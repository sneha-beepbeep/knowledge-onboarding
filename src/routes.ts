// Route table (technical plan §6). Roles here only choose which screen to show;
// the server enforces access on every route.
import type { RouteDef } from "./App";
import { A1Pilot } from "./screens/A1Pilot";
import { A2People } from "./screens/A2People";

const ADMIN = ["bank_owner", "cpo"] as const;

export const routes: RouteDef[] = [
  { path: "/pilot", roles: [...ADMIN], component: A1Pilot },
  { path: "/people", roles: [...ADMIN], component: A2People },
];
