#!/usr/bin/env python3
"""Collect one deterministic Carbonet design snapshot from live contracts and source."""

from __future__ import annotations

import argparse
import csv
import io
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NS = "carbonet-prod"
DB = "carbonet"


def run(args: list[str], timeout: int = 120) -> str:
    proc = subprocess.run(args, cwd=ROOT, text=True, encoding="utf-8", errors="replace",
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if proc.returncode:
        raise SystemExit(f"[design-snapshot] command failed: {' '.join(args)}\n{proc.stderr[-1200:]}")
    return proc.stdout


def leader(namespace: str) -> str:
    pods = run(["kubectl", "-n", namespace, "get", "pods", "-l", "app=postgres-patroni",
                "-o", "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"]).splitlines()
    for pod in pods:
        state = subprocess.run(
            ["kubectl", "-n", namespace, "exec", pod, "-c", "patroni", "--", "psql",
             "-h", "127.0.0.1", "-U", "postgres", "-d", DB, "-Atqc", "select pg_is_in_recovery()"],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        ).stdout.strip()
        if state == "f":
            return pod
    raise SystemExit("[design-snapshot] writable PostgreSQL leader not found")


def query(pod: str, namespace: str, database: str, sql: str) -> list[dict[str, str]]:
    proc = subprocess.run(
        ["kubectl", "-n", namespace, "exec", "-i", pod, "-c", "patroni", "--",
         "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", database,
         "--csv", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
        cwd=ROOT, input=sql, text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
    )
    if proc.returncode:
        raise SystemExit(f"[design-snapshot] SQL failed: {proc.stderr[-1200:]}")
    return list(csv.DictReader(io.StringIO(proc.stdout)))


def rg_lines(paths: list[str], expression: str, globs: list[str] | None = None) -> list[str]:
    args = ["rg", "-n", "--no-heading"]
    for glob in globs or []:
        args.extend(["-g", glob])
    args.extend([expression, *paths])
    proc = subprocess.run(args, cwd=ROOT, text=True, encoding="utf-8", errors="replace",
                          stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=180)
    return sorted(proc.stdout.splitlines()) if proc.returncode in (0, 1) else []


def rg_files(paths: list[str], expression: str) -> list[str]:
    proc = subprocess.run(["rg", "--files", *paths], cwd=ROOT, text=True, encoding="utf-8",
                          errors="replace", stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=180)
    values = []
    import re
    rx = re.compile(expression, re.I)
    for line in proc.stdout.splitlines():
        if rx.search(line):
            values.append(line)
    return sorted(values)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--namespace", default=NS)
    parser.add_argument("--database", default=DB)
    args = parser.parse_args()
    pod = leader(args.namespace)
    snap: dict[str, object] = {
        "schema_version": "3.0.0",
        "captured_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "host": "172.16.1.232", "namespace": args.namespace, "database": args.database,
        "postgres_leader": pod,
    }
    snap["database_summary"] = query(pod, args.namespace, args.database, """
      select current_database() database,
       (select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')) table_count,
       (select count(*) from information_schema.columns where table_schema not in ('pg_catalog','information_schema')) column_count,
       (select count(*) from pg_indexes where schemaname not in ('pg_catalog','information_schema')) index_count,
       (select count(*) from information_schema.table_constraints where constraint_schema not in ('pg_catalog','information_schema')) constraint_count;
    """)[0]
    snap["tables"] = query(pod, args.namespace, args.database, """
      select t.table_schema,t.table_name,t.table_type,coalesce(c.reltuples::bigint,0) estimated_rows,
             coalesce(obj_description(c.oid),'') description
      from information_schema.tables t left join pg_namespace n on n.nspname=t.table_schema
      left join pg_class c on c.relnamespace=n.oid and c.relname=t.table_name
      where t.table_schema not in ('pg_catalog','information_schema') order by 1,2;
    """)
    snap["columns"] = query(pod, args.namespace, args.database, """
      select c.table_schema,c.table_name,c.ordinal_position,c.column_name,c.data_type,
       coalesce(c.character_maximum_length::text,'') max_length,c.is_nullable,
       coalesce(c.column_default,'') column_default,coalesce(col_description(pc.oid,c.ordinal_position),'') description
      from information_schema.columns c left join pg_namespace pn on pn.nspname=c.table_schema
      left join pg_class pc on pc.relnamespace=pn.oid and pc.relname=c.table_name
      where c.table_schema not in ('pg_catalog','information_schema') order by 1,2,3;
    """)
    snap["constraints"] = query(pod, args.namespace, args.database, """
      select tc.constraint_schema,tc.table_name,tc.constraint_name,tc.constraint_type,
       coalesce(string_agg(kcu.column_name,',' order by kcu.ordinal_position),'') columns,
       coalesce(ccu.table_schema||'.'||ccu.table_name,'') referenced_table,coalesce(ccu.column_name,'') referenced_column
      from information_schema.table_constraints tc
      left join information_schema.key_column_usage kcu on tc.constraint_schema=kcu.constraint_schema and tc.constraint_name=kcu.constraint_name
      left join information_schema.constraint_column_usage ccu on tc.constraint_schema=ccu.constraint_schema and tc.constraint_name=ccu.constraint_name
      where tc.constraint_schema not in ('pg_catalog','information_schema')
      group by tc.constraint_schema,tc.table_name,tc.constraint_name,tc.constraint_type,ccu.table_schema,ccu.table_name,ccu.column_name
      order by 1,2,4,3;
    """)
    snap["indexes"] = query(pod, args.namespace, args.database, """
      select schemaname table_schema,tablename table_name,indexname index_name,indexdef
      from pg_indexes where schemaname not in ('pg_catalog','information_schema') order by 1,2,3;
    """)
    table_names = {row["table_name"] for row in snap["tables"]}
    contract_table = "framework_professional_screen_contract"
    snap["screen_quality"] = []
    snap["screen_contracts"] = query(pod, args.namespace, args.database,
        f"select row_to_json(x)::text row_json from {contract_table} x order by route_path,contract_id;") if contract_table in table_names else []
    contracts = [json.loads(x["row_json"]) for x in snap["screen_contracts"]]
    snap["screen_counts"] = {"quality_rows": 0, "quality_routes": 0,
        "contract_rows": len(contracts), "contract_routes": len({x.get('route_path') for x in contracts})}
    selected = ["framework_process_definition", "framework_process_step", "framework_process_flow_edge",
      "framework_process_professional_scenario", "framework_business_process_sequence", "framework_process_data_handoff",
      "framework_process_professional_readiness", "framework_actor_process_menu_coverage", "framework_task_contract",
      "framework_task_definition", "comtnroleinfo", "msatnroleinfo", "msatnroles_hierarchy",
      "comtnauthorrolerelate", "msatnauthorrolerelate"]
    snap["asset_rows"] = {}
    for name in selected:
        if name in table_names:
            rows = query(pod, args.namespace, args.database, f"select row_to_json(x)::text row_json from {name} x;")
            snap["asset_rows"][name] = sorted(rows, key=lambda row: row["row_json"])
    snap["candidate_tables"] = [{"table_schema": t["table_schema"], "table_name": t["table_name"], "asset_type": "DISCOVERED"}
        for t in snap["tables"] if any(k in t["table_name"].lower() for k in ("screen","process","task","role","authority","permission","test","scenario","rule","requirement","workflow"))]
    roots = ["apps", "modules", "projects", "frontend", "ops"]
    snap["api_mappings"] = rg_lines(roots, r"@(Get|Post|Put|Patch|Delete|Request)Mapping\b", ["*.java", "!**/target/**"])
    snap["frontend_route_lines"] = rg_lines(["projects/carbonet-frontend/source/src", "projects/carbonet-frontend/source/scripts"], r"path\s*[:=]|<Route|routePath", ["*.js", "*.jsx", "*.ts", "*.tsx", "!node_modules/**"])
    snap["test_files"] = rg_files(roots, r"(^|/)(test|tests|__tests__|e2e|cypress|playwright)|(_test|Test|\.spec\.|\.test\.)")
    snap["migration_files"] = rg_files(["apps", "modules", "projects", "db", "ops"], r"(migration|changelog).*\.(sql|xml|ya?ml)$")
    snap["process_files"] = rg_files(roots, r"(bpmn|process|workflow|task)")
    snap["report_files"] = rg_files(["var/reports", "var/verification", "projects/carbonet-frontend/source"], r"(screen|gate|quality).*\.json$")
    snap["k8s_resources"] = sorted(run(["kubectl", "-n", args.namespace, "get", "deploy,statefulset,service,cronjob", "-o", "name"]).splitlines())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"snapshot": str(args.out), "contracts": len(contracts), "routes": snap["screen_counts"]["contract_routes"],
                      "tables": len(snap["tables"]), "columns": len(snap["columns"]), "apiMappings": len(snap["api_mappings"]),
                      "tests": len(snap["test_files"])}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
