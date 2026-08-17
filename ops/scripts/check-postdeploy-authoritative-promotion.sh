#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-/opt/Resonance}}"
SOURCE_COMMIT="${2:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"
CANDIDATE_ID="${3:-${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT/ops/scripts/resolve-patroni-primary-pod.sh}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG

[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ -z "$CANDIDATE_ID" || "$CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || exit 2
[[ -r "$KUBECONFIG" ]] || exit 2
leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$LEADER_RESOLVER" 2>/dev/null)" || exit 2
fi
[[ -n "$leader" ]] || exit 2

lifecycle_available="$(printf '%s\n' "select case when to_regclass('public.framework_postdeploy_release_attempt') is null then 'ABSENT' else 'AVAILABLE' end;" | \
  "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    2>/dev/null)" || exit 2
lifecycle_available="$(printf '%s' "$lifecycle_available" | tr -d '[:space:]')"
[[ "$lifecycle_available" == AVAILABLE || "$lifecycle_available" == ABSENT ]] || exit 2

if [[ "$lifecycle_available" == AVAILABLE ]]; then
exact_mode=false
[[ -z "$CANDIDATE_ID" ]] || exact_mode=true
status="$(cat <<'SQL' | "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    -v source_commit="$SOURCE_COMMIT" -v candidate_id="$CANDIDATE_ID" -v exact_mode="$exact_mode" 2>/dev/null
WITH current_runtime AS (
  SELECT source_commit,health_status,
         CASE
           WHEN NOT (to_jsonb(runtime) ? 'pod_template_sha256') THEN
             encode(sha256(convert_to(concat_ws('|',
               source_commit,deployment_namespace,deployment_name,deployment_uid,
               deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status
             ),'UTF8')),'hex')
           WHEN release_key='CARBONET_RUNTIME'
            AND source_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
            AND deployment_namespace='carbonet-prod' AND deployment_name='carbonet-runtime'
            AND deployment_uid='5a9323d6-446c-49d2-ad3e-c300c18f5803'
            AND image_ref='localhost:5000/carbonet-runtime:2026.08.14-202346-gradle'
            AND image_id='sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160'
            AND health_status='UP'
            AND to_jsonb(runtime)->>'pod_template_sha256'='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a' THEN
             encode(sha256(convert_to(concat_ws('|',
               source_commit,deployment_namespace,deployment_name,deployment_uid,
               deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status
             ),'UTF8')),'hex')
           WHEN to_jsonb(runtime)->>'pod_template_sha256' ~ '^[0-9a-f]{64}$' THEN
             encode(sha256(convert_to(jsonb_build_array(
               'CARBONET_RUNTIME_IDENTITY_V2',source_commit,deployment_namespace,deployment_name,
               deployment_uid,deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status,to_jsonb(runtime)->>'pod_template_sha256'
             )::text,'UTF8')),'hex')
           ELSE NULL
         END AS runtime_identity_hash
  FROM framework_runtime_release_state runtime
  WHERE release_key='CARBONET_RUNTIME' AND source_commit=:'source_commit'
), promotion AS (
  SELECT * FROM framework_postdeploy_evidence_promotion
  WHERE source_commit=:'source_commit'
), attempt AS (
  SELECT * FROM framework_postdeploy_release_attempt
  WHERE source_commit=:'source_commit'
    AND (
      (:'exact_mode'::boolean AND candidate_id=:'candidate_id')
      OR
      (NOT :'exact_mode'::boolean AND EXISTS (
        SELECT 1 FROM promotion
        WHERE promotion.candidate_id=framework_postdeploy_release_attempt.candidate_id
          AND promotion.source_commit=framework_postdeploy_release_attempt.source_commit
      ))
    )
), bound AS (
  SELECT attempt.*,promotion.runtime_identity_hash AS promoted_runtime_identity_hash,
         promotion.promotion_id AS bound_promotion_id,promotion.process_count,promotion.unit_count,
         promotion.promoted_definition_count,promotion.appended_validation_count,
         promotion.appended_simulation_count,promotion.marker_contract
  FROM attempt JOIN promotion USING(candidate_id,source_commit)
), canonical_bound AS (
  SELECT canonical_attempt.*,promotion.runtime_identity_hash AS promoted_runtime_identity_hash,
         promotion.promotion_id AS bound_promotion_id,promotion.process_count,promotion.unit_count,
         promotion.promoted_definition_count,promotion.appended_validation_count,
         promotion.appended_simulation_count,promotion.marker_contract
  FROM promotion JOIN framework_postdeploy_release_attempt canonical_attempt
    USING(candidate_id,source_commit)
), facts AS (
  SELECT
    (SELECT count(*) FROM promotion) AS promotion_count,
    (SELECT count(*) FROM framework_postdeploy_release_attempt
      WHERE source_commit=:'source_commit' AND attempt_status='PROMOTED') AS promoted_attempt_count,
    (SELECT count(*) FROM attempt) AS attempt_count,
    (SELECT count(*) FROM bound) AS bound_attempt_count,
    coalesce((SELECT bool_and(attempt_status='STAGED') FROM attempt),false) AS exact_staged,
    coalesce((SELECT bool_and(attempt_status='ABORTED') FROM attempt),false) AS exact_aborted,
    (SELECT count(*) FROM current_runtime) AS runtime_count,
    coalesce((SELECT bool_and(
      bound.attempt_status='PROMOTED'
      AND bound.runtime_identity_hash=bound.promoted_runtime_identity_hash
      AND bound.promotion_id=bound.bound_promotion_id
      AND bound.terminal_reason='PROMOTION_COMMITTED'
      AND current_runtime.runtime_identity_hash=bound.promoted_runtime_identity_hash
      AND current_runtime.health_status='UP'
      AND bound.process_count=6 AND bound.unit_count=12
      AND bound.promoted_definition_count=2
      AND bound.appended_validation_count=3
      AND bound.appended_simulation_count=0
      AND bound.marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
    )
    FROM bound JOIN current_runtime USING(source_commit)),false) AS exact_authority,
    coalesce((SELECT bool_and(
      canonical_bound.attempt_status='PROMOTED'
      AND canonical_bound.runtime_identity_hash=canonical_bound.promoted_runtime_identity_hash
      AND canonical_bound.promotion_id=canonical_bound.bound_promotion_id
      AND canonical_bound.terminal_reason='PROMOTION_COMMITTED'
      AND current_runtime.runtime_identity_hash=canonical_bound.promoted_runtime_identity_hash
      AND current_runtime.health_status='UP'
      AND canonical_bound.process_count=6 AND canonical_bound.unit_count=12
      AND canonical_bound.promoted_definition_count=2
      AND canonical_bound.appended_validation_count=3
      AND canonical_bound.appended_simulation_count=0
      AND canonical_bound.marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
    ) FROM canonical_bound JOIN current_runtime USING(source_commit)),false) AS canonical_authority,
    coalesce((SELECT bool_and(
      attempt.attempt_status='ABORTED'
      AND attempt.terminal_reason='RECONCILED_TO_EXISTING_SOURCE_PROMOTION'
      AND attempt.runtime_identity_hash=promotion.runtime_identity_hash
      AND attempt.candidate_id<>promotion.candidate_id
    ) FROM attempt CROSS JOIN promotion),false) AS exact_reconciled
)
SELECT CASE
  WHEN :'exact_mode'::boolean AND promotion_count=0 AND attempt_count=1 AND exact_staged
    THEN 'NOT_PROMOTED'
  WHEN NOT :'exact_mode'::boolean AND promotion_count=0 AND promoted_attempt_count=0
    THEN 'NOT_PROMOTED'
  WHEN promotion_count=1 AND promoted_attempt_count=1
       AND attempt_count=1 AND bound_attempt_count=1 AND runtime_count=1 AND exact_authority
    THEN 'PROMOTED'
  WHEN :'exact_mode'::boolean AND promotion_count=1 AND promoted_attempt_count=1
       AND attempt_count=1 AND bound_attempt_count=0 AND runtime_count=1
       AND exact_reconciled AND canonical_authority
    THEN 'PROMOTED_RECONCILED'
  WHEN :'exact_mode'::boolean AND promotion_count=0 AND attempt_count=1 AND exact_aborted
    THEN 'ABORTED'
  ELSE 'UNKNOWN'
