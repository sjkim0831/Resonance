# Resonance Authority / Builder / Theme Review

## Authority review

### What is already good

Frontend authority structure is already stronger than a typical page-level guard.

Confirmed files:

- `frontend/src/app/policy/authorityScope.ts`
- `frontend/src/components/access/PermissionGate.tsx`
- `frontend/src/components/access/CanUse.tsx`

Current strengths:

- action-level authority model exists
  - `view`
  - `query`
  - `export`
  - `create`
  - `update`
  - `delete`
  - `execute`
  - `approve`
- feature-code convention is normalized
- route/session/menu-based resolution already exists
- deny reason messaging exists
- UI-level disable/hide handling already exists

### What is still missing or thin

The frontend side is mostly sufficient, but the backend/common gate contract is still under-specified.

Recommended minimum authority Gate APIs:

- `common.auth.check.v2`
- `common.authority.context.get.v1`
- `common.authority.feature.catalog.v1`
- `common.authority.scope.verify.v1`
- `common.authority.action.check.v1`
- `common.authority.resource.check.v1`

Recommendation:

- keep the current frontend structure
- do not redesign the UI authority model
- add canonical backend Gate API endpoints/contracts so project adapters do not reach into scope logic directly

## Builder review

### What is already good

Confirmed modules:

- `modules/screenbuilder-core`
- `modules/screenbuilder-runtime-common-adapter`
- `modules/screenbuilder-carbonet-adapter`
- `modules/carbonet-builder-observability`

This means builder is already separated into:

- core engine
- runtime/common adapter
- project adapter
- observability support

This is the correct direction.

### What still needs work

Builder is structurally present, but the package-composer viewpoint still needs to be enforced.

Builder should explicitly manage:

- route/page scaffold
- component composition
- package manifest output
- common JAR set compatibility
- theme binding metadata
- later backend/db scaffold

Recommendation:

- screen-first builder is fine for now
- do not jump to fully free-form AI builder
- keep builder contract-driven

## Theme review

### What is already good

Theme usage is already visible at route-family level.

Observed examples:

- `themeBinding` in route family files
- builder-side theme binding references
- install page package set/theme bundle references

This is enough to continue without a redesign.

### What is still missing or thin

There is not yet a clearly visible centralized theme registry/token governance layer in the inspected frontend paths.

Recommendation:

- keep the current family-level theme bindings
- add/strengthen a central theme registry model in Resonance docs and manifests
- avoid pushing project business logic into theme files

### Theme registry gate added

Central files:

- `data/theme-registry/theme-registry.json`
- `ops/scripts/verify-theme-registry.sh`

Gate rule:

- AI theme edits must resolve through the deterministic route map first.
- Theme writes require a registry diff, token category verification, route-family binding verification, and preview verification note.
- Business rules such as role, permission, approval, workflow, database, tenant, pricing, or emission-factor decisions must not be encoded as theme tokens.

## Path review

### Why `/opt/Resonance` was used first

It was chosen deliberately for migration safety:

- existing active workspaces already live under `/opt/projects`
- Carbonet already lives at `/opt/Resonance`
- wave-based mirroring and diffing is safer when the framework workspace sits beside the original project workspace
- this avoids large path rewrites too early

### Should it move to `/opt/Resonance` later

It can, but only after:

- module/reactor references stabilize
- package/deploy scripts are updated
- operations console paths are normalized
- docs and manifests stop assuming the `/opt/projects/*` pairing

Recommendation:

- do **not** move it yet
- treat `/opt/Resonance` as the transitional safe location
- move to `/opt/Resonance` only in a dedicated path-normalization wave
