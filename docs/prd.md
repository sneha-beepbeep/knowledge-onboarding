# PRD: Onboarding Knowledge Check (working title)

*Stage 3 `/prd`, 2026-09-29, rev. 2. **CPO-approved 2026-09-29 (rev. 2 amendments per /design decisions).** Sources: `docs/opportunity-brief.md` (CPO-approved 2026-09-29) and `docs/ceo-review.md` (Pursue with caveats).*

> **Changelog, rev. 2 — 2026-09-29:** Fixes inconsistencies found during `/design` (design spec §11), as settled by the CPO. (P1) F12 now has four access levels, and the reviewer sees anonymised statistics only, with answer statistics hidden below 5 people (so none in the n=1 pilot); §6 aligned. (P9) A confirmed wrong question is removed from the score in the export analysis, not in the app. Published versions stay read-only (§5). (P10) The material and the bank are frozen for the 90-day pilot, with one published version (F4, §2, §5, §7b, §8). Default of 4 questions per topic (F4). The app language is English (§4). Nothing else changed.

**Scoped pitch (CPO-confirmed):** AI-generated knowledge-check quizzes, scored and saved, built from onboarding material, for working students newly joining our company within the context of internal employee onboarding.

**Settled decisions this PRD does not reopen:** we build the app, as simply as possible (CPO, 2026-09-29). The pilot has one working student. Web articles are out. There is no works council and no Microsoft Copilot licence.

---

## 1. Goals and non-goals

**The pilot's goal is to learn, not to save money.** With n=1 the pilot cannot move the ~600k/year error cost. It answers four questions within 90 days:

1. **Loop:** can we run draft, review, quiz, low score, follow-up and retake end to end, with named owners doing their parts on time?
2. **Signal:** do the quiz's weak topics match the knowledge-gap errors the student actually makes?
3. **Effort:** does it cost no more effort than preparing an equivalent manual quiz? This tests the build decision.
4. **Attribution:** what share of historical errors comes from onboarding knowledge gaps (input C)? We learn this from the 30-50 incident sample, which runs in parallel with the app.

**Non-goals (pilot):**
- Reducing the company error rate, or showing a statistically meaningful effect.
- Comparing knowledge across joiners ("same level of knowledge" needs a cohort, so it is deferred).
- Evaluating the student's performance. Results are for development only (see section 6).
- Any use of web or external content.
- A general-purpose quiz platform, LMS replacement or authoring suite.

## 2. Users and roles

With n=1, one person may hold more than one role. Each role still needs a **named person** before go-live.

| Role | Who (proposed) | Does |
|---|---|---|
| **Student** | The pilot working student | Takes the first attempt and the retake, and attends the debrief. |
| **Follow-up owner** | **The student's direct manager** (proposed, see 7a) | Receives the low-score flag, delivers the follow-up, logs it, tags the student's errors by cause. |
| **Question-bank owner** | **A named member of the product team** (proposed, see 7b) | Uploads material, runs AI drafting, publishes the pilot's single version (frozen for 90 days, see section 8), logs effort. |
| **Content reviewer** | **A subject-matter expert from the student's team**, ideally not the manager (proposed, see 7b) | Approves, edits or rejects every draft question before use. |
| **Pilot sponsor** | CPO | HR clearance, the 90-day review, the go/kill/checkpoint call. |

**Assumption:** "working student" means a part-time student employee. This does not matter at n=1, but it must be confirmed before a cohort (open in the brief).

## 3. Core user stories

