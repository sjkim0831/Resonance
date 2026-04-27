# Resonance Common Module Active Replacement Plan

## Goal

`mapper-infra`, `web-support`, `screenbuilder-core`의 활성 `pom.xml`을 바로 바꾸지 않고,
실제 치환 직전 비교 기준을 먼저 고정한다.

## Target modules

1. `resonance-common/mapper-infra`
2. `resonance-common/web-support`
3. `resonance-builder/screenbuilder-core`

## Current draft set

### mapper-infra

- active:
  - `pom.xml`
- draft:
  - `pom.wave5.seed.xml`

### web-support

- active:
  - `pom.xml`
- draft:
  - `pom.wave5.seed.xml`

### screenbuilder-core

- active:
  - `pom.xml`
- draft:
  - `pom.wave4.seed.xml`

## Replacement checkpoints

### 1. artifact rename

- `carbonet-*` or generic artifact naming이 남아 있는지 확인
- target naming:
  - `resonance-mapper-infra`
  - `resonance-web-support`
  - `resonance-screenbuilder-core`

### 2. dependency rename impact

- 상위 또는 하위 모듈이 아직 old artifact 명을 참조하는지 확인
- bridge seed가 이미 있는 모듈과 순서를 맞춘다

### 3. parent retention

현재 웨이브에서는 모두 transitional parent를 유지한다.

- `groupId = egovframework`
- `artifactId = carbonet`
- `version = 1.0.0`
- `relativePath = ../../pom.xml`

즉 parent rewrite는 아직 다음 웨이브다.

## Safe replacement rule

- current `pom.xml` overwrite 금지
- current vs draft diff 먼저 확보
- diff 기준이 정리된 뒤에만 selective build wave로 진입

## Success criteria

- 세 모듈 모두 current vs draft 비교 자료가 있음
- 어떤 모듈이 rename-only 인지, 어떤 모듈이 dependency ripple이 큰지 판단 가능
- active replacement wave 진입 전 문서/스크립트/seed가 모두 정렬됨
