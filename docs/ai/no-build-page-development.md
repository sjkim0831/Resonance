# No-Build Page Development

Use this rule for every AI agent working on Resonance page development.

## Default

Page work is server-driven and metadata-driven. Do not build or redeploy for ordinary page work.

## Edit These Paths

- `projects/carbonet-frontend/src/main/resources/static/react-app/**`
- `projects/carbonet-assets/static/**`
- `projects/carbonet-backend-metadata/**`
- `var/k8s/carbonet-runtime-manifest.json`
- `ops/runtime-metadata/**`

## Avoid These Paths For Page Work

- `frontend/src/**`
- `apps/**`
- `modules/**`
- `release/**`
- `templates/**`
- `deploy/**`
- `scripts/runtime-configs/**`

## Workflow

1. Use `/admin/system/build-studio` as the SDUI control plane.
2. Store UI layout and behavior as SDUI/metadata.
3. Store page assets in `projects/carbonet-assets/static/**`.
4. Store backend screen metadata in `projects/carbonet-backend-metadata/**`.
5. Apply overlay-only changes with `ops/scripts/resonance-no-build-apply.sh`.
6. Verify served assets with `curl -sI`.

## Build Required Only For

- runtime engine changes
- Java shared contracts
- security/auth changes
- DB schema or mapper contract changes
- new generic backend capability that cannot be represented as metadata
