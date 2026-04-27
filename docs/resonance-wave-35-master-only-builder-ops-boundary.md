# Resonance Wave 35 - Master-only Builder and Operations Boundary

Date: 2026-04-27 KST
Canonical root: `/opt/Resonance`

## Purpose

Lock dangerous platform operations behind `ROLE_SYSTEM_MASTER` while keeping ordinary admin roles usable for safe viewing and preparation work.

This wave covers AI Workbench, SR execution, Codex execution, WBS edit, new page access, builder/theme/k8s/deploy/rollback/version-control policy, and runtime verification after the permission hardening patch.

## Boundary Decision

Dangerous operations must not be granted to `ROLE_ADMIN`.

`ROLE_SYSTEM_MASTER` owns:

- SR approve and execute.
- Codex execute.
- WBS edit.
- New page scaffold access.
- Builder and theme write operations.
- Kubernetes runtime control.
- Deploy, rollback, and version-control execution.
- AI agent execution.

`ROLE_SYSTEM_ADMIN` can help prepare work but cannot execute dangerous changes:

- SR view/create/prepare.
- Codex view.
- WBS view.
- New page view.
- System audit log view.

`ROLE_ADMIN` is safe-by-default for this area:

- SR view.
- Codex view.
- WBS view.
- System audit log view.

## Changed Runtime Policy

Updated source:

```text
/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/codex/service/AdminAiWorkbenchMenuBootstrapSupport.java
```

Updated catalog:

```text
/opt/Resonance/docs/ai/40-backend/auth-policy.csv
```

The policy catalog now includes a master-only platform-builder entry covering:

```text
BUILDER_*|THEME_*|K8S_*|DEPLOY_*|ROLLBACK_*|VERSION_CONTROL_*|AI_AGENT_EXECUTE
```

## Verification

Full canonical build succeeded:

```bash
mvn clean package -Dmaven.test.skip=true
```

Runtime image refresh and kind rollout succeeded:

```bash
ops/scripts/build-kind-runtime-image.sh
kubectl -n carbonet-local rollout restart deploy/carbonet-p003
kubectl -n carbonet-local rollout status deploy/carbonet-p003
```

Health check succeeded:

```json
{"status":"UP","groups":["liveness","readiness"]}
```

Actual app database is not the in-cluster CUBRID pod. The running app uses:

```text
CUBRID_HOST=172.18.0.1
DB_USERNAME=dba
DB_PASSWORD=
```

The authoritative DB is the remote host Docker container:

```text
container: 11.2
database: carbonet
```

Authority-feature verification query result:

```text
ROLE_ADMIN:
  A1900102_VIEW
  A1900103_VIEW
  A1900104_VIEW

ROLE_SYSTEM_ADMIN:
  A1900102_CREATE
  A1900102_PREPARE
  A1900102_VIEW
  A1900103_VIEW
  A1900104_VIEW
  A1900106_VIEW

ROLE_SYSTEM_MASTER:
  A1900102_APPROVE
  A1900102_CREATE
  A1900102_EXECUTE
  A1900102_PREPARE
  A1900102_VIEW
  A1900103_EXECUTE
  A1900103_VIEW
  A1900104_EDIT
  A1900104_VIEW
  A1900106_VIEW
```

This matches the intended master-only execution boundary.

## Follow-up

- Add dedicated operations-console pages for platform install, builder, theme management, k8s runtime, Ollama router, deploy/rollback, and version control.
- Keep those pages under operations/common layers, not Carbonet project code.
- Carbonet should remain a thin project adapter/runtime package.
- Any future AI agent execution API must check `ROLE_SYSTEM_MASTER` or an equivalent master-only feature code before running.

