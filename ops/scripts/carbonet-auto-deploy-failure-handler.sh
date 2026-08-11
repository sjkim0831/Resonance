#!/usr/bin/env bash
set -euo pipefail

state_dir="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
status_file="$state_dir/deploy-status.json"
evidence_dir="$state_dir/failure-evidence"
root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
marker_pending_file="${CARBONET_POSTDEPLOY_MARKER_PENDING_FILE:-$state_dir/postdeploy-marker-pending.state}"
promotion_authority_script="${CARBONET_POSTDEPLOY_PROMOTION_AUTHORITY_SCRIPT:-/opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh}"
full_screen_active_file="${CARBONET_FULL_SCREEN_ACTIVE_FILE:-$root/var/deploy-worktrees/runtime-build/var/run/full-screen-deploy-gate/active.env}"
notify_script="${CARBONET_DEPLOY_NOTIFY_SCRIPT:-/opt/resonance-data/control-plane/bin/carbonet-deploy-notify.sh}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG
mkdir -p "$evidence_dir"
chmod 0750 "$evidence_dir"

timestamp="$(date -Iseconds)"
run_key="$(systemctl show carbonet-auto-deploy.service -p ExecMainStartTimestampMonotonic --value 2>/dev/null || date +%s)"
invocation_id="$(systemctl show carbonet-auto-deploy.service -p InvocationID --value 2>/dev/null || true)"
evidence="$evidence_dir/${run_key}.log"
if [[ -n "$invocation_id" ]]; then
  journalctl "_SYSTEMD_INVOCATION_ID=$invocation_id" --no-pager >"$evidence"
else
  journalctl -u carbonet-auto-deploy.service -n 400 --no-pager >"$evidence"
fi
chmod 0640 "$evidence"

category=UNKNOWN
retry_allowed=false
promotion_authoritative=false
snapshot_preserved=false
pending_target=""
if [[ -e "$marker_pending_file" || -L "$marker_pending_file" ]]; then
  if [[ -f "$marker_pending_file" && ! -L "$marker_pending_file" \
     && "$(stat -c '%a' "$marker_pending_file" 2>/dev/null)" == 600 \
     && "$(sed -n '1p' "$marker_pending_file")" == schemaVersion=1 ]]; then
    pending_target="$(sed -n 's/^targetCommit=//p' "$marker_pending_file")"
  fi
  if [[ -r "$KUBECONFIG" && "$pending_target" =~ ^[0-9a-f]{40}$ ]] \
     && CARBONET_DEPLOY_ROOT="$root" bash "$promotion_authority_script" "$root" "$pending_target" >/dev/null; then
    category=PROMOTION_MARKER_PENDING
    retry_allowed=true
    promotion_authoritative=true
    [[ ! -s "$full_screen_active_file" ]] || snapshot_preserved=true
  else
    category=PROMOTION_AUTHORITY_UNAVAILABLE
  fi
elif grep -Eqi 'connection reset|connection refused|temporary failure|timed out|timeout|TLS handshake|unable to connect|i/o timeout|HTTP 50[234]|requested URL returned error: 50[234]|readiness returned 50[234]|concurrent token acquisition failed' "$evidence"; then
  category=NETWORK_TRANSIENT
  retry_allowed=true
elif grep -Eqi 'visual E2E|playwright|screenshot|browser regression' "$evidence"; then
  category=E2E
elif grep -Eqi 'no valid .*backup|Flyway.*(fail|error)|Patroni.*(fail|not ready)|PostgreSQL.*(fail|not ready|unavailable)|database migration.*(fail|error)|schema backup.*(fail|invalid)' "$evidence"; then
  category=DATABASE
elif grep -Eqi 'capacity-gate.*(FAIL|BLOCK|refus)|DiskPressure=True|no space left|insufficient (disk|memory)|out of memory|OOMKilled' "$evidence"; then
  category=CAPACITY
elif grep -Eqi 'asset closure|asset-catalog|missing .*asset|bundle|chunk' "$evidence"; then
  category=ASSET
elif grep -Eqi 'gradle|compile|build failed|docker build|buildx' "$evidence"; then
  category=BUILD
fi

target="$pending_target"
[[ -n "$target" ]] || target="$(git ls-remote https://github.com/sjkim0831/Resonance.git refs/heads/main 2>/dev/null | awk '{print $1}' || true)"
[[ -n "$target" ]] || target="unknown-$run_key"
if [[ "$promotion_authoritative" == true ]]; then
  retry_marker="$state_dir/promotion-marker-reconcile-${target}.attempted"
else
  retry_marker="$state_dir/retry-${target}.attempted"
fi
retry_attempted=false
status=FAILED
if [[ "$retry_allowed" == true && ! -e "$retry_marker" ]]; then
  : >"$retry_marker"
  retry_attempted=true
  if [[ "$promotion_authoritative" == true ]]; then status=RECONCILE_SCHEDULED; else status=RETRY_SCHEDULED; fi
  systemd-run --quiet --unit="carbonet-auto-deploy-retry-${run_key}" \
    --on-active=10s /usr/bin/systemctl start carbonet-auto-deploy.service
fi

jq -n \
  --arg checkedAt "$timestamp" \
  --arg status "$status" \
  --arg category "$category" \
  --arg targetCommit "$target" \
  --arg evidence "$evidence" \
  --argjson retryAllowed "$retry_allowed" \
  --argjson retryAttempted "$retry_attempted" \
  --argjson promotionAuthoritative "$promotion_authoritative" \
  --argjson snapshotPreserved "$snapshot_preserved" \
  '{checkedAt:$checkedAt,status:$status,category:$category,targetCommit:$targetCommit,retryAllowed:$retryAllowed,retryAttempted:$retryAttempted,promotionAuthoritative:$promotionAuthoritative,snapshotPreserved:$snapshotPreserved,evidence:$evidence}' \
  >"${status_file}.tmp"
chmod 0644 "${status_file}.tmp"
mv "${status_file}.tmp" "$status_file"
bash "$notify_script"
echo "[deploy-failure] category=$category status=$status retry=$retry_attempted evidence=$evidence"
