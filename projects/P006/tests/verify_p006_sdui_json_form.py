#!/usr/bin/env python3
"""P006 SDUI JSON Form page/process verification with rollback.

Order: PAGE -> ACTOR -> SCREEN -> FUNCTION -> INPUT -> DATABASE_OUTPUT
       -> RELOAD_RESTORE -> VISUAL_QA.
"""

from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request

import bcrypt
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = "http://127.0.0.1:5174"
TARGET_PATH = "/projects/P006/digital-twin/sdui-scenario-form"
SCENARIO_ID = "00000000-0000-0000-0000-000000000606"
USD_SYNC_FILES = [
    Path("/home/sjkim/OmniverseProjects/p006_safe_layout.usda"),
    Path("/home/sjkim/OmniverseProjects/p006_stream_focus.usda"),
    Path("/home/sjkim/OmniverseProjects/p006_factory_stream.usda"),
]
TEST_CONTRACT_PATH = Path("/opt/Resonance/projects/P006/frontend/screens/p006-scenario-form.process-test.json")
TEST_CONTRACT = json.loads(TEST_CONTRACT_PATH.read_text())
ACTOR_CONTRACTS = {item["role"]: item for item in TEST_CONTRACT["actors"]}
ACTORS = {role: item["uiExpected"] for role, item in ACTOR_CONTRACTS.items()}
EXPECTED = {
    "runtime": "p006-sdui-json-form-v1",
    "screenId": TEST_CONTRACT["screenId"],
    "pageId": TEST_CONTRACT["page"]["pageId"],
    "menuCode": TEST_CONTRACT["page"]["menuCode"],
    "editableFields": TEST_CONTRACT["input"]["editableFieldCount"],
    "processRows": TEST_CONTRACT["input"]["processRowCount"],
    "metrics": 6,
    "processSteps": 5,
    "supportCards": 6,
}
EVIDENCE_ROOT = Path(os.environ.get(
    "P006_SDUI_EVIDENCE_DIR",
    "/opt/resonance-data/test-evidence/p006-sdui-json-form",
))
SCENARIO_STORE = Path("/opt/Resonance/projects/P006/runtime/scenario_store.py")
sys.path.insert(0, str(SCENARIO_STORE.parent))
from scenario_store import sql  # noqa: E402


