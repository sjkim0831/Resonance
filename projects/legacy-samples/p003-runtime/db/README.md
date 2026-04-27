# P003 DB Split

P003 follows the common/project DB split.

`COMMON_DB`

- project registry
- menu/page/function metadata
- artifact lock and compatibility data
- rollout and governance metadata

`PROJECT_DB`

- P003 business tables
- P003 workflow and approval state
- P003 project-local settings and integrations

`BINDING_LAYER`

- menu profile binding
- route prefix binding
- theme binding
- adapter/runtime version binding

Starter SQL should be copied from:

- [templates/skeletons/project-runtime-1.0.0/db/common-db-binding/001_project_binding_seed.sql](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/db/common-db-binding/001_project_binding_seed.sql)
- [templates/skeletons/project-runtime-1.0.0/db/project-db/001_initial_project_schema.sql](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/db/project-db/001_initial_project_schema.sql)
