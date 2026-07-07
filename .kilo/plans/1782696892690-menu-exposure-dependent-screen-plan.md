# 메뉴 관리 페이지 기능 개선 계획

## 현재 문제점

### 1. 검색 섹션 디자인 불일치
- 현재: 흰 배경 (`div` 태그)
- 레퍼런스 (SystemCode, MemberList): 회색 배경 (`bg-[var(--kr-gov-surface-subtle)]`)

### 2. DependentScreen 매핑 팝업 UI 부족
- 현재: 화면 코드만 드롭다운에 표시
- 문제: 코드만으로는 어떤 메뉴인지 알 수 없음
- 개선: 메뉴 트리(대메뉴 > 중메뉴 > 소메뉴) 또는 메뉴명을 함께 표시

### 3. 보임/숨김 토글 미작동
**원인:** 두 개의 컨트롤러 충돌
- `com.resonance.common.menu.admin.controller.AdminMenuController` (인메모리)
- `com.egovframework.com.feature.admin.web.AdminMenuController` (DB 연동)

**추가 문제:** `AdminMenuTreeService.buildAdminMenuTree`가 `EXPSR_AT='N'`인 메뉴를 필터링하지 않음

---

## 구현 계획

### Task 1: 검색 섹션 디자인 (SystemCode/MemberList 동일 스타일)

**파일:** `MenuManagementMigrationPage.tsx`

**현재:**
```tsx
<div className="flex items-end gap-4">
  ...
</div>
```

**변경:**
```tsx
<div className="mb-4 grid grid-cols-1 gap-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] p-4 lg:grid-cols-3">
  ...
</div>
```

### Task 2: DependentScreen 매핑 팝업 개선

**파일:** `MenuManagementMigrationPage.tsx` - `DependentScreenSelectPopup` 컴포넌트

**변경 내용:**
- 드롭다운 옵션에 `{code} - {label}` 형식으로 표시
- 예: `A0010101 - 회원`
- 기존: `{code}`만 표시

### Task 3: 보임/숨김 토글 복구

#### 3-1. AdminMenuTreeService에 EXPSR_AT 필터링 추가

**파일:** `AdminMenuTreeService.java` (line 61-65)

**현재:**
```java
if (code.isEmpty() || !"Y".equalsIgnoreCase(safeString(row.getUseAt()))) {
    continue;
}
```

**변경:**
```java
if (code.isEmpty() || !"Y".equalsIgnoreCase(safeString(row.getUseAt()))) {
    continue;
}
if ("N".equalsIgnoreCase(safeString(row.getExpsrAt()))) {
    continue;
}
```

#### 3-2. API 엔드포인트 확인/수정

**현재 문제:** 프론트엔드가 `/admin/system/menu/toggle-exposure`를 호출하면 인메모리 서비스로 라우팅될 수 있음

**해결 방법:** `AdminMenuTreeService`가 사용하는 `MenuInfoService`의 `saveMenuExposure`가 올바르게 호출되는지 확인

#### 3-3. MenuInfoServiceImpl 확인

**파일:** `MenuInfoServiceImpl.java`

**메서드:** `saveMenuExposure` - 이미 DB 업데이트 로직 존재 확인

### Task 4: 캐시 무효화

**문제:** 메뉴 가시성 변경 후 sidebar가 즉시 업데이트되지 않음

**해결:** `refreshAdminMenuTree()` 호출하여 캐시 무효화

---

## 검증 방법

1. `/admin/system/menu-management` 접속
2. 메뉴 트리에서 눈 아이콘 클릭 → 토글
3. **F5 새로고침** 후 좌측 사이드바에서 해당 메뉴가 사라지는지 확인
4. DependentScreen 링크 아이콘 클릭 → 팝업에서 메뉴명과 함께 표시되는지 확인
5. 검색 섹션 배경색이 회색([var(--kr-gov-surface-subtle)])인지 확인

---

## 우선순위
1. Task 3 (보임/숨김 복구) - 가장 중요
2. Task 1 (검색 섹션 디자인)
3. Task 2 (DependentScreen 팝업 개선)
4. Task 4 (캐시 무효화)