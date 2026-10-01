# Test Report: Onboarding Knowledge Check (pilot, round 1)

*Stage 7 `/test`, QA, 2026-10-01.*

- **Code tested:** branch `build/knowledge-check`, `d696061`. HEAD moved to `739eed3` during testing, but that commit only changes `CLAUDE.md`, so the application code is the same.
- **Tested against:** `docs/prd.md` rev. 3, `docs/design-spec.md` rev. 3, `docs/technical-plan.md` (including §13).
- **What QA changed:** no application code, tests, config or remote resources were changed or deployed.
- **Where the live runs happened:** in throwaway git worktrees with their own local D1. The CPO's local test state (`.wrangler/state` in the repo) was not touched.

---

## 1. Summary

| | Result |
|---|---|
| Automated tests (`npx vitest run`) | **233 / 237 pass. 4 fail**, all caused by stale test expectations (D1). The same 36 tests pass at `bd2a413`. |
| Typecheck (`npm run typecheck`) | Pass, no errors |
| Shipped walkthrough (`scripts/local-walkthrough.mjs`, AI on with the mock) | **48 / 48 checks pass** |
| QA probe of the round-1 pilot path (AI off, importer, edge cases) | **63 / 63 checks pass**, plus 2 additional production-mode probes that found defects D2 and D3 |
| Production deploy guard (`scripts/check-deploy-config.mjs`) | Correctly blocks: "D1 database_id is the local placeholder" |
| PRD Must requirements (12) | **11 Pass** (F1 partly unverified, browser only). **1 Partial** (F12). **0 Fail** |
| Defects | **0 blocker · 1 major (conditional) · 4 minor · 6 cosmetic** |

**Recommendation: SHIP to the pilot, with conditions** (section 7). The core loop works end to end in the round-1 configuration: import, review gate, publish/freeze, HR gate, notice, Form A, flag, follow-up, Form B, comparison, export and delete. The privacy rules called out in the spec are enforced on the server, and the test suite is broad. Nothing found breaks the loop or leaks student data in the intended role setup. The conditions are:

- make the suite green;
- confirm one role-holder fact (D2);
- clear the non-code go-live blockers.

---

## 2. What was tested and how

1. **Automated suite.** I ran it and read every failing assertion. To confirm the root cause of the 4 failures, I ran `test/deploy-config.test.ts` and `test/import.test.ts` in a worktree at `bd2a413`, the parent of `d696061`: 36/36 pass there.
2. **Shipped walkthrough.** I ran `scripts/local-walkthrough.mjs` against a fresh `npm run dev` in an isolated worktree, with `AI_ENABLED=true` as the script requires. It covers flows 0–4 with mock drafting through a real Cloudflare Workflow under `vite dev`.
3. **Round-1 pilot path (QA probe, AI off).** This is the configuration production will actually run, and the shipped walkthrough does not cover it. I used a fresh DB and generated an import file: 1 document, 2 topics, 9 questions each.
   - **Importer.** Check-only mode, a successful load, a re-import refused, and an import refused after publishing. A deliberately broken file was rejected with 7 distinct, plain-language messages: a quote that isn't in the material, 5 options, `correctIndex` 4, a wrong topic, duplicate options, a 5-character quote, and a quote with the wrong letter case. The importer also handles invalid JSON (with a position) and a missing file.
   - **AI off.** Drafting is refused (409). Readiness completes without the AI item. The A1 payload carries no kill-line copy.
   - **Review gate.** Only the reviewer can decide; the bank owner gets 404. Publishing is blocked while questions are pending. M3 counts are correct (18 reviewed, 1 substantial edit, 1 rejected).
   - **Publish and freeze.** Version 1 published. After publishing, imports are refused.
   - **HR gate.** Form A is blocked before HR sign-off. A sign-off dated in the future is refused. Only the CPO can record it.
   - **Notice and participation.** Before the notice is answered, the form is not served. M1 is byte-identical before and after a decline. A1 shows "Declined". The student can change their mind.
   - **Quiz.** Form A has 8 questions and no answer key in the payload. Submissions are refused when an answer is missing or an option is out of range. A second submission is refused. 2 of 4 is flagged at 70%.
   - **R1 and access.** The student's R1 has no overall score and no note. The reviewer gets 404 on R1. A non-existent attempt gives 404, the same as "not yours". A student can't open another person's comparison. V3 shows no names, and answer statistics are hidden (`shown:false`, `minRespondents:5`).
   - **Follow-up validation.** The log rejects a future date, a date before the flag, an empty note and a 201-character note. The reviewer and the bank owner can't log follow-ups. Form B is locked until the follow-up is logged, then unlocks.
   - **Form B and comparison.** T1 never shows the note. Form B shares no question with Form A. Form B creates no new flag. The follow-up log closes after Form B. R2 shows +2 on the weak topic.
   - **Export.** The bank owner gets the zip; the manager gets 404. The five CSVs match A6's columns, with a BOM, ISO dates and question ids.
   - **Delete.** A wrong-case name is refused. The reviewer can't delete. The bank owner's delete succeeds. M3 survives the delete, and R2 then returns 404.
   - **E7 (no weak topic).** Exercised by accident in one run: an all-correct Form A created no flag.
