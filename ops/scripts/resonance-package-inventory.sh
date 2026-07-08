#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

cat <<'TEXT'
Resonance package groups
========================

ACTIVE BUILD PACKAGES
- resonance-core     : modules/resonance-common/*
- resonance-adaptor  : modules/resonance-builder/*
- project-core       : apps/project-runtime, apps/carbonet-app
- resonance-ops      : modules/resonance-ops/*, apps/operations-console, ops, deploy

ACTIVE PROJECT OVERLAYS
- project            : projects/carbonet-frontend, projects/carbonet-assets,
                       projects/carbonet-backend-lib, projects/carbonet-backend-metadata

SUPPORT / TOOLING
- modules/hermes-core, ai-builder, skills, templates, scripts, package-sets,
  common, frontend, catalog, third_party

OPS / DATA / STATE
- data, db, manifests, runtime, release, var, ubuntu-auto-repair

LEGACY / REVIEW
- modules/_legacy-candidates
- modules/carbonet-common-core

LOCAL / TOOL STATE
- .codex, .kilo, .qwen, .kube, .github, .githooks, .gradle, node_modules, plans
TEXT

echo
echo "Gradle included modules:"
grep '^include' settings.gradle.kts | sed 's/^/  /'

echo
echo "Legacy/reference checks:"
printf '  modules/hermes-core direct refs: '
rg -l 'modules/hermes-core' settings.gradle.kts build.gradle.kts ops deploy apps modules projects docs 2>/dev/null | wc -l
printf '  old modules/carbonet-common-core refs: '
rg -l 'modules/carbonet-common-core|carbonet-common-core' settings.gradle.kts build.gradle.kts ops deploy apps modules projects docs 2>/dev/null | wc -l
printf '  legacy candidate refs: '
rg -l 'modules/_legacy-candidates|common-admin-runtime|common-content-runtime|common-payment' settings.gradle.kts build.gradle.kts ops deploy apps modules projects docs 2>/dev/null | wc -l
