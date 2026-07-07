import { useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type ReportTypeKey = "overview" | "board" | "verification";
type ExportFormatKey = "pdf" | "ppt" | "xlsx";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type QueueItem = {
  key: string;
  badge: string;
  badgeClassName: string;
  due: string;
  title: string;
  body: string;
  actionLabel: string;
  href: string;
  icon: string;
};

type MetricCard = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  status: string;
  statusClassName: string;
  accentClassName: string;
};

type ProcessRow = {
  label: string;
  value: string;
  toneClassName: string;
};

type SiteCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  title: string;
  subtitle: string;
  metricLabel: string;
  metricValue: string;
  metricUnit: string;
  delta: string;
  deltaClassName: string;
  insightA: string;
  insightB: string;
  primaryAction: string;
  primaryHref: string;
  secondaryAction?: string;
  secondaryHref?: string;
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
  heroLabel: string;
  heroBody: string;
  heroButton: string;
  queueTitle: string;
  queueStatus: string;
  pageStatusMessage: string;
  exportPanelTitle: string;
  exportPanelBody: string;
  reportTypeLabel: string;
  periodLabel: string;
  formatLabel: string;
  periodValue: string;
  readyMessage: string;
  primaryExportLabel: string;
  secondaryExportLabel: string;
  trendTitle: string;
  trendBody: string;
  trendCaption: string;
  trendAction: string;
  mixTitle: string;
  mixBody: string;
  mixInsight: string;
  sitesTitle: string;
  sitesBody: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  reportTypeOptions: Array<{ key: ReportTypeKey; label: string }>;
  formatOptions: Array<{ key: ExportFormatKey; label: string }>;
  queueItems: QueueItem[];
  metrics: MetricCard[];
  trendBars: Array<{ month: string; height: string; accent?: boolean; value: string }>;
  processRows: ProcessRow[];
  siteCards: SiteCard[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "분석 리포트 내보내기",
    pageSubtitle: "EXECUTIVE EXPORT WORKSPACE",
    governmentText: "대한민국 정부 공식 서비스 | 모니터링 분석 리포트 내보내기 센터",
    governmentStatus: "마지막 데이터 동기화: 2026.04.02 14:30",
    navItems: [
      { label: "종합 현황", href: "/monitoring/dashboard" },
      { label: "성과 추이", href: "/monitoring/reduction_trend" },
      { label: "ESG 보고서", href: "/monitoring/statistics" },
      { label: "리포트 내보내기", href: "/monitoring/export", active: true }
    ],
    roleLabel: "총괄 책임자",
    roleName: "이현장 관리자",
    heroTitle: "업데이트 비서",
    heroLabel: "Intelligent Assistant",
    heroBody:
      "reference 화면의 브리핑 히어로, 우선순위 액션 큐, 월별 추이, 사업장 상태 보드를 현재 Carbonet 홈 포털 패턴으로 재구성했습니다. 선택한 분석 리포트를 PDF, 발표용 브리프, 데이터 패키지로 바로 내보낼 수 있습니다.",
    heroButton: "전체 워크플로우 관리",
    queueTitle: "Your Update Queue",
    queueStatus: "실시간 분석 중",
    pageStatusMessage: "reference export 화면을 현재 React 마이그레이션 앱 구조와 공통 입력 컴포넌트 기준으로 변환했습니다.",
    exportPanelTitle: "보고서 내보내기 설정",
    exportPanelBody: "보고 범위와 산출 형식을 선택하면 경영진 공유용 산출물을 즉시 준비합니다.",
    reportTypeLabel: "리포트 유형",
    periodLabel: "기준 기간",
    formatLabel: "내보내기 형식",
    periodValue: "2026년 1분기",
    readyMessage: "배출량, 검증률, 사업장 상태 카드가 최신 스냅샷 기준으로 준비되었습니다.",
    primaryExportLabel: "PDF 내보내기",
    secondaryExportLabel: "발표 브리프 생성",
    trendTitle: "월별 배출 트렌드 분석",
    trendBody: "연간 감축 목표 대비 현재 추이를 시각화한 핵심 차트",
    trendCaption: "현재 추세는 6월 이후 안정화 구간에 진입했고, 7월 이후 값은 내보내기 시 예측치로 함께 표기됩니다.",
    trendAction: "원본 대시보드 열기",
    mixTitle: "공정별 배출 비중",
    mixBody: "리포트 본문에 포함될 핵심 공정 부하 분포",
    mixInsight: "고정 연소 비중이 전월 대비 5% 상승했습니다. 울산 제3 화학기지의 효율 최적화를 권장합니다.",
    sitesTitle: "핵심 관리 배출지 실시간 현황",
    sitesBody: "내보내기 리포트에 포함될 우선 관리 사업장 상태 카드입니다.",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "분석 리포트 지원팀 02-1234-5678",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Executive Export Workspace.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    reportTypeOptions: [
      { key: "overview", label: "경영진 종합 브리핑" },
      { key: "board", label: "이사회 보고용 패키지" },
      { key: "verification", label: "검증 부속 리포트" }
    ],
    formatOptions: [
      { key: "pdf", label: "PDF 보고서" },
      { key: "ppt", label: "발표 요약본" },
      { key: "xlsx", label: "데이터 패키지" }
    ],
    queueItems: [
      {
        key: "ulsan",
        badge: "CRITICAL",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "D-2",
        title: "울산 제3: 서류 보완",
        body: "배출계수 재산정 증빙 서류 누락이 탐지되어 보고서 부록 보완이 필요합니다.",
        actionLabel: "즉시 업데이트",
        href: "/monitoring/track",
        icon: "bolt"
      },
      {
        key: "pohang",
        badge: "REQUIRED",
        badgeClassName: "bg-amber-500/20 text-amber-300",
        due: "D-5",
        title: "포항 제1: 에너지 대조",
        body: "8월분 전력 사용량 확정 요청이 남아 있어 추정치 확정이 필요합니다.",
        actionLabel: "데이터 입력",
        href: "/monitoring/realtime",
        icon: "open_in_new"
      },
      {
        key: "gwangyang",
        badge: "VERIFY",
        badgeClassName: "bg-blue-500/20 text-blue-300",
        due: "D-12",
        title: "광양 제2: 품질 체크",
        body: "검증 전 체크리스트가 85% 완료되어 남은 항목 점검이 필요합니다.",
        actionLabel: "리스트 확인",
        href: "/monitoring/statistics",
        icon: "fact_check"
      },
      {
        key: "trend",
        badge: "INSIGHT",
        badgeClassName: "bg-emerald-500/20 text-emerald-300",
        due: "NOW",
        title: "배출 목표 트렌드",
        body: "연간 목표 대비 초과 위험이 감지되어 리포트 주석 반영이 필요합니다.",
        actionLabel: "분석 리포트",
        href: "/monitoring/reduction_trend",
        icon: "trending_up"
      }
    ],
    metrics: [
      {
        key: "footprint",
        label: "TOTAL CARBON FOOTPRINT",
        value: "45,120",
        unit: "tCO2e",
        status: "전년 대비 4.2% 감소",
        statusClassName: "text-emerald-600",
        accentClassName: "border-emerald-500"
      },
      {
        key: "intensity",
        label: "ENERGY INTENSITY",
        value: "0.84",
        unit: "kWh/KRW",
        status: "Optimal Range",
        statusClassName: "text-blue-600",
        accentClassName: "border-blue-500"
      },
      {
        key: "verification",
        label: "VERIFICATION STATUS",
        value: "80",
        unit: "% Completion",
        status: "검증 부속 문서 포함 가능",
        statusClassName: "text-slate-500",
        accentClassName: "border-[var(--kr-gov-blue)]"
      },
      {
        key: "sites",
        label: "ACTIVE MONITORING SITES",
        value: "18",
        unit: "Facilities",
        status: "핵심 감시 사업장 중심",
        statusClassName: "text-indigo-200",
        accentClassName: "border-slate-700"
      }
    ],
    trendBars: [
      { month: "Jan", height: "60%", value: "3.2k" },
      { month: "Feb", height: "75%", value: "3.8k" },
      { month: "Mar", height: "45%", value: "2.4k" },
      { month: "Apr", height: "90%", value: "4.5k" },
      { month: "May", height: "55%", value: "2.8k", accent: true },
      { month: "Jun", height: "80%", value: "4.0k" },
      { month: "Jul", height: "65%", value: "3.4k" },
      { month: "Aug", height: "50%", value: "2.6k" }
    ],
    processRows: [
      { label: "고정 연소", value: "42%", toneClassName: "bg-[var(--kr-gov-blue)]" },
      { label: "간접 배출", value: "31%", toneClassName: "bg-blue-500" },
      { label: "탈루 배출", value: "18%", toneClassName: "bg-emerald-500" },
      { label: "이동 연소", value: "9%", toneClassName: "bg-slate-300" }
    ],
    siteCards: [
      {
        key: "pohang",
        badge: "Stable",
        badgeClassName: "bg-emerald-100 text-emerald-700",
        title: "포항 제1 열연공장",
        subtitle: "ID: PH-001 | 핵심 제조 시설",
        metricLabel: "Current Emission",
        metricValue: "2,341",
        metricUnit: "tCO2",
        delta: "▼ 1.5%",
        deltaClassName: "text-emerald-600",
        insightA: "Efficiency 98.2%",
        insightB: "Target Within Range",
        primaryAction: "사업장 상세 보기",
        primaryHref: "/monitoring/realtime",
        secondaryAction: "대시보드 열기",
        secondaryHref: "/monitoring/dashboard"
      },
      {
        key: "ulsan",
        badge: "Critical Update",
        badgeClassName: "bg-red-100 text-red-700",
        title: "울산 제3 화학기지",
        subtitle: "ID: US-042 | 누락 데이터 탐지",
        metricLabel: "Current Emission",
        metricValue: "4,812",
        metricUnit: "tCO2",
        delta: "▲ 12.4%",
        deltaClassName: "text-red-600",
        insightA: "증빙 부록 보완 필요",
        insightB: "리포트 주석 자동 삽입 대상",
        primaryAction: "서류 보완 및 즉시 처리",
        primaryHref: "/monitoring/track"
      },
      {
        key: "gwangyang",
        badge: "Verifying",
        badgeClassName: "bg-blue-100 text-blue-700",
        title: "광양 제2 에너지센터",
        subtitle: "ID: GN-112 | 연간 검증 단계",
        metricLabel: "Total Verified",
        metricValue: "12,890",
        metricUnit: "tCO2",
        delta: "85% 완료",
        deltaClassName: "text-blue-600",
        insightA: "검증 현황 포함",
        insightB: "보고서 출력 준비",
        primaryAction: "검증 현황",
        primaryHref: "/monitoring/statistics",
        secondaryAction: "보고서 출력",
        secondaryHref: "/monitoring/export"
      }
    ]
  },
  en: {
    pageTitle: "Monitoring Report Export",
    pageSubtitle: "EXECUTIVE EXPORT WORKSPACE",
    governmentText: "Official Republic of Korea Government Service | Monitoring report export center",
    governmentStatus: "Last data sync: 2026.04.02 14:30",
    navItems: [
      { label: "Overview", href: "/monitoring/dashboard" },
      { label: "Trends", href: "/monitoring/reduction_trend" },
      { label: "ESG Report", href: "/monitoring/statistics" },
      { label: "Export", href: "/monitoring/export", active: true }
    ],
    roleLabel: "Executive Owner",
    roleName: "Operations Lead Lee",
    heroTitle: "Update Assistant",
    heroLabel: "Intelligent Assistant",
    heroBody:
      "The reference export screen has been rebuilt in the current Carbonet home portal pattern while preserving its briefing hero, priority queue, monthly trend panel, and site status board. You can export the selected monitoring report as a PDF, briefing deck, or data package.",
    heroButton: "Manage full workflow",
    queueTitle: "Your Update Queue",
    queueStatus: "Live analysis running",
    pageStatusMessage: "The reference export screen was ported into the React migration structure with shared Carbonet controls.",
    exportPanelTitle: "Report export setup",
    exportPanelBody: "Choose the reporting scope and output format to prepare leadership-ready deliverables.",
    reportTypeLabel: "Report type",
    periodLabel: "Reporting period",
    formatLabel: "Export format",
    periodValue: "Q1 2026",
    readyMessage: "Emission totals, verification rate, and monitored site cards are ready from the latest snapshot.",
    primaryExportLabel: "Export PDF",
    secondaryExportLabel: "Generate briefing deck",
    trendTitle: "Monthly emission trend analysis",
    trendBody: "Primary chart against the annual reduction target",
    trendCaption: "The current trend entered a stable zone after June, and July onward values will be marked as forecasted in the export package.",
    trendAction: "Open source dashboard",
    mixTitle: "Process emission mix",
    mixBody: "Core process burden distribution included in the report body",
    mixInsight: "Stationary combustion increased by 5% month over month. Ulsan Plant 3 should be prioritized for efficiency optimization.",
    sitesTitle: "Key monitored site status",
    sitesBody: "Priority site cards that will be included in the export package.",
    footerOrg: "CCUS Integrated Management Office",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul 04551",
    footerServiceLine: "Reporting support desk +82-2-1234-5678",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Executive Export Workspace.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility mark",
    reportTypeOptions: [
      { key: "overview", label: "Executive overview" },
      { key: "board", label: "Board package" },
      { key: "verification", label: "Verification appendix" }
    ],
    formatOptions: [
      { key: "pdf", label: "PDF report" },
      { key: "ppt", label: "Briefing deck" },
      { key: "xlsx", label: "Data package" }
    ],
    queueItems: [
      {
        key: "ulsan",
        badge: "CRITICAL",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "D-2",
        title: "Ulsan Plant 3: document supplement",
        body: "The recalculation evidence package is incomplete and must be fixed before export.",
        actionLabel: "Update now",
        href: "/monitoring/track",
        icon: "bolt"
      },
      {
        key: "pohang",
        badge: "REQUIRED",
        badgeClassName: "bg-amber-500/20 text-amber-300",
        due: "D-5",
        title: "Pohang Plant 1: energy reconciliation",
        body: "August power usage confirmation is still pending and blocks finalization.",
        actionLabel: "Enter data",
        href: "/monitoring/realtime",
        icon: "open_in_new"
      },
      {
        key: "gwangyang",
        badge: "VERIFY",
        badgeClassName: "bg-blue-500/20 text-blue-300",
        due: "D-12",
        title: "Gwangyang Plant 2: quality check",
        body: "The pre-verification checklist is 85% complete and needs final review.",
        actionLabel: "Review checklist",
        href: "/monitoring/statistics",
        icon: "fact_check"
      },
      {
        key: "trend",
        badge: "INSIGHT",
        badgeClassName: "bg-emerald-500/20 text-emerald-300",
        due: "NOW",
        title: "Target trend risk",
        body: "A variance against the annual target was detected and should be reflected in annotations.",
        actionLabel: "Open trend report",
        href: "/monitoring/reduction_trend",
        icon: "trending_up"
      }
    ],
    metrics: [
      {
        key: "footprint",
        label: "TOTAL CARBON FOOTPRINT",
        value: "45,120",
        unit: "tCO2e",
        status: "4.2% lower than last year",
        statusClassName: "text-emerald-600",
        accentClassName: "border-emerald-500"
      },
      {
        key: "intensity",
        label: "ENERGY INTENSITY",
        value: "0.84",
        unit: "kWh/KRW",
        status: "Optimal Range",
        statusClassName: "text-blue-600",
        accentClassName: "border-blue-500"
      },
      {
        key: "verification",
        label: "VERIFICATION STATUS",
        value: "80",
        unit: "% Completion",
        status: "Appendix ready for export",
        statusClassName: "text-slate-500",
        accentClassName: "border-[var(--kr-gov-blue)]"
      },
      {
        key: "sites",
        label: "ACTIVE MONITORING SITES",
        value: "18",
        unit: "Facilities",
        status: "Priority watchlist focused",
        statusClassName: "text-indigo-200",
        accentClassName: "border-slate-700"
      }
    ],
    trendBars: [
      { month: "Jan", height: "60%", value: "3.2k" },
      { month: "Feb", height: "75%", value: "3.8k" },
      { month: "Mar", height: "45%", value: "2.4k" },
      { month: "Apr", height: "90%", value: "4.5k" },
      { month: "May", height: "55%", value: "2.8k", accent: true },
      { month: "Jun", height: "80%", value: "4.0k" },
      { month: "Jul", height: "65%", value: "3.4k" },
      { month: "Aug", height: "50%", value: "2.6k" }
    ],
    processRows: [
      { label: "Stationary combustion", value: "42%", toneClassName: "bg-[var(--kr-gov-blue)]" },
      { label: "Indirect electricity use", value: "31%", toneClassName: "bg-blue-500" },
      { label: "Fugitive emissions", value: "18%", toneClassName: "bg-emerald-500" },
      { label: "Mobile combustion", value: "9%", toneClassName: "bg-slate-300" }
    ],
    siteCards: [
      {
        key: "pohang",
        badge: "Stable",
        badgeClassName: "bg-emerald-100 text-emerald-700",
        title: "Pohang Hot Strip Mill 1",
        subtitle: "ID: PH-001 | Core manufacturing facility",
        metricLabel: "Current Emission",
        metricValue: "2,341",
        metricUnit: "tCO2",
        delta: "▼ 1.5%",
        deltaClassName: "text-emerald-600",
        insightA: "Efficiency 98.2%",
        insightB: "Target within range",
        primaryAction: "Open site detail",
        primaryHref: "/monitoring/realtime",
        secondaryAction: "Open dashboard",
        secondaryHref: "/monitoring/dashboard"
      },
      {
        key: "ulsan",
        badge: "Critical Update",
        badgeClassName: "bg-red-100 text-red-700",
        title: "Ulsan Chemical Base 3",
        subtitle: "ID: US-042 | Missing data detected",
        metricLabel: "Current Emission",
        metricValue: "4,812",
        metricUnit: "tCO2",
        delta: "▲ 12.4%",
        deltaClassName: "text-red-600",
        insightA: "Appendix evidence required",
        insightB: "Auto report note pending",
        primaryAction: "Fix documents now",
        primaryHref: "/monitoring/track"
      },
      {
        key: "gwangyang",
        badge: "Verifying",
        badgeClassName: "bg-blue-100 text-blue-700",
        title: "Gwangyang Energy Center 2",
        subtitle: "ID: GN-112 | Annual verification phase",
        metricLabel: "Total Verified",
        metricValue: "12,890",
        metricUnit: "tCO2",
        delta: "85% complete",
        deltaClassName: "text-blue-600",
        insightA: "Verification summary included",
        insightB: "Ready for report output",
        primaryAction: "Open verification",
        primaryHref: "/monitoring/statistics",
        secondaryAction: "Report output",
        secondaryHref: "/monitoring/export"
      }
    ]
  }
};

