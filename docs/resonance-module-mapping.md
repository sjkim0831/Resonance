# Resonance Module Mapping

## Goal

현재 Carbonet Maven reactor를 기준으로 어떤 모듈이 `Resonance common`, `project adapter`, `project runtime`, `application entrypoint`에 해당하는지 정리한다.

## Common / Platform modules

다음 모듈은 기본적으로 `Resonance common` 또는 `Resonance platform`으로 본다.

- `modules/common-auth`
- `modules/common-admin-runtime`
- `modules/common-content-runtime`
- `modules/common-payment`
- `modules/platform-request-contracts`
- `modules/platform-service-contracts`
- `modules/platform-runtime-control`
- `modules/platform-version-control`
- `modules/stable-execution-gate`
- `modules/platform-help`
- `modules/platform-help-content`
- `modules/platform-observability-query`
- `modules/platform-observability-web`
- `modules/platform-observability-payload`
- `modules/screenbuilder-core`
- `modules/screenbuilder-runtime-common-adapter`

## Carbonet-oriented shared modules

아래 모듈은 현재 Carbonet 이름을 갖고 있지만, 일부는 장기적으로 `Resonance`로 흡수될 수 있다.

- `modules/carbonet-common-core`
- `modules/carbonet-contract-metadata`
- `modules/carbonet-builder-observability`
- `modules/carbonet-mapper-infra`
- `modules/carbonet-web-support`
- `modules/screenbuilder-carbonet-adapter`

권장 해석:

- reusable and versioned logic -> 점진적으로 Resonance common으로 이동
- pure project binding -> carbonet-adapter로 유지

## Project adapter modules

- `projects/project-template-adapter`
- `projects/p003-adapter`
- `projects/p004-adapter`
- `projects/carbonet-adapter`

## Project runtime modules

- `projects/project-template`
- `projects/p003-runtime`
- `projects/p004-runtime`
- `projects/carbonet-runtime`

## App entrypoints

- `apps/operations-console`
- `apps/project-runtime`
- `apps/carbonet-app`

## Recommended target naming

장기 목표에서 이름은 아래처럼 정리하는 것이 적절하다.

- `modules/resonance-*`
- `projects/<project>-adapter`
- `projects/<project>-runtime`
- `apps/operations-console`
- `apps/project-runtime`

즉 project 이름은 유지하고, common/platform 쪽만 `Resonance` 이름으로 승격한다.
