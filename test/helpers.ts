// Test fixtures. Generic people only; never real names or initials.
import { env, exports } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { people, roleAssignments, sessions, type Role } from "../worker/db/schema";
import { sha256 } from "../worker/auth";

export const db = () => drizzle(env.DB);

export type Persona = "student" | "fuo" | "bank" | "reviewer" | "cpo";
export const PERSONAS: Persona[] = ["student", "fuo", "bank", "reviewer", "cpo"];

const PERSONA_ROLE: Record<Persona, Role> = {
  student: "student",
  fuo: "follow_up_owner",
  bank: "bank_owner",
  reviewer: "reviewer",
  cpo: "cpo",
};

export const NAMES: Record<Persona, string> = {
  student: "Pat Student",
  fuo: "Morgan Manager",
  bank: "Blake Bankowner",
  reviewer: "Riley Reviewer",
  cpo: "Casey Sponsor",
};

export type World = {
  ids: Record<Persona, number>;
  tokens: Record<Persona, string>;
  outsider: { id: number; token: string };
};

/** Wipes all app tables (keeps the schema). */
export async function wipe() {
  const tables = [
    "deletion_log", "followups", "flag_topics", "flags", "answers", "attempt_topic_scores", "attempts",
    "participation", "form_questions", "versions", "questions", "draft_runs", "document_topics",
    "documents", "topics", "pilot", "sessions", "sign_in_links", "role_assignments", "people",
  ];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}

export async function addPerson(name: string, roles: Role[] = []): Promise<{ id: number; token: string }> {
  const d = db();
  const now = Date.now();
  const [p] = await d.insert(people).values({ name, createdAt: now }).returning();
  for (const role of roles) await d.insert(roleAssignments).values({ role, personId: p.id, assignedAt: now });
  const token = `tok-${p.id}-${crypto.randomUUID()}`;
  await d.insert(sessions).values({ personId: p.id, tokenHash: await sha256(token), createdAt: now, expiresAt: now + 86_400_000 });
  return { id: p.id, token };
}

/** Five personas, each holding exactly one role, plus a signed-in person with no role. */
export async function makeWorld(): Promise<World> {
  await wipe();
  const ids = {} as Record<Persona, number>;
  const tokens = {} as Record<Persona, string>;
  for (const p of PERSONAS) {
    const r = await addPerson(NAMES[p], [PERSONA_ROLE[p]]);
    ids[p] = r.id;
    tokens[p] = r.token;
  }
  const outsider = await addPerson("Noah Norole");
  return { ids, tokens, outsider };
}

export async function call(
  method: string,
  path: string,
  opts: { token?: string; json?: unknown } = {},
): Promise<{ status: number; body: any; text: string; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await exports.default.fetch(
    new Request(`https://kc.test${path}`, {
      method,
      headers,
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    }),
  );
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text, headers: res.headers };
  }
  const buf = await res.arrayBuffer();
  return { status: res.status, body: buf, text: "", headers: res.headers };
}
