#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA) + pg_isready 사용
echo "[DEPRECATED] cubrid-broker-watchdog: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
BROKER_DEPLOYMENT="${BROKER_DEPLOYMENT:-cubrid-broker}"
DB_STATEFULSET="${DB_STATEFULSET:-cubrid-carbonet}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/log/cubrid-watchdog}"
LOCK_FILE="$ROOT_DIR/var/run/cubrid-watchdog.lock"
METRICS_FILE="$ROOT_DIR/var/run/cubrid-watchdog.metrics"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/cubrid-watchdog-events.jsonl"

mkdir -p "$LOG_DIR" "$(dirname "$LOCK_FILE")" "$(dirname "$METRICS_FILE")" "$(dirname "$EVENT_LOG")"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "$(date -Is) another watchdog run is active"; exit 0; }

log() {
    local msg="[cubrid-watchdog] $(date -Is) $*"
    printf '%s\n' "$msg"
}

log_event() {
    local status="$1"
    local code="$2"
    local message="$3"
    local ts
    ts=$(date -Iseconds)
    printf '{"ts":"%s","script":"cubrid-watchdog","status":"%s","code":"%s","message":"%s"}\n' \
        "$ts" "$status" "$code" "$message" >> "$EVENT_LOG"
}

update_metrics() {
    local metric="$1"
    local value="$2"
    local timestamp
    timestamp=$(date -Iseconds)
    case "$metric" in
        broker_health) echo "broker_health $value $timestamp" >> "$METRICS_FILE" ;;
        db_health) echo "db_health $value $timestamp" >> "$METRICS_FILE" ;;
        recovery_count) echo "recovery_count $value $timestamp" >> "$METRICS_FILE" ;;
    esac
}

get_broker_pods() {
    kubectl -n "$NAMESPACE" get pods -l "app=$BROKER_DEPLOYMENT" \
        --field-selector=status.phase=Running \
        -o jsonpath='{.items[*].metadata.name}' 2>/dev/null
}

