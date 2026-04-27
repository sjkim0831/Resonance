# Resonance Wave 4 Child POM Transition

## Goal

`Resonance` 워크스페이스에서 mirror promotion 된 모듈 중 실제 source 가 확인된 모듈부터 `child pom` 전환 기준을 고정한다.

이번 웨이브의 목적은 대규모 rename 이 아니라 아래 두 가지다.

- 어떤 child module 부터 전환할지 순서를 고정
- 전환 시 어떤 의존성/부모/리소스 경로가 막히는지 명확히 기록

## Target modules

우선 전환 대상:

1. `screenbuilder-core`
2. `screenbuilder-runtime-common-adapter`
3. `platform-version-control`

보류:

- `platform-runtime-control`
  - shared resources 경로 의존성 확인 필요
- `common-auth`
  - source gap 해소 필요

## Why these modules first

### 1. screenbuilder-core

- source tree 존재
- child pom 구조가 단순
- builder engine 축이라 `Resonance` 정체성과 잘 맞음

### 2. screenbuilder-runtime-common-adapter

- `screenbuilder-core`를 직접 참조
- builder runtime adapter 분리의 대표 사례

### 3. platform-version-control

- 운영/버전 control 축에서 가장 먼저 `Resonance ops`로 승격할 가치가 큼
- 다만 현재는 아래 blocker 가 있다.
  - `carbonet-mapper-infra`
  - `carbonet-web-support`
  - `screenbuilder-core`

## Transition rule

이 웨이브에서는 실제 remote child pom 을 즉시 rewrite 하지 않는다.
먼저 아래를 seed 로 만든다.

- rewritten child pom example
- dependency rename map
- parent alignment plan

그다음 다음 웨이브에서만 실제 child pom replace 를 검토한다.

## Parent alignment

현재 mirrored child pom 은 모두:

- `groupId = egovframework`
- `artifactId = carbonet`
- `version = 1.0.0`
- `relativePath = ../../pom.xml`

을 사용한다.

지금은 `/opt/Resonance/modules/pom.xml` 이 transitional parent 역할을 한다.

즉 Wave 4 seed 에서는:

- parent version 유지
- relativePath 유지
- 단, artifact naming / dependency mapping 초안만 분리

가 안전하다.

## Dependency rename direction

### builder side

- `screenbuilder-core`
  - future canonical name: `resonance-screenbuilder-core`

- `screenbuilder-runtime-common-adapter`
  - future canonical name: `resonance-screenbuilder-runtime-common-adapter`

### ops side

- `platform-version-control`
  - future canonical name: `resonance-platform-version-control`

### shared/common blockers

- `carbonet-mapper-infra`
- `carbonet-web-support`
- `platform-request-contracts`
- `platform-service-contracts`

이 artifact 들은 아직 `Resonance common` 쪽 canonical rename 이 되지 않았으므로,
실제 child pom 전환 전에 bridge 또는 추가 mirror promotion 이 필요하다.

## Success criteria

- `Resonance` child pom 전환 대상이 문서로 고정된다.
- seed pom 파일이 준비된다.
- 실제 replace 전 blocker 가 명확해진다.
- `carbonet` 기존 reactor/build 는 그대로 유지된다.
