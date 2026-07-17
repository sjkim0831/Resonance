# EMISSION_PROJECT_SETUP reference analysis

## Purpose

The setup step establishes the organization and operational boundary, calculation period, Scope coverage, methodology versions, responsible actors, and stage deadlines. It completes only when the versioned settings pass segregation-of-duty validation and the project reaches `PLANNED`.

## Actors and authority

| Actor | Responsibility | Allowed commands |
|---|---|---|
| `COMPANY_MANAGER` | Owns scope, schedule, assignments, and project start | save draft, validate settings, start project |
| `SITE_DATA_OWNER` | Confirms assigned sites and collection responsibility | review assignment |
| `CALCULATOR` | Confirms factor, GWP, unit, and calculation policy | review methodology |
| `VERIFIER` | Reviews boundary, materiality, and independence | review scope |
| `APPROVER` | Receives the later approval task and must remain independent | review assignment only |
| `PLATFORM_OPERATOR` | Maintains reference codes and policies without owning business approval | manage reference data |

The server validates `tenantId`, `projectId`, account-to-actor assignment, object-level access, and separation between calculator, verifier, and approver. Cross-tenant lookup, search, export, and mutation return 403 or non-disclosing 404.

## Flow and states

1. An authorized company manager opens `/emission/project/create` or the existing project settings workspace.
2. The manager selects the company, sites, reporting purpose, period, organizational boundary, Scope 1·2·3 categories, Scope 2 method, GWP and factor versions.
3. The manager assigns stage actors and deadlines. The system rejects missing actors, inaccessible sites, inverted periods, and prohibited self-approval combinations.
4. Draft save persists a version without opening downstream work.
5. `POST /home/api/emission-projects/{id}/start` validates the complete snapshot with an idempotency key.
6. A successful `CONFIRM_SCOPE` transition changes `DRAFT` to `PLANNED`, creates the activity-data task once, and records an immutable process event.

Conflicting edits return a stale-version response. Failed validation leaves the project in `DRAFT`; no task, notification, or partial settings version is committed.

## User and administrator screens

| Audience | Route | Required workspace |
|---|---|---|
| User | `/emission/project/create` | basic information, organization and sites, boundary, Scope and methodology, actors and deadlines, review and start |
| Administrator | `/admin/emission/project-operations` | project search, operational status, assignment and deadline controls, policy and audit history, direct user-screen link |

Both screens use the common KRDS header and tokens. At 360px they use a single column and a persistent primary action; at 768px the summary and form are separated; at 1280px the list and detail workspace use two columns. They implement `LOADING`, `EMPTY`, `ERROR`, `FORBIDDEN`, `READY`, `SAVING`, `CONFLICT`, and `STALE_VERSION` without relying on color alone.

## API and transaction contract

- `GET /home/api/emission-projects/{id}` returns the tenant-scoped project, settings version, tasks, members, and history.
- `POST /home/api/emission-projects` creates one project for an idempotent request.
- `PUT /home/api/emission-projects/{id}/settings` requires the current version and stores a new settings snapshot atomically.
- `POST /home/api/emission-projects/{id}/start` validates required settings and executes `CONFIRM_SCOPE` once.
- All mutations return field-level validation errors, an updated version, process state, current task, and the next allowed commands.

## Data and evidence

The implementation reuses `emission_project_registry`, `emission_project_site`, `emission_project_task`, `framework_account_actor_assignment`, `framework_process_execution`, and `framework_process_execution_event`. Required indexes cover tenant and project lookup, actor assignment scope, current task status, and idempotency keys. Evidence includes the settings snapshot hash, actor and account, before and after state, command, reason, request identifier, timestamp, and source version.

## Executable acceptance scenarios

- `HAPPY_PATH`: complete settings create exactly one project execution and one activity-data task in `PLANNED`.
- `EXCEPTION`: a missing site, period, Scope, actor, or deadline returns actionable errors and preserves `DRAFT` without partial records.
- `AUTHORITY`: a site owner, calculator, verifier, or approver cannot start a project without the company-manager command permission; the attempt is audited.
- `ISOLATION`: an account assigned to tenant A cannot discover or change tenant B's project through detail, search, export, or direct identifiers.
- `RECOVERY`: retry after a timeout returns the original project and transition using the idempotency key, without duplicate tasks, events, or notifications.

## Reuse decision and delivery gaps

The existing project registry service, project creation page, actor assignment tables, process execution engine, menu links, and creation hardening migration are the implementation baseline and must be preserved. Frontend delivery must bind every designed field and state to the selected KRDS layout. Backend delivery must close any contract endpoint or transaction gap, then contract, browser, accessibility, responsive, authorization, isolation, and recovery tests must produce evidence before the step is marked implemented.
