// A4 Publish version (F3, F4, F7). The server re-checks every publish rule.
import { Hono } from "hono";
import { asc, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow } from "../auth";
import { body, badRequest, conflict, frozen } from "../lib/http";
import { dateOf, getDb, getPilot, getVersion } from "../lib/state";
import { checkAssignment, defaultSplit } from "../lib/split";
import { formQuestions, questions, topics } from "../db/schema";
import { DEFAULT_THRESHOLD } from "../../shared/scoring";

export const publishRoutes = new Hono<AppEnv>()
  .get("/publish", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const [p, version] = await Promise.all([getPilot(db), getVersion(db)]);
    const rows = await db
      .select({ id: questions.id, text: questions.text, status: questions.status, topicId: questions.topicId, topicName: topics.name })
      .from(questions)
      .innerJoin(topics, eq(topics.id, questions.topicId))
      .orderBy(asc(topics.name), asc(questions.id));

    if (version) {
      const fq = await db
        .select({ form: formQuestions.form, topicId: formQuestions.topicId, questionId: formQuestions.questionId })
        .from(formQuestions)
        .where(eq(formQuestions.versionId, version.id))
        .orderBy(formQuestions.form, formQuestions.position);
      const topicIds = [...new Set(fq.map((f) => f.topicId))];
      const text = new Map(rows.map((r) => [r.id, r.text]));
      const tname = new Map(rows.map((r) => [r.topicId, r.topicName]));
      return c.json(
        {
          published: {
            date: dateOf(c.env, version.publishedAt),
            thresholdPct: version.thresholdPct,
            perTopicCount: version.perTopicCount,
            topics: topicIds
              .map((tid) => ({
                id: tid,
                name: tname.get(tid) ?? "",
                A: fq.filter((f) => f.topicId === tid && f.form === "A").map((f) => ({ id: f.questionId, text: text.get(f.questionId) ?? "" })),
                B: fq.filter((f) => f.topicId === tid && f.form === "B").map((f) => ({ id: f.questionId, text: text.get(f.questionId) ?? "" })),
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          },
          perTopicCount: version.perTopicCount,
          defaultThreshold: version.thresholdPct,
          pendingCount: 0,
          topics: [],
        },
        200,
      );
    }

    const byTopic = new Map<number, { id: number; name: string; approved: { id: number; text: string }[]; other: number }>();
    for (const r of rows) {
      if (r.status === "discarded") continue;
      const t = byTopic.get(r.topicId) ?? { id: r.topicId, name: r.topicName, approved: [], other: 0 };
      if (r.status === "approved") t.approved.push({ id: r.id, text: r.text });
      else t.other++;
      byTopic.set(r.topicId, t);
    }
    return c.json(
      {
        published: null,
        perTopicCount: p.perTopicCount,
        defaultThreshold: DEFAULT_THRESHOLD,
        pendingCount: rows.filter((r) => r.status === "pending").length,
        topics: [...byTopic.values()].map((t) => ({
          id: t.id,
          name: t.name,
          approved: t.approved,
          split: defaultSplit(
            t.approved.map((q) => q.id),
            p.perTopicCount,
          ),
        })),
      },
      200,
    );
  })

  .post(
    "/publish",
    allow(...ADMIN),
    body<{ thresholdPct: number; topics: { topicId: number; A: number[]; B: number[] }[] }>(),
    async (c) => {
      const b = c.req.valid("json");
      const db = getDb(c.env);
      if (await getVersion(db)) return frozen(c);
      const p = await getPilot(db);
      const thr = b.thresholdPct;
      if (!Number.isInteger(thr) || thr < 1 || thr > 100) return badRequest(c, "The flag threshold must be a whole number from 1 to 100.");
      const [{ n: pending }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.status, "pending"));
      if (Number(pending) > 0)
        return conflict(c, `${pending} ${Number(pending) === 1 ? "draft is" : "drafts are"} still waiting for review.`);

      const approved = await db
        .select({ id: questions.id, topicId: questions.topicId })
        .from(questions)
        .where(eq(questions.status, "approved"));
      const approvedByTopic = new Map<number, Set<number>>();
      for (const q of approved) approvedByTopic.set(q.topicId, (approvedByTopic.get(q.topicId) ?? new Set()).add(q.id));
      const names = new Map((await db.select().from(topics)).map((t) => [t.id, t.name]));
      const assignment = Array.isArray(b.topics) ? b.topics : [];
      const problem = checkAssignment(assignment, approvedByTopic, p.perTopicCount, names);
      if (problem) return badRequest(c, problem);

      const now = Date.now();
      const me = c.get("me").personId;
      const D = c.env.DB;
      const vid = "(SELECT id FROM versions WHERE number = 1)";
      try {
        await D.batch([
          D.prepare(
            "INSERT INTO versions (number, published_at, published_by, threshold_pct, per_topic_count) VALUES (1, ?, ?, ?, ?)",
          ).bind(now, me, thr, p.perTopicCount),
          ...assignment.flatMap((t) =>
            (["A", "B"] as const).flatMap((form) =>
              t[form].map((qid, pos) =>
                D.prepare(
                  `INSERT INTO form_questions (version_id, form, topic_id, question_id, position) VALUES (${vid}, ?, ?, ?, ?)`,
                ).bind(form, t.topicId, qid, pos),
              ),
            ),
          ),
        ]);
      } catch {
        if (await getVersion(db)) return frozen(c);
        throw new Error("publish_failed");
      }
      return c.json({ ok: true }, 201);
    },
  );
