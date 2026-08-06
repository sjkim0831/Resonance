#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TENANT="${1:?tenant id is required}"
[[ "$TENANT" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "invalid tenant id" >&2; exit 2; }
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

carbonet_postgres_query "WITH actors AS (
 SELECT actor_code,count(DISTINCT lower(account_id)) AS accounts
 FROM framework_account_actor_assignment
 WHERE tenant_id='$TENANT' AND assignment_status='ACTIVE'
   AND (valid_until IS NULL OR valid_until>=current_date)
   AND actor_code IN ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER')
 GROUP BY actor_code
), conflicts AS (
 SELECT count(*) AS accounts FROM (
  SELECT lower(account_id) FROM framework_account_actor_assignment
  WHERE tenant_id='$TENANT' AND assignment_status='ACTIVE'
    AND (valid_until IS NULL OR valid_until>=current_date)
    AND actor_code IN ('CALCULATOR','VERIFIER','APPROVER')
  GROUP BY lower(account_id) HAVING count(DISTINCT actor_code)>1
 ) q
)
SELECT concat_ws('|','$TENANT',
 (SELECT count(*) FROM emission_site_registry WHERE tenant_id='$TENANT' AND site_status='ACTIVE' AND (effective_until IS NULL OR effective_until>=current_date)),
 coalesce((SELECT string_agg(actor_code||':'||accounts,',' ORDER BY actor_code) FROM actors),''),
 (SELECT accounts FROM conflicts))"
