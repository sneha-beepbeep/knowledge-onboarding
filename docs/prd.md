# PRD: Onboarding Knowledge Check (working title)

*Stage 3 `/prd`, 2026-09-29, rev. 3. **CPO-approved 2026-09-29 (rev. 3: round-1 no-AI amendments).** Sources: `docs/opportunity-brief.md` (CPO-approved 2026-09-29) and `docs/ceo-review.md` (Pursue with caveats).*

> **Changelog, rev. 3 — 2026-09-29:** Aligns the PRD with CPO decisions made after `/plan`. (1) IT skipped AI for round 1. The bank owner hand-writes the questions in a JSON file and runs an importer to load them. They pass the same source-quote check and review gate. F2 is split into F2a (import, round 1) and F2b (AI drafting, round 2, only when `AI_ENABLED`). (2) The pitch deviation is accepted by the CPO, and the day-90 review is the AI checkpoint. (3) M3 becomes "Review outcomes" and K3 is suspended in round 1. M4/K4 is kept as "build overhead without AI", and hand-writing hours are logged separately. (4) §6: nothing is sent to an AI provider in round 1. Notice v2 (no AI claims) needs its own HR approval. Hosting and the demo deployment are recorded. (5) Settled from `/plan` and after: roles S/N/E, planned start date 2026-10-01, sign-in by link, no email, Cloudflare EU, time zone fixed at GMT+2. (6) CPO decisions: N runs the importer, not the engineer (with a plain-language guide, a check-only mode, clear error messages and a one-time walkthrough counted in M4); Form A may go out after 2026-10-01. (7) Risks and open questions updated.
>
> **Changelog, rev. 2 — 2026-09-29:** Fixes inconsistencies found during `/design` (design spec §11), as settled by the CPO. (P1) F12 now has four access levels, and the reviewer sees anonymised statistics only, with answer statistics hidden below 5 people (so none in the n=1 pilot); §6 aligned. (P9) A confirmed wrong question is removed from the score in the export analysis, not in the app. Published versions stay read-only (§5). (P10) The material and the bank are frozen for the 90-day pilot, with one published version (F4, §2, §5, §7b, §8). Default of 4 questions per topic (F4). The app language is English (§4). Nothing else changed.

**Scoped pitch (CPO-confirmed):** AI-generated knowledge-check quizzes, scored and saved, built from onboarding material, for working students newly joining our company within the context of internal employee onboarding.

**Round 1 (pilot, 2026):** the bank owner hand-writes the questions, each grounded in a quote from the source material, and a reviewer checks every one. No AI is used (IT decision). AI drafting is round 2, behind `AI_ENABLED`. **The CPO accepted this deviation from the pitch on 2026-09-29, instead of running `/checkpoint`. The day-90 review is the AI checkpoint** (see section 9, day-90 decision).

**Settled decisions this PRD does not reopen:** we build the app, as simply as possible (CPO, 2026-09-29). The pilot has one working student. Web articles are out. There is no works council and no Microsoft Copilot licence. AI is off in round 1 (IT), and questions are loaded from a JSON file by an importer that **N runs, not the engineer**. Hosting is Cloudflare, on a company-owned account with EU data location (IT-approved). Sign-in is by a revocable 14-day link, with no accounts. There is no email: in-app badges and copied links instead. The time zone is fixed at GMT+2 all year (`Etc/GMT-2`). The roles are S = manager / follow-up owner, N = bank owner, E = SME reviewer. The student's start date is 2026-10-01, and **Form A may go out after that date**: the questions, the reviewer gate and HR approval of notice v2 come first.

---

## 1. Goals and non-goals

**The pilot's goal is to learn, not to save money.** With n=1 the pilot cannot move the ~600k/year error cost. It answers four questions within 90 days:

1. **Loop:** can we run write/import, review, quiz, low score, follow-up and retake end to end, with named owners doing their parts on time?
2. **Signal:** do the quiz's weak topics match the knowledge-gap errors the student actually makes?
3. **Effort:** does it cost no more effort than preparing an equivalent manual quiz? In round 1 this tests whether the app's running overhead beats a Forms quiz with the same hand-written questions. It does **not** test whether AI drafting saves effort. That moves to round 2.
4. **Attribution:** what share of historical errors comes from onboarding knowledge gaps (input C)? We learn this from the 30-50 incident sample, which runs in parallel with the app.

