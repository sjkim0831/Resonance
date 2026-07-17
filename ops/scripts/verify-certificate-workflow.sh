#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CARBONET_BASE_URL:-http://127.0.0.1}"
CERTIFICATE_ID="${1:-}"
if [[ -z "$CERTIFICATE_ID" ]]; then
  echo "usage: $0 <active-certificate-id>" >&2
  exit 2
fi

assert_code() {
  local expected="$1" url="$2" actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [[ "$actual" == "$expected" ]] || { echo "FAIL $url expected=$expected actual=$actual" >&2; exit 1; }
}

assert_code 200 "$BASE_URL/home/certificate-verify"
valid_json="$(curl -fsS "$BASE_URL/api/public/report-certificates/$CERTIFICATE_ID")"
invalid_json="$(curl -fsS "$BASE_URL/api/public/report-certificates/CER-INVALID-000")"
grep -q '"valid":true' <<<"$valid_json" || { echo "FAIL active certificate was not valid" >&2; exit 1; }
grep -q '"certificateStatus":"ACTIVE"' <<<"$valid_json" || { echo "FAIL active state missing" >&2; exit 1; }
grep -q '"valid":false' <<<"$invalid_json" || { echo "FAIL unknown certificate was not rejected" >&2; exit 1; }
echo "PASS certificate workflow: public-page, active-certificate, unknown-certificate"
