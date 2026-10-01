import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addPerson, call, db, makeWorld, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { flags, versions, pilot } from "../worker/db/schema";

describe("A2 people & roles", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("lists roles with warnings for reviewer overlap", async () => {
    const r = await call("GET", "/api/roles", { token: w.tokens.bank });
    expect(r.status).toBe(200);
    expect(r.body.warnings).toEqual([]);
    await call("PUT", "/api/roles/reviewer", { token: w.tokens.bank, json: { personId: w.ids.fuo } });
    const r2 = await call("GET", "/api/roles", { token: w.tokens.bank });
    expect(r2.body.warnings[0]).toMatch(/recommends a reviewer who isn't the manager/);
    await call("PUT", "/api/roles/reviewer", { token: w.tokens.bank, json: { personId: w.ids.bank } });
    const r3 = await call("GET", "/api/roles", { token: w.tokens.bank });
    expect(r3.body.warnings[0]).toMatch(/through their admin access/);
  });

  it("creates a new person when assigning by name", async () => {
    const r = await call("PUT", "/api/roles/reviewer", { token: w.tokens.bank, json: { name: "Sam Expert", email: "sam@example.com" } });
    expect(r.status).toBe(200);
    const roles = await call("GET", "/api/roles", { token: w.tokens.bank });
    expect(roles.body.roles.find((x: any) => x.role === "reviewer").person.name).toBe("Sam Expert");
    const bad = await call("PUT", "/api/roles/reviewer", { token: w.tokens.bank, json: { name: "X", email: "nope" } });
    expect(bad.status).toBe(400);
  });

  it("only the CPO can assign the CPO role", async () => {
    expect((await call("PUT", "/api/roles/cpo", { token: w.tokens.bank, json: { personId: w.ids.bank } })).status).toBe(404);
    expect((await call("PUT", "/api/roles/cpo", { token: w.tokens.cpo, json: { personId: w.ids.cpo } })).status).toBe(200);
  });

  it("links for admins are CPO only; other links any admin", async () => {
    expect((await call("POST", `/api/people/${w.ids.cpo}/link`, { token: w.tokens.bank })).status).toBe(404);
    expect((await call("POST", `/api/people/${w.ids.bank}/link`, { token: w.tokens.bank })).status).toBe(404);
    const ok = await call("POST", `/api/people/${w.ids.bank}/link`, { token: w.tokens.cpo });
    expect(ok.status).toBe(200);
    expect(ok.body.url).toMatch(/^https:\/\/kc\.test\/start#t=[A-Za-z0-9_-]{43}$/);
    // The new link ends the bank owner's old session; they sign in again with it.
    expect((await call("GET", "/api/me", { token: w.tokens.bank })).status).toBe(401);
    const bank = (await call("POST", "/api/auth/exchange", { json: { token: ok.body.url.split("#t=")[1] } })).body.sessionToken;
    const rev = await call("POST", `/api/people/${w.ids.reviewer}/link`, { token: bank });
    expect(rev.status).toBe(200);
    // The link signs the reviewer in.
    const token = rev.body.url.split("#t=")[1];
    const ex = await call("POST", "/api/auth/exchange", { json: { token } });
    const me = await call("GET", "/api/me", { token: ex.body.sessionToken });
    expect(me.body.roles).toEqual(["reviewer"]);
    // Non-admins can't issue links.
    expect((await call("POST", `/api/people/${w.ids.student}/link`, { token: w.tokens.fuo })).status).toBe(404);
  });

  it("changing the follow-up owner moves the student's flag; the old owner loses access", async () => {
    const ids = await seedLoop(w);
    expect((await call("GET", `/api/roles`, { token: w.tokens.bank })).body.studentHasFlag).toBe(true);
    const newOwner = await addPerson("Jordan Buddy");
    await call("PUT", "/api/roles/follow_up_owner", { token: w.tokens.bank, json: { personId: newOwner.id } });
    const [f] = await db().select().from(flags).where(eq(flags.id, ids.flagId));
    expect(f.ownerPersonId).toBe(newOwner.id);
  });
});

describe("A1 readiness and HR sign-off", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("readiness reflects roles, AI (mock), publish and HR sign-off", async () => {
    const r = await call("GET", "/api/pilot", { token: w.tokens.bank });
    expect(r.body.readiness.items).toEqual({ rolesNamed: true, aiSetUp: true, bankPublished: false, hrSignoff: false });
    expect(r.body.readiness.complete).toBe(false);
  });

  it("HR sign-off is CPO only, validated, and completes readiness", async () => {
    expect((await call("POST", "/api/pilot/hr-signoff", { token: w.tokens.bank, json: { date: "2026-09-01", by: "HR" } })).status).toBe(404);
    expect((await call("POST", "/api/pilot/hr-signoff", { token: w.tokens.cpo, json: { date: "2099-01-01", by: "HR" } })).status).toBe(400);
    expect((await call("POST", "/api/pilot/hr-signoff", { token: w.tokens.cpo, json: { date: "2026-09-01", by: "" } })).status).toBe(400);
    expect((await call("POST", "/api/pilot/hr-signoff", { token: w.tokens.cpo, json: { date: "2026-09-01", by: "HR Partner" } })).status).toBe(200);
    await db().insert(versions).values({ number: 1, publishedAt: Date.now(), publishedBy: w.ids.bank, thresholdPct: 70, perTopicCount: 4 });
    const r = await call("GET", "/api/pilot", { token: w.tokens.cpo });
    expect(r.body.readiness.complete).toBe(true);
    expect(r.body.readiness.readySince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a notice version change invalidates the sign-off", async () => {
    await call("POST", "/api/pilot/hr-signoff", { token: w.tokens.cpo, json: { date: "2026-09-01", by: "HR" } });
    await db().update(pilot).set({ hrNoticeVersion: 0 }).where(eq(pilot.id, 1));
    const r = await call("GET", "/api/pilot", { token: w.tokens.cpo });
    expect(r.body.readiness.items.hrSignoff).toBe(false);
  });
});
