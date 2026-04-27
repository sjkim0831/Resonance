# Resonance Wave 5 Bridge Transition

## Goal

`Wave 5`에서 mirrored 된 `mapper-infra`, `web-support`를 기준으로 `platform-version-control` dependency bridge 초안을 한 단계 더 구체화한다.

## Scope

- `resonance-common/mapper-infra`
- `resonance-common/web-support`
- `resonance-ops/platform-version-control`

## Draft placement rule

- active file:
  - `pom.xml`
- draft file:
  - `pom.wave5.seed.xml`

`platform-version-control`은 별도로:

- `pom.wave5.bridge.seed.xml`

를 두어 dependency bridge 초안임을 분명히 한다.

## Bridge target

현재 `platform-version-control`의 공통 의존성 목표:

- `carbonet-mapper-infra -> resonance-mapper-infra`
- `screenbuilder-core -> resonance-screenbuilder-core`
- `carbonet-web-support -> resonance-web-support`

## Safety rule

- active `pom.xml` overwrite 금지
- mirrored common source 확인 후에도 먼저 draft 만 배치
- build wave 는 draft diff 검토 후 별도 진행

## Success criteria

- `mapper-infra`, `web-support`에 `pom.wave5.seed.xml` 존재
- `platform-version-control`에 `pom.wave5.bridge.seed.xml` 존재
- 다음 웨이브에서 current vs draft 기준으로 실제 치환 검토 가능
