import { useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type ReportFilterKey = "half" | "annual" | "investor";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type HeroMetric = {
  label: string;
  value: string;
  accentClassName?: string;
};

type HeroAction = {
  key: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  featured?: boolean;
};

type KpiCard = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  status: string;
  statusClassName: string;
  accentClassName: string;
  note: string;
  badge?: string;
  sparkline?: string;
  progress?: string;
  bars?: number[];
};

type TrendBar = {
  month: string;
  height: string;
  value: string;
  active?: boolean;
  forecast?: boolean;
};

type FrameworkMetric = {
  label: string;
  icon: string;
  value: string;
  progress: string;
  toneClassName: string;
};

type CertificationRow = {
  title: string;
  status: string;
  progress: string;
  toneClassName: string;
};

type InsightCard = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  statA: string;
  statB: string;
  toneClassName: string;
  actionLabel: string;
  href: string;
};

type PublishingStep = {
  key: string;
  label: string;
  title: string;
  body: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  governmentText: string;
  governmentStatus: string;
  navItems: NavItem[];
  roleLabel: string;
  roleName: string;
  heroTitle: string;
  heroBody: string;
  pageStatusMessage: string;
  filterLabel: string;
  filterOptions: Array<{ key: ReportFilterKey; label: string }>;
  exportLabel: string;
  kpiTitle: string;
  kpiBody: string;
  trendTitle: string;
  trendBody: string;
  trendAction: string;
  trendCaption: string;
  trendRecommendation: string;
  trendRecommendationAction: string;
  currentTag: string;
  forecastTag: string;
  complianceTitle: string;
  complianceBody: string;
  complianceBadge: string;
  complianceAction: string;
  publishingTitle: string;
  publishingBody: string;
  publishingSteps: PublishingStep[];
  publishingSummaryLabel: string;
  publishingSummaryValue: string;
  insightsTitle: string;
  insightsBody: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  heroMetrics: HeroMetric[];
  heroActions: HeroAction[];
  kpis: KpiCard[];
  trendBars: TrendBar[];
  frameworkMetrics: FrameworkMetric[];
  certificationRows: CertificationRow[];
  insights: InsightCard[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "ESG 보고서",
    pageSubtitle: "EXECUTIVE INSIGHT & MONITORING",
    governmentText: "전략 모니터링 & 분석 허브 | 의사결정권자용 통합 뷰",
    governmentStatus: "데이터 동기화: 실시간 (2026.04.02 13:30)",
    navItems: [
      { label: "종합 대시보드", href: "/monitoring/dashboard" },
      { label: "트렌드 분석", href: "/monitoring/reduction_trend" },
      { label: "ESG 보고서", href: "/monitoring/statistics", active: true },
      { label: "컴플라이언스", href: "/monitoring/alerts" }
    ],
    roleLabel: "최고책임자",
    roleName: "김경영 본부장님",
    heroTitle: "System Health Overview",
    heroBody: "실시간 모니터링 시스템은 현재 정상 가동 중입니다. 전체 배출원의 98%가 유효 데이터를 송신하고 있으며 ESG 컴플라이언스 위험도는 낮음 상태를 유지하고 있습니다.",
    pageStatusMessage: "reference ESG 보고서 화면을 현재 홈 포털 React 구조에 맞춰 재구성했고 `/monitoring/esg` 별칭도 같은 화면으로 연결했습니다.",
    filterLabel: "보고 범위",
    filterOptions: [
      { key: "half", label: "2025 상반기 보고서" },
      { key: "annual", label: "2025 연간 보고서" },
      { key: "investor", label: "이사회 브리프" }
    ],
    exportLabel: "데이터 내보내기",
    kpiTitle: "Core KPI Dashboards",
    kpiBody: "주요 배출지 성과와 감축 목표 달성 현황을 한 화면에서 점검합니다.",
    trendTitle: "Trend Analysis Report",
    trendBody: "과거 12개월 배출량 추이와 익월 예측",
    trendAction: "상세 분석",
    trendCaption: "추세가 기준 범위 안에 유지되면 현재 전략 시나리오가 효과적으로 동작하고 있음을 의미합니다.",
    trendRecommendation: "하절기 가동률 상승에 대비한 에너지 절감 시나리오가 권장됩니다.",
    trendRecommendationAction: "권고안 보기",
    currentTag: "CUR: 2.3k",
    forecastTag: "FCST",
    complianceTitle: "ESG Compliance Summary",
    complianceBody: "글로벌 공시 지표 준수 상태와 인증 진행도를 함께 검토합니다.",
    complianceBadge: "COMPLIANT",
    complianceAction: "ESG 전체 보고서 센터 바로가기",
    publishingTitle: "보고서 배포 흐름",
    publishingBody: "reference 화면의 집행 요약 성격을 유지하면서, 현재 앱에서는 검토부터 이해관계자 공유까지의 공개 흐름을 같은 보드에 정리했습니다.",
    publishingSteps: [
      { key: "review", label: "01", title: "경영 검토", body: "핵심 KPI와 이슈 사업장, 규제 리스크를 경영진 기준으로 재정렬합니다." },
      { key: "package", label: "02", title: "공시 패키징", body: "공시 문안, 그래프, 증빙 첨부를 보고서 묶음으로 확정합니다." },
      { key: "share", label: "03", title: "이해관계자 공유", body: "감사 대응본, 투자자 브리프, 내부 운영본으로 배포 대상을 분기합니다." }
    ],
    publishingSummaryLabel: "이번 주 배포 예정",
    publishingSummaryValue: "3 Reports",
    insightsTitle: "Detailed Sectional Insights",
    insightsBody: "사업장별 세부 데이터, 과거 이벤트 비교, 배출량 산정 리포트를 현재 앱의 후속 화면과 연결했습니다.",
    footerOrg: "CCUS 전략통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 기술 지원: 02-1234-5678",
    footerServiceLine: "본 플랫폼은 고위급 의사결정 지원을 위한 실시간 데이터 분석 허브입니다.",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Strategic Oversight Hub.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    heroMetrics: [
      { label: "데이터 신뢰도", value: "99.4%" },
      { label: "인증 진행률", value: "82.5%", accentClassName: "text-indigo-300" }
    ],
    heroActions: [
      { key: "trend", icon: "analytics", title: "트렌드 분석", body: "배출량 추이 및 미래 예측", href: "/monitoring/reduction_trend", featured: true },
      { key: "report", icon: "article", title: "ESG 공시 리포트", body: "2025 상반기 통합 보고서", href: "/monitoring/statistics" },
      { key: "policy", icon: "policy", title: "준거성 상태", body: "국내외 환경 규제 대응 현황", href: "/monitoring/alerts" }
    ],
    kpis: [
      {
        key: "emissions",
        label: "TOTAL EMISSIONS",
        value: "45,120",
        unit: "tCO2e",
        status: "▼ 4.2%",
        statusClassName: "text-emerald-600",
        accentClassName: "border-t-indigo-500",
        note: "전년 동기 대비 감소",
        sparkline: "M0 15 Q 10 10, 20 12 T 40 8 T 60 10 T 80 5 T 100 7"
      },
      {
        key: "reduction",
        label: "REDUCTION TARGET",
        value: "14,880",
        unit: "Left to Goal",
        status: "75% Achieved",
        statusClassName: "text-slate-500",
        accentClassName: "border-t-emerald-500",
        note: "목표 경로 내에서 유지",
        progress: "75%"
      },
      {
        key: "efficiency",
        label: "ENERGY EFFICIENCY",
        value: "0.42",
        unit: "intensity",
        status: "Improving",
        statusClassName: "text-amber-600",
        accentClassName: "border-t-amber-500",
        note: "공정 효율 개선 추세",
        bars: [45, 55, 78, 92]
      },
      {
        key: "compliance",
        label: "COMPLIANCE STATUS",
        value: "AA+",
        status: "Very Good",
        statusClassName: "text-blue-600",
        accentClassName: "border-t-blue-600",
        note: "No regulatory issues found",
        badge: "TOP 5%"
      }
    ],
    trendBars: [
      { month: "Jan", height: "60%", value: "3.2k" },
      { month: "Feb", height: "65%", value: "3.4k" },
      { month: "Mar", height: "55%", value: "2.9k" },
      { month: "Apr", height: "75%", value: "3.8k" },
      { month: "May", height: "45%", value: "2.3k", active: true },
      { month: "Jun", height: "40%", value: "2.6k", forecast: true }
    ],
    frameworkMetrics: [
      { label: "GRI Standards", icon: "task_alt", value: "100%", progress: "100%", toneClassName: "bg-blue-600" },
      { label: "TCFD Alignment", icon: "task_alt", value: "92%", progress: "92%", toneClassName: "bg-emerald-500" }
    ],
    certificationRows: [
      { title: "ISO 14064-1 검증", status: "Step 3/4", progress: "75%", toneClassName: "bg-indigo-500" },
      { title: "RE100 로드맵 승인", status: "In Review", progress: "50%", toneClassName: "bg-amber-400" }
    ],
    insights: [
      {
        key: "site",
        icon: "factory",
        title: "사업장별 세부 데이터",
        subtitle: "18개 배출지별 전수 분석",
        statA: "포항 제1 공장: Excellent",
        statB: "울산 제3 화학: Warning",
        toneClassName: "text-indigo-600",
        actionLabel: "모니터링 시트 열기",
        href: "/monitoring/dashboard"
      },
      {
        key: "history",
        icon: "history_edu",
        title: "과거 이력 비교",
        subtitle: "전년도 및 목표 대비 대조 보고서",
        statA: "전년 동기 대비: -12.5%",
        statB: "5개년 장기 추세: Stable",
        toneClassName: "text-blue-600",
        actionLabel: "비교 리포트 생성",
        href: "/monitoring/reduction_trend"
      },
      {
        key: "report",
        icon: "description",
        title: "배출량 산정 리포트",
        subtitle: "데이터 유효성과 계산 근거",
        statA: "Tier 3 적용 비율: 85%",
        statB: "검증 완료 항목: 14건",
        toneClassName: "text-slate-700",
        actionLabel: "증빙 리스트 확인",
        href: "/emission/validate"
      }
    ]
  },
  en: {
    pageTitle: "ESG Report",
    pageSubtitle: "EXECUTIVE INSIGHT & MONITORING",
    governmentText: "Strategic Monitoring & Analysis Hub | Unified executive view",
    governmentStatus: "Data sync: realtime (2026.04.02 13:30)",
    navItems: [
      { label: "Dashboard", href: "/monitoring/dashboard" },
      { label: "Trend Analysis", href: "/monitoring/reduction_trend" },
      { label: "ESG Report", href: "/monitoring/statistics", active: true },
      { label: "Compliance", href: "/monitoring/alerts" }
    ],
    roleLabel: "Chief Officer",
    roleName: "Director Kim",
    heroTitle: "System Health Overview",
    heroBody: "The real-time monitoring system is operational. Valid feeds are arriving from 98% of emission sources and ESG compliance risk remains in a low state.",
    pageStatusMessage: "The reference ESG dashboard was rebuilt in the current React home structure, and `/monitoring/esg` now resolves to the same page.",
    filterLabel: "Report scope",
    filterOptions: [
      { key: "half", label: "2025 H1 report" },
      { key: "annual", label: "2025 annual report" },
      { key: "investor", label: "Board brief" }
    ],
    exportLabel: "Export data",
    kpiTitle: "Core KPI Dashboards",
    kpiBody: "Review site performance and reduction target progress in one board.",
    trendTitle: "Trend Analysis Report",
    trendBody: "Past 12-month emissions trend and next-month forecast",
    trendAction: "Detailed view",
    trendCaption: "If the trend stays within the baseline corridor, the current strategy scenario remains effective.",
    trendRecommendation: "An energy-saving scenario is recommended before summer utilization rises.",
    trendRecommendationAction: "Open recommendation",
    currentTag: "CUR: 2.3k",
    forecastTag: "FCST",
    complianceTitle: "ESG Compliance Summary",
    complianceBody: "Review global disclosure alignment and certification progress together.",
    complianceBadge: "COMPLIANT",
    complianceAction: "Open ESG report center",
    publishingTitle: "Publishing Flow",
    publishingBody: "The executive summary intent from the reference is preserved, with the current app organizing review, packaging, and stakeholder sharing in the same board.",
    publishingSteps: [
      { key: "review", label: "01", title: "Executive review", body: "Reorder KPI movement, at-risk facilities, and regulatory exposure for leadership review." },
      { key: "package", label: "02", title: "Disclosure package", body: "Finalize narrative blocks, charts, and evidence attachments into one report bundle." },
      { key: "share", label: "03", title: "Stakeholder share", body: "Split delivery between audit response, investor brief, and internal operations package." }
    ],
    publishingSummaryLabel: "Scheduled this week",
    publishingSummaryValue: "3 Reports",
    insightsTitle: "Detailed Sectional Insights",
    insightsBody: "Site-level detail, historical comparison, and emissions reporting are linked to the current app follow-up screens.",
    footerOrg: "CCUS Strategic Oversight Center",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul 04551 | Support: +82-2-1234-5678",
    footerServiceLine: "This platform supports executive decisions with real-time analytics.",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Strategic Oversight Hub.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility mark",
    heroMetrics: [
      { label: "Data reliability", value: "99.4%" },
      { label: "Certification progress", value: "82.5%", accentClassName: "text-indigo-300" }
    ],
    heroActions: [
      { key: "trend", icon: "analytics", title: "Trend Analysis", body: "Emission trajectory and forecasts", href: "/monitoring/reduction_trend", featured: true },
      { key: "report", icon: "article", title: "ESG Disclosure", body: "2025 H1 integrated report", href: "/monitoring/statistics" },
      { key: "policy", icon: "policy", title: "Compliance Status", body: "Global regulatory alignment", href: "/monitoring/alerts" }
    ],
    kpis: [
      {
        key: "emissions",
        label: "TOTAL EMISSIONS",
        value: "45,120",
        unit: "tCO2e",
        status: "▼ 4.2%",
        statusClassName: "text-emerald-600",
        accentClassName: "border-t-indigo-500",
        note: "Down versus last year",
        sparkline: "M0 15 Q 10 10, 20 12 T 40 8 T 60 10 T 80 5 T 100 7"
      },
      {
        key: "reduction",
        label: "REDUCTION TARGET",
        value: "14,880",
        unit: "Left to Goal",
        status: "75% Achieved",
        statusClassName: "text-slate-500",
        accentClassName: "border-t-emerald-500",
        note: "Staying within the target path",
        progress: "75%"
      },
      {
        key: "efficiency",
        label: "ENERGY EFFICIENCY",
        value: "0.42",
        unit: "intensity",
        status: "Improving",
        statusClassName: "text-amber-600",
        accentClassName: "border-t-amber-500",
        note: "Process efficiency is improving",
        bars: [45, 55, 78, 92]
      },
      {
        key: "compliance",
        label: "COMPLIANCE STATUS",
        value: "AA+",
        status: "Very Good",
        statusClassName: "text-blue-600",
        accentClassName: "border-t-blue-600",
        note: "No regulatory issues found",
        badge: "TOP 5%"
      }
    ],
    trendBars: [
      { month: "Jan", height: "60%", value: "3.2k" },
      { month: "Feb", height: "65%", value: "3.4k" },
      { month: "Mar", height: "55%", value: "2.9k" },
      { month: "Apr", height: "75%", value: "3.8k" },
      { month: "May", height: "45%", value: "2.3k", active: true },
      { month: "Jun", height: "40%", value: "2.6k", forecast: true }
    ],
    frameworkMetrics: [
      { label: "GRI Standards", icon: "task_alt", value: "100%", progress: "100%", toneClassName: "bg-blue-600" },
      { label: "TCFD Alignment", icon: "task_alt", value: "92%", progress: "92%", toneClassName: "bg-emerald-500" }
    ],
    certificationRows: [
      { title: "ISO 14064-1 Verification", status: "Step 3/4", progress: "75%", toneClassName: "bg-indigo-500" },
      { title: "RE100 Roadmap Approval", status: "In Review", progress: "50%", toneClassName: "bg-amber-400" }
    ],
    insights: [
      {
        key: "site",
        icon: "factory",
        title: "Site-level detail",
        subtitle: "Full analysis across 18 emission sites",
        statA: "Pohang Mill 1: Excellent",
        statB: "Ulsan Chemical 3: Warning",
        toneClassName: "text-indigo-600",
        actionLabel: "Open monitoring sheet",
        href: "/monitoring/dashboard"
      },
      {
        key: "history",
        icon: "history_edu",
        title: "Historical comparison",
        subtitle: "Year-over-year and target comparison report",
        statA: "Versus last year: -12.5%",
        statB: "5-year trend: Stable",
        toneClassName: "text-blue-600",
        actionLabel: "Generate comparison report",
        href: "/monitoring/reduction_trend"
      },
      {
        key: "report",
        icon: "description",
        title: "Emissions calculation report",
        subtitle: "Data validity and calculation basis",
        statA: "Tier 3 coverage: 85%",
        statB: "Verified items: 14 cases",
        toneClassName: "text-slate-700",
        actionLabel: "Open evidence list",
        href: "/emission/validate"
      }
    ]
  }
};

