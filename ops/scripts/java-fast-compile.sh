#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MAX_WORKERS="${JAVA_FAST_MAX_WORKERS:-2}"
MODE="${1:-working-tree}"
declare -a changed_files=()
declare -a tasks=()

case "$MODE" in
  --stdin)
    while IFS= read -r path; do [[ -n "$path" ]] && changed_files+=("$path"); done
    ;;
  --since)
    base="${2:?base ref is required}"
    target="${3:-HEAD}"
    mapfile -t changed_files < <(git -C "$ROOT_DIR" diff --name-only --diff-filter=ACMR "$base" "$target")
    ;;
  working-tree)
    mapfile -t changed_files < <(
      {
        git -C "$ROOT_DIR" diff --name-only --diff-filter=ACMR
        git -C "$ROOT_DIR" diff --cached --name-only --diff-filter=ACMR
        git -C "$ROOT_DIR" ls-files --others --exclude-standard
      } | sort -u
    )
    ;;
  *) changed_files=("$@") ;;
esac

add_task() {
  local candidate="$1" existing
  for existing in "${tasks[@]:-}"; do [[ "$existing" == "$candidate" ]] && return; done
  tasks+=("$candidate")
}

module_task_for() {
  local path="$1" task="$2" module=""
  case "$path" in
    apps/*/*)
      IFS=/ read -r _ app _ <<<"$path"
      module=":apps:${app}"
      ;;
    modules/*/*/*)
      IFS=/ read -r _ family name _ <<<"$path"
      module=":modules:${family}:${name}"
      ;;
    common/*/*)
      IFS=/ read -r _ name _ <<<"$path"
      module=":common:${name}"
      ;;
  esac
  [[ -n "$module" ]] && add_task "${module}:${task}"
}

for path in "${changed_files[@]:-}"; do
  case "$path" in
    apps/*/src/main/java/*.java|apps/*/src/main/java/**/*.java|modules/*/*/src/main/java/*.java|modules/*/*/src/main/java/**/*.java|common/*/src/main/java/*.java|common/*/src/main/java/**/*.java)
      module_task_for "$path" compileJava
      ;;
    apps/*/src/main/resources/*|modules/*/*/src/main/resources/*|common/*/src/main/resources/*)
      module_task_for "$path" processResources
      ;;
    *.gradle|*.gradle.kts|gradle.properties|settings.gradle.kts|gradle/*)
      add_task ":apps:carbonet-api:compileJava"
      ;;
  esac
done

if [[ ${#tasks[@]} -eq 0 ]]; then
  echo "[java-fast-compile] no Java, resource, or Gradle changes"
  exit 0
fi

start_ns="$(date +%s%N)"
echo "[java-fast-compile] tasks=${tasks[*]} workers=$MAX_WORKERS"
if [[ "${OS:-}" == "Windows_NT" ]] || grep -q $'\r$' "$ROOT_DIR/gradlew" 2>/dev/null; then
  (cd "$ROOT_DIR" && cmd.exe /d /c gradlew.bat \
    --daemon --parallel --build-cache --configuration-cache \
    --max-workers="$MAX_WORKERS" --console=plain "${tasks[@]}")
else
  (cd "$ROOT_DIR" && bash ./gradlew \
    --daemon --parallel --build-cache --configuration-cache \
    --max-workers="$MAX_WORKERS" --console=plain "${tasks[@]}")
fi
end_ns="$(date +%s%N)"
elapsed_ms="$(( (end_ns-start_ns)/1000000 ))"
echo "[java-fast-compile] PASS elapsedMs=$elapsed_ms tasks=${#tasks[@]}"
