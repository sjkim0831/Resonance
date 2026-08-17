#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
gate="$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"
guard="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"

grep -Fq 'snapshot_format="plain-tar"' "$gate"
if grep -Fq 'cp -al "$OVERLAY_DIR/."' "$gate"; then
  echo 'rollback snapshot must not share mutable overlay inodes' >&2
  exit 1
fi
grep -Fq 'OVERLAY_DIR="${OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"' "$gate"
grep -Fq 'STATE_DIR="${FULL_SCREEN_GATE_STATE_DIR:-/opt/resonance-data/deploy/full-screen-deploy-gate}"' "$gate"
grep -Fq 'node "$ASSET_CLOSURE_VERIFIER" "$OVERLAY_DIR"' "$gate"
grep -Fq 'frontend-overlay.tar' "$gate"
grep -Fq 'mktemp "$STATE_DIR/.active.env.XXXXXX"' "$gate"
grep -Fq 'mv -fT -- "$active_tmp" "$ACTIVE_FILE"' "$gate"
grep -Fq 'stat -c '\''%a'\'' "$ACTIVE_FILE"' "$gate"
grep -Fq '[[ -f "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" && -s "$ACTIVE_FILE" ]]' "$gate"
grep -Fq 'SNAPSHOT_MANIFEST_SHA256=' "$gate"
grep -Fq 'deployment-annotations.json' "$gate"
grep -Fq 'pod-template.json' "$gate"
grep -Fq 'deployment-rollout-policy.json' "$gate"
grep -Fq 'web-deployment-state.json' "$gate"
grep -Fq 'web-service.json' "$gate"
grep -Fq 'patch "service/$WEB_SERVICE" --type=json' "$gate"
grep -Fq 'RUNTIME_IMAGE_ID=' "$gate"
grep -Fq 'runtime_image_ids_equivalent "$RUNTIME_IMAGE_ID" "$image_id" "$RUNTIME_IMAGE"' "$gate"
grep -Fq '"$manifest_digest" == "$actual_digest"' "$gate"
grep -Fq '"$tag_manifest_digest" == "$actual_digest"' "$gate"
grep -Fq '"$config_digest" == "$expected_digest"' "$gate"
grep -Fq 'rsync -a --exclude=' "$gate"
grep -Fq 'rsync -a --delete-after' "$gate"
copy_line="$(grep -n 'rsync -a --exclude=' "$gate" | head -1 | cut -d: -f1)"
index_line="$(grep -n 'mv -fT -- "$index_tmp" "$OVERLAY_DIR/index.html"' "$gate" | head -1 | cut -d: -f1)"
delete_line="$(grep -n 'rsync -a --delete-after' "$gate" | head -1 | cut -d: -f1)"
[[ "$copy_line" -lt "$index_line" && "$index_line" -lt "$delete_line" ]]
grep -Fq 'mktemp "$STATE_DIR/current-nginx.XXXXXX"' "$gate"
grep -Fq 'restore_marker_from_manifest appliedMarkerCommit' "$gate"
grep -Fq 'finalize-failed' "$gate"
grep -Fq 'SNAPSHOT_FORMAT="${SNAPSHOT_FORMAT:-legacy-gzip}"' "$gate"
grep -Fq 'FULL_SCREEN_GATE_SNAPSHOT_RETENTION:-3' "$gate"
grep -Fq 'for snapshot in "${stale_snapshots[@]}"; do' "$gate"
if grep -Fq 'for snapshot in "${stale_snapshots[@]:-}"; do' "$gate"; then
  echo "empty snapshot arrays must not create an empty cleanup path" >&2
  exit 1
fi
grep -Fq 'sudo -n rm -rf -- "$snapshot"' "$gate"
grep -Fq 'stale snapshot cleanup deferred' "$gate"
grep -Fq 'os.replace(tmp, path)' "$guard"

if grep -Fq 'tar -C "$OVERLAY_DIR" -czf' "$gate"; then
  echo "capture path must not gzip the already compressed frontend assets" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap '[[ "${CARBONET_TEST_KEEP_TMP:-false}" == true ]] || rm -rf "$tmp"' EXIT
[[ "${CARBONET_TEST_KEEP_TMP:-false}" != true ]] || echo "[fast-overlay-test] tmp=$tmp" >&2
mkdir -p "$tmp/live" "$tmp/snapshot" "$tmp/extracted"
printf 'old\n' > "$tmp/live/index.html"
tar -C "$tmp/live" -cf "$tmp/snapshot/frontend-overlay.tar" .
printf 'new\n' > "$tmp/live/index.html"
tar -C "$tmp/extracted" -xf "$tmp/snapshot/frontend-overlay.tar"
[[ "$(cat "$tmp/live/index.html")" == "new" ]]
[[ "$(cat "$tmp/extracted/index.html")" == "old" ]] || {
  echo "live in-place write mutated the immutable rollback archive" >&2
  exit 1
}

