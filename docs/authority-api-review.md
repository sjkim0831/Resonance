# Authority API Review

## Goal

기존 `scope` 기반 구조를 유지하면서, 실제로 추가가 필요한 권한 Gate API만 정리한다.

## What exists already

원격 프런트 기준:

- `frontend/src/app/policy/authorityScope.ts`
- `frontend/src/components/access/PermissionGate.tsx`
- `frontend/src/components/access/CanUse.tsx`

이미 다음이 존재한다.

- `featureCode` 기반 권한 판단
- action별 구분
  - `view`
  - `query`
  - `export`
  - `create`
  - `update`
  - `delete`
  - `execute`
  - `approve`
- 권한 거부 사유 메시지 생성
- UI 레벨 gating

## Important finding

원격 `modules/common-auth`는 현재 JAR 산출물만 보이고 source tree가 비어 있다.

즉 권한 API 추가 논의는 “새 권한 모델을 만든다”가 아니라:

- source owner를 먼저 정리하고
- existing scope/feature model을 common gate API로 꺼내는 것

이 맞다.

## Recommended minimal authority Gate APIs

- `common.auth.check.v2`
- `common.authority.context.get.v1`
- `common.authority.feature.catalog.v1`
- `common.authority.scope.verify.v1`
- `common.authority.action.check.v1`
- `common.authority.resource.check.v1`

## Why these are enough

### `context.get`

- 현재 사용자
- 기관/조직
- 프로젝트
- scope binding

### `feature.catalog`

- 프런트 `featureCode`와 action 매핑
- 메뉴/페이지별 view/execute/approve 규칙

### `scope.verify`

- 현재 scope에서 접근 가능한지

### `action.check`

- create/update/delete/execute/approve 같은 액션이 가능한지

### `resource.check`

- 특정 리소스 대상 접근 가능 여부

## Conclusion

- 추가 API가 전혀 없는 것은 아니다.
- 하지만 새 권한 시스템이나 방대한 권한 API 세트는 필요 없다.
- 현재 구조상 위 5~6개 Gate API면 충분하다.
