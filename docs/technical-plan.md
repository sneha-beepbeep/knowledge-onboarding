# Technical Plan: Onboarding Knowledge Check (working title)

*Stage 5 `/plan`, 2026-09-29. CPO-approved 2026-09-29 with all engineer recommendations in section 11. Updated after approval on 2026-09-29: see section 13 (round 1 without AI, demo environment, timezone).*

Sources: `docs/design-spec.md` (rev. 2, CPO-approved), `docs/prd.md` (rev. 2, CPO-approved), `docs/opportunity-brief.md`, and the template `sneha-beepbeep/techstack-togs` at commit `82ef6fc` (Vite + React 19, Hono on Workers, D1 + Drizzle, an R2 binding, one example `items` table).

Scope is the 12 Musts (F1–F12) and the 18 screens and dialogs (S0, A1–A6 including A3a, V1–V3, T1–T3, R1–R2, M1–M2). Nothing else.

**Still open after approval** (none of these blocks the build):
- ~~`APP_TIMEZONE` has not been provided yet.~~ Decided: `Etc/GMT-2` (fixed GMT+2 all year, no daylight saving), section 13.
- The Cloudflare account has not been created yet.
- The S/N/E role mapping is still awaiting CPO confirmation.

---

## 1. Architecture overview

This is one Cloudflare Worker, as the template intends. It serves the React app and all `/api/*` routes. The template's conventions are kept: Hono routes chained onto `routes` so the typed client stays accurate, all front-end calls go through `src/api.ts`, schema changes go through Drizzle migrations, sign-in uses a Bearer token (not cookies), secrets use `wrangler secret`, and each working step gets a commit.

**Kept from the template:** Vite, React, TypeScript, Hono, the typed `hc` client, D1 with Drizzle and drizzle-kit, the `wrangler.jsonc` layout, the npm scripts, and `observability`.

**Removed:**
- The example `items` table, its routes and its UI.
- The **R2 bucket** (`IMAGES`). We store no files. PDFs are turned into text in the browser, and only that text is stored in D1. This is one fewer thing to create before deploying. The follow-up owner sees the stored text, not the original PDF.
- The template's `migrations/0000_init.sql`. It was never applied for this product, so we start with a fresh `0000`. This is a knowing exception to the template rule "never edit old migrations".

**Added:**
- **Cloudflare Workflows** binding `DRAFT_WORKFLOW` (part of Workers, not a new vendor). It runs AI drafting in the background (section 4).
- Worker modules:
  - `worker/auth.ts`: session middleware and role guards.
  - `worker/routes/*.ts`: admin, bank, review, student, results, flags, data.
  - `worker/ai/`: the prompt, the Anthropic call, validation and the grounding check.
  - `worker/lib/`: working days, scoring, form split, CSV, the notice text.
- Front-end screens under `src/screens/`, a router of about 40 lines written by hand (no new library), and small shared components.
- New npm packages (approved by the CPO, section 11):
  - `pdfjs-dist`: PDF text extraction in the browser, loaded only on A3a.
  - `fflate`: packs the five CSVs into one zip.
  - `vitest` and `@cloudflare/vitest-pool-workers`: tests (dev only).

**Anthropic** is called with plain `fetch` to `https://api.anthropic.com/v1/messages`, so no SDK package is needed. The key is the Worker secret `ANTHROPIC_API_KEY`. Only onboarding document text, topic names and existing question texts are ever sent. Nothing about people is sent.

**Timing and dates:** timestamps are stored as epoch ms. Calendar dates (version date, follow-up date, due dates) are stored as `YYYY-MM-DD` in the configured company timezone (`APP_TIMEZONE`).

## 2. Data model (Drizzle, `worker/db/schema.ts` → a single generated migration `0000`)

