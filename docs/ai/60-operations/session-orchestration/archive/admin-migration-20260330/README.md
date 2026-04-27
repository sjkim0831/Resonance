# Admin Migration Active Plan

- `requestId`: `admin-migration-20260330`
- `title`: admin React migration, observability backend, and runtime packaging continuity
- `status`: active
- `lastReconciled`: `2026-03-30`

## Why This Folder Exists

This request already has real in-progress files in the working tree. A new login must reopen this folder before starting more edits so it does not duplicate route, controller, mapper, or generated-asset ownership.

## Open First

1. `bash ops/scripts/codex-resume-status.sh`
2. `bash ops/scripts/codex-admin-status.sh`
3. `../ACTIVE_INDEX.md`
4. `/opt/Resonance/docs/operations/admin-screen-implementation-status.md`
5. `session-plan.md`
6. `current-worktree.md`
7. `handoff-latest.md`
8. `git status --short`

## Shared File Warning

These files are shared-contract risk and should not be edited from multiple lanes at once:

- `frontend/src/app/routes/definitions.ts`
- `frontend/src/app/routes/pageRegistry.tsx`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/navigation/runtime.ts`
- `src/main/java/egovframework/com/common/util/ReactPageUrlMapper.java`
- `src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`
- `ops/scripts/start-18000.sh`

## Runtime Warning

`src/main/resources/static/react-app/**` is generated output. Rebuild and verification should own those files, not feature lanes.
