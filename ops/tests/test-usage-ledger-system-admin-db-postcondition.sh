#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ACCOUNT_ID=qausageadmin26
cd "$ROOT"

# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

# The explicit transaction is read-only and always rolled back. It can safely
# be used before provisioning (exit 75) and after provisioning (PASS) without
# promoting or mutating any candidate evidence.
result="$(carbonet_postgres_query "
begin transaction read only;
select
  count(*)::text || '|' ||
  count(*) filter (where s.author_code='ROLE_SYSTEM_ADMIN')::text || '|' ||
  count(*) filter (where e.user_nm='QA Usage Ledger Admin'
    and e.email_adres='qa-usage-ledger-admin@resonance.invalid'
    and e.ofcps_nm='AUTOMATION_ONLY'
     and trim(e.instt_id)='TEST_COMPANY_001' and trim(e.orgnzt_id)='TEST_COMPANY_001' and trim(e.group_id)='TEST_COMPANY_001'
     and e.emplyr_sttus_code='P' and s.author_code='ROLE_SYSTEM_ADMIN'
     and (select count(*) from comtninsttinfo i where trim(i.instt_id)='TEST_COMPANY_001'
          and i.project_id='P003' and i.instt_sttus='P')=1
    and length(e.password)=44)::text
from comtnemplyrinfo e
left join comtnemplyrscrtyestbs s on s.scrty_dtrmn_trget_id=e.esntl_id
where lower(e.emplyr_id)='qausageadmin26';
rollback;
")"

case "$result" in
  0\|0\|0)
    printf '[usage-ledger-admin-db-postcondition] BLOCKED account=%s state=NOT_PROVISIONED transaction=ROLLED_BACK\n' "$ACCOUNT_ID" >&2
    exit 75
    ;;
  1\|1\|1)
    printf '[usage-ledger-admin-db-postcondition] PASS account=%s role=ROLE_SYSTEM_ADMIN status=P hash=SHA256_BASE64_LENGTH transaction=ROLLED_BACK\n' "$ACCOUNT_ID"
    ;;
  *)
    printf '[usage-ledger-admin-db-postcondition] FAIL account=%s state=%s transaction=ROLLED_BACK\n' "$ACCOUNT_ID" "$result" >&2
    exit 1
    ;;
esac
