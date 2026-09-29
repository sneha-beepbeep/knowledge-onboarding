# Opportunity Brief: Onboarding Knowledge Check (working title)

*Stage 2 `/kickoff`, 2026-09-29, rev. 4 (final). **Approved by the CPO on 2026-09-29.** Source: `docs/ceo-review.md` (Pursue with caveats, CPO-approved 2026-09-29).*

**Scoped pitch (CPO-confirmed):** AI-generated knowledge-check quizzes, scored and saved, built from onboarding material, for working students newly joining our company within the context of internal employee onboarding.

## Problem
Working students finish onboarding with uneven knowledge of how the company works. The CPO reports **~1M/year** in errors and rework, of which **60% (~600k/year) comes from errors**. Nothing checks, in a consistent way, whether a joiner understood the onboarding material. The LMS and HR-tool quizzes were tried and proved too complicated to implement. A quiz only measures a gap. Results improve only if a low score triggers a defined follow-up (CEO condition 4).

## Who has it
- **Primary user:** newly joining working students. The first pilot is **one working student** (CPO input A). The definition (part-time student employees, or all new hires) is still unconfirmed.
- **Secondary users:** the question reviewer/content owner, and the manager or buddy who acts on results.

## Evidence it's real
- **Reported (CPO):** ~1M/year in errors and rework, of which 60% comes from errors. The currency and calculation method have not been given. The composition of the remaining ~400k (presumably other rework) is not confirmed.
- **Reported (CPO):** LMS/HR quiz tooling was tried and abandoned.
- **Unverified:** the share of the ~600k caused by onboarding knowledge gaps (input C, "Unclear").
- **External:** LLM-drafted questions are a usable start but not reliable unreviewed. In one study, 22% had factual or conceptual errors ([PubMed 40516963](https://pubmed.ncbi.nlm.nih.gov/40516963/)). So human review stays mandatory.

## CPO inputs and how this brief uses them
| # | As given | Interpretation | Still open |
|---|---|---|---|
| A | "1 working student to start" | The pilot has n=1. It is a feasibility test, not an effect test. | Next cohort size, if the pilot expands. |
| B | "Error level is 60%", clarified: "60% of the 1M comes from errors" | **Resolved.** About 600k/year is error-related. This is a company-wide cost split, **not** a per-joiner baseline and **not** the onboarding share. | Nothing for B itself. For the per-person baseline, see below. |
| C | "Unclear" | Attribution remains unknown. | Obtain it through the lightweight method below. **Owner: the CPO and the product team.** |

**Getting C inside the pilot (lightweight):** (1) for every error the pilot student causes, the manager adds a one-line cause tag: *knowledge gap / process / tooling / other*; (2) **the CPO and the product team** tag a one-off sample of 30-50 recent historical error incidents the same way (about 1-2 hours). Step 2 produces a usable share. With n=1, step 1 is anecdotal.

**Per-person baseline for the single working student:** a new joiner has no "before" period, so the pilot needs two stand-ins, both set up before the student starts:
1. **Knowledge baseline:** the student's first quiz attempt, taken before any follow-up. The retake after follow-up is compared against it, per topic.
2. **Error reference:** errors and rework per person in the first 8 weeks for recent working students (for example the last 1-3), taken from whatever records exist, with the cause tagged as above. **The CPO and the product team will pull these records** (CPO, 2026-09-29). If no such records turn out to exist, say so. The pilot student's errors are then logged and described but not compared.

## Size of prize
**Upside = ~600k x (share from onboarding gaps) x (reduction achieved).** The first term is now known (input B); the other two are not. *Illustration only, not an estimate:* at a 20-40% onboarding share and a 20-30% reduction, that is ~24k-72k/year. Knowing the onboarding share (C) is what turns this into a real number. A one-person pilot recovers essentially none of it directly. **Its value is information:** whether the loop is workable and worth scaling.

## What an n=1 pilot can and cannot prove
- **Can show:** whether the loop works end to end (drafted, reviewed, quiz taken, low score, follow-up delivered, retake); how much reviewer and setup effort it takes; whether the quiz's weak topics match the errors the student actually makes; and whether the student and manager find it useful.
- **Cannot show:** any effect on the error rate or on the ~600k; consistency across joiners (the core "same level of knowledge" goal); or anything statistically meaningful. A good result from one person is an anecdote, not evidence.

## Success / kill criteria (n=1)
**Success (all needed to justify expanding):**
1. **The loop completes:** a reviewed quiz is taken, weak topics are identified, the owner delivers a follow-up within the agreed time, and the retake is completed.
2. **Within-person pre/post:** the retake score on the weak topics improves on the first attempt (the knowledge baseline), and the student and manager confirm in a short debrief that the gaps were real.
3. **Signal matches reality:** errors the manager tags as "knowledge gap" during the pilot fall mostly in topics the quiz covered.
4. **Effort is acceptable:** total setup and review time is recorded and is no more than preparing an equivalent manual quiz.

**Kill or `/checkpoint` if:** the follow-up doesn't happen or has no owner; the reviewer has to rewrite most AI drafts; errors during the pilot come from topics the quiz doesn't touch; or the student or manager finds it unhelpful.

**Before expanding past n=1:** C is estimated from the historical sample, a per-joiner error baseline exists, the next cohort's size is known, and the success criteria above are met. Error-rate targets against that baseline become the kill signal only at cohort scale.

## Key decisions
1. **Web background articles: OUT of the pilot.** They cannot be reviewed as company-correct, and they would undermine consistency. Revisit only if internal material can't cover the gaps.
2. **Build vs. simplest alternative (condition 6): CPO decision is to build the app, as simply as possible** (CPO, 2026-09-29: "Build the app as simply as possible"). The pilot uses the app, not a plain form.
   - **PM recommendation (not taken):** for n=1, run the pilot on a question bank drafted once with a general AI tool, reviewed, and delivered via plain Microsoft or Google Forms (Forms with Copilot is unavailable, no licence), with a manual follow-up. My view was that this tests every success criterion at near-zero build cost, and that a build pays off only at cohort scale.
   - **What this means for the build:** rollout must still be no harder than a form quiz. The app should aim at what a form can't do: drafting from uploaded material that a reviewer approves inside the tool; a single versioned question bank; per-topic gap tracking across retakes; and a low-score follow-up routed to a named owner. Anything beyond that is out of scope for the pilot. Success criterion 4 (effort no more than a manual quiz) is the check on this decision.

## Constraints carried to the PRD (conditions 4-8)
- **C4 Low-score action:** the PRD defines the follow-up and names its owner. No owner, no pilot.
- **C5 Consistency:** only canonical onboarding material is used. AI drafts, a named reviewer approves, and the bank is fixed per cohort with no per-attempt regeneration.
- **C6 Simplicity:** the app's rollout must be no harder than a form quiz (see Decision 2).
- **C7 Data use:** there is no works council (CPO), so co-determination gating is removed. HR/data-use clearance still applies and matters more at n=1, where results are fully identifiable. Before the student takes the quiz, agree with HR: who sees results, the purpose (development, not evaluation), how long results are kept, and what the student is told.
- **C8 Content owner:** a named person keeps the material and the bank current.

## Open questions for `/prd`
1. **Ownership (C4, C8):** who owns the low-score follow-up, and who owns and reviews the question bank? Not yet named. If no owner can be named, that is a `/checkpoint` trigger.
2. **Minimum build:** which of the four capabilities in Decision 2 are truly needed for one student, and which can stay manual in the pilot, so that the app stays no harder to roll out than a form?
3. **Records:** once the CPO and the product team have pulled the per-person error records, do they exist in usable form? If not, the pilot runs without an error comparison.
