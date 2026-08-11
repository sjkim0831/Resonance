#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
bash -n "$TARGET"

for contract in \
  'full_stack_ready_before=' \
  "generation_status='READY'" \
  'generate-full-stack-design-packages.sh' \
  'var/runtime/full-stack-generation/generated' \
  'var/runtime/full-stack-generation/design-preview' \
  'full_stack_ready_after' \
  'full_stack_rc != 0 || full_stack_ready_after != 0' \
  'fullStackGeneration='; do
  grep -Fq "$contract" "$TARGET" || {
    echo "[auto-completion-full-stack] FAIL missing=$contract" >&2
    exit 1
  }
done

generator_line="$(grep -n 'generate-full-stack-design-packages.sh' "$TARGET" | head -1 | cut -d: -f1)"
screen_line="$(grep -n "screen_generation_result='" "$TARGET" | head -1 | cut -d: -f1)"
(( generator_line < screen_line )) || {
  echo '[auto-completion-full-stack] FAIL full-stack generation must precede screen runtime generation' >&2
  exit 1
}

echo '[auto-completion-full-stack] PASS approved-ready=consumed runtime-output=isolated order=full-stack-before-screen fail-closed=1'
