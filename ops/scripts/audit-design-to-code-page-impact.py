#!/usr/bin/env python3
"""Build one read-only DB + repository design-to-code page impact ledger."""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable


SCHEMA = "carbonet.design-to-code-page-impact-ledger/v1"
ROOT = Path(__file__).resolve().parents[2]
CORE_SQL = Path(__file__).with_suffix(".sql")
DEFAULT_TIMEOUT_MS = 300_000


class AuditError(RuntimeError):
    pass


def utc_now() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch is not None:
        value = dt.datetime.fromtimestamp(int(epoch), tz=dt.timezone.utc)
    else:
        value = dt.datetime.now(tz=dt.timezone.utc)
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def run(
    argv: list[str],
    *,
    cwd: Path,
    input_text: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float = 360.0,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        argv,
        cwd=cwd,
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        raise AuditError(sanitize_error(result.stderr or result.stdout))
    return result


def sanitize_error(value: str) -> str:
    compact = re.sub(r"\s+", " ", value or "").strip()
    compact = re.sub(
        r"(?i)(password|passwd|pwd|token|secret)\s*[=:]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        compact,
    )
    compact = re.sub(r"(?i)postgres(?:ql)?://[^\s]+", "postgresql://[REDACTED]", compact)
    return compact[:1000] or "command failed without diagnostic output"


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def render_core_sql(source: str, args: argparse.Namespace) -> str:
    replacements = {
        "/*__PROCESS_CODE__*/NULL": sql_literal(args.process_code),
        "/*__STEP_CODE__*/NULL": sql_literal(args.step_code),
        "/*__AUDIENCE__*/NULL": sql_literal(args.audience),
        "/*__ROUTE_PATH__*/NULL": sql_literal(args.route_path),
    }
    for marker, value in replacements.items():
        if marker not in source:
            raise AuditError(f"core SQL selector marker missing: {marker}")
        source = source.replace(marker, value, 1)
    return source


def asset_impact_sql(args: argparse.Namespace) -> str:
    asset_type = sql_literal(args.asset_type)
    asset_id = sql_literal(args.asset_id)
    process_code = sql_literal(args.process_code)
    step_code = sql_literal(args.step_code)
    audience = sql_literal(args.audience)
    route_path = sql_literal(args.route_path)
    return f"""
    WITH RECURSIVE
    selector AS MATERIALIZED (
      SELECT {asset_type}::text AS asset_type,{asset_id}::text AS asset_id,
             {process_code}::text AS process_code,{step_code}::text AS step_code,
             {audience}::text AS audience,{route_path}::text AS route_path
    ),
    source_asset AS MATERIALIZED (
      SELECT upper(asset_type) AS asset_type,asset_id,canonical_asset
      FROM public.framework_common_design_asset_source_state
    ),
    dependency_edge AS MATERIALIZED (
      SELECT parent.asset_type AS parent_type,parent.asset_id AS parent_id,
             upper(dependency->>'assetType') AS dependency_type,
             dependency->>'assetId' AS dependency_id
      FROM source_asset parent
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(parent.canonical_asset#>'{{payload,dependencies}}')='array'
             THEN parent.canonical_asset#>'{{payload,dependencies}}'
             ELSE '[]'::jsonb END
      ) dependency
      WHERE coalesce(dependency->>'assetType','')<>''
        AND coalesce(dependency->>'assetId','')<>''
    ),
    reverse_asset(asset_type,asset_id) AS (
      SELECT selector.asset_type,selector.asset_id FROM selector
      UNION
      SELECT edge.parent_type,edge.parent_id
      FROM reverse_asset current_asset
      JOIN dependency_edge edge
        ON edge.dependency_type=current_asset.asset_type
       AND edge.dependency_id=current_asset.asset_id
    ),
    source_screen AS MATERIALIZED (
      SELECT asset.asset_id,
             lower(split_part(asset.canonical_asset->>'routePath','?',1)) AS route_path
      FROM source_asset asset
      JOIN reverse_asset reachable USING(asset_type,asset_id)
      WHERE asset.asset_type='SCREEN'
        AND coalesce(asset.canonical_asset->>'routePath','')~'^/'
    ),
    impacted_page AS MATERIALIZED (
      SELECT screen.asset_id AS page_id FROM source_screen screen
      UNION
      SELECT mapping.page_id
      FROM public.ui_page_component_map mapping
      JOIN reverse_asset reachable
        ON reachable.asset_type='COMPONENT'
       AND reachable.asset_id=mapping.component_id
      UNION
      SELECT page.page_id
      FROM public.ui_page_manifest page
      JOIN reverse_asset reachable
        ON reachable.asset_type='THEME'
       AND reachable.asset_id=page.design_token_version
      UNION
      SELECT reachable.asset_id
      FROM reverse_asset reachable WHERE reachable.asset_type='SCREEN'
    ),
    impacted_route AS MATERIALIZED (
      SELECT lower(split_part(page.route_path,'?',1)) AS route_path
      FROM public.ui_page_manifest page
      JOIN impacted_page impacted USING(page_id)
      WHERE page.route_path~'^/'
      UNION
      SELECT route_path FROM source_screen
    ),
    blueprint_binding AS MATERIALIZED (
      SELECT DISTINCT upper(blueprint.process_code) AS process_code,
             upper(blueprint.step_code) AS step_code,
             upper(blueprint.audience) AS audience,
             lower(split_part(blueprint.route_path,'?',1)) AS route_path
      FROM public.framework_screen_blueprint blueprint
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN blueprint.specification_json IS JSON OBJECT
                   AND jsonb_typeof(blueprint.specification_json::jsonb->'assetBindings')='array'
             THEN blueprint.specification_json::jsonb->'assetBindings'
             ELSE '[]'::jsonb END
      ) binding
      JOIN reverse_asset reachable
        ON reachable.asset_type=upper(coalesce(
             nullif(binding->>'assetType',''),nullif(binding->>'type',''),'COMPONENT'))
       AND reachable.asset_id=coalesce(
             nullif(binding->>'assetCode',''),nullif(binding->>'asset',''),
             nullif(binding->>'registryKey',''))
      WHERE blueprint.validation_status='VALID'
      UNION
      SELECT DISTINCT upper(blueprint.process_code),upper(blueprint.step_code),
             upper(blueprint.audience),lower(split_part(blueprint.route_path,'?',1))
      FROM public.framework_screen_blueprint blueprint
      JOIN reverse_asset reachable
        ON reachable.asset_type='SCREEN' AND reachable.asset_id=blueprint.page_id
      WHERE blueprint.validation_status='VALID'
    ),
    required_identity AS MATERIALIZED (
      SELECT upper(step.process_code) AS process_code,upper(step.step_code) AS step_code,
             lane.audience,lower(split_part(lane.route_path,'?',1)) AS route_path
      FROM public.framework_process_step step
      CROSS JOIN LATERAL (VALUES
        ('USER'::text,nullif(btrim(step.user_path),''),step.requires_user_page),
        ('ADMIN'::text,nullif(btrim(step.admin_path),''),step.requires_admin_page)
      ) lane(audience,route_path,screen_required)
      WHERE lane.route_path~'^/' AND coalesce(lane.screen_required,false)
    ),
    affected_identity AS MATERIALIZED (
      SELECT required.* FROM required_identity required
      JOIN impacted_route route USING(route_path)
      UNION
      SELECT required.* FROM required_identity required
      JOIN blueprint_binding binding
        USING(process_code,step_code,audience,route_path)
    ),
    selected_affected AS MATERIALIZED (
      SELECT affected.* FROM affected_identity affected CROSS JOIN selector
      WHERE (selector.process_code IS NULL OR affected.process_code=selector.process_code)
        AND (selector.step_code IS NULL OR affected.step_code=selector.step_code)
        AND (selector.audience IS NULL OR affected.audience=selector.audience)
        AND (selector.route_path IS NULL OR affected.route_path=selector.route_path)
    )
    SELECT jsonb_build_object(
      'schema','carbonet.common-design-asset-page-impact/v1',
      'scope','ASSET_DEPENDENCY_DAG',
      'assetType',selector.asset_type,'assetId',selector.asset_id,
      'directAssetFound',EXISTS(
        SELECT 1 FROM source_asset asset
        WHERE asset.asset_type=selector.asset_type AND asset.asset_id=selector.asset_id),
      'reachableAssetCount',(SELECT count(*)::integer FROM reverse_asset),
      'reachableScreenAssetCount',(SELECT count(*)::integer FROM source_screen),
      'uiPageFanoutCount',(SELECT count(*)::integer FROM impacted_page),
      'blueprintAssetBindingFanoutCount',(SELECT count(*)::integer FROM blueprint_binding),
      'affectedNormalizedRouteCount',(
        SELECT count(DISTINCT route_path)::integer FROM selected_affected),
      'affectedExactIdentityCount',(SELECT count(*)::integer FROM selected_affected)
    )
    FROM selector
    """


def first_json(value: str) -> Any:
    decoder = json.JSONDecoder()
    for line in value.splitlines():
        candidate = line.strip()
        if not candidate or candidate[0] not in "[{":
            continue
        try:
            parsed, offset = decoder.raw_decode(candidate)
        except json.JSONDecodeError:
            continue
        if not candidate[offset:].strip():
            return parsed
    raise AuditError("psql returned no machine-readable JSON row")


class PsqlReader:
    def __init__(
        self,
        *,
        root: Path,
        dsn: str | None,
        command: list[str] | None,
        timeout_ms: int,
    ) -> None:
        if bool(dsn) == bool(command):
            raise AuditError("provide exactly one of --dsn or --psql-command-json")
        self.root = root
        self.timeout_ms = timeout_ms
        if command:
            self.argv = command
            self.env = os.environ.copy()
        else:
            self.argv = [
                "psql",
                "-X",
                "-A",
                "-t",
                "-q",
                "-v",
                "ON_ERROR_STOP=1",
                "-d",
                str(dsn),
            ]
            self.env = os.environ.copy()
            prior = self.env.get("PGOPTIONS", "").strip()
            safe = (
                f"-c default_transaction_read_only=on "
                f"-c statement_timeout={timeout_ms} "
                f"-c lock_timeout=5000"
            )
            self.env["PGOPTIONS"] = f"{prior} {safe}".strip()

    def query(self, sql: str) -> Any:
        # The audit SQL remains one SELECT. The transaction wrapper makes the
        # no-write guarantee explicit even when a caller supplies custom psql.
        wrapped = (
            "BEGIN TRANSACTION READ ONLY;\n"
            f"SET LOCAL statement_timeout='{self.timeout_ms}ms';\n"
            "SET LOCAL lock_timeout='5s';\n"
            f"{sql.rstrip().rstrip(';')};\n"
            "ROLLBACK;\n"
        )
        result = run(
            self.argv,
            cwd=self.root,
            input_text=wrapped,
            env=self.env,
            timeout=max(30.0, self.timeout_ms / 1000 + 30),
            check=False,
        )
        if result.returncode != 0:
            raise AuditError(sanitize_error(result.stderr or result.stdout))
        return first_json(result.stdout)


def probe(reader: PsqlReader, name: str, sql: str) -> dict[str, Any]:
    started = time.monotonic()
    try:
        value = reader.query(sql)
        return {
            "name": name,
            "status": "OK",
            "durationMs": round((time.monotonic() - started) * 1000),
            "value": value,
        }
    except (AuditError, subprocess.TimeoutExpired) as exc:
        return {
            "name": name,
            "status": "ERROR",
            "durationMs": round((time.monotonic() - started) * 1000),
            "error": sanitize_error(str(exc)),
        }


def isolate_source_endpoint_readiness(
    reader: PsqlReader, process_codes: list[str]
) -> dict[str, Any]:
    """Probe SOURCE readiness independently so one process cannot hide peers."""
    started = time.monotonic()

    def one(process_code: str) -> tuple[str, dict[str, Any]]:
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,79}", process_code):
            return process_code, {
                "name": f"sourceEndpointReadiness[{process_code}]",
                "status": "ERROR",
                "durationMs": 0,
                "error": "invalid canonical process code returned by database",
            }
        return process_code, probe(
            reader,
            f"sourceEndpointReadiness[{process_code}]",
            "SELECT public.framework_source_canonical_endpoint_readiness("
            f"5000,{sql_literal(process_code)}::varchar)",
        )

    rows: list[tuple[str, dict[str, Any]]] = []
    if process_codes:
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=min(4, len(process_codes))
        ) as pool:
            rows = list(pool.map(one, process_codes))
    rows.sort(key=lambda item: item[0])
    successful = [item for _, item in rows if item["status"] == "OK"]
    failed = [item for _, item in rows if item["status"] != "OK"]
    values = [item.get("value") for item in successful]
    processes = []
    for process_code, item in rows:
        value = item.get("value") if isinstance(item.get("value"), dict) else {}
        process = {
            "processCode": process_code,
            "probeStatus": item["status"],
            "durationMs": item["durationMs"],
        }
        if item["status"] == "OK":
            process.update(
                {
                    "readinessStatus": value.get("status"),
                    "totalCount": int(value.get("totalCount") or 0),
                    "sourceReadyCount": int(value.get("sourceReadyCount") or 0),
                    "blockerCount": int(value.get("blockerCount") or 0),
                    "reasonCounts": value.get("reasonCounts") or {},
                }
            )
        else:
            process["error"] = item.get("error") or "probe failed"
        processes.append(process)
    return {
        "name": "sourceEndpointReadinessIsolation",
        "status": "OK",
        "durationMs": round((time.monotonic() - started) * 1000),
        "value": {
            "schema": "carbonet.source-endpoint-readiness-isolation/v1",
            "mode": "INDEPENDENT_PROCESS_PROBES",
            "processCount": len(rows),
            "successfulProbeCount": len(successful),
            "failedProbeCount": len(failed),
            "totalCount": sum(int((value or {}).get("totalCount") or 0) for value in values),
            "sourceReadyCount": sum(
                int((value or {}).get("sourceReadyCount") or 0) for value in values
            ),
            "blockerCount": sum(
                int((value or {}).get("blockerCount") or 0) for value in values
            ),
            "processes": processes,
        },
    }