class VerificationFailure(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationFailure(message)


def elapsed_ms(start: float) -> int:
    return round((time.monotonic() - start) * 1000)


def http_json(path: str, *, token: str | None = None, cookie_header: str | None = None,
              method: str = "GET", payload=None, timeout=180, extra_headers=None):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
    }
    if cookie_header is not None:
        headers["Cookie"] = cookie_header
    elif token is not None:
        headers["Cookie"] = f"P006_SESSION={token}"
    headers.update(extra_headers or {})
    request = urllib.request.Request(
        BASE_URL + path,
        data=body,
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode()
            return response.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = {"raw": raw[-1000:]}
        return exc.code, detail


def create_actor_sessions(run_key: str, sessions: dict):
    password_hash = bcrypt.hashpw(secrets.token_urlsafe(24).encode(), bcrypt.gensalt()).decode()
    for index, role in enumerate(ACTORS, start=1):
        short = role.lower().replace("simulation_", "sim_").replace("factory_", "factory_")
        account_id = f"qa_sdui_{run_key}_{index}"
        login_id = f"qa-sdui-{run_key}-{short}"[:80]
        display_name = f"SDUI QA {role}"
        token = secrets.token_urlsafe(36)
        digest = hashlib.sha256(token.encode()).hexdigest()
        sql(
            "insert into dt_project_account(account_id,login_id,password_hash,display_name,status) "
            f"values('{account_id}','{login_id}','{password_hash}','{display_name}','ACTIVE')"
        )
        sql(f"insert into dt_account_role(account_id,role_code) values('{account_id}','{role}')")
        sql(
            "insert into dt_project_session(session_hash,account_id,expires_at) "
            f"values('{digest}','{account_id}',current_timestamp+interval '45 minutes')"
        )
        sessions[role] = {"accountId": account_id, "loginId": login_id, "token": token}
    return sessions


def cleanup_actor_sessions(sessions) -> list[str]:
    warnings = []
    for actor in sessions.values():
        account_id = actor["accountId"]
        for query in [
            f"delete from dt_project_session where account_id='{account_id}'",
            f"delete from dt_equipment_worker_profile where account_id='{account_id}' or fallback_account_id='{account_id}'",
            f"delete from dt_account_role where account_id='{account_id}'",
            f"delete from dt_project_account where account_id='{account_id}'",
        ]:
            try:
                sql(query)
            except Exception as exc:  # cleanup should continue across all actors
                warnings.append(f"{account_id}: {type(exc).__name__}: {exc}")
    return warnings


def qa_residue(sessions) -> dict:
    account_ids = [actor["accountId"].replace("'", "''") for actor in sessions.values()]
    if not account_ids:
        return {"accounts": 0, "roles": 0, "sessions": 0, "total": 0}
    values = ",".join(f"'{account_id}'" for account_id in account_ids)
    counts = {
        "accounts": int(sql(f"select count(*) from dt_project_account where account_id in ({values})") or 0),
        "roles": int(sql(f"select count(*) from dt_account_role where account_id in ({values})") or 0),
        "sessions": int(sql(f"select count(*) from dt_project_session where account_id in ({values})") or 0),
    }
    counts["total"] = sum(counts.values())
    return counts


def database_record():
    raw = sql(
        "select json_build_object('scenarioNameColumn',scenario_name,'parameters',parameters_json,"
        "'status',status,'createdAt',created_at)::text from dt_simulation_scenario "
        f"where scenario_id='{SCENARIO_ID}'"
    )
    require(bool(raw), "active scenario row is missing")
    return json.loads(raw)


def database_scenario():
    return database_record()["parameters"]


def restore_scenario(original, token: str, original_record=None) -> dict:
    status, response = http_json(
        "/projects/P006/scenario-config",
        token=token,
        method="POST",
        payload=original,
        timeout=90,
    )
    require(status == 200, f"scenario rollback failed: {status} {response}")
    restored = database_scenario()
    require(restored == original, "rollback parameters_json deep-equality mismatch")
    sync = {"attempted": False}
    try:
        scene_status, scene = http_json(
            "/r/P006/actuator/p006/factory-scenes/default", token=token, timeout=45
        )
        if scene_status == 200:
            sync_status, sync_body = http_json(
                "/projects/P006/sync-usd",
                token=token,
                method="POST",
                payload={"scene": scene, "scenario": restored},
                timeout=180,
            )
            sync = {"attempted": True, "httpStatus": sync_status, "status": sync_body.get("status")}
    except Exception as exc:
        sync = {"attempted": True, "warning": f"{type(exc).__name__}: {exc}"}
    api_status, api_restored = http_json("/projects/P006/scenario-config", token=token, timeout=45)
    require(api_status == 200 and api_restored == restored, "rollback API readback mismatch")
    require(sync.get("httpStatus") == 200 and sync.get("status") == "P006_USD_SYNC_OK", f"USD rollback failed: {sync}")
    record = database_record()
    if original_record is not None:
        require(record["scenarioNameColumn"] == original_record["scenarioNameColumn"], "rollback scenario_name mismatch")
        require(record["status"] == original_record["status"], "rollback status mismatch")
        require(record["createdAt"] == original_record["createdAt"], "rollback created_at mismatch")
    return {"databaseRestored": True, "apiRestored": True, "databaseRecord": record, "usdRestore": sync}


def make_driver() -> webdriver.Firefox:
    options = Options()
    options.add_argument("-headless")
    options.binary_location = "/snap/firefox/current/usr/lib/firefox/firefox"
    options.set_preference("browser.cache.disk.enable", False)
    options.set_preference("browser.cache.memory.enable", False)
    options.set_preference("network.http.use-cache", False)
    options.enable_bidi = True
    service = Service("/snap/bin/geckodriver", log_output=os.devnull)
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_page_load_timeout(60)
    return driver


def select_value(driver, selector: str, value) -> None:
    element = driver.find_element(By.CSS_SELECTOR, selector)
    element.clear()
    element.send_keys(str(value))
    driver.execute_script(
        "arguments[0].dispatchEvent(new Event('input',{bubbles:true}));"
        "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
        element,
    )


def force_value(driver, selector: str, value) -> None:
    """Set a value while bypassing native min/max/maxLength for validator QA."""
    element = driver.find_element(By.CSS_SELECTOR, selector)
    driver.execute_script(
        "arguments[0].value=String(arguments[1]);"
        "arguments[0].dispatchEvent(new Event('input',{bubbles:true}));"
        "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
        element,
        value,
    )


def wait_runtime(driver, timeout=60):
    wait = WebDriverWait(driver, timeout)
    state = wait.until(
        lambda browser: browser.execute_script(
            "return document.documentElement.dataset.sduiRuntime || ''"
        ) in {"ready", "denied", "error"}
        and browser.execute_script(
            "return document.documentElement.dataset.sduiRuntime || ''"
        )
    )
    if state == "error":
        message = driver.execute_script("return document.documentElement.dataset.sduiError || ''")
        raise VerificationFailure(f"SDUI runtime error: {message}")
    return state


def open_as(driver, token: str):
    driver.get(BASE_URL + "/projects/P006/assets/p006-logo.svg")
    driver.delete_all_cookies()
    driver.add_cookie({
        "name": "P006_SESSION",
        "value": token,
        "path": "/",
        "sameSite": "Lax",
    })
    driver.get(BASE_URL + TARGET_PATH + f"?_qa={time.time_ns()}")
    return wait_runtime(driver)


def verify_invalid_sessions(original) -> list[dict]:
    probes = [
        ("NO_COOKIE", None, None),
        ("UNRELATED_COOKIE", None, "foo=bar"),
        ("BOGUS_SESSION", "A" * 48, None),
    ]
    results = []
    for name, token, cookie_header in probes:
        get_status, _ = http_json(
            "/projects/P006/scenario-config", token=token, cookie_header=cookie_header, timeout=30
        )
        post_status, _ = http_json(
            "/projects/P006/scenario-config", token=token, cookie_header=cookie_header,
            method="POST", payload=original, timeout=30,
        )
        require(get_status == 401 and post_status == 401, f"{name}: expected GET/POST 401, got {get_status}/{post_status}")
        results.append({"case": name, "scenarioGet": get_status, "scenarioPost": post_status})
    return results


def verify_session_edge_cases(sessions, original) -> list[dict]:
    results = []
    token = sessions["SIMULATION_OPERATOR"]["token"]
    duplicate = f"P006_SESSION={token}; P006_SESSION={token}"
    duplicate_status, _ = http_json("/projects/P006/scenario-config", cookie_header=duplicate, timeout=30)
    require(duplicate_status == 401, f"duplicate P006_SESSION expected 401, got {duplicate_status}")
    results.append({"case": "DUPLICATE_SESSION_COOKIE", "actual": duplicate_status, "expected": 401})

    expired_token = secrets.token_urlsafe(36)
    expired_digest = hashlib.sha256(expired_token.encode()).hexdigest()
    reviewer_id = sessions["REVIEWER"]["accountId"]
    sql(
        "insert into dt_project_session(session_hash,account_id,expires_at) "
        f"values('{expired_digest}','{reviewer_id}',current_timestamp-interval '1 minute')"
    )
    expired_status, _ = http_json("/projects/P006/scenario-config", token=expired_token, timeout=30)
    require(expired_status == 401, f"expired session expected 401, got {expired_status}")
    results.append({"case": "EXPIRED_SESSION", "actual": expired_status, "expected": 401})

    inactive_token = secrets.token_urlsafe(36)
    inactive_digest = hashlib.sha256(inactive_token.encode()).hexdigest()
    factory_id = sessions["FACTORY_DESIGNER"]["accountId"]
    sql(
        "insert into dt_project_session(session_hash,account_id,expires_at) "
        f"values('{inactive_digest}','{factory_id}',current_timestamp+interval '5 minutes')"
    )
    try:
        sql(f"update dt_project_account set status='INACTIVE' where account_id='{factory_id}'")
        inactive_status, _ = http_json("/projects/P006/scenario-config", token=inactive_token, timeout=30)
        require(inactive_status == 401, f"inactive account expected 401, got {inactive_status}")
        results.append({"case": "INACTIVE_ACCOUNT", "actual": inactive_status, "expected": 401})
    finally:
        sql(f"update dt_project_account set status='ACTIVE' where account_id='{factory_id}'")

    db_before = database_scenario()
    evil_post_status, _ = http_json(
        "/projects/P006/scenario-config", token=token, method="POST", payload=original,
        extra_headers={"Origin": "https://evil.example"}, timeout=30,
    )
    evil_options_status, _ = http_json(
        "/projects/P006/scenario-config", method="OPTIONS",
        extra_headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}, timeout=30,
    )
    require(evil_post_status == 403 and evil_options_status == 403, f"evil origin expected 403/403, got {evil_post_status}/{evil_options_status}")
    require(database_scenario() == db_before, "evil-origin request changed database")
    results.append({"case": "UNTRUSTED_ORIGIN", "post": evil_post_status, "options": evil_options_status, "databaseUnchanged": True})
    return results


