#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
VALIDATOR="$ROOT/ops/scripts/validate-professional-development-contract.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat >"$TMP/spec.json" <<'JSON'
{"requirement":"승인된 액터가 프로젝트 범위에서 전문 업무를 완료한다."}
JSON
cat >"$TMP/governed.json" <<'JSON'
{"processCode":"TEST_PROCESS","stepCode":"TEST_STEP","actorCode":"TEST_ACTOR","requirement":"승인된 액터가 프로젝트 범위에서 전문 업무를 완료한다.","screenContractCount":1,"routeCount":2,"apiVerified":true,"databaseVerified":true,"authorityVerified":true,"responsiveVerified":false,"accessibilityVerified":false,"exceptionStatesVerified":true}
JSON

bash "$VALIDATOR" "$ROOT" FRONTEND_USER "$TMP/spec.json" "$TMP/governed.json" >/dev/null
bash "$VALIDATOR" "$ROOT" UI_QUALITY "$TMP/spec.json" "$TMP/governed.json" >/dev/null

jq '.apiVerified=false' "$TMP/governed.json" >"$TMP/incomplete.json"
if bash "$VALIDATOR" "$ROOT" UI_QUALITY "$TMP/spec.json" "$TMP/incomplete.json" >/dev/null 2>&1; then
  echo "FAIL: UI quality accepted an incomplete server contract" >&2
  exit 1
fi

jq 'del(.requirement)' "$TMP/spec.json" >"$TMP/missing-requirement.json"
if bash "$VALIDATOR" "$ROOT" DATABASE "$TMP/missing-requirement.json" "$TMP/governed.json" >/dev/null 2>&1; then
  echo "FAIL: missing approved requirement was accepted" >&2
  exit 1
fi

echo "PASS professional development policy is deterministic and fail-closed"
