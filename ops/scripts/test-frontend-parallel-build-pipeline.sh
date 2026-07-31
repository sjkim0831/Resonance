#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
pipeline="$ROOT_DIR/projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"

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
