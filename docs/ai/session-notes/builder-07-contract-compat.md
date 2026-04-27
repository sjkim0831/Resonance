# builder-07-contract-compat

- Role: framework builder contract and compatibility
- Allowed Paths: frontend/src/framework, src/main/java/egovframework/com/framework/builder, builder architecture docs
- Forbidden Paths: environment-management, runtime deploy scripts, generated static assets

## Findings

- The repository already contains a framework-level builder contract layer in both frontend and backend paths, including builder contract metadata, compatibility models, migration-plan models, and profile metadata.
- `frontend/src/framework/contracts/builderContract.ts` and related files already model artifact unit ids, component contracts, page contracts, and surface contracts. This indicates the system is trying to govern builder output at a framework boundary, not just a page-editor boundary.
- Backend files under `src/main/java/egovframework/com/framework/builder/model/` and corresponding services/controllers already expose compatibility declarations and contract payloads, which likely serve as the control-plane metadata foundation for publish safety.
- This contract layer is the right place to define what a release unit is, which artifact units it contains, and whether a builder output is compatible with a given runtime target.

## Contract Gaps

- Need to verify whether `artifactUnitIds` are consistently propagated from backend profiles through frontend contract metadata into repair/runtime flows.
- Need to verify whether compatibility checks are advisory only or actively gate publish/runtime transitions.
- Need to verify whether page-level builder contracts and surface-level compatibility declarations cover the same identity keys used by runtime preview and repair workbench.
- Need to verify whether the contract layer is already canonical for `releaseUnitId`, or whether release-unit identity is still inferred in individual pages.

## Compatibility Notes

- Contract and compatibility analysis must stay framework-owned and should not be split across multiple feature sessions editing the same model/controller families.
- This area has direct impact on artifact handoff, regeneration safety, and repair automation, so it should merge before runtime-target changes.
- Framework builder compatibility is the likely meeting point between authoring metadata and operations handoff metadata.

## Next Action

- Trace `artifactUnitIds`, builder profiles, and compatibility result payloads end-to-end so the coordinator can decide whether release-unit ownership already exists or must be made explicit.
