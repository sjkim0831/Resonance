# Resonance Wave 25: App Cutover Seed Build

Date: 2026-04-26

## Result

`carbonet-app` now builds inside `/opt/Resonance` without resolving artifacts from the old `/opt/Resonance` reactor.

Verified command:

```bash
cd /opt/Resonance
mvn -pl apps/carbonet-app -am -Dmaven.test.skip=true package
```

Result:

```text
carbonet-app SUCCESS
BUILD SUCCESS
```

Generated artifact:

```text
/opt/Resonance/apps/carbonet-app/target/carbonet.jar
```

## Changes

- Seeded app-required transitional modules into `Resonance/modules`:
  - `resonance-common/carbonet-common-core`
  - `resonance-common/common-auth`
  - `resonance-builder/carbonet-builder-observability`
  - `resonance-common/carbonet-contract-metadata`
  - `resonance-common/platform-help-content`
  - `resonance-common/platform-help`
  - `resonance-common/platform-observability-web`
  - `resonance-common/platform-observability-payload`
  - `resonance-builder/screenbuilder-carbonet-adapter`

- Connected the seeded modules to `modules/pom.xml`.

- Retargeted old dependency names where safe:
  - `carbonet-mapper-infra` -> `resonance-mapper-infra`
  - `carbonet-web-support` -> `resonance-web-support`
  - `screenbuilder-core` -> `resonance-screenbuilder-core`
  - `screenbuilder-runtime-common-adapter` -> `resonance-screenbuilder-runtime-common-adapter`
  - `platform-version-control` -> `resonance-platform-version-control`

- Added `pdfbox` `2.0.32` to `carbonet-common-core` for the existing `PDDocument.load(File)` API.

- Normalized root build properties:
  - `lombok.version`
  - `spring-boot.maven-plugin.version`
  - Spring Boot Maven plugin management

## Current Boundary

This is a transitional cutover, not the final clean architecture.

The important achievement is that the app build path no longer requires the old source folder as a reactor participant. Some artifact names still contain `carbonet-*` because they represent migrated modules copied from the old tree. These should be renamed or split gradually after runtime smoke tests pass.

## Remaining Work

- Build and fix:
  - `apps/operations-console`
  - `apps/project-runtime`

- Runtime smoke:
  - boot `carbonet.jar`
  - verify admin/install pages
  - verify screen builder/theme routes
  - verify auth/scope behavior

- Old folder deletion gate:
  - no build command references `/opt/Resonance`
  - no runtime config points at `/opt/Resonance`
  - apps and k8s smoke pass from `/opt/Resonance`

Do not delete `/opt/Resonance` yet. The main app now builds from `Resonance`, but runtime smoke and the two remaining app modules still need to pass.
