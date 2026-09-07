#!/usr/bin/env python3
"""Authenticated P006 scenario JSON store and side-effect-free authz lookup."""

import base64
import hashlib
import json
import os
import subprocess
import sys


NS = "carbonet-prod"
SCENARIO_ID = "00000000-0000-0000-0000-000000000606"
SCENARIO_ROLES = {"PROJECT_ADMIN", "SIMULATION_OPERATOR"}
SCENARIO_PERMISSIONS = {"SIMULATION_RUN"}
DEFAULT = {
    "scenarioName": "기본 생산 시나리오",
    "inputPerHour": 120,
    "processes": [
        {"code": code, "dwellSeconds": seconds, "defectRate": rate}
        for code, seconds, rate in [
            ("melting_furnace", 45, 0.2),
            ("holding_furnace", 30, 0.1),
            ("casting_machine", 12, 1.2),
            ("spray_ladler", 8, 0.1),
            ("release_agent", 6, 0.1),
            ("vacuum_unit", 10, 0.4),
            ("mold_cooling", 25, 0.2),
            ("cooling_unit", 40, 0.2),
            ("takeout_robot", 8, 0.1),
            ("trimming_machine", 18, 0.6),
            ("punching_press", 15, 0.5),
            ("casting_filter", 8, 0.3),
            ("turntable_furnace", 30, 0.1),
            ("ladler", 10, 0.1),
            ("robot_panel", 5, 0.1),
            ("main_panel", 5, 0.1),
        ]
    ],
}
_CREDENTIALS = None


class AuthenticationRequired(PermissionError):
    pass


class AuthorizationDenied(PermissionError):
    pass


def cmd(args, input=None):
    return subprocess.check_output(args, input=input, text=True).strip()


def credentials():
    global _CREDENTIALS
    if _CREDENTIALS is not None:
        return _CREDENTIALS
    username = cmd([
        "kubectl", "-n", NS, "get", "secret", "p006-runtime-secret",
        "-o", "jsonpath={.data.DB_USERNAME}",
    ])
    password = cmd([
        "kubectl", "-n", NS, "get", "secret", "p006-runtime-secret",
        "-o", "jsonpath={.data.DB_PASSWORD}",
    ])
    _CREDENTIALS = base64.b64decode(username).decode(), base64.b64decode(password).decode()
    return _CREDENTIALS


def sql(query):
    username, password = credentials()
    return cmd([
        "kubectl", "-n", NS, "exec", "-i", "postgres-patroni-0", "--",
        "env", f"PGPASSWORD={password}", "psql", "-Atq", "-h", "postgres-haproxy",
        "-U", username, "-d", "woosu_digital_twin",
    ], query)


def csv_set(value):
    return {item.strip() for item in str(value or "").split(",") if item.strip()}


def actor_for_session(token):
    if not token:
        raise AuthenticationRequired("valid P006 session required")
    digest = hashlib.sha256(token.encode()).hexdigest()
    raw = sql(f"""
      select json_build_object(
        'accountId',a.account_id,
        'loginId',a.login_id,
        'displayName',a.display_name,
        'roles',coalesce((select json_agg(q.role_code order by q.role_code) from (select distinct role_code from dt_account_role where account_id=a.account_id) q),'[]'::json),
        'permissions',coalesce((select json_agg(q.permission_code order by q.permission_code) from (select distinct rp.permission_code from dt_account_role ar join dt_role_permission rp on rp.role_code=ar.role_code where ar.account_id=a.account_id) q),'[]'::json)
      )::text
      from dt_project_session s
      join dt_project_account a on a.account_id=s.account_id
      where s.session_hash='{digest}'
        and s.expires_at>current_timestamp
        and a.status='ACTIVE'
      limit 1
    """)
    if not raw:
        raise AuthenticationRequired("valid P006 session required")
    return json.loads(raw)


