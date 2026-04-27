# Resonance Platformization 2026-04-09

This request folder keeps the current Resonance and Carbonet separation work resumable.

Primary outcome:

- move from architecture agreement to implementation order without reopening boundary decisions each session

Primary references:

- `docs/architecture/carbonet-resonance-separation-status.md`
- `docs/architecture/carbonet-resonance-boundary-classification.md`
- `docs/architecture/builder-structure-wave-20260409-closure.md`
- `docs/architecture/common-project-reversible-transition-rules.md`
- `docs/architecture/platform-common-module-versioning.md`
- `docs/architecture/common-db-and-project-db-splitting.md`
- `docs/architecture/installable-builder-upgrade-roadmap.md`
- `docs/architecture/operations-platform-console-architecture.md`

Open these first:

- `session-plan.md`
- `current-worktree.md`
- `handoff-latest.md`
- `builder-structure-wave-closeout.md` when the request is about builder structure closure, source-of-truth, or old-path treatment
- `builder-resource-ownership-kickoff.md` when the request continues into builder resource ownership closure
- `builder-resource-ownership-current-closeout.md` when the request should resume from the current provisional resource-ownership state
- `docs/architecture/builder-resource-ownership-queue-map.md` immediately after the current closeout for the shortest row-by-row continuation view
- `builder-resource-ownership-partial-closeout-example.md` when the request needs a starter handoff note for the first resource-ownership rows

For `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`, treat these as the single live entry pair:

- `builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`

Use this as supporting maintenance-contract guidance only:

- `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`

Current active continuation target:

- row `5`
- `executable app resource assembly fallback`
- blocker-resolution state with row `5` as the remaining blocker
- `docs/architecture/builder-resource-row5-owner-packet.md`
- compressed blocker control docs:
  - `docs/architecture/builder-resource-blocker-source-sentence-matrix.md`
  - `docs/architecture/builder-resource-blocker-source-trigger-matrix.md`
- canonical partial phrase:
  - `PARTIAL_DONE: builder resource ownership closure now carries bounded DELETE_NOW notes on rows 1 and 2, stronger non-blocker notes on rows 3 and 4, and row 5 remains the only BLOCKS_CLOSEOUT fallback blocker on the current docs set.`

Remaining docs-only valid work for row `5` is only:

- whether a watched source doc changed
- whether that changed source adds the exact missing sentence bundle

If blocker count, active row, next review target, or partial-closeout wording changes, update both entry-pair docs in the same turn.
