#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$ROOT/ops/tests/test-generated-screen-definition-closure.mjs" "$ROOT"
