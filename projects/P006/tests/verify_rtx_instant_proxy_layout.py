#!/usr/bin/env python3
"""Verify the 180-object instant RTX proxy uses a collision-free dense grid."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
import time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

sys.path.insert(0, "/opt/Resonance/projects/P006/runtime")
from scenario_store import sql  # noqa: E402


BASE_URL = "http://127.0.0.1:5174"
TARGET = "/projects/P006/digital-twin/factory-studio?scene=blueprint-auto"
EVIDENCE_ROOT = Path(os.environ.get(
    "P006_RTX_LAYOUT_EVIDENCE_DIR",
    "/opt/resonance-data/test-evidence/p006-rtx-preview-layout",
))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    started = time.monotonic()
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence = EVIDENCE_ROOT / stamp
    evidence.mkdir(parents=True, exist_ok=False)
    account = f"qa_rtx_layout_{secrets.token_hex(5)}"
    token = secrets.token_urlsafe(36)
    digest = hashlib.sha256(token.encode()).hexdigest()
    driver = None
    result = {"status": "RUNNING", "target": BASE_URL + TARGET, "startedAt": stamp}
    exit_code = 1
    try:
        sql(
            "insert into dt_project_account(account_id,login_id,password_hash,display_name,status) "
            f"values('{account}','{account}','disabled','RTX Layout QA','ACTIVE')"
        )
        sql(f"insert into dt_account_role(account_id,role_code) values('{account}','PROJECT_ADMIN')")
        sql(
            "insert into dt_project_session(session_hash,account_id,expires_at) "
            f"values('{digest}','{account}',current_timestamp+interval '15 minutes')"
        )
        options = Options()
        options.add_argument("-headless")
        options.binary_location = "/snap/firefox/current/usr/lib/firefox/firefox"
        options.enable_bidi = True
        service = Service("/snap/bin/geckodriver", log_output=os.devnull)
        driver = webdriver.Firefox(service=service, options=options)
        driver.set_page_load_timeout(60)
        driver.get(BASE_URL + "/projects/P006/assets/p006-logo.svg")
        driver.add_cookie({"name": "P006_SESSION", "value": token, "path": "/", "sameSite": "Lax"})
        driver.browsing_context.set_viewport(
            context=driver.current_window_handle,
            viewport={"width": 1920, "height": 1080},
            device_pixel_ratio=1,
        )
        driver.get(BASE_URL + TARGET + f"&_qa={time.time_ns()}")
        wait = WebDriverWait(driver, 70)
        wait.until(lambda browser: browser.execute_script(
            "return document.documentElement.dataset.blueprintScene==='READY'"
        ))
        source_object_count = wait.until(lambda browser: browser.execute_script(
            "return document.querySelectorAll('#workspace .object[data-asset]').length"
        ) or False)
        require(source_object_count > 0, "workspace objects are missing")
        object_count = driver.execute_script("""
          const workspace=document.querySelector('#workspace');
          const source=[...workspace.querySelectorAll('.object[data-asset]')];
          for(let index=source.length;index<180;index++){
            const clone=source[index%source.length].cloneNode(true);
            clone.dataset.id=crypto.randomUUID();
            clone.dataset.objectId=clone.dataset.id;
            clone.dataset.qaSynthetic='rtx-layout-180';
            clone.style.left=`${20+(index%3)*30}%`;
            clone.style.top=`${10+(Math.floor(index/3)%10)*8}%`;
            clone.classList.remove('editor-selected');
            workspace.append(clone);
          }
          return workspace.querySelectorAll('.object[data-asset]').length;
        """)
        require(object_count == 180, f"expected 180 preview objects, got {object_count}")
        driver.execute_script(
            "document.querySelectorAll('#workspace .object.editor-selected').forEach(node=>node.classList.remove('editor-selected'));"
            "document.querySelector('#rtx').click();"
        )
        wait.until(lambda browser: browser.find_elements("css selector", ".rtx-instant-proxy"))
        layout = driver.execute_script("""
          const proxy=document.querySelector('.rtx-instant-proxy');
          const floor=proxy.children[1];
          const cards=[...floor.querySelectorAll('article')];
          const bounds=floor.getBoundingClientRect();
          const rects=cards.map(card=>card.getBoundingClientRect());
          let overlaps=0;
          for(let left=0;left<rects.length;left++)for(let right=left+1;right<rects.length;right++){
            const a=rects[left],b=rects[right];
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps++;
          }
          const outside=rects.filter(rect=>rect.left<bounds.left-1||rect.right>bounds.right+1||rect.top<bounds.top-1||rect.bottom>bounds.bottom+1).length;
          return {
            mode:proxy.dataset.layoutMode,
            objectCount:Number(proxy.dataset.objectCount),
            cardCount:cards.length,
            columns:Number(floor.dataset.columns),
            rows:Number(floor.dataset.rows),
            overlaps,
            outside,
            viewport:{width:innerWidth,height:innerHeight},
            horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            header:proxy.querySelector('header').innerText,
            floor:{width:Math.round(bounds.width),height:Math.round(bounds.height)},
            minCardWidth:Math.round(Math.min(...rects.map(rect=>rect.width))),
            minCardHeight:Math.round(Math.min(...rects.map(rect=>rect.height)))
          };
        """)
        require(layout["mode"] == "collision-free-grid", f"layout mode mismatch: {layout}")
        require(layout["objectCount"] == 180 and layout["cardCount"] == 180, f"card count mismatch: {layout}")
        require(layout["columns"] == 19 and layout["rows"] == 10, f"grid mismatch: {layout}")
        require(layout["overlaps"] == 0 and layout["outside"] == 0, f"collision or clipping: {layout}")
        require(not layout["horizontalOverflow"], f"page overflow: {layout}")
        screenshot = evidence / "desktop-1920x1080.png"
        driver.save_screenshot(str(screenshot))
        result.update({
            "status": "PASS",
            "sourceObjectCount": source_object_count,
            "previewObjectCount": object_count,
            "layout": layout,
            "screenshot": str(screenshot),
        })
        exit_code = 0
    except Exception as error:
        result.update({"status": "FAIL", "error": f"{type(error).__name__}: {error}"})
        if driver:
            try:
                failure = evidence / "failure.png"
                driver.save_screenshot(str(failure))
                result["failureScreenshot"] = str(failure)
            except Exception:
                pass
    finally:
        if driver:
            try:
                driver.get("about:blank")
                driver.quit()
            except Exception:
                pass
        for query in [
            f"delete from dt_project_session where account_id='{account}'",
            f"delete from dt_account_role where account_id='{account}'",
            f"delete from dt_project_account where account_id='{account}'",
        ]:
            try:
                sql(query)
            except Exception as error:
                result.setdefault("cleanupErrors", []).append(str(error))
        residue = int(sql(
            "select (select count(*) from dt_project_account "
            f"where account_id='{account}')+(select count(*) from dt_account_role where account_id='{account}')+"
            f"(select count(*) from dt_project_session where account_id='{account}')"
        ) or 0)
        result["temporaryResidue"] = residue
        result["durationMs"] = round((time.monotonic() - started) * 1000)
        if residue or result.get("cleanupErrors"):
            result["status"] = "FAIL"
            exit_code = 1
        result_path = evidence / "result.json"
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"status": result["status"], "durationMs": result["durationMs"], "layout": result.get("layout"), "evidence": str(result_path), "error": result.get("error")}, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
