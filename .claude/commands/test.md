---
description: Run QA against the implementation and file a test report
---

Delegate to the `qa` subagent to run the /test stage against the current implementation, using `docs/prd.md` and `docs/design-spec.md` as the standard to test against. It should produce `docs/test-report.md`.

Summarize the test report for the CPO, including the ship/no-ship recommendation. If there are failures, ask the CPO whether to loop back to `/build`, proceed anyway, or — if the failures suggest something more fundamental than a fixable bug — run `/checkpoint` to re-test whether the business case still holds. Update CLAUDE.md.
