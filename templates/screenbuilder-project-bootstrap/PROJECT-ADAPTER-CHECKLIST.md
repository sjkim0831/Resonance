# Project Adapter Checklist

## Required Beans

Create project-owned implementations for:

- `ScreenBuilderMenuCatalogPort`
- `ScreenBuilderCommandPagePort`
- `ScreenBuilderComponentRegistryPort`
- `ScreenBuilderAuthorityContractPort`
- `ScreenBuilderRuntimeComparePort`

By default, do not reimplement these unless the project truly needs custom policy behavior:

- `ScreenBuilderMenuBindingPolicyPort`
- `ScreenBuilderArtifactNamingPolicyPort`
- `ScreenBuilderRuntimeComparePolicyPort`
- `ScreenBuilderRequestContextPolicyPort`

These can now be supplied by `screenbuilder-runtime-common-adapter`.

## Suggested Package Layout

```text
src/main/java/com/example/project/screenbuilder/support/
src/main/java/com/example/project/screenbuilder/support/model/
src/main/java/com/example/project/screenbuilder/support/impl/
src/main/java/com/example/project/screenbuilder/config/
src/main/java/com/example/project/screenbuilder/web/
src/main/resources/mybatis/screenbuilder/
```

## Port Mapping Guide

- `ScreenBuilderMenuCatalogPort`: map project menus into `ScreenBuilderMenuDescriptor`
- `ScreenBuilderCommandPagePort`: map project page bootstrap lookups
- `ScreenBuilderComponentRegistryPort`: expose component registry and page manifest reads
- `ScreenBuilderAuthorityContractPort`: expose role/menu/page authority bindings
- `ScreenBuilderRuntimeComparePort`: bridge runtime compare execution into the project runtime system
- `ScreenBuilderMenuBindingPolicyPort`: usually property-backed from common runtime adapter; override only for custom menu/page-id rules
- `ScreenBuilderArtifactNamingPolicyPort`: usually property-backed from common runtime adapter; override only for custom artifact naming
- `ScreenBuilderRuntimeComparePolicyPort`: usually property-backed from common runtime adapter; override only for custom compare lane/family rules
- `ScreenBuilderRequestContextPolicyPort`: usually property-backed from common runtime adapter; override only for custom locale/surface rules

## Keep Out Of The Project Adapter

Do not copy core classes or edit builder core internals.

Do not reimplement:

- `ScreenBuilderDraftServiceImpl`
- `FrameworkBuilderContractService`
- `FrameworkBuilderCompatibilityService`

If the project needs different behavior, add or replace adapters, not core logic.

## Starter Skeleton

A ready-to-copy starter skeleton now exists under:

- `templates/screenbuilder-project-bootstrap/sample-project-adapter/pom.xml`
- `templates/screenbuilder-project-bootstrap/sample-project-adapter/src/main/java/com/example/project/screenbuilder/config/ScreenBuilderProjectAdapterConfiguration.java`
- `templates/screenbuilder-project-bootstrap/sample-project-adapter/src/main/java/com/example/project/screenbuilder/support/impl/*`

## Manifest And Validator Assets

Use these together with the adapter starter:

- `templates/screenbuilder-project-bootstrap/manifests/builder-install-manifest.json`
- `templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json`
- `templates/screenbuilder-project-bootstrap/manifests/api-install-manifest.json`
- `templates/screenbuilder-project-bootstrap/bootstrap-validator-checklist.md`
- `templates/screenbuilder-project-bootstrap/validate-screenbuilder-bootstrap.sh`
