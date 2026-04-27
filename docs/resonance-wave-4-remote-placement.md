# Resonance Wave 4 Remote Placement

## Goal

`Wave 4` child `pom` 초안을 실제 `Resonance` 모듈 디렉터리 안에 배치하되, 현재 활성 `pom.xml`은 그대로 둔다.

## Placement rule

- active file:
  - `pom.xml`
- draft file:
  - `pom.wave4.seed.xml`

즉 실제 build input 은 그대로 유지하고, 다음 웨이브에서:

- current `pom.xml`
- `pom.wave4.seed.xml`

를 비교해 안전하게 치환 여부를 판단한다.

## Initial placement targets

1. `modules/resonance-builder/screenbuilder-core/pom.wave4.seed.xml`
2. `modules/resonance-builder/screenbuilder-runtime-common-adapter/pom.wave4.seed.xml`
3. `modules/resonance-ops/platform-version-control/pom.wave4.seed.xml`

## Why module-local placement matters

- 문서 폴더에만 있으면 실제 치환 대상과 떨어져 있어 추적이 어렵다.
- module 옆에 draft 를 두면:
  - current vs draft 비교가 쉬움
  - diff 검토가 쉬움
  - 다음 웨이브에서 일괄 치환 스크립트를 만들기 쉬움

## Safety rule

- 현재 웨이브에서는 remote active `pom.xml` overwrite 금지
- source gap module (`common-auth`) 는 draft placement 대상에서 제외
- `carbonet` 기존 reactor/build 는 계속 untouched 유지