**Non-goals (pilot):**
- Reducing the company error rate, or showing a statistically meaningful effect.
- Comparing knowledge across joiners ("same level of knowledge" needs a cohort, so it is deferred).
- Evaluating the student's performance. Results are for development only (see section 6).
- Any use of web or external content.
- A general-purpose quiz platform, LMS replacement or authoring suite.
- Evaluating AI drafting quality (round 2).

## 2. Users and roles

With n=1, one person may hold more than one role. Each role still needs a **named person** before go-live. **N and E must be different people**, or the review gate would only be the author reviewing their own work.

| Role | Who | Does |
|---|---|---|
| **Student** | The pilot working student (starts 2026-10-01) | Takes the first attempt and the retake, and attends the debrief. |
| **Follow-up owner** | **S**, the student's direct manager (see 7a) | Receives the low-score flag, delivers the follow-up, logs it, tags the student's errors by cause. |
| **Question-bank owner** | **N**, a member of the product team (see 7b) | Uploads material, writes the questions (with verbatim source quotes) in the JSON file, **runs the importer to load them** (not the engineer), publishes the pilot's single version (frozen for 90 days, see section 8), logs effort. |
| **Content reviewer** | **E**, a subject-matter expert from the student's team, not the manager (see 7b) | Approves, edits or rejects every pending question before use. |
| **Pilot sponsor** | CPO | HR clearance, the 90-day review, the go/kill/checkpoint call. |

**Assumption:** "working student" means a part-time student employee. This does not matter at n=1, but it must be confirmed before a cohort (open in the brief).

## 3. Core user stories

1. As the **bank owner**, I write questions per topic, each with the passage it comes from, and run the importer myself to load them. Any question whose quote isn't in the uploaded material is rejected with a clear message, so I can fix it and review is fast. *(Round 2: the app drafts them with AI, with the same grounding.)*
2. As the **reviewer**, I approve, edit or reject each pending question against the source, so that no unreviewed question ever reaches a student.
3. As the **bank owner**, I publish a fixed, versioned bank, so every attempt is scored against exactly the same approved questions.
4. As the **student**, I take the quiz and see my score per topic, with the correct answers, so I know where my gaps are.
5. As the **follow-up owner**, I am told when a topic score is below threshold, and I record what follow-up I gave and when, so the gap gets closed and doesn't just get recorded.
6. As the **student**, I retake the quiz after the follow-up, and the student, manager and CPO see the change per topic against my first attempt.
7. As the **CPO**, I export all attempts, flags and follow-ups for the 90-day review.

## 4. Functional requirements

MoSCoW priorities are for the pilot. Anything not listed here is out of scope (see section 8).

