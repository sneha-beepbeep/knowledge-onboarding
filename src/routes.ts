// Route table (technical plan §6). Roles here only choose which screen to show;
// the server enforces access on every route.
import type { RouteDef } from "./App";
import { A1Pilot } from "./screens/A1Pilot";
import { A2People } from "./screens/A2People";
import { A3Bank } from "./screens/A3Bank";
import { V1Queue, V2Question, V3Stats } from "./screens/Review";

const ADMIN = ["bank_owner", "cpo"] as const;

export const routes: RouteDef[] = [
  { path: "/pilot", roles: [...ADMIN], component: A1Pilot },
  { path: "/people", roles: [...ADMIN], component: A2People },
  { path: "/bank", roles: [...ADMIN], component: A3Bank },
  { path: "/review", roles: ["reviewer", ...ADMIN], component: V1Queue },
  { path: "/review/stats", roles: ["reviewer", ...ADMIN], component: V3Stats },
  { path: "/review/:id", roles: ["reviewer", ...ADMIN], component: V2Question },
];
