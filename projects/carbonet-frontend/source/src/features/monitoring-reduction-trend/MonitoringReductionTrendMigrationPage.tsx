import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type RangeKey = "24h" | "7d" | "30d";
type SiteTone = "stable" | "critical" | "benchmark";

type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone: "neutral" | "critical" | "accent";
};

type AlertCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  icon: string;
  title: string;
  body: string;
  meta: string;
  actionLabel: string;
  href: string;
  panelClassName: string;
  buttonClassName: string;
};

type SiteCard = {
  key: string;
  tone: SiteTone;
  toneLabel: string;
  title: string;
  value: string;
  unit: string;
  path: string;
  firstLabel: string;
  firstValue: string;
  secondLabel: string;
  secondValue: string;
  insightTitle?: string;
  insightBody?: string;
  actionLabel: string;
  actionHref: string;
};

type TimelineContent = {
  chartPath: string;
  baselinePath: string;
  anomalyLabel: string;
  anomalyDate: string;
  anomalyTitle: string;
  anomalyBody: string;
  anomalyAction: string;
  metrics: SummaryMetric[];
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  governmentText: string;
  governmentStatus: string;
  navItems: Array<{ label: string; href: string; active?: boolean }>;
  teamLabel: string;
  teamName: string;
  assistantCount: string;
  heroTitle: string;
  heroStatus: string;
  heroBodyLead: string;
  heroBodyStrong: string;
  heroNote: string;
  pageStatusMessage: string;
  rangeLabel: string;
  filterLabel: string;
  siteFilterLabel: string;
  siteFilterOptions: Array<{ value: string; label: string }>;
  timelineTitle: string;
  timelineBody: string;
  timelineAxis: string[];
  siteSectionTitle: string;
  siteSectionBody: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  heroAlerts: AlertCard[];
  rangeOptions: Array<{ key: RangeKey; label: string }>;
  timelines: Record<RangeKey, TimelineContent>;
  sites: SiteCard[];
};

