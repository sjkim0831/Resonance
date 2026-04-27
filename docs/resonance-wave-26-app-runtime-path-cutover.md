# Resonance Wave 26 - App Runtime Path Cutover

## Status

`Resonance` app/runtime cutover now builds from `/opt/Resonance` without requiring the old `/opt/Resonance` project root.

Verified app builds:

- `apps/carbonet-app`
- `apps/operations-console`
- `apps/project-runtime`

## Changes

- Added the missing Lombok dependency to `apps/project-runtime/pom.xml`.
- Normalized hardcoded default project paths from `/opt/Resonance` to `/opt/Resonance`.
- Updated install/control-plane defaults so runtime, release, backup, workbench, firewall, and admin helper paths no longer point at the old project folder.
- Rebuilt all three app artifacts after the path cutover.

## Verification

Commands run on `100.116.50.74`:

```bash
cd /opt/Resonance
mvn -pl apps/carbonet-app -am -Dmaven.test.skip=true package
mvn -pl apps/operations-console -am -Dmaven.test.skip=true package
mvn -pl apps/project-runtime -am -Dmaven.test.skip=true package
```

All three commands completed with `BUILD SUCCESS`.

## Remaining Work

The old `/opt/Resonance` folder should not be deleted until these checks pass:

- boot smoke for `carbonet-app`, `operations-console`, and `project-runtime`
- k8s/deploy manifest smoke after path normalization
- runtime data path check for backup, release, firewall script, workbench, and upload/cache folders

Remaining `carbonet-*` artifact names are transition/module names, not old root path dependencies. They can be renamed in a later cleanup wave once runtime smoke is stable.
