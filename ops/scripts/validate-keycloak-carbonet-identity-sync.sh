#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
USERNAME="${IDENTITY_SYNC_VERIFY_USERNAME:-sjkim}"

find_leader() {
  local podref pod state
  while IFS= read -r podref; do
    pod="${podref#pod/}"
    state="$(kubectl -n carbonet-prod exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)"
    [[ "$state" == "f" ]] && {
      printf '%s' "$pod"
      return 0
    }
  done < <(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name)
  return 1
}

leader="$(find_leader)"
result="$(
  kubectl -n carbonet-prod exec "$leader" -c patroni -- \
    psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -AtF '|' -c "
      select u.user_id,
             s.author_code,
             count(distinct a.actor_code),
             max(sync.result_code)
        from comvnusermaster u
        join comtnemplyrscrtyestbs s
          on trim(s.scrty_dtrmn_trget_id)=trim(u.esntl_id)
        join framework_account_actor_assignment a
          on lower(a.account_id)=lower(u.user_id)
         and a.assignment_status='ACTIVE'
        join framework_identity_sync_audit sync
          on lower(sync.account_id)=lower(u.user_id)
       where lower(trim(u.user_id))=lower('$USERNAME')
       group by u.user_id,s.author_code"
)"
IFS='|' read -r user_id author_code actor_count result_code <<<"$result"
[[ "${user_id,,}" == "${USERNAME,,}" ]]
[[ "$author_code" == "ROLE_SYSTEM_MASTER" ]]
[[ "${actor_count:-0}" -ge 10 ]]
[[ "$result_code" == "SYNCHRONIZED" ]]

echo "[identity-sync-verify] PASS username=$USERNAME author=$author_code actors=$actor_count"
