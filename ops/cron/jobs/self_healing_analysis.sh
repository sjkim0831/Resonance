#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

log_info "Running Self-Healing Pattern Analysis Job"

API_URL="${API_BASE_URL:-${APP_URL%/home}}"
API_KEY="${CARBONET_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    log_error "CARBONET_API_KEY not set, skipping self-healing job"
    exit 0
fi

RESPONSE=$(curl "${CARBONET_CURL_ARGS[@]}" -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    "$API_URL/api/admin/self-healing/analyze")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    log_info "Self-healing analysis completed: $BODY"
else
    log_error "Self-healing analysis failed (HTTP $HTTP_CODE): $BODY"
fi
