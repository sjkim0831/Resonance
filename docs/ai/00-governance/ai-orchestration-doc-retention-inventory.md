# AI Orchestration Doc Retention Inventory

Status: LIVE_ENTRY

Use this inventory before archiving or deleting orchestration-related docs.

This file classifies the current orchestration doc families into:

- `LIVE`
- `CONDITIONAL`
- `ARCHIVE_CANDIDATE`
- `DELETE_CANDIDATE_AFTER_REFERENCE_CLEANUP`

It is intentionally conservative.

If a family is still widely referenced, it stays `LIVE` or `CONDITIONAL` even if it looks old.

## Decision Standard

Use this order:

1. keep the current live routing docs
2. keep the current active-lane continuity docs
3. keep documents still referenced by operator playbooks or implementation handoff maps
4. archive wording-only examples only after live references are gone
5. delete only after reference cleanup is complete

## Family Classification

### 1. Global routing and continuity

Status: `LIVE`

Keep:

- `docs/ai/00-governance/ai-skill-doc-routing-matrix.md`
- `docs/ai/00-governance/ai-reference-reduction-policy.md`
- `docs/ai/00-governance/ai-orchestration-doc-retention-inventory.md`
- `docs/architecture/high-parallel-account-orchestration-playbook.md`
- `docs/operations/account-relogin-continuity-playbook.md`
- `.codex/skills/carbonet-ai-session-orchestrator/SKILL.md`

Reason:

- these are now the primary routing, retention, high-parallel, and expiry-continuity entry docs

### 2. Session orchestration workspace root

Status: `LIVE`

Keep:

- `docs/ai/60-operations/session-orchestration/README.md`
- `docs/ai/60-operations/session-orchestration/active/ACTIVE_INDEX.md`
- `docs/ai/60-operations/session-orchestration/active/README.md`
- `docs/ai/60-operations/session-orchestration/session-plan-template.md`
- `docs/ai/60-operations/session-orchestration/session-contract-template.md`
- `docs/ai/60-operations/session-orchestration/session-handoff-template.md`

Reason:

- these define the durable resume and handoff structure

### 3. Current active request docs

Status: `LIVE`

Keep while unfinished:

- `docs/ai/60-operations/session-orchestration/active/admin-migration-20260330/README.md`
- `docs/ai/60-operations/session-orchestration/active/admin-migration-20260330/session-plan.md`
- `docs/ai/60-operations/session-orchestration/active/admin-migration-20260330/current-worktree.md`
- `docs/ai/60-operations/session-orchestration/active/admin-migration-20260330/handoff-latest.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/README.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/session-plan.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/current-worktree.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/handoff-latest.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`

Reason:

- these are current continuity artifacts and must survive re-login and token expiry

### 4. Builder active support docs

Status: `CONDITIONAL`

Keep for now:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-structure-wave-closeout.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-kickoff.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-closeout-template.md`

Reason:

- they are not the primary live-entry doc, but they may still be useful support material for the active family

Action before downgrade or archive:

- verify no active README, handoff, or queue-map still routes through them

### 5. Builder row example docs under active continuation

Status: `ARCHIVE_CANDIDATE`

Candidates:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-app-packaging-partial-closeout-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-executable-app-partial-closeout-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-observability-partial-closeout-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-partial-closeout-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-row1-blocker-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-row1-delete-now-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-row2-blocker-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-row3-blocker-example.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-row5-blocker-example.md`

Reason:

- these are example or wording-pattern docs, not the primary active continuation entry

Blockers to archive:

- verify no current live-entry doc still points to a specific example as the next required step

### 6. Numbered lane assignment and tmux playbooks

Status: `CONDITIONAL`

Keep for now:

- `docs/ai/80-skills/resonance-10-session-assignment.md`
- `docs/architecture/tmux-multi-account-delivery-playbook.md`

Reason:

- both are still referenced widely by operator and handoff docs
- they are no longer the first routing gate, but they are not safe delete candidates yet

### 7. Lane start and prompt documents

Status: `CONDITIONAL`

Keep for now:

- `docs/architecture/lane-start-instructions-05-06-08-09.md`
- `docs/architecture/lane-start-instructions-07-10-04-03-02.md`
- `docs/architecture/implementation-lane-prompt-starters.md`
- `docs/architecture/implementation-lane-short-prompts.md`
- `docs/architecture/implementation-lane-short-prompts-ko.md`
- `docs/architecture/implementation-lane-status-template.md`
- `docs/architecture/implementation-lane-handoff-receipt-template.md`
- `docs/architecture/implementation-lane-completion-template.md`

Reason:

- these still appear in multiple lane and operator docs

Future direction:

- consolidate into fewer operator-facing references
- then downgrade to archive or delete candidates

### 8. Archive root

Status: `CONDITIONAL`

Keep:

- `docs/ai/60-operations/session-orchestration/archive/README.md`

Reason:

- the archive location itself remains part of the retention workflow even though archive contents are not default references

## Current No-Delete List

Do not delete now:

- `ACTIVE_INDEX.md`
- any current `session-plan.md`
- any current `current-worktree.md`
- any current `handoff-latest.md`
- `builder-resource-ownership-current-closeout.md`
- `high-parallel-account-orchestration-playbook.md`
- `account-relogin-continuity-playbook.md`
- `resonance-10-session-assignment.md`
- `tmux-multi-account-delivery-playbook.md`
- `lane-start-instructions-*`
- `implementation-lane-*`

## First Safe Cleanup Wave

Safe first wave should focus on labeling and reference reduction, not deletion.

Recommended sequence:

1. add status labels to example docs and active support docs
2. update docs that still point to `resonance-10-session-assignment.md` as the first routing source
3. reduce operator docs that point to both tmux and numbered-session docs when only one is needed
4. move clearly unused example docs to archive only after references are removed
5. delete only the families that reach zero live references

## Next Review Targets

Highest-value next targets for reference cleanup:

1. `docs/ai/80-skills/resonance-10-session-assignment.md`
2. `docs/architecture/implementation-lane-prompt-starters.md`
3. `docs/architecture/lane-start-instructions-05-06-08-09.md`
4. `docs/architecture/lane-start-instructions-07-10-04-03-02.md`
5. builder row `*-example.md` docs under the active continuation folder
