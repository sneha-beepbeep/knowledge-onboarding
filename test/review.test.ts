import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addPerson, call, db, makeWorld, NAMES, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { answers, attempts, questions, topics } from "../worker/db/schema";

async function seedPending(n = 3) {
  const [t] = await db().insert(topics).values({ name: "Returns process" }).returning();
  const now = Date.now();
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const orig = { text: `Original ${i}?`, options: ["a", "b", "c", "d"], correctIndex: 0 };
    const [q] = await db()
      .insert(questions)
      .values({ topicId: t.id, documentName: "Guide", quote: "A quoted passage from the guide.", text: orig.text, options: orig.options, correctIndex: 0, aiOriginal: orig, status: "pending", createdAt: now, updatedAt: now })
      .returning();
    ids.push(q.id);
  }
  // A discarded draft never appears in review.
  await db().insert(questions).values({ topicId: t.id, text: "bad", options: [], correctIndex: -1, status: "discarded", discardReason: "ungrounded", createdAt: now, updatedAt: now });
  return ids;
}

describe("V1/V2 review", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("queue counts, filters and next-waiting navigation", async () => {
    const [a, b] = await seedPending(3);
    const q = await call("GET", "/api/review/questions?status=waiting", { token: w.tokens.reviewer });
    expect(q.body.counts).toEqual({ waiting: 3, reviewed: 0, total: 3 });
    expect(q.body.firstWaitingId).toBe(a);
    const v = await call("GET", `/api/review/questions/${a}`, { token: w.tokens.reviewer });
    expect(v.body.nextWaitingId).toBe(b);
    expect(v.body.canDecide).toBe(true);
    // Admins can view but not decide.
    const adm = await call("GET", `/api/review/questions/${a}`, { token: w.tokens.bank });
    expect(adm.body.canDecide).toBe(false);
    expect((await call("POST", `/api/review/questions/${a}/decision`, { token: w.tokens.bank, json: { action: "approve", expectedUpdatedAt: v.body.updatedAt } })).status).toBe(404);
  });

  it("approve, edit (minor/substantial) and reject record outcomes; undo restores the draft", async () => {
    const [a, b, c] = await seedPending(3);
    const get = async (id: number) => (await call("GET", `/api/review/questions/${id}`, { token: w.tokens.reviewer })).body;
    const t = w.tokens.reviewer;
    expect((await call("POST", `/api/review/questions/${a}/decision`, { token: t, json: { action: "approve", expectedUpdatedAt: (await get(a)).updatedAt } })).status).toBe(200);

    const badEdit = await call("POST", `/api/review/questions/${b}/decision`, {
      token: t,
      json: { action: "edit", expectedUpdatedAt: (await get(b)).updatedAt, text: "New?", options: ["a", "A", "c", "d"], correctIndex: 1, editKind: "minor" },
    });
    expect(badEdit.status).toBe(400);
    const noKind = await call("POST", `/api/review/questions/${b}/decision`, {
      token: t,
      json: { action: "edit", expectedUpdatedAt: (await get(b)).updatedAt, text: "New?", options: ["w", "x", "y", "z"], correctIndex: 1 },
    });
    expect(noKind.body.error).toBe("Say what kind of change this was.");
    const edit = await call("POST", `/api/review/questions/${b}/decision`, {
      token: t,
      json: { action: "edit", expectedUpdatedAt: (await get(b)).updatedAt, text: "New?", options: ["w", "x", "y", "z"], correctIndex: 2, editKind: "substantial" },
    });
    expect(edit.status).toBe(200);
    const rej = await call("POST", `/api/review/questions/${c}/decision`, {
      token: t,
      json: { action: "reject", expectedUpdatedAt: (await get(c)).updatedAt, reasons: ["incorrect", "trivia"], note: "Outdated" },
    });
    expect(rej.status).toBe(200);

    const stats = await call("GET", "/api/stats", { token: t });
    expect(stats.body.m3.total).toMatchObject({ reviewed: 3, approvedAsIs: 1, substantial: 1, rejected: 1, rewriteRatePct: 67 });

    const filters = await Promise.all(
      ["approved", "edited", "rejected"].map((s) => call("GET", `/api/review/questions?status=${s}`, { token: t })),
    );
    expect(filters.map((f) => f.body.items.map((i: any) => i.id))).toEqual([[a], [b], [c]]);

    // A second decision without undo is refused.
    expect((await call("POST", `/api/review/questions/${b}/decision`, { token: t, json: { action: "approve", expectedUpdatedAt: (await get(b)).updatedAt } })).status).toBe(409);
    // Undo restores the AI original.
    expect((await call("POST", `/api/review/questions/${b}/undo`, { token: t, json: { expectedUpdatedAt: (await get(b)).updatedAt } })).status).toBe(200);
    const restored = await get(b);
    expect(restored).toMatchObject({ status: "pending", text: "Original 1?", options: ["a", "b", "c", "d"], correctIndex: 0 });
  });

  it("detects a concurrent change and names who made it", async () => {
    const [a] = await seedPending(1);
    const stale = (await call("GET", `/api/review/questions/${a}`, { token: w.tokens.reviewer })).body.updatedAt;
    const other = await addPerson("Second Reviewer");
    await db().update(questions).set({ updatedAt: stale + 5, updatedBy: other.id }).where(eq(questions.id, a));
    const r = await call("POST", `/api/review/questions/${a}/decision`, { token: w.tokens.reviewer, json: { action: "approve", expectedUpdatedAt: stale } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("This question was updated by Second Reviewer. Reload to see the latest version.");
  });

  it("discarded drafts are not reachable", async () => {
    await seedPending(1);
    const [d] = (await db().select().from(questions)).filter((q) => q.status === "discarded");
    expect((await call("GET", `/api/review/questions/${d.id}`, { token: w.tokens.reviewer })).status).toBe(404);
  });

  it("reviews are closed after publish", async () => {
    const ids = await seedLoop(w);
    const q = (await call("GET", `/api/review/questions/${ids.questionId}`, { token: w.tokens.reviewer })).body;
    expect(q.published).toBe(true);
    expect(q.canDecide).toBe(false);
    expect((await call("POST", `/api/review/questions/${ids.questionId}/undo`, { token: w.tokens.reviewer, json: { expectedUpdatedAt: q.updatedAt } })).status).toBe(409);
  });
});

describe("V3 statistics suppression", () => {
  it("hides answer statistics below 5 distinct respondents and shows them at 5; never names", async () => {
    const w = await makeWorld();
    const ids = await seedLoop(w);
    const qid = ids.questionId;
    const stats1 = await call("GET", "/api/stats", { token: w.tokens.reviewer });
    const row1 = stats1.body.questions.find((q: any) => q.id === qid);
    expect(row1).toEqual({ id: qid, topic: "Returns process", start: expect.any(String), form: "A", shown: false });
    for (const n of Object.values(NAMES)) expect(stats1.text).not.toContain(n);

    // 3 more synthetic respondents: 4 in total, still hidden.
    const extra = async (name: string, chosen: number) => {
      const p = await addPerson(name);
      const [a] = await db().insert(attempts).values({ personId: p.id, versionId: ids.versionId, form: "A", submittedAt: 1, submittedDate: "2026-10-01", overallCorrect: 0, overallTotal: 1 }).returning();
      await db().insert(answers).values({ attemptId: a.id, questionId: qid, topicId: ids.weakTopicId, chosenIndex: chosen, correctIndex: 1, isCorrect: chosen === 1 });
    };
    await extra("Synthetic One", 1);
    await extra("Synthetic Two", 0);
    await extra("Synthetic Three", 1);
    const stats4 = await call("GET", "/api/stats", { token: w.tokens.reviewer });
    expect(stats4.body.questions.find((q: any) => q.id === qid).shown).toBe(false);
    expect(stats4.text).not.toContain("optionCounts");
    await extra("Synthetic Four", 2);
    const stats5 = await call("GET", "/api/stats", { token: w.tokens.reviewer });
    const row5 = stats5.body.questions.find((q: any) => q.id === qid);
    expect(row5.shown).toBe(true);
    expect(row5.optionCounts).toEqual([1, 3, 1, 0]);
    expect(row5.pctCorrect).toBe(60);
    expect(stats5.text).not.toContain("Synthetic");
  });

  it("reviewer responses never contain the student's name", async () => {
    const w = await makeWorld();
    const ids = await seedLoop(w);
    for (const path of ["/api/review/questions?status=approved", `/api/review/questions/${ids.questionId}`, "/api/stats", "/api/me"]) {
      const r = await call("GET", path, { token: w.tokens.reviewer });
      expect(r.status).toBe(200);
      expect(r.text).not.toContain(NAMES.student);
    }
  });
});
