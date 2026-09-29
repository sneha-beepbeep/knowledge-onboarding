---
description: Re-check business viability at any gate against what's been learned since day one
argument-hint: [reason for the checkpoint]
---

This can run at any point after `/ceo-review`, whether or not the current stage failed — it answers a different question than "request changes" or "loop back." Those are about whether the current artifact is right; `/checkpoint` is about whether the business case still holds.

Delegate to the `ceo` subagent to run a /checkpoint review: $ARGUMENTS. Tell it which stage the pipeline is currently at (from CLAUDE.md's "Current status") so it's reasoning from the full picture, not just the stated reason.

The subagent appends a new dated, stage-tagged entry to `docs/ceo-review.md` (never overwriting the original) with one of three verdicts: **Continue**, **Reshape (resume at stage N)**, or **Abandon**. Summarize the verdict and reasoning for the CPO, then handle it:

- **Continue** — no state change beyond the decision log entry. The CPO resumes wherever they left off.
- **Reshape** — set "Current status" in CLAUDE.md back to stage N. The next time that stage's command runs, pass it the checkpoint's reasoning plus every downstream artifact that exists (the ones built on what's now being reshaped) as explicit context, so the redone artifact carries forward what was learned instead of starting cold.
- **Abandon** — set "Current status" to `Abandoned (stage N, <date>)` rather than resetting to "not started," so the history survives. Ask the CPO what should happen to the repo: archive it, leave it as-is, or start a different idea (a fresh `/ceo-review` here, or in a new repo spun up from `pipeline-template`).
