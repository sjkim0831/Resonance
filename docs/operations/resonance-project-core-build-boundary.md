# Resonance / Project-Core Build Boundary

This repository now treats runtime changes as four separate lanes. The goal is to keep ordinary screen work out of Java builds and to make the remaining build/deploy cases explicit.

## Lanes

| Lane | Paths | Build / deploy rule |
| --- | --- | --- |
| `project` | `projects/carbonet-frontend/src/main/resources/static/react-app/**`, `projects/carbonet-assets/static/**`, `projects/carbonet-backend-metadata/**`, runtime manifest/config metadata | No Gradle build. No image build. No rollout. Apply through overlay/metadata scripts. |
| `project-core` | `apps/project-runtime/**`, `apps/carbonet-app/**`, `modules/resonance-common/carbonet-common-core/**`, Carbonet metadata/help/observability project modules, `projects/carbonet-frontend/source/**` | Build and redeploy the project runtime only. |
| `resonance-core` | Generic framework contracts, auth, mapper infra, execution gate, runtime/version control core | Build framework modules first. Runtime rollout only when the project runtime consumes the changed artifact. |
| `resonance-adaptor` / `resonance-ops` | Screenbuilder adapters and operations modules/scripts | Build or dry-run only the affected unit. Deploy only when an active runtime dependency changes. |

## Commands

Classify current changes:

```bash
bash ops/scripts/resonance-change-classifier.sh
```

Apply screen/static/backend metadata without runtime redeploy:

```bash
bash ops/scripts/resonance-screen-overlay-apply.sh
```

Build shared framework only:

```bash
bash ops/scripts/resonance-core-build.sh core
bash ops/scripts/resonance-core-build.sh adaptor
bash ops/scripts/resonance-core-build.sh ops
```

Build and deploy project runtime only:

```bash
bash ops/scripts/resonance-project-core-deploy.sh
```

When the working tree already contains unrelated agent work, classify only the intended change set:

```bash
bash ops/scripts/resonance-change-classifier.sh --staged
bash ops/scripts/resonance-project-core-deploy.sh --staged
```

Let the AI fast-development lane choose the safest available path:

```bash
bash ops/scripts/resonance-ai-fast-dev.sh --staged
```

## Java Simplification Rule

Do not add a new Java controller for each screen behavior. Add Java only when a new stable runtime capability is required.

Prefer these runtime-configurable surfaces:

- menu name/path/exposure/dependent-screen updates through existing generic admin menu APIs
- screen definitions through backend metadata and builder registry records
- static React assets through the mounted `react-app` overlay
- operational dashboards through JSON endpoints that read live system state generically
- project-specific labels, mappings, and screen contracts through DB or `projects/carbonet-backend-metadata/**`

Java remains necessary for:

- new transaction boundaries
- new database writes that cannot be represented by an existing generic command
- new security/authorization gates
- new integration drivers
- new scheduled/batch execution logic
- mapper/schema changes

## Current GraalVM Status

The active runtime image uses a JVM base image and runs `java -jar`, not a GraalVM native executable. GraalVM native-image would not remove build/deploy needs for Java changes; it would make Java changes require a native-image rebuild.

## Target Direction

1. Keep `resonance-core` stable and generic.
2. Move project business APIs and Carbonet-specific admin behavior into `project-core`.
3. Convert ordinary screens to builder/metadata/overlay so screen changes remain in `project` lane.
4. Add generic runtime commands instead of one-off Java endpoints.
5. Use classifier output before every AI-agent change to prevent accidental framework rebuilds or container churn.