def git(root: Path, args: list[str], *, check: bool = True) -> str:
    return run(["git", *args], cwd=root, check=check, timeout=90).stdout


def git_text(root: Path, path: str) -> str:
    result = run(
        ["git", "show", f"HEAD:{path}"], cwd=root, check=False, timeout=90
    )
    return result.stdout if result.returncode == 0 else ""


def git_paths(root: Path, prefix: str) -> list[str]:
    return [
        item
        for item in git(root, ["ls-tree", "-r", "--name-only", "HEAD", prefix]).splitlines()
        if item.strip()
    ]


def json_from_repo(root: Path, path: str, default: Any) -> Any:
    local = root / path
    raw = local.read_text(encoding="utf-8") if local.is_file() else git_text(root, path)
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def grep_git(root: Path, pattern: str, prefixes: Iterable[str]) -> list[str]:
    result = run(
        ["git", "grep", "-h", "-o", "-E", pattern, "HEAD", "--", *prefixes],
        cwd=root,
        check=False,
        timeout=120,
    )
    if result.returncode not in (0, 1):
        raise AuditError(sanitize_error(result.stderr))
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def count_support_entries(source: str) -> int:
    match = re.search(
        r"GENERATED_SCREEN_SUPPORT_CATALOG[^=]*=\s*\[(.*?)\];",
        source,
        flags=re.DOTALL,
    )
    if not match:
        return 0
    return len(re.findall(r"\bpageId\s*:", match.group(1)))


