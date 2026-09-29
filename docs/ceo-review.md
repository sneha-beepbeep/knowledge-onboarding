# CEO Review

## Stage 1: `/ceo-review` (2026-09-29)

### Raw idea as given

> "AI-generated quizzes from uploaded class notes and web background articles, with scoring, saved results and retakes for students within the context of education / study tools"

Earlier description from the CPO: an educational app for students to test them on new concepts learned. The user uploads class notes with definitions of concepts. The app creates quiz questions from the notes plus background articles from the web to test critical understanding, with scoring and the ability to save and retake quizzes.

### Framing challenge

The pitch fit the required shape only nominally. "Students" and "education / study tools" were categories, not a specific user and bounded domain. The idea slot was mostly table-stakes features (scoring, saving, retakes). I sent it back for restatement.

**CPO's restatement (round 1):** "This is an internal tool for working students at our company, designed to test they are being onboarded correctly and have the same level of knowledge. It is solving the problem of uneven knowledge when onboarding them to work at the company."

**Scoped pitch (working version, reflected back by CEO; the CPO did not explicitly confirm the wording):**

> "AI-generated knowledge-check quizzes, scored and saved, built from onboarding material, for working students newly joining our company within the context of internal employee onboarding."

This reframe changes the case fundamentally. It is no longer a consumer study app competing with NotebookLM, ChatGPT and Quizlet. It is an internal tool where the company is the buyer and the problem is a measurable operational cost. The original consumer framing would have faced a crowded, free-alternative market with weak willingness to pay. This review does not assess that version.

### Key questions asked and CPO answers (summarized)

Round 1 (consumer framing, superseded by the restatement): competitors and switching, whether the web articles are an advantage or a liability, current student behaviour, who pays, who loses if we don't build, question correctness, and a 90-day kill signal. The CPO's reply was the reframe above rather than point-by-point answers.

Round 2 (internal-onboarding framing):

| # | Question | CPO answer (summarized) |
|---|----------|-------------------------|
| 1 | What evidence shows uneven knowledge is a problem, and what does it cost? | Concrete evidence of errors and rework, costing roughly **1 million per year**. Headcount of working students not given. |
| 2 | Is a quiz the fix or just a measurement? What happens on a low score? | Not answered. |
| 3 | Why AI generation and web articles instead of a curated, consistent question bank? | Not answered. |
| 4 | Why build versus existing options (LMS/HR quiz, Forms, a one-off AI-generated and reviewed bank, manager checklist)? Who maintains it? | LMS and HR quiz tools have **proven too complicated to implement**. Forms, a one-off bank, a checklist and maintenance ownership not addressed. |
| 5 | How do employees experience it? HR, works council and data use? | Not answered. |
| 6 | What is the 90-day kill signal, and what does this displace? | Implicit only: "build a simple test app to test with the students and **see if it improves results**." |

### Assessment

**What makes the case strong:**

- **A real, costed problem.** Roughly 1M/year in errors and rework is a large number for an internal tool. Even a modest reduction pays for a simple app many times over. This is the single strongest fact in the review.
- **The buyer and user are captive and clear.** There is no go-to-market risk, no willingness-to-pay question and no consumer competitor.
- **The CPO frames this as a pilot, which is the right size for the bet.** "A simple test app to test with the students" limits the downside.
- **An existing alternative has been tried and failed.** LMS/HR quiz tooling was attempted and rejected, so this is not a build-for-its-own-sake project.

**What makes the case weak or unproven:**

- **Attribution of the 1M.** It is not established how much of the error/rework cost comes from uneven onboarding knowledge, as opposed to process, tooling or supervision. That determines the realistic upside of a quiz.
- **A quiz measures the gap; it does not close it.** Without a defined response to a low score (targeted re-training, buddy follow-up, manager sign-off), the tool produces data and not better results.
- **The AI-plus-web-articles part of the original idea now works against the goal.** "Same level of knowledge" needs consistent, company-correct questions. Questions that vary each time and web content that may contradict internal practice undermine comparability and correctness. The idea's original differentiator is the part most likely to be a liability here.
- **The simplest alternatives were not ruled out.** "LMS too complicated" does not rule out a Forms quiz or a reviewed, one-off AI-generated question bank. The build has to beat that bar, not just the LMS.
- **Employee-data and co-determination risk is unexamined.** Scored, saved, per-person results are performance data. If working students are Werkstudenten in Germany, the works council has co-determination rights over technical systems suited to monitoring performance.

None of the unanswered points is a blocker at the idea stage. Each can be turned into a concrete condition for the pilot, and the scale of the problem justifies a cheap, bounded test. They are not optional, though. If they aren't resolved, the pilot will likely "work" technically and change nothing.

### Verdict: **Pursue with caveats**

Pursue this as a **time-boxed, deliberately simple internal pilot** against a costed operational problem, not as a product platform. Proceed on these conditions. Stage 2 (`/kickoff`) must turn conditions 1 to 3 into concrete requirements before the PRD, and downstream stages must meet the rest.

1. **Confirm the scoped pitch** (the wording above, including whether "working students" means part-time student employees or all new hires). **Size the pilot**: number of working students and the number of new joiners per cohort.
2. **Baseline and kill signal.** Before launch, establish a baseline for the error/rework metric (or a proxy the pilot group can move, such as errors per new joiner in the first N weeks). Define success and failure thresholds. Suggested kill signal at roughly 90 days: no measurable improvement in that metric for the pilot cohort versus baseline or a comparison group, **or** managers not acting on results. "See if it improves results" is not yet a measurable criterion.
3. **Attribution.** Estimate what share of the ~1M comes from onboarding knowledge gaps, so the upside of this pilot is realistic.
4. **Define the action on a low score.** The pilot must include what happens after a failed or weak result, and who owns it. Otherwise it only measures.
5. **Accuracy and consistency over novelty.** Questions come from the company's own canonical onboarding material, and a named person reviews them before use. AI may draft questions, but a reviewed, consistent bank is the default. **Web background articles are out of scope for the pilot** unless the kickoff makes a specific case for them, because they conflict with the "same level of knowledge" goal.
6. **Beat the simplest alternative.** The kickoff must say why a Forms quiz, or a reviewed question bank generated once, does not meet the need. The build should be no more complex to roll out than that.
7. **HR and works council clearance before real employee results are collected.** Define who can see results, what they may be used for (development, not evaluation, unless agreed), how long they are kept, and consent or notice. If the works council applies, involve it before the pilot goes live.
8. **Named content owner.** Someone owns keeping the onboarding material and question bank up to date after launch.

**What would change this verdict:** if the attribution work shows only a small share of the ~1M comes from onboarding knowledge, if no one can own the response to low scores, or if a Forms quiz or reviewed question bank turns out to be enough, then run `/checkpoint`. The likely outcome would be to reshape the approach or not build.
