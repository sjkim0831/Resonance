# Resonance Migration Plan

## Goal

`/opt/Resonance`를 장기적으로 `Resonance` 중심 구조로 재편하되, 실제 운영 중인 프로젝트 기능은 `carbonet` 프로젝트 어댑터로 남긴다.

즉 목표는 단순 치환이 아니라 아래 구조다.

- `Resonance`: 운영/공통/빌더/AI control plane 기준이 되는 코어 프레임워크
- `Carbonet`: Resonance 위에서 동작하는 프로젝트 어댑터 및 프로젝트별 기능

## Current Risk

원격 조사 기준으로 `carbonet` 명시 참조가 매우 많다.

- 대략 `2943`건 이상의 문자열/설정/문서/경로 참조가 존재한다.

이 상태에서 아래 작업을 한 번에 하면 위험하다.

- `/opt/Resonance`를 즉시 `/opt/Resonance`로 이동
- 전역 문자열 치환
- 패키지명/라우트/문서명 동시 변경

## Recommended Migration Sequence

### Phase 1. Architecture-first split

먼저 구조를 분리한다.

- `ops`
- `common`
- `builder`
- `theme`
- `project carbonet`
- `ai-control`
- `adapter-contracts`
- `common-module-catalog`

이 단계에서는 실제 서비스 이름을 급하게 바꾸지 않는다.

### Phase 2. Introduce Resonance naming layer

새 문서와 새 capability에서 `Resonance`를 메인 이름으로 도입한다.

예:

- `Resonance common`
- `Resonance ops`
- `Resonance builder`
- `project carbonet`

즉 코어 이름만 먼저 올리고, 프로젝트 이름은 유지한다.

### Phase 3. Create project adapter boundary

`carbonet` 프로젝트가 공통 내부를 직접 건드리지 않도록 어댑터를 만든다.

흐름:

`project.carbonet.* -> common gate api -> common core`

이 단계에서 반드시 함께 정의할 것:

- project adapter manifest
- common capability allow-list
- blocked internal module list
- adapter owner/verification owner
- adapter compatibility class

### Phase 3-1. Common module grouping

표준프레임워크 200여 모듈은 한 번에 평면적으로 다루지 않는다.

반드시 capability 그룹으로 묶는다.

예:

- authority/auth
- account/user
- board/content
- menu/navigation
- builder/screen/project
- theme/design
- ops/runtime/deploy
- db/migration/audit

즉 `200 modules -> 8~12 capability groups`로 먼저 줄인 뒤 업데이트한다.

### Phase 4. Runtime split

운영 런타임을 아래처럼 재구성한다.

- shared control plane
- isolated project runtime
- ollama model gateway
- project manifest registry
- adapter registry
- common module compatibility registry

### Phase 5. Rename selected user-facing surfaces

영향이 적고 사용자에게 보여지는 위치부터 이름을 바꾼다.

- 관리자 문구
- 문서 제목
- 새 capability 네이밍
- 설치 페이지

### Phase 6. Repository move

위 단계가 끝난 뒤에야 저장소 이동 또는 상위 디렉터리 재구성을 검토한다.

가능한 방식:

- `/opt/Resonance`를 새 코어 저장소로 생성
- `carbonet`은 프로젝트 저장소로 유지
- 또는 mono-repo 내부에서 `platform/resonance`, `projects/carbonet` 식으로 분리

## What to avoid

- 즉시 전체 문자열 치환
- 운영 중인 라우트 id를 한 번에 변경
- DB/schema 이름을 이름 바꾸기만으로 정리하려고 시도
- 프로젝트 경계 없이 common과 project를 동시에 대량 수정
- 200여 공통 모듈을 개별 파일 단위로 무차별 업데이트
- adapter 검증 없이 common 최신본만 밀어넣기

## Common Module Update Governance

공통 200여 모듈 업데이트는 아래 순서로 진행한다.

1. capability group 분류
2. 각 모듈의 adapter 영향도 산정
3. empty adapter / common adapter / project adapter 기준 golden test 준비
4. usage frequency와 criticality 기준 우선순위화
5. compatibility report 생성
6. 검증 통과 그룹만 단계 반영

필수 산출물:

- `common-module-catalog.json`
- `adapter-compatibility-report.json`
- `project-impact-matrix.json`
- `release-group-manifest.yaml`

권장 검증 등급:

- `active-verified`
- `active-compat`
- `legacy-unverified`
- `deprecated-unused`

## Success Criteria

- 운영/공통/빌더/프로젝트 경계가 문서와 capability에서 명확하다.
- Carbonet은 프로젝트 어댑터로 설명 가능하다.
- Ollama-only 운영 플랫폼이 문서상 완성된다.
- Hermes는 개발용 에이전트 고도화 도구로 분리된다.
- 공통 200여 모듈 업데이트가 capability group + adapter 검증 기준으로 설명 가능하다.
