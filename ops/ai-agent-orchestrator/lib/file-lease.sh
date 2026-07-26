#!/usr/bin/env bash
# lib/file-lease.sh - File-based lease management for distributed locking
# Features:
# - Atomic lease acquisition using mkdir
# - Lease renewal and expiration
# - Deadlock prevention via lease timeout
# - Multi-process safe operations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./status.sh
source "${SCRIPT_DIR}/status.sh"

# Lease configuration
LEASE_BASE_DIR="${LEASE_BASE_DIR:-/var/tmp/agent-worktrees/.leases}"
LEASE_LOCK_SUFFIX="${LEASE_LOCK_SUFFIX:-.lock}"
LEASE_PID_SUFFIX="${LEASE_PID_SUFFIX:-.pid}"
LEASE_META_SUFFIX="${LEASE_META_SUFFIX:-.meta}"
LEASE_DEFAULT_TTL="${LEASE_DEFAULT_TTL:-3600}"  # 1 hour default
LEASE_GRACE_PERIOD="${LEASE_GRACE_PERIOD:-60}"  # 1 minute grace for cleanup

# Initialize lease directory
_lease_init() {
    mkdir -p "$LEASE_BASE_DIR"
}

# _lease_lock_file - Get lock file path for resource
_lease_lock_file() {
    local resource_id="$1"
    echo "${LEASE_BASE_DIR}/${resource_id}${LEASE_LOCK_SUFFIX}"
}

# _lease_pid_file - Get PID file path for resource
_lease_pid_file() {
    local resource_id="$1"
    echo "${LEASE_BASE_DIR}/${resource_id}${LEASE_PID_SUFFIX}"
}

# _lease_meta_file - Get metadata file path for resource
_lease_meta_file() {
    local resource_id="$1"
    echo "${LEASE_BASE_DIR}/${resource_id}${LEASE_META_SUFFIX}"
}

# _lease_log - Log lease event
_lease_log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] lease: $msg"
}

# lease_exists - Check if a lease exists for resource
lease_exists() {
    local resource_id="$1"
    local lock_file
    lock_file=$(_lease_lock_file "$resource_id")
    [[ -d "$lock_file" ]]
}

# lease_get_holder - Get PID of current lease holder
lease_get_holder() {
    local resource_id="$1"
    local pid_file
    pid_file=$(_lease_pid_file "$resource_id")

    if [[ -f "$pid_file" ]]; then
        cat "$pid_file" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# lease_is_stale - Check if lease is stale (holder dead or expired)
lease_is_stale() {
    local resource_id="$1"
    local ttl="${2:-$LEASE_DEFAULT_TTL}"

    local meta_file
    meta_file=$(_lease_meta_file "$resource_id")

    if [[ ! -f "$meta_file" ]]; then
        return 0  # No metadata means stale
    fi

    local created_at
    created_at=$(cat "$meta_file" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('created_at', 0))" 2>/dev/null || echo "0")

    local now
    now=$(date +%s)
    local age=$((now - created_at))

    if [[ $age -gt $ttl ]]; then
        return 0  # Lease is stale
    fi

    return 1
}

# lease_process_alive - Check if a process is still alive
lease_process_alive() {
    local pid="$1"

    if [[ -z "$pid" ]]; then
        return 1
    fi

    if kill -0 "$pid" 2>/dev/null; then
        return 0
    fi
    return 1
}

# lease_can_grab - Check if we can grab a stale lease
lease_can_grab() {
    local resource_id="$1"
    local force="${2:-false}"

    if ! lease_exists "$resource_id"; then
        return 0  # No lease exists
    fi

    local holder
    holder=$(lease_get_holder "$resource_id")

    if [[ -z "$holder" ]]; then
        return 0  # No holder recorded
    fi

    if [[ "$force" == "true" ]]; then
        # Check if process is actually dead
        if ! lease_process_alive "$holder"; then
            return 0  # Process dead, can grab
        fi
        # Even if alive, force option allows grab
        return 0
    fi

    # Check if current holder is dead
    if ! lease_process_alive "$holder"; then
        return 0  # Holder dead, can grab
    fi

    # Check if lease is stale
    if lease_is_stale "$resource_id"; then
        return 0  # Lease expired, can grab
    fi

    return 1  # Lease is valid and held by alive process
}

# lease_acquire - Acquire a lease on a resource
# Options:
#   -t, --ttl SECONDS    Lease TTL (default: 3600)
#   -f, --force          Force acquire even if held by alive process
#   -w, --wait SECONDS   Wait for lease to become available
# Returns: 0 on success, 1 on failure
lease_acquire() {
    local resource_id="$1"
    shift

    local ttl="$LEASE_DEFAULT_TTL"
    local force="false"
    local wait_time="0"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--ttl)
                ttl="$2"
                shift 2
                ;;
            -f|--force)
                force="true"
                shift
                ;;
            -w|--wait)
                wait_time="$2"
                shift 2
                ;;
            *)
                _lease_log "ERROR" "Unknown option: $1"
                return 1
                ;;
        esac
    done

    _lease_init

    local lock_file
    lock_file=$(_lease_lock_file "$resource_id")

    # If lease exists, check if we can grab it
    if lease_exists "$resource_id"; then
        if [[ "$force" != "true" ]]; then
            if ! lease_can_grab "$resource_id"; then
                _lease_log "WARN" "Lease already held for $resource_id"

                # Wait if requested
                if [[ "$wait_time" -gt 0 ]]; then
                    _lease_log "INFO" "Waiting up to ${wait_time}s for lease on $resource_id"
                    local elapsed=0
                    local interval=1
                    while [[ $elapsed -lt $wait_time ]]; do
                        sleep "$interval"
                        elapsed=$((elapsed + interval))
                        if lease_can_grab "$resource_id"; then
                            _lease_log "INFO" "Lease became available for $resource_id after ${elapsed}s"
                            break
                        fi
                    done
                    if ! lease_can_grab "$resource_id"; then
                        _lease_log "ERROR" "Timeout waiting for lease on $resource_id"
                        return 1
                    fi
                else
                    return 1
                fi
            fi

            # Clean up stale lease
            _lease_log "INFO" "Cleaning up stale lease for $resource_id"
            lease_release "$resource_id" --force 2>/dev/null || true
        fi
    fi

    # Attempt atomic lease acquisition
    if mkdir "$lock_file" 2>/dev/null; then
        local pid_file meta_file
        pid_file=$(_lease_pid_file "$resource_id")
        meta_file=$(_lease_meta_file "$resource_id")

        echo "$$" > "$pid_file"

        local now
        now=$(date +%s)
        cat > "$meta_file" <<EOF
{
  "resource_id": "$resource_id",
  "holder_pid": $$,
  "holder_host": "$(hostname)",
  "created_at": $now,
  "ttl": $ttl,
  "acquired_at_iso": "$(date -Iseconds)"
}
EOF

        _lease_log "INFO" "Acquired lease for $resource_id (TTL: ${ttl}s, PID: $$)"
        return 0
    fi

    _lease_log "ERROR" "Failed to acquire lease for $resource_id"
    return 1
}