4. **Production-mode probes.** I ran the worktree with `ENVIRONMENT=production` in `.dev.vars` to test N≠E enforcement and the CPO-only admin-link rule (D3, D4).
5. **Code and copy review.** I checked `src/screens/*`, `worker/routes/*`, `worker/lib/notice.ts` and `wrangler.jsonc` against the design spec's screen copy, states and edge cases E1–E17. I also checked which "round-2 phrases" actually render in round 1.

---

## 3. Requirement traceability (PRD rev. 3, Must items)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| F1 | Material intake (text, PDF, name, version date, topics, no web) | **Pass. PDF partly unverified** | `test/bank.test.ts` (fields, limits, topic reuse, removal keeps snapshots, freeze). Importer document checks. No outbound fetch outside the gated AI provider. *PDF text extraction runs in the browser (`src/lib/pdf.ts`, pdf.js) and was not exercised by QA.* |
| F2a | Question import, round 1 (JSON, check-only, grounding, plain errors, lands pending, guide) | **Pass** | QA probe (section 2.3), `test/import.test.ts` (planImport, all-or-nothing, re-import refused), `scripts/import/README.md` (a clear, non-engineer guide with a message table). The one-time walkthrough with N is a process step, not testable. |
| F2b | AI drafting (round 2) | Won't (round 1). Correctly gated | `test/ai-off.test.ts`, `test/drafting.test.ts`. The probe got 409 with AI off. |
| F3 | Review workflow (approve, edit + minor/substantial, reject + reason; outcomes recorded; only approved publish) | **Pass** | `test/review.test.ts` (including undo and concurrency). Walkthrough. The probe confirmed reviewer-only decisions. |
| F4 | Fixed versioned bank, Forms A/B, 4/topic, read-only, one version | **Pass** | `test/publish.test.ts`, `test/lib.test.ts` (split rules). The probe confirmed disjoint A/B, freeze after publish, and the version recorded in the export. |
| F5 | Take quiz, score overall and per topic, results with correct answers | **Pass** | `test/student.test.ts`. The probe covered the missing-answer and out-of-range refusals and the once-only submission. |
| F6 | Results saved per person (date, version, form, answers, scores) | **Pass** | Export `attempts.csv` and `answers.csv` content (section 2.3). |
| F7 | Flag below 70% on Form A to the named owner (badge, link, configurable threshold) | **Pass** | `test/student.test.ts`, `test/lib.test.ts` (integer threshold), `test/flags.test.ts`. A4 threshold 1–100. Badge in `/api/me`. |
| F8 | Follow-up log (date, one-line note, time to follow-up) | **Pass** | `test/flags.test.ts`. The probe covered validation. Export has `working_days_flag_to_followup` and `within_sla`. |
| F9 | Retake (Form B) after follow-up, side-by-side comparison | **Pass** | `test/flags.test.ts`. Walkthrough. The probe's R2 rows were correct. |
| F10 | Export to CSV (CPO or bank owner) | **Pass** | `test/data.test.ts`. The probe checked the bank-owner export, the manager getting 404, and the columns. |
| F11 | Delete a person's data (bank owner or CPO) | **Pass** | `test/data.test.ts` (exact counts, exact name, full rollback on injected failure). The probe ran the delete as the bank owner. |
| F12 | Roles and access (4 levels; reviewer sees no names; stats hidden below 5; 14-day revocable links; admins issue links; only the CPO issues admin links or assigns CPO) | **Partial** | `test/access.test.ts` (route × role matrix), `test/auth.test.ts`, `test/review.test.ts` (V3 suppression at 4 vs 5 people). The access levels hold. However, "only the CPO issues admin links" can be bypassed (D4), N≠E in production can be bypassed with a duplicate name (D3), and manager-is-admin overlap is not warned (D2). |
| §6 gate | HR sign-off for the current notice version blocks Form A; notice v2 shown and version stored | **Pass** | `test/admin.test.ts` (a version change invalidates the sign-off), `test/ai-off.test.ts` (v2 text). The probe confirmed Form A is blocked before sign-off and that participation stores `notice_version` 2. |
| §2 / PRD rev. 3 | N ≠ E, enforced in production | **Partial** | `test/role-separation.test.ts`. The id check works; the duplicate-name bypass is D3. |
| Rollout bar C6 | Publish → student takes Form A in no more steps than a Forms link | **Pass (by inspection)** | A1 → Send Form A → Create link → copy → Mark as sent. Student: open link → notice → quiz. See observation O2. |

