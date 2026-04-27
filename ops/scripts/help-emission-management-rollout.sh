#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/help-emission-management-rollout.sh

Environment overrides:
  EMISSION_HELP_OUTPUT
    - text (default)
    - json
      returns the command catalog grouped by usage area with labels that
      distinguish inspect, summary, replay, and assert commands
    - flat-json
      returns a versioned flat command catalog
    - commands
      returns an unstructured flat command list only

Examples:
  EMISSION_HELP_OUTPUT=json bash ops/scripts/help-emission-management-rollout.sh
  EMISSION_HELP_OUTPUT=flat-json bash ops/scripts/help-emission-management-rollout.sh
  EMISSION_HELP_OUTPUT=commands bash ops/scripts/help-emission-management-rollout.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_HELP_OUTPUT="${EMISSION_HELP_OUTPUT:-text}"
python3 - <<'PY' "$ROOT_DIR" "$EMISSION_HELP_OUTPUT"
import json
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import emit_json, schema_payload

output_mode = sys.argv[2]

catalog_sections = [
    {
        "key": "readOnly",
        "title": "Read-only",
        "entries": [
        {"label": "inspect supported scopes", "command": "bash ops/scripts/list-emission-management-rollout-scopes.sh"},
        {"label": "summarize read-only rollout status", "command": "bash ops/scripts/show-emission-management-rollout-status.sh"},
        {"label": "inspect current rollout board", "command": "bash ops/scripts/show-emission-management-rollout-board.sh"},
        {"label": "verify read-only rollout bundle", "command": "bash ops/scripts/verify-emission-management-rollout-readonly.sh"},
        {"label": "assert current rollout board is READY for the default scope set", "command": "bash ops/scripts/verify-emission-management-rollout-board-ready.sh"},
        ],
    },
    {
        "key": "fixtureAndMetadata",
        "title": "Fixture and metadata",
        "entries": [
        {"label": "verify scope metadata and fixture consistency", "command": "bash ops/scripts/verify-emission-management-rollout-fixtures.sh"},
        ],
    },
    {
        "key": "replayAndVerification",
        "title": "Replay and verification",
        "entries": [
        {"label": "verify one canonical scope", "command": "bash ops/scripts/verify-emission-management-rollout-scope.sh CEMENT:1"},
        {"label": "replay all supported scopes without rebuild", "command": "bash ops/scripts/fill-emission-management-rollout-snapshots.sh"},
        ],
    },
    {
        "key": "fullLocalRuntimeFlow",
        "title": "Full local runtime flow",
        "entries": [
        {"label": "build, restart, freshness verify, refill, verify, and optionally print final board", "command": "bash ops/scripts/build-restart-fill-verify-emission-management-rollout-18000.sh"},
        ],
    },
    {
        "key": "shortcuts",
        "title": "Useful shortcuts",
        "entries": [
        {"label": "emit the default scope set", "command": "bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes"},
        {"label": "print split per-scope replay commands", "command": "EMISSION_PRINT_COMMANDS=true bash ops/scripts/fill-emission-management-rollout-snapshots.sh"},
        {"label": "emit read-only rollout status as JSON without hitting the board", "command": "EMISSION_STATUS_OUTPUT=json EMISSION_STATUS_INCLUDE_BOARD=false bash ops/scripts/show-emission-management-rollout-status.sh"},
        {"label": "emit the read-only verification result as JSON", "command": "EMISSION_READONLY_VERIFY_OUTPUT=json bash ops/scripts/verify-emission-management-rollout-readonly.sh"},
        ],
    },
]

catalog = {section["key"]: section["entries"] for section in catalog_sections}

commands = [
    entry["command"]
    for section in catalog_sections
    for entry in section["entries"]
]

if output_mode == "commands":
    print("\n".join(commands))
    raise SystemExit(0)

if output_mode == "flat-json":
    emit_json(catalogMode="flat", commandCount=len(commands), commands=commands)
    raise SystemExit(0)

if output_mode == "json":
    data = schema_payload(catalogMode="grouped", commandCount=len(commands), **catalog)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    raise SystemExit(0)

if output_mode != "text":
    raise SystemExit(f"Unsupported EMISSION_HELP_OUTPUT: {output_mode}")

print("Emission Management Rollout Commands\n")
for section in catalog_sections:
    print(f"{section['title']}:")
    for row in section["entries"]:
        print(f"- {row['label']}")
        print(f"  {row['command']}")
    print()
PY
exit 0
