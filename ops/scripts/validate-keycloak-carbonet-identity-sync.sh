#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
USERNAME="${IDENTITY_SYNC_VERIFY_USERNAME:-sjkim}"
integrated_username="$(
  kubectl -n "$NAMESPACE" get secret resonance-keycloak-integrated-admin \
    -o jsonpath='{.data.USERNAME}' | base64 -d
)"
integrated_password="$(
  kubectl -n "$NAMESPACE" get secret resonance-keycloak-integrated-admin \
    -o jsonpath='{.data.PASSWORD}' | base64 -d
)"
expected_password_hash="$(
  printf '%s%s' "$integrated_username" "$integrated_password" |
    openssl dgst -sha256 -binary | base64 -w0
)"
integrated_password=

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
      select e.emplyr_id,
             s.author_code,
             count(distinct a.actor_code),
             max(sync.result_code),
             bool_and(e.password='$expected_password_hash'),
             bool_and(a.tenant_id=sync.detail_json->>'tenantId'),
             bool_and((sync.detail_json->'projectScopes') ? a.project_id),
             bool_and(a.data_scope=sync.detail_json->>'dataScope')
        from comtnemplyrinfo e
        join comtnemplyrscrtyestbs s
          on trim(s.scrty_dtrmn_trget_id)=trim(e.esntl_id)
        join framework_account_actor_assignment a
          on lower(a.account_id)=lower(e.emplyr_id)
         and a.assignment_status='ACTIVE'
        join lateral (
          select audit.result_code,audit.detail_json
            from framework_identity_sync_audit audit
           where lower(audit.account_id)=lower(e.emplyr_id)
           order by audit.sync_id desc
           limit 1
        ) sync on true
       where lower(trim(e.emplyr_id))=lower('$USERNAME')
       group by e.emplyr_id,s.author_code"
)"
IFS='|' read -r user_id author_code actor_count result_code password_matches tenant_matches project_matches data_matches <<<"$result"
echo "[identity-sync-verify] observed username=${user_id:-missing} author=${author_code:-missing} actors=${actor_count:-0} audit=${result_code:-missing} password=${password_matches:-missing} tenant=${tenant_matches:-missing} project=${project_matches:-missing} data=${data_matches:-missing}"
[[ "${user_id,,}" == "${USERNAME,,}" ]]
[[ "$author_code" == "ROLE_SYSTEM_MASTER" ]]
[[ "${actor_count:-0}" -ge 10 ]]
[[ "$result_code" == "SYNCHRONIZED" ]]
[[ "$password_matches" == "t" ]]
[[ "$tenant_matches" == "t" ]]
[[ "$project_matches" == "t" ]]
[[ "$data_matches" == "t" ]]

echo "[identity-sync-verify] PASS username=$USERNAME author=$author_code actors=$actor_count scopes=verified"
