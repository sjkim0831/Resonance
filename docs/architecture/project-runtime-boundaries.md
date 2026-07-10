# Project Runtime Boundaries

## Naming rule

Every deployable project owns exactly two runtime units:

- `<project>-api`: Java API, transactions, security, persistence, and integrations.
- `<project>-web`: React bundles, SDUI metadata, themes, sections, and static assets.

`project-core` and `project-web` are not deployable shared applications. New projects
must not depend on Carbonet code through generic project names.

## Shared framework

Reusable, project-neutral code belongs under `modules/resonance-*`:

- contracts and request/response types;
- authentication primitives and execution gates;
- screen-builder core and runtime-neutral adapters;
- observability, version control, and operations control.

Shared modules must not contain a project database schema, project menu code, Carbonet
controller, or Carbonet React component.

## Carbonet mapping

- `apps/carbonet-app`: transitional Carbonet API executable; target name `carbonet-api`.
- `modules/resonance-common/carbonet-common-core`: Carbonet domain implementation;
  move reusable pieces to `resonance-*` only after removing Carbonet dependencies.
- `projects/carbonet-frontend`: Carbonet Web source and generated runtime assets.
- `projects/carbonet-backend-metadata`: buildless SDUI and backend metadata.
- `apps/carbonet-api`: compatibility runtime only; do not use for new projects.

## Change and deployment policy

| Change | Build | Runtime action |
| --- | --- | --- |
| SDUI/menu/theme/section metadata | No | Atomic metadata publish |
| Plain HTML/CSS/static JSON | No | Atomic Web asset publish |
| React TS/TSX | Incremental frontend build | Web asset version switch |
| Java controller/service/repository | Incremental Gradle build | API rolling deployment |
| Framework contract/core | Affected-module Gradle build | Affected API rolling deployment |
| Database schema | Migration validation | Flyway/Liquibase migration |

The public origin remains unchanged. `<project>-web` owns the external port and proxies
API requests to `<project>-api`, avoiding CORS changes and preserving existing URLs.

## New project layout

```text
projects/<project>/
  api/          # project Java source or executable assembly
  web/          # React source and generated static assets
  metadata/     # SDUI, menus, themes, sections, API bindings
  migrations/   # project-owned Flyway/Liquibase migrations
  manifests/    # <project>-api and <project>-web runtime declarations
```

Create a shared module only when at least two projects use the same project-neutral
contract. Do not create generic `project-core` or `project-web` modules as pass-through
layers.
