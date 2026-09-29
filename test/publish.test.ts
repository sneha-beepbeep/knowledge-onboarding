import { beforeEach, describe, expect, it } from "vitest";
import { call, db, makeWorld, type World } from "./helpers";
import { formQuestions, questions, topics, versions } from "../worker/db/schema";

async function seedApproved(name: string, n: number, pending = 0) {
  const [t] = await db().insert(topics).values({ name }).returning();
  const now = Date.now();
  const ids: number[] = [];
  for (let i = 0; i < n + pending; i++) {
    const [q] = await db()
      .insert(questions)
      .values({ topicId: t.id, text: `${name} Q${i}`, options: ["a", "b", "c", "d"], correctIndex: 0, status: i < n ? "approved" : "pending", createdAt: now, updatedAt: now })
      .returning();
    ids.push(q.id);
  }
  return { topicId: t.id, ids };
}

describe("A4 publish", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("offers the default split and publishes; then everything is frozen", async () => {
    const a = await seedApproved("Returns", 10);
    const b = await seedApproved("Tools", 7);
    const g = await call("GET", "/api/publish", { token: w.tokens.bank });
    expect(g.body.published).toBeNull();
    const ta = g.body.topics.find((t: any) => t.id === a.topicId);
    const tb = g.body.topics.find((t: any) => t.id === b.topicId);
    expect([ta.split.A.length, ta.split.B.length, ta.split.unused.length]).toEqual([4, 4, 2]);
    expect([tb.split.A.length, tb.split.B.length, tb.split.unused.length]).toEqual([3, 3, 1]);

    const p = await call("POST", "/api/publish", {
      token: w.tokens.bank,
      json: { thresholdPct: 70, topics: [ { topicId: a.topicId, A: ta.split.A, B: ta.split.B }, { topicId: b.topicId, A: tb.split.A, B: tb.split.B } ] },
    });
    expect(p.status).toBe(201);
    const fq = await db().select().from(formQuestions);
    expect(fq).toHaveLength(14);
    const [v] = await db().select().from(versions);
    expect(v).toMatchObject({ number: 1, thresholdPct: 70, perTopicCount: 4 });

    const after = await call("GET", "/api/publish", { token: w.tokens.bank });
    expect(after.body.published.topics).toHaveLength(2);
    // Second publish, review writes, bank writes: all refused.
    expect((await call("POST", "/api/publish", { token: w.tokens.bank, json: { thresholdPct: 70, topics: [] } })).status).toBe(409);
    expect((await call("PUT", "/api/bank/settings", { token: w.tokens.bank, json: { perTopicCount: 3 } })).status).toBe(409);
    expect((await call("POST", `/api/topics/${a.topicId}/drafts`, { token: w.tokens.bank, json: { kind: "more" } })).status).toBe(409);
    const q = (await call("GET", `/api/review/questions/${a.ids[0]}`, { token: w.tokens.reviewer })).body;
    expect((await call("POST", `/api/review/questions/${a.ids[0]}/undo`, { token: w.tokens.reviewer, json: { expectedUpdatedAt: q.updatedAt } })).status).toBe(409);
  });

  it("is blocked while drafts wait for review, and re-checks every rule", async () => {
    const a = await seedApproved("Returns", 8, 1);
    const post = (json: unknown) => call("POST", "/api/publish", { token: w.tokens.bank, json });
    const r = await post({ thresholdPct: 70, topics: [{ topicId: a.topicId, A: a.ids.slice(0, 4), B: a.ids.slice(4, 8) }] });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("1 draft is still waiting for review.");
    await db().delete(questions).where((await import("drizzle-orm")).eq(questions.id, a.ids[8]));
    expect((await post({ thresholdPct: 0, topics: [{ topicId: a.topicId, A: a.ids.slice(0, 4), B: a.ids.slice(4, 8) }] })).status).toBe(400);
    expect((await post({ thresholdPct: 70, topics: [] })).body.error).toBe("Include at least one topic.");
    expect((await post({ thresholdPct: 70, topics: [{ topicId: a.topicId, A: a.ids.slice(0, 4), B: a.ids.slice(4, 7) }] })).status).toBe(400);
    expect((await post({ thresholdPct: 70, topics: [{ topicId: a.topicId, A: a.ids.slice(0, 4), B: a.ids.slice(4, 8) }] })).status).toBe(201);
  });
});
