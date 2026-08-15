#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS_CODE="${2:-}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
OUT="${FULL_STACK_PACKAGE_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated}"
PREVIEW_OUT="${FULL_STACK_PREVIEW_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/design-preview}"
ENDPOINT_CATALOG="${CANONICAL_ENDPOINT_CATALOG:-}"
ENDPOINT_ROOT="${CANONICAL_ENDPOINT_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints}"
ENDPOINT_OUT="$ENDPOINT_ROOT"
ENDPOINT_AUTODETECT="${CANONICAL_ENDPOINT_AUTODETECT:-true}"
ENDPOINT_LIMIT="${CANONICAL_ENDPOINT_LIMIT:-5000}"
readonly ACTIVATION_POLICY="SOURCE_IMMEDIATE_V1"
GRADLE_TASK="${CANONICAL_ENDPOINT_GRADLE_TASK:-:modules:resonance-common:carbonet-common-core:compileJava}"
WORKERS="${CANONICAL_GENERATOR_WORKERS:-${FULL_STACK_GENERATOR_WORKERS:-4}}"
TMP="$(mktemp)"
STAGE_ROOT=""
ENDPOINT_TMP=""
MIGRATION_REPORT=""
DB_BUNDLE_TMP=""
AUTHORITATIVE_TMP=""
REBOUND_TMP=""
DESIGN_CATALOG_TMP=""
trap 'rm -f "$TMP"; [[ -z "$ENDPOINT_TMP" ]] || rm -f "$ENDPOINT_TMP"; [[ -z "$MIGRATION_REPORT" ]] || rm -f "$MIGRATION_REPORT"; [[ -z "$DB_BUNDLE_TMP" ]] || rm -f "$DB_BUNDLE_TMP"; [[ -z "$AUTHORITATIVE_TMP" ]] || rm -f "$AUTHORITATIVE_TMP"; [[ -z "$REBOUND_TMP" ]] || rm -f "$REBOUND_TMP"; [[ -z "$DESIGN_CATALOG_TMP" ]] || rm -f "$DESIGN_CATALOG_TMP"; [[ -z "$STAGE_ROOT" ]] || rm -rf "$STAGE_ROOT"' EXIT

leader=""
[[ -z "$PROCESS_CODE" || "$PROCESS_CODE" =~ ^[A-Z][A-Z0-9_]{1,79}$ ]] || {
  echo '[full-stack-generator] invalid process code' >&2; exit 1;
}
[[ "$ENDPOINT_LIMIT" =~ ^[0-9]+$ ]] && (( ENDPOINT_LIMIT >= 1 && ENDPOINT_LIMIT <= 5000 )) || {
  echo '[full-stack-generator] canonical endpoint limit must be between 1 and 5000' >&2; exit 1;
}
LIMIT_VALIDATED=1

require_linked_worktree() {
  [[ "${LINKED_WORKTREE_VALIDATED:-}" == "1" ]] && return 0
  local git_dir git_common_dir
  git_dir="$(git -C "$ROOT" rev-parse --absolute-git-dir 2>/dev/null || true)"
  git_common_dir="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  [[ -n "$git_dir" && -n "$git_common_dir" && "$git_dir" != "$git_common_dir" && "$git_dir" == "$git_common_dir"/worktrees/* ]] || {
    echo '[full-stack-generator] canonical generation is allowed only in an isolated linked git worktree' >&2
    return 1
  }
  LINKED_WORKTREE_VALIDATED=1
}

# An explicitly requested canonical release must fail before any database read
# in a primary checkout. Autodetection is gated later only after readiness is
# COMPLETE so rolling-upgrade PARTIAL/legacy generation remains available.
[[ -z "$ENDPOINT_CATALOG" ]] || require_linked_worktree

# Patroni can promote any ordinal. A configured POSTGRES_POD is only a hint;
# never write generation state until pg_is_in_recovery() proves it is leader.
declare -a candidates=()
[[ -n "${POSTGRES_POD:-}" ]] && candidates+=("$POSTGRES_POD")
while IFS= read -r candidate; do
  [[ -n "$candidate" ]] && candidates+=("$candidate")
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
for candidate in "${candidates[@]}"; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$candidate" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$candidate"
    break
  fi
done
[[ -n "$leader" ]] || { echo '[full-stack-generator] PostgreSQL pod not found' >&2; exit 1; }

