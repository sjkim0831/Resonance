# Resonance Bundle Layout

## Goal

프로젝트별 독립 실행과 이관 배포를 동시에 만족하는 번들 디렉터리 구조를 정의한다.

## Example layout

```text
bundle/
  manifest/
    project-manifest.yaml
  runtime/
    project-runtime.jar
    project-adapter.jar
  common/
    common-auth.jar
    platform-runtime-control.jar
    platform-version-control.jar
    stable-execution-gate.jar
  builder/
    screenbuilder-core.jar
    screenbuilder-runtime-common-adapter.jar
  theme/
    brand-resonance/
    project-carbonet/
  migration/
    V2026_04__carbonet.sql
  scripts/
    install.sh
    start.sh
    stop.sh
    restart.sh
    verify.sh
  source/
    carbonet-source.tar.gz
```

## Rules

- runtime과 adapter는 project 단위
- common은 pinned jar set
- source snapshot은 이관/복구용
- scripts는 deterministic worker 실행 기준

## Operational benefit

- 운영서버에서 프로젝트별 개별 실행 가능
- 필요한 공통 JAR을 함께 묶을 수 있음
- 소스 전달 기반 이관도 가능
- rollback과 reinstall 기준이 명확해짐

## Container/Kubernetes extension

이 bundle layout은 컨테이너 이미지의 입력물로도 적합하다.

예:

- `bundle/runtime/*` -> container runtime layer
- `bundle/common/*` -> common JAR layer
- `bundle/manifest/*` -> ConfigMap / mounted manifest
- `bundle/scripts/*` -> entrypoint or ops hooks
