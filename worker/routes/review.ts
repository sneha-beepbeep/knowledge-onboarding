// V1 Review queue, V2 Review a question, V3 Question statistics (F2, F3, §6, M3).
// Responses here never contain data about the student.
import { Hono } from "hono";
import { and, asc, countDistinct, eq, inArray, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow, has } from "../auth";
import { body, badRequest, conflict, frozen, idParam, notAvailable, str } from "../lib/http";
import { getDb, getRoleMap, getVersion } from "../lib/state";
import { m3Figures } from "../lib/m3";
import { answers, attempts, formQuestions, people, questions, topics } from "../db/schema";

export const REJECT_REASONS = {
  incorrect: "Incorrect or outdated",
  multiple: "More than one right answer",
  weak_options: "Weak wrong options",
  trivia: "Trivia or wording",
  confidential: "Confidential",
  wrong_topic: "Wrong topic",
  other: "Other",
} as const;
type RejectReason = keyof typeof REJECT_REASONS;

/** Minimum distinct respondents before answer statistics are shown (decision 1). */
export const MIN_RESPONDENTS = 5;

const FILTERS = ["waiting", "approved", "edited", "rejected"] as const;

async function queueOrder(db: ReturnType<typeof getDb>) {
  return db
    .select({ id: questions.id, status: questions.status })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(ne(questions.status, "discarded"))
    .orderBy(asc(topics.name), asc(questions.id));
}

function validateEdit(b: { text?: unknown; options?: unknown; correctIndex?: unknown }) {
  const errors: { field: string; message: string }[] = [];
  const text = str(b.text);
  if (!text) errors.push({ field: "edit-text", message: "Add the question text." });
  else if (text.length > 500) errors.push({ field: "edit-text", message: "The question is too long (500 characters at most)." });
  const opts = Array.isArray(b.options) && b.options.length === 4 ? b.options.map(str) : null;
  if (!opts) errors.push({ field: "edit-option-0", message: "All 4 options are required." });
  else {
    opts.forEach((o, i) => {
      if (!o) errors.push({ field: `edit-option-${i}`, message: `Add option ${"ABCD"[i]}.` });
      else if (o.length > 200) errors.push({ field: `edit-option-${i}`, message: `Option ${"ABCD"[i]} is too long.` });
    });
    if (opts.every(Boolean) && new Set(opts.map((o) => o.toLowerCase())).size !== 4)
      errors.push({ field: "edit-option-0", message: "The 4 options must be different." });
  }
  const ci = b.correctIndex;
  if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci > 3)
    errors.push({ field: "edit-correct", message: "Choose exactly one correct option." });
  return { errors, text, options: opts ?? [], correctIndex: ci as number };
}

