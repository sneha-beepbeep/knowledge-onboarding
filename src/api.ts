import { hc } from "hono/client";
import type { AppType } from "../worker/index";
import { getToken } from "./lib/session";

// Typed API client: calls match the routes in worker/index.ts. All front-end
// calls go through here (template convention).
export const api = hc<AppType>("/", {
  headers: (): Record<string, string> => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  },
}).api;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Jsonish = { ok: boolean; status: number; json(): Promise<unknown> };
type OkBody<R> = R extends { json(): Promise<infer B> } ? Exclude<B, { error: string }> : never;

export const SIGNED_OUT_EVENT = "kc:signed-out";

/**
 * Awaits a typed client call and returns the success body, or throws ApiError.
 * A 401 also signals the app shell to show the signed-out state, unless the
 * caller handles it itself (T3 keeps answers on the page).
 */
export async function ok<R extends Jsonish>(p: Promise<R>, opts: { handle401?: boolean } = {}): Promise<OkBody<R>> {
  let res: R;
  try {
    res = await p;
  } catch {
    throw new ApiError(0, "network");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && opts.handle401 !== false) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    throw new ApiError(res.status, typeof body.error === "string" ? body.error : "Something went wrong.", body);
  }
  return body as OkBody<R>;
}
