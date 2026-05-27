# Hermes Builder Monitoring Automation

## Purpose

This automation binds screen development, Screen Builder governance, monitoring smoke tests, and self-healing probes into one repeatable framework operation.

## Entry Point

```bash
cd /opt/Resonance
bash ops/scripts/hermes-builder-monitoring-automation.sh
```

Default output:

- `var/ai-runtime/builder-monitoring/builder-monitoring-*.report.json`
- `var/ai-runtime/builder-monitoring/builder-monitoring-events.jsonl`
- per-step output files under `var/ai-runtime/builder-monitoring`

## What It Checks

1. Screen Builder module, jar, boundary, and bootstrap audits.
2. Frontend verification for builder and monitoring surfaces.
3. Bootstrap asset freshness for key admin routes.
4. Kubernetes runtime, model stack, and actuator health.
5. Self-healing dry-run/probe unless `APPLY_SELF_HEAL=true` is set.

## Operating Policy

The script is designed as a framework gate. Hermes should run it after screen-builder changes, monitoring page changes, deployment recovery work, or before promoting generated UI code. It records evidence rather than silently claiming success.

Use `APPLY_SELF_HEAL=true` only when automatic recovery is intentionally allowed. The default is a dry-run/probe so maintenance stays safe.