1. As the **bank owner**, I upload our canonical onboarding material and get AI-drafted questions per topic, each tied to the passage it came from, so review is fast.
2. As the **reviewer**, I approve, edit or reject each draft against the source, so that no unreviewed question ever reaches a student.
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
| F2 | **AI drafting, grounded** | Must | For each topic, the app drafts single-answer multiple-choice questions (4 options) from the uploaded material only. Each draft shows the source passage it was drawn from. Drafts start in "pending review" and cannot be served to a student. |
| F3 | **Review workflow** | Must | The reviewer can approve, edit-then-approve, or reject each draft, with an optional reason. The app records each question's outcome (approved as is, edited, rejected) so the rewrite rate can be computed (metric M3). Only approved questions can be published. |
| F4 | **Fixed, versioned bank with two forms** | Must | The bank owner publishes a version containing **Form A** (first attempt) and **Form B** (retake). Each form has the same topics, with different approved questions. **Default size: 4 questions per topic per form** (~15-25 per form), so the 70% threshold (F7) flags a topic at 2 or more wrong answers rather than on a single miss. A published version is read-only. Every attempt records its version and form. Questions are never regenerated per attempt. **For the pilot there is exactly one published version:** the onboarding material and the bank are frozen for the 90 days. *Why two forms: retaking identical questions after seeing the answers measures recall of the answer key, not understanding, and would inflate success criterion 2.* |
| F5 | **Take quiz and score** | Must | The student can open the assigned form, answer, and submit once per assignment. The app scores the attempt overall and per topic, and shows the student their per-topic results and the correct answers after submission. |
| F6 | **Save results per person** | Must | Each attempt is stored with the student, date, version, form, per-question answers, and overall and per-topic scores. Access follows section 6. |
| F7 | **Low-score flag to a named owner** | Must | Any topic scoring **below 70%** on Form A is flagged (the threshold can be configured by the bank owner). The follow-up owner is notified: email is preferred, but an unmissable in-app list is acceptable if email adds build cost. The flag shows the weak topics and the linked source material. |
| F8 | **Follow-up log** | Must | The follow-up owner marks each flag "follow-up done" with a date and a one-line note of what was done (for example "30-min walkthrough of X"). The app records the time from flag to follow-up. |
| F9 | **Retake and comparison** | Must | Once the follow-up is logged, the student can be assigned Form B. The app shows per-topic Form A vs. Form B scores side by side. |
| F10 | **Export** | Must | The CPO or bank owner can export attempts, flags, follow-ups and review outcomes to CSV. |
| F11 | **Delete a person's data** | Must | The bank owner or CPO can permanently delete a named person's attempts, flags and follow-ups (retention, see section 6). |
| F12 | **Roles and access** | Must | Four access levels: **student** (own results only), **manager / follow-up owner** (their student's results and flags), **reviewer** (question content and anonymised statistics only, never names or named results), and **bank owner/CPO** (full). The reviewer's answer statistics stay hidden until at least 5 people have answered, so none are shown in the n=1 pilot. Use the company's existing sign-in if that is simplest. Otherwise the `/plan` stage picks the lightest option that is still per-person and access-controlled. |
| F13 | Email reminders, bank editing after publish, multiple students | Won't (pilot) | See section 8. |

**Kept manual on purpose, outside the app** (this answers brief open question 2): tagging errors by cause (a shared sheet kept by the manager), tagging the historical 30-50 incidents (a sheet kept by the CPO and product team), the effort log (a sheet kept by the bank owner), the follow-up itself (a conversation or material given by the manager), and the debrief (a meeting).

**Rollout bar (C6):** from a published bank to the student taking Form A should take no more steps than sending a Forms link. If `/plan` finds the app cannot meet this, raise it at the plan gate.

**Language:** the app language is English.

## 5. How AI question generation is reviewed for correctness

Published studies find a material error rate in LLM-drafted questions (22% with factual or conceptual errors in one study, [PubMed 40516963](https://pubmed.ncbi.nlm.nih.gov/40516963/)). Review is therefore a gate, not an option.

- **Grounding:** drafts come only from uploaded company material, and each shows its source passage (F1, F2).
- **Human gate:** every question needs explicit approval by the named reviewer (F3). Nothing is published automatically.
- **Reviewer checklist** (applied per question): (1) correct according to the source *and* current practice; (2) exactly one defensible correct answer; (3) the wrong options are clearly wrong but plausible; (4) tests understanding, not trivia or wording; (5) no confidential detail that shouldn't be shown in a quiz.
- **Measured:** the share of drafts rejected or substantially edited (M3). If it exceeds 50%, AI drafting is not saving effort (kill signal K3).
- **Updates:** for the pilot, the onboarding material and the bank are frozen for the 90 days, with one published version, and a live version is never edited. Publishing a new version when material changes is a post-pilot capability. If material changes during the pilot, that is logged as a finding, not fixed in the bank.
- **Student reports:** the student can flag "I think this question is wrong" in the debrief, or in-app if that's cheap. The reviewer checks it. A confirmed wrong question is removed from that topic's score **in the export analysis, not in the app**. The published version stays read-only.

## 6. Data and privacy (scores saved per person)

At n=1 the results are fully identifiable, so they are employee personal data. We assume GDPR applies, to be confirmed with HR. There is no works council, but **HR/data-use clearance is a go-live gate** (C7).

| Topic | Proposal for HR sign-off |
|---|---|
| **Purpose** | Onboarding development only. Not used for performance evaluation, probation, pay or contract decisions. |
| **Who sees results** | The student (own), the follow-up owner (their student), and the bank owner and CPO (for running the pilot). The reviewer sees per-question statistics only, not names. Answer statistics stay hidden until at least 5 people have answered, so the reviewer sees none in the n=1 pilot (F12). |
| **Notice** | Before the first attempt, the student gets a short written notice: purpose, who sees what, how long it is kept, and who to ask. Participation is voluntary, and declining has no consequences. |
| **Retention** | Identifiable results are deleted **30 days after the 90-day review**. Anonymised per-question statistics (for bank quality) may be kept. |
| **Minimisation** | We store only name/ID, answers, scores, flags and follow-up notes. No free-text evaluation of the person. |
| **AI provider** | **Only onboarding material goes to the AI model, never student data.** The chosen model/provider must be approved for company-internal (possibly confidential) material. There is no Copilot licence, so this is an **open decision** (Q2). |
| **Error tagging** | Cause tags describe the error, not the person. The historical sample should be pseudonymised when tagged. |

**Gate:** no real student result is collected until HR has signed off on the above and the student has received the notice.

## 7. Ownership (brief open question 1 / CEO C4, C8) — proposed for CPO sign-off

**(a) Low-score follow-up: the student's direct manager (proposed).**
The manager is already accountable for the student's ramp-up, sees the errors, and already tags them by cause (as in the brief), so the follow-up adds the least new work there. The manager may hand delivery to a buddy, but stays accountable.
**Service level:** follow-up is delivered and logged within **5 working days** of the Form A flag. Form B is taken within **10 working days** of the follow-up.
*Trade-off:* the manager is also the student's evaluator. This makes the "development, not evaluation" notice (section 6) more important, not less. If the CPO prefers, a buddy can be the owner, with the manager informed only.

**(b) Question bank: owned by a named product-team member (proposed), reviewed by a subject-matter expert from the student's team.**
- *Bank owner* (product team): uploads material, runs drafting, publishes the pilot's single version, logs effort. The material and bank are frozen for the 90-day pilot; updating the bank when material changes starts after the pilot. This keeps the operational work with the team running the pilot.
- *Content reviewer* (a subject-matter expert, ideally not the manager): approves every question for correctness. The product team cannot judge whether an answer is company-correct, so a subject-matter expert is needed.
- *After the pilot:* if we scale, content ownership should move to whoever owns onboarding material (HR/L&D or the team lead). This is decided at the 90-day review.

**No names, no pilot:** if either role cannot be filled by a named person before `/design` completes, that is a `/checkpoint` trigger (brief, C4).

## 8. Scope boundaries

**In scope:** section 4, Must items only. One student, one bank version with Forms A and B (material and bank frozen for the 90 days), and one follow-up cycle (a second cycle only if time allows within 90 days).

**Out of scope for the pilot:**
- Web articles or any external content, and any retrieval beyond uploaded files.
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

**Clock:** day 0 = the student's first attempt (Form A). Error logging runs for 8 weeks, to match the historical reference window. **The 90-day review happens on day 90**, chaired by the CPO.

**Baselines, all set before day 0:**
- **Knowledge baseline:** the per-topic scores on Form A.
- **Error reference:** errors per person in the first 8 weeks for the last 1-3 working students, tagged by cause (pulled by the CPO and product team). If the records don't exist in usable form, this is stated, and M5 is reported descriptively only.
- **Effort reference:** the bank owner's estimate, *made before starting*, of the hours needed to build an equivalent reviewed manual quiz in Forms.
- **Attribution (C):** the share of the 30-50 tagged historical incidents that are "knowledge gap". The CPO and product team own this, and it must be done before day 90.

| # | Metric | Target (success) | Kill / `/checkpoint` signal at day 90 |
|---|---|---|---|
| M1 | Loop completion | All flagged topics followed up within 5 working days. Form B taken. | **K1:** the follow-up was not delivered, or not logged, within the SLA, or no owner was named. |
| M2 | Pre/post on weak topics | Form B score on the flagged topics is higher than on Form A, and the student and manager confirm in the debrief that the gaps were real. | **K2:** no improvement on the flagged topics, or the debrief says the gaps were not real. |
| M3 | Draft rewrite rate | 50% or less of drafts rejected or substantially edited. | **K3:** more than 50%. AI drafting is not saving effort. |
| M4 | Total effort (setup + drafting + review + running) | No more than the effort reference. | **K4:** clearly more than the effort reference (more than 1.5x). The build decision did not pay off at this scale. |
| M5 | Signal matches reality | Most (more than 50%) of the student's "knowledge gap" errors fall in topics the quiz covers. | **K5:** most knowledge-gap errors fall in topics the quiz does not cover. |
| M6 | Usefulness | The student and manager both rate it useful (debrief: yes/no, plus why). | **K6:** either one rates it not useful. |
| M7 | Attribution (C) | Known by day 90. | **K7:** C is below **20%**. The upside is too small to scale, so run `/checkpoint` before any expansion. *(The threshold is proposed, see Q3.)* |

**Decision at day 90:** if all targets are met and C is at least 20%, propose a cohort pilot. Error-rate reduction against the per-joiner baseline becomes the primary kill signal at cohort scale (as the CEO requires). If any of K1-K7 fires, run `/checkpoint`. *With n=1, M2, M5 and M6 are anecdotes. They can justify the next step, but not a claim of impact.*

## 10. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| The build takes longer than the pilot is worth (the PM's earlier concern) | Med / Med | Must-only scope. Rollout bar (C6). M4 and K4 test it explicitly. |
| The follow-up doesn't happen (the manager is busy) | Med / High | A named owner, a 5-day SLA, flag plus log (F7, F8). K1. |
| AI drafts are wrong and slip through review | Med / High | Grounding, a mandatory checklist, student reports, the M3 rewrite rate. |
| Onboarding material is incomplete or out of date, so the quiz tests the wrong things | Med / High | The reviewer checks against current practice. K5 catches it. Material gaps are a finding in their own right. |
| The student sees the quiz as an evaluation, so results are distorted or trust is lost | Med / Med | Development-only purpose, written notice, voluntary participation, HR sign-off. |
| Confidential material is sent to an unapproved AI provider | Low-Med / High | Provider approval before use (Q2). No personal data sent to the model. |
| Historical error records don't exist, so there is no baseline or C | Med / Med | Report descriptively. K7 cannot fire, so expansion is blocked until C exists. |
| n=1 produces a false positive and the pilot is over-scaled | Med / Med | The day-90 rule: anecdotes justify only a cohort pilot, not a rollout. |

## 11. Open questions for the CPO

1. **Owners:** do you approve the proposal in section 7, with the student's manager owning follow-up and a product-team member owning the bank with a subject-matter expert as reviewer? Please give the three names, plus the pilot student's start date (it sets day 0).
2. **AI provider:** there is no Copilot licence. Which AI model or provider may process our onboarding material? Does it need IT/security approval before `/plan` can choose it? This may be the longest lead-time item.
3. **Thresholds:** do you accept the proposed numbers (a 70% per-topic flag, a 5-day follow-up SLA, the 50% rewrite-rate kill, a 1.5x effort kill, and a C below 20% blocking expansion)? Or do you want different lines, set now, before the data comes in?
