# CO2_QUALITY_ANALYSIS Test Specification
# Job: 9516, Process: CO2_QUALITY_ANALYSIS, Step: CQA_PLAN

## Test Scope

These tests validate the CO2_QUALITY_ANALYSIS process once implemented.

## Test Files Required

| Test File | Purpose | Priority |
|-----------|---------|----------|
| `verify-co2-quality-metrics.sql` | Validate quality score calculation | HIGH |
| `verify-co2-quality-tenant-isolation.sql` | Validate cross-tenant access prevention | HIGH |
| `verify-co2-quality-actor-permissions.sql` | Validate role-based access control | MEDIUM |

## HAPPY_PATH Test Cases

### TC-CQA-001: Quality Metrics Dashboard Load
```
Precondition: User authenticated with DATA_QUALITY_REVIEWER role
Steps:
  1. GET /api/co2-quality/metrics
Expected:
  - Response 200
  - Body contains: accuracy, completeness, timeliness, consistency scores
  - Scores are in valid range [0-100]
```

### TC-CQA-002: Site-Specific Quality Scores
```
Precondition: User authenticated
Steps:
  1. GET /api/co2-quality/sites/{siteId}/scores
Expected:
  - Response 200
  - Body contains siteId, dimension scores, overall grade
```

### TC-CQA-003: Quality Error List with Pagination
```
Precondition: User authenticated
Steps:
  1. GET /api/co2-quality/errors?page=1&pageSize=20
Expected:
  - Response 200
  - Body contains: items[], totalCount, pageIndex, pageSize
```

### TC-CQA-004: Resolve Quality Error
```
Precondition: User authenticated with SITE_DATA_OWNER role, error exists
Steps:
  1. POST /api/co2-quality/errors/{errorId}/resolve
Expected:
  - Response 200
  - Error status updated to RESOLVED
```

### TC-CQA-005: Export Quality Report
```
Precondition: User authenticated with AUDITOR role
Steps:
  1. GET /api/co2-quality/report
Expected:
  - Response 200
  - Content-Type: application/pdf or application/vnd.openxmlformats...
```

## AUTHORIZATION Test Cases

### TC-CQA-010: Unauthorized Admin Access
```
Precondition: User authenticated with basic USER role
Steps:
  1. GET /api/co2-quality/rules (admin endpoint)
Expected:
  - Response 403 Forbidden
```

### TC-CQA-011: Cross-Tenant Access Prevention
```
Precondition: User authenticated in TENANT-A
Steps:
  1. GET /api/co2-quality/sites/TENANT-B/siteId/scores
Expected:
  - Response 403 or non-disclosing 404
```

## ISOLATION Test Cases

### TC-CQA-020: Tenant Data Isolation
```
Precondition: Quality data exists for TENANT-A and TENANT-B
Steps:
  1. User from TENANT-A queries GET /api/co2-quality/metrics
Expected:
  - Only TENANT-A data returned
  - TENANT-B data not visible
```

## Data Quality Calculation Test Cases

### TC-CQA-030: Completeness Score Calculation
```
Precondition: Test data with known missing fields
Input:
  - 10 records, 3 with missing emissionFactor
  - 5 with missing evidenceNote
Expected:
  - Completeness score = (10 - 3 - 5) / 10 * 100 = 20%
```

### TC-CQA-031: Accuracy Score Calculation
```
Precondition: Test data with known invalid values
Input:
  - 10 records, 2 with invalid unit (not in registry)
  - 1 with negative quantity
Expected:
  - Accuracy score based on valid records
```

### TC-CQA-032: Timeliness Score Calculation
```
Precondition: Test data with various submission timestamps
Input:
  - Records submitted within SLA window
  - Records submitted after deadline
Expected:
  - Timeliness score reflects on-time submission ratio
```

### TC-CQA-033: Consistency Score Calculation
```
Precondition: Test data with cross-field validation
Input:
  - Records where source data conflicts with ERP records
Expected:
  - Consistency score penalizes conflicting records
```

## UI Test Cases (Frontend)

### TC-CQA-040: Dashboard Renders All Quality Dimensions
```
Precondition: User authenticated, quality data exists
Steps:
  1. Navigate to /work/co2-quality-analysis
  2. Verify all 4 quality dimension cards displayed
Expected:
  - accuracy card visible
  - completeness card visible
  - timeliness card visible
  - consistency card visible
```

### TC-CQA-041: Critical Errors Highlighted
```
Precondition: Critical quality errors exist
Steps:
  1. Navigate to /work/co2-quality-analysis
  2. Check error list
Expected:
  - Critical errors have red/warning styling
  - Action buttons visible for each critical error
```

## Accessibility Test Cases

### TC-CQA-050: Color Not Only Informational
```
Precondition: Page loaded
Validation:
  - Quality scores use text labels, not just color
  - Status indicators have aria-labels
```

### TC-CQA-051: Keyboard Navigation
```
Precondition: Page loaded, focus on page
Validation:
  - Tab cycles through interactive elements
  - Enter activates buttons
```

## Notes

- These tests should be implemented as database SQL tests following the pattern in `ops/tests/verify-emission-activity-quality.sql`
- API tests should use the project's REST test conventions
- UI tests should use the project's React testing patterns
- All tests should be tenant-isolated and use test fixtures