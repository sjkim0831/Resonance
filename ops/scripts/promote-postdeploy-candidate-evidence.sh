#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
CANDIDATE_ID="${2:-${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}}"
SOURCE_COMMIT="${3:-${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}}"
MARKER_FILE="${4:-${DEPLOY_STATE_FILE:-}}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
RUNTIME_CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"

fail() { printf '[postdeploy-promoter] FAIL: %s\n' "$*" >&2; exit 1; }
[[ "$CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || fail 'candidate id is missing or invalid'
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail 'source commit is blank or invalid'
[[ -n "$MARKER_FILE" ]] || fail 'deployment marker path is required'

marker_dir="$(dirname "$MARKER_FILE")"
marker_name="$(basename "$MARKER_FILE")"
[[ "$marker_name" != . && "$marker_name" != .. ]] || fail 'deployment marker basename is unsafe'
mkdir -p "$marker_dir"
[[ -d "$marker_dir" && -w "$marker_dir" ]] || fail 'deployment marker directory is not writable'
marker_dir="$(realpath "$marker_dir")"
MARKER_FILE="$marker_dir/$marker_name"
if [[ -e "$MARKER_FILE" || -L "$MARKER_FILE" ]]; then
  [[ -f "$MARKER_FILE" && ! -L "$MARKER_FILE" ]] \
    || fail 'deployment marker target must be a regular non-symlink file'
fi
MARKER_TMP="$(mktemp "$marker_dir/.${marker_name}.candidate.XXXXXX")"
trap 'rm -f -- "$MARKER_TMP"' EXIT

# Prepare and verify the exact marker before any current evidence is promoted.
# The temporary file lives in the destination directory, so the final rename is
# one-filesystem atomic.  If that rename is interrupted, the DB promotion row is
# authoritative and an idempotent retry performs only this reconciliation.
printf '%s\n' "$SOURCE_COMMIT" >"$MARKER_TMP"
chmod 0644 "$MARKER_TMP"
[[ "$(tr -d '[:space:]' <"$MARKER_TMP")" == "$SOURCE_COMMIT" ]] || fail 'prepared marker content mismatch'
marker_hash="$(sha256sum "$MARKER_TMP" | awk '{print $1}')"
[[ "$marker_hash" == "$(printf '%s\n' "$SOURCE_COMMIT" | sha256sum | awk '{print $1}')" ]] \
  || fail 'prepared marker hash mismatch'
[[ "$(stat -c %d "$MARKER_TMP")" == "$(stat -c %d "$marker_dir")" ]] || fail 'marker temp is not on the destination filesystem'

leader="${RESONANCE_POSTGRES_LEADER_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
[[ -n "$leader" ]] || fail 'PostgreSQL leader is unavailable'

db_psql() {
  "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 "$@"
}

# Runtime-smoke evidence is intentionally outside PostgreSQL so an operator can
# inspect the exact response body.  Bind the two candidate rows to immutable,
# regular files owned by this deployment user before any database promotion.
evidence_root="$(realpath -e "${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-$ROOT/var/test-evidence/process-runtime-smoke}")" \
  || fail 'runtime evidence root is unavailable'
candidate_runtime_files="$(db_psql -v candidate_id="$CANDIDATE_ID" -v source_commit="$SOURCE_COMMIT" <<'SQL'
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'unitCode',unit_code,
  'path',evidence_json->>'runtimeEvidence',
  'sha256',evidence_json->>'runtimeEvidenceHash'
) ORDER BY unit_code),'[]'::jsonb)::text
FROM framework_postdeploy_evidence_candidate
WHERE candidate_id=:'candidate_id' AND source_commit=:'source_commit'
  AND unit_code IN ('GOVERNANCE_CHANGE_RUNTIME','ORGANIZATIONAL_BOUNDARY_RUNTIME');
SQL
)" || fail 'candidate runtime evidence lookup failed'
jq -e 'length==2 and ([.[].unitCode]|sort)==["GOVERNANCE_CHANGE_RUNTIME","ORGANIZATIONAL_BOUNDARY_RUNTIME"]
  and ([.[].path]|unique|length)==2
  and all(.[];.path|type=="string" and length>0)
  and all(.[];.sha256|test("^[0-9a-f]{64}$"))' <<<"$candidate_runtime_files" >/dev/null \
  || fail 'candidate runtime evidence payload contract mismatch'
