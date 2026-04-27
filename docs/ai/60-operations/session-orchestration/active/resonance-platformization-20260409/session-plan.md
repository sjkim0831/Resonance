# Session Plan

## Request

- `requestId`: `resonance-platformization-20260409`
- `title`: Resonance and Carbonet platformization continuation
- `summary`: Continue the current Resonance control-plane, common-vs-project, builder, and deploy-governance work without re-deciding ownership boundaries or overlapping shared files.

## Classification

- `control-plane composition split out of feature/admin`: `dependency_ordered`
- `common-vs-project boundary enforcement for reusable modules`: `shared_resource`
- `builder operationalization and installable product hardening`: `shared_resource`
- `artifact-first deploy and version-governance implementation`: `dependency_ordered`
- `route split between runtime and platform pages`: `shared_resource`
- `docs, handoff, and verification rules`: `shared_resource`

## Shared Contracts

- `BUILDER_RESOURCE_OWNERSHIP_CLOSURE` is now CLOSED
- all 5 rows resolved as `DELETE_NOW` or carry non-blocking notes
- success phrase: `SUCCESS: builder resource ownership closure is now complete across all five rows, with row 5 resolved as DELETE_NOW following explicit root exclusion and fully moved MyBatis/resource ownership.`
- next family: `BUILDER_COMPATIBILITY_SHIM_REMOVAL`

- API: control-plane bootstrap/page payload APIs, builder governance APIs, version-management APIs, deploy evidence APIs
- DTO or VO: platform-owned builder, version-control, runtime-package, and control-plane DTO families
- event map: runtime route registry versus platform route registry, deploy evidence linkage, builder publish and rebuild flow
- DB impact: `COMMON_DB` control-plane tables, `RSN_*` draft families, artifact/version governance tables, project-installed version records
- shared components: admin shell composition, route registry, control-plane API client, builder governance surfaces
- shared mapper XML: `src/main/resources/egovframework/mapper/com/platform/**`, selected compatibility shims under `com/feature/admin/**`

## Conflict Groups

### Group 1

- scope: boundary governance and shared contracts
- reason grouped together: package ownership, DTO ownership, and migration order must be fixed before implementation fans out
- likely paths: `docs/architecture/**`, `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/**`

### Group 2

- scope: backend control-plane composition split
- reason grouped together: `feature/admin` composition, `platform/*` services, and mapper/controller boundaries are tightly coupled
- likely paths: `src/main/java/egovframework/com/feature/admin/**`, `src/main/java/egovframework/com/platform/**`, `src/main/resources/egovframework/mapper/com/platform/**`, `src/main/resources/egovframework/mapper/com/feature/admin/**`

### Group 3

- scope: frontend runtime-versus-platform route ownership
- reason grouped together: route registry and control-plane screen entrypoints are shared resources across many pages
- likely paths: `frontend/src/app/routes/**`, `frontend/src/lib/api/**`, `frontend/src/platform/**`, `frontend/src/features/screen-builder/**`, `frontend/src/features/environment-management/**`, `frontend/src/features/project-version-management/**`

### Group 4

- scope: deploy and version governance
- reason grouped together: release-unit, runtime-package, deploy-trace, and rollback evidence need one owner
- likely paths: `src/main/java/egovframework/com/platform/versioncontrol/**`, `docs/architecture/runtime-package-matrix-and-deploy-ia.md`, `docs/architecture/project-version-management-implementation-map.md`, `ops/scripts/**`

## Session List

### Session A

- role: coordinator and boundary owner
- goal: keep one canonical execution order, one ownership map, and one current backlog for the whole platformization track
- allowedPaths: `docs/architecture/**`, `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/**`
- forbiddenPaths: `frontend/src/**`, `src/main/java/**`, `src/main/resources/egovframework/mapper/**`, `src/main/resources/static/react-app/**`
- inputs: current separation docs, builder notes, deploy architecture docs, working-tree snapshot
- outputs: updated execution backlog, active session contracts, handoff notes
- doneCriteria: next implementation slice is explicit and shared-file ownership is frozen
- current builder-structure wave authority:
  - `docs/architecture/builder-structure-wave-20260409-closure.md`
