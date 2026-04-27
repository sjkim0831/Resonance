# Common Module Update Governance

## Goal

표준프레임워크의 200여 공통 모듈을 무작정 일괄 수정하지 않고, capability group과 adapter 검증 기준으로 안전하게 업데이트한다.

## Core rule

`module file list`가 아니라 `capability group + adapter impact + verification level`로 관리한다.

## Required catalogs

- `common-module-catalog.json`
- `adapter-catalog.json`
- `project-impact-matrix.json`
- `release-group-manifest.yaml`

## Recommended capability groups

- auth/authority
- account/user
- board/content
- menu/navigation
- builder/project/screen
- theme/design
- ops/runtime/deploy
- db/migration/audit

## Update wave process

1. common module catalog refresh
2. impacted capability groups select
3. adapter impact resolve
4. golden tests and schema checks run
5. compatibility report generate
6. release group package promote

## Verification classes

- `active-verified`
- `active-compat`
- `legacy-unverified`
- `deprecated-unused`

## AI usage rule

AI는 common 200여 모듈 전체를 읽고 추측하면 안 된다.

반드시 아래 순서로 움직인다.

1. common module catalog
2. capability group report
3. adapter compatibility report
4. bounded file set
5. patch generation
6. verifier

## Success criteria

- common update가 capability group 기준으로 설명 가능하다.
- adapter 영향이 사전에 계산된다.
- project split과 common update가 서로 섞여 폭발하지 않는다.
