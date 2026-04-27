# Remote Codex Handoff - Resonance / Carbonet

Date: 2026-04-27 KST
Remote: `sjkim@100.116.50.74`
Canonical root: `/opt/Resonance`

## User Goal

Build Resonance as the framework/operations/common platform, keep Carbonet as a thin project package, and make the system maintainable by deterministic code-first automation plus small local Ollama/3B-style AI agents.

The user's mental model:

- Operations/platform = space station
- Common framework/JAR = jetpack
- Project package = rocket
- Builder = assembly bay/control deck that scaffolds project screens/packages and includes common JARs for deployment

The user wants:

- `/opt/Resonance` as canonical root, not `/opt/projects/Resonance`.
- Old `/opt/projects/carbonet` removable after migration.
- Project/common/operations/builder boundaries clear.
- Project code thin and stable; version-up-prone code belongs in Resonance/common.
- Project runtime independently buildable/runnable/deployable with common JARs.
- Kubernetes local runtime for browser verification.
- Admin UI/operations pages for install, AI agent, Ollama router, builder, theme management, deploy/rollback/version control.
- Master-only access for dangerous operations.
- Hermes can remain a development-side external agent, but Carbonet/Resonance runtime should work with Ollama + custom control plane without Hermes.

## Current Remote State

- `/opt/Resonance` exists and is canonical.
- `/opt/projects/carbonet` was archived to `/opt/projects/_archive/carbonet-20260426-183930` and is not the active root.
- `/opt/projects/Resonance` was removed.
- `/opt/Resonance` size was previously about 484 MB.
- Full Maven build has succeeded after recent changes.
- Kubernetes kind cluster `kind-dev` is running.
- Namespace: `carbonet-local`
- Deployment: `carbonet-p003`
- Service: `carbonet-p003`
- CUBRID runs in namespace `carbonet-local`.
- Browser access is via local tunnel:
  - local URL: `http://127.0.0.1:18082/`
  - health URL: `http://127.0.0.1:18082/actuator/health`
- Last verified health:
  - Pod-local health returned `{"status":"UP","groups":["liveness","readiness"]}`.
  - Local port-forward health also returned UP after restarting the port-forward.

## Important Verified Account

- Admin user `webmaster` exists.
- Candidate password `rhdxhd12` was verified against the actual app password algorithm.
- `webmaster` has `ROLE_SYSTEM_MASTER`.
- Do not print password hash.

## Recently Completed Changes

### 1. Canonical Build and Runtime Refresh

Commands run successfully:

```bash
/mnt/c/Users/Kim\ SeongJoon/Documents/Codex/2026-04-25-venv-nix-hermes-readme-interacted-with-2/scripts/wsl_remote_app_cutover.sh build-canonical-apps
/mnt/c/Users/Kim\ SeongJoon/Documents/Codex/2026-04-25-venv-nix-hermes-readme-interacted-with-2/scripts/wsl_remote_app_cutover.sh refresh-kind-carbonet-runtime-image
```

Results:

- Full reactor build succeeded.
- Project runtime image was rebuilt and loaded into kind.
- Deployment `carbonet-p003` rolled out successfully.
- New Pod was running.

### 2. Runtime Image Builder Fix

Remote script fixed earlier:

```text
/opt/Resonance/ops/scripts/build-kind-runtime-image.sh
```

It now builds a release image context under:

```text
/opt/Resonance/var/releases/P003/image-context
```

and includes:

- `apps/project-runtime/target/project-runtime.jar`
- optional `projects/carbonet-adapter/target/*.jar`
- template config

### 3. AI Workbench / Operations Permission Hardening

Patched remote file:

```text
/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/codex/service/AdminAiWorkbenchMenuBootstrapSupport.java
```

Patched documentation:

```text
/opt/Resonance/docs/ai/40-backend/auth-policy.csv
```

Intended authority boundary:

- `ROLE_SYSTEM_MASTER`
  - Full AI Workbench authority.
  - SR view/create/approve/prepare/execute.
  - Codex view/execute.
  - WBS view/edit.
  - New Page view.
  - System audit log view.
  - Builder/theme/k8s/deploy/rollback/version/AI execute authority.

- `ROLE_SYSTEM_ADMIN`
  - Help view/edit.
  - SR view/create/prepare.
  - Codex view only.
  - WBS view only.
  - New Page view.
  - System audit log view.
  - No SR approve/execute.
  - No Codex execute.
  - No WBS edit.

- `ROLE_ADMIN`
  - Help view/edit.
  - SR view only.
  - Codex view only.
  - WBS view only.
  - System audit log view.
  - No SR create/approve/execute.
  - No Codex execute.
  - No WBS edit.
  - No New Page view.

- `ROLE_OPERATION_ADMIN`
  - No AI Workbench dangerous authority.

`auth-policy.csv` also added master-only policy for:

```text
AMENU_PLATFORM_BUILDER
BUILDER_*|THEME_*|K8S_*|DEPLOY_*|ROLLBACK_*|VERSION_CONTROL_*|AI_AGENT_EXECUTE
/admin/system/platform-install
```

### 4. Build Verification After Permission Patch

Common module build succeeded:

```bash
mvn -pl modules/resonance-common/carbonet-common-core -am -Dmaven.test.skip=true package
```

Full build also succeeded afterward:

```bash
mvn clean package -Dmaven.test.skip=true
```

## Last Interrupted Point

The previous Codex session was interrupted while trying to verify the actual DB rows in `COMTNAUTHORFUNCTIONRELATE`.

Local helper created:

