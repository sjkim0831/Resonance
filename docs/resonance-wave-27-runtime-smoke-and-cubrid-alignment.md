# Resonance Wave 27: Runtime Smoke And CUBRID Alignment

Date: 2026-04-26

## Result

The Resonance app cutover now passes build and boot smoke from `/opt/Resonance`.

Validated applications:

- `apps/carbonet-app/target/carbonet.jar`
- `apps/operations-console/target/operations-console.jar`
- `apps/project-runtime/target/project-runtime.jar`

Smoke command:

```bash
scripts/wsl_remote_app_cutover.sh boot-smoke-apps
```

Result:

```text
SMOKE_PASS carbonet-app exit=124
SMOKE_PASS operations-console exit=124
SMOKE_PASS project-runtime exit=124
```

`exit=124` is expected for this smoke harness because each app is allowed to run until the 45 second timeout. The pass condition is that Spring Boot reaches the `Started ... in ...` log line before the timeout and does not crash during startup.

## Fixes Applied

- Added direct `jackson-databind` `2.19.0` dependencies to the three app modules so Spring Boot 3.5.x does not load the older `2.12.7.1` databind jar.
- Set `factoryBean.setEntityManagerFactoryInterface(EntityManagerFactory.class)` in the common JPA configuration to avoid the Spring 6 / Hibernate `SessionFactory` proxy conflict.
- Normalized hardcoded `/opt/Resonance` runtime paths to `/opt/Resonance`.
- Recreated CUBRID from `/opt/util/cubrid/docker-compose.yml` so it runs the pinned `cubrid/cubrid:11.2` image instead of the stale `cubrid/cubrid:latest` container.

## CUBRID Finding

The failed boot smoke was caused by the stale `latest` CUBRID container. That container attempted to start a CUBRID 11.4-style PL server but did not have `java` available, leaving the `carbonet` database server down.

The compose-managed container now runs:

```text
container: 11.2
image: cubrid/cubrid:11.2
database: carbonet
broker: query_editor on 33000
```

The CUBRID Java stored procedure service is not required for the current app smoke path.

## Old Folder Deletion Gate

The old `/opt/Resonance` folder is much closer to removable, but deletion should still wait for one more gate:

- run a real HTTP smoke against the three apps with fixed ports
- verify k8s manifests point to `/opt/Resonance` artifacts/images
- confirm no active service still launches from `/opt/Resonance`
- take a final tar backup before removing the old folder

Current status:

- build gate: pass
- app boot gate: pass
- old hardcoded path gate: pass for `/opt/Resonance`
- deletion gate: pending final service/k8s/backup check

