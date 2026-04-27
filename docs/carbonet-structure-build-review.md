# Carbonet Structure and Build Review

## Goal

실제 원격 Carbonet 구조와 빌드 구성을 기준으로 `Resonance common / project adapter / runtime app` 분리 방향을 맞춘다.

## Actual structure

원격 `/opt/Resonance` 확인 결과:

- `modules/`
- `projects/`
- `apps/`
- `frontend/`
- `ops/`
- `data/`
- `docs/`

즉 이미 다층 구조가 존재한다.

## Maven reactor build

루트 `pom.xml`은 `packaging=pom`이며, 아래 모듈을 묶는다.

### Common / platform-like modules

- `modules/common-auth`
- `modules/common-admin-runtime`
- `modules/common-content-runtime`
- `modules/common-payment`
- `modules/platform-request-contracts`
- `modules/platform-service-contracts`
- `modules/platform-runtime-control`
- `modules/platform-version-control`
- `modules/stable-execution-gate`
- `modules/screenbuilder-core`
- `modules/screenbuilder-runtime-common-adapter`

### Carbonet-specific modules

- `modules/carbonet-common-core`
- `modules/carbonet-contract-metadata`
- `modules/carbonet-builder-observability`
- `modules/carbonet-mapper-infra`
- `modules/carbonet-web-support`
- `modules/screenbuilder-carbonet-adapter`

### Project modules

- `projects/project-template-adapter`
- `projects/project-template`
- `projects/p003-adapter`
- `projects/p003-runtime`
- `projects/p004-adapter`
- `projects/p004-runtime`
- `projects/carbonet-adapter`
- `projects/carbonet-runtime`

### Apps

- `apps/operations-console`
- `apps/project-runtime`
- `apps/carbonet-app`

## Interpretation

이 구조는 이미 아래 목표에 가깝다.

- `modules/*` = Resonance common / platform layer
- `projects/*-adapter` = project adapter layer
- `projects/*-runtime` = project runtime assembly
- `apps/*` = executable application layer

즉 다음 단계는:

1. 이름과 계약을 `Resonance common` 관점으로 문서화
2. adapter boundary를 강화
3. common-module catalog와 compatibility report를 추가
4. 프로젝트별 runtime/version governance를 더 명확히 하는 것

이지, 당장 폴더를 크게 재배치하는 것이 아니다.

## Recommended next structural moves

### 1. Keep existing reactor, clarify roles

- `modules/*`는 common/platform로 분류
- `projects/*`는 adapter/runtime로 분류
- `apps/*`는 product entrypoints로 분류

### 2. Introduce explicit catalogs

- `docs/resonance/common-module-update-governance.md`
- `data/ai-runtime/pattern-reference-manifest.json`
- future:
  - `data/module-catalog/common-module-catalog.json`
  - `data/module-catalog/adapter-compatibility-report.json`

### 3. Do not mass-rename yet

`carbonet -> resonance` 전역 치환은 아직 이르다.

현재는:

- framework vocabulary는 `Resonance`
- project name은 `carbonet`

으로 두는 것이 안전하다.
