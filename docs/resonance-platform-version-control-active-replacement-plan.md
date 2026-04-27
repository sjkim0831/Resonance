# Resonance Platform-Version-Control Active Replacement Plan

## Goal

`platform-version-control`의 활성 `pom.xml`을 즉시 바꾸지 않고, 실제 치환 직전 검토 기준을 고정한다.

## Current state

현재 모듈에는 아래가 함께 존재한다.

- active:
  - `pom.xml`
- wave 4 draft:
  - `pom.wave4.seed.xml`
- wave 5 bridge draft:
  - `pom.wave5.bridge.seed.xml`

즉 지금 단계는 “치환”이 아니라 “비교 가능한 상태”를 만든 것이다.

## Recommended replacement target

활성 치환 시 목표 기준은 `pom.wave5.bridge.seed.xml`이다.

이유:

- `resonance-screenbuilder-core`
- `resonance-mapper-infra`
- `resonance-web-support`

세 공통 의존성을 모두 반영하고 있기 때문이다.

## Preconditions before active replacement

1. `mapper-infra` mirrored source 확인
2. `web-support` mirrored source 확인
3. `screenbuilder-core` Wave 4 draft 존재 확인
4. `platform-version-control` current vs bridge diff 검토
5. `Resonance/modules/pom.xml` build set 포함 여부 결정

## Diff checkpoints

### artifact rename

- current:
  - `platform-version-control`
- target:
  - `resonance-platform-version-control`

### dependency rename

- current:
  - `carbonet-mapper-infra`
  - `screenbuilder-core`
  - `carbonet-web-support`

- target:
  - `resonance-mapper-infra`
  - `resonance-screenbuilder-core`
  - `resonance-web-support`

### parent

- keep for now:
  - `groupId = egovframework`
  - `artifactId = carbonet`
  - `version = 1.0.0`
  - `relativePath = ../../pom.xml`

즉 parent 는 아직 transitional 상태를 유지한다.

## Replacement wave rule

- do not overwrite active `pom.xml` in the same wave as the first bridge seed placement
- compare active/draft first
- only replace when:
  - mirrored common modules are present
  - bridge dependencies are documented
  - optional build wave has a rollback plan

## Immediate next action

1. compare:
   - `pom.xml`
   - `pom.wave5.bridge.seed.xml`
2. produce diff note
3. decide whether to:
   - keep draft only
   - or start a selective Resonance build wave