def repository_ledger(root: Path) -> dict[str, Any]:
    head = git(root, ["rev-parse", "HEAD"]).strip()
    route_prefix = "projects/carbonet-frontend/source/src/app/routes"
    family_prefix = f"{route_prefix}/families"
    generated_prefix = (
        "projects/carbonet-frontend/source/src/generated/screen-generation"
    )
    endpoint_prefix = (
        "projects/carbonet-backend-metadata/process-runtime/generated-endpoints"
    )
    route_files = git_paths(root, route_prefix)
    ko_matches = grep_git(root, r'koPath: "[^"]+"', [family_prefix])
    canonical_routes = sorted(
        {match[len('koPath: "') : -1].split("?", 1)[0].lower() for match in ko_matches}
    )

    verification = json_from_repo(
        root,
        "projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json",
        {},
    )
    verification_summary = verification.get("summary", {}) if isinstance(verification, dict) else {}
    closure = json_from_repo(
        root, f"{generated_prefix}/generatedScreenDefinitionClosure.json", {}
    )
    declared_definitions = int(
        ((closure.get("definitions") or {}).get("count") or 0)
        if isinstance(closure, dict)
        else 0
    )
    generated_paths = git_paths(root, generated_prefix)
    tracked_definitions = sum("/definitions/" in path for path in generated_paths)
    materialized_definition_root = root / generated_prefix / "definitions"
    materialized_definitions = (
        sum(1 for item in materialized_definition_root.rglob("*.ts") if item.is_file())
        if materialized_definition_root.is_dir()
        else 0
    )
    catalog = git_text(root, f"{generated_prefix}/generatedScreenCatalog.ts")
    if not catalog:
        catalog_file = root / generated_prefix / "generatedScreenCatalog.ts"
        catalog = catalog_file.read_text(encoding="utf-8") if catalog_file.is_file() else ""
    catalog_imports = len(re.findall(r'from\s+"\./definitions/', catalog))
    support = git_text(root, f"{generated_prefix}/generatedScreenSupportCatalog.ts")
    if not support:
        support_file = root / generated_prefix / "generatedScreenSupportCatalog.ts"
        support = support_file.read_text(encoding="utf-8") if support_file.is_file() else ""

    component_catalog = json_from_repo(
        root,
        "projects/carbonet-frontend/source/src/generated/systemComponentCatalog.json",
        [],
    )
    component_count = len(component_catalog) if isinstance(component_catalog, list) else 0
    css = git_text(root, "projects/carbonet-frontend/source/src/styles.css")
    if not css:
        css_path = root / "projects/carbonet-frontend/source/src/styles.css"
        css = css_path.read_text(encoding="utf-8") if css_path.is_file() else ""
    krds_tokens = sorted(set(re.findall(r"--krds-[a-z0-9-]+", css, flags=re.I)))
    sdui_files = run(
        [
            "git",
            "grep",
            "-l",
            "-i",
            "-E",
            r"\bSDUI\b|JSON[ _-]?FORM",
            "HEAD",
            "--",
            "projects/carbonet-frontend/source",
            "platform/control-plane/backstage",
        ],
        cwd=root,
        check=False,
        timeout=120,
    )
    sdui_reference_files = (
        len([line for line in sdui_files.stdout.splitlines() if line.strip()])
        if sdui_files.returncode in (0, 1)
        else 0
    )

    endpoint_paths = git_paths(root, endpoint_prefix)
    manifests = [path for path in endpoint_paths if path.endswith("/manifest.json")]
    endpoint_java = [path for path in endpoint_paths if path.endswith(".java")]
    artifact_count = 0
    manifest_errors: list[str] = []
    process_codes: set[str] = set()
    for manifest_path in manifests:
        parts = manifest_path[len(endpoint_prefix) :].strip("/").split("/")
        if parts:
            process_codes.add(parts[0])
        try:
            manifest = json.loads(git_text(root, manifest_path))
            artifacts = manifest.get("artifacts", [])
            if isinstance(artifacts, list):
                artifact_count += len(artifacts)
            else:
                manifest_errors.append(f"{manifest_path}:artifacts-not-array")
        except (json.JSONDecodeError, AttributeError):
            manifest_errors.append(f"{manifest_path}:invalid-json")

    # WSL fixture runs against a Windows worktree and may spend minutes asking
    # Git to stat every file. Production audits keep the dirty-path evidence;
    # the isolated fixture can explicitly skip only this repository diagnostic.
    dirty = []
    if os.environ.get("PAGE_IMPACT_SKIP_DIRTY_SCAN") != "1":
        dirty = [
            line
            for line in git(
                root, ["status", "--porcelain", "--untracked-files=no"], check=True
            ).splitlines()
            if line.strip()
        ]
    return {
        "commit": head,
        "dirtyPathCountAtAudit": len(dirty),
        "frontend": {
            "canonicalKoRouteCount": len(canonical_routes),
            "routeSourceFileCount": len(route_files),
            "pageManifestCount": int(verification_summary.get("pageCount") or 0),
            "routeBoundPageManifestCount": int(
                verification_summary.get("routeBoundPageCount") or 0
            ),
            "generatedCatalogImportCount": catalog_imports,
            "declaredGeneratedDefinitionCount": declared_definitions,
            "trackedGeneratedDefinitionCount": tracked_definitions,
            "materializedGeneratedDefinitionCount": materialized_definitions,
            "generatedSupportEntryCount": count_support_entries(support),
        },
        "endpointCode": {
            "processDirectoryCount": len(process_codes),
            "manifestCount": len(manifests),
            "artifactCount": artifact_count,
            "javaSourceCount": len(endpoint_java),
            "manifestErrorCount": len(manifest_errors),
            "manifestErrors": manifest_errors[:20],
        },
        "designSystem": {
            "krdsCssTokenCount": len(krds_tokens),
            "sduiReferenceFileCount": sdui_reference_files,
            "systemComponentCatalogCount": component_count,
        },
    }


