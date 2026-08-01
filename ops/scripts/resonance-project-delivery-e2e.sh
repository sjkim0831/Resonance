#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"

for command in curl node; do
  command -v "$command" >/dev/null || { echo "[project-delivery-e2e] missing command: $command" >&2; exit 1; }
done
[[ -s "$CA_CERT" ]] || { echo "[project-delivery-e2e] internal CA is missing" >&2; exit 2; }

token="$($ROOT/ops/scripts/resonance-backstage-oidc-token.sh resonance-approver)"
response="$(mktemp)"
trap 'rm -f "$response"' EXIT
status="$(curl --cacert "$CA_CERT" -sS -o "$response" -w '%{http_code}' \
  -H "authorization: Bearer $token" -H 'content-type: application/json' \
  -X POST "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands" \
  --data '{"command":"project-delivery.e2e"}')"
[[ "$status" == 200 ]] || { echo "[project-delivery-e2e] command failed: HTTP $status" >&2; exit 3; }

RESPONSE="$response" node <<'NODE'
const fs=require('fs');
const result=JSON.parse(fs.readFileSync(process.env.RESPONSE,'utf8'));
const evidence=result.evidence??{};
const fail=message=>{throw new Error(message)};
if(result.success!==true||result.rollbackScheduled!==true)fail('transaction or rollback evidence missing');
if(Number(evidence.release_count??evidence.releaseCount)!==1)fail('release count is not one');
if(Number(evidence.actor_count??evidence.actorCount)!==1)fail('actor assignment count is not one');
if(Number(evidence.task_count??evidence.taskCount)<1)fail('project task was not generated');
if(Number(evidence.process_count??evidence.processCount)<1)fail('applicable process was not generated');
console.log(`[project-delivery-e2e] PASS process=${result.processCode} actor=${result.actorCode} release=1 tasks=${evidence.task_count??evidence.taskCount} rollback=scheduled`);
NODE
