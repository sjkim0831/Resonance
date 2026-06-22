import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomePayload } from "../home-entry/homeEntryTypes";
import { UserGovernmentBar } from "../../components/user-shell/UserPortalChrome";

import { MonitoringExportHeader } from "./components/MonitoringExportHeader";
import { MonitoringExportMobileMenu } from "./components/MonitoringExportMobileMenu";
import { MonitoringExportHero } from "./components/MonitoringExportHero";
import { MonitoringExportSummaryCards } from "./components/MonitoringExportSummaryCards";
import { MonitoringExportControls } from "./components/MonitoringExportControls";
import { MonitoringExportTrend } from "./components/MonitoringExportTrend";
import { MonitoringExportMix } from "./components/MonitoringExportMix";
import { MonitoringExportSites } from "./components/MonitoringExportSites";
import { MonitoringExportFooter } from "./components/MonitoringExportFooter";

import type { ReportTypeKey, ExportFormatKey } from "./types/MonitoringExportTypes";

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
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportTypeKey>("overview");
  const [format, setFormat] = useState<ExportFormatKey>("pdf");

  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined,
    }
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-export", {
      language: en ? "en" : "ko",
      userType: session.value?.authorCode || "guest",
      reportType,
      format,
      mobileMenuOpen,
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
    });
  }, [en, format, reportType, session.value?.authorCode, mobileMenuOpen, homeMenu.length, payload.isLoggedIn]);

  const handleLogout = () => {
    navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-3 focus:py-2 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

      <MonitoringExportHeader content={content} en={en} onLogout={handleLogout} />
      <MonitoringExportMobileMenu content={content} mobileMenuOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8" id="main-content">
        <MonitoringExportHero content={content} />

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]" data-help-id="monitoring-export-controls">
          <MonitoringExportSummaryCards metrics={content.metrics} />
          <MonitoringExportControls
            content={content}
            reportType={reportType}
            format={format}
            onReportTypeChange={setReportType}
            onFormatChange={setFormat}
          />
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
          <MonitoringExportTrend content={content} trendBars={content.trendBars} />
          <MonitoringExportMix content={content} processRows={content.processRows} />
        </section>

        <MonitoringExportSites content={content} siteCards={content.siteCards} />
      </main>

      <MonitoringExportFooter content={content} />
    </div>
  );
}