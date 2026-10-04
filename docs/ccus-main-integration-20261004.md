# CCUS project list integration — 2026-10-04

## Design and scope
Base: origin/main c49a5f557. Source: snapshot/ccus-source-20261004 c2b61e8a7.
Existing route: /emission/project_list (and /en/emission/project_list).
Keep the left navigation with initially collapsed groups, remove the right preview, retain the compact title/search/list layout and reusable search section. Registration is conditional on canCreate. Project selection opens the existing detail route. Filters and pagination remain in the URL.

## Contract
GET /home/api/emission-project-list-v1 returns contractVersion 1, items, sites, totalCount, page, pageSize and canCreate. Authentication, tenant and project assignment checks remain server-side. 401, 403, invalid contract, empty results and date validation are separate states. No database migration or production service change is included.

## Integration evidence
12 source/test/dependency files ported onto current main. Includes the read-only controller, existing controller tests, page CSS, sidebar, common search and breadcrumb components and screen-name metadata.
The page dependency bundle compiles using esbuild with generatedScreenCatalog externalized. This is a partial dependency check, not a full production build.
Full dependency resolution is blocked by missing generated screen definitions in main (1378 unresolved imports after excluding the added metadata dependency).
Maven cannot start tests because apps/carbonet-api/pom.xml has no spring-session-jdbc version. No passing backend test claim is made.

## Release gate and remaining work
Draft only. Restore main's generated screen definitions using its intended generator, resolve the Maven dependency management baseline, run controller tests and authenticated browser flow (login -> search -> details -> return). Capture visual evidence at the same viewport as the approved design before merge/deployment.
The live proxy is a separate missing runtime subsystem in main with PortOne and environment-specific dependencies; do not install it from a single-file patch. Existing live development/production services remain unchanged.