def nested(value: Any, path: str, default: Any = None) -> Any:
    current = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def probe_value(probes: dict[str, dict[str, Any]], name: str) -> Any:
    item = probes.get(name, {})
    return item.get("value") if item.get("status") == "OK" else None


def build_blockers(
    core: dict[str, Any] | None,
    probes: dict[str, dict[str, Any]],
    repository: dict[str, Any],
) -> list[dict[str, Any]]:
    blockers: list[dict[str, Any]] = []

    def add(code: str, count: int | None, source: str, detail: str) -> None:
        if count is None or count > 0:
            blockers.append(
                {"code": code, "count": count, "source": source, "detail": detail}
            )

    if core is None:
        add("DB_CORE_UNAVAILABLE", None, "database", "core page-impact query failed")
    else:
        add(
            "PROFESSIONAL_CONTRACT_MISSING",
            int(nested(core, "professionalContract.missingRequiredIdentities", 0)),
            "database",
            "required exact identities with no professional contract",
        )
        add(
            "PROFESSIONAL_CONTRACT_DUPLICATE",
            int(nested(core, "professionalContract.duplicateRequiredIdentityGroups", 0)),
            "database",
            "required exact identities with multiple professional contracts",
        )
        add(
            "BLUEPRINT_MISSING",
            int(nested(core, "blueprint.missingRequiredIdentities", 0)),
            "database",
            "required exact identities with no VALID blueprint",
        )
        add(
            "BLUEPRINT_AUTHORITY_AMBIGUOUS",
            int(nested(core, "blueprint.duplicateAmbiguous", 0)),
            "database",
            "duplicate VALID blueprint identities without one exact authority",
        )
        add(
            "SCREEN_CONTRACT_INCOMPLETE",
            int(nested(core, "quality.incompleteExactIdentities", 0)),
            "database",
            "exact identities not closed across contract lanes and blueprint authority",
        )

    for name in (
        "canonicalBlueprintAuthority",
        "sourceDesignCatalog",
        "endpointFunctionInventory",
        "sourceEndpointReadiness",
        "sourceEndpointProcessList",
        "sourceEndpointReadinessIsolation",
        "globalEndpointReadiness",
        "sourceEndpointCatalog",
        "designCausalityStatus",
        "commonAssetCoverage",
        "assetImpact",
    ):
        item = probes.get(name)
        if item and item.get("status") != "OK":
            add(
                f"{name.upper()}_ERROR",
                None,
                "database-probe",
                str(item.get("error") or "probe failed"),
            )

    frontend = repository["frontend"]
    definition_gap = max(
        int(frontend["declaredGeneratedDefinitionCount"])
        - int(frontend["trackedGeneratedDefinitionCount"]),
        0,
    )
    add(
        "GENERATED_SCREEN_DEFINITION_CLOSURE_GAP",
        definition_gap,
        "repository",
        "closure declaration is larger than tracked generated definitions",
    )
    expected_endpoints = int(nested(core or {}, "endpoint.expectedScreenIdentities", 0))
    generated_endpoints = int(repository["endpointCode"]["artifactCount"])
    add(
        "GENERATED_ENDPOINT_CODE_GAP",
        max(expected_endpoints - generated_endpoints, 0),
        "database+repository",
        "expected endpoint screen identities exceed tracked generated endpoint artifacts",
    )
    add(
        "COMMON_COMPONENT_CATALOG_EMPTY",
        1 if int(repository["designSystem"]["systemComponentCatalogCount"]) == 0 else 0,
        "repository",
        "tracked system component catalog has no reusable components",
    )
    common = probe_value(probes, "commonAssetCoverage")
    if isinstance(common, dict):
        add(
            "COMMON_ASSET_CLOSURE_GAP",
            int(common.get("missingPageCount") or 0),
            "database",
            "active manifest pages without exact common theme/section/component/class closure",
        )
    isolation = probe_value(probes, "sourceEndpointReadinessIsolation")
    if isinstance(isolation, dict):
        add(
            "SOURCE_ENDPOINT_PROCESS_PROBE_FAILURE",
            int(isolation.get("failedProbeCount") or 0)
            + int(isolation.get("omittedProcessCount") or 0),
            "database-probe",
            "SOURCE readiness processes that failed or exceeded the isolation budget",
        )
    return blockers


