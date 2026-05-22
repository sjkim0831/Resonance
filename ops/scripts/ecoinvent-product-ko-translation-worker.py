#!/usr/bin/env python3
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request


ROOT_DIR = pathlib.Path(os.environ.get("ROOT_DIR", "/opt/Resonance"))
NAMESPACE = os.environ.get("NAMESPACE", "carbonet-prod")
POD = os.environ.get("CUBRID_POD", "cubrid-carbonet-0")
DB_NAME = os.environ.get("DB_NAME", "carbonet")
DB_USER = os.environ.get("DB_USER", "dba")
TRANSLATION_BASE_URL = os.environ.get(
    "TRANSLATION_BASE_URL",
    os.environ.get("GEMMA_BASE_URL", os.environ.get("QWEN40_BASE_URL", "http://127.0.0.1:24114/v1")),
).rstrip("/")
TRANSLATION_API_KEY = os.environ.get("TRANSLATION_API_KEY", os.environ.get("GEMMA_API_KEY", os.environ.get("QWEN40_API_KEY", "qwer1234")))
TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", os.environ.get("GEMMA_MODEL", os.environ.get("QWEN40_MODEL", "gemma4-e4b-q4_k_m")))
TRANSLATION_MODEL_CANDIDATES = [
    item.strip()
    for item in os.environ.get("TRANSLATION_MODELS", f"{TRANSLATION_MODEL},gemma4:e2b,gemma:2b").split(",")
    if item.strip()
]
TRANSLATION_TIMEOUT_SECONDS = int(os.environ.get("TRANSLATION_TIMEOUT_SECONDS", os.environ.get("QWEN40_TIMEOUT_SECONDS", "60")))
TRANSLATION_MAX_TOKENS = int(os.environ.get("TRANSLATION_MAX_TOKENS", os.environ.get("QWEN40_MAX_TOKENS", "4096")))
TRANSLATION_SINGLE_MAX_TOKENS = int(os.environ.get("TRANSLATION_SINGLE_MAX_TOKENS", os.environ.get("QWEN40_SINGLE_MAX_TOKENS", "512")))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "25"))
MAX_BATCHES = int(os.environ.get("MAX_BATCHES", "0"))
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "1"))
MARK_REVIEW_REQUIRED_ON_REJECT = os.environ.get("MARK_REVIEW_REQUIRED_ON_REJECT", "true").lower() == "true"

LOG_DIR = pathlib.Path(os.environ.get("LOG_DIR", str(ROOT_DIR / "var" / "ai-runtime")))
EVENT_LOG = LOG_DIR / "ecoinvent-product-ko-translation-events.jsonl"
WORK_DIR = LOG_DIR / "db-sync"
LOG_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR.mkdir(parents=True, exist_ok=True)
HANGUL_PATTERN = re.compile(r"[가-힣]")
ACTIVE_TRANSLATION_MODEL = TRANSLATION_MODEL
EXACT_KOREAN_GLOSSARY = {
    "ammonium chloride": ("염화암모늄", "ammonium chloride"),
    "chloroacetic acid": ("클로로아세트산", "chloroacetic acid"),
    "cobwork": ("코브워크", "cobwork"),
    "coke": ("코크스", "coke"),
    "deep drawing, steel, 3500 kn press, single stroke": ("강재 딥 드로잉, 3500 kN 프레스, 단일 스트로크", "deep drawing, steel, 3500 kN press, single stroke"),
    "electricity, high voltage": ("고전압 전력", "high voltage electricity"),
    "electricity, low voltage": ("저전압 전력", "low voltage electricity"),
    "electricity, medium voltage": ("중전압 전력", "medium voltage electricity"),
    "formaldehyde": ("포름알데히드", "formaldehyde"),
    "fluosilicic acid, without water, in 22% solution state": ("무수 플루오로규산, 22% 용액 상태", "fluosilicic acid, without water, in 22% solution state"),
    "nylon 6": ("나일론 6", "nylon 6"),
    "portafer": ("포타퍼", "portafer"),
    "sodium fluoride": ("플루오르화나트륨", "sodium fluoride"),
    "soybean oil, refined": ("정제 대두유", "refined soybean oil"),
    "stucco": ("치장벽토", "stucco"),
}


