<!-- Filled in by /graduate. Replace <placeholders>; this becomes
     .claude/pipeline-archive/README.md in the graduated repo. -->

# Pipeline archive

This folder holds the tooling that built this product — the agent definitions
and slash commands from `pipeline-template`, moved here (not deleted) when the
product graduated on <date>. Nothing in it is imported, executed, or built
into any release artifact: treat it as inert dev-tooling config, the way
you'd treat `.github/` or `.vscode/`.

## Reactivating it

To run another development cycle on this product:

1. Move `agents/`, `commands/` and `templates/` back up to `.claude/`.
2. Restore a live `CLAUDE.md` — either roll back the current one in git
   history to before `/graduate` ran, or start from `pipeline-template`'s
   empty-pipeline state and reset "Current status".
3. Run `/prd` directly if you're scoping a new version of this same product,
   or `/ceo-review` if it's a genuinely different idea (in which case, use a
   fresh repo spun up from `pipeline-template` instead of this one).

This cycle's planning and QA artifacts are preserved in
`docs/archive/<date>-shipped/`.
