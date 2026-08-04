# DB Screen Contract Runtime v1

## Goal

Render governed screens from versioned JSON contracts so a published design change can reach the UI without generating or rebuilding a screen bundle.

## Source of truth

`framework_professional_screen_contract` remains the design source. The runtime adds only immutable delivery state:

1. `framework_screen_contract_version`: immutable JSON snapshots and hashes.
2. `framework_screen_contract_binding`: stable screen key, active version, previous version, and cache epoch.
3. `framework_screen_contract_event`: publish, rollback, and self-recovery audit events.

Do not create a second authoring table. A design save validates and publishes a new version in one transaction.

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
- `POST /admin/api/system/runtime/screens/{screenKey}/publish` validates all layers and atomically publishes a new version.
- `POST /admin/api/system/runtime/screens/{screenKey}/rollback` swaps active and previous versions.

Publishing accepts `expectedVersionId`. A stale editor is rejected instead of overwriting a newer design.

## Failure behavior

If the active version is missing or retired, the read path restores the previous published version and records a `RECOVER` event. The React renderer also keeps a compiled fallback contract during migration, so a contract API failure cannot blank the screen.

## Migration sequence

1. Register a stable `screenKey` and publish the existing contract.
2. Add a runtime hook with a compiled fallback.
3. Verify field, action, actor, process, permission, responsive, and E2E contracts.
4. Remove the fallback only after two published versions and rollback verification exist.

Complex visualizations, PDF/OCR, maps, and editors remain reusable specialized renderers selected by JSON; they are not generated as one-off screens.