- current builder resource-ownership wave authority:
  - `docs/architecture/builder-resource-ownership-wave-20260415-closure.md`
- current wave closes:
  - `BUILDER_STRUCTURE_GOVERNANCE`
  - `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`
- current wave does not close:
  - compatibility shim removal
  - broader control-plane composition split
- next continuation family:
  - `BUILDER_COMPATIBILITY_SHIM_REMOVAL`

### Session B

- role: backend control-plane split owner
- goal: move control-plane entry composition, page assembly, and persistence ownership away from mixed `feature/admin` lanes
- allowedPaths: `src/main/java/egovframework/com/feature/admin/**`, `src/main/java/egovframework/com/platform/**`, `src/main/resources/egovframework/mapper/com/platform/**`, `src/main/resources/egovframework/mapper/com/feature/admin/**`
- forbiddenPaths: `frontend/src/**`, `docs/ai/60-operations/session-orchestration/active/**`, `src/main/resources/static/react-app/**`
- inputs: Session A ownership decisions, separation status priorities
- outputs: platform-owned controllers/services/mappers or explicit compatibility shims
- doneCriteria: one selected control-plane family no longer depends on mixed runtime-admin composition as the source of truth

### Session C

- role: frontend route and control-plane UI owner
- goal: split runtime page ownership from platform governance page ownership without breaking the shared shell
- allowedPaths: `frontend/src/app/routes/**`, `frontend/src/lib/api/**`, `frontend/src/platform/**`, `frontend/src/features/screen-builder/**`, `frontend/src/features/environment-management/**`, `frontend/src/features/project-version-management/**`
- forbiddenPaths: `src/main/java/**`, `src/main/resources/egovframework/mapper/**`, `src/main/resources/static/react-app/**`, `docs/ai/60-operations/session-orchestration/active/**`
- inputs: Session A route ownership and Session B API contracts
- outputs: separated route registration, platform-facing API usage, control-plane screen handoff updates
- doneCriteria: route ownership is separately traceable even if one runtime shell remains during transition

### Session D

- role: deploy and verification owner
- goal: keep artifact-first deploy governance, version visibility, and runtime freshness proof aligned with the separation work
- allowedPaths: `src/main/java/egovframework/com/platform/versioncontrol/**`, `ops/scripts/**`, `docs/architecture/**`, `docs/operations/**`
- forbiddenPaths: `frontend/src/**`, `src/main/java/egovframework/com/feature/admin/**` except approved compatibility hooks, `src/main/resources/static/react-app/**`
- inputs: Session A backlog, Session B/C implementation outputs
- outputs: version-governance implementation map updates, deploy evidence rules, verification checklist updates
- doneCriteria: release-unit and runtime-package evidence are explicit and verifiable for the current target flow

## Ownership

- shared file owner: Session A for architecture and orchestration docs, Session B for backend mixed-boundary files, Session C for route registry and control-plane frontend files, Session D for deploy/version docs and ops rules
- contract owner: Session A
- docs owner: Session A
- verification owner: Session D

## Order

1. coordinator work: freeze the immediate backlog and select one implementation family
2. first implementation batch: backend control-plane composition split
3. second implementation batch: frontend route split and version/deploy governance follow the backend contract line
4. verification and docs: deploy evidence, route verification, and handoff refresh

## Merge Order

1. Session A boundary and backlog updates
2. Session B backend composition split
3. Session C frontend route and control-plane UI split
4. Session D deploy/version governance and verification closeout

## Final Decision

- session count: `4`
- why this count is the minimum safe split: the current repository has one large shared backend conflict family, one large shared frontend route family, and one deploy/version governance family that should not be mixed into feature implementation work
