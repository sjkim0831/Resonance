#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"

for command in curl node; do
  command -v "$command" >/dev/null || { echo "[project-delivery-e2e] missing command: $command" >&2; exit 1; }
done
[[ -s "$CA_CERT" ]] || { echo "[project-delivery-e2e] internal CA is missing" >&2; exit 2; }

run_dir="$(mktemp -d)"
response="$run_dir/response.json"
token_file="$run_dir/token"
auth_header="$run_dir/authorization.header"
payload_file="$run_dir/payload.json"
trap 'rm -rf -- "$run_dir"' EXIT
"$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" resonance-approver >"$token_file"
[[ -s "$token_file" ]] || { echo '[project-delivery-e2e] empty OIDC token' >&2; exit 2; }
{ printf 'authorization: Bearer '; cat "$token_file"; printf '\n'; } >"$auth_header"
printf '%s' '{"command":"project-delivery.e2e"}' >"$payload_file"
chmod 0600 "$auth_header" "$payload_file"
rm -f -- "$token_file"
status="$(curl --cacert "$CA_CERT" -sS -o "$response" -w '%{http_code}' \
  --header @"$auth_header" -H 'content-type: application/json' \
  -X POST "$BACKSTAGE_URL/api/resonance-projects/actor-process/commands" \
  --data-binary @"$payload_file")"
if [[ "$status" != 200 ]]; then
  diagnostic_message="$(RESPONSE_FILE="$response" node <<'NODE'
const fs = require('fs');

let value;
try {
  value = JSON.parse(fs.readFileSync(process.env.RESPONSE_FILE, 'utf8'));
} catch {
  process.stdout.write('unparseable-response');
  process.exit(0);
}

const raw = typeof value?.message === 'string' ? value.message : 'unspecified';
const safe = raw
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
  .replace(/((?:authorization|cookie|password|passwd|token|secret)[A-Za-z0-9_.-]*\s*[:=]\s*)[^\s;,]+/gi, '$1[REDACTED]')
  .replace(/\b[A-Za-z0-9_-]{60,}\b/g, '[REDACTED]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 240);
process.stdout.write(safe || 'unspecified');
NODE
)"
  echo "[project-delivery-e2e] command failed: HTTP $status message=$diagnostic_message" >&2
  exit 3
fi

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
