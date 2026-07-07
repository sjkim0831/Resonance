import { useEffect, useMemo, type SyntheticEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";
const FOOTER_GOV = "https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE";

type TableRow = {
  name: string;
  id: string;
  accuracy: string;
  accuracyColor: string;
  completeness: string;
  completenessColor: string;
  timeliness: string;
  timelinessColor: string;
  consistency: string;
  consistencyColor: string;
  overallGrade: string;
  overallColor: string;
  value: string;
};

type ContentStrings = {
  skipLink: string;
  govAlt: string;
  govText: string;
  statusLabel: string;
  logoTitle: string;
  logoSubtitle: string;
  navItems: string[];
  auditorRole: string;
  auditorName: string;
  logoutText: string;
  heroTitle: string;
  heroSubtitle: string;
  legendExcellent: string;
  legendGood: string;
  legendWarning: string;
  legendCritical: string;
  centralLedgerTitle: string;
  centralLedgerSub: string;
  pohangPlant: string;
  pohangMetricLabel: string;
  gwangyangEnergy: string;
  gwangyangMetricLabel: string;
  ulsanBase: string;
  ulsanMetricLabel: string;
  ulsanButtonLabel: string;
  erpTitle: string;
  erpSub: string;
  gridTitle: string;
  gridSub: string;
  iotTitle: string;
  iotSub: string;
  analysisTitle: string;
  networkReliability: string;
  criticalErrorsTitle: string;
  ulsanErrorReportTitle: string;
  ulsanErrorReportDesc: string;
  manualPatchButton: string;
  viewLogsButton: string;
  kpiTitle: string;
  kpiIntegrityLabel: string;
  kpiIntegrityValue: string;
  kpiLatencyLabel: string;
  kpiLatencyValue: string;
  kpiFormatLabel: string;
  kpiFormatValue: string;
  exportReportButton: string;
  smartQueueTitle: string;
  smartQueueTaskQty: string;
  task1Title: string;
  task1Action: string;
  task2Title: string;
  task2Action: string;
  task3Title: string;
  task3Action: string;
  matrixTitle: string;
  matrixSubtitle: string;
  filtersButton: string;
  tableHeaders: string[];
  tableRows: TableRow[];
  footerTitle: string;
  footerAddress: string;
  footerCompliance: string;
  footerLinks: string[];
  footerCopyright: string;
  footerChip: string;
  waAlt: string;
};

const CONTENT: Record<"ko" | "en", ContentStrings> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "대한민국 정부 공식 서비스 | 현장 감독관 전용 포털",
    statusLabel: "네트워크 헬스 체크: 실시간 감시 중",
    logoTitle: "탄소정보 연계 품질지표",
    logoSubtitle: "Data Linkage Health Map",
    navItems: ["배출지 모니터링", "연계 품질 관리", "데이터 검증", "시스템 설정"],
    auditorRole: "총괄 책임자",
    auditorName: "이현장 관리자님",
    logoutText: "로그아웃",
    heroTitle: "데이터 연계 건전성 지도",
    heroSubtitle: "현장별 데이터 소스 간 상호의존성 및 연계 품질 실시간 시각화",
    legendExcellent: "우수 (95%+)",
    legendGood: "보통 (80%+)",
    legendWarning: "주의 (60%+)",
    legendCritical: "위험/단절",
    centralLedgerTitle: "통합 탄소 원장",
    centralLedgerSub: "CENTRAL REPOSITORY",
    pohangPlant: "포항 제1 열연",
    pohangMetricLabel: "품질지수",
    gwangyangEnergy: "광양 제2 에너지",
    gwangyangMetricLabel: "지연 탐지",
    ulsanBase: "울산 제3 화학기지",
    ulsanMetricLabel: "연계 단절: ERP API 인증 실패",
    ulsanButtonLabel: "복구 워크플로우 실행",
    erpTitle: "내부 ERP 시스템",
    erpSub: "Stable Connection",
    gridTitle: "한전 전력 데이터",
    gridSub: "Last Sync 5m ago",
    iotTitle: "IoT 센서 그리드",
    iotSub: "Network Jitter Detected",
    analysisTitle: "연계 품질 분석 (DQ Index)",
    networkReliability: "전체 네트워크 신뢰도",
    criticalErrorsTitle: "치명적 연계 오류 (Critical)",
    ulsanErrorReportTitle: "울산 제3 - 원료 투입량",
    ulsanErrorReportDesc: "데이터 필드 누락 (8월분)",
    manualPatchButton: "수동 보정",
    viewLogsButton: "로그 확인",
    kpiTitle: "주요 연계 성능",
    kpiIntegrityLabel: "데이터 정합성",
    kpiIntegrityValue: "Excellent",
    kpiLatencyLabel: "연계 지연시간 (Latency)",
    kpiLatencyValue: "0.42s avg",
    kpiFormatLabel: "포맷 유효성",
    kpiFormatValue: "Warning (74%)",
    exportReportButton: "품질 리포트 내보내기",
    smartQueueTitle: "지능형 업데이트 큐",
    smartQueueTaskQty: "4 Tasks",
    task1Title: "울산 제3: 데이터 필드 매핑 복구",
    task1Action: "지금 해결하기",
    task2Title: "포항 제1: 에너지 고지서 대조",
    task2Action: "입력 양식으로 이동",
    task3Title: "광양 제2: 품질 보증 체크리스트",
    task3Action: "검증 프로세스 개시",
    matrixTitle: "배출원별 품질지표 상세 (Quality Matrix)",
    matrixSubtitle: "최근 7일간의 연계 품질 트렌드 및 지표별 점수",
    filtersButton: "필터링",
    tableHeaders: ["배출원 명칭", "정확성", "완전성", "적시성", "일관성", "종합 등급"],
    tableRows: [
      { name: "포항 제1 열연공장", id: "PH-001", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "S (98.2)", overallColor: "text-emerald-600", value: "98.2" },
      { name: "광양 제2 에너지센터", id: "GN-112", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "orange-400", timelinessColor: "bg-orange-400", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "A (89.5)", overallColor: "text-indigo-600", value: "89.5" },
      { name: "인천 물류센터", id: "IC-005", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "S (96.1)", overallColor: "text-emerald-600", value: "96.1" },
      { name: "울산 제3 화학기지", id: "US-042", accuracy: "red-500", accuracyColor: "bg-red-500", completeness: "red-500", completenessColor: "bg-red-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "orange-400", consistencyColor: "bg-orange-400", overallGrade: "F (32.4)", overallColor: "text-red-600", value: "32.4" }
    ],
    footerTitle: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678",
    footerCompliance: "본 플랫폼은 기업의 온실가스 감축 현장 관리를 위해 최적화되었습니다.",
    footerLinks: ["개인정보처리방침", "이용약관", "연계 API 가이드"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Linkage Health Map Interface.",
    footerChip: "System Status: Optimal",
    waAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skipLink: "Skip to main content",
    govAlt: "Government of Korea Emblem",
    govText: "Official Government Service | Field Overseer Portal",
    statusLabel: "Network Health: Active Monitoring",
    logoTitle: "Carbon Data Linkage",
    logoSubtitle: "Data Linkage Health Map",
    navItems: ["Source Monitoring", "Quality Management", "Data Validation", "System Settings"],
    auditorRole: "Site Overseer",
    auditorName: "Admin Lee Hyun-jang",
    logoutText: "Logout",
    heroTitle: "Data Linkage Health Map",
    heroSubtitle: "Real-time visualization of interdependencies and linkage quality across carbon data sources",
    legendExcellent: "Excellent (95%+)",
    legendGood: "Good (80%+)",
    legendWarning: "Warning (60%+)",
    legendCritical: "Critical/Breach",
    centralLedgerTitle: "Central Carbon Ledger",
    centralLedgerSub: "CENTRAL REPOSITORY",
    pohangPlant: "Pohang Plant #1",
    pohangMetricLabel: "Quality Score",
    gwangyangEnergy: "Gwangyang Energy #2",
    gwangyangMetricLabel: "Latency detected",
    ulsanBase: "Ulsan Chemical Base #3",
    ulsanMetricLabel: "Linkage Breach: ERP API Auth Failure",
    ulsanButtonLabel: "Execute Recovery Workflow",
    erpTitle: "Internal ERP System",
    erpSub: "Stable Connection",
    gridTitle: "National Grid Data",
    gridSub: "Last Sync 5m ago",
    iotTitle: "IoT Sensor Grid",
    iotSub: "Network Jitter Detected",
    analysisTitle: "Linkage Analysis (DQ Index)",
    networkReliability: "Total Network Reliability",
    criticalErrorsTitle: "Critical Linkage Errors",
    ulsanErrorReportTitle: "Ulsan #3 - Raw Material Input",
    ulsanErrorReportDesc: "Missing data fields (August)",
    manualPatchButton: "Manual Patch",
    viewLogsButton: "View Logs",
    kpiTitle: "Key Performance Metrics",
    kpiIntegrityLabel: "Data Integrity",
    kpiIntegrityValue: "Excellent",
    kpiLatencyLabel: "Average Latency",
    kpiLatencyValue: "0.42s avg",
    kpiFormatLabel: "Format Validity",
    kpiFormatValue: "Warning (74%)",
    exportReportButton: "Export Quality Report",
    smartQueueTitle: "Smart Update Queue",
    smartQueueTaskQty: "4 Tasks",
    task1Title: "Ulsan #3: Restore data field mapping",
    task1Action: "Resolve Now",
    task2Title: "Pohang #1: Energy bill cross-check",
    task2Action: "Go to Entry Form",
    task3Title: "Gwangyang #2: QA Checklist review",
    task3Action: "Start Verification",
    matrixTitle: "Quality Matrix by Emission Source",
    matrixSubtitle: "7-day linkage quality trends and indicator scores",
    filtersButton: "Filters",
    tableHeaders: ["Source Name", "Accuracy", "Completeness", "Timeliness", "Consistency", "Overall Grade"],
    tableRows: [
      { name: "Pohang Plant #1", id: "PH-001", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "S (98.2)", overallColor: "text-emerald-600", value: "98.2" },
      { name: "Gwangyang Energy #2", id: "GN-112", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "orange-400", timelinessColor: "bg-orange-400", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "A (89.5)", overallColor: "text-indigo-600", value: "89.5" },
      { name: "Incheon Logistics Center", id: "IC-005", accuracy: "emerald-500", accuracyColor: "bg-emerald-500", completeness: "emerald-500", completenessColor: "bg-emerald-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "emerald-500", consistencyColor: "bg-emerald-500", overallGrade: "S (96.1)", overallColor: "text-emerald-600", value: "96.1" },
      { name: "Ulsan Chemical Base #3", id: "US-042", accuracy: "red-500", accuracyColor: "bg-red-500", completeness: "red-500", completenessColor: "bg-red-500", timeliness: "emerald-500", timelinessColor: "bg-emerald-500", consistency: "orange-400", consistencyColor: "bg-orange-400", overallGrade: "F (32.4)", overallColor: "text-red-600", value: "32.4" }
    ],
    footerTitle: "CCUS Management HQ",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Site Support Team: 02-1234-5678",
    footerCompliance: "This platform is optimized for managing corporate greenhouse gas reduction on-site.",
    footerLinks: ["Privacy Policy", "Terms of Service", "Linkage API Guide"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Linkage Health Map Interface.",
    footerChip: "System Status: Optimal",
    waAlt: "Web Accessibility Certification Mark"
  }
};

function handleGovSymbolError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function Co2AnalysisInlineStyles({ en }: { en: boolean }) {
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
        --health-excellent: #10b981;
        --health-good: #3b82f6;
        --health-warning: #f59e0b;
        --health-critical: #ef4444;
        --map-bg: #0f172a;
      }
      body { font-family: ${en ? "'Public Sans', 'Noto Sans KR', sans-serif" : "'Noto Sans KR', 'Public Sans', sans-serif"}; -webkit-font-smoothing: antialiased; }
      .skip-link {
        position: absolute; top: -100px; left: 0;
        background: var(--kr-gov-blue); color: white; padding: 12px; z-index: 100; transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24; font-size: 24px;
      }
      .gov-btn {
        padding: 0.625rem 1.25rem; font-weight: 700; border-radius: var(--kr-gov-radius);
        transition: background-color .2s ease, color .2s ease; outline: none;
      }
      .node-pulse {
        animation: node-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes node-ring {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
      }
      .network-line {
        stroke-dasharray: 5;
        animation: dash 20s linear infinite;
      }
      @keyframes dash {
        to { stroke-dashoffset: -100; }
      }
      .health-gradient-bg {
        background: radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 1) 100%);
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus); outline-offset: 2px;
      }
      @media (max-width: 1279px) {
        .analysis-header-nav { display: none; }
      }
    `}</style>
  );
}

export function Co2AnalysisMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };

  useEffect(() => {
    logGovernanceScope("PAGE", "co2-analysis", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      menuCode: "H0030103", // Arbitrary sub code for analysis if not specifically defined
      routePath: en ? "/en/co2/analysis" : "/co2/analysis"
    });
  }, [en, payload.isLoggedIn]);

  return (
    <>
      <Co2AnalysisInlineStyles en={en} />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)] min-h-screen">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>

        {/* Government Header Bar */}
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{content.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{content.statusLabel}</p>
            </div>
          </div>
        </div>

        {/* Sticky Header */}
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3 shrink-0">
                <a className="flex items-center gap-2 focus-visible" href={buildLocalizedPath("/home", "/en/home")}>
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>hub</span>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
                    <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.logoSubtitle}</p>
                  </div>
                </a>
              </div>
              <nav className="analysis-header-nav hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => (
                  <a
                    className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === 1 ? "text-[var(--kr-gov-blue)] border-[var(--kr-gov-blue)]" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`}
                    href="#"
                    key={item}
                    onClick={(event) => event.preventDefault()}
                  >
                    {item}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.auditorRole}</span>
                  <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{content.auditorName}</span>
                </div>
                <button className="relative w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-100" type="button">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">notifications</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">2</span>
                </button>
                <button
                  className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] text-sm focus-visible"
                  onClick={() => {
                    if (payload.isLoggedIn) {
                      void session.logout();
                      return;
                    }
                    navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"));
                  }}
                  type="button"
                >
                  {content.logoutText}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="bg-slate-900 pt-10 pb-6 relative overflow-hidden" data-help-id="co2-analysis-hero">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-400">lan</span>
                    {content.heroTitle}
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">{content.heroSubtitle}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-6 bg-slate-800/50 px-6 py-3 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[var(--health-excellent)]" />
                      <span className="text-white text-xs font-bold">{content.legendExcellent}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[var(--health-good)]" />
                      <span className="text-white text-xs font-bold">{content.legendGood}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[var(--health-warning)]" />
                      <span className="text-white text-xs font-bold">{content.legendWarning}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[var(--health-critical)]" />
                      <span className="text-white text-xs font-bold">{content.legendCritical}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border-b border-slate-800 relative h-[650px]" data-help-id="co2-analysis-charts">
            <div className="absolute inset-0 health-gradient-bg">
              <svg className="w-full h-full opacity-40" viewBox="0 0 1440 650">
                <line className="network-line" stroke="var(--health-excellent)" strokeWidth="2" x1="400" x2="720" y1="200" y2="325" />
                <line className="network-line" stroke="var(--health-good)" strokeWidth="2" x1="1040" x2="720" y1="200" y2="325" />
                <line stroke="var(--health-critical)" strokeDasharray="8" strokeWidth="3" x1="400" x2="720" y1="450" y2="325" />
                <line className="network-line" stroke="var(--health-warning)" strokeWidth="2" x1="1040" x2="720" y1="450" y2="325" />
                <line stroke="var(--health-excellent)" strokeWidth="1.5" x1="200" x2="400" y1="325" y2="200" />
                <line stroke="var(--health-good)" strokeWidth="1.5" x1="200" x2="400" y1="325" y2="450" />
                <circle cx="560" cy="387" fill="rgba(239, 68, 68, 0.15)" r="30" />
                <path d="M550,380 L570,395 M570,380 L550,395" stroke="var(--health-critical)" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto h-full relative px-4 lg:px-8">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center group">
                <div className="w-24 h-24 bg-indigo-600/20 border-2 border-indigo-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(99,102,241,0.3)] node-pulse cursor-pointer">
                  <span className="material-symbols-outlined text-white text-4xl">cloud_sync</span>
                </div>
                <p className="text-white font-black text-sm">{content.centralLedgerTitle}</p>
                <p className="text-indigo-400 text-[10px] font-bold">{content.centralLedgerSub}</p>
              </div>
              <div className="absolute top-[180px] left-[380px] -translate-x-1/2 group cursor-pointer">
                <div className="w-16 h-16 bg-[var(--health-excellent)]/20 border-2 border-[var(--health-excellent)] rounded-xl flex items-center justify-center mb-2 shadow-lg hover:bg-[var(--health-excellent)] transition-all">
                  <span className="material-symbols-outlined text-white">factory</span>
                </div>
                <div className="bg-slate-800 p-2 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 z-30">
                  <p className="text-white text-xs font-bold">{content.pohangPlant}</p>
                  <div className="flex justify-between mt-1"><span className="text-slate-400 text-[10px]">{content.pohangMetricLabel}</span><span className="text-emerald-400 text-[10px] font-bold">98{en ? " pts" : "점"}</span></div>
                </div>
              </div>
              <div className="absolute bottom-[180px] right-[380px] translate-x-1/2 group cursor-pointer">
                <div className="w-16 h-16 bg-[var(--health-warning)]/20 border-2 border-[var(--health-warning)] rounded-xl flex items-center justify-center mb-2 shadow-lg hover:bg-[var(--health-warning)] transition-all">
                  <span className="material-symbols-outlined text-white">energy_savings_leaf</span>
                </div>
                <div className="bg-slate-800 p-2 rounded border border-slate-700 absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 z-30">
                  <p className="text-white text-xs font-bold">{content.gwangyangEnergy}</p>
                  <div className="flex justify-between mt-1"><span className="text-slate-400 text-[10px]">{content.gwangyangMetricLabel}</span><span className="text-orange-400 text-[10px] font-bold">-12min</span></div>
                </div>
              </div>
              <div className="absolute bottom-[180px] left-[380px] -translate-x-1/2 group cursor-pointer">
                <div className="w-16 h-16 bg-[var(--health-critical)]/20 border-2 border-[var(--health-critical)] rounded-xl flex items-center justify-center mb-2 shadow-lg animate-pulse">
                  <span className="material-symbols-outlined text-white">sync_problem</span>
                </div>
                <div className="bg-red-900/90 p-3 rounded border border-red-500 absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 z-30">
                  <p className="text-white text-xs font-bold">{content.ulsanBase}</p>
                  <p className="text-red-200 text-[10px] mt-1 leading-tight">{content.ulsanMetricLabel}</p>
                  <button className="mt-2 w-full bg-white text-red-900 text-[10px] font-black py-1 rounded" type="button">{content.ulsanButtonLabel}</button>
                </div>
              </div>
              <div className="absolute left-8 top-1/2 -translate-y-1/2 space-y-12">
                <div className="flex items-center gap-4 group cursor-help">
                  <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">database</span>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-slate-300 text-[11px] font-bold">{content.erpTitle}</p>
                    <p className="text-[var(--health-excellent)] text-[9px]">{content.erpSub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group cursor-help">
                  <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">bolt</span>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-slate-300 text-[11px] font-bold">{content.gridTitle}</p>
                    <p className="text-[var(--health-good)] text-[9px]">{content.gridSub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group cursor-help">
                  <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">settings_input_component</span>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-slate-300 text-[11px] font-bold">{content.iotTitle}</p>
                    <p className="text-[var(--health-warning)] text-[9px]">{content.iotSub}</p>
                  </div>
                </div>
              </div>
              <div className="absolute right-8 top-8 bottom-8 w-80 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-6 overflow-y-auto z-40">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400 text-lg">analytics</span>
                  {content.analysisTitle}
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs text-slate-400">{content.networkReliability}</span>
                      <span className="text-lg font-black text-indigo-400">84.2%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: "84.2%" }} />
                    </div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 text-[11px] font-bold mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {content.criticalErrorsTitle}
                    </p>
                    <ul className="space-y-3">
                      <li className="flex flex-col gap-1">
                        <span className="text-white text-xs font-bold">{content.ulsanErrorReportTitle}</span>
                        <span className="text-slate-400 text-[10px]">{content.ulsanErrorReportDesc}</span>
                        <div className="flex gap-2 mt-1">
                          <button className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black" type="button">{content.manualPatchButton}</button>
                          <button className="bg-slate-700 text-white text-[9px] px-2 py-0.5 rounded font-black" type="button">{content.viewLogsButton}</button>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <p className="text-slate-300 text-[11px] font-bold mb-3 uppercase tracking-wider">{content.kpiTitle}</p>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{content.kpiIntegrityLabel}</span>
                        <span className="text-[10px] font-bold text-emerald-400">{content.kpiIntegrityValue}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{content.kpiLatencyLabel}</span>
                        <span className="text-[10px] font-bold text-slate-300">{content.kpiLatencyValue}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{content.kpiFormatLabel}</span>
                        <span className="text-[10px] font-bold text-orange-400">{content.kpiFormatValue}</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-4" type="button">
                    <span className="material-symbols-outlined text-sm">download</span> {content.exportReportButton}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="co2-analysis-recommendations" id="emission-sources">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-indigo-50/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
                      <h3 className="font-black text-slate-800">{content.smartQueueTitle}</h3>
                    </div>
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{content.smartQueueTaskQty}</span>
                  </div>
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100 group cursor-pointer hover:bg-red-100 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-red-600">CRITICAL</span>
                        <span className="text-[10px] text-gray-400">D-2</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800">{content.task1Title}</p>
                      <a className="text-[10px] text-red-600 underline mt-2 inline-block font-bold" href="#" onClick={(event) => event.preventDefault()}>{content.task1Action}</a>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-gray-100 group cursor-pointer hover:border-indigo-400 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-indigo-600">UPDATE</span>
                        <span className="text-[10px] text-gray-400">D-5</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800">{content.task2Title}</p>
                      <a className="text-[10px] text-indigo-600 underline mt-2 inline-block font-bold" href="#" onClick={(event) => event.preventDefault()}>{content.task2Action}</a>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-gray-100 group cursor-pointer hover:border-indigo-400 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-indigo-600">VERIFY</span>
                        <span className="text-[10px] text-gray-400">D-12</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800">{content.task3Title}</p>
                      <a className="text-[10px] text-indigo-600 underline mt-2 inline-block font-bold" href="#" onClick={(event) => event.preventDefault()}>{content.task3Action}</a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-full">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">grid_view</span>
                        {content.matrixTitle}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">{content.matrixSubtitle}</p>
                    </div>
                    <button className="text-xs font-bold text-indigo-600 flex items-center gap-1" type="button">
                      <span className="material-symbols-outlined text-[18px]">tune</span> {content.filtersButton}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr>
                          {content.tableHeaders.map((header, idx) => (
                            <th className={`px-4 py-3 text-[11px] font-black text-gray-500 uppercase ${idx === 0 ? "" : idx === content.tableHeaders.length - 1 ? "text-right" : "text-center"}`} key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {content.tableRows.map((row) => (
                          <tr className="hover:bg-gray-50 transition-colors" key={row.id}>
                            <td className="px-4 py-4">
                              <p className="text-xs font-bold text-gray-800">{row.name}</p>
                              <span className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">{row.id}</span>
                            </td>
                            <td className="px-4 py-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${row.accuracyColor}`} /></td>
                            <td className="px-4 py-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${row.completenessColor}`} /></td>
                            <td className="px-4 py-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${row.timelinessColor}`} /></td>
                            <td className="px-4 py-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${row.consistencyColor}`} /></td>
                            <td className="px-4 py-4 text-right"><span className={`text-[11px] font-black ${row.overallColor}`}>{row.overallGrade}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={content.govAlt} className="h-8 grayscale opacity-50" src={FOOTER_GOV} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{content.footerTitle}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed">
                  {content.footerAddress}<br />
                  {content.footerCompliance}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                {content.footerLinks.map((link, idx) => (
                  <a
                    className={idx === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-gray-600 hover:underline"}
                    href="#"
                    key={link}
                    onClick={(event) => event.preventDefault()}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">{content.footerCopyright}</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{content.footerChip}</div>
                <img alt={content.waAlt} className="h-10 opacity-60" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
