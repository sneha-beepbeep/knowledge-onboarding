import { Hono } from "hono";

// `Env` is generated from wrangler.jsonc by `npm run cf-typegen`.
const app = new Hono<{ Bindings: Env }>().basePath("/api");

const routes = app.get("/health", (c) => c.json({ ok: true }));

// The frontend imports this type to get a fully typed API client (see src/api.ts).
export type AppType = typeof routes;

export default app;
