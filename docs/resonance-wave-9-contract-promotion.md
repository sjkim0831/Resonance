# Resonance Wave 9 Contract Promotion

## Goal

`stable-execution-gate`를 막고 있는 계약 모듈 둘을 `Resonance`로 승격한다.

대상:

1. `platform-request-contracts`
2. `platform-service-contracts`

## Strategy

이번 웨이브는 `artifactId`를 바꾸지 않는다.

이유:

- `stable-execution-gate`가 이미 이 이름을 직접 참조한다
- `service-contracts`도 `request-contracts`를 직접 참조한다
- 우선은 full reactor blocker 해소가 목표다

즉:

- 경로는 `Resonance`로 승격
- parent는 `resonance-modules-parent`로 연결
- artifact 이름은 유지

## Placement

- `/opt/Resonance/modules/resonance-common/platform-request-contracts`
- `/opt/Resonance/modules/resonance-common/platform-service-contracts`

## Reactor update

`/opt/Resonance/modules/pom.xml`에 아래를 추가한다.

- `resonance-common/platform-request-contracts`
- `resonance-common/platform-service-contracts`

## Validation

```bash
cd /opt/Resonance/modules
mvn -q \
  -pl resonance-common/platform-request-contracts,resonance-common/platform-service-contracts,resonance-common/stable-execution-gate \
  -am -DskipTests package
```

## Success criteria

- 계약 모듈 두 개가 `Resonance`에 mirrored source로 존재
- parent가 `resonance-modules-parent`
- `stable-execution-gate` 선택 빌드가 통과하거나 blocker가 더 줄어든다
