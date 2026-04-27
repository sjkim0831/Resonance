# Resonance

Monorepo workspace for the Resonance project.

## Structure

- `apps/` - runnable applications
- `modules/` - shared application modules
- `projects/` - project-specific code
- `catalog/` - catalog data and metadata
- `docs/` - documentation

## Current Operations Board

체스판 기준으로 Resonance는 공통 프레임워크와 운영 콘솔이 중앙을 잡고, Carbonet 프로젝트는 얇은 바인딩/런타임 말로 움직인다.

- Kubernetes: Docker Desktop `docker-desktop` context, `operations-console` and `carbonet-runtime` running.
- Build version management: `data/version-control/k8s-runtime-status-20260427.json`.
- Theme management: `data/theme-registry/theme-registry.json`.
- Project split: `data/project-boundary/resonance-carbonet-boundary-contract.json`.
- AI/Hermes: `data/ai-runtime/hermes-rag-context-pack.json` and `data/ai-runtime/deterministic-agent-policy.json`.

## Governance Gate

Run the full non-mutating gate before changing deployment, version, theme, project boundary, or AI agent policy:

```bash
bash ops/scripts/run-resonance-governance-gate.sh
```

Optional live model check:

```bash
RUN_MODEL_GATE=true MODEL=gemma3:4b bash ops/scripts/run-resonance-governance-gate.sh
```

The gate verifies:

- build version metadata matches the current Kubernetes runtime
- theme registry is bounded and presentation-only
- Carbonet/Resonance project boundary is valid
- deterministic agent policy keeps models out of dangerous direct execution
- Hermes/RAG smoke passes against the running cluster
