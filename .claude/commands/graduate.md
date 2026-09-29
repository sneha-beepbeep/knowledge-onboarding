---
description: Split a shipped product's repo from the pipeline scaffolding that built it
---

Confirm `docs/release-notes.md` exists — i.e. `/ship` has completed. If not, stop and tell the CPO to resolve `/ship` first.

This stage is repo reorganization, not craft: do it directly rather than delegating to a subagent (the same exception CLAUDE.md already makes for updating its own "Current status"). Describe the plan below to the CPO and get explicit confirmation before touching anything — it restructures the repo and should never run silently:

1. Move everything currently in `docs/` to `docs/archive/<today's date>-shipped/`, preserving it as this cycle's audit trail, and leave `docs/` empty and ready for a future cycle.
2. Move `.claude/agents/`, `.claude/commands/` and `.claude/templates/` to `.claude/pipeline-archive/` — dormant, not deleted, so a future v2 cycle on this same product can reactivate the pipeline without re-copying it from `pipeline-template`.
3. Write `.claude/pipeline-archive/README.md` from `.claude/templates/pipeline-archive-note.md`, filled in — it tells anyone who opens that folder later, including an external reviewer, what it is and that it isn't shipped or runtime code.
4. Replace the root `CLAUDE.md` with `.claude/templates/CLAUDE.graduated.md`, filled in — a short provenance note instead of live orchestrator state.

After the move, remind the CPO of the things that are easy to get wrong doing this by hand: the repo's visibility should match intent, its GitHub description should describe the product (not the pipeline), and its name shouldn't collide with `pipeline-template` or other repos.
