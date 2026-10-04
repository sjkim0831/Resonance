# Screen No-Build / No-Deploy Policy

## Scope

### Work classification and precedence

- Ordinary page work means changes fully expressible through an already-supported SDUI definition, allow-listed components, existing APIs, and menu metadata. Prefer the runtime metadata path so supported pages do not require a source edit or frontend build.
- Platform/foundation work means changing route resolution or static-to-dynamic precedence, the Page Registry/SDUI renderer or component allow-list, authentication/authorization enforcement, shared API contracts, publication/version/rollback validation, or the build/runtime path that enables metadata-only pages.
- When a user explicitly requests platform/foundation work, the `Page Work vs Platform/Foundation Work` exception in the repository `AGENTS.md` takes precedence over the ordinary page-only path restrictions below. Make only the minimal compatible source changes, run the relevant frontend/backend builds and tests, and apply them only to the authorized development runtime. This is not permission to migrate every static page or touch production.
- A frontend router, route loader, shared React component, or Vite configuration edit is a source change and requires a frontend build. A new REST endpoint, server authorization rule, transaction behavior, or schema change requires the relevant backend build; schema rollout also requires an approved migration path. Do not describe these foundation changes as no-build work.
- After the foundation supports a page's component and API contracts, ordinary additions/edits should return to metadata-only publication. A static route remains higher priority than a dynamic registry entry; an unregistered dynamic URL and a failed definition must produce an explicit error view.

This system has two screen delivery modes.

1. Existing React/TSX screens
   - Build: required
   - Backend/Gradle build: not required
   - Image rebuild: not required
   - Pod delete/recreate: not required
   - Rollout restart: not required
   - Standard command:
     `bash ops/scripts/resonance-screen-overlay-apply.sh`

2. Runtime schema or metadata-driven screens
   - Build: not required
   - Deploy: not required
   - Allowed runtime paths:
     - `projects/carbonet-frontend/src/main/resources/static/react-app/**`
     - `projects/carbonet-assets/static/**`
     - `projects/carbonet-backend-metadata/**`
     - `var/k8s/carbonet-runtime-manifest.json`
   - Standard command:
     `SKIP_FRONTEND_BUILD=true bash ops/scripts/resonance-screen-overlay-apply.sh`

## Hard Rule

Do not delete or recreate the runtime container for frontend-only screen work.

The running `carbonet-runtime` deployment mounts:

- Host: `projects/carbonet-frontend/src/main/resources/static/react-app`
- Pod: `/app/react-app-overlay`

Any frontend build output placed in that host directory is visible to the pod through the mounted overlay.

## What Counts As Full No-Build

Full no-build is possible only when the screen behavior is data-driven at runtime.

Examples:

- JSON screen definitions in `projects/carbonet-backend-metadata/**`
- Static HTML/JS/CSS/assets under `projects/carbonet-assets/static/**`
- React shell metadata under `projects/carbonet-frontend/src/main/resources/static/react-app/**`
- DB-backed screen schema consumed by an already deployed renderer

Editing `.tsx`, `.ts`, route loaders, generated registries, shared React components, or Vite config still requires a frontend build because browsers cannot execute those source files directly in this production bundle.

## Required Verification

Every screen apply must pass:

```bash
bash ops/scripts/resonance-frontend-overlay-guard.sh verify-all
```

The guard verifies:

- local overlay exists
- asset count is sane
- hashed assets referenced by `index.html` exist
- source marker matches the current frontend source
- HTTP hashed assets are served from the running system

## Standard Commands

For normal React screen changes:

```bash
bash ops/scripts/resonance-screen-overlay-apply.sh
```

For runtime metadata/static-only changes:

```bash
SKIP_FRONTEND_BUILD=true bash ops/scripts/resonance-screen-overlay-apply.sh
```

For status:

```bash
cat var/run/frontend-screen-apply-status.json
```

## Migration Direction

To make more screens truly no-build, migrate page-specific behavior from compiled TSX into runtime schemas:

- page layout schema
- table/search/form schema
- API binding metadata
- menu/screen binding metadata
- validation and visibility rules
- i18n labels

The compiled React shell should become a stable renderer. Once a page is represented by runtime schema, changes to that page can be applied without frontend build or backend deploy.
