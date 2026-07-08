# Resonance Package Inventory

Status captured on 2026-07-08 KST for `/opt/Resonance`.

## Build Packages

These are the only Gradle build packages included by `settings.gradle.kts`.

| Boundary | Included packages | Status |
| --- | --- | --- |
| `resonance-core` | `modules/resonance-common/*` | Active Gradle modules |
| `resonance-adaptor` | `modules/resonance-builder/*` | Active Gradle modules |
| `project-core` | `apps/project-runtime`, `apps/carbonet-app` | Active Gradle modules |
| `resonance-ops` | `modules/resonance-ops/*`, `apps/operations-console` | Active Gradle modules |

## Project Runtime Packages

| Boundary | Paths | Status |
| --- | --- | --- |
| `project` | `projects/carbonet-frontend` | Active project source and hostPath static overlay |
| `project` | `projects/carbonet-assets` | Active static asset overlay |
| `project` | `projects/carbonet-backend-lib` | Active project runtime library overlay |
| `project` | `projects/carbonet-backend-metadata` | Active metadata/script/security overlay |

## Support Packages

These are not Gradle runtime modules, but they are still part of the working system and must not be deleted as "unused".

| Package | Role | Handling |
| --- | --- | --- |
| `modules/hermes-core` | Hermes/agent Python/Node support. `HermesService` checks this path directly. | Keep as `support/hermes-runtime` until extracted to its own repository or service. |
| `ai-builder` | AI builder support and agent work area. | Keep under support/tooling. |
| `skills` | Codex/Resonance workflow skill assets. | Keep under support/tooling. |
| `templates` | Project and screenbuilder templates. | Keep under support/tooling. |
| `scripts` | Standalone utility/runtime-config scripts. | Keep under support/tooling unless each script is migrated to `ops/scripts`. |
| `package-sets` | Package grouping metadata. | Keep as metadata; not a build package. |
| `common` | Shared documentation/UI notes, not Gradle Java. | Keep as support documentation until merged into `docs` or `projects`. |
| `frontend` | Standalone frontend source snapshot. | Review before removal; current project frontend lives under `projects/carbonet-frontend`. |
| `catalog` | Catalog metadata. | Keep as metadata. |

## Operations And Data Packages

| Package | Role | Handling |
| --- | --- | --- |
| `ops` | Operational scripts, Dockerfiles, config, runtime metadata. | Active `resonance-ops`. |
| `deploy` | Kubernetes/base deployment manifests. | Active `resonance-ops`. |
| `manifests` | Supplemental manifests. | Active ops metadata. |
| `db` | DB schema/migrations/backups. | Active DB metadata; schema changes require review. |
| `data` | Runtime/business/AI registry seed data. | Active data/metadata. |
| `var` | Runtime state, logs, releases, DB hostPath data. | Active runtime state; never delete during package cleanup. |
| `runtime` | Runtime package snapshot. | Review as generated/runtime artifact. |
| `release` | Release package snapshot. | Review as generated/release artifact. |
| `third_party` | External binary dependencies, including KISA jar. | Keep. |
| `ubuntu-auto-repair` | Host repair logs/scripts. | Ops support; review separately. |

## Legacy And Review Packages

| Package | Finding | Decision |
| --- | --- | --- |
| `modules/_legacy-candidates` | Contains 3 Maven-only candidates: `common-admin-runtime`, `common-content-runtime`, `common-payment`. Existing docs mark it read-only evidence. | Keep read-only. Do not include in Gradle until classified. |
| `modules/carbonet-common-core` | Legacy path with 9 files. Active implementation is `modules/resonance-common/carbonet-common-core` with 2392 files. Some docs/ops seed data still mention the old path. | Do not build. Treat as legacy alias/migration evidence, then retire only after references are cleaned. |
| `.kilo`, `.qwen`, `.codex`, `.kube`, `.github`, `.githooks`, `.gradle`, `node_modules`, `plans` | Tooling, local state, CI/hooks, cache, or planning folders. | Not application packages. Exclude from package boundary decisions. |

## Cleanup Rule

- Build package cleanup must affect only `settings.gradle.kts` included modules and their dependencies.
- Support packages can be moved only after all direct references are updated.
- Runtime state folders (`var`, DB data, release snapshots, hostPath overlays) must be backed up before cleanup.
- Legacy candidates stay read-only until a separate retirement ticket confirms no source, script, DB seed, or operator flow references them.