| Table | Key columns | Notes |
|---|---|---|
| `people` | id, name, email (optional, display only), created_at | Everyone who holds a role |
| `role_assignments` | role (`student`/`follow_up_owner`/`bank_owner`/`reviewer`/`cpo`) UNIQUE, person_id | One holder per role. A person can appear under several roles |
| `sign_in_links` | id, person_id, token_hash, created_at, expires_at, revoked_at | Only the SHA-256 hash is stored. The link is shown once |
| `sessions` | id, person_id, token_hash, created_at, expires_at | 30-day sliding expiry |
| `pilot` (single row) | per_topic_count (default 4), drafting_consent_at/by, hr_signoff_date, hr_signoff_by, hr_notice_version, hr_recorded_at, form_a_sent_at/by | The row is created on first read |
| `topics` | id, name UNIQUE | |
| `documents` | id, name, version_date, text, char_count, source (`pdf`/`txt`/`paste`), created_at | Hard delete on *Remove*. Drafts keep a snapshot of their passage |
| `document_topics` | document_id, topic_id | |
| `draft_runs` | id, topic_id, kind (`initial`/`more`), requested, status (`running`/`done`/`failed`), created_count, discarded_count, error_reason, model, started_at, finished_at | Drives the A3 status line |
| `questions` | id, topic_id, draft_run_id, document_id (nullable), document_name, quote, context_before, context_after, text, options (JSON, 4 items), correct_index, ai_original (JSON), status (`pending`/`approved`/`rejected`/`discarded`), edit_kind (`none`/`minor`/`substantial`), reject_reasons (JSON), reject_note, discard_reason, reviewed_by, reviewed_at, updated_at | Discarded drafts are kept as rows so the export can count them. `updated_at` catches concurrent edits |
| `versions` | id, number (=1), published_at, published_by, threshold_pct, per_topic_count | Once a version row exists, every bank and review write is refused (the freeze) |
| `form_questions` | version_id, form (`A`/`B`), topic_id, question_id, position | An approved question not in this table is "Not used" |
| `participation` | id, person_id, notice_version, choice (`take_part`/`decline`), recorded_at | Only ever appended to. The latest row counts, so the student can change their mind |
| `attempts` | id, person_id, version_id, form, submitted_at, overall_correct, overall_total | UNIQUE(person_id, version_id, form), so each form can be submitted once |
| `attempt_topic_scores` | attempt_id, topic_id, correct, total, below_threshold | |
| `answers` | attempt_id, question_id, topic_id, chosen_index, correct_index, is_correct | |
| `flags` | id, attempt_id UNIQUE, person_id, owner_person_id, flagged_at, due_date | One flag per attempt (D8) |
| `flag_topics` | flag_id, topic_id, correct, total | |
| `followups` | flag_id, topic_id (UNIQUE pair), followup_date, note (≤200), logged_by, logged_at (original), updated_at | |
| `deletion_log` | id, person_id, person_name, deleted_at, deleted_by_name, counts (JSON) | A record that a deletion happened, not the deleted data |

Values that are computed rather than stored:
- Readiness.
- Form B availability and due date (10 working days after the last follow-up, or after the Form A submission when there is no flag).
- Day 0, day 90 and the retention date.
- M3 figures.
- V3 statistics, computed live from `answers` (decision 5, section 11).

## 3. API endpoints, screens, requirements and authorization

**Access levels:**
- **STU**: holds the `student` role. Can only reach their own data, and the route takes the person ID from the session, never from the URL.
- **FUO**: currently holds `follow_up_owner`. Can see only the person currently assigned `student`.
- **REV**: reviewer.
- **ADM**: bank owner or CPO.
- **CPO**: CPO only.

A person with several roles gets the union of their access. A request without a valid session gets `401`. A request for a resource outside the caller's access gets a uniform `404 {error:"This page isn't available to you."}`, whether or not the resource exists (S0).

