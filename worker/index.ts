import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authRoutes } from "./routes/auth";

// `Env` is generated from wrangler.jsonc by `npm run cf-typegen`.
const app = new Hono<AppEnv>().basePath("/api");

// Application logs carry error types only: never bodies, tokens, answers, notes or document text.
app.onError((err, c) => {
  console.error(`api_error ${c.req.method} ${new URL(c.req.url).pathname}: ${err.name}`);
  return c.json({ error: "Something went wrong. Try again." }, 500);
});

const routes = app.get("/health", (c) => c.json({ ok: true })).route("/", authRoutes);

// The frontend imports this type to get a fully typed API client (see src/api.ts).
export type AppType = typeof routes;

export default app;
