// Starts AI drafting for a topic (F2). The Workflow does the work in the background.
import { Hono } from "hono";
import { and, eq, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow } from "../auth";
import { body, badRequest, conflict, frozen, idParam, notAvailable } from "../lib/http";
import { aiEnabled, aiSetUp, getDb, getPilot, getVersion } from "../lib/state";
import { latestRun } from "../lib/bank";
import { documentTopics, draftRuns, questions, topics } from "../db/schema";

export const MORE_COUNT = 5;

export const draftRoutes = new Hono<AppEnv>().post(
  "/topics/:id/drafts",
  allow(...ADMIN),
  body<{ kind: "initial" | "more" }>(),
  async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const kind = c.req.valid("json").kind;
    if (kind !== "initial" && kind !== "more") return badRequest(c, "Choose how many questions to draft.");
    const db = getDb(c.env);
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    if (!topic) return notAvailable(c);
    if (await getVersion(db)) return frozen(c);
    if (!aiEnabled(c.env)) return conflict(c, "AI drafting is off for this round. Questions are loaded by the pilot team.");
    if (!aiSetUp(c.env)) return conflict(c, "AI drafting isn't set up yet. The provider must be approved first.");
    const p = await getPilot(db);
    if (!p.draftingConsentAt) return conflict(c, "Confirm what drafting sends before the first draft.");
    const [hasDocs] = await db.select().from(documentTopics).where(eq(documentTopics.topicId, id)).limit(1);
    if (!hasDocs) return badRequest(c, "Add material to this topic first.");
    const current = await latestRun(db, id);
    if (current?.status === "running") return conflict(c, "Drafting is already in progress for this topic.");

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(questions)
      .where(and(eq(questions.topicId, id), ne(questions.status, "discarded")));
    const effectiveKind = Number(n) > 0 ? "more" : kind;
    const requested = effectiveKind === "initial" ? 2 * p.perTopicCount + 2 : MORE_COUNT;

    const now = Date.now();
    const [run] = await db
      .insert(draftRuns)
      .values({ topicId: id, kind: effectiveKind, requested, status: "running", startedAt: now, model: c.env.AI_MODEL })
      .returning();
    try {
      await c.env.DRAFT_WORKFLOW.create({ id: `draft-run-${run.id}-${crypto.randomUUID()}`, params: { runId: run.id } });
    } catch {
      await db
        .update(draftRuns)
        .set({ status: "failed", errorReason: "service unavailable", finishedAt: Date.now() })
        .where(eq(draftRuns.id, run.id));
      return c.json({ error: "Drafting couldn't start. Try again." }, 503);
    }
    return c.json({ runId: run.id, requested }, 202);
  },
);
