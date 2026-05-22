#!/usr/bin/env python3
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request


ROOT_DIR = pathlib.Path(os.environ.get("ROOT_DIR", "/opt/Resonance"))
NAMESPACE = os.environ.get("NAMESPACE", "carbonet-prod")
POD = os.environ.get("CUBRID_POD", "cubrid-carbonet-0")
DB_NAME = os.environ.get("DB_NAME", "carbonet")
DB_USER = os.environ.get("DB_USER", "dba")
API_KEY = os.environ.get("SHADOW_API_KEY", "qwer1234")
BATCH_SIZE = int(os.environ.get("SHADOW_BATCH_SIZE", "20"))
SLEEP_SECONDS = float(os.environ.get("SHADOW_SLEEP_SECONDS", "0.5"))
MAX_BATCHES = int(os.environ.get("SHADOW_MAX_BATCHES", "0"))
MODEL_TIMEOUT_SECONDS = int(os.environ.get("SHADOW_MODEL_TIMEOUT_SECONDS", "60"))

MODELS = [
    {
        "name": os.environ.get("GEMMA_TRANSLATION_MODEL", os.environ.get("GEMMA_MODEL", "gemma4-e4b-q4_k_m")),
        "base_url": os.environ.get("GEMMA_BASE_URL", "http://127.0.0.1:24114/v1").rstrip("/"),
        "lane": "translation",
    },
    {
        "name": os.environ.get("QWEN_DEV_CLASSIFY_MODEL", "qwen2.5-instruct:7b"),
        "base_url": os.environ.get("QWEN_DEV_BASE_URL", "http://127.0.0.1:11434/v1").rstrip("/"),
        "lane": "dev-classify",
    },
]

if os.environ.get("SHADOW_INCLUDE_DEV_FAST", "false").lower() == "true":
    MODELS.append({
        "name": os.environ.get("QWEN_DEV_FAST_MODEL", "qwen2.5-coder:7b"),
        "base_url": os.environ.get("QWEN_DEV_BASE_URL", "http://127.0.0.1:11434/v1").rstrip("/"),
        "lane": "fast-draft",
    })

LOG_DIR = pathlib.Path(os.environ.get("LOG_DIR", str(ROOT_DIR / "var" / "ai-runtime")))
EVENT_LOG = LOG_DIR / "ecoinvent-shadow-translation-events.jsonl"
WORK_DIR = LOG_DIR / "db-sync"
LOG_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR.mkdir(parents=True, exist_ok=True)
HANGUL_PATTERN = re.compile(r"[가-힣]")


def log_event(status, code, message, **extra):
    event = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "script": "ecoinvent-shadow-translation-worker",
        "status": status,
        "code": code,
        "message": message,
        **extra,
    }
    with EVENT_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def run(command, check=True):
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    if check and result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{result.stdout}")
    return result.stdout


def sql_literal(value, limit):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"


def csql(sql, stem):
    local_sql = WORK_DIR / f"{stem}.sql"
    remote_sql = f"/tmp/{stem}.sql"
    local_sql.write_text(sql, encoding="utf-8")
    run(["kubectl", "-n", NAMESPACE, "cp", str(local_sql), f"{POD}:{remote_sql}"])
    return run(["kubectl", "-n", NAMESPACE, "exec", POD, "--", "bash", "-lc", f"csql -u {DB_USER!r} {DB_NAME!r} -i {remote_sql}"])


def contains_hangul(value):
    return bool(HANGUL_PATTERN.search(value or ""))


def fetch_batch():
    sql = f"""
SELECT 'SROW|' || CAST(t.ecoinvent_master_id AS VARCHAR(40)) || '|'
       || REPLACE(COALESCE(m.product_name, t.english_name), '|', '/') || '|'
       || REPLACE(COALESCE(t.korean_name, ''), '|', '/') || '|'
       || COALESCE(t.mapping_status, '')
FROM emission_material_translation t
LEFT JOIN ecoinvent_master m ON m.id = t.ecoinvent_master_id
WHERE t.raw_name LIKE 'ecoinvent:%'
  AND t.shadow_translation_json IS NULL
  AND t.mapping_status IN ('PRODUCT_KO_EN_AI_TRANSLATED', 'PRODUCT_KO_PENDING_AI')
  AND COALESCE(m.product_name, t.english_name) IS NOT NULL
ORDER BY CASE WHEN t.mapping_status = 'PRODUCT_KO_EN_AI_TRANSLATED' THEN 0 ELSE 1 END,
         t.ecoinvent_master_id
LIMIT {BATCH_SIZE};
"""
    output = csql(sql, "ecoinvent-shadow-select")
    rows = []
    for match in re.finditer(r"SROW\|([0-9]+)\|([^\n\r|]*)\|([^\n\r|]*)\|([^\n\r|]*)", output):
        rows.append({
            "id": int(match.group(1)),
            "productName": match.group(2).strip(),
            "referenceKoreanName": match.group(3).strip(),
            "mappingStatus": match.group(4).strip(),
        })
    return rows


