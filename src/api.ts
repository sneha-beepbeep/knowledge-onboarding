import { hc } from "hono/client";
import type { AppType } from "../worker/index";

// Typed API client: calls match the routes in worker/index.ts.
export const api = hc<AppType>("/").api;
