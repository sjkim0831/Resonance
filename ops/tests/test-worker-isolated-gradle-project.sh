#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER="$ROOT/ops/scripts/run-process-development-worker.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
wt="$tmp/worktree"; process=REDUCTION_TEST
mkdir -p "$wt/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$process/src/main/java" "$tmp/outside"
cat >"$wt/gradlew" <<'SH'
#!/usr/bin/env bash
printf 'PWD=%s\nARGS=%s\nSOURCES=%s\n' "$PWD" "$*" "$CANONICAL_ENDPOINT_SOURCE_DIRS" >"$TRACE"
SH
chmod +x "$wt/gradlew"
function_source="$(sed -n '/^compile_canonical_generated_endpoint() {$/,/^}$/p' "$WORKER")"
(cd "$tmp/outside"; export TRACE="$tmp/trace"; eval "$function_source"; compile_canonical_generated_endpoint "$wt" "$process")
grep -Fq "ARGS=--project-dir $wt :modules:resonance-common:carbonet-common-core:compileJava" "$tmp/trace"
grep -Fq "SOURCES=$wt/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$process/src/main/java" "$tmp/trace"
grep -Fq "PWD=$wt" "$tmp/trace"
mutant="${function_source/cd \"\$worktree\"/cd .}"
rm -f "$tmp/trace"
if (cd "$tmp/outside"; export TRACE="$tmp/trace"; eval "$mutant"; compile_canonical_generated_endpoint "$wt" "$process") 2>/dev/null; then
  if grep -Fq "PWD=$wt" "$tmp/trace"; then echo 'worktree-cwd mutant survived' >&2; exit 1; fi
fi
echo WORKER_ISOLATED_GRADLE_PROJECT_PASS