def request_model(model, rows):
    payload = {
        "model": model["name"],
        "messages": [
            {
                "role": "system",
                "content": (
                    "Translate ecoinvent productName into Korean product names. "
                    "Return strict JSON array only. koreanName must contain Hangul. "
                    "No explanations. Preserve formulas, numbers, units, and abbreviations."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Return [{\"id\":1,\"koreanName\":\"...\",\"englishName\":\"...\"}]. "
                    "englishName is the English back-translation of koreanName.\n"
                    + json.dumps([{"id": row["id"], "productName": row["productName"]} for row in rows], ensure_ascii=False)
                ),
            },
        ],
        "temperature": 0,
        "max_tokens": 4096,
    }
    started = time.time()
    request = urllib.request.Request(
        model["base_url"] + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=MODEL_TIMEOUT_SECONDS) as response:
        data = json.loads(response.read().decode("utf-8"))
    elapsed_ms = int((time.time() - started) * 1000)
    content = data["choices"][0]["message"]["content"]
    match = re.search(r"\[[\s\S]*\]", content)
    parsed = json.loads(match.group(0)) if match else []
    by_id = {}
    for item in parsed:
        row_id = int(item.get("id", 0))
        korean_name = str(item.get("koreanName", "")).strip()
        english_name = str(item.get("englishName", "")).strip()
        if row_id:
            by_id[row_id] = {
                "model": model["name"],
                "koreanName": korean_name,
                "englishName": english_name,
                "hasHangul": contains_hangul(korean_name),
                "elapsedMs": elapsed_ms,
            }
    return by_id, elapsed_ms


def apply_shadow(rows, model_results):
    statements = []
    write_started = time.time()
    updated = 0
    for row in rows:
        row_results = [model_results.get(model["name"], {}).get(row["id"]) for model in MODELS]
        row_results = [result for result in row_results if result]
        if not row_results:
            continue
        payload = {
            "productName": row["productName"],
            "referenceKoreanName": row["referenceKoreanName"],
            "referenceStatus": row["mappingStatus"],
            "results": row_results,
        }
        ok_count = sum(1 for result in row_results if result.get("hasHangul"))
        status = f"SHADOW_OK_{ok_count}_OF_{len(row_results)}"
        statements.append(
            "UPDATE emission_material_translation "
            f"SET shadow_translation_json = {sql_literal(json.dumps(payload, ensure_ascii=False), 4000)}, "
            f"shadow_translation_status = {sql_literal(status, 80)}, "
            "shadow_saved_at = CURRENT_DATETIME, "
            "shadow_save_elapsed_ms = 0, "
            "last_updt_pnttm = last_updt_pnttm "
            f"WHERE raw_name = 'ecoinvent:{row['id']}' AND ecoinvent_master_id = {row['id']};"
        )
        updated += 1
    if statements:
        statements.append("COMMIT;")
        csql("\n".join(statements), f"ecoinvent-shadow-update-{int(time.time())}")
        elapsed_ms = int((time.time() - write_started) * 1000)
        metric_updates = []
        for row in rows:
            metric_updates.append(
                "UPDATE emission_material_translation "
                f"SET shadow_save_elapsed_ms = {elapsed_ms} "
                f"WHERE raw_name = 'ecoinvent:{row['id']}' AND ecoinvent_master_id = {row['id']} "
                "AND shadow_saved_at IS NOT NULL;"
            )
        metric_updates.append("COMMIT;")
        csql("\n".join(metric_updates), f"ecoinvent-shadow-save-metric-{int(time.time())}")
        return updated, elapsed_ms
    return updated, 0


def main():
    batches = 0
    total = 0
    log_event("START", "RUN_STARTED", "shadow translation worker started", batchSize=BATCH_SIZE, models=[m["name"] for m in MODELS])
    while True:
        if MAX_BATCHES and batches >= MAX_BATCHES:
            break
        rows = fetch_batch()
        if not rows:
            log_event("OK", "NO_ROWS", "no rows remain for shadow translation", total=total)
            return 0
        model_results = {}
        model_stats = []
        for model in MODELS:
            try:
                results, elapsed_ms = request_model(model, rows)
                model_results[model["name"]] = results
                model_stats.append({
                    "model": model["name"],
                    "elapsedMs": elapsed_ms,
                    "rows": len(rows),
                    "rowsPerSecond": round(len(rows) / max(elapsed_ms / 1000.0, 0.001), 3),
                    "hangulOk": sum(1 for item in results.values() if item.get("hasHangul")),
                })
            except Exception as exc:
                log_event("ERROR", "MODEL_FAILED", str(exc), model=model["name"], batch=batches + 1)
                model_results[model["name"]] = {}
        updated, db_save_elapsed_ms = apply_shadow(rows, model_results)
        batches += 1
        total += updated
        log_event("OK", "BATCH_SHADOWED", "shadow batch completed", batch=batches, rows=len(rows), updated=updated, total=total, dbSaveElapsedMs=db_save_elapsed_ms, modelStats=model_stats)
        time.sleep(SLEEP_SECONDS)
    log_event("OK", "MAX_BATCHES_REACHED", "shadow worker stopped after configured batch limit", total=total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
