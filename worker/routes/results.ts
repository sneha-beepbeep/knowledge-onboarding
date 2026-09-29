// R1 Results for one attempt and R2 comparison (shared views; F5-F7, F9).
// Same layout for everyone; the overall score goes to admins only, the flag
// link to the follow-up owner and admins only, and notes to nobody here.
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv, Me } from "../types";
import { has, isAdmin } from "../auth";
import { idParam, notAvailable } from "../lib/http";
import { getDb, getRoleMap, type DB } from "../lib/state";
import { loadFlags } from "../lib/flags";
import { answers, attemptTopicScores, attempts, people, questions, topics, versions } from "../db/schema";

/** STU for their own, FUO for the current student only, ADM for all (technical plan §3). */
export async function canSeePerson(db: DB, me: Me, personId: number): Promise<boolean> {
  if (isAdmin(me)) return true;
  if (me.personId === personId && has(me, "student")) return true;
  if (has(me, "follow_up_owner")) {
    const roles = await getRoleMap(db);
    return roles.student?.personId === personId;
  }
  return false;
}

async function topicScores(db: DB, attemptId: number) {
  return db
    .select({ topicId: attemptTopicScores.topicId, name: topics.name, correct: attemptTopicScores.correct, total: attemptTopicScores.total, below: attemptTopicScores.belowThreshold })
    .from(attemptTopicScores)
    .innerJoin(topics, eq(topics.id, attemptTopicScores.topicId))
    .where(eq(attemptTopicScores.attemptId, attemptId))
    .orderBy(topics.name);
}

export const resultRoutes = new Hono<AppEnv>()
  .get("/attempts/:id", async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const me = c.get("me");
    const db = getDb(c.env);
    const [a] = await db
      .select({ a: attempts, name: people.name, thr: versions.thresholdPct })
      .from(attempts)
      .innerJoin(people, eq(people.id, attempts.personId))
      .innerJoin(versions, eq(versions.id, attempts.versionId))
      .where(eq(attempts.id, id));
    if (!a || !(await canSeePerson(db, me, a.a.personId))) return notAvailable(c);
    const roles = await getRoleMap(db);
    const scores = await topicScores(db, id);
    const ans = await db
      .select({
        questionId: answers.questionId,
        topicId: answers.topicId,
        chosenIndex: answers.chosenIndex,
        correctIndex: answers.correctIndex,
        isCorrect: answers.isCorrect,
        text: questions.text,
        options: questions.options,
        documentName: questions.documentName,
      })
      .from(answers)
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .where(eq(answers.attemptId, id))
      .orderBy(answers.topicId, answers.questionId);
    const [flag] = (await loadFlags(db, { personId: a.a.personId })).filter((f) => f.attemptId === id);
    const [other] = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.personId, a.a.personId), eq(attempts.versionId, a.a.versionId), eq(attempts.form, a.a.form === "A" ? "B" : "A")));
    const seesFlagLink = isAdmin(me) || (has(me, "follow_up_owner") && me.personId !== a.a.personId);
    return c.json(
      {
        viewer: me.personId === a.a.personId ? ("self" as const) : ("other" as const),
        personId: a.a.personId,
        studentName: a.name,
        managerName: roles.follow_up_owner?.name ?? null,
        form: a.a.form,
        checkNumber: a.a.form === "A" ? 1 : 2,
        submittedDate: a.a.submittedDate,
        thresholdPct: a.thr,
        topics: scores,
        flag: flag ? { dueDate: flag.dueDate, id: seesFlagLink ? flag.id : null } : null,
        // D3: the overall score is shown to admins only.
        overall: isAdmin(me) ? { correct: a.a.overallCorrect, total: a.a.overallTotal } : null,
        answers: ans,
        otherAttemptId: other?.id ?? null,
        bothDone: !!other,
      },
      200,
    );
  })

  .get("/comparison/:personId", async (c) => {
    const personId = idParam(c.req.param("personId"));
    if (!personId) return notAvailable(c);
    const me = c.get("me");
    const db = getDb(c.env);
    if (!(await canSeePerson(db, me, personId))) return notAvailable(c);
    const [p] = await db.select().from(people).where(eq(people.id, personId));
    const list = await db.select().from(attempts).where(eq(attempts.personId, personId));
    const a = list.find((x) => x.form === "A");
    const b = list.find((x) => x.form === "B");
    if (!p || !a) return notAvailable(c);
    const roles = await getRoleMap(db);
    const base = {
      viewer: me.personId === personId ? ("self" as const) : ("other" as const),
      studentName: p.name,
      managerName: roles.follow_up_owner?.name ?? null,
      attemptAId: a.id,
      attemptBId: b?.id ?? null,
    };
    if (!b) return c.json({ ...base, bothDone: false, rows: [], perTopic: null }, 200);
    const [sa, sb] = await Promise.all([topicScores(db, a.id), topicScores(db, b.id)]);
    const [flag] = (await loadFlags(db, { personId })).filter((f) => f.attemptId === a.id);
    const rows = sa.map((t) => {
      const tb = sb.find((x) => x.topicId === t.topicId);
      const fu = flag?.topics.find((x) => x.topicId === t.topicId)?.followup?.date ?? null;
      return {
        topicId: t.topicId,
        name: t.name,
        a: { correct: t.correct, total: t.total },
        b: tb ? { correct: tb.correct, total: tb.total } : null,
        change: tb ? tb.correct - t.correct : null,
        weakInA: t.below,
        followedUpDate: fu,
      };
    });
    const perTopic = sa[0]?.total ?? null;
    return c.json({ ...base, bothDone: true, rows, perTopic }, 200);
  });
