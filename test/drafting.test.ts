// Drafting through the real Workflow with the local mock provider.
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { call, db, makeWorld, type World } from "./helpers";
import { questions } from "../worker/db/schema";

const SENTENCES = Array.from(
  { length: 12 },
  (_, i) => `Rule ${i + 1}: every return over ${i + 10} euros needs a manager's approval before the refund.`,
).join(" ");

async function addDoc(w: World, text: string, topic = "Returns process", name = "Returns guide") {
  const r = await call("POST", "/api/documents", {
    token: w.tokens.bank,
    json: { name, versionDate: "2026-08-01", topics: [topic], text, source: "paste" },
  });
  expect(r.status).toBe(201);
  const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
  return bank.body.topics.find((t: any) => t.name === topic);
}

async function waitForRun(w: World, topicId: number, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    const t = bank.body.topics.find((x: any) => x.id === topicId);
    if (t.run && t.run.status !== "running") return t;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("run did not finish");
}

describe("drafting", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("needs the first-drafting consent", async () => {
    const t = await addDoc(w, SENTENCES);
    const r = await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Confirm what drafting sends/);
  });

  it("drafts 2 x per-form + 2 pending questions, grounded in the material; then 5 more", async () => {
    const t = await addDoc(w, SENTENCES);
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    const r = await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    expect(r.status).toBe(202);
    expect(r.body.requested).toBe(10);
    const running = await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "more" } });
    expect([202, 409]).toContain(running.status); // 409 while still running
    const done = await waitForRun(w, t.id);
    expect(done.run.status).toBe("done");
    if (running.status === 202) await waitForRun(w, t.id);
    const qs = await db().select().from(questions).where(eq(questions.topicId, t.id));
    const pending = qs.filter((q) => q.status === "pending");
    expect(pending.length).toBeGreaterThanOrEqual(10);
    for (const q of pending) {
      expect(SENTENCES).toContain(q.quote!);
      expect(q.options).toHaveLength(4);
      expect(q.documentName).toBe("Returns guide");
    }
    // The reviewer's badge counts the pending drafts.
    const me = await call("GET", "/api/me", { token: w.tokens.reviewer });
    expect(me.body.badges.review).toBe(pending.length);

    const more = await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "more" } });
    if (more.status === 202) {
      expect(more.body.requested).toBe(5);
      const after = await waitForRun(w, t.id);
      expect(after.run.kind).toBe("more");
    }
  });

  it("discards ungrounded and malformed drafts and counts them", async () => {
    const t = await addDoc(w, `${SENTENCES} [mock:ungrounded] [mock:malformed]`);
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    const done = await waitForRun(w, t.id);
    expect(done.run).toMatchObject({ status: "done", createdCount: 8, discardedCount: 2 });
    expect(done.counts).toMatchObject({ pending: 8, discarded: 2, total: 8 });
    const discarded = (await db().select().from(questions)).filter((q) => q.status === "discarded");
    expect(discarded.map((q) => q.discardReason).sort()).toEqual(["options", "ungrounded"]);
  });

  it("a set-up problem fails the topic at once, with nothing saved", async () => {
    const t = await addDoc(w, `${SENTENCES} [mock:unauthorized]`);
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    const done = await waitForRun(w, t.id);
    expect(done.run).toMatchObject({ status: "failed", errorReason: "AI set-up problem, contact the pilot team" });
    expect(await db().select().from(questions)).toHaveLength(0);
  });

  it("material over 400,000 characters per topic fails as 'document too long'", async () => {
    const big = "A".repeat(140_000);
    await addDoc(w, big, "Huge", "Part 1");
    await addDoc(w, big, "Huge", "Part 2");
    const t = await addDoc(w, big, "Huge", "Part 3");
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    const done = await waitForRun(w, t.id);
    expect(done.run).toMatchObject({ status: "failed", errorReason: "document too long" });
  });

  it("a 429 is retried, then fails as 'service unavailable'", async () => {
    const t = await addDoc(w, `${SENTENCES} [mock:429]`);
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    const done = await waitForRun(w, t.id, 40_000);
    expect(done.run).toMatchObject({ status: "failed", errorReason: "service unavailable" });
    expect(await db().select().from(questions)).toHaveLength(0);
  }, 45_000);

  it("a timeout is retried, then fails as 'timed out'", async () => {
    const t = await addDoc(w, `${SENTENCES} [mock:timeout]`);
    await call("POST", "/api/bank/consent", { token: w.tokens.bank });
    await call("POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    const done = await waitForRun(w, t.id, 40_000);
    expect(done.run).toMatchObject({ status: "failed", errorReason: "timed out" });
  }, 45_000);
});
