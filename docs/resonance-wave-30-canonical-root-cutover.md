# Resonance Wave 30: Canonical Root Cutover

Date: 2026-04-26

## Result

The Resonance framework root is now:

```text
/opt/Resonance
```

The transitional path is no longer active:

```text
/opt/Resonance
```

## Migration

The workspace was moved with elevated filesystem permissions and ownership was returned to `sjkim`:

```text
/opt/Resonance -> /opt/Resonance
```

Path normalization updated source, docs, manifests, and scripts from:

```text
/opt/Resonance
```

to:

```text
/opt/Resonance
```

Updated file count:

```text
34
```

## Verification

Canonical root build:

```bash
cd /opt/Resonance
mvn -pl apps/carbonet-app,apps/operations-console,apps/project-runtime -am -Dmaven.test.skip=true clean package
```

Result:

```text
BUILD SUCCESS
```

Canonical root boot smoke:

```text
SMOKE_PASS carbonet-app exit=124
SMOKE_PASS operations-console exit=124
SMOKE_PASS project-runtime exit=124
```

`exit=124` is expected because the smoke harness treats a timeout after successful Spring Boot startup as success.

## Current Active Paths

- framework root: `/opt/Resonance`
- archived old project root: `/opt/projects/_archive/carbonet-20260426-183930`
- active old project root: absent

## Notes

The remaining `carbonet-*` artifact names are compatibility/module names, not filesystem root blockers. They should be handled in a later artifact rename and common-module promotion wave.

