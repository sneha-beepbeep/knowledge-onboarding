---
description: Prepare release notes and rollout/rollback checklist and ship
---

Confirm `docs/test-report.md` exists and reflects a ship-worthy state. If it's missing, or QA's recommendation was negative and hasn't been resolved, stop and tell the CPO to resolve /test first.

Otherwise, delegate to the `launch-coordinator` subagent to run the /ship stage, producing `docs/release-notes.md` and a rollout/rollback checklist.

Once complete, mark the pipeline as shipped in CLAUDE.md's "Current status" section and close out the decision log for this cycle.
