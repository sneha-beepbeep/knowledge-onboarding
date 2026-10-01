# Test Report: Onboarding Knowledge Check (pilot, round 1)

*Stage 7 `/test`, QA, 2026-10-01. Re-test after the D1, D6–D11 fix pass.*

- **Code tested (current):** branch `build/knowledge-check`, `772a4c9`. The fix-pass commits are `f25ab6e`, `aa1c00b`, `43f6d7d`, `185febd` and `2f8219f`. `772a4c9` itself only changes `CLAUDE.md`.
- **First run:** `d696061` (see section 9).
- **Tested against:** `docs/prd.md` rev. 3, `docs/design-spec.md` rev. 3 (as edited in `2f8219f`), and `docs/technical-plan.md` (including §13).
- **What QA changed:** this report only. No application code, tests, `wrangler.jsonc`, `CLAUDE.md` or remote resources were changed, deployed or committed.
- **Where the live runs happened:** in two throwaway git worktrees at `772a4c9`, each with its own local D1, wiped between runs. The worktrees were removed afterwards. The CPO's `.dev.vars` and `.wrangler/state` were not touched.

---

## 1. Re-test 2026-10-01: summary

| | Result |
|---|---|
| Automated tests (`npx vitest run`) | **240 / 240 pass** (19 files). The fix pass added 3 tests. The `DRAFT_FAIL:timed out` and "Worker's code had hung" lines in the output come from the intentional failure-path tests in the drafting suite, not from failures. |
| D1 robustness | The config tests (`deploy-config`, `import`) still pass **38 / 38** after the demo `database_id` is swapped to a new UUID, and again after it is swapped to the placeholder. Both swaps were made in a scratch worktree and reverted. |
| Typecheck (`npm run typecheck`) | Pass, no errors |
| Shipped walkthrough (`scripts/local-walkthrough.mjs`, AI on, mock) | **41 / 41 checks pass**. *Correction:* the first run reported "48 / 48". That count included the 5 flow headers, the A1 loop line and the PASSED line. The script has not changed since `d696061`; it has 41 checks. |
| QA probe, round-1 path (AI off, importer, full loop) | **82 / 82 API checks pass**, plus importer runs: check-only, load, re-import refused, import after publish refused, 7 broken entries rejected, invalid JSON, missing file |
| Production-mode probe (`ENVIRONMENT=production`) | N≠E by id refused with the spec's text (D7). The duplicate-name bypass is still present (D3, deferred) |
| AI-on probe (wording) | AI-on wording is unchanged: "10 drafts are still waiting for review.", and the bank owner role description says "runs AI drafting" |
| Fixes verified | **D1, D6, D7, D8, D9, D10, D11: all verified. None regressed** |
| Deferred, re-confirmed still present | **D2, D3, D4, D5** |
| New defects | **1 cosmetic (D12)** |
| PRD Must requirements (12) | **11 Pass** (F1's PDF path is still unverified; it needs a browser). **1 Partial** (F12, the deferred D2–D4). **0 Fail.** No status changed from the first run |

**Recommendation: SHIP to the round-1 pilot, with conditions** (section 7). The previous code condition (a green suite) is met. What remains is the D2 role-holder confirmation, the non-code go-live blockers, and the manual browser and accessibility pass.

---

## 2. Defect status

| ID | Severity | Status | Verified how |
|---|---|---|---|
| D1 Stale demo-id tests | Minor (test-only) | **Fixed, verified** | 240/240 green. Tests now run on an in-memory copy with the placeholder (`test/deploy-config.test.ts:33-36`, `test/import.test.ts:57-60`). A new "live config" block accepts either a placeholder or a UUID. Robust to a changed demo id (section 1). |
| D2 Manager who is also an admin: no warning, and the notice is false | **Major, conditional** (a **blocker** if S is the CPO or N in production) | **Deferred by CPO, still present** | Live: with the follow-up owner set to the CPO, A2 `warnings: []` and `/api/my/notice` still say "Your manager won't be told." `worker/routes/people.ts:31-42`, `worker/lib/notice.ts:70`. Not changed in the fix pass. |
| D3 Production N≠E bypass via a duplicate name | Minor | **Deferred by CPO, still present** | Production mode, live: `{personId: N}` → 400. `{name: "Nora Bank"}` → 200, with `rolesOverlap: false` and no warning. `worker/routes/people.ts:95-107`. |
| D4 "Only the CPO issues admin links" bypass via a role change | Minor | **Deferred by CPO, still present** | Live: N assigns X as follow-up owner, issues X's link (200), then assigns `bank_owner` to X (200). X's link then opens A1 (200). `worker/routes/people.ts:80-88, 133-145`. |
| D5 Notice v2 says "No AI tool is used" regardless of `AI_ENABLED` | Minor | **Deferred by CPO, still present** | `worker/lib/notice.ts:92` is a fixed string and the file has no `aiEnabled` reference. Not changed in the fix pass. |
| D6 Round-2 wording in round 1 | Cosmetic | **Fixed, verified** (AI off and AI on). A residual is logged as D12. | Server, live: AI off gives "18 questions are still waiting for review."; AI on gives "10 drafts are still waiting for review." (`worker/routes/publish.ts:99-102`, plus a test in `test/ai-off.test.ts`). The screens were checked by code reading; the browser render was not seen. A4 `A4Publish.tsx:75`, A3 heading and count `A3Bank.tsx:224,230`, and V2 heading `Review.tsx:230` all switch on `aiEnabled`. The payloads were confirmed live: `/api/me.aiEnabled` and `/api/bank.aiEnabled` are `false` with AI off and `true` with AI on. |
| D7 N≠E error text differs from the spec | Cosmetic | **Fixed, verified** | Spec A2 (`design-spec.md:199`) now has the app's text, and the live production-mode 400 returns exactly that text. |
| D8 Design spec not fully updated | Cosmetic (docs) | **Fixed, verified** | Flow 4 (`:146`) and the A6 delete panel (`:287`) now say "review outcomes (these contain no names)". The only remaining "anonymised question statistics" is the historical post-approval note (`:627`), which is correct. The round-2 phrases in A3 (`:211-212`, `:225`), A4 (`:256`), V1 (`:307-308`), V2 (`:315`) and §6 (`:432`) are labelled, with the round-1 wording. The header now cites PRD rev. 3. |
| D9 "Deleted" results copy differs from the spec | Cosmetic | **Fixed, verified** | Spec R1 (`:391`) now records the app's same-response wording and the reason for it. |
| D10 Stale local-dev timezone | Cosmetic | **Fixed, verified** | `.dev.vars.example` no longer sets `APP_TIMEZONE`. The probe server ran with a `.dev.vars` copied unchanged from the example. A1 and every date-dependent route worked. Without inheritance from `wrangler.jsonc` (`Etc/GMT-2`), the worker would throw "APP_TIMEZONE is not configured" (`worker/lib/state.ts:48-51`), so `wrangler.jsonc` is the only possible source. (The CPO's own `.dev.vars` already sets `Etc/GMT-2`; no action needed.) |
| D11 Technical plan has stale "open" items | Cosmetic (docs) | **Fixed, verified** | `technical-plan.md:12` and `:344` record the S/N/E mapping as confirmed on 2026-09-29. |
| **D12** Two round-2 phrases still reachable in round 1 | Cosmetic | **New** | See section 4. |

---

## 3. What was re-tested and how

1. **Automated suite and typecheck** in a clean worktree at `772a4c9`. For D1, I also re-ran the two config test files with the committed demo id replaced first by a different UUID, then by the placeholder.
2. **Shipped walkthrough** (AI on, mock drafting through a real Cloudflare Workflow under `vite dev`), on a fresh DB in worktree 2.
3. **Round-1 probe (AI off).** Worktree 1 used a fresh DB and a `.dev.vars` copied unchanged from `.dev.vars.example`, so `AI_ENABLED=false` and `APP_TIMEZONE` were inherited from `wrangler.jsonc`. The import file had 1 document, 2 topics and 9 questions each, with the correct option rotated.
   - **Importer** (`npm run import:questions`):
     - invalid JSON: rejected, with the position;
     - missing file: plain message;
     - a broken file: **7 distinct messages**, nothing loaded (quote not in the material, 5 options, `correctIndex` 4, wrong topic, duplicate options, a 4-character quote, a quote in the wrong case);
     - `--check`: nothing written;
     - load: 18 questions pending;
     - re-import: refused ("already has a document with this name");
     - import after publish: refused ("the question bank is frozen").
   - **AI off.**
     - `/api/me`, `/api/bank` and A1 report `aiEnabled: false`.
     - Drafting returns 409.
     - A1 has no K3 or kill line.
     - The A2 bank-owner description is the AI-off one.
   - **Review gate.**
     - Publish is blocked with "18 questions are still waiting for review." (no "draft" anywhere in the response).
     - The bank owner can't decide (404).
     - 18 reviewed. M3 = 16 approved as is, 1 substantial, 1 rejected.
   - **Publish and freeze.** Default split 4 per form per topic. A and B disjoint. Version 1 published. Documents can't be added (409), and imports are refused afterwards.
   - **HR gate.**
     - Form A is blocked before sign-off.
     - A future date is refused.
     - The bank owner can't record a sign-off (404).
     - The CPO's sign-off is stored against notice v2.
   - **Notice and decline.**
     - Before *Mark as sent*, the student sees `nothing_sent` (O2, unchanged).
     - The form is not served before the notice is answered.
     - Notice v2 says no AI tool is used, and names N and the CPO as the only people told of a decline.
     - Decline leaves M1 byte-identical. A1 shows "Declined", and the student sees the declined card.
     - The student can change their mind. `participation.csv` holds both rows at notice version 2.
   - **Quiz.**
     - 8 questions, and no answer key in the payload.
     - A missing answer and an out-of-range option are refused. A second submission is refused.
     - R1 has no overall score and marks the weak topic.
     - The reviewer gets 404 on R1, and a non-existent attempt gives 404.
     - V3 has no names, and answer statistics are hidden.
   - **Flag and follow-up.**
     - 2 of 4 on "Returns process" flags only that topic. Form B is locked.
     - Refused: a future date, a date before the flag, an empty note, a 201-character note, and entries by the reviewer or the bank owner.
     - The follow-up is logged, Form B opens, and T1 never shows the note.
   - **Form B and comparison.**
     - No question is shared with Form A.
     - Form B creates no flag, and the log closes after Form B (409).
     - R2: Returns process goes from 2/4 to 4/4, `change: 2`.
   - **Export.** The bank owner gets the zip; the manager gets 404. Exactly 5 CSVs, with a UTF-8 BOM (raw bytes), ISO dates and SLA columns.
   - **Delete.** A wrong-case name is refused. The reviewer can't delete. The bank owner's delete succeeds. M3 survives it, R2 returns 404 afterwards, and the student's session is revoked (401).
4. **Deferred-defect re-checks:**
   - D2 and D4 live, in the same run;
   - D3 live in production mode, on a fresh DB;
   - D5 by code. `notice.ts` was not touched in the fix pass.
5. **AI-on wording probe** (worktree 2, fresh DB, `AI_ENABLED=true`): mock-drafted 10, then tried to publish. Result: "10 drafts are still waiting for review." The AI-on bank owner description is unchanged.
6. **Wording sweep.** I grepped `src/`, `worker/` and `shared/` for every user-visible "draft" string and checked each one's `aiEnabled` gating. All are gated in round 1 except the two in D12. A3's AI-off banner ("…then reviewed here like any draft") is deliberate comparison wording, so it is not a defect.

---

## 4. New defect

### D12. Two round-2 phrases still reachable in round 1. Cosmetic

- **A3 "Remove document" confirmation** (`src/screens/A3Bank.tsx:187`): "The document is removed from the bank. **Drafts** already made from it stay in review, with their source passage." It is not gated on `aiEnabled`, and N can open it in round 1 until publish. Spec A3 (`design-spec.md:210`) uses the same word, so the app matches the spec, but the text wasn't covered by the D6 or D8 relabelling.
- **A2 reviewer role description** (`worker/routes/people.ts:15`): "Approves, edits or rejects every **draft** question before use." This is served by `/api/roles` with AI off; I confirmed it live. Only the bank owner has an AI-off variant (`people.ts:19-23`).
- **Impact:** wording only. Neither phrase reaches the student. Suggested round-1 text: "Questions already made from it…" and "…every question before use." Fix any time; it does not block go-live.

---

## 5. Requirement traceability (PRD rev. 3, Must items)

Re-checked where the fix pass touched them: F2a, F3 and F4 (publish-blocked wording), F8 and the SLA dates (local timezone, D10), and F12 (D7 text, D2–D4). **No status changed.**

| # | Requirement | Status | Evidence (re-test) |
|---|---|---|---|
| F1 | Material intake | **Pass. PDF unverified** | `test/bank.test.ts`, plus the importer document checks. Browser PDF extraction was still not exercised. |
| F2a | Question import, round 1 | **Pass** | Importer runs (section 3.3), `test/import.test.ts` |
| F2b | AI drafting (round 2) | Won't (round 1). Correctly gated | 409 with AI off. The AI-on path works with the mock |
| F3 | Review workflow | **Pass** | Probe review gate, `test/review.test.ts`. The round-1 wording now says "questions" |
| F4 | Fixed versioned bank, Forms A/B, 4/topic, frozen | **Pass** | Probe publish and freeze. Import refused after publish |
| F5 | Take quiz, score, results | **Pass** | Probe quiz section |
| F6 | Results saved per person | **Pass** | Export CSVs |
| F7 | Flag below 70% on Form A | **Pass** | Probe flag (2/4 → flagged, weak topic only) |
| F8 | Follow-up log | **Pass** | Probe validation. Local dev now uses the production timezone (D10) |
| F9 | Form B after follow-up, comparison | **Pass** | Probe R2 `change: 2` |
| F10 | Export (CPO or bank owner) | **Pass** | Probe export |
| F11 | Delete a person's data | **Pass** | Probe delete |
| F12 | Roles and access | **Partial** | The access levels hold. D2, D3 and D4 are deferred and still present. The D7 text is aligned |
| §6 gate | HR sign-off for the current notice version blocks Form A | **Pass** | Probe HR gate (stored against v2) |
| §2 / rev. 3 | N ≠ E in production | **Partial** | The id check works with the spec's text. D3 bypass |
| C6 | Publish → Form A in ≤ the steps of a Forms link | **Pass (by inspection)** | Unchanged. O2 still applies |

The design-spec edge cases (E1–E17) are as in the first run (section 9.2). E3, E7 (by construction: Ticket tool all correct, no flag), E8, E15 and E16 were re-exercised live and pass.

---

## 6. Go-live blockers that are not code defects

These are tracked separately; they are not test failures.

1. **HR approval of notice v2.** Blocks *Send Form A*. The app enforces it (re-verified).
2. **Production D1 database on the company Cloudflare account.** Blocks `npm run deploy`, and the deploy guard enforces it. The committed demo id belongs to the CPO's personal account and will need rewriting when the demo moves.
3. **N writes and imports the real round-1 questions**, at least 8 approved per topic plus spares. **E reviews every one.** Publish is blocked while any are pending (re-verified).
4. **No git remote is configured.** The branch is local only and not backed up.
5. **Manual browser and accessibility pass**, including one PDF upload. See section 8.
6. **D2 role-holder confirmation** (condition 1 below).

---

## 7. Recommendation

**SHIP to the round-1 pilot, subject to these conditions before Form A is sent:**

1. **D2 (CPO).** Confirm that in production S (follow-up owner) is neither the CPO nor N. If S is either one, D2 is a **blocker**: add the A2 warning and correct the notice copy, and have HR approve that text, before notice v2 is sent.
2. **D3, D4, D5** stay deferred as pilot risks the CPO has accepted. QA's view is unchanged: D4 is the one worth a one-line guard (make `bank_owner` assignment CPO-only), because F12 is a Must. D5 must be resolved before `AI_ENABLED` is ever switched on in production.
3. **Clear the non-code blockers** in section 6.
4. **Manual browser and accessibility pass** on T1–T3, R1, R2 and M2, plus one PDF upload, before or during N's importer walkthrough. QA could not verify these (section 8).

Condition 1 of the first run (a green suite) is **met**. D12 and observations O1–O4 can wait until after go-live.

---

## 8. What I could not verify

Treat these as untested, not passed.

- **Browser rendering of the D6 wording changes** (A3 heading and count, A4 blocked reason, V2 heading). They were verified by code reading, typecheck, and the `aiEnabled` payloads the screens switch on. I did not see them rendered.
- **Browser UI generally:** focus management, the A/E/R shortcuts, `beforeunload`, copy-to-clipboard, and the A2 "Change role" focus fix. No browser automation was available.
- **Accessibility** (spec §9, plan §8): keyboard-only use, axe, 200% zoom, 320 px reflow, contrast, live regions. Not done.
- **PDF text extraction** in the browser (pdf.js), including scanned-PDF detection.
- **Session-expiry recovery mid-quiz.** Code reading only.
- **Anything remote:** demo deployment, `deploy:demo`, remote import, production deploy, and Workflows on real infrastructure. Out of scope by instruction.
- **Real round-1 content:** N's questions don't exist yet.
- **Midnight GMT+2 behaviour:** unit tests only. The re-test ran at about 10:00 CEST, when the UTC and GMT+2 dates are the same. D10 is verified by elimination (the zone can only come from `wrangler.jsonc`), not by a boundary-time run.
- **Student-screen framing words** (§7.2): no automated scan was done.

---

## 9. First run (2026-10-01, `d696061`): retained detail

### 9.1 First-run results

- **Suite:** 233/237. The 4 failures were D1.
- **Typecheck:** pass.
- **Walkthrough:** 41 checks (originally reported as "48").
- **Round-1 probe:** 63/63.
- **Production-mode probes:** found D3 and D4.
- **Deploy guard:** blocked on the placeholder production id.

### 9.2 Design-spec edge cases (section 8 of the spec)

| Case | Result | | Case | Result |
|---|---|---|---|---|
| E1 role not named | Pass (tests) | | E9 abandon midway | Pass by inspection (nothing stored until submit) |
| E2 AI not set up | N/A in round 1. The AI-off path passes | | E10 follow-up overdue | Pass (`flags.test.ts`) |
| E3 no HR sign-off | Pass (probe) | | E11 Form B overdue | Pass by inspection |
| E4 bad drafts | Pass (tests, round-2 path) | | E12 owner change | Pass (`admin.test.ts`, `flags.test.ts`) |
| E5 all rejected | Pass by inspection (round-1 copy at `A3Bank.tsx:236`) | | E13/E14 wrong question, material change | Out of app by design. Question ids are in the export |
| E6 rewrite > 50% | Hidden in round 1 | | E15/E16 delete | Pass (probe, tests) |
| E7 nothing flagged | Pass | | E17 holidays | Not adjusted, by design |
| E8 decline | Pass (probe) | | | |

### 9.3 Deferred defects: full detail

**D2. Manager who is also an admin: no warning, and the notice becomes false.** Major, conditional.
- `roleWarnings` (`worker/routes/people.ts:31-42`) only checks the reviewer's overlaps.
- If S is the CPO or N, A2 shows no warning. The notice (`worker/lib/notice.ts:70`) still says only N and the CPO will know of a decline and "Your manager won't be told", but S, as an admin, sees "Declined" on A1. This contradicts decision 6 and the notice HR is approving.
- It is a blocker only if production S is the CPO or N.
- Fix: an A2 warning plus adjusted notice copy, or confirm the role holders are distinct.

**D3. Production N ≠ E can be bypassed by entering N's name as a new person.** Minor.
- `PUT /api/roles/reviewer {name}` always creates a new person (`people.ts:95-102`), and the separation check compares ids only (`:104-107`).
- A2 defaults to "Someone already in the app", so the bypass needs a deliberate "new person" entry.
- Fix: refuse or warn on a case-insensitive name match.

**D4. "Only the CPO issues admin links" can be bypassed by a role change.** Minor.
- Link issuing checks admin roles only at issue time (`people.ts:133-145`). Any admin can assign `bank_owner` (`:80-88`), and authorisation follows the person's current roles.
- Admin access is transferred, not added, because the role is unique. The change is visible on A2.
- Fix: make `bank_owner` assignment CPO-only, or revoke a person's links and sessions when they gain an admin role.

**D5. Notice v2's "No AI tool is used in this round" is hard-coded.** Minor.
- `worker/lib/notice.ts:92`.
- It is false in the demo (AI on). It would be false in production if `AI_ENABLED` were switched on without a new notice version.
- Fix: tie the paragraph to `AI_ENABLED`, or fail readiness when AI is on with notice v2.

### 9.4 Known, by design (logged, not defects)

- The demo's admin side shows AI drafting and the K3 kill line, unlike the pilot, because `env.demo` leaves `AI_ENABLED` unset (technical plan §13). The PRD excludes demo data from all metrics. D5 covers the notice text in the demo.

### 9.5 Observations (no defect)

- **O1.** Extra, unknown question ids in a Form A submission are ignored. No effect on scoring.
- **O2.** *Create link* does not mark Form A as sent. Until N presses *Mark as sent*, the student sees "Nothing to do yet" (re-confirmed). Mention it in N's walkthrough.
- **O3.** Export timestamps (`submitted_at`, `flagged_at`, `logged_at`, `recorded_at`) are UTC ISO (`…Z`), while calendar dates are GMT+2. The 90-day analysis should know this.
- **O4.** `npm run import:questions -- <file>` resolves relative paths against the project root. The guide tells N to work from the project folder, so this is fine as written.
