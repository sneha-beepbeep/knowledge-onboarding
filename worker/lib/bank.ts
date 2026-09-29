// Topic, document and draft-status reads for A3 (and helpers for A4/drafting).
import { desc, eq, inArray, sql } from "drizzle-orm";
import { documentTopics, documents, draftRuns, questions, topics } from "../db/schema";
import type { DB } from "./state";
import { DRAFT_TIMEOUT_MS } from "../../shared/limits";

export type RunView = {
  id: number;
  kind: "initial" | "more";
  status: "running" | "done" | "failed";
  errorReason: string | null;
  requested: number;
  createdCount: number;
  discardedCount: number;
  startedAt: number;
};

/** A run still running after 15 minutes is shown as failed, "timed out" (technical plan §4). */
export function effectiveRun(r: typeof draftRuns.$inferSelect, now = Date.now()): RunView {
  const timedOut = r.status === "running" && now - r.startedAt > DRAFT_TIMEOUT_MS;
  return {
    id: r.id,
    kind: r.kind,
    status: timedOut ? "failed" : r.status,
    errorReason: timedOut ? "timed out" : r.errorReason,
    requested: r.requested,
    createdCount: r.createdCount,
    discardedCount: r.discardedCount,
    startedAt: r.startedAt,
  };
}

export async function latestRun(db: DB, topicId: number) {
  const [r] = await db.select().from(draftRuns).where(eq(draftRuns.topicId, topicId)).orderBy(desc(draftRuns.id)).limit(1);
  return r ? effectiveRun(r) : null;
}

export type TopicCounts = { approved: number; rejected: number; pending: number; discarded: number; total: number };

export async function questionCounts(db: DB): Promise<Map<number, TopicCounts>> {
  const rows = await db
    .select({ topicId: questions.topicId, status: questions.status, n: sql<number>`count(*)` })
    .from(questions)
    .groupBy(questions.topicId, questions.status);
  const map = new Map<number, TopicCounts>();
  for (const r of rows) {
    const c = map.get(r.topicId) ?? { approved: 0, rejected: 0, pending: 0, discarded: 0, total: 0 };
    c[r.status] = Number(r.n);
    if (r.status !== "discarded") c.total += Number(r.n);
    map.set(r.topicId, c);
  }
  return map;
}

export async function topicDocuments(db: DB, topicIds?: number[]) {
  const q = db
    .select({
      topicId: documentTopics.topicId,
      id: documents.id,
      name: documents.name,
      versionDate: documents.versionDate,
      charCount: documents.charCount,
    })
    .from(documentTopics)
    .innerJoin(documents, eq(documents.id, documentTopics.documentId));
  const rows = topicIds ? await q.where(inArray(documentTopics.topicId, topicIds)) : await q;
  return rows;
}

export async function allTopics(db: DB) {
  return db.select().from(topics).orderBy(topics.name);
}
