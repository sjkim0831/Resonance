# Resonance Architecture

## Goal

`resonance`를 메인 표준 프레임워크로 두고, `carbonet`은 프로젝트 어댑터/프로젝트 바인딩을 가진 개별 프로젝트로 분리한다.

핵심 원칙:

- `공통(common)`과 `프로젝트(project)`는 직접 import로 엮지 않는다.
- 모든 교차 호출은 `Gate API` 또는 `Project Adapter API`를 통해서만 수행한다.
- 운영(`ops`), 공통(`common`), 빌더(`builder`), 프로젝트(`project`)를 capability 단위로 구분한다.
- AI 에이전트는 전체 저장소를 탐색하지 않고, 먼저 `resolver -> gate -> adapter` 경로를 따라간다.

## Layers

## Space-station Metaphor

운영 모델을 비유로 정리하면 아래와 같다.

- `운영/ops/control plane` = 우주정거장
- `Resonance common/framework` = 제트팩
- `project runtime + adapter` = 로켓
- `builder` = 조립소 / 발사체 제작 설비

즉 빌더는 “로켓 자체”가 아니라 로켓을 만들어내는 공장에 가깝다.

## Actual Repository Shape

원격 실구조 기준 Carbonet은 이미 Maven reactor 기반으로 아래처럼 나뉘어 있다.

- `modules/*`
  - common/auth/runtime/control/builder 같은 공통 모듈
- `projects/*`
  - project-template, p003, p004, carbonet adapter/runtime
- `apps/*`
  - `operations-console`
  - `project-runtime`
  - `carbonet-app`

즉 앞으로의 분리 작업은 “아예 처음부터 재구성”이 아니라, 이 구조 위에서 `Resonance common`, `project adapter`, `runtime app` 경계를 더 명확히 하는 방향이 맞다.

### 1. Ops Layer

운영 콘솔, 프로젝트 생성/수정/삭제, 이관, 배포, 버전 승격을 담당한다.

예시 capability:

- `ops.project.create`
- `ops.project.update`
- `ops.project.archive`
- `ops.release.promote`
- `ops.deploy.package`

### 2. Common Layer

여러 프로젝트에서 재사용되는 표준 기능과 표준 API 계약을 담당한다.

주의:

- common은 단일 거대 덩어리로 관리하지 않는다.
- 표준프레임워크의 200여 모듈은 capability group으로 묶어 관리한다.
- 각 group은 contract owner와 verification owner를 가진다.

예시 capability:

- `common.auth.check`
- `common.account.lookup`
- `common.menu.resolve`
- `common.board.post.list`
- `common.board.post.write`
- `common.theme.catalog.get`
- `common.builder.screen.schema`

빌더 엔진은 원칙적으로 이 common/framework 쪽에 둔다.

### 3. Project Layer

프로젝트별 정책, 라우트, 화면 구성, 예외 처리, 프로젝트 데이터 바인딩을 담당한다.

예시 capability:

- `project.carbonet.route.resolve`
- `project.carbonet.menu.binding`
- `project.carbonet.theme.binding`
- `project.carbonet.screen.compose`

프로젝트에는 빌더 엔진을 두지 않고, 빌더가 만들어낸 결과물과 project binding만 둔다.

### 4. Adapter Contract Layer

공통과 프로젝트를 실제로 분리하는 층이다.

종류:

- `empty adapter`
- `common adapter`
- `project adapter`

역할:

- canonical contract 유지
- 구버전/신버전 차이 흡수
- 프로젝트별 예외 흡수
- common 직접 수정 없이 project 바인딩 유지

핵심 원칙:

- project는 common core를 직접 호출하지 않는다
- 반드시 adapter 또는 gate를 통한다
- adapter마다 owner, contract version, verification level을 가진다

실구조 대응:

- `modules/*` = 공통 모듈/게이트/지원 계층
- `projects/*-adapter` = 프로젝트 어댑터
- `projects/*-runtime` = 프로젝트 런타임 조합
- `apps/*` = 최종 실행 애플리케이션

## Builder Placement

빌더는 세 층으로 나눠서 보는 것이 맞다.

### 1. Builder engine

위치:

- `Resonance common`
- 또는 `modules/screenbuilder-*`, `modules/platform-*` 같은 공통 계층

역할:

- page/schema/template generation
- project scaffold generation
- preview/render
- builder contract validation

즉 빌더의 “두뇌와 엔진”은 제트팩 쪽이다.

### 2. Builder console

위치:

- `ops`
- `apps/operations-console`

역할:

- 빌더 실행 UI
- 템플릿 선택
- manifest 생성
- preview 승인
- 패키지 생성 요청

즉 빌더를 조작하는 콘솔은 우주정거장 쪽이다.

### 3. Builder output

위치:

- `projects/<name>-adapter`
- `projects/<name>-runtime`
- generated page/config files

역할:

- project-specific page composition
- project manifest
- thin runtime wiring

즉 빌더의 산출물이 로켓 쪽으로 들어간다.

## Runtime Topology

### Option A. Fully isolated runtime per project

각 프로젝트를 별도 프로세스 또는 별도 런타임으로 구동한다.

장점:

- 한 프로젝트만 재기동 가능
- 장애 전파 최소화
- 프로젝트별 버전 pinning이 쉬움
- 운영 중 특정 프로젝트만 이관/교체 가능

단점:

- 공통 코드와 프레임워크 메모리가 프로젝트 수만큼 중복될 수 있음
- 프로젝트 수가 많아질수록 총 메모리 사용량 증가
- 운영 오케스트레이션 필요

권장 사용처:

- 중요한 고객사별 독립성
- 프로젝트별 릴리스 주기가 다름
- 프로젝트별 DB/포트/로그/캐시 분리가 필요함

### Option B. Shared runtime with isolated project slots

하나의 프로세스 안에 여러 프로젝트를 올리되, project registry와 adapter로 경계를 유지한다.

장점:

- 메모리 중복이 적음
- 운영 단순화
- 공통 캐시/프레임워크 재사용 가능

단점:

- 한 프로젝트 오류가 전체 프로세스에 영향 가능
- 특정 프로젝트만 정밀 재기동하기 어려움
- 버전 pinning 자유도가 떨어짐

권장 사용처:

- 내부 개발/스테이징
- 프로젝트 수는 많지만 활성 사용이 적음
- 빠른 초기 구축이 필요함

### Recommended hybrid model

권장 구조는 혼합형이다.

- 운영서버에서는 `shared control plane + isolated project runtime`
- 즉 ops/common control은 공유
- 실제 project runtime은 프로젝트별 독립 실행

이렇게 하면:

- 프로젝트별 재기동 가능
- 공통 관리와 registry는 공유 가능
- 메모리는 완전 공유형보다 더 먹지만, 안정성이 훨씬 좋아짐

## Memory Trade-off

프로젝트별로 따로 구동하면 메모리는 일부 중복된다.

중복되는 것:

- JVM/런타임 기본 오버헤드
- 공통 라이브러리 로딩
- framework cache
- ORM/session pool

분리되는 것:

- 프로젝트별 adapter/config/theme/runtime state
- 프로젝트별 DB connection pool
- 프로젝트별 request/session cache
- 프로젝트별 logs/uploads/temp state

현실적인 권장:

- 500개 프로젝트를 항상 동시에 full runtime으로 올리기보다
- active project만 상시 실행
- 나머지는 warm pool 또는 on-demand startup
- control plane에서 project lifecycle 관리

## Packaging and Migration

이관 단위는 다음 5가지 패키지로 나누는 것을 권장한다.

- `ops package`
- `common package`
- `project adapter package`
- `theme package`
- `migration package`

대규모 common 업데이트를 위해 추가로 아래 메타 패키지를 권장한다.

- `adapter-contract package`
- `common-module-catalog package`

프로젝트 manifest가 이 조합을 고정한다.

예시:

```yaml
project: carbonet
ops_version: 1.4.2
common_version: 3.2.1
project_adapter_version: 2.7.0
theme_bundle_version: 1.1.3
migration_bundle_version: 2026.04
runtime_mode: isolated
```

### Framework vs Project packaging rule

- `Resonance`는 폴더/워크스페이스 단위로 관리한다.
- 각 프로젝트는 `package + manifest + adapter + runtime assembly` 단위로 관리한다.

