// PRD rev. 3: in production the question bank owner and the reviewer must be
// different people. Local and demo keep allowing it (with A2's warning), so a
// one-person local setup still works.
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import app from "../worker/index";
import { SEPARATION_ERROR } from "../worker/routes/people";
import { roleAssignments } from "../worker/db/schema";
import { db, makeWorld, type World } from "./helpers";
import { seedLoop } from "./scenario";

async function callAs(vars: Record<string, string>, method: string, path: string, token: string, json?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await app.fetch(
    new Request(`https://kc.test${path}`, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined }),
    { ...env, ...vars } as Env,
  );
  return { status: res.status, body: (await res.json()) as any };
}

// Production in round 1: AI off, no mock. Local/demo: the suite's AI settings.
const PROD = { ENVIRONMENT: "production", AI_ENABLED: "false", AI_MOCK: "0" };
const LOCAL = { ENVIRONMENT: "local" };
const DEMO = { ENVIRONMENT: "demo" };

describe("bank owner and reviewer must be different people (production only)", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("production refuses the reviewer as bank owner, and the bank owner as reviewer", async () => {
    const a = await callAs(PROD, "PUT", "/api/roles/bank_owner", w.tokens.cpo, { personId: w.ids.reviewer });
    expect(a.status).toBe(400);
    expect(a.body.error).toBe(SEPARATION_ERROR);
    const b = await callAs(PROD, "PUT", "/api/roles/reviewer", w.tokens.cpo, { personId: w.ids.bank });
    expect(b.status).toBe(400);
    expect(b.body.error).toBe(SEPARATION_ERROR);
    const rows = await db().select().from(roleAssignments);
    expect(rows.find((r) => r.role === "bank_owner")!.personId).toBe(w.ids.bank);
    expect(rows.find((r) => r.role === "reviewer")!.personId).toBe(w.ids.reviewer);
    // Other roles can still be shared, e.g. the CPO as reviewer.
    expect((await callAs(PROD, "PUT", "/api/roles/reviewer", w.tokens.cpo, { personId: w.ids.cpo })).status).toBe(200);
  });

  it.each([["local", LOCAL], ["demo", DEMO]])("%s allows it, with A2's warning", async (_, vars) => {
    const r = await callAs(vars, "PUT", "/api/roles/reviewer", w.tokens.cpo, { personId: w.ids.bank });
    expect(r.status).toBe(200);
    const roles = await callAs(vars, "GET", "/api/roles", w.tokens.cpo);
    expect(roles.body.warnings).toEqual([
      "This person will see named results through their admin access. The student notice will list this person once, under their other role.",
    ]);
  });

  it("readiness in production treats an existing overlap as not ready; local doesn't", async () => {
    await seedLoop(w, { submitA: false });
    const ok = await callAs(PROD, "GET", "/api/pilot", w.tokens.cpo);
    expect(ok.body.readiness).toMatchObject({ complete: true, rolesOverlap: false });
    // Data created before the rule.
    await db().update(roleAssignments).set({ personId: w.ids.bank }).where(eq(roleAssignments.role, "reviewer"));
    const prod = await callAs(PROD, "GET", "/api/pilot", w.tokens.cpo);
    expect(prod.body.readiness.items.rolesNamed).toBe(false);
    expect(prod.body.readiness).toMatchObject({ complete: false, rolesOverlap: true });
    expect((await callAs(PROD, "POST", "/api/pilot/form-a/link", w.tokens.cpo)).status).toBe(409);
    const local = await callAs({ ...LOCAL, AI_ENABLED: "false" }, "GET", "/api/pilot", w.tokens.cpo);
    expect(local.body.readiness).toMatchObject({ complete: true, rolesOverlap: false });
  });
});
