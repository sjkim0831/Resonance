# P003 Adapter

Example new-project adapter derived from `project-template-adapter`.

This module should stay thin.

Own here:

- P003 menu binding
- P003 route prefix binding
- P003 authority narrowing
- P003 project DB attachment
- P003 executor bridge wiring

Do not move common-core logic here.

Current target runtime pair:

- [projects/p003-runtime](/opt/Resonance/projects/p003-runtime/pom.xml)
- [templates/skeletons/project-runtime-1.0.0](/opt/Resonance/templates/skeletons/project-runtime-1.0.0/README.md)
