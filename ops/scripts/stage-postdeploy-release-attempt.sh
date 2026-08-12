#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
CANDIDATE_ID="${2:-${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}}"
SOURCE_COMMIT="${3:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT/ops/scripts/resolve-patroni-primary-pod.sh}"
JOURNAL_HELPER="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-$ROOT/ops/scripts/postdeploy-attempt-journal.py}"

fail() { printf '[postdeploy-attempt-stage] FAIL: %s\n' "$*" >&2; exit 1; }
[[ "$CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || fail 'candidate id is invalid'
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail 'source commit is invalid'
[[ -f "$JOURNAL_HELPER" && ! -L "$JOURNAL_HELPER" && -r "$JOURNAL_HELPER" ]] \
  || fail 'journal helper is unavailable or unsafe'
helper_mode="$(stat -c '%a' "$JOURNAL_HELPER" 2>/dev/null || true)"
[[ "$helper_mode" == 755 || "$helper_mode" == 750 || "$helper_mode" == 700 ]] \
  || fail 'journal helper mode is unsafe'

leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$LEADER_RESOLVER")"
fi
[[ -n "$leader" ]] || fail 'PostgreSQL leader is unavailable'

lifecycle_available="$(printf '%s\n' "select case when to_regprocedure('framework_stage_postdeploy_release_attempt(character varying,character varying)') is null then 'ABSENT' else 'AVAILABLE' end;" | \
  "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1)" \
  || fail 'attempt lifecycle lookup failed'
lifecycle_available="$(printf '%s' "$lifecycle_available" | tr -d '[:space:]')"
if [[ "$lifecycle_available" == ABSENT ]]; then
  printf '[postdeploy-attempt-stage] LIFECYCLE_UNAVAILABLE candidate=%s source=%s\n' \
    "$CANDIDATE_ID" "$SOURCE_COMMIT"
  exit 3
fi
[[ "$lifecycle_available" == AVAILABLE ]] || fail 'attempt lifecycle lookup returned an unknown state'

result="$(cat <<'SQL' | "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    -v candidate_id="$CANDIDATE_ID" -v source_commit="$SOURCE_COMMIT"
SELECT framework_stage_postdeploy_release_attempt(:'candidate_id',:'source_commit')::text;
SQL
)" || fail 'attempt stage transaction failed'
jq -e --arg candidate "$CANDIDATE_ID" --arg source "$SOURCE_COMMIT" '
  .status=="STAGED" and .candidateId==$candidate and .sourceCommit==$source
' <<<"$result" >/dev/null || fail 'attempt stage result contract mismatch'
if [[ -n "${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-}" ]]; then
  python3 "$JOURNAL_HELPER" \
    --file "$CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
    mark-db-staged "$CANDIDATE_ID" "$SOURCE_COMMIT" >/dev/null \
    || fail 'DB staged but durable journal arm failed'
fi
printf '[postdeploy-attempt-stage] %s\n' "$result"
