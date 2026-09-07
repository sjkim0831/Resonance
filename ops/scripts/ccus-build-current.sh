#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/opt/Resonance
SOURCE="$ROOT/projects/carbonet-frontend/source"
cd "$SOURCE"
mkdir -p "$ROOT/runtime/build-candidates"
exec 9>"$ROOT/runtime/build-candidates/build.lock"
flock -n 9 || { echo 'Another canonical build is running'; exit 1; }
OUT=$(mktemp -d "$ROOT/runtime/build-candidates/release.XXXXXXXX")
START=$SECONDS
node "$ROOT/ops/scripts/ccus-canonical-source-gate.cjs" >"$OUT/source-before.json"
node node_modules/typescript/bin/tsc --noEmit --incremental --tsBuildInfoFile "$ROOT/runtime/build-candidates/typecheck.tsbuildinfo" -p tsconfig.app.json
VITE_OUT_DIR="$OUT/frontend" node node_modules/vite/bin/vite.js build
node "$ROOT/ops/scripts/ccus-canonical-source-gate.cjs" >"$OUT/source-after.json"
node - "$OUT" <<'JS'
const fs=require('fs');const out=process.argv[2];
const a=JSON.parse(fs.readFileSync(out+'/source-before.json'));
const b=JSON.parse(fs.readFileSync(out+'/source-after.json'));
if(a.sourceHash!==b.sourceHash)throw Error('SOURCE_CHANGED_DURING_BUILD: publication blocked');
JS
CCUS_FRONTEND_ROOT="$OUT/frontend" CCUS_WEB_PORT=32101 node "$ROOT/ops/runtime/ccus-candidate-web.mjs" >"$OUT/server.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$PID" || { echo 'Candidate port unavailable'; exit 1; }
BASE_URL=http://127.0.0.1:32101 OUTPUT_DIR="$OUT" node "$ROOT/ops/scripts/ccus-verify-header.cjs"
node "$ROOT/ops/scripts/ccus-canonical-source-gate.cjs" >"$OUT/source-verified.json"
node - "$OUT" <<'JS'
const fs=require('fs');const out=process.argv[2];
const a=JSON.parse(fs.readFileSync(out+'/source-before.json'));
const b=JSON.parse(fs.readFileSync(out+'/source-verified.json'));
if(a.sourceHash!==b.sourceHash)throw Error('SOURCE_CHANGED_DURING_BROWSER_TEST: publication blocked');
fs.writeFileSync(out+'/receipt.json',JSON.stringify({status:'PASS',sourceHash:a.sourceHash,verifiedAt:new Date().toISOString(),frontend:out+'/frontend',scope:'typecheck, build, public header/font/mobile browser smoke; not full authenticated E2E'},null,2));
JS
ln -s "$OUT/frontend" "$ROOT/runtime/frontend-current.next"
mv -Tf "$ROOT/runtime/frontend-current.next" "$ROOT/runtime/frontend-current"
printf 'LATEST_VERIFIED_BUILD=%s\nELAPSED_SECONDS=%s\n' "$OUT/frontend" "$((SECONDS-START))"