```text
scripts/check_remote_auth_boundary.sh
```

It was started but user interrupted it after a long wait. It may have hung because `kubectl exec deploy/cubrid` or `csql -S demodb` did not return quickly.

Next Codex should not blindly re-run the long script. Instead:

1. First inspect CUBRID pod and database name.
2. Run a very small timeout-limited query.
3. If server-mode `csql -S demodb` hangs, use client mode to the service or app-side JDBC query.

Target query:

```sql
SELECT AUTHOR_CODE, FEATURE_CODE, GRANT_AUTHORITY_YN
FROM COMTNAUTHORFUNCTIONRELATE
WHERE AUTHOR_CODE IN ('ROLE_ADMIN', 'ROLE_SYSTEM_ADMIN', 'ROLE_SYSTEM_MASTER')
  AND FEATURE_CODE IN (
    'A1900102_VIEW',
    'A1900102_CREATE',
    'A1900102_APPROVE',
    'A1900102_PREPARE',
    'A1900102_EXECUTE',
    'A1900103_VIEW',
    'A1900103_EXECUTE',
    'A1900104_VIEW',
    'A1900104_EDIT',
    'A1900106_VIEW'
  )
ORDER BY AUTHOR_CODE, FEATURE_CODE;
```

Expected result:

- `ROLE_ADMIN` should have only safe view-level rows for these features.
- `ROLE_SYSTEM_ADMIN` should not have `A1900102_APPROVE`, `A1900102_EXECUTE`, `A1900103_EXECUTE`, or `A1900104_EDIT`.
- `ROLE_SYSTEM_MASTER` should have full rows.

## Local Helper Scripts Added in Desktop Workspace

These are on the current Windows/Codex workspace, not necessarily committed:

```text
scripts/check_remote_carbonet_status.sh
scripts/restart_remote_carbonet_port_forward.sh
scripts/check_remote_auth_boundary.sh
scripts/harden_ai_workbench_master_boundary.py
```

Useful commands from local desktop WSL:

```bash
bash /mnt/c/Users/Kim\ SeongJoon/Documents/Codex/2026-04-25-venv-nix-hermes-readme-interacted-with-2/scripts/check_remote_carbonet_status.sh
bash /mnt/c/Users/Kim\ SeongJoon/Documents/Codex/2026-04-25-venv-nix-hermes-readme-interacted-with-2/scripts/restart_remote_carbonet_port_forward.sh
```

## Current Recommended Next Work

### A. Finish Permission Verification

Do a timeout-limited DB query against `COMTNAUTHORFUNCTIONRELATE`.

If query verifies:

- Write a doc entry:
  - `/opt/Resonance/docs/resonance-wave-35-master-only-builder-ops-boundary.md`
- Update skill docs:
  - `/opt/Resonance/skills/resonance-workflow/SKILL.md`
  - State that builder/theme/k8s/deploy/rollback/version/AI execute are `ROLE_SYSTEM_MASTER` only.

### B. Builder Location and UI Direction

Builder should live in Resonance, not Carbonet:

```text
/opt/Resonance/modules/resonance-builder
/opt/Resonance/apps/operations-console
```

Carbonet should only contain thin project adapter/package code:

```text
/opt/Resonance/projects/carbonet-adapter
```

Admin/operations-only screens:

- platform install page
- builder page
- theme manager
- component builder
- screen builder
- k8s runtime console
- Ollama router/model registry
- AI agent execution console
- deployment/rollback/version control

These should be visible/executable only to `ROLE_SYSTEM_MASTER` unless explicitly made read-only for system admins.

### C. AI Agent / Ollama Deterministic Control Plane

The user wants 3B/local AI to be possible, but only where deterministic guardrails make it safe.

Design rule:

- Do not let 3B AI freely explore hundreds of files.
- Use deterministic index first.
- AI receives only bounded candidate files and contracts.
- All dangerous operations are code-defined workflows, not free-form agent behavior.

Required stages:

1. intent classifier
2. route/file index lookup
3. bounded context packer
4. contract/test generator
5. patch planner
6. deterministic code generator/scaffolder
7. compile/test verifier
8. deployment/rollback controller
9. memory/docs/skills writeback

Model routing suggestion:

- 3B/8B local model: classification, extraction, naming, small DTO/page skeleton, docs summary.
- 8B/14B local model: bounded patch proposals on selected files.
- Cerebras 235B or Codex: hard implementation, ambiguous refactors, architecture, security-sensitive code.
- Gemini large context: optional planner only when massive context is unavoidable.

Core principle:

```text
AI suggests. Deterministic control plane decides, validates, applies, builds, deploys, and rolls back.
```

## Kubernetes Notes

Current browser access:

```text
http://127.0.0.1:18082/
```

If broken, restart forwarding from desktop WSL:

```bash
bash /mnt/c/Users/Kim\ SeongJoon/Documents/Codex/2026-04-25-venv-nix-hermes-readme-interacted-with-2/scripts/restart_remote_carbonet_port_forward.sh
```

NodePort `30083` is not directly reliable because kind host port mapping was not configured for it. Use port-forward/tunnel for now.

## Caution

- Do not delete `/opt/projects/_archive/carbonet-20260426-183930` unless the user explicitly confirms archival removal.
- Do not move canonical root back under `/opt/projects`.
- Do not grant execute/deploy/rollback/builder/theme/k8s permissions to `ROLE_ADMIN`.
- Avoid scanning built frontend assets under:
  - `apps/carbonet-app/src/main/resources/static/react-app/assets`
  - `target`
  - `node_modules`