def log_event(status, code, message, **extra):
    event = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "script": "ecoinvent-product-ko-translation-worker",
        "status": status,
        "code": code,
        "message": message,
        **extra,
    }
    with EVENT_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def run(command, check=True, input_text=None):
    result = subprocess.run(
        command,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
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
    return run([
        "kubectl",
        "-n",
        NAMESPACE,
        "exec",
        POD,
        "--",
        "bash",
        "-lc",
        f"csql -u {DB_USER!r} {DB_NAME!r} -i {remote_sql}",
    ])


def mark_review_required(row, reason):
    if not MARK_REVIEW_REQUIRED_ON_REJECT:
        return
    row_id = int(row["id"])
    product_name = row.get("productName", "")
    sql = (
        "UPDATE emission_material_translation "
        "SET korean_name = NULL, "
        f"english_name = {sql_literal(product_name, 1000)}, "
        f"english_exact_name = {sql_literal(product_name, 2000)}, "
        f"source_type = {sql_literal('AI_PRODUCT_TRANSLATION_REVIEW', 80)}, "
        "mapping_status = 'PRODUCT_KO_REVIEW_REQUIRED', "
        f"mapping_note = {sql_literal(reason, 1000)}, "
        "last_updt_pnttm = CURRENT_DATETIME "
        f"WHERE raw_name = 'ecoinvent:{row_id}' "
        f"AND ecoinvent_master_id = {row_id} "
        "AND mapping_status = 'PRODUCT_KO_PENDING_AI';\n"
        "COMMIT;"
    )
    csql(sql, f"ecoinvent-product-ko-review-{row_id}-{int(time.time())}")
    log_event(
        "WARN",
        "ROW_MARKED_REVIEW_REQUIRED",
        "row marked review-required after Korean translation rejection",
        rowId=row_id,
        productName=product_name,
    )


def normalize_product_name(value):
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def fetch_pending_batch():
    sql = f"""
SELECT 'QROW|' || CAST(t.ecoinvent_master_id AS VARCHAR(40)) || '|' || COALESCE(m.product_name, t.english_name)
FROM emission_material_translation t
LEFT JOIN ecoinvent_master m ON m.id = t.ecoinvent_master_id
WHERE t.raw_name LIKE 'ecoinvent:%'
  AND t.mapping_status = 'PRODUCT_KO_PENDING_AI'
  AND COALESCE(m.product_name, t.english_name) IS NOT NULL
  AND (
    t.korean_name IS NULL
    OR TRIM(t.korean_name) = ''
    OR t.english_exact_name IS NULL
    OR TRIM(t.english_exact_name) = ''
  )
ORDER BY t.ecoinvent_master_id
LIMIT {BATCH_SIZE * 4};
"""
    output = csql(sql, "ecoinvent-product-ko-select")
    rows = []
    seen = set()
    for match in re.finditer(r"QROW\|([0-9]+)\|([^'\n\r]+)", output):
        product_name = match.group(2).strip()
        key = normalize_product_name(product_name)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append({"id": int(match.group(1)), "productName": product_name})
        if len(rows) >= BATCH_SIZE:
            break
    return rows


def contains_hangul(value):
    return bool(HANGUL_PATTERN.search(value or ""))


def apply_domain_glossary(row, names):
    product_name = (row.get("productName") or "").strip()
    normalized = product_name.lower()
    if normalized in EXACT_KOREAN_GLOSSARY:
        korean_name, english_name = EXACT_KOREAN_GLOSSARY[normalized]
        return {"koreanName": korean_name, "englishName": english_name}

    korean_name = names["koreanName"]
    english_name = names["englishName"]
    if "coke" in normalized:
        korean_name = korean_name.replace("코카콜라", "코크스")
    if "deep drawing" in normalized:
        korean_name = korean_name.replace("심인성", "딥 드로잉")
        korean_name = korean_name.replace("심층 드로잉", "딥 드로잉")
    if "cement-fibre" in normalized or "cement fibre" in normalized:
        korean_name = korean_name.replace("시멘트 섬유 슬래브", "시멘트 섬유판")
    return {"koreanName": korean_name, "englishName": english_name}


def fetch_existing_translations(rows):
    product_names = []
    seen = set()
    for row in rows:
        key = normalize_product_name(row.get("productName"))
        if key and key not in seen:
            seen.add(key)
            product_names.append(row.get("productName", ""))
    if not product_names:
        return {}
    conditions = " OR ".join(
        f"LOWER(TRIM(COALESCE(m.product_name, t.english_name))) = {sql_literal(normalize_product_name(name), 1000)}"
        for name in product_names
    )
    sql = f"""
SELECT 'CACHE|' || LOWER(TRIM(COALESCE(m.product_name, t.english_name))) || '|'
       || COALESCE(t.korean_name, '') || '|'
       || COALESCE(t.english_name, '')
FROM emission_material_translation t
LEFT JOIN ecoinvent_master m ON m.id = t.ecoinvent_master_id
WHERE t.raw_name LIKE 'ecoinvent:%'
  AND t.mapping_status = 'PRODUCT_KO_EN_AI_TRANSLATED'
  AND t.korean_name IS NOT NULL
  AND t.korean_name REGEXP '[가-힣]'
  AND ({conditions})
ORDER BY t.last_updt_pnttm DESC;
"""
    output = csql(sql, f"ecoinvent-product-ko-cache-select-{int(time.time())}")
    cached = {}
    for match in re.finditer(r"CACHE\|([^|\n\r]+)\|([^|\n\r]+)\|([^'\n\r]+)", output):
        key = normalize_product_name(match.group(1))
        if key and key not in cached:
            cached[key] = {
                "koreanName": match.group(2).strip(),
                "englishName": match.group(3).strip(),
            }
    return cached


def reuse_existing_translations(rows):
    cached = fetch_existing_translations(rows)
    reused = {}
    remaining = []
    for row in rows:
        key = normalize_product_name(row.get("productName"))
        names = cached.get(key)
        if names and contains_hangul(names.get("koreanName")):
            reused[int(row["id"])] = {
                "koreanName": names["koreanName"],
                "englishName": names["englishName"] or row.get("productName", ""),
                "productName": row.get("productName", ""),
            }
        else:
            remaining.append(row)
    if reused:
        log_event(
            "OK",
            "CACHE_REUSED",
            "reused existing Korean product-name translations from DB",
            reused=len(reused),
            remaining=len(remaining),
        )
    return reused, remaining


def request_chat(messages, max_tokens):
    global ACTIVE_TRANSLATION_MODEL
    last_error = None
    for model_name in TRANSLATION_MODEL_CANDIDATES:
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0,
            "max_tokens": max_tokens,
        }
        request = urllib.request.Request(
            TRANSLATION_BASE_URL + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {TRANSLATION_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=TRANSLATION_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
            ACTIVE_TRANSLATION_MODEL = model_name
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            last_error = exc
            log_event("WARN", "TRANSLATION_MODEL_FALLBACK", "translation model failed; trying next candidate", model=model_name, error=str(exc)[:500])
    raise RuntimeError(f"all translation models failed: {last_error}")


def extract_jsonish_field(content, field):
    match = re.search(rf"['\"]?{field}['\"]?\s*:\s*['\"“](.*?)['\"”]", content)
    if match:
        return match.group(1).strip()
    return ""


def call_translation_model_single(row):
    content = request_chat(
        [
            {
                "role": "system",
                "content": (
                    "너는 영어 제품명을 한국어 한글 제품명으로 번역하는 번역기다. "
                    "koreanName에는 반드시 한국어 한글을 넣는다. 영어, 일본어, 중국어를 그대로 쓰지 않는다. "
                    "화학식, 숫자, 단위, 표준 약어만 원문 그대로 보존한다. "
                    "산업/LCA 문맥에서 coke는 음료가 아니라 코크스, stucco는 치장벽토, deep drawing은 딥 드로잉이다. "
                    "JSON 객체만 출력한다."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"productName={row['productName']}\n"
                    "koreanName은 반드시 한글 제품명으로 작성한다. "
                    "englishName은 koreanName을 다시 영어로 번역한 값으로 작성한다. "
                    "예시: {\"koreanName\":\"염화암모늄\",\"englishName\":\"ammonium chloride\"}"
                ),
            },
        ],
        TRANSLATION_SINGLE_MAX_TOKENS,
    )
    korean_name = ""
    english_name = ""
    match = re.search(r"\{[\s\S]*\}", content)
    if match:
        candidate = match.group(0)
        try:
            parsed = json.loads(candidate)
            korean_name = str(parsed.get("koreanName", "")).strip()
            english_name = str(parsed.get("englishName", "")).strip()
        except json.JSONDecodeError:
            korean_name = extract_jsonish_field(candidate, "koreanName")
            english_name = extract_jsonish_field(candidate, "englishName")
    if not korean_name:
        korean_name = extract_jsonish_field(content, "koreanName")
    if not english_name:
        english_name = extract_jsonish_field(content, "englishName")
    if korean_name and english_name:
        names = apply_domain_glossary(row, {"koreanName": korean_name, "englishName": english_name})
        if contains_hangul(names["koreanName"]):
            return names
    log_event(
        "WARN",
        "ROW_SINGLE_REJECTED",
        "single-row translation model did not produce Korean Hangul",
        rowId=row["id"],
        productName=row["productName"],
        content=content[:500],
    )
    mark_review_required(row, f"{ACTIVE_TRANSLATION_MODEL} batch and single-row translation did not produce Korean Hangul; skipped to keep worker progressing")
    return None


def call_translation_model(rows):
    row_by_id = {int(row["id"]): row for row in rows}
    source_by_id = {row_id: row["productName"] for row_id, row in row_by_id.items()}
    content = request_chat(
        [
            {
                "role": "system",
                "content": (
                    "당신은 ecoinvent 제품명(productName)을 한국어와 영어로 매핑하는 번역기입니다. "
                    "각 productName마다 먼저 정확한 한국어 제품명 koreanName을 만드세요. "
                    "koreanName은 반드시 한국어 한글을 포함해야 하며, 일본어 한자/히라가나/가타카나 또는 중국어 문자를 쓰면 안 됩니다. "
                    "화학식, 숫자, 단위, 표준 약어만 원문 그대로 보존하고, 나머지 영어 단어는 한국어로 번역하거나 한글로 음역하세요. "
                    "그 다음 koreanName을 다시 영어로 번역한 간결한 제품명을 englishName에 넣으세요. "
                    "활동명, 지역명, 점수, 분류, 설명, 주석은 넣지 마세요. "
                    "예: ammonium chloride -> 염화암모늄 / ammonium chloride; "
                    "coke -> 코크스 / coke; stucco -> 치장벽토 / stucco; deep drawing -> 딥 드로잉; "
                    "formaldehyde -> 포름알데히드 / formaldehyde; "
                    "high voltage electricity -> 고전압 전력 / high voltage electricity; "
                    "waste cement-fibre slab -> 폐 시멘트 섬유판 / waste cement-fibre slab; "
                    "ethylene dichloride -> 에틸렌 디클로라이드 / ethylene dichloride; "
                    "portafer -> 포타퍼 / portafer. Strict JSON only."
                ),
            },
            {
                "role": "user",
                "content": (
                    "아래 JSON 배열의 productName만 처리하세요. "
                    "koreanName은 반드시 한국어 한글 제품명이어야 하며 영어/일본어/중국어를 그대로 복사하지 마세요. "
                    "englishName은 koreanName을 다시 영어로 번역한 값으로 작성하세요. "
                    "반드시 JSON 배열만 반환하세요: [{\"id\":1,\"koreanName\":\"...\",\"englishName\":\"...\"}].\n"
                    + json.dumps(rows, ensure_ascii=False)
                ),
            },
        ],
        TRANSLATION_MAX_TOKENS,
    )
    match = re.search(r"\[[\s\S]*\]", content)
    parsed = []
    if match:
        parsed = json.loads(match.group(0))
    else:
        log_event("WARN", "BATCH_JSON_MISSING", "translation model response did not contain a JSON array; falling back to single-row calls", model=ACTIVE_TRANSLATION_MODEL)
    translations = {}
    for item in parsed:
        row_id = int(item.get("id", 0))
        korean_name = str(item.get("koreanName", "")).strip()
        english_name = str(item.get("englishName", "")).strip()
        if row_id > 0 and korean_name and english_name:
            names = apply_domain_glossary(row_by_id.get(row_id, {"productName": source_by_id.get(row_id, "")}), {
                "koreanName": korean_name,
                "englishName": english_name,
            })
            if contains_hangul(names["koreanName"]):
                names["productName"] = source_by_id.get(row_id, "")
                translations[row_id] = names
                continue
            korean_name = names["koreanName"]
            english_name = names["englishName"]
        if row_id > 0:
            log_event(
                "WARN",
                "ROW_REJECTED_NON_KOREAN",
                "translation model returned koreanName without Hangul; row left pending",
                rowId=row_id,
                productName=source_by_id.get(row_id),
                koreanName=korean_name,
                englishName=english_name,
            )
    missing_rows = [row for row in rows if int(row["id"]) not in translations]
    if missing_rows:
        log_event(
            "WARN",
            "BATCH_FALLBACK_SINGLE",
            "falling back to single-row Korean translation",
            rows=len(missing_rows),
        )
        for row in missing_rows:
            single = call_translation_model_single(row)
            if single:
                single["productName"] = row["productName"]
                translations[int(row["id"])] = single
    return translations


def apply_translations(translations):
    if not translations:
        return 0
    statements = []
    batch_key = f"product-ko-{int(time.time() * 1000)}"
    for row_id, names in translations.items():
        korean_name = names["koreanName"]
        english_name = names["englishName"]
        product_name = names.get("productName", "")
        product_key = normalize_product_name(product_name)
        statements.append(
            "UPDATE emission_material_translation "
            f"SET korean_name = {sql_literal(korean_name, 1000)}, "
            f"english_name = {sql_literal(english_name, 1000)}, "
            f"english_exact_name = {sql_literal(english_name, 2000)}, "
            f"source_type = {sql_literal('AI_PRODUCT_TRANSLATION', 80)}, "
            "mapping_status = 'PRODUCT_KO_EN_AI_TRANSLATED', "
            f"mapping_note = {sql_literal(ACTIVE_TRANSLATION_MODEL + '/product-name cache translated ecoinvent product_name; same product_name rows updated together', 1000)}, "
            f"translation_batch_key = {sql_literal(batch_key, 80)}, "
            "last_updt_pnttm = CURRENT_DATETIME "
            "WHERE raw_name LIKE 'ecoinvent:%' "
            "AND mapping_status = 'PRODUCT_KO_PENDING_AI' "
            "AND (korean_name IS NULL OR TRIM(korean_name) = '' OR english_exact_name IS NULL OR TRIM(english_exact_name) = '') "
            "AND ("
            f"ecoinvent_master_id = {row_id} "
            f"OR LOWER(TRIM(english_name)) = {sql_literal(product_key, 1000)} "
            "OR ecoinvent_master_id IN ("
            "SELECT id FROM ecoinvent_master "
            f"WHERE LOWER(TRIM(product_name)) = {sql_literal(product_key, 1000)}"
            ")"
            ");"
        )
    statements.append("COMMIT;")
    started = time.monotonic()
    csql("\n".join(statements), f"ecoinvent-product-ko-update-{int(time.time())}")
    elapsed_ms = int((time.monotonic() - started) * 1000)
    csql(
        "UPDATE emission_material_translation "
        f"SET translation_save_elapsed_ms = {elapsed_ms} "
        f"WHERE translation_batch_key = {sql_literal(batch_key, 80)};\n"
        "COMMIT;",
        f"ecoinvent-product-ko-save-metrics-{int(time.time())}",
    )
    log_event(
        "OK",
        "DB_SAVE_METRICS_RECORDED",
        "recorded product-name translation DB save metrics",
        batchKey=batch_key,
        translationKeys=len(translations),
        saveElapsedMs=elapsed_ms,
    )
    return len(translations)


def main():
    batches = 0
    total = 0
    log_event("START", "RUN_STARTED", "product-name Korean translation worker started", batchSize=BATCH_SIZE)
    while True:
        if MAX_BATCHES and batches >= MAX_BATCHES:
            break
        rows = fetch_pending_batch()
        if not rows:
            log_event("OK", "NO_PENDING_ROWS", "no pending product-name rows remain", totalTranslated=total)
            return 0
        try:
            reused, remaining_rows = reuse_existing_translations(rows)
            translations = dict(reused)
            if remaining_rows:
                translations.update(call_translation_model(remaining_rows))
            updated = apply_translations(translations)
            batches += 1
            total += updated
            log_event(
                "OK",
                "BATCH_TRANSLATED",
                "translated product-name batch",
                batch=batches,
                rows=len(rows),
                reused=len(reused),
                qwenRows=len(remaining_rows),
                updated=updated,
                totalTranslated=total,
            )
        except (urllib.error.URLError, ValueError, json.JSONDecodeError, RuntimeError) as exc:
            log_event("ERROR", "BATCH_FAILED", str(exc), batch=batches + 1, rows=len(rows))
            return 1
        time.sleep(SLEEP_SECONDS)
    log_event("OK", "MAX_BATCHES_REACHED", "worker stopped after configured batch limit", totalTranslated=total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
