# builder-09-artifact-target

- Role: artifact runtime target handoff
- Allowed Paths: builder regeneration docs, operations platform docs, ops scripts, built static react-app artifacts
- Forbidden Paths: builder source authoring code, contract ownership files

## Findings

- The architecture docs are explicit that `carbonet-general` is a deployment/runtime target for regenerated outputs, not the source of truth for builder behavior.
- Generated outputs are meant to be disposable and reproducible; manual fixes in generated runtime artifacts are explicitly rejected as the normal operating model.
- The publish boundary must be fixed around explicit release-unit packages owned by `carbonet-ops`.
- Local build and restart flow in this repository already matches an operations-owned packaging path: frontend build writes into `src/main/resources/static/react-app`, backend package builds the jar, and `restart-18000.sh` starts the runtime.

## Handoff Rules

- Fix builder rules, overlays, compatibility policy, and publish decisions in `carbonet-ops`.
- Regenerate and republish artifacts to the runtime target instead of patching generated files in the target system.
- Treat derived artifacts as replaceable outputs tied to builder version, source contracts, and release-unit metadata.
- Use release-unit packaging as the handoff boundary between builder ownership and runtime consumption.

## Runtime Target Notes

- Runtime targets should consume published artifacts only.
- Runtime targets should not become a second control plane for builder configuration.
- `src/main/resources/static/react-app/**` is a build output location in this repository and should not be treated as the enduring source of builder logic.
- Repair/parity automation needs to operate on regenerated outputs plus release-unit evidence, not ad hoc edits on runtime nodes.

## Next Action

- Define the exact artifact bundle contents and metadata that a `carbonet-general` handoff must include: release unit id, builder version, compatibility verdict, route/page identity, and traceable runtime package evidence.