get_db_pod() {
    kubectl -n "$NAMESPACE" get pods -l "app=$DB_STATEFULSET" \
        --field-selector=status.phase=Running \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

check_broker_port() {
    local pod="$1"
    local port="${2:-33000}"
    local timeout="${3:-5}"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "nc -z -w${timeout} localhost ${port}" >/dev/null 2>&1
}

check_broker_process() {
    local pod="$1"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "su cubrid -c 'cubrid broker status'" >/dev/null 2>&1
}

check_db_server() {
    local pod="$1"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "su cubrid -c 'cubrid server status'" >/dev/null 2>&1
}

check_db_connectivity() {
    local pod="$1"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "su cubrid -c 'csql -u dba -c \"SELECT 1;\" carbonet'" >/dev/null 2>&1
}

restart_broker_service() {
    local pod="$1"
    log "restarting broker service on $pod"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "su cubrid -c 'cubrid service restart'" || true
}

restart_db_server() {
    local pod="$1"
    log "restarting database server on $pod"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc "su cubrid -c 'cubrid server restart carbonet'" || true
}

delete_pod_for_recovery() {
    local pod="$1"
    local label="$2"
    log "deleting pod $pod for recovery"
    kubectl -n "$NAMESPACE" delete pod "$pod" --grace-period=30 --ignore-not-found=true || true
    local count=0
    while [[ $count -lt 60 ]]; do
        local new_pod
        new_pod=$(kubectl -n "$NAMESPACE" get pods -l "app=$label" \
            --field-selector=status.phase=Running \
            -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [[ -n "$new_pod" ]]; then
            log "new pod $new_pod is running"
            return 0
        fi
        sleep 5
        count=$((count + 1))
    done
    log "ERROR: pod recovery timeout"
    return 1
}

check_broker_deployment_health() {
    local total=0
    local healthy=0

    local broker_pods
    broker_pods=$(get_broker_pods)
    if [[ -z "$broker_pods" ]]; then
        log "WARN: no running broker pods"
        return 1
    fi

    for pod in $broker_pods; do
        total=$((total + 1))
        if check_broker_port "$pod" 33000 3; then
            healthy=$((healthy + 1))
        else
            log "broker pod $pod port check failed"
        fi
    done

    log "broker health: $healthy/$total pods responding on port 33000"

    if [[ $healthy -eq 0 && $total -gt 0 ]]; then
        return 1
    fi
    return 0
}

check_db_health() {
    local db_pod
    db_pod=$(get_db_pod)
    if [[ -z "$db_pod" ]]; then
        log "WARN: no running db pod"
        return 1
    fi

    log "checking db pod: $db_pod"

    if ! check_db_server "$db_pod" >/dev/null 2>&1; then
        log "WARN: database server status check failed on $db_pod"
        return 1
    fi

    if ! check_db_connectivity "$db_pod" >/dev/null 2>&1; then
        log "WARN: database connectivity check failed on $db_pod"
        return 1
    fi

    return 0
}

auto_heal_broker() {
    local broker_pods="$1"
    local healed=0

    for pod in $broker_pods; do
        log "attempting to heal broker pod: $pod"

        if ! check_broker_port "$pod" 33000 3; then
            log "port check failed, trying broker restart"
            restart_broker_service "$pod"
            sleep 10

            if check_broker_port "$pod" 33000 3; then
                log "broker recovered after restart"
                healed=$((healed + 1))
                continue
            fi
        fi

        log "broker restart did not help, deleting pod for recovery"
        delete_pod_for_recovery "$pod" "$BROKER_DEPLOYMENT"
        healed=$((healed + 1))
    done

    return 0
}

auto_heal_db() {
    local db_pod
    db_pod=$(get_db_pod)

    if [[ -z "$db_pod" ]]; then
        log "no db pod found, nothing to heal"
        return 0
    fi

    log "attempting to heal db pod: $db_pod"

    if ! check_db_server "$db_pod" >/dev/null 2>&1; then
        log "db server not responding, trying server restart"
        restart_db_server "$db_pod"
        sleep 15
    fi

    if ! check_db_connectivity "$db_pod" >/dev/null 2>&1; then
        log "db connectivity still failing, trying full service restart"
        restart_broker_service "$db_pod"
        sleep 20
    fi

    if ! check_db_health; then
        log "db health still failing, deleting pod for recovery"
        delete_pod_for_recovery "$db_pod" "$DB_STATEFULSET"
    fi

    return 0
}

main() {
    log "starting CUBRID broker watchdog"
    log_event "START" "STARTED" "watchdog started"

    local recovery_count=0

    if ! check_broker_deployment_health; then
        log "broker deployment health check failed"
        log_event "WARN" "BROKER_UNHEALTHY" "broker deployment unhealthy"

        local broker_pods
        broker_pods=$(get_broker_pods)
        if [[ -n "$broker_pods" ]]; then
            auto_heal_broker "$broker_pods"
            recovery_count=$((recovery_count + 1))
            update_metrics "recovery_count" "$recovery_count"
        fi
    else
        log "broker deployment healthy"
        update_metrics "broker_health" "1"
    fi

    if ! check_db_health; then
        log "database health check failed"
        log_event "WARN" "DB_UNHEALTHY" "database unhealthy"
        auto_heal_db
        recovery_count=$((recovery_count + 1))
        update_metrics "recovery_count" "$recovery_count"
    else
        log "database healthy"
        update_metrics "db_health" "1"
    fi

    local final_broker_health=0
    check_broker_deployment_health && final_broker_health=1
    local final_db_health=0
    check_db_health && final_db_health=1

    update_metrics "broker_health" "$final_broker_health"
    update_metrics "db_health" "$final_db_health"

    if [[ $final_broker_health -eq 1 && $final_db_health -eq 1 ]]; then
        log_event "OK" "ALL_HEALTHY" "all services healthy"
        log "all services healthy"
    else
        log_event "FAIL" "SERVICES_UNHEALTHY" "broker=$final_broker_health db=$final_db_health"
    fi

    log "watchdog cycle complete"
}

main "$@"