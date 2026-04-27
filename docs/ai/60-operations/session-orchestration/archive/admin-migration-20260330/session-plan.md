# Session Plan

## Request

- `requestId`: `admin-migration-20260330`
- `title`: admin migration continuity on fresh login
- `summary`: Reopen the current admin migration and observability work without overlapping route contracts, backend mapper chains, or generated runtime outputs.

## Classification

- `frontend route and registry changes`: `shared_resource`
- `frontend page implementation by screen family`: `independent`
- `backend observability and admin controller changes`: `shared_resource`
- `notification history SQL and mapper additions`: `dependency_ordered`
- `runtime build outputs and startup scripts`: `shared_resource`
- `docs and handoff maintenance`: `shared_resource`

## Shared Contracts

- API: admin summary, observability, system code, notification history endpoints
- DTO or VO: backend observability payloads and notification history records
- event map: runtime navigation and route registration
- DB impact: `20260330_admin_notification_history.sql`
- shared components: route registry, runtime navigation, common admin shell linkage
- shared mapper XML: `src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`, `src/main/resources/egovframework/mapper/com/feature/admin/AdminNotificationHistoryMapper.xml`

## Conflict Groups

### Group 1

- scope: route contract and frontend shared registry
- reason grouped together: central routing files fan out to many admin screens
- likely paths: `frontend/src/app/routes`, `frontend/src/lib/navigation`, `frontend/src/lib/api`, `data/full-stack-management`

### Group 2

- scope: admin screen-family pages
- reason grouped together: page implementation can parallelize only after route ownership is fixed
- likely paths: `frontend/src/features/environment-management`, `frontend/src/features/security-monitoring`, `frontend/src/features/system-code`, `frontend/src/features/home-entry`, `frontend/src/features/emission-project-list`, `frontend/src/features/menu-management`, `frontend/src/features/notification-center`, `frontend/src/features/operations-center`, `frontend/src/features/performance`, `frontend/src/features/sensor-*`, `frontend/src/features/external-connection-*`, `frontend/src/features/system-infra`, `frontend/src/features/batch-management`

### Group 3

- scope: backend observability and admin controller chain
- reason grouped together: mapper, service, and controller edits are tightly coupled
- likely paths: `src/main/java/egovframework/com/common/**`, `src/main/java/egovframework/com/feature/admin/**`, `src/main/resources/egovframework/mapper/**`, `docs/sql/20260330_admin_notification_history.sql`

### Group 4

- scope: runtime packaging and verification
- reason grouped together: generated assets and startup scripts must have one owner
- likely paths: `ops/scripts`, `src/main/resources/static/react-app/**`, build verification docs

## Session List

### Session A

- role: coordinator and route-contract owner
- goal: reconcile the working tree, keep route/shared file ownership fixed, and decide which frontend lanes are safe to reopen
- allowedPaths: `docs/ai/60-operations/session-orchestration/active/admin-migration-20260330/**`, `frontend/src/app/routes/**`, `frontend/src/lib/navigation/**`, `frontend/src/lib/api/**`, `data/full-stack-management/**`
- forbiddenPaths: `src/main/java/**`, `src/main/resources/egovframework/mapper/**`, `src/main/resources/static/react-app/**`
- inputs: current working tree, builder session notes, tmux playbook
- outputs: updated active plan, route ownership, handoff notes
- doneCriteria: shared route files have one owner and other lanes are explicitly bounded

### Session B

- role: frontend admin screen-family lane
- goal: continue page implementation without touching shared route contracts
- allowedPaths: `frontend/src/features/**`
- forbiddenPaths: `frontend/src/app/routes/**`, `frontend/src/lib/navigation/**`, `frontend/src/lib/api/**`, `src/main/java/**`, `src/main/resources/static/react-app/**`
- inputs: route contracts frozen by Session A
- outputs: page-level React implementations by screen family
- doneCriteria: page work stays inside owned feature folders

### Session C

- role: backend observability and admin API lane
- goal: continue controller, service, mapper, and SQL changes for observability and notification history
- allowedPaths: `src/main/java/egovframework/com/common/**`, `src/main/java/egovframework/com/feature/admin/**`, `src/main/resources/egovframework/mapper/**`, `docs/sql/**`
- forbiddenPaths: `frontend/src/**`, `src/main/resources/static/react-app/**`
- inputs: route/API expectations from Session A
- outputs: backend contract and persistence changes
- doneCriteria: controller-service-mapper chain is internally consistent and documented

### Session D

- role: build and verification owner
- goal: package, runtime restart, and generated-asset freshness proof after source lanes settle
- allowedPaths: `ops/scripts/**`, `src/main/resources/static/react-app/**`, verification docs
- forbiddenPaths: `frontend/src/**`, `src/main/java/**`, `src/main/resources/egovframework/mapper/**`
- inputs: completed frontend/backend source changes
- outputs: fresh runtime build, verified startup, latest asset set
- doneCriteria: generated outputs match the latest sources and verification note is updated

## Ownership

- shared file owner: Session A for route/shared frontend contracts, Session C for backend contracts, Session D for generated runtime outputs
- contract owner: Session A
- docs owner: Session A
- verification owner: Session D

## Order

1. coordinator work: reopen plan, reconcile with `git status --short`, freeze shared file owners
2. first implementation batch: frontend page lane and backend lane in parallel
3. second implementation batch: only after route/API contract clarification if new shared files appear
4. verification and docs: build, package, runtime restart, handoff refresh

## Merge Order

1. Session A route and ownership fixes
2. Session C backend chain changes
3. Session B frontend feature changes
4. Session D generated assets and verification closeout

## Final Decision

- session count: `4`
- why this count is the minimum safe split: route contracts, backend mapper chains, and generated runtime outputs are all shared resources, while feature pages can parallelize only after the coordinator freezes those boundaries
