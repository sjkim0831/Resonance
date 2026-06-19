# `/emission/data_input` 16 GPU 병렬 확장 작업 계획

## 현재 상태

- **Worktree**: 없음 (초기 상태)
- **현재 섹션**: 5개 (Hero, AI Insights, Search, Sites, Report)
- **목표 섹션**: 20개 (15개 신규 + 5개 기존 확장)
- **Plan Mode**: 읽기 전용 - 실제 실행 불가

---

## 진행 방식

### Kilo Agent Manager를 사용한 병렬 작업

```
16 GPU 사용 → 16개 Agent 동시 실행 → 병렬 컴포넌트 생성 → 최종 병합
```

### Architecture

```
Master Branch: emission-monitoring (main)
                    │
        ┌───────────┼───────────┬─────────────┐
        ▼           ▼           ▼             ▼
   Worktree-1   Worktree-2  ...-15     Worktree-16
   (Hero+Queue) (AI Insights)           (Integration)
        │           │                 │
        └───────────┴────────┬────────┘
                            ▼
                    Final Merge (PR #1)
```

---

## Phase 1: 사전準備 (User 작업)

### 1.1 Worktree 생성 (15개 + 1개)

```bash
cd /opt/Resonance

# 16개 worktree 생성
for i in {1..16}; do
  kilo agent worktree create --name "data-input-$i" --branch "feature/data-input-expand-$i"
done

# 또는 한 번에
kilo agent worktree create --name "data-input-hero --branch "feature/data-input-hero"
kilo agent worktree create --name "data-input-ai --branch "feature/data-input-ai"
# ... (총 16개)
```

### 1.2 각 Worktree에 섹션 할당

| Worktree | Branch | 섹션 | Agent |
|----------|--------|------|-------|
| data-input-01 | feature/data-input-hero | Hero + Queue | Agent-1 |
| data-input-02 | feature/data-input-ai | AI Insights | Agent-2 |
| data-input-03 | feature/data-input-search | Search | Agent-3 |
| data-input-04 | feature/data-input-site1 | Dedicated Site-1 (포항) | Agent-4 |
| data-input-05 | feature/data-input-site2 | Dedicated Site-2 (울산) | Agent-5 |
| data-input-06 | feature/data-input-site3 | Dedicated Site-3 (광양) | Agent-6 |
| data-input-07 | feature/data-input-general | General Sites | Agent-7 |
| data-input-08 | feature/data-input-report | Report Dashboard | Agent-8 |
| data-input-09 | feature/data-input-calendar | Input Calendar | Agent-9 ⭐ |
| data-input-10 | feature/data-input-factors | Emission Factors | Agent-10 ⭐ |
| data-input-11 | feature/data-input-scope | Scope Summary | Agent-11 ⭐ |
| data-input-12 | feature/data-input-trend | Trend Chart | Agent-12 ⭐ |
| data-input-13 | feature/data-input-quality | Data Quality Matrix | Agent-13 ⭐ |
| data-input-14 | feature/data-input-validation | Validation Tracker | Agent-14 ⭐ |
| data-input-15 | feature/data-input-export | Quick Export + History | Agent-15 ⭐ |
| data-input-16 | feature/data-input-integrate | Integration + Manifests | Agent-16 (Master) |

---

## Phase 2: 각 Agent 작업 지시 (프롬프트)

### Agent-1 ~ Agent-8 (기존 섹션 확장)

```markdown
# 작업: /emission/data_input [섹션명] 확장

## 현재 상태
- 파일: src/features/emission-data-input/EmissionDataInputMigrationPage.tsx
- 기존 섹션 5개 → 8개로 확장

## 할당된 섹션
[Agent-1: Hero + Queue]
[Agent-2: AI Insights]
...

## 작업内容
1. 기존 섹션 코드를独立的 컴포넌트로 추출
2. Typescript 타입 정의 확인/추가
3. pageManifests.ts에 component 엔트리 추가
4. 기존 InlineStyles.css 확장 (필요시)

## pageManifests 추가 예시
```typescript
// src/platform/screen-registry/pageManifests.ts
{
  componentId: "EmissionDataInput[섹션명]",
  instanceKey: "emission-data-input-[케밥케이스]",
  layoutZone: "content",
  propsSummary: ["en", ...]
}
```

## 디자인 가이드
- Tailwind CSS
- --kr-gov-* CSS 변수 활용
- 다국어: en ? "EN" : "KO"
```

### Agent-9 ~ Agent-15 (신규 섹션 생성)

```markdown
# 작업: /emission/data_input 신규 섹션 생성

## 현재 상태
- 기존: 5개 섹션
- 목표: 20개 섹션

## 할당된 섹션
[Agent-9: Input Calendar 위젯]
- 월별 마감일, 검증 일정, 보고서 제출일
- 사용자가 클릭 가능한 캘린더 UI

[Agent-10: Emission Factors Panel]
- 최근 사용한 배출계수 5~10개
- 검색 + 필터 기능

[Agent-11: Scope Summary]
- Scope 1/2/3별 배출량 요약
- 그래프 또는 게이지

[Agent-12: Trend Chart]
- 월별/분기별 배출 추이 라인차트
- 12개월 데이터

[Agent-13: Data Quality Matrix]
- completeness %
- 결측치 알림 목록

[Agent-14: Validation Tracker]
- 외부 검증 현재 단계
- KEMCO, 내부 검증 상태

[Agent-15: Quick Export + History]
- 보고서 즉시 내보내기 버튼
- Site별 최근 데이터 수정 이력

## 생성 파일
- src/features/emission-data-input/components/DataInput[섹션명].tsx
- src/features/emission-data-input/types/dataInputTypes.ts (공통 타입 확장)

## pageManifests 추가
{
  componentId: "EmissionDataInput[섹션명]",
  instanceKey: "emission-data-input-[케밥케이스]",
  layoutZone: "content",
  propsSummary: ["en"]
}
```