capture_overlay="$tmp/capture-live"
capture_state="$tmp/state"
capture_report="$tmp/report"
mkdir -p "$capture_overlay/.vite" "$capture_overlay/assets" "$tmp/bin"
printf '%s\n' 1111111111111111111111111111111111111111 >"$tmp/applied.commit"
printf '%s\n' 1111111111111111111111111111111111111111 >"$tmp/runtime.commit"
printf '%s\n' malformed-marker >"$tmp/applied-invalid.commit"
printf '<script type="module" src="/assets/app.js"></script>\n' > "$capture_overlay/index.html"
printf '{"src/main.tsx":{"file":"assets/app.js","css":["assets/app.css"]}}\n' \
  > "$capture_overlay/.vite/manifest.json"
printf 'console.log("capture");\n' > "$capture_overlay/assets/app.js"
printf 'body{}\n' > "$capture_overlay/assets/app.css"
cat > "$tmp/bin/kubectl" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *"get deployment carbonet-runtime"*)
    runtime_json="$(cat <<'JSON'
{"metadata":{"uid":"runtime-uid","generation":7,"annotations":{"deployment.kubernetes.io/revision":"683","kubectl.kubernetes.io/last-applied-configuration":"managed","resonance.ai/target-commit":"1111111111111111111111111111111111111111","resonance.ai/image":"baseline"}},"spec":{"replicas":1,"minReadySeconds":5,"progressDeadlineSeconds":600,"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":"25%","maxUnavailable":"25%"}},"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"metadata":{"labels":{"app":"carbonet-runtime","resonance.ai/release-id":"baseline"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.invalid/carbonet-runtime:baseline"}]}}},"status":{"observedGeneration":7,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
    )"
    case "${FAULT_CAPTURE_PHASE:-none}" in
      defaults-omitted) jq -c 'del(.spec.minReadySeconds)' <<<"$runtime_json" ;;
      runtime-null) jq -c '.spec.minReadySeconds=null' <<<"$runtime_json" ;;
      *) printf '%s\n' "$runtime_json" ;;
    esac
    ;;
  *"get deployment carbonet-web"*)
    web_json="$(cat <<'JSON'
{"metadata":{"uid":"web-uid","generation":3,"annotations":{"deployment.kubernetes.io/revision":"7","resonance.ai/target-commit":"1111111111111111111111111111111111111111"}},"spec":{"replicas":1,"minReadySeconds":0,"progressDeadlineSeconds":600,"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":"25%","maxUnavailable":"25%"}},"selector":{"matchLabels":{"app":"carbonet-web"}},"template":{"metadata":{"labels":{"app":"carbonet-web"}},"spec":{"containers":[{"name":"web","image":"registry.invalid/carbonet-web:baseline"}]}}},"status":{"observedGeneration":3,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
    )"
    case "${FAULT_CAPTURE_PHASE:-none}" in
      defaults-omitted) jq -c 'del(.spec.minReadySeconds)' <<<"$web_json" ;;
      web-null) jq -c '.spec.minReadySeconds=null' <<<"$web_json" ;;
      *) printf '%s\n' "$web_json" ;;
    esac
    ;;
  *"get service carbonet-web"*)
    service_json='{"metadata":{"labels":{"app":"carbonet-web","tier":"frontend"},"annotations":{"kubectl.kubernetes.io/last-applied-configuration":"managed","resonance.ai/target-commit":"1111111111111111111111111111111111111111"}},"spec":{"clusterIP":"10.96.1.20","clusterIPs":["10.96.1.20"],"externalTrafficPolicy":"Local","ports":[{"name":"http","nodePort":30080,"port":80,"protocol":"TCP","targetPort":8080}],"selector":{"app":"carbonet-web"},"sessionAffinity":"None","type":"NodePort"}}'
    if [[ "${FAULT_CAPTURE_PHASE:-none}" == service-json ]]; then
      printf '%s\n' '{invalid-service-json'
    else
      printf '%s\n' "$service_json"
    fi
    ;;
  *"get configmap carbonet-web-nginx"*)
    [[ "${FAULT_CAPTURE_PHASE:-none}" == nginx-empty ]] || printf 'server { listen 8080; }\n'
    ;;
  *"exec runtime-0"*) printf '{"status":"UP"}\n' ;;
  *"get pods -l app=carbonet-runtime"*)
    jq -cn --arg imageId "${FAKE_RUNTIME_IMAGE_ID:-docker-pullable://registry.invalid/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}" '
      {items:[{metadata:{name:"runtime-0"},
        spec:{containers:[{name:"carbonet-runtime",image:"registry.invalid/carbonet-runtime:baseline"}]},
        status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],
          containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$imageId}]}}]}'
    ;;
  *) printf 'unexpected fake kubectl call: %s\n' "$*" >&2; exit 91 ;;
