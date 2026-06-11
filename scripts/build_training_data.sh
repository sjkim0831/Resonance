#!/bin/bash
# NVIDIA API 16-Key Parallel Training Data Generator
# RAG, VectorDB, Fine-tune 데이터 생성
# Usage: python3 generate_training_data.py [MODE] [BATCH_NUM] [TOTAL_BATCHES]
# Example: python3 generate_training_data.py all 0 16

echo "This script is deprecated. Use:"
echo "  python3 /opt/Resonance/scripts/generate_training_data.py all 0 16"
echo ""
echo "For parallel execution:"
echo "  for i in {0..15}; do nohup python3 /opt/Resonance/scripts/generate_training_data.py all \$i 16 & done"

MODE="${1:-all}"
TOTAL_BATCHES="${2:-16}"
BATCH_NUM="${3:-0}"

NVIDIA_API="https://integrate.api.nvidia.com/v1/chat/completions"
MODEL="qwen/qwen3-next-80b-a3b-instruct"

API_KEYS=(
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
)

POD="cubrid-carbonet-0"
NS="carbonet-prod"
OUTPUT_DIR="/opt/Resonance/data"
mkdir -p $OUTPUT_DIR/{rag,vector,finetune,glossary}

csql() {
    kubectl -n $NS exec $POD -- csql -u 'dba' 'carbonet' -c "$1" 2>/dev/null
}

nvidia_call() {
    local prompt="$1"
    local key_idx="$2"
    local api_key="${API_KEYS[$key_idx]}"

    curl -s --max-time 60 "$NVIDIA_API" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":300,\"temperature\":0.1}" \
        2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['choices'][0]['message']['content'].strip())
except:
    print('')
"
}

echo "=== NVIDIA 16-Key Parallel Training Data Generator ==="
echo "Mode: $MODE, Batches: $TOTAL_BATCHES, Current: $BATCH_NUM"
echo "======================================================"

# Get data from CUBRID
get_translation_data() {
    csql "SELECT english_name, korean_name FROM emission_material_translation WHERE korean_name IS NOT NULL;" 2>/dev/null
}

# Parse CUBRID output
parse_cubrid_output() {
    python3 << PYEOF
import re, sys
content = sys.stdin.read()
glossary = {}
pattern = r"'([^']+)'\s+'([^']+)'"
for match in re.finditer(pattern, content):
    eng = match.group(1).strip()
    kor = match.group(2).strip()
    if eng and kor and len(eng) > 1 and len(kor) > 1:
        key = eng.lower()
        glossary[key] = {"english": eng, "korean": kor}
print(f"PARSED:{len(glossary)}")
for k, v in glossary.items():
    print(f"ENTRY:{k}|{v['english']}|{v['korean']}")
PYEOF
}

