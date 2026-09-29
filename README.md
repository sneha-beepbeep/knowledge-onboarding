<!-- product-dev-pipeline:product-readme
     Instantiated by the Product Manager at /kickoff, rewritten by the Launch
     Coordinator at /ship. -->

# Onboarding Knowledge Check (working title)

An internal tool that gives newly joining working students short multiple-choice knowledge checks built only from the company's own onboarding material. It scores results by topic, flags weak topics to a named person for follow-up, and compares a retake against the first attempt.

**Status: built, in testing.** The app has been built and is being tested before a first pilot with a single working student. It is not yet in use with real results. The pilot runs for 90 days from the student's first quiz.

## Who it's for

Working students (part-time student employees) who are new to the company and going through onboarding. It also serves the people around them:

- the person who maintains the question bank
- a subject-matter expert who checks every question for correctness
- the student's manager, who follows up when a topic scores low

## What it does

- Quiz questions are written from uploaded onboarding material, and each is linked to the passage it comes from. A named reviewer approves every question before anyone sees it. In the first pilot, the questions are written by a person, not by AI.
- A fixed question set with two forms: one for the first attempt, one for the retake. Everyone is measured against the same approved questions.
- Scores per topic, with the correct answers shown after the quiz.
- Any topic below the threshold is flagged to the student's manager, who records the follow-up they gave.
- A retake after the follow-up, shown side by side with the first attempt.

## Getting started

Not yet available to use. Setup and usage instructions will be added when the pilot is released.

## Limitations

- The first pilot involves one working student. It tests whether the quiz-and-follow-up process works, not whether it reduces errors across the company.
- Content comes only from internal onboarding material. Web articles and other outside sources are excluded.
- The first pilot does not use AI. Nothing is sent to an AI service.
- Results are for development only, not performance evaluation. Who can see them, and how long they are kept, will be agreed with HR and explained to the participant before any real results are collected.

---

Planning and specification documents live in [`docs/`](docs/). They are written
for the team building this product, not for people using it, and they are not a
substitute for the sections above.

<!-- At /ship, delete the docs/ pointer above: the shipped README is written for
     the end user, and internal artifacts are not part of their path. -->