# lease_release - Release a lease on a resource
# Options:
#   -f, --force    Force release even if not holder
lease_release() {
    local resource_id="$1"
    shift

    local force="false"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--force)
                force="true"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    local lock_file pid_file meta_file
    lock_file=$(_lease_lock_file "$resource_id")
    pid_file=$(_lease_pid_file "$resource_id")
    meta_file=$(_lease_meta_file "$resource_id")

    if [[ ! -d "$lock_file" ]]; then
        _lease_log "WARN" "No lease exists for $resource_id"
        return 0
    fi

    # Check holder if not forcing
    if [[ "$force" != "true" ]]; then
        local holder
        holder=$(lease_get_holder "$resource_id")
        if [[ -n "$holder" && "$holder" != "$$" ]]; then
            _lease_log "ERROR" "Cannot release lease for $resource_id - held by PID $holder (mine: $$)"
            return 1
        fi
    fi

    # Remove all lease files/directories
    rm -rf "$lock_file" "$pid_file" "$meta_file" 2>/dev/null || true
    _lease_log "INFO" "Released lease for $resource_id"
    return 0
}

# lease_renew - Renew an existing lease
# Options:
#   -t, --ttl SECONDS    New TTL (default: keep existing)
lease_renew() {
    local resource_id="$1"
    shift

    local ttl=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--ttl)
                ttl="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    local lock_file pid_file meta_file
    lock_file=$(_lease_lock_file "$resource_id")
    pid_file=$(_lease_pid_file "$resource_id")
    meta_file=$(_lease_meta_file "$resource_id")

    if [[ ! -d "$lock_file" ]]; then
        _lease_log "ERROR" "No lease exists for $resource_id"
        return 1
    fi

    # Check holder
    local holder
    holder=$(lease_get_holder "$resource_id")
    if [[ -n "$holder" && "$holder" != "$$" ]]; then
        _lease_log "ERROR" "Cannot renew lease for $resource_id - held by PID $holder"
        return 1
    fi

    # Get existing TTL if not provided
    if [[ -z "$ttl" ]]; then
        ttl=$(cat "$meta_file" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('ttl', $LEASE_DEFAULT_TTL))" 2>/dev/null || echo "$LEASE_DEFAULT_TTL")
    fi

    local now
    now=$(date +%s)

    # Update metadata
    cat > "$meta_file" <<EOF
{
  "resource_id": "$resource_id",
  "holder_pid": $$,
  "holder_host": "$(hostname)",
  "created_at": $now,
  "ttl": $ttl,
  "acquired_at_iso": "$(date -Iseconds)",
  "renewed_at_iso": "$(date -Iseconds)"
}
EOF

    echo "$$" > "$pid_file"

    _lease_log "INFO" "Renewed lease for $resource_id (TTL: ${ttl}s, PID: $$)"
    return 0
}