| Endpoint | Screen | Req. | Rule |
|---|---|---|---|
| POST `/api/auth/bootstrap` | first setup | F12 | Public. Needs the `BOOTSTRAP_TOKEN` secret, and works only while no CPO exists. Creates the CPO |
| POST `/api/auth/exchange` {token} | S0 | F12 | Public. The link must be valid, not expired and not revoked. Returns a session token |
| POST `/api/auth/signout` · GET `/api/me` | S0, nav | F12 | Any signed-in user. `/me` returns roles, badge counts (only for roles held) and the bank owner's name for the "no role" state |
| GET `/api/pilot` | A1 | F4, F7–F9, F12, M1, M3 | ADM |
| POST `/api/pilot/hr-signoff` | A1 | §6 gate | **CPO** |
| POST `/api/pilot/form-a/link` · POST `/api/pilot/form-a/sent` | A5 | F5, C6 | ADM, and the server re-checks that readiness is complete |
| GET `/api/roles` · PUT `/api/roles/:role` · POST `/api/people/:id/link` | A2 | F12 | ADM. Assigning the `cpo` role, or issuing links for admins, is CPO only. Changing the follow-up owner moves open flags to the new owner |
| GET `/api/bank` · PUT `/api/bank/settings` · POST `/api/bank/consent` | A3 | F1, F2 | ADM. Writes are refused after publish |
| POST `/api/documents` (JSON: name, versionDate, topics[], text, source) · DELETE `/api/documents/:id` | A3a, A3 | F1 | ADM, before publish. Size limits are enforced here |
| GET `/api/documents/:id` | V2, M2 | F2, F7 | ADM or REV. FUO only if the document is tagged with a weak topic of a flag on their student |
| POST `/api/topics/:id/drafts` {kind} | A3 | F2 | ADM. AI must be set up, consent recorded, the bank unpublished, and no run already in progress for that topic |
| GET `/api/publish` · POST `/api/publish` | A4 | F3, F4, F7 | ADM. The server re-checks every publish rule |
| GET `/api/review/questions?status=` · GET `/api/review/questions/:id` | V1, V2 | F2, F3 | REV or ADM. The response contains no data about people |
| POST `/api/review/questions/:id/decision` · `/undo` | V2 | F3 | **REV only**, before publish, with a check that nobody else changed the question in the meantime |
| GET `/api/stats` | V3 | §6, M3 | REV or ADM. Answer statistics are **removed on the server** for any question with fewer than 5 distinct respondents. No names or dates are ever included |
| GET `/api/my/checks` | T1 | F5, F9 | STU. Follow-ups appear as topics, due date and "done [date]" only. **The note is never included** |
| GET `/api/my/notice` · POST `/api/my/participation` | T2 | §6 | STU. Stores the choice, the time and the notice version |
| GET `/api/my/forms/:form` | T3 | F4, F5 | STU. The form must be sent (A) or unlocked (B), the student must have chosen *Take part*, HR sign-off must match the current notice version, and the form must not be submitted yet. **Correct answers are removed.** Only published form questions are reachable; drafts never are |
| POST `/api/my/forms/:form/attempt` | T3 → R1 | F5, F6, F7 | STU. Every question must be answered. Scores the attempt, stores it and creates the flag in one batch |
| GET `/api/attempts/:id` | R1 | F5–F7 | STU for their own, FUO for their student, ADM. **The overall score is only returned to ADM.** The flag link goes to FUO and ADM only. Notes are never returned |
| GET `/api/comparison/:personId` | R2 | F9 | Same rule as R1 |
| GET `/api/flags` | M1 | F7 | FUO (their own) or ADM. A student who declined and one who hasn't started get the **identical** `not_taken` state |
| GET `/api/flags/:id` · PUT `/api/flags/:id/followups/:topicId` | M2 | F8, F9 | Reading: FUO or ADM. Writing: the current FUO only, until Form B is submitted. Logging the last weak topic unlocks Form B |
| GET `/api/export` | A6 | F10 | ADM. Returns one zip with the five CSVs |
| GET `/api/data/people` · DELETE `/api/data/people/:id` {confirmName} | A6 | F11 | ADM. The name must match exactly. The delete is all-or-nothing (section 7) |

## 4. AI drafting pipeline

> **Round 1 runs without AI** (section 13): `AI_ENABLED` is `"false"` in production, drafting is refused, and questions are hand-written and loaded with the importer. This section describes the AI-on path, which is kept for round 2.

**Model: `claude-opus-5-5`** (decided, section 11), with the model name held in a `vars.AI_MODEL` setting so switching is a one-line change. Why:
- The total cost is a few dollars whichever model we use (see below).
- Draft quality drives M3 and K3 (the rewrite rate) and M4 (reviewer effort). Using the most capable model gives the build decision its fairest test. *(Since section 13, this reasoning applies to round 2 only. In round 1 there are no AI drafts, and K3 is suspended.)*
- Speed doesn't matter because drafting runs in the background.

Switching to `claude-sonnet-5-5` is a config change. The exact model IDs and prices will be confirmed in the Anthropic console at build time.

**How drafting runs (Cloudflare Workflow `DraftTopicWorkflow`):**
1. `POST /api/topics/:id/drafts` creates a `draft_runs` row (`running`), starts the workflow and returns at once. A3 checks progress every 3 seconds, and the status is read out to screen readers.
2. Step "call model": a retrying step (3 attempts with backoff, for 429, 5xx and 529 errors).
3. Step "validate and save": writes the pending questions, the discarded rows and the run totals in one D1 batch. On failure nothing is saved (A3: "Nothing was saved").
4. A run that is still `running` after 15 minutes is shown as failed with "timed out".

The spec's "You can leave this page. Drafting continues." is only true with a background job, which is why Workflows was chosen.

**Prompt approach:**
- The system prompt says: write single-answer multiple-choice questions **in English** for an onboarding knowledge check, using **only** the documents provided. Test understanding, not trivia. Exactly 4 options, with one clearly correct answer and plausible wrong options. Leave out confidential or personal details. Each question must quote, word for word, the passage that supports its correct answer.
- The documents are wrapped in `<document id name>` tags.
- For *Draft 5 more*, the texts of the topic's existing questions are sent so the model avoids duplicates.
- Output comes back as structured JSON: a forced tool call, `submit_questions`, with a JSON schema of `{question, options[4], correct_index, document_id, quote}`. `max_tokens` is about 16k.
- Question counts: `2 × per-form + 2` (10) the first time, 5 for *Draft 5 more*.

