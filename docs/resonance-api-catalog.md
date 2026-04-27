# Resonance API Catalog

## Design Rule

API는 URL이나 클래스 중심이 아니라 `capability` 중심으로 관리한다.

네이밍 규칙:

- `ops.*`
- `common.*`
- `builder.*`
- `theme.*`
- `project.<name>.*`

모든 capability는 버전을 가진다.

예:

- `common.auth.check.v2`
- `common.account.user.create.v1`
- `common.board.post.list.v3`
- `theme.catalog.list.v1`
- `builder.screen.template.generate.v1`
- `project.carbonet.route.resolve.v1`

## Suggested Capability Groups

### Auth / Authority

- `common.auth.check.v2`
- `common.auth.role.list.v1`
- `common.authority.permission.resolve.v2`
- `common.authority.scope.verify.v1`
- `common.authority.context.get.v1`
- `common.authority.resource.check.v1`
- `common.authority.action.check.v1`
- `common.authority.project.scope.bind.v1`

설명:

- 로그인 여부 확인
- 사용자 역할 확인
- 메뉴/기능 권한 확인
- 프로젝트/기관/조직 범위 확인

권장 해석:

- 기존 `scope` 시스템이 이미 있다면 새 권한 엔진을 만들지 않는다
- 대신 scope를 감싸는 표준 Gate API를 만든다

실구조 확인 메모:

- 프런트는 이미 `authorityScope.ts`, `PermissionGate.tsx`, `CanUse.tsx`를 통해 feature/action 중심 권한 모델을 사용 중이다.
- 따라서 API는 이 모델을 backend/common gate로 드러내는 쪽이 맞다.

추가 권장 capability:

- `common.authority.context.get`
  현재 사용자/기관/프로젝트/scope 컨텍스트 조회
- `common.authority.resource.check`
  특정 리소스 접근 가능 여부 판정
- `common.authority.action.check`
  create/update/delete/approve/execute 등의 액션 가능 여부 판정
- `common.authority.project.scope.bind`
  프로젝트별 scope 바인딩 정책 조회
- `common.authority.feature.catalog`
  프런트 `featureCode`/action 매핑 카탈로그 조회

현재 기준 권장 결론:

- 권한 관련 API를 무한정 늘릴 필요는 없다.
- 아래 6개를 최소 표준면으로 잡는 것이 적절하다.
  - `common.auth.check.v2`
  - `common.authority.context.get.v1`
  - `common.authority.feature.catalog.v1`
  - `common.authority.scope.verify.v1`
  - `common.authority.action.check.v1`
  - `common.authority.resource.check.v1`

### Account

- `common.account.user.get.v2`
- `common.account.user.search.v2`
- `common.account.user.create.v1`
- `common.account.user.update.v1`
- `common.account.user.status.change.v1`

설명:

- 계정 조회/검색/생성/수정
- 휴면/정지/승인 상태 전환

### Board / Content

- `common.board.board.list.v1`
- `common.board.post.list.v3`
- `common.board.post.detail.v2`
- `common.board.post.create.v2`
- `common.board.post.update.v2`
- `common.board.file.attach.v1`

설명:

- 표준 게시판 API는 resonance 공통에서 제공하고 프로젝트는 바인딩만 수행

### Menu / Navigation

- `common.menu.resolve.v3`
- `common.menu.tree.get.v2`
- `project.carbonet.menu.binding.v1`
- `project.carbonet.route.resolve.v1`

설명:

- 공통 메뉴 계산
- 프로젝트별 메뉴 바인딩
- 프로젝트 라우트 해석

### Theme

- `theme.catalog.list.v1`
- `theme.token.get.v1`
- `theme.bundle.resolve.v1`
- `project.carbonet.theme.binding.v1`

설명:

- 테마 목록 조회
- 토큰 번들 조회
- 프로젝트 테마 선택 및 오버라이드

### Builder

- `builder.project.template.list.v1`
- `builder.project.generate.v1`
- `builder.screen.template.list.v1`
- `builder.screen.schema.generate.v1`
- `builder.screen.preview.render.v1`
- `builder.package.compose.v1`
- `builder.runtime.profile.resolve.v1`
- `builder.project.manifest.generate.v1`
- `builder.common.jar-set.resolve.v1`
- `builder.common.jar-set.verify.v1`
- `builder.structure.version.get.v1`

설명:

- 프로젝트 빌더
- 화면 빌더
- 스키마 기반 화면 생성
- 프리뷰 및 패키징
- common JAR set 확인
- builder structure version 확인

위치 해석:

- builder engine = Resonance common
- builder console = ops / operations-console
- builder output = project adapter/runtime

### Ops / Deploy / Migration

- `ops.project.create.v1`
- `ops.project.update.v1`
- `ops.project.delete.v1`
- `ops.release.promote.v1`
- `ops.release.package.v1`
- `ops.migration.export.v1`
- `ops.migration.import.v1`
- `ops.project.start.v1`
- `ops.project.stop.v1`
- `ops.project.restart.v1`
- `ops.project.health.v1`
- `ops.project.runtime.profile.v1`
- `ops.project.package.assemble.v1`
- `ops.project.container.build.v1`
- `ops.project.k8s.release.plan.v1`
- `ops.project.k8s.release.apply.v1`
- `ops.project.k8s.release.verify.v1`
- `ops.project.k8s.rollback.v1`
- `ops.project.k8s.workload.status.v1`
- `ops.project.k8s.manifest.compose.v1`

