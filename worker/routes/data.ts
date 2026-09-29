// A6 Data: export (F10) and delete a person's data (F11, all-or-nothing).
import { Hono } from "hono";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import type { AppEnv } from "../types";
import { ADMIN, allow } from "../auth";
import { body, badRequest, conflict, idParam, notAvailable } from "../lib/http";
import { getDb, getRoleMap, getVersion, today, type DB } from "../lib/state";
import { iso, toCsv, type Cell } from "../lib/csv";
import { REJECT_REASONS } from "./review";
import { FOLLOWUP_SLA_DAYS } from "../lib/flags";
import {
  answers, attemptTopicScores, attempts, deletionLog, flagTopics, flags, followups, formQuestions,
  participation, people, questions, sessions, signInLinks, topics,
} from "../db/schema";
import { addDays, workingDaysBetween } from "../../shared/dates";

const LETTERS = "ABCD";

async function personCounts(db: DB, personId: number) {
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const attemptIds = db.select({ id: attempts.id }).from(attempts).where(eq(attempts.personId, personId));
  const flagIds = db.select({ id: flags.id }).from(flags).where(eq(flags.personId, personId));
  return {
    attempts: await n(db.select({ n: sql<number>`count(*)` }).from(attempts).where(eq(attempts.personId, personId))),
    answers: await n(db.select({ n: sql<number>`count(*)` }).from(answers).where(inArray(answers.attemptId, attemptIds))),
    flags: await n(db.select({ n: sql<number>`count(*)` }).from(flags).where(eq(flags.personId, personId))),
    followups: await n(db.select({ n: sql<number>`count(*)` }).from(followups).where(inArray(followups.flagId, flagIds))),
    participation: await n(db.select({ n: sql<number>`count(*)` }).from(participation).where(eq(participation.personId, personId))),
  };
}

/** Day 0 (Form A submission), day 90 (the review), and the retention date (day 90 + 30). */
export async function keyDates(db: DB, studentId: number | undefined) {
  if (studentId === undefined) return { dayZero: null, dayNinety: null, retention: null };
  const [a] = await db.select().from(attempts).where(eq(attempts.personId, studentId)).orderBy(attempts.id).limit(1);
  if (!a) return { dayZero: null, dayNinety: null, retention: null };
  const d90 = addDays(a.submittedDate, 90);
  return { dayZero: a.submittedDate, dayNinety: d90, retention: addDays(d90, 30) };
}

async function hasExportData(db: DB) {
  const [a] = await db.select({ id: attempts.id }).from(attempts).limit(1);
  const [p] = await db.select({ id: participation.id }).from(participation).limit(1);
  const [q] = await db.select({ id: questions.id }).from(questions).where(inArray(questions.status, ["approved", "rejected", "discarded"])).limit(1);
  return !!(a || p || q);
}

