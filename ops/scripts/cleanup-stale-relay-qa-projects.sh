#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
COOKIE="$(mktemp)"; WORK="$(mktemp -d)"
trap 'rm -f "$COOKIE"; rm -rf "$WORK"' EXIT

if [[ -z "${CARBONET_ACTOR_TEST_PASSWORD:-}" ]]; then
  CARBONET_ACTOR_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-test-account-switch -o jsonpath='{.data.password}' | base64 -d)"
fi
[[ -n "$CARBONET_ACTOR_TEST_PASSWORD" ]] || { echo '[relay-qa-cleanup] FAIL credential unavailable' >&2; exit 1; }

login_code="$(curl -sS -c "$COOKIE" -o "$WORK/login.json" -w '%{http_code}' -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/signin/actionLogin" \
  --data "$(jq -nc --arg pw "$CARBONET_ACTOR_TEST_PASSWORD" '{userId:"qaowner26",userPw:$pw,userSe:"USR"}')")"
[[ "$login_code" == 200 ]] || { echo "[relay-qa-cleanup] FAIL login http=$login_code" >&2; exit 1; }

curl -fsS -b "$COOKIE" "$BASE_URL/home/api/emission-projects?size=500" > "$WORK/projects.json"
jq -r '.items[] | select(.id != "PRJ-ACTOR-TEST") |
  select((.name // "") | test("^(QA twenty-step relay|Twenty-step relay|Manual twenty-step relay) ")) | .id' \
  "$WORK/projects.json" > "$WORK/targets.txt"

deleted=0
while IFS= read -r project_id; do
  [[ -n "$project_id" ]] || continue
  code="$(curl -sS -b "$COOKIE" -o "$WORK/delete.json" -w '%{http_code}' -X DELETE \
    "$BASE_URL/home/api/emission-projects/$project_id")"
  [[ "$code" == 200 ]] || { echo "[relay-qa-cleanup] FAIL delete project=$project_id http=$code" >&2; exit 1; }
  jq -e '.success == true' "$WORK/delete.json" >/dev/null || { echo "[relay-qa-cleanup] FAIL response project=$project_id" >&2; exit 1; }
  deleted=$((deleted+1))
done < "$WORK/targets.txt"

curl -fsS -b "$COOKIE" "$BASE_URL/home/api/emission-projects?size=500" > "$WORK/reread.json"
remaining="$(jq '[.items[] | select(.id != "PRJ-ACTOR-TEST") |
  select((.name // "") | test("^(QA twenty-step relay|Twenty-step relay|Manual twenty-step relay) "))] | length' "$WORK/reread.json")"
[[ "$remaining" == 0 ]] || { echo "[relay-qa-cleanup] FAIL remaining=$remaining" >&2; exit 1; }
echo "[relay-qa-cleanup] PASS deleted=$deleted remaining=0 protected=PRJ-ACTOR-TEST"
