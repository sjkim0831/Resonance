import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  supportLine: string;
  brandTitle: string;
  brandSubtitle: string;
  role: string;
  managerName: string;
  logout: string;
  heroTitle: string;
  heroBody: string;
  queueLabel: string;
  queueButton: string;
  searchPlaceholder: string;
  addSite: string;
  pinnedTitle: string;
  pinnedBody: string;
  assistantGuide: string;
  manage: string;
  generalTitle: string;
  generalCount: string;
  reportTitle: string;
  reportBody: string;
  reportUpdated: string;
  timelineTitle: string;
  timelineBody: string;
  footerOrg: string;
  footerAddress: string;
  footerService: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerLinks: string[];
};

type QuickTask = {
  tone: "critical" | "required" | "verification" | "insight";
  badge: string;
  due: string;
  title: string;
  body: string;
  cta: string;
};

type SiteAction = {
  label: string;
  icon: string;
  href: string;
  highlight?: boolean;
};

type SiteActivity = {
  title: string;
  meta: string;
};

type FeaturedSite = {
  status: string;
  statusTone: "emerald" | "amber" | "blue";
  id: string;
  name: string;
  alert: string;
  alertTone: "indigo" | "red" | "blue";
  metricLabel: string;
  metricValue: string;
  metricUnit: string;
  chart: string;
  actions: SiteAction[];
  activities: SiteActivity[];
};

type CompactSite = {
  id: string;
  name: string;
  emission: string;
  status: string;
  tone: "emerald" | "amber" | "slate";
  cta: string;
};

type TimelineItem = {
  title: string;
  body: string;
  time: string;
  tone: "blue" | "amber" | "emerald";
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "현장 감독관 전용 포털",
    supportLine: "마지막 업데이트 탐지: 방금 전",
    brandTitle: "배출지 통합 대시보드",
    brandSubtitle: "Site Overseer Control Center",
    role: "총괄 책임자",
    managerName: "이현장 관리자님",
    logout: "로그아웃",
    heroTitle: "업데이트 비서",
    heroBody: "AI가 배출지 데이터를 실시간 분석해 필요한 업데이트 업무를 감지했습니다. 우선순위가 높은 관리 항목부터 바로 이동할 수 있습니다.",
    queueLabel: "Your Update Queue",
    queueButton: "전체 워크플로우 보기",
    searchPlaceholder: "시설 코드, 배출지 명칭, 또는 관리 중인 특정 프로세스를 입력하세요...",
    addSite: "신규 배출지 등록",
    pinnedTitle: "핵심 관리 배출지",
    pinnedBody: "감독관님이 직접 고정한 최우선 관리 대상입니다.",
    assistantGuide: "업데이트 비서 가이드 활성화 중",
    manage: "관리",
    generalTitle: "일반 배출지 현황",
    generalCount: "총 18개소",
    reportTitle: "종합 배출 모니터링 리포트",
    reportBody: "관리 중인 모든 배출지의 통계 및 목표 달성 현황입니다.",
    reportUpdated: "최종 업데이트: 2025.08.14 15:45",
    timelineTitle: "오늘의 운영 타임라인",
    timelineBody: "감지된 이슈, 검증 진행, 보고서 마감 일정을 시간순으로 확인합니다.",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 고객지원센터: 02-1234-5678",
    footerService: "이 플랫폼은 기업 온실가스 감축 현장 운영을 지원합니다.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerLinks: ["개인정보처리방침", "이용약관", "지원센터"]
  },
  en: {
    skip: "Skip to main content",
    government: "Official Government Service",
    guideline: "Field Supervisor Portal",
    supportLine: "Last update detected: just now",
    brandTitle: "Emission Site Dashboard",
    brandSubtitle: "Site Overseer Control Center",
    role: "Chief Supervisor",
    managerName: "Hyun-jang Lee",
    logout: "Logout",
    heroTitle: "Update Assistant",
    heroBody: "AI reviews your emission sites in real time and surfaces the next operational updates to complete. Jump into the most urgent work first.",
    queueLabel: "Your Update Queue",
    queueButton: "View Full Workflow",
    searchPlaceholder: "Search by facility code, site name, or managed process...",
    addSite: "Register New Site",
    pinnedTitle: "Dedicated Sites",
    pinnedBody: "Pinned sites that require your closest attention.",
    assistantGuide: "Assistant guide is active",
    manage: "Manage",
    generalTitle: "General Site Status",
    generalCount: "18 sites total",
    reportTitle: "Integrated Emission Monitoring Report",
    reportBody: "Overall statistics and annual target progress across all managed sites.",
    reportUpdated: "Last update: 2025.08.14 15:45",
    timelineTitle: "Today's Operations Timeline",
    timelineBody: "Track detected issues, verification progress, and report deadlines in chronological order.",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support Center: 02-1234-5678",
    footerService: "This platform supports corporate greenhouse-gas reduction operations.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "Last Updated:",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerLinks: ["Privacy Policy", "Terms of Use", "Support Center"]
  }
};

