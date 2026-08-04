# DB Screen Contract Runtime v1

## Goal

Render governed screens from versioned JSON contracts so a published design change can reach the UI without generating or rebuilding a screen bundle.

## Source of truth

`framework_professional_screen_contract` remains the design source. The runtime adds only immutable delivery state:

1. `framework_screen_contract_version`: immutable JSON snapshots and hashes.
2. `framework_screen_contract_binding`: stable screen key, active version, previous version, and cache epoch.
3. `framework_screen_contract_event`: publish, rollback, and self-recovery audit events.

Generated screen keys include the immutable contract id and normalized route hash. Process, step, audience, and normalized route alone are not unique in imported legacy contracts. A fail-closed migration compares the final binding count with the professional contract count.

Do not create a second authoring table. A design save validates and publishes a new version in one transaction.

Saving a professional screen contract now republishes its canonical eight-layer projection in the same transaction. Semantic no-op saves reuse the active version, an existing historical hash is reactivated instead of duplicated, and a changed contract advances every alias binding together. Any design-gate, generation, publication, or graph failure rolls back the complete save.

The save path does not synchronously rebuild an entire process. Runtime publication and the affected screen gate commit immediately; full code generation remains an explicit idempotent `/development/direct` operation. This prevents a single screen edit from timing out while still making the DB-backed renderer change visible without a build.

The save path is guarded by `ops/scripts/validate-screen-contract-runtime-save.sh`. The harness performs an authenticated design detail read, saves the same contract twice, verifies runtime publication, confirms `buildRequired=false` and `fullGenerationDeferred=true` from the generation-deferred automation contract, resolves the route contract, and optionally checks that the target route still returns the React shell. The default gate keeps each save under 2,000 ms and route resolution under 1,000 ms.

## Runtime contract

Every published document contains these layers:

- `screen`
- `data`
- `ui`
- `action`
- `process`
- `permission`
- `test`
- `operations`

The optional `renderer` property contains a renderer-specific projection. React currently consumes the five-layer form projection from `renderer`; other renderers can consume the canonical layers directly.

## Endpoints

- `GET /runtime/screens/{screenKey}` returns the active contract, version, hash, and cache epoch.
- `GET /runtime/screens/resolve?routePath=...&processCode=...&stepCode=...&audience=...` resolves the active contract for a generated route without embedding an opaque key in the frontend.
- `POST /admin/api/system/runtime/screens/{screenKey}/publish` validates all layers and atomically publishes a new version.
- `POST /admin/api/system/runtime/screens/{screenKey}/rollback` swaps active and previous versions.

Publishing accepts `expectedVersionId`. A stale editor is rejected instead of overwriting a newer design.

## Failure behavior

If the active version is missing or retired, the read path restores the previous published version and records a `RECOVER` event. The React renderer also keeps a compiled fallback contract during migration, so a contract API failure cannot blank the screen.

Generated screens resolve route, process, step, and audience against the versioned registry. A valid DB contract overrides the generated fallback at render time. Lookup or conversion failure keeps the compiled generated screen. Routes registered as `ADOPT_EXISTING` keep their specialized implementation and are not replaced by the common renderer.

## Migration sequence

1. Register a stable `screenKey` and publish the existing contract.
2. Add a runtime hook with a compiled fallback.
3. Verify field, action, actor, process, permission, responsive, and E2E contracts.
4. Remove the fallback only after two published versions and rollback verification exist.

Complex visualizations, PDF/OCR, maps, and editors remain reusable specialized renderers selected by JSON; they are not generated as one-off screens.
