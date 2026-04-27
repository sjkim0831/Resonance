# Active Session Index

Last updated: `2026-04-09`

## Resume Order

1. run `bash ops/scripts/codex-resume-status.sh`
2. run `bash ops/scripts/codex-admin-status.sh`
3. open the request folder listed below
4. stay inside that request's `allowedPaths`
5. update `handoff-latest.md` before stopping

## Active Requests

### `resonance-platformization-20260409`

- path: `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409`
- purpose: keep Resonance control-plane separation, common-vs-project boundary work, builder operationalization, and artifact-first deploy governance resumable as one coordinated track
- status docs:
  - `docs/architecture/carbonet-resonance-separation-status.md`
  - `docs/architecture/carbonet-resonance-boundary-classification.md`
  - `docs/architecture/installable-builder-upgrade-roadmap.md`
- current shared-file owner groups:
  - Session A: coordinator, shared boundary docs, and control-plane contract decisions
  - Session B: backend control-plane composition split under `src/main/java/egovframework/com/feature/admin/**` and `src/main/java/egovframework/com/platform/**`
  - Session C: frontend route/platform split and control-plane screens
  - Session D: deploy/version governance, runtime package evidence, and verification docs
- first files to open:
  - `session-plan.md`
  - `current-worktree.md`
  - `handoff-latest.md`
- do not duplicate:
  - `frontend/src/app/routes/**`
  - `frontend/src/lib/api/**`
  - `src/main/java/egovframework/com/feature/admin/**`
  - `src/main/java/egovframework/com/platform/**`
  - `src/main/resources/egovframework/mapper/com/platform/**`
  - `src/main/resources/static/react-app/**`

## Index Rule

- add one section per active coordinated request
- remove or archive the section when the request is finished
- keep this file short enough to act as the first resume screen