const QUICK_TASKS: Record<"ko" | "en", QuickTask[]> = {
  ko: [
    { tone: "critical", badge: "CRITICAL", due: "D-2", title: "울산 제3: 보완 서류 제출", body: "공정 배출계수 재산정 로직에 따른 증빙 서류 누락 탐지", cta: "업데이트 시작" },
    { tone: "required", badge: "REQUIRED", due: "D-5", title: "포항 제1: 에너지 데이터", body: "8월분 전력 사용량 고지서 대조 및 최종 확정 필요", cta: "데이터 입력기" },
    { tone: "verification", badge: "VERIFICATION", due: "D-12", title: "광양 제2: 검증 준비", body: "품질 보증 체크리스트 85% 완료. 마지막 3개 항목 확인", cta: "체크리스트 열기" },
    { tone: "insight", badge: "INSIGHT", due: "TODAY", title: "배출 목표 분석 확인", body: "현재 배출 트렌드가 올해 감축 목표 범위를 벗어남", cta: "분석 리포트" }
  ],
  en: [
    { tone: "critical", badge: "CRITICAL", due: "D-2", title: "Ulsan Site 3: Supplement Documents", body: "Missing evidence detected after the revised emission-factor logic update", cta: "Start Update" },
    { tone: "required", badge: "REQUIRED", due: "D-5", title: "Pohang Site 1: Energy Data", body: "August electricity bill reconciliation and final confirmation required", cta: "Open Data Entry" },
    { tone: "verification", badge: "VERIFICATION", due: "D-12", title: "Gwangyang Site 2: Verification Prep", body: "Quality checklist is 85% complete. Review the last three items.", cta: "Open Checklist" },
    { tone: "insight", badge: "INSIGHT", due: "TODAY", title: "Review Emission Target Trend", body: "Current emission trend is moving outside this year's reduction range", cta: "Open Analysis" }
  ]
};

