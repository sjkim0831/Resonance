#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PORT="${JAVA_FAST_DEV_PORT:-18001}"
WATCH_INTERVAL="${JAVA_FAST_WATCH_INTERVAL:-1}"
RUN_DIR="$ROOT_DIR/var/run/java-fast-dev"
mkdir -p "$RUN_DIR"

if [[ "${1:-}" == "--compile-only" ]]; then
  shift
  exec bash "$ROOT_DIR/ops/scripts/java-fast-compile.sh" "$@"
fi

if [[ -z "${SPRING_DATASOURCE_URL:-}" ]]; then
  echo "SPRING_DATASOURCE_URL is required for java-fast-dev runtime mode" >&2
  echo "Use --compile-only when only incremental verification is needed." >&2
  exit 2
fi

cd "$ROOT_DIR"
bash ops/scripts/java-fast-compile.sh \
  apps/carbonet-api/build.gradle.kts \
  modules/resonance-common/carbonet-common-core/build.gradle.kts

cleanup() {
  [[ -n "${boot_pid:-}" ]] && kill "$boot_pid" >/dev/null 2>&1 || true
  rm -f "$RUN_DIR/pid"
}
trap cleanup EXIT INT TERM

SERVER_PORT="$PORT" bash ./gradlew :apps:carbonet-api:bootRun \
  --daemon --parallel --build-cache --configuration-cache --console=plain &
boot_pid=$!
printf '%s\n' "$boot_pid" >"$RUN_DIR/pid"
echo "[java-fast-dev] bootRun pid=$boot_pid port=$PORT"

snapshot="$RUN_DIR/snapshot"
next_snapshot="$RUN_DIR/snapshot.next"
find apps modules common -type f \( -name '*.java' -o -path '*/src/main/resources/*' \) \
  -printf '%T@ %s %p\n' 2>/dev/null | sort >"$snapshot"

while kill -0 "$boot_pid" 2>/dev/null; do
  sleep "$WATCH_INTERVAL"
  find apps modules common -type f \( -name '*.java' -o -path '*/src/main/resources/*' \) \
    -printf '%T@ %s %p\n' 2>/dev/null | sort >"$next_snapshot"
  if cmp -s "$snapshot" "$next_snapshot"; then continue; fi
  changed="$RUN_DIR/changed"
  # `comm` requires inputs sorted with exactly the same collation rules and can
  # terminate the watcher under `set -e` when a locale disagrees. `diff` has no
  # such precondition; emit both sides so modifications and deletions are seen.
  diff --old-line-format='%L' --new-line-format='%L' --unchanged-line-format='' \
    "$snapshot" "$next_snapshot" 2>/dev/null \
    | sed -E 's/^[^ ]+ [^ ]+ //' | sort -u >"$changed" || true
  mv "$next_snapshot" "$snapshot"
  if [[ -s "$changed" ]]; then
    echo "[java-fast-dev] source change detected"
    bash ops/scripts/java-fast-compile.sh --stdin <"$changed" || true
  fi
done

wait "$boot_pid"
