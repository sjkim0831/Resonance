# Resonance Wave 8 Parent Artifact Rename

## Goal

`Resonance/modules`의 transitional parent artifact 이름에서 남아 있는 `carbonet` 흔적을 제거한다.

이번 웨이브에서는:

1. `/opt/Resonance/modules/pom.xml`
2. 현재 reactor에 포함된 child module parent reference

를 함께 전환한다.

## Rename target

- before: `egovframework:carbonet:1.0.0`
- after: `egovframework:resonance-modules-parent:1.0.0`

## Why now

- `Wave 7`에서 bridge build가 이미 성공했다
- 현재 reactor child는 대부분 `Resonance` artifact naming으로 승격되었다
- parent artifact 이름만 남아 있어, 개념 경계가 아직 흐리다

## Scope

현재 reactor 기준 대상:

- `resonance-common/stable-execution-gate`
- `resonance-common/mapper-infra`
- `resonance-common/web-support`
- `resonance-builder/screenbuilder-core`
- `resonance-builder/screenbuilder-runtime-common-adapter`
- `resonance-ops/platform-version-control`
- `resonance-ops/platform-runtime-control`

## Safety rule

- 먼저 `pom.xml.bak.wave8` 백업 생성
- 그 다음 parent artifact rename 적용
- 적용 후 reactor selective build 실행

## Validation

```bash
cd /opt/Resonance/modules
mvn -q -DskipTests package
```

## Success criteria

- `modules/pom.xml` artifactId가 `resonance-modules-parent`
- reactor child들이 모두 같은 parent artifactId를 참조
- `mvn -q -DskipTests package` 통과
