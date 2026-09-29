// M3 review-outcome figures (A1 section 4, V3). Discarded drafts are left out.
import { sql } from "drizzle-orm";
import { questions, topics } from "../db/schema";
import { eq } from "drizzle-orm";
import type { DB } from "./state";

export type M3 = {
  reviewed: number;
  approvedAsIs: number;
  minor: number;
  substantial: number;
  rejected: number;
  rewriteRatePct: number | null;
};

const empty = (): M3 => ({ reviewed: 0, approvedAsIs: 0, minor: 0, substantial: 0, rejected: 0, rewriteRatePct: null });

function finish<T extends M3>(m: T): T {
  m.reviewed = m.approvedAsIs + m.minor + m.substantial + m.rejected;
  // Rewrite rate = rejected or substantially edited, as a share of reviewed drafts.
  m.rewriteRatePct = m.reviewed ? Math.round(((m.rejected + m.substantial) * 100) / m.reviewed) : null;
  return m;
}

export async function m3Figures(db: DB): Promise<{ total: M3; byTopic: ({ topicId: number; topic: string } & M3)[] }> {
  const rows = await db
    .select({
      topicId: questions.topicId,
      topic: topics.name,
      status: questions.status,
      editKind: questions.editKind,
      n: sql<number>`count(*)`,
    })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .groupBy(questions.topicId, questions.status, questions.editKind);
  const total = empty();
  const by = new Map<number, { topicId: number; topic: string } & M3>();
  for (const r of rows) {
    const n = Number(r.n);
    const t = by.get(r.topicId) ?? { topicId: r.topicId, topic: r.topic, ...empty() };
    for (const m of [total, t]) {
      if (r.status === "rejected") m.rejected += n;
      else if (r.status === "approved") {
        if (r.editKind === "minor") m.minor += n;
        else if (r.editKind === "substantial") m.substantial += n;
        else m.approvedAsIs += n;
      }
    }
    by.set(r.topicId, t);
  }
  return {
    total: finish(total),
    byTopic: [...by.values()].map((t) => finish(t)).sort((a, b) => a.topic.localeCompare(b.topic)),
  };
}
