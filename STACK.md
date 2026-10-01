# Project guide for Claude Code

## Who you're working with
The person using this project may not be a developer. Explain what you're doing in plain
language, keep changes small, and after each change tell them how to see it (e.g. "refresh
the page at http://localhost:5173"). Ask before doing anything that deletes data or
costs money.

## The stack — stick to it
This is a single Cloudflare Worker that serves both the website and the API.
Do NOT add other frameworks, databases, hosting platforms or UI libraries unless the
person explicitly asks. If a feature seems to need one, explain the trade-off and ask first.

| Part | Tool | Where |
|---|---|---|
| Frontend | React + Vite + TypeScript | `src/` |
| API | Hono on Cloudflare Workers | `worker/index.ts`, routes in `worker/routes/` |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM | schema in `worker/db/schema.ts` |
| Background AI drafting | Cloudflare Workflows | binding `DRAFT_WORKFLOW` (off in round 1) |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` | `test/` |
| Config | `wrangler.jsonc` | bindings, names, vars, the `demo` environment |

There is no file storage (no R2): uploaded documents are turned into text in the browser
(PDFs with `pdfjs-dist`) and only the text is saved in D1.

## Commands
- `npm run dev` — applies local DB migrations, starts everything at http://localhost:5173
- `npm run typecheck` — TypeScript check (run after every change)
- `npx vitest run` (or `npm test`) — the test suite
- `npm run db:generate` — create a migration after editing `worker/db/schema.ts`
- `npm run db:migrate:local` / `npm run db:migrate:remote` — apply migrations
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc`
- `npm run deploy` — runs the deploy guard, then builds and publishes **production**
- `npm run deploy:demo` — builds and publishes the **demo copy** (see below)
- `npm run import:questions -- <file.json> [--check]` — loads hand-written questions into
  the local app (see below)
- `npm run seed:demo` — loads the synthetic Slack-guide questions into the local app

## Conventions
- **All API routes live under `/api`**, chained onto `routes` in `worker/index.ts` so the
  `AppType` export stays accurate. The frontend calls them only through the typed client in
  `src/api.ts` (`api.pilot.$get()` etc.) — never with hand-written `fetch("/api/...")`.
- **Changing the database:** edit `worker/db/schema.ts` → `npm run db:generate` →
  `npm run db:migrate:local`. Never edit old migration files; never write raw SQL tables
  by hand.
- **Auth:** token-based (`Authorization: Bearer ...`), not cookies. People sign in with a
  14-day sign-in link; issuing a new link replaces the old one and ends that person's
  sessions (technical plan §5).
- Validate input in API routes and return `{ error: "..." }` with a 4xx status on bad input.
- Keep secrets out of code: use `npx wrangler secret put NAME` for production and a
  `.dev.vars` file (git-ignored; copy `.dev.vars.example`) for local development.
- After changes: run `npm run typecheck` and `npx vitest run`, then check the feature in the
  browser.
- Commit to git after each working change, with a clear message.

## Settings (`vars` in `wrangler.jsonc`)
- `ENVIRONMENT` — `"production"` at the top level, `"demo"` in `env.demo`, `"local"` in
  `.dev.vars`. Only local and demo allow `AI_MOCK` (canned drafts, no AI call).
- `AI_ENABLED` — `"false"` in production for round 1: no AI drafting, questions come from the
  importer. Only the exact value `"false"` turns AI off; unset means on. Local dev inherits
  `"false"`; set `AI_ENABLED=true` in `.dev.vars` to use mock drafting locally.
- `APP_TIMEZONE` — `"Etc/GMT-2"` (company time, fixed GMT+2 all year; the `Etc/` sign is
  inverted on purpose). Drives "today", due dates and overdue.
- `AI_MODEL` — the Claude model used when AI is on.
- Secrets: `BOOTSTRAP_TOKEN` (first CPO set-up, below). `ANTHROPIC_API_KEY` is **not** set
  in round 1.

## The deploy guard
`npm run deploy` first runs `scripts/check-deploy-config.mjs` (rules in
`scripts/lib/wrangler-config.mjs`). It checks the top-level (production) config only and
refuses to deploy if the D1 `database_id` is still the placeholder, `ENVIRONMENT` isn't
`"production"`, `APP_TIMEZONE` isn't a valid time zone, `AI_ENABLED` is anything other than
`"true"` or `"false"`, `AI_MOCK` is set, the config names the demo worker or database, or
`CLOUDFLARE_ENV` is set. It does **not** check which Cloudflare account you're logged in to.
Don't work around it; fix the config.

## First production deploy
**The go-live order, owners and checks are in `docs/release-notes.md` §3 (rollout
checklist). Follow that, not this list.** This is only what the commands do:
1. `npx wrangler login`, then `npx wrangler whoami` — must be the **company** account.
2. `npx wrangler d1 create onboarding-knowledge-check-db --location weur` (EU) → paste the
   returned id into the top-level `database_id` in `wrangler.jsonc` and commit.
3. `npm run db:migrate:remote`, then `npm run deploy` (guard, build, publish).
4. **First CPO:** `npx wrangler secret put BOOTSTRAP_TOKEN` with a random value. The CPO
   opens `<URL>/setup` and enters that code and their name. `/setup` stops working once a
   CPO exists; the secret can then be deleted (`npx wrangler secret delete BOOTSTRAP_TOKEN`).
   Everyone else gets a sign-in link from the app (A2).

Later deploys: `npm run db:migrate:remote` (if the schema changed), then `npm run deploy`.

## The demo copy
`npm run deploy:demo` (`scripts/deploy-demo.mjs`) deploys `env.demo`: its own worker
(`knowledge-check-demo`), D1 (`knowledge-check-demo-db`, created in `weur` on first run) and
Workflow, with `ENVIRONMENT="demo"` and mock AI. It asks you to confirm the account, writes
the demo `database_id` into `wrangler.jsonc`, and saves a fresh demo `BOOTSTRAP_TOKEN` to
`.demo-bootstrap.local` (git-ignored). `-- --seed` loads the synthetic Slack-guide data;
`-- --dry-run` prints the commands only. The demo URL is public: **never put real names,
real material or real results in it.** It never goes through the production guard.
See `docs/release-notes.md` §6.

## The question importer (round 1)
In round 1 the bank owner writes the questions by hand and loads them with
`scripts/import-questions.mjs`. The guide and file format are in `scripts/import/README.md`
(example: `scripts/import/example.json`).
- `npm run import:questions -- <file.json> --check` checks only; without `--check` it loads
  into the **local** app.
- Every question goes through the app's validation and grounding and lands "waiting for
  review"; the reviewer still approves each one. All or nothing.
- Remote loading needs `--remote <db> --confirm-remote=<db>` and accepts only the demo DB,
  or the production DB when the deploy guard passes. For production this is rollout step 6
  in `docs/release-notes.md` §3.

## Later: phone app
When asked, add Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
`@capacitor/android`) with `webDir: "dist/client"`, and point the API client in `src/api.ts`
at the deployed URL instead of `/`.
