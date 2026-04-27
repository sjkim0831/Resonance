# Project Template Adapter

Use this module as the starting point for a new project-specific binding line.

Ownership:

- `COMMON_RUNTIME`
  - stays in reusable Carbonet modules and stable gate jars
- `PROJECT_ADAPTER`
  - lives here
- `PROJECT_RUNTIME`
  - lives in `projects/project-template`

Keep in this module:

- project DB mapping and datasource attachment
- project menu and route binding
- project authority narrowing
- project theme binding
- project executor bridge wiring

Keep out of this module:

- copied common-core services
- growing business logic
- project business tables

For first bootstrap, pair this module with:

- [projects/project-template](/opt/Resonance/projects/project-template/pom.xml)
- [templates/skeletons/project-runtime-1.0.0](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/README.md)
- [templates/screenbuilder-project-bootstrap/sample-project-adapter](/opt/Resonance/templates/screenbuilder-project-bootstrap/sample-project-adapter/README.md)
