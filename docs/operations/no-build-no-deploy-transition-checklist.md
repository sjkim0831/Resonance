# No-Build / No-Deploy Transition Checklist

Status captured on 2026-07-08 KST for `/opt/Resonance` on `carbonet-prod`.

## Current Verdict

- Page, menu, static asset, metadata, SDUI, and Groovy script changes can be operated as no-build/no-deploy work when they stay under the project-owned overlay paths.
- Java transaction logic, security/auth logic, DB schema changes, shared Java contracts, and new REST endpoints still require a Gradle build and Kubernetes rollout.
- The runtime currently runs as a JVM jar (`project-runtime.jar`) on OpenJDK 21. GraalVM Native Image is not active on the host because `native-image` is not installed and the running process is `java -jar`.
- PostgreSQL service routing is already through `postgres-haproxy`, backed by the `postgres-patroni` 3-node cluster. The old `postgres-ha` StatefulSet still exists and should be treated as legacy until removed through a separate DB retirement plan.

## Project Boundary Target

| Target boundary | Current source area | Build policy |
| --- | --- | --- |
| `resonance-core` | `modules/resonance-common/*` core/common modules | Build only when shared Java behavior or contracts change |
| `resonance-adaptor` | `modules/resonance-builder/*adapter`, project bridge classes | Build only when adapter Java contracts change |
| `project-core` | `apps/project-runtime`, project-specific Java modules and runtime composition | Primary build/deploy unit for Java changes |
| `project` | `projects/carbonet-frontend`, `projects/carbonet-assets`, `projects/carbonet-backend-metadata` | No-build/no-deploy overlay by default |
| `resonance-ops` | `modules/resonance-ops`, `ops`, `deploy` | Build only for ops Java modules; shell/K8s changes follow ops review |

## No-Build / No-Deploy Allowed Paths

- `projects/carbonet-frontend/src/main/resources/static/react-app/**`
- `projects/carbonet-assets/static/**`
- `projects/carbonet-backend-metadata/**`
- `projects/carbonet-backend-metadata/scripts/**`
- `var/k8s/carbonet-runtime-manifest.json` for runtime manifest changes only
- `ops/runtime-metadata/**` for runtime metadata registry changes only

## Build / Deploy Required

- Java class additions or modifications
- Transaction boundaries and service-layer transaction behavior
- Spring Security, authentication, authorization, session, CSRF, or filter changes
- New REST endpoints or controller mappings
- DB schema migrations and Flyway/Liquibase-style changes
- Shared DTO, mapper, service contract, or module dependency changes
- Runtime packaging, Docker image, JVM option, or Kubernetes deployment spec changes

## Gradle First Rule

- Use Gradle as the canonical Java build path.
- Do not add new Maven-only build steps.
- Keep `project-core` as the primary deployable unit for project Java changes.
- Do not rebuild `resonance-core` or `resonance-adaptor` for page-only changes.

## Runtime / GraalVM Check

- Host Java: OpenJDK 21.
- Host `native-image`: not installed at capture time.
- Running runtime shape: JVM jar, not a native binary.
- Existing GraalVM references should be treated as support/preparation unless a later check proves the image is built by `nativeCompile` and executed as a native binary.

## Database Check

- `postgres-patroni-0`: Leader, running.
- `postgres-patroni-1`: Replica, streaming, lag 0 MB.
- `postgres-patroni-2`: Replica, streaming, lag 0 MB.
- Runtime DB URL: `jdbc:postgresql://postgres-haproxy:5432/carbonet?sslmode=disable`.
- Data hostPath root: `/opt/Resonance/var/postgres-patroni`.
- Legacy DB workload: `postgres-ha` still exists and must not be deleted without a verified retirement plan and backup.

## Monitoring Menu Preservation Check

The recently implemented monitoring screens are present in both source and runtime registration areas:

- Source files: `projects/carbonet-frontend/source/src/features/monitoring-*`.
- Route family: `projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts`.
- Screen manifests: `projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts`.
- Served overlay: `projects/carbonet-frontend/src/main/resources/static/react-app/index.html` and hashed `assets/*Monitoring*` bundles.
- DB menu rows: `A0070501` through `A0070505` for admin monitoring and `H005*` for public/service monitoring.

Because `carbonet-runtime` mounts `projects/carbonet-frontend/src/main/resources/static/react-app` as a hostPath overlay, deleting and recreating the runtime container should not delete these files. Risk remains if a build or cleanup script overwrites the overlay without preserving source and bundle pairs.

## Loss Prevention Rules

- Before any build or cleanup, run `git status --short` and save a patch for source changes.
- Do not delete untracked files under `projects/carbonet-frontend/source/src/**`, `projects/carbonet-backend-metadata/**`, or `projects/carbonet-assets/static/**`.
- Treat hashed frontend bundles as replaceable only when their source build is available and `index.html` references matching assets.
- Back up DB and hostPath overlays before retiring `postgres-ha`, cleaning static bundles, or changing deployment volumes.
- Keep page-only changes in project overlays so container recreation does not erase them.


## 2026-07-08 Gradle Runtime Deployment Update

- `ops/scripts/resonance-k8s-build-deploy-80-v2.sh` now uses Gradle for the backend runtime build path.
- Default runtime image repository is `localhost:5000/carbonet-runtime:*gradle`, matching the local registry container bound to port `5000`.
- The script pushes built images to the local registry and also imports them into containerd for the current single-node Kubernetes runtime.
- `carbonet-runtime` is currently running a Gradle-built image and reports actuator health `UP`.
- Deployment image pull policy was changed from `Never` to `IfNotPresent` so a recreated pod can reuse the local registry image path.
- Frontend/monitoring overlay files were not rebuilt or deleted during this backend-only rollout.


## Frontend Overlay Guard

Added on 2026-07-08 KST to prevent screen changes from silently disappearing or being deployed with broken hashed assets.

- Guard script: `ops/scripts/resonance-frontend-overlay-guard.sh`.
- The deploy script runs an overlay backup before sync: `var/backups/frontend-overlay/react-app-overlay-*.tar.gz`.
- The deploy script verifies local overlay integrity before and after sync.
- The guard checks `index.html`, the `assets` directory, all hashed asset references from `index.html`, and required monitoring/observability bundles.
- The guard writes `.resonance-build.json` with a React source hash after a successful frontend build.
- `--skip-frontend` deployments verify that the current React source hash still matches the overlay build marker; stale source/build pairs fail deployment.
- The final runtime verification checks that hashed assets referenced by the current overlay are served over HTTP from `http://127.0.0.1`.
- If any guard check fails, the build/deploy script fails instead of silently completing.

Residual non-code risks still require operational controls: browser cache, user session state, external CDN/proxy cache if one is later added, and a user viewing an already-open tab without refresh.

## Next Work Items

- Rename or document module ownership so `project-core` is the only normal Java deploy target for project-specific backend changes.
- Add a guard script that classifies a diff as no-build, project-core-build, or full-framework-build.
- Retire `postgres-ha` only after a backup, connection audit, and rollback plan.

See also: `docs/operations/package-inventory.md` for the full top-level package inventory and cleanup decisions.
