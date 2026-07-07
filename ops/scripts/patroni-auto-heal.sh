#!/bin/bash
set -euo pipefail

NAMESPACE="carbonet-prod"
CLUSTER_NAME="postgres-patroni"
SLACK_WEBHOOK_FILE="/opt/Resonance/ops/scripts/patroni-slack-webhook.cfg"
LOG_FILE="/opt/Resonance/var/log/patroni-auto-heal.log"
STATE_DIR="/tmp/patroni-heal-state"
MAX_RESTART_ATTEMPTS=3
RESTART_COOLDOWN_MINUTES=5

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$STATE_DIR"
mkdir -p "$(dirname "$SLACK_WEBHOOK_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

send_slack() {
    local message="$1"
    local webhook_url

    if [[ -f "$SLACK_WEBHOOK_FILE" ]]; then
        webhook_url=$(grep -v "^#" "$SLACK_WEBHOOK_FILE" | grep -v "^$" | head -1 || echo "")
        if [[ -n "$webhook_url" ]]; then
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"text\": \"$message\"}" \
                "$webhook_url" > /dev/null 2>&1 || true
        fi
    fi
}

get_failed_count() {
    local member="$1"
    local count
    count=$(cat "$STATE_DIR/${member}.failcount" 2>/dev/null || echo "0")
    echo "$count"
}

increment_failed_count() {
    local member="$1"
    local count
    count=$(get_failed_count "$member")
    echo $((count + 1)) > "$STATE_DIR/${member}.failcount"
}

reset_failed_count() {
    local member="$1"
    rm -f "$STATE_DIR/${member}.failcount"
}

can_restart() {
    local member="$1"
    local last_restart
    last_restart=$(cat "$STATE_DIR/${member}.lastrestart" 2>/dev/null || echo "0")
    local now
    now=$(date +%s)
    local cooldown_seconds=$((RESTART_COOLDOWN_MINUTES * 60))

    if [[ $((now - last_restart)) -gt $cooldown_seconds ]]; then
        return 0
    else
        return 1
    fi
}

record_restart() {
    local member="$1"
    date +%s > "$STATE_DIR/${member}.lastrestart"
}

restart_member() {
    local member="$1"
    log "Attempting to restart member: $member"

    if ! can_restart "$member"; then
        log "Skipping restart for $member - cooldown period active"
        return 1
    fi

    local fail_count
    fail_count=$(get_failed_count "$member")

    if (( fail_count >= MAX_RESTART_ATTEMPTS )); then
        log "Max restart attempts ($MAX_RESTART_ATTEMPTS) reached for $member"
        send_slack ":alert: *Patroni Auto-Heal Failed* - $member exceeded max restart attempts"
        return 1
    fi

    local output
    if output=$(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- \
        patronictl restart "$CLUSTER_NAME" "$member" --force 2>&1); then
        log "Successfully restarted $member"
        reset_failed_count "$member"
        record_restart "$member"
        send_slack ":white_check_mark: *Patroni Auto-Heal* - Restarted $member successfully"
        return 0
    else
        log "Failed to restart $member: $output"
        increment_failed_count "$member"
        return 1
    fi
}

reinit_member() {
    local member="$1"
    log "Attempting to reinitialize member: $member"

    local output
    if output=$(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- \
        patronictl reinit "$CLUSTER_NAME" "$member" --force --wait 2>&1); then
        log "Successfully reinitialized $member"
        reset_failed_count "$member"
        send_slack ":white_check_mark: *Patroni Auto-Heal* - Reinitialized $member successfully"
        return 0
    else
        log "Failed to reinit $member: $output"
        return 1
    fi
}

heal_cluster() {
    local leader="$1"
    local members_status="$2"

    log "Analyzing cluster health with leader: $leader"

    local stopped_members
    stopped_members=$(echo "$members_status" | grep -oP 'STOPPED=\K[^ ]+')

    if [[ -z "$stopped_members" || "$stopped_members" == "0" ]]; then
        log "No stopped members detected"
        return 0
    fi

    while IFS= read -r member_line; do
        local member
        member=$(echo "$member_line" | awk '{print $2}' | tr -d '|')

        if echo "$member_line" | grep -q "stopped"; then
            log "Found stopped member: $member"

            if restart_member "$member"; then
                continue
            fi

            log "Restart failed, trying reinit for $member"
            if reinit_member "$member"; then
                continue
            fi

            log "All recovery attempts failed for $member"
            send_slack ":x: *Patroni Auto-Heal* - Failed to recover $member"
        fi
    done < <(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- patronictl list 2>/dev/null || echo "")
}

check_no_leader() {
    local attempts=0
    local max_attempts=3

    while (( attempts < max_attempts )); do
        local leader
        leader=$(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- \
            patronictl list 2>/dev/null | grep -oP 'Leader: \K[^|]+' | tr -d ' ' || echo "")

        if [[ -n "$leader" && "$leader" != "None" ]]; then
            echo "$leader"
            return 0
        fi

        ((attempts++)) || true
        sleep 10
    done

    echo ""
    return 1
}

main() {
    log "=== Patroni Auto-Heal Check ==="

    local leader=""
    leader=$(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- \
        patronictl list 2>/dev/null | grep -oP 'Leader: \K[^|]+' | tr -d ' ' || echo "")

    if [[ -z "$leader" || "$leader" == "None" || "$leader" == "" ]]; then
        log "No leader detected, attempting to trigger election..."

        local stopped_count=0
        local member

        while IFS= read -r line; do
            if echo "$line" | grep -q "Replica"; then
                member=$(echo "$line" | awk '{print $2}' | tr -d '|')
                if echo "$line" | grep -q "stopped"; then
                    ((stopped_count++)) || true
                    log "Attempting restart of $member to trigger election"
                    restart_member "$member" || true
                fi
            fi
        done < <(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- patronictl list 2>/dev/null || echo "")

        if (( stopped_count == 0 )); then
            log "All members appear to be stopped, forcing restart..."
            kubectl delete pod -n "$NAMESPACE" -l app=postgres-patroni --grace-period=30 2>/dev/null || true
        fi

        send_slack ":alert: *Patroni Alert* - No leader detected, attempting recovery..."
        log "No leader found after recovery attempts"
        return 1
    fi

    local members_status
    members_status=$(kubectl exec -n "$NAMESPACE" "postgres-patroni-0" -- patronictl list 2>/dev/null | tail -n +3 || echo "")

    if [[ -n "$members_status" ]]; then
        heal_cluster "$leader" "$members_status"
    fi

    log "=== Auto-heal check completed ==="
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi