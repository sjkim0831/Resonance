#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-flow.sh [base-url]

Purpose:
  Verify that the admin emission management route and API flow work against the
  running local service, including:
  - authenticated webmaster session bootstrap
  - page route and page-data
  - category/tier/variable/factor fetch
  - input session save
  - input session readback
  - calculation execution

Default verification path:
  - category: LIME
  - tier: first available tier
  - input: LIME_TYPE = 고칼슘석회, MLI = 10
  - expected total: 7.5 tCO2
  - expected formula: SUM(EF석회,i * Ml,i)

Environment overrides:
  PORT
  CONFIG_DIR
  ENV_FILE
  EXPECTED_CATEGORY_SUBCODE
  EXPECTED_INPUT_VAR_CODE
  EXPECTED_INPUT_VALUE
  EXPECTED_TIER
  EXPECTED_CO2_TOTAL
  EXPECTED_FORMULA_SUMMARY
  EXPECTED_PROMOTION_STATUS
  EXPECTED_DRAFT_ID_PREFIX
  EXPECTED_CALCULATION_SOURCE
  EXPECTED_READY_SCOPES
  INVALID_INPUT_VAR_CODE
  SAVE_PAYLOAD_JSON
  SAVE_PAYLOAD_FILE
  VERIFY_DEFINITION_PUBLISH
  DEFINITION_RUNTIME_MODE
  DEFINITION_FORMULA
  DEFINITION_TIER_LABEL
  DEFINITION_DRAFT_JSON
  DEFINITION_DRAFT_FILE
  DEFINITION_MATERIALIZE
  VERIFY_SAVED_VALUE
  VERIFY_INVALID_VARIABLE_CODE
  VERIFY_ROLLOUT_STATUS
  VERIFY_CO2_TOTAL
  VERIFY_FORMULA_SUMMARY
  EMISSION_VERIFY_CACHE_DIR
  EMISSION_HTTP_RETRIES
  EMISSION_HTTP_RETRY_SECONDS
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-flow"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
EXPECTED_CATEGORY_SUBCODE="${EXPECTED_CATEGORY_SUBCODE:-LIME}"
EXPECTED_INPUT_VAR_CODE="${EXPECTED_INPUT_VAR_CODE:-MLI}"
EXPECTED_INPUT_VALUE="${EXPECTED_INPUT_VALUE:-10}"
EXPECTED_TIER="${EXPECTED_TIER:-}"
EXPECTED_CO2_TOTAL="${EXPECTED_CO2_TOTAL:-7.5}"
EXPECTED_FORMULA_SUMMARY="${EXPECTED_FORMULA_SUMMARY:-SUM(EF석회,i * Ml,i)}"
EXPECTED_PROMOTION_STATUS="${EXPECTED_PROMOTION_STATUS:-READY}"
EXPECTED_DRAFT_ID_PREFIX="${EXPECTED_DRAFT_ID_PREFIX:-BUILTIN:}"
EXPECTED_CALCULATION_SOURCE="${EXPECTED_CALCULATION_SOURCE:-PUBLISHED_DEFINITION}"
EXPECTED_READY_SCOPES="${EXPECTED_READY_SCOPES:-}"
INVALID_INPUT_VAR_CODE="${INVALID_INPUT_VAR_CODE:-INVALID_VAR_CODE}"
SAVE_PAYLOAD_JSON="${SAVE_PAYLOAD_JSON:-}"
SAVE_PAYLOAD_FILE="${SAVE_PAYLOAD_FILE:-}"
VERIFY_DEFINITION_PUBLISH="${VERIFY_DEFINITION_PUBLISH:-false}"
DEFINITION_RUNTIME_MODE="${DEFINITION_RUNTIME_MODE:-AUTO}"
DEFINITION_FORMULA="${DEFINITION_FORMULA:-SUM(EF석회,i * Ml,i)}"
DEFINITION_TIER_LABEL="${DEFINITION_TIER_LABEL:-Tier 1}"
DEFINITION_DRAFT_JSON="${DEFINITION_DRAFT_JSON:-}"
DEFINITION_DRAFT_FILE="${DEFINITION_DRAFT_FILE:-}"
DEFINITION_MATERIALIZE="${DEFINITION_MATERIALIZE:-false}"
VERIFY_SAVED_VALUE="${VERIFY_SAVED_VALUE:-true}"
VERIFY_INVALID_VARIABLE_CODE="${VERIFY_INVALID_VARIABLE_CODE:-true}"
VERIFY_ROLLOUT_STATUS="${VERIFY_ROLLOUT_STATUS:-true}"
VERIFY_CO2_TOTAL="${VERIFY_CO2_TOTAL:-true}"
VERIFY_FORMULA_SUMMARY="${VERIFY_FORMULA_SUMMARY:-true}"
EMISSION_VERIFY_CACHE_DIR="${EMISSION_VERIFY_CACHE_DIR:-/tmp/emission-management-verify-cache}"
EMISSION_HTTP_RETRIES="${EMISSION_HTTP_RETRIES:-3}"
EMISSION_HTTP_RETRY_SECONDS="${EMISSION_HTTP_RETRY_SECONDS:-1}"

TMP_DIR="$(mktemp -d /tmp/emission-management-flow.XXXXXX)"
CLASSPATH_FILE="$EMISSION_VERIFY_CACHE_DIR/runtime.classpath"
JAVA_SOURCE="$EMISSION_VERIFY_CACHE_DIR/ForgeEmissionManagementToken.java"
JAVA_CLASS_DIR="$EMISSION_VERIFY_CACHE_DIR/classes"
COOKIE_JAR="$TMP_DIR/cookies.txt"
SESSION_JSON="$TMP_DIR/session.json"
HTML_FILE="$TMP_DIR/page.html"
PAGE_DATA_JSON="$TMP_DIR/page-data.json"
CATEGORIES_JSON="$TMP_DIR/categories.json"
TIERS_JSON="$TMP_DIR/tiers.json"
VARIABLES_JSON="$TMP_DIR/variables.json"
LIME_FACTOR_JSON="$TMP_DIR/lime-factor.json"
SAVE_REQUEST_JSON="$TMP_DIR/save-request.json"
SAVE_RESPONSE_JSON="$TMP_DIR/save-response.json"
SESSION_RESPONSE_JSON="$TMP_DIR/input-session.json"
CALC_RESPONSE_JSON="$TMP_DIR/calc-response.json"
INVALID_RESPONSE_JSON="$TMP_DIR/invalid-response.json"
DEFINITION_SAVE_REQUEST_JSON="$TMP_DIR/definition-save-request.json"
DEFINITION_SAVE_RESPONSE_JSON="$TMP_DIR/definition-save-response.json"
DEFINITION_PUBLISH_RESPONSE_JSON="$TMP_DIR/definition-publish-response.json"
DEFINITION_MATERIALIZE_RESPONSE_JSON="$TMP_DIR/definition-materialize-response.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
emission_load_optional_env "$ENV_FILE"
TOKEN_ACCESS_SECRET="${TOKEN_ACCESS_SECRET:-change-me-access-secret}"
TOKEN_REFRESH_SECRET="${TOKEN_REFRESH_SECRET:-change-me-refresh-secret}"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"

emission_require_cmd curl
emission_require_cmd mvn
emission_require_cmd javac
emission_require_cmd java
emission_require_cmd python3
emission_require_file "$ROOT_DIR/pom.xml"
emission_require_file "$ROOT_DIR/target/classes/egovframework/com/feature/auth/util/JwtTokenProvider.class"
emission_require_allowed_value "VERIFY_DEFINITION_PUBLISH" "$VERIFY_DEFINITION_PUBLISH" "true" "false"
emission_require_allowed_value "DEFINITION_RUNTIME_MODE" "$DEFINITION_RUNTIME_MODE" "AUTO" "SHADOW" "PRIMARY"
emission_require_allowed_value "DEFINITION_MATERIALIZE" "$DEFINITION_MATERIALIZE" "true" "false"

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
if session.get("authorCode") != "ROLE_SYSTEM_MASTER":
    raise SystemExit("frontend session authorCode is not ROLE_SYSTEM_MASTER")
if "A0020107_VIEW" not in (session.get("featureCodes") or []):
    raise SystemExit("A0020107_VIEW is missing from featureCodes")
if "A0020107_SESSION_SAVE" not in (session.get("featureCodes") or []):
    raise SystemExit("A0020107_SESSION_SAVE is missing from featureCodes")
if "A0020107_CALCULATE" not in (session.get("featureCodes") or []):
    raise SystemExit("A0020107_CALCULATE is missing from featureCodes")
PY
CSRF_INFO="$(python3 - <<'PY' "$SESSION_JSON"
import json, sys
session = json.load(open(sys.argv[1], encoding="utf-8"))
print(session.get("csrfToken") or "")
print(session.get("csrfHeaderName") or "X-CSRF-TOKEN")
PY
)"
CSRF_TOKEN="$(printf '%s\n' "$CSRF_INFO" | sed -n '1p')"
CSRF_HEADER="$(printf '%s\n' "$CSRF_INFO" | sed -n '2p')"
[[ -n "$CSRF_TOKEN" ]] || emission_fail "csrfToken is missing from frontend session"

if [[ "$VERIFY_DEFINITION_PUBLISH" == "true" ]]; then
  emission_info "saving definition draft for runtime-mode verification"
  if [[ -n "$DEFINITION_DRAFT_FILE" ]]; then
    emission_require_file "$DEFINITION_DRAFT_FILE"
    cp "$DEFINITION_DRAFT_FILE" "$DEFINITION_SAVE_REQUEST_JSON"
  elif [[ -n "$DEFINITION_DRAFT_JSON" ]]; then
    printf '%s' "$DEFINITION_DRAFT_JSON" > "$DEFINITION_SAVE_REQUEST_JSON"
  else
    python3 - <<'PY' "$DEFINITION_SAVE_REQUEST_JSON" "$EXPECTED_CATEGORY_SUBCODE" "$DEFINITION_FORMULA" "$DEFINITION_RUNTIME_MODE" "$DEFINITION_TIER_LABEL"
import json, sys
path, category_code, formula, runtime_mode, tier_label = sys.argv[1:6]
category_code = category_code.strip().upper()
draft = {
    "categoryCode": category_code,
    "categoryName": "Codex verification definition",
    "tierLabel": tier_label,
    "formula": formula,
    "formulaTree": [{
        "joiner": "",
        "kind": "sum",
        "iterator": "i",
        "items": [
            {"joiner": "", "kind": "token", "token": "EF석회,i"},
            {"joiner": "×", "kind": "token", "token": "Ml,i"},
        ],
    }],
    "inputMode": "NUMBER",
    "policies": ["input_required_yn", "default_capable_yn"],
    "directRequiredCodes": ["MLI"],
    "fallbackCodes": ["EF_LIME"],
    "autoCalculatedCodes": [],
    "supplementalCodes": [],
    "sections": [],
    "variableDefinitions": [],
    "runtimeMode": runtime_mode,
    "note": "Codex runtime-mode verification snapshot"
}
open(path, "w", encoding="utf-8").write(json.dumps(draft, ensure_ascii=False))
PY
  fi
  DEFINITION_SAVE_STATUS="$(emission_curl_status_with_retry "$DEFINITION_SAVE_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'Content-Type: application/json' --data @"$DEFINITION_SAVE_REQUEST_JSON" "$BASE_URL/admin/api/admin/emission-definition-studio/drafts")" || emission_fail "definition draft save transport failed"
  [[ "$DEFINITION_SAVE_STATUS" == "200" ]] || emission_fail "definition draft save failed with status $DEFINITION_SAVE_STATUS"
  EXPECTED_DRAFT_ID_PREFIX="$(python3 - <<'PY' "$DEFINITION_SAVE_RESPONSE_JSON"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
draft_id = str(data.get("draftId") or "")
if not draft_id:
    raise SystemExit("definition draft save response missing draftId")
print(draft_id)
PY
)"
  emission_info "publishing definition draft: $EXPECTED_DRAFT_ID_PREFIX"
  DEFINITION_PUBLISH_STATUS="$(emission_curl_status_with_retry "$DEFINITION_PUBLISH_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'X-Requested-With: XMLHttpRequest' "$BASE_URL/admin/api/admin/emission-definition-studio/drafts/$EXPECTED_DRAFT_ID_PREFIX/publish")" || emission_fail "definition publish transport failed"
  [[ "$DEFINITION_PUBLISH_STATUS" == "200" ]] || emission_fail "definition publish failed with status $DEFINITION_PUBLISH_STATUS"
  if [[ "$DEFINITION_MATERIALIZE" == "true" ]]; then
    emission_info "materializing published definition scope: $EXPECTED_DRAFT_ID_PREFIX"
    DEFINITION_MATERIALIZE_STATUS="$(emission_curl_status_with_retry "$DEFINITION_MATERIALIZE_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'X-Requested-With: XMLHttpRequest' "$BASE_URL/admin/api/admin/emission-management/definition-scopes/$EXPECTED_DRAFT_ID_PREFIX/materialize")" || emission_fail "definition materialize transport failed"
    [[ "$DEFINITION_MATERIALIZE_STATUS" == "200" ]] || emission_fail "definition materialize failed with status $DEFINITION_MATERIALIZE_STATUS"
  fi
fi

emission_info "loading admin shell route"
emission_curl_to_file_with_retry "$HTML_FILE" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/emission/management" || emission_fail "route request failed"
grep -q 'window\.__CARBONET_REACT_BOOTSTRAP__ = config\.reactBootstrapPayload || {};' "$HTML_FILE" || emission_fail "shell bootstrap assignment is missing"

emission_info "loading emission management page-data"
emission_curl_to_file_with_retry "$PAGE_DATA_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/emission/management/page-data" || emission_fail "page-data request failed"
python3 - <<'PY' "$PAGE_DATA_JSON"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
if data.get("menuCode") != "A0020107":
    raise SystemExit("page-data menuCode is not A0020107")
PY

emission_info "loading categories"
emission_curl_to_file_with_retry "$CATEGORIES_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/api/admin/emission-management/categories" || emission_fail "categories request failed"
CATEGORY_ID="$(python3 - <<'PY' "$CATEGORIES_JSON" "$EXPECTED_CATEGORY_SUBCODE"
import json, sys
items = json.load(open(sys.argv[1], encoding="utf-8")).get("items") or []
expected = sys.argv[2].strip().upper()
chosen = next((item for item in items if str(item.get("subCode", "")).upper() == expected), None)
if not chosen:
    raise SystemExit(f"category not found for subCode={expected}")
print(chosen.get("categoryId") or "")
PY
)"
[[ -n "$CATEGORY_ID" ]] || emission_fail "failed to resolve category id"

emission_info "loading tiers"
emission_curl_to_file_with_retry "$TIERS_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/api/admin/emission-management/categories/$CATEGORY_ID/tiers" || emission_fail "tiers request failed"
TIER="$(python3 - <<'PY' "$TIERS_JSON" "$EXPECTED_TIER"
import json, sys
tiers = json.load(open(sys.argv[1], encoding="utf-8")).get("tiers") or []
expected_tier = sys.argv[2].strip()
if not tiers:
    raise SystemExit("tier list is empty")
