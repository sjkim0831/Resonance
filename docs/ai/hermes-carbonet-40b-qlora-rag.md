# Hermes-Carbonet 40B QLoRA and RAG Operating Notes

## Purpose

The 40B QLoRA adapter teaches the model Resonance framework behavior, Hermes Agent workflows, deployment recovery, and Carbonet development patterns. RAG remains necessary because source code, deployment scripts, and incident memory change faster than model fine-tuning cycles.

## Current 40B Training Source

- HF source: `DavidAU/Qwen3.6-40B-Claude-4.6-Opus-Deckard-Heretic-Uncensored-Thinking`
- Do not train from GGUF. The running GGUF Q4_K_M model is inference-only for llama.cpp.
- QLoRA base path: `/opt/util/ai/fine-tuning/hermes-framework-40b-qlora/models/qwen3.6-40b-hf`
- Adapter output: `/opt/util/ai/fine-tuning/hermes-framework-40b-qlora/outputs/hermes-framework-40b-qlora/final`

## What Belongs in Fine-Tuning

- Stable operating policies: safe restore, stale process cleanup, build/deploy verification, Hermes task decomposition.
- Repeated implementation patterns: admin React page, backend controller/service, CUBRID migration, k8s rollout.
- Korean operator response style and evidence-first reporting.

## What Belongs in RAG/DB

- Current source paths and recently changed files.
- Pattern cards and team routing policy.
- Incident memory, rollback notes, exact deployment logs, model runtime registry, menu/route details.
- Generated SQL assets from `ops/scripts/hermes-sync-project-knowledge.sh`.

## Required Syncs

After framework or Hermes changes:

```bash
cd /opt/Resonance
bash ops/scripts/hermes-sync-project-knowledge.sh --apply --project-id carbonet
python3 ops/scripts/init-pattern-card-db.py
```

After model training changes:

```bash
cd /opt/util/ai/fine-tuning/hermes-framework-40b-qlora
bash scripts/monitor_training.sh
```

## Verification

- `data/train.summary.json` records the SFT data count.
- RAG sync logs in `/opt/Resonance/var/ai-runtime/hermes-project-knowledge`.
- Pattern card registry at `/opt/Resonance/data/ai-runtime/pattern-card-registry.sqlite`.
- CUBRID project knowledge schema/data apply logs must show committed rows.
