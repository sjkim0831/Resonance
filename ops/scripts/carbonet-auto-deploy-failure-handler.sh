#!/usr/bin/env bash
set -euo pipefail

state_dir="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
status_file="$state_dir/deploy-status.json"
evidence_dir="$state_dir/failure-evidence"
root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
deploy_owner="${CARBONET_DEPLOY_OWNER:-sjkim}"
deploy_owner_uid="$(id -u "$deploy_owner" 2>/dev/null || true)"
deploy_group="$(id -gn "$deploy_owner" 2>/dev/null || true)"
marker_pending_file="${CARBONET_POSTDEPLOY_MARKER_PENDING_FILE:-$state_dir/postdeploy-marker-pending.state}"
attempt_journal_file="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-$state_dir/carbonet-postdeploy-attempt.json}"
flyway_cleanup_hold_file="${CARBONET_FLYWAY_CLEANUP_HOLD_FILE:-$state_dir/flyway-cleanup-hold.json}"
attempt_journal_helper="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py}"
recovery_launcher="${CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER:-/opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh}"
recovery_runner="${CARBONET_POSTDEPLOY_RECOVERY_RUNNER:-/opt/resonance-data/control-plane/bin/postdeploy-attempt-recovery-runner.sh}"
recovery_bundle="${CARBONET_POSTDEPLOY_RECOVERY_BUNDLE_DIR:-/opt/resonance-data/control-plane/bin}"
orphan_recovery_helper_explicit=false
[[ -v CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER ]] && orphan_recovery_helper_explicit=true
orphan_recovery_helper="${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER:-$recovery_bundle/reconcile-exact-legacy-orphan-runtime-quarantine.sh}"
orphan_recovery_helper_sha256="${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256:-}"
promotion_authority_script="${CARBONET_POSTDEPLOY_PROMOTION_AUTHORITY_SCRIPT:-/opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh}"
full_screen_active_file="${CARBONET_FULL_SCREEN_ACTIVE_FILE:-$state_dir/full-screen-deploy-gate/active.env}"
notify_script="${CARBONET_DEPLOY_NOTIFY_SCRIPT:-/opt/resonance-data/control-plane/bin/carbonet-deploy-notify.sh}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG

# OnFailure can be delivered after a later invocation has already completed.
# Treat only the exact successful terminal 4-tuple as stale; any missing,
# duplicated or contradictory field falls through to normal fail-closed
# classification. This guard must stay ahead of every state/evidence write.
main_service_snapshot="$(systemctl show carbonet-auto-deploy.service \
  -p ActiveState -p SubState -p Result -p ExecMainStatus --no-pager 2>/dev/null || true)"
main_service_tuple="$(printf '%s\n' "$main_service_snapshot" | LC_ALL=C sort)"
if [[ "$main_service_tuple" == $'ActiveState=inactive\nExecMainStatus=0\nResult=success\nSubState=dead' ]]; then
  exit 0
fi

mkdir -p "$evidence_dir"
chmod 0750 "$evidence_dir"

