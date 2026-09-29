import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { call, db, makeWorld, NAMES, wipe, type World } from "./helpers";
import { issueLink } from "../worker/auth";
import { signInLinks } from "../worker/db/schema";

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

  it("refuses expired links", async () => {
    const token = await issueLink(db(), w.ids.student, Date.now() - 15 * 86_400_000);
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
