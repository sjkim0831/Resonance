# Resonance 10-Session Assignment / 10세션 배정 문서

2026-03-21 기준 다중 계정 AI 실행 운영 문서입니다.

2026-03-21 작업 트리 기준 최신 정리를 반영했습니다.

이 상태 스냅샷은 저장소 변경 파일을 바탕으로 추정한 내용이며,
실시간 tmux 로그나 계정별 실행 로그는 아닙니다.

## 목표

운영자가 번호만 보고도 각 AI 세션을 시작, 추적, 넘길 수 있도록
겹치지 않는 단일 배정표를 제공합니다.

## 운영자 빠른 지시

- `BUILDER_RESOURCE_OWNERSHIP_CLOSURE` 재개 시 single live entry pair 는 아래 2개 문서로 고정하고 maintenance contract 문서는 supporting guidance 로만 둡니다
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`
- supporting guidance: `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`
- 현재 active continuation target은 row `3`이고 family는 rows `3`, `5` 기준 blocker-resolution state입니다
- compressed blocker control docs는 `docs/architecture/builder-resource-blocker-source-sentence-matrix.md`, `docs/architecture/builder-resource-blocker-source-trigger-matrix.md` 입니다
- 남은 docs-only 유효 작업은 watched source docs 변경 여부와 exact missing sentence 추가 여부 확인뿐입니다
- canonical partial phrase는 `PARTIAL_DONE: builder resource ownership closure still counts rows 3 and 5 as blockers, rows 1 and 2 now carry bounded DELETE_NOW notes, row 4 now carries a stronger non-blocker note, and unresolved fallback blocker count is <n>.` 입니다

- 운영자가 `N번에 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 기본 대상은 항상 해당 번호 세션입니다
- 이 지시는 새 세션을 만들지 않고 해당 번호 세션에 이어 붙는 뜻으로 해석합니다
- 붙은 뒤에는 1분 주기로 마지막 미완료 작업을 확인하고, 가능하면 이어서 진행하고 아니면 같은 범위에서 재실행합니다
- 소유 범위나 선행 계약이 바뀌면 반복을 멈추고 `HANDOFF` 또는 `BLOCKED`로 상태를 먼저 갱신합니다
- 특히 `2번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`는 별도 해석 없이 항상 `02` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `02` 레인의 마지막 미완료 항목을 1분 간격으로 계속 재확인합니다
- 특히 `3번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `03` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `03` 레인의 마지막 미완료 템플릿 라인, 테마 세트, 디자인 시스템 문서와 프로토타입을 1분 간격으로 계속 재확인합니다
- 특히 `4번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `04` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `04` 레인의 마지막 미완료 화면 빌더, 자산 스튜디오, 유도 흐름 문서와 프로토타입을 1분 간격으로 계속 재확인합니다
- 특히 `5번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `05` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `05` 레인의 마지막 미완료 프런트엔드 런타임 화면, 운영자 UI, 공통 기본 구성요소 연결 상태를 1분 간격으로 계속 재확인합니다
- 이 지시는 새 `05` 세션을 추가로 파는 뜻이 아니라, 이미 붙어 있던 `05` 작업 컨텍스트와 마지막 미완료 메모를 그대로 이어받아 계속 진행하는 뜻으로 고정합니다
- 이 지시는 `05` 레인 안에서 이전 루프의 마지막 작업 위치를 최대한 이어받고, 더 이상 이어갈 미완료 항목이 없을 때만 같은 범위를 처음부터 재실행하는 뜻으로 고정합니다
- 운영자가 이 문서 경로를 직접 지정한 뒤 같은 표현으로 지시해도 해석은 바뀌지 않으며, 항상 현재 `05` 레인 컨텍스트에 붙어서 이어가기 우선으로 처리합니다
- 따라서 `5번에 붙는다`는 말은 항상 `05` 고정, `이어서 진행` 우선, 미완료 항목 소진 시 동일 범위 `재실행`, 약 `1분` 간격 반복 순서로 해석합니다
- 특히 `6번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `06` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `06` 레인의 마지막 미완료 백엔드 제어 평면 인터페이스, 서비스, 매퍼 작업을 1분 간격으로 계속 재확인합니다
- 이 지시는 새 `06` 세션을 추가로 파는 뜻이 아니라, 이미 붙어 있던 `06` 작업 컨텍스트와 마지막 미완료 메모를 그대로 이어받아 계속 진행하는 뜻으로 고정합니다
- 이 지시는 `06` 레인 안에서 이전 루프의 마지막 작업 위치를 최대한 이어받고, 더 이상 이어갈 미완료 항목이 없을 때만 같은 범위를 처음부터 재실행하는 뜻으로 고정합니다
- 운영자가 이 문서 경로를 직접 지정한 뒤 같은 표현으로 지시해도 해석은 바뀌지 않으며, 항상 현재 `06` 레인 컨텍스트에 붙어서 이어가기 우선으로 처리합니다
- 따라서 `6번에 붙는다`는 말은 항상 `06` 고정, `이어서 진행` 우선, 미완료 항목 소진 시 동일 범위 `재실행`, 약 `1분` 간격 반복 순서로 해석합니다
- 특히 `7번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `07` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `07` 레인의 마지막 미완료 SQL draft, migration draft, rollback draft, DB 노트를 1분 간격으로 계속 재확인합니다
- 이 지시는 `07` 레인 안에서 이전 루프의 마지막 작업 위치를 최대한 이어받고, 더 이상 이어갈 미완료 항목이 없을 때만 같은 범위를 처음부터 재실행하는 뜻으로 고정합니다
- 특히 `8번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `08` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `08` 레인의 마지막 미완료 deploy-console, runtime-package, session-loop 운영 기준과 서버 역할 드리프트를 1분 간격으로 계속 재확인합니다
- 이 지시는 `08` 레인 안에서 이전 루프의 마지막 작업 위치를 최대한 이어받고, 더 이상 이어갈 미완료 운영 항목이 없을 때만 같은 범위를 처음부터 재실행하는 뜻으로 고정합니다
- 특히 `9번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`도 별도 해석 없이 항상 `09` 레인의 상시 반복 지시로 고정합니다
- 이 경우 운영자가 중지, 번호 변경, 범위 변경을 말하기 전까지 `09` 레인의 마지막 미완료 compare, parity, repair, smoke verification 문서와 프로토타입, 연결된 검증 구현 범위를 1분 간격으로 계속 재확인합니다
- 이 지시는 새 `09` 세션을 추가로 파는 뜻이 아니라, 이미 붙어 있던 `09` 작업 컨텍스트와 마지막 미완료 메모를 그대로 이어받아 계속 진행하는 뜻으로 고정합니다
- 이 지시는 `09` 레인 안에서 이전 루프의 마지막 작업 위치를 최대한 이어받고, 더 이상 이어갈 미완료 검증 항목이 없을 때만 같은 범위를 처음부터 재실행하는 뜻으로 고정합니다
- 따라서 `9번에 붙는다`는 말은 항상 `09` 고정, `이어서 진행` 우선, 미완료 항목 소진 시 동일 범위 `재실행`, 약 `1분` 간격 반복 순서로 해석합니다

## 상태 코드

- `READY`: 시작 가능
- `IN_PROGRESS`: 진행 중
- `BLOCKED`: 막힘
- `HANDOFF`: 넘김 대기 또는 넘김 완료
- `DONE`: 완료

## 표준 상태 문구

세션 메모나 인계 코멘트는 가능하면 아래 형식을 따릅니다.

- `HANDOFF READY: <대상 세션>이 <파일 또는 흐름>부터 바로 이어서 진행 가능; 현재 막힘 항목 수는 <n>.`
- `BLOCKED: <세션 또는 계약>을 기다리는 중; 사유는 <구체 사유>.`

## 추정 진행 현황

각 작업 레인이 이 파일에서 직접 상태를 갱신하기 전까지 임시 운영 대시보드로 사용합니다.

| 세션 | 현재 상태 | 추정 진행률 | 담당 계정 | 최종 갱신 | 오늘 목표 |
| --- | --- | ---: | --- | --- | --- |
| `01` 계약 조정 | `HANDOFF` | `96%` | `미지정` | `2026-03-24` | 구현 세션 착수 관찰 및 예외 blocker 대응 |
| `02` 제안 및 요구 접수 | `HANDOFF` | `92%` | `미지정` | `2026-03-25` | `04/09`가 바로 consume할 governed proposal baseline 유지와 drift 감시 |
| `03` 테마, 셸, 디자인 시스템 | `HANDOFF` | `96%` | `미지정` | `2026-03-24` | `05/09` 수신 이후 예외 parity와 custom route drift만 추적 |
| `04` 빌더 및 자산 스튜디오 | `HANDOFF` | `88%` | `미지정` | `2026-03-24` | `05/09`가 바로 consume할 builder, asset, page-assembly 입력물 유지와 drift 감시 |
| `05` 프런트엔드 런타임 및 운영자 UI | `HANDOFF` | `88%` | `미지정` | `2026-03-24` | `09`가 바로 consume할 runtime/operator UI 출력 유지와 drift 감시 |
| `06` 백엔드 제어 평면 | `IN_PROGRESS` | `90%` | `미지정` | `2026-03-25` | `07/09`가 바로 받을 수 있는 stable payload naming과 trace linkage 유지 |
| `07` DB, SQL, 마이그레이션, 롤백 | `HANDOFF` | `92%` | `미지정` | `2026-03-24` | `06/08` 수신 확인과 후속 DB drift 유무만 1분 간격으로 재점검 |
| `08` 배포, 런타임 패키지, 서버 | `HANDOFF` | `72%` | `미지정` | `2026-03-24` | `09`가 바로 받을 수 있는 deploy evidence와 번호 세션 라우팅 기준 유지 |
| `09` 정합성, 비교, 복구, 검증 | `HANDOFF` | `90%` | `미지정` | `2026-03-24` | `01`이 종합 검토를 이어받을 수 있도록 parity/compare/repair/smoke 출력 유지 |
| `10` 설치형 모듈 및 공통 계열 | `HANDOFF` | `86%` | `미지정` | `2026-03-25` | `08/09`가 바로 consume할 module result, trace, runtime-package linkage 유지 |

## 비가역 기본 규칙

`01`만 공통 교차 계약 문서를 먼저 수정할 수 있습니다.

다른 세션은 해당 문서를 읽을 수는 있지만, `01`이 동결 처리하거나 넘기기 전에는 공통 계약 계열을 다시 쓰면 안 됩니다.

## 구현 시작 우선순위

실제 코드 구현은 기본적으로 다음 순서를 따릅니다.

1. `05` 프런트엔드 런타임 및 운영자 UI
2. `06` 백엔드 제어 평면
3. `08` 배포, 런타임 패키지, 서버
4. `09` 정합성, 비교, 복구, 검증
5. `07` DB, SQL, 마이그레이션, 롤백

세부 기준은:

- `docs/architecture/implementation-priority-and-first-day-plan.md`
- `docs/architecture/implementation-blocker-audit.md`
- `docs/architecture/implementation-handoff-document-index.md`
- `docs/architecture/contract-lane-manifest.md`
- `docs/architecture/contract-lane-closeout-note.md`
- `docs/architecture/contract-lane-archive-note.md`
- `docs/architecture/lane-start-instructions-05-06-08-09.md`
- `docs/architecture/lane-start-instructions-07-10-04-03-02.md`
- `docs/architecture/lane-code-start-checklists-05-06-08-09.md`
- `docs/architecture/lane-code-start-checklists-07-10-04-03-02.md`
- `docs/architecture/contract-lane-final-completion-checklist.md`
- `docs/architecture/contract-lane-executive-summary.md`
- `docs/architecture/implementation-lane-prompt-starters.md`
- `docs/architecture/implementation-lane-short-prompts.md`
- `docs/architecture/implementation-lane-short-prompts-ko.md`
- `docs/architecture/implementation-lane-status-template.md`
- `docs/architecture/implementation-lane-handoff-receipt-template.md`
- `docs/architecture/implementation-lane-completion-template.md`
- `docs/architecture/contract-lane-reopen-protocol.md`
- `docs/architecture/implementation-handoff-health-checklist.md`
- `docs/architecture/implementation-drift-report-template.md`
- `docs/architecture/operator-quickstart-cheatsheet.md`
- `docs/architecture/operator-lane-launch-board-template.md`
- `docs/architecture/operator-lane-launch-routine.md`
- `docs/architecture/operator-day-ops-check-card.md`
- `docs/architecture/operator-first-hour-timeline.md`
- `docs/architecture/operator-end-of-day-closeout-card.md`
- `docs/architecture/operator-issue-routing-card.md`
- `docs/architecture/operator-next-day-restart-card.md`
- `docs/architecture/operator-command-palette-card.md`

## 번호 세션

### 01. 계약 조정

- 상태: `HANDOFF`
- 추정 진행률: `96%`
- 운영 메모: 공통 계약 문서군과 이름 규약, handoff 기준, 구현 시작 규칙이 정리되어 구현 세션 착수 준비가 완료됐습니다
- 현재 구조 정리 wave에서 닫힌 family: `BUILDER_STRUCTURE_GOVERNANCE`
- 현재 구조 정리 wave source of truth: `docs/architecture/builder-structure-wave-20260409-closure.md`
- 현재 builder resource ownership 이어가기 entry:
  - `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
  - `docs/architecture/builder-resource-ownership-queue-map.md`
- 현재 family single live entry pair:
  - `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
  - `docs/architecture/builder-resource-ownership-queue-map.md`
- 이 pair의 blocker count, active row, next review target, partial-closeout wording이 바뀌면 두 문서를 같은 턴에 같이 갱신합니다
- 다음 1개 행동: `05/06/08/09`가 실제 구현에 들어간 뒤 예외 blocker가 생기면 reopen 여부만 판단합니다
- 목적: 공통 계약, 스키마, 점검표, 공통 규칙을 먼저 확정합니다
- 최근 변경 파일:
  - `docs/architecture/builder-structure-wave-20260409-closure.md`
  - `docs/architecture/builder-resource-ownership-queue-map.md`
  - `docs/architecture/system-folder-structure-alignment.md`
  - `docs/architecture/large-move-completion-contract.md`
  - `docs/architecture/platform-console-information-architecture.md`
  - `docs/architecture/operator-feature-completeness-checklist.md`
  - `docs/architecture/page-assembly-schema.md`
  - `docs/architecture/governed-identity-naming-convention.md`
  - `docs/architecture/session-implementation-handoff-map.md`
  - `docs/architecture/contract-lane-handoff-note.md`
  - `docs/ai/80-skills/resonance-10-session-assignment.md`
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/ai/80-skills`
- 금지 경로:
  - `/opt/Resonance/projects/carbonet-frontend/source/src`
  - `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java`
  - `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper`
- 시작 시점:
  - 즉시
- 인계 대상:
  - `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`
- 핵심 범위:
  - 공통 스키마
  - 정합성/체크리스트 게이트
  - 공개/관리자 분리
  - 모듈 설치 규칙
  - 단계별 유도 규칙
- 첫 30분 점검:
  - `session-implementation-handoff-map.md` 기준으로 reopen 허용 범위를 재확인
  - 새 계약 추가 필요 여부만 최종 판정
  - 구현 세션이 바로 시작 가능한지 `HANDOFF READY` 수준으로 확인
- 공식 handoff 문구:
  - `HANDOFF READY: implementation lanes may start from documented lane instructions; contract blocker count is 0.`

### 02. 제안 및 요구 접수

- 상태: `HANDOFF`
- 추정 진행률: `92%`
- 운영 메모: 제안 매핑, 인벤토리, 매트릭스, 시나리오/설계 산출 흐름이 같은 proposal identity와 `04/09` 소비 기준으로 정렬되어 handoff-ready 상태입니다
- 다음 1개 행동: `04/09` 수신 이후 proposal baseline drift나 누락 evidence만 재점검합니다
- 상시 운영 해석: 운영자가 `2번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 제안 업로드, 매핑 초안, 인벤토리, 매트릭스, 시나리오/설계 산출 흐름을 정리합니다
- 최근 변경 파일:
  - `docs/architecture/project-proposal-generation-api-contracts.md`
  - `docs/architecture/project-proposal-generation-inventory-checklist.md`
  - `docs/architecture/project-proposal-generation-matrix.md`
  - `docs/architecture/proposal-to-mapping-ai-output-schema.md`
  - `docs/architecture/project-scenario-and-design-output-contract.md`
  - `docs/prototypes/resonance-ui/proposal-mapping-draft.html`
  - `docs/prototypes/resonance-ui/project-proposal-inventory.html`
  - `docs/prototypes/resonance-ui/project-proposal-matrix.html`
- 붙기/반복 기준:
  - 운영자가 `2번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `02` 레인의 마지막 미완료 문서부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `02` 레인 안에서 계속 순환합니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/project-proposal-generation-api-contracts.md`
  - `docs/architecture/project-proposal-generation-inventory-checklist.md`
  - `docs/architecture/project-proposal-generation-matrix.md`
  - `docs/architecture/project-scenario-and-design-output-contract.md`
  - `docs/prototypes/resonance-ui/proposal-mapping-draft.html`
  - `docs/prototypes/resonance-ui/project-proposal-inventory.html`
  - `docs/prototypes/resonance-ui/project-proposal-matrix.html`
  - `docs/prototypes/resonance-ui/project-scenario-output.html`
  - `docs/prototypes/resonance-ui/project-design-output.html`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 위 문서 중 가장 마지막으로 수정한 항목과 연결된 미완료 계약 또는 프로토타입을 우선 이어갑니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 계약 필드, 카운트, 화면 흐름이 서로 어긋나면 같은 레인 안에서 정합성부터 맞춥니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드려야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `04`나 `09`가 바로 받을 수 있을 정도로 제안 흐름, 인벤토리, 매트릭스, 산출 흐름이 연결되면 `HANDOFF`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `2번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
- 금지 경로:
  - 백엔드 소스
  - 프런트엔드 런타임 소스
- 시작 시점:
  - 즉시
- 선행 의존:
  - 새로운 공통 계약이 생기면 `01`
- 인계 대상:
  - `04`, `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 04 and 09 may continue from governed proposal mapping, inventory, matrix, and scenario/design outputs; proposal consumer blocker count is 0.`

### 03. 테마, 셸, 디자인 시스템

- 상태: `HANDOFF`
- 추정 진행률: `96%`
- 운영 메모: 테마, 템플릿 라인, 셸 규칙 문서와 template line-theme set-parity-custom route 연결 규칙이 정리되어 `05/09`가 바로 받을 수 있는 상태입니다
- 다음 1개 행동: `05/09` 수신 이후 custom route drift나 parity 예외만 reopen 여부로 판단합니다
- 상시 운영 해석: 운영자가 `3번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 공개/관리자 템플릿 라인, 테마 세트, 색상/폰트/간격/토큰, 셸 구성을 정리합니다
- 최근 변경 파일:
  - `docs/architecture/public-admin-template-line-schema.md`
  - `docs/architecture/theme-set-schema.md`
  - `docs/prototypes/resonance-ui/theme-set-studio.html`
  - `docs/prototypes/resonance-ui/design-workspace.html`
- 붙기/반복 기준:
  - 운영자가 `3번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `03` 레인의 마지막 미완료 문서부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `03` 레인 안에서 계속 순환합니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/public-admin-template-line-schema.md`
  - `docs/architecture/theme-set-schema.md`
  - `docs/architecture/element-design-set-schema.md`
  - `docs/architecture/resonance-design-patterns.md`
  - `docs/frontend/admin-template-parity-inventory.md`
  - `docs/prototypes/resonance-ui/theme-set-studio.html`
  - `docs/prototypes/resonance-ui/design-workspace.html`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 토큰/테마/셸 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 위 문서 중 가장 마지막으로 수정한 항목과 연결된 미완료 규칙 또는 프로토타입을 우선 이어갑니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 공개/관리자 템플릿 라인, 테마 세트, 토큰, 셸 규칙이 서로 어긋나면 같은 레인 안에서 정합성부터 맞춥니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드려야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `04`, `05`, `09`가 바로 받을 수 있을 정도로 셸 규칙과 테마 기준이 정리되면 `HANDOFF`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `3번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/frontend`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
- 금지 경로:
  - 백엔드 소스
- 시작 시점:
  - 즉시
- 선행 의존:
  - 계열 규칙 변경이 있으면 `01`
- 인계 대상:
  - `04`, `05`, `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 05 and 09 may continue from template-line/theme-set/parity governance docs; blocker count is 0 for current admin/public split rules.`

### 04. 빌더 및 자산 스튜디오

- 상태: `HANDOFF`
- 추정 진행률: `88%`
- 운영 메모: builder, asset-studio, design guide, page-assembly 입력물이 `05/09` 소비 기준으로 문서와 프로토타입에 연결됐고, 현재는 수신 확인과 drift 감시 단계입니다
- 다음 1개 행동: `05/09` 수신 확인과 후속 builder linkage drift 유무만 유지 점검합니다
- 상시 운영 해석: 운영자가 `4번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 테마 세트 스튜디오, 증분 자산 스튜디오, 화면 빌더, 페이지/요소/조합 거버넌스를 정리합니다
- 최근 변경 파일:
  - `docs/prototypes/resonance-ui/screen-builder.html`
  - `docs/prototypes/resonance-ui/asset-studio.html`
  - `docs/prototypes/resonance-ui/guided-build-flow.html`
  - `docs/architecture/page-design-guide-automation-contract.md`
- 붙기/반복 기준:
  - 운영자가 `4번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `04` 레인의 마지막 미완료 문서 또는 프로토타입부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `04` 레인 안에서 계속 순환합니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/page-design-guide-automation-contract.md`
  - `docs/architecture/page-assembly-schema.md`
  - `docs/prototypes/resonance-ui/guided-build-flow.html`
  - `docs/prototypes/resonance-ui/screen-builder.html`
  - `docs/prototypes/resonance-ui/asset-studio.html`
  - `docs/prototypes/resonance-ui/theme-set-studio.html`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 빌더/자산/유도 흐름 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 위 문서 중 가장 마지막으로 수정한 항목과 연결된 미완료 프로토타입 또는 계약 정리를 우선 이어갑니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서와 프로토타입을 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 화면 빌더, 자산 스튜디오, 유도 흐름, 페이지 조립 규칙이 서로 어긋나면 같은 레인 안에서 정합성부터 맞춥니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드려야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `05`가 화면 구현을 바로 시작하고 `09`가 정합성/복구 기준으로 검토할 수 있을 정도로 입력물이 정리되면 `HANDOFF`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `4번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
- 인계 기준:
  - 빌더 연계 계약 문서 추가 수정이 더 이상 필요 없다
  - 유도 흐름, 화면 빌더, 자산 스튜디오 관련 프로토타입이 1차 검토 가능한 상태다
  - `05`가 문서를 다시 뜯지 않고 화면 구현을 시작할 수 있다
  - `09`가 정합성/복구 기준으로 검토할 입력물이 준비돼 있다
  - `04` 범위의 열린 이슈가 새 작업이 아니라 메모로만 남아 있다
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
  - `/opt/Resonance/projects/carbonet-frontend/source/src/features`
- 금지 경로:
  - 명시적으로 넘겨받지 않은 백엔드 소스
- 시작 시점:
  - `01`이 빌더 연계 계약을 동결한 뒤
- 선행 의존:
  - `01`, `03`
- 인계 대상:
  - `05`, `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 05 and 09 may continue from guided-build-flow, screen-builder, asset-studio, and page-assembly inputs; blocker count is 0 for current builder linkage scope.`

### 05. 프런트엔드 런타임 및 운영자 UI

- 상태: `HANDOFF`
- 추정 진행률: `88%`
- 운영 메모: 운영자 UI, screen-runtime, current-runtime-compare 화면과 공통 셸이 실제 프런트 코드에 올라와 있고, `09`가 consume하는 runtime/operator UI 출력 형태도 문서와 프로토타입 기준으로 고정했습니다
- 다음 1개 행동: `09` 수신 확인과 후속 UI drift 유무만 유지 점검합니다
- 상시 운영 해석: 운영자가 `5번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 리액트 운영 화면, 런타임 관리자 UI와 공개 UI의 일관성, 공통 기본 구성요소를 구현합니다
- 최근 변경 파일:
  - `docs/architecture/screen-family-ui-consistency-contract.md`
  - `docs/architecture/lane-start-instructions-05-06-08-09.md`
  - `docs/prototypes/resonance-ui/index.html`
  - `docs/prototypes/resonance-ui/project-runtime.html`
- 실행 명령:
  - 무한 반복: `cd /opt/Resonance/projects/carbonet-frontend/source && npm run lane:05:loop`
  - 1회 점검: `cd /opt/Resonance/projects/carbonet-frontend/source && npm run lane:05:loop -- --once`
- 붙기/반복 기준:
  - 운영자가 `5번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 운영자가 이 파일 경로를 직접 찍고 같은 문구를 말해도 새 작업 지시로 갈라 읽지 않고, 이미 열려 있는 `05` 레인 컨텍스트에 그대로 붙는 뜻으로 해석합니다
  - 새 레인을 만들지 않고 현재 `05` 레인의 마지막 미완료 화면 구현, 운영자 UI 정리, 공통 기본 구성요소 작업부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `05` 레인 안에서 계속 순환합니다
  - 각 루프는 먼저 `이어서 진행` 가능 여부를 확인하고, 직전 미완료 지점이 닫혔을 때만 같은 체크 순서를 기준으로 `재실행` 단계로 넘어갑니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/lane-start-instructions-05-06-08-09.md`
  - `docs/architecture/screen-family-ui-consistency-contract.md`
  - `docs/frontend/admin-template-parity-inventory.md`
  - `docs/prototypes/resonance-ui/index.html`
  - `docs/prototypes/resonance-ui/project-runtime.html`
  - `/opt/Resonance/projects/carbonet-frontend/source/src`
  - `/opt/Resonance/projects/carbonet-frontend/source/scripts`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 화면/컴포넌트/일관성 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 이 지시는 새 `05` 세션 생성이나 범위 확장을 뜻하지 않고, 이미 열려 있던 `05` 컨텍스트의 마지막 미완료 지점을 그대로 복구해 이어가는 뜻으로 고정합니다
  - 이어서 진행할 수 있는 미완료 항목이 있으면 재탐색보다 해당 프런트엔드 구현의 직전 중단 지점 복구를 우선합니다
  - 가장 마지막으로 수정한 운영자 UI 또는 런타임 화면에서 이어서, 누락된 구성요소 연결과 governed identity field 유지 여부를 먼저 닫습니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서, 프로토타입, 프런트엔드 소스를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 재실행 루프에서는 `03`의 template/theme/parity 기준과 `04`의 guided-build-flow, screen-builder, asset-studio, page-assembly 입력물이 현재 구현과 다시 벌어지지 않았는지 먼저 확인합니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드리거나 `04` 입력물 정의가 다시 바뀌어야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `09`가 구현 결과를 바로 검증할 수 있을 정도로 운영자 UI, 런타임 화면, 공통 기본 구성요소 출력이 정리되면 `HANDOFF`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `5번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 UI 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
  - 반복은 운영자가 중지, 번호 변경, 범위 변경을 말할 때만 종료하고, 그 전까지는 `05` 내부 미완료 항목 확인과 동일 범위 재점검을 계속 유지합니다
  - 따라서 해석 우선순서는 항상 `기존 05 마지막 미완료 지점 이어가기 -> 같은 범위 재점검 -> 동일 체크 순서 재실행`입니다
- 허용 경로:
  - `/opt/Resonance/projects/carbonet-frontend/source/src`
  - `/opt/Resonance/projects/carbonet-frontend/source/scripts`
- 금지 경로:
  - 넘겨받지 않은 공통 계약 문서
  - 백엔드 소스
- 시작 시점:
  - `01` 동결 이후, `04`의 builder linkage 입력물이 `HANDOFF READY` 수준으로 정리된 뒤
- 선행 의존:
  - `01`, `03`, `04`
- 인계 대상:
  - `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 09 may continue from implemented operator UI, runtime screens, and component outputs derived from guided-build-flow, screen-builder, asset-studio, and page-assembly inputs; blocker count is 0 for current frontend runtime scope.`

### 06. 백엔드 제어 평면 (Backend Control Plane)

- 상태: `IN_PROGRESS`
- 담당: `account-06`
- 운영 메모: 제어 평면 진입점은 `platform.*` 패키지로 대부분 올라왔고, `RuntimeControlPlaneServiceImpl`은 이제 `RSN_*` 테이블 가버넌스 퍼시스턴스를 지원합니다 (JSONL 병행 기록). `admin-migration-20260330` 아카이브를 포함한 stale handoff 정리도 완료되었습니다.
- 다음 1개 행동: `RSN_VERIFICATION_RUN` 기반의 메뉴-화면 검증 이력 저장 기능을 `platform.runtimecontrol` 서비스에 통합하고, 09번 레인과 협력하여 검증 모델 정합성을 확인합니다.

- 상시 운영 해석: 운영자가 `6번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 제어 평면 인터페이스, 레지스트리, 수명주기, 비교, 보정, 릴리스 서비스를 구현합니다
- 최근 변경 파일:
  - `docs/architecture/module-selection-api-contracts.md`
  - `docs/architecture/repair-and-verification-api-contracts.md`
  - `docs/prototypes/resonance-ui/backend-chain-explorer.html`
  - `src/main/java/egovframework/com/platform/runtimecontrol/service/impl/RuntimeControlPlaneServiceImpl.java`
  - `src/test/java/egovframework/com/platform/runtimecontrol/service/impl/RuntimeControlPlaneServiceImplTest.java`
  - `modules/platform-runtime-control/pom.xml`
- 실행 명령:
  - 무한 반복: `cd /opt/Resonance/projects/carbonet-frontend/source && npm run lane:06:loop`
  - 1회 점검: `cd /opt/Resonance/projects/carbonet-frontend/source && npm run lane:06:loop -- --once`
- 붙기/반복 기준:
  - 운영자가 `6번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 운영자가 이 파일 경로를 직접 찍고 같은 문구를 말해도 새 작업 지시로 갈라 읽지 않고, 이미 열려 있는 `06` 레인 컨텍스트에 그대로 붙는 뜻으로 해석합니다
  - 새 레인을 만들지 않고 현재 `06` 레인의 마지막 미완료 백엔드 제어 평면 인터페이스, 서비스, 매퍼 작업부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `06` 레인 안에서 계속 순환합니다
  - 각 루프는 먼저 `이어서 진행` 가능 여부를 확인하고, 직전 미완료 지점이 닫혔을 때만 같은 체크 순서를 기준으로 `재실행` 단계로 넘어갑니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/lane-start-instructions-05-06-08-09.md`
  - `docs/architecture/lane-code-start-checklists-05-06-08-09.md`
  - `docs/architecture/module-selection-api-contracts.md`
  - `docs/architecture/repair-and-verification-api-contracts.md`
  - `src/main/java/egovframework/com/platform/runtimecontrol/web/RuntimeControlPlaneApiController.java`
  - `src/main/java/egovframework/com/platform/runtimecontrol/service/impl/RuntimeControlPlaneServiceImpl.java`
  - `docs/sql/20260321_resonance_repair_module_selection_schema.sql`
  - `src/test/java/egovframework/com/platform/runtimecontrol/service/impl/RuntimeControlPlaneServiceImplTest.java`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 인터페이스/서비스/매퍼 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 이 지시는 새 `06` 세션 생성이나 범위 확장을 뜻하지 않고, 이미 열려 있던 `06` 컨텍스트의 마지막 미완료 지점을 그대로 복구해 이어가는 뜻으로 고정합니다
  - 이어서 진행할 수 있는 미완료 항목이 있으면 재탐색보다 해당 백엔드 제어 평면 구현의 직전 중단 지점 복구를 우선합니다
  - 가장 마지막으로 수정한 인터페이스, 서비스, 매퍼에서 이어서 구현하고, 누락 계약 연결과 이름 정합성을 먼저 닫습니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서와 백엔드 소스를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 재실행 루프에서는 제어 평면 계약, Java 서비스, MyBatis 매퍼 사이의 이름, 파라미터, lifecycle 연결이 다시 벌어지지 않았는지 먼저 확인합니다
  - 재실행 루프에서는 module-selection, repair, verification 응답/적재 payload와 서비스 테스트, mapper contract test 고정 상태를 먼저 다시 대조하고, 그 다음 mapper/DB drift를 닫습니다
  - `01`이 아직 고정하지 않은 공통 계약이나 identity 이름이 필요해지면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `07`과 `09`가 바로 이어받을 수 있을 정도로 제어 평면 구현과 계약 연결이 안정화되면 `HANDOFF READY`로 넘깁니다
  - `HANDOFF READY` 뒤에도 운영자가 계속 `6번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 서비스/매퍼 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
  - 반복은 운영자가 중지, 번호 변경, 범위 변경을 말할 때만 종료하고, 그 전까지는 `06` 내부 미완료 항목 확인과 동일 범위 재점검을 계속 유지합니다
  - 따라서 해석 우선순서는 항상 `기존 06 마지막 미완료 지점 이어가기 -> 같은 범위 재점검 -> 동일 체크 순서 재실행`입니다
- 허용 경로:
  - `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java`
  - `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper`
  - `/opt/Resonance/src/test/java`
- 금지 경로:
  - 프런트엔드 소스
  - 넘겨받지 않은 공통 계약
- 시작 시점:
  - `01` 동결 이후
- 선행 의존:
  - `01`
- 인계 대상:
  - `07`, `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 07 and 09 may continue from stabilized control-plane interfaces, services, mapper bindings, and verified payload naming; blocker count is 0 for the current backend control-plane scope.`

### 07. DB, SQL, 마이그레이션, 롤백

- 상태: `HANDOFF`
- 추정 진행률: `92%`
- 운영 메모: `06` 시작 문서, release-governance 계약, naming 규약 대조 결과 `RELEASE_UNIT_BINDING_TRACE / releaseBindingTraceId / releaseUnitId / projectId / guidedStateId / assetTraceSet / boundAt` 조합에 충돌이 없었고, `06` 매퍼가 요구하는 `TEMPLATE_LINE_ID` drift를 `RSN_REPAIR_SESSION / RSN_REPAIR_APPLY_RUN / RSN_VERIFICATION_RUN` draft family에 반영했습니다. 현재는 `08` 수신 확인과 후속 drift 감시만 남아 있습니다
- 다음 1개 행동: `08` 문서와 운영 산출물이 release-unit binding placeholder, rollback detach placeholder, `TEMPLATE_LINE_ID` 보존 규칙을 그대로 수신하는지 확인하고, 새 DB drift가 생기면 같은 draft family 안에서만 보수합니다
- 상시 운영 해석: 운영자가 `7번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: SQL 초안, 데이터베이스 기준, 마이그레이션, 롤백, 공통/프로젝트 DB 분리를 정리합니다
- 최근 변경 파일:
  - `docs/architecture/chain-matrix-governance-schema.md`
  - `docs/architecture/scenario-family-generation-contracts.md`
  - `docs/architecture/resonance-db-first-draft-family.md`
  - `docs/sql/20260321_resonance_repair_module_selection_schema.sql`
  - `docs/sql/20260321_resonance_repair_module_selection_migration.sql`
  - `docs/sql/20260321_resonance_repair_module_selection_rollback.sql`
- 붙기/반복 기준:
  - 운영자가 `7번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `07` 레인의 마지막 미완료 schema, migration, rollback draft 또는 DB 노트부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `07` 레인 안에서 계속 순환합니다
  - 각 루프는 먼저 `이어서 진행` 가능 여부를 확인하고, 직전 미완료 지점이 닫혔을 때만 같은 체크 순서를 기준으로 `재실행` 단계로 넘어갑니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/resonance-db-first-draft-family.md`
  - `docs/sql/20260321_resonance_repair_module_selection_schema.sql`
  - `docs/sql/20260321_resonance_repair_module_selection_migration.sql`
  - `docs/sql/20260321_resonance_repair_module_selection_rollback.sql`
  - `docs/architecture/db-object-integrity-contract.md`
  - `docs/architecture/module-selection-api-contracts.md`
  - `docs/architecture/repair-and-verification-api-contracts.md`
  - `docs/architecture/common-db-and-project-db-splitting.md`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 schema/migration/rollback 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 이어서 진행할 수 있는 미완료 항목이 있으면 재탐색보다 해당 draft family의 직전 중단 지점 복구를 우선합니다
  - 가장 마지막으로 수정한 DB 초안에서 이어서, 누락 테이블/컬럼/인덱스/schema-migration-rollback 연결 절을 먼저 닫습니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서와 SQL draft를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 재실행 루프에서는 schema, migration, rollback, DB 노트 사이의 이름, placeholder, release-unit binding trace 연결이 다시 벌어지지 않았는지 먼저 확인합니다
  - 공통 DB와 프로젝트 DB 경계가 흐려지면 SQL 작성보다 분리 메모 보강을 우선합니다
  - `06`이 아직 고정하지 않은 family 이름이나 mapper 이름을 새로 만들 필요가 생기면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `06`과 `08`이 migration family와 `RELEASE_UNIT_BINDING_TRACE` placeholder를 바로 사용할 수 있을 정도가 되면 `HANDOFF`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `7번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 DB 수정 필요성만 1분마다 같은 레인에서 다시 점검합니다
  - 반복은 운영자가 중지, 번호 변경, 범위 변경을 말할 때만 종료하고, 그 전까지는 `07` 내부 미완료 항목 확인과 동일 범위 재점검을 계속 유지합니다
- 허용 경로:
  - `/opt/Resonance/docs/sql`
  - `/opt/Resonance/docs/architecture`
- 금지 경로:
  - 프런트엔드 소스
  - `06`과 조율되지 않은 런타임 백엔드 소스
- 시작 시점:
  - `01` 동결 이후
- 선행 의존:
  - `01`, `06`
- 인계 대상:
  - `06`, `08`, `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 06 and 08 can continue from stable SQL draft, migration family, and release-unit binding placeholder; current blocker count is 0.`
- 권장 handoff receipt 메모:
  - `ACCEPTED: 06 will continue from release-unit binding trace naming and SQL draft family under existing governed identity rules.`
  - `ACCEPTED: 08 will continue from migration family, rollback draft, and release-unit evidence under existing governed identity rules.`

### 08. 배포, 런타임 패키지, 서버

- 상태: `HANDOFF`
- 추정 진행률: `72%`
- 운영 메모: 운영 흐름 문서, 배포 콘솔, runtime package matrix, 반복 스크립트에 `releaseUnitId`, `runtimePackageId`, `deployTraceId`, `ownerLane`, `rollbackAnchorYn` 기준을 맞췄고 `09`가 바로 받을 deploy evidence를 정리했습니다
- 다음 1개 행동: `09` 수신 확인과 후속 운영 drift 유무만 유지 점검합니다
- 상시 운영 해석: 운영자가 `8번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: Jenkins/Nomad/Nginx, 런타임 패키지 매트릭스, 193->221 배포 흐름, 서버 세트 소유를 정리합니다
- 최근 변경 파일:
  - `docs/architecture/runtime-package-matrix-and-deploy-ia.md`
  - `docs/prototypes/resonance-ui/deploy-console.html`
  - `docs/prototypes/resonance-ui/runtime-package-matrix.html`
  - `ops/scripts/resonance-session-loop.sh`
- 붙기/반복 기준:
  - 운영자가 `8번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `08` 레인의 마지막 미완료 deploy/session-loop 항목부터 이어갑니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `08` 레인 안에서 계속 순환합니다
  - 각 루프는 먼저 `이어서 진행` 가능 여부를 확인하고, 직전 미완료 지점이 닫혔을 때만 같은 체크 순서를 기준으로 `재실행` 단계로 넘어갑니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/lane-start-instructions-05-06-08-09.md`
  - `docs/architecture/lane-code-start-checklists-05-06-08-09.md`
  - `docs/architecture/runtime-package-matrix-and-deploy-ia.md`
  - `docs/architecture/two-host-build-deploy-runbook.md`
  - `docs/prototypes/resonance-ui/runtime-package-matrix.html`
  - `docs/prototypes/resonance-ui/deploy-console.html`
  - `ops/scripts/resonance-session-loop.sh`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 열린 서버 역할 드리프트, 번호 세션 라우팅 메모를 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 이어서 진행할 수 있는 미완료 항목이 있으면 재탐색보다 해당 deploy-console, runtime-package, session-loop 정렬 작업의 직전 중단 지점 복구를 우선합니다
  - 가장 마지막으로 수정한 운영 산출물에서 이어서, `233 build / 221 run / 193 DB` 역할 구분과 번호 세션 라우팅 프롬프트 드리프트를 먼저 닫습니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서, 프로토타입, 반복 스크립트를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 재실행 루프에서는 `06`의 release-unit 및 artifact naming, `07`의 DB target 및 rollback note, `09`가 소비할 deploy evidence 기준과 다시 벌어지지 않았는지 먼저 확인합니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드리거나 `06`, `07`, `09` 입력물 정의를 다시 바꿔야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `09`가 바로 받을 수 있을 정도로 deploy-console, runtime-package, session-loop 운영 산출물이 번호 세션 라우팅과 서버 역할 기준까지 정리되면 `HANDOFF READY`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `8번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 운영 drift만 1분마다 같은 레인에서 다시 점검합니다
  - 반복은 운영자가 중지, 번호 변경, 범위 변경을 말할 때만 종료하고, 그 전까지는 `08` 내부 미완료 항목 확인과 동일 범위 재점검을 계속 유지합니다
- 허용 경로:
  - `/opt/Resonance/ops`
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
- 금지 경로:
  - 프런트엔드 런타임 소스
  - 넘겨받지 않은 백엔드 핵심 소스
- 시작 시점:
  - `01` 동결 이후
- 선행 의존:
  - `01`, `06`, `07`
- 인계 대상:
  - `09`
- 공식 handoff 문구:
  - `HANDOFF READY: 09 may continue from deploy-console, runtime-package, and session-loop operating outputs aligned to numbered-lane routing prompts; blocker count is 0 for current deployment operations scope.`

