import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

const WORKFLOWS = {
  ko: [
    {
      id: "workflow-1",
      tone: "emerald",
      tag: "신규 등록",
      meta: "3 / 4 단계",
      title: "박민재 (공정관리팀) 시스템 권한 부여",
      action: "다음 단계 진행",
      actionVariant: "primary",
      icon: "how_to_reg",
      steps: ["등록", "교육", "승인", "발령"],
      activeIndex: 2
    },
    {
      id: "workflow-2",
      tone: "rose",
      tag: "퇴직 처리",
      meta: "긴급",
      title: "최영희 (울산 센터) 데이터 이관 대기",
      action: "상태 확인",
      actionVariant: "secondary",
      icon: "person_remove",
      steps: ["공지", "자산 회수", "종료"],
      activeIndex: 1
    }
  ],
  en: [
    {
      id: "workflow-1",
      tone: "emerald",
      tag: "Onboarding",
      meta: "Step 3 of 4",
      title: "Park Min-jae (Process Team) system access grant",
      action: "Perform next step",
      actionVariant: "primary",
      icon: "how_to_reg",
      steps: ["Registration", "Training", "Approval", "Appointment"],
      activeIndex: 2
    },
    {
      id: "workflow-2",
      tone: "rose",
      tag: "Offboarding",
      meta: "Urgent",
      title: "Choi Young-hee (Ulsan Center) pending data transfer",
      action: "Check status",
      actionVariant: "secondary",
      icon: "person_remove",
      steps: ["Notice", "Asset Return", "Closure"],
      activeIndex: 1
    }
  ]
};

const LIFECYCLE_CARDS = {
  ko: [
    {
      id: "staff-1",
      name: "김철수",
      subtitle: "포항 플랜트 1 · 총괄 관리자",
      status: "재직",
      tone: "emerald",
      metricLabel: "권한 성숙도",
      metricValue: "100%",
      actions: ["권한 조정", "인수인계"],
      insightTitle: "갱신 필요 (D-15)",
      insightBody: "연간 보안 서약과 시스템 재인증 갱신 기한이 도래했습니다."
    },
    {
      id: "staff-2",
      name: "이지은",
      subtitle: "울산 화학기지 3 · 산정 담당",
      status: "온보딩",
      tone: "amber",
      metricLabel: "온보딩 진행률",
      metricValue: "65%",
      actions: ["프로세스 계속", "서류 확인"],
      insightTitle: "필수 교육 미이수",
      insightBody: "'L3 데이터 산정 숙련 교육'이 완료되지 않아 시스템 승인 단계가 보류 중입니다."
    },
    {
      id: "staff-3",
      name: "박지성",
      subtitle: "광양 에너지센터 2 · 검증 담당",
      status: "전환",
      tone: "slate",
      metricLabel: "이관율",
      metricValue: "88%",
      actions: ["수료 확인", "최종 종료"],
      insightTitle: "이관 검토 완료",
      insightBody: "모든 관리 기록이 후임자에게 성공적으로 이관되었습니다."
    }
  ],
  en: [
    {
      id: "staff-1",
      name: "Kim Cheol-su",
      subtitle: "Pohang Plant 1 · General Manager",
      status: "Active",
      tone: "emerald",
      metricLabel: "Permission maturity",
      metricValue: "100%",
      actions: ["Adjust role", "Handover"],
      insightTitle: "Renewal required (D-15)",
      insightBody: "The deadline for annual security pledge renewal and system re-authentication is approaching."
    },
    {
      id: "staff-2",
      name: "Lee Ji-eun",
      subtitle: "Ulsan Base 3 · Calculation Staff",
      status: "Onboarding",
      tone: "amber",
      metricLabel: "Onboarding progress",
      metricValue: "65%",
      actions: ["Continue process", "Documents"],
      insightTitle: "Missing mandatory training",
      insightBody: "System approval is blocked until the L3 data calculation training is completed."
    },
    {
      id: "staff-3",
      name: "Park Ji-sung",
      subtitle: "Gwangyang Energy Center 2 · Verifier",
      status: "Transition",
      tone: "slate",
      metricLabel: "Transfer rate",
      metricValue: "88%",
      actions: ["Certificate", "Final exit"],
      insightTitle: "Transfer review complete",
      insightBody: "All management records were successfully handed over to the successor."
    }
  ]
};

