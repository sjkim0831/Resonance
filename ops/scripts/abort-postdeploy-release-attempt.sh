#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
CANDIDATE_ID="${2:-${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}}"
SOURCE_COMMIT="${3:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"
RUNTIME_IDENTITY_HASH="${4:--}"
REASON="${5:-DEPLOYMENT_FAILED}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT/ops/scripts/resolve-patroni-primary-pod.sh}"

fail() { printf '[postdeploy-attempt-abort] FAIL: %s\n' "$*" >&2; exit 1; }
[[ "$CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || fail 'candidate id is invalid'
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail 'source commit is invalid'
[[ "$RUNTIME_IDENTITY_HASH" == - || "$RUNTIME_IDENTITY_HASH" =~ ^[0-9a-f]{64}$ ]] \
  || fail 'runtime identity hash is invalid'
[[ "$REASON" =~ ^[A-Z0-9_:-]{3,160}$ ]] || fail 'abort reason is invalid'

leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$LEADER_RESOLVER")"
fi
[[ -n "$leader" ]] || fail 'PostgreSQL leader is unavailable'

lifecycle_available="$(printf '%s\n' "select case when to_regprocedure('framework_abort_postdeploy_release_attempt(character varying,character varying,character varying,character varying)') is null then 'ABSENT' else 'AVAILABLE' end;" | \
  "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1)" \
  || fail 'attempt lifecycle lookup failed'
lifecycle_available="$(printf '%s' "$lifecycle_available" | tr -d '[:space:]')"
if [[ "$lifecycle_available" == ABSENT ]]; then
  printf '[postdeploy-attempt-abort] LIFECYCLE_UNAVAILABLE candidate=%s source=%s\n' \
    "$CANDIDATE_ID" "$SOURCE_COMMIT"
  exit 3
fi
[[ "$lifecycle_available" == AVAILABLE ]] || fail 'attempt lifecycle lookup returned an unknown state'

runtime_sql=NULL
[[ "$RUNTIME_IDENTITY_HASH" == - ]] || runtime_sql="'$RUNTIME_IDENTITY_HASH'"
result="$(cat <<SQL | "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    -v candidate_id="$CANDIDATE_ID" -v source_commit="$SOURCE_COMMIT" -v reason="$REASON"
SELECT framework_abort_postdeploy_release_attempt(
  :'candidate_id',:'source_commit',$runtime_sql,:'reason')::text;
SQL
)" || fail 'attempt abort transaction failed'
jq -e --arg candidate "$CANDIDATE_ID" --arg source "$SOURCE_COMMIT" --arg reason "$REASON" '
  .status=="ABORTED" and .candidateId==$candidate and .sourceCommit==$source and .reason==$reason
' <<<"$result" >/dev/null || fail 'attempt abort result contract mismatch'
printf '[postdeploy-attempt-abort] %s\n' "$result"
