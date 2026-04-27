# Sample Project Adapter Module

This is a starter skeleton for a new project-specific builder adapter.

Pair it with:

- `templates/skeletons/project-runtime-1.0.0/`

That runtime skeleton keeps:

- `COMMON_DB` metadata and artifact governance out of project tables
- `PROJECT_DB` business data out of common governance tables
- one thin adapter jar as the project binding seam

Use it like this:

1. Copy `templates/skeletons/project-runtime-1.0.0/` into the new project runtime package.
2. Copy this adapter module into the new project repository.
3. Replace `com.example.project` with the real project package.
4. Add the dependency block from `templates/screenbuilder-project-bootstrap/pom-screenbuilder-dependencies.xml`.
5. Copy `templates/screenbuilder-project-bootstrap/application-screenbuilder.properties`.
6. Replace the `UnsupportedOperationException` sections with real project bindings.

The policy adapter is already wired to property-based defaults.

The TODO adapters are:

- menu catalog
- command page lookup
- component registry
- authority contract
- runtime compare

Keep project-specific save/calculate/approval logic outside this adapter when
possible. The adapter should stay as the binding seam, not grow into a second
common-core.
