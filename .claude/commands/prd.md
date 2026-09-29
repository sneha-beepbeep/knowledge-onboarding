---
description: Expand the approved opportunity brief into a full PRD
---

Confirm `docs/opportunity-brief.md` exists and was approved by the CPO (check CLAUDE.md's decision log). If not, stop and say so.

Otherwise, delegate to the `product-manager` subagent to run the /prd stage, producing `docs/prd.md`. Summarize it for the CPO and ask for explicit approval before proceeding. Update CLAUDE.md once approved.