while IFS=$'\t' read -r evidence_unit evidence_path expected_hash; do
  [[ -n "$evidence_unit" && -n "$evidence_path" && -n "$expected_hash" ]] \
    || fail 'candidate runtime evidence row is incomplete'
  [[ ! -L "$evidence_path" ]] || fail "runtime evidence is a symlink unit=$evidence_unit"
  evidence_real="$(realpath -e "$evidence_path" 2>/dev/null || true)"
  [[ -n "$evidence_real" && "$evidence_path" == "$evidence_real" && "$evidence_real" == "$evidence_root"/* ]] \
    || fail "runtime evidence escaped its owned root unit=$evidence_unit"
  [[ -f "$evidence_real" && "$(stat -c %u "$evidence_real")" == "$(id -u)" \
     && "$(stat -c %a "$evidence_real")" == 444 ]] \
    || fail "runtime evidence ownership/mode contract mismatch unit=$evidence_unit"
  [[ "$(sha256sum "$evidence_real" | awk '{print $1}')" == "$expected_hash" ]] \
    || fail "runtime evidence hash mismatch unit=$evidence_unit"
done < <(jq -r '.[]|[.unitCode,.path,.sha256]|@tsv' <<<"$candidate_runtime_files")

deployment_json="$("$KUBECTL_BIN" -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" \
  || fail 'runtime deployment cannot be read'
jq -e --arg namespace "$NAMESPACE" --arg deployment "$DEPLOYMENT" \
  --arg container "$RUNTIME_CONTAINER" --arg commit "$SOURCE_COMMIT" '
  .metadata.namespace==$namespace and .metadata.name==$deployment
  and .metadata.annotations["resonance.ai/target-commit"]==$commit
  and (.metadata.uid | type=="string" and length>0)
  and ((.metadata.generation // 0)>0)
  and ((.status.observedGeneration // -1)>=(.metadata.generation // 0))
  and ((.spec.replicas // 0)>0)
  and ((.status.updatedReplicas // 0)==(.spec.replicas // 0))
  and ((.status.readyReplicas // 0)==(.spec.replicas // 0))
  and ((.status.availableReplicas // 0)==(.spec.replicas // 0))
  and ((.status.unavailableReplicas // 0)==0)
  and ([.spec.template.spec.containers[] | select(.name==$container)] | length)==1
  and ([.spec.template.spec.containers[] | select(.name==$container) | .image]
       | length==1 and (.[0] | type=="string" and length>0))
' <<<"$deployment_json" >/dev/null || fail 'runtime deployment identity/readiness contract mismatch'

deployment_uid="$(jq -r '.metadata.uid' <<<"$deployment_json")"
deployment_generation="$(jq -r '.metadata.generation' <<<"$deployment_json")"
observed_generation="$(jq -r '.status.observedGeneration' <<<"$deployment_json")"
desired="$(jq -r '.spec.replicas' <<<"$deployment_json")"
updated="$(jq -r '.status.updatedReplicas' <<<"$deployment_json")"
ready="$(jq -r '.status.readyReplicas' <<<"$deployment_json")"
available="$(jq -r '.status.availableReplicas' <<<"$deployment_json")"
image_ref="$(jq -r --arg container "$RUNTIME_CONTAINER" \
  '.spec.template.spec.containers[] | select(.name==$container) | .image' <<<"$deployment_json")"
selector="$(jq -r '.spec.selector.matchLabels // {} | to_entries | map("\(.key)=\(.value)") | join(",")' \
  <<<"$deployment_json")"
[[ -n "$selector" ]] || fail 'runtime deployment pod selector is unavailable'
pods_json="$("$KUBECTL_BIN" -n "$NAMESPACE" get pods -l "$selector" -o json)" \
  || fail 'runtime pods cannot be read'
ready_runtime_pods="$(jq -c --arg container "$RUNTIME_CONTAINER" --arg image "$image_ref" '
  [.items[]
   | select(.status.phase=="Running")
   | select(any(.spec.containers[]?; .name==$container and .image==$image))
   | select(any(.status.conditions[]?; .type=="Ready" and .status=="True"))
   | select(any(.status.containerStatuses[]?; .name==$container and .ready==true))
   | {name:.metadata.name,
      imageId:([.status.containerStatuses[] | select(.name==$container) | .imageID][0] // "")}]
' <<<"$pods_json")"
[[ "$(jq -r 'length' <<<"$ready_runtime_pods")" == "$desired" ]] \
  || fail 'Ready exact-image runtime pod count does not match desired replicas'
runtime_image_id_count="$(jq -r '[.[].imageId | select(length>0)] | unique | length' <<<"$ready_runtime_pods")"
runtime_image_id="$(jq -r '.[0].imageId // empty' <<<"$ready_runtime_pods")"
[[ "$runtime_image_id_count" == "1" && "$runtime_image_id" =~ sha256:[0-9a-f]{64}$ ]] \
  || fail 'Ready exact-image runtime pods do not share one immutable imageID'
mapfile -t runtime_pods < <(jq -r '.[].name' <<<"$ready_runtime_pods")
[[ "${#runtime_pods[@]}" == "$desired" ]] || fail 'exact runtime pod list is incomplete'
for runtime_pod in "${runtime_pods[@]}"; do
  health="$("$KUBECTL_BIN" -n "$NAMESPACE" exec "$runtime_pod" -c "$RUNTIME_CONTAINER" -- \
    curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health)" \
    || fail "exact runtime pod health request failed pod=$runtime_pod"
  jq -e '.status=="UP"' <<<"$health" >/dev/null \
    || fail "exact runtime pod health is not UP pod=$runtime_pod"
done

runtime_ledger="$(db_psql <<'SQL'
SELECT jsonb_build_object(
  'releaseKey',release_key,'sourceCommit',source_commit,
  'deploymentNamespace',deployment_namespace,'deploymentName',deployment_name,
  'deploymentUid',deployment_uid,'deploymentGeneration',deployment_generation,
  'observedGeneration',observed_generation,'desiredReplicas',desired_replicas,
  'imageRef',image_ref,'imageId',image_id,'healthStatus',health_status,
  'runtimeIdentityHash',encode(sha256(convert_to(concat_ws('|',
    source_commit,deployment_namespace,deployment_name,deployment_uid,
    deployment_generation,observed_generation,desired_replicas,
    image_ref,image_id,health_status
  ),'UTF8')),'hex')
)::text
FROM framework_runtime_release_state
WHERE release_key='CARBONET_RUNTIME';
SQL
)" || fail 'runtime release ledger lookup failed'
jq -e --arg commit "$SOURCE_COMMIT" --arg namespace "$NAMESPACE" \
  --arg deployment "$DEPLOYMENT" --arg uid "$deployment_uid" \
  --arg image "$image_ref" --arg imageId "$runtime_image_id" \
  --argjson generation "$deployment_generation" --argjson observed "$observed_generation" \
  --argjson desired "$desired" --argjson updated "$updated" \
  --argjson ready "$ready" --argjson available "$available" '
  .releaseKey=="CARBONET_RUNTIME" and .sourceCommit==$commit
  and .deploymentNamespace==$namespace and .deploymentName==$deployment
  and .deploymentUid==$uid and .deploymentGeneration==$generation
  and .observedGeneration==$observed and .desiredReplicas==$desired
  and $updated==$desired and $ready==$desired and $available==$desired
  and .imageRef==$image and .imageId==$imageId and .healthStatus=="UP"
  and (.runtimeIdentityHash | test("^[0-9a-f]{64}$"))
' <<<"$runtime_ledger" >/dev/null || fail 'runtime ledger and Kubernetes identity mismatch'
runtime_identity_hash="$(jq -r '.runtimeIdentityHash' <<<"$runtime_ledger")"

# Re-read the same-dir marker immediately before entering the promotion
# transaction. The global deploy flock serializes legitimate deployers; this
# second content/hash check also catches accidental or hostile temp-file edits.
[[ -f "$MARKER_TMP" && ! -L "$MARKER_TMP" \
   && "$(tr -d '[:space:]' <"$MARKER_TMP")" == "$SOURCE_COMMIT" \
   && "$(sha256sum "$MARKER_TMP" | awk '{print $1}')" == "$marker_hash" ]] \
  || fail 'prepared marker changed before promotion'

promotion="$("$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$DB_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -qAt -v ON_ERROR_STOP=1 \
    -v candidate_id="$CANDIDATE_ID" -v source_commit="$SOURCE_COMMIT" \
    -v runtime_identity_hash="$runtime_identity_hash" <<'SQL'
BEGIN;
SELECT framework_promote_postdeploy_evidence_candidate(
  :'candidate_id',:'source_commit',:'runtime_identity_hash')::text;
COMMIT;
SQL
)" || fail 'atomic database promotion failed'
  jq -e --arg candidate "$CANDIDATE_ID" --arg source "$SOURCE_COMMIT" \
    --arg runtimeHash "$runtime_identity_hash" '
  ((.status=="PROMOTED" and .candidateId==$candidate and .runtimeIdentityHash==$runtimeHash)
   or (.status=="ALREADY_PROMOTED" and .requestedCandidateId==$candidate))
  and .sourceCommit==$source
  and .processCount==6 and .unitCount==12
' <<<"$promotion" >/dev/null || fail 'promotion result contract mismatch'

# Do not add fallible gates after this point.  A failed mv leaves the exact DB
# promotion truthfully bound to the healthy commit.  A retry may reconcile this
# marker only after repeating the exact K8s/pod/health/locked-ledger identity
# checks above; it must never resurrect a marker for a rolled-back runtime.
mv -fT -- "$MARKER_TMP" "$MARKER_FILE" || fail 'atomic deployment marker exact-target rename failed'
trap - EXIT
# Marker rename is the last fallible operation. A closed log pipe must never
# turn a fully promoted runtime into a reported deployment failure.
printf '[postdeploy-promoter] %s marker=%s\n' "$promotion" "$MARKER_FILE" || true