export function MonitoringStatisticsMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [reportFilter, setReportFilter] = useState<ReportFilterKey>("half");

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-statistics", {
      language: en ? "en" : "ko",
      userType: session.value?.authorCode || "guest",
      reportFilter
    });
  }, [en, reportFilter, session.value?.authorCode]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-3 focus:py-2 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>
                query_stats
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">Strategic Hub</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.pageSubtitle}</p>
              </div>
            </div>
            <nav className="mt-5 hidden flex-wrap items-center gap-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`h-10 border-b-[3px] px-4 text-[15px] font-bold transition ${
                    item.active
                      ? "border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]"
                      : "border-transparent text-slate-500 hover:text-[var(--kr-gov-blue)]"
                  }`}
                  key={item.href}
                  onClick={() => navigate(buildLocalizedPath(item.href, `/en${item.href}`))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/monitoring/statistics")} onKo={() => navigate("/monitoring/statistics")} />
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-slate-500">{content.roleLabel}</p>
              <p className="text-sm font-black text-slate-900">{content.roleName}</p>
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <span className="material-symbols-outlined text-slate-600">notifications</span>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </div>
            <MemberButton className="!bg-slate-900 !px-4 !py-2.5 !text-sm !text-white hover:!bg-black">
              {en ? "Sign out" : "로그아웃"}
            </MemberButton>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="overflow-hidden bg-slate-900 py-10 text-white" data-help-id="monitoring-statistics-hero">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-6 max-w-3xl">
              <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.45fr]">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="flex items-center gap-2 text-2xl font-black">
                  <span className="material-symbols-outlined text-indigo-400">monitoring</span>
                  {content.heroTitle}
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">{content.heroBody}</p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {content.heroMetrics.map((metric) => (
                    <div className="rounded-xl border border-white/10 bg-white/10 p-4" key={metric.label}>
                      <p className="text-xs text-slate-400">{metric.label}</p>
                      <p className={`mt-2 text-2xl font-black text-white ${metric.accentClassName || ""}`}>{metric.value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <div className="grid gap-4 md:grid-cols-3">
                {content.heroActions.map((action) => (
                  <button
                    className={`group flex min-h-[172px] flex-col justify-between rounded-2xl border p-6 text-left transition ${
                      action.featured
                        ? "border-indigo-500 bg-indigo-600 hover:bg-indigo-500"
                        : "border-white/5 bg-slate-800 hover:bg-slate-700"
                    }`}
                    key={action.key}
                    onClick={() => navigate(buildLocalizedPath(action.href, `/en${action.href}`))}
                    type="button"
                  >
                    <div>
                      <span className="material-symbols-outlined mb-3">{action.icon}</span>
                      <h3 className="text-lg font-black">{action.title}</h3>
                      <p className={`mt-2 text-xs ${action.featured ? "text-indigo-100" : "text-slate-400"}`}>{action.body}</p>
                    </div>
                    <span className="material-symbols-outlined self-end opacity-0 transition group-hover:opacity-100">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-10 lg:px-8" data-help-id="monitoring-statistics-filters">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">{content.kpiTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{content.kpiBody}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-[220px]">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" htmlFor="monitoring-statistics-filter">
                  {content.filterLabel}
                </label>
                <AdminSelect id="monitoring-statistics-filter" value={reportFilter} onChange={(event) => setReportFilter(event.target.value as ReportFilterKey)}>
                  {content.filterOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="flex items-end">
                <MemberButton className="!gap-2 !bg-[var(--kr-gov-blue)] !px-4 !py-3 !text-white hover:!bg-[#002d72]">
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  {content.exportLabel}
                </MemberButton>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {content.kpis.map((kpi) => (
              <article className={`rounded-2xl border border-gray-100 border-t-4 ${kpi.accentClassName} bg-white p-6 shadow-sm`} key={kpi.key}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{kpi.label}</p>
                  <span className={`text-xs font-bold ${kpi.statusClassName}`}>{kpi.status}</span>
                </div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900">{kpi.value}</span>
                  {kpi.unit ? <span className="text-sm font-bold text-slate-400">{kpi.unit}</span> : null}
                  {kpi.badge ? <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{kpi.badge}</span> : null}
                </div>
                {kpi.sparkline ? (
                  <svg className="h-12 w-full" viewBox="0 0 100 20">
                    <path d={kpi.sparkline} fill="none" stroke="#6366f1" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                ) : null}
                {kpi.progress ? (
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: kpi.progress }} />
                  </div>
                ) : null}
                {kpi.bars ? (
                  <div className="flex h-10 items-end gap-1">
                    {kpi.bars.map((bar, index) => (
                      <div
                        className={`w-3 rounded-t-sm ${index < 2 ? "bg-amber-200" : index === 2 ? "bg-amber-400" : "bg-amber-500"}`}
                        key={`${kpi.key}-${bar}`}
                        style={{ height: `${bar}%` }}
                      />
                    ))}
                  </div>
                ) : null}
                {!kpi.sparkline && !kpi.progress && !kpi.bars ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">verified_user</span>
                    <span className="text-xs font-bold text-slate-500">{kpi.note}</span>
                  </div>
                ) : (
                  <p className="mt-4 text-xs font-bold text-slate-500">{kpi.note}</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-10 lg:grid-cols-2 lg:px-8">
          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" data-help-id="monitoring-statistics-analysis">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">{content.trendTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{content.trendBody}</p>
              </div>
              <button
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                onClick={() => navigate(buildLocalizedPath("/monitoring/reduction_trend", "/en/monitoring/reduction_trend"))}
                type="button"
              >
                {content.trendAction}
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </button>
            </div>
            <div className="p-8">
              <div className="relative flex h-[280px] items-end gap-4">
                <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200" />
                <div className="absolute bottom-0 left-0 top-0 w-px bg-slate-200" />
                {content.trendBars.map((bar) => (
                  <div className="flex flex-1 flex-col items-center gap-2" key={bar.month}>
                    <div
                      className={`group relative w-full rounded-t ${
                        bar.active ? "bg-indigo-600" : bar.forecast ? "border-2 border-dashed border-indigo-200 bg-transparent" : "bg-slate-100 hover:bg-indigo-400"
                      }`}
                      style={{ height: bar.height }}
                    >
                      <span
                        className={`absolute -top-7 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] font-bold ${
                          bar.active
                            ? "bg-slate-800 text-white"
                            : bar.forecast
                              ? "text-indigo-300"
                              : "text-slate-400 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {bar.active ? content.currentTag : bar.forecast ? content.forecastTag : bar.value}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold ${bar.active ? "text-indigo-600" : bar.forecast ? "text-slate-300" : "text-slate-400"}`}>{bar.month}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t border-gray-100 pt-6">
                <p className="text-sm font-medium text-slate-500">{content.trendRecommendation}</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="max-w-[440px] text-xs leading-6 text-slate-500">{content.trendCaption}</p>
                  <button
                    className="text-xs font-bold text-[var(--kr-gov-blue)] underline"
                    onClick={() => navigate(buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"))}
                    type="button"
                  >
                    {content.trendRecommendationAction}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" data-help-id="monitoring-statistics-contributions">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">{content.complianceTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{content.complianceBody}</p>
              </div>
              <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{content.complianceBadge}</span>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {content.frameworkMetrics.map((metric) => (
                  <div className="rounded-xl bg-slate-50 p-4" key={metric.label}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-slate-600">{metric.icon}</span>
                      <span className="text-xs font-bold text-slate-600">{metric.label}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">{metric.value}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className={`h-full ${metric.toneClassName}`} style={{ width: metric.progress }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{en ? "Ongoing certifications" : "진행 중 인증"}</h4>
                {content.certificationRows.map((row) => (
                  <div className="rounded-xl border border-gray-100 p-4" key={row.title}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-800">{row.title}</span>
                      <span className="text-[10px] font-bold text-slate-500">{row.status}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className={`h-full ${row.toneClassName}`} style={{ width: row.progress }} />
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black" type="button">
                {content.complianceAction}
              </button>
            </div>
          </article>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 pb-10 lg:px-8">
          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h3 className="text-lg font-black text-slate-900">{content.publishingTitle}</h3>
                <p className="mt-1 text-sm text-slate-500">{content.publishingBody}</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {content.publishingSteps.map((step) => (
                    <div className="rounded-2xl border border-gray-100 bg-slate-50 p-5" key={step.key}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">{step.label}</p>
                      <h4 className="mt-3 text-base font-black text-slate-900">{step.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{step.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{content.publishingSummaryLabel}</p>
                <p className="mt-3 text-4xl font-black">{content.publishingSummaryValue}</p>
                <div className="mt-6 space-y-3 text-sm text-slate-300">
                  <p>{en ? "Audit response pack: ready" : "감사 대응본: 준비 완료"}</p>
                  <p>{en ? "Investor brief: waiting for sign-off" : "투자자 브리프: 결재 대기"}</p>
                  <p>{en ? "Operations appendix: evidence sync complete" : "운영 부록: 증빙 동기화 완료"}</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="border-t border-gray-100 bg-white py-14" data-help-id="monitoring-statistics-insights">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900">{content.insightsTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{content.insightsBody}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {content.insights.map((card) => (
                <article className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md" key={card.key}>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 transition group-hover:bg-slate-900">
                    <span className={`material-symbols-outlined transition group-hover:text-white ${card.toneClassName}`}>{card.icon}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{card.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{card.subtitle}</p>
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">{card.statA.split(":")[0]}</span>
                      <span className={`font-bold ${card.toneClassName}`}>{card.statA.split(": ").slice(1).join(": ")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">{card.statB.split(":")[0]}</span>
                      <span className={`font-bold ${card.toneClassName}`}>{card.statB.split(": ").slice(1).join(": ")}</span>
                    </div>
                  </div>
                  <button
                    className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[var(--kr-gov-blue)] hover:underline"
                    onClick={() => navigate(buildLocalizedPath(card.href, `/en${card.href}`))}
                    type="button"
                  >
                    {card.actionLabel}
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={content.footerAddress}
        copyright={content.footerCopyright}
        lastModifiedLabel={content.footerLastModified}
        orgName={content.footerOrg}
        serviceLine={content.footerServiceLine}
        waAlt={content.footerWaAlt}
      />
    </div>
  );
}