export const reviewRoutes = new Hono<AppEnv>()
  .get("/review/questions", allow("reviewer", ...ADMIN), async (c) => {
    const f = (c.req.query("status") ?? "waiting") as (typeof FILTERS)[number];
    if (!FILTERS.includes(f)) return badRequest(c, "Unknown filter.");
    const db = getDb(c.env);
    const [version, roles] = await Promise.all([getVersion(db), getRoleMap(db)]);
    const all = await db
      .select({
        id: questions.id,
        text: questions.text,
        status: questions.status,
        editKind: questions.editKind,
        topicId: questions.topicId,
        topicName: topics.name,
      })
      .from(questions)
      .innerJoin(topics, eq(topics.id, questions.topicId))
      .where(ne(questions.status, "discarded"))
      .orderBy(asc(topics.name), asc(questions.id));
    const waiting = all.filter((q) => q.status === "pending");
    const pick = {
      waiting: (q: (typeof all)[number]) => q.status === "pending",
      approved: (q: (typeof all)[number]) => q.status === "approved" && q.editKind === "none",
      edited: (q: (typeof all)[number]) => q.status === "approved" && q.editKind !== "none",
      rejected: (q: (typeof all)[number]) => q.status === "rejected",
    }[f];
    return c.json(
      {
        published: !!version,
        filter: f,
        counts: { waiting: waiting.length, reviewed: all.length - waiting.length, total: all.length },
        firstWaitingId: waiting[0]?.id ?? null,
        bankOwnerName: roles.bank_owner?.name ?? null,
        items: all.filter(pick).map((q) => ({
          id: q.id,
          topicName: q.topicName,
          start: q.text.length > 110 ? q.text.slice(0, 107) + "…" : q.text,
          status: q.status,
          editKind: q.editKind,
        })),
      },
      200,
    );
  })

  .get("/review/questions/:id", allow("reviewer", ...ADMIN), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    const [q] = await db
      .select({ q: questions, topicName: topics.name })
      .from(questions)
      .innerJoin(topics, eq(topics.id, questions.topicId))
      .where(and(eq(questions.id, id), ne(questions.status, "discarded")));
    if (!q) return notAvailable(c);
    const order = await queueOrder(db);
    const idx = order.findIndex((x) => x.id === id);
    const after = [...order.slice(idx + 1), ...order.slice(0, idx)];
    const nextWaiting = after.find((x) => x.status === "pending");
    let updatedByName: string | null = null;
    if (q.q.updatedBy) {
      const [p] = await db.select({ name: people.name }).from(people).where(eq(people.id, q.q.updatedBy));
      updatedByName = p?.name ?? null;
    }
    const version = await getVersion(db);
    return c.json(
      {
        id: q.q.id,
        topic: { id: q.q.topicId, name: q.topicName },
        text: q.q.text,
        options: q.q.options,
        correctIndex: q.q.correctIndex,
        status: q.q.status,
        editKind: q.q.editKind,
        rejectReasons: (q.q.rejectReasons ?? []).map((r) => REJECT_REASONS[r as RejectReason] ?? r),
        rejectNote: q.q.rejectNote,
        source: {
          documentName: q.q.documentName,
          versionDate: q.q.documentVersionDate,
          quote: q.q.quote,
          contextBefore: q.q.contextBefore,
          contextAfter: q.q.contextAfter,
          removed: q.q.documentId === null,
        },
        updatedAt: q.q.updatedAt,
        updatedByName,
        prevId: idx > 0 ? order[idx - 1].id : null,
        nextId: idx >= 0 && idx < order.length - 1 ? order[idx + 1].id : null,
        nextWaitingId: nextWaiting?.id ?? null,
        published: !!version,
        canDecide: has(c.get("me"), "reviewer") && !version,
        rejectReasonOptions: Object.entries(REJECT_REASONS).map(([code, label]) => ({ code, label })),
      },
      200,
    );
  })

  .post(
    "/review/questions/:id/decision",
    allow("reviewer"),
    body<{
      action: "approve" | "edit" | "reject";
      expectedUpdatedAt: number;
      text?: string;
      options?: string[];
      correctIndex?: number;
      editKind?: "minor" | "substantial";
      reasons?: string[];
      note?: string;
    }>(),
    async (c) => {
      const id = idParam(c.req.param("id"));
      if (!id) return notAvailable(c);
      const db = getDb(c.env);
      const [q] = await db.select().from(questions).where(and(eq(questions.id, id), ne(questions.status, "discarded")));
      if (!q) return notAvailable(c);
      if (await getVersion(db)) return frozen(c);
      const b = c.req.valid("json");
      const me = c.get("me");
      const now = Date.now();

      let set: Partial<typeof questions.$inferInsert>;
      if (b.action === "approve") set = { status: "approved", editKind: "none" };
      else if (b.action === "edit") {
        const v = validateEdit(b);
        if (v.errors.length) return c.json({ error: v.errors[0].message, errors: v.errors }, 400);
        if (b.editKind !== "minor" && b.editKind !== "substantial")
          return c.json({ error: "Say what kind of change this was.", errors: [{ field: "edit-kind-minor", message: "Say what kind of change this was." }] }, 400);
        set = { status: "approved", editKind: b.editKind, text: v.text, options: v.options, correctIndex: v.correctIndex };
      } else if (b.action === "reject") {
        const reasons = Array.isArray(b.reasons) ? [...new Set(b.reasons)] : [];
        if (reasons.some((r) => !(r in REJECT_REASONS))) return badRequest(c, "Unknown reason.");
        const note = str(b.note);
        if (note.length > 300) return badRequest(c, "The note is too long.");
        set = { status: "rejected", editKind: "none", rejectReasons: reasons, rejectNote: note || null };
      } else return badRequest(c, "Choose Approve, Edit or Reject.");

      if (q.status !== "pending") return conflict(c, "This question was already reviewed. Undo the decision first.");
      if (b.expectedUpdatedAt !== q.updatedAt) return stale(c, db, q.updatedBy);
      const res = await db
        .update(questions)
        .set({ ...set, reviewedBy: me.personId, reviewedAt: now, updatedAt: now, updatedBy: me.personId })
        .where(and(eq(questions.id, id), eq(questions.updatedAt, q.updatedAt), eq(questions.status, "pending")))
        .returning({ id: questions.id });
      if (!res.length) return stale(c, db, null);
      return c.json({ ok: true, updatedAt: now }, 200);
    },
  )

  .post("/review/questions/:id/undo", allow("reviewer"), body<{ expectedUpdatedAt: number }>(), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    const [q] = await db.select().from(questions).where(and(eq(questions.id, id), ne(questions.status, "discarded")));
    if (!q) return notAvailable(c);
    if (await getVersion(db)) return frozen(c);
    if (q.status === "pending") return conflict(c, "There's no decision to undo.");
    if (c.req.valid("json").expectedUpdatedAt !== q.updatedAt) return stale(c, db, q.updatedBy);
    const orig = (q.aiOriginal ?? {}) as { text?: string; options?: string[]; correctIndex?: number };
    const now = Date.now();
    await db
      .update(questions)
      .set({
        status: "pending",
        editKind: "none",
        rejectReasons: null,
        rejectNote: null,
        reviewedBy: null,
        reviewedAt: null,
        text: orig.text ?? q.text,
        options: orig.options ?? q.options,
        correctIndex: orig.correctIndex ?? q.correctIndex,
        updatedAt: now,
        updatedBy: c.get("me").personId,
      })
      .where(and(eq(questions.id, id), eq(questions.updatedAt, q.updatedAt)));
    return c.json({ ok: true, updatedAt: now }, 200);
  })

  // V3. Answer statistics are removed on the server below 5 distinct respondents;
  // no names, attempt dates or per-person data are ever included.
  .get("/stats", allow("reviewer", ...ADMIN), async (c) => {
    const db = getDb(c.env);
    const m3 = await m3Figures(db);
    const version = await getVersion(db);
    const out: {
      id: number;
      topic: string;
      start: string;
      form: "A" | "B";
      shown: boolean;
      pctCorrect?: number;
      optionCounts?: number[];
    }[] = [];
    if (version) {
      const fq = await db
        .select({ id: questions.id, text: questions.text, correctIndex: questions.correctIndex, topic: topics.name, form: formQuestions.form })
        .from(formQuestions)
        .innerJoin(questions, eq(questions.id, formQuestions.questionId))
        .innerJoin(topics, eq(topics.id, formQuestions.topicId))
        .where(eq(formQuestions.versionId, version.id))
        .orderBy(formQuestions.form, asc(topics.name), formQuestions.position);
      const ids = fq.map((q) => q.id);
      const resp = ids.length
        ? await db
            .select({ questionId: answers.questionId, n: countDistinct(attempts.personId) })
            .from(answers)
            .innerJoin(attempts, eq(attempts.id, answers.attemptId))
            .where(inArray(answers.questionId, ids))
            .groupBy(answers.questionId)
        : [];
      const shownIds = resp.filter((r) => Number(r.n) >= MIN_RESPONDENTS).map((r) => r.questionId);
      const opt = shownIds.length
        ? await db
            .select({ questionId: answers.questionId, chosen: answers.chosenIndex, n: sql<number>`count(*)` })
            .from(answers)
            .where(inArray(answers.questionId, shownIds))
            .groupBy(answers.questionId, answers.chosenIndex)
        : [];
      for (const q of fq) {
        const start = q.text.length > 90 ? q.text.slice(0, 87) + "…" : q.text;
        if (!shownIds.includes(q.id)) {
          out.push({ id: q.id, topic: q.topic, start, form: q.form, shown: false });
          continue;
        }
        const counts = [0, 1, 2, 3].map((i) => Number(opt.find((o) => o.questionId === q.id && o.chosen === i)?.n ?? 0));
        const total = counts.reduce((a, b) => a + b, 0);
        out.push({
          id: q.id,
          topic: q.topic,
          start,
          form: q.form,
          shown: true,
          pctCorrect: total ? Math.round((counts[q.correctIndex] * 100) / total) : 0,
          optionCounts: counts,
        });
      }
    }
    return c.json({ m3, published: !!version, minRespondents: MIN_RESPONDENTS, questions: out }, 200);
  });

async function stale(c: Parameters<typeof conflict>[0], db: ReturnType<typeof getDb>, by: number | null) {
  let name: string | null = null;
  if (by) {
    const [p] = await db.select({ name: people.name }).from(people).where(eq(people.id, by));
    name = p?.name ?? null;
  }
  return c.json(
    { error: `This question was updated by ${name ?? "someone else"}. Reload to see the latest version.`, code: "stale" },
    409,
  );
}
