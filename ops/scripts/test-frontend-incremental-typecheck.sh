#!/usr/bin/env bash
set -euo pipefail

pipeline="projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"
package="projects/carbonet-frontend/source/package.json"
nightly="ops/scripts/run-nightly-frontend-contracts.sh"
unit="ops/systemd/resonance-full-screen-nightly.service"

node --check "$pipeline"
bash -n "$nightly"
grep -q 'CARBONET_FORCE_FULL_TYPECHECK' "$pipeline"
grep -q -- '--incremental' "$pipeline"
grep -q 'tsconfig.app.tsbuildinfo' "$pipeline"
grep -q 'typecheck mode=' "$pipeline"
node -e '
  const pkg = require("./projects/carbonet-frontend/source/package.json");
  if (!pkg.scripts["typecheck:full"] || !pkg.scripts["typecheck:incremental"]) process.exit(1);
'
grep -q 'npm run typecheck:full' "$nightly"
grep -q 'run-nightly-frontend-contracts.sh' "$unit"

echo "[frontend-typecheck-test] PASS incremental=default full=nightly fail-closed=true"
