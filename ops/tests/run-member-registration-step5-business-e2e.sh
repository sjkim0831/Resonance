#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
LOCK_FILE="${MEMBER_REGISTRATION_STEP5_LOCK_FILE:-/tmp/resonance-member-registration-step5-e2e.lock}"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo '[member-step5-e2e] already running' >&2; exit 75; }

approval="$(timeout 180 bash "$ROOT/ops/tests/run-member-approval-business-e2e.sh")"
jq -e '.status=="PASS" and .happy==1 and .auth==1 and .exception==1 and .isolation==1 and .recovery==1 and .database==1 and .audit==1 and .cleanup==1' \
  >/dev/null <<<"$approval"

completion="$(timeout 90 node "$ROOT/ops/scripts/member-registration-step5-e2e.mjs")"
jq -e '.status=="PASS" and .processCode=="MEMBER_REGISTRATION" and .stepCode=="MEMBER_REGISTRATION_S5"
  and .caseCount==5 and .responsive==1 and .accessibility==1
  and ([.results[].caseType]|sort)==(["AUTHORITY","EXCEPTION","HAPPY_PATH","ISOLATION","RECOVERY"]|sort)
  and ([.results[].passed]|all(.==1))' >/dev/null <<<"$completion"

evidence_hash="$(printf '%s\n%s' "$approval" "$completion" | sha256sum | awk '{print $1}')"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }

q "begin;
insert into framework_simulation_run(
  case_code,process_version,result,failure_reason,evidence_json,executed_by,
  source_commit,execution_environment,evidence_hash
)
select c.case_code,p.process_version,'PASSED',null,
  jsonb_build_object(
    'evidenceType','MEMBER_REGISTRATION_STEP5_BUSINESS_E2E',
    'sourceCommit','$SOURCE_COMMIT','evidenceSha256','$evidence_hash',
    'publicCompletion',true,'administratorApprovalAndRejection',true,
    'responsive',true,'accessibility',true,'databaseReread',true,
    'audit',true,'cleanup',true,'caseType',c.case_type
  )::text,
  'member-registration-step5-relay-e2e','$SOURCE_COMMIT',
  'production-runtime+browser+admin-handoff','$evidence_hash'
from framework_simulation_case c
join framework_process_definition p using(process_code)
where c.process_code='MEMBER_REGISTRATION'
  and c.case_code like 'MEMBER_REGISTRATION_S5_%'
  and c.case_status='APPROVED'
  and not exists(
    select 1 from framework_simulation_run r
     where r.case_code=c.case_code and r.result='PASSED'
       and r.executed_by='member-registration-step5-relay-e2e'
       and r.source_commit='$SOURCE_COMMIT' and r.evidence_hash='$evidence_hash'
  );
do \$\$ declare passed_count integer; begin
  select count(*) into passed_count from framework_simulation_case c
   where c.process_code='MEMBER_REGISTRATION'
     and c.case_code like 'MEMBER_REGISTRATION_S5_%'
     and exists(select 1 from framework_simulation_run r
       where r.case_code=c.case_code and r.result='PASSED'
         and r.executed_by='member-registration-step5-relay-e2e'
         and r.execution_environment='production-runtime+browser+admin-handoff');
  if passed_count<>5 then raise exception 'member step5 evidence mismatch %/5',passed_count; end if;
end \$\$;
commit;" >/dev/null

echo "[member-step5-e2e] PASS cases=5 public-completion=1 admin-handoff=1 database=1 audit=1 cleanup=1 evidence=${evidence_hash:0:12}"
