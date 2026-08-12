#!/usr/bin/env bash
set -euo pipefail

state_dir="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
journal_file="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-$state_dir/carbonet-postdeploy-attempt.json}"
journal_helper="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py}"
launcher="${CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER:-/opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh}"
marker_pending_file="${CARBONET_POSTDEPLOY_MARKER_PENDING_FILE:-$state_dir/postdeploy-marker-pending.state}"
schedule_marker="${CARBONET_RECOVERY_SCHEDULE_MARKER:-}"
expected_candidate="${CARBONET_RECOVERY_CANDIDATE_ID:-}"
expected_source="${CARBONET_RECOVERY_TARGET_COMMIT:-}"
attempts="${CARBONET_RECOVERY_ATTEMPTS:-3}"
delays="${CARBONET_RECOVERY_DELAYS_SECONDS:-10 30 60}"
attempt_timeout="${CARBONET_RECOVERY_ATTEMPT_TIMEOUT_SECONDS:-900}"
owner_uid="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID:-$(id -u)}"

log() { printf '[attempt-recovery-runner] %s %s\n' "$(date -Is)" "$*"; }
fail() { log "FAIL: $*" >&2; exit 79; }

[[ "$expected_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || fail 'candidate identity is invalid'
[[ "$expected_source" =~ ^[0-9a-f]{40}$ ]] || fail 'source identity is invalid'
[[ "$attempts" =~ ^[1-9][0-9]*$ && "$attempts" -le 10 ]] || fail 'retry count is invalid'
[[ "$attempt_timeout" =~ ^[1-9][0-9]*$ && "$attempt_timeout" -le 1800 ]] || fail 'attempt timeout is invalid'
[[ -x "$launcher" || -f "$launcher" ]] || fail 'persistent recovery launcher is missing'
[[ -f "$journal_helper" && ! -L "$journal_helper" ]] || fail 'persistent journal helper is missing'
mkdir -p "$state_dir"
[[ -d "$state_dir" && ! -L "$state_dir" ]] || fail 'state directory is unsafe'
umask 077
exec 8>"$state_dir/postdeploy-attempt-recovery.lock"
flock -n 8 || { log 'another recovery runner owns the lock'; exit 75; }

read_exact_attempt() {
  local document
  [[ -f "$journal_file" && ! -L "$journal_file" ]] || return 1
  document="$(CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID="$owner_uid" \
    python3 "$journal_helper" --file "$journal_file" read)" || return 2
  jq -e --arg candidate "$expected_candidate" --arg source "$expected_source" '
    .candidateId==$candidate and .sourceCommit==$source
    and (.lifecycleStatus=="STAGED" or .lifecycleStatus=="PROMOTED" or .lifecycleStatus=="ABORTED")
  ' <<<"$document" >/dev/null || return 2
  printf '%s\n' "$document"
}

write_marker_status() {
  local status="$1" exit_status="$2" completed_attempts="$3" temporary="" scheduled_at="" unit_name=""
  [[ -n "$schedule_marker" ]] || return 0
  case "$(realpath -m "$schedule_marker")" in
    "$(realpath -m "$state_dir")"/*) ;;
    *) return 1 ;;
  esac
  if [[ -e "$schedule_marker" || -L "$schedule_marker" ]]; then
    [[ -f "$schedule_marker" && ! -L "$schedule_marker" ]] || return 1
    scheduled_at="$(jq -r '.scheduledAt // empty' "$schedule_marker" 2>/dev/null || true)"
    unit_name="$(jq -r '.unitName // empty' "$schedule_marker" 2>/dev/null || true)"
  fi
  [[ "$scheduled_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || return 1
  [[ "$unit_name" =~ ^carbonet-auto-deploy-recovery-[0-9a-f]{20}-[0-9]+$ ]] || return 1
  temporary="$(mktemp "$state_dir/.attempt-recovery-marker.XXXXXX")" || return 1
  jq -n --arg status "$status" --arg candidateId "$expected_candidate" \
    --arg sourceCommit "$expected_source" --arg scheduledAt "$scheduled_at" --arg unitName "$unit_name" \
    --arg finishedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --argjson exitStatus "$exit_status" --argjson attempts "$completed_attempts" \
    '{schemaVersion:1,status:$status,candidateId:$candidateId,sourceCommit:$sourceCommit,scheduledAt:$scheduledAt,
      unitName:$unitName,attempts:$attempts,exitStatus:$exitStatus,finishedAt:$finishedAt}' >"$temporary" \
    && chmod 0600 "$temporary" && mv -fT -- "$temporary" "$schedule_marker" \
    || { rm -f -- "$temporary"; return 1; }
}

# Refuse to invoke the deployment entrypoint even once unless the durable file
# still names the handler-authorized candidate/source pair.
read_exact_attempt >/dev/null || fail 'attempt identity is unavailable or changed'

read -r -a retry_delays <<<"$delays"
last_status=79
for ((attempt=1; attempt<=attempts; attempt++)); do
  if (( attempt > 1 )); then
    delay_index=$((attempt - 2))
    delay="${retry_delays[$delay_index]:-${retry_delays[-1]:-60}}"
    [[ "$delay" =~ ^[0-9]+$ && "$delay" -le 3600 ]] || fail 'retry delay is invalid'
    (( delay == 0 )) || sleep "$delay"
  fi
  # A previous try may have completed and cleared the attempt journal. In that
  # case success is accepted only when no promotion-marker obligation remains.
  if [[ ! -e "$journal_file" && ! -L "$journal_file" \
     && ! -e "$marker_pending_file" && ! -L "$marker_pending_file" \
     && ! -e "$state_dir/runtime-ledger-invalidation.quarantine" \
     && ! -L "$state_dir/runtime-ledger-invalidation.quarantine" ]]; then
    write_marker_status SUCCEEDED 0 "$((attempt - 1))" || fail 'success marker update failed'
    log "PASS candidate=$expected_candidate attempts=$((attempt - 1))"
    exit 0
  fi
  read_exact_attempt >/dev/null || fail 'attempt identity drifted during retry'
  last_status=0
  CARBONET_RECOVERY_ONLY=true \
  CARBONET_RECOVERY_TARGET_COMMIT="$expected_source" \
    timeout --signal=TERM --kill-after=10s "${attempt_timeout}s" \
      /usr/bin/bash "$launcher" || last_status=$?
  if (( last_status == 0 )); then
    [[ ! -e "$journal_file" && ! -L "$journal_file" \
       && ! -e "$marker_pending_file" && ! -L "$marker_pending_file" \
       && ! -e "$state_dir/runtime-ledger-invalidation.quarantine" \
       && ! -L "$state_dir/runtime-ledger-invalidation.quarantine" ]] || last_status=79
  fi
  if (( last_status == 0 )); then
    write_marker_status SUCCEEDED 0 "$attempt" || fail 'success marker update failed'
    log "PASS candidate=$expected_candidate attempts=$attempt"
    exit 0
  fi
  log "retry candidate=$expected_candidate attempt=$attempt/$attempts status=$last_status"
done

write_marker_status EXHAUSTED "$last_status" "$attempts" || fail 'exhausted marker update failed'
quarantine="$state_dir/recovery-quarantine-$(printf '%s\n%s\n' "$expected_candidate" "$expected_source" | sha256sum | awk '{print $1}').json"
temporary="$(mktemp "$state_dir/.recovery-quarantine.XXXXXX")" || fail 'quarantine temp allocation failed'
jq -n --arg candidateId "$expected_candidate" --arg sourceCommit "$expected_source" \
  --arg quarantinedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --argjson attempts "$attempts" --argjson exitStatus "$last_status" \
  '{schemaVersion:1,status:"EXHAUSTED",candidateId:$candidateId,sourceCommit:$sourceCommit,
    attempts:$attempts,exitStatus:$exitStatus,quarantinedAt:$quarantinedAt}' >"$temporary" \
  && chmod 0600 "$temporary" && mv -fT -- "$temporary" "$quarantine" \
  || { rm -f -- "$temporary"; fail 'quarantine publish failed'; }
log "QUARANTINED candidate=$expected_candidate attempts=$attempts stateMutation=0"
exit 79
