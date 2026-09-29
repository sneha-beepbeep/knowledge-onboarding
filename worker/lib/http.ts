import type { Context } from "hono";

// One shared mapping from access failure to a uniform 404, so nothing leaks
// through error messages (design spec S0, technical plan §3).
export const NOT_AVAILABLE = "This page isn't available to you.";
export const FROZEN = "Version 1 is published. It stays unchanged for the whole pilot.";

export const notAvailable = (c: Context) => c.json({ error: NOT_AVAILABLE }, 404);
export const badRequest = (c: Context, error: string) => c.json({ error }, 400);
export const conflict = (c: Context, error: string) => c.json({ error }, 409);
export const frozen = (c: Context) => c.json({ error: FROZEN }, 409);

/** Parses a positive integer route parameter, or returns null. */
export function idParam(v: string | undefined): number | null {
  if (!v || !/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

/** Reads a JSON body as an unknown record; never throws. */
export async function jsonBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const v = await c.req.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

import { validator } from "hono/validator";

/**
 * JSON body middleware. `T` types the client (src/api.ts); handlers must still
 * check every field at runtime because the body is untrusted.
 */
export function body<T extends object>() {
  return validator("json", (v: unknown) =>
    (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Partial<T> as T,
  );
}