# Build RAG Documents
build_rag_data() {
    echo "[RAG] Generating documents..."

    data=$(get_translation_data | parse_cubrid_output)
    count=$(echo "$data" | head -1 | grep -oP 'PARSED:\K\d+')
    echo "[RAG] Processing $count entries..."

    rag_docs=()
    idx=0
    while IFS= read -r line; do
        if [[ "$line" =~ ^ENTRY: ]]; then
            parts=(${line#ENTRY:})
            eng="${parts[1]}"
            kor="${parts[2]}"

            # Generate category
            category="other"
            LOWER_ENG=$(echo "$eng" | tr '[:upper:]' '[:lower:]')
            if echo "$LOWER_ENG" | grep -qE "(battery|ion|lithium|li-ion)"; then
                category="battery"
            elif echo "$LOWER_ENG" | grep -qE "(steel|iron|metal|aluminium|copper)"; then
                category="metal"
            elif echo "$LOWER_ENG" | grep -qE "(plastic|polymer|polyethylene)"; then
                category="plastic"
            elif echo "$LOWER_ENG" | grep -qE "(fuel|diesel|gasoline|coal|petroleum)"; then
                category="energy"
            elif echo "$LOWER_ENG" | grep -qE "(fertilizer|nitrogen|phosphor)"; then
                category="agriculture"
            fi

            # Distribute to batches
            batch_idx=$((idx % TOTAL_BATCHES))
            if [ $batch_idx -eq $BATCH_NUM ]; then
                cat >> "$OUTPUT_DIR/rag/batch_$BATCH_NUM.jsonl" << DOCEOF
{"id":"emission_${idx}","type":"emission_material","english":"$eng","korean":"$kor","category":"$category"}
DOCEOF
            fi
            idx=$((idx + 1))
        fi
    done <<< "$data"

    echo "[RAG] Batch $BATCH_NUM: $(wc -l < $OUTPUT_DIR/rag/batch_$BATCH_NUM.jsonl 2>/dev/null || echo 0) docs"
}

# Build VectorDB Embedding Requests
build_vector_data() {
    echo "[Vector] Generating embedding requests..."

    data=$(get_translation_data | parse_cubrid_output)
    count=$(echo "$data" | head -1 | grep -oP 'PARSED:\K\d+')
    echo "[Vector] Processing $count entries..."

    idx=0
    while IFS= read -r line; do
        if [[ "$line" =~ ^ENTRY: ]]; then
            parts=(${line#ENTRY:})
            eng="${parts[1]}"
            kor="${parts[2]}"

            batch_idx=$((idx % TOTAL_BATCHES))
            if [ $batch_idx -eq $BATCH_NUM ]; then
                # Generate embedding prompt
                prompt="Generate semantic embedding vector for: $eng ($kor). Output JSON: {\"text\":\"$eng\",\"embedding\":[0.0,...]}"
                embedding_result=$(nvidia_call "$prompt" "$BATCH_NUM")

                cat >> "$OUTPUT_DIR/vector/batch_$BATCH_NUM.jsonl" << VECEOF
{"id":"vec_${idx}","text":"$eng","korean":"$kor","embedding_prompt":"$prompt","embedding_result":"$embedding_result"}
VECEOF
            fi
            idx=$((idx + 1))
        fi
    done <<< "$data"

    echo "[Vector] Batch $BATCH_NUM: $(wc -l < $OUTPUT_DIR/vector/batch_$BATCH_NUM.jsonl 2>/dev/null || echo 0) vectors"
}

# Build Fine-tuning Data
build_finetune_data() {
    echo "[Fine-tune] Generating training data..."

    data=$(get_translation_data | parse_cubrid_output)
    count=$(echo "$data" | head -1 | grep -oP 'PARSED:\K\d+')
    echo "[Fine-tune] Processing $count entries..."

    instruction_data=()
    chat_data=()
    idx=0

    while IFS= read -r line; do
        if [[ "$line" =~ ^ENTRY: ]]; then
            parts=(${line#ENTRY:})
            eng="${parts[1]}"
            kor="${parts[2]}"

            batch_idx=$((idx % TOTAL_BATCHES))
            if [ $batch_idx -eq $BATCH_NUM ]; then
                # Instruction format
                cat >> "$OUTPUT_DIR/finetune/instruction_batch_$BATCH_NUM.jsonl" << FTEOF
{"instruction":"Translate this emission/material term to Korean","input":"$eng","output":"$kor"}
FTEOF
                cat >> "$OUTPUT_DIR/finetune/instruction_batch_$BATCH_NUM.jsonl" << FTEOF
{"instruction":"번역词的韩语翻译为英语","input":"$kor","output":"$eng"}
FTEOF

                # Chat format
                cat >> "$OUTPUT_DIR/finetune/chat_batch_$BATCH_NUM.jsonl" << CHATEOF
{"messages":[{"role":"system","content":"You are a Korean translation expert for emission factors and material codes."},{"role":"user","content":"Translate to Korean: $eng"},{"role":"assistant","content":"$kor"}]}
CHATEOF
            fi
            idx=$((idx + 1))
        fi
    done <<< "$data"

    echo "[Fine-tune] Batch $BATCH_NUM: $(wc -l < $OUTPUT_DIR/finetune/instruction_batch_$BATCH_NUM.jsonl 2>/dev/null || echo 0) instruction samples"
}

# Build Glossary
build_glossary_data() {
    echo "[Glossary] Building translation dictionary..."

    data=$(get_translation_data | parse_cubrid_output)
    count=$(echo "$data" | head -1 | grep -oP 'PARSED:\K\d+')
    echo "[Glossary] Processing $count entries..."

    python3 << PYEOF
import re, sys
content = sys.stdin.read()
glossary = {}
pattern = r"'([^']+)'\s+'([^']+)'"
for match in re.finditer(pattern, content):
    eng = match.group(1).strip()
    kor = match.group(2).strip()
    if eng and kor and len(eng) > 1 and len(kor) > 1:
        glossary[eng.lower()] = kor

with open('/opt/Resonance/scripts/glossary.py', 'w') as f:
    f.write("#!/usr/bin/env python3\n")
    f.write(f"# Auto-generated glossary from {len(glossary)} translations\n\n")
    f.write("GLOSSARY = {\n")
    for k, v in sorted(glossary.items()):
        f.write(f'    "{k}": "{v}",\n')
    f.write("}\n\n")
    f.write("def lookup(text):\n")
    f.write("    return GLOSSARY.get(text.lower().strip())\n")

print(f"glossary.py: {len(glossary)} entries")
PYEOF
}

# Main execution
case "$MODE" in
    rag)
        build_rag_data
        ;;
    vector)
        build_vector_data
        ;;
    finetune)
        build_finetune_data
        ;;
    glossary)
        build_glossary_data
        ;;
    all|"")
        build_glossary_data
        build_rag_data
        build_vector_data
        build_finetune_data
        ;;
esac

echo "=== Complete ==="
echo "Output: $OUTPUT_DIR"
ls -la $OUTPUT_DIR/*/batch_$BATCH_NUM.* 2>/dev/null || ls -la $OUTPUT_DIR/*/ 2>/dev/null