# CO2_QUALITY_ANALYSIS CQA_PLAN - Reference Analysis

## Purpose

The CQA_PLAN step establishes the planning foundation for the CO2_QUALITY_ANALYSIS process. This process covers data quality management for carbon/CO2 emission records, including completeness, accuracy, timeliness, and consistency validation across multiple data sources (ERP, IoT sensors, power grid data, manual inputs).

**Target route**: `/work/co2-quality-analysis?step=cqa_plan`

**Process code**: CO2_QUALITY_ANALYSIS
**Step code**: CQA_PLAN
**Job type**: FULL_STACK
**Generator required**: true
**Reuse common assets**: true

## Existing Implementation Evidence

### Already Implemented (Reference Only)
The existing `/co2/analysis` route provides a reference design pattern:

| Aspect | Evidence |
|--------|----------|
| Route | `/co2/analysis` (pageId: `co2-analysis`) |
| Feature | `projects/carbonet-frontend/source/src/features/co2-analysis/Co2AnalysisMigrationPage.tsx` |
| Components | `Co2AnalysisHero`, `Co2AnalysisCharts`, `Co2AnalysisRecommendations` |
| Page manifest | `projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts` line 3161 |
| Menu link | Major menu index links to `/co2/analysis` with "Quality Metrics" label |
| Quality dimensions | accuracy, completeness, timeliness, consistency, overallGrade |

### Key Quality Metrics from Existing Implementation
```
- 데이터 정합성 (Data Integrity): Excellent
- 연계 지연시간 (Latency): 0.42s avg
- 포맷 유효성 (Format validity): Warning (74%)
- Legend: 95%+优秀, 80%+良好, 60%+注意, <60%危险/단절
```

## Proposed Process Scope

### Bounded Increment for CQA_PLAN
The plan step should define:

1. **Process boundary**: CO2 quality analysis workflow with data quality scoring
2. **Data sources**: ERP systems, IoT sensors, power grid feeds, manual inputs
3. **Quality dimensions**: completeness, accuracy, timeliness, consistency
4. **Actors**: data quality reviewers, system administrators, auditors
5. **Screens**: quality dashboard, data lineage view, error report, manual correction workflow
6. **API contracts**: quality metrics retrieval, data validation, error flagging
7. **Database entities**: quality scores, validation rules, error logs

## Actors and Authority

| Actor | Responsibility | Allowed Commands |
|-------|---------------|------------------|
| `DATA_QUALITY_REVIEWER` | Review quality scores, flag issues | view dashboard, export report, flag errors |
| `SYSTEM_ADMIN` | Manage validation rules, configure thresholds | update rules, manage thresholds, view logs |
| `AUDITOR` | Verify data quality process compliance | view audit trail, export evidence |
| `SITE_DATA_OWNER` | Address data quality issues at site level | resolve errors, request manual correction |

Server validates `tenantId`, actor assignment, and object-level access. Cross-tenant access returns 403.

## Flow and States

1. User opens `/work/co2-quality-analysis` or `/work/co2-quality-analysis?step=cqa_plan`
2. System displays quality metrics dashboard with site-level DQ scores
3. Quality issues are flagged with severity (critical/warning/info)
4. Authorized users can trigger manual correction workflow or data re-sync
5. Quality metrics are calculated from: completeness checks, accuracy validation, timeliness checks, consistency cross-checks

**States**: `INITIALIZING`, `LOADING`, `READY`, `ERROR`, `REFRESHING`

## User and Administrator Screens

| Audience | Route | Purpose |
|----------|-------|---------|
| General User | `/work/co2-quality-analysis` | Quality metrics dashboard, site health map |
| Administrator | `/work/co2-quality-analysis?step=admin` | Validation rules, thresholds, error management |
| Auditor | `/work/co2-quality-analysis?step=audit` | Audit trail, evidence export |

## API and Transaction Contract

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/co2-quality/metrics` | GET | Retrieve quality metrics summary |
| `/api/co2-quality/sites/{siteId}/scores` | GET | Get site-specific quality scores |
| `/api/co2-quality/errors` | GET | List quality errors with pagination |
| `/api/co2-quality/errors/{errorId}/resolve` | POST | Mark error as resolved |
| `/api/co2-quality/report` | GET | Export quality report |

## Data and Evidence

Reuse existing data quality infrastructure:
- Quality score tables
- Validation rule registry
- Error log and audit trail tables
- Site-to-data-source mapping

## Executable Acceptance Scenarios

1. **HAPPY_PATH**: User can view quality dashboard with all 4 quality dimensions
2. **CRITICAL_ERRORS**: Critical errors are visually highlighted and actionable
3. **EXPORT**: Quality report can be exported in standard format
4. **AUTHORIZATION**: Unauthorized users cannot access admin functions
5. **REFRESH**: Metrics can be refreshed without full page reload

## Implementation Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| New route `/work/co2-quality-analysis` not implemented | HIGH | Must create new feature or extend existing `/co2/analysis` |
| Quality calculation service not exposed | HIGH | Backend API for quality metrics |
| Database schema for quality scores | MEDIUM | May reuse existing emission data quality tables |
| Manual correction workflow UI | MEDIUM | Follow existing error resolution patterns |
| Validation rule management UI | LOW | Can be added in subsequent step |

## Reuse Decision

- **Reuse**: KRDS design tokens, common components, existing quality metrics logic from `/co2/analysis`
- **Extend**: May build on existing `EmissionLciQuality` component patterns
- **New**: Dedicated CO2_QUALITY_ANALYSIS feature route and API endpoints

## Recommended Next Steps

1. Decide whether to extend existing `/co2/analysis` or create new `/work/co2-quality-analysis`
2. Define database schema for quality metrics persistence
3. Implement backend quality calculation service
4. Create frontend quality dashboard with SDUI components
5. Add validation rules management
6. Implement manual correction workflow

## Test Strategy

- Unit tests for quality calculation algorithms
- Integration tests for API endpoints
- UI component tests for dashboard rendering
- Authorization tests for role-based access
- Accessibility tests for WCAG compliance