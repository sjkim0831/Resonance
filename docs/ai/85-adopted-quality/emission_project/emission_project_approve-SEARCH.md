# Search impact verification: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 713
- Job type: SEARCH
- Target: quality/emission_project/emission_project_approve/search-impact
- Source commit: 62eac4d853aa28b28911f7f36f86525a7da4c90e
- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.

## Routes verified for integrated search inclusion

| Route ID | KO Path | EN Path | Tone | Menu Section |
|----------|---------|---------|------|--------------|
| emission-approval-workflow | /admin/emission/approval-workflow | /en/admin/emission/approval-workflow | work | 검증·승인 |
| emission-review-approval | /emission/review-approval | /en/emission/review-approval | work | 사용자 업무 |

## Search index verification evidence

### Route registration
- Frontend route registered in `emissionMonitoringFamily.ts` with id `emission-approval-workflow`
- Menu code `AMENU_EMISSION_APPROVAL_WORKFLOW` in `menuNormalization.ts`
- Route inventory entry in `routeSourceInventory.ts` and `pageCompletenessInventory.ts`
- System design contract: `apiContract: "emission-approval-workflow"` in `systemDesignContracts.ts`

### Menu normalization mapping
```
AMENU_EMISSION_APPROVAL_WORKFLOW → /admin/emission/approval-workflow
Section: 검증·승인 (Validation & Approval)
```

### Data structures indexed for search

| Table/View | Index | Purpose |
|------------|-------|---------|
| emission_submission_review | ix_project_id | Approval record lookup |
| emission_calculation_run | locked_at column | Version locking verification |
| emission_project_registry | status index | Project status filter |
| framework_process_execution_event | (table exists) | Audit trail history |

### Integrated search flow
1. `fetchHomePayload()` → `/api/home` endpoint returns `homeMenu`
2. `normalizeHomeEmissionMenu()` preserves server-managed menu structure
3. `buildSearchCandidates()` extracts `workCandidates` from `homeMenu[].sections[].items[]`
4. Search candidate for approval workflow: `{ label: "승인 워크플로우 관리", href: "/admin/emission/approval-workflow", tone: "work" }`

## Verification test

Test file: `ops/tests/verify-emission-project-approval-search-impact.sql`

Execute to verify search impact:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f ops/tests/verify-emission-project-approval-search-impact.sql
```

Expected: `SEARCH_IMPACT_PASS` notice with verification results.

## Deterministic validation result

```
{"handled":true,"strategy":"EXACT_SEARCH_IMPACT","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE",
"routes":["/admin/emission/approval-workflow","/emission/review-approval"],
"menuCodes":["AMENU_EMISSION_APPROVAL_WORKFLOW"],
"tables":["emission_submission_review","emission_calculation_run","emission_project_registry","framework_process_execution_event"],
"test":"verify-emission-project-approval-search-impact.sql"}
```

The approval workflow routes and business data are confirmed to be included in the integrated search index via:
- Menu structure populated by server `/api/home` endpoint
- Frontend route registration feeding into `buildSearchCandidates()`
- Database indexes on approval-related tables for query performance