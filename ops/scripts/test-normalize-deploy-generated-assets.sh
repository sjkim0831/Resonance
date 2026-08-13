#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
normalizer="$script_dir/normalize-deploy-generated-assets.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.invalid
git -C "$tmp" config user.name test
mkdir -p \
  "$tmp/apps/carbonet-api/src/main/resources/static/react-app/assets" \
  "$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/assets" \
  "$tmp/projects/carbonet-frontend/source/src/generated/screen-generation/definitions" \
  "$tmp/projects/carbonet-backend-metadata/process-runtime/design-preview/ORGANIZATIONAL_BOUNDARY" \
  "$tmp/projects/carbonet-backend-metadata/process-runtime/generated/ORGANIZATIONAL_BOUNDARY" \
  "$tmp/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/ORGANIZATIONAL_BOUNDARY/src/main/java/example" \
  "$tmp/.gradle/caches"
printf 'tracked\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'tracked\n' >"$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/index.html"
printf 'package example; public class GeneratedEndpoint {}\n' \
  >"$tmp/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/ORGANIZATIONAL_BOUNDARY/src/main/java/example/GeneratedEndpoint.java"
printf '.gradle/\n**/StaleIgnoredEndpoint.java\n' >"$tmp/.gitignore"
git -C "$tmp" add .
git -C "$tmp" commit -qm seed

printf 'modified\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'generated\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/assets/new.js"
printf 'generated\n' >"$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/assets/new.js"
printf 'generated\n' >"$tmp/projects/carbonet-frontend/source/src/generated/screen-generation/definitions/new.json"
printf 'generated\n' >"$tmp/projects/carbonet-backend-metadata/process-runtime/design-preview/ORGANIZATIONAL_BOUNDARY/preview.json"
printf 'generated\n' >"$tmp/projects/carbonet-backend-metadata/process-runtime/generated/ORGANIZATIONAL_BOUNDARY/spec.json"
endpoint_java="$tmp/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/ORGANIZATIONAL_BOUNDARY/src/main/java/example"
printf 'package example; public class GeneratedEndpoint { BROKEN }\n' >"$endpoint_java/GeneratedEndpoint.java"
printf 'package example; public class StaleEndpoint {}\n' >"$endpoint_java/StaleEndpoint.java"
printf 'package example; public class StaleIgnoredEndpoint {}\n' >"$endpoint_java/StaleIgnoredEndpoint.java"
printf 'cache\n' >"$tmp/.gradle/caches/keep.bin"

bash "$normalizer" "$tmp" | grep -q GENERATED_WORKTREE_CLEAN
[[ "$(cat "$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html")" == tracked ]]
grep -Fq 'public class GeneratedEndpoint {}' "$endpoint_java/GeneratedEndpoint.java"
[[ ! -e "$endpoint_java/StaleEndpoint.java" ]]
[[ ! -e "$endpoint_java/StaleIgnoredEndpoint.java" ]]
[[ -f "$tmp/.gradle/caches/keep.bin" ]]
[[ -z "$(git -C "$tmp" status --porcelain=v1)" ]]
echo "GENERATED_WORKTREE_NORMALIZE_TEST_PASS"
