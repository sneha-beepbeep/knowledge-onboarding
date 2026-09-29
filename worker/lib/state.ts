// Shared reads of pilot-wide state: config, the pilot row, role holders, the
// published version.
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { people, pilot, roleAssignments, versions, type Role } from "../db/schema";
import { dateInTz, isValidTimeZone } from "../../shared/dates";

export type DB = DrizzleD1Database<Record<string, never>>;
export const getDb = (env: Env): DB => drizzle(env.DB);

type EnvLike = Env & { ANTHROPIC_API_KEY?: string; AI_MOCK?: string; AI_ENABLED?: string };

export const isLocal = (env: Env) => (env as EnvLike).ENVIRONMENT === "local";

/** The deployed demo copy (worker knowledge-check-demo, its own D1). Never the pilot. */
export const isDemo = (env: Env) => (env as EnvLike).ENVIRONMENT === "demo";

/**
 * Mock AI is honoured only in the local environment (technical plan §4) and in
 * the deployed demo copy (CPO decision 2026-09-29: no Anthropic key in round 1,
 * the demo must still reach Send Form A). Production ignores AI_MOCK.
 */
export const aiMock = (env: Env) => (isLocal(env) || isDemo(env)) && (env as EnvLike).AI_MOCK === "1";

export const anthropicKey = (env: Env): string | undefined => {
  const k = (env as EnvLike).ANTHROPIC_API_KEY;
  return k && k.trim() ? k.trim() : undefined;
};

/**
 * AI-off mode (CPO decision 2026-09-29, round 1 without AI). Only the exact value
 * "false" turns AI drafting off; unset means on. When off, questions are loaded by
 * scripts/import-questions.mjs, drafting is refused, and the "AI provider set up"
 * item no longer blocks Send Form A.
 */
export const aiEnabled = (env: Env) => (env as EnvLike).AI_ENABLED !== "false";

/** "AI provider set up": the key exists (or the local mock is on). */
export const aiSetUp = (env: Env) => aiMock(env) || !!anthropicKey(env);

export const AI_PROVIDER_NAME = "Anthropic (Claude)";

/** The company timezone. Local dev falls back to UTC; production refuses a placeholder. */
export function appTz(env: Env): string {
  const tz = (env as EnvLike).APP_TIMEZONE ?? "";
  if (isValidTimeZone(tz)) return tz;
  if (isLocal(env)) return "UTC";
  throw new Error("APP_TIMEZONE is not configured");
}

export const today = (env: Env, now = Date.now()) => dateInTz(now, appTz(env));
export const dateOf = (env: Env, ms: number) => dateInTz(ms, appTz(env));

export type PilotRow = typeof pilot.$inferSelect;

export async function getPilot(db: DB): Promise<PilotRow> {
  const [row] = await db.select().from(pilot).where(eq(pilot.id, 1));
  if (row) return row;
  await db.insert(pilot).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select().from(pilot).where(eq(pilot.id, 1));
  return created;
}

export type RoleHolder = { personId: number; name: string; email: string | null };
export type RoleMap = Partial<Record<Role, RoleHolder>>;

export async function getRoleMap(db: DB): Promise<RoleMap> {
  const rows = await db
    .select({ role: roleAssignments.role, personId: people.id, name: people.name, email: people.email })
    .from(roleAssignments)
    .innerJoin(people, eq(people.id, roleAssignments.personId));
  const map: RoleMap = {};
  for (const r of rows) map[r.role] = { personId: r.personId, name: r.name, email: r.email };
  return map;
}

export async function rolesOf(db: DB, personId: number): Promise<Role[]> {
  const rows = await db
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(eq(roleAssignments.personId, personId));
  return rows.map((r) => r.role);
}

export type VersionRow = typeof versions.$inferSelect;

/** The single published version, or null before publish (the freeze check). */
export async function getVersion(db: DB): Promise<VersionRow | null> {
  const [v] = await db.select().from(versions).limit(1);
  return v ?? null;
}

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  follow_up_owner: "Follow-up owner",
  bank_owner: "Bank owner",
  reviewer: "Content reviewer",
  cpo: "Pilot sponsor (CPO)",
};
