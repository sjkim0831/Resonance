#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/show-emission-management-rollout-board.sh [base-url]
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-readonly.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-board-ready.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes

Purpose:
  Print authenticated `/admin/emission/management/page-data` rollout summary
  cards and scope rows from the running local service without executing save or
  calculate.

Environment overrides:
  PORT
  CONFIG_DIR
  ENV_FILE
  EMISSION_VERIFY_CACHE_DIR
  EMISSION_HTTP_RETRIES
  EMISSION_HTTP_RETRY_SECONDS
  EMISSION_ROLLOUT_OUTPUT
  EMISSION_ROLLOUT_FILTER_SCOPES
  EMISSION_EXPECT_READY_SCOPES
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="show-emission-management-rollout-board"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
EMISSION_VERIFY_CACHE_DIR="${EMISSION_VERIFY_CACHE_DIR:-/tmp/emission-management-verify-cache}"
EMISSION_HTTP_RETRIES="${EMISSION_HTTP_RETRIES:-3}"
EMISSION_HTTP_RETRY_SECONDS="${EMISSION_HTTP_RETRY_SECONDS:-1}"
EMISSION_ROLLOUT_OUTPUT="${EMISSION_ROLLOUT_OUTPUT:-text}"
EMISSION_ROLLOUT_FILTER_SCOPES="${EMISSION_ROLLOUT_FILTER_SCOPES:-}"
EMISSION_EXPECT_READY_SCOPES="${EMISSION_EXPECT_READY_SCOPES:-}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
emission_require_allowed_value "EMISSION_ROLLOUT_OUTPUT" "$EMISSION_ROLLOUT_OUTPUT" text json

TMP_DIR="$(mktemp -d /tmp/emission-rollout-board.XXXXXX)"
CLASSPATH_FILE="$EMISSION_VERIFY_CACHE_DIR/runtime.classpath"
JAVA_SOURCE="$EMISSION_VERIFY_CACHE_DIR/ForgeEmissionManagementToken.java"
JAVA_CLASS_DIR="$EMISSION_VERIFY_CACHE_DIR/classes"
COOKIE_JAR="$TMP_DIR/cookies.txt"
SESSION_JSON="$TMP_DIR/session.json"
PAGE_DATA_JSON="$TMP_DIR/page-data.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
emission_load_optional_env "$ENV_FILE"
TOKEN_ACCESS_SECRET="${TOKEN_ACCESS_SECRET:-change-me-access-secret}"
TOKEN_REFRESH_SECRET="${TOKEN_REFRESH_SECRET:-change-me-refresh-secret}"

emission_require_cmd curl
emission_require_cmd mvn
emission_require_cmd javac
emission_require_cmd java
emission_require_cmd python3
emission_require_file "$ROOT_DIR/pom.xml"
emission_require_file "$ROOT_DIR/target/classes/egovframework/com/feature/auth/util/JwtTokenProvider.class"

emission_prepare_cached_runtime_artifacts
emission_create_cookie_jar "$COOKIE_JAR"

emission_info "verifying authenticated frontend session"
emission_curl_to_file_with_retry "$SESSION_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/frontend/session" || emission_fail "frontend session request failed"

python3 - <<'PY' "$SESSION_JSON"
import json, sys
session = json.load(open(sys.argv[1], encoding="utf-8"))
if not session.get("authenticated"):
    raise SystemExit("frontend session is not authenticated")
if session.get("actualUserId") != "webmaster":
    raise SystemExit("frontend session actualUserId is not webmaster")
PY

emission_info "loading rollout board page-data"
emission_curl_to_file_with_retry "$PAGE_DATA_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/emission/management/page-data" || emission_fail "page-data request failed"

python3 - <<'PY' "$ROOT_DIR" "$PAGE_DATA_JSON" "$EMISSION_ROLLOUT_OUTPUT" "$EMISSION_ROLLOUT_FILTER_SCOPES" "$EMISSION_EXPECT_READY_SCOPES"
import json
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import render_board_row_lines, split_scopes

path, output_mode, filter_scopes_raw, expected_ready_raw = sys.argv[2:6]
data = json.load(open(path, encoding="utf-8"))
cards = data.get("rolloutSummaryCards") or []
rows = data.get("rolloutStatusRows") or []
filter_scopes = set(split_scopes(filter_scopes_raw))
expected_ready_scopes = set(split_scopes(expected_ready_raw))

normalized_rows = []
for row in rows:
    scope = f"{str(row.get('categoryCode') or '').strip().upper()}:{row.get('tier')}"
    if filter_scopes and scope not in filter_scopes:
        continue
    normalized_rows.append({
        "scope": scope,
        "categoryCode": row.get("categoryCode"),
        "tier": row.get("tier"),
        "promotionStatus": row.get("promotionStatus"),
        "definitionFormulaAdopted": row.get("definitionFormulaAdopted"),
        "draftId": row.get("draftId"),
        "sessionId": row.get("sessionId"),
        "resultId": row.get("resultId"),
    })

if expected_ready_scopes:
    row_map = {row["scope"]: row for row in normalized_rows}
    missing = []
    not_ready = []
    not_adopted = []
    for scope in expected_ready_scopes:
        row = row_map.get(scope)
        if row is None:
            missing.append(scope)
            continue
        if str(row.get("promotionStatus") or "").strip().upper() != "READY":
            not_ready.append(f"{scope}={row.get('promotionStatus')}")
        if not bool(row.get("definitionFormulaAdopted")):
            not_adopted.append(scope)
    if missing or not_ready or not_adopted:
        problems = []
        if missing:
            problems.append("missing rows: " + ", ".join(missing))
        if not_ready:
            problems.append("non-READY rows: " + ", ".join(not_ready))
        if not_adopted:
            problems.append("definitionFormulaAdopted=false: " + ", ".join(not_adopted))
        raise SystemExit("; ".join(problems))

if output_mode == "json":
    print(json.dumps({
        "rolloutSummaryCards": cards,
        "rolloutStatusRows": normalized_rows,
    }, ensure_ascii=False, indent=2))
    raise SystemExit(0)

print("[show-emission-management-rollout-board] summary")
for card in cards:
    print(f"[show-emission-management-rollout-board]   {card.get('title')}: {card.get('value')}")
print(f"[show-emission-management-rollout-board] scopes: {len(normalized_rows)}")
for line in render_board_row_lines("show-emission-management-rollout-board", normalized_rows):
    print(line)
PY