### 09. 정합성, 비교, 복구, 검증

- 상태: `HANDOFF`
- 추정 진행률: `90%`
- 운영 메모: current-runtime-compare, repair-workbench, parity checklist에 `08` deploy evidence와 smoke closure 기준까지 연결했고, 현재는 `01`이 바로 종합 검토를 이어받을 수 있는 상태입니다
- 다음 1개 행동: `01` 수신 확인과 후속 drift 유무만 유지 점검합니다
- 상시 운영 해석: 운영자가 `9번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말한 상태로 간주하고, 중지 지시가 없으면 이 레인을 계속 순환합니다
- 목적: 비교, 스모크 점검, 누락 자산 대기열, 복구 작업대, 정합성 및 일관성 검증을 정리합니다
- 최근 변경 파일:
  - `docs/architecture/parity-and-smoke-checklists.md`
  - `docs/architecture/repair-and-verification-api-examples.md`
  - `docs/prototypes/resonance-ui/current-runtime-compare.html`
  - `docs/prototypes/resonance-ui/repair-workbench.html`
- 붙기/반복 기준:
  - 운영자가 `9번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`라고 말하면 항상 이 레인으로 해석합니다
  - 새 레인을 만들지 않고 현재 `09` 레인의 마지막 미완료 compare, parity, repair, verification 항목부터 이어갑니다
  - 이미 `09`를 수행 중인 세션이 있으면 같은 세션에 그대로 붙고, 직전 루프의 마지막 작업 위치와 메모를 기본 시작점으로 사용합니다
  - 중지 지시가 없으면 1회성 작업으로 끝내지 않고 같은 `09` 레인 안에서 계속 순환합니다
  - `09` 레인에 이미 작업 중인 세션이 있으면 그 세션의 직전 미완료 지점과 메모를 이어받아 계속 진행하고, 비어 있거나 끊긴 경우에만 같은 레인 기준으로 다시 붙습니다
  - 각 루프는 먼저 `이어서 진행` 가능 여부를 확인하고, 직전 미완료 지점이 닫혔을 때만 같은 체크 순서를 기준으로 `재실행` 단계로 넘어갑니다
  - 약 1분마다 아래 반복 체크 순서대로 다시 확인합니다
- 반복 체크 순서:
  - `docs/architecture/lane-start-instructions-05-06-08-09.md`
  - `docs/architecture/lane-code-start-checklists-05-06-08-09.md`
  - `docs/architecture/parity-and-smoke-checklists.md`
  - `docs/architecture/repair-and-verification-api-examples.md`
  - `docs/architecture/implementation-handoff-health-checklist.md`
  - `docs/prototypes/resonance-ui/current-runtime-compare.html`
  - `docs/prototypes/resonance-ui/repair-workbench.html`
  - `/opt/Resonance/projects/carbonet-frontend/source/src/features`
- 반복 실행 규칙:
  - 직전 루프의 마지막 작업 위치, 미완료 메모, 열린 compare/parity/repair 불일치 목록을 그대로 이어받아 다음 루프 시작점으로 사용합니다
  - 루프 시작 순서는 항상 `현재 09 세션 생존 여부 확인 -> 직전 미완료 지점 복구 -> 이어서 진행 -> 필요 시 동일 범위 재실행`으로 고정합니다
  - 매 1분 루프 시작 시 가장 먼저 현재 `09` 세션이 살아 있는지, 직전 작업 컨텍스트를 그대로 복구할 수 있는지 확인하고 가능하면 항상 `이어서 진행`을 우선합니다
  - 이어서 진행할 수 있는 미완료 항목이 있으면 재탐색보다 해당 검증 기준, 비교 프로토타입, 복구 워크벤치의 직전 중단 지점 복구를 우선합니다
  - 가장 마지막으로 수정한 비교 기준 또는 검증 산출물에서 이어서, `04`의 guided-build-flow, screen-builder, asset-studio, page-assembly 입력물과 `05`의 구현 결과 사이에 남은 연결 누락을 먼저 닫습니다
  - 직전 루프에서 더 진행할 내용이 없으면 같은 범위 문서, 프로토타입, 연결된 검증 구현 범위를 다시 훑어 새 누락이나 드리프트가 없는지 재실행 확인합니다
  - 재실행 루프에서는 `03`의 template-line/theme-set/parity 기준, `06`의 repair and verification 계약, `08`의 deploy/session-loop 운영 산출물이 현재 compare/repair 흐름과 다시 벌어지지 않았는지 먼저 확인합니다
  - 새 공통 계약이 필요해 `01` 소유 범위를 건드리거나 `04`, `05`, `06`, `08` 입력물 정의를 다시 바꿔야 하면 즉시 `BLOCKED` 또는 `HANDOFF`로 바꿉니다
  - `01`이 바로 종합 검토를 이어받을 수 있을 정도로 parity, compare, repair, smoke verification 출력이 정리되면 `HANDOFF READY`로 넘깁니다
  - `HANDOFF` 뒤에도 운영자가 계속 `9번`에 붙으라고 유지하면, 인계 수신 확인 여부와 후속 검증 drift만 1분마다 같은 레인에서 다시 점검합니다
  - 반복은 운영자가 중지, 번호 변경, 범위 변경을 말할 때만 종료하고, 그 전까지는 `09` 내부 미완료 항목 확인과 동일 범위 재점검을 계속 유지합니다
  - 운영 해석상 `9번에 붙는다`는 말은 항상 `재실행 가능 여부 확인 -> 가능하면 이어서 진행 -> 더 이상 이어갈 것이 없으면 동일 범위 재실행` 순서를 무한 반복하는 뜻으로 고정합니다
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
  - `/opt/Resonance/projects/carbonet-frontend/source/src/features`
- 금지 경로:
  - 넘겨받지 않은 백엔드 핵심 소스
- 시작 시점:
  - `02`, `04`, `05`, `06`, `08`의 초기 결과가 나오고, 특히 `04`의 builder linkage 입력물과 `05`의 초기 화면 결과가 확인된 뒤
- 선행 의존:
  - `01`, `02`, `04`, `05`, `06`, `08`
- 인계 대상:
  - `01`
- 공식 handoff 문구:
  - `HANDOFF READY: 01 may continue from parity, compare, repair, and verification outputs cross-checked against 04 builder inputs and 05 frontend runtime results; blocker count is 0 for current verification scope.`

### 10. 설치형 모듈 및 공통 계열

- 상태: `HANDOFF`
- 추정 진행률: `86%`
- 운영 메모: 모듈 선택 결과, 적용 결과, trace linkage가 runtime-package와 repair 흐름까지 연결됐고, 현재는 `08/09` 수신 확인과 drift 감시 단계입니다
- 다음 1개 행동: `08/09` 수신 확인과 후속 module linkage drift 유무만 유지 점검합니다
- 목적: 모듈 수집, 선택 팝업, 공통 JAR 구성 체계, 메일/SMS/인증/결재/인장 공통 연동기를 정리합니다
- 최근 변경 파일:
  - `docs/architecture/module-selection-apply-result-contract.md`
  - `docs/architecture/module-selection-trace-linkage-contract.md`
  - `docs/prototypes/resonance-ui/module-selection-result.html`
  - `docs/prototypes/resonance-ui/module-selection-trace.html`
- 허용 경로:
  - `/opt/Resonance/docs/architecture`
  - `/opt/Resonance/docs/prototypes/resonance-ui`
  - `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java`
- 금지 경로:
  - 넘겨받지 않은 프런트엔드 런타임 소스
  - `01`과 조율되지 않은 공통 계약
- 시작 시점:
  - `01` 동결 이후
- 선행 의존:
  - `01`, `06`
- 인계 대상:
  - `08`, `09`

## 세션 실행 기준

세션을 `tmux`로 운영할 때는 기본 이름과 창 구성을 아래 기준으로 맞춥니다.

권장 `tmux` 세션 이름:
- `res-01-contract`
- `res-02-proposal`
- `res-03-theme`
- `res-04-builder`
- `res-05-frontend`
- `res-06-backend`
- `res-07-db`
- `res-08-deploy`
- `res-09-verify`
- `res-10-module`

세션별 기본 `tmux` 창 구성:
- `0: main` 메인 작업
- `1: audit` 점검/검토
- `2: notes` 메모
- `3: verify` 확인/검증

반복 스크립트 예시:
- `ops/scripts/resonance-session-loop.sh 02`
- `ops/scripts/resonance-session-loop.sh 04 60`
- `ops/scripts/resonance-session-loop.sh 08 60`
- `ops/scripts/resonance-session-loop.sh 09 60`
- `LOOP_MODE=rerun ops/scripts/resonance-session-loop.sh res-09-verify 30`

숫자 레인으로 스크립트를 실행하면 기본 프롬프트는 자동으로
`docs/ai/80-skills/resonance-10-session-assignment.md N번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`
형식으로 전송합니다.

## 운영자 라우팅 규칙

AI에게 숫자만 말하면:

- 이 파일에서 해당 번호 섹션을 사용합니다
- 시작하면 그 섹션 상태를 `IN_PROGRESS`로 바꿉니다
- 끝나면 그 섹션 상태를 `HANDOFF` 또는 `DONE`으로 바꿉니다

AI에게 번호 대신 작업 내용을 말하면:

- 가장 가까운 번호 세션으로 매핑합니다
- 소유 범위가 실제로 바뀌지 않는 한 중복 작업 레인을 새로 만들지 않습니다
- 특정 세션 섹션에 별도 `붙기/반복 기준`이 있으면 그 전용 규칙이 공통 규칙보다 우선합니다

AI에게 `N에 붙어`, `0N에 붙어`, `N에 붙어서`, `0N에 붙어서`, `N번에 붙어`, `N번에 붙어서` 같은 번호 부착 표현을 말하면:

- 해당 번호 세션에 붙습니다
- 그 세션의 마지막 미완료 지점부터 이어갑니다
- 해당 세션 섹션에 `상시 운영 해석` 또는 `붙기/반복 기준`이 있으면 그 세션 전용 반복 규칙을 그대로 따릅니다
- 그 세션의 소유 범위, 허용 경로, 인계 순서, 경로 경계를 유지합니다
- 소유 범위가 실제로 바뀌지 않는 한 중복 작업 레인을 새로 열지 않습니다
- 표현 안에 `무한 반복`, `무한반복`, `1분마다 재실행`, `이어서 해줘`가 함께 있으면 새 세션을 열지 않고 같은 번호 세션에서 반복을 계속합니다

AI에게 `docs/ai/80-skills/resonance-10-session-assignment.md 붙어`, `resonance-10-session-assignment.md 붙어서`, `/opt/Resonance/docs/ai/80-skills/resonance-10-session-assignment.md 붙어` 같은 파일 경로 부착 표현을 말하면:

- 이 문서를 붙기/반복 라우팅 기준으로 사용합니다
- 명시적인 번호 세션이 함께 있으면 그 번호가 우선합니다
- 그렇지 않으면 현재 활성 번호 세션이나 가장 최근에 붙은 번호 세션을 이어갑니다
- 파일 경로가 같이 나왔다는 이유만으로 중복 작업 레인을 새로 만들지 않습니다

AI에게 `무한 반복 1분마다 재실행` 또는 `1분마다 재실행 혹은 이어서 해줘`를 말하면:

- 현재 번호 세션이나 명시적으로 지정한 번호 세션에 그대로 머뭅니다
- 각 반복 사이에는 약 1분을 둡니다
- 각 반복마다 다음 확인 작업을 다시 실행하거나 마지막 미완료 지점부터 이어갑니다
- 병렬 중복 세션을 새로 만들지 않고 같은 세션 상태만 갱신합니다
- 운영자가 중지를 말하거나, 작업이 `DONE`이 되거나, 세션이 `BLOCKED` 되면 멈춥니다

예시:

- `N번에 붙어서 무한 반복 1분마다 재실행`
- `4번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`
- `N번에 붙어서 이어서 해줘`
- `무한반복 N번에 붙어`
- `docs/ai/80-skills/resonance-10-session-assignment.md 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`
- `docs/ai/80-skills/resonance-10-session-assignment.md 4번에 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`
- `docs/ai/80-skills/resonance-10-session-assignment.md N번에 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘`
- `resonance-10-session-assignment.md N번에 붙어서 이어서 해줘`

AI에게 `이어서 해줘`를 말하면:

- 현재 활성 번호 세션이 있으면 그 세션을 계속 진행합니다
- 현재 활성 세션이 없으면 가장 최근에 붙은 번호 세션을 이어갑니다
- 마지막 미완료 지점부터 재개하고 새 작업 레인은 열지 않습니다

AI에게 `무한반복 N번에 붙어서`, `N번에 붙어서 무한 반복` 같은 조합형 표현을 말하면:

- 해당 번호 세션에 붙습니다
- 같은 세션에서 1분 간격 재실행 또는 이어서 진행 규칙을 적용합니다
- 그 세션이 명시적으로 넘기기 전까지는 해당 소유 범위 안에서만 작업합니다

## 추가 계정 기준

추가 계정은 아래 경우에만 늘립니다:

- `04`와 `05`가 모두 포화된 경우
- `09`에 별도 런타임 수집 레인이 필요한 경우
- `10`에 공급자별 모듈 작업을 분리할 필요가 있는 경우

추가 선택 레인:

- `11. 런타임 수집`
- `12. 성능 및 캐시`
- `13. 스타일 및 토큰 점검`

## 함께 사용할 문서

다음 문서와 함께 사용합니다:

- [tmux-multi-account-delivery-playbook.md](/opt/Resonance/docs/architecture/tmux-multi-account-delivery-playbook.md)
- 이 문서의 `운영자 라우팅 규칙` 섹션은 `붙어`, `붙어서`, `이어서 해줘`, `무한반복` 표현을 `tmux` 운영에서 어떻게 해석할지 정한 기준입니다
- [resonance-ai-track-partition-map.md](/opt/Resonance/docs/architecture/resonance-ai-track-partition-map.md)
- [guided-operator-build-flow.md](/opt/Resonance/docs/architecture/guided-operator-build-flow.md)
