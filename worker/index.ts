import { Hono } from "hono";
import type { AppEnv } from "./types";
import { requireSession } from "./auth";
import { authRoutes } from "./routes/auth";
import { pilotRoutes } from "./routes/pilot";
import { peopleRoutes } from "./routes/people";
import { bankRoutes } from "./routes/bank";
import { draftRoutes } from "./routes/drafts";
import { reviewRoutes } from "./routes/review";
import { publishRoutes } from "./routes/publish";

// `Env` is generated from wrangler.jsonc by `npm run cf-typegen`.
const app = new Hono<AppEnv>().basePath("/api");

// Application logs carry error types only: never bodies, tokens, answers, notes or document text.
app.onError((err, c) => {
  console.error(`api_error ${c.req.method} ${new URL(c.req.url).pathname}: ${err.name}`);
  return c.json({ error: "Something went wrong. Try again." }, 500);
});

// Every route needs a valid session except these.
const PUBLIC = new Set(["/api/health", "/api/auth/bootstrap", "/api/auth/exchange"]);
app.use("*", async (c, next) => {
  if (PUBLIC.has(new URL(c.req.url).pathname)) return next();
  return requireSession(c, next);
});

const routes = app
  .get("/health", (c) => c.json({ ok: true }))
  .route("/", authRoutes)
  .route("/", pilotRoutes)
  .route("/", peopleRoutes)
  .route("/", bankRoutes)
  .route("/", draftRoutes)
  .route("/", reviewRoutes)
  .route("/", publishRoutes);

// Unknown API paths get the same uniform 404 as access failures.
app.notFound((c) => c.json({ error: "This page isn't available to you." }, 404));

// The frontend imports this type to get a fully typed API client (see src/api.ts).
export type AppType = typeof routes;

// Background drafting (Cloudflare Workflows), bound as DRAFT_WORKFLOW.
export { DraftTopicWorkflow } from "./ai/workflow";

export default app;
