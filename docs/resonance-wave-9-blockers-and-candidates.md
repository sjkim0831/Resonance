# Resonance Wave 9 Blockers and Candidates

## Current state after Wave 8

- `Wave 8` parent artifact rename applied
- promoted core subset build succeeded
  - `mapper-infra`
  - `web-support`
  - `screenbuilder-core`
  - `screenbuilder-runtime-common-adapter`
  - `platform-version-control`

## Current full reactor blockers

### Resolved in Wave 9: `stable-execution-gate`

Promoted contracts:

- `platform-request-contracts`
- `platform-service-contracts`

These were promoted into `Resonance` without artifact rename, and the selected gate build now passes.

### Partially reduced in Wave 10: `platform-observability-query`

`platform-observability-query` was promoted into `Resonance` and its selected build now passes.

### Remaining blocker: `platform-runtime-control`

Still depends on:

- `carbonet-common-core`
- renamed / bridged common modules through follow-up alignment
- `stable-execution-gate`

This means it needs a dedicated bridge wave after:

- common-core boundary decision
- runtime dependency rename alignment
- observability payload / related support review if still referenced indirectly

## Recommended next sequence

1. decide boundary
   - `carbonet-common-core`
2. bridge draft
   - `platform-runtime-control`
3. remaining support review
   - `platform-observability-payload`
   - `common-auth`
   - `screenbuilder-carbonet-adapter`

## Success criteria

- `stable-execution-gate` builds in Resonance selected reactor wave
- `platform-observability-query` builds in Resonance selected reactor wave
- `platform-runtime-control` bridge targets are explicitly defined
- next full reactor build has only known, intentional blockers