**Validation and grounding check** (on the server, for each draft). A draft is discarded, with its reason stored and counted, if any of these fail:
- The question text is present and ≤500 characters.
- There are exactly 4 options, each non-empty, distinct (ignoring case) and ≤200 characters.
- `correct_index` is between 0 and 3.
- The quote is 30–600 characters.
- **The quote is found word for word** in one of the topic's documents, after one normalisation applied to both sides: NFKC, curly quotes made straight, dash variants made one hyphen, runs of whitespace collapsed. The check is case-sensitive.

The normaliser keeps a map back to positions in the original text. That lets us store the quote plus the paragraph before and after it ("about two paragraphs of context" for V2). The snapshot survives if the document is removed later.

A3 shows "N drafts were discarded because they didn't quote your material correctly." Discarded drafts appear in the `review_outcomes` export as "discarded invalid" and are left out of M3.

**Errors shown on A3** (the whole topic fails, with *Try again*):
- 429, 5xx or 529 after retries: "service unavailable".
- Timeout: "timed out".
- Topic material over the limit, or a context-length error: "document too long".
- 401 or 403: "AI set-up problem, contact the pilot team".
- Output cut off at the token limit, or unreadable: "service unavailable". Nothing is saved.

**Limits** (the spec's "[plan]" items):
- PDF up to 10 MB.
- Extracted or pasted text up to **150,000 characters per document** (about 60 pages). Above that, A3a shows its "too long" message.
- Up to 400,000 characters per topic in total (about 100k tokens).

**Is the AI set up:** A1 and A3 show *Set up* when the `ANTHROPIC_API_KEY` secret is present. The operating rule is that the key is put in **only after IT/security has approved Anthropic**. The first-drafting consent dialog names "Anthropic (Claude)".

**Local mock:** with `AI_MOCK=1` in `.dev.vars` (honoured only when `ENVIRONMENT=local`), the app returns canned drafts quoted from the uploaded text. This lets us build and test the whole app before IT approval, with no material leaving the laptop.

**Cost estimate:** one topic call is about 30k input tokens (material and prompt) and 5k output tokens. For 5 topics, counting the first drafts, top-ups and retries, that is about 12–15 calls, or roughly 0.5M input and 75k output tokens. Even at Opus-tier list prices this is **well under $20 for the whole pilot**, and a few dollars with Sonnet. There is no per-student AI cost, because the quiz never calls the model.

## 5. Auth and sign-in

**Decided: signed one-link sign-in, with no email and no account creation.**
- An admin creates a person on A2 (name, optional email) and copies their sign-in link: `https://<app>/start#t=<random 256-bit token>`.
- The token sits after the `#`, so it never reaches server logs, link previews or referrer headers.
- The page swaps the token for a session token through a `POST` (email link-scanners don't run JavaScript, so they can't use it up). The token is then cleared from the address bar.
- The session token is kept in `localStorage` and sent as `Authorization: Bearer`, following the template convention.
- Links can be used more than once, **last 14 days, and can be revoked**: issuing a new link revokes the old one. Sessions last 30 days and extend on use.
- **The Form A link is the student's sign-in link.** A5 creates it, shows it with *Copy link*, then *Mark as sent*.
- **Bootstrap:** the CPO signs in once with the `BOOTSTRAP_TOKEN` secret. That route shuts itself off once a CPO exists.

**Rollout bar check (C6):**
- Bank owner: A1 → *Send Form A* → A5 *Copy link* → paste it into email or chat. This is the same as sharing a Forms link.
- Student: open the link → T2 → T3 → Submit. This matches the spec's parity table exactly.

**Session expiry mid-quiz:**
- T3 keeps answers in React state, mirrored to `sessionStorage` (tab-only, cleared when submitted). This is not a saved-progress feature, since closing the tab still loses the answers (D5).
- If submitting returns 401, T3 shows the spec's message. The student opens their link again in a new tab, which refreshes the token.
- Retrying *Submit* reads the new token. A reload in the same tab gets the answers back from `sessionStorage`.

**Trade-offs considered:**

| Option | Student steps | Set-up | Risks |
|---|---|---|---|
| **Sign-in link (chosen)** | Click the link. Parity holds | None outside the app | Anyone holding the link is that person until it is revoked or expires. Links must be shared privately. Admin links carry full data access, so only the CPO can issue them |
| Cloudflare Access + company identity provider (Entra/Google) | Silent if already signed in | IT has to connect the company identity provider to Cloudflare Zero Trust. That is another IT dependency, and IT is already the slowest item | Uses cookies (against the template's Bearer convention; the Worker would check the `Cf-Access-Jwt-Assertion` header instead) |
| Cloudflare Access with a one-time PIN by email | Enter email, wait, type code | Low | **Breaks the rollout bar** (extra steps) |

Access could be added later as an outer layer without changing the app's roles.

## 6. Front-end structure

`src/App.tsx` is the shell: it restores the session, loads `/api/me`, and builds the nav from the union of roles, with the badges *Review (N)* and *Flags (N)*. `src/lib/router.ts` is a small history-API router.

Shared components:
- `Page` (one H1, the page title, `lang="en"`)
- `StatusLabel` (text plus icon, never colour alone)
- `ErrorSummary`
- `LiveRegion`
- `ConfirmDialog` (native `<dialog>`)
- `Skeleton`
- `DataTable` (a real table with header cells)

Styling extends the template's `index.css`, with no UI library.

| Route | Screen |
|---|---|
| `/start#t=…`, and fallback states | **S0** (signed out, no role, not available) |
| `/pilot` | **A1**, with the HR sign-off form and the **A5** dialog |
| `/people` | **A2** |
| `/bank` | **A3**, with the **A3a** dialog (`src/lib/pdf.ts` loads pdf.js lazily) |
| `/publish` | **A4** |
| `/data` | **A6** |
| `/review`, `/review/:id`, `/review/stats` | **V1**, **V2** (A/E/R keys, checklist panel), **V3** |
| `/checks`, `/notice`, `/check/a`, `/check/b` | **T1**, **T2** (full page, no nav), **T3** |
| `/results/:attemptId`, `/compare/:personId` | **R1**, **R2** (shared; the heading depends on the viewer) |
| `/flags`, `/flags/:id` | **M1**, **M2** (source documents open in a panel inside M2, not on a new screen) |

`/` sends each user to their home screen: A1 for admins, M1 for the follow-up owner, V1 for the reviewer, T1 or T2 for the student.

All copy comes from the spec's sections 5 and 7, following the framing rules in 7.2. The notice text lives in `worker/lib/notice.ts` with a `NOTICE_VERSION`. It fills placeholders, falls back to role labels, and applies the role-overlap rule (decision 7). When HR's final text arrives, we replace the text, increase the version and deploy.

## 7. Privacy implementation

**Enforcement on the server** (not just hidden in the UI):
- The rules are in section 3.
- Each audience gets its own serializer: `toStudentView`, `toOwnerView`, `toAdminView`. Fields that must not be seen (the note, the overall score, correct answers before submission, participation for the manager, names for the reviewer) never enter the response, rather than being filtered out afterwards.
- Student routes have no ID parameters.
- A single shared mapping from access failure to 404 ensures nothing leaks through error messages.
- **Declines:** the manager has no route that returns participation. M1 collapses "declined" and "not started" into one state. No message is sent to anyone.

**Deletion (F11):**
- Counts are read first. Then **one `db.batch()`** (a single D1 transaction) deletes the person's answers, attempt topic scores, attempts, flag topics, follow-ups, flags, participation, sign-in links and sessions, and **writes the deletion log**.
- If anything fails, nothing changes. The role assignment and the person row stay, so A1 can show "Data deleted [date]".
- Retention dates are shown on A1 and A6. Deletion is manual, as the spec says.

**Two things HR should know:**
1. **D1 Time Travel keeps point-in-time backups** (7 days on the Free plan, 30 on Paid). Deleted rows can be recovered from those backups until they age out. This is ordinary backup retention and should go into the HR notes.
2. **At n=1, "anonymised question statistics" are not anonymous.** Decided (section 11, decision 5): V3 computes answer statistics live from `answers` (so deleting the student removes them), and A6 says it keeps **"review outcomes (these contain no names)"** only. This changes one sentence of spec copy.

**What is logged:**
- Workers observability records the method, path and status of each request. Paths contain only numeric IDs, and sign-in tokens never appear in URLs.
- Application logs contain error types and draft-run IDs only. **They never contain request bodies, tokens, answers, notes or document text.**
- In D1 we keep the deletion log, review decisions with the reviewer's name (needed for the export), the HR sign-off record, and who sent Form A.
- Anthropic receives document text only.

**CSV export:**
- RFC 4180 quoting, UTF-8 with a BOM so Excel opens it correctly, ISO dates.
- Cells starting with `= + - @` get a leading `'` so spreadsheet formulas can't run.
- The five files are zipped with `fflate` into `knowledge-check-export-YYYY-MM-DD.zip`. The personal-data warning appears on A6.

## 8. Testing approach (for QA's `/test`)

- **Unit tests (vitest):**
  - Adding and counting working days (Mon–Fri, across weekends)
  - The threshold as integer maths: `correct*100 < threshold*total`, so 2 of 4 is flagged and 3 of 4 is not
  - The form split and its balance rules
  - Grounding normalisation and quote matching (including hyphens, curly quotes and whitespace)
  - Draft validation
  - CSV escaping and formula-safe cells
  - Notice placeholders and the role-overlap rule
  - Date formatting ("Tue 6 Oct")
- **API integration tests (`@cloudflare/vitest-pool-workers`, local D1 with migrations applied):**
  - An **access matrix**: every route × {no session, student, follow-up owner, reviewer, bank owner, CPO}, with the expected status.
  - Privacy checks: a student response never contains `note`, `correct_index` before submission, or any draft. The manager's M1 response is **byte-identical** for "declined" and "not started". Reviewer responses contain no names. V3 hides statistics with 4 synthetic respondents and shows them with 5.
  - Freeze after publish: every bank or review write gets a 4xx.
  - The readiness gate blocks Form A. Each form can be submitted only once.
  - Form B unlocks only after every weak topic is logged.
  - **Deletion rollback**: inject a failure and check that nothing was deleted.
  - Drafting with a mocked Anthropic returning valid, ungrounded and malformed output, a 429, and a timeout.
- **Manual end-to-end walkthrough (local, mock AI):** five personas in separate browser profiles, each using their own sign-in link, running flows 0–4. This includes the E7 no-flag path and the E8 decline path.
- **Accessibility spot-check:** keyboard only, axe DevTools, 200% zoom, 320 px width on T1–T3, R1, R2 and M2.
- **Copy check:** a search for banned words ("fail", "test", "exam", "flag" in student screens).

## 9. Build sequence (each step ends runnable, type-checked and committed)

1. **Bring in the template** (section 12). Rename the app, remove `items`, R2 and the old migration. Confirm `npm run dev` and `typecheck` pass.
2. **Schema and migration `0000`.** Check it with `db:migrate:local`.
3. **Auth:** bootstrap, links, sessions, `/me`, role guards, S0, the router and nav shell. Start the access-matrix test harness.
4. **A2 roles, A1 readiness, HR sign-off (CPO only).**
5. **A3 and A3a:** documents, topics, PDF extraction, limits.
6. **Drafting:** the Workflow, the mock provider, validation and grounding, A3 status and errors, the consent dialog. The real Anthropic call is wired up but only used once the key exists. **Check early here that Workflows runs under `vite dev`. If it doesn't, stop and flag it to the CPO.**
7. **V1, V2, V3:** review, edit with minor/substantial, reject reasons, undo, the concurrency check, statistics suppression.
8. **A4 publish:** split, moves, threshold explanation, freeze.
9. **A5, T1, T2, T3, submit and scoring, R1**, plus the session-expiry handling.
10. **Flags:** M1, M2, working-day due dates, Form B unlock, T1 states, R2.
11. **A6:** zip export and all-or-nothing delete. Then complete A1's loop, key dates, M3 and the K3 banner.
12. **Accessibility and copy pass**, then the manual end-to-end walkthrough. Then hand over to `/test`.
13. **Deploy to production** (only with the CPO's go-ahead, section 10).

A rough size is 6–9 focused build days. That build effort is separate from M4, which only counts running the pilot.

## 10. Deployment and config

- **Cloudflare account:** a **company-owned** account, not a personal one, because it will hold employee personal data (decided). **Not created yet (open).** The Free plan is enough (CPU-heavy PDF work happens in the browser, and data volumes are tiny). Upgrade to Workers Paid ($5/month) only if we hit a limit.
- **Region:** create D1 with an EU location hint or jurisdiction if the company is EU-based (GDPR is assumed). IT should confirm.
- **Environments** (updated, section 13): there are three.
  - `local`: vite dev, `.dev.vars`, and the mock AI if `AI_ENABLED=true` is set locally.
  - `demo`: `ENVIRONMENT="demo"`, `AI_MOCK` allowed. It has its own worker, D1 and Workflow, and is deployed only with `npm run deploy:demo`.
  - `production`.

  There is still no staging for the pilot itself. Dry runs happen locally or in the demo copy, so no test data reaches production's M3 figures.
- **Secrets (production):**
  - `ANTHROPIC_API_KEY`: from a **company Anthropic Console organisation**, and put in only after IT/security approval.
  - `BOOTSTRAP_TOKEN`: can be deleted after the first CPO sign-in.
- **Vars:** `ENVIRONMENT`, `AI_MODEL`, `APP_TIMEZONE` = `Etc/GMT-2` (decided; the `Etc/` sign is inverted, so this means UTC+2), and `AI_ENABLED` = `"false"` for round 1 (section 13).
- **Bindings:** `DB` (D1), `DRAFT_WORKFLOW`.
- **First deploy:** follows the template's steps without R2: `wrangler login` → `d1 create` → paste the ID → `db:migrate:remote` → `wrangler secret put` → `npm run deploy`. The app runs at `<name>.<account>.workers.dev`. A custom domain is optional.

**Go-live blockers** (the app shows them as states and does not work around them):

| Blocker | What it blocks | Where it shows |
|---|---|---|
| IT/security approval of Anthropic | Round 2 only. With `AI_ENABLED="false"` (round 1) it blocks nothing: questions are imported, and readiness skips the AI item. With AI on, it blocks the API key and therefore drafting, publishing and Form A | AI off: A1 "AI drafting: Off for this round". AI on: A1 "AI provider: Not set up", and A3 drafting disabled |
| HR sign-off and final notice text | *Send Form A* (the sign-off must match the current notice version) | A1 readiness |
| Named people for all four roles | *Send Form A* | A1 and A2 |
| Student's start date | Nothing in the system. Day 0 is set by the Form A submission. It is needed for planning | — |
| Cloudflare account creation (`APP_TIMEZONE` is decided: `Etc/GMT-2`) | Deployment | — |

## 11. Risks and decisions (CPO decisions of 2026-09-29)

The CPO approved all nine engineer recommendations on 2026-09-29. The "Decision" column records what was decided.

| # | Question or risk | Decision (CPO, 2026-09-29) |
|---|---|---|
| 1 | Sign-in mechanism | **Sign-in links** (14-day, revocable, shared privately). Cloudflare Access with SSO can be added later if IT offers it |
| 2 | Notifications | **No email.** In-app badges (*Review (N)*, *Flags (N)*), A5 copy-link, M2's "Let them know it's ready". Allowed by F7 and the spec's section 6 |
| 3 | Model | **`claude-opus-5-5`** (cost is trivial, and quality drives K3 and M4). `claude-sonnet-5-5` stays a one-line switch. *Round 2 only since section 13: round 1 is hand-written* |
| 4 | Background drafting | **Cloudflare Workflows** (meets the spec's "you can leave this page"). If it misbehaves locally, the fallback is a normal request with "Keep this page open" wording. That would change the spec, so the engineer brings it back to the CPO before using it |
| 5 | A6 says it "keeps anonymised question statistics", but at n=1 these identify the student | **Delete them with the person.** V3 is computed live, and A6 says it keeps "review outcomes (these contain no names)" only. A one-sentence copy change to the design spec |
| 6 | New dependencies and template changes | **Approved:** `pdfjs-dist`, `fflate`, `vitest` and `@cloudflare/vitest-pool-workers`. R2 dropped. Migrations start fresh |
| 7 | Cloudflare account, region, timezone | **Company-owned account, EU data location.** Timezone decided: `APP_TIMEZONE` = `Etc/GMT-2` (section 13). Still open: the account has not been created yet |
| 8 | Who can issue sign-in links | **Admins can issue them. Links for admin roles and assigning the CPO role are CPO only** |
| 9 | Notice "Questions? Contact [name / HR contact]" | **Default to the bank owner's name.** If HR wants an HR contact, it is a text change and a notice version increase |
| Open | S/N/E role mapping | **Awaiting CPO confirmation** |
| Risk | PDF extraction quality (columns, hyphenation) causes grounding discards | Discards are counted and visible. Pasting text is the fallback. A3a's scanned-PDF message |
| Risk | A sign-in link is forwarded | Short expiry, revoke by issuing a new link, share only privately. Acceptable at n=1 |
| Risk | Workflows does not run under the `vite dev` Cloudflare plugin | Checked early in step 6. Fallback per decision 4 |
| Risk | D1 backups keep deleted data for 7–30 days | Tell HR, and add it to the retention notes |
| Risk | Model IDs or prices differ from what's assumed here | Checked at build. The model is a config var |
| Risk | Building takes longer than the pilot is worth (PRD risk) | Musts only. Steps are small and committed. The mock AI lets the build finish before IT approval, so IT isn't on the build's critical path |

## 12. How the template gets into the product repo at `/build`

1. Copy the template into the `decision-bias` root, next to `docs/`. Exclude `.git`, `node_modules`, and the template's `README.md`, `CLAUDE.md` and `.gitignore`. For example: `rsync -a --exclude .git --exclude node_modules --exclude README.md --exclude CLAUDE.md --exclude .gitignore <template>/ <repo>/`.
2. **README.md:** keep the product README (the Launch Coordinator rewrites it at `/ship`).
3. **CLAUDE.md:** keep the pipeline's file. Save the template's guide as **`STACK.md`** in the root, so the stack conventions outlive `/graduate`, which archives `docs/` and replaces `CLAUDE.md`. `/graduate`'s provenance note can point to it.
4. **.gitignore:** combine the two. Keep the product's entries and add `dist/`, `.wrangler/`, `.dev.vars*`, `!.dev.vars.example`, `.env*` and `*.log`.
5. Keep the product's `LICENSE` (the template has none).
6. Rename things: `package.json` name, and in `wrangler.jsonc` the `name` and `database_name` (e.g. `onboarding-knowledge-check`). Remove `r2_buckets`, add the workflow binding and vars. Run `npm install`, then `npm run cf-typegen`.
7. First commit: "Import techstack-togs template @ 82ef6fc", so where the code came from is on record. Then build steps 1–13 follow, with one commit each.

None of this happens until `/build` is invoked.

## 13. Post-approval changes (2026-09-29)

These are CPO decisions taken after this plan was approved. They are recorded here so the plan still matches the code.

**Timezone.** `APP_TIMEZONE` is `Etc/GMT-2` in both production and the demo: company time is a fixed GMT+2 all year, with no daylight saving. This is no longer a deploy blocker.

**Demo environment** (commits `051da3c`, `262a0b1`).
- Adds a third environment, `demo`. It has its own worker (`knowledge-check-demo`), D1 (`knowledge-check-demo-db`) and Workflow, set in `wrangler.jsonc` `env.demo`, where vars are not inherited from the top level.
- `ENVIRONMENT="demo"` allows `AI_MOCK=1`, so the demo can reach Send Form A without a key. Production still ignores `AI_MOCK`.
- It is deployed with `npm run deploy:demo`. The production guard (`scripts/check-deploy-config.mjs`, run by `npm run deploy`) checks the top-level config only, and it blocks `AI_MOCK` and `CLOUDFLARE_ENV`.

**Round 1 without AI** (PRD rev. 3; commits `5ca8a76`, `dbc0949`). IT decided to skip the AI integration for the first round. The bank owner writes the questions by hand, and the day-90 review is the checkpoint on whether to use AI in round 2.
- **`AI_ENABLED` switch** (`worker/lib/state.ts`, `aiEnabled`):
  - Only the exact value `"false"` turns AI off; unset means on.
  - The top-level (production) vars set `"false"`, and local dev inherits it. Set `AI_ENABLED=true` in `.dev.vars` for mock drafting, for example for `scripts/local-walkthrough.mjs`.
  - `env.demo` leaves it unset, so the demo mock is unchanged.
  - The production guard rejects any value other than `"true"` or `"false"`.
- **Readiness** (`worker/lib/readiness.ts`): in AI-off mode the "AI provider set up" item doesn't count, so Send Form A needs roles, a published bank and HR sign-off only. A1 shows "AI drafting: Off for this round".
- **Drafting:**
  - `POST /api/topics/:id/drafts` returns 409 "AI drafting is off for this round".
  - `DraftTopicWorkflow` also refuses to call a model.
  - A3 hides the drafting controls, the consent dialog and the set-up warning.
- **Importer:**
  - Run with `npm run import:questions -- <file.json> [--check]`; the code is in `scripts/import-questions.mjs` and `scripts/lib/bank-import.ts`.
  - It is run by the question bank owner, who is not an engineer. The guide and the format (`knowledge-check-import/1`) are in `scripts/import/README.md`, with an example in `scripts/import/example.json`.
  - Documents are checked like A3a. Each question goes through `validateDraft` (validation and grounding). It is all or nothing.
  - Questions land `pending`, with one run per topic (`model = "manual import (no AI)"`). The reviewer gate, Undo and publishing work as for AI drafts.
  - It runs locally by default.
  - Remote loading needs `--remote <db> --confirm-remote=<db>`. It accepts only the demo DB, or the production DB when the production deploy guard passes. It is a separate, CPO-approved step at deploy time.
  - `seed:demo` (the synthetic Slack guide for manual testing) uses the same planner.
- **Student notice version 2** (`NOTICE_VERSION` = 2). The "AI:" paragraph is replaced by "How the questions were made: Our team wrote the questions from our onboarding documents, and a named reviewer checked every question before it was used. No AI tool is used in this round." **This needs HR approval.** The A1 HR sign-off must be recorded for version 2.
- **Metrics:** in AI-off mode, A1 and V3 show "Review outcomes" (the counts only). The rewrite rate and the kill-line copy are hidden, and K3 is never raised: K3 is suspended in round 1. The counts are still recorded for the F3 audit and the export. M4 isn't measured in the app.
- **Copy:** the bank owner's role description, the V1 empty states and the A4 empty state read correctly in AI-off mode. The export has no AI-specific columns; "discarded invalid" simply doesn't occur.

**Bank owner ≠ reviewer (PRD rev. 3, CPO 2026-09-29), production only.** When `ENVIRONMENT` is `"production"`, `PUT /api/roles/:role` refuses to make one person both bank owner and reviewer, in either direction (400), and A1 readiness shows "Roles named" as not done if data created earlier has that overlap. Local and demo keep A2's warning only, so the one-person local setup still works.
