# Session Orchestration Workspace

Use this folder for AI session planning artifacts before and during implementation.

Purpose:

- keep session split decisions in one predictable location
- make coordinator output reusable by implementation sessions
- reduce ambiguity around allowed paths, forbidden paths, and handoff order

## Standard Files

- `session-plan-template.md`
  - top-level split plan for one request
- `session-contract-template.md`
  - per-session work contract
- `session-handoff-template.md`
  - session-to-session handoff note
- `active/`
  - working area for in-progress coordinated requests
- `archive/`
  - completed session-planning artifacts worth keeping

## Re-Login Rule

When a fresh login or new account must continue existing work:

1. run `bash ops/scripts/codex-resume-status.sh`
2. open `active/ACTIVE_INDEX.md`
3. open `active/` first
4. reopen the most recent request folder
5. compare it with `git status --short`
6. continue the same lane if the file family is already owned
7. update the latest handoff note before stopping again

Use [`/opt/Resonance/docs/operations/account-relogin-continuity-playbook.md`](/opt/Resonance/docs/operations/account-relogin-continuity-playbook.md) for the detailed checklist.

## Usage Rule

For any non-trivial request, start from `session-plan-template.md`.

If the work remains isolated after classification, the same plan may conclude with a single implementation session.

## Storage Rule

- use one subfolder per coordinated request when the work is large enough to need durable artifacts
- keep completed examples under `docs/ai/70-reference/sample-change-specs/`
- do not scatter temporary session notes across the repository root
- if the work is still active, keep a `current-worktree.md` snapshot in that request folder
