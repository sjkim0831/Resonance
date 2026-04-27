# AI Session Partitioning Standard

Use this standard for every request in this repository.

This is the default operating model for all tasks, even when the final result is a single working session.

## When To Apply

Apply this standard first for every task.

After classification, the work may still collapse to one session when it is clearly isolated.

## What "Simple" Means

Simple means truly isolated work, not just short work.

Treat a request as simple only when most of these are true:

- one primary file family changes
- no shared contract changes are needed
- no shared component or shared mapper ownership conflict exists
- frontend-only or backend-only, not both
- no durable handoff is needed
- docs impact is minimal

Examples that may stay in one session:

- one small copy fix in a single screen
- one localized CSS adjustment in one feature
- one controller bug fix with no DTO or mapper contract change

Examples that should still be classified carefully:

- "small" API field additions that affect frontend and backend
- edits to shared React components
- edits to common backend DTO, VO, or mapper XML
- any request that touches both implementation and cross-feature docs

## Core Rule

Do not split by "task title" alone.

Split by:

- ownership boundary
- writable path boundary
- contract boundary
- merge risk

One session should have:

- one clear responsibility
- one allowed path set
- one expected output
- one definition of done

## Default Session Layout

Use the smallest safe number of sessions after partitioning.

For a 10-work-item request, 4 to 6 sessions is usually the right range unless the work is unusually independent.

### 1. Coordinator Session

Owns planning and contract control.

- groups the work into conflict-free batches
- fixes API, DTO, event, and DB contracts first
- assigns allowed paths and forbidden paths
- keeps shared files to a single owner
- prepares merge order and review order

The coordinator should avoid broad implementation work.

### 2. Frontend Sessions

Use 1 or 2 sessions depending on conflict risk.

- own `frontend/src/app`
- own `frontend/src/features`
- own `frontend/src/components`
- own `frontend/src/lib` only when the coordinator assigns it

Split frontend work by feature group, route group, or page family.

Do not let two sessions edit the same shared component tree at the same time.

### 3. Backend Sessions

Use 1 or 2 sessions depending on domain overlap.

- own `src/main/java`
- own `src/main/resources/templates`
- own `src/main/resources/egovframework/mapper`

Split backend work by domain package, controller-service-mapper chain, or workflow family.

Do not let two sessions edit the same mapper XML, shared VO, or common service contract at the same time.

### 4. Documentation And Verification Session

Owns cross-cutting updates and closeout.

- updates `docs/ai` maps
- updates SQL or impact notes when needed
- verifies route, API, mapper, and screen linkage
- checks regressions and handoff quality

## Default Partition Formula

Use this formula first:

`session count = conflict groups + coordinator + verification`

In practice:

- 10 work items often become 3 or 4 conflict groups
- that usually means 5 or 6 sessions total

Do not create 10 sessions for 10 items unless almost all items are fully isolated.

## How To Group 10 Work Items

Classify each item into one of three buckets first:

### Independent

Safe to run in parallel because files and contracts do not overlap.

### Shared Resource

Should be grouped under one owner because they touch the same shared files, components, mappers, DTOs, or policies.

### Dependency Ordered

Must wait for another item because the contract or infrastructure must exist first.

## Required Session Contract

Before implementation, each session should receive a short work contract with:

- `taskGroupId`
- `ownerSession`
- `goal`
- `allowedPaths`
- `forbiddenPaths`
- `inputContracts`
- `expectedOutputs`
- `doneCriteria`
- `handoffTo`

Use the templates under `docs/ai/60-operations/session-orchestration/` when the request needs durable coordination artifacts.

## Shared File Rule

Shared files must have a single temporary owner.

Typical shared files in this repository:

- shared React components
- frontend API client helpers
- common backend DTOs or VO classes
- common mapper XML
- cross-feature templates
- `docs/ai` index or catalog files

If multiple sessions need the same shared file, assign it to the coordinator or create a dedicated shared-infrastructure session.

## Mandatory Sequencing

Use this sequence unless the request clearly needs something else:

1. coordinator fixes scope and contracts
2. shared infrastructure work happens first
3. frontend and backend feature sessions run in parallel
4. documentation and verification session closes the loop

## Required Deliverables For Parallel Work

For any multi-session change, update the minimum repository maps when applicable:

- `docs/ai/20-ui/screen-index.csv`
- `docs/ai/20-ui/event-map.csv`
- `docs/ai/40-backend/api-catalog.csv`
- `docs/ai/50-data/table-screen-api-map.csv`

## Anti-Patterns

Avoid these patterns:

- one session per requested bullet without conflict analysis
- multiple sessions editing the same file family
- multiple sessions changing the same API contract independently
- mixing implementation, coordination, and final verification in every session
- letting documentation drift until after merge

## Default Instruction For Future Work

Use this partitioning standard automatically for every request.

If the task is ambiguous, start with a coordinator pass and define path ownership before implementation.

If the task is simple, the classification step may still conclude:

- coordinator and implementer are the same session
- verification stays lightweight
- no parallel split is needed
