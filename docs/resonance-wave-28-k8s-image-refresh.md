# Resonance Wave 28: K8s Image Refresh

Date: 2026-04-26

## Purpose

The app jars now build and boot from `/opt/Resonance`, but the local kind cluster was still running an older image:

```text
carbonet-local/carbonet-p003:latest
```

That old image failed before startup with a MyBatis duplicate result map error:

```text
Result Maps collection already contains key CmmUseMapper.CmmCodeDetail
```

## Added

- `ops/docker/Dockerfile.project-runtime`
- `ops/docker/Dockerfile.operations-console`
- `ops/scripts/build-kind-runtime-image.sh`

The project runtime image is intentionally thin:

- build the app jar from the Resonance reactor
- copy only `apps/project-runtime/target/project-runtime.jar`
- run with `java $JAVA_OPTS -jar /app/project-runtime.jar`

This keeps project runtime deployment aligned with the "space station / jetpack / rocket" model:

- operations platform: shared control plane
- common modules: versioned common jar set
- project runtime: thin project rocket with adapter and project-specific config

## Local Kind Refresh

Use:

```bash
IMAGE_NAME=carbonet-local/carbonet-p003:latest KIND_CLUSTER=dev ops/scripts/build-kind-runtime-image.sh
kubectl -n carbonet-local rollout restart deployment/carbonet-p003
kubectl -n carbonet-local rollout status deployment/carbonet-p003
```

This replaces only the local kind image. It does not delete the old `/opt/Resonance` folder and does not change production deployment state.

