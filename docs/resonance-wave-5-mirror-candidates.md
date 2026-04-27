# Resonance Wave 5 Mirror Candidates

## Goal

`platform-version-control`의 dependency bridge 후보 중 source-ready 상태가 확인된 모듈을 다음 공통 승격 웨이브 대상으로 고정한다.

## Confirmed candidates

### 1. carbonet-mapper-infra

- current path:
  - `/opt/Resonance/modules/carbonet-mapper-infra`
- inspection result:
  - `pom.xml` present
  - `src` present
  - `target` present
- candidate target:
  - `Resonance/modules/resonance-common/mapper-infra`

### 2. carbonet-web-support

- current path:
  - `/opt/Resonance/modules/carbonet-web-support`
- inspection result:
  - `pom.xml` present
  - `src` present
  - `target` present
- candidate target:
  - `Resonance/modules/resonance-common/web-support`

## Why these matter first

- `platform-version-control` currently depends on both modules
- both are source-ready
- both look structurally simple enough for mirror promotion before full rename

## Recommended Wave 5 order

1. mirror `carbonet-mapper-infra`
2. mirror `carbonet-web-support`
3. document dependency mapping into `platform-version-control`
4. only then review active `pom.xml` replacement wave

## Safety rule

- keep active `carbonet` build untouched
- mirror first, rename later
- create `pom.wave5.seed.xml` only after mirror placement if needed
