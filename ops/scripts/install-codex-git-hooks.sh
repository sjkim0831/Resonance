#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

chmod +x .githooks/pre-commit ops/scripts/codex-commit-guard.sh
git config core.hooksPath .githooks
printf '[install-codex-git-hooks] core.hooksPath=%s\n' "$(git config core.hooksPath)"
