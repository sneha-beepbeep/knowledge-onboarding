// Student routes (T1, T2, T3). No ID parameters: the person always comes from
// the session. Correct answers and drafts are never returned before submission,
// and follow-up notes are never returned at all.
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { allow } from "../auth";
import { body, badRequest, conflict } from "../lib/http";
import { getDb, getPilot, getRoleMap, getVersion, today } from "../lib/state";
import { currentChoice, latestParticipation } from "../lib/student";
import { NOTICE_VERSION, renderNotice } from "../lib/notice";
import { formBState, FOLLOWUP_SLA_DAYS } from "../lib/flags";
import { attemptFor, formGate, formQuestionsFor, type Form } from "../lib/forms";
import { participation } from "../db/schema";
import { addDays, addWorkingDays } from "../../shared/dates";
import { isBelowThreshold } from "../../shared/scoring";

const parseForm = (v: string | undefined): Form | null => (v === "a" ? "A" : v === "b" ? "B" : null);

export const studentRoutes = new Hono<AppEnv>()
  .get("/my/checks", allow("student"), async (c) => {
    const db = getDb(c.env);
    const me = c.get("me").personId;
    const [p, version, roles] = await Promise.all([getPilot(db), getVersion(db), getRoleMap(db)]);
    const managerName = roles.follow_up_owner?.name ?? null;
    const t = today(c.env);
    if (!version || !p.formASentAt) return c.json({ state: "nothing_sent" as const, managerName }, 200);
    const choice = await currentChoice(db, me);
    const aQs = await formQuestionsFor(db, version.id, "A");
    const count = aQs.length;
    if (!choice) return c.json({ state: "notice" as const, managerName }, 200);
    const a = await attemptFor(db, me, version.id, "A");
    const b = a ? await attemptFor(db, me, version.id, "B") : null;
    // Declining (or declining later) shows the declined card, unless both checks are already done.
    if (choice.choice === "decline" && !b) return c.json({ state: "declined" as const, managerName }, 200);
    if (!a) return c.json({ state: "form_a" as const, managerName, questionCount: count }, 200);

    if (b) return c.json({ state: "both_done" as const, managerName, personId: me, attemptAId: a.id, attemptBId: b.id }, 200);
    const fb = await formBState(db, me, version.id);
    // Students see topics, due date and "done [date]" only; never the note (decision 9).
    const followups = (fb.flag?.topics ?? []).map((x) => ({ topic: x.name, doneDate: x.followup?.date ?? null }));
    if (!fb.available)
      return c.json(
        {
          state: "followup_pending" as const,
          managerName,
          attemptAId: a.id,
          doneDate: a.submittedDate,
          dueDate: fb.flag!.dueDate,
          followups,
        },
        200,
      );
    return c.json(
      {
        state: fb.flag ? ("form_b" as const) : ("form_b_no_flag" as const),
        managerName,
        attemptAId: a.id,
        doneDate: a.submittedDate,
        dueDate: fb.dueDate!,
        overdue: t > fb.dueDate!,
        questionCount: count,
        followups,
      },
      200,
    );
  })

  .get("/my/notice", allow("student"), async (c) => {
    const db = getDb(c.env);
    const me = c.get("me").personId;
    const [roles, version, p] = await Promise.all([getRoleMap(db), getVersion(db), getPilot(db)]);
    const qs = version ? await formQuestionsFor(db, version.id, "A") : [];
    const a = version ? await attemptFor(db, me, version.id, "A") : null;
    const holder = (r: keyof typeof roles) => (roles[r] ? { personId: roles[r]!.personId, name: roles[r]!.name } : undefined);
    const notice = renderNotice({
      bankOwner: holder("bank_owner"),
      cpo: holder("cpo"),
      manager: holder("follow_up_owner"),
      reviewer: holder("reviewer"),
      questionCount: qs.length || undefined,
      topics: [...new Set(qs.map((q) => q.topicName))],
      thresholdPct: version?.thresholdPct ?? 70,
      retentionDate: a ? addDays(addDays(a.submittedDate, 90), 30) : undefined,
    });
    const latest = await latestParticipation(db, me);
    return c.json(
      {
        ...notice,
        sent: !!p.formASentAt && !!version,
        currentChoice: latest && latest.noticeVersion === NOTICE_VERSION ? latest.choice : null,
        formASubmitted: !!a,
      },
      200,
    );
  })

  .post("/my/participation", allow("student"), body<{ choice: "take_part" | "decline" }>(), async (c) => {
    const choice = c.req.valid("json").choice;
    if (choice !== "take_part" && choice !== "decline") return badRequest(c, "Choose Take part or I'd rather not.");
    const db = getDb(c.env);
    const p = await getPilot(db);
    if (!p.formASentAt) return conflict(c, "Nothing to do yet.");
    await db.insert(participation).values({ personId: c.get("me").personId, noticeVersion: NOTICE_VERSION, choice, recordedAt: Date.now() });
    return c.json({ ok: true, choice }, 200);
  })

  .get("/my/forms/:form", allow("student"), async (c) => {
    const form = parseForm(c.req.param("form"));
    if (!form) return c.json({ error: "This page isn't available to you." }, 404);
    const db = getDb(c.env);
    const gate = await formGate(db, c.get("me").personId, form);
    if (!gate.ok) return c.json({ error: gate.code, code: gate.code, attemptId: gate.attemptId ?? null, managerName: gate.managerName ?? null }, 409);
    const qs = await formQuestionsFor(db, gate.version.id, form);
    const topics: { id: number; name: string; questions: { id: number; text: string; options: string[] }[] }[] = [];
    for (const q of qs) {
      let t = topics.find((x) => x.id === q.topicId);
      if (!t) topics.push((t = { id: q.topicId, name: q.topicName, questions: [] }));
      // Correct answers are left out: only text and options go to the browser.
      t.questions.push({ id: q.id, text: q.text, options: q.options });
    }
    return c.json({ form, checkNumber: form === "A" ? 1 : 2, total: qs.length, topics }, 200);
  })

  // Scores the attempt, stores it and creates the flag, all in one D1 transaction.
  .post("/my/forms/:form/attempt", allow("student"), body<{ answers: Record<string, number> }>(), async (c) => {
    const form = parseForm(c.req.param("form"));
    if (!form) return c.json({ error: "This page isn't available to you." }, 404);
    const db = getDb(c.env);
    const me = c.get("me").personId;
    const gate = await formGate(db, me, form);
    if (!gate.ok) return c.json({ error: gate.code, code: gate.code, attemptId: gate.attemptId ?? null, managerName: gate.managerName ?? null }, 409);
    const version = gate.version;
    const qs = await formQuestionsFor(db, version.id, form);
    const given = c.req.valid("json").answers;
    const answersIn = given && typeof given === "object" && !Array.isArray(given) ? given : {};
    const missing = qs.filter((q) => {
      const v = (answersIn as Record<string, unknown>)[String(q.id)];
      return !(typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3);
    });
    if (missing.length)
      return c.json(
        { error: `${missing.length} ${missing.length === 1 ? "question still needs" : "questions still need"} an answer.`, missing: missing.map((q) => q.id) },
        400,
      );

    const scored = qs.map((q) => {
      const chosen = (answersIn as Record<string, number>)[String(q.id)];
      return { ...q, chosen, isCorrect: chosen === q.correctIndex };
    });
    const topicIds = [...new Set(scored.map((q) => q.topicId))];
    const topicScores = topicIds.map((tid) => {
      const tq = scored.filter((q) => q.topicId === tid);
      const correct = tq.filter((q) => q.isCorrect).length;
      return { topicId: tid, correct, total: tq.length, below: isBelowThreshold(correct, tq.length, version.thresholdPct) };
    });
    const overallCorrect = scored.filter((q) => q.isCorrect).length;
    const now = Date.now();
    const day = today(c.env, now);
    const roles = await getRoleMap(db);
    const weak = topicScores.filter((t) => t.below);

    const D = c.env.DB;
    const aid = "(SELECT id FROM attempts WHERE person_id = ? AND version_id = ? AND form = ?)";
    const aBind = [me, version.id, form] as const;
    const stmts = [
      D.prepare(
        "INSERT INTO attempts (person_id, version_id, form, submitted_at, submitted_date, overall_correct, overall_total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(me, version.id, form, now, day, overallCorrect, scored.length),
      ...topicScores.map((t) =>
        D.prepare(`INSERT INTO attempt_topic_scores (attempt_id, topic_id, correct, total, below_threshold) VALUES (${aid}, ?, ?, ?, ?)`).bind(
          ...aBind,
          t.topicId,
          t.correct,
          t.total,
          t.below ? 1 : 0,
        ),
      ),
      ...scored.map((q) =>
        D.prepare(`INSERT INTO answers (attempt_id, question_id, topic_id, chosen_index, correct_index, is_correct) VALUES (${aid}, ?, ?, ?, ?, ?)`).bind(
          ...aBind,
          q.id,
          q.topicId,
          q.chosen,
          q.correctIndex,
          q.isCorrect ? 1 : 0,
        ),
      ),
    ];
    // F7: one flag per Form A attempt listing all weak topics. Form B never flags.
    if (form === "A" && weak.length) {
      stmts.push(
        D.prepare(
          `INSERT INTO flags (attempt_id, person_id, owner_person_id, flagged_at, flagged_date, due_date) VALUES (${aid}, ?, ?, ?, ?, ?)`,
        ).bind(...aBind, me, roles.follow_up_owner?.personId ?? null, now, day, addWorkingDays(day, FOLLOWUP_SLA_DAYS)),
        ...weak.map((t) =>
          D.prepare(
            `INSERT INTO flag_topics (flag_id, topic_id, correct, total) VALUES ((SELECT id FROM flags WHERE attempt_id = ${aid}), ?, ?, ?)`,
          ).bind(...aBind, t.topicId, t.correct, t.total),
        ),
      );
    }
    try {
      await D.batch(stmts);
    } catch (e) {
      const again = await attemptFor(db, me, version.id, form);
      if (again) return c.json({ error: "already_submitted", code: "already_submitted", attemptId: again.id, managerName: null }, 409);
      throw e;
    }
    const saved = await attemptFor(db, me, version.id, form);
    return c.json({ attemptId: saved!.id }, 201);
  });