if [[ -n "$PROCESS_CODE" ]]; then
  selector="'$PROCESS_CODE'"
  OUT="$OUT/$PROCESS_CODE"
  PREVIEW_OUT="$PREVIEW_OUT/$PROCESS_CODE"
  ENDPOINT_OUT="$ENDPOINT_OUT/$PROCESS_CODE"
else
  selector="null"
fi

endpoint_catalog_expression() {
  if [[ -n "$PROCESS_CODE" ]]; then
    printf "framework_source_canonical_endpoint_catalog(%s,'%s')" \
      "$ENDPOINT_LIMIT" "$PROCESS_CODE"
  else
    printf "framework_canonical_endpoint_catalog(%s)" "$ENDPOINT_LIMIT"
  fi
}

design_catalog_expression() {
  if [[ -n "$PROCESS_CODE" ]]; then
    printf "framework_source_canonical_design_catalog(%s,'%s')" \
      "$ENDPOINT_LIMIT" "$PROCESS_CODE"
  else
    printf "framework_canonical_design_catalog(%s)" "$ENDPOINT_LIMIT"
  fi
}

endpoint_readiness_expression() {
  if [[ -n "$PROCESS_CODE" ]]; then
    printf "framework_source_canonical_endpoint_readiness(%s,'%s')" \
      "$ENDPOINT_LIMIT" "$PROCESS_CODE"
  else
    printf "framework_canonical_endpoint_readiness(%s)" "$ENDPOINT_LIMIT"
  fi
}

endpoint_catalog_sql() {
  printf 'select %s;' "$(endpoint_catalog_expression)"
}