const STAFF_TABLE = {
  ko: [
    {
      id: "row-1",
      initials: "최",
      name: "최강현",
      role: "안전환경 / 담당",
      detail: "데이터 수집 및 검증",
      facilities: "포항 1, 파주 데이터센터",
      security: "Level 2",
      status: "재직"
    },
    {
      id: "row-2",
      initials: "한",
      name: "한소희",
      role: "광양 센터 / 관리자",
      detail: "인증 총괄",
      facilities: "광양 에너지센터 2",
      security: "Level 3",
      status: "권한 변경"
    }
  ],
  en: [
    {
      id: "row-1",
      initials: "C",
      name: "Choi Kang-hyun",
      role: "Safety & Env / Staff",
      detail: "Data collection and verification",
      facilities: "Pohang 1, Paju Data Center",
      security: "Level 2",
      status: "Active"
    },
    {
      id: "row-2",
      initials: "H",
      name: "Han So-hee",
      role: "Gwangyang Center / Manager",
      detail: "Certification lead",
      facilities: "Gwangyang Energy Center 2",
      security: "Level 3",
      status: "Permission Update"
    }
  ]
};

function toneClasses(tone: string) {
  if (tone === "emerald") {
    return {
      pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
      track: "bg-emerald-500",
      card: "bg-emerald-50/30",
      accent: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
  }
  if (tone === "amber") {
    return {
      pill: "bg-amber-100 text-amber-700 border-amber-200",
      track: "bg-amber-500",
      card: "bg-amber-50/30",
      accent: "bg-red-50 border-red-100 text-red-700"
    };
  }
  return {
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    track: "bg-indigo-500",
    card: "bg-slate-50/50",
    accent: "bg-blue-50 border-blue-100 text-blue-700"
  };
}

export function MypageStaffMigrationPage() {
  const en = isEnglish();
  const locale = en ? "en" : "ko";
  const workflows = WORKFLOWS[locale];
  const cards = LIFECYCLE_CARDS[locale];
  const rows = STAFF_TABLE[locale];

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "My Page | Manager permission and workflow management" : "마이페이지 | 담당자 권한 및 라이프사이클 관리",
    brandTitle: en ? "My Page" : "마이페이지",
    brandSubtitle: en ? "Manager Lifecycle Control" : "담당자 라이프사이클 관리",
    homeHref: buildLocalizedPath("/home", "/en/home"),
    heroBadge: en ? "Workflow engine active" : "워크플로 엔진 활성화",
    heroTitle: en ? "Intelligent Staff Lifecycle Assistant" : "지능형 담당자 라이프사이클 어시스턴트",
    heroBody: en
      ? "Handle onboarding, role changes, and offboarding from one operational cockpit."
      : "신규 등록, 역할 변경, 종료 처리까지 모든 담당자 운영 절차를 한 화면에서 관리합니다.",
    startRegistration: en ? "Start Registration" : "등록 시작",
    statusReport: en ? "General Status Report" : "전체 현황 리포트",
    ongoingTitle: en ? "Major Ongoing Workflows" : "주요 진행 워크플로",
    ongoingMeta: en ? "2 pending processes" : "총 2건 진행 중",
    searchPlaceholder: en ? "Search by staff name, department, or site" : "담당자명, 부서, 사업장으로 검색",
    search: en ? "Search" : "검색",
    sectionTitle: en ? "Core Staff Lifecycle Management" : "핵심 담당자 라이프사이클 관리",
    sectionBody: en ? "Monitor current status and required actions of core facility staff in real time." : "핵심 시설 담당자의 현재 상태와 필요한 조치를 실시간으로 확인합니다.",
    batchRole: en ? "Batch Role Adjustment" : "일괄 권한 조정",
    downloadList: en ? "Download List" : "목록 다운로드",
    listTitle: en ? "All Staff List" : "전체 담당자 목록",
    totalLabel: en ? "Total 42" : "총 42명",
    departmentFilter: en ? "All Departments" : "전체 부서",
    statusFilter: en ? "All Statuses" : "전체 상태",
    managerCol: en ? "Staff" : "담당자",
    deptCol: en ? "Dept / Role" : "부서 / 역할",
    facilitiesCol: en ? "Managed Facilities" : "담당 시설",
    securityCol: en ? "Security Level" : "보안 등급",
    workflowCol: en ? "Workflow Status" : "워크플로 상태",
    actionCol: en ? "Action" : "작업",
    profile: en ? "My Profile" : "내 정보",
    security: en ? "Security & Password" : "보안 설정",
    company: en ? "Company Info" : "기업 정보",
    staff: en ? "Staff Management" : "담당자 관리",
    notification: en ? "Notifications" : "알림 설정",
    userRole: en ? "System Administrator" : "시스템 관리자",
    userName: en ? "Admin Lee Hyeon-jang" : "이현장 관리자",
    footerOrg: en ? "CCUS Integrated HQ" : "CCUS 통합관리본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Staff support: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 담당자 지원센터 02-1234-5678",
    footerService: en ? "This system supports efficient staff governance and security compliance." : "본 시스템은 담당자 운영 거버넌스와 보안 준수를 효율적으로 지원합니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Use", "Admin Guide"]) : Array.from(["개인정보처리방침", "이용약관", "운영 가이드"]),
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  const sidebarItems = [
    { label: copy.profile, href: buildLocalizedPath("/mypage/profile", "/en/mypage/profile"), icon: "account_circle", active: false },
    { label: copy.security, href: buildLocalizedPath("/mypage/security", "/en/mypage/security"), icon: "security", active: false },
    { label: copy.company, href: buildLocalizedPath("/mypage/company", "/en/mypage/company"), icon: "business", active: false },
    { label: copy.staff, href: buildLocalizedPath("/mypage/staff", "/en/mypage/staff"), icon: "groups", active: true },
    { label: copy.notification, href: buildLocalizedPath("/mypage/notification", "/en/mypage/notification"), icon: "notifications", active: false }
  ];

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#eff4fb_0%,#f8fafc_22%,#ffffff_100%)] text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={copy.homeHref}
        rightContent={(
          <>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-500">{copy.userRole}</span>
              <span className="text-sm font-black text-slate-900">{copy.userName}</span>
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/mypage/staff")} onEn={() => navigate("/en/mypage/staff")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,#1f3ea8_0%,#111827_62%,#0f172a_100%)]" data-help-id="mypage-staff-hero">
          <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="space-y-2 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                {sidebarItems.map((item) => (
                  <button
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${item.active ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                    key={item.label}
                    onClick={() => navigate(item.href)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-200">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                      </span>
                      {copy.heroBadge}
                    </span>
                    <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">{copy.heroTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{copy.heroBody}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700" type="button">
                      {copy.startRegistration}
                    </button>
                    <button className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15" type="button">
                      {copy.statusReport}
                    </button>
                  </div>
                </div>

                <section className="rounded-[28px] border border-white/10 bg-white/6 p-6 backdrop-blur-sm">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-lg font-black text-white">
                      <span className="material-symbols-outlined text-indigo-300">pending_actions</span>
                      {copy.ongoingTitle}
                    </h3>
                    <span className="text-xs font-bold text-slate-400">{copy.ongoingMeta}</span>
                  </div>
                  <div className="space-y-5">
                    {workflows.map((workflow) => (
                      <article className="rounded-[24px] border border-slate-700 bg-slate-900/70 p-5" key={workflow.id}>
                        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${workflow.tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-rose-500/20 bg-rose-500/10 text-rose-300"}`}>
                              <span className="material-symbols-outlined">{workflow.icon}</span>
                            </div>
                            <div>
                              <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${workflow.tone === "emerald" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{workflow.tag}</span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{workflow.meta}</span>
                              </div>
                              <h4 className="text-sm font-bold text-white">{workflow.title}</h4>
                            </div>
                          </div>
                          <button className={`rounded-xl px-4 py-2 text-xs font-bold transition ${workflow.actionVariant === "primary" ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-600 text-slate-200 hover:bg-slate-700"}`} type="button">
                            {workflow.action}
                          </button>
                        </div>
                        <div className={`grid gap-3 ${workflow.steps.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                          {workflow.steps.map((step, index) => {
                            const active = index === workflow.activeIndex;
                            const complete = index < workflow.activeIndex;
                            return (
                              <div key={step}>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black ${complete ? "border-emerald-500 bg-emerald-50 text-emerald-600" : active ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "border-slate-700 bg-slate-800 text-slate-500"}`}>
                                  {complete ? <span className="material-symbols-outlined text-[18px]">check</span> : index + 1}
                                </div>
                                <p className={`mt-2 text-[11px] font-bold ${active ? "text-white" : "text-slate-400"}`}>{step}</p>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto -mt-8 max-w-7xl px-4 lg:px-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row">
              <label className="relative flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input className="h-14 w-full rounded-2xl bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500" placeholder={copy.searchPlaceholder} type="text" />
              </label>
              <div className="flex gap-2">
                <button className="h-14 rounded-2xl bg-indigo-600 px-8 text-sm font-bold text-white transition hover:bg-indigo-700" type="button">{copy.search}</button>
                <button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200" type="button">
                  <span className="material-symbols-outlined">filter_list</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8" data-help-id="mypage-staff-table">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <span className="material-symbols-outlined text-indigo-600">manage_accounts</span>
                {copy.sectionTitle}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{copy.sectionBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600" type="button">
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                {copy.batchRole}
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700" type="button">
                <span className="material-symbols-outlined text-[16px]">download</span>
                {copy.downloadList}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {cards.map((card) => {
              const tone = toneClasses(card.tone);
              return (
                <article className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={card.id}>
                  <div className={`border-b border-slate-100 p-6 ${tone.card}`}>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                        <span className="material-symbols-outlined text-[28px]">face</span>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${tone.pill}`}>{card.status}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{card.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{card.subtitle}</p>
                  </div>
                  <div className="space-y-6 p-6">
                    <div>
                      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <span>{card.metricLabel}</span>
                        <span className="text-indigo-600">{card.metricValue}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${tone.track}`} style={{ width: card.metricValue }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {card.actions.map((action) => (
                        <button className="rounded-xl bg-slate-50 py-3 text-[11px] font-bold text-slate-600 transition hover:bg-indigo-600 hover:text-white" key={action} type="button">
                          {action}
                        </button>
                      ))}
                    </div>
                    <div className={`rounded-2xl border p-4 ${tone.accent}`}>
                      <p className="text-[11px] font-black">{card.insightTitle}</p>
                      <p className="mt-2 text-[11px] leading-5">{card.insightBody}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {copy.listTitle}
                <span className="ml-2 text-sm font-normal text-slate-400">{copy.totalLabel}</span>
              </h3>
              <div className="flex gap-3">
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500">
                  <option>{copy.departmentFilter}</option>
                </select>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500">
                  <option>{copy.statusFilter}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-6 py-4">{copy.managerCol}</th>
                    <th className="px-6 py-4">{copy.deptCol}</th>
                    <th className="px-6 py-4">{copy.facilitiesCol}</th>
                    <th className="px-6 py-4">{copy.securityCol}</th>
                    <th className="px-6 py-4 text-center">{copy.workflowCol}</th>
                    <th className="px-6 py-4 text-right">{copy.actionCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr className="hover:bg-slate-50/80" key={row.id}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-600">{row.initials}</div>
                          <div className="text-sm font-bold text-slate-800">{row.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-slate-600">{row.role}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{row.detail}</div>
                      </td>
                      <td className="px-6 py-5 text-xs font-medium text-slate-600">{row.facilities}</td>
                      <td className="px-6 py-5">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">{row.security}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${row.status.includes("권한") || row.status.includes("Permission") ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{row.status}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button className="text-slate-400 transition hover:text-indigo-600" type="button">
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center gap-1 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400" type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="h-8 w-8 rounded border border-indigo-600 bg-indigo-600 text-xs font-bold text-white" type="button">1</button>
              <button className="h-8 w-8 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600" type="button">2</button>
              <button className="h-8 w-8 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600" type="button">3</button>
              <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400" type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
