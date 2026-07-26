#!/usr/bin/env bash
# lib/status.sh - Task status constants and helper functions

# Guard against multiple sourcing
[[ -n "${STATUS_SH_SOURCED:-}" ]] && return 0
readonly STATUS_SH_SOURCED=1

# Task statuses
readonly STATUS_PENDING="PENDING"
readonly STATUS_RUNNING="RUNNING"
readonly STATUS_STALLED="STALLED"
readonly STATUS_BLOCKED="BLOCKED"
readonly STATUS_RETRYING="RETRYING"
readonly STATUS_REVIEW_REQUIRED="REVIEW_REQUIRED"
readonly STATUS_VERIFIED="VERIFIED"
readonly STATUS_DEPLOY_READY="DEPLOY_READY"
readonly STATUS_FAILED="FAILED"

# All valid statuses
readonly ALL_STATUSES=(
    "$STATUS_PENDING"
    "$STATUS_RUNNING"
    "$STATUS_STALLED"
    "$STATUS_BLOCKED"
    "$STATUS_RETRYING"
    "$STATUS_REVIEW_REQUIRED"
    "$STATUS_VERIFIED"
    "$STATUS_DEPLOY_READY"
    "$STATUS_FAILED"
)

# Valid terminal statuses (no further processing)
readonly TERMINAL_STATUSES=(
    "$STATUS_VERIFIED"
    "$STATUS_DEPLOY_READY"
    "$STATUS_FAILED"
)

# Approval-required actions
readonly APPROVAL_REQUIRED_ACTIONS=(
    "COMMIT"
    "DB_MUTATION"
    "DEPLOY"
    "PUSH"
    "DELETE"
)

# Status colors for terminal output
declare -gA STATUS_COLORS
STATUS_COLORS["$STATUS_PENDING"]="\033[33m"       # Yellow
STATUS_COLORS["$STATUS_RUNNING"]="\033[34m"       # Blue
STATUS_COLORS["$STATUS_STALLED"]="\033[35m"       # Magenta
STATUS_COLORS["$STATUS_BLOCKED"]="\033[36m"       # Cyan
STATUS_COLORS["$STATUS_RETRYING"]="\033[33m"      # Yellow
STATUS_COLORS["$STATUS_REVIEW_REQUIRED"]="\033[35m" # Magenta
STATUS_COLORS["$STATUS_VERIFIED"]="\033[32m"      # Green
STATUS_COLORS["$STATUS_DEPLOY_READY"]="\033[32m" # Green
STATUS_COLORS["$STATUS_FAILED"]="\033[31m"        # Red
STATUS_COLORS["RESET"]="\033[0m"

# status_is_valid - Check if a status value is valid
status_is_valid() {
    local status="$1"
    for s in "${ALL_STATUSES[@]}"; do
        [[ "$s" == "$status" ]] && return 0
    done
    return 1
}

# status_is_terminal - Check if a status is terminal (no further processing)
status_is_terminal() {
    local status="$1"
    for s in "${TERMINAL_STATUSES[@]}"; do
        [[ "$s" == "$status" ]] && return 0
    done
    return 1
}

# status_color - Get ANSI color code for a status
status_color() {
    local status="$1"
    echo "${STATUS_COLORS[$status]:-${STATUS_COLORS[RESET]}}"
}

# status_reset - Get reset color code
status_reset() {
    echo "${STATUS_COLORS[RESET]}"
}

# status_requires_approval - Check if action requires explicit approval flag
status_requires_approval() {
    local action="$1"
    for a in "${APPROVAL_REQUIRED_ACTIONS[@]}"; do
        [[ "$a" == "$action" ]] && return 0
    done
    return 1
}

# Export constants for use in other scripts
export STATUS_PENDING STATUS_RUNNING STATUS_STALLED STATUS_BLOCKED
export STATUS_RETRYING STATUS_REVIEW_REQUIRED STATUS_VERIFIED STATUS_DEPLOY_READY STATUS_FAILED