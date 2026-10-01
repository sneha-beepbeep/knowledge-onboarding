// AI-off mode (AI_ENABLED "false", round 1 without AI): readiness no longer needs
// the AI provider, drafting is refused, K3 is never raised, and the screens get
// the flag. The suite runs with AI on; these tests call the app with their own env.
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import app from "../worker/index";
import { aiEnabled } from "../worker/lib/state";
import { renderNotice, NOTICE_VERSION } from "../worker/lib/notice";
import { roleDescription } from "../worker/routes/people";
import { draftRuns, questions, topics } from "../worker/db/schema";
import { db, makeWorld, type World } from "./helpers";
import { seedLoop } from "./scenario";

const envOf = (vars: Record<string, string | undefined>) => vars as unknown as Env;

/** AI off, and (like production in round 1) no key and no mock. */
const OFF = { AI_ENABLED: "false", AI_MOCK: "0" };
/** AI on, but no key and no mock: the provider isn't set up. */
const ON_NOT_SET_UP = { AI_ENABLED: "true", AI_MOCK: "0" };

async function callWith(vars: Record<string, string>, method: string, path: string, opts: { token?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await app.fetch(
    new Request(`https://kc.test${path}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }),
    { ...env, ...vars } as Env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

describe("aiEnabled", () => {
  it("unset means on; only the exact value 'false' turns AI off", () => {
    expect(aiEnabled(envOf({}))).toBe(true);
    expect(aiEnabled(envOf({ AI_ENABLED: "true" }))).toBe(true);
    expect(aiEnabled(envOf({ AI_ENABLED: "false" }))).toBe(false);
    expect(aiEnabled(envOf({ AI_ENABLED: "False" }))).toBe(true);
  });
});

describe("AI-off mode through the API", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("readiness completes without the AI provider, and Send Form A works", async () => {
    await seedLoop(w, { submitA: false });
    const off = await callWith(OFF, "GET", "/api/pilot", { token: w.tokens.bank });
    expect(off.body.readiness.aiEnabled).toBe(false);
    expect(off.body.readiness.items.aiSetUp).toBe(false);
    expect(off.body.readiness.complete).toBe(true);
    expect((await callWith(OFF, "POST", "/api/pilot/form-a/link", { token: w.tokens.bank })).status).toBe(200);
    expect((await callWith(OFF, "POST", "/api/pilot/form-a/sent", { token: w.tokens.bank })).status).toBe(200);

    // Control: AI on without a provider still blocks, as before.
    const on = await callWith(ON_NOT_SET_UP, "GET", "/api/pilot", { token: w.tokens.bank });
    expect(on.body.readiness.aiEnabled).toBe(true);
    expect(on.body.readiness.complete).toBe(false);
    expect((await callWith(ON_NOT_SET_UP, "POST", "/api/pilot/form-a/link", { token: w.tokens.bank })).status).toBe(409);
  });

  it("the other readiness items still block in AI-off mode", async () => {
    const r = await callWith(OFF, "GET", "/api/pilot", { token: w.tokens.bank });
    expect(r.body.readiness.complete).toBe(false);
    expect((await callWith(OFF, "POST", "/api/pilot/form-a/link", { token: w.tokens.bank })).status).toBe(409);
  });

  it("drafting is refused and no run is created", async () => {
    const add = await callWith(OFF, "POST", "/api/documents", {
      token: w.tokens.bank,
      json: { name: "Guide", versionDate: "2026-09-01", topics: ["Topic"], text: "Some onboarding text for the topic.", source: "paste" },
    });
    expect(add.status).toBe(201);
    const bank = await callWith(OFF, "GET", "/api/bank", { token: w.tokens.bank });
    expect(bank.body.aiEnabled).toBe(false);
    const t = bank.body.topics[0];
    await callWith(OFF, "POST", "/api/bank/consent", { token: w.tokens.bank });
    const r = await callWith(OFF, "POST", `/api/topics/${t.id}/drafts`, { token: w.tokens.bank, json: { kind: "initial" } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("AI drafting is off for this round. Questions are loaded by the pilot team.");
    const [{ n }] = await db().select({ n: sql<number>`count(*)` }).from(draftRuns);
    expect(Number(n)).toBe(0);
  });

  it("K3 is never raised in AI-off mode", async () => {
    const s = await seedLoop(w, { submitA: false });
    const now = Date.now();
    // 16 approved as is (seedLoop) + 20 rejected: rewrite rate 56%.
    for (let i = 0; i < 20; i++)
      await db().insert(questions).values({
        topicId: s.topicIds[0], text: `Rejected ${i}?`, options: ["A", "B", "C", "D"], correctIndex: 0,
        status: "rejected", createdAt: now, updatedAt: now,
      });
    const on = await callWith({ AI_ENABLED: "true" }, "GET", "/api/pilot", { token: w.tokens.bank });
    expect(on.body.m3.rewriteRatePct).toBeGreaterThan(50);
    expect(on.body.k3).toBe(true);
    const off = await callWith(OFF, "GET", "/api/pilot", { token: w.tokens.bank });
    expect(off.body.m3.rewriteRatePct).toBeGreaterThan(50);
    expect(off.body.k3).toBe(false);
  });

  it("/api/me carries the flag for the screens; the bank owner's role text drops AI", async () => {
    expect((await callWith(OFF, "GET", "/api/me", { token: w.tokens.reviewer })).body.aiEnabled).toBe(false);
    expect((await callWith({ AI_ENABLED: "true" }, "GET", "/api/me", { token: w.tokens.reviewer })).body.aiEnabled).toBe(true);
    const roles = await callWith(OFF, "GET", "/api/roles", { token: w.tokens.cpo });
    const bank = roles.body.roles.find((r: { role: string }) => r.role === "bank_owner");
    expect(bank.description).not.toMatch(/AI/);
    expect(roleDescription("bank_owner", true)).toMatch(/runs AI drafting/);
  });
});

describe("round-1 wording", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("A4's publish block calls waiting items questions, not drafts, when AI is off", async () => {
    const [t] = await db().insert(topics).values({ name: "Returns process" }).returning();
    const now = Date.now();
    await db().insert(questions).values({
      topicId: t.id, text: "Still waiting?", options: ["A", "B", "C", "D"], correctIndex: 0,
      status: "pending", createdAt: now, updatedAt: now,
    });
    const json = { thresholdPct: 70, topics: [] };
    const off = await callWith(OFF, "POST", "/api/publish", { token: w.tokens.bank, json });
    expect(off.status).toBe(409);
    expect(off.body.error).toBe("1 question is still waiting for review.");
    const on = await callWith({ AI_ENABLED: "true" }, "POST", "/api/publish", { token: w.tokens.bank, json });
    expect(on.body.error).toBe("1 draft is still waiting for review.");
  });
});

describe("student notice version 2 (round 1, no AI)", () => {
  it("says no AI tool is used, and its version is 2", () => {
    expect(NOTICE_VERSION).toBe(2);
    const n = renderNotice({ topics: ["Returns process"], thresholdPct: 70 });
    const text = JSON.stringify(n);
    expect(n.version).toBe(2);
    expect(text).toContain("How the questions were made:");
    expect(text).toContain(
      "Our team wrote the questions from our onboarding documents, and a named reviewer checked every question before it was used. No AI tool is used in this round.",
    );
    expect(text).not.toContain("drafted by an AI tool");
  });
});