def run_audit(args: argparse.Namespace) -> dict[str, Any]:
    started = time.monotonic()
    root = Path(args.repo_root).resolve()
    if not (root / ".git").exists():
        # Linked worktrees use a .git file, regular repositories use a directory.
        if not (root / ".git").is_file():
            raise AuditError(f"not a git worktree: {root}")

    repository = repository_ledger(root)
    core: dict[str, Any] | None = None
    core_probe: dict[str, Any]
    probes: dict[str, dict[str, Any]] = {}
    if args.db_core_json:
        core = json.loads(Path(args.db_core_json).read_text(encoding="utf-8"))
        core_probe = {"status": "OK", "source": "file"}
    elif args.skip_db:
        core_probe = {"status": "SKIPPED"}
    else:
        command = json.loads(args.psql_command_json) if args.psql_command_json else None
        if command is not None and (
            not isinstance(command, list) or not all(isinstance(item, str) for item in command)
        ):
            raise AuditError("--psql-command-json must be a JSON string array")
        reader = PsqlReader(
            root=root,
            dsn=args.dsn,
            command=command,
            timeout_ms=args.statement_timeout_ms,
        )
        core_result = probe(
            reader,
            "dbCore",
            render_core_sql(CORE_SQL.read_text(encoding="utf-8"), args),
        )
        core_probe = core_result
        if core_result["status"] == "OK" and isinstance(core_result.get("value"), dict):
            core = core_result["value"]

        probes["canonicalBlueprintAuthority"] = probe(
            reader,
            "canonicalBlueprintAuthority",
            """
            SELECT coalesce((
              SELECT jsonb_build_object(
                'status','RESOLVED','contractId',contract.contract_id,
                'blueprintId',public.framework_canonical_blueprint_authority(
                  upper(contract.process_code)::varchar,
                  upper(contract.step_code)::varchar,
                  upper(contract.audience)::varchar,
                  lower(split_part(contract.route_path,'?',1))::varchar,
                  contract.contract_id
                )
              )
              FROM public.framework_professional_screen_contract contract
              WHERE contract.route_path ~ '^/'
              ORDER BY contract.contract_id LIMIT 1
            ),jsonb_build_object('status','NO_CONTRACT'))
            """,
        )
        probes["sourceDesignCatalog"] = probe(
            reader,
            "sourceDesignCatalog",
            """
            SELECT coalesce((
              SELECT jsonb_build_object(
                'schema',catalog->>'schema','processCode',source.process_code,
                'screenCount',(catalog->>'screenCount')::integer,
                'catalogHash',catalog->>'catalogHash'
              )
              FROM (
                SELECT upper(process_code)::varchar AS process_code
                FROM public.framework_screen_blueprint
                WHERE validation_status='VALID'
                ORDER BY upper(process_code) LIMIT 1
              ) source
              CROSS JOIN LATERAL public.framework_source_canonical_design_catalog(
                5000,source.process_code
              ) catalog
            ),jsonb_build_object('status','NO_VALID_BLUEPRINT'))
            """,
        )
        probes["endpointFunctionInventory"] = probe(
            reader,
            "endpointFunctionInventory",
            """
            SELECT jsonb_build_object(
              'sourceReadiness',to_regprocedure(
                'public.framework_source_canonical_endpoint_readiness(integer,character varying)'
              ) IS NOT NULL,
              'sourceCatalog',to_regprocedure(
                'public.framework_source_canonical_endpoint_catalog(integer,character varying)'
              ) IS NOT NULL,
              'globalReadinessOneArg',to_regprocedure(
                'public.framework_canonical_endpoint_readiness(integer)'
              ) IS NOT NULL,
              'globalReadinessTwoArg',to_regprocedure(
                'public.framework_canonical_endpoint_readiness(integer,character varying)'
              ) IS NOT NULL
            )
            """,
        )
        endpoint_inventory = probe_value(probes, "endpointFunctionInventory") or {}
        probes["sourceEndpointReadiness"] = probe(
            reader,
            "sourceEndpointReadiness",
            """
            WITH process_source AS MATERIALIZED (
              SELECT DISTINCT upper(process_code)::varchar AS process_code
              FROM public.framework_screen_blueprint
              WHERE validation_status='VALID'
                AND nullif(btrim(process_code),'') IS NOT NULL
            ), readiness AS MATERIALIZED (
              SELECT source.process_code,
                     public.framework_source_canonical_endpoint_readiness(
                       5000,source.process_code
                     ) AS value
              FROM process_source source
            )
            SELECT jsonb_build_object(
              'schema','carbonet.source-endpoint-readiness-by-process/v1',
              'mode','DISTINCT_NON_NULL_PROCESS_AGGREGATE',
              'processCount',count(*)::integer,
              'completeProcessCount',count(*) FILTER(
                WHERE value->>'status'='COMPLETE')::integer,
              'partialProcessCount',count(*) FILTER(
                WHERE value->>'status'='PARTIAL')::integer,
              'otherStatusProcessCount',count(*) FILTER(
                WHERE coalesce(value->>'status','') NOT IN ('COMPLETE','PARTIAL'))::integer,
              'totalCount',coalesce(sum(coalesce((value->>'totalCount')::integer,0)),0)::integer,
              'sourceReadyCount',coalesce(sum(
                coalesce((value->>'sourceReadyCount')::integer,0)),0)::integer,
              'blockerCount',coalesce(sum(
                coalesce((value->>'blockerCount')::integer,0)),0)::integer,
              'processes',coalesce(jsonb_agg(jsonb_build_object(
                'processCode',process_code,'status',value->>'status',
                'totalCount',coalesce((value->>'totalCount')::integer,0),
                'sourceReadyCount',coalesce((value->>'sourceReadyCount')::integer,0),
                'blockerCount',coalesce((value->>'blockerCount')::integer,0),
                'reasonCounts',coalesce(value->'reasonCounts','{}'::jsonb)
              ) ORDER BY process_code),'[]'::jsonb)
            )
            FROM readiness
            """,
        )
        if (
            probes["sourceEndpointReadiness"]["status"] == "ERROR"
            and endpoint_inventory.get("sourceReadiness") is True
        ):
            probes["sourceEndpointProcessList"] = probe(
                reader,
                "sourceEndpointProcessList",
                """
                SELECT coalesce(jsonb_agg(process_code ORDER BY process_code),'[]'::jsonb)
                FROM (
                  SELECT DISTINCT upper(process_code) AS process_code
                  FROM public.framework_screen_blueprint
                  WHERE validation_status='VALID'
                    AND upper(process_code)~'^[A-Z][A-Z0-9_]{1,79}$'
                ) source
                """,
            )
            process_codes = probe_value(probes, "sourceEndpointProcessList")
            if isinstance(process_codes, list):
                isolation_limit = 64
                isolation_reader = PsqlReader(
                    root=root,
                    dsn=args.dsn,
                    command=command,
                    timeout_ms=min(args.statement_timeout_ms, 5000),
                )
                isolation = isolate_source_endpoint_readiness(
                    isolation_reader,
                    [str(code) for code in process_codes[:isolation_limit]],
                )
                isolation["value"]["totalProcessCount"] = len(process_codes)
                isolation["value"]["isolationProcessLimit"] = isolation_limit
                isolation["value"]["omittedProcessCount"] = max(
                    len(process_codes) - isolation_limit, 0
                )
                probes["sourceEndpointReadinessIsolation"] = isolation
        # This global API is an independent fallback/evidence path: if one
        # SOURCE process fails, the global result is still reported instead of
        # being hidden by the process aggregation error.
        global_readiness_sql = (
            "SELECT public.framework_canonical_endpoint_readiness(5000)"
            if endpoint_inventory.get("globalReadinessOneArg") is True
            else "SELECT public.framework_canonical_endpoint_readiness(5000,NULL::varchar)"
        )
        probes["globalEndpointReadiness"] = probe(
            reader,
            "globalEndpointReadiness",
            global_readiness_sql,
        )
        probes["sourceEndpointCatalog"] = probe(
            reader,
            "sourceEndpointCatalog",
            """
            SELECT jsonb_build_object(
              'schema',catalog->>'schema',
              'catalogHash',catalog->>'catalogHash',
              'endpointCount',jsonb_array_length(catalog->'endpoints')
            )
            FROM (
              SELECT public.framework_source_canonical_endpoint_catalog(
                5000,NULL::varchar
              ) AS catalog
            ) source
            """,
        )
        probes["designCausalityStatus"] = probe(
            reader,
            "designCausalityStatus",
            "SELECT public.framework_design_causality_status()",
        )
        probes["commonAssetCoverage"] = probe(
            reader,
            "commonAssetCoverage",
            """
            SELECT jsonb_build_object(
              'activePageCount',count(*)::integer,
              'readyPageCount',count(*) FILTER(WHERE common_assets_ready)::integer,
              'missingPageCount',count(*) FILTER(WHERE NOT common_assets_ready)::integer
            )
            FROM public.framework_common_design_asset_coverage
            """,
        )
        if args.asset_type:
            probes["assetImpact"] = probe(
                reader,
                "assetImpact",
                asset_impact_sql(args),
            )

    blockers = build_blockers(core, probes, repository)
    source_endpoint = probe_value(probes, "sourceEndpointCatalog")
    source_readiness = probe_value(probes, "sourceEndpointReadiness")
    if source_readiness is None:
        source_readiness = probe_value(probes, "sourceEndpointReadinessIsolation")
    global_readiness = probe_value(probes, "globalEndpointReadiness")
    causality = probe_value(probes, "designCausalityStatus")
    common_assets = probe_value(probes, "commonAssetCoverage")
    asset_impact = probe_value(probes, "assetImpact")
    actual_ms = round((time.monotonic() - started) * 1000)
    core_mutation = nested(core or {}, "designMutationImpact", {})
    if args.asset_type:
        affected = (
            int(asset_impact.get("affectedExactIdentityCount") or 0)
            if isinstance(asset_impact, dict)
            else None
        )
        mutation = {
            **core_mutation,
            "scope": "ASSET_DEPENDENCY_DAG",
            "assetSelector": {
                "assetType": args.asset_type,
                "assetId": args.asset_id,
            },
            "assetFanout": asset_impact,
        }
    elif any((args.process_code, args.step_code, args.audience, args.route_path)):
        affected = (
            int(core_mutation.get("selectorMatchedExactIdentityCount") or 0)
            if isinstance(core_mutation, dict) and core is not None
            else None
        )
        mutation = dict(core_mutation)
    else:
        affected = (
            int(core_mutation.get("compilerAffectedExactIdentityCount") or 0)
            if isinstance(core_mutation, dict) and core is not None
            else None
        )
        mutation = dict(core_mutation)
    expected_screens = int(nested(core or {}, "endpoint.expectedScreenIdentities", 0) or 0)
    return {
        "schema": SCHEMA,
        "generatedAt": utc_now(),
        "status": "COMPLETE" if not blockers else "INCOMPLETE",
        "readOnly": {
            "databaseTransaction": True,
            "repository": True,
            "databaseWrites": 0,
            "liveFileWrites": 0,
            "databaseStatementTimeoutMs": args.statement_timeout_ms,
            "databaseLockTimeoutMs": 5000,
        },
        "sources": {
            "database": {"label": args.db_label, "core": core_probe},
            "repository": {
                "root": ".",
                "commit": repository["commit"],
            },
        },
        "routeTotals": nested(core or {}, "routeTotals", {}),
        "exactIdentities": {
            "identityContract": nested(core or {}, "identityContract", {}),
            "stepScreens": nested(core or {}, "stepScreens", {}),
            "screenResource": nested(core or {}, "screenResource", {}),
            "professionalContract": nested(core or {}, "professionalContract", {}),
            "blueprint": nested(core or {}, "blueprint", {}),
            "strategy": nested(core or {}, "strategy", {}),
            "source": nested(core or {}, "source", {}),
            "quality": nested(core or {}, "quality", {}),
        },
        "endpoint": {
            "expectedScreenIdentities": expected_screens,
            "expectedOperationCount": int(
                nested(core or {}, "endpoint.expectedOperationCount", 0) or 0
            ),
            "sourceReadiness": source_readiness,
            "globalReadiness": global_readiness,
            "catalog": source_endpoint,
            "codeGenerated": repository["endpointCode"],
        },
        "frontend": repository["frontend"],
        "designSystem": {
            "databaseIdentityCoverage": nested(core or {}, "designSystem", {}),
            "commonAssetCoverage": common_assets,
            "repository": repository["designSystem"],
        },
        "designMutationImpact": {
            **mutation,
            "authoritativeAffectedExactIdentityCount": affected,
            "pendingDirtySignalCount": nested(causality or {}, "dirtySignalCount", None),
        },
        "probes": probes,
        "blockers": {
            "kindCount": len(blockers),
            "affectedExactIdentityCount": int(
                nested(core or {}, "quality.incompleteExactIdentities", 0) or 0
            ),
            "items": blockers,
        },
        "reviewBudget": {
            "targetMs": 600_000,
            "actualMs": actual_ms,
            "withinTenMinutes": actual_ms < 600_000,
        },
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--dsn")
    parser.add_argument(
        "--psql-command-json",
        help="JSON argv array for a stdin-reading, tuple-only psql-compatible command",
    )
    parser.add_argument("--db-core-json")
    parser.add_argument("--skip-db", action="store_true")
    parser.add_argument("--db-label", default="unspecified-read-only-postgresql")
    parser.add_argument("--statement-timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS)
    parser.add_argument("--process-code")
    parser.add_argument("--step-code")
    parser.add_argument("--audience", choices=("USER", "ADMIN", "user", "admin"))
    parser.add_argument("--route-path")
    parser.add_argument(
        "--asset-type",
        choices=(
            "THEME", "SECTION", "COMPONENT", "SCREEN",
            "theme", "section", "component", "screen",
        ),
    )
    parser.add_argument("--asset-id")
    parser.add_argument("--output", help="write machine JSON to this local path")
    args = parser.parse_args(argv)
    for name in ("process_code", "step_code", "audience"):
        value = getattr(args, name)
        setattr(args, name, value.strip().upper() if value and value.strip() else None)
    if args.route_path:
        args.route_path = args.route_path.strip().split("?", 1)[0].lower()
        if not args.route_path.startswith("/"):
            parser.error("--route-path must start with /")
    if args.asset_type:
        args.asset_type = args.asset_type.upper()
    if args.asset_id:
        args.asset_id = args.asset_id.strip() or None
    if bool(args.asset_type) != bool(args.asset_id):
        parser.error("--asset-type and --asset-id must be provided together")
    if args.statement_timeout_ms < 1000 or args.statement_timeout_ms > 540_000:
        parser.error("--statement-timeout-ms must be between 1000 and 540000")
    if not args.skip_db and not args.db_core_json:
        if bool(args.dsn) == bool(args.psql_command_json):
            parser.error(
                "provide exactly one of --dsn or --psql-command-json unless --skip-db is used"
            )
    if args.db_core_json and any(
        (args.process_code, args.step_code, args.audience, args.route_path, args.asset_type)
    ):
        parser.error("selectors require a live read-only database query, not --db-core-json")
    return args


def main(argv: list[str]) -> int:
    try:
        args = parse_args(argv)
        ledger = run_audit(args)
        payload = json.dumps(ledger, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        if args.output:
            destination = Path(args.output)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(payload, encoding="utf-8", newline="\n")
        else:
            sys.stdout.write(payload)
        return 0
    except (AuditError, OSError, json.JSONDecodeError, subprocess.TimeoutExpired) as exc:
        sys.stderr.write(f"PAGE_IMPACT_AUDIT_FAIL {sanitize_error(str(exc))}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
