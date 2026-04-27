# Resonance Common JAR Governance

## Goal

공통 업데이트가 발생해도 프로젝트별 배포와 어댑터 호환성이 깨지지 않도록, 공통 JAR 세트를 버전 단위로 관리한다.

## Core idea

프로젝트는 공통 코드를 직접 흩어져 참조하는 대신, `common JAR set`을 pinning해서 사용한다.

예:

- `common-auth.jar`
- `platform-runtime-control.jar`
- `platform-version-control.jar`
- `screenbuilder-core.jar`

## Rule

- 공통 업데이트는 먼저 `Resonance common`에 반영
- 그 다음 `common JAR set` 버전 생성
- 그 다음 adapter compatibility 검증
- 마지막으로 프로젝트 패키지에 포함

## Project delivery

프로젝트 배포 시 포함되는 것:

- project runtime
- project adapter
- pinned common JAR set
- theme bundle
- migration bundle
- package manifest

즉 공통 JAR도 프로젝트 배포물에 포함될 수 있다.

## Why builder must know this

빌더가 단순 파일 생성기라면 framework 업데이트를 반영하지 못한다.

하지만 builder가:

- current common JAR set
- adapter contract version
- package manifest version

를 알고 있으면, 업데이트 이후에도 맞는 구조로 스캐폴딩할 수 있다.

## Required metadata

- `jar_set_id`
- `common_version`
- `included_modules`
- `adapter_contract_version`
- `builder_structure_version`
- `compatibility_report_id`

## Success criteria

- 공통 업데이트 후에도 어떤 JAR 세트를 프로젝트에 포함해야 하는지 명확하다.
- builder가 최신 구조를 따라 스캐폴딩할 수 있다.