def authorize(required_roles=None, required_permissions=None):
    actor = actor_for_session(os.environ.get("P006_SESSION_TOKEN", ""))
    roles = set(actor.get("roles") or [])
    permissions = set(actor.get("permissions") or [])
    required_roles = set(required_roles or [])
    required_permissions = set(required_permissions or [])
    if required_roles and not roles.intersection(required_roles):
        raise AuthorizationDenied("PROJECT_ADMIN 또는 SIMULATION_OPERATOR 역할이 필요합니다.")
    missing_permissions = sorted(required_permissions.difference(permissions))
    if missing_permissions:
        raise AuthorizationDenied("필수 권한이 없습니다: " + ", ".join(missing_permissions))
    return actor


def metrics(config):
    total = sum(float(process["dwellSeconds"]) for process in config["processes"])
    yield_rate = 1
    for process in config["processes"]:
        yield_rate *= 1 - float(process["defectRate"]) / 100
    input_rate = float(config["inputPerHour"])
    return {
        "cycleSeconds": round(total, 2),
        "inputPerHour": input_rate,
        "goodUnitsPerHour": round(input_rate * yield_rate, 2),
        "defectRate": round((1 - yield_rate) * 100, 3),
        "yieldRate": round(yield_rate * 100, 3),
        "bottleneck": max(config["processes"], key=lambda process: float(process["dwellSeconds"]))["code"],
    }


def scenario(mode):
    actor = authorize(SCENARIO_ROLES, SCENARIO_PERMISSIONS)
    scene = sql("select scene_id from dt_scene order by created_at limit 1")
    if mode == "save":
        config = json.load(sys.stdin)
        config["metrics"] = metrics(config)
        payload = json.dumps(config, ensure_ascii=False).replace("'", "''")
        name = str(config.get("scenarioName", "기본 생산 시나리오")).replace("'", "''")
        sql(
            "insert into dt_simulation_scenario(scenario_id,scene_id,scenario_name,parameters_json,status) "
            f"values ('{SCENARIO_ID}','{scene}','{name}','{payload}'::jsonb,'ACTIVE') "
            "on conflict(scenario_id) do update set scenario_name=excluded.scenario_name,"
            "parameters_json=excluded.parameters_json,status='ACTIVE'"
        )
    row = sql(f"select parameters_json::text from dt_simulation_scenario where scenario_id='{SCENARIO_ID}'")
    if not row:
        config = DEFAULT
        config["metrics"] = metrics(config)
        payload = json.dumps(config, ensure_ascii=False).replace("'", "''")
        sql(
            "insert into dt_simulation_scenario(scenario_id,scene_id,scenario_name,parameters_json,status) "
            f"values ('{SCENARIO_ID}','{scene}','기본 생산 시나리오','{payload}'::jsonb,'ACTIVE')"
        )
        row = json.dumps(config, ensure_ascii=False)
    print(row)
    return actor


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "get"
    try:
        if mode == "authz":
            actor = authorize(
                csv_set(sys.argv[2] if len(sys.argv) > 2 else ""),
                csv_set(sys.argv[3] if len(sys.argv) > 3 else ""),
            )
            print(json.dumps({"status": "AUTHORIZED", "authenticated": True, "actor": actor}, ensure_ascii=False))
        elif mode in {"get", "save"}:
            scenario(mode)
        else:
            raise ValueError("mode must be authz, get, or save")
    except AuthenticationRequired as error:
        print(json.dumps({"status": "AUTH_REQUIRED", "authenticated": False, "message": str(error)}, ensure_ascii=False))
        raise SystemExit(4)
    except AuthorizationDenied as error:
        print(json.dumps({"status": "FORBIDDEN", "authenticated": True, "message": str(error)}, ensure_ascii=False))
        raise SystemExit(3)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "INVALID", "message": str(error)}, ensure_ascii=False))
        raise SystemExit(2)


if __name__ == "__main__":
    main()
