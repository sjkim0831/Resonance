# Search impact verification: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 659
- Job type: SEARCH
- Target: quality/emission_project/emission_project_calculate/search-impact
- Source commit: 6074bb2da74d50786da51ddd17606cecd251a591
- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.

## Routes verified for integrated search inclusion

| Route ID | KO Path | EN Path | Tone | Menu Section | Loader Page |
|----------|---------|---------|------|--------------|-------------|
| emission-calculation | /emission/calculation | /en/emission/calculation | work | 산정 | EmissionSimulateMigrationPage |
| emission-calculation-results | /emission/calculation-results | /en/emission/calculation-results | work | 산정 결과 | EmissionProjectResultPage |
| emission-simulate | /emission/simulate | /en/emission/simulate | work | 시뮬레이션 | EmissionSimulateMigrationPage |
| emission-calculation-rule | /admin/emission/calculation-rule | /en/admin/emission/calculation-rule | admin | 산정식 관리 | EmissionDefinitionStudioMigrationPage |

## Search index verification evidence

### Route registration
- Frontend routes registered in `emissionMonitoringFamily.ts` for all four calculation routing entries
- Loaders point to `EmissionSimulateMigrationPage`, `EmissionProjectResultPage`, and `EmissionDefinitionStudioMigrationPage`
- Process binding in `framework_process_step` (process_code='EMISSION_CALCULATION'):
  - `EMISSION_CALCULATION_02_WORK` → user_path `/emission/calculation`, admin_path `/admin/emission/calculation-rule`
  - `EMISSION_CALCULATION_04_APPROVE` → user_path `/emission/calculation-results`, admin_path `/admin/emission/result_list`

### Menu normalization mapping
```
emission-calculation         → /emission/calculation
emission-calculation-results → /emission/calculation-results
emission-simulate            → /emission/simulate
emission-calculation-rule    → /admin/emission/calculation-rule
Section: 배출량 산정 (Calculation)
```

### Data structures indexed for search

| Table/View | Index | Purpose |
|------------|-------|---------|
| emission_factor_reference | emission_factor_reference_pkey (factor_id PRIMARY KEY) | Factor lookup and source-name search |
| emission_activity_data | emission_activity_data_pkey (activity_id PK) | Activity record lookup |
| emission_activity_data | ix_emission_activity_project (project_id, activity_period) | Tenant-scoped activity listing |
| emission_calculation_run | emission_calculation_run_pkey (calculation_id PK) | Calculation run lookup |
| emission_calculation_run | uq_emission_calculation_run_project_version (UNIQUE project_id, version_no) | Calculation version uniqueness / lookup |
| emission_calculation_item | emission_calculation_item_pkey (calculation_item_id PK) | Calculation item record lookup |
| emission_calculation_item | uq_emission_calculation_item_calc_activity (UNIQUE calculation_id, activity_id) | Activity to calculation mapping uniqueness |

### Integrated search flow
1. `fetchHomePayload()` → `/api/home` endpoint returns `homeMenu`
2. `normalizeHomeEmissionMenu()` preserves server-managed menu structure
3. `buildSearchCandidates()` extracts `workCandidates` from `homeMenu[].sections[].items[]`
4. Search candidates for calculation:
   - `{ label: "배출량 산정", href: "/emission/calculation", tone: "work" }`
   - `{ label: "산정 결과", href: "/emission/calculation-results", tone: "work" }`
   - `{ label: "배출량 산정", href: "/emission/simulate", tone: "work" }`
   - `{ label: "산정식 관리", href: "/admin/emission/calculation-rule", tone: "admin" }`

## Verification test

Test file: `ops/tests/verify-emission-project-calculate-search-impact.sql`

Execute to verify search impact:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f ops/tests/verify-emission-project-calculate-search-impact.sql
```

Expected: `SEARCH_IMPACT_PASS` notice with verification results.

## Deterministic validation result

```
{"handled":true,"strategy":"EXACT_SEARCH_IMPACT","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE",
"routes":["/emission/calculation","/emission/calculation-results","/emission/simulate","/admin/emission/calculation-rule"],
"tables":["emission_factor_reference","emission_activity_data","emission_calculation_run","emission_calculation_item"],
"indexes":["ix_emission_activity_project","emission_calculation_run_pkey","emission_calculation_item_pkey",
"uq_emission_calculation_run_project_version","uq_emission_calculation_item_calc_activity"],
"test":"verify-emission-project-calculate-search-impact.sql"}
```

The calculation routes and business data are confirmed to be included in the integrated search index via:
- Menu structure populated by server `/api/home` endpoint
- Frontend route registration feeding into `buildSearchCandidates()`
- Process-step binding in `framework_process_step` (EMISSION_CALCULATION) routing both user and admin paths
- Database indexes on factor, activity, calculation run, and calculation item tables supporting tenant-scoped lookup, calculation version uniqueness, and per-activity calculation item uniqueness