| # | Requirement | Pri. | Acceptance criteria |
|---|---|---|---|
| F1 | **Material intake** | Must | The bank owner can upload or paste onboarding material (at minimum plain text and PDF). Each document is stored with a name, a version date and one or more topic tags. Only uploaded material is used as a source. The app makes no web or external retrieval. |
| F2a | **Question import (round 1)** | Must | The bank owner (N) supplies a JSON file of single-answer multiple-choice questions, each with 4 options, one correct answer, a topic and a verbatim source quote, and runs the importer themselves. A **check-only mode** validates the file without loading anything. The importer rejects any item that is malformed or whose quote isn't found word for word in the uploaded material, and reports how many it rejected and why, in plain language. Imported questions land as "pending review" and cannot be served to a student. The importer comes with a plain-language, step-by-step guide written for a non-engineer. |
| F2b | **AI drafting, grounded (round 2, only when `AI_ENABLED`)** | Won't (round 1) | For each topic, the app drafts single-answer multiple-choice questions (4 options) from the uploaded material only. Each draft shows the source passage it was drawn from. Drafts start in "pending review" and cannot be served to a student. |
| F3 | **Review workflow** | Must | The reviewer can approve, edit-then-approve, or reject each pending question (imported or drafted), with an optional reason. The app records each question's outcome (approved as is, edited, rejected) so the review outcomes can be computed (metric M3). Only approved questions can be published. |
| F4 | **Fixed, versioned bank with two forms** | Must | The bank owner publishes a version containing **Form A** (first attempt) and **Form B** (retake). Each form has the same topics, with different approved questions. **Default size: 4 questions per topic per form** (~15-25 per form), so the 70% threshold (F7) flags a topic at 2 or more wrong answers rather than on a single miss. A published version is read-only. Every attempt records its version and form. Questions are never regenerated per attempt. **For the pilot there is exactly one published version:** the onboarding material and the bank are frozen for the 90 days. In round 1, N must write enough questions for both forms: 4 per topic per form, plus spares to replace rejected ones. *Why two forms: retaking identical questions after seeing the answers measures recall of the answer key, not understanding, and would inflate success criterion 2.* |
| F5 | **Take quiz and score** | Must | The student can open the assigned form, answer, and submit once per assignment. The app scores the attempt overall and per topic, and shows the student their per-topic results and the correct answers after submission. |
| F6 | **Save results per person** | Must | Each attempt is stored with the student, date, version, form, per-question answers, and overall and per-topic scores. Access follows section 6. |
| F7 | **Low-score flag to a named owner** | Must | Any topic scoring **below 70%** on Form A is flagged (the threshold can be configured by the bank owner). The follow-up owner is notified in the app, with a badge and a copied link. There is no email (decided in `/plan`). The flag shows the weak topics and the linked source material. |
| F8 | **Follow-up log** | Must | The follow-up owner marks each flag "follow-up done" with a date and a one-line note of what was done (for example "30-min walkthrough of X"). The app records the time from flag to follow-up. |
| F9 | **Retake and comparison** | Must | Once the follow-up is logged, the student can be assigned Form B. The app shows per-topic Form A vs. Form B scores side by side. |
| F10 | **Export** | Must | The CPO or bank owner can export attempts, flags, follow-ups and review outcomes to CSV. |
| F11 | **Delete a person's data** | Must | The bank owner or CPO can permanently delete a named person's attempts, flags and follow-ups (retention, see section 6). |
| F12 | **Roles and access** | Must | Four access levels: **student** (own results only), **manager / follow-up owner** (their student's results and flags), **reviewer** (question content and anonymised statistics only, never names or named results), and **bank owner/CPO** (full). The reviewer's answer statistics stay hidden until at least 5 people have answered, so none are shown in the n=1 pilot. Sign-in is by a revocable 14-day link, with no accounts. Admins issue links. Only the CPO issues admin links or assigns the CPO role. |
| F13 | Email reminders, bank editing after publish, multiple students | Won't (pilot) | See section 8. |

**Readiness:** the "AI provider set up" readiness item applies only when `AI_ENABLED`. In round 1, publishing and Form A are not blocked by any AI approval.

**Dates and working days:** working days are Mon–Fri, with no holiday calendar. All dates are in fixed GMT+2 (`Etc/GMT-2`) all year, with no daylight saving. The service levels in section 7 use this.

**Kept manual on purpose, outside the app** (this answers brief open question 2): tagging errors by cause (a shared sheet kept by the manager), tagging the historical 30-50 incidents (a sheet kept by the CPO and product team), the effort log (a sheet kept by the bank owner), the follow-up itself (a conversation or material given by the manager), and the debrief (a meeting).

**Rollout bar (C6):** from a published bank to the student taking Form A should take no more steps than sending a Forms link. If `/plan` finds the app cannot meet this, raise it at the plan gate.

**Language:** the app language is English.

## 5. How questions are reviewed for correctness

Published studies find a material error rate in LLM-drafted questions (22% with factual or conceptual errors in one study, [PubMed 40516963](https://pubmed.ncbi.nlm.nih.gov/40516963/)). This is why review is a gate, not an option, when AI drafting arrives in round 2. Hand-written questions in round 1 go through the same gate. Authors make errors too, and the author is not the subject-matter expert.

- **Grounding:** questions come only from uploaded company material, and each carries its source passage. Round 1: imported questions whose quote isn't found word for word are rejected (F1, F2a). Round 2: the same applies to AI drafts (F2b).
- **Human gate:** every question needs explicit approval by the named reviewer (F3). Nothing is published automatically.
- **Reviewer checklist** (applied per question): (1) correct according to the source *and* current practice; (2) exactly one defensible correct answer; (3) the wrong options are clearly wrong but plausible; (4) tests understanding, not trivia or wording; (5) no confidential detail that shouldn't be shown in a quiz.
- **Measured:** round 1: the share of N's questions that E rejects or substantially edits (M3, review outcomes). This is a diagnostic with no kill line. Round 2: the share of AI drafts rejected or substantially edited. If it exceeds 50%, AI drafting is not saving effort (kill signal K3).
- **Updates:** for the pilot, the onboarding material and the bank are frozen for the 90 days, with one published version, and a live version is never edited. Publishing a new version when material changes is a post-pilot capability. If material changes during the pilot, that is logged as a finding, not fixed in the bank.
- **Student reports:** the student can flag "I think this question is wrong" in the debrief, or in-app if that's cheap. The reviewer checks it. A confirmed wrong question is removed from that topic's score **in the export analysis, not in the app**. The published version stays read-only.

## 6. Data and privacy (scores saved per person)

At n=1 the results are fully identifiable, so they are employee personal data. We assume GDPR applies, to be confirmed with HR. There is no works council, but **HR/data-use clearance is a go-live gate** (C7).

| Topic | Proposal for HR sign-off |
|---|---|
| **Purpose** | Onboarding development only. Not used for performance evaluation, probation, pay or contract decisions. |
| **Who sees results** | The student (own), the follow-up owner (their student), and the bank owner and CPO (for running the pilot). The reviewer sees per-question statistics only, not names. Answer statistics stay hidden until at least 5 people have answered, so the reviewer sees none in the n=1 pilot (F12). |
| **Notice** | Before the first attempt, the student gets a short written notice: purpose, who sees what, how long it is kept, and who to ask. Participation is voluntary, and declining has no consequences. Round 1 uses **notice v2**, which makes no AI claims. HR must approve v2 specifically; a v1 sign-off does not carry over. Turning AI on later needs a new notice version and HR re-approval. |
| **Retention** | Identifiable results are deleted **30 days after the 90-day review**. Anonymised per-question statistics (for bank quality) may be kept. |
| **Minimisation** | We store only name/ID, answers, scores, flags and follow-up notes. No free-text evaluation of the person. |
| **AI provider** | **Round 1: nothing is sent to any AI provider** (`AI_ENABLED=false` in production). Round 2: Anthropic (Claude, via the company Console organisation). IT/security approved it before round 1 was switched to no-AI; confirm again before enabling. Onboarding material only, never student data. |
| **Hosting** | Cloudflare, on a company-owned account with EU data location, approved by IT. A separate **demo** deployment holds synthetic data only. It is not part of the pilot, its data never counts towards the metrics, and no real person's data or sign-in links go into it. |
| **Error tagging** | Cause tags describe the error, not the person. The historical sample should be pseudonymised when tagged. |

**Gate:** no real student result is collected until HR has signed off on the above, including notice v2, and the student has received the notice.

## 7. Ownership (brief open question 1 / CEO C4, C8)

**(a) Low-score follow-up: S, the student's direct manager.**
The manager is already accountable for the student's ramp-up, sees the errors, and already tags them by cause (as in the brief), so the follow-up adds the least new work there. The manager may hand delivery to a buddy, but stays accountable.
**Service level:** follow-up is delivered and logged within **5 working days** of the Form A flag. Form B is taken within **10 working days** of the follow-up (working days as defined in section 4).
*Trade-off:* the manager is also the student's evaluator. This makes the "development, not evaluation" notice (section 6) more important, not less. If the CPO prefers, a buddy can be the owner, with the manager informed only.

**(b) Question bank: owned by N (product team), reviewed by E (subject-matter expert from the student's team).**
- *Bank owner* (N): uploads material, writes the questions and runs the importer to load them in round 1 (runs AI drafting in round 2), publishes the pilot's single version, logs effort. The engineer does not run the importer; they give N a one-time walkthrough. The material and bank are frozen for the 90-day pilot; updating the bank when material changes starts after the pilot. This keeps the operational work with the team running the pilot.
- *Content reviewer* (E, not the manager, and not N): approves every question for correctness. The product team cannot judge whether an answer is company-correct, so a subject-matter expert is needed.
- *After the pilot:* if we scale, content ownership should move to whoever owns onboarding material (HR/L&D or the team lead). This is decided at the 90-day review.

**No names, no pilot:** if a role loses its named person before go-live, that is a `/checkpoint` trigger (brief, C4).

## 8. Scope boundaries

**In scope:** section 4, Must items only. One student, one bank version with Forms A and B (material and bank frozen for the 90 days), and one follow-up cycle (a second cycle only if time allows within 90 days).

**Out of scope for the pilot:**
- Web articles or any external content, and any retrieval beyond uploaded files.
- **Round 1:** AI drafting and any call to an AI provider (F2b is round 2).
- Writing or editing questions inside the app (questions come in through the JSON importer).
- Email of any kind.
- The demo deployment (synthetic data, for sharing and testing only).
- Question types other than single-answer multiple choice (no free text, no AI grading).
- Per-attempt or adaptive question generation.
- A second bank version, or any change to the material or bank during the 90 days.
- In-app exclusion of questions from scoring (done in the export analysis instead, see section 5).
- Multiple students, cohorts, cross-joiner comparison dashboards or leaderboards.
- Integration with an LMS, HR system or payroll. Automated error-data import.
- Automated reminders or escalation chains, and mobile apps.
- Learning content or courses (the app points to source material. The follow-up owner teaches).
- Analytics beyond the per-topic comparison and CSV export.

## 9. Success metrics, baseline and 90-day kill signal

**Clock:** the student starts work on 2026-10-01. **Form A may go out after that date (CPO decision, 2026-09-29).** It is sent only once the questions are written and imported, E has reviewed them, and HR has approved notice v2. In the system, day 0 = the student's Form A submission, so a later Form A costs nothing in measurement. Error logging runs for 8 weeks from day 0, to match the historical reference window. **The 90-day review happens on day 90**, chaired by the CPO.

**Baselines, all set before day 0:**
- **Knowledge baseline:** the per-topic scores on Form A.
- **Error reference:** errors per person in the first 8 weeks for the last 1-3 working students, tagged by cause (pulled by the CPO and product team). If the records don't exist in usable form, this is stated, and M5 is reported descriptively only.
- **Effort reference:** the bank owner's estimate, *made before starting to write the questions*, of the hours needed to build an equivalent reviewed manual quiz in Forms. If N has already started writing, record that the reference may be biased.
- **Attribution (C):** the share of the 30-50 tagged historical incidents that are "knowledge gap". The CPO and product team own this, and it must be done before day 90.

| # | Metric | Target (success) | Kill / `/checkpoint` signal at day 90 |
|---|---|---|---|
| M1 | Loop completion | All flagged topics followed up within 5 working days. Form B taken. | **K1:** the follow-up was not delivered, or not logged, within the SLA, or no owner was named. |
| M2 | Pre/post on weak topics | Form B score on the flagged topics is higher than on Form A, and the student and manager confirm in the debrief that the gaps were real. | **K2:** no improvement on the flagged topics, or the debrief says the gaps were not real. |
| M3 | Review outcomes | Round 1: the share of N's questions that E rejects or substantially edits, reported as a diagnostic. A high rate points to unclear material or unclear topics. Round 2: 50% or less of AI drafts rejected or substantially edited. | **K3: suspended in round 1.** Round 2: more than 50%, meaning AI drafting is not saving effort. |
| M4 | Total effort (setup, including the engineer's one-time importer walkthrough with N + hand-writing incl. source quotes + importing + review + running) | No more than the effort reference. N logs hand-writing hours as a separate line in the effort sheet. | **K4:** clearly more than the effort reference (more than 1.5x). In round 1 this is the build overhead without AI: the app did not pay off against a Forms quiz at this scale. |
| M5 | Signal matches reality | Most (more than 50%) of the student's "knowledge gap" errors fall in topics the quiz covers. | **K5:** most knowledge-gap errors fall in topics the quiz does not cover. |
| M6 | Usefulness | The student and manager both rate it useful (debrief: yes/no, plus why). | **K6:** either one rates it not useful. |
| M7 | Attribution (C) | Known by day 90. | **K7:** C is below **20%**. The upside is too small to scale, so run `/checkpoint` before any expansion. |

**What round 1 does not learn:**
- whether AI drafts of our material are accurate enough (the real rewrite rate, against the 22% figure from the literature)
- whether AI drafting saves time compared with writing by hand, which was the main reason to build rather than use Forms
- how the quote check and the drafting pipeline behave on real model output
- whether the AI part of the notice changes how the student trusts the quiz

The separately logged hand-writing hours (M4) are the baseline that round-2 AI drafting has to beat.

**Decision at day 90 (this is also the AI checkpoint):** if all targets are met and C is at least 20%, propose a cohort pilot. A cohort proposal must include AI drafting with M3/K3 measured, **or** a pre-cohort offline trial first: AI drafts the same frozen material and E reviews it, with nothing served to students. Error-rate reduction against the per-joiner baseline becomes the primary kill signal at cohort scale (as the CEO requires). If any of K1, K2 or K4-K7 fires, run `/checkpoint`. *With n=1, M2, M5 and M6 are anecdotes. They can justify the next step, but not a claim of impact.*

## 10. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| The build takes longer than the pilot is worth (the PM's earlier concern) | Med / Med | Must-only scope. Rollout bar (C6). M4 and K4 test it explicitly. The no-AI round-1 change (importer and `AI_ENABLED` switch) added about 1 build day. |
| The follow-up doesn't happen (the manager is busy) | Med / High | A named owner, a 5-day SLA, flag plus log (F7, F8). K1. |
| Questions are wrong or ambiguous and slip through review | Med / High | Grounding with verbatim quotes, a mandatory checklist, student reports, M3 review outcomes. |
| Onboarding material is incomplete or out of date, so the quiz tests the wrong things | Med / High | The reviewer checks against current practice. K5 catches it. Material gaps are a finding in their own right. |
| The student sees the quiz as an evaluation, so results are distorted or trust is lost | Med / Med | Development-only purpose, written notice, voluntary participation, HR sign-off. |
| Confidential material is sent to an unapproved AI provider | Closed in round 1 (nothing is sent). Reopens in round 2. | Confirm the Anthropic approval before enabling. No personal data sent to the model. |
| HR approval of notice v2 comes too late | Med / High | It blocks Send Form A. Send v2 to HR now. Form A may go out after 2026-10-01 (section 9). |
| N's hand-writing effort (about 30-50+ questions with exact quotes, before E's review) delays go-live or inflates M4 | High / Med | Form A goes out after 2026-10-01 if needed (CPO decision). Cut topics rather than question quality. Log the hours separately (M4). |
| N has to run the importer, a command-line script, and may get stuck, putting the engineer back on the critical path | Med / Med | The importer has a plain-language guide, a check-only mode and clear error messages (F2a). The engineer does a one-time walkthrough with N, and that time counts in M4. |
| N and E are the same person, or E rubber-stamps N's work | Low-Med / High | N and E must be different people (section 2). |
| Scaling on an AI premise with no evidence | Med / High | The day-90 rule requires AI drafting with M3/K3 measured, or an offline trial, before a cohort (section 9). |
| Demo and pilot get mixed up (for example, a demo link is sent to the real student) | Low / Med | Separate database and worker, synthetic data only, demo labelling, excluded from metrics (section 6). |
| Historical error records don't exist, so there is no baseline or C | Med / Med | Report descriptively. K7 cannot fire, so expansion is blocked until C exists. |
| n=1 produces a false positive and the pilot is over-scaled | Med / Med | The day-90 rule: anecdotes justify only a cohort pilot, not a rollout. |

## 11. Open questions for the CPO

**Resolved:**
- *Owners and start date* (rev. 2 Q1): S = manager / follow-up owner, N = bank owner, E = SME reviewer. The student starts 2026-10-01 (CPO, 2026-09-29).
- *AI provider* (rev. 2 Q2): IT/security approved Anthropic, then IT paused AI for round 1. Round 1 runs without AI (CPO option (b), 2026-09-29).
- *Thresholds* (rev. 2 Q3): accepted at `/prd`. K3 is suspended in round 1.
- *Pitch deviation:* accepted by the CPO on 2026-09-29. Day 90 is the AI checkpoint.
- *Who runs the importer:* N, not the engineer, with a plain-language guide, a check-only mode and clear error messages. The engineer gives a one-time walkthrough, counted in M4 (CPO, 2026-09-29).
- *Form A timing:* Form A may go out after 2026-10-01. The questions, the reviewer gate and HR approval of notice v2 come first (CPO, 2026-09-29).

**Open:**
1. **Is there a latest acceptable date for Form A?** Without one, the pilot can drift. If the pilot must end by a fixed date (for example, the end of the student's contract or a budget review), day 90 has to fit inside it. That sets the latest day for Form A.
2. **The offline AI trial before day 90:** should N and E run it on the frozen material as soon as IT allows AI (nothing served to the student), so that the day-90 AI checkpoint has real rewrite-rate data rather than none?
