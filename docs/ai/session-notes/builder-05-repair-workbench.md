# builder-05-repair-workbench

- Role: compare and repair workbench
- Allowed Paths: repair workbench page, current runtime compare page, resonance control plane api
- Forbidden Paths: editor canvas, environment-management, backend builder persistence

## Findings

- `frontend/src/features/screen-builder/RepairWorkbenchMigrationPage.tsx` already models the post-publish compare and repair flow between generated builder output and current runtime state.
- The workbench loads both published preview and current draft/generated preview, then uses compare keys such as `guidedStateId`, `templateLineId`, `screenFamilyRuleId`, `ownerLane`, `selectedScreenId`, and `releaseUnitId`.
- `frontend/src/lib/api/resonanceControlPlane.ts` already exposes the expected control-plane calls for parity compare, opening a repair session, and applying a repair session.
- The workbench already constructs deploy evidence and release-unit aware metadata, which aligns directly with the operations-owned artifact handoff model rather than a page-only preview model.
- This surface appears to be the operational bridge from builder publish output into parity verification and guided repair, not part of the authoring UI itself.

## Compare And Repair Gaps

- Need to confirm whether `releaseUnitId` is authoritative enough for runtime handoff or still derived too loosely from page/version identity.
- Need to confirm whether compare targets and repair candidates are fully sourced from published artifact metadata or still partially inferred in the frontend.
- Need to confirm how repair results flow back into regenerated artifacts versus temporary runtime patch targets.

## Candidate Files

- `frontend/src/features/screen-builder/RepairWorkbenchMigrationPage.tsx`
- `frontend/src/features/screen-builder/CurrentRuntimeCompareMigrationPage.tsx`
- `frontend/src/lib/api/resonanceControlPlane.ts`
- `frontend/src/features/screen-builder/shared/screenBuilderUtils.ts`

## Next Action

- Trace the control-plane contract for parity compare and repair apply so the release-unit and runtime-target ownership model can be made explicit before implementation changes.