### Design-spec edge cases (section 8)

| Case | Result | | Case | Result |
|---|---|---|---|---|
| E1 role not named | Pass (tests) | | E9 abandon midway | Pass by inspection (nothing stored until submit) |
| E2 AI not set up | N/A in round 1. AI-off path passes | | E10 follow-up overdue | Pass (`flags.test.ts`) |
| E3 no HR sign-off | Pass (probe) | | E11 Form B overdue | Pass by inspection (`loop.ts:73`, `student.ts:60`) |
| E4 bad drafts | Pass (tests, round 2 path) | | E12 owner change | Pass (`admin.test.ts`, `flags.test.ts`) |
| E5 all rejected | Pass by inspection (round-1 copy at `A3Bank.tsx:236`) | | E13/E14 wrong question, material change | Out of app by design. Question ids are in the export |
| E6 rewrite > 50% | Hidden in round 1 (`ai-off.test.ts`) | | E15/E16 delete | Pass (probe, tests) |
| E7 nothing flagged | Pass (`student.test.ts`, seen in the probe) | | E17 holidays | Not adjusted, by design (`lib.test.ts`) |
| E8 decline | Pass (probe: byte-identical M1, A1 "Declined", can change mind) | | | |

---

## 4. Defects

Severity scale:
- **Blocker:** must be fixed before go-live.
- **Major:** violates a Must or a privacy promise in a realistic case. Fix, or get explicit CPO acceptance.
- **Minor:** limited impact or unlikely. Fix when convenient.
- **Cosmetic:** wording or docs only.

### D1. Four tests fail because they assert the demo placeholder id, which `d696061` replaced. Minor (test-only), fix before ship

- **Where:** `test/deploy-config.test.ts:113`, `:120`, `:147` and `test/import.test.ts:77`. They read the live `wrangler.jsonc`, whose `env.demo` `database_id` is now `24354d59-…` (`wrangler.jsonc:54`), and expect `DEMO_PLACEHOLDER_ID` / "not a real id".
- **Root cause confirmed:** the same tests pass 36/36 at `bd2a413`. The config is correct; the tests are stale.
- **Design issue:** these tests depend on mutable deploy state, so every `deploy:demo` that creates a new demo DB will turn them red again.
- **Fix (Engineer):** have the tests use an in-memory copy of the config with the placeholder substituted, as other tests already do with `withProdId(config())`, rather than the committed file.
- **Impact:** none at runtime. But a red suite hides real regressions, so it should be green before `/ship`.
- **Note:** the committed demo id belongs to the CPO's personal Cloudflare account. It will need rewriting when the demo moves to the company account.

### D2. Manager who is also an admin: no warning, and the notice becomes false. Major, conditional on who holds the roles

- **Where:** `worker/routes/people.ts:31-42` (`roleWarnings` only checks the reviewer's overlaps) and `worker/lib/notice.ts:65-68`.
- **What happens:** if S (follow-up owner) is the same person as the CPO or N, nothing warns on A2. The student notice still says: "If you say no, only [bank owner] and [CPO], who run this pilot, will know. Your manager won't be told." That person sees the decline on A1 as an admin. This contradicts decision 6 and the notice HR is approving.
- **Repro (by code):** assign the same person as `follow_up_owner` and `cpo`, then render `/api/my/notice`.
- **Why it's conditional:** the CPO's local test state uses one person for CPO, bank owner, reviewer and follow-up owner. If production S is distinct from N and the CPO, this has no impact. If S is the CPO or N, it is a **blocker** for sending notice v2.
- **Fix:** add an A2 warning for this overlap and adjust the notice copy, or confirm the role holders are distinct (see condition 2).

### D3. Production N ≠ E can be bypassed by entering the bank owner's name as a new person. Minor

- **Where:** `worker/routes/people.ts:104-107` compares person ids. `PUT /api/roles/reviewer {name}` always creates a new `people` row (`:95-102`), with no duplicate-name check.
- **Repro (production mode):** after assigning `bank_owner` "Nora Bank":
  - `PUT /api/roles/reviewer {personId: <Nora>}` → 400, as specified;
  - `PUT /api/roles/reviewer {name: "Nora Bank"}` → 200. A1 then shows `rolesOverlap: false` and A2 shows no warning.
- **Mitigation already in the UI:** A2 defaults to "Someone already in the app" (`A2People.tsx:134`), so this needs a deliberate "new person" entry.
- **Fix:** warn or refuse when a new person's name matches an existing person (case-insensitive).

### D4. "Only the CPO issues admin links" can be bypassed by a role change. Minor

- **Where:** `worker/routes/people.ts:133-145` checks admin roles only when the link is issued. `PUT /api/roles/bank_owner` is open to any admin (`:80-88`), and authorisation follows the person's current roles.
- **Repro (production mode):**
  1. N assigns a new person X as follow-up owner, then issues X's link (200, since X isn't an admin).
  2. N assigns `bank_owner` to X (200).
  3. X's link now opens A1 (200).
