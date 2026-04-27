# Project Template DB Split

Use this directory only as the starter reference for new project DB ownership.

Split rule:

- `COMMON_DB`
  - project registry
  - menu/page/function metadata
  - artifact/version locks
  - rollout and compatibility metadata
- `PROJECT_DB`
  - business tables
  - workflow state
  - project-local settings and integrations
- `BINDING_LAYER`
  - project enablement of common menus, themes, routes, and adapters

Recommended starter path:

- execute common binding seed from
  [templates/skeletons/project-runtime-1.0.0/db/common-db-binding](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/db/common-db-binding/001_project_binding_seed.sql)
- execute project schema seed from
  [templates/skeletons/project-runtime-1.0.0/db/project-db](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/db/project-db/001_initial_project_schema.sql)