END
FROM facts;
SQL
)" || exit 2
else
  if [[ -n "$CANDIDATE_ID" ]]; then
    status=UNKNOWN
  else
  # Upgrade bridge: before the lifecycle Flyway migration exists, a missing
  # promotion row is definitively NOT_PROMOTED.  An existing row is accepted
  # only when its complete legacy contract still binds the exact UP ledger;
  # every row/ledger divergence is UNKNOWN and can never authorize rollback.
  status="$(cat <<'SQL' | "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
      -v source_commit="$SOURCE_COMMIT" 2>/dev/null
WITH promotion AS (
  SELECT * FROM framework_postdeploy_evidence_promotion WHERE source_commit=:'source_commit'
), current_runtime AS (
  SELECT source_commit,health_status,
         CASE
           WHEN NOT (to_jsonb(runtime) ? 'pod_template_sha256') THEN
             encode(sha256(convert_to(concat_ws('|',
               source_commit,deployment_namespace,deployment_name,deployment_uid,
               deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status
             ),'UTF8')),'hex')
           WHEN release_key='CARBONET_RUNTIME'
            AND source_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
            AND deployment_namespace='carbonet-prod' AND deployment_name='carbonet-runtime'
            AND deployment_uid='5a9323d6-446c-49d2-ad3e-c300c18f5803'
            AND image_ref='localhost:5000/carbonet-runtime:2026.08.14-202346-gradle'
            AND image_id='sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160'
            AND health_status='UP'
            AND to_jsonb(runtime)->>'pod_template_sha256'='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a' THEN
             encode(sha256(convert_to(concat_ws('|',
               source_commit,deployment_namespace,deployment_name,deployment_uid,
               deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status
             ),'UTF8')),'hex')
           WHEN to_jsonb(runtime)->>'pod_template_sha256' ~ '^[0-9a-f]{64}$' THEN
             encode(sha256(convert_to(jsonb_build_array(
               'CARBONET_RUNTIME_IDENTITY_V2',source_commit,deployment_namespace,deployment_name,
               deployment_uid,deployment_generation,observed_generation,desired_replicas,
               image_ref,image_id,health_status,to_jsonb(runtime)->>'pod_template_sha256'
             )::text,'UTF8')),'hex')
           ELSE NULL
         END AS runtime_identity_hash
  FROM framework_runtime_release_state runtime
  WHERE release_key='CARBONET_RUNTIME' AND source_commit=:'source_commit'
), facts AS (
  SELECT (SELECT count(*) FROM promotion) promotion_count,
         (SELECT count(*) FROM current_runtime) runtime_count,
         coalesce((SELECT bool_and(
           runtime.health_status='UP'
           AND promotion.runtime_identity_hash=runtime.runtime_identity_hash
           AND promotion.process_count=6 AND promotion.unit_count=12
           AND promotion.promoted_definition_count=2
           AND promotion.appended_validation_count=3
           AND promotion.appended_simulation_count=0
           AND promotion.marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
         ) FROM promotion JOIN current_runtime runtime USING(source_commit)),false) exact_authority
)
SELECT CASE
  WHEN promotion_count=0 THEN 'NOT_PROMOTED'
  WHEN promotion_count=1 AND runtime_count=1 AND exact_authority THEN 'PROMOTED'
  ELSE 'UNKNOWN'
END FROM facts;
SQL
  )" || exit 2
  fi
fi
status="$(printf '%s' "$status" | tr -d '[:space:]')"
case "$status" in
  PROMOTED) printf 'PROMOTED\n'; exit 0 ;;
  PROMOTED_RECONCILED) printf 'PROMOTED_RECONCILED\n'; exit 0 ;;
  NOT_PROMOTED) printf 'NOT_PROMOTED\n'; exit 1 ;;
  ABORTED) printf 'ABORTED\n'; exit 3 ;;
  UNKNOWN) printf 'UNKNOWN\n'; exit 2 ;;
  *) exit 2 ;;
esac
