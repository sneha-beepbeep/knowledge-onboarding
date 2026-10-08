# Release notes: Onboarding Knowledge Check, version 1.0 (round-1 pilot)

*Written 2026-10-01 for code on branch `build/knowledge-check` at `31307b0`; updated 2026-10-08 for `b19fd05` (a new sign-in link also ends that person's sessions), then again on 2026-10-08 to add cover for absent role holders (section 4) and the CPO's confirmation that D2 is not a blocker; updated again on 2026-10-08 to record the accepted deviation to run on the CPO's personal GitHub and Cloudflare accounts (section 2, "Accepted deviation"). The branch has been pushed to the private repo `github.com/sneha-beepbeep/decision-bias` but not yet merged into `main`.*

**Who this is for:** the people running the pilot: the CPO, N (question bank owner), E (reviewer), S (manager and follow-up owner), HR, and IT or the engineer. The student does not read this. They see only the app and the notice HR approves.

**Status:** **built and tested, not yet deployed to production.** QA's verdict (`docs/test-report.md`, re-test 2026-10-01) is *ship to the round-1 pilot, with conditions*, and the CPO accepted it. Production does not exist yet. The go-live work is in section 3.

---

## 1. What ships

A small web app for one pilot. It checks what one new working student has understood from the company's onboarding material, flags weak topics to their manager, and measures whether a follow-up helped.

**The loop, end to end:**

1. **N loads hand-written questions.** In round 1 there is no AI. N writes multiple-choice questions in a JSON file, each one with a verbatim quote from the onboarding material, and loads it with the importer (`scripts/import-questions.mjs`; the guide is `scripts/import/README.md`). The importer checks every question the same way the app checks AI drafts. It is all or nothing: if anything is wrong, nothing is loaded.
2. **E reviews every question.** Each question waits in E's review queue, shown next to its source passage. E approves it, edits and then approves it, or rejects it. Nothing can be published while a question is still waiting.
3. **N publishes one version.** The app splits the approved questions into Form A (first attempt) and Form B (retake), with 4 per topic per form by default and no question on both forms. The version is then frozen for the 90-day pilot.
4. **The student reads a notice, then takes Form A.** The notice (version 2, which HR must approve) explains what is collected and who sees it. The student can decline, and declining is recorded without telling the manager. Results show a score per topic and the correct answers. There is no overall score.
5. **Weak topics go to S.** Any topic below 70% raises a flag to S, who has 5 working days (Mon–Fri, GMT+2) to give a follow-up and log it in the app. The student never sees the follow-up note.
6. **Retake and comparison.** Logging the follow-up unlocks Form B. Form B is then shown side by side with Form A for the flagged topics.
7. **Export and delete.** The CPO or N can download a zip of 5 CSV files for the 90-day analysis, and can delete everything about a person in one step, which can't be undone.

**How people sign in.** There are no accounts and no emails. Admins issue personal sign-in links that expire after 14 days, and you share them privately. Issuing a new link for someone kills their old link and signs them out everywhere at once; if an admin issues a link for themselves, the session they are using stays signed in. Only the CPO can issue links for admin roles. The very first CPO is created once with a set-up code (`/setup`), and that route stops working as soon as a CPO exists.

**Where it runs.** On the CPO's personal Cloudflare account, as an accepted substitute for a company account (section 2, "Accepted deviation"): one Worker (`onboarding-knowledge-check`), plus a D1 database (`onboarding-knowledge-check-db`) in the EU (`weur`), separate from the demo. Company time is fixed at GMT+2 all year (`APP_TIMEZONE = Etc/GMT-2`). IT/security has approved Cloudflare and Anthropic.

**AI is off.** Production sets `AI_ENABLED = "false"`. No onboarding material and no student data is sent to any AI service, and round 1 needs no Anthropic API key. AI drafting is built but switched off. The day-90 review decides whether round 2 uses it (section 7).

**What QA verified (re-test on `772a4c9`; `31307b0` adds only docs):** 240 of 240 automated tests pass and typecheck is clean. The round-1 path was run end to end with AI off: 82 of 82 API checks passed, as did every importer case. 11 of the 12 Must requirements pass; F12 (roles and access) is partial, because of the D2–D4 issues below.

---

## 2. Known limitations and accepted risks

These come from `docs/test-report.md`. The CPO accepted them as pilot risks on 2026-10-01, but none of them is fixed in this release.

| ID | What it means in practice | Who it affects | Condition |
|---|---|---|---|
| **D2** | Suppose the manager (S) is also the CPO or N. The app gives no warning, and the student notice still says "Your manager won't be told" if they decline. As an admin, S would in fact see "Declined". | Student, HR | **Not a blocker:** the CPO confirmed on 2026-10-08 that production S is neither the CPO nor N. It would become one if S, or a stand-in for S, were ever the CPO or N (section 4, "Covering for an absent role holder"). |
| **D3** | The rule that N and E must be different people can be bypassed by typing N's name as a "new person" when naming the reviewer. | Data integrity of M3 | Accepted. Avoid by always choosing "Someone already in the app". |
| **D4** | N can pass admin access to someone else by issuing that person a link and then making them bank owner. The change is visible on the roles screen. | Access control | Accepted. QA's view: this is the one worth a one-line guard. |
| **D5** | Notice v2 says "No AI tool is used in this round", and that text is fixed in code. It would become false if AI were turned on without a new notice. | Student, HR | **Must be fixed before `AI_ENABLED` is ever switched on in production.** |
| **D12** | Two admin-only texts still say "draft" in round 1 (the A3 remove-document dialog and the reviewer's role description). | N, E | Cosmetic. The student never sees these. |
| **O2** | Creating the Form A link does not mark Form A as sent. Until N presses **Mark as sent**, the student sees "Nothing to do yet". | Student | Checklist step 9 (section 3). |
| **O3** | In the export, timestamps (`submitted_at`, `flagged_at`, `logged_at`, `recorded_at`) are in UTC, while calendar dates are in GMT+2. | Day-90 analysis | Keep this in mind when analysing. |

**What QA could not verify (treat these as untested, not as passed):**
- the app rendered in a real browser;
- accessibility (keyboard-only use, zoom, screen-reader announcements, contrast);
- PDF text extraction in the browser;
- recovery when a session expires in the middle of a quiz;
- behaviour at the GMT+2 midnight boundary;
- anything remote (the production deploy, a remote import, Workflows on Cloudflare);
- the real round-1 questions, which don't exist yet.

Step 3 of the checklist covers the browser and accessibility gap before go-live.

**Scope limits, by design:**
- one student;
- one frozen question version;
- one follow-up cycle;
- onboarding material only (no web articles);
- English only;
- no holiday calendar in the 5-working-day count;
- no email notifications;
- results are for development, not performance evaluation.

With n=1, the pilot can show whether the loop works. It cannot show that the app reduces errors across the company.

### Accepted deviation: personal accounts instead of company accounts

*Decided 2026-10-08.* The company is small, so the CPO's **personal** accounts stand in for company ones: the private GitHub repo `github.com/sneha-beepbeep/decision-bias` is the git remote, and the CPO's personal Cloudflare account hosts production. The CPO checked with the CEO and got the all-clear.

| # | Residual risk | Mitigation |
|---|---|---|
| 1 | Only the CPO can deploy, roll back (R1–R8) or restore the database. If the CPO is unavailable, nobody else can act. Until a second member exists, wherever this document gives a Cloudflare command to IT/engineer, the CPO runs it. | Invite a second member to the Cloudflare account if the plan allows. Turn on two-factor login on both Cloudflare and GitHub. |
| 2 | The student's personal data sits on a personal account. | Covered by the CEO's all-clear. Revisit at the day-90 review. |
| 3 | Moving to a company account later changes the `workers.dev` URL, so every sign-in link changes, and the data has to be moved with a D1 export and import. | Move only after the 90-day pilot, never during it. |

---

## 3. Rollout checklist

**Shape of the rollout:** this goes out once, to one student, with no feature flag. AI stays off (`AI_ENABLED = "false"`). Two controls already exist, so the checklist doesn't repeat them:

- **`npm run deploy` runs a deploy guard** (`scripts/check-deploy-config.mjs`). It refuses to deploy if the database id is still the placeholder, if `APP_TIMEZONE` is not a valid time zone, if `ENVIRONMENT` is not `"production"`, if `AI_MOCK` is set, if `AI_ENABLED` is anything other than `"true"` or `"false"`, if the config names the demo worker or database, or if `CLOUDFLARE_ENV` is set.
- **The app keeps Send Form A locked** until all four roles are named, N and E are different people, the version is published, and HR's sign-off is recorded for notice version 2. The server enforces this (`worker/lib/readiness.ts`, `/pilot/form-a/link` and `/pilot/form-a/sent`).

Everything before step 9 can be redone without touching personal data (section 5). **Blocks** means Send Form A must not happen until the step is done.

| # | Step | Owner | Blocks go-live |
|---|---|---|---|
| 1 | **Name the production role holders:** CPO, N, E, S and the student. N and E must be different people; the app also enforces this. **S must be neither the CPO nor N.** The app doesn't check this. *Confirmed by the CPO on 2026-10-08: production S is neither, so D2 is not a blocker.* If that ever changes, D2 becomes a blocker: fix the A2 warning and the notice text, and have HR approve the new text, before continuing. | CPO | **Yes** |
| 2 | **Back up the code and deploy from `main`:** the remote is the CPO's private personal repo `github.com/sneha-beepbeep/decision-bias` (accepted deviation, section 2). `build/knowledge-check` is already pushed there; merge it into `main` and push `main`. Deploy only from `main`. | IT/engineer | **Yes** |
| 3 | **Do the manual browser and accessibility pass** on the demo or local copy, never production, so no test data reaches the pilot's figures. Cover T1–T3, R1, R2 and M2: keyboard only, 200% zoom, 320 px width and an axe scan. Include **one PDF upload** in A3. Anything that stops the student from completing a form blocks go-live. | CPO, with IT/engineer | **Yes** |
| 4 | **Create production on the CPO's personal Cloudflare account** (accepted deviation, section 2):<br>1. Turn on two-factor login for the account if it isn't on yet.<br>2. Run `npx wrangler whoami` and check that it shows the **CPO's personal** account, the same one that hosts the demo. The guard doesn't check this. Production is a separate worker, `onboarding-knowledge-check`, and a separate database, `onboarding-knowledge-check-db`, in `weur`. Never reuse the demo worker or database (`knowledge-check-demo`, `knowledge-check-demo-db`).<br>3. Run `npx wrangler d1 create onboarding-knowledge-check-db --location weur`, paste the id into the top-level `database_id` in `wrangler.jsonc`, and commit.<br>4. Run `npm run db:migrate:remote`, then `npm run deploy`.<br>5. In the deploy output, check that the bindings list shows `AI_ENABLED "false"`. The guard would also accept `"true"`.<br>6. Note the URL and the version id (`npx wrangler deployments list`). | CPO (the only account holder), with IT/engineer | **Yes** |
| 5 | **Set up the first CPO and admins:**<br>1. Run `npx wrangler secret put BOOTSTRAP_TOKEN` with a random value.<br>2. The CPO opens `<URL>/setup` and enters the code and their name.<br>3. The CPO names the step 1 people on A2, choosing E with "Someone already in the app" (D3).<br>4. The CPO issues sign-in links to N and E and shares them privately.<br><br>*`/setup` stops working once a CPO exists. Deleting the secret afterwards (`npx wrangler secret delete BOOTSTRAP_TOKEN`) is optional tidying.* | IT/engineer, then CPO | **Yes** |
| 6 | **N imports the questions:**<br>1. Run the dry run: `npx tsx scripts/import-questions.mjs <file.json> --remote onboarding-knowledge-check-db --confirm-remote=onboarding-knowledge-check-db --check`.<br>2. If it's clean, run the same command without `--check`. Aim for at least 8 approved questions per topic, plus spares.<br><br>*Before N starts writing, record N's estimate of the hours a manual Forms quiz would take (the M4 effort reference), and log the writing hours separately. Before the real import, take a snapshot: `npx wrangler d1 export onboarding-knowledge-check-db --remote --output=<company-storage>/kc-before-import.sql`. Section 8 says who runs the command.* | N (engineer present for the one-time walkthrough) | **Yes** |
| 7 | **E reviews every question, then N publishes** version 1 on A4, after checking the Form A/B split and the 70% threshold. Publishing freezes the bank for 90 days and can't be undone in the app.<br><br>*Take a second snapshot, `kc-after-publish.sql`, right after publishing.* | E, then N | **Yes** |
| 8 | **Name the backups, then HR approves notice v2.** The CPO names a backup for S, N and E (*to be named by the CPO*; rules in section 4, "Covering for an absent role holder"). HR reviews the exact text the app shows the student and approves the backups with it, because a stand-in for S or E sees the student's named results. The CPO then records the sign-off date and signer on A1. Tell HR that D1 backups keep deleted data for up to 30 days. This can run in parallel with steps 4–7. | CPO, HR, then CPO | **Yes** |
| 9 | **Send Form A** (A1 → A5), on or after 2026-10-01. Create the student's link and share it privately, **then press Mark as sent** (O2). Until then, the student sees "Nothing to do yet". If you re-copy the link later, the earlier link stops working and the student is signed out, so share the new one. Day 0 is the day the student submits Form A. | N | This *is* go-live |

---

## 4. Monitoring after go-live

| When | What to check | Owner | If it's wrong |
|---|---|---|---|
| Right after the deploy (step 4) | `<URL>` loads. `<URL>/setup` accepts the code once. Run `npx wrangler tail onboarding-knowledge-check` during the first sign-ins and watch for 5xx errors or "APP_TIMEZONE is not configured". Workers Logs (observability is on) in the dashboard shows the same. | IT/engineer | Section 5, R1 |
| Right after the import (step 6) | The number of pending questions on V1 matches the importer's summary. On A3, each question shows its source passage. | N, E | R3 |
| The day Form A is sent | Confirm with the student that they saw the notice, not "Nothing to do yet" (O2). The student reaches the notice, then the form. A1 shows "Form A sent". After the student submits: R1 shows per-topic scores, and A1/M1 show a flag if any topic is below 70%. | N, CPO | R4 |
| Every working day while a flag is open | M1/M2 shows the due date (5 working days, Mon–Fri, GMT+2). S logs the follow-up before then. If it's overdue, K1 is at risk. Check once that the due date shown matches a manual count. This covers the untested midnight-boundary case. | S (CPO checks) | Chase S. If the follow-up was given but the log is broken: R1 |
| After the follow-up is logged | Form B unlocks for the student, and R2 shows the comparison once Form B is submitted. | N | R4 |
| For 8 weeks from day 0 | Errors are logged per person and tagged by cause, for M5. | CPO + product team | — |
| Monthly, and at Form A, Form B and day 90 | An A6 export (5 CSVs) and a `wrangler d1 export` snapshot, stored in the location HR agrees to. These contain personal data, so never commit them. | N / IT/engineer | — |
| Whenever someone reports "link expired" | Sign-in links last 14 days, and sessions last 30 days (renewed while in use). Issue a new link from A2 or A5. This also signs the person out of any older sessions, so they must use the new link. | N / CPO | — |
| Always | `AI_ENABLED` stays `"false"`, and no `ANTHROPIC_API_KEY` secret is set (`npx wrangler secret list`). | IT/engineer | R6 |

### Covering for an absent role holder

*Approved by the CPO on 2026-10-08.* Each role has exactly one holder. To cover an absence, move the role to the stand-in; to hand it back, do the same again.

1. On A2, assign the role to the stand-in, choosing "Someone already in the app" if they are already named (D3). Any admin can reassign a role at any time; only the CPO can assign the bank-owner or CPO role, or issue links for admins.
2. Issue the stand-in a sign-in link from A2 and share it privately. A new link also signs that person out of any older sessions.
3. When the holder is back, reassign the role to them on A2 and, if needed, issue them a new link.

Access follows a person's current roles. When the follow-up owner role moves, the student's open flags move to the new holder and the old holder loses access. Who actually did the work is recorded per action (`reviewed_by` on questions, `logged_by` on follow-ups), so the day-90 analysis stays attributable.

| Absent | Stand-in | Never | Watch out |
|---|---|---|---|
| **S** (manager, follow-up owner) | Another team lead | The CPO or N: a manager who is also an admin triggers D2, and the notice's "Your manager won't be told" would be false. Avoid E too (A2 shows a warning). | The 5-working-day follow-up clock keeps running. Hand over the same day. |
| **N** (bank owner) | The CPO, or a second product-team member | E. The app enforces N ≠ E in production. | Only the CPO can assign this role. Running the remote import also needs a login to the Cloudflare account that hosts production (section 8). |
| **E** (SME reviewer) | Another subject-matter expert from the student's team | N | — |
| **CPO** | None in the app. Only the CPO can issue CPO links. | — | **The one single point of failure.** If the CPO is locked out, an engineer fixes it in the database with the CPO's approval: remove the role (`DELETE FROM role_assignments WHERE role = 'cpo';`), set a fresh `BOOTSTRAP_TOKEN`, and the CPO signs in again at `/setup`, which works only while no CPO exists. This creates a new person record for the CPO. |

**Backups are named in advance.** The student notice lists the current role holders, and a stand-in for S or E sees the student's named results. So the backups for S, N and E are named before Send Form A and approved by HR with notice v2 (step 8). Backups: *to be named by the CPO.* A stand-in who isn't on that list needs HR's approval first.

**Someone can't sign in** (they aren't absent): issue them a new link from A2. No reassignment is needed.

---

## 5. Rollback checklist

**Before you start.** Rolling back the code does not roll back the data. `wrangler rollback` changes only the Worker code; D1 keeps its current contents. Issuing a new sign-in link kills the old **link** and immediately ends all of that person's **sessions**, so it is the way to cut someone off (R5). The one exception: when an admin issues a link for themselves, the session they are using stays signed in.

Useful commands (run while signed in to the CPO's personal Cloudflare account, which hosts production; database `onboarding-knowledge-check-db`, worker `onboarding-knowledge-check`):

```sh
npx wrangler deployments list                         # version ids, newest first
npx wrangler rollback <version-id> -m "<reason>"      # code only
npx wrangler d1 export onboarding-knowledge-check-db --remote --output=<company-storage>/kc-<date>.sql
npx wrangler d1 time-travel info    onboarding-knowledge-check-db --timestamp=<RFC3339, e.g. 2026-10-05T09:00:00+02:00>
npx wrangler d1 time-travel restore onboarding-knowledge-check-db --timestamp=<same>
```

Time travel can restore to any minute within the retention window: 7 days on the Workers Free plan, 30 days on Paid. A restore overwrites everything written after that point, including any answers submitted and any deletions made. **After Form A, restore only with the CPO's approval, and tell HR,** because a restore can bring back personal data that was deleted.

### R1. A deploy broke the app (errors, blank page, wrong behaviour)
1. Owner: IT/engineer. Tell N and S not to act in the app until it's fixed.
2. `npx wrangler deployments list`, then `npx wrangler rollback <previous-version-id> -m "<reason>"`.
3. **First deploy only:** there is no earlier version to roll back to. Instead, take the app offline: Cloudflare dashboard → Workers & Pages → `onboarding-knowledge-check` → Settings → Domains & Routes → turn off `workers.dev`. Turning it back on restores access. The data is untouched.
4. Fix the problem on a branch, test it locally, merge it to `main`, then `npm run deploy`.
5. If the student was mid-quiz: nothing is stored until they submit (E9), so they start the form again once the app is back.

### R2. A migration went wrong
There is only one migration in this release (`0000_init`), applied to an empty database. If it fails, delete and recreate the database before any data exists: `npx wrangler d1 delete onboarding-knowledge-check-db`, then repeat step 4 (from `d1 create`) with the new id. For any later migration: take an export immediately beforehand, and if the migration fails, restore with time travel to the minute before.

### R3. The questions are wrong (bad import, or a bad question in review)
- **Before publish:** E rejects the bad questions in V2. N corrects the file and imports the fixes using the importer guide. Run `--check` first. If the imported set as a whole is wrong and E has done no review yet, restore to the point before the import (time travel, or the `kc-before-import.sql` snapshot from step 6) and import again. No personal data exists at this stage.
- **After publish, before Form A:** the version is frozen and the app can't unpublish it. Restore to the point before the publish (time travel), with the CPO's approval, then re-review and publish again. HR's sign-off is a record in the database: if the restore point is earlier than the sign-off, the CPO records it again.
- **After Form A:** don't change the bank. A confirmed wrong question is handled in the export analysis by question id, as the design specifies, and logged as a finding.

### R4. Stop or pause Form A
- **Before it's sent:** don't press Send Form A, and don't share the link. Nothing else is needed.
- **Link shared, opened or not:** on A5, create the link again, which kills the earlier one and signs the student out, and don't share the new one.
- **Student already signed in:** the step above already signs them out (R5). Whatever they already submitted stays, until it is deleted with R7.
- **Telling the student:** S or N tells them in person that the check is paused. The app has no "unsend" action.

### R5. Revoke someone's access immediately (a lost or forwarded link, or a person leaving a role)
1. Issue a new link from A2 (for N or E, only the CPO can do this; for the student, A2 or A5) and don't share it. This kills the old link and signs the person out of every session at once.
2. **Fallback only**, with the CPO's approval: if the app is down, or to end sessions without issuing a new link, delete their sessions directly:
   ```sh
   npx wrangler d1 execute onboarding-knowledge-check-db --remote \
     --command "DELETE FROM sessions WHERE person_id = <id>;"
   ```
   To find the id: `--command "SELECT id, name FROM people;"`. For the student: `... WHERE person_id = (SELECT person_id FROM role_assignments WHERE role = 'student');`
3. If the person should lose a role, an admin assigns that role to someone else on A2 (only the CPO for the bank-owner or CPO role). Access follows a person's current roles. For a temporary stand-in, see "Covering for an absent role holder" (section 4).

### R6. AI was switched on by mistake
Set `AI_ENABLED` back to `"false"` in `wrangler.jsonc` and run `npm run deploy`. Check `npx wrangler secret list`: if an `ANTHROPIC_API_KEY` exists, remove it with `npx wrangler secret delete ANTHROPIC_API_KEY`. Without that key, no call can reach Anthropic. Notice v2 states that no AI is used (D5), so tell HR if any draft was made.

### R7. The student withdraws, or asks for their data to be deleted
On A6, the CPO or N deletes the person by typing their full name. It is all or nothing, it can't be undone, and the student's session ends immediately. Review outcomes (with no names) are kept. Afterwards:
- delete any downloaded export files and D1 snapshots that hold the student's data;
- tell HR that Cloudflare's time-travel backups keep it for up to 30 days.

The pilot then ends, and the CPO decides on `/checkpoint`.

### R8. Abandon the app and run the pilot without it
Use this when the app is unusable and R1–R6 can't fix it in time for a follow-up deadline.
1. The CPO decides, and records the decision and the reason.
2. N downloads the A6 export, which includes the published questions by form, any attempts, flags and follow-ups.
3. N rebuilds the remaining steps in a plain form (Microsoft Forms, with Form B's questions copied unchanged). S logs follow-ups in a shared sheet, keeping the same 5-working-day SLA.
4. Before the student uses the replacement, **HR checks whether notice v2 still describes who sees what.** If it doesn't, HR approves an updated notice.
5. Keep measuring M1–M7 by hand, and flag the switch in the day-90 review (it affects M4/K4).
6. Once the data is safely exported, delete the person in A6, then tear down production:
   ```sh
   npx wrangler delete onboarding-knowledge-check
   npx wrangler workflows delete draft-topic
   npx wrangler d1 delete onboarding-knowledge-check-db
   ```

---

## 6. The demo copy

`knowledge-check-demo` is deployed with its own Worker, D1 database (`knowledge-check-demo-db`, id `24354d59-…`) and Workflow. It runs on the **CPO's personal Cloudflare account**, with mock AI and synthetic Slack-guide data. Its URL is public, so **never put real names, real material or real results in it.** Its admin side shows AI drafting and the K3 kill line, unlike production, and its notice wrongly says no AI is used (D5). This is expected for a demo.

**Decision needed (CPO, before go-live, not blocking):**
- **Keep it** for the accessibility pass (step 3) and for showing stakeholders.
- **Move it** to a company account: only relevant if production moves after the pilot (section 2, "Accepted deviation"). Delete it on the personal account (commands below), then `npm run deploy:demo` again while signed in to the new account. That rewrites the demo `database_id` in `wrangler.jsonc`; commit the change.
- **Delete it:**

  ```sh
  npx wrangler delete --config wrangler.jsonc --env demo
  npx wrangler workflows delete knowledge-check-demo-draft-topic
  npx wrangler d1 delete knowledge-check-demo-db
  rm -f .demo-bootstrap.local
  ```

Either way, delete its `BOOTSTRAP_TOKEN` once the demo CPO has signed in, and remove `.demo-bootstrap.local`.

---

## 7. How the pilot is judged (PRD §9)

**Clock.** Day 0 is the student's Form A submission. Errors are logged for 8 weeks from day 0, and the **CPO chairs the review on day 90**.

**Baselines, all fixed before day 0:**
- the per-topic Form A scores;
- errors per person for the last 1–3 working students;
- N's effort estimate for a manual Forms quiz;
- attribution C, the share of 30–50 tagged incidents that are knowledge gaps.

| # | Measures | Kill / `/checkpoint` signal at day 90 |
|---|---|---|
| M1 | Every flagged topic is followed up within 5 working days, and Form B is taken | **K1:** the follow-up was not delivered or not logged within the SLA |
| M2 | Form B beats Form A on the flagged topics, and the debrief confirms the gaps were real | **K2:** no improvement, or the gaps were not real |
| M3 | Review outcomes: the share of N's questions E rejected or substantially edited | **K3 is suspended in round 1.** M3 is a diagnostic only |
| M4 | Total effort (set-up, the importer walkthrough, hand-writing, import, review, running) | **K4:** more than 1.5× the effort reference. In round 1 this measures *app overhead without AI*. N's hand-writing hours are logged separately and become the baseline AI drafting must beat in round 2 |
| M5 | More than half of the student's knowledge-gap errors fall in topics the quiz covers | **K5:** most fall outside them |
| M6 | The student and S both rate it useful | **K6:** either one rates it not useful |
| M7 | Attribution C is known | **K7:** C below 20% blocks any expansion |

**Day 90 is also the AI checkpoint.** If every target is met and C is at least 20%, the next step is a cohort pilot. That proposal must include either AI drafting with M3/K3 measured, or an offline trial first (AI drafts the frozen material, E reviews, nothing is shown to students). D5 must be fixed before AI is switched on. If any of K1, K2 or K4–K7 fires, run `/checkpoint`.

With n=1, M2, M5 and M6 are anecdotes. They can justify a next step, but not a claim of impact.

---

## 8. Open points to settle at rollout

- **Resolved: a new sign-in link did not end existing sessions** (`issueLink`). Fixed in `b19fd05`: a new link now signs the person out everywhere. CPO decision 2026-10-08: when an admin issues a link for themselves, the session they are using stays signed in.
- **Who runs the remote import.** The CPO decided N runs the importer (PRD rev. 3). But the importer guide (`scripts/import/README.md`, "For engineers") and the script header both describe the remote load as an engineer-only, CPO-approved step, and `npm run import:questions` always targets the local database. A remote import also needs `wrangler login` to the Cloudflare account that hosts production, which is now the CPO's personal account, on the machine it runs on. **Decide whether N is invited to that account (see the accepted deviation, section 2), or whether the CPO or engineer runs the step 6 command with N present.** Then update the guide to match.
- **Demo `database_id` in the shared `wrangler.jsonc`.** The demo id belongs to the CPO's personal Cloudflare account. Since production now runs on that same account, this is no longer a cross-account risk; it is only config hygiene (the demo and production ids sit side by side in one file, and the deploy guard refuses the demo names).
- **Backup storage.** Agree with HR where database snapshots and CSV exports may be kept, and for how long. They contain the student's personal data.
