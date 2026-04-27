# builder-08-registry-governance

- Role: component registry governance
- Allowed Paths: governance panels, builder catalog, common trace registry backend, framework builder model
- Forbidden Paths: editor layout flow, runtime deploy scripts, environment-management menu CRUD

## Findings

- The builder governance surface is already deep: governance panels include registry inventory, usage lookup, authority, AI prompt surface, draft scan, AI node tree, and auto-replace preview sections.
- The repository also contains backend registry and trace-related code under `src/main/java/egovframework/com/common/trace/**`, which suggests the component registry is not purely local to the builder page and is meant to connect to wider UI manifest tracking.
- Current architecture docs already require delete-if-unused, replacement mapping, deprecation support, and usage visibility before delete. The existing governance panels match that direction closely.
- This means registry governance is already a first-class subsystem and should be treated separately from basic authoring UI work.

## Registry Safety Gaps

- Need to verify whether builder draft usage and published snapshot usage are both considered in deletion/remap safety checks.
- Need to verify whether deprecated component replacement previews are derived from authoritative registry usage data or only from currently loaded page state.
- Need to verify whether AI-assisted node tree insertion and prompt surfaces can create references that bypass normal registry validation.
- Need to verify whether registry usage spans both manifest-traced pages and builder-managed schema snapshots without false negatives.

## Candidate Files

- `frontend/src/features/screen-builder/panels/governance/GovernanceRegistryInventorySection.tsx`
- `frontend/src/features/screen-builder/panels/governance/GovernanceRegistryUsageSection.tsx`
- `frontend/src/features/screen-builder/panels/governance/GovernanceAutoReplacePreviewSection.tsx`
- `frontend/src/features/screen-builder/panels/governance/GovernanceDraftScanSection.tsx`
- `frontend/src/features/screen-builder/panels/governance/GovernanceAiPromptSurfaceSection.tsx`
- `frontend/src/features/screen-builder/catalog/buttonCatalog.tsx`
- `src/main/java/egovframework/com/common/trace/UiManifestRegistryService.java`
- `src/main/java/egovframework/com/common/trace/UiComponentRegistryVO.java`
- `src/main/java/egovframework/com/common/trace/UiPageComponentDetailVO.java`

## Next Action

- Confirm the registry source of truth and verify that delete/remap/deprecate operations consider builder drafts, published builder snapshots, and non-builder manifest-traced pages together.
