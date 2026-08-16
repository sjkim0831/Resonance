#!/usr/bin/env python3
"""Compile explicit approved design schema changes into validated Flyway migrations."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
TYPE = re.compile(
    r"^(?:uuid|bigint|bigserial|integer|boolean|text|jsonb|date|timestamp|timestamptz|"
    r"varchar\([1-9][0-9]{0,4}\)|numeric\([1-9][0-9]?,[0-9]{1,2}\))$"
)
DEFAULT = re.compile(
    r"^(?:CURRENT_TIMESTAMP|CURRENT_DATE|gen_random_uuid\(\)|true|false|-?[0-9]+(?:\.[0-9]+)?|'[^']{0,200}')$",
    re.I,
)
ON_DELETE = {"CASCADE", "RESTRICT", "SET NULL", "NO ACTION"}


class ContractError(ValueError):
    pass


def identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
        raise ContractError(f"{label} must match {IDENTIFIER.pattern}: {value!r}")
    return value


def sql_type(value: Any) -> str:
    if not isinstance(value, str) or not TYPE.fullmatch(value.lower()):
        raise ContractError(f"unsupported column type: {value!r}")
    return value.lower()


def render_column(column: dict[str, Any]) -> str:
    name = identifier(column.get("name"), "column name")
    parts = [name, sql_type(column.get("type"))]
    if column.get("primaryKey") is True:
        parts.append("PRIMARY KEY")
    if column.get("nullable") is False:
        parts.append("NOT NULL")
    if "default" in column:
        default = str(column["default"])
        if not DEFAULT.fullmatch(default):
            raise ContractError(f"unsupported default for {name}: {default!r}")
        parts.extend(["DEFAULT", default])
    reference = column.get("references")
    if reference is not None:
        if not isinstance(reference, dict):
            raise ContractError(f"references for {name} must be an object")
        table = identifier(reference.get("table"), "reference table")
        target = identifier(reference.get("column"), "reference column")
        parts.extend(["REFERENCES", f"{table}({target})"])
        on_delete = reference.get("onDelete")
        if on_delete is not None:
            normalized = str(on_delete).upper()
            if normalized not in ON_DELETE:
                raise ContractError(f"unsupported onDelete for {name}: {on_delete!r}")
            parts.extend(["ON DELETE", normalized])
    return " ".join(parts)


def render_change(change: dict[str, Any]) -> str:
    if change.get("operation") != "CREATE_TABLE":
        raise ContractError(f"only CREATE_TABLE is safe for automatic generation: {change.get('operation')!r}")
    table = identifier(change.get("tableName"), "table name")
    columns = change.get("columns")
    if not isinstance(columns, list) or not columns:
        raise ContractError(f"{table}: columns must be a non-empty array")
    names = [identifier(column.get("name"), "column name") for column in columns if isinstance(column, dict)]
    if len(names) != len(columns) or len(set(names)) != len(names):
        raise ContractError(f"{table}: column entries must be objects with unique names")
    definitions = ["  " + render_column(column) for column in columns]
    for unique in change.get("uniqueConstraints", []):
        if not isinstance(unique, list) or not unique:
            raise ContractError(f"{table}: unique constraint must be a non-empty column array")
        values = [identifier(value, "unique column") for value in unique]
        if not set(values).issubset(names):
            raise ContractError(f"{table}: unique constraint references an unknown column")
        definitions.append("  UNIQUE (" + ", ".join(values) + ")")
    statements = [f"CREATE TABLE {table} (\n" + ",\n".join(definitions) + "\n);"]
    for index in change.get("indexes", []):
        if not isinstance(index, dict):
            raise ContractError(f"{table}: index must be an object")
        index_name = identifier(index.get("name"), "index name")
        values = [identifier(value, "index column") for value in index.get("columns", [])]
        if not values or not set(values).issubset(names):
            raise ContractError(f"{table}: index {index_name} has unknown or empty columns")
        unique = "UNIQUE " if index.get("unique") is True else ""
        statements.append(f"CREATE {unique}INDEX {index_name} ON {table} (" + ", ".join(values) + ");")
    return "\n".join(statements)


def java_quote(value: str) -> str:
    if any(0xD800 <= ord(item) <= 0xDFFF for item in value):
        raise ContractError("unpaired surrogate is forbidden")
    return '"' + value.encode("utf-8").hex() + '"'


def java_stable(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict):
        return "{" + ",".join(
            java_quote(str(key)) + ":" + java_stable(value[key])
            for key in sorted(value, key=lambda item: str(item).encode(
                "utf-16-be", "surrogatepass"))
        ) + "}"
    if isinstance(value, list):
        return "[" + ",".join(java_stable(item) for item in value) + "]"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            raise ContractError("non-finite number")
        return "@" + struct.pack(">d", 0.0 if number == 0 else number).hex()
    if isinstance(value, str):
        return java_quote(value)
    raise ContractError("non-JSON value")


def stable_hash(changes: list[dict[str, Any]]) -> str:
    return hashlib.sha256(java_stable(changes).encode()).hexdigest()


def existing_table_hashes(root: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    migration_dir = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql"
    pattern = re.compile(
        r"^COMMENT ON TABLE ([a-z][a-z0-9_]*) IS 'design-schema-hash:([0-9a-f]{64})';$", re.M)
    for path in sorted(migration_dir.glob("V*__*.sql")):
        for table, digest in pattern.findall(path.read_text(encoding="utf-8")):
            previous = result.get(table)
            if previous is not None and previous != digest:
                raise ContractError(f"contradictory table schema markers: {table}")
            result[table] = digest
    return result


def table_local_hashes(changes: list[dict[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    for change in changes:
        render_change(change)
        table = identifier(change.get("tableName"), "table name")
        if table in result:
            raise ContractError(f"duplicate table schema change: {table}")
        result[table] = stable_hash([change])
    return result


def render_migration_body(package_name: str, all_changes: list[dict[str, Any]],
                          emitted_changes: list[dict[str, Any]] | None = None) -> str:
    table_local_hashes(all_changes)
    emitted = all_changes if emitted_changes is None else emitted_changes
    local = table_local_hashes(emitted)
    rendered = "\n\n".join(render_change(change) for change in emitted)
    markers = "\n".join(
        f"COMMENT ON TABLE {table} IS 'design-schema-hash:{local[table]}';"
        for table in sorted(local)
    )
    return (f"-- design-package-schema-set-hash: {stable_hash(all_changes)}\n"
            f"-- design-package: {package_name}\n\n{rendered}\n\n{markers}\n")


def incremental_changes(changes: list[dict[str, Any]], existing_tables_set: set[str],
                        existing_markers: dict[str, str]) -> tuple[dict[str, str], list[dict[str, Any]]]:
    requested = table_local_hashes(changes)
    marker_conflicts = sorted(
        table for table, local_hash in requested.items()
        if table in existing_markers and existing_markers[table] != local_hash)
    legacy_conflicts = sorted(
        table for table in requested if table in existing_tables_set and table not in existing_markers)
    if marker_conflicts:
        raise ContractError("table schema marker mismatch: " + ",".join(marker_conflicts))
    if legacy_conflicts:
        raise ContractError("table already exists: " + ",".join(legacy_conflicts))
    return requested, [change for change in changes
                       if str(change["tableName"]) not in existing_markers]


def existing_tables(root: Path) -> set[str]:
    result: set[str] = set()
    migration_dir = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql"
    for path in migration_dir.glob("V*__*.sql"):
        sql = re.sub(r"/\*.*?\*/|--[^\n]*", " ", path.read_text(encoding="utf-8"), flags=re.S)
        result.update(
            match.lower()
            for match in re.findall(r"(?is)\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z][a-z0-9_]*)", sql)
        )
    return result


def name_part(value: Any) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).lower()).strip("_")
    if not normalized:
        raise ContractError(f"empty process/step code: {value!r}")
    return normalized[:80]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packages", type=Path, help="generated package directory or one package JSON")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="validate and report without writing migrations")
    parser.add_argument("--render-sql", type=Path,
                        help="render one validated package to SQL without registering a migration")
    args = parser.parse_args()
    paths = [args.packages] if args.packages.is_file() else sorted(args.packages.glob("*.json"))
    paths = [path for path in paths if path.name != "index.json"]
    if args.render_sql is not None and (args.check or len(paths) != 1):
        parser.error("--render-sql requires exactly one package and cannot be combined with --check")
    table_hashes = existing_table_hashes(args.root)
    tables = existing_tables(args.root)
    generated = rendered = skipped = legacy = review = 0
    plans = []
    for path in paths:
        package = json.loads(path.read_text(encoding="utf-8"))
        database = package.get("database") or {}
        auto = database.get("autoGenerateMigration") is True
        changes = database.get("schemaChanges")
        if not auto:
            legacy += 1
            continue
        if not isinstance(changes, list) or not changes:
            review += 1
            plans.append({"package": path.name, "status": "REVIEW_REQUIRED", "reason": "schemaChanges is empty"})
            continue
        try:
            requested, missing = incremental_changes(changes, tables, table_hashes)
        except ContractError as exc:
            review += 1
            plans.append({"package": path.name, "status": "REVIEW_REQUIRED", "reason": str(exc)})
            continue
        digest = stable_hash(changes)
        if not missing:
            skipped += 1
            plans.append({"package": path.name, "status": "UNCHANGED", "hash": digest})
            continue
        process = name_part(package["process"]["code"])
        step = name_part(package["step"]["code"])
        body = render_migration_body(path.name, changes, missing)
        status = "VALIDATED" if args.check else "RENDERED" if args.render_sql is not None else "GENERATED"
        plans.append({"package": path.name, "status": status, "hash": digest})
        if args.render_sql is not None:
            args.render_sql.write_text(body, encoding="utf-8")
            rendered += 1
        elif not args.check:
            with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
                handle.write(body)
                temporary = Path(handle.name)
            try:
                completed = subprocess.run(
                    [sys.executable, str(args.root / "ops/scripts/create-safe-additive-migration.py"),
                     "--name", f"design {process} {step}", "--input", str(temporary)],
                    cwd=args.root, check=False, capture_output=True, text=True,
                )
                if completed.returncode != 0:
                    raise ContractError("safe migration registration failed: "
                                        + (completed.stdout or completed.stderr).strip())
            finally:
                temporary.unlink(missing_ok=True)
            generated += 1
        for table in requested:
            if table not in table_hashes:
                table_hashes[table] = requested[table]
        tables.update(requested)
    result = {"success": review == 0, "packages": len(paths), "generated": generated,
              "rendered": rendered,
              "unchanged": skipped, "legacySkipped": legacy, "reviewRequired": review, "plans": plans}
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0 if review == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
