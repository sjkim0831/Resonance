# Resonance Dependency Bridge Candidates

## Goal

`Wave 4` 이후 실제 child `pom` 치환 전에, 아직 `carbonet-*` artifact 에 묶여 있는 의존성을 `bridge candidate`로 먼저 정리한다.

## Current focus

### 1. screenbuilder-runtime-common-adapter

- current dependency:
  - `screenbuilder-core`
- future bridge:
  - `screenbuilder-core -> resonance-screenbuilder-core`

## 2. platform-version-control

- current dependencies:
  - `carbonet-mapper-infra`
  - `screenbuilder-core`
  - `carbonet-web-support`

- next bridge candidates:
  - `screenbuilder-core -> resonance-screenbuilder-core`
  - `carbonet-mapper-infra -> resonance-mapper-infra` or temporary compatibility artifact
  - `carbonet-web-support -> resonance-web-support` or temporary compatibility artifact

### inspection result

- `carbonet-mapper-infra`
  - `pom.xml` present
  - `src` present
  - `target` present
  - safe to treat as `Wave 5 mirror promotion candidate`

- `carbonet-web-support`
  - `pom.xml` present
  - `src` present
  - `target` present
  - safe to treat as `Wave 5 mirror promotion candidate`

## 3. stable-execution-gate

- current dependencies:
  - `platform-request-contracts`
  - `platform-service-contracts`

- next bridge candidates:
  - `platform-request-contracts -> resonance-platform-request-contracts`
  - `platform-service-contracts -> resonance-platform-service-contracts`

## Bridge policy

- prefer `mirror promotion` before rename
- keep active child `pom.xml` unchanged until dependency bridge draft exists
- use `pom.wave4.seed.xml` for target shape first
- if a dependency has no source-ready mirror, document it as blocked instead of forcing rename

## Immediate next set

1. place `screenbuilder-runtime-common-adapter/pom.wave4.seed.xml`
2. add UI/manifest visibility for dependency bridge blockers
3. mirror-promote `carbonet-mapper-infra` and `carbonet-web-support` into `Resonance common` as Wave 5 seed candidates