권장 해석:

- framework = folder/workspace
- project = versioned package set

즉 운영에서는:

- Resonance 폴더가 공통 코어와 catalog를 가진다.
- Carbonet 같은 프로젝트는 공통 JAR을 포함한 패키지 세트로 따로 실행된다.

### Independent project runtime package

각 프로젝트는 아래 조합으로 독립 실행 가능해야 한다.

- project runtime JAR
- project adapter JAR
- required common JAR set
- selected theme bundle
- migration bundle
- project manifest

이 조합만 맞으면:

- 운영서버에서 프로젝트별 따로 실행
- 한 프로젝트만 재기동
- 이관 시 필요한 공통 부분 포함 배포

이 가능하다.

## Boundary Model

### Common Gate API

프로젝트는 공통 내부 구현을 직접 호출하지 않고, 항상 `Common Gate API`를 통해 호출한다.

흐름:

`Project Request -> Project Adapter -> Common Gate API -> Common Core`

### Project Adapter API

프로젝트별 차이와 예외를 흡수한다.

역할:

- 프로젝트 입력을 canonical contract로 변환
- 프로젝트별 라우트/메뉴/권한/테마 바인딩 적용
- 공통 capability 호출 전/후 보정

### Common Module Catalog

공통 200여 모듈은 catalog 없이 직접 읽고 추론하지 않는다.

권장 메타데이터:

- `module_id`
- `capability_group`
- `contract_version`
- `owner`
- `adapter_required`
- `verification_level`
- `upgrade_wave`
- `project_impact`

AI와 내부 worker는 이 catalog를 우선 참조해야 한다.

### Manifest

각 프로젝트는 자신이 사용할 수 있는 capability와 버전을 manifest로 고정한다.

예시:

```yaml
project: carbonet
framework: resonance
allowed_common_capabilities:
  - common.auth.check.v2
  - common.account.lookup.v2
  - common.board.post.list.v3
  - common.theme.catalog.get.v1
  - common.builder.screen.schema.v1
project_adapters:
  - project.carbonet.route.resolve.v1
  - project.carbonet.theme.binding.v1
  - project.carbonet.screen.compose.v1
blocked_internal_modules:
  - common.internal.jpa
  - common.internal.cache
  - common.internal.batch
runtime_package_set:
  - apps/project-runtime
  - projects/carbonet-runtime
  - projects/carbonet-adapter
common_package_set:
  - modules/common-auth
  - modules/platform-runtime-control
  - modules/platform-version-control
```

## AI Workflow

AI는 아래 순서로만 움직인다.

1. `scope_resolver`
   요청이 `ops/common/project/builder/theme` 중 어디인지 판별
2. `route_or_capability_resolver`
   URL 또는 요구사항을 `routeId` 또는 `capability`로 확정
3. `candidate_builder`
   읽을 파일 목록을 최대 15~20개로 축소
4. `planner`
   수정 범위, 산출물, 검증 규칙 결정
5. `implementer`
   실제 수정 또는 HTML 산출물 생성
6. `verifier`
   changed_files, schema, contract, build, artifact 검증

공통 모듈 업데이트나 프로젝트 분리 작업일 때 추가 단계:

7. `adapter_impact_resolver`
   affected adapters, compatibility level, blocked projects 판정
8. `module_update_verifier`
   common-module-catalog + adapter golden test + impact matrix 검증

## Finder Budget

에이전트는 항상 탐색 예산을 강제한다.

- `max_files: 20`
- `max_total_lines: 2500`
- `max_search_seconds: 20`
- `max_candidate_dirs: 3`

## Carbonet to Resonance Transition

### Rename Strategy

- 프레임워크 이름: `resonance`
- 프로젝트 이름: `carbonet`

### Result

- `resonance`: 공통 표준 프레임워크 + 운영 + 빌더 + 테마 카탈로그
- `carbonet`: 프로젝트 바인딩 + 프로젝트 화면/정책 + 프로젝트 데이터 모델

### What moves to resonance

- 권한 표준 계약
- 계정 표준 계약
- 게시판 표준 계약
- 메뉴/테마/빌더 표준 계약
- 운영 및 배포 capability
- 버전업 가능성이 있는 공통 Java 서비스 로직
- 강한 계산/검증/승인/배치 로직
- DB 정책과 migration policy
- screen builder 엔진
- AI control plane / model gateway / verifier

