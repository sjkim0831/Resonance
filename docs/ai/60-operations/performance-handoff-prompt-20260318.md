# Performance Handoff Prompt 2026-03-18

Use this prompt when another AI session must continue the performance and algorithm upgrade work in `/opt/Resonance`.

## Current state

- Implemented:
  - password reset history moved to DB-side filtering and pagination
  - request execution log recent-read changed to bounded deque scan
  - React asset manifest parsing cached in memory by manifest timestamp
  - backend route lookup and frontend manifest lookup changed from repeated linear scans to indexed lookup maps
  - admin permission hot-path set math changed to bitmap-backed `FeatureCodeBitmap` operations
  - menu rows, home menu, and sitemap trees now use versioned precompiled snapshots with in-memory invalidation on menu-order writes
  - security audit summary cards now use a single-pass aggregate snapshot instead of repeated list rescans
  - emission result summary filtering now computes filtered rows and summary counts in one pass
  - auth-group feature catalog summary counts now use a shared one-pass snapshot
- Main record:
  - `docs/architecture/performance-algorithm-upgrade-notes.md`
- Related skill docs already updated:
  - `.codex/skills/carbonet-audit-trace-architecture/SKILL.md`
  - `.codex/skills/carbonet-react-refresh-consistency/SKILL.md`

## Highest-value next steps

1. Permission and feature evaluation bitset model
2. Materialized summary rows for admin dashboard and audit cards
3. Extend menu snapshot invalidation to any non-order menu write path if those writes are introduced or discovered
4. Append-only segmented request-log recent index
5. Bloom or Cuckoo filter fast-paths for duplicate and blocklist checks

## Files to read first

1. `/opt/Resonance/AGENTS.md`
2. `/opt/Resonance/docs/architecture/performance-algorithm-upgrade-notes.md`
3. `/opt/Resonance/.codex/skills/carbonet-ai-session-orchestrator/SKILL.md`
4. `/opt/Resonance/.codex/skills/carbonet-audit-trace-architecture/SKILL.md`
5. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminMainController.java`
6. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/util/ReactPageUrlMapper.java`
7. `/opt/Resonance/projects/carbonet-frontend/source/src/app/screen-registry/pageManifestIndex.ts`
8. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/util/FeatureCodeBitmap.java`
9. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/menu/service/impl/SiteMapServiceImpl.java`
10. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/impl/HomeMenuServiceImpl.java`
11. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/impl/MenuInfoServiceImpl.java`

## Continuation prompt

```text
/opt/Resonance 에서 성능/알고리즘 업그레이드를 이어서 진행해라.

반드시 먼저 사용할 스킬:
1. carbonet-ai-session-orchestrator
2. carbonet-audit-trace-architecture
필요시 React asset/caching 변경이 있으면 carbonet-react-refresh-consistency도 사용해라.

작업 목표:
- 이미 적용된 개선사항을 유지한 채 다음 우선순위 항목을 실제 코드로 반영한다.
- 우선순위는 아래 순서를 기본으로 한다.
  1. 권한/기능 코드 평가를 bitset 또는 동등한 bitmap 기반 모델로 바꿀 수 있는지 조사하고, 안전한 최소 범위를 먼저 구현
  2. 메뉴/사이트맵을 요청 시 재조립하지 않도록 precompiled snapshot 또는 캐시 구조 도입
  3. 요약 카드용 count를 반복 스캔하지 않도록 materialized summary 또는 증분 집계 구조 설계 및 가능한 범위 구현

필수 제약:
- 사용자 변경사항은 절대 되돌리지 말 것
- apply_patch 로만 수동 수정할 것
- 변경한 내용은 docs/architecture/performance-algorithm-upgrade-notes.md 와 관련 skill docs에 기록할 것
- 다른 AI가 이어받을 수 있게 마지막에 다음 액션과 검증 명령을 남길 것

먼저 할 일:
- 현재 워크트리 변경사항 확인
- 기존 성능 개선 기록 읽기
- 권한/메뉴 경로에서 가장 비용 큰 선형 탐색과 반복 contains 패턴을 다시 식별
- 작은 범위부터 실제 구현하고 빌드 검증

검증:
- frontend: npm run build
- backend: mvn -q -DskipTests compile

최종 응답에는:
- 이번 세션에서 실제 반영한 성능 개선
- 남은 고우선순위 백로그
- 다음 AI를 위한 이어받기 지시
를 짧게 정리해라.
```
