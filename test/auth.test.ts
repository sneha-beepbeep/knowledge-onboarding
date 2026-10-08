import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { call, db, makeWorld, NAMES, wipe, type World } from "./helpers";
import { issueLink } from "../worker/auth";
import { sessions, signInLinks } from "../worker/db/schema";
import { seedLoop } from "./scenario";

describe("bootstrap", () => {
  beforeEach(wipe);

  it("creates the CPO once, then shuts itself off", async () => {
    const bad = await call("POST", "/api/auth/bootstrap", { json: { token: "nope", name: "Casey" } });
    expect(bad.status).toBe(403);
    const ok = await call("POST", "/api/auth/bootstrap", { json: { token: "test-bootstrap-token", name: "Casey" } });
    expect(ok.status).toBe(201);
    const me = await call("GET", "/api/me", { token: ok.body.sessionToken });
    expect(me.body.roles).toEqual(["cpo"]);
    const again = await call("POST", "/api/auth/bootstrap", { json: { token: "test-bootstrap-token", name: "X" } });
    expect(again.status).toBe(404);
  });
});

describe("sign-in links and sessions", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("rejects requests without a valid session", async () => {
    expect((await call("GET", "/api/me")).status).toBe(401);
    expect((await call("GET", "/api/me", { token: "garbage" })).status).toBe(401);
  });

  it("exchanges a link for a session, reusable until replaced", async () => {
    const token = await issueLink(db(), w.ids.student);
    const a = await call("POST", "/api/auth/exchange", { json: { token } });
    expect(a.status).toBe(200);
    const b = await call("POST", "/api/auth/exchange", { json: { token } });
    expect(b.status).toBe(200);
    const me = await call("GET", "/api/me", { token: a.body.sessionToken });
    expect(me.body.person.name).toBe(NAMES.student);
    // A new link revokes the old one.
    await issueLink(db(), w.ids.student);
    expect((await call("POST", "/api/auth/exchange", { json: { token } })).status).toBe(401);
  });

  it("a new link ends the person's existing sessions, and only theirs", async () => {
    // The student is signed in on two devices with the same link.
    const first = await issueLink(db(), w.ids.student);
    const phone = (await call("POST", "/api/auth/exchange", { json: { token: first } })).body.sessionToken;
    const laptop = (await call("POST", "/api/auth/exchange", { json: { token: first } })).body.sessionToken;
    expect((await call("GET", "/api/me", { token: phone })).status).toBe(200);
    expect((await call("GET", "/api/me", { token: laptop })).status).toBe(200);
    await issueLink(db(), w.ids.student);
    expect((await call("GET", "/api/me", { token: phone })).status).toBe(401);
    expect((await call("GET", "/api/me", { token: laptop })).status).toBe(401);
    expect(await db().select().from(sessions).where(eq(sessions.personId, w.ids.student))).toHaveLength(0);
    // Everyone else stays signed in.
    for (const t of [w.tokens.fuo, w.tokens.bank, w.tokens.reviewer, w.tokens.cpo, w.outsider.token])
      expect((await call("GET", "/api/me", { token: t })).status).toBe(200);
  });

  it("re-creating the link on A2 or A5 signs the person out; the new link signs them back in", async () => {
    const viaA2 = await call("POST", `/api/people/${w.ids.reviewer}/link`, { token: w.tokens.bank });
    expect(viaA2.status).toBe(200);
    expect((await call("GET", "/api/me", { token: w.tokens.reviewer })).status).toBe(401);
    expect((await call("GET", "/api/me", { token: w.tokens.bank })).status).toBe(200); // the issuer is untouched

    await seedLoop(w, { submitA: false });
    const stu = (await call("POST", "/api/auth/exchange", { json: { token: await issueLink(db(), w.ids.student) } })).body.sessionToken;
    const viaA5 = await call("POST", "/api/pilot/form-a/link", { token: w.tokens.bank });
    expect(viaA5.status).toBe(200);
    expect((await call("GET", "/api/me", { token: stu })).status).toBe(401);
    const back = await call("POST", "/api/auth/exchange", { json: { token: viaA5.body.url.split("#t=")[1] } });
    expect((await call("GET", "/api/me", { token: back.body.sessionToken })).body.roles).toEqual(["student"]);
  });

  it("issuing a link for yourself keeps the current session and ends your other sessions", async () => {
    // The CPO is also signed in on a second device (e.g. a lost or forwarded link).
    const old = await issueLink(db(), w.ids.cpo);
    const other = (await call("POST", "/api/auth/exchange", { json: { token: old } })).body.sessionToken;
    // issueLink above ended the helper's session; sign in again on the "current" device.
    const current = (await call("POST", "/api/auth/exchange", { json: { token: old } })).body.sessionToken;
    expect((await call("GET", "/api/me", { token: other })).status).toBe(200);

    const res = await call("POST", `/api/people/${w.ids.cpo}/link`, { token: current });
    expect(res.status).toBe(200);
    expect((await call("GET", "/api/me", { token: current })).status).toBe(200); // the issuer stays signed in
    expect((await call("GET", "/api/me", { token: other })).status).toBe(401); // their other session ends
    expect(await db().select().from(sessions).where(eq(sessions.personId, w.ids.cpo))).toHaveLength(1);
    // The old link stops working; the new one works.
    expect((await call("POST", "/api/auth/exchange", { json: { token: old } })).status).toBe(401);
    expect((await call("POST", "/api/auth/exchange", { json: { token: res.body.url.split("#t=")[1] } })).status).toBe(200);
  });

  it("issuing a link for someone else ends all of their sessions", async () => {
    const first = await issueLink(db(), w.ids.reviewer);
    const phone = (await call("POST", "/api/auth/exchange", { json: { token: first } })).body.sessionToken;
    const laptop = (await call("POST", "/api/auth/exchange", { json: { token: first } })).body.sessionToken;
    const res = await call("POST", `/api/people/${w.ids.reviewer}/link`, { token: w.tokens.cpo });
    expect(res.status).toBe(200);
    for (const t of [phone, laptop]) expect((await call("GET", "/api/me", { token: t })).status).toBe(401);
    expect(await db().select().from(sessions).where(eq(sessions.personId, w.ids.reviewer))).toHaveLength(0);
    expect((await call("GET", "/api/me", { token: w.tokens.cpo })).status).toBe(200);
  });

  it("refuses expired links", async () => {
    const token = await issueLink(db(), w.ids.student, { now: Date.now() - 15 * 86_400_000 });
    expect((await call("POST", "/api/auth/exchange", { json: { token } })).status).toBe(401);
    const rows = await db().select().from(signInLinks).where(eq(signInLinks.personId, w.ids.student));
    expect(rows[0].tokenHash).not.toContain(token); // only the hash is stored
  });

  it("sign-out ends the session", async () => {
    expect((await call("POST", "/api/auth/signout", { token: w.tokens.fuo })).status).toBe(200);
    expect((await call("GET", "/api/me", { token: w.tokens.fuo })).status).toBe(401);
  });

  it("/me returns roles and the bank owner's name for the no-role state", async () => {
    const me = await call("GET", "/api/me", { token: w.outsider.token });
    expect(me.body.roles).toEqual([]);
    expect(me.body.bankOwnerName).toBe(NAMES.bank);
    expect(me.body.badges).toEqual({});
    const rev = await call("GET", "/api/me", { token: w.tokens.reviewer });
    expect(rev.body.badges).toEqual({ review: 0 });
  });
});
