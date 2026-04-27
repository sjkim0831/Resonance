# Resonance Wave 2 Module Promotion Plan

## Goal

문서/카탈로그 분리 이후, 실제 공통 모듈을 `Resonance` 워크스페이스로 승격할 대상을 정한다.

## Promotion candidates

우선순위 상위:

- `modules/platform-runtime-control`
- `modules/platform-version-control`
- `modules/stable-execution-gate`
- `modules/common-auth`
- `modules/screenbuilder-core`
- `modules/screenbuilder-runtime-common-adapter`

검토 후 승격:

- `modules/common-admin-runtime`
- `modules/common-content-runtime`
- `modules/common-payment`
- `modules/platform-request-contracts`
- `modules/platform-service-contracts`

Carbonet 의존성 검토 필요:

- `modules/carbonet-common-core`
- `modules/carbonet-contract-metadata`
- `modules/carbonet-builder-observability`
- `modules/carbonet-mapper-infra`
- `modules/carbonet-web-support`
- `modules/screenbuilder-carbonet-adapter`

## Rule

실제 코드 승격은 반드시 아래 순서로 한다.

1. module catalog classification
2. adapter impact report
3. package path 결정
4. build fix
5. runtime verify
