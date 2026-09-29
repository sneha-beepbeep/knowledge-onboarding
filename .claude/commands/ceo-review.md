---
description: Challenge whether a raw idea is worth pursuing, before any product work begins
argument-hint: <idea> for <user> within the context of <domain>
---

Delegate to the `ceo` subagent to run the /ceo-review stage for this idea: $ARGUMENTS

This is the first stage of the pipeline — nothing else has run yet. It's an interactive challenge session with the CPO, not a one-shot report: let the ceo subagent ask its questions directly and iterate on the CPO's answers before concluding. The idea must be phrased as "\<idea\> for \<user\> within the context of \<domain\>" (e.g. "a note-taking app for professional writers within the context of novel writing") — if it isn't, the subagent challenges the framing and asks for a rephrase before opening the strategic questions. It should produce `docs/ceo-review.md` with a final verdict (Pursue / Pursue with caveats / Do not pursue).

If the verdict is "Do not pursue," tell the CPO clearly that the pipeline stops here unless they explicitly choose to override and run `/kickoff` anyway.

Update CLAUDE.md's decision log with the verdict and set "Current status" to reflect this stage.
