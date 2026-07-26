# Kilo M2.7 screen handoff

This handoff removes repeated repository discovery before continuing the governed 1,000-screen program.

## Fast entry

```bash
cd /opt/Resonance
bash ops/scripts/start-kilo-m27-screen-agent.sh plan
bash ops/scripts/start-kilo-m27-screen-agent.sh interactive
```

Run the provider probe only for connectivity diagnosis, not immediately before an interactive session; back-to-back NVIDIA requests can trigger provider throttling:

```bash
cd /opt/Resonance
bash ops/scripts/start-kilo-m27-screen-agent.sh prepare
```

The fixed model identity is `nvidia/minimaxai/minimax-m2.7` and interactive implementation uses `codex-m27`. Automated `plan` writes the deterministic live decision to `verified-plan.json` without spending an NVIDIA request; detailed model planning happens in the permission-gated interactive session. `prepare` is the explicit provider connectivity check. The launcher deliberately does not use `--auto` or `--dangerously-skip-permissions`. It also isolates the screen agent from the multi-gigabyte shared Kilo session database, which avoids startup lock and snapshot delays while retaining the normal provider configuration.

## Source of truth order

1. Live preflight JSON generated under `var/ai-runtime/kilo-m27-screen-handoff/`
2. Current quality queue and deploy-gate JSON in the served React overlay
3. Process-runtime metadata and professional screen contracts
4. Historical reports only as hints

## Current known checkpoint

On 2026-07-23 the live files reported 925 routes, average score 95.57, one P2 route, no P0/P1 routes, and a 925/925 deploy gate. Runtime and HAProxy deployments were both 3/3 and actuator readiness was UP. These numbers drift, so every session starts by regenerating preflight evidence.

## Scope boundaries

Ordinary screen work stays in project-owned metadata, static assets, runtime metadata, or the served overlay paths permitted by `AGENTS.md`. The first implementation batch should address the single P2 item and then use reviewed backlog to close the 75-route gap. New route invention is the last option, not the first.

The repository has a large pre-existing dirty state. Never use broad staging, cleanup, reset, or checkout commands. A Kilo change must name its exact files and show that they do not overlap unrelated active work.

## Promotion evidence

A batch is promotable only when it has:

- stable route and contract IDs across a rerun;
- zero duplicate route candidates;
- no P0/P1 regression;
- changed-route smoke passing;
- runtime health still UP;
- an explicit rollback list;
- full 8-shard deploy gate passing at the promotion checkpoint.

## Security note

A historical runtime worktree contains an old NVIDIA parallel test script with embedded API keys. It is not a canonical asset and must not be opened by Kilo, copied, executed, or committed. Provider credentials must remain in the configured Kilo provider/secret store. The exposed keys should be rotated separately by an operator.