def verify_actor_matrix(driver, sessions, original) -> list[dict]:
    results = []
    for role, expected in ACTORS.items():
        start = time.monotonic()
        actor = sessions[role]
        auth_status, auth = http_json("/r/P006/actuator/p006/auth/session", token=actor["token"], timeout=30)
        require(auth_status == 200 and auth.get("authenticated") is True, f"{role} auth/session failed")
        authz_status, authz = http_json("/projects/P006/authz", token=actor["token"], timeout=30)
        require(authz_status == 200 and authz.get("authenticated") is True, f"{role} authz failed: {authz_status} {authz}")
        roles = authz.get("actor", {}).get("roles", [])
        permissions = authz.get("actor", {}).get("permissions", [])
        require(role in roles, f"{role} missing in authority source: {roles}")
        scenario_status, _ = http_json("/projects/P006/scenario-config", token=actor["token"], timeout=30)
        contract = ACTOR_CONTRACTS[role]
        backend_expected = contract["apiReadExpected"]
        scenario_post_status, _ = http_json(
            "/projects/P006/scenario-config", token=actor["token"], method="POST", payload=original, timeout=45
        )
        backend_post_expected = contract["apiWriteExpected"]
        require(scenario_status == backend_expected, f"{role}: GET expected {backend_expected}, got {scenario_status}")
        require(scenario_post_status == backend_post_expected, f"{role}: POST expected {backend_post_expected}, got {scenario_post_status}")
        sync_status = None
        if expected == "DENY":
            usd_before = {str(path): path.stat().st_mtime_ns for path in USD_SYNC_FILES}
            sync_status, _ = http_json(
                "/projects/P006/sync-usd", token=actor["token"], method="POST",
                payload={"scene": {}, "scenario": original}, timeout=30,
            )
            require(sync_status == 403, f"{role}: scenario USD sync expected 403, got {sync_status}")
            usd_after = {str(path): path.stat().st_mtime_ns for path in USD_SYNC_FILES}
            require(usd_after == usd_before, f"{role}: denied USD sync changed output files")
        runtime_state = open_as(driver, actor["token"])
        authority = driver.find_element(By.CSS_SELECTOR, "main [data-sdui-runtime]").get_attribute("data-sdui-authority")
        if expected == "ALLOW":
            require(runtime_state == "ready" and authority == "allowed", f"{role}: allowed runtime did not become ready")
            require("SIMULATION_RUN" in permissions, f"{role}: SIMULATION_RUN permission missing")
            require(len(driver.find_elements(By.CSS_SELECTOR, ".sdui-json-form input")) == EXPECTED["editableFields"], f"{role}: allowed form incomplete")
            actual = "ALLOW"
        else:
            require(runtime_state == "denied" and authority == "denied", f"{role}: denied runtime state mismatch")
            require(len(driver.find_elements(By.CSS_SELECTOR, ".sdui-authority[role='alert']")) == 1, f"{role}: deny alert missing")
            require(len(driver.find_elements(By.CSS_SELECTOR, ".sdui-json-form input")) == 0, f"{role}: denied form leaked")
            resources = driver.execute_script("return performance.getEntriesByType('resource').map(entry=>entry.name)")
            require(not any("/projects/P006/scenario-config" in item for item in resources), f"{role}: denied UI loaded scenario data")
            actual = "DENY"
        require(actual == expected, f"{role}: expected {expected}, got {actual}")
        results.append({
            "role": role,
            "accountId": actor["accountId"],
            "expected": expected,
            "actual": actual,
            "authorityRoles": roles,
            "authorityPermissions": permissions,
            "authzStatus": authz_status,
            "backendScenarioGetExpected": backend_expected,
            "backendScenarioGetActual": scenario_status,
            "backendScenarioPostExpected": backend_post_expected,
            "backendScenarioPostActual": scenario_post_status,
            "scenarioUsdSyncActual": sync_status,
            "deniedUsdFilesUnchanged": sync_status is None or sync_status == 403,
            "backendAuthorityEnforced": scenario_status == backend_expected and scenario_post_status == backend_post_expected,
            "durationMs": elapsed_ms(start),
        })
    return results


