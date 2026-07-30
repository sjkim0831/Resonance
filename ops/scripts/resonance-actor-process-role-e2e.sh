#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"
TEST_PROJECT_ID="${RESONANCE_ROLE_E2E_PROJECT_ID:-PRJ-2026-AD5D0F}"
WORK_ROOT="${ROLE_E2E_WORK_ROOT:-$HOME/.cache/resonance/actor-process-role-e2e}"

for command in curl node; do
  command -v "$command" >/dev/null || {
    echo "[actor-process-role-e2e] missing command: $command" >&2
    exit 1
  }
done
[[ -s "$CA_CERT" ]] || {
  echo "[actor-process-role-e2e] internal CA is missing" >&2
  exit 2
}

mkdir -p "$WORK_ROOT"
chmod 700 "$WORK_ROOT"
run_dir="$(mktemp -d "$WORK_ROOT/run.XXXXXXXX")"
cleanup() {
  rm -rf "$run_dir"
}
trap cleanup EXIT

token_for() {
  "$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" "$1"
}

fetch_dataset() {
  local token="$1" dataset="$2" output="$3"
  curl --cacert "$CA_CERT" -fsS \
    -H "authorization: Bearer $token" \
    "$BACKSTAGE_URL/api/resonance-projects/actor-process/runtime-dashboard?dataset=$dataset" \
    -o "$output"
}

requester_token="$(token_for resonance-requester)"
reviewer_token="$(token_for resonance-reviewer)"
approver_token="$(token_for resonance-approver)"

for dataset in actors processes steps processExecutions; do
  fetch_dataset "$requester_token" "$dataset" "$run_dir/requester-$dataset.json"
  fetch_dataset "$reviewer_token" "$dataset" "$run_dir/reviewer-$dataset.json"
  fetch_dataset "$approver_token" "$dataset" "$run_dir/approver-$dataset.json"
done

RUN_DIR="$run_dir" TEST_PROJECT_ID="$TEST_PROJECT_ID" node <<'NODE'
const fs = require('fs');
const path = require('path');
const runDir = process.env.RUN_DIR;
const projectId = process.env.TEST_PROJECT_ID;
const read = (role, dataset) =>
  JSON.parse(fs.readFileSync(path.join(runDir, `${role}-${dataset}.json`), 'utf8'))[dataset] ?? [];
const fail = message => { throw new Error(message); };
const codes = (rows, key) => new Set(rows.map(row => String(row[key] ?? '')));

const requesterActors = codes(read('requester', 'actors'), 'actorCode');
for (const actor of ['PLATFORM_OPERATOR', 'SYSTEM_INTEGRATOR']) {
  if (!requesterActors.has(actor)) fail(`requester actor missing: ${actor}`);
}
const reviewerActors = codes(read('reviewer', 'actors'), 'actorCode');
for (const actor of ['COMPANY_MANAGER', 'SITE_DATA_OWNER', 'CALCULATOR', 'LCA_PRACTITIONER']) {
  if (!reviewerActors.has(actor)) fail(`reviewer actor missing: ${actor}`);
}
if (!codes(read('reviewer', 'processes'), 'processCode').has('EMISSION_PROJECT')) {
  fail('reviewer EMISSION_PROJECT missing');
}
const reviewerExecutions = read('reviewer', 'processExecutions');
if (!reviewerExecutions.length) fail('reviewer has no executable project workflow');
if (reviewerExecutions.some(row => String(row.projectId) !== projectId)) {
  fail('reviewer project isolation failed');
}
const execution = reviewerExecutions.find(row =>
  row.processCode === 'EMISSION_PROJECT' &&
  row.executionStatus === 'RUNNING' &&
  reviewerActors.has(String(row.currentActorCode)));
if (!execution) fail('reviewer-owned running EMISSION_PROJECT execution missing');
if (codes(read('requester', 'processExecutions'), 'executionId').has(String(execution.executionId))) {
  fail('requester can read the reviewer-owned project execution');
}
const step = read('reviewer', 'steps').find(row =>
  row.processCode === execution.processCode &&
  row.stepCode === execution.currentStepCode);
if (!step) fail('current workflow step is not exposed to its assigned actor');
if (!String(step.userPath ?? step.adminPath ?? '').startsWith('/')) {
  fail('current workflow step has no navigable route');
}
fs.writeFileSync(path.join(runDir, 'execution-id'), String(execution.executionId));

const approverActors = codes(read('approver', 'actors'), 'actorCode');
for (const actor of ['VERIFIER', 'APPROVER']) {
  if (!approverActors.has(actor)) fail(`approver actor missing: ${actor}`);
}
console.log(`[actor-process-role-e2e] dataset PASS: 3 accounts, ${reviewerExecutions.length} isolated execution(s), 1 navigable current task`);
NODE

execution_id="$(cat "$run_dir/execution-id")"
payload="$(printf '{"command":"execution.validate","executionId":"%s","requireDraft":true}' "$execution_id")"

allowed_status="$(curl --cacert "$CA_CERT" -sS -o "$run_dir/reviewer-command.json" -w '%{http_code}' \
  -H "authorization: Bearer $reviewer_token" \
  -H 'content-type: application/json' \
  -d "$payload" \
  "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands")"
[[ "$allowed_status" == "200" ]] || {
  echo "[actor-process-role-e2e] reviewer validation failed: HTTP $allowed_status" >&2
  exit 3
}
RESPONSE_FILE="$run_dir/reviewer-command.json" node -e '
  const value = JSON.parse(require("fs").readFileSync(process.env.RESPONSE_FILE, "utf8"));
  if (value.success !== true || value.validated !== true || value.committed !== false) process.exit(1);
'

requester_status="$(curl --cacert "$CA_CERT" -sS -o "$run_dir/requester-command.json" -w '%{http_code}' \
  -H "authorization: Bearer $requester_token" \
  -H 'content-type: application/json' -d "$payload" \
  "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands")"
[[ "$requester_status" == "403" ]] || {
  echo "[actor-process-role-e2e] requester denial expected HTTP 403, received $requester_status" >&2
  exit 4
}

approver_status="$(curl --cacert "$CA_CERT" -sS -o "$run_dir/approver-command.json" -w '%{http_code}' \
  -H "authorization: Bearer $approver_token" \
  -H 'content-type: application/json' -d "$payload" \
  "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands")"
[[ "$approver_status" == "200" ]] || {
  echo "[actor-process-role-e2e] system-master override expected HTTP 200, received $approver_status" >&2
  exit 5
}

anonymous_status="$(curl --cacert "$CA_CERT" -sS -o "$run_dir/anonymous-command.json" -w '%{http_code}' \
  -H 'content-type: application/json' -d "$payload" \
  "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands")"
[[ "$anonymous_status" == "401" ]] || {
  echo "[actor-process-role-e2e] anonymous denial expected HTTP 401, received $anonymous_status" >&2
  exit 6
}

echo "[actor-process-role-e2e] command PASS: 2 allowed, 1 forbidden, 1 unauthenticated, 0 workflow mutations"