if expected_tier:
    chosen = next((item for item in tiers if str(item.get("tier") or "") == expected_tier), None)
    if not chosen:
        raise SystemExit(f"expected tier missing: {expected_tier}")
    print(chosen.get("tier") or "")
    raise SystemExit(0)
print(tiers[0].get("tier") or "")
PY
)"
[[ -n "$TIER" ]] || emission_fail "failed to resolve tier"

emission_info "loading variable definitions"
emission_curl_to_file_with_retry "$VARIABLES_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/api/admin/emission-management/categories/$CATEGORY_ID/tiers/$TIER/variables" || emission_fail "variables request failed"
python3 - <<'PY' "$VARIABLES_JSON" "$EXPECTED_INPUT_VAR_CODE"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
expected_code = sys.argv[2].strip().upper()
variable_codes = [str(item.get("varCode", "")).upper() for item in (data.get("variables") or [])]
if expected_code not in variable_codes:
    raise SystemExit(f"expected variable code is missing: {expected_code}")
PY

emission_info "loading lime default factor"
emission_curl_to_file_with_retry "$LIME_FACTOR_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/api/admin/emission-management/lime/default-factor" || emission_fail "lime default factor request failed"

if [[ "$VERIFY_INVALID_VARIABLE_CODE" == "true" ]]; then
  emission_info "verifying invalid variable rejection"
  python3 - <<'PY' "$SAVE_REQUEST_JSON" "$CATEGORY_ID" "$TIER" "$INVALID_INPUT_VAR_CODE"
import json, sys
path, category_id, tier, invalid_var_code = sys.argv[1:5]
payload = {
    "categoryId": int(category_id),
    "tier": int(tier),
    "createdBy": "codex-invalid-check",
    "values": [{"varCode": invalid_var_code, "lineNo": 1, "valueNum": 10.0}]
}
open(path, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False))
PY
  INVALID_STATUS="$(emission_curl_status_with_retry "$INVALID_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'Content-Type: application/json' --data @"$SAVE_REQUEST_JSON" "$BASE_URL/admin/api/admin/emission-management/input-sessions")" || emission_fail "invalid variable request failed"
  [[ "$INVALID_STATUS" == "500" ]] || emission_fail "invalid variable request should fail with 500 but was $INVALID_STATUS"
  grep -q '"status":"error"' "$INVALID_RESPONSE_JSON" || emission_fail "invalid variable response did not return error payload"
fi

emission_info "saving input session"
if [[ -n "$SAVE_PAYLOAD_FILE" ]]; then
  emission_require_file "$SAVE_PAYLOAD_FILE"
  python3 - <<'PY' "$SAVE_PAYLOAD_FILE" "$SAVE_REQUEST_JSON" "$CATEGORY_ID" "$TIER"
import pathlib, sys
source_path, output_path, category_id, tier = sys.argv[1:5]
text = pathlib.Path(source_path).read_text(encoding="utf-8")
text = text.replace("__CATEGORY_ID__", category_id).replace("__TIER__", tier)
pathlib.Path(output_path).write_text(text, encoding="utf-8")
PY
elif [[ -n "$SAVE_PAYLOAD_JSON" ]]; then
  printf '%s' "$SAVE_PAYLOAD_JSON" > "$SAVE_REQUEST_JSON"
else
python3 - <<'PY' "$SAVE_REQUEST_JSON" "$CATEGORY_ID" "$TIER" "$EXPECTED_INPUT_VALUE"
import json, sys
path, category_id, tier, value = sys.argv[1:5]
payload = {
    "categoryId": int(category_id),
    "tier": int(tier),
    "createdBy": "codex-local-verify",
    "values": [
        {"varCode": "LIME_TYPE", "lineNo": 1, "valueText": "HIGH_CALCIUM"},
        {"varCode": "MLI", "lineNo": 1, "valueNum": float(value)}
    ]
}
open(path, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False))
PY
fi
SAVE_STATUS="$(emission_curl_status_with_retry "$SAVE_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'Content-Type: application/json' --data @"$SAVE_REQUEST_JSON" "$BASE_URL/admin/api/admin/emission-management/input-sessions")" || emission_fail "save request transport failed"
[[ "$SAVE_STATUS" == "200" ]] || emission_fail "save request failed with status $SAVE_STATUS"

