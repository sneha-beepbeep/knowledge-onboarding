---
description: Kick off product scoping with the Product Manager agent, once the CEO has cleared the idea
---

Confirm `docs/ceo-review.md` exists and its verdict is not "Do not pursue." If it's missing, stop and tell the CPO to run `/ceo-review "<idea>"` first.

Also check the root `README.md`. If it is missing, or contains the marker `product-dev-pipeline:self`, it is the pipeline's own README sitting in a product repo — the subagent must replace it from `.claude/templates/README.product.md` as part of this stage.

Otherwise, delegate to the `product-manager` subagent to run the /kickoff stage, using the idea and reasoning captured in `docs/ceo-review.md`. The subagent should produce `docs/opportunity-brief.md`. When done, summarize the brief for the CPO and explicitly ask for approval before anything else runs. Update the "Current status" section in CLAUDE.md once approved.