export function MonitoringExportMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [reportType, setReportType] = useState<ReportTypeKey>("overview");
  const [format, setFormat] = useState<ExportFormatKey>("pdf");

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-export", {
      language: en ? "en" : "ko",
      userType: session.value?.authorCode || "guest",
      reportType,
      format
    });
  }, [en, format, reportType, session.value?.authorCode]);

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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--kr-gov-blue)] text-white">
                <span className="material-symbols-outlined text-[24px]">file_export</span>
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">{content.pageTitle}</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.pageSubtitle}</p>
              </div>
            </div>
            <nav className="mt-5 hidden flex-wrap items-center gap-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    item.active ? "bg-slate-100 text-[var(--kr-gov-blue)]" : "text-slate-500 hover:bg-slate-50 hover:text-[var(--kr-gov-blue)]"
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
            <UserLanguageToggle en={en} onKo={() => navigate("/monitoring/export")} onEn={() => navigate("/en/monitoring/export")} />
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-slate-500">{content.roleLabel}</p>
              <p className="text-sm font-black text-slate-900">{content.roleName}</p>
            </div>
            <MemberButton className="!bg-slate-900 !px-4 !py-2.5 !text-sm !text-white hover:!bg-black">{en ? "Log out" : "로그아웃"}</MemberButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8" id="main-content">
        <section className="overflow-hidden rounded-[28px] bg-slate-900 px-6 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] lg:px-8" data-help-id="monitoring-export-hero">
          <div className="mb-6 max-w-3xl">
            <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>
          </div>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/80 shadow-lg shadow-indigo-500/20">
                  <span className="material-symbols-outlined text-[26px]">auto_awesome</span>
                </span>
                <div>
                  <h2 className="text-xl font-black">{content.heroTitle}</h2>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300">{content.heroLabel}</p>
                </div>
              </div>
              <p className="text-sm leading-7 text-slate-300">{content.heroBody}</p>
              <button
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold transition hover:bg-white/15"
                onClick={() => navigate(buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"))}
                type="button"
              >
                {content.heroButton}
                <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
              </button>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">{content.queueTitle}</h3>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300">{content.queueStatus}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {content.queueItems.map((item) => (
                  <button
                    className="group rounded-[22px] border border-white/10 bg-white/5 p-5 text-left transition hover:bg-white/10"
                    key={item.key}
                    onClick={() => navigate(buildLocalizedPath(item.href, `/en${item.href}`))}
                    type="button"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className={`rounded px-2 py-1 text-[10px] font-black ${item.badgeClassName}`}>{item.badge}</span>
                      <span className="text-[10px] font-bold text-slate-500">{item.due}</span>
                    </div>
                    <h4 className="text-sm font-black leading-5">{item.title}</h4>
                    <p className="mt-2 min-h-[54px] text-[12px] leading-5 text-slate-400">{item.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-black text-sky-300 transition group-hover:gap-2">
                      {item.actionLabel}
                      <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                    </span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]" data-help-id="monitoring-export-controls">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" data-help-id="monitoring-export-summary-cards">
            {content.metrics.map((metric) => (
              <article
                className={`rounded-3xl border border-gray-200 border-t-4 ${metric.accentClassName} bg-white p-6 shadow-sm ${metric.key === "sites" ? "bg-slate-900 text-white" : ""}`}
                key={metric.key}
              >
                <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${metric.key === "sites" ? "text-slate-500" : "text-slate-400"}`}>{metric.label}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className={`text-4xl font-black tracking-tight ${metric.key === "sites" ? "text-white" : "text-slate-900"}`}>{metric.value}</span>
                  {metric.unit ? <span className="text-sm font-bold text-slate-400">{metric.unit}</span> : null}
                </div>
                <p className={`mt-5 text-xs font-bold ${metric.statusClassName}`}>{metric.status}</p>
              </article>
            ))}
          </div>

          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900">{content.exportPanelTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{content.exportPanelBody}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" htmlFor="monitoring-export-type">
                  {content.reportTypeLabel}
                </label>
                <AdminSelect id="monitoring-export-type" value={reportType} onChange={(event) => setReportType(event.target.value as ReportTypeKey)}>
                  {content.reportTypeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" htmlFor="monitoring-export-period">
                  {content.periodLabel}
                </label>
                <div className="flex h-[50px] items-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 text-sm font-bold text-slate-700">
                  {content.periodValue}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" htmlFor="monitoring-export-format">
                  {content.formatLabel}
                </label>
                <AdminSelect id="monitoring-export-format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormatKey)}>
                  {content.formatOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">{content.readyMessage}</div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <MemberButton className="!justify-center !gap-2 !bg-[var(--kr-gov-blue)] !px-4 !py-3 !text-white hover:!bg-[#002d72]">
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                {content.primaryExportLabel}
              </MemberButton>
              <MemberButton className="!justify-center !gap-2 !border !border-slate-200 !bg-white !px-4 !py-3 !text-slate-700 hover:!bg-slate-50">
                <span className="material-symbols-outlined text-[18px]">slideshow</span>
                {content.secondaryExportLabel}
              </MemberButton>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
          <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm" data-help-id="monitoring-export-trend">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">{content.trendTitle}</h2>
                <p className="mt-1 text-sm text-slate-400">{content.trendBody}</p>
              </div>
              <button
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline"
                onClick={() => navigate(buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"))}
                type="button"
              >
                {content.trendAction}
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </button>
            </div>
            <div className="p-8">
              <div className="relative flex h-[300px] items-end gap-4">
                <div className="absolute inset-0 flex flex-col justify-between">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div className="border-t border-gray-100" key={`grid-${index}`} />
                  ))}
                </div>
                {content.trendBars.map((bar) => (
                  <div className="relative z-10 flex flex-1 flex-col items-center gap-2" key={bar.month}>
                    <div className={`group relative w-full rounded-t-md ${bar.accent ? "bg-blue-500" : "bg-[var(--kr-gov-blue)]"} ${!bar.accent ? "opacity-90" : ""}`} style={{ height: bar.height }}>
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                        {bar.value}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{bar.month}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 max-w-3xl text-sm leading-6 text-slate-500">{content.trendCaption}</p>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm" data-help-id="monitoring-export-mix">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-black text-slate-900">{content.mixTitle}</h2>
              <p className="mt-1 text-sm text-slate-400">{content.mixBody}</p>
            </div>
            <div className="space-y-6 p-6">
              {content.processRows.map((row) => (
                <div className="space-y-2" key={row.label}>
                  <div className="flex items-center justify-between gap-3 text-sm font-bold">
                    <span className="text-slate-700">{row.label}</span>
                    <span className="text-[var(--kr-gov-blue)]">{row.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${row.toneClassName}`} style={{ width: row.value }} />
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400">tips_and_updates</span>
                  <p>{content.mixInsight}</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 pb-8" data-help-id="monitoring-export-sites">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900">{content.sitesTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{content.sitesBody}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {content.siteCards.map((card) => (
              <article className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${card.key === "ulsan" ? "border-red-200 ring-2 ring-red-500/5" : "border-gray-200"}`} key={card.key}>
                <div className={`border-b border-gray-100 px-6 py-5 ${card.key === "ulsan" ? "bg-red-50/40" : "bg-blue-50/20"}`}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className={`rounded border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${card.badgeClassName}`}>{card.badge}</span>
                    <span className="material-symbols-outlined text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>
                      push_pin
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{card.title}</h3>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{card.subtitle}</p>
                </div>
                <div className="p-6">
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{card.metricLabel}</p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className={`text-3xl font-black tracking-tight ${card.key === "ulsan" ? "text-red-600" : "text-slate-900"}`}>{card.metricValue}</span>
                        <span className="text-xs font-bold text-slate-400">{card.metricUnit}</span>
                      </div>
                    </div>
                    <p className={`text-sm font-black ${card.deltaClassName}`}>{card.delta}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 text-sm font-bold text-slate-700">{card.insightA}</div>
                    <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 text-sm font-bold text-slate-700">{card.insightB}</div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${card.key === "ulsan" ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-900 text-white hover:bg-black"}`}
                      onClick={() => navigate(buildLocalizedPath(card.primaryHref, `/en${card.primaryHref}`))}
                      type="button"
                    >
                      {card.primaryAction}
                    </button>
                    {card.secondaryAction && card.secondaryHref ? (
                      <button
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => navigate(buildLocalizedPath(card.secondaryHref!, `/en${card.secondaryHref!}`))}
                        type="button"
                      >
                        {card.secondaryAction}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
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
