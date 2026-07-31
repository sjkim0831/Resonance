#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
FRONTEND="$ROOT_DIR/projects/carbonet-frontend/source"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/contracts.jsonl" <<'JSONL'
{"contractId":1,"processCode":"P1","stepCode":"S1","audience":"USER","routePath":"/home","screenName":"Home","actorCode":"USER","contractStatus":"ACTIVE","updatedAt":"2026-01-01"}
{"contractId":2,"processCode":"P2","stepCode":"S2","audience":"ADMIN","routePath":"/admin/system/menu","screenName":"Menu","actorCode":"ADMIN","contractStatus":"ACTIVE","updatedAt":"2026-01-01"}
JSONL

node "$FRONTEND/scripts/generate-full-screen-smoke-manifest.mjs" \
  --input "$TMP/contracts.jsonl" \
  --output "$TMP/manifest.json" \
  --baseline "$TMP/missing-baseline.json" \
  --shards 8 \
  --changedOnly false \
  --routePattern '^/home$' >/dev/null

node - "$TMP/manifest.json" <<'NODE'
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (manifest.counts.selectedRouteCount !== 1) throw new Error("expected one selected route");
if (manifest.shards.length !== 1) throw new Error(`expected one effective shard, got ${manifest.shards.length}`);
if (manifest.options.shardCount !== 8 || manifest.options.effectiveShardCount !== 1) {
  throw new Error("requested/effective shard contract is invalid");
}
NODE

pattern="$(node "$FRONTEND/scripts/derive-frontend-smoke-route-pattern.mjs" \
  --changed-file projects/carbonet-frontend/source/src/main.tsx)"
for route in \
  /signin/loginView \
  /emission/project_list \
  /home/certificate-verify \
  /admin/system/actor-process \
  /admin/emission/survey-report-print; do
  [[ "$pattern" == *"$route"* ]] || {
    echo "common-impact canary is missing: $route" >&2
    exit 1
  }
done
[[ "$(grep -o '/[^|)]*' <<<"$pattern" | wc -l | tr -d ' ')" -eq 5 ]] || {
  echo "common-impact canary set must stay bounded to five routes: $pattern" >&2
  exit 1
}

grep -q 'FULL_SCREEN_SMOKE_SKIP_QUALITY_REFRESH.*true' \
  "$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"

echo "[fast-browser-deploy-gate-test] PASS"
