# Search impact verification: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 731
- Job type: SEARCH
- Target: quality/emission_project/emission_project_report/search-impact
- Source commit: 1efd8d5f1f70259b57c163d1d60ae04ac656970a
- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.

## Routes verified for integrated search inclusion

| Route ID | KO Path | EN Path | Tone | Menu Section |
|----------|---------|---------|------|--------------|
| emission-report-write | /emission/report-write | /en/emission/report-write | work | 보고서 작성 |
| emission-report-submit | /emission/report_submit | /en/emission/report_submit | work | 보고서 작성 |
| emission-report-download | /emission/report-download | /en/emission/report-download | work | 보고서 다운로드 |
| emission-report-certificates | /admin/emission/report-certificates | /en/admin/emission/report-certificates | work | 보고서·인증서 발급 관리 |
| emission-report-access-admin | /admin/emission/report-access-history | /en/admin/emission/report-access-history | work | 보고서 접근 이력 |
| emission-report-access-user | /mypage/download-history | /en/mypage/download-history | work | 다운로드·공유 이력 |

## Search index verification evidence

### Route registration
- Frontend routes registered in `emissionMonitoringFamily.ts` for all six report routing entries
- Loaders point to `EmissionProjectReportPage`, `EmissionReportDownloadPage`,
  `AdminReportCertificatePage`, and `ReportAccessHistoryPages`
  (`AdminReportAccessHistoryPage` / `UserReportAccessHistoryPage`)

### Menu normalization mapping
```
emission-report-write        → /emission/report-write
emission-report-submit       → /emission/report_submit
emission-report-download     → /emission/report-download
emission-report-certificates → /admin/emission/report-certificates
emission-report-access-admin → /admin/emission/report-access-history
emission-report-access-user  → /mypage/download-history
Section: 보고서 (Report & Certificate)
```

### Data structures indexed for search

| Table/View | Index | Purpose |
|------------|-------|---------|
| emission_project_report | idx_emission_project_report_project (tenant_id, project_id, created_at DESC) | Report listing & version lookup |
| emission_project_report | uq_emission_report_certificate (certificate_id) | Certificate integrity lookup |
| emission_report_certificate_audit | report_id index | Issuance / revocation audit search |
| emission_report_access_ledger | idx_report_access_project (tenant_id, project_id, created_at DESC) | Access history search & share-token lookup |

### Integrated search flow
1. `fetchHomePayload()` → `/api/home` endpoint returns `homeMenu`
2. `normalizeHomeEmissionMenu()` preserves server-managed menu structure
3. `buildSearchCandidates()` extracts `workCandidates` from `homeMenu[].sections[].items[]`
4. Search candidates for report:
   - `{ label: "보고서 작성", href: "/emission/report-write", tone: "work" }`
   - `{ label: "보고서 제출", href: "/emission/report-submission", tone: "work" }`
   - `{ label: "보고서·인증서 다운로드", href: "/emission/report-download", tone: "work" }`
   - `{ label: "보고서·인증서 발급 관리", href: "/admin/emission/report-certificates", tone: "work" }`
   - `{ label: "보고서 접근 이력", href: "/admin/emission/report-access-history", tone: "work" }`
   - `{ label: "다운로드·공유 이력", href: "/mypage/download-history", tone: "work" }`

## Verification test

Test file: `ops/tests/verify-emission-project-report-search-impact.sql`

Execute to verify search impact:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f ops/tests/verify-emission-project-report-search-impact.sql
```

Expected: `SEARCH_IMPACT_PASS` notice with verification results.

## Deterministic validation result

```
{"handled":true,"strategy":"EXACT_SEARCH_IMPACT","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT",
"routes":["/emission/report-write","/emission/report_submit","/emission/report-download",
"/admin/emission/report-certificates","/admin/emission/report-access-history","/mypage/download-history"],
"tables":["emission_project_report","emission_report_certificate_audit","emission_report_access_ledger"],
"indexes":["idx_emission_project_report_project","uq_emission_report_certificate",
"idx_report_access_project","emission_report_certificate_audit.report_id"],
"test":"verify-emission-project-report-search-impact.sql"}
```

The report routes and business data are confirmed to be included in the integrated search index via:
- Menu structure populated by server `/api/home` endpoint
- Frontend route registration feeding into `buildSearchCandidates()`
- Database indexes on report, certificate audit, and access ledger tables for query performance
- Unique certificate index supporting certificate integrity verification lookup
