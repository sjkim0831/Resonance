# MenuManagementMigrationPage.tsx 개선 계획

## 1. 좌측 동그라미 아이콘 용도 (현재 코드)
```
{hasChildren ? expand_more/chevron_right : circle}
```
- **용도**: 트리 노드의 **자식 존재 여부 + 확장/축소 토글 버튼**
  - 자식 있음 → `expand_more`(열림) / `chevron_right`(닫힘)
  - 자식 없음 → `circle` (비활성 표시용 원)
- **라디오버튼/체크박스가 아님**

---

## 2. 현재 문제점 분석

### 2.1 저장 버튼 동작 안 함
- **원인 분석**: `/admin/system/menu/order` API가 백엔드에 없거나 응답 형식 불일치
- **확인 필요**: 백엔드 Controller, API 경로, Request/Response 형식
- **대응**: 백엔드 API 확인 후, 없으면 생성 필요

### 2.2 보이게/안 보이게 토글 동작 안 함
- **원인 분석**: `/admin/system/menu/toggle-exposure` API가 백엔드에 없음
- **대응**: 백엔드 API 확인 후, 없으면 생성 필요

---

## 3. 구현할 기능

### 3.1 트리 초기 상태: 모두 닫힘
- Line 109: `useState(depth < 2)` → `useState(false)`
- **단, 최상위 노드만 기본적으로 열기** (depth === 0) 또는 **전체 닫힘**

### 3.2 메뉴 등록 폼 → 최상단 이동
- 현재: Menu Tree (위) → Register New Menu (아래)
- 변경: Register New Menu (위) → Menu Tree (아래)

### 3.3 드래그엔드롭 + 기존 버튼 동시 지원
- `@dnd-kit/core`, `@dnd-kit/sortable` 사용 또는 HTML5 Drag and Drop API
- 기존 up/down 버튼은 유지 (순차 이동용)

### 3.4 메뉴 이름/URL/공통코드 수정 기능
- **인라인 편집**: 행 클릭 → 입력 필드로 전환
- **수정 가능 필드**: label, url, menuCode (공통코드)
- **연쇄 업데이트**: menuCode 변경 시 관련 공통코드 테이블 자동 수정
- **백엔드 API 필요**: `/admin/system/menu/update-page`

### 3.5 메뉴 추가 시 공통코드 자동 생성
- 메뉴 생성 시 입력한 menuCode로 공통코드 테이블에 자동 INSERT
- **백엔드 API 필요**: `/admin/system/menu/create-page` 수정 또는 새 API

### 3.6 Screen Flow UI 개선
- **문제**: 멤버 리스트(노출) - 멤버 등록(비노출, 하위) 관계 표현 안 됨
- **개선 방향**:
  - 노출됨 + 자식 있음 → 일반 노드 + 확장 토글
  - 비노출(숨김) → 회색/점선 스타일로 구분
  - Hierarchy 시각화 개선 (들여쓰기, 연결선)

---

## 4. 백엔드 API 필요 목록

| 기능 | 현재 API | 필요 API |
|------|----------|----------|
| 순서 저장 | /admin/system/menu/order (확인 요) | - |
| 노출 토글 | /admin/system/menu/toggle-exposure (확인 요) | - |
| 메뉴 수정 | 없음 | /admin/system/menu/update-page |
| 공통코드 연쇄 수정 | 없음 | 공통코드 테이블 UPDATE 로직 |
| 메뉴 추가 시 공통코드 생성 | 없음 | 메뉴 + 공통코드 동시 INSERT |

---

## 5. 구현 우선순위

### P0 (즉시 수리)
- [ ] 저장 버튼 동작 안 하는 버그 Fix
- [ ] 토글 버튼 동작 안 하는 버그 Fix
- [ ] 백엔드 API 확인/구현

### P1 (핵심 기능)
- [ ] 트리 초기 상태: 모두 닫힘
- [ ] 메뉴 등록 폼을 최상단으로 이동
- [ ] 메뉴 이름/URL 수정 기능

### P2 (향상 기능)
- [ ] 드래그엔드롭 순서 변경
- [ ] 공통코드 연쇄 업데이트
- [ ] Screen Flow UI 개선

---

## 6. 파일 변경
- `projects/carbonet-frontend/source/src/features/menu-management/MenuManagementMigrationPage.tsx`
- 백엔드 API 생성 필요 시:
  - `projects/carbonet-backend/apps/project-runtime/src/main/java/.../menu/` 경로