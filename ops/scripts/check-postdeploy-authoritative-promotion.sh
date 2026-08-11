#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-/opt/Resonance}}"
SOURCE_COMMIT="${2:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG

[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ -r "$KUBECONFIG" ]] || exit 2
leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh" 2>/dev/null)" || exit 2
fi
[[ -n "$leader" ]] || exit 2

status="$(cat <<'SQL' | "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    -v source_commit="$SOURCE_COMMIT" 2>/dev/null
WITH current_runtime AS (
  SELECT source_commit,health_status,
         encode(sha256(convert_to(concat_ws('|',
           source_commit,deployment_namespace,deployment_name,deployment_uid,
           deployment_generation,observed_generation,desired_replicas,
           image_ref,image_id,health_status
         ),'UTF8')),'hex') AS runtime_identity_hash
  FROM framework_runtime_release_state
  WHERE release_key='CARBONET_RUNTIME' AND source_commit=:'source_commit'
), authoritative AS (
  SELECT 1
  FROM current_runtime runtime
  JOIN framework_postdeploy_evidence_promotion promotion
    ON promotion.source_commit=runtime.source_commit
   AND promotion.runtime_identity_hash=runtime.runtime_identity_hash
  WHERE runtime.health_status='UP'
    AND promotion.process_count=6 AND promotion.unit_count=12
    AND promotion.promoted_definition_count=2
    AND promotion.appended_validation_count=3
    AND promotion.appended_simulation_count=0
    AND promotion.marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
)
SELECT CASE WHEN EXISTS(SELECT 1 FROM authoritative)
            THEN 'PROMOTED' ELSE 'NOT_PROMOTED' END;
SQL
)" || exit 2
status="$(printf '%s' "$status" | tr -d '[:space:]')"
case "$status" in
  PROMOTED) printf 'PROMOTED\n'; exit 0 ;;
  NOT_PROMOTED) printf 'NOT_PROMOTED\n'; exit 1 ;;
  *) exit 2 ;;
esac
