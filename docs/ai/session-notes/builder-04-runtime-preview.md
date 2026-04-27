# builder-04-runtime-preview

- Role: published runtime preview
- Allowed Paths: frontend runtime preview page and shared preview renderer/api helpers
- Forbidden Paths: builder editor internals, repair workbench, backend mutation code

## Findings

- `frontend/src/features/screen-builder/ScreenRuntimeMigrationPage.tsx` is already positioned as a read-only published runtime surface for the latest builder snapshot.
- The page explicitly distinguishes published runtime from draft-only builder state and links back to both environment-management and the builder authoring page.
- The runtime surface already exposes the data points needed for an artifact-consuming system view: `menuCode`, `pageId`, `publishedVersionId`, publish timestamp, version history, node count, event count, and registry linkage issues.
- The page computes and surfaces registry gaps such as unregistered, missing, and deprecated nodes, which is critical for deciding whether a published artifact is safe to hand off to compare/repair flows or runtime consumers.
- The preview renderer under `frontend/src/features/screen-builder/shared/screenBuilderPreview.tsx` already provides deterministic rendering for approved node types and visibly falls back on unknown types instead of hiding them.

## Runtime Evidence

- Published version id is already shown as a first-class runtime identity.
- Recent builder audit events are already surfaced on the page, which helps connect published output back to builder activity.
- Runtime binding keys such as guided state, template line, screen family rule, owner lane, and authority scope are already represented in the page model.
- Registry gap counts already act as a publish-safety and handoff-safety indicator.
- `releaseUnitId` and artifact handoff evidence are now exposed in the page/preview payload and surfaced on the runtime page so the `carbonet-ops -> carbonet-general` boundary is visible in the UI.

## Candidate Files

- `frontend/src/features/screen-builder/ScreenRuntimeMigrationPage.tsx`
- `frontend/src/features/screen-builder/shared/screenBuilderPreview.tsx`
- `frontend/src/features/screen-builder/shared/screenBuilderUtils.ts`
- `frontend/src/lib/api/screenBuilder.ts`

## Next Action

- Verify whether the runtime preview surface exposes enough release-unit and artifact-package evidence for `carbonet-general` handoff, or whether additional runtime metadata needs to be added.