### What stays in carbonet

- carbonet 라우트 바인딩
- carbonet 메뉴 바인딩
- carbonet 테마 선택/재정의
- carbonet 화면 조합
- carbonet 프로젝트별 정책
- 얇은 project config
- 가벼운 Java wiring code
- project label / wording / layout-level override

### Project-light rule

`carbonet`은 기능 구현체보다 구성체에 가까워야 한다.

즉 Carbonet에는 아래만 남기는 것이 원칙이다.

- route binding
- menu binding
- theme binding
- screen composition metadata
- thin runtime wiring
- project-specific configuration

반대로 아래는 가능하면 Carbonet에 남기지 않는다.

- 복잡한 service logic
- 공통 validation
- 공통 auth/account/board logic
- 공통 DB processing
- broad calculation logic
- reusable workflow engine

## Responsibility Matrix

### Resonance

- 업그레이드 가능성이 높은 코드
- 여러 프로젝트가 재사용할 가능성이 있는 코드
- 공통 API 계약
- 공통 Java 서비스
- 공통 운영/배포/백업/롤백 로직
- 빌더/테마/권한/게시판/계정 기능
- 공통 DB 정책

### Resonance Adapter

- canonical contract 유지
- common module version 차이 흡수
- empty/common adapter 기준점 제공
- project adapter가 호출할 공통 경계층 제공

### Carbonet Adapter

- Carbonet route/menu/theme/page binding
- Carbonet-specific exception mapping
- Resonance capability 호출 전후의 얇은 project mapping
- 가능하면 project-specific heavy logic 금지

### Carbonet Runtime

- Carbonet manifest
- runtime wiring
- environment-specific project assembly
- adapter + theme + runtime config 조합

## AI Control Plane Placement

AI orchestration code는 resonance core에 직접 섞지 않는 것을 권장한다.

권장 분리:

- `resonance`: framework contracts, route registry, capability registry, manifests
- `resonance-ai-control`: agent workflows, model routing, memory/index, evaluation, codex/hermes adapters

이유:

- 프레임워크 릴리스와 AI 실험 릴리스가 다름
- AI 계층은 빈번히 바뀜
- 모델/평가/오케스트레이션은 운영 도구에 가까움

## Small-model-only feasibility

`3B` 단일 모델 하나만으로 전체 업무를 안정적으로 수행하는 것은 권장하지 않는다.

가능한 범위:

- intake
- scope classification
- route/capability classification
- candidate reranking
- verifier 1차 판정

어려운 범위:

- 일반화된 planner
- 멀티파일 구현
- DB migration 설계
- 공통/프로젝트 경계 넘는 리팩터링

현실적인 최소 구성:

- small model 하나
- deterministic resolver
- route registry
- capability registry
- adapter registry
- common module catalog
- project memory/index
- strict JSON handoff
- patch verifier

즉 작은 모델만 써도 일부는 가능하지만, 품질은 모델보다 전처리와 검증 계층에 달려 있다.

## Authority Review

원격 코드 기준 프런트는 이미 아래 구조를 갖고 있다.

- `frontend/src/app/policy/authorityScope.ts`
- `frontend/src/components/access/PermissionGate.tsx`
- `frontend/src/components/access/CanUse.tsx`

해석:

- 권한 판단은 `featureCode` 기반
- action별 `view/query/export/create/update/delete/execute/approve` 구분 존재
- scope/authority UI 계층은 이미 있음

따라서 새 권한 엔진은 필요하지 않다.

대신 필요한 것은 backend/common 쪽의 표준 Gate API 정리다.

권장 최소 API:

- `common.authority.context.get.v1`
- `common.authority.feature.catalog.v1`
- `common.authority.scope.verify.v1`
- `common.authority.action.check.v1`
- `common.authority.resource.check.v1`

주의:

- 원격 `modules/common-auth`는 현재 JAR 산출물만 보이고 source가 비어 있는 상태라, 권한 Gate API를 실제로 만들 때는 source owner/module 위치를 먼저 정리해야 한다.
