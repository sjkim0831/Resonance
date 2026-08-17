#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
RUNTIME_CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
CHECKPOINT_FILE="${CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE:-/opt/resonance-data/deploy/carbonet-runtime-candidate.json}"
ATTEMPT_JOURNAL_FILE="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-/opt/resonance-data/deploy/postdeploy-attempt.json}"
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

# Runtime/image mutations are still rollback-capable while units execute, and
# the current runtime DB singleton is deliberately absent. Authenticate the
# attempt with the owned RUNTIME_CANDIDATE_READY checkpoint when available;
# non-rollout candidate paths use the equally owned/armed durable journal and
# let the first exact live snapshot become the attempt's one-time DB binding.
checkpoint_mode=journal
checkpoint_json='{}'
if [[ -e "$CHECKPOINT_FILE" || -L "$CHECKPOINT_FILE" ]]; then
  [[ -f "$CHECKPOINT_FILE" && ! -L "$CHECKPOINT_FILE" \
     && "$(stat -c '%a:%u' "$CHECKPOINT_FILE" 2>/dev/null)" == "644:$(id -u)" ]] \
    || fail 'runtime candidate checkpoint ownership/mode is invalid'
  checkpoint_json="$(cat "$CHECKPOINT_FILE")" || fail 'runtime candidate checkpoint cannot be read'
  jq -e --arg source "$SOURCE_COMMIT" '
    .schemaVersion==1 and .stage=="RUNTIME_CANDIDATE_READY" and .targetCommit==$source
    and (.deploymentUid|type=="string" and length>0)
    and (.deploymentGeneration|type=="number" and .>0)
    and (.desiredReplicas|type=="number" and .>0)
    and (.imageRef|type=="string" and length>0)
    and (.imageIdDigest|test("sha256:[0-9a-f]{64}$"))
    and (.podTemplateSha256|test("^[0-9a-f]{64}$"))
  ' <<<"$checkpoint_json" >/dev/null \
    || fail 'runtime candidate checkpoint identity is invalid'
  checkpoint_mode=runtime-ready
else
  [[ -f "$ATTEMPT_JOURNAL_FILE" && ! -L "$ATTEMPT_JOURNAL_FILE" \
     && "$(stat -c '%a:%u' "$ATTEMPT_JOURNAL_FILE" 2>/dev/null)" == "600:$(id -u)" ]] \
    || fail 'durable attempt journal ownership/mode is invalid'
  jq -e --arg candidate "$CANDIDATE_ID" --arg source "$SOURCE_COMMIT" '
    .schemaVersion==2 and .lifecycleStatus=="STAGED" and .rollbackStage=="ARMED"
    and .dbAttemptStaged==true and .candidateId==$candidate and .sourceCommit==$source
  ' "$ATTEMPT_JOURNAL_FILE" >/dev/null || fail 'durable attempt journal identity is invalid'
fi

deployment_json="$("$KUBECTL_BIN" -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" \
  || fail 'candidate runtime deployment cannot be read'
