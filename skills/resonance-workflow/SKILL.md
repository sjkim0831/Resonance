# Resonance Workflow Skill

Use this skill for Resonance and Carbonet framework work under /opt/Resonance.

Primary rule:

Never let an AI agent search broadly first. Resolve the target layer and candidate files deterministically, then let the model rank, edit, and explain.

Startup context:

1. Read data/ai-runtime/deterministic-route-map.json.
2. Read data/ai-runtime/agent-stage-model-matrix.json.
3. Read docs/agent/deterministic-3b-agent-playbook.md.
4. Classify the work into operations, common, project, or builder.
5. Select exact files before reading broadly.

Layer boundaries:

- Operations platform is the space station. It owns deploy, k8s, backup, rollback, install, runtime control, Ollama control plane, and version control.
- Common framework is the jetpack. It owns reusable jars, authority and scope foundation, contracts, web support, mapper infra, builder core, and standard framework update absorption.
- Carbonet project is the rocket. It owns thin project-specific pages, project adapter bindings, project config, and project runtime package selection.
- Builder is the launch factory. It owns screen builder, component builder, theme management, scaffolding, and project package generation.

Read budgets:

- Default read cap: 12 files.
- Wide investigation cap: 40 files.
- Implementation cap: 6 edited files.
- If more files are needed, stop and ask for a wave split.

Authority and scope work:

- Prefer the existing scope system.
- Do not introduce a second permission engine.
- Add backend Gate APIs only when adapters need a stable boundary.
- Start from docs/authority-api-review.md and docs/resonance-authority-builder-theme-review.md.
- Builder, theme write, k8s runtime control, deploy, rollback, version-control execution, and AI agent execution are master-only operations.
- `ROLE_ADMIN` must stay safe-by-default for AI Workbench: view only for SR/Codex/WBS, no execute, no approve, no WBS edit, no new-page scaffold access.
- `ROLE_SYSTEM_ADMIN` may create and prepare SR work, but must not approve, execute, run Codex, or edit WBS.
- `ROLE_SYSTEM_MASTER` owns dangerous execution features. Verify with COMTNAUTHORFUNCTIONRELATE in the host Docker CUBRID container `11.2`, DB `carbonet`.

Builder and theme work:

- Keep screen builder core in modules/resonance-builder.
- Keep project-specific page details under projects/carbonet-frontend or project adapters.
- Keep reusable theme tokens and package metadata in builder/common layers.
- Do not embed project business logic into theme files.

Ollama, vLLM, and 3B agent work:

- 3B can classify, rank, make bounded edits, and summarize failures.
- Ollama is the default local runner for qwen2.5-coder and gemma3-class models.
- vLLM is an optional OpenAI-compatible GPU runner for Devstral, Qwen, and Gemma candidates after exact model ids are verified by `/v1/models`.
- Treat `qwen3.5-coder` and `gemma4` as logical candidate names until the local Ollama/vLLM registry confirms exact tags.
- Devstral may plan or draft bounded patches, but only after deterministic route/file selection.
- Deterministic scripts must perform deploy, backup, rollback, k8s apply, and DB migration.
- For local Carbonet Kubernetes reflection, always use `bash ops/scripts/restart-local-carbonet-k8s.sh` from `/opt/Resonance` instead of manual Maven, Docker, `kubectl set image`, or ad hoc port-forward steps.
- If only the already-built local Kubernetes runtime needs to be reattached or verified, use `SKIP_FRONTEND=true SKIP_IMAGE_BUILD=true bash ops/scripts/restart-local-carbonet-k8s.sh`.
- If a route cannot be resolved from maps, return NEEDS_ROUTE_MAP instead of scanning the repository.
- Never use vLLM or a larger model to expand the read budget; use it only to improve reasoning over an already capped context pack.

Forbidden scan roots:

- node_modules
- target
- dist
- logs
- var backup folders
- /opt/projects/_archive unless explicitly doing source promotion

Legacy promotion:

- modules/_legacy-candidates is evidence only.
- Promote to modules/resonance-common, modules/resonance-builder, or modules/resonance-ops only after boundary review and build gate.
- projects/legacy-samples is sample evidence only and must not become common code by accident.

Required closeout:

- Changed files.
- Verification command and result.
- Whether route-map, docs, or skill memory needs update.

Model promotion gates:

- A local model is not production-ready until it passes registry, runtime, smoke, route, patch, safety, latency, and closeout gates.
- The verified local defaults are Ollama `qwen2.5-coder:3b`, Ollama `qwen2.5-coder:14b-instruct`, and vLLM `qwen2.5-coder-7b-instruct`.
- Treat Devstral, Qwen3.5, and Gemma4 as candidate families until exact model ids load and pass Resonance gates.
- Never use a larger model to compensate for missing route maps. Add or fix deterministic route maps instead.
- Risky implementation remains external-agent-assisted until local models pass repeated bounded patch and verification gates.


Latest local model gate decision:

- `gemma3:4b` passed local route/safety gates and is the default small classifier/safety model.
- `gemma-4-e2b-it` passed vLLM runtime/route/safety gates and is the verified local GPU planning model.
- Qwen local models are restricted to bounded coding assistance because they failed the strict safety gate.
- Devstral unquantized timed out on RTX 5090 32GB and must not be promoted without quantization or a lower-memory profile.
