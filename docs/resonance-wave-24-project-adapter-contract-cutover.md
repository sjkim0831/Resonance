# Resonance Wave 24: Project Adapter Contract Cutover

Date: 2026-04-26

## Result

The Carbonet project adapter now builds under `/opt/Resonance` without depending on the old Carbonet common JAR set.

Verified command:

```bash
cd /opt/Resonance
mvn -pl projects/carbonet-runtime -am -DskipTests package
```

Result:

```text
carbonet-adapter SUCCESS
carbonet-runtime SUCCESS
BUILD SUCCESS
```

## Changes

- Removed unused legacy dependencies from `projects/carbonet-adapter/pom.xml`:
  - `carbonet-common-core`
  - `common-auth`
  - `common-admin-runtime`
  - `common-content-runtime`
  - `common-payment`

- Added `ProjectMenuPort` to the Resonance common contract layer:
  - `modules/resonance-common/platform-service-contracts/src/main/java/egovframework/com/common/adapter/ProjectMenuPort.java`

- Retargeted `carbonet-adapter` to depend on `platform-service-contracts`.

- Added root Maven defaults to `resonance-workspace`:
  - Java release `17`
  - `maven-compiler-plugin` `3.14.0`
  - `maven-surefire-plugin` `3.5.4`
  - `maven-jar-plugin` `3.4.2`

## Boundary Decision

`ProjectMenuPort` is a common-to-project contract, not Carbonet project code.

The interface belongs in Resonance common contracts, while implementations such as `P003MenuAdapter` remain in the project adapter JAR.

## Current Status

Project layer:

- `projects/carbonet-adapter`: build OK
- `projects/carbonet-runtime`: build OK, currently empty runtime JAR

Remaining cutover work:

- App layer build hardening:
  - `apps/carbonet-app`
  - `apps/operations-console`
  - `apps/project-runtime`

- App parent plugin normalization:
  - Spring Boot Maven plugin version
  - app dependency retargeting away from old `/opt/Resonance`

- Runtime smoke:
  - app boot
  - route/admin page check
  - k8s manifest check

Do not delete `/opt/Resonance` yet. The project layer is cut over, but app/runtime references still need to be proven clean.
