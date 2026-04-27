# Bootstrap Validator Checklist

Use this checklist before calling a new project "3-minute builder ready".

## Required Dependencies

- `screenbuilder-core`
- `screenbuilder-runtime-common-adapter`
- project adapter module
- optional shared support modules only if the adapter truly needs them

## Required Properties

- `screenbuilder.project.project-id`
- `screenbuilder.project.menu-root`
- `screenbuilder.project.runtime-class`
- `screenbuilder.project.menu-scope`
- `screenbuilder.project.release-unit-prefix`
- `screenbuilder.project.runtime-package-prefix`

## Required Beans

- `ScreenBuilderMenuCatalogPort`
- `ScreenBuilderCommandPagePort`
- `ScreenBuilderComponentRegistryPort`
- `ScreenBuilderAuthorityContractPort`
- `ScreenBuilderRuntimeComparePort`
- `ScreenBuilderMenuBindingPolicyPort`
- `ScreenBuilderArtifactNamingPolicyPort`
- `ScreenBuilderRuntimeComparePolicyPort`
- `ScreenBuilderRequestContextPolicyPort`

Default policy beans may come from `screenbuilder-runtime-common-adapter`.
Only override them inside the project adapter when the project truly needs custom policy behavior.

## Required Runtime Checks

- draft storage root exists or DB-backed storage is configured
- menu root is readable
- builder routes/controllers are exposed
- compatibility APIs resolve
- runtime compare bridge is callable

## Install Must Fail If

- any required bean is missing
- any required property is missing
- menu root cannot be resolved
- storage is not writable
- compatibility range does not match the imported builder version
