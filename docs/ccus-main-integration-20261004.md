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
The read-only controller test passes: 2 tests, 0 failures/errors. Fixes include the Spring Session 3.4.3 version from the Spring Boot 3.4.5 BOM, mutable summary assembly and corrected test fixture SQL matcher.
Full frontend build remains blocked: main's generated catalog expects definition-set hash 7e637d82, but the only available canonical definitions use 1c1d0fef. The guarded generation script rejects the mismatch.

## Release gate and remaining work
Draft only. Recover main's generated screen definitions from the matching source, run the frontend full build and authenticated browser flow (login -> search -> details -> return). Capture visual evidence at the same viewport as the approved design before merge/deployment.
The live proxy is a separate missing runtime subsystem in main with PortOne and environment-specific dependencies; do not install it from a single-file patch. Existing live development/production services remain unchanged.
