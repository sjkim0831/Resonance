# Package Map

This file records the current full-stack package-to-domain mapping used in Carbonet.

For builder structure-governance close questions, read:

- `docs/architecture/builder-structure-wave-20260409-closure.md`

before treating this map as a completion signal.

For builder resource-ownership continuation questions, read:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`
- supporting guidance only: `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`
- `docs/architecture/builder-resource-app-packaging-evidence-checklist.md`

before deciding which row-specific review card to open next.

Treat those two docs as the single live entry pair for that family.
Use `docs/architecture/builder-resource-entry-pair-maintenance-contract.md` only as supporting guidance when continuation state changes.
If package-map guidance changes blocker count, active row, next review target, or partial-closeout wording, update both docs in the same turn.
The active continuation row is `3`.
The family is in blocker-resolution state across rows `3` and `5`.
Use the compressed blocker control docs before any docs-only reopen decision:

- `docs/architecture/builder-resource-blocker-source-sentence-matrix.md`
- `docs/architecture/builder-resource-blocker-source-trigger-matrix.md`

Remaining docs-only valid work is only:

- whether a watched source doc changed
- whether that changed source adds the exact missing sentence bundle

canonical partial phrase is:
`PARTIAL_DONE: builder resource ownership closure still counts rows 3 and 5 as blockers, rows 1 and 2 now carry bounded DELETE_NOW notes, row 4 now carries a stronger non-blocker note, and unresolved fallback blocker count is <n>.`

## Backend Packages

- `apps/carbonet-app`
  - Domain: executable runtime assembly
  - Responsibility: Spring Boot app packaging, assembly wiring, runtime exclusions, executable delivery
- `modules/screenbuilder-core`
  - Domain: builder common core
  - Responsibility: builder contracts, ports, draft lifecycle, runtime-neutral builder services
- `modules/screenbuilder-runtime-common-adapter`
  - Domain: builder runtime-common defaults
  - Responsibility: reusable property-backed builder policy adapters
- `modules/screenbuilder-carbonet-adapter`
  - Domain: Carbonet-specific builder adapter
  - Responsibility: Carbonet menu, authority, route, and runtime bridge wiring for builder flows
- builder lane close note:
  - these three `modules/screenbuilder-*` lanes are the canonical builder structure source of truth for the current wave
  - remaining legacy root builder paths are transitional only and do not change the canonical ownership answer
- `modules/platform-*`
  - Domain: reusable platform control-plane families
  - Responsibility: request contracts, service contracts, help, observability, runtime control, version control, and related platform jars

- `src/main/java/egovframework/com/common`
  - Domain: shared backend infrastructure
  - Responsibility: security, filters, interceptors, audit, common services, menu helpers, mapper support
  - Important entry points: common web helpers, menu services, trace and audit utilities
- `src/main/java/egovframework/com/config`
  - Domain: runtime configuration
  - Responsibility: Spring MVC, data source, security, filters, web wiring
- `src/main/java/egovframework/com/feature/admin`
  - Domain: admin business features
  - Responsibility: admin pages, menu management, emission, screen builder, admin workflows
  - Important entry points: `web/`, `service/`, `mapper/`
- `src/main/java/egovframework/com/feature/auth`
  - Domain: authentication and identity
  - Responsibility: login, token, external auth integration, session and identity lookup
- `src/main/java/egovframework/com/feature/home`
  - Domain: home and mypage
  - Responsibility: public or member-facing home flows and mypage screens
- `src/main/java/egovframework/com/feature/member`
  - Domain: membership
  - Responsibility: join, member, company, department, approval-related membership workflows
- `src/main/java/egovframework/com/framework`
  - Domain: full-stack common contract layer
  - Responsibility: builder contract, authority contract, framework metadata, compatibility support, framework-owned support ports, shared framework API response support
  - Rule: project feature code should consume this layer rather than duplicating contract shapes
- `src/main/java/egovframework/com/platform`
  - Domain: platform-wide operator capabilities
  - Responsibility: Codex console, observability, runtime control, workbench, platform screen builder
  - Rule: treat this root path as transitional where equivalent live ownership is already moving into `modules/platform-*`

## Frontend Packages

- `frontend/src/app`
  - Domain: app shell
  - Responsibility: route definitions, page registry, policies, telemetry, bootstrapping
- `frontend/src/components`
  - Domain: shared UI
  - Responsibility: reusable cross-feature UI components
- `frontend/src/features`
  - Domain: screen-oriented product modules
  - Responsibility: route-level page implementations grouped by business feature
- `frontend/src/framework`
  - Domain: frontend common contract layer
  - Responsibility: normalized builder and authority contracts, contract metadata, registry exports, backend API bridge, framework-owned shared hooks
  - Rule: treat this as the canonical frontend boundary for full-stack contract reuse
- `frontend/src/lib`
  - Domain: frontend infrastructure
  - Responsibility: API clients, auth helpers, shared runtime utilities
- `frontend/src/platform`
  - Domain: governed platform registries
  - Responsibility: page manifests, observability metadata, screen registry types
- `frontend/src/generated`
  - Domain: generated frontend artifacts
  - Responsibility: generated metadata and catalogs
  - Rule: do not hand-edit when an authoritative source exists elsewhere

## Contract Boundary

- Canonical backend metadata source:
  - `src/main/resources/framework/contracts/framework-contract-metadata.json`
- Canonical frontend contract entry:
  - `frontend/src/framework/index.ts`
- Canonical frontend contract type barrel:
  - `frontend/src/framework/contracts/index.ts`
- Canonical frontend API barrel:
  - `frontend/src/framework/api/index.ts`

## Update Rule

When a change moves ownership between frontend and backend, update this file in the same turn if any of these change:

- package responsibility
- canonical contract entrypoint
- generated-vs-source authority
- common vs project ownership boundary
- app-vs-module-vs-legacy-root ownership
