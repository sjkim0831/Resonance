# Resonance Wave 10 Observability Query Promotion

## Goal

`platform-runtime-control`의 blocker를 줄이기 위해 `platform-observability-query`를 `Resonance`로 승격한다.

## Why this module next

- source / pom 구조가 단순하다
- 이미 승격된 `platform-service-contracts`를 사용한다
- `carbonet-mapper-infra` 의존성은 `resonance-mapper-infra`로 bridge 하면 된다
- `platform-runtime-control`가 직접 참조한다

## Strategy

- 경로는 `Resonance`로 승격
- parent는 `resonance-modules-parent`
- artifact 이름은 그대로 유지
  - `platform-observability-query`
- 의존성만 bridge
  - `carbonet-mapper-infra` -> `resonance-mapper-infra`

## Placement

- `/opt/Resonance/modules/resonance-common/platform-observability-query`

## Reactor update

`/opt/Resonance/modules/pom.xml`에 아래를 추가한다.

- `resonance-common/platform-observability-query`

## Validation

```bash
cd /opt/Resonance/modules
mvn -q \
  -pl resonance-common/platform-request-contracts,resonance-common/platform-service-contracts,resonance-common/mapper-infra,resonance-common/platform-observability-query \
  -am -DskipTests package
```

## Success criteria

- `platform-observability-query`가 `Resonance`에 mirrored source로 존재
- parent가 `resonance-modules-parent`
- `resonance-mapper-infra`를 참조하도록 bridge 완료
- selected build 통과
