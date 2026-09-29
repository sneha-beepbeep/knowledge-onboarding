// Sign-in links, sessions, and role guards (technical plan §5).
import type { Context, MiddlewareHandler } from "hono";
import { and, eq, gt, isNull } from "drizzle-orm";
import { sessions, signInLinks } from "./db/schema";
import type { Role } from "./db/schema";
import type { AppEnv, Me } from "./types";
import { getDb, rolesOf, type DB } from "./lib/state";
import { people } from "./db/schema";
import { notAvailable } from "./lib/http";

const DAY = 24 * 60 * 60 * 1000;
export const LINK_TTL = 14 * DAY;
export const SESSION_TTL = 30 * DAY;

export function randomToken(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison for secrets of possibly different lengths. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

/** Issues a new sign-in link for a person, revoking any earlier link. Returns the raw token. */
export async function issueLink(db: DB, personId: number, now = Date.now()): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256(token);
  await db.batch([
    db
      .update(signInLinks)
      .set({ revokedAt: now })
      .where(and(eq(signInLinks.personId, personId), isNull(signInLinks.revokedAt))),
    db.insert(signInLinks).values({ personId, tokenHash, createdAt: now, expiresAt: now + LINK_TTL }),
  ]);
  return token;
}

export const linkUrl = (c: Context, token: string) => `${new URL(c.req.url).origin}/start#t=${token}`;

export async function createSession(db: DB, personId: number, now = Date.now()): Promise<string> {
  const token = randomToken();
  await db
    .insert(sessions)
    .values({ personId, tokenHash: await sha256(token), createdAt: now, expiresAt: now + SESSION_TTL });
  return token;
}

/** Exchanges a sign-in link token for a session token, or returns null. */
export async function exchangeLink(db: DB, token: string, now = Date.now()): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const [link] = await db
    .select()
    .from(signInLinks)
    .where(
      and(eq(signInLinks.tokenHash, await sha256(token)), isNull(signInLinks.revokedAt), gt(signInLinks.expiresAt, now)),
    );
  if (!link) return null;
  return createSession(db, link.personId, now);
}

/** Requires a valid session; sets `me`. Extends the 30-day expiry on use (at most once a day). */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return c.json({ error: "signed_out" }, 401);
  const db = getDb(c.env);
  const now = Date.now();
  const [row] = await db
    .select({ id: sessions.id, personId: sessions.personId, expiresAt: sessions.expiresAt, name: people.name })
    .from(sessions)
    .innerJoin(people, eq(people.id, sessions.personId))
    .where(and(eq(sessions.tokenHash, await sha256(token)), gt(sessions.expiresAt, now)));
  if (!row) return c.json({ error: "signed_out" }, 401);
  if (row.expiresAt - now < SESSION_TTL - DAY) {
    await db.update(sessions).set({ expiresAt: now + SESSION_TTL }).where(eq(sessions.id, row.id));
  }
  const me: Me = { personId: row.personId, name: row.name, roles: await rolesOf(db, row.personId), sessionId: row.id };
  c.set("me", me);
  await next();
};

export const has = (me: Me, ...roles: Role[]) => roles.some((r) => me.roles.includes(r));
export const isAdmin = (me: Me) => has(me, "bank_owner", "cpo");
export const isCpo = (me: Me) => has(me, "cpo");

/** Route guard: the caller must hold at least one of `roles`, else the uniform 404. */
export const allow =
  (...roles: Role[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!has(c.get("me"), ...roles)) return notAvailable(c);
    await next();
  };

export const ADMIN: Role[] = ["bank_owner", "cpo"];
