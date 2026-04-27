# Resonance Session Handoff: AI Runtime and Model Gate

Date: 2026-04-27
Remote host: `100.116.50.74`
User: `sjkim`
Canonical root: `/opt/Resonance`
Browser URL: `http://100.116.50.74:18082`

## Current State

Resonance is now the canonical framework root. Carbonet runs as the project runtime under Kubernetes.

Current Kubernetes runtime:

- Namespace: `carbonet-local`
- Deployment: `carbonet-p003`
- Health: `UP`
- Browser tunnel: `0.0.0.0:18082 -> pod:8080`

Current local AI runtime:

- Ollama is installed and has:
  - `gemma3:4b`
  - `qwen2.5-coder:3b`
  - `qwen2.5-coder:14b-instruct`
- vLLM runs as Docker container `resonance-vllm`.
- vLLM endpoint:
  - host: `http://127.0.0.1:8000/v1`
  - Kubernetes pod route: `http://172.18.0.1:8000/v1`
- Current vLLM served model:
  - `gemma-4-e2b-it`
  - source: `google/gemma-4-E2B-it`

GPU:

- NVIDIA GeForce RTX 5090
- 32 GB VRAM
- `nvidia-smi` is available.

## Important Decision

The goal is not to make the model search harder. The goal is to make the framework deterministic enough that small models can work safely.

Current model routing decision:

- `classify`: Ollama `gemma3:4b`
- `route-resolve`: deterministic maps/scripts first, no model first
- `rank-files`: `gemma3:4b` or restricted `qwen2.5-coder:3b` over capped candidates only
- `plan`: vLLM `gemma-4-e2b-it`
- `implement-small`: Ollama `qwen2.5-coder:14b-instruct`, selected files only
- `implement-risky`: external Codex/Hermes until local patch gates mature
- `verify`: deterministic scripts first, model only summarizes failures
- `deploy`, `backup`, `restart`, `k8s`, `db_migration`: deterministic scripts only

## Model Gate Results

Passing models:

- `gemma3:4b`
  - Runtime: Ollama
  - Route gate: PASS
  - Safety gate: PASS
  - Use for: small classifier, route/safety gate, Korean summary

- `gemma-4-e2b-it`
  - Runtime: vLLM
  - Source: `google/gemma-4-E2B-it`
  - Runtime gate: PASS
  - Route gate: PASS
  - Safety gate: PASS
  - Use for: bounded planning, route discipline, safety classification

Restricted or failed models:

- `qwen2.5-coder:3b`
  - Route gate: PASS
  - Safety gate: FAIL
  - Use only for harmless summaries or bounded non-dangerous tasks.

- `qwen2.5-coder:14b-instruct`
  - Route gate: PASS
  - Safety gate: FAIL
  - Use only for selected-file implementation after deterministic context selection.

- `qwen2.5-coder-7b-instruct` through vLLM
  - Runtime gate: PASS
  - Route gate: PASS
  - Safety gate: FAIL
  - Do not use as operations/safety authority.

- `devstral-small-2505`
  - Source: `mistralai/Devstral-Small-2505`
  - Runtime gate: FAIL/TIMEOUT on RTX 5090 32GB profile
  - It downloaded and began loading, occupied most GPU memory, but did not expose `/v1/models` in the operational timeout.
  - Retry only with quantized checkpoint or smaller runtime profile.

## Files Updated

Docs:

- `/opt/Resonance/docs/resonance-wave-38-local-model-promotion-gates.md`
- `/opt/Resonance/docs/resonance-wave-39-model-gate-results.md`

Skill:

- `/opt/Resonance/skills/resonance-workflow/SKILL.md`

Runtime config:

- `/opt/Resonance/data/ai-runtime/ollama-control-plane.json`
- `/opt/Resonance/data/ai-runtime/agent-stage-model-matrix.json`

Java defaults:

- `/opt/Resonance/modules/resonance-ops/ollama-control-plane/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java`
- `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java`

Scripts:

- `/opt/Resonance/ops/scripts/probe-ai-model-registries.sh`
- `/opt/Resonance/ops/scripts/run-ollama-model-gate.sh`
- `/opt/Resonance/ops/scripts/run-vllm-model-gate.sh`
- `/opt/Resonance/ops/scripts/start-vllm-openai.sh`
- `/opt/Resonance/ops/scripts/stop-vllm-openai.sh`
- `/opt/Resonance/ops/scripts/health-vllm-openai.sh`
- `/opt/Resonance/ops/scripts/build-independent-runtimes.sh`

Build script fix:

- `ops/scripts/build-independent-runtimes.sh` now uses `-Dmaven.test.skip=true`.
- Reason: `-DskipTests` skipped test execution but still compiled tests; existing test dependencies for JUnit/Mockito are incomplete.

## Verification Commands

Check app:

```bash
kubectl -n carbonet-local get pods -o wide
kubectl -n carbonet-local get deploy
POD="$(kubectl -n carbonet-local get pod -l app=carbonet-p003 -o jsonpath='{.items[0].metadata.name}')"
kubectl -n carbonet-local exec "$POD" -- sh -lc 'wget -qO- http://127.0.0.1:8080/actuator/health || curl -fsS http://127.0.0.1:8080/actuator/health'
```

Restart browser tunnel:

```bash
pkill -f 'kubectl.*port-forward.*18082' || true
kubectl -n carbonet-local port-forward --address 0.0.0.0 deployment/carbonet-p003 18082:8080 >/tmp/carbonet-port-forward.log 2>&1 &
curl -fsS http://127.0.0.1:18082/actuator/health
```

Check vLLM:

```bash
cd /opt/Resonance
bash ops/scripts/health-vllm-openai.sh
curl -fsS http://127.0.0.1:8000/v1/models
```

Check Pod-to-vLLM:

```bash
POD="$(kubectl -n carbonet-local get pod -l app=carbonet-p003 -o jsonpath='{.items[0].metadata.name}')"
kubectl -n carbonet-local exec "$POD" -- sh -lc 'wget -qO- http://172.18.0.1:8000/v1/models || curl -fsS http://172.18.0.1:8000/v1/models'
```

Run gates:

```bash
cd /opt/Resonance
bash ops/scripts/probe-ai-model-registries.sh
bash ops/scripts/run-ollama-model-gate.sh gemma3:4b
bash ops/scripts/run-vllm-model-gate.sh google/gemma-4-E2B-it gemma-4-e2b-it
```

Build and image refresh:

```bash
cd /opt/Resonance
bash ops/scripts/build-independent-runtimes.sh
bash ops/scripts/build-kind-runtime-image.sh
kubectl -n carbonet-local rollout restart deployment/carbonet-p003
kubectl -n carbonet-local rollout status deployment/carbonet-p003 --timeout=240s
```

## Next Work

1. Add a real patch-quality gate.
   - Use a fixed candidate file pack for `/admin/platform/ollama`.
   - Model must return a patch touching selected files only.
   - Model must include verification command.
   - Model must not invent paths.

2. Add AI runtime status to admin UI if not already fully visible.
   - Show Ollama models.
   - Show vLLM endpoint.
   - Show current served model.
   - Show last gate result.
   - Master-only controls for start/stop/switch model.

3. Add deterministic route-map expansion for admin pages.
   - No broad scan.
   - URL/menu/controller/component mapping should resolve before any model call.

4. Add script-only operation guard.
   - DB migration, backup, restart, k8s, deploy must go through approved scripts.
   - AI can draft but not execute.

5. Keep Qwen as bounded code assistant, not safety authority.

6. Retry Devstral only with quantized checkpoint or lower-memory profile.

## Notes for Next Agent

Do not start by scanning all files.

Start from:

1. `/opt/Resonance/skills/resonance-workflow/SKILL.md`
2. `/opt/Resonance/docs/resonance-wave-39-model-gate-results.md`
3. `/opt/Resonance/data/ai-runtime/ollama-control-plane.json`
4. `/opt/Resonance/data/ai-runtime/agent-stage-model-matrix.json`

The current safe mental model:

- Resonance operations platform is the space station.
- Common framework is the jetpack.
- Carbonet project is the rocket.
- Builder is the launch factory.
- AI must operate inside deterministic rails, not replace them.

