# Multi-Session Work Example

This example shows how a mixed frontend and backend request should be split.

## Request

"Add member profile update flow, admin approval history view, related API changes, and audit visibility."

## Classification

- member profile page parity update: `shared_resource`
- member profile submit API: `shared_resource`
- admin approval history screen: `independent`
- audit linkage: `dependency_ordered`
- docs and verification: `dependency_ordered`

## Resulting Sessions

### Session A: Coordinator

- owns contract decisions
- owns shared DTO and API field agreement
- owns shared file assignment

### Session B: Frontend Member Flow

- allowed paths:
  - `frontend/src/features/member`
  - `frontend/src/components` only if assigned

### Session C: Backend Member Flow

- allowed paths:
  - `src/main/java/egovframework/com/feature/member`
  - `src/main/resources/egovframework/mapper/com/feature/member`

### Session D: Admin History Flow

- allowed paths:
  - `frontend/src/features/admin`
  - `src/main/java/egovframework/com/feature/admin`
  - related admin templates and mapper files

### Session E: Verification And Docs

- allowed paths:
  - `docs/ai`
  - test and verification notes

## Why This Split Works

- member flow and admin history do not share most feature files
- shared contracts are decided once by the coordinator
- docs and verification stay centralized
- no mapper XML or shared component has two competing owners
