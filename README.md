<!-- product-dev-pipeline:product-readme
     Instantiated by the Product Manager at /kickoff, rewritten by the Launch
     Coordinator at /ship. -->

# Onboarding Knowledge Check (working title)

An internal tool that gives newly joining working students short multiple-choice knowledge checks built only from the company's own onboarding material. It scores results by topic, flags weak topics to a named person for follow-up, and compares a retake against the first attempt.

**Status: in development.** Nothing runs yet. The requirements for a first pilot with a single working student have been drafted and are awaiting approval. The pilot runs for 90 days from the student's first quiz.

## Who it's for

Working students (part-time student employees) who are new to the company and going through onboarding. It also serves the people around them:

- the person who maintains the question bank
- a subject-matter expert who checks every question for correctness
- the student's manager, who follows up when a topic scores low

## What it does

All planned, none built yet:

- Planned: quiz questions drafted with AI from uploaded onboarding material, each linked to its source passage. A named reviewer approves every question before anyone sees it.
- Planned: a fixed, versioned question set with two forms: one for the first attempt, one for the retake. Everyone is measured against the same approved questions.
- Planned: scores per topic, with the correct answers shown after the quiz.
- Planned: any topic below the threshold is flagged to the student's manager, who records the follow-up they gave.
- Planned: a retake after the follow-up, shown side by side with the first attempt.

## Getting started

Not yet runnable. Setup and usage instructions will be added when the pilot is released.

## Limitations

- The first pilot involves one working student. It tests whether the quiz-and-follow-up process works, not whether it reduces errors across the company.
- Content comes only from internal onboarding material. Web articles and other outside sources are excluded.
- Results are for development only, not performance evaluation. Who can see them, and how long they are kept, will be agreed with HR and explained to the participant before any real results are collected.

---

Planning and specification documents live in [`docs/`](docs/). They are written
for the team building this product, not for people using it, and they are not a
substitute for the sections above.

<!-- At /ship, delete the docs/ pointer above: the shipped README is written for
     the end user, and internal artifacts are not part of their path. -->
