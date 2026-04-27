# Project Runtime Skeleton `1.0.0`

This skeleton is the governed starter package for adding a new project without
copying the whole Carbonet source tree.

Target runtime shape:

- reusable common jars stay in `COMMON_RUNTIME`
- project-only logic stays in the project adapter and project runtime
- DB ownership stays split between `COMMON_DB` and `PROJECT_DB`
- one project instance is governed by `config/manifest.json`

## Folder Layout

```text
project-runtime-1.0.0/
├── config/
│   ├── application-prod.yml
│   └── manifest.json
├── db/
│   ├── common-db-binding/
│   │   └── 001_project_binding_seed.sql
│   └── project-db/
│       └── 001_initial_project_schema.sql
├── lib/
│   └── README.md
└── scripts/
    └── start-project-runtime.sh
```

## Required Replacements

1. Replace `P_TEMPLATE` with the real project id.
2. Replace DB URLs, credentials, schema names, and storage roots.
3. Build the project-owned adapter jar and place it under `lib/`.
4. Keep common version selections in `manifest.json` instead of editing
   common-core source.

## Ownership Rule

- `COMMON_DB`
  - project registry, menu/page metadata, authority metadata, artifact/version
    governance, rollout history
- `PROJECT_DB`
  - project business data, runtime workflow state, project-local integrations,
    project-local logs and settings
- `BINDING_LAYER`
  - which project enables which common modules, menu profiles, route prefixes,
    theme packages, and adapter line

This skeleton is intentionally thin. It is a binding package, not a project
fork.
