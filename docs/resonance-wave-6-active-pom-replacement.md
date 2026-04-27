# Resonance Wave 6 Active POM Replacement

## Goal

비교 결과상 `rename-only`에 가까운 공통 모듈부터 실제 활성 `pom.xml` 치환을 시작한다.

이번 웨이브 대상:

1. `resonance-common/mapper-infra`
2. `resonance-common/web-support`
3. `resonance-builder/screenbuilder-core`

## Why these modules first

- current vs seed diff가 단순하다
- parent 유지 가능
- 추가 dependency ripple이 거의 없다
- `platform-version-control` 같은 bridge-heavy 모듈보다 안전하다

## Replacement rule

- active `pom.xml`를 바로 삭제하지 않는다
- 먼저:
  - `pom.xml.bak`
  를 만든다
- 그 다음:
  - `pom.wave5.seed.xml`
  - 또는 `pom.wave4.seed.xml`
  를 `pom.xml`로 복사한다

## Safety boundary

- `carbonet` 기존 reactor/build는 건드리지 않는다
- `platform-version-control` active replace는 아직 하지 않는다
- `screenbuilder-runtime-common-adapter`도 이번 웨이브에서는 보류한다

## Success criteria

- 세 모듈 모두:
  - `pom.xml.bak` 존재
  - active `pom.xml`가 `resonance-*` artifact naming으로 전환
- `carbonet` 관리자 화면 상태도 함께 갱신