# lease_status - Get status of a lease
lease_status() {
    local resource_id="$1"

    local lock_file pid_file meta_file
    lock_file=$(_lease_lock_file "$resource_id")
    pid_file=$(_lease_pid_file "$resource_id")
    meta_file=$(_lease_meta_file "$resource_id")

    if [[ ! -d "$lock_file" ]]; then
        echo "free"
        return 0
    fi

    local holder=""
    if [[ -f "$pid_file" ]]; then
        holder=$(cat "$pid_file" 2>/dev/null || echo "")
    fi

    if [[ -n "$holder" && "$holder" != "$$" ]]; then
        if lease_process_alive "$holder"; then
            echo "held_by_other (pid=$holder)"
        else
            echo "stale_dead (pid=$holder)"
        fi
    elif [[ -n "$holder" && "$holder" == "$$" ]]; then
        echo "held_by_self (pid=$$)"
    else
        echo "orphaned"
    fi

    return 0
}

# lease_list - List all leases
lease_list() {
    local format="${1:-table}"  # table or json

    if [[ ! -d "$LEASE_BASE_DIR" ]]; then
        if [[ "$format" == "json" ]]; then
            echo "[]"
        fi
        return 0
    fi

    local leases=()

    for lock_file in "${LEASE_BASE_DIR}"/*${LEASE_LOCK_SUFFIX}; do
        [[ -d "$lock_file" ]] || continue

        local resource_id
        resource_id=$(basename "$lock_file" "$LEASE_LOCK_SUFFIX")

        local status
        status=$(lease_status "$resource_id")

        local meta_file holder ttl created_at
        meta_file=$(_lease_meta_file "$resource_id")
        holder=$(lease_get_holder "$resource_id")
        ttl=$(cat "$meta_file" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('ttl',''))" 2>/dev/null || echo "")
        created_at=$(cat "$meta_file" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('acquired_at_iso',''))" 2>/dev/null || echo "")

        if [[ "$format" == "json" ]]; then
            leases+=("{\"resource_id\":\"$resource_id\",\"status\":\"$status\",\"holder\":\"$holder\",\"ttl\":$ttl,\"acquired_at\":\"$created_at\"}")
        else
            printf "%-30s %-20s %-10s %s\n" "$resource_id" "$status" "$holder" "$created_at"
        fi
    done

    if [[ "$format" == "json" ]]; then
        local temp_json="/tmp/lease_list_$$.json"
        echo "[" > "$temp_json"
        local first=true
        for lease in "${leases[@]:-}"; do
            if [[ -n "$lease" ]]; then
                if [[ "$first" == "true" ]]; then
                    first=false
                else
                    echo "," >> "$temp_json"
                fi
                echo "$lease" >> "$temp_json"
            fi
        done
        echo "]" >> "$temp_json"
        cat "$temp_json"
        rm -f "$temp_json"
    fi
}

# lease_cleanup_stale - Clean up stale leases
lease_cleanup_stale() {
    local force="${1:-false}"

    if [[ ! -d "$LEASE_BASE_DIR" ]]; then
        return 0
    fi

    local cleaned=0

    for lock_file in "${LEASE_BASE_DIR}"/*${LEASE_LOCK_SUFFIX}; do
        [[ -f "$lock_file" ]] || continue

        local resource_id
        resource_id=$(basename "$lock_file" "$LEASE_LOCK_SUFFIX")

        if lease_can_grab "$resource_id" "$force"; then
            _lease_log "INFO" "Cleaning up stale lease: $resource_id"
            rm -rf "$lock_file" "${lock_file%.lock}.pid" "${lock_file%.lock}.meta" 2>/dev/null || true
            cleaned=$((cleaned + 1))
        fi
    done

    _lease_log "INFO" "Cleaned up $cleaned stale leases"
    return 0
}

# lease_wait_for - Wait for a lease to become available
lease_wait_for() {
    local resource_id="$1"
    local timeout="${2:-60}"
    local poll_interval="${3:-1}"

    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        if lease_can_grab "$resource_id"; then
            return 0
        fi
        sleep "$poll_interval"
        elapsed=$((elapsed + poll_interval))
    done

    return 1
}

# Export configuration
export LEASE_BASE_DIR LEASE_LOCK_SUFFIX LEASE_PID_SUFFIX LEASE_META_SUFFIX
export LEASE_DEFAULT_TTL LEASE_GRACE_PERIOD

# Initialize on source
_lease_init