- **Impact:** an admin-capable link exists that the CPO never issued (F12, plan decision 8). Because `role_assignments.role` is unique, N loses admin in the same step. Admin access is transferred, not added, and the change is visible on A2.
- **Fix:** make assigning `bank_owner` CPO-only, or revoke the person's existing links and sessions when they gain an admin role.

### D5. Notice v2's "No AI tool is used in this round" is hard-coded, independent of `AI_ENABLED`. Minor

- **Where:** `worker/lib/notice.ts:85-88`.
- **Impact:** in the demo (AI mock on) the notice is false. In production, switching `AI_ENABLED` on without a new notice version would show students a false statement. The PRD requires a new notice and HR re-approval in that case, but nothing in the code enforces it.
- **Fix:** tie the paragraph to `AI_ENABLED`, or have readiness fail when AI is on and `NOTICE_VERSION` is 2.

### D6. Round-2 wording visible in round 1 for hand-written questions. Cosmetic

- A4 blocked reason "N drafts are still waiting for review": `src/screens/A4Publish.tsx:75` and `worker/routes/publish.ts:99`.
- A3 topic card heading "Drafts" and "N drafts: x approved…": `src/screens/A3Bank.tsx:224,229`.
- V2 heading "Draft question": `src/screens/Review.tsx:229`.
- **Correction to the known-leftovers list:** V1 "may draft more" (`Review.tsx:82`), A3 "Draft 5 more" (`A3Bank.tsx:290`, rendered only when `aiEnabled`) and the kill line (`A1Pilot.tsx:309-319`, `Review.tsx:418-428`) are correctly hidden in round 1. Those phrases remain only in the **design spec** text (D8).

### D7. N≠E error text differs from the spec. Cosmetic

- **Spec (A2, `design-spec.md:199`):** "The bank owner and the reviewer must be different people."
- **App (`worker/routes/people.ts:26-27`):** "The question bank owner and the content reviewer must be different people, so the reviewer isn't checking their own questions. Choose someone else."
- The app's text is arguably better. Update the spec to match.

### D8. Design spec not fully updated. Cosmetic (docs)

- **A6 wording:** Flow 4 (`design-spec.md:146`) and the A6 delete panel (`:287`) still say "anonymised question statistics". The post-approval note (`:627`) and the app (`A6Data.tsx:124`, "review outcomes (these contain no names)") say otherwise.
- **Round-2 phrases not labelled "round 2 / when AI_ENABLED":**
  - V1 (`:307` "notified when drafts are ready", `:308` "may draft more");
  - A3 (`:212`, `:225` "Draft 5 more");
  - A4 (`:256` "drafts are still waiting");
  - §6 (`:432` "Drafts ready").
- **Header:** says "PRD rev. 3 is being applied in parallel" (`:3`).

### D9. "Deleted" results copy differs from the spec. Cosmetic

- **Spec (R1 states):** "These results have been deleted."
- **App (`src/screens/Results.tsx:20`):** "This page isn't available to you. If these results existed, they may have been deleted."
- The app's behaviour follows S0's rule of the same response whether or not the resource exists, so this looks intentional. Record it in the spec.

### D10. Stale local-dev timezone config. Cosmetic

- **Where:** `.dev.vars.example:8-9`.
- It says "Production value is still open" and sets `APP_TIMEZONE=UTC`, which overrides `Etc/GMT-2` locally. Local runs therefore compute "today", due dates and overdue states in UTC, 2 hours off from production near midnight.
- **Fix:** update the comment, and consider defaulting local to `Etc/GMT-2`.

### D11. Technical plan has stale "open" items. Cosmetic (docs)

- **Where:** `docs/technical-plan.md:11-12` and `:344`.
- They still list the S/N/E mapping as "awaiting CPO confirmation". It was confirmed on 2026-09-29.

### Known, by design (logged, not defects)

- The demo's admin side shows AI drafting and the K3 kill line, unlike the pilot. This follows from `env.demo` leaving `AI_ENABLED` unset (technical plan §13). The PRD excludes demo data from all metrics. D5 covers the notice text in the demo.

### Observations (no defect)

- **O1.** Submitting Form A with extra, unknown question ids is accepted, and the extras are ignored (`worker/routes/student.ts` attempt handler). No effect on scoring.
- **O2.** *Create link* does not mark Form A as sent. Until N presses *Mark as sent*, the student who opens the link sees "Nothing to do yet." This matches spec A5 ("After copying, *Mark as sent*"). It is a plausible slip for N on go-live day, so mention it in N's walkthrough.
- **O3.** Export timestamps (`submitted_at`, `flagged_at`, `logged_at`) are UTC ISO (`…Z`). Calendar dates (`follow_up_date`) are GMT+2. Both are ISO as specified. The 90-day analysis should know they use different time zones.
- **O4.** `npm run import:questions -- <file>` resolves the file against the project root (npm's working directory), not N's shell directory. The guide tells N to work from the project folder, so this is fine as written.

---

## 5. Go-live blockers that are not code defects

These are tracked separately and are not test failures.

1. **HR approval of notice v2.** Blocks *Send Form A*. The app enforces this: verified.
2. **Production D1 database id and the company Cloudflare account.** Block `npm run deploy`. The deploy guard enforces this: verified, exit 1. The current `wrangler` login is the CPO's personal account, which hosts only the demo.
3. **N writes and imports the real round-1 questions.** At least 8 approved per topic at the default size (6 minimum), plus spares.
4. **E reviews every imported question.** Publishing is blocked until none are pending: verified.
5. **No git remote is configured.** The branch is local only and not backed up.
6. **D2 role-holder confirmation** (condition 2 below).

---

## 6. What I could not verify

Treat these as untested, not passed.

- **Browser UI:** rendering, focus management, the A/E/R keyboard shortcuts, the `beforeunload` prompt, copy-to-clipboard, and the A2 "Change role" scroll and focus fix (`e173746`). I had no browser automation. The CPO tested locally in a browser at `/build`.
- **Accessibility checks** (spec §9 and plan §8): keyboard-only use, axe, 200% zoom, 320 px reflow, contrast and screen-reader live regions. **Not done.** They need a manual pass.
- **PDF text extraction** in the browser (pdf.js), including scanned-PDF detection. Server-side limits and validation are tested; extraction is not.
- **Session-expiry recovery mid-quiz** (sessionStorage plus reopening the link in a new tab). Verified by code reading only.
- **Anything remote:** the demo deployment, `deploy:demo`, remote import, production deploy, and Cloudflare Workflows on real infrastructure. Out of scope by instruction; nothing remote was touched.
- **Real round-1 content:** N's questions don't exist yet, so how hard the importer is for a non-engineer, and how often the grounding check rejects real material, are untested.
- **Copy framing rules** (§7.2: "fail", "test", "exam", "flag" on student screens): no automated scan was done. Spot-reading student screens found no violations.
- **Behaviour around midnight GMT+2** (due dates and overdue). Covered by unit tests only, and local dev runs in UTC (D10).

---

## 7. Recommendation

**SHIP to the round-1 pilot, subject to these conditions before Form A is sent:**

1. **Fix D1** (Engineer). Make the 4 stale tests independent of the committed demo id and get the suite to 237/237 green. Re-run `npm run typecheck`.
2. **Resolve D2** (CPO). Confirm that S (follow-up owner) is neither the CPO nor N in production. If S is either one, D2 becomes a **blocker**: add the A2 warning and adjust the notice copy, then get HR to approve that text, before sending notice v2.
3. **Decide on D3, D4 and D5** (CPO). Fix them, or accept them explicitly as pilot risks with the honour-system controls already in place. QA recommends a quick fix for D4: make `bank_owner` assignment CPO-only. It is a one-line guard, and F12 is a Must.
4. **Clear the non-code blockers** in section 5: HR approval of notice v2, the production D1 id on the company Cloudflare account, the real questions imported by N and reviewed by E, and a git remote.
5. **Accessibility and browser pass.** Before or during N's one-time importer walkthrough, run the manual accessibility check (plan §8) on T1–T3, R1, R2 and M2, plus one PDF upload, since QA could not verify these (section 6).

D6–D11 (cosmetic) and observations O1–O4 can wait until after go-live. The spec fixes (D7, D8, D9) are a docs-only update by the Designer.
