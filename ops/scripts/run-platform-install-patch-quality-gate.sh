#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-model-gates}"
mkdir -p "$OUT_DIR"

MODEL_ID="${1:-${MODEL_ID:-gemma-4-e2b-it}}"
SERVED_MODEL_NAME="${2:-${SERVED_MODEL_NAME:-gemma-4-e2b-it}}"
ENDPOINT="${ENDPOINT:-http://127.0.0.1:8000/v1}"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_NAME="$(printf '%s' "$SERVED_MODEL_NAME" | tr '/:' '__')"
REPORT="$OUT_DIR/platform-install-patch-quality-$SAFE_NAME-$STAMP.md"

candidate_files=(
  "modules/resonance-ops/ollama-control-plane/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java"
  "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java"
  "data/ai-runtime/ollama-control-plane.json"
  "projects/carbonet-frontend/source/src/features/platform-install/PlatformInstallMigrationPage.tsx"
  "projects/carbonet-frontend/source/src/lib/api/platform.ts"
  "docs/resonance-wave-39-model-gate-results.md"
)

write() {
  printf '%s\n' "$*" | tee -a "$REPORT"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

prompt="$(cat <<'EOF'
You are evaluating a patch-quality gate for the Resonance /admin/system/platform-install page.
Use ONLY the candidate files listed below. Do not invent any other paths.
Return strict JSON only. No markdown fences. No extra commentary.
If the candidate pack is insufficient, reply with JSON containing {"verdict":"NEEDS_ROUTE_MAP","missing_signal":...}.
Otherwise return JSON with these keys only:
- verdict
- zone
- selected_files
- reason_per_file
- verification_command
- rollback_note

Rules:
- selected_files must contain 3 to 5 files from the candidate pack only.
- You MUST include data/ai-runtime/ollama-control-plane.json.
- You MUST include docs/resonance-wave-39-model-gate-results.md.
- Include one bounded UI/component edit.
- Do not propose execution of backup, restart, k8s, deploy, or db_migration.
- verification_command must be a concrete shell command.

Candidate files:
1. modules/resonance-ops/ollama-control-plane/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java
2. modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java
3. data/ai-runtime/ollama-control-plane.json
4. projects/carbonet-frontend/source/src/features/platform-install/PlatformInstallMigrationPage.tsx
5. projects/carbonet-frontend/source/src/lib/api/platform.ts
6. docs/resonance-wave-39-model-gate-results.md
EOF
)"

payload="$(python3 - "$MODEL_ID" "$prompt" <<'PY'
import json
import sys

model = sys.argv[1]
prompt = sys.argv[2]
print(json.dumps({
    "model": model,
    "messages": [
        {"role": "system", "content": "You are a bounded Resonance framework agent. Strict JSON only."},
        {"role": "user", "content": prompt},
    ],
    "temperature": 0,
    "max_tokens": 700,
}, ensure_ascii=False))
PY
)"

write "# Platform Install Patch-Quality Gate"
write ""
write "- time: $(date -Is)"
write "- modelId: $MODEL_ID"
write "- servedModelName: $SERVED_MODEL_NAME"
write "- endpoint: $ENDPOINT"
write ""
write "## Candidate Files"
for file in "${candidate_files[@]}"; do
  write "- $file"
done

response_file="$(mktemp)"
error_file="$(mktemp)"
trap 'rm -f "$response_file" "$error_file"' EXIT

if curl -fsS "$ENDPOINT/chat/completions" \
  -H 'Content-Type: application/json' \
  -d "$payload" >"$response_file" 2>"$error_file"; then
  write ""
  write "## Model Response"
  write '```json'
  cat "$response_file" | tee -a "$REPORT"
  write '```'
else
  write ""
  write "FAIL model request"
  write '```text'
  cat "$error_file" | tee -a "$REPORT" || true
  write '```'
  exit 1
fi

python3 - "$response_file" "$REPORT" "${candidate_files[@]}" <<'PY'
import json
import re
import sys
from pathlib import Path

response_path = Path(sys.argv[1])
report_path = Path(sys.argv[2])
candidate_files = sys.argv[3:]

raw = response_path.read_text(encoding="utf-8", errors="ignore")
try:
    data = json.loads(raw)
    content = data["choices"][0]["message"]["content"]
except Exception as exc:
    print(f"FAIL parse response: {exc}")
    sys.exit(1)

content = content.strip()
if content.startswith("```"):
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)

try:
    result = json.loads(content)
except Exception as exc:
    print(f"FAIL parse model JSON: {exc}")
    sys.exit(1)

verdict = str(result.get("verdict", "")).strip()
if verdict not in {"PASS", "NEEDS_ROUTE_MAP"}:
    print(f"FAIL verdict: {verdict!r}")
    sys.exit(1)

selected = result.get("selected_files", [])
if not isinstance(selected, list):
    print("FAIL selected_files: not a list")
    sys.exit(1)

if verdict == "PASS":
    selected_set = set(map(str, selected))
    candidate_set = set(candidate_files)
    unknown = sorted(selected_set - candidate_set)
    if unknown:
        print("FAIL selected_files contains unknown paths: " + ", ".join(unknown))
        sys.exit(1)

    required = {
        "data/ai-runtime/ollama-control-plane.json",
        "docs/resonance-wave-39-model-gate-results.md",
    }
    missing = sorted(required - selected_set)
    if missing:
        print("FAIL missing required files: " + ", ".join(missing))
        sys.exit(1)

    if not any(path.endswith("PlatformInstallMigrationPage.tsx") for path in selected_set):
        print("FAIL missing bounded UI/component edit")
        sys.exit(1)

    verification = str(result.get("verification_command", "")).strip()
    if not verification:
        print("FAIL verification_command is empty")
        sys.exit(1)

    if not re.search(r"\b(curl|mvn|bash|npm|pnpm|yarn)\b", verification):
        print("FAIL verification_command is not a concrete shell command")
        sys.exit(1)

print("PASS patch-quality gate validator")
PY

write ""
write "PASS patch-quality gate"
write ""
write "Report: $REPORT"
