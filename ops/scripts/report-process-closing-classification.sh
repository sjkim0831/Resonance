#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REGISTRY="${BUSINESS_E2E_RUNNER_REGISTRY:-$ROOT/ops/runtime-metadata/business-e2e-runner-registry.json}"
MODE="${1:---json}"
[[ "$MODE" == --json || "$MODE" == --table || "$MODE" == --gate ]] || { echo 'usage: report-process-closing-classification.sh [--json|--table|--gate]' >&2; exit 2; }
jq -e '.runners|type=="array"' "$REGISTRY" >/dev/null
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

DB_ROWS="$(carbonet_postgres_query "WITH process AS (
 SELECT p.process_code,p.process_name,coalesce(m.step_count,0) step_count,
        coalesce(m.design_blocker_count,0) design_blockers,
        coalesce(m.missing_user_route_count,0)+coalesce(m.missing_admin_route_count,0) missing_routes,
        coalesce(m.assurance_status,'MISSING') assurance_status,
        coalesce(m.required_job_count,0) required_jobs,coalesce(m.verified_job_count,0) verified_jobs
 FROM framework_process_definition p LEFT JOIN framework_process_design_assurance_matrix m USING(process_code)
), evidence AS (
 SELECT process_code,count(*) FILTER(WHERE business_test_result='PASSED' AND current_version) current_passed
 FROM framework_current_business_e2e_evidence GROUP BY process_code
), screen AS (
 SELECT process_code,count(*) screen_count,count(*) FILTER(WHERE readiness_score=100) ready_screens
 FROM framework_professional_screen_readiness GROUP BY process_code
), simulation AS (
 SELECT c.process_code,count(DISTINCT c.case_type) FILTER(WHERE c.case_status='APPROVED') approved_types,
        count(DISTINCT c.case_type) FILTER(WHERE c.case_status='APPROVED' AND c.automated AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED')) passed_types
 FROM framework_simulation_case c GROUP BY c.process_code
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'processCode',p.process_code,'processName',p.process_name,'stepCount',p.step_count,
 'designBlockers',p.design_blockers,'missingRoutes',p.missing_routes,
 'screenCount',coalesce(s.screen_count,0),'readyScreens',coalesce(s.ready_screens,0),
 'assuranceStatus',p.assurance_status,'requiredJobs',p.required_jobs,'verifiedJobs',p.verified_jobs,
 'approvedTestTypes',coalesce(t.approved_types,0),'passedTestTypes',coalesce(t.passed_types,0),
 'currentPassedSteps',coalesce(e.current_passed,0)
) ORDER BY p.process_code),'[]'::jsonb)
FROM process p LEFT JOIN evidence e USING(process_code) LEFT JOIN screen s USING(process_code) LEFT JOIN simulation t USING(process_code);")"

REPORT="$(jq -cn --argjson rows "$DB_ROWS" --slurpfile registry "$REGISTRY" '
  ($registry[0].runners // []) as $runners |
  [$rows[] | . as $row |
    (($runners[]? | select(.processCode==$row.processCode) | .externalBlockers) // []) as $external |
    . + {externalBlockers:$external} |
    . + ({classification:
      (if ($external|length)>0 then "EXTERNAL_BLOCKED"
       elif .stepCount==0 or .designBlockers>0 or .missingRoutes>0 or .screenCount==0 or .readyScreens<.screenCount then "DESIGN_GAP"
       elif .assuranceStatus!="IMPLEMENTATION_VERIFIED" or .requiredJobs==0 or .verifiedJobs<.requiredJobs then "IMPLEMENTATION_GAP"
       elif .approvedTestTypes<5 or .passedTestTypes<.approvedTestTypes or .currentPassedSteps<.stepCount then "TEST_GAP"
       else "READY" end),
      nextAction:
      (if ($external|length)>0 then "외부 의존성 계약과 수용시험 완료"
       elif .stepCount==0 or .designBlockers>0 or .missingRoutes>0 or .screenCount==0 or .readyScreens<.screenCount then "설계·라우트·화면 계약 보완"
       elif .assuranceStatus!="IMPLEMENTATION_VERIFIED" or .requiredJobs==0 or .verifiedJobs<.requiredJobs then "화면·API·DB 구현 및 증거 연결"
       elif .approvedTestTypes<5 or .passedTestTypes<.approvedTestTypes or .currentPassedSteps<.stepCount then "프로세스 E2E 및 현재 버전 증거 생성"
       else "변경 감시" end)})
  ] as $items |
  {generatedAt:(now|todate),total:($items|length),summary:($items|group_by(.classification)|map({key:.[0].classification,value:length})|from_entries),items:$items}
')"

if [[ "$MODE" == --table ]]; then
  jq -r '"상태\t프로세스\t단계증거\t화면\t개발작업\t다음 작업",(.items[]|[.classification,.processCode,("\(.currentPassedSteps)/\(.stepCount)"),("\(.readyScreens)/\(.screenCount)"),("\(.verifiedJobs)/\(.requiredJobs)"),.nextAction]|@tsv)' <<<"$REPORT"
else
  jq . <<<"$REPORT"
fi
if [[ "$MODE" == --gate && "$(jq '.summary.READY // 0' <<<"$REPORT")" != "$(jq '.total' <<<"$REPORT")" ]]; then exit 1; fi