설명:

- 멀티프로젝트 운영 시 프로젝트별 독립 lifecycle 제어 필요
- 한 프로젝트만 중지/기동/재기동할 수 있어야 함
- project package assemble
- Docker/container build
- Kubernetes release planning and apply
- Kubernetes release verify / rollback / workload status / manifest compose

## API Governance

### Required Metadata

모든 capability는 아래 메타데이터를 가진다.

- `capability_id`
- `version`
- `owner`
- `layer`
- `input_schema`
- `output_schema`
- `breaking_policy`
- `adapter_required`
- `audit_required`

### Version Policy

- 메이저 버전은 breaking change
- 마이너 버전은 backward compatible
- 패치 버전은 버그 수정
- 내부 구현이 아니라 contract 버전이 기준

### Validation Stack

- 계약 테스트: Pact
- 스키마/퍼징 테스트: Schemathesis
- breaking change diff: oasdiff

## Adapter Policy

### Empty Adapter

기본 passthrough 어댑터.

용도:

- 표준 contract 기준 구현
- 비교 기준
- 업데이트 검증 기준

### Common Adapter

공통의 구버전/신버전 차이를 canonical contract로 맞추는 어댑터.

### Project Adapter

프로젝트별 라우트, 메뉴, 권한, 테마, 화면 조합을 처리하는 어댑터.

### Adapter Governance

추가 권장 capability:

- `common.adapter.catalog.list.v1`
- `common.adapter.compatibility.report.v1`
- `project.adapter.binding.resolve.v1`
- `ops.adapter.verify.v1`

설명:

- adapter catalog 조회
- common update 대비 compatibility report 조회
- 프로젝트별 binding 해석
- 배포 전 adapter 검증

## Runtime Policy

프로젝트 runtime은 다음 metadata를 갖는 것을 권장한다.

- `runtime_mode`: `shared` | `isolated`
- `db_binding`
- `port_binding`
- `log_binding`
- `cache_namespace`
- `theme_binding`
- `scope_binding`

권장:

- production: `isolated`
- local/staging: `shared` 또는 `hybrid`

## Common Module Governance

표준프레임워크 200여 모듈 업데이트를 위해 아래 capability를 추가 권장한다.

- `common.module.catalog.list.v1`
- `common.module.group.report.v1`
- `common.module.upgrade.wave.plan.v1`
- `common.module.compatibility.verify.v1`
- `ops.common.release.group.promote.v1`

설명:

- common module catalog 조회
- capability group별 영향도 요약
- upgrade wave 계획 수립
- adapter/project compatibility 검증
- 검증 통과 release group 승격

## Recommended Theme Folder Model

```text
themes/
  base/
  brand-resonance/
  project-carbonet/
  project-carbonet/v2026-04/
```

각 테마는 아래를 포함한다.

- `tokens.json`
- `components.json`
- `page-presets.json`
- `theme-manifest.yaml`

## Install / Bundle / Model Gateway

관리자 설치 페이지와 air-gapped bundle 운영을 위해 아래 capability를 추가 권장한다.

### Platform Install

- `ops.platform.install.plan.v1`
- `ops.platform.install.apply.v1`
- `ops.platform.install.verify.v1`

설명:

- Ollama 설치 계획 수립
- 플랫폼 설치 실행
- 설치 검증과 상태 확인

### Bundle Export / Import

- `ops.platform.bundle.export.v1`
- `ops.platform.bundle.import.v1`

설명:

- air-gapped bundle 생성
- 대상 환경으로 가져오기

### Ollama / Model Gateway

- `ops.platform.ollama.status.v1`
- `ops.platform.model.catalog.v1`
- `ops.platform.model.pull.v1`
- `ops.platform.model.verify.v1`
- `ops.platform.runner.catalog.v1`
- `ops.platform.runner.update.v1`
- `ops.platform.toolchain.catalog.v1`
- `ops.platform.toolchain.sync.v1`

설명:

- Ollama 기동 상태
- 모델 목록 조회
- 모델 설치/동기화
- 모델 사용 가능 여부 검증
- Codex/Hermes-Codex-Cerebras 실행 러너 관리
- Git/Harness/Unsloth/Axolotl 같은 도구체인 동기화 관리

권장 runner:

- `ollama-local`
- `codex-cloud`
- `hermes-codex-cerebras`

권장 toolchain:

- `ollama-runtime`
- `git-governance`
- `codex-sync`
- `harness-eval`
- `unsloth-axolotl`

## Operational Interpretation

- `Hermes`는 개발용 에이전트 고도화 계층으로 두어도 된다.
- 운영 제품 capability는 `Ollama + control plane + workers + registry` 기준으로 정의한다.
- 즉 개발용 에이전트와 운영용 플랫폼 capability를 섞지 않는다.
- `Codex`, `Hermes-Codex-Cerebras`, `Harness`, `Unsloth`, `Axolotl`은 운영 runtime의 직접 의존이 아니라 runner/toolchain catalog로 관리한다.
