# Resonance Project Runtime Deployment Model

## Goal

프로젝트별 빌드 패키지를 따로 기동할 수 있고, 공통은 어댑터와 common JAR set으로 잘 나누어 공통만 업데이트해도 프로젝트를 최대한 안 건드리는 방향을 정의한다.

## Core deployment rule

- 공통 업데이트는 `Resonance common`에서 처리
- adapter compatibility 검증 후 common JAR set 새 버전 생성
- 프로젝트는 가능하면 source 수정 없이 새 common JAR set만 교체

## Project runtime unit

프로젝트별 실행 단위:

- `project-runtime.jar`
- `project-adapter.jar`
- `common-jar-set`
- `theme-bundle`
- `project-manifest`
- `k8s-release-manifest`

## What changes on common update

- `common-jar-set` version
- `adapter contract` version
- possibly `builder structure version`

## What should not change if possible

- project page composition files
- project-specific route binding
- project wording/config

## Builder implication

빌더는 업데이트 이후에도 최신 구조를 따라가야 한다.

즉:

- framework structure version 확인
- common JAR set version 확인
- adapter contract version 확인
- 그 기준으로 scaffolding / package compose

## Success criteria

- 공통 업데이트 시 project source를 대량 수정하지 않는다.
- project runtime package만 다시 조립하면 되는 경우가 많다.
- adapter compatibility가 깨질 때만 project code를 만진다.
- Kubernetes release 단위까지 project별로 독립 관리 가능하다.
