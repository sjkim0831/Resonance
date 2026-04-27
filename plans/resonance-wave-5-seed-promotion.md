# Resonance Wave 5 Seed Promotion

## Goal

`Wave 5`에서는 `platform-version-control`의 dependency bridge 후보 중 source-ready 상태가 확인된 공통 모듈을 `Resonance common` 워크스페이스로 미러 승격한다.

## Target modules

1. `carbonet-mapper-infra`
   - target:
     - `Resonance/modules/resonance-common/mapper-infra`
2. `carbonet-web-support`
   - target:
     - `Resonance/modules/resonance-common/web-support`

## Promotion policy

- active `carbonet` reactor/build 는 유지
- rename 은 하지 않고 mirror 만 수행
- 이후 dependency bridge 문서와 child `pom` 치환 웨이브에서 canonical naming 을 검토

## Expected outcome

- `Resonance common` 쪽에 mapper/web-support source 가 같이 존재
- `platform-version-control` bridge 검토가 문서 수준이 아니라 실제 mirrored source 기준으로 가능
- `carbonet`는 계속 thin project 유지