SESSION_ID="$(python3 - <<'PY' "$SAVE_RESPONSE_JSON"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
if not data.get("success"):
    raise SystemExit("save response success flag is false")
print(data.get("sessionId") or "")
PY
)"
[[ -n "$SESSION_ID" ]] || emission_fail "save response did not include sessionId"

emission_info "loading saved input session"
GET_STATUS="$(emission_curl_status_with_retry "$SESSION_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/api/admin/emission-management/input-sessions/$SESSION_ID")" || emission_fail "input session lookup transport failed"
[[ "$GET_STATUS" == "200" ]] || emission_fail "input session lookup failed with status $GET_STATUS"
if [[ "$VERIFY_SAVED_VALUE" == "true" ]]; then
python3 - <<'PY' "$SESSION_RESPONSE_JSON" "$EXPECTED_INPUT_VAR_CODE" "$EXPECTED_INPUT_VALUE"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
expected_var = sys.argv[2].strip().upper()
expected_value = float(sys.argv[3])
values = data.get("values") or []
match = next((item for item in values if str(item.get("varCode", "")).upper() == expected_var), None)
if not match:
    raise SystemExit(f"saved varCode not found: {expected_var}")
actual = float(match.get("valueNum"))
if abs(actual - expected_value) > 1e-9:
    raise SystemExit(f"saved value mismatch: expected={expected_value}, actual={actual}")
PY
fi

emission_info "executing calculation"
CALC_STATUS="$(emission_curl_status_with_retry "$CALC_RESPONSE_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST -H "$CSRF_HEADER: $CSRF_TOKEN" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/admin/api/admin/emission-management/input-sessions/$SESSION_ID/calculate")" || emission_fail "calculate request transport failed"
[[ "$CALC_STATUS" == "200" ]] || emission_fail "calculate request failed with status $CALC_STATUS"
CALC_INFO="$(python3 - <<'PY' "$CALC_RESPONSE_JSON"
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
print(data.get("co2Total"))
print(str(data.get("formulaSummary", "")).strip())
print(str(data.get("calculationSource", "")).strip())
PY
)"
ACTUAL_CO2_TOTAL="$(printf '%s\n' "$CALC_INFO" | sed -n '1p')"
ACTUAL_FORMULA_SUMMARY="$(printf '%s\n' "$CALC_INFO" | sed -n '2p')"
ACTUAL_CALCULATION_SOURCE="$(printf '%s\n' "$CALC_INFO" | sed -n '3p')"
if [[ "$VERIFY_CO2_TOTAL" == "true" ]]; then
  python3 - <<'PY' "$ACTUAL_CO2_TOTAL" "$EXPECTED_CO2_TOTAL"
import sys
actual_total = float(sys.argv[1])
expected_total = float(sys.argv[2])
if abs(actual_total - expected_total) > 1e-9:
    raise SystemExit(f"co2Total mismatch: expected={expected_total}, actual={actual_total}")
PY
fi
if [[ "$VERIFY_FORMULA_SUMMARY" == "true" ]]; then
  [[ "$ACTUAL_FORMULA_SUMMARY" == "$EXPECTED_FORMULA_SUMMARY" ]] || emission_fail "formulaSummary mismatch"
fi
if [[ -n "$EXPECTED_CALCULATION_SOURCE" ]]; then
  [[ "$ACTUAL_CALCULATION_SOURCE" == "$EXPECTED_CALCULATION_SOURCE" ]] || emission_fail "calculationSource mismatch: expected=$EXPECTED_CALCULATION_SOURCE actual=$ACTUAL_CALCULATION_SOURCE"