def verify_allowed_screen(driver, token: str, evidence_dir: Path, original) -> dict:
    phase_start = time.monotonic()
    state = open_as(driver, token)
    require(state == "ready", "allowed actor did not reach ready state")
    root = driver.find_element(By.CSS_SELECTOR, "main [data-sdui-runtime]")
    identity = {
        "runtime": root.get_attribute("data-sdui-runtime"),
        "screenId": root.get_attribute("data-screen-id"),
        "pageId": root.get_attribute("data-page-id"),
        "menuCode": root.get_attribute("data-menu-code"),
        "designVersion": root.get_attribute("data-design-version"),
    }
    for key in ["runtime", "screenId", "pageId", "menuCode"]:
        require(identity[key] == EXPECTED[key], f"{key} mismatch: {identity[key]}")

    editable_fields = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-json-form input, .sdui-json-form textarea, .sdui-json-form select"))
    process_rows = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-table tbody tr"))
    metric_cards = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-metric"))
    process_steps = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-process article"))
    support_cards = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-support-card"))
    readonly_codes = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-table .sdui-readonly"))
    editable_codes = len(driver.find_elements(By.CSS_SELECTOR, '[name$=".code"]'))
    require(editable_fields == EXPECTED["editableFields"], f"editable field count {editable_fields}")
    require(process_rows == EXPECTED["processRows"], f"process row count {process_rows}")
    require(metric_cards == EXPECTED["metrics"], f"metric count {metric_cards}")
    require(process_steps == EXPECTED["processSteps"], f"process step count {process_steps}")
    require(support_cards == EXPECTED["supportCards"], f"support card count {support_cards}")
    require(readonly_codes == EXPECTED["processRows"] and editable_codes == 0, "process codes are not read-only")
    require(len(driver.find_elements(By.CSS_SELECTOR, '[data-sdui-nav="p006-sdui-scenario-form"]')) == 1, "SDUI navigation missing")

    validation_start = time.monotonic()
    original_input = original["inputPerHour"]
    original_name = original["scenarioName"]
    original_dwell = original["processes"][0]["dwellSeconds"]
    original_defect = original["processes"][0]["defectRate"]
    invalid_cases = [
        ("required", '[name="scenarioName"]', "", original_name),
        ("minLength:2", '[name="scenarioName"]', "가", original_name),
        ("maxLength:200", '[name="scenarioName"]', "가" * 201, original_name),
        ("minimum:1", '[name="inputPerHour"]', 0, original_input),
        ("maximum:10000", '[name="inputPerHour"]', 10001, original_input),
        ("process-minimum:1", '[name="processes.0.dwellSeconds"]', 0, original_dwell),
        ("multipleOf:0.1", '[name="processes.0.defectRate"]', 0.05, original_defect),
    ]
    invalid_results = []
    for rule, selector, invalid_value, restore_value in invalid_cases:
        force_value(driver, selector, invalid_value)
        driver.find_element(By.CSS_SELECTOR, '[data-action="validate"]').click()
        try:
            WebDriverWait(driver, 10).until(
                lambda browser: len(browser.find_elements(By.CSS_SELECTOR, ".sdui-error-summary")) == 1
            )
        except Exception as exc:
            current_value = driver.find_element(By.CSS_SELECTOR, selector).get_attribute("value")
            status_text = driver.find_element(By.CSS_SELECTOR, ".sdui-status").text
            raise VerificationFailure(
                f"{rule}: validation summary missing; value={current_value!r}; status={status_text!r}"
            ) from exc
        invalid = driver.find_element(By.CSS_SELECTOR, selector).get_attribute("aria-invalid")
        error_count = len(driver.find_elements(By.CSS_SELECTOR, ".sdui-error-summary li"))
        require(invalid == "true", f"{rule}: invalid input did not receive aria-invalid")
        require(error_count >= 1, f"{rule}: validation summary is empty")
        invalid_results.append({"rule": rule, "errorCount": error_count, "ariaInvalid": True})
        force_value(driver, selector, restore_value)
        driver.find_element(By.CSS_SELECTOR, '[data-action="validate"]').click()
        WebDriverWait(driver, 10).until(
            lambda browser: len(browser.find_elements(By.CSS_SELECTOR, ".sdui-error-summary")) == 0
        )
    database_after_validation = database_scenario()
    require(database_after_validation == original, "validation-only cases unexpectedly changed the database")
    validation = {
        "invalidCases": invalid_results,
        "restoredValid": True,
        "databaseUnchanged": True,
        "durationMs": elapsed_ms(validation_start),
    }

    save_start = time.monotonic()
    qa_name = f"SDUI_QA_{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    qa_input = float(original_input) + 1
    if qa_input > 10000:
        qa_input = float(original_input) - 1
    if float(qa_input).is_integer():
        qa_input = int(qa_input)
    select_value(driver, '[name="scenarioName"]', qa_name)
    select_value(driver, '[name="inputPerHour"]', qa_input)
    form = driver.find_element(By.CSS_SELECTOR, ".sdui-json-form")
    driver.find_element(By.CSS_SELECTOR, '[data-action="submit"]').click()

    def save_finished(browser):
        current = browser.find_element(By.CSS_SELECTOR, ".sdui-json-form")
        saved = current.get_attribute("data-saved")
        tone = browser.find_element(By.CSS_SELECTOR, ".sdui-status").get_attribute("data-tone")
        if saved == "false" or tone == "error":
            return "error"
        return "saved" if saved == "true" else False

    save_state = WebDriverWait(driver, 210).until(save_finished)
    status_text = driver.find_element(By.CSS_SELECTOR, ".sdui-status").text
    require(save_state == "saved", f"workflow failed: {status_text}")
    require(form.get_attribute("data-database-readback") == "pending-reload", "readback marker missing")

    db_after = database_scenario()
    require(db_after["scenarioName"] == qa_name, "database scenarioName does not match input")
    require(float(db_after["inputPerHour"]) == float(qa_input), "database inputPerHour does not match input")
    require(len(db_after["processes"]) == 16, "database process array is incomplete")
    require(len(db_after.get("metrics", {})) >= 6, "database metrics are incomplete")
    save_result = {
        "input": {"scenarioName": qa_name, "inputPerHour": qa_input, "processCount": 16},
        "databaseOutput": {
            "scenarioName": db_after["scenarioName"],
            "inputPerHour": db_after["inputPerHour"],
            "metrics": db_after["metrics"],
            "statusText": status_text,
        },
        "durationMs": elapsed_ms(save_start),
    }

    reload_start = time.monotonic()
    driver.refresh()
    require(wait_runtime(driver) == "ready", "runtime did not recover after reload")
    restored_name = driver.find_element(By.CSS_SELECTOR, '[name="scenarioName"]').get_attribute("value")
    restored_input = driver.find_element(By.CSS_SELECTOR, '[name="inputPerHour"]').get_attribute("value")
    require(restored_name == qa_name, "reload did not restore scenarioName from DB")
    require(float(restored_input) == float(qa_input), "reload did not restore inputPerHour from DB")
    reload_result = {"scenarioName": restored_name, "inputPerHour": float(restored_input), "durationMs": elapsed_ms(reload_start)}

    visual_start = time.monotonic()
    driver.browsing_context.set_viewport(
        context=driver.current_window_handle,
        viewport={"width": 1600, "height": 1200},
        device_pixel_ratio=1,
    )
    time.sleep(0.5)
    desktop_viewport = driver.execute_script("return {width: innerWidth, height: innerHeight}")
    desktop_overflow = driver.execute_script(
        "return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    desktop_path = evidence_dir / "desktop-1600x1200.png"
    driver.save_screenshot(str(desktop_path))
    driver.browsing_context.set_viewport(
        context=driver.current_window_handle,
        viewport={"width": 390, "height": 844},
        device_pixel_ratio=1,
    )
    time.sleep(0.5)
    mobile_viewport = driver.execute_script("return {width: innerWidth, height: innerHeight}")
    mobile_overflow = driver.execute_script(
        "return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    mobile_path = evidence_dir / "mobile-390x844.png"
    driver.save_screenshot(str(mobile_path))
    require(not desktop_overflow, "desktop horizontal overflow detected")
    require(not mobile_overflow, "mobile horizontal overflow detected")
    require(desktop_viewport == {"width": 1600, "height": 1200}, f"desktop viewport mismatch: {desktop_viewport}")
    require(mobile_viewport == {"width": 390, "height": 844}, f"mobile viewport mismatch: {mobile_viewport}")
    visual = {
        "desktop": {**desktop_viewport, "horizontalOverflow": desktop_overflow, "screenshot": str(desktop_path)},
        "mobile": {**mobile_viewport, "horizontalOverflow": mobile_overflow, "screenshot": str(mobile_path)},
        "durationMs": elapsed_ms(visual_start),
    }
    return {
        "identity": identity,
        "counts": {
            "editableFields": editable_fields,
            "processRows": process_rows,
            "metrics": metric_cards,
            "processSteps": process_steps,
            "supportCards": support_cards,
            "readonlyProcessCodes": readonly_codes,
        },
        "validation": validation,
        "save": save_result,
        "reloadRestore": reload_result,
        "visualQa": visual,
        "durationMs": elapsed_ms(phase_start),
    }


def main() -> int:
    started = time.monotonic()
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_key = timestamp[9:15].lower() + secrets.token_hex(2)
    evidence_dir = EVIDENCE_ROOT / timestamp
    evidence_dir.mkdir(parents=True, exist_ok=False)
    result = {
        "testContractId": "P006_SDUI_SCENARIO_FORM_E2E",
        "startedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "target": BASE_URL + TARGET_PATH,
        "order": ["PAGE", "ACTOR", "SCREEN", "FUNCTION", "INPUT", "DATABASE_OUTPUT", "RELOAD_RESTORE", "VISUAL_QA"],
        "status": "RUNNING",
        "noBuildNoDeploy": {
            "npmBuild": False,
            "mavenBuild": False,
            "imageBuild": False,
            "podRollout": False,
            "serviceRestart": False,
        },
    }
    sessions = {}
    original = None
    original_record = None
    driver = None
    exit_code = 1
    try:
        original_record = database_record()
        original = original_record["parameters"]
        result["original"] = {
            "scenarioName": original["scenarioName"],
            "inputPerHour": original["inputPerHour"],
            "processCount": len(original["processes"]),
            "status": original_record["status"],
            "createdAt": original_record["createdAt"],
        }
        result["invalidSessions"] = verify_invalid_sessions(original)
        create_actor_sessions(run_key, sessions)
        driver = make_driver()
        result["actors"] = verify_actor_matrix(driver, sessions, original)
        result["sessionEdgeCases"] = verify_session_edge_cases(sessions, original)
        require(database_scenario() == original, "actor/authorization matrix changed scenario data")
        result["screenProcess"] = verify_allowed_screen(
            driver,
            sessions["SIMULATION_OPERATOR"]["token"],
            evidence_dir,
            original,
        )
        result["status"] = "PASS"
        exit_code = 0
    except Exception as exc:
        result["status"] = "FAIL"
        result["error"] = {"type": type(exc).__name__, "message": str(exc), "traceback": traceback.format_exc()[-6000:]}
    finally:
        if driver is not None and result.get("status") == "FAIL":
            try:
                driver.save_screenshot(str(evidence_dir / "failure.png"))
            except Exception as exc:
                result.setdefault("cleanupWarnings", []).append(f"failure-screenshot: {type(exc).__name__}: {exc}")
        if driver is not None:
            try:
                driver.quit()
            except Exception as exc:
                result.setdefault("cleanupWarnings", []).append(f"driver: {type(exc).__name__}: {exc}")
        if original is not None and sessions:
            try:
                result["rollback"] = restore_scenario(original, sessions["SIMULATION_OPERATOR"]["token"], original_record)
            except Exception as exc:
                result["status"] = "FAIL"
                exit_code = 1
                result.setdefault("cleanupWarnings", []).append(f"scenario: {type(exc).__name__}: {exc}")
        if sessions:
            result.setdefault("cleanupWarnings", []).extend(cleanup_actor_sessions(sessions))
            try:
                result["qaResidue"] = qa_residue(sessions)
            except Exception as exc:
                result.setdefault("cleanupWarnings", []).append(f"qa-residue: {type(exc).__name__}: {exc}")
        result["temporaryAccountsDeleted"] = bool(sessions) and result.get("qaResidue", {}).get("total") == 0 and not result.get("cleanupWarnings")
        result["finishedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
        result["durationMs"] = elapsed_ms(started)
        result_path = evidence_dir / "result.json"
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        latest = EVIDENCE_ROOT / "latest-result.json"
        temporary = latest.with_name(f".{latest.name}.{os.getpid()}.tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        os.replace(temporary, latest)
        print(json.dumps({
            "status": result["status"],
            "evidence": str(result_path),
            "durationMs": result["durationMs"],
            "actors": [{"role": item["role"], "actual": item["actual"]} for item in result.get("actors", [])],
            "counts": result.get("screenProcess", {}).get("counts"),
            "rollback": result.get("rollback"),
            "cleanupWarnings": result.get("cleanupWarnings", []),
            "error": result.get("error"),
        }, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
