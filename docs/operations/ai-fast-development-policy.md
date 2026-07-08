# AI Fast Development Policy

This policy replaces the goal of forcing every change into buildless/deployless development. The default is the fastest safe lane for the kind of change being made.

## Decision

Use standard Java/eGov structure when the feature affects durable business behavior. Use metadata/overlay only for safe runtime-configurable behavior.

## Lanes By Speed And Risk

| Lane | Use for | Runtime action |
| --- | --- | --- |
| Prompt-driven implementation | AI creates the standard files and tests from a request | No runtime action by itself |
| Front overlay | React source changes that build to mounted static assets | npm/Vite build only, no image, no rollout |
| Metadata / Runtime command | menu, mapping, labels, safe command parameters, screen metadata | file/DB metadata apply, no runtime rollout |
| Project-core Java | transaction, DB write, authorization, audit, integration, batch | project runtime rolling deploy |
| Resonance core | shared framework, contracts, execution gates | framework review/build, runtime deploy only if consumed |

## Default Rule

Prefer this default for new business features:

```text
Java standard structure + project-core rolling deploy
```

Use metadata when all of these are true:

- the operation is already supported by a safe generic engine
- allowed parameters are known and validated
- authorization and audit policy are already covered
- no new transaction behavior is needed
- no new mapper/schema/integration logic is needed

## Java Is Not Buildless

Java source changes require compile and a new runtime artifact. GraalVM native-image does not change that; it makes the generated runtime even more fixed. The safe target is not Java buildless. The safe target is Java zero/low-downtime project-core deployment.

## AI Agent Workflow

1. Classify the intended changed files.
2. Choose the fastest safe lane.
3. For Java, generate standard Controller/Service/Mapper/DTO structure where appropriate.
4. Compile project-core before deployment.
5. Use rolling deployment, never manual pod deletion as a normal path.
6. Verify health, route freshness, and changed screen behavior.
7. Keep generated static overlay and runtime source separated.

## Canonical Commands

Classify:

```bash
bash ops/scripts/resonance-change-classifier.sh --staged
```

Run the automatic fast lane:

```bash
bash ops/scripts/resonance-ai-fast-dev.sh --staged
```

Dry-run the automatic fast lane:

```bash
bash ops/scripts/resonance-ai-fast-dev.sh --dry-run --staged
```

Project-core Java deploy only:

```bash
bash ops/scripts/resonance-project-core-deploy.sh --staged
```

Screen overlay only:

```bash
bash ops/scripts/resonance-screen-overlay-apply.sh
```

## Standard Java First Cases

Use Java standard structure for:

- transaction boundaries
- insert/update/delete with business rules
- permission checks
- audit logs
- DB mapper/schema behavior
- external API integrations
- batch/scheduler logic
- file processing
- complex validation

## Metadata First Cases

Use metadata/overlay for:

- menu names and paths
- screen mapping
- visibility flags
- labels and copy
- dashboard display composition
- safe read-only queries already supported by a generic engine
