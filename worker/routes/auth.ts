// S0: bootstrap, link exchange, sign-out, /me (F12).
import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { body, badRequest, notAvailable, str } from "../lib/http";
import { createSession, exchangeLink, has, requireSession, safeEqual } from "../auth";
import { getDb, getRoleMap } from "../lib/state";
import { people, questions, roleAssignments, sessions } from "../db/schema";
import { openFlagCount } from "../lib/flags";
import { studentNeedsNotice } from "../lib/student";

export const authRoutes = new Hono<AppEnv>()
  // First setup: creates the CPO. Needs BOOTSTRAP_TOKEN and works only while no CPO exists.
  .post("/auth/bootstrap", body<{ token: string; name: string; email?: string }>(), async (c) => {
    const b = c.req.valid("json");
    const expected = (c.env as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN ?? "";
    const db = getDb(c.env);
    const [cpo] = await db.select().from(roleAssignments).where(eq(roleAssignments.role, "cpo"));
    if (!expected || cpo) return notAvailable(c);
    if (!(await safeEqual(str(b.token), expected))) return c.json({ error: "That set-up code isn't right." }, 403);
    const name = str(b.name);
    if (!name || name.length > 120) return badRequest(c, "Add your name.");
    const email = str(b.email) || null;
    const now = Date.now();
    const [person] = await db.insert(people).values({ name, email, createdAt: now }).returning();
    await db.insert(roleAssignments).values({ role: "cpo", personId: person.id, assignedAt: now });
    const sessionToken = await createSession(db, person.id, now);
    return c.json({ sessionToken }, 201);
  })

  // S0: swaps the link token (from the URL fragment) for a session token.
  .post("/auth/exchange", body<{ token: string }>(), async (c) => {
    const b = c.req.valid("json");
    const sessionToken = await exchangeLink(getDb(c.env), str(b.token));
    if (!sessionToken)
      return c.json(
        { error: "This sign-in link has expired or been replaced. Ask the pilot team for a new one." },
        401,
      );
    return c.json({ sessionToken }, 200);
  })

  .post("/auth/signout", requireSession, async (c) => {
    await getDb(c.env).delete(sessions).where(eq(sessions.id, c.get("me").sessionId));
    return c.json({ ok: true }, 200);
  })

  .get("/me", requireSession, async (c) => {
    const me = c.get("me");
    const db = getDb(c.env);
    const roleMap = await getRoleMap(db);
    const badges: { review?: number; flags?: number } = {};
    if (has(me, "reviewer")) {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(questions)
        .where(and(eq(questions.status, "pending")));
      badges.review = Number(r?.n ?? 0);
    }
    if (has(me, "follow_up_owner")) badges.flags = await openFlagCount(db, me.personId, roleMap.student?.personId);
    return c.json(
      {
        person: { id: me.personId, name: me.name },
        roles: me.roles,
        badges,
        bankOwnerName: roleMap.bank_owner?.name ?? null,
        needsNotice: has(me, "student") ? await studentNeedsNotice(db, me.personId) : false,
      },
      200,
    );
  });
