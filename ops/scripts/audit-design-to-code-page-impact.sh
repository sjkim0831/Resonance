#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PYTHON="${PYTHON:-python3}"

# No implicit production connection is allowed. Callers must provide a DSN or
# a JSON argv vector for a stdin-reading psql-compatible command. The Python
# runner enforces a READ ONLY transaction and a bounded statement timeout.
exec "$PYTHON" "$ROOT/ops/scripts/audit-design-to-code-page-impact.py" \
  --repo-root "$ROOT" "$@"