fi
if [[ "$VERIFY_ROLLOUT_STATUS" == "true" ]]; then
  emission_info "verifying rollout board status"
  emission_curl_to_file_with_retry "$PAGE_DATA_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/emission/management/page-data" || emission_fail "page-data request failed during rollout verification"
  python3 - <<'PY' "$ROOT_DIR" "$PAGE_DATA_JSON" "$EXPECTED_CATEGORY_SUBCODE" "$TIER" "$EXPECTED_PROMOTION_STATUS" "$EXPECTED_DRAFT_ID_PREFIX" "$EXPECTED_READY_SCOPES"
import json
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import split_scopes

data = json.load(open(sys.argv[2], encoding="utf-8"))
expected_category = sys.argv[3].strip().upper()
expected_tier = int(sys.argv[4])
expected_status = sys.argv[5].strip().upper()
expected_draft_prefix = sys.argv[6]
expected_ready_scopes = split_scopes(sys.argv[7])

rows = data.get("rolloutStatusRows") or []
row = next((
    item for item in rows
    if str(item.get("categoryCode", "")).strip().upper() == expected_category
    and int(item.get("tier")) == expected_tier
), None)
if row is None:
    raise SystemExit(f"rollout row not found for {expected_category}:{expected_tier}")

actual_status = str(row.get("promotionStatus", "")).strip().upper()
if actual_status != expected_status:
    raise SystemExit(f"promotionStatus mismatch: expected={expected_status}, actual={actual_status}")
if not bool(row.get("definitionFormulaAdopted")):
    raise SystemExit("definitionFormulaAdopted is false on rollout row")
draft_id = str(row.get("draftId") or "")
if expected_draft_prefix and not draft_id.startswith(expected_draft_prefix):
    raise SystemExit(f"draftId prefix mismatch: expected_prefix={expected_draft_prefix}, actual={draft_id}")

cards = data.get("rolloutSummaryCards") or []
ready_card = next((card for card in cards if str(card.get("title", "")).strip() == "Ready"), None)
if ready_card is None:
    raise SystemExit("Ready summary card is missing")
if int(str(ready_card.get("value") or "0")) < 1:
    raise SystemExit("Ready summary card should be at least 1 after calculate")

if expected_ready_scopes:
    row_map = {
        f"{str(item.get('categoryCode') or '').strip().upper()}:{int(item.get('tier'))}": item
        for item in rows
        if item.get("tier") is not None
    }
    missing = []
    not_ready = []
    not_adopted = []
    for scope in expected_ready_scopes:
        scope_row = row_map.get(scope)
        if scope_row is None:
            missing.append(scope)
            continue
        if str(scope_row.get("promotionStatus") or "").strip().upper() != "READY":
            not_ready.append(f"{scope}={scope_row.get('promotionStatus')}")
        if not bool(scope_row.get("definitionFormulaAdopted")):
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
PY
fi

emission_info "session OK"
emission_info "page-data OK: /admin/emission/management/page-data"
emission_info "category OK: $EXPECTED_CATEGORY_SUBCODE"
emission_info "tier OK: $TIER"
emission_info "save OK: sessionId=$SESSION_ID"
emission_info "calculate OK: co2Total=$EXPECTED_CO2_TOTAL"
if [[ "$VERIFY_ROLLOUT_STATUS" == "true" ]]; then
  emission_info "rollout OK: $EXPECTED_CATEGORY_SUBCODE:$TIER -> $EXPECTED_PROMOTION_STATUS"
  if [[ -n "$EXPECTED_READY_SCOPES" ]]; then
    emission_info "rollout READY scopes OK: $EXPECTED_READY_SCOPES"
  fi
fi
emission_info "verification completed"