esac
SH
chmod 700 "$tmp/bin/kubectl"
cat > "$tmp/bin/chmod" <<'SH'
#!/usr/bin/env bash
if [[ "${FAULT_CAPTURE_PHASE:-none}" == manifest-chmod && "$*" == *'/manifest.json'* ]]; then
  exit 95
fi
exec /usr/bin/chmod "$@"
SH
chmod 700 "$tmp/bin/chmod"
cat > "$tmp/bin/tar" <<'SH'
#!/usr/bin/env bash
/usr/bin/tar "$@" || exit $?
if [[ "${CORRUPT_CAPTURE_COPY:-false}" == true && "$*" == *" -cf "* ]]; then
  archive="${4:-}"
  /usr/bin/tar --delete -f "$archive" ./assets/app.js
fi
SH
chmod 700 "$tmp/bin/tar"
cat > "$tmp/bin/mktemp" <<'SH'
#!/usr/bin/env bash
if [[ "${FAULT_ACTIVE_MKTEMP:-false}" == true && "$*" == *'/.active.env.XXXXXX'* ]]; then
  exit 97
fi
exec /usr/bin/mktemp "$@"
SH
chmod 700 "$tmp/bin/mktemp"
cat > "$tmp/bin/curl" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *'/v2/carbonet-runtime/manifests/sha256:'* \
   && -n "${FAKE_REGISTRY_MANIFEST:-}" ]]; then
  cat -- "$FAKE_REGISTRY_MANIFEST"
  exit 0
fi
if [[ "$*" == *'/v2/carbonet-runtime/manifests/baseline'* \
   && -n "${FAKE_REGISTRY_TAG_MANIFEST:-${FAKE_REGISTRY_MANIFEST:-}}" ]]; then
  cat -- "${FAKE_REGISTRY_TAG_MANIFEST:-$FAKE_REGISTRY_MANIFEST}"
  exit 0
fi
printf 'unexpected fake curl call: %s\n' "$*" >&2
exit 90
SH
chmod 700 "$tmp/bin/curl"
cat > "$tmp/bin/mv" <<'SH'
#!/usr/bin/env bash
last="${!#}"
if [[ "${FAULT_ACTIVE_MV:-false}" == true && "$last" == "${FAULT_ACTIVE_FILE:-}" ]]; then
  exit 96
fi
if [[ "${FAULT_CAPTURE_PHASE:-none}" == post-mv-term && "$last" == "${FAULT_ACTIVE_FILE:-}" ]]; then
  /usr/bin/mv "$@" || exit $?
  kill -TERM "$PPID"
  exit 0
fi
exec /usr/bin/mv "$@"
SH
chmod 700 "$tmp/bin/mv"

run_isolated_capture() {
  local state="${1:-$capture_state}" mktemp_fault="${2:-false}" mv_fault="${3:-false}"
  local fault_phase="${4:-none}" applied_marker="$tmp/applied.commit"
  [[ "$fault_phase" != marker-invalid ]] || applied_marker="$tmp/applied-invalid.commit"
  PATH="$tmp/bin:$PATH" \
  FAULT_ACTIVE_MKTEMP="$mktemp_fault" \
  FAULT_ACTIVE_MV="$mv_fault" \
  FAULT_ACTIVE_FILE="$state/active.env" \
  FAULT_CAPTURE_PHASE="$fault_phase" \
  ROOT_DIR="$ROOT_DIR" \
  OVERLAY_DIR="$capture_overlay" \
  FULL_SCREEN_GATE_STATE_DIR="$state" \
  FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
  FULL_SCREEN_GATE_BASE_COMMIT=1111111111111111111111111111111111111111 \
  CARBONET_DEPLOY_STATE_FILE="$applied_marker" \
  CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
    bash "$gate" capture
}

run_isolated_capture >"$tmp/capture-valid.log"
active_file="$capture_state/active.env"
[[ -s "$active_file" ]]
[[ "$(stat -c '%a' "$active_file")" == 600 ]]
snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\(.*\)'$/\1/p" "$active_file")"
[[ -n "$snapshot_dir" && -s "$snapshot_dir/frontend-overlay.tar" && -s "$snapshot_dir/manifest.json" \
  && -s "$snapshot_dir/deployment-rollout-policy.json" && -s "$snapshot_dir/web-deployment-state.json" \
  && -s "$snapshot_dir/web-service.json" ]]
