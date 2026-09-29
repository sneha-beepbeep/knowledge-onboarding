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
| API | Hono on Cloudflare Workers | `worker/index.ts` |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM | schema in `worker/db/schema.ts` |
| File/image storage | Cloudflare R2 | binding `IMAGES` |
| Config | `wrangler.jsonc` | bindings, names, deploy settings |

## Commands
- `npm run dev` — applies local DB migrations, starts everything at http://localhost:5173
- `npm run typecheck` — TypeScript check (run after every change)
- `npm run db:generate` — create a migration after editing `worker/db/schema.ts`
- `npm run db:migrate:local` / `npm run db:migrate:remote` — apply migrations
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc`
- `npm run deploy` — build and publish to Cloudflare

## Conventions
- **All API routes live under `/api`** in `worker/index.ts`, chained onto `routes` so the
  `AppType` export stays accurate. The frontend calls them only through the typed client in
  `src/api.ts` (`api.items.$get()` etc.) — never with hand-written `fetch("/api/...")`.
- **Changing the database:** edit `worker/db/schema.ts` → `npm run db:generate` →
  `npm run db:migrate:local`. Never edit old migration files; never write raw SQL tables
  by hand.
- **Files/images:** store the file in R2 and save only its key in the database.
  Serve files through an `/api/...` route.
- **Auth (when needed):** use token-based auth (`Authorization: Bearer ...`), not cookies,
  so the app can later be wrapped as a phone app with Capacitor.
- Validate input in API routes and return `{ error: "..." }` with a 4xx status on bad input.
- Keep secrets out of code: use `npx wrangler secret put NAME` for production and a
  `.dev.vars` file (git-ignored) for local development.
- After changes: run `npm run typecheck`, then check the feature in the browser.
- Commit to git after each working change, with a clear message.

## First deploy (one time)
The D1 `database_id` in `wrangler.jsonc` is a placeholder that only works locally.
1. `npx wrangler login` (opens the browser to sign in to Cloudflare)
2. Rename the app if wanted: change `name`, `database_name` and `bucket_name` in
   `wrangler.jsonc` (the Worker `name` becomes the URL: `<name>.<account>.workers.dev`)
3. `npx wrangler d1 create <database_name>` → copy the returned `database_id` into
   `wrangler.jsonc`
4. `npx wrangler r2 bucket create <bucket_name>`
5. `npm run db:migrate:remote`
6. `npm run deploy` → prints the live URL

Later deploys: `npm run db:migrate:remote` (if the schema changed), then `npm run deploy`.

## Later: phone app
When asked, add Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
`@capacitor/android`) with `webDir: "dist/client"`, and point the API client in `src/api.ts`
at the deployed URL instead of `/`.
