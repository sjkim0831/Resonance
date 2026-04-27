# Resonance Wave 11 Common Core Boundary and Runtime Control

## Goal

Reduce the remaining split blockers by:

1. shrinking `carbonet-common-core` boundary
2. defining the first real bridge plan for `platform-runtime-control`

## Current findings

### `platform-runtime-control`

Still depends on:

- `carbonet-common-core`
- `carbonet-mapper-infra`
- `screenbuilder-core`
- `platform-version-control`
- `platform-observability-query`
- `stable-execution-gate`

This means the next wave is not a simple mirror.

It is a bridge-design wave.

### `carbonet-common-core`

Still aggregates too much:

- `carbonet-web-support`
- `stable-execution-gate`
- `common-auth`
- `platform-observability-query`
- `platform-observability-payload`
- `screenbuilder-carbonet-adapter`
- `platform-request-contracts`
- `platform-version-control`

This module should not be promoted as-is.

### Concrete sub-boundaries observed

`carbonet-common-core` currently mixes at least five different layers:

1. `config/*`
   - web/data/security/common filter config
2. `platform/versioncontrol/*`
   - version control requests, mapper, service, controller
3. `platform/runtimecontrol/*`
   - runtime control requests, mapper, service, controller
4. `platform/codex/*`, `platform/observability/*`, `platform/governance/*`
   - admin/bootstrap/ops/AI/governance payload and orchestration layer
5. `platform/menu/*`
   - menu DTO/service/mapper layer

This confirms the correct next step is boundary reduction, not direct promotion.

### `platform-runtime-control`

Current source shape in Resonance is very thin:

- `web/PlatformRuntimeGovernanceApiController.java`

This means the real runtime-control service/mapper logic still effectively lives behind `carbonet-common-core`.

So the next move is:

- first split the `platform/runtimecontrol/*` slice out of `carbonet-common-core`
- then re-target `platform-runtime-control` to that new slice

## Wave 11 policy

### 1. Do not promote `carbonet-common-core` directly

Instead:

- identify what belongs in Resonance common
- identify what is still project-facing
- identify what should become a thin boundary module

Recommended split buckets:

- `resonance-common-config`
- `resonance-versioncontrol-core`
- `resonance-runtimecontrol-core`
- `resonance-governance-observability-core`
- `resonance-menu-core`

### 2. Treat `platform-runtime-control` as a bridge module

Short-term target:

- change old common references to promoted Resonance modules where possible
- isolate the remaining dependencies that still require Carbonet-side ownership

Recommended first bridge target set:

- `resonance-runtimecontrol-core` for runtimecontrol service/mapper/model logic
- `resonance-mapper-infra`
- `resonance-screenbuilder-core` only where still truly needed
- `resonance-platform-version-control` where version policy APIs are needed

### 3. Keep 3B deterministic usage bounded

3B can reliably help with:

- dependency inventory
- route/capability classification
- scaffold selection
- operation verification summaries

3B should **not** be treated as the final authority for:

- broad common-core redesign
- runtime-control dependency surgery without deterministic manifests

## Success criteria

- `carbonet-common-core` sub-boundaries are mapped
- `platform-runtime-control` bridge draft is explicit
- next wave can promote or split a smaller subset instead of a monolith
