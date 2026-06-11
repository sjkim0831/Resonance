"""Carbonet DB-backed AI task orchestration helpers for Hermes.

This module keeps Hermes small-model friendly: first classify and decompose a
request, then create a compact 40B handoff prompt, and optionally persist the
task packet into Carbonet's AI orchestration tables.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import textwrap
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_PROJECT_ID = "carbonet"
DEFAULT_DB_URL = "jdbc:cubrid:172.16.1.232:33000:carbonet:::?charset=UTF-8"
DEFAULT_DB_USER = "dba"
DEFAULT_JDBC_JAR = str(Path.home() / ".m2/repository/cubrid/cubrid-jdbc/11.2.0.0035/cubrid-jdbc-11.2.0.0035.jar")

WORKFLOWS: dict[str, dict[str, Any]] = {
    "ROUTE_NOT_VISIBLE": {
        "risk": "MEDIUM",
        "keywords": ["does not show", "안보임", "페이지 안뜸", "route", "bootstrap", "hard refresh"],
        "steps": [
            ("route_probe", "route-checker", "Call the exact route and capture status, redirect, and first response lines."),
            ("pattern_search", "pattern-finder", "Find matching React route, bootstrap binding, menu metadata, and a similar working page."),
            ("freshness_verify", "route-checker", "Verify jar, pid, port, startup marker, and changed route freshness."),
            ("handoff", "executor-40b", "Prepare the 40B repair packet with allowed changes and required verification."),
        ],
        "verify": ["curl_exact_route", "freshness_verify", "startup_marker"],
    },
    "DB_MAPPER_ERROR": {
        "risk": "HIGH",
        "keywords": ["mapper", "column", "sql", "cubrid", "테이블", "컬럼", "디비", "db"],
        "steps": [
            ("db_schema_probe", "db-scout", "Inspect related tables, columns, indexes, constraints, and row-count-safe samples."),
            ("log_classify", "log-watcher", "Extract failing SQL, stack trace, exception class, and repeated error signature."),
            ("pattern_search", "pattern-finder", "Trace controller, service, mapper XML, table, and similar working implementation."),
            ("handoff", "executor-40b", "Prepare the 40B repair packet with DB evidence and schema-change guardrails."),
        ],
        "verify": ["failing_sql_or_stacktrace", "table_column_evidence", "targeted_api_or_route_check"],
    },
    "BUILD_RUNTIME_FRESHNESS": {
        "risk": "HIGH",
        "keywords": ["compile", "package", "restart", "18000", "freshness", "stale jar", "stale asset", "빌드", "재시작"],
        "steps": [
            ("build_package", "executor-40b", "Run the governed build/package path or prepare the exact commands."),
            ("runtime_verify", "route-checker", "Verify runtime jar match, pid, port, marker, health, and route response."),
            ("log_classify", "log-watcher", "Collect startup and verification logs and classify any failure."),
            ("reflection", "pattern-finder", "Record freshness lesson and next action for repeated failures."),
        ],
        "verify": ["jar_match", "pid_alive", "port_18000_listening", "startup_marker", "health_or_route_response"],
    },
    "GENERAL_ENGINEERING": {
        "risk": "MEDIUM",
        "keywords": [],
        "steps": [
            ("context_search", "pattern-finder", "Find the smallest relevant code, docs, DB, and script surfaces."),
            ("evidence_collect", "log-watcher", "Collect errors, logs, or current behavior evidence before editing."),
            ("handoff", "executor-40b", "Prepare a narrow implementation packet with success conditions."),
            ("verification", "route-checker", "Run the smallest proof that the change works."),
        ],
        "verify": ["targeted_test_or_command", "change_summary", "reflection"],
    },
}


@dataclass
class StepPacket:
    step_id: str
    step_order: int
    step_type: str
    agent_role_code: str
    model_class: str
    instruction: str


@dataclass
class TaskPacket:
    task_id: str
    project_id: str
    task_type: str
    target_route: str
    target_module: str
    risk_level: str
    confidence_score: float
    user_request: str
    success_conditions: list[str]
    steps: list[StepPacket]
    handoff_prompt: str


def classify_request(user_request: str) -> tuple[str, float]:
    text = user_request.lower()
    best_type = "GENERAL_ENGINEERING"
    best_score = 0
    for task_type, workflow in WORKFLOWS.items():
        score = sum(1 for keyword in workflow["keywords"] if keyword.lower() in text)
        if score > best_score:
            best_type = task_type
            best_score = score
    confidence = 0.62 if best_type == "GENERAL_ENGINEERING" else min(0.95, 0.72 + best_score * 0.07)
    return best_type, confidence


def extract_target_route(user_request: str) -> str:
    match = re.search(r"(?<!:)\/(?:admin|en|api|home|emission|edu|monitoring|signin)[^\s,`'\"]*", user_request)
    return match.group(0) if match else ""


def extract_target_module(user_request: str, target_route: str) -> str:
    if target_route.startswith("/admin/emission") or "emission" in user_request.lower():
        return "admin-emission"
    if "codex" in user_request.lower() or "hermes" in user_request.lower():
        return "ai-orchestration"
    if target_route:
        parts = [p for p in target_route.split("/") if p]
        return "-".join(parts[:2]) if parts else ""
    return ""


def build_packet(user_request: str, project_id: str = DEFAULT_PROJECT_ID) -> TaskPacket:
    task_type, confidence = classify_request(user_request)
    workflow = WORKFLOWS[task_type]
    target_route = extract_target_route(user_request)
    target_module = extract_target_module(user_request, target_route)
    task_id = "ait-" + uuid.uuid4().hex[:20]
    steps = [
        StepPacket(
            step_id="ais-" + uuid.uuid4().hex[:20],
            step_order=index + 1,
            step_type=step_type,
            agent_role_code=role,
            model_class="FORTY_B" if role == "executor-40b" else "TINY",
            instruction=instruction,
        )
        for index, (step_type, role, instruction) in enumerate(workflow["steps"])
    ]
    handoff_prompt = build_handoff_prompt(
        user_request=user_request,
        task_type=task_type,
        risk_level=workflow["risk"],
        target_route=target_route,
        target_module=target_module,
        success_conditions=workflow["verify"],
        steps=steps,
    )
    return TaskPacket(
        task_id=task_id,
        project_id=project_id,
        task_type=task_type,
        target_route=target_route,
        target_module=target_module,
        risk_level=workflow["risk"],
        confidence_score=confidence,
        user_request=user_request,
        success_conditions=list(workflow["verify"]),
        steps=steps,
        handoff_prompt=handoff_prompt,
    )


def build_handoff_prompt(
    *,
    user_request: str,
    task_type: str,
    risk_level: str,
    target_route: str,
    target_module: str,
    success_conditions: list[str],
    steps: list[StepPacket],
) -> str:
    step_lines = "\n".join(
        f"- {step.step_order}. {step.step_type} via {step.agent_role_code}: {step.instruction}"
        for step in steps
    )
    success_lines = "\n".join(f"- {item}" for item in success_conditions)
    return textwrap.dedent(
        f"""
        Carbonet AI task handoff for 40B executor

        User request:
        {user_request}

        Classification:
        - taskType: {task_type}
        - riskLevel: {risk_level}
        - targetRoute: {target_route or "-"}
        - targetModule: {target_module or "-"}

        Tiny-agent evidence loop:
        {step_lines}

        Guardrails:
        - Prefer Carbonet project patterns, skills, docs, and existing mapper/service/controller routes.
        - Do not mutate business data unless the task explicitly allows it.
        - Treat DB schema changes, auth changes, and calculation logic changes as high-risk.
        - Record evidence before claiming success.

        Required proof:
        {success_lines}

        Return:
        - changed files or commands
        - reason for each change
        - verification output summary
        - reflection: missing context, reusable lesson, next action
        """
    ).strip()


def packet_to_json(packet: TaskPacket) -> str:
    data = asdict(packet)
    return json.dumps(data, ensure_ascii=False, indent=2)


def _sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def _insert_sql(packet: TaskPacket) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    success_json = json.dumps(packet.success_conditions, ensure_ascii=False)
    step_payload = json.dumps([asdict(step) for step in packet.steps], ensure_ascii=False)
    lines = [
        "INSERT INTO ai_task (task_id, project_id, trace_id, user_request, task_type, target_route, target_module, status, risk_level, confidence_score, owner_model, assigned_role_code, success_condition_json, context_summary, requested_by, frst_regist_pnttm, last_updt_pnttm)",
        "VALUES ("
        + ", ".join(
            [
                _sql_string(packet.task_id),
                _sql_string(packet.project_id),
                _sql_string(packet.task_id),
                _sql_string(packet.user_request),
                _sql_string(packet.task_type),
                _sql_string(packet.target_route),
                _sql_string(packet.target_module),
                _sql_string("PLANNED"),
                _sql_string(packet.risk_level),
                str(packet.confidence_score),
                _sql_string("qwen-40b"),
                _sql_string("executor-40b"),
                _sql_string(success_json),
                _sql_string(step_payload),
                _sql_string("hermes"),
                _sql_string(now),
                _sql_string(now),
            ]
        )
        + ");",
    ]
    for step in packet.steps:
        lines.extend(
            [
                "INSERT INTO ai_task_step (step_id, task_id, step_order, step_type, agent_role_code, model_class, instruction, status, confidence_score, frst_regist_pnttm, last_updt_pnttm)",
                "VALUES ("
                + ", ".join(
                    [
                        _sql_string(step.step_id),
                        _sql_string(packet.task_id),
                        str(step.step_order),
                        _sql_string(step.step_type),
                        _sql_string(step.agent_role_code),
                        _sql_string(step.model_class),
                        _sql_string(step.instruction),
                        _sql_string("PENDING"),
                        "0",
                        _sql_string(now),
                        _sql_string(now),
                    ]
                )
                + ");",
            ]
        )
    lines.extend(
        [
            "INSERT INTO ai_task_evidence (evidence_id, task_id, evidence_type, source_type, source_ref, summary, raw_payload, confidence_score, collected_by, frst_regist_pnttm)",
            "VALUES ("
            + ", ".join(
                [
                    _sql_string("aie-" + uuid.uuid4().hex[:20]),
                    _sql_string(packet.task_id),
                    _sql_string("TASK_CLASSIFICATION"),
                    _sql_string("HERMES"),
                    _sql_string("carbonet_orchestrator"),
                    _sql_string(f"Classified as {packet.task_type} with confidence {packet.confidence_score:.2f}."),
                    _sql_string(packet_to_json(packet)),
                    str(packet.confidence_score),
                    _sql_string("hermes"),
                    _sql_string(now),
                ]
            )
            + ");",
            "INSERT INTO ai_task_handoff (handoff_id, task_id, receiver_model, receiver_role_code, prompt, context_summary, required_output_json, allowed_change_json, status, token_budget, created_by, frst_regist_pnttm, last_updt_pnttm)",
            "VALUES ("
            + ", ".join(
                [
                    _sql_string("aih-" + uuid.uuid4().hex[:20]),
                    _sql_string(packet.task_id),
                    _sql_string("qwen-40b"),
                    _sql_string("executor-40b"),
                    _sql_string(packet.handoff_prompt),
                    _sql_string(packet_to_json(packet)),
                    _sql_string(json.dumps(["changed files", "change reasons", "verification output", "reflection"], ensure_ascii=False)),
                    _sql_string(json.dumps(["controlled code edit", "read-only db probe", "verification scripts"], ensure_ascii=False)),
                    _sql_string("READY"),
                    "12000",
                    _sql_string("hermes"),
                    _sql_string(now),
                    _sql_string(now),
                ]
            )
            + ");",
        ]
    )
    return "\n".join(lines) + "\n"


def persist_packet_with_csql(packet: TaskPacket, csql_command: str | None = None) -> None:
    command = csql_command or os.getenv(
        "CARBONET_CSQL_COMMAND",
        "/opt/util/cubrid/11.2/scripts/csql_local.sh -u dba carbonet",
    )
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as tmp:
        tmp.write(_insert_sql(packet))
        tmp_path = tmp.name
    try:
        completed = subprocess.run(
            f"{command} < {tmp_path}",
            shell=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
        if completed.returncode != 0:
            raise RuntimeError((completed.stderr or completed.stdout).strip())
    finally:
        Path(tmp_path).unlink(missing_ok=True)


JAVA_SQL_APPLY_SOURCE = r"""
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class HermesCarbonetJdbcApply {
    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            throw new IllegalArgumentException("Usage: HermesCarbonetJdbcApply <url> <user> <password> <sqlFile>");
        }
        Class.forName("cubrid.jdbc.driver.CUBRIDDriver");
        String sql = Files.readString(Path.of(args[3]), StandardCharsets.UTF_8);
        List<String> statements = splitStatements(sql);
        int applied = 0;
        try (Connection connection = DriverManager.getConnection(args[0], args[1], args[2]);
             Statement statement = connection.createStatement()) {
            for (String item : statements) {
                String normalized = item.trim();
                if (normalized.isEmpty()) {
                    continue;
                }
                statement.execute(normalized);
                applied++;
            }
        }
        System.out.println("APPLIED statements=" + applied);
    }

    private static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inSingleQuote = false;
        boolean lineComment = false;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';
            if (lineComment) {
                if (ch == '\n') {
                    lineComment = false;
                    current.append(ch);
                }
                continue;
            }
            if (!inSingleQuote && ch == '-' && next == '-') {
                lineComment = true;
                i++;
                continue;
            }
            if (ch == '\'') {
                if (inSingleQuote && next == '\'') {
                    current.append(ch).append(next);
                    i++;
                    continue;
                }
                inSingleQuote = !inSingleQuote;
            }
            if (!inSingleQuote && ch == ';') {
                statements.add(current.toString());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        if (!current.toString().trim().isEmpty()) {
            statements.add(current.toString());
        }
        return statements;
    }
}
"""


def persist_packet_with_jdbc(
    packet: TaskPacket,
    *,
    db_url: str,
    db_user: str,
    db_password: str,
    jdbc_jar: str,
) -> None:
    jar_path = Path(jdbc_jar).expanduser()
    if not jar_path.exists():
        raise RuntimeError(f"CUBRID JDBC jar not found: {jar_path}")
    with tempfile.TemporaryDirectory(prefix="hermes-carbonet-") as tmp_dir:
        tmp = Path(tmp_dir)
        sql_file = tmp / "packet.sql"
        java_file = tmp / "HermesCarbonetJdbcApply.java"
        sql_file.write_text(_insert_sql(packet), encoding="utf-8")
        java_file.write_text(JAVA_SQL_APPLY_SOURCE, encoding="utf-8")
        subprocess.run(["javac", "-cp", str(jar_path), str(java_file)], check=True, timeout=60)
        completed = subprocess.run(
            [
                "java",
                "-cp",
                f"{tmp}:{jar_path}",
                "HermesCarbonetJdbcApply",
                db_url,
                db_user,
                db_password,
                str(sql_file),
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
        if completed.returncode != 0:
            raise RuntimeError((completed.stderr or completed.stdout).strip())


def cmd_carbonet(args: argparse.Namespace) -> None:
    request = " ".join(args.request or []).strip()
    if not request:
        raise SystemExit("request is required. Example: hermes carbonet plan 'mapper column error on /admin/emission/management'")
    packet = build_packet(request, project_id=args.project_id)
    if args.format == "json":
        print(packet_to_json(packet))
    else:
        print(packet.handoff_prompt if args.handoff else _human_summary(packet))
    if args.apply_db:
        if args.csql_command:
            persist_packet_with_csql(packet, args.csql_command)
        else:
            persist_packet_with_jdbc(
                packet,
                db_url=args.db_url,
                db_user=args.db_user,
                db_password=args.db_password,
                jdbc_jar=args.jdbc_jar,
            )
        print(f"\nDB_APPLIED task_id={packet.task_id}")


def _human_summary(packet: TaskPacket) -> str:
    lines = [
        f"task_id: {packet.task_id}",
        f"project_id: {packet.project_id}",
        f"task_type: {packet.task_type}",
        f"risk_level: {packet.risk_level}",
        f"confidence: {packet.confidence_score:.2f}",
        f"target_route: {packet.target_route or '-'}",
        f"target_module: {packet.target_module or '-'}",
        "",
        "steps:",
    ]
    for step in packet.steps:
        lines.append(f"  {step.step_order}. {step.step_type} [{step.agent_role_code}/{step.model_class}]")
        lines.append(f"     {step.instruction}")
    lines.extend(["", "required_proof:"])
    lines.extend(f"  - {item}" for item in packet.success_conditions)
    return "\n".join(lines)


def register_carbonet_parser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "carbonet",
        help="Carbonet AI task orchestration packet generator",
        description="Classify a Carbonet request, generate tiny-agent steps, and produce a compact 40B handoff packet.",
    )
    parser.add_argument(
        "request",
        nargs=argparse.REMAINDER,
        help="User request to classify and decompose",
    )
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID)
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--handoff", action="store_true", help="Print only the 40B handoff prompt")
    parser.add_argument("--apply-db", action="store_true", help="Persist task, steps, evidence, and handoff into Carbonet DB")
    parser.add_argument("--csql-command", default=None, help="Override csql command used with --apply-db")
    parser.add_argument("--db-url", default=os.getenv("CARBONET_AI_DB_URL", DEFAULT_DB_URL))
    parser.add_argument("--db-user", default=os.getenv("CARBONET_AI_DB_USER", DEFAULT_DB_USER))
    parser.add_argument("--db-password", default=os.getenv("CARBONET_AI_DB_PASSWORD", ""))
    parser.add_argument("--jdbc-jar", default=os.getenv("CARBONET_CUBRID_JDBC_JAR", DEFAULT_JDBC_JAR))
    parser.set_defaults(func=cmd_carbonet)