[[ "$(stat -c '%a' "$snapshot_dir/frontend-overlay.tar")" == 400 ]]
jq -e '.schemaVersion==2 and .runtimeDesiredReplicas==1 and (.runtimeImageId|endswith("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))' \
  "$snapshot_dir/manifest.json" >/dev/null
jq -e '.webServiceSha256|test("^[0-9a-f]{64}$")' "$snapshot_dir/manifest.json" >/dev/null
jq -e '.deploymentRolloutPolicySha256|test("^[0-9a-f]{64}$")' "$snapshot_dir/manifest.json" >/dev/null
jq -e '.webDeploymentStateSha256|test("^[0-9a-f]{64}$")' "$snapshot_dir/manifest.json" >/dev/null
jq -e '.minReadySeconds==5 and .progressDeadlineSeconds==600
  and .strategy.rollingUpdate.maxSurge=="25%"' "$snapshot_dir/deployment-rollout-policy.json" >/dev/null

# Kubernetes omits the default minReadySeconds=0 from live runtime and web
# Deployment JSON. Capture and restored-state verification share that default,
# while malformed explicit null and every later pre-publish fault fail closed.
omitted_state="$tmp/omitted-min-ready-state"
run_isolated_capture "$omitted_state" false false defaults-omitted >"$tmp/capture-omitted-min-ready.log"
omitted_snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\(.*\)'$/\1/p" "$omitted_state/active.env")"
jq -e '.minReadySeconds==0 and .progressDeadlineSeconds==600
  and .strategy.type=="RollingUpdate"' "$omitted_snapshot_dir/deployment-rollout-policy.json" >/dev/null
jq -e '.spec.minReadySeconds==0 and .spec.progressDeadlineSeconds==600
  and .spec.strategy.type=="RollingUpdate"' "$omitted_snapshot_dir/web-deployment-state.json" >/dev/null
PATH="$tmp/bin:$PATH" FAULT_CAPTURE_PHASE=defaults-omitted ROOT_DIR="$ROOT_DIR" \
OVERLAY_DIR="$capture_overlay" FULL_SCREEN_GATE_STATE_DIR="$omitted_state" \
FULL_SCREEN_GATE_REPORT_DIR="$capture_report" CARBONET_DEPLOY_STATE_FILE="$tmp/applied.commit" \
CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
  bash "$gate" verify-restored-physical >"$tmp/verify-omitted-min-ready.log"

# A kubelet/containerd transition can expose the registry manifest digest in
# Pod imageID even though the immutable snapshot captured the config digest.
# Accept only a byte-addressed manifest whose config digest binds that exact
# baseline; a wrong config or body/digest mismatch remains fail-closed.
manifest_expected_config='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
jq -cn --arg config "$manifest_expected_config" '
  {schemaVersion:2,mediaType:"application/vnd.docker.distribution.manifest.v2+json",
   config:{mediaType:"application/vnd.docker.container.image.v1+json",size:1,digest:$config},layers:[]}' \
  >"$tmp/registry-manifest.json"
manifest_digest="sha256:$(sha256sum "$tmp/registry-manifest.json" | awk '{print $1}')"
FAKE_RUNTIME_IMAGE_ID="registry.invalid/carbonet-runtime@$manifest_digest" \
FAKE_REGISTRY_MANIFEST="$tmp/registry-manifest.json" \
PATH="$tmp/bin:$PATH" ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$capture_overlay" \
FULL_SCREEN_GATE_STATE_DIR="$capture_state" FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
CARBONET_DEPLOY_STATE_FILE="$tmp/applied.commit" CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
  bash "$gate" verify-restored-physical >"$tmp/verify-manifest-config-bridge.log"

jq -cn --arg config 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' '
  {schemaVersion:2,mediaType:"application/vnd.docker.distribution.manifest.v2+json",
   config:{mediaType:"application/vnd.docker.container.image.v1+json",size:1,digest:$config},layers:[]}' \
  >"$tmp/registry-wrong-config.json"
wrong_manifest_digest="sha256:$(sha256sum "$tmp/registry-wrong-config.json" | awk '{print $1}')"
if FAKE_RUNTIME_IMAGE_ID="registry.invalid/carbonet-runtime@$wrong_manifest_digest" \
   FAKE_REGISTRY_MANIFEST="$tmp/registry-wrong-config.json" \
   PATH="$tmp/bin:$PATH" ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$capture_overlay" \
   FULL_SCREEN_GATE_STATE_DIR="$capture_state" FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
   CARBONET_DEPLOY_STATE_FILE="$tmp/applied.commit" CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
     bash "$gate" verify-restored-physical >"$tmp/verify-wrong-config.log" 2>&1; then
  echo 'wrong registry config digest was accepted as the rollback image' >&2
  exit 1
