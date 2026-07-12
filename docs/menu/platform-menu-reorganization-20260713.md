# Platform menu reorganization baseline

## Recovery artifacts

- Full PostgreSQL backup: `carbonet-before-menu-reorg-20260713.dump`
- Menu data backup: `carbonet-menu-before-reorg-20260713.sql`
- Menu common-code backup: `carbonet-menu-codes-before-reorg-20260713.sql`
- Original artifacts are retained under `/opt/resonance-backups/manual` and copied to the operator PC Downloads folder.

## Rules

1. Existing routes are never deleted as part of the information-architecture change.
2. A route removed from primary navigation is recorded in the legacy screen archive.
3. Menu, route, permission, localized labels, order, and visibility are changed in one transaction through the menu-management command service.
4. Top navigation contains task destinations. Create, edit, detail, print, history, upload, and modal routes remain child routes or in-page tabs.

## Target home navigation

| Order | Major menu | Primary destinations |
|---:|---|---|
| 1 | Home | `/home`, tasks, notifications, recent work, certificate verification |
| 2 | Carbon Emissions | `/emission/index`, `/emission/project_list`, `/emission/data_input`, `/emission/simulate`, `/emission/validate`, `/emission/report_submit` |
| 3 | Product LCA | `/emission/lca`, LCA project, inventory, impact assessment, report |
| 4 | Reduction Management | `/emission/reduction`, targets, initiatives, performance, scenarios |
| 5 | Monitoring & Analytics | `/monitoring/index`, dashboard, realtime, alerts, statistics, sharing, export |
| 6 | Carbon & Resource Trading | `/co2/index`, production, demand, search, integrity, credit, analysis |
| 7 | Education & Support | `/edu/index`, courses, applications, progress, certificates, notices, FAQ |
| 8 | My Page | `/mypage/index`, company, tasks, approvals, notifications, marketing, security |
| 9 | Legacy Screen Archive | Routes removed from the primary hierarchy, grouped by their original domain |

## Target administration navigation

1. Operations Dashboard
2. Members, Companies & Authority
3. Carbon Emission Operations
4. LCA Operations
5. Reduction Operations
6. Master Data
7. Validation & Workflow
8. Content, Education & Support
9. Trade, Settlement & Certification
10. External Integration
11. System Management
12. Legacy Admin Screen Archive

## Current route preservation inventory

The pre-change database backups are the authoritative menu-code/order/URL snapshot. Source route ownership remains in the route-family registries. Routes that currently alias another implementation must remain available until a dedicated implementation or an explicit in-page-tab migration is verified.

Known aliases requiring preservation and later completion:

- `/emission/my-tasks` currently uses the project-list implementation.
- `/emission/evidence` currently uses the report-submit implementation.
- Several administration routes reuse validation, definition, report, and external-integration implementations.

## Definition of complete

A menu is complete only when its route, DB-backed behavior, authorization, mobile layout, audit trail, administrator counterpart, tests, build, and deployment verification are complete. Menu exposure alone is not completion.
