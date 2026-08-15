#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUTHORITY="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815121000__resolve_canonical_blueprint_authority.sql"
PROCESS_INPUT="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815121600__enforce_one_canonical_generation_job.sql"
GENERATOR="$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
WORKER="$ROOT/ops/scripts/run-process-development-worker.sh"

bash -n "$GENERATOR"
bash -n "$WORKER"

python3 - "$ROOT" "$AUTHORITY" "$PROCESS_INPUT" "$GENERATOR" "$WORKER" <<'PY'
import sys
from pathlib import Path

root = Path(sys.argv[1])
authority, process_input, generator, worker = (
    Path(path).read_text(encoding="utf-8") for path in sys.argv[2:]
)

def validate(authority: str, process_input: str, generator: str, worker: str) -> None:
    source_functions = (
        "framework_source_canonical_design_catalog",
        "framework_source_canonical_endpoint_readiness",
        "framework_source_canonical_endpoint_catalog",
    )
    endpoint_start = authority.index(
        "CREATE OR REPLACE FUNCTION public.framework_source_canonical_endpoint_catalog")
    endpoint_end = authority.index("COMMENT ON FUNCTION public.framework_source_canonical_endpoint_catalog", endpoint_start)
    endpoint_body = authority[endpoint_start:endpoint_end]
    if "readiness:=public.framework_source_canonical_endpoint_readiness(" not in endpoint_body:
        raise AssertionError("SOURCE endpoint catalog still follows ACTIVE readiness")
    if "readiness:=public.framework_canonical_endpoint_readiness(" in endpoint_body:
        raise AssertionError("ACTIVE readiness leaked into SOURCE endpoint catalog")
    for function in source_functions:
        signature = f"public.{function}("
        if authority.count(f"REVOKE ALL ON FUNCTION {signature}") != 2:
            raise AssertionError(f"SOURCE ACL revoke missing: {function}")
        if f"to_regprocedure('public.{function}(integer,character varying)')" not in authority:
            raise AssertionError(f"SOURCE ACL postcondition missing: {function}")
    if authority.count("acl.grantee=0 AND acl.privilege_type='EXECUTE'") < 1:
        raise AssertionError("PUBLIC execute ACL is not asserted")

    function_start = process_input.index(
        "CREATE OR REPLACE FUNCTION public.framework_process_generation_input")
    function_end = process_input.index("COMMENT ON FUNCTION public.framework_process_generation_input", function_start)
    head_body = process_input[function_start:function_end]
    for function in source_functions:
        if head_body.count(f"public.{function}(") != 1:
            raise AssertionError(f"process input does not call {function} exactly once")
    for token in (
        "WITH source_snapshot AS MATERIALIZED",
        "complete_snapshot AS MATERIALIZED",
        "INTO design_catalog,endpoint_readiness,endpoint_catalog",
        "'activationPolicy','SOURCE_IMMEDIATE_V1'",
    ):
        if token not in head_body:
            raise AssertionError(f"process SOURCE snapshot token missing: {token}")
    for forbidden in (
        "framework_canonical_design_catalog(5000,requested_process)",
        "framework_canonical_endpoint_catalog(\n    5000,requested_process)",
        "framework_activate_canonical_endpoint_upgrade",
        "framework_propose_canonical_endpoint_upgrade",
    ):
        if forbidden in head_body:
            raise AssertionError(f"effective/release transition leaked into process input: {forbidden}")

    for token in (
        'printf "framework_source_canonical_design_catalog(%s,\'%s\')"',
        'printf "framework_source_canonical_endpoint_readiness(%s,\'%s\')"',
        'printf "framework_source_canonical_endpoint_catalog(%s,\'%s\')"',
        "with source_snapshot as materialized",
        'activationPolicy:$activationPolicy',
        '.activationPolicy=="SOURCE_IMMEDIATE_V1"',
        'activationPolicy:$activationPolicy,processCode:$processCode',
    ):
        if token not in generator:
            raise AssertionError(f"generator SOURCE token missing: {token}")
    if generator.count("with source_snapshot as materialized") != 1:
        raise AssertionError("generator catalog bundle is not one statement")

    for token in (
        '.activationPolicy=="SOURCE_IMMEDIATE_V1"',
        "generation.head->>'activationPolicy'='SOURCE_IMMEDIATE_V1'",
        "j.spec->>'activationPolicy'=generation.head->>'activationPolicy'",
        'release.get("activationPolicy") != "SOURCE_IMMEDIATE_V1"',
        '"activationPolicy": release["activationPolicy"]',
        "CANONICAL_SOURCE_IMMEDIATE_RECEIPT_MISMATCH",
        "job_spec->>'designCatalogHash' is distinct from",
        "job_spec->>'endpointCatalogHash' is distinct from",
    ):
        if token not in worker:
            raise AssertionError(f"worker SOURCE receipt token missing: {token}")

validate(authority, process_input, generator, worker)

mutants = (
    (authority.replace("readiness:=public.framework_source_canonical_endpoint_readiness(",
                       "readiness:=public.framework_canonical_endpoint_readiness(", 1), process_input, generator, worker),
    (authority.replace("REVOKE ALL ON FUNCTION public.framework_source_canonical_design_catalog(",
                       "GRANT EXECUTE ON FUNCTION public.framework_source_canonical_design_catalog(", 1), process_input, generator, worker),
    (authority, process_input.replace("WITH source_snapshot AS MATERIALIZED", "WITH source_snapshot AS NOT MATERIALIZED", 1), generator, worker),
    (authority, process_input.replace("public.framework_source_canonical_endpoint_catalog(", "public.framework_canonical_endpoint_catalog(", 1), generator, worker),
    (authority, process_input, generator.replace('printf "framework_source_canonical_design_catalog(%s,\'%s\')"', 'printf "framework_canonical_design_catalog(%s,\'%s\')"', 1), worker),
    (authority, process_input, generator.replace("with source_snapshot as materialized", "with source_snapshot as not materialized", 1), worker),
    (authority, process_input, generator, worker.replace("j.spec->>'activationPolicy'=generation.head->>'activationPolicy'", "true", 1)),
    (authority, process_input, generator, worker.replace("job_spec->>'endpointCatalogHash' is distinct from", "job_spec->>'ignoredEndpointHash' is distinct from", 1)),
)
for index, mutant in enumerate(mutants):
    try:
        validate(*mutant)
    except (AssertionError, ValueError):
        continue
    raise AssertionError(f"SOURCE_IMMEDIATE mutant escaped: {index}")

if list((root / "apps/carbonet-api/src/main/resources/db/migration/postgresql").glob(
        "V20260815122000__close_active_source_candidate_transition.sql")):
    raise AssertionError("superseded ACTIVE transition migration exists")
PY

printf 'SOURCE_IMMEDIATE_CONTRACT_PASS sourceFunctions=3 statementSnapshots=2 aclPrivate=3 receiptHashes=3 mutations=8 m3=0\n'
