#!/usr/bin/env python3
"""
NVIDIA 16-Key Parallel Training Data Generator
RAG, VectorDB, Fine-tune 데이터 생성
Usage: python3 generate_training_data.py [MODE] [BATCH_NUM] [TOTAL_BATCHES]
Example: python3 generate_training_data.py all 0 16
"""

import json
import subprocess
import sys
import os
import re
import time

NVIDIA_API = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "qwen/qwen3-next-80b-a3b-instruct"

API_KEYS = [
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
]

POD = "cubrid-carbonet-0"
NS = "carbonet-prod"
OUTPUT_DIR = "/opt/Resonance/data"
os.makedirs(f"{OUTPUT_DIR}/rag", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/vector", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/finetune", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/glossary", exist_ok=True)


def csql(query):
    result = subprocess.run([
        'kubectl', '-n', NS, 'exec', POD, '--',
        'csql', '-u', 'dba', 'carbonet', '-c', query
    ], capture_output=True, text=True, timeout=60)
    return result.stdout


def nvidia_call(prompt, key_idx):
    api_key = API_KEYS[key_idx % len(API_KEYS)]
    cmd = [
        'curl', '-s', '--max-time', '60', NVIDIA_API,
        '-H', f'Authorization: Bearer {api_key}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 300,
            "temperature": 0.1
        })
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        data = json.loads(result.stdout)
        return data['choices'][0]['message']['content'].strip()
    except:
        return ""


def parse_cubrid_output(content):
    glossary = {}
    pattern = r"'([^']+)'\s+'([^']+)'"
    for match in re.finditer(pattern, content):
        eng = match.group(1).strip()
        kor = match.group(2).strip()
        if eng and kor and len(eng) > 1 and len(kor) > 1:
            glossary[eng.lower()] = {"english": eng, "korean": kor}
    return glossary


def detect_category(text):
    text_lower = text.lower()
    if any(x in text_lower for x in ['battery', 'ion', 'lithium', 'li-ion']):
        return "battery"
    if any(x in text_lower for x in ['steel', 'iron', 'metal', 'aluminium', 'copper']):
        return "metal"
    if any(x in text_lower for x in ['plastic', 'polymer', 'polyethylene']):
        return "plastic"
    if any(x in text_lower for x in ['fuel', 'diesel', 'gasoline', 'coal', 'petroleum']):
        return "energy"
    if any(x in text_lower for x in ['fertilizer', 'nitrogen', 'phosphor']):
        return "agriculture"
    return "other"


def build_glossary(glossary):
    print(f"[Glossary] Building {len(glossary)} entries...")
    with open('/opt/Resonance/scripts/glossary.py', 'w') as f:
        f.write("#!/usr/bin/env python3\n")
        f.write(f"# Auto-generated glossary from {len(glossary)} translations\n\n")
        f.write("GLOSSARY = {\n")
        for k, v in sorted(glossary.items()):
            f.write(f'    "{k}": "{v["korean"]}",\n')
        f.write("}\n\n")
        f.write("def lookup(text):\n")
        f.write("    return GLOSSARY.get(text.lower().strip())\n")
    print(f"[Glossary] Saved to /opt/Resonance/scripts/glossary.py")


def build_rag(entries, batch_num, total_batches):
    print(f"[RAG] Generating documents...")
    output_file = f"{OUTPUT_DIR}/rag/batch_{batch_num}.jsonl"
    count = 0
    with open(output_file, 'w') as f:
        for idx, (key, val) in enumerate(entries):
            if idx % total_batches == batch_num:
                eng = val['english']
                kor = val['korean']
                category = detect_category(eng)
                doc = {
                    "id": f"emission_{idx}",
                    "type": "emission_material",
                    "english": eng,
                    "korean": kor,
                    "category": category
                }
                f.write(json.dumps(doc, ensure_ascii=False) + '\n')
                count += 1
    print(f"[RAG] Batch {batch_num}: {count} docs -> {output_file}")


def build_vector(entries, batch_num, total_batches):
    print(f"[Vector] Generating embedding requests...")
    output_file = f"{OUTPUT_DIR}/vector/batch_{batch_num}.jsonl"
    count = 0
    with open(output_file, 'w') as f:
        for idx, (key, val) in enumerate(entries):
            if idx % total_batches == batch_num:
                eng = val['english']
                kor = val['korean']
                prompt = f"Generate semantic embedding for: {eng} ({kor})"
                vec_entry = {
                    "id": f"vec_{idx}",
                    "text": eng,
                    "korean": kor,
                    "embedding_prompt": prompt
                }
                f.write(json.dumps(vec_entry, ensure_ascii=False) + '\n')
                count += 1
    print(f"[Vector] Batch {batch_num}: {count} vectors -> {output_file}")


def build_finetune(entries, batch_num, total_batches):
    print(f"[Fine-tune] Generating training data...")
    instr_file = f"{OUTPUT_DIR}/finetune/instruction_batch_{batch_num}.jsonl"
    chat_file = f"{OUTPUT_DIR}/finetune/chat_batch_{batch_num}.jsonl"
    instr_count = 0
    chat_count = 0

    with open(instr_file, 'w') as fi, open(chat_file, 'w') as fc:
        for idx, (key, val) in enumerate(entries):
            if idx % total_batches == batch_num:
                eng = val['english']
                kor = val['korean']

                # Instruction format
                fi.write(json.dumps({
                    "instruction": "Translate this emission/material term to Korean",
                    "input": eng,
                    "output": kor
                }, ensure_ascii=False) + '\n')
                fi.write(json.dumps({
                    "instruction": "번역词的韩语翻译为英语",
                    "input": kor,
                    "output": eng
                }, ensure_ascii=False) + '\n')
                instr_count += 2

                # Chat format
                fc.write(json.dumps({
                    "messages": [
                        {"role": "system", "content": "You are a Korean translation expert for emission factors and material codes."},
                        {"role": "user", "content": f"Translate to Korean: {eng}"},
                        {"role": "assistant", "content": kor}
                    ]
                }, ensure_ascii=False) + '\n')
                chat_count += 1

    print(f"[Fine-tune] Batch {batch_num}: {instr_count} instructions, {chat_count} chats")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    batch_num = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    total_batches = int(sys.argv[3]) if len(sys.argv) > 3 else 16

    print(f"=== NVIDIA {total_batches}-Key Parallel Training Data Generator ===")
    print(f"Mode: {mode}, Batch: {batch_num}/{total_batches}")

    print("[1/4] Fetching data from CUBRID...")
    data = csql("SELECT english_name, korean_name FROM emission_material_translation WHERE korean_name IS NOT NULL;")
    entries = list(parse_cubrid_output(data).items())
    print(f"      Found {len(entries)} entries")

    if mode == 'glossary':
        build_glossary(dict(entries))
    elif mode == 'rag':
        build_rag(entries, batch_num, total_batches)
    elif mode == 'vector':
        build_vector(entries, batch_num, total_batches)
    elif mode == 'finetune':
        build_finetune(entries, batch_num, total_batches)
    elif mode == 'all':
        build_glossary(dict(entries))
        build_rag(entries, batch_num, total_batches)
        build_vector(entries, batch_num, total_batches)
        build_finetune(entries, batch_num, total_batches)

    print("=== Complete ===")


if __name__ == "__main__":
    main()