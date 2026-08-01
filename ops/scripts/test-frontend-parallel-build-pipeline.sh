#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
pipeline="$ROOT_DIR/projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"
deploy_pipeline="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"

grep -Fq 'run(process.execPath, ["scripts/dedupe-generated-route-family.mjs"])' "$pipeline"
grep -Fq 'const validationTasks = [' "$pipeline"
grep -Fq '...validationTasks,' "$pipeline"
grep -Fq 'node_modules/typescript/bin/tsc' "$pipeline"
grep -Fq 'four independent generators and customer-journey audit run concurrently' "$pipeline"
grep -Fq 'generateAsync("page-completeness-inventory"' "$pipeline"
grep -Fq 'runAsync(process.execPath, ["scripts/check-customer-journey-governance.mjs"])' "$pipeline"
grep -Fq 'runAsync(bundlerCommand, bundlerArgs)' "$pipeline"

dedupe_line="$(grep -n 'run(process.execPath, \["scripts/dedupe-generated-route-family.mjs"\])' "$pipeline" | head -1 | cut -d: -f1)"
validation_line="$(grep -n 'const validationTasks = \[' "$pipeline" | head -1 | cut -d: -f1)"
[[ "$dedupe_line" -lt "$validation_line" ]] || {
  echo "source-mutating dedupe must precede parallel read-only validation" >&2
  exit 1
}

echo "[frontend-parallel-build-pipeline-test] PASS"

python3 - "$deploy_pipeline" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index('if [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]]')
end = source.index('verify_immutable_frontend_jar', start)
block = source[start:end]
frontend = block.index('build_frontend & immutable_frontend_pid=$!')
backend = block.index('build_maven & immutable_backend_pid=$!')
wait_frontend = block.index('wait "$immutable_frontend_pid"')
wait_backend = block.index('wait "$immutable_backend_pid"')
assemble = block.index('prepare_immutable_frontend', wait_backend)
final_jar = block.index('build_maven', assemble)
assert frontend < wait_frontend
assert backend < wait_backend
assert wait_frontend < assemble and wait_backend < assemble < final_jar
assert 'SKIP_FRONTEND" != "true" && "$SKIP_BACKEND" != "true"' in block
assert 'IMMUTABLE_PARALLEL_BUILD_FAILED' in block
print("IMMUTABLE_FRONTEND_BACKEND_PARALLEL_PASS final-jar-after-barrier=true")
PY
