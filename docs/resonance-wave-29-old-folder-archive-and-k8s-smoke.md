# Resonance Wave 29: Old Folder Archive And K8s Smoke

Date: 2026-04-26

## Result

The old project root was removed from the active path:

```text
/opt/Resonance
```

It was not permanently deleted. It was archived in-place for rollback:

```text
/opt/projects/_archive/carbonet-20260426-183930
```

Archive size:

```text
14G
```

## Active Runtime

The active runtime is now based on:

```text
/opt/Resonance
```

Validated gates:

- `apps/carbonet-app` build: pass
- `apps/operations-console` build: pass
- `apps/project-runtime` build: pass
- jar boot smoke for all three apps: pass
- old `/opt/Resonance` active folder check: missing
- k8s `carbonet-p003` pod: `1/1 Running`
- k8s HTTP smoke through port-forward: pass

HTTP smoke:

```text
GET /actuator/health -> 200 {"status":"UP","groups":["liveness","readiness"]}
GET / -> 302
```

The `302` response on `/` is acceptable for this gate because the app is alive and redirecting into the security/login flow.

## K8s Notes

The local kind cluster exposes host ports `30080` and `30443`. Existing `default/nginx` already owns NodePort `30080`, so `carbonet-p003` was verified with a temporary port-forward:

```bash
kubectl -n carbonet-local port-forward svc/carbonet-p003 18081:8080
```

The app uses the host CUBRID container for the current working smoke:

```text
CUBRID_HOST=172.18.0.1
```

The in-cluster CUBRID deployment still needs a separate hardening pass. It was moved toward `cubrid/cubrid:11.2`, but its broker/master lifecycle is not yet production-ready under the current PVC/deployment shape.

## Rollback

If rollback is needed:

```bash
mv /opt/projects/_archive/carbonet-20260426-183930 /opt/Resonance
```

Do this only after stopping services that may be using `/opt/Resonance`.

