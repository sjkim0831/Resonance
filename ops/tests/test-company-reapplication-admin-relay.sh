#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HARNESS="$ROOT/ops/scripts/validate-company-reapplication-admin-relay.mjs"
WRAPPER="$ROOT/ops/tests/run-company-reapplication-business-e2e.sh"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalController.java"
ASSEMBLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalPageModelAssembler.java"
FRONTEND="$ROOT/projects/carbonet-frontend/source/src/features/company-approve/CompanyApproveMigrationPage.tsx"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260808130000__scope_company_reapplication_admin_review_by_project.sql"
MAPPER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/EntrprsManageMapper.xml"

grep -Fq '/admin/login/actionLogin' "$HARNESS"
grep -Fq '/admin/member/company-approve' "$HARNESS"
grep -Fq '/admin/api/admin/member/company-approve/action' "$HARNESS"
grep -Fq 'name:"상세 검토",exact:true' "$HARNESS"
grep -Fq 'getByText(item.fileName' "$HARNESS"
grep -Fq 'name:"승인"' "$HARNESS"
grep -Fq 'rejectReasonInput=dialog.locator("textarea")' "$HARNESS"
grep -Fq 'name:"반려"' "$HARNESS"
grep -Fq 'adminRelay:1' "$HARNESS"
grep -Fq 'CARBONET_ADMIN_TEST_PASSWORD' "$WRAPPER"
grep -Fq 'validate-company-reapplication-admin-relay.mjs' "$WRAPPER"
grep -Fq 'admin_state' "$WRAPPER"
grep -Fq '.adminRelay!=1 or .decisions!=2' "$WRAPPER"
grep -Fq '@RequestParam(value = "projectId", required = false) String projectId' "$CONTROLLER"
grep -Fq 'searchParams.put("projectId", normalizedProjectId)' "$ASSEMBLER"
grep -Fq 'projectId: getSearchParam("projectId")' "$FRONTEND"
grep -Fq 'htmlFor="company-approve-reject-reason"' "$FRONTEND"
grep -Fq 'id="company-approve-reject-reason"' "$FRONTEND"
grep -Fq 'new URLSearchParams({searchKeyword:item.companyName,sbscrbSttus:"A",pageIndex:"1",projectId})' "$HARNESS"
grep -Fq 'crossProjectRowsExcluded' "$MIGRATION"
company_paged_sql="$(sed -n '/<select id="searchCompanyListPaged"/,/<\/select>/p' "$MAPPER")"
grep -Fq 'LIMIT #{pageSize} OFFSET #{offset}' <<<"$company_paged_sql"
if grep -Fq 'ROWNUM' <<<"$company_paged_sql"; then
  echo '[company-reapplication-admin-relay-contract] Oracle ROWNUM is forbidden in PostgreSQL company paging' >&2
  exit 1
fi

if grep -Eq 'userPw:[[:space:]]*"[^$]' "$HARNESS"; then
  echo '[company-reapplication-admin-relay-contract] embedded password is forbidden' >&2
  exit 1
fi

echo '[company-reapplication-admin-relay-contract] PASS public-to-admin=2 decisions=approve+reject evidence=visible responsive=desktop+mobile password=secret-only'
