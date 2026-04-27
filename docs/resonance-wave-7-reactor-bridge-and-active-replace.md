# Resonance Wave 7 Reactor Bridge and Active Replacement

## Goal

`Wave 6`에서 active 치환이 끝난 공통 모듈을 실제 `Resonance` 선택 빌드에 연결한다.

이번 웨이브 대상:

1. `resonance-builder/screenbuilder-runtime-common-adapter`
2. `resonance-ops/platform-version-control`
3. `Resonance/modules/pom.xml` reactor bridge

## Why this wave now

- `screenbuilder-core`
- `resonance-mapper-infra`
- `resonance-web-support`

가 이미 active `pom.xml` 기준으로 승격되었다.

즉 다음 모듈들은 이제 새 artifact 이름을 바라보도록 active replace 할 수 있다.

- `screenbuilder-runtime-common-adapter`
- `platform-version-control`

## Reactor bridge

`platform-version-control`가 빌드되려면 `mapper-infra`, `web-support`가 `Resonance/modules/pom.xml`에 포함되어야 한다.

이번 웨이브에서는 `modules/pom.xml`에 아래를 추가한다.

- `resonance-common/mapper-infra`
- `resonance-common/web-support`

## Replacement rule

- active `pom.xml`는 교체 전에 반드시 `.bak` 백업을 남긴다
- `screenbuilder-runtime-common-adapter`는 `pom.wave4.seed.xml`으로 교체
- `platform-version-control`는 `pom.wave5.bridge.seed.xml`으로 교체
- `modules/pom.xml`도 `pom.xml.bak`를 남긴 뒤 bridge 추가

## Validation

교체 후 아래 선택 빌드를 시도한다.

```bash
cd /opt/Resonance/modules
mvn -q \
  -pl resonance-common/mapper-infra,resonance-common/web-support,resonance-builder/screenbuilder-core,resonance-builder/screenbuilder-runtime-common-adapter,resonance-ops/platform-version-control \
  -am -DskipTests package
```

## Success criteria

- `modules/pom.xml.bak` 존재
- `screenbuilder-runtime-common-adapter/pom.xml.bak` 존재
- `platform-version-control/pom.xml.bak` 존재
- active `pom.xml`들이 `resonance-*` artifact 기준으로 교체
- 선택 빌드가 성공하거나, 실패 지점이 명확하게 수집됨
