import { hc } from "hono/client";
import type { AppType } from "../worker/index";

// Typed API client: `api.items.$get()` etc. match the routes in worker/index.ts.
// If a route changes on the backend, TypeScript flags every place that uses it here.
export const api = hc<AppType>("/").api;

export const imageUrl = (key: string) => `/api/images/${encodeURIComponent(key)}`;