const FEATURED_SITES: Record<"ko" | "en", FeaturedSite[]> = {
  ko: [
    {
      status: "정상 운영",
      statusTone: "emerald",
      id: "PH-001",
      name: "포항 제1 열연공장",
      alert: "8월 2주차 데이터 대조가 필요합니다.",
      alertTone: "indigo",
      metricLabel: "현재 배출량 (Real-time)",
      metricValue: "2,341",
      metricUnit: "tCO2",
      chart: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4",
      actions: [
        { label: "데이터 입력", icon: "edit_square", href: "/emission/data_input" },
        { label: "산정 로직", icon: "calculate", href: "/emission/validate" }
      ],
      activities: [
        { title: "에너지 데이터 확정 (Admin)", meta: "12분 전 · 데이터 유효성 검증 완료" },
        { title: "Tier 3 산정 계수 업데이트", meta: "어제 · 시스템 자동 최적화" }
      ]
    },
    {
      status: "입력 지연 (65%)",
      statusTone: "amber",
      id: "US-042",
      name: "울산 제3 화학기지",
      alert: "산정 증빙 서류 2건이 누락되었습니다.",
      alertTone: "red",
      metricLabel: "누적 배출량",
      metricValue: "4,812",
      metricUnit: "tCO2",
      chart: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22",
      actions: [
        { label: "서류 보완하기", icon: "upload_file", href: "/mtn/my_inquiry", highlight: true },
        { label: "이력 확인", icon: "history", href: "/support/inquiry" }
      ],
      activities: [
        { title: "검증관(김검증) 보완 요청 알림", meta: "3시간 전 · '증빙 자료 부족' 사유" },
        { title: "데이터 수정 (이현장)", meta: "어제 · 고정 연소 섹션 12% 보정" }
      ]
    },
    {
      status: "검증 진행중",
      statusTone: "blue",
      id: "GN-112",
      name: "광양 제2 에너지센터",
      alert: "에너지공단 검증 1단계 통과 완료.",
      alertTone: "blue",
      metricLabel: "연간 누적치",
      metricValue: "12,890",
      metricUnit: "tCO2",
      chart: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15",
      actions: [
        { label: "검증 현황", icon: "fact_check", href: "/certificate/report_list" },
        { label: "보고서 출력", icon: "description", href: "/certificate/report_form" }
      ],
      activities: [
        { title: "한국에너지공단 심사 개시", meta: "2일 전 · 외부 검증 절차 착수" },
        { title: "보고서 최종 승인 완료", meta: "2025.08.10 · 현장 감독관 확정" }
      ]
    }
  ],
  en: [
    {
      status: "Normal",
      statusTone: "emerald",
      id: "PH-001",
      name: "Pohang No. 1 Hot Rolling Mill",
      alert: "Week 2 data reconciliation for August is required.",
      alertTone: "indigo",
      metricLabel: "Current emission (real time)",
      metricValue: "2,341",
      metricUnit: "tCO2",
      chart: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4",
      actions: [
        { label: "Data Entry", icon: "edit_square", href: "/en/emission/data_input" },
        { label: "Logic Review", icon: "calculate", href: "/en/emission/validate" }
      ],
      activities: [
        { title: "Energy data confirmed", meta: "12 min ago · Validation completed" },
        { title: "Tier 3 factor update applied", meta: "Yesterday · Automatic optimization" }
      ]
    },
    {
      status: "Delayed Input (65%)",
      statusTone: "amber",
      id: "US-042",
      name: "Ulsan Chemical Base No. 3",
      alert: "Two evidence documents are still missing.",
      alertTone: "red",
      metricLabel: "Accumulated emission",
      metricValue: "4,812",
      metricUnit: "tCO2",
      chart: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22",
      actions: [
        { label: "Upload Documents", icon: "upload_file", href: "/en/mtn/my_inquiry", highlight: true },
        { label: "View History", icon: "history", href: "/en/support/inquiry" }
      ],
      activities: [
        { title: "Verifier requested supplement", meta: "3 hours ago · Reason: insufficient evidence" },
        { title: "Data edited by supervisor", meta: "Yesterday · 12% correction in fixed combustion" }
      ]
    },
    {
      status: "Verification in Progress",
      statusTone: "blue",
      id: "GN-112",
      name: "Gwangyang No. 2 Energy Center",
      alert: "Stage 1 verification was completed successfully.",
      alertTone: "blue",
      metricLabel: "Annual total",
      metricValue: "12,890",
      metricUnit: "tCO2",
      chart: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15",
      actions: [
        { label: "Verification Status", icon: "fact_check", href: "/en/certificate/report_list" },
        { label: "Generate Report", icon: "description", href: "/en/certificate/report_form" }
      ],
      activities: [
        { title: "External review started", meta: "2 days ago · Public energy review stage opened" },
        { title: "Final report approved", meta: "2025.08.10 · Supervisor confirmation complete" }
      ]
    }
  ]
};