fi
grep -Fq 'restored Ready pod imageID differs from immutable baseline' "$tmp/verify-wrong-config.log"

if FAKE_RUNTIME_IMAGE_ID="registry.invalid/carbonet-runtime@$manifest_digest" \
   FAKE_REGISTRY_MANIFEST="$tmp/registry-wrong-config.json" \
   PATH="$tmp/bin:$PATH" ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$capture_overlay" \
   FULL_SCREEN_GATE_STATE_DIR="$capture_state" FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
   CARBONET_DEPLOY_STATE_FILE="$tmp/applied.commit" CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
     bash "$gate" verify-restored-physical >"$tmp/verify-manifest-body-tamper.log" 2>&1; then
  echo 'registry manifest body/digest mismatch was accepted as rollback proof' >&2
  exit 1
fi
grep -Fq 'restored Ready pod imageID differs from immutable baseline' "$tmp/verify-manifest-body-tamper.log"

if FAKE_RUNTIME_IMAGE_ID="registry.invalid/carbonet-runtime@$manifest_digest" \
   FAKE_REGISTRY_MANIFEST="$tmp/registry-manifest.json" \
   FAKE_REGISTRY_TAG_MANIFEST="$tmp/registry-wrong-config.json" \
   PATH="$tmp/bin:$PATH" ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$capture_overlay" \
   FULL_SCREEN_GATE_STATE_DIR="$capture_state" FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
   CARBONET_DEPLOY_STATE_FILE="$tmp/applied.commit" CARBONET_RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit" \
     bash "$gate" verify-restored-physical >"$tmp/verify-tag-retarget.log" 2>&1; then
  echo 'retargeted mutable baseline tag was accepted as rollback proof' >&2
  exit 1
fi
grep -Fq 'restored Ready pod imageID differs from immutable baseline' "$tmp/verify-tag-retarget.log"

policy_active_hash="$(sha256sum "$active_file" | awk '{print $1}')"
policy_snapshot_count="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
for fault_phase in runtime-null web-null service-json nginx-empty marker-invalid manifest-chmod; do
  if run_isolated_capture "$capture_state" false false "$fault_phase" >"$tmp/capture-${fault_phase}.log" 2>&1; then
    echo "pre-publish fault unexpectedly succeeded: $fault_phase" >&2
    exit 1
  fi
  [[ "$(sha256sum "$active_file" | awk '{print $1}')" == "$policy_active_hash" ]]
  [[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "$policy_snapshot_count" ]]
done
grep -Fq 'runtime deployment rollout policy baseline is incomplete' "$tmp/capture-runtime-null.log"
grep -Fq 'web deployment baseline is incomplete' "$tmp/capture-web-null.log"
grep -Fq 'applied marker commit is invalid' "$tmp/capture-marker-invalid.log"

post_mv_active_hash_before="$(sha256sum "$active_file" | awk '{print $1}')"
post_mv_snapshot_count_before="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
post_mv_status=0
run_isolated_capture "$capture_state" false false post-mv-term \
  >"$tmp/capture-post-mv-term.log" 2>&1 || post_mv_status=$?
[[ "$post_mv_status" == 143 ]] || {
  echo "post-mv TERM fault status mismatch: $post_mv_status" >&2
  exit 1
}
post_mv_active_hash_after="$(sha256sum "$active_file" | awk '{print $1}')"
[[ "$post_mv_active_hash_after" != "$post_mv_active_hash_before" ]]
[[ -f "$active_file" && ! -L "$active_file" \
  && "$(stat -c '%a' "$active_file")" == 600 \
  && "$(stat -c '%u' "$active_file")" == "$(id -u)" ]]
post_mv_snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\(.*\)'$/\1/p" "$active_file")"
post_mv_manifest_hash="$(sed -n "s/^SNAPSHOT_MANIFEST_SHA256='\(.*\)'$/\1/p" "$active_file")"
[[ -n "$post_mv_snapshot_dir" && -d "$post_mv_snapshot_dir" && ! -L "$post_mv_snapshot_dir" ]]
[[ -n "$post_mv_manifest_hash" \
  && "$(sha256sum "$post_mv_snapshot_dir/manifest.json" | awk '{print $1}')" == "$post_mv_manifest_hash" ]]
