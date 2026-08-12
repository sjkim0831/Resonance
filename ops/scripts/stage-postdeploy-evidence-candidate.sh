#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
CANDIDATE_ID="${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}"
UNIT_CODE="${1:-}"
PROCESS_CODE="${2:-}"
EVIDENCE_KIND="${3:-}"
SOURCE_COMMIT="${4:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"

fail() { printf '[postdeploy-candidate] FAIL: %s\n' "$*" >&2; exit 1; }
[[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == "candidate" ]] \
  || fail 'candidate staging requires CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate'
[[ "$CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || fail 'candidate id is missing or invalid'
[[ "$UNIT_CODE" =~ ^[A-Z0-9_]{3,80}$ ]] || fail 'unit code is invalid'
[[ "$PROCESS_CODE" =~ ^(__RELEASE__|[A-Z0-9_]{3,80})$ ]] || fail 'process code is invalid'
[[ "$EVIDENCE_KIND" =~ ^(STATIC|RUNTIME|RELEASE_GATE)$ ]] || fail 'evidence kind is invalid'
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail 'source commit is blank or invalid'
command -v jq >/dev/null || fail 'jq is required'
command -v base64 >/dev/null || fail 'base64 is required'

input="$(cat)"
[[ -n "$input" ]] || input='{}'
payload="$(jq -cS \
  --arg unit "$UNIT_CODE" --arg process "$PROCESS_CODE" --arg kind "$EVIDENCE_KIND" \
  --arg source "$SOURCE_COMMIT" \
  '. + {status:"PASS",unitCode:$unit,processCode:$process,evidenceKind:$kind,sourceCommit:$source}' \
  <<<"$input")" || fail 'evidence payload is not valid JSON'
payload_b64="$(printf '%s' "$payload" | base64 -w0)"

leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
[[ -n "$leader" ]] || fail 'PostgreSQL leader is unavailable'

result="$(kubectl -n "$NAMESPACE" exec -i "$leader" -c "$CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -At -v ON_ERROR_STOP=1 \
    -v candidate_id="$CANDIDATE_ID" -v unit_code="$UNIT_CODE" \
    -v process_code="$PROCESS_CODE" -v evidence_kind="$EVIDENCE_KIND" \
    -v source_commit="$SOURCE_COMMIT" -v payload_b64="$payload_b64" <<'SQL'
BEGIN;
-- Create/lock the durable attempt in the same transaction as every immutable
-- unit.  A terminal or candidate/source-colliding attempt fails before an
-- evidence row can be inserted.
SELECT framework_stage_postdeploy_release_attempt(:'candidate_id',:'source_commit');
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
VALUES (
  :'candidate_id',:'unit_code',:'process_code',:'evidence_kind',:'source_commit',
  convert_from(decode(:'payload_b64','base64'),'UTF8')::jsonb,''
)
ON CONFLICT (candidate_id,unit_code) DO NOTHING;

-- Division by zero makes an immutable same-unit/different-payload retry fail
-- inside this transaction without relying on psql substitution in a DO body.
SELECT 1 / CASE WHEN count(*)=1 THEN 1 ELSE 0 END
FROM framework_postdeploy_evidence_candidate
WHERE candidate_id=:'candidate_id' AND unit_code=:'unit_code'
  AND process_code=:'process_code' AND evidence_kind=:'evidence_kind'
  AND source_commit=:'source_commit'
  AND evidence_json=convert_from(decode(:'payload_b64','base64'),'UTF8')::jsonb;
SELECT evidence_hash FROM framework_postdeploy_evidence_candidate
WHERE candidate_id=:'candidate_id' AND unit_code=:'unit_code';
COMMIT;
SQL
)" || fail "unable to stage unit=$UNIT_CODE"
[[ "$result" =~ [0-9a-f]{64} ]] || fail 'database did not return a candidate evidence hash'
printf '[postdeploy-candidate] STAGED candidate=%s unit=%s process=%s hash=%s\n' \
  "$CANDIDATE_ID" "$UNIT_CODE" "$PROCESS_CODE" "${BASH_REMATCH[0]}"