export const dataRoutes = new Hono<AppEnv>()
  .get("/export", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    if (!(await hasExportData(db))) return conflict(c, "Nothing to export yet");
    const [names, topicRows, version] = await Promise.all([
      db.select({ id: people.id, name: people.name }).from(people),
      db.select().from(topics),
      getVersion(db),
    ]);
    const person = new Map(names.map((p) => [p.id, p.name]));
    const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

    // 1. attempts (one row per attempt, per-topic scores as columns)
    const att = await db.select().from(attempts).orderBy(attempts.id);
    const scores = await db.select().from(attemptTopicScores);
    const scoreTopics = [...new Set(scores.map((s) => s.topicId))].sort((a, b) =>
      (topicName.get(a) ?? "").localeCompare(topicName.get(b) ?? ""),
    );
    const attemptsCsv = toCsv(
      ["attempt_id", "person", "version", "form", "submitted_at", "overall_correct", "overall_total",
        ...scoreTopics.flatMap((t) => [`${topicName.get(t)} correct`, `${topicName.get(t)} total`])],
      att.map((a): Cell[] => [
        a.id, person.get(a.personId), 1, a.form, iso(a.submittedAt), a.overallCorrect, a.overallTotal,
        ...scoreTopics.flatMap((t) => {
          const s = scores.find((x) => x.attemptId === a.id && x.topicId === t);
          return [s?.correct ?? "", s?.total ?? ""];
        }),
      ]),
    );

    // 2. answers (question IDs let a confirmed wrong question be removed in the analysis)
    const ans = await db.select().from(answers).orderBy(answers.attemptId, answers.questionId);
    const answersCsv = toCsv(
      ["attempt_id", "question_id", "topic", "chosen_option", "correct_option", "correct"],
      ans.map((a) => [a.attemptId, a.questionId, topicName.get(a.topicId), LETTERS[a.chosenIndex], LETTERS[a.correctIndex], a.isCorrect]),
    );

    // 3. flags_followups (one row per flagged topic)
    const fl = await db.select().from(flags).orderBy(flags.id);
    const ft = await db.select().from(flagTopics);
    const fu = await db.select().from(followups);
    const flagsCsv = toCsv(
      ["flag_id", "attempt_id", "person", "topic", "flag_score", "flagged_at", "follow_up_owner", "follow_up_date", "note", "logged_at",
        "working_days_flag_to_followup", "within_sla"],
      ft
        .sort((a, b) => a.flagId - b.flagId || (topicName.get(a.topicId) ?? "").localeCompare(topicName.get(b.topicId) ?? ""))
        .map((t): Cell[] => {
          const f = fl.find((x) => x.id === t.flagId)!;
          const log = fu.find((x) => x.flagId === t.flagId && x.topicId === t.topicId);
          const wd = log ? workingDaysBetween(f.flaggedDate, log.followupDate) : null;
          return [
            f.id, f.attemptId, person.get(f.personId), topicName.get(t.topicId), `${t.correct} of ${t.total}`, iso(f.flaggedAt),
            f.ownerPersonId ? person.get(f.ownerPersonId) : "", log?.followupDate ?? "", log?.note ?? "", iso(log?.loggedAt),
            wd ?? "", log ? wd! <= FOLLOWUP_SLA_DAYS : "",
          ];
        }),
    );

    // 4. review_outcomes (discarded drafts included as "discarded invalid"; left out of M3)
    const qs = await db.select().from(questions).orderBy(questions.id);
    const used = version ? await db.select().from(formQuestions).where(eq(formQuestions.versionId, version.id)) : [];
    const outcome = (q: (typeof qs)[number]) =>
      q.status === "discarded" ? "discarded invalid"
        : q.status === "rejected" ? "rejected"
          : q.status === "pending" ? "waiting for review"
            : q.editKind === "minor" ? "edited minor"
              : q.editKind === "substantial" ? "edited substantial"
                : "approved as is";
    const reviewCsv = toCsv(
      ["question_id", "topic", "outcome", "reason", "reviewer", "reviewed_at", "used_in"],
      qs.map((q): Cell[] => {
        const u = used.find((x) => x.questionId === q.id);
        const reason =
          q.status === "discarded"
            ? q.discardReason ?? ""
            : [...(q.rejectReasons ?? []).map((r) => REJECT_REASONS[r as keyof typeof REJECT_REASONS] ?? r), q.rejectNote ?? ""].filter(Boolean).join("; ");
        return [q.id, topicName.get(q.topicId), outcome(q), reason, q.reviewedBy ? person.get(q.reviewedBy) : "", iso(q.reviewedAt),
          u ? `Form ${u.form}` : "not used"];
      }),
    );

    // 5. participation
    const part = await db.select().from(participation).orderBy(participation.id);
    const partCsv = toCsv(
      ["person", "notice_version", "choice", "recorded_at"],
      part.map((p) => [person.get(p.personId), p.noticeVersion, p.choice === "take_part" ? "take part" : "declined", iso(p.recordedAt)]),
    );

    const zip = zipSync({
      "attempts.csv": strToU8(attemptsCsv),
      "answers.csv": strToU8(answersCsv),
      "flags_followups.csv": strToU8(flagsCsv),
      "review_outcomes.csv": strToU8(reviewCsv),
      "participation.csv": strToU8(partCsv),
    });
    const filename = `knowledge-check-export-${today(c.env)}.zip`;
    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  })

  .get("/data/people", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const roles = await getRoleMap(db);
    const ids = new Set<number>();
    for (const r of await db.select({ id: attempts.personId }).from(attempts)) ids.add(r.id);
    for (const r of await db.select({ id: flags.personId }).from(flags)) ids.add(r.id);
    for (const r of await db.select({ id: participation.personId }).from(participation)) ids.add(r.id);
    const list = ids.size ? await db.select().from(people).where(inArray(people.id, [...ids])).orderBy(people.name) : [];
    const out = [];
    for (const p of list) out.push({ id: p.id, name: p.name, counts: await personCounts(db, p.id) });
    const deletions = await db.select().from(deletionLog).orderBy(desc(deletionLog.id));
    return c.json(
      {
        people: out,
        studentName: roles.student?.name ?? null,
        ...(await keyDates(db, roles.student?.personId)),
        hasExportData: await hasExportData(db),
        deletions: deletions.map((d) => ({ name: d.personName, date: iso(d.deletedAt).slice(0, 10), by: d.deletedByName })),
      },
      200,
    );
  })

  // All-or-nothing: counts first, then one db.batch() (a single D1 transaction)
  // that deletes the data and writes the deletion log.
  .delete("/data/people/:id", allow(...ADMIN), body<{ confirmName: string }>(), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    const [p] = await db.select().from(people).where(eq(people.id, id));
    if (!p) return notAvailable(c);
    const confirm = c.req.valid("json").confirmName;
    if (typeof confirm !== "string" || confirm.trim() !== p.name) return badRequest(c, "Type the person's full name to confirm.");
    const counts = await personCounts(db, id);
    const me = c.get("me");
    const attemptIds = db.select({ id: attempts.id }).from(attempts).where(eq(attempts.personId, id));
    const flagIds = db.select({ id: flags.id }).from(flags).where(eq(flags.personId, id));
    try {
      await db.batch([
        db.delete(answers).where(inArray(answers.attemptId, attemptIds)),
        db.delete(attemptTopicScores).where(inArray(attemptTopicScores.attemptId, attemptIds)),
        db.delete(followups).where(inArray(followups.flagId, flagIds)),
        db.delete(flagTopics).where(inArray(flagTopics.flagId, flagIds)),
        db.delete(flags).where(eq(flags.personId, id)),
        db.delete(attempts).where(eq(attempts.personId, id)),
        db.delete(participation).where(eq(participation.personId, id)),
        db.delete(signInLinks).where(eq(signInLinks.personId, id)),
        db.delete(sessions).where(eq(sessions.personId, id)),
        db.insert(deletionLog).values({ personId: id, personName: p.name, deletedAt: Date.now(), deletedByName: me.name, counts }),
      ]);
    } catch {
      console.error(`delete_failed person=${id}`);
      return c.json({ error: "Nothing was deleted. Try again." }, 500);
    }
    return c.json({ ok: true, counts }, 200);
  });