const SITE_TONE_CLASSNAME: Record<SiteTone, { header: string; badge: string; value: string; button: string }> = {
  stable: {
    header: "border-t-4 border-t-emerald-500",
    badge: "border border-emerald-100 bg-emerald-50 text-emerald-700",
    value: "text-[var(--kr-gov-blue)]",
    button: "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
  },
  critical: {
    header: "border-l-4 border-l-red-500 shadow-[0_18px_50px_rgba(239,68,68,0.12)] ring-1 ring-red-100",
    badge: "border border-red-200 bg-red-100 text-red-700",
    value: "text-red-600",
    button: "bg-red-600 text-white hover:bg-red-700 shadow-[0_16px_40px_rgba(239,68,68,0.22)]"
  },
  benchmark: {
    header: "border-t-4 border-t-indigo-500",
    badge: "border border-indigo-100 bg-indigo-50 text-indigo-700",
    value: "text-indigo-700",
    button: "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
  }
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "모니터링 대시보드",
    pageSubtitle: "PERFORMANCE TREND ANALYSIS",
    governmentText: "대한민국 정부 공식 서비스 | Proactive Trend Analyst Mode",
    governmentStatus: "AI 이상 징후 탐지 엔진 작동 중: 정상",
    navItems: [
      { label: "성과 추이 분석", href: "/monitoring/reduction_trend", active: true },
      { label: "실시간 모니터링", href: "/monitoring/realtime" },
      { label: "데이터 무결성 검증", href: "/co2/integrity" },
      { label: "보고서 자동 생성", href: "/co2/analysis" }
    ],
    teamLabel: "트렌드 분석 전문가",
    teamName: "이현장 분석관님",
    assistantCount: "2",
    heroTitle: "지능형 업데이트 비서",
    heroStatus: "ANOMALY DETECTION ACTIVE",
    heroBodyLead: "분석 엔진이",
    heroBodyStrong: "2건의 비정상적 패턴",
    heroNote: "산정 데이터의 급격한 변동 원인을 진단하십시오.",
    pageStatusMessage: "reference HTML을 기반으로 성과 추이 중심의 모니터링 화면을 현재 React 마이그레이션 포털 셸로 재구성했습니다.",
    rangeLabel: "조회 범위",
    filterLabel: "필터",
    siteFilterLabel: "사업장 보기",
    siteFilterOptions: [
      { value: "all", label: "전체 사업장" },
      { value: "stable", label: "안정 구간" },
      { value: "critical", label: "이상 구간" },
      { value: "benchmark", label: "비교 우수 구간" }
    ],
    timelineTitle: "성과 추이 통합 타임라인",
    timelineBody: "핵심 배출지 간 성과 지표 비교 및 이상 패턴 자동 플래깅",
    timelineAxis: ["15,000", "10,000", "5,000", "0"],
    siteSectionTitle: "사업장별 상세 성과 매트릭스",
    siteSectionBody: "사업장 단위의 추세, 이탈, 비교 성과를 한 번에 확인합니다.",
    footerOrg: "CCUS 통합분석본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "데이터 분석 지원팀 02-1234-5678",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Proactive Trend Analyst Portal.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    heroAlerts: [
      {
        key: "ulsan-spike",
        badge: "SIGNIFICANT DEVIATION",
        badgeClassName: "bg-red-500/20 text-red-400",
        icon: "trending_up",
        title: "질소산화물 배출량 15% 급증 탐지",
        body: "최근 48시간 내 평균 대비 비정상적 수치가 감지되어 정밀 점검이 필요합니다.",
        meta: "울산 제3 화학기지",
        actionLabel: "원인 진단 워크플로우",
        href: "/monitoring/track",
        panelClassName: "border-red-500/30 bg-red-500/10",
        buttonClassName: "bg-red-600 hover:bg-red-700"
      },
      {
        key: "pohang-pattern",
        badge: "PATTERN MISMATCH",
        badgeClassName: "bg-indigo-500/20 text-indigo-300",
        icon: "compare_arrows",
        title: "전력 사용량 대비 배출량 비동기 현상",
        body: "생산량은 일정하지만 에너지 사용 패턴과 배출량 상관성이 이탈하고 있습니다.",
        meta: "포항 제1 열연공장",
        actionLabel: "상세 비교 분석",
        href: "/monitoring/realtime",
        panelClassName: "border-indigo-500/30 bg-indigo-500/10",
        buttonClassName: "bg-indigo-600 hover:bg-indigo-700"
      }
    ],
    rangeOptions: [
      { key: "24h", label: "24H" },
      { key: "7d", label: "7D" },
      { key: "30d", label: "30D" }
    ],
    timelines: {
      "24h": {
        chartPath: "M0 150 L100 145 L200 148 L300 140 L400 155 L500 120 L600 130 L700 40 L800 60 L900 65 L1000 70",
        baselinePath: "M0 100 L150 110 L300 95 L450 120 L600 105 L750 115 L900 110 L1000 108",
        anomalyLabel: "이상 패턴 탐지 (Peak)",
        anomalyDate: "2026.04.02 14:00",
        anomalyTitle: "울산 제3: 비정상적 배출 급증",
        anomalyBody: "설비 가동률 대비 배출량이 2.4배 수준으로 급증했습니다. 계측기 오작동 또는 누출 가능성이 큽니다.",
        anomalyAction: "상세 진단 워크플로우로 이동",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "421.5", unit: "tCO2/hr", note: "▼ 1.2% Trend", tone: "neutral" },
          { key: "anomaly", label: "ANOMALY COUNT", value: "02", unit: "Critical", note: "High Severity Detected", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "92.4", unit: "/100", note: "System Standard Met", tone: "neutral" },
          { key: "quality", label: "DATA QUALITY", value: "99.8%", note: "High Reliability", tone: "accent" }
        ]
      },
      "7d": {
        chartPath: "M0 138 L100 132 L200 136 L300 126 L400 134 L500 118 L600 104 L700 84 L800 88 L900 92 L1000 96",
        baselinePath: "M0 116 L150 114 L300 108 L450 112 L600 110 L750 118 L900 114 L1000 112",
        anomalyLabel: "Forecast Mismatch",
        anomalyDate: "2026.04.02 09:00",
        anomalyTitle: "광양 제2: 비교군 대비 고효율 유지",
        anomalyBody: "동종 시설 평균 대비 12% 우수한 수준을 7일 연속 유지했습니다. 우수 패턴의 정책 반영을 검토할 수 있습니다.",
        anomalyAction: "비교 리포트 보기",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "398.2", unit: "tCO2/hr", note: "▼ 3.8% vs last week", tone: "neutral" },
          { key: "anomaly", label: "FLAGGED SITES", value: "03", unit: "Watch", note: "1 severe, 2 review", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "94.1", unit: "/100", note: "Benchmark improving", tone: "accent" },
          { key: "quality", label: "DATA QUALITY", value: "99.6%", note: "All feeds synchronized", tone: "accent" }
        ]
      },
      "30d": {
        chartPath: "M0 144 L100 146 L200 138 L300 140 L400 128 L500 120 L600 112 L700 106 L800 100 L900 94 L1000 90",
        baselinePath: "M0 126 L150 124 L300 122 L450 120 L600 118 L750 116 L900 114 L1000 112",
        anomalyLabel: "Monthly Trend Shift",
        anomalyDate: "2026.04.01 18:00",
        anomalyTitle: "포항 제1: 안정 추세 유지",
        anomalyBody: "30일 누적 추세 기준 목표 경로보다 낮은 배출량을 유지하고 있습니다. 감축 계획의 기준 케이스로 활용 가능합니다.",
        anomalyAction: "성과 리포트 열기",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "386.0", unit: "tCO2/hr", note: "▼ 5.2% monthly", tone: "neutral" },
          { key: "anomaly", label: "ANOMALY COUNT", value: "05", unit: "Resolved", note: "4 closed this month", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "95.3", unit: "/100", note: "Best in class", tone: "accent" },
          { key: "quality", label: "DATA QUALITY", value: "99.9%", note: "Verified archive complete", tone: "accent" }
        ]
      }
    },
    sites: [
      {
        key: "stable",
        tone: "stable",
        toneLabel: "PERFORMANCE NORMAL",
        title: "포항 제1 열연공장",
        value: "2,341",
        unit: "tCO2",
        path: "M0 35 L20 30 L40 32 L60 25 L80 28 L100 20",
        firstLabel: "변동성",
        firstValue: "±2.1% (안정)",
        secondLabel: "예측 이탈",
        secondValue: "없음",
        actionLabel: "상세 트렌드 뷰",
        actionHref: "/monitoring/realtime"
      },
      {
        key: "critical",
        tone: "critical",
        toneLabel: "CRITICAL ANOMALY",
        title: "울산 제3 화학기지",
        value: "4,812",
        unit: "tCO2",
        path: "M0 35 L30 38 L60 10 L80 15 L100 5",
        firstLabel: "AI 분석 결과",
        firstValue: "질소산화물 배출 계수가 업계 표준 범위를 25% 초과",
        secondLabel: "우선 조치",
        secondValue: "정밀 진단 즉시 실행",
        insightTitle: "AI 분석 결과",
        insightBody: "질소산화물 배출 계수가 업계 표준 범위를 25% 초과했습니다. 원인 규명을 위한 정밀 진단이 시급합니다.",
        actionLabel: "진단 워크플로우 실행",
        actionHref: "/monitoring/track"
      },
      {
        key: "benchmark",
        tone: "benchmark",
        toneLabel: "BENCHMARK COMPARISON",
        title: "광양 제2 에너지센터",
        value: "12,890",
        unit: "tCO2",
        path: "M0 20 L25 22 L50 21 L75 23 L100 22",
        firstLabel: "전월 동기 대비",
        firstValue: "▼ 4.5% 우수",
        secondLabel: "동종 시설 평균 대비",
        secondValue: "▲ 12% 고효율",
        actionLabel: "상세 비교 리포트",
        actionHref: "/co2/analysis"
      }
    ]
  },
  en: {
    pageTitle: "Monitoring Dashboard",
    pageSubtitle: "PERFORMANCE TREND ANALYSIS",
    governmentText: "Official Government Service | Proactive Trend Analyst Mode",
    governmentStatus: "AI anomaly detection engine: normal",
    navItems: [
      { label: "Trend Analysis", href: "/en/monitoring/reduction_trend", active: true },
      { label: "Real-time Monitoring", href: "/en/monitoring/realtime" },
      { label: "Data Integrity", href: "/en/co2/integrity" },
      { label: "Report Automation", href: "/en/co2/analysis" }
    ],
    teamLabel: "Trend Analyst",
    teamName: "Hyun-jang Lee",
    assistantCount: "2",
    heroTitle: "Intelligent Update Assistant",
    heroStatus: "ANOMALY DETECTION ACTIVE",
    heroBodyLead: "The analysis engine detected",
    heroBodyStrong: "2 abnormal patterns",
    heroNote: "Diagnose the cause of abrupt swings in monitored emission data.",
    pageStatusMessage: "This page rebuilds the reference performance-trend dashboard inside the current React migration portal shell.",
    rangeLabel: "Range",
    filterLabel: "Filter",
    siteFilterLabel: "Site view",
    siteFilterOptions: [
      { value: "all", label: "All sites" },
      { value: "stable", label: "Stable zone" },
      { value: "critical", label: "Critical zone" },
      { value: "benchmark", label: "Benchmark zone" }
    ],
    timelineTitle: "Integrated Performance Timeline",
    timelineBody: "Compare cross-site performance signals and automatically flag unusual patterns.",
    timelineAxis: ["15,000", "10,000", "5,000", "0"],
    siteSectionTitle: "Site Performance Metrics",
    siteSectionBody: "Review trend movement, deviations, and benchmark outcomes for each site.",
    footerOrg: "CCUS Integrated Analytics Division",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul",
    footerServiceLine: "Data analysis desk +82-2-1234-5678",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Proactive Trend Analyst Portal.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility quality mark",
    heroAlerts: [
      {
        key: "ulsan-spike",
        badge: "SIGNIFICANT DEVIATION",
        badgeClassName: "bg-red-500/20 text-red-400",
        icon: "trending_up",
        title: "15% spike detected in NOx emissions",
        body: "An abnormal swing versus the recent 48-hour average requires immediate diagnostic review.",
        meta: "Ulsan Plant 3",
        actionLabel: "Run root-cause workflow",
        href: "/en/monitoring/track",
        panelClassName: "border-red-500/30 bg-red-500/10",
        buttonClassName: "bg-red-600 hover:bg-red-700"
      },
      {
        key: "pohang-pattern",
        badge: "PATTERN MISMATCH",
        badgeClassName: "bg-indigo-500/20 text-indigo-300",
        icon: "compare_arrows",
        title: "Emission output moved out of sync with power use",
        body: "Production volume stayed flat while energy usage and emissions lost their expected correlation.",
        meta: "Pohang Hot Rolling Mill 1",
        actionLabel: "Open detailed comparison",
        href: "/en/monitoring/realtime",
        panelClassName: "border-indigo-500/30 bg-indigo-500/10",
        buttonClassName: "bg-indigo-600 hover:bg-indigo-700"
      }
    ],
    rangeOptions: [
      { key: "24h", label: "24H" },
      { key: "7d", label: "7D" },
      { key: "30d", label: "30D" }
    ],
    timelines: {
      "24h": {
        chartPath: "M0 150 L100 145 L200 148 L300 140 L400 155 L500 120 L600 130 L700 40 L800 60 L900 65 L1000 70",
        baselinePath: "M0 100 L150 110 L300 95 L450 120 L600 105 L750 115 L900 110 L1000 108",
        anomalyLabel: "Peak anomaly detected",
        anomalyDate: "2026.04.02 14:00",
        anomalyTitle: "Ulsan Plant 3: abnormal emission spike",
        anomalyBody: "Emissions rose to 2.4x the expected operating-rate range. Meter failure or leakage is likely.",
        anomalyAction: "Open detailed diagnostic flow",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "421.5", unit: "tCO2/hr", note: "-1.2% trend", tone: "neutral" },
          { key: "anomaly", label: "ANOMALY COUNT", value: "02", unit: "Critical", note: "High severity detected", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "92.4", unit: "/100", note: "System standard met", tone: "neutral" },
          { key: "quality", label: "DATA QUALITY", value: "99.8%", note: "High reliability", tone: "accent" }
        ]
      },
      "7d": {
        chartPath: "M0 138 L100 132 L200 136 L300 126 L400 134 L500 118 L600 104 L700 84 L800 88 L900 92 L1000 96",
        baselinePath: "M0 116 L150 114 L300 108 L450 112 L600 110 L750 118 L900 114 L1000 112",
        anomalyLabel: "Forecast mismatch",
        anomalyDate: "2026.04.02 09:00",
        anomalyTitle: "Gwangyang Center 2: benchmark-leading efficiency",
        anomalyBody: "The site outperformed peer facilities by 12% for seven straight days and is suitable as a policy benchmark case.",
        anomalyAction: "Open benchmark report",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "398.2", unit: "tCO2/hr", note: "-3.8% vs last week", tone: "neutral" },
          { key: "anomaly", label: "FLAGGED SITES", value: "03", unit: "Watch", note: "1 severe, 2 review", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "94.1", unit: "/100", note: "Benchmark improving", tone: "accent" },
          { key: "quality", label: "DATA QUALITY", value: "99.6%", note: "All feeds synchronized", tone: "accent" }
        ]
      },
      "30d": {
        chartPath: "M0 144 L100 146 L200 138 L300 140 L400 128 L500 120 L600 112 L700 106 L800 100 L900 94 L1000 90",
        baselinePath: "M0 126 L150 124 L300 122 L450 120 L600 118 L750 116 L900 114 L1000 112",
        anomalyLabel: "Monthly trend shift",
        anomalyDate: "2026.04.01 18:00",
        anomalyTitle: "Pohang Mill 1: stable reduction path",
        anomalyBody: "The site stayed below the monthly target path and can serve as the current best-practice baseline.",
        anomalyAction: "Open performance report",
        metrics: [
          { key: "avg", label: "AVG. EMISSION RATE", value: "386.0", unit: "tCO2/hr", note: "-5.2% monthly", tone: "neutral" },
          { key: "anomaly", label: "ANOMALY COUNT", value: "05", unit: "Resolved", note: "4 closed this month", tone: "critical" },
          { key: "score", label: "EFFICIENCY SCORE", value: "95.3", unit: "/100", note: "Best in class", tone: "accent" },
          { key: "quality", label: "DATA QUALITY", value: "99.9%", note: "Verified archive complete", tone: "accent" }
        ]
      }
    },
    sites: [
      {
        key: "stable",
        tone: "stable",
        toneLabel: "PERFORMANCE NORMAL",
        title: "Pohang Hot Rolling Mill 1",
        value: "2,341",
        unit: "tCO2",
        path: "M0 35 L20 30 L40 32 L60 25 L80 28 L100 20",
        firstLabel: "Volatility",
        firstValue: "±2.1% (stable)",
        secondLabel: "Forecast deviation",
        secondValue: "None",
        actionLabel: "Open detailed trend view",
        actionHref: "/en/monitoring/realtime"
      },
      {
        key: "critical",
        tone: "critical",
        toneLabel: "CRITICAL ANOMALY",
        title: "Ulsan Plant 3",
        value: "4,812",
        unit: "tCO2",
        path: "M0 35 L30 38 L60 10 L80 15 L100 5",
        firstLabel: "AI finding",
        firstValue: "NOx coefficient exceeds the industry range by 25%",
        secondLabel: "Priority action",
        secondValue: "Run precision diagnostics now",
        insightTitle: "AI finding",
        insightBody: "The NOx emission coefficient exceeds the standard band by 25%. A root-cause diagnostic should start immediately.",
        actionLabel: "Launch diagnostic workflow",
        actionHref: "/en/monitoring/track"
      },
      {
        key: "benchmark",
        tone: "benchmark",
        toneLabel: "BENCHMARK COMPARISON",
        title: "Gwangyang Energy Center 2",
        value: "12,890",
        unit: "tCO2",
        path: "M0 20 L25 22 L50 21 L75 23 L100 22",
        firstLabel: "Vs previous month",
        firstValue: "-4.5% better",
        secondLabel: "Vs peer average",
        secondValue: "+12% efficiency",
        actionLabel: "Open benchmark report",
        actionHref: "/en/co2/analysis"
      }
    ]
  }
};

function MonitoringReductionTrendInlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-focus: #005fde;
        --kr-gov-bg-gray: #f2f2f2;
        --kr-gov-radius: 5px;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
        background: #f4f7fa;
        color: var(--kr-gov-text-primary);
      }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
      }
      .monitoring-reduction-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 22%),
          linear-gradient(180deg, #f4f7fa 0%, #eff3f8 100%);
      }
      .monitoring-reduction-hero {
        background:
          linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.96)),
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.18), transparent 24%);
      }
      .timeline-grid {
        background-image: linear-gradient(to right, #eef2f7 1px, transparent 1px), linear-gradient(to bottom, #eef2f7 1px, transparent 1px);
        background-size: 40px 40px;
      }
      .pulse-soft {
        animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes pulse-ring {
        0%, 100% { opacity: 1; }
        50% { opacity: .4; }
      }
    `}</style>
  );
}

export function MonitoringReductionTrendMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = CONTENT[en ? "en" : "ko"];
  const [range, setRange] = useState<RangeKey>("24h");
  const [siteFilter, setSiteFilter] = useState("all");

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-reduction-trend", {
      language: en ? "en" : "ko",
      range,
      siteFilter
    });
  }, [en, range, siteFilter]);

  const timeline = content.timelines[range];
  const visibleSites = useMemo(() => (
    siteFilter === "all" ? content.sites : content.sites.filter((site) => site.key === siteFilter)
  ), [content.sites, siteFilter]);

  return (
    <div className="monitoring-reduction-shell">
      <MonitoringReductionTrendInlineStyles />
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

      <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
          <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>query_stats</span>
                <div>
                  <h1 className="text-xl font-black tracking-tight">{content.pageTitle}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{content.pageSubtitle}</p>
                </div>
              </button>
              <nav className="hidden items-center gap-1 xl:flex" data-help-id="monitoring-reduction-trend-nav">
                {content.navItems.map((item) => (
                  <button
                    className={item.active
                      ? "rounded-lg border-b-4 border-[var(--kr-gov-blue)] px-4 py-3 text-sm font-black text-[var(--kr-gov-blue)]"
                      : "rounded-lg border-b-4 border-transparent px-4 py-3 text-sm font-black text-slate-500 transition hover:text-[var(--kr-gov-blue)]"}
                    key={item.label}
                    onClick={() => navigate(item.href)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="hidden text-right md:block">
                <p className="text-xs font-bold text-slate-500">{content.teamLabel}</p>
                <p className="text-sm font-black text-slate-900">{content.teamName}</p>
              </div>
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 transition hover:bg-indigo-100" type="button">
                <span className="material-symbols-outlined text-indigo-600">psychology</span>
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black text-white">{content.assistantCount}</span>
              </button>
              <UserLanguageToggle en={en} onKo={() => navigate("/monitoring/reduction_trend")} onEn={() => navigate("/en/monitoring/reduction_trend")} />
              {session.value?.authenticated ? (
                <MemberButton onClick={() => void session.logout()} variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
              ) : (
                <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                  {en ? "Login" : "로그인"}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pb-14">
        <section className="monitoring-reduction-hero relative overflow-hidden border-b border-slate-800 py-8" data-help-id="monitoring-reduction-trend-hero">
          <div className="absolute inset-0 opacity-5">
            <svg height="100%" width="100%">
              <pattern id="monitoring-reduction-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#monitoring-reduction-grid)" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1600px] px-4 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
              <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.2)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_12px_30px_rgba(79,70,229,0.3)]">
                    <span className="material-symbols-outlined text-[28px] text-white">insights</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-300">{content.heroStatus}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-300">
                  {content.heroBodyLead} <strong className="text-lg text-white">{content.heroBodyStrong}</strong>{en ? "." : "을 감지했습니다."}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{content.heroNote}</p>
                <div className="mt-6">
                  <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>
                </div>
              </aside>

              <div className="grid gap-4 md:grid-cols-2">
                {content.heroAlerts.map((alert) => (
                  <article className={`rounded-2xl border p-5 ${alert.panelClassName}`} key={alert.key}>
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-[0.18em] ${alert.badgeClassName}`}>{alert.badge}</span>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{alert.meta}</p>
                      </div>
                      <span className="material-symbols-outlined text-white/80">{alert.icon}</span>
                    </div>
                    <h3 className="text-sm font-black text-white">{alert.title}</h3>
                    <p className="mt-2 text-[12px] leading-6 text-slate-300">{alert.body}</p>
                    <button
                      className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-black text-white transition ${alert.buttonClassName}`}
                      onClick={() => navigate(alert.href)}
                      type="button"
                    >
                      {alert.actionLabel}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 py-10 lg:px-8" data-help-id="monitoring-reduction-trend-timeline">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" data-help-id="monitoring-reduction-trend-filters">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>timeline</span>
                {content.timelineTitle}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">{content.timelineBody}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                {content.rangeOptions.map((option) => (
                  <button
                    className={range === option.key ? "rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-black text-slate-900" : "rounded-lg px-4 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-50"}
                    key={option.key}
                    onClick={() => setRange(option.key)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="min-w-[180px] text-xs font-black text-slate-500">
                <span className="mb-1 block">{content.siteFilterLabel}</span>
                <AdminSelect value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                  {content.siteFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </AdminSelect>
              </label>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <div className="timeline-grid absolute inset-0 opacity-40" />
            <div className="relative z-10">
              <div className="relative min-h-[360px] border-b border-slate-100 pb-8">
                <div className="absolute inset-y-0 left-0 flex w-12 flex-col justify-between border-r border-slate-100 pr-4 text-[10px] font-black text-slate-400">
                  {content.timelineAxis.map((tick) => <span key={tick}>{tick}</span>)}
                </div>
                <div className="ml-16 relative h-[300px]">
                  <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                    <path d={timeline.chartPath} fill="none" stroke="#6366f1" strokeLinecap="round" strokeWidth="3" />
                    <circle className="pulse-soft" cx="700" cy="40" r="6" fill="#ef4444" />
                    <text x="712" y="30" fill="#ef4444" fontSize="10" fontWeight="bold">{timeline.anomalyLabel}</text>
                  </svg>
                  <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                    <path d={timeline.baselinePath} fill="none" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="2" />
                  </svg>
                  <div className="absolute left-[70%] top-[18%] w-64 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-white shadow-[0_18px_50px_rgba(15,23,42,0.45)]">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">{timeline.anomalyLabel}</span>
                      <span className="text-[10px] text-slate-400">{timeline.anomalyDate}</span>
                    </div>
                    <h3 className="text-xs font-black">{timeline.anomalyTitle}</h3>
                    <p className="mt-2 text-[10px] leading-5 text-slate-400">{timeline.anomalyBody}</p>
                    <button className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black transition hover:bg-indigo-700" onClick={() => navigate(buildLocalizedPath("/monitoring/track", "/en/monitoring/track"))} type="button">
                      {timeline.anomalyAction}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="monitoring-reduction-trend-stats">
                {timeline.metrics.map((metric) => (
                  <article
                    className={metric.tone === "critical"
                      ? "rounded-2xl border border-red-100 bg-red-50 p-4"
                      : "rounded-2xl border border-slate-100 bg-slate-50 p-4"}
                    key={metric.key}
                  >
                    <p className={metric.tone === "critical" ? "text-[11px] font-black uppercase tracking-[0.16em] text-red-600" : "text-[11px] font-black uppercase tracking-[0.16em] text-slate-500"}>{metric.label}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className={metric.tone === "critical" ? "text-3xl font-black text-red-600" : metric.tone === "accent" ? "text-3xl font-black text-indigo-600" : "text-3xl font-black text-slate-900"}>{metric.value}</span>
                      {metric.unit ? <span className="text-[10px] font-black text-slate-400">{metric.unit}</span> : null}
                    </div>
                    <p className={metric.tone === "critical" ? "mt-2 text-[10px] font-black text-red-500" : metric.tone === "accent" ? "mt-2 text-[10px] font-black text-indigo-500" : "mt-2 text-[10px] font-black text-emerald-600"}>{metric.note}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 pb-16 lg:px-8" data-help-id="monitoring-reduction-trend-sites">
          <div className="mb-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">dashboard</span>
              {content.siteSectionTitle}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">{content.siteSectionBody}</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3" data-help-id="monitoring-reduction-trend-site-cards">
            {visibleSites.map((site) => {
              const tone = SITE_TONE_CLASSNAME[site.tone];
              return (
                <article className={`overflow-hidden rounded-[26px] border border-slate-200 bg-white ${tone.header}`} key={site.key}>
                  <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5">
                    <div>
                      <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-black tracking-[0.14em] ${tone.badge}`}>{site.toneLabel}</span>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{site.title}</h3>
                    </div>
                    <span className={`material-symbols-outlined ${site.tone === "critical" ? "text-red-500" : site.tone === "benchmark" ? "text-indigo-500" : "text-slate-300"}`} style={site.tone === "critical" ? { fontVariationSettings: "'FILL' 1" } : undefined}>push_pin</span>
                  </div>
                  <div className="px-5 py-5">
                    <div className="mb-6 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{en ? "Current Performance" : "Current Performance"}</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className={`text-3xl font-black ${tone.value}`}>{site.value}</span>
                          <span className="text-xs font-black text-slate-400">{site.unit}</span>
                        </div>
                      </div>
                      <div className="h-12 w-24">
                        <svg className="h-full w-full" viewBox="0 0 100 40">
                          <path d={site.path} fill="none" stroke={site.tone === "critical" ? "#ef4444" : site.tone === "benchmark" ? "#6366f1" : "#00378b"} strokeWidth={site.tone === "critical" ? "2.5" : "2"} />
                        </svg>
                      </div>
                    </div>

                    {site.insightTitle && site.insightBody ? (
                      <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4">
                        <p className="flex items-center gap-1 text-[11px] font-black text-red-700">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          {site.insightTitle}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-red-600">{site.insightBody}</p>
                      </div>
                    ) : (
                      <div className="mb-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black text-slate-400">{site.firstLabel}</p>
                          <p className={site.tone === "benchmark" ? "mt-1 text-sm font-black text-emerald-600" : "mt-1 text-sm font-black text-slate-700"}>{site.firstValue}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black text-slate-400">{site.secondLabel}</p>
                          <p className={site.tone === "benchmark" ? "mt-1 text-sm font-black text-indigo-600" : "mt-1 text-sm font-black text-slate-700"}>{site.secondValue}</p>
                        </div>
                      </div>
                    )}

                    {!site.insightTitle ? null : (
                      <div className="mb-6 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-[11px] font-black">
                          <span className="text-slate-500">{site.firstLabel}</span>
                          <span className="text-red-600">{site.firstValue}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] font-black">
                          <span className="text-slate-500">{site.secondLabel}</span>
                          <span className="text-red-500">{site.secondValue}</span>
                        </div>
                      </div>
                    )}

                    <button className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${tone.button}`} onClick={() => navigate(site.actionHref)} type="button">
                      {site.actionLabel}
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <UserPortalFooter
        copyright={content.footerCopyright}
        footerLinks={[
          en ? "Analysis Guide" : "분석 가이드",
          en ? "Algorithm Policy" : "알고리즘 정책",
          en ? "Data Security Policy" : "데이터 보안지침"
        ]}
        lastModifiedLabel={content.footerLastModified}
        orgName={content.footerOrg}
        addressLine={content.footerAddress}
        serviceLine={content.footerServiceLine}
        waAlt={content.footerWaAlt}
      />
    </div>
  );
}