timestamp="$(date -Iseconds)"
run_key="$(systemctl show carbonet-auto-deploy.service -p ExecMainStartTimestampMonotonic --value 2>/dev/null || date +%s)"
invocation_id="$(systemctl show carbonet-auto-deploy.service -p InvocationID --value 2>/dev/null || true)"
deploy_exit_status="$(systemctl show carbonet-auto-deploy.service -p ExecMainStatus --value 2>/dev/null || true)"
deploy_exit_status="${deploy_exit_status//[[:space:]]/}"
[[ "$deploy_exit_status" =~ ^[0-9]+$ ]] || deploy_exit_status=""
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
pending_candidate=""
attempt_recovery_pending=false
flyway_cleanup_hold_json=""
if [[ -e "$flyway_cleanup_hold_file" || -L "$flyway_cleanup_hold_file" ]]; then
  # This evidence outranks an attempt journal: rollback/retry may not race the
  # exact Flyway backend whose absence has not yet been proven.
  if [[ -f "$flyway_cleanup_hold_file" && ! -L "$flyway_cleanup_hold_file" \
     && "$(stat -c '%U:%a' "$flyway_cleanup_hold_file" 2>/dev/null)" == "$deploy_owner:600" ]] \
     && flyway_cleanup_hold_json="$(jq -ce '
       select(.schemaVersion==1 and .status=="CLEANUP_UNPROVEN"
       and (.jobName|test("^carbonet-flyway-[a-z0-9-]{1,42}$"))
       and .applicationName==.jobName
       and (.namespace|test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"))
       and (.sourceCommit|test("^[0-9a-f]{40}$"))
       and (.candidateImage | (type=="string" and length>0 and length<=255))
       and (.createdAt | (type=="string" and length>0 and length<=64))
       and (.cleanupHoldSeconds | (type=="number" and .>=30 and .<=600))
       and .terminationGraceSeconds==30
       and (.reason=="JOB_APPLY_ARMED" or .reason=="CLEANUP_BUDGET_EXHAUSTED" or .reason=="CLEANUP_CLOCK_UNAVAILABLE")
       and keys==["applicationName","candidateImage","cleanupHoldSeconds","createdAt","jobName","namespace","reason","schemaVersion","sourceCommit","status","terminationGraceSeconds"])
     ' "$flyway_cleanup_hold_file" 2>/dev/null)"; then
    category=FLYWAY_CLEANUP_HOLD
    # Bind retry identity to the exact cleanup evidence read above. A valid
    # marker must not depend on GitHub availability before scheduling recovery.
    pending_target="$(jq -r '.sourceCommit' <<<"$flyway_cleanup_hold_json")"
    # One lease-bound retry wakes the main preflight, whose first operation is
    # cleanup-only reconciliation. The per-target attempted marker prevents an
    # OnFailure burst; the normal timer remains the slower self-heal fallback.
    retry_allowed=true
  else
    category=FLYWAY_CLEANUP_HOLD_INVALID
  fi
elif [[ "$deploy_exit_status" == 79 ]] \
   && grep -Eqi 'SQL State[[:space:]]*:[[:space:]]*P0001|SQLSTATE[[:space:]]*[:=]?[[:space:]]*P0001|precondition failed|FLYWAY_JOB_FAILED' "$evidence"; then
  category=DATABASE_DETERMINISTIC
elif [[ "$deploy_exit_status" == 79 ]]; then
  # Exit 79 is fail-closed. In particular, never let an older durable attempt
  # journal schedule rollback while the child is handing off cleanup evidence.
  category=DEPLOY_TERMINATED
elif [[ "$deploy_exit_status" == 1 ]] \
   && grep -Eqi '\[emission-workflow\][[:space:]]+invalid projects:[[:space:]]*[1-9][0-9]*' "$evidence"; then
  # A nonzero workflow-health count is a deterministic database-contract
  # result. It must outrank both a durable attempt journal and incidental
  # network text emitted by sibling validation groups.
  category=POSTDEPLOY_VALIDATION_DETERMINISTIC
elif [[ -e "$attempt_journal_file" || -L "$attempt_journal_file" ]]; then
  if [[ -f "$attempt_journal_file" && ! -L "$attempt_journal_file" \
     && "$(stat -c '%a' "$attempt_journal_file" 2>/dev/null)" == 600 \
     && -f "$attempt_journal_helper" ]]; then
    attempt_json="$(CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID="$deploy_owner_uid" \
      python3 "$attempt_journal_helper" --file "$attempt_journal_file" read 2>/dev/null || true)"
    pending_target="$(jq -r '.sourceCommit // empty' <<<"$attempt_json" 2>/dev/null || true)"
    pending_candidate="$(jq -r '.candidateId // empty' <<<"$attempt_json" 2>/dev/null || true)"
    if [[ "$pending_target" =~ ^[0-9a-f]{40}$ \
       && "$pending_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ \
       && "$(jq -r '.lifecycleStatus // empty' <<<"$attempt_json")" =~ ^(STAGED|PROMOTED|ABORTED)$ ]]; then
      category=ATTEMPT_RECOVERY_PENDING
      retry_allowed=true
      attempt_recovery_pending=true
      [[ ! -s "$full_screen_active_file" ]] || snapshot_preserved=true
    else
      category=ATTEMPT_JOURNAL_INVALID
    fi
  else
    category=ATTEMPT_JOURNAL_INVALID
  fi
elif [[ -e "$marker_pending_file" || -L "$marker_pending_file" ]]; then
  if [[ -f "$marker_pending_file" && ! -L "$marker_pending_file" \
     && "$(stat -c '%a' "$marker_pending_file" 2>/dev/null)" == 600 \
     && "$(sed -n '1p' "$marker_pending_file")" == schemaVersion=1 ]]; then
    pending_target="$(sed -n 's/^targetCommit=//p' "$marker_pending_file")"
    pending_candidate="$(sed -n 's/^candidateId=//p' "$marker_pending_file")"
  fi
  if [[ -r "$KUBECONFIG" && "$pending_target" =~ ^[0-9a-f]{40}$ \
     && "$pending_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] \
     && CARBONET_DEPLOY_ROOT="$root" bash "$promotion_authority_script" \
       "$root" "$pending_target" "$pending_candidate" >/dev/null; then
    category=PROMOTION_MARKER_PENDING
    retry_allowed=true
    promotion_authoritative=true
    [[ ! -s "$full_screen_active_file" ]] || snapshot_preserved=true
  else
    category=PROMOTION_AUTHORITY_UNAVAILABLE
  fi
elif grep -Eqi 'SQL State[[:space:]]*:[[:space:]]*P0001|SQLSTATE[[:space:]]*[:=]?[[:space:]]*P0001|precondition failed|FLYWAY_JOB_FAILED' "$evidence"; then
  # A Flyway contract/precondition failure is deterministic even when a later
  # kubectl wait emits a generic timeout. Never let that wrapper timeout turn
  # an already rolled-back migration into an automatic deployment retry.
  category=DATABASE_DETERMINISTIC
elif grep -Eqi '\[backstage\][[:space:]]+runtime purge recovery (account secret is required|actor ref is invalid)' "$evidence"; then
  # Missing or malformed recovery authority is deployment configuration, not a
  # transport outage. Incidental timeout text from sibling cleanup must never
  # schedule an identical full-backup/build retry.
  category=BACKSTAGE_CONFIGURATION_DETERMINISTIC
elif grep -Eqi 'STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=(AUTHORITY_MISMATCH|IMMUTABLE_MISMATCH|COORDINATE_CONTRADICTION|TEMPLATE_MISMATCH)' "$evidence"; then
  # Durable authority, immutable image/template and monotonic-coordinate
  # contradictions require reconciliation; an identical retry cannot repair
  # them. Attempt/promotion recovery evidence above always takes precedence.
  category=RUNTIME_IDENTITY_DETERMINISTIC
elif grep -Eqi 'STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=(DATA_UNAVAILABLE|READINESS_TRANSIENT)|connection reset|connection refused|temporary failure|timed out|timeout|TLS handshake|unable to connect|i/o timeout|HTTP 50[234]|requested URL returned error: 50[234]|readiness returned 50[234]|concurrent token acquisition failed' "$evidence"; then
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
[[ -n "$target" ]] || target="$(timeout --signal=TERM --kill-after=1s 8s \
  git ls-remote https://github.com/sjkim0831/Resonance.git refs/heads/main 2>/dev/null \
  | awk '{print $1}' || true)"
[[ -n "$target" ]] || target="unknown-$run_key"
if [[ "$promotion_authoritative" == true ]]; then
  retry_identity="$(printf '%s\0%s' "$pending_candidate" "$target" | sha256sum | awk '{print $1}')"
  retry_marker="$state_dir/postdeploy-recovery-schedule-${retry_identity}.json"
elif [[ "$attempt_recovery_pending" == true ]]; then
  retry_identity="$(printf '%s\0%s' "$pending_candidate" "$target" | sha256sum | awk '{print $1}')"
  retry_marker="$state_dir/postdeploy-recovery-schedule-${retry_identity}.json"
else
  retry_marker="$state_dir/retry-${target}.attempted"
fi
retry_attempted=false
status=FAILED
retry_state_valid=true
schedule_existing_status=""
schedule_reusable=false
recovery_unit=""
schedule_lease_seconds="${CARBONET_RECOVERY_SCHEDULE_LEASE_SECONDS:-60}"
[[ "$schedule_lease_seconds" =~ ^[1-9][0-9]*$ && "$schedule_lease_seconds" -le 3600 ]] || exit 79
if [[ "$retry_allowed" == true && ( "$attempt_recovery_pending" == true || "$promotion_authoritative" == true ) \
   && ( -e "$retry_marker" || -L "$retry_marker" ) ]]; then
  if [[ ! -f "$retry_marker" || -L "$retry_marker" \
     || "$(stat -c '%U:%G:%a' "$retry_marker" 2>/dev/null)" != "$deploy_owner:$deploy_group:600" ]] \
     || ! jq -e --arg candidate "$pending_candidate" --arg source "$target" '
       .schemaVersion==1 and .candidateId==$candidate and .sourceCommit==$source
       and ((.status=="SCHEDULED"
              and (.unitName|test("^carbonet-auto-deploy-recovery-[0-9a-f]{20}-[0-9]+$"))
              and keys==["candidateId","scheduledAt","schemaVersion","sourceCommit","status","unitName"])
         or ((.status=="SUCCEEDED" or .status=="EXHAUSTED")
              and (.unitName|test("^carbonet-auto-deploy-recovery-[0-9a-f]{20}-[0-9]+$"))
              and keys==["attempts","candidateId","exitStatus","finishedAt","scheduledAt","schemaVersion","sourceCommit","status","unitName"]))
     ' "$retry_marker" >/dev/null 2>&1; then
    retry_state_valid=false
    retry_allowed=false
    category=RETRY_STATE_INVALID
  fi
  if [[ "$retry_state_valid" == true ]]; then
    schedule_existing_status="$(jq -r '.status' "$retry_marker")"
    if [[ "$schedule_existing_status" == SCHEDULED ]]; then
      schedule_epoch="$(date -d "$(jq -r '.scheduledAt' "$retry_marker")" +%s 2>/dev/null || printf 0)"
      now_epoch="$(date +%s)"
      recovery_unit="$(jq -r '.unitName' "$retry_marker")"
      unit_active="$(systemctl is-active "$recovery_unit" 2>/dev/null || true)"
      if [[ "$unit_active" != active && "$unit_active" != activating \
         && "$schedule_epoch" =~ ^[0-9]+$ \
         && $((now_epoch - schedule_epoch)) -ge "$schedule_lease_seconds" ]]; then
        schedule_reusable=true
      fi
    fi
  fi
fi
if [[ "$retry_allowed" == true && "$retry_state_valid" == true \
   && ( ( ! -e "$retry_marker" && ! -L "$retry_marker" ) || "$schedule_reusable" == true ) ]]; then
  if [[ "$attempt_recovery_pending" == true || "$promotion_authoritative" == true ]]; then
    [[ -s "$orphan_recovery_helper" && ! -L "$orphan_recovery_helper" ]] || exit 79
    if [[ "$orphan_recovery_helper_explicit" != true ]]; then
      orphan_recovery_helper_real="$(readlink -f "$orphan_recovery_helper" 2>/dev/null || true)"
      recovery_bundle_real="$(readlink -f "$recovery_bundle" 2>/dev/null || true)"
      [[ -n "$orphan_recovery_helper_real" \
         && "$(dirname "$orphan_recovery_helper_real")" == "$recovery_bundle_real" \
         && "$(stat -c '%a:%u:%g' "$orphan_recovery_helper_real" 2>/dev/null || true)" == 755:0:0 \
         && "$(stat -c '%a:%u:%g' "$recovery_bundle_real" 2>/dev/null || true)" == 755:0:0 ]] \
        || exit 79
    fi
    actual_orphan_recovery_helper_sha256="$(sha256sum "$orphan_recovery_helper" | awk '{print $1}')"
    [[ "$actual_orphan_recovery_helper_sha256" =~ ^[0-9a-f]{64}$ ]] || exit 79
    [[ -z "$orphan_recovery_helper_sha256" \
       || "$orphan_recovery_helper_sha256" == "$actual_orphan_recovery_helper_sha256" ]] || exit 79
    orphan_recovery_helper_sha256="$actual_orphan_recovery_helper_sha256"
  fi
  if [[ "$attempt_recovery_pending" == true || "$promotion_authoritative" == true ]]; then
    schedule_generation="$(date +%s%N)"
    recovery_unit="carbonet-auto-deploy-recovery-${retry_identity:0:20}-${schedule_generation}"
    retry_tmp="$(mktemp "$state_dir/.postdeploy-recovery-schedule.XXXXXX")"
    jq -n --arg candidateId "$pending_candidate" --arg sourceCommit "$target" \
      --arg scheduledAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      --arg unitName "$recovery_unit" \
      '{schemaVersion:1,status:"SCHEDULED",candidateId:$candidateId,sourceCommit:$sourceCommit,scheduledAt:$scheduledAt,unitName:$unitName}' \
      >"$retry_tmp"
    chmod 0600 "$retry_tmp"
    chown "$deploy_owner:$deploy_group" "$retry_tmp"
    [[ "$(stat -c '%U:%G:%a' "$retry_tmp")" == "$deploy_owner:$deploy_group:600" ]] || exit 79
    mv -fT -- "$retry_tmp" "$retry_marker"
  else
    : >"$retry_marker"
  fi
  retry_attempted=true
  if [[ "$attempt_recovery_pending" == true ]]; then
    status=RECOVERY_SCHEDULED
  elif [[ "$promotion_authoritative" == true ]]; then
    status=RECONCILE_SCHEDULED
  else
    status=RETRY_SCHEDULED
  fi
  if [[ "$attempt_recovery_pending" == true ]]; then
    # Run only the bounded recovery path directly. This transient unit is not
    # subject to the main deployment service's maintenance-hold condition and
    # CARBONET_RECOVERY_ONLY forbids a new build, migration or rollout.
    if ! systemd-run --quiet --unit="$recovery_unit" \
      --uid="$deploy_owner" --gid="$deploy_group" --working-directory="$root" \
      --property=OnFailure=carbonet-auto-deploy-failure-handler.service \
      --on-active=10s /usr/bin/env \
      CARBONET_RECOVERY_ONLY=true CARBONET_DEPLOY_ROOT="$root" \
      CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true \
      CARBONET_DEPLOY_ORIGINAL_ROOT="$root" \
      CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$target" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_BINDING_ROOT="$recovery_bundle" \
      CARBONET_RECOVERY_TARGET_COMMIT="$target" \
      CARBONET_RECOVERY_CANDIDATE_ID="$pending_candidate" \
      CARBONET_RECOVERY_SCHEDULE_MARKER="$retry_marker" \
      CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$attempt_journal_file" \
      CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID="$deploy_owner_uid" \
      CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER="$recovery_launcher" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$orphan_recovery_helper" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$orphan_recovery_helper_sha256" \
      CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$attempt_journal_helper" \
      CARBONET_POSTDEPLOY_GATE_SCRIPT="$recovery_bundle/resonance-full-screen-deploy-gate.sh" \
      CARBONET_POSTDEPLOY_RECORD_RUNTIME_SCRIPT="$recovery_bundle/record-runtime-release-state.sh" \
      CARBONET_POSTDEPLOY_CHECKPOINT_SCRIPT="$recovery_bundle/runtime-candidate-checkpoint.sh" \
      CARBONET_POSTDEPLOY_STAGE_SCRIPT="$recovery_bundle/stage-postdeploy-release-attempt.sh" \
      CARBONET_POSTDEPLOY_ABORT_SCRIPT="$recovery_bundle/abort-postdeploy-release-attempt.sh" \
      CARBONET_POSTDEPLOY_AUTHORITY_SCRIPT="$promotion_authority_script" \
      CARBONET_POSTDEPLOY_LEADER_RESOLVER="$recovery_bundle/resolve-patroni-primary-pod.sh" \
      FULL_SCREEN_GATE_ASSET_CLOSURE_VERIFIER="$recovery_bundle/verify-react-asset-closure.mjs" \
      /usr/bin/bash "$recovery_runner"; then
      failed_marker="${retry_marker}.schedule-failed.$(date +%s)"
      [[ ! -e "$failed_marker" && ! -L "$failed_marker" ]] \
        && mv -T -- "$retry_marker" "$failed_marker"
      exit 79
    fi
  elif [[ "$promotion_authoritative" == true ]]; then
    systemd-run --quiet --unit="$recovery_unit" \
      --uid="$deploy_owner" --gid="$deploy_group" --working-directory="$root" \
      --property=OnFailure=carbonet-auto-deploy-failure-handler.service \
      --on-active=10s /usr/bin/env CARBONET_RECOVERY_ONLY=true CARBONET_DEPLOY_ROOT="$root" \
      CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true \
      CARBONET_DEPLOY_ORIGINAL_ROOT="$root" \
      CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$target" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_BINDING_ROOT="$recovery_bundle" \
      CARBONET_RECOVERY_TARGET_COMMIT="$target" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$orphan_recovery_helper" \
      CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$orphan_recovery_helper_sha256" \
      /usr/bin/bash "$recovery_launcher"
  else
    systemd-run --quiet --unit="carbonet-auto-deploy-retry-${run_key}" \
      --on-active=10s /usr/bin/systemctl start carbonet-auto-deploy.service
  fi
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
  --argjson attemptRecoveryPending "$attempt_recovery_pending" \
  '{checkedAt:$checkedAt,status:$status,category:$category,targetCommit:$targetCommit,retryAllowed:$retryAllowed,retryAttempted:$retryAttempted,promotionAuthoritative:$promotionAuthoritative,attemptRecoveryPending:$attemptRecoveryPending,snapshotPreserved:$snapshotPreserved,evidence:$evidence}' \
  >"${status_file}.tmp"
chmod 0644 "${status_file}.tmp"
mv "${status_file}.tmp" "$status_file"
bash "$notify_script"
echo "[deploy-failure] category=$category status=$status retry=$retry_attempted evidence=$evidence"
