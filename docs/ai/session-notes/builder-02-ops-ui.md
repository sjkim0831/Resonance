# builder-02-ops-ui

- Role: ops builder authoring UI
- Allowed Paths: frontend/src/features/screen-builder except runtime preview and repair workbench pages
- Forbidden Paths: backend Java, environment-management, runtime compare and repair pages

## Findings

- `frontend/src/features/screen-builder/ScreenBuilderMigrationPage.tsx` is already a substantial orchestration surface rather than a placeholder page. It coordinates page bootstrap, command metadata, workspace state, governance state, editor state, and mutation handlers.
- The authoring UI is already split into lazy-loaded panel groups: overview, editor, and governance. This means the main remaining work is not initial page scaffolding but tightening authoring boundaries and filling workflow gaps.
- Hooks under `frontend/src/features/screen-builder/hooks/` already separate concerns into workspace state, governance state, editor behavior, and mutations. That is a good session boundary but also a merge-conflict hotspot if multiple sessions touch the same hook files.
- The authoring page already tracks draft authority profile, selected template type, preview mode, preview nodes, component registry state, AI node tree rows, auto-replace previews, and save/publish status. This confirms the builder is already beyond a minimal Phase 1 draft editor.

## UX Gaps

- Need to verify whether the authoring flow clearly distinguishes draft editing from published runtime and repair flows, or whether operators can still get lost between those surfaces.
- Need to verify whether the page is over-coupled to governance and registry operations, making the authoring surface too heavy for routine builder tasks.
- Need to verify whether the initial template selection and node-adding workflow is explicit enough for operators, or whether too much state is surfaced at once.
- Need to verify whether authority profile editing belongs directly in the authoring page or should be presented as a governed side panel with stronger validation.

## Candidate Files

- `frontend/src/features/screen-builder/ScreenBuilderMigrationPage.tsx`
- `frontend/src/features/screen-builder/hooks/useScreenBuilderWorkspaceState.ts`
- `frontend/src/features/screen-builder/hooks/useScreenBuilderEditor.ts`
- `frontend/src/features/screen-builder/hooks/useScreenBuilderMutations.ts`
- `frontend/src/features/screen-builder/hooks/useScreenBuilderGovernanceState.ts`
- `frontend/src/features/screen-builder/panels/ScreenBuilderEditorPanels.tsx`
- `frontend/src/features/screen-builder/panels/ScreenBuilderOverviewPanels.tsx`
- `frontend/src/features/screen-builder/panels/ScreenBuilderGovernancePanels.tsx`

## Next Action

- Map which authoring concerns must stay on the main builder page versus which governance and repair concerns should be linked out, then reduce overlap before feature expansion.