endpoint_process_sources() {
  local candidate manifest release source_dir catalog_hash release_catalog release_policy
  [[ ! -e "$ENDPOINT_ROOT/src/main/java" ]] || {
    echo '[full-stack-generator] mixed legacy-root and process-scoped endpoint layouts are forbidden' >&2
    return 1
  }
  for candidate in "$ENDPOINT_ROOT"/*; do
    [[ -d "$candidate" && ! -L "$candidate" ]] || continue
    [[ "$(basename "$candidate")" =~ ^[A-Z][A-Z0-9_]{1,79}$ ]] || continue
    [[ "$candidate" != "$ENDPOINT_OUT" ]] || continue
    manifest="$candidate/manifest.json"; release="$candidate/full-stack-release.json"
    source_dir="$candidate/src/main/java"
    [[ -f "$manifest" && -f "$release" && -d "$source_dir" ]] || {
      echo "[full-stack-generator] endpoint process evidence is incomplete: $candidate" >&2; return 1;
    }
    catalog_hash="$(jq -er 'select(.schema=="carbonet.generated-endpoints/v1")|.catalogHash' "$manifest")" || return 1
    release_catalog="$(jq -er 'select(.schema=="carbonet.canonical-full-stack-release/v1")|.endpointCatalogHash' "$release")" || return 1
    release_policy="$(jq -er '.activationPolicy' "$release")" || return 1
    [[ "$catalog_hash" == "$release_catalog" && "$release_policy" == "$ACTIVATION_POLICY" ]] || {
      echo "[full-stack-generator] endpoint process release provenance mismatch: $candidate" >&2; return 1;
    }
    printf '%s\n' "$source_dir"
  done
}

validate_endpoint_layout() {
  local has_process=false candidate
  for candidate in "$ENDPOINT_ROOT"/*; do
    [[ -d "$candidate" && ! -L "$candidate" ]] || continue
    [[ "$(basename "$candidate")" =~ ^[A-Z][A-Z0-9_]{1,79}$ ]] || continue
    has_process=true; break
  done
  if [[ -e "$ENDPOINT_ROOT/src/main/java" && "$has_process" == true ]]; then
    echo '[full-stack-generator] mixed legacy-root and process-scoped endpoint layouts are forbidden' >&2
    return 1
  fi
  if [[ -n "$PROCESS_CODE" && -e "$ENDPOINT_ROOT/src/main/java" ]]; then
    echo '[full-stack-generator] process-scoped generation rejects the legacy root endpoint layout' >&2
    return 1
  fi
  if [[ -z "$PROCESS_CODE" && "$has_process" == true ]]; then
    echo '[full-stack-generator] global generation rejects existing process-scoped endpoint layout' >&2
    return 1
  fi
}

verify_published_release() {
  jq -e --slurpfile runtime "$OUT/index.json" --slurpfile manifest "$ENDPOINT_OUT/manifest.json" '
    .schema=="carbonet.canonical-full-stack-release/v1" and
    .activationPolicy=="SOURCE_IMMEDIATE_V1" and
    .packageManifestHash==$runtime[0].manifestHash and
    .endpointBundleHash==$manifest[0].bundleHash and
    .endpointCatalogHash==$manifest[0].catalogHash and
    (.releaseHash|type=="string" and test("^[0-9a-f]{64}$"))
  ' "$ENDPOINT_OUT/full-stack-release.json" >/dev/null || {
    echo '[full-stack-generator] published release marker cross-hash verification failed' >&2
    return 1
  }
  jq -cn --arg releaseHash "$(jq -r '.releaseHash' "$ENDPOINT_OUT/full-stack-release.json")" \
    --arg processCode "${PROCESS_CODE:-ALL}" \
    --arg activationPolicy "$ACTIVATION_POLICY" \
    '{event:"CANONICAL_RELEASE_READY",boundary:"GIT_COMMIT",activationPolicy:$activationPolicy,processCode:$processCode,releaseHash:$releaseHash}'
}

# Self-heal a process killed between directory swaps before reading a new DB
# snapshot. Recovery is journaled and serialized by the generator lock.
python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" --recover-publish-set \
  "$OUT" "$PREVIEW_OUT" "$ENDPOINT_OUT" >/dev/null
validate_endpoint_layout

# Once the additive canonical endpoint compiler is installed, design updates
# automatically enter the typed endpoint lane. Before that migration exists,
# the existing package-only path remains available for rolling upgrades.
if [[ -z "$ENDPOINT_CATALOG" && "$ENDPOINT_AUTODETECT" == "true" ]]; then
  endpoint_compiler_available="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -Atqc \
    "select (case when '$PROCESS_CODE'='' then to_regprocedure('public.framework_canonical_endpoint_catalog(integer)') is not null else to_regprocedure('public.framework_source_canonical_design_catalog(integer,character varying)') is not null and to_regprocedure('public.framework_source_canonical_endpoint_readiness(integer,character varying)') is not null and to_regprocedure('public.framework_source_canonical_endpoint_catalog(integer,character varying)') is not null end)::text")"
  if [[ "$endpoint_compiler_available" == "true" ]]; then
    # The authoritative endpoint bundle below performs the only canonical
    # readiness/catalog call. Use a marker here so explicit and autodetect paths
    # share the same one-statement snapshot.
    ENDPOINT_CATALOG="__AUTODETECT__"
  fi
fi

if [[ -n "$ENDPOINT_CATALOG" ]]; then
  [[ "$WORKERS" =~ ^[0-9]+$ ]] && (( WORKERS >= 1 && WORKERS <= 16 )) || {
    echo '[full-stack-generator] workers must be between 1 and 16' >&2; exit 1;
  }
  EXTERNAL_ENDPOINT_CATALOG="$ENDPOINT_CATALOG"
  [[ "$EXTERNAL_ENDPOINT_CATALOG" == "__AUTODETECT__" || -s "$EXTERNAL_ENDPOINT_CATALOG" ]] || {
    echo '[full-stack-generator] canonical endpoint catalog missing' >&2; exit 1;
  }
  ENDPOINT_GENERATOR="$ROOT/ops/scripts/generate-spring-api-from-design.py"
  [[ -x "$ENDPOINT_GENERATOR" ]] || { echo '[full-stack-generator] canonical endpoint generator missing' >&2; exit 1; }
  STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/canonical-full-stack.XXXXXX")"
  RUNTIME_STAGE="$STAGE_ROOT/runtime"
  PREVIEW_STAGE="$STAGE_ROOT/preview"
  ENDPOINT_STAGE="$STAGE_ROOT/endpoints"

  # Export runtime plus the three SOURCE catalogs in one PostgreSQL statement/
  # MVCC snapshot. ACTIVE release wrappers cannot contribute older H1 bytes.
  DB_BUNDLE_TMP="$(mktemp)"
  AUTHORITATIVE_TMP="$(mktemp)"
  REBOUND_TMP="$(mktemp)"
  DESIGN_CATALOG_TMP="$(mktemp)"
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At \
    -c "with source_snapshot as materialized (select framework_process_generation_snapshot($selector) runtime,$(design_catalog_expression) design,$(endpoint_readiness_expression) endpoint_readiness), complete_snapshot as materialized (select runtime,design,endpoint_readiness,case when endpoint_readiness->>'status'='COMPLETE' then $(endpoint_catalog_expression) else null end endpoint from source_snapshot) select jsonb_build_object('runtime',runtime,'design',design,'endpointReadiness',endpoint_readiness,'endpoint',endpoint) from complete_snapshot;" >"$DB_BUNDLE_TMP"
  endpoint_readiness="$(jq -e '.endpointReadiness' "$DB_BUNDLE_TMP")"
  if [[ "$(jq -er '.status' <<<"$endpoint_readiness")" != "COMPLETE" ]]; then
    if [[ "$EXTERNAL_ENDPOINT_CATALOG" == "__AUTODETECT__" ]]; then
      jq -cn --argjson readiness "$endpoint_readiness" \
        '{event:"CANONICAL_ENDPOINT_DEFERRED",status:$readiness.status,blockerCount:$readiness.blockerCount,readiness:$readiness}' >&2
      ENDPOINT_CATALOG=""
    else
      echo '[full-stack-generator] explicit endpoint catalog rejected while canonical endpoint readiness is PARTIAL' >&2
      exit 1
    fi
  fi
  if [[ -z "$ENDPOINT_CATALOG" ]]; then
    jq -e '.runtime' "$DB_BUNDLE_TMP" >"$REBOUND_TMP"
    mv "$REBOUND_TMP" "$TMP"
    REBOUND_TMP=""
    rm -f "$DB_BUNDLE_TMP" "$AUTHORITATIVE_TMP" "$REBOUND_TMP" "$DESIGN_CATALOG_TMP"
    DB_BUNDLE_TMP=""; AUTHORITATIVE_TMP=""; REBOUND_TMP=""; DESIGN_CATALOG_TMP=""
  else
  [[ -n "$PROCESS_CODE" ]] || {
    echo '[full-stack-generator] canonical endpoint publication requires a process-scoped worker' >&2; exit 1;
  }
  require_linked_worktree
  jq -e '.runtime' "$DB_BUNDLE_TMP" >"$REBOUND_TMP"
  mv "$REBOUND_TMP" "$TMP"
  REBOUND_TMP=""
  jq -e '.endpoint' "$DB_BUNDLE_TMP" >"$AUTHORITATIVE_TMP"
  jq -e '.design' "$DB_BUNDLE_TMP" >"$DESIGN_CATALOG_TMP"
  if [[ "$EXTERNAL_ENDPOINT_CATALOG" != "__AUTODETECT__" && \
        "$(jq -er '.catalogHash' "$AUTHORITATIVE_TMP")" != "$(jq -er '.catalogHash' "$EXTERNAL_ENDPOINT_CATALOG")" ]]; then
    echo '[full-stack-generator] stale canonical endpoint catalog rejected' >&2; exit 1;
  fi
  ENDPOINT_CATALOG="$AUTHORITATIVE_TMP"
  if [[ -n "${FULL_STACK_SNAPSHOT_KEEP:-}" ]]; then
    install -m 600 "$TMP" "$FULL_STACK_SNAPSHOT_KEEP"
  fi
  fi

  if [[ -z "$ENDPOINT_CATALOG" ]]; then
    python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT"
    python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT" --check
  else

  # PROCESS_COMMAND_ADAPTER v1 reuses the existing process aggregate. Verify
  # its transactional scope/optimistic-lock columns read-only; it emits no DDL.
  aggregate_ready="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -Atqc \
    "select (to_regclass('public.framework_process_execution') is not null and (select count(*)=4 from information_schema.columns where table_schema='public' and table_name='framework_process_execution' and column_name in ('execution_id','tenant_id','project_id','execution_version')))::text")"
  [[ "$aggregate_ready" == "true" ]] || {
    echo '[full-stack-generator] process execution aggregate preflight failed' >&2; exit 1;
  }

  # Preflight every contract before any live output or Flyway path is touched.
  python3 "$ENDPOINT_GENERATOR" "$ENDPOINT_CATALOG" --out "$ENDPOINT_STAGE" --workers "$WORKERS" --check
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$RUNTIME_STAGE" --workers "$WORKERS" --canonical-catalog "$DESIGN_CATALOG_TMP"
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$RUNTIME_STAGE" --workers "$WORKERS" --canonical-catalog "$DESIGN_CATALOG_TMP" --check
  jq -e '.packageCount>0' "$RUNTIME_STAGE/index.json" >/dev/null || {
    echo "[full-stack-generator] no approved generation-ready package for ${PROCESS_CODE:-all processes}" >&2
    exit 1
  }
  python3 "$ENDPOINT_GENERATOR" "$ENDPOINT_CATALOG" --out "$ENDPOINT_STAGE" --workers "$WORKERS"
  jq -e --slurpfile manifest "$ENDPOINT_STAGE/manifest.json" '
    .schema=="carbonet.canonical-endpoint-catalog/v1" and
    .catalogHash==$manifest[0].catalogHash and
    ([.endpoints[].designHash]|unique|sort)==([$manifest[0].artifacts[].designHash]|unique|sort)
  ' "$ENDPOINT_CATALOG" >/dev/null
  jq -e --slurpfile runtime "$RUNTIME_STAGE/index.json" '
    ([.endpoints[].endpointContract.operations[]|[.processCode,.stepCode]]|unique|sort)
      ==([$runtime[0].packages[]|[.processCode,.stepCode]]|unique|sort)
  ' "$ENDPOINT_CATALOG" >/dev/null || {
    echo '[full-stack-generator] endpoint/runtime process-step sets diverged' >&2; exit 1;
  }
  jq -e --slurpfile runtime "$RUNTIME_STAGE/index.json" --slurpfile design "$DESIGN_CATALOG_TMP" '
    .catalogHash==$runtime[0].canonicalCatalogHash and
    ([.screens[]|{screenKey,designHash}]|sort_by(.screenKey))==
      ([$runtime[0].canonicalScreens[]]|unique_by(.screenKey)|sort_by(.screenKey))
  ' "$DESIGN_CATALOG_TMP" >/dev/null || {
    echo '[full-stack-generator] five-lane canonical design hashes diverged' >&2; exit 1;
  }
  MIGRATION_REPORT="$(mktemp)"
  python3 "$ROOT/ops/scripts/generate-safe-migrations-from-design.py" "$RUNTIME_STAGE" --root "$ROOT" --check >"$MIGRATION_REPORT"
  jq -e '.success==true and .generated==0 and .reviewRequired==0 and (.legacySkipped+.unchanged)==.packages and ([.plans[]?|select(.status=="VALIDATED")]|length)==0' \
    "$MIGRATION_REPORT" >/dev/null || {
      echo '[full-stack-generator] canonical adapter must produce zero schema migrations' >&2; exit 1;
    }
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" \
    --out "$PREVIEW_STAGE" --workers "$WORKERS" --allow-review-required --canonical-catalog "$DESIGN_CATALOG_TMP"
  jq -n --arg designCatalogHash "$(jq -r '.catalogHash' "$DESIGN_CATALOG_TMP")" \
    --arg endpointCatalogHash "$(jq -r '.catalogHash' "$ENDPOINT_CATALOG")" \
    --arg activationPolicy "$ACTIVATION_POLICY" \
    --arg packageManifestHash "$(jq -r '.manifestHash' "$RUNTIME_STAGE/index.json")" \
    --arg endpointBundleHash "$(jq -r '.bundleHash' "$ENDPOINT_STAGE/manifest.json")" \
    --argjson designHashes "$(jq -c '[.endpoints[].designHash]|unique|sort' "$ENDPOINT_CATALOG")" \
    '{schema:"carbonet.canonical-full-stack-release/v1",activationPolicy:$activationPolicy,lanes:["FRONTEND","API","DATABASE","HELP","CARDS"],designCatalogHash:$designCatalogHash,endpointCatalogHash:$endpointCatalogHash,designHashes:$designHashes,packageManifestHash:$packageManifestHash,endpointBundleHash:$endpointBundleHash}' \
    >"$ENDPOINT_STAGE/full-stack-release.json"
  release_hash="$(python3 - "$ENDPOINT_STAGE/full-stack-release.json" <<'PY'
import hashlib,json,sys
value=json.load(open(sys.argv[1],encoding="utf-8"))
print(hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest())
PY
)"
  jq --arg releaseHash "$release_hash" '.releaseHash=$releaseHash' \
    "$ENDPOINT_STAGE/full-stack-release.json" >"$ENDPOINT_STAGE/full-stack-release.json.tmp"
  mv "$ENDPOINT_STAGE/full-stack-release.json.tmp" "$ENDPOINT_STAGE/full-stack-release.json"
  # Compile the exact staged endpoint sources through the real Gradle source
  # set. The source path override is stage-only and leaves live output untouched.
  build_sources="$ENDPOINT_STAGE/src/main/java"
  if [[ -n "$PROCESS_CODE" && -d "$ENDPOINT_ROOT" ]]; then
    existing_sources_text="$(endpoint_process_sources)" || exit 1
    existing_sources=()
    [[ -z "$existing_sources_text" ]] || mapfile -t existing_sources <<<"$existing_sources_text"
    for existing_source in "${existing_sources[@]}"; do
      build_sources="$build_sources:$existing_source"
    done
  fi
  preflight_sources="$build_sources"
  CANONICAL_ENDPOINT_SOURCE_DIRS="$build_sources" \
    bash "$ROOT/gradlew" "$GRADLE_TASK" --no-daemon --console=plain --no-build-cache --rerun-tasks

  runtime_sources="$ENDPOINT_STAGE/src/main/java"
  if [[ -n "$PROCESS_CODE" && -d "$ENDPOINT_ROOT" ]]; then
    existing_sources_text="$(endpoint_process_sources)" || exit 1
    existing_sources=()
    [[ -z "$existing_sources_text" ]] || mapfile -t existing_sources <<<"$existing_sources_text"
    for existing_source in "${existing_sources[@]}"; do runtime_sources="$runtime_sources:$existing_source"; done
  fi
  [[ "$runtime_sources" == "$preflight_sources" ]] || {
    echo '[full-stack-generator] endpoint source layout changed between preflight and publish' >&2; exit 1;
  }

  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" --publish-set \
    "$RUNTIME_STAGE" "$OUT" "$PREVIEW_STAGE" "$PREVIEW_OUT" "$ENDPOINT_STAGE" "$ENDPOINT_OUT"
  verify_published_release
  fi
else
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At \
    -c "select framework_process_generation_snapshot($selector);" >"$TMP"
  if [[ -n "${FULL_STACK_SNAPSHOT_KEEP:-}" ]]; then
    install -m 600 "$TMP" "$FULL_STACK_SNAPSHOT_KEEP"
  fi
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT"
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT" --check
fi
jq -e '.packageCount>0' "$OUT/index.json" >/dev/null || {
  echo "[full-stack-generator] no approved generation-ready package for ${PROCESS_CODE:-all processes}" >&2
  exit 1
}

# Approved designs may opt into deterministic database generation by declaring
# database.autoGenerateMigration=true and an explicit schemaChanges contract.
# The compiler is fail-closed and only emits CREATE TABLE/INDEX migrations
# accepted by the same classifier used by the one-minute deployment path.
if [[ -z "$ENDPOINT_CATALOG" ]]; then
  python3 "$ROOT/ops/scripts/generate-safe-migrations-from-design.py" "$OUT" --root "$ROOT"
fi

# Every structurally complete design is rendered to an isolated preview so a
# domain owner can review all fields and flows. Only APPROVED contracts above
# are written to the runtime-consumable generated directory.
if [[ -z "$ENDPOINT_CATALOG" ]]; then
  python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" \
    --out "$PREVIEW_OUT" --allow-review-required
fi

if [[ -n "$PROCESS_CODE" ]]; then
  generation_filter="and process_code='$PROCESS_CODE'"
else
  generation_filter=""
fi
# Canonical publication is content-addressed and performs zero writes after the
# directory swap. Legacy status bookkeeping remains unchanged.
if [[ -z "$ENDPOINT_CATALOG" ]]; then
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 \
    -c "update framework_step_execution_spec set generation_status='GENERATED',updated_at=current_timestamp where design_status='DESIGN_COMPLETE' and approval_status='APPROVED' $generation_filter;" >/dev/null
fi
