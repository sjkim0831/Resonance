# Builder Studio AdminShell 연동 및 UI 일치화

## 목표

Builder Studio 페이지를 다른 Admin 페이지들과 동일한 UI 패턴으로 일치시킴

## 완료된 작업

1. `A` 컴포넌트 연동 - `environmentManagementHub-BwcwD2IN.js`에서 `A` import
2. renderShell() 수정 - body를 `A` 컴포넌트의 children으로 전달

## 현재 문제

BuilderStudioPage가 `A` 컴포넌트에 children만 전달하고 있어, 다른 Admin 페이지들과 동일한 UI 요소가 없음:
- ❌ breadcrumbs 없음
- ❌ title/subtitle 없음
- ❌ sidebar 활성화 상태 없음
- ❌ page actions 없음

## 목표 UI (표준 Admin 페이지 패턴)

다른 Admin 페이지들(AiDashboardPage, AiLogsPage 등)과 동일한 구조로:

```javascript
e.jsx(A, {
  breadcrumbs: [
    {label: "홈", href: "/admin/"},
    {label: "AI 관리"},
    {label: "대시보드"}
  ],
  sidebarVariant: "system",
  title: "AI Operations Dashboard",
  subtitle: "AI 플랫폼 상태...",
  actions: ...,
  children: content
})
```

## 구현 plan

### 1. BuilderStudioPage의 renderShell() 수정

현재:
```javascript
const AdminShell = React.lazy(() => import("./environmentManagementHub-BwcwD2IN.js").then(m => ({ default: m.A })));
return h(React.Suspense, { fallback: ... },
  h(AdminShell, null, body));
```

변경 후:
```javascript
const AdminShell = React.lazy(() => import("./environmentManagementHub-BwcwD2IN.js").then(m => ({ default: m.A })));

// 다국어 지원 함수 (다른 Admin 페이지들과 동일한 패턴)
const t = j(); // useLocale()
const breadcrumbs = [
  {label: t?"Home":"홈", href: b("/admin/","/en/admin/")},
  {label: t?"System":"시스템"},
  {label: t?"Builder Studio":"빌더 스튜디오"}
];
const title = t?"Builder Studio":"빌더 스튜디오";
const subtitle = t?"Screen builder workspace for creating and managing pages.":"화면 빌더 워크스페이스";
const sidebarVariant = "system";
const actions = h("div",{className:"flex gap-2"},
  h("button",{className:"gov-btn gov-btn-outline",onClick:()=>loadAll(),type:"button"}, "Reload"));

return h(React.Suspense, { fallback: ... },
  h(AdminShell, {
    breadcrumbs: breadcrumbs,
    sidebarVariant: sidebarVariant,
    title: title,
    subtitle: subtitle,
    actions: actions
  }, body));
```

### 2. 변경 파일

**carbonet-frontend (3개):**
- `BuilderStudioPage-BBdbfW4J.js`
- `BuilderStudioPage-BMLKrWvl.js`
- `BuilderStudioPage-CLYZaISy.js`

**carbonet-assets (3개):**
- `BuilderStudioPage-BBdbfW4J.js`
- `BuilderStudioPage-BMLKrWvl.js`
- `BuilderStudioPage-CLYZaISy.js`

## 적용 방식
- **무빌드/무배포** - JS 번들 직접 수정
- 호스트Path 마운트로 파일 변경 즉시 컨테이너 반영

## 검증
1. 브라우저 캐시 클리어 (Ctrl+Shift+R)
2. `/admin/system/builder-studio` 접속
3. 다음 항목 확인:
   - ✅ 상단 헤더에 "대한민국 정부 공식 서비스" 표시
   - ✅ 좌측 사이드바에 메뉴 활성화 상태
   - ✅ 브레드크럼 표시 (홈 > 시스템 > 빌더 스튜디오)
   - ✅ 페이지 제목/설명 표시
   - ✅ 액션 버튼 (새로고침 등) 표시
   - ✅ Builder Studio 본문 (Explorer/Canvas/Inspector)