# Project Template Runtime

This module is the starter runtime assembly for a new project.

It exists to keep the split explicit:

- reusable common jars are versioned separately
- adapter binding is isolated in `project-template-adapter`
- runtime package selection stays per project

Use this module to own:

- project runtime package identity
- project-specific config profile selection
- project runtime release-unit metadata

Do not use this module to absorb:

- common governance metadata
- project adapter compatibility fixes that belong in the adapter module

When creating a new project, rename this pair:

1. `project-template-adapter`
2. `project-template`

Then bind:

1. `COMMON_DB`
2. `PROJECT_DB`
3. menu/theme/runtime manifest values
4. adapter jar wiring
