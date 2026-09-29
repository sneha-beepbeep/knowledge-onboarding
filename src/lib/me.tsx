import { createContext, useContext } from "react";
import type { api } from "../api";
import type { InferResponseType } from "hono/client";

export type MeData = Exclude<InferResponseType<typeof api.me.$get>, { error: string }>;
export type Role = MeData["roles"][number];

export const MeContext = createContext<{ me: MeData; refreshMe: () => Promise<void> } | null>(null);

export function useMe() {
  const v = useContext(MeContext);
  if (!v) throw new Error("useMe outside MeContext");
  return v;
}

export const hasRole = (me: MeData, ...roles: Role[]) => roles.some((r) => me.roles.includes(r));
export const isAdminMe = (me: MeData) => hasRole(me, "bank_owner", "cpo");

/** `/` sends each user to their home screen (technical plan §6). */
export function homePath(me: MeData): string {
  if (isAdminMe(me)) return "/pilot";
  if (hasRole(me, "follow_up_owner")) return "/flags";
  if (hasRole(me, "reviewer")) return "/review";
  if (hasRole(me, "student")) return me.needsNotice ? "/notice" : "/checks";
  return "/";
}
