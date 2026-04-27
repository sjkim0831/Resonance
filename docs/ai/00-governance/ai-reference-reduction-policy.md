# AI Reference Reduction Policy

This file defines which skills and docs are default references, conditional references, and non-default references for token-efficient work.

Use this together with:

- `docs/ai/00-governance/ai-skill-doc-routing-matrix.md`
- `docs/ai/00-governance/ai-orchestration-doc-retention-inventory.md`

## Classes

### A. Default references

Safe to use as first-line guidance when directly relevant:

- `docs/ai/00-governance/ai-skill-doc-routing-matrix.md`
- `.codex/skills/*/SKILL.md` for the selected primary skill
- `docs/operations/codex-token-optimization-guide.md`
- `docs/ai/00-governance/ai-session-partitioning.md` when ownership or multi-file conflict risk exists
- `docs/operations/fast-bootstrap-runtime-freshness.md` when runtime freshness is part of the task
- `AGENTS.md` when local runtime verification rules matter

### B. Conditional references

Open only when the routing matrix points there or the task explicitly requires them:

- `README.md`
- `STRUCTURE.md`
- `docs/ai/README.md`
- `docs/ai/10-architecture/**`
- `docs/architecture/**`
- `docs/ai/20-ui/**`
- `docs/ai/40-backend/**`
- `docs/ai/50-data/**`
- `docs/ai/60-operations/README`-style workflow docs
- `/home/imaneya/workspace/화면설계/**`

### C. Non-default references

Do not open during normal work unless a live-entry file or explicit user request points there:

- `docs/ai/60-operations/session-orchestration/active/**`
- `docs/ai/60-operations/session-orchestration/archive/**`
- `docs/ai/60-operations/session-orchestration/**/*example.md`
- row-specific builder blocker docs
- decision note templates
- historical handoff prompts
- long architecture deep-dive chains unrelated to the exact task

## Current Keep / Archive / Delete Guidance

This section is for framework-level triage. It does not delete files by itself.

### Keep as live routing docs

- `docs/ai/00-governance/ai-skill-doc-routing-matrix.md`
- `docs/ai/00-governance/ai-reference-reduction-policy.md`
- `docs/ai/00-governance/ai-session-partitioning.md`
- `docs/ai/00-governance/ai-orchestration-doc-retention-inventory.md`
- `docs/operations/codex-token-optimization-guide.md`
- `docs/ai/80-skills/skill-index.md`
- `.codex/skills/carbonet-ai-session-orchestrator/SKILL.md`
- `docs/ai/60-operations/session-orchestration/README.md`
- `docs/architecture/high-parallel-account-orchestration-playbook.md`
- `docs/operations/account-relogin-continuity-playbook.md`

### Keep but downgrade to conditional guidance

- `README.md`
- `STRUCTURE.md`
- `docs/ai/README.md`
- `docs/ai/00-governance/ai-fast-path.md`
- `docs/ai/80-skills/when-to-use-each-skill.md`
- `docs/ai/80-skills/skill-boundaries.md`
- `docs/architecture/tmux-multi-account-delivery-playbook.md`

### Stop using as default references

- `docs/ai/60-operations/session-orchestration/active/**`
- `docs/ai/60-operations/session-orchestration/archive/**`
- `docs/ai/60-operations/performance-handoff-prompt-20260318.md`
- `docs/ai/80-skills/resonance-10-session-assignment.md`
- builder row `*-example.md` files

## Latest-First Preservation Rule

Deletion is not based on age alone.

Keep the newest document that is actually the current live entry, active continuation source, or referenced routing document.

Delete or archive only the older material that is both:

1. no longer the active or latest governed source for that family
2. no longer referenced by a live-entry doc, routing doc, current skill, or operator playbook

If the latest document is active but older-looking support docs still exist, preserve the latest live doc and classify the others as:

- `CONDITIONAL`
- `EXAMPLE_ONLY`
- `ARCHIVE`
- delete candidate after reference cleanup

## Active Orchestration Preservation Rule

Do not delete these while their family is still active:

- current `active/ACTIVE_INDEX.md`
- the latest request folder under `docs/ai/60-operations/session-orchestration/active/` for an unfinished initiative
- the current `session-plan.md`
- the current `current-worktree.md`
- the current `handoff-latest.md`
- any declared live-entry pair or live-entry doc referenced by routing guidance

This protection also applies when the reason for resume is token expiry, provider reset, or forced re-login.

### Archive-candidate families

These should be reviewed for archive or stronger labeling when they are no longer live:

- stale `handoff` docs under active coordination folders
- builder row example docs that only demonstrate wording patterns
- superseded prompt starter docs when their rules are absorbed into routing docs

### Delete-candidate families

Delete only after confirming they are not referenced by active live-entry docs or current operator playbooks:

- duplicate wording-only example docs that no longer add unique decision logic
- obsolete route-prompt starters fully replaced by routing matrix plus live-entry docs
- task-family prompts tied to completed work that no longer have an active owner

## Labeling Rule

Future docs in AI governance and orchestration areas should declare one of these labels near the top:

- `Status: LIVE_ENTRY`
- `Status: CONDITIONAL`
- `Status: EXAMPLE_ONLY`
- `Status: ARCHIVE`

At minimum, active continuation docs and example docs should be distinguishable without opening both.

## Removal Workflow

Before deleting or archiving a skill/doc family:

1. verify no current live-entry file depends on it
2. verify `rg` references are either gone or can be updated in the same turn
3. verify the latest governed doc for that family is still kept
4. move to archive first if the content still has operator history value
5. update `docs/ai/00-governance/ai-skill-doc-routing-matrix.md`
6. update `docs/ai/80-skills/skill-index.md`