### Agent-16 (Master - Integration)

```markdown
# 작업: 모든 섹션 통합 + pageManifests 완성

## 목표
- 20개 섹션 조립
- pageManifests.ts 완전 업데이트
- 타입/인터페이스 최종 정리

## 사전 체크
1. Agent-1 ~ Agent-15 완료 확인
2. 각 섹션의 instanceKey 중복 체크
3. Props 인터페이스 충돌 확인

## 최종 파일 구조
```
src/features/emission-data-input/
├── EmissionDataInputMigrationPage.tsx (메인 - 20개 섹션)
├── components/
│   ├── DataInputHero.tsx
│   ├── DataInputQueue.tsx
│   ├── DataInputAIInsights.tsx
│   ├── DataInputSearch.tsx
│   ├── DataInputSitePohang.tsx
│   ├── DataInputSiteUlsan.tsx
│   ├── DataInputSiteGwangyang.tsx
│   ├── DataInputGeneralSites.tsx
│   ├── DataInputReportDashboard.tsx
│   ├── DataInputCalendar.tsx        ⭐
│   ├── DataInputEmissionFactors.tsx  ⭐
│   ├── DataInputScopeSummary.tsx     ⭐
│   ├── DataInputTrendChart.tsx      ⭐
│   ├── DataInputQualityMatrix.tsx   ⭐
│   ├── DataInputValidationTracker.tsx ⭐
│   ├── DataInputQuickExport.tsx      ⭐
│   └── DataInputHistoryFeed.tsx     ⭐
├── types/
│   └── dataInputTypes.ts
└── hooks/
    └── useDataInputContext.tsx (필요시)
```

## 검증 명령어
```bash
npm run build
npx tsc --noEmit
grep -c "emission-data-input" src/platform/screen-registry/pageManifests.ts
# 기대값: 25개 (기존 5 + 신규 20)
```

## 완료 산출물
1. EmissionDataInputMigrationPage.tsx (최종 통합)
2. pageManifests.ts (25개 컴포넌트 엔트리)
3. types/dataInputTypes.ts (타입 정의)
```

---

## Phase 3: 병합 (User 작업)

```bash
# 1. 모든 worktree를 main branch로 병합
git checkout main
git merge feature/data-input-hero
git merge feature/data-input-ai
# ... (16개 병합)

# 2. 또는 Agent Manager Apply 사용
kilo agent apply --worktree data-input-01 --target main

# 3. 충돌 해결 (필요시)
# 충돌 발생 시 Agent-16이 해결

# 4. 빌드 검증
cd /opt/Resonance/projects/carbonet-frontend
npm run build
npm run typecheck
```

---

## 예상 소요 시간 (16 GPU)

| 단계 | 시간 | 비고 |
|------|------|------|
| Worktree 생성 | 5분 | User 작업 |
| Agent 병렬 작업 | 30~60분 | 각 Agent 1~2분 |
| 병합 + 충돌 해결 | 10~20분 | User 작업 |
| 최종 검증 | 5분 | 빌드 + 타입체크 |
| **총계** | **약 1~1.5시간** | |

---

## 산출물

### 파일 변경 목록

```
新建:
- src/features/emission-data-input/components/DataInputCalendar.tsx
- src/features/emission-data-input/components/DataInputEmissionFactors.tsx
- src/features/emission-data-input/components/DataInputScopeSummary.tsx
- src/features/emission-data-input/components/DataInputTrendChart.tsx
- src/features/emission-data-input/components/DataInputQualityMatrix.tsx
- src/features/emission-data-input/components/DataInputValidationTracker.tsx
- src/features/emission-data-input/components/DataInputQuickExport.tsx
- src/features/emission-data-input/components/DataInputHistoryFeed.tsx
- src/features/emission-data-input/types/dataInputTypes.ts

変更:
- src/features/emission-data-input/EmissionDataInputMigrationPage.tsx
- src/platform/screen-registry/pageManifests.ts (25개 엔트리)
- src/app/routes/families/emissionMonitoringFamily.ts (필요시)
```

### pageManifests.ts component 수

```
현재: 5개
├── EmissionDataInputHero
├── EmissionDataInputQueue
├── EmissionDataInputSearch
├── EmissionDataInputSites
└── EmissionDataInputReport

추가 후: 25개
├── (기존 5개)
└── (신규 20개)
```

---

## 다음 단계

1. **User**: Kilo Agent Manager에서 16개 worktree 생성
2. **User**: 각 worktree에 Agent를 할당하고 위 프롬프트 전달
3. **Agent-16**: 모든 섹션 통합 + 최종 검증
4. **User**: 병합 + 빌드 확인

---

## 참고

- 각 Agent는 독립적인 파일을 생성하므로 충돌 최소화
- 공통 타입은 Agent-16이 최종 정리
- pageManifests.ts는 Agent-16이 최종 업데이트
- 기존 `H0010102` 메뉴 코드는 유지 (확장만 수행)