const COMPACT_SITES: Record<"ko" | "en", CompactSite[]> = {
  ko: [
    { id: "IC-005", name: "인천 물류센터", emission: "452 tCO2", status: "정상", tone: "emerald", cta: "데이터 상세" },
    { id: "DJ-021", name: "대전 R&D 캠퍼스", emission: "210 tCO2", status: "입력대기", tone: "amber", cta: "입력 개시" },
    { id: "PJ-088", name: "파주 전산센터", emission: "890 tCO2", status: "정상", tone: "emerald", cta: "데이터 상세" }
  ],
  en: [
    { id: "IC-005", name: "Incheon Logistics Center", emission: "452 tCO2", status: "Normal", tone: "emerald", cta: "View Details" },
    { id: "DJ-021", name: "Daejeon R&D Campus", emission: "210 tCO2", status: "Awaiting Input", tone: "amber", cta: "Start Input" },
    { id: "PJ-088", name: "Paju Data Center", emission: "890 tCO2", status: "Normal", tone: "emerald", cta: "View Details" }
  ]
};

const TIMELINE: Record<"ko" | "en", TimelineItem[]> = {
  ko: [
    { title: "09:10 보완 서류 누락 탐지", body: "울산 제3 화학기지에서 검증용 증빙 2건 누락이 감지되었습니다.", time: "09:10", tone: "amber" },
    { title: "11:40 외부 검증 착수", body: "광양 제2 에너지센터의 1단계 검증이 시작되었습니다.", time: "11:40", tone: "blue" },
    { title: "15:20 데이터 확정 완료", body: "포항 제1 열연공장의 8월 2주차 에너지 데이터가 확정되었습니다.", time: "15:20", tone: "emerald" }
  ],
  en: [
    { title: "09:10 Missing evidence detected", body: "Two verification files are missing for Ulsan Chemical Base No. 3.", time: "09:10", tone: "amber" },
    { title: "11:40 External verification opened", body: "Stage 1 verification started for Gwangyang No. 2 Energy Center.", time: "11:40", tone: "blue" },
    { title: "15:20 Data confirmation complete", body: "Week 2 August energy data was finalized for Pohang Site 1.", time: "15:20", tone: "emerald" }
  ]
};

function taskToneClass(tone: QuickTask["tone"]) {
  if (tone === "critical") return "border-l-red-500 bg-white/5 text-red-400";
  if (tone === "required") return "border-l-orange-500 bg-white/5 text-orange-400";
  if (tone === "verification") return "border-l-blue-500 bg-white/5 text-blue-400";
  return "border-l-emerald-500 bg-white/5 text-emerald-400";
}

function statusBadgeClass(tone: FeaturedSite["statusTone"]) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "border-orange-200 bg-orange-100 text-orange-700";
  return "border-blue-200 bg-blue-100 text-blue-700";
}

function alertClass(tone: FeaturedSite["alertTone"]) {
  if (tone === "red") return "border-red-100 bg-red-50 text-red-800";
  if (tone === "blue") return "border-blue-100 bg-blue-50 text-blue-800";
  return "border-indigo-100 bg-indigo-50 text-indigo-800";
}

function compactToneClass(tone: CompactSite["tone"]) {
  if (tone === "amber") return "text-orange-600";
  if (tone === "emerald") return "text-emerald-600";
  return "text-slate-500";
}

function timelineToneClass(tone: TimelineItem["tone"]) {
  if (tone === "amber") return "border-orange-200 bg-orange-50 text-orange-700";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function MtnStatusMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const tasks = QUICK_TASKS[en ? "en" : "ko"];
  const featuredSites = FEATURED_SITES[en ? "en" : "ko"];
  const compactSites = COMPACT_SITES[en ? "en" : "ko"];
  const timeline = TIMELINE[en ? "en" : "ko"];

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>

      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />

      <div className="border-b border-[var(--kr-gov-border-light)] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 text-xs font-medium text-[var(--kr-gov-text-secondary)] lg:px-8">
          <span>{copy.supportLine}</span>
          <UserLanguageToggle en={en} onEn={() => navigate("/en/mtn/status")} onKo={() => navigate("/mtn/status")} />
        </div>
      </div>

      <UserPortalHeader
        brandSubtitle={copy.brandSubtitle}
        brandTitle={copy.brandTitle}
        onHomeClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}
        rightContent={(
          <>
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.role}</p>
              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.managerName}</p>
            </div>
            <button
              className="rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]"
              onClick={() => navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"))}
              type="button"
            >
              {copy.logout}
            </button>
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 py-10 text-white" data-help-id="mtn-status-hero">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_35%)]" />
          <div className="relative mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/25">
                    <span className="material-symbols-outlined text-[28px] text-white">auto_awesome</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">{copy.heroTitle}</h2>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-300">{copy.queueLabel}</p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-slate-300">{copy.heroBody}</p>
                <button
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                  onClick={() => navigate(buildLocalizedPath("/support/inquiry", "/en/support/inquiry"))}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  {copy.queueButton}
                </button>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  {copy.queueLabel}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {tasks.map((task) => (
                    <button
                      className={`rounded-r-2xl border border-white/10 border-l-4 p-5 text-left shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-white/10 ${taskToneClass(task.tone)}`}
                      key={task.title}
                      onClick={() => navigate(buildLocalizedPath("/support/inquiry", "/en/support/inquiry"))}
                      type="button"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span className="rounded px-2 py-0.5 text-[10px] font-black tracking-[0.18em]">{task.badge}</span>
                        <span className="text-[10px] font-bold text-slate-500">{task.due}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{task.title}</h4>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">{task.body}</p>
                      <span className="mt-5 inline-flex items-center gap-1 text-[11px] font-black text-indigo-300">
                        {task.cta}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8">
          <div className="flex flex-col gap-4 rounded-[24px] border border-gray-100 bg-white p-4 shadow-2xl md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <input className="h-14 w-full rounded-xl bg-gray-50 pl-12 pr-4 text-sm outline-none ring-0 placeholder:text-gray-400" placeholder={copy.searchPlaceholder} type="text" />
            </div>
            <button
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[var(--kr-gov-blue)] px-6 text-sm font-black text-white transition hover:bg-[var(--kr-gov-blue-hover)]"
              onClick={() => navigate(buildLocalizedPath("/mtn/my_inquiry", "/en/mtn/my_inquiry"))}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              {copy.addSite}
            </button>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black">{copy.pinnedTitle}</h2>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{copy.pinnedBody}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 md:flex">
                <span className="material-symbols-outlined text-[18px] text-indigo-500">bolt</span>
                <span className="text-[11px] font-bold text-indigo-700">{copy.assistantGuide}</span>
              </div>
              <button className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 transition hover:text-[var(--kr-gov-blue)]" type="button">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                {copy.manage}
              </button>
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-8 lg:grid-cols-3" data-help-id="mtn-status-pinned-sites">
              {featuredSites.map((site) => (
                <article className="flex h-full flex-col overflow-hidden rounded-[26px] border border-gray-200 bg-white shadow-md" key={site.id}>
                  <div className="flex items-start justify-between border-b border-gray-100 bg-blue-50/20 p-6">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(site.statusTone)}`}>{site.status}</span>
                        <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{site.name}</h3>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">push_pin</span>
                  </div>

                  <div className={`flex items-center justify-between border-b px-6 py-3 ${alertClass(site.alertTone)}`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                      <span className="text-[11px] font-bold">{site.alert}</span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-8 p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="mb-1 text-xs font-bold text-gray-500">{site.metricLabel}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black tracking-tight text-[var(--kr-gov-blue)]">{site.metricValue}</span>
                          <span className="text-sm font-bold uppercase text-gray-400">{site.metricUnit}</span>
                        </div>
                      </div>
                      <svg className="h-16 w-32" viewBox="0 0 100 30">
                        <path d={site.chart} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" className={site.statusTone === "amber" ? "text-orange-500" : "text-blue-500"} />
                      </svg>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {site.actions.map((action) => (
                        <button
                          className={`flex flex-col items-center justify-center rounded-2xl px-4 py-4 text-center text-[12px] font-bold transition ${action.highlight ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700" : "bg-gray-50 text-gray-600 hover:bg-[var(--kr-gov-blue)] hover:text-white"}`}
                          key={action.label}
                          onClick={() => navigate(action.href)}
                          type="button"
                        >
                          <span className="material-symbols-outlined mb-1">{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Site Activity Feed</p>
                      <ul className="space-y-5">
                        {site.activities.map((activity) => (
                          <li className="relative pl-5 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-300" key={activity.title}>
                            <p className="text-[12px] font-bold leading-tight text-gray-700">{activity.title}</p>
                            <span className="text-[10px] text-gray-400">{activity.meta}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="space-y-6">
              <section className="rounded-[26px] border border-gray-200 bg-white p-6 shadow-sm" data-help-id="mtn-status-timeline">
                <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-900">{copy.timelineTitle}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{copy.timelineBody}</p>
                </div>
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <div className="rounded-2xl border p-4" key={item.title}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${timelineToneClass(item.tone)}`}>{item.time}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="mt-2 text-xs leading-6 text-slate-500">{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[26px] border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">{copy.reportTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{copy.reportBody}</p>
                <p className="mt-4 text-xs font-bold text-slate-400">{copy.reportUpdated}</p>
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <p className="text-sm font-bold text-gray-600">{en ? "Annual target progress" : "올해 누적 배출량 vs 연간 목표"}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tight text-[var(--kr-gov-blue)]">45,120</span>
                      <span className="text-sm font-bold text-gray-400">tCO2</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-emerald-600">{en ? "4.2% lower vs same period last year" : "전년 동기 대비 4.2% 감소"}</p>
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-[12px] font-bold">
                        <span>{en ? "Annual limit (60,000 tCO2)" : "연간 허용 목표 (60,000 tCO2)"}</span>
                        <span className="text-[var(--kr-gov-blue)]">75.2%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-white">
                        <div className="h-full w-[75.2%] bg-[var(--kr-gov-blue)]" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <p className="text-sm font-bold text-gray-600">{en ? "Process distribution" : "프로세스별 배출지 분포"}</p>
                    <div className="mt-5 flex h-32 items-end gap-4">
                      <div className="relative flex-1 rounded-t-lg bg-emerald-500"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">12</span></div>
                      <div className="relative flex-1 rounded-t-lg bg-orange-400 h-[72%]"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">5</span></div>
                      <div className="relative flex-1 rounded-t-lg bg-blue-400 h-[54%]"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">3</span></div>
                      <div className="relative flex-1 rounded-t-lg bg-gray-300 h-[28%]"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">1</span></div>
                    </div>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <section className="mt-14">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-700">{copy.generalTitle}</h2>
              <span className="text-sm font-normal text-gray-400">{copy.generalCount}</span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {compactSites.map((site) => (
                <article className="flex flex-col rounded-[22px] border border-gray-200 bg-white shadow-sm transition hover:border-blue-400" key={site.id}>
                  <div className="flex items-start justify-between border-b border-gray-100 p-4">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      <h4 className="font-bold text-gray-800">{site.name}</h4>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-gray-300">push_pin</span>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div className="mb-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{en ? "Emission" : "배출량"}</span>
                        <span className="font-bold">{site.emission}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{en ? "Status" : "상태"}</span>
                        <span className={`font-bold ${compactToneClass(site.tone)}`}>{site.status}</span>
                      </div>
                    </div>
                    <button className="w-full rounded-lg border border-gray-200 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50" onClick={() => navigate(buildLocalizedPath("/support/inquiry", "/en/support/inquiry"))} type="button">
                      {site.cta}
                    </button>
                  </div>
                </article>
              ))}

              <button className="flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-gray-200 bg-white p-6 text-center transition hover:border-[var(--kr-gov-blue)] hover:bg-slate-50" onClick={() => navigate(buildLocalizedPath("/mtn/my_inquiry", "/en/mtn/my_inquiry"))} type="button">
                <span className="material-symbols-outlined mb-2 text-[32px] text-gray-300">add_circle</span>
                <span className="text-xs font-bold text-gray-400">{copy.addSite}</span>
              </button>
            </div>
          </section>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright={copy.footerCopyright}
        footerLinks={[...copy.footerLinks]}
        lastModifiedLabel={copy.footerLastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
