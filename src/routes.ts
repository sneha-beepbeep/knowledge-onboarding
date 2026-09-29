// Route table (technical plan §6). Roles here only choose which screen to show;
// the server enforces access on every route.
import type { RouteDef } from "./App";
import { A1Pilot } from "./screens/A1Pilot";
import { A2People } from "./screens/A2People";
import { A3Bank } from "./screens/A3Bank";
import { V1Queue, V2Question, V3Stats } from "./screens/Review";
import { A4Publish } from "./screens/A4Publish";
import { T1Home, T2Notice, T3Quiz } from "./screens/Student";
import { R1Results, R2Compare } from "./screens/Results";
import { M1Flags, M2Flag } from "./screens/Flags";

const ADMIN = ["bank_owner", "cpo"] as const;

export const routes: RouteDef[] = [
  { path: "/pilot", roles: [...ADMIN], component: A1Pilot },
  { path: "/people", roles: [...ADMIN], component: A2People },
  { path: "/bank", roles: [...ADMIN], component: A3Bank },
  { path: "/publish", roles: [...ADMIN], component: A4Publish },
  { path: "/review", roles: ["reviewer", ...ADMIN], component: V1Queue },
  { path: "/review/stats", roles: ["reviewer", ...ADMIN], component: V3Stats },
  { path: "/review/:id", roles: ["reviewer", ...ADMIN], component: V2Question },
  { path: "/checks", roles: ["student"], component: T1Home },
  { path: "/notice", roles: ["student"], component: T2Notice, bare: true },
  { path: "/check/:form", roles: ["student"], component: T3Quiz },
  { path: "/results/:attemptId", roles: ["student", "follow_up_owner", ...ADMIN], component: R1Results },
  { path: "/compare/:personId", roles: ["student", "follow_up_owner", ...ADMIN], component: R2Compare },
  { path: "/flags", roles: ["follow_up_owner", ...ADMIN], component: M1Flags },
  { path: "/flags/:id", roles: ["follow_up_owner", ...ADMIN], component: M2Flag },
];
