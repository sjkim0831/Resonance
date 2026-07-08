# Resonance Project Boundaries

Status captured on 2026-07-08 KST.

## Canonical Boundaries

| Boundary | Gradle/project paths | Normal operation policy |
| --- | --- | --- |
| `resonance-core` | `modules/resonance-common/*` | Shared Java contracts and platform behavior. Build only when common Java code changes. |
| `resonance-adaptor` | `modules/resonance-builder/*adapter`, builder observability bridge modules | Adapter and bridge Java behavior. Build only when adapter contracts or bridge code changes. |
| `project-core` | `apps/project-runtime`, `apps/carbonet-app` | Primary Java build/deploy unit for project-specific backend logic, transactions, REST endpoints, security wiring, and runtime composition. |
| `project` | `projects/carbonet-frontend`, `projects/carbonet-assets`, `projects/carbonet-backend-metadata` | No-build/no-deploy by default for overlay assets, metadata, manifests, and page bundles. Source frontend changes still need frontend build before overlay sync. |
| `resonance-ops` | `ops`, `deploy`, `modules/resonance-ops/*`, root Docker/runtime deployment files | Ops review path. Shell/YAML changes may not require Java build but can affect runtime availability. |

## Build Decision

- `project` only: no Java build. Apply overlay or metadata changes, then verify the served file/menu.
- `project-core`: run `./gradlew :apps:project-runtime:bootJar`, build image, and roll out `carbonet-runtime`.
- `resonance-core` or `resonance-adaptor`: run full affected Gradle checks before runtime deployment.
- `resonance-ops`: review operational blast radius first; run dry-run where scripts support it.

## Current Runtime Build Path

- Primary script: `ops/scripts/resonance-k8s-build-deploy-80-v2.sh`
- Backend build tool: Gradle through `ops/scripts/build.sh`
- Runtime image repository: `localhost:5000/carbonet-runtime:*gradle`
- Deployment: `carbonet-prod/carbonet-runtime`
- Expected health check: `http://127.0.0.1/actuator/health`

See also: `docs/operations/package-inventory.md` for the full top-level package inventory and cleanup decisions.