jq -e --arg namespace "$NAMESPACE" --arg deployment "$DEPLOYMENT" --arg container "$RUNTIME_CONTAINER" \
  --arg source "$SOURCE_COMMIT" '
  .metadata.namespace==$namespace and .metadata.name==$deployment
  and .metadata.annotations["resonance.ai/target-commit"]==$source
  and (.metadata.resourceVersion|type=="string" and length>0)
  and (.metadata.uid|type=="string" and length>0)
  and ((.metadata.generation // 0)>0)
  and ((.status.observedGeneration // -1)==(.metadata.generation // 0))
  and ((.spec.replicas // 0)>0)
  and ((.status.updatedReplicas // 0)==(.spec.replicas // 0))
  and ((.status.readyReplicas // 0)==(.spec.replicas // 0))
  and ((.status.availableReplicas // 0)==(.spec.replicas // 0))
  and ((.status.unavailableReplicas // 0)==0)
  and ([.spec.template.spec.containers[]|select(.name==$container)]|length)==1
' <<<"$deployment_json" >/dev/null || fail 'candidate runtime deployment identity/readiness mismatch'

deployment_uid="$(jq -r '.metadata.uid' <<<"$deployment_json")"
deployment_generation="$(jq -r '.metadata.generation' <<<"$deployment_json")"
observed_generation="$(jq -r '.status.observedGeneration' <<<"$deployment_json")"
desired_replicas="$(jq -r '.spec.replicas' <<<"$deployment_json")"
image_ref="$(jq -r --arg container "$RUNTIME_CONTAINER" \
  '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$deployment_json")"
pod_template_sha256="$(jq -cS '.spec.template' <<<"$deployment_json" | sha256sum | awk '{print $1}')"
selector="$(jq -r '.spec.selector.matchLabels//{}|to_entries|map("\(.key)=\(.value)")|join(",")' \
  <<<"$deployment_json")"
[[ -n "$selector" && "$pod_template_sha256" =~ ^[0-9a-f]{64}$ ]] \
  || fail 'candidate runtime selector/template identity is unavailable'

pods_json="$("$KUBECTL_BIN" -n "$NAMESPACE" get pods -l "$selector" -o json)" \
  || fail 'candidate runtime pods cannot be read'
ready_runtime_pods="$(jq -c --arg container "$RUNTIME_CONTAINER" --arg image "$image_ref" '
  [.items[]
   | select(.status.phase=="Running")
   | select(any(.spec.containers[]?;.name==$container and .image==$image))
   | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
   | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))
   | {name:.metadata.name,imageId:([.status.containerStatuses[]?
       |select(.name==$container)|.imageID][0]//"")}]
' <<<"$pods_json")" || fail 'candidate runtime pod evidence is malformed'
[[ "$(jq -r 'length' <<<"$ready_runtime_pods")" == "$desired_replicas" ]] \
  || fail 'candidate runtime ready pod cardinality mismatch'
image_id="$(jq -r '[.[].imageId|select(test("sha256:[0-9a-f]{64}$"))]|unique
  |if length==1 then .[0] else empty end' <<<"$ready_runtime_pods")"
[[ "$image_id" =~ sha256:[0-9a-f]{64}$ ]] || fail 'candidate runtime pods do not share one image digest'
while IFS= read -r runtime_pod; do
  health="$("$KUBECTL_BIN" -n "$NAMESPACE" exec "$runtime_pod" -c "$RUNTIME_CONTAINER" -- \
    curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health)" \
    || fail "candidate runtime health request failed pod=$runtime_pod"
  jq -e '.status=="UP"' <<<"$health" >/dev/null \
    || fail "candidate runtime health is not UP pod=$runtime_pod"
done < <(jq -r '.[].name' <<<"$ready_runtime_pods")

if [[ "$checkpoint_mode" == runtime-ready ]]; then
  jq -e --arg uid "$deployment_uid" --arg image "$image_ref" --arg imageId "$image_id" \
    --arg template "$pod_template_sha256" --argjson generation "$deployment_generation" \
    --argjson desired "$desired_replicas" '
    .deploymentUid==$uid and .deploymentGeneration==$generation and .desiredReplicas==$desired
    and .imageRef==$image and .imageIdDigest==$imageId and .podTemplateSha256==$template
  ' <<<"$checkpoint_json" >/dev/null || fail 'live runtime diverged from RUNTIME_CANDIDATE_READY checkpoint'
fi

deployment_token="$(jq -cS --arg container "$RUNTIME_CONTAINER" '
  {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
   observedGeneration:.status.observedGeneration,replicas:.spec.replicas,
   targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
   image:(.spec.template.spec.containers[]|select(.name==$container)|.image),template:.spec.template}
' <<<"$deployment_json")"
final_deployment_json="$("$KUBECTL_BIN" -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" \
  || fail 'candidate runtime final deployment reread failed'
final_deployment_token="$(jq -cS --arg container "$RUNTIME_CONTAINER" '
  {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
   observedGeneration:.status.observedGeneration,replicas:.spec.replicas,
   targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
   image:(.spec.template.spec.containers[]|select(.name==$container)|.image),template:.spec.template}
' <<<"$final_deployment_json")"
[[ -n "$deployment_token" && "$final_deployment_token" == "$deployment_token" ]] \
  || fail 'candidate runtime resourceVersion/template changed during snapshot'

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

result="$("$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$leader" -c "$CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -At -v ON_ERROR_STOP=1 \
    -v candidate_id="$CANDIDATE_ID" -v unit_code="$UNIT_CODE" \
    -v process_code="$PROCESS_CODE" -v evidence_kind="$EVIDENCE_KIND" \
    -v source_commit="$SOURCE_COMMIT" -v payload_b64="$payload_b64" \
    -v deployment_namespace="$NAMESPACE" -v deployment_name="$DEPLOYMENT" \
    -v deployment_uid="$deployment_uid" -v deployment_generation="$deployment_generation" \
    -v observed_generation="$observed_generation" -v desired_replicas="$desired_replicas" \
    -v image_ref="$image_ref" -v image_id="$image_id" \
    -v pod_template_sha256="$pod_template_sha256" <<'SQL'
BEGIN;
-- Create/lock the durable attempt in the same transaction as every immutable
-- unit.  A terminal or candidate/source-colliding attempt fails before an
-- evidence row can be inserted.
SELECT framework_stage_postdeploy_release_attempt(:'candidate_id',:'source_commit') AS staged_attempt \gset
SELECT framework_candidate_runtime_identity_hash_v2(
  :'source_commit',:'deployment_namespace',:'deployment_name',:'deployment_uid',
  :'deployment_generation'::bigint,:'observed_generation'::bigint,
  :'desired_replicas'::integer,:'image_ref',:'image_id',:'pod_template_sha256'
) AS candidate_runtime_identity_hash \gset
SELECT framework_bind_postdeploy_release_attempt_runtime(
  :'candidate_id',:'source_commit',:'candidate_runtime_identity_hash') AS bound_attempt \gset
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
VALUES (
  :'candidate_id',:'unit_code',:'process_code',:'evidence_kind',:'source_commit',
  :'candidate_runtime_identity_hash',
  convert_from(decode(:'payload_b64','base64'),'UTF8')::jsonb
    || jsonb_build_object('runtimeIdentityHash',:'candidate_runtime_identity_hash'),''
)
ON CONFLICT (candidate_id,unit_code) DO NOTHING;

-- Division by zero makes an immutable same-unit/different-payload retry fail
-- inside this transaction without relying on psql substitution in a DO body.
SELECT 1 / CASE WHEN count(*)=1 THEN 1 ELSE 0 END
FROM framework_postdeploy_evidence_candidate
WHERE candidate_id=:'candidate_id' AND unit_code=:'unit_code'
  AND process_code=:'process_code' AND evidence_kind=:'evidence_kind'
  AND source_commit=:'source_commit'
  AND candidate_runtime_identity_hash=:'candidate_runtime_identity_hash'
  AND evidence_json=(convert_from(decode(:'payload_b64','base64'),'UTF8')::jsonb
    || jsonb_build_object('runtimeIdentityHash',:'candidate_runtime_identity_hash'));
SELECT evidence_hash FROM framework_postdeploy_evidence_candidate
WHERE candidate_id=:'candidate_id' AND unit_code=:'unit_code';
COMMIT;
SQL
)" || fail "unable to stage unit=$UNIT_CODE"
[[ "$result" =~ [0-9a-f]{64} ]] || fail 'database did not return a candidate evidence hash'
printf '[postdeploy-candidate] STAGED candidate=%s unit=%s process=%s hash=%s\n' \
  "$CANDIDATE_ID" "$UNIT_CODE" "$PROCESS_CODE" "${BASH_REMATCH[0]}"