[[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" \
  == "$((post_mv_snapshot_count_before + 1))" ]]
grep -Fq 'capture publication completed before final flag; preserving exact active snapshot=' \
  "$tmp/capture-post-mv-term.log"
jq -e '.spec.replicas==1 and .spec.template.spec.containers[0].image=="registry.invalid/carbonet-web:baseline"
  and .metadata.annotations=={"resonance.ai/target-commit":"1111111111111111111111111111111111111111"}' \
  "$snapshot_dir/web-deployment-state.json" >/dev/null
jq -e '.metadata.labels=={"app":"carbonet-web","tier":"frontend"}
  and .metadata.annotations=={"resonance.ai/target-commit":"1111111111111111111111111111111111111111"}
  and .spec.externalTrafficPolicy=="Local" and .spec.ports[0].nodePort==30080' \
  "$snapshot_dir/web-service.json" >/dev/null
jq -e 'keys==["resonance.ai/image","resonance.ai/target-commit"]' \
  "$snapshot_dir/deployment-annotations.json" >/dev/null
current_annotations='{"deployment.kubernetes.io/revision":"684","kubectl.kubernetes.io/last-applied-configuration":"managed-new","resonance.ai/target-commit":"candidate","resonance.ai/release-candidate":"remove-me"}'
restored_annotations="$(jq -cnS --argjson current "$current_annotations" \
  --slurpfile baseline "$snapshot_dir/deployment-annotations.json" \
  '($current|with_entries(select((.key|startswith("resonance.ai/"))|not))) + $baseline[0]')"
jq -e '."deployment.kubernetes.io/revision"=="684"
  and ."kubectl.kubernetes.io/last-applied-configuration"=="managed-new"
  and ."resonance.ai/target-commit"=="1111111111111111111111111111111111111111"
  and (has("resonance.ai/release-candidate")|not)' <<<"$restored_annotations" >/dev/null
# Model the exact late-failure Service repair: candidate selector/NodePort and
# owned annotations return to baseline, while controller/kubectl annotations
# remain current. This is the same merge used by restore-physical.
candidate_service='{"metadata":{"labels":{"app":"candidate"},"annotations":{"kubectl.kubernetes.io/last-applied-configuration":"candidate-managed","resonance.ai/target-commit":"candidate"}},"spec":{"clusterIP":"10.96.1.20","clusterIPs":["10.96.1.20"],"externalTrafficPolicy":"Cluster","ports":[{"name":"http","nodePort":30081,"port":81,"protocol":"TCP","targetPort":8181}],"selector":{"app":"candidate"},"sessionAffinity":"None","type":"NodePort"}}'
restored_service="$(jq -cnS --argjson current "$candidate_service" --slurpfile baseline "$snapshot_dir/web-service.json" '
  ($current.metadata.annotations|with_entries(select((.key|startswith("resonance.ai/"))|not))) as $unowned
  | {metadata:{labels:$baseline[0].metadata.labels,annotations:($unowned+$baseline[0].metadata.annotations)},spec:$baseline[0].spec}
')"
jq -e '.metadata.labels=={"app":"carbonet-web","tier":"frontend"}
  and .metadata.annotations."kubectl.kubernetes.io/last-applied-configuration"=="candidate-managed"
  and .metadata.annotations."resonance.ai/target-commit"=="1111111111111111111111111111111111111111"
  and .spec.selector.app=="carbonet-web" and .spec.ports[0].nodePort==30080
  and .spec.externalTrafficPolicy=="Local"' <<<"$restored_service" >/dev/null
candidate_runtime_policy='{"minReadySeconds":0,"progressDeadlineSeconds":180,"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":3,"maxUnavailable":0}}}'
restored_runtime_policy="$(jq -cS . "$snapshot_dir/deployment-rollout-policy.json")"
[[ "$candidate_runtime_policy" != "$restored_runtime_policy" ]]
jq -e '.minReadySeconds==5 and .progressDeadlineSeconds==600
  and .strategy.rollingUpdate.maxUnavailable=="25%"' <<<"$restored_runtime_policy" >/dev/null
candidate_web_state='{"metadata":{"annotations":{"resonance.ai/target-commit":"candidate"}},"spec":{"replicas":2,"minReadySeconds":3,"progressDeadlineSeconds":120,"strategy":{"type":"Recreate"},"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"candidate"}},"spec":{"containers":[{"name":"web","image":"candidate"}]}}}}'
restored_web_state="$(jq -cS . "$snapshot_dir/web-deployment-state.json")"
[[ "$candidate_web_state" != "$restored_web_state" ]]
jq -e '.spec.replicas==1 and .spec.template.metadata.annotations==null
  and .spec.template.spec.containers[0].image=="registry.invalid/carbonet-web:baseline"' \
  <<<"$restored_web_state" >/dev/null

# Served overlay closure remains complete at all three publication cutpoints:
# candidate index during baseline copy, baseline index before candidate delete,
# then exact baseline graph after delete.
mkdir -p "$tmp/order-baseline/assets" "$tmp/order-live/assets"
printf '<script src="/assets/old.js"></script>\n' >"$tmp/order-baseline/index.html"
printf 'old\n' >"$tmp/order-baseline/assets/old.js"
printf '<script src="/assets/new.js"></script>\n' >"$tmp/order-live/index.html"
printf 'new\n' >"$tmp/order-live/assets/new.js"
rsync -a --exclude='/index.html' -- "$tmp/order-baseline/" "$tmp/order-live/"
grep -Fq '/assets/new.js' "$tmp/order-live/index.html" && test -s "$tmp/order-live/assets/new.js"
cp "$tmp/order-baseline/index.html" "$tmp/order-live/.index.rollback"
mv -fT "$tmp/order-live/.index.rollback" "$tmp/order-live/index.html"
grep -Fq '/assets/old.js' "$tmp/order-live/index.html" && test -s "$tmp/order-live/assets/old.js"
rsync -a --delete-after --exclude='/index.html' -- "$tmp/order-baseline/" "$tmp/order-live/"
test -s "$tmp/order-live/assets/old.js" && test ! -e "$tmp/order-live/assets/new.js"
active_hash_before="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_before="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"

if CORRUPT_CAPTURE_COPY=true run_isolated_capture >"$tmp/capture-copy-invalid.log" 2>&1; then
  echo "incomplete copied overlay closure did not fail closed" >&2
  exit 1
fi
active_hash_after_copy_failure="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_after_copy_failure="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[[ "$active_hash_after_copy_failure" == "$active_hash_before" ]] || {
  echo "incomplete copied closure changed the current active rollback pointer" >&2
  exit 1
}
[[ "$snapshot_count_after_copy_failure" == "$snapshot_count_before" ]] || {
  echo "incomplete copied closure published a rollback snapshot" >&2
  exit 1
}
grep -Fq 'captured tar overlay closure is incomplete' "$tmp/capture-copy-invalid.log"

rm -f "$capture_overlay/assets/app.js"
if run_isolated_capture >"$tmp/capture-invalid.log" 2>&1; then
  echo "incomplete mounted overlay capture did not fail closed" >&2
  exit 1
fi
active_hash_after="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_after="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[[ "$active_hash_after" == "$active_hash_before" ]] || {
  echo "incomplete capture changed the current active rollback pointer" >&2
  exit 1
}
[[ "$snapshot_count_after" == "$snapshot_count_before" ]] || {
  echo "incomplete capture published a rollback snapshot" >&2
  exit 1
}
grep -Fq '[asset-closure] missing 1 manifest assets' "$tmp/capture-invalid.log"

printf 'console.log("capture");\n' > "$capture_overlay/assets/app.js"
if run_isolated_capture "$capture_state" true false >"$tmp/capture-mktemp-fault.log" 2>&1; then
  echo "active pointer mktemp fault unexpectedly succeeded" >&2
  exit 1
fi
[[ "$(sha256sum "$active_file" | awk '{print $1}')" == "$active_hash_before" ]]
[[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "$snapshot_count_before" ]]
! find "$capture_state" -maxdepth 1 -type f -name '.active.env.*' | grep -q .
grep -Fq 'active rollback pointer temp allocation failed' "$tmp/capture-mktemp-fault.log"

if run_isolated_capture "$capture_state" false true >"$tmp/capture-mv-fault.log" 2>&1; then
  echo "active pointer publish-path fault unexpectedly succeeded" >&2
  exit 1
fi
[[ "$(sha256sum "$active_file" | awk '{print $1}')" == "$active_hash_before" ]]
[[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "$snapshot_count_before" ]]
! find "$capture_state" -maxdepth 1 -type f -name '.active.env.*' | grep -q .
grep -Fq 'active rollback pointer publish failed' "$tmp/capture-mv-fault.log"

directory_state="$tmp/directory-state"
mkdir -p "$directory_state/active.env"
touch "$directory_state/active.env/keep"
if run_isolated_capture "$directory_state" false false >"$tmp/capture-directory-target.log" 2>&1; then
  echo "active pointer directory target unexpectedly succeeded" >&2
  exit 1
fi
[[ -e "$directory_state/active.env/keep" ]]
[[ ! -d "$directory_state/snapshots" \
   || "$(find "$directory_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == 0 ]]
grep -Fq 'active rollback pointer target is unsafe' "$tmp/capture-directory-target.log"

symlink_state="$tmp/symlink-state"
symlink_executed="$tmp/symlink-active-was-sourced"
mkdir -p "$symlink_state"
chmod 0700 "$symlink_state"
printf 'touch %q\n' "$symlink_executed" > "$tmp/malicious-active.env"
ln -s "$tmp/malicious-active.env" "$symlink_state/active.env"
if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$symlink_state" \
    bash "$gate" finalize-success >"$tmp/load-symlink.log" 2>&1; then
  echo "symlinked active pointer unexpectedly loaded" >&2
  exit 1
fi
[[ ! -e "$symlink_executed" ]]
grep -Fq 'deployment snapshot is missing or unsafe' "$tmp/load-symlink.log"

# The active pointer is parsed as a strict schema, never sourced. Duplicate or
# unknown keys, weak modes and a foreign owner all fail before any action.
strict_state="$tmp/strict-state"
cp -a "$capture_state" "$strict_state"
strict_active="$strict_state/active.env"
sed -i "s#^SNAPSHOT_DIR=.*#SNAPSHOT_DIR='$strict_state/snapshots/$(basename "$snapshot_dir")'#" "$strict_active"
cp "$strict_active" "$tmp/active.clean"
printf "SNAPSHOT_DIR='%s'\n" "$strict_state/snapshots/$(basename "$snapshot_dir")" >>"$strict_active"
if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$strict_state" bash "$gate" describe >/dev/null 2>&1; then
  echo 'duplicate active key escaped' >&2; exit 1
fi
cp "$tmp/active.clean" "$strict_active"; chmod 0600 "$strict_active"
printf "UNKNOWN_KEY='value'\n" >>"$strict_active"
if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$strict_state" bash "$gate" describe >/dev/null 2>&1; then
  echo 'unknown active key escaped' >&2; exit 1
fi
cp "$tmp/active.clean" "$strict_active"; chmod 0644 "$strict_active"
if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$strict_state" bash "$gate" describe >/dev/null 2>&1; then
  echo 'weak active mode escaped' >&2; exit 1
fi
cp "$tmp/active.clean" "$strict_active"; chmod 0600 "$strict_active"
if sudo -n true 2>/dev/null; then
  sudo -n chown root:root "$strict_active"
  if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$strict_state" bash "$gate" describe >/dev/null 2>&1; then
    echo 'foreign active owner escaped' >&2; exit 1
  fi
  sudo -n chown "$(id -u):$(id -g)" "$strict_active"
fi

# finalize-failed may retire active.env immediately before SIGKILL prevents the
# attempt journal clear. Exact expected identity reopens only that immutable
# retired pointer; a manifest drift remains fail-closed.
retired_state="$tmp/retired-state"
cp -a "$capture_state" "$retired_state"
retired_snapshot_id="$(sed -n "s/^SNAPSHOT_ID='\(.*\)'$/\1/p" "$retired_state/active.env")"
retired_snapshot_dir="$retired_state/snapshots/$retired_snapshot_id"
sed -i "s#^SNAPSHOT_DIR=.*#SNAPSHOT_DIR='$retired_snapshot_dir'#" "$retired_state/active.env"
retired_manifest="$(sed -n "s/^SNAPSHOT_MANIFEST_SHA256='\(.*\)'$/\1/p" "$retired_state/active.env")"
retired_baseline="$(sed -n "s/^BASELINE_SOURCE_COMMIT='\(.*\)'$/\1/p" "$retired_state/active.env")"
mkdir -p "$retired_state/retired"
mv "$retired_state/active.env" "$retired_state/retired/${retired_snapshot_id}.failed.env"
chmod 0600 "$retired_state/retired/${retired_snapshot_id}.failed.env"
FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$retired_snapshot_id" \
FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$retired_manifest" \
FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$retired_baseline" \
ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$retired_state" \
  bash "$gate" describe >/dev/null
bad_manifest="$(printf 'f%.0s' {1..64})"
if FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$retired_snapshot_id" \
   FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$bad_manifest" \
   FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$retired_baseline" \
   ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$retired_state" \
     bash "$gate" describe >/dev/null 2>&1; then
  echo 'retired snapshot manifest drift was accepted' >&2
  exit 1
fi

echo "[fast-overlay-snapshot-test] PASS persistentState=0700 immutableArchive=0400 manifest=imageID+ownedAnnotations+runtimePolicy+webTemplate+service+readiness+markers imageIdDomain=config-manifest-byte-bound minReadySeconds=runtime+web-missing-default0+restore-verified+null-rejected prePublishCleanup=6faults+activeHashExact+snapshotCountExact postMvTerm=active+snapshot+manifest-coherent serviceLateFailure=restored overlayOrder=copy-index-delete retiredResume=exact controllerRevision=excluded currentNginx=temp sourceClosure=verified copiedClosure=verified activeParser=strict duplicateUnknownModeOwner=rejected symlinkLoad=rejected"
