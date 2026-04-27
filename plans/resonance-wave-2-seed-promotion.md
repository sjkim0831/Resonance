# Resonance Wave 2 Seed Promotion

## Goal

`carbonet` 빌드를 깨지 않으면서, 공통 후보 모듈 일부를 `Resonance` 워크스페이스로 실제 복사해 공통 프레임워크 승격의 시작점을 만든다.

## Strategy

이번 단계는 `move`가 아니라 `mirror promotion`이다.

즉:

- Carbonet reactor는 그대로 유지
- Resonance에는 공통 후보 모듈 소스를 복사
- 이후 검토 후에만 실제 빌드 경로를 전환

## Initial seed candidates

- `modules/platform-runtime-control`
- `modules/platform-version-control`
- `modules/stable-execution-gate`
- `modules/common-auth`
- `modules/screenbuilder-core`
- `modules/screenbuilder-runtime-common-adapter`

## Target folders

- `Resonance/modules/resonance-ops/platform-runtime-control`
- `Resonance/modules/resonance-ops/platform-version-control`
- `Resonance/modules/resonance-common/stable-execution-gate`
- `Resonance/modules/resonance-common/common-auth`
- `Resonance/modules/resonance-builder/screenbuilder-core`
- `Resonance/modules/resonance-builder/screenbuilder-runtime-common-adapter`

## Important rule

이 단계에서는:

- carbonet `pom.xml` 수정 안 함
- reactor module path 변경 안 함
- package rename 안 함

즉 source mirror만 수행한다.

## Success criteria

- Resonance workspace에 실제 공통 후보 소스가 존재한다.
- Carbonet 기존 빌드는 계속 통과한다.
- 다음 단계에서 module-by-module switch 계획을 세울 수 있다.
