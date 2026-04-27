import { useEffect, useMemo, type SyntheticEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";
const FOOTER_GOV = "https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE";

type AlertItem = {
  severity: "critical" | "verification" | "compliance";
  deadline: string;
  title: string;
  description: string;
  action: string;
};

type SiteCard = {
  id: string;
  name: string;
  healthScore: number;
  healthColor: string;
  borderColor: string;
  ringClass?: string;
  infoLabel: string;
  infoValue: string;
  infoBgClass: string;
  infoBorderClass?: string;
  infoLabelClass: string;
  infoValueClass: string;
  checkLabel: string;
  checkValue: string;
  buttonLabel: string;
  buttonIcon: string;
  buttonBgClass: string;
  buttonHoverClass: string;
};

type TableRow = {
  code: string;
  source: string;
  statusLabel: string;
  statusBgClass: string;
  statusTextClass: string;
  statusPulse?: boolean;
  riskIcon?: string;
  riskIconClass?: string;
  riskLabel: string;
  riskLabelClass: string;
  auditPerson: string;
  auditDate: string;
  verifyIcons: Array<{ icon: string; bgClass: string; colorClass: string; title: string }>;
  actionLabel: string;
  actionClass: string;
};

type IntegrityPageContent = {
  skipLink: string;
  govAlt: string;
  govText: string;
  statusLabel: string;
  logoTitle: string;
  logoSubtitle: string;
  navItems: string[];
  auditorRole: string;
  auditorName: string;
  assistantTitle: string;
  assistantDescription: string;
  assistantHighlight: string;
  viewLogsButton: string;
  queueTitle: string;
  alerts: AlertItem[];
  sitesTitle: string;
  sitesDescription: string;
  settingsLabel: string;
  sites: SiteCard[];
  tableTitle: string;
  tableSubtitle: string;
  searchPlaceholder: string;
  filterLabel: string;
  exportLabel: string;
  tableHeaders: string[];
  tableRows: TableRow[];
  paginationInfo: string;
  footerTitle: string;
  footerAddress: string;
  footerCompliance: string;
  footerLinks: string[];
  footerCopyright: string;
  footerChip: string;
  waAlt: string;
  systemExit: string;
};

const CONTENT: Record<"ko" | "en", IntegrityPageContent> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "데이터 무결성 & 감사 준수 포털 | 감독관 모드",
    statusLabel: "실시간 무결성 스캔: 가동 중",
    logoTitle: "데이터 무결성 대시보드",
    logoSubtitle: "Integrity & Audit Compliance",
    navItems: ["무결성 모니터링", "감사 이력 추적", "리스크 관리", "규제 준수 현황"],
    auditorRole: "총괄 감사관",
    auditorName: "이현장 관리자님",
    assistantTitle: "업데이트 비서",
    assistantDescription: "AI가 CO2 배출 데이터의 무결성을 실시간 검토하고 있습니다.",
    assistantHighlight: "3건의 우선 검증이 필요합니다.",
    viewLogsButton: "전체 감사 로그 보기",
    queueTitle: "Your Update Queue (우선순위순)",
    alerts: [
      { severity: "critical", deadline: "D-1", title: "울산 제3: 서류 무결성 오류", description: "업로드된 배출 계수 증빙 자료의 타임스탬프 불일치 감지", action: "무결성 검토 시작" },
      { severity: "verification", deadline: "D-3", title: "포항 제1: 센서 데이터 대조", description: "IOT 전력 데이터와 수동 입력값 간 5.2% 오차 발생", action: "데이터 보정 가이드" },
      { severity: "compliance", deadline: "D-7", title: "광양 제2: 연간 감사 준비", description: "제3자 검증을 위한 데이터 패키지 무결성 검사 필요", action: "감사 패키지 생성" }
    ],
    sitesTitle: "핵심 관리 배출지 (Data Health Status)",
    sitesDescription: "무결성 스코어 및 중점 감사 대상 시설입니다.",
    settingsLabel: "설정",
    sites: [
      {
        id: "PH-001", name: "포항 제1 열연공장", healthScore: 98, healthColor: "#10b981", borderColor: "border-t-emerald-500",
        infoLabel: "데이터 정합성", infoValue: "최상", infoBgClass: "bg-gray-50", infoLabelClass: "text-gray-500", infoValueClass: "text-emerald-600",
        checkLabel: "최근 무결성 검사", checkValue: "2시간 전",
        buttonLabel: "무결성 정밀 리뷰", buttonIcon: "verified", buttonBgClass: "bg-emerald-600", buttonHoverClass: "hover:bg-emerald-700"
      },
      {
        id: "US-042", name: "울산 제3 화학기지", healthScore: 64, healthColor: "#f59e0b", borderColor: "border-t-orange-500", ringClass: "ring-4 ring-orange-500/10",
        infoLabel: "식별된 리스크", infoValue: "고위험 (2건)", infoBgClass: "bg-red-50", infoBorderClass: "border border-red-100", infoLabelClass: "text-red-600", infoValueClass: "text-red-700",
        checkLabel: "최근 무결성 검사", checkValue: "12시간 전",
        buttonLabel: "리스크 즉시 조치", buttonIcon: "emergency_home", buttonBgClass: "bg-orange-600", buttonHoverClass: "hover:bg-orange-700"
      },
      {
        id: "GN-112", name: "광양 제2 에너지센터", healthScore: 82, healthColor: "#3b82f6", borderColor: "border-t-blue-500",
        infoLabel: "검증 단계", infoValue: "1단계 통과", infoBgClass: "bg-blue-50", infoBorderClass: "border border-blue-100", infoLabelClass: "text-blue-600", infoValueClass: "text-blue-700",
        checkLabel: "최근 무결성 검사", checkValue: "1일 전",
        buttonLabel: "감사 이력 열람", buttonIcon: "history_edu", buttonBgClass: "bg-blue-600", buttonHoverClass: "hover:bg-blue-700"
      }
    ],
    tableTitle: "CO2 데이터 무결성 및 감사 트레일",
    tableSubtitle: "Audit Trail History & Compliance Matrix",
    searchPlaceholder: "데이터 포인트 검색...",
    filterLabel: "필터",
    exportLabel: "리포트 내보내기",
    tableHeaders: ["데이터 명칭 / 소스", "무결성 상태", "관련 리스크", "감사 추적 (최종 수정)", "검증 이력", "조치"],
    tableRows: [
      {
        code: "#US-042-COMB-01", source: "울산 3호기 / 고정 연소 섹션",
        statusLabel: "불일치 감지", statusBgClass: "bg-red-100", statusTextClass: "text-red-700", statusPulse: true,
        riskIcon: "priority_high", riskIconClass: "text-red-500", riskLabel: "중복 산정 가능성", riskLabelClass: "text-red-600",
        auditPerson: "이현장 관리자", auditDate: "2025.08.15 14:22",
        verifyIcons: [
          { icon: "computer", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "System Check" },
          { icon: "person", bgClass: "bg-gray-100", colorClass: "text-gray-400", title: "Human Verify" }
        ],
        actionLabel: "무결성 검토", actionClass: "text-[var(--kr-gov-blue)] font-black underline hover:text-blue-800"
      },
      {
        code: "#PH-001-ELEC-82", source: "포항 1호기 / 전력 사용량 (IOT)",
        statusLabel: "신뢰도 우수", statusBgClass: "bg-emerald-100", statusTextClass: "text-emerald-700",
        riskLabel: "리스크 없음", riskLabelClass: "text-gray-400",
        auditPerson: "시스템 자동 업데이트", auditDate: "2025.08.15 16:00",
        verifyIcons: [
          { icon: "done_all", bgClass: "bg-emerald-100", colorClass: "text-emerald-600", title: "Auto Confirmed" }
        ],
        actionLabel: "상세 로그", actionClass: "text-gray-400 font-bold hover:text-gray-600"
      },
      {
        code: "#GN-112-PROC-DV", source: "광양 2호기 / 공정 부산물 배출",
        statusLabel: "외부 검증 중", statusBgClass: "bg-blue-100", statusTextClass: "text-blue-700",
        riskIcon: "info", riskIconClass: "text-orange-500", riskLabel: "감사 데이터 대기", riskLabelClass: "text-orange-600",
        auditPerson: "에너지공단 김검증", auditDate: "2025.08.14 09:15",
        verifyIcons: [
          { icon: "history_edu", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "External Auditor" },
          { icon: "assignment_ind", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "Internal Sign" }
        ],
        actionLabel: "검증 현황", actionClass: "text-[var(--kr-gov-blue)] font-black underline hover:text-blue-800"
      }
    ],
    paginationInfo: "총 42개의 무결성 체크포인트 중 3개 주의 필요",
    footerTitle: "CCUS 통합관리본부 무결성 검증 센터",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 무결성 지원팀: 02-1234-5678",
    footerCompliance: "본 시스템은 ISO 14064-1 및 국내 배출권거래제 무결성 지침을 준수합니다.",
    footerLinks: ["데이터 보안 방침", "이용약관", "감사 매뉴얼"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Integrity & Audit Portal.",
    footerChip: "Compliance V 2.8.5 (Blockchain Verified)",
    waAlt: "웹 접근성 품질인증 마크",
    systemExit: "로그아웃"
  },
  en: {
    skipLink: "Skip to Main Content",
    govAlt: "Government Symbol",
    govText: "Data Integrity & Audit Compliance Portal | Auditor Mode",
    statusLabel: "Real-time Integrity Scan: Active",
    logoTitle: "Data Integrity Dashboard",
    logoSubtitle: "Integrity & Audit Compliance",
    navItems: ["Integrity Monitoring", "Audit Trail History", "Risk Management", "Compliance Status"],
    auditorRole: "Lead Auditor",
    auditorName: "Hyunjang Lee",
    assistantTitle: "Update Assistant",
    assistantDescription: "AI is reviewing CO2 emission data integrity in real-time.",
    assistantHighlight: "3 priority verifications require your attention.",
    viewLogsButton: "View All Audit Logs",
    queueTitle: "Your Update Queue (By Priority)",
    alerts: [
      { severity: "critical", deadline: "D-1", title: "Ulsan #3: Document Integrity Error", description: "Timestamp mismatch detected in uploaded emission factor evidence", action: "Start Integrity Review" },
      { severity: "verification", deadline: "D-3", title: "Pohang #1: Sensor Data Cross-Check", description: "5.2% variance found between IoT power data and manual entries", action: "Data Calibration Guide" },
      { severity: "compliance", deadline: "D-7", title: "Gwangyang #2: Annual Audit Prep", description: "Integrity check required for data package for 3rd party verification", action: "Generate Audit Package" }
    ],
    sitesTitle: "Key Emission Sites (Data Health Status)",
    sitesDescription: "Integrity scores and facilities requiring focused auditing.",
    settingsLabel: "Settings",
    sites: [
      {
        id: "PH-001", name: "Pohang #1 Hot Rolling Plant", healthScore: 98, healthColor: "#10b981", borderColor: "border-t-emerald-500",
        infoLabel: "Data Consistency", infoValue: "Excellent", infoBgClass: "bg-gray-50", infoLabelClass: "text-gray-500", infoValueClass: "text-emerald-600",
        checkLabel: "Last Integrity Check", checkValue: "2h ago",
        buttonLabel: "Deep Integrity Review", buttonIcon: "verified", buttonBgClass: "bg-emerald-600", buttonHoverClass: "hover:bg-emerald-700"
      },
      {
        id: "US-042", name: "Ulsan #3 Chemical Base", healthScore: 64, healthColor: "#f59e0b", borderColor: "border-t-orange-500", ringClass: "ring-4 ring-orange-500/10",
        infoLabel: "Identified Risks", infoValue: "High (2 Issues)", infoBgClass: "bg-red-50", infoBorderClass: "border border-red-100", infoLabelClass: "text-red-600", infoValueClass: "text-red-700",
        checkLabel: "Last Integrity Check", checkValue: "12h ago",
        buttonLabel: "Immediate Risk Action", buttonIcon: "emergency_home", buttonBgClass: "bg-orange-600", buttonHoverClass: "hover:bg-orange-700"
      },
      {
        id: "GN-112", name: "Gwangyang #2 Energy Center", healthScore: 82, healthColor: "#3b82f6", borderColor: "border-t-blue-500",
        infoLabel: "Verification Stage", infoValue: "Stage 1 Passed", infoBgClass: "bg-blue-50", infoBorderClass: "border border-blue-100", infoLabelClass: "text-blue-600", infoValueClass: "text-blue-700",
        checkLabel: "Last Integrity Check", checkValue: "1 day ago",
        buttonLabel: "View Audit History", buttonIcon: "history_edu", buttonBgClass: "bg-blue-600", buttonHoverClass: "hover:bg-blue-700"
      }
    ],
    tableTitle: "CO2 Data Integrity & Audit Trail",
    tableSubtitle: "Audit Trail History & Compliance Matrix",
    searchPlaceholder: "Search data points...",
    filterLabel: "Filter",
    exportLabel: "Export Report",
    tableHeaders: ["Data Label / Source", "Integrity Status", "Associated Risk", "Audit Trail (Last Modified)", "Verification History", "Actions"],
    tableRows: [
      {
        code: "#US-042-COMB-01", source: "Ulsan #3 / Stationary Combustion",
        statusLabel: "Mismatch Detected", statusBgClass: "bg-red-100", statusTextClass: "text-red-700", statusPulse: true,
        riskIcon: "priority_high", riskIconClass: "text-red-500", riskLabel: "Double Counting Risk", riskLabelClass: "text-red-600",
        auditPerson: "Hyunjang Lee", auditDate: "2025.08.15 14:22",
        verifyIcons: [
          { icon: "computer", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "System Check" },
          { icon: "person", bgClass: "bg-gray-100", colorClass: "text-gray-400", title: "Human Verify" }
        ],
        actionLabel: "Integrity Review", actionClass: "text-[var(--kr-gov-blue)] font-black underline hover:text-blue-800"
      },
      {
        code: "#PH-001-ELEC-82", source: "Pohang #1 / Power Usage (IoT)",
        statusLabel: "High Reliability", statusBgClass: "bg-emerald-100", statusTextClass: "text-emerald-700",
        riskLabel: "No Risk Identified", riskLabelClass: "text-gray-400",
        auditPerson: "System Auto-Update", auditDate: "2025.08.15 16:00",
        verifyIcons: [
          { icon: "done_all", bgClass: "bg-emerald-100", colorClass: "text-emerald-600", title: "Auto Confirmed" }
        ],
        actionLabel: "Details Log", actionClass: "text-gray-400 font-bold hover:text-gray-600"
      },
      {
        code: "#GN-112-PROC-DV", source: "Gwangyang #2 / Process Byproduct",
        statusLabel: "External Verifying", statusBgClass: "bg-blue-100", statusTextClass: "text-blue-700",
        riskIcon: "info", riskIconClass: "text-orange-500", riskLabel: "Awaiting Audit Data", riskLabelClass: "text-orange-600",
        auditPerson: "Kim (Energy Board)", auditDate: "2025.08.14 09:15",
        verifyIcons: [
          { icon: "history_edu", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "External Auditor" },
          { icon: "assignment_ind", bgClass: "bg-blue-100", colorClass: "text-blue-600", title: "Internal Sign" }
        ],
        actionLabel: "Status Check", actionClass: "text-[var(--kr-gov-blue)] font-black underline hover:text-blue-800"
      }
    ],
    paginationInfo: "3 items require attention out of 42 integrity checkpoints",
    footerTitle: "CCUS Integrated Integrity Verification Center",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Integrity Support Team: 02-1234-5678",
    footerCompliance: "This system complies with ISO 14064-1 and national Emission Trading Scheme integrity guidelines.",
    footerLinks: ["Data Security Policy", "Terms of Use", "Audit Manual"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Integrity & Audit Portal.",
    footerChip: "Compliance V 2.8.5 (Blockchain Verified)",
    waAlt: "Web Accessibility Certification",
    systemExit: "Sign Out"
  }
};

const SEVERITY_STYLES: Record<string, { border: string; badge: string; badgeText: string }> = {
  critical: { border: "border-l-red-500", badge: "bg-red-500/20 text-red-400", badgeText: "CRITICAL RISK" },
  verification: { border: "border-l-orange-500", badge: "bg-orange-500/20 text-orange-400", badgeText: "VERIFICATION" },
  compliance: { border: "border-l-blue-500", badge: "bg-blue-500/20 text-blue-400", badgeText: "COMPLIANCE" }
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

function Co2IntegrityInlineStyles({ en }: { en: boolean }) {
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
      .gov-card {
        border: 1px solid var(--kr-gov-border-light); border-radius: var(--kr-gov-radius); background: white;
        transition: all .2s ease; outline: none; display: flex; flex-direction: column; height: 100%;
      }
      .gov-card:hover { box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
      .integrity-table th {
        padding: 1rem; text-align: left; font-size: 11px; font-weight: 900; color: #6b7280;
        text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f3f4f6; background: #f9fafb;
      }
      .integrity-table td {
        padding: 1rem; font-size: 0.875rem; border-bottom: 1px solid #fafafa;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus); outline-offset: 2px;
      }
      @media (max-width: 1279px) {
        .integrity-header-nav { display: none; }
      }
    `}</style>
  );
}

function HealthScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
        <path
          className="text-gray-100"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="currentColor" strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeDasharray={`${score}, 100`} strokeWidth="3"
        />
      </svg>
      <div className="text-center">
        <span className="block text-sm font-black" style={{ color }}>{score}</span>
        <span className="block text-[8px] font-bold text-gray-400 uppercase">Health</span>
      </div>
    </div>
  );
}

export function Co2IntegrityMigrationPage() {
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
    logGovernanceScope("PAGE", "co2-integrity", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      menuCode: "H0030102",
      routePath: en ? "/en/co2/integrity" : "/co2/integrity"
    });
  }, [en, payload.isLoggedIn]);

  return (
    <>
      <Co2IntegrityInlineStyles en={en} />
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
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>verified_user</span>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
                    <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.logoSubtitle}</p>
                  </div>
                </a>
              </div>
              <nav className="integrity-header-nav hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => (
                  <a
                    className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === 0 ? "text-[var(--kr-gov-blue)] border-[var(--kr-gov-blue)]" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`}
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
                <button className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors border border-slate-200" type="button">
                  <span className="material-symbols-outlined text-slate-600">policy</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
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
                  {content.systemExit}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          {/* Hero Section - Dark Background */}
          <section className="bg-slate-900 py-10 relative overflow-hidden" data-help-id="co2-integrity-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="grid-integrity" patternUnits="userSpaceOnUse" width="60">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
                <rect fill="url(#grid-integrity)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="xl:w-1/4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">account_tree</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.assistantTitle}</h2>
                      <p className="text-blue-400 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" /> Integrity Watch
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {content.assistantDescription} <br />
                    <strong className="text-white">{content.assistantHighlight}</strong>
                  </p>
                  <button className="w-full py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white text-sm font-bold transition-all flex items-center justify-center gap-2" type="button">
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span> {content.viewLogsButton}
                  </button>
                </div>

                <div className="xl:w-3/4 w-full">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">list_alt</span> {content.queueTitle}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {content.alerts.map((alert) => {
                      const style = SEVERITY_STYLES[alert.severity];
                      return (
                        <div className={`bg-white/5 backdrop-blur-md border-l-4 ${style.border} border border-white/10 p-5 rounded-r-lg group hover:bg-white/10 transition-all cursor-pointer`} key={alert.title}>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-widest ${style.badge}`}>{style.badgeText}</span>
                            <span className="text-[10px] font-bold text-slate-500">{alert.deadline}</span>
                          </div>
                          <h4 className="text-white font-bold text-sm mb-1">{alert.title}</h4>
                          <p className="text-slate-400 text-[11px] mb-4">{alert.description}</p>
                          <a className="inline-flex items-center text-[11px] font-bold text-blue-400 hover:text-blue-300 gap-1" href="#" onClick={(event) => event.preventDefault()}>
                            {alert.action} <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Key Emission Sites Section */}
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="co2-integrity-trace-map">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>pin_drop</span>
                  {content.sitesTitle}
                </h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{content.sitesDescription}</p>
              </div>
              <button className="text-xs font-bold text-gray-400 hover:text-[var(--kr-gov-blue)] flex items-center gap-1 transition-colors" type="button">
                <span className="material-symbols-outlined text-[18px]">settings</span> {content.settingsLabel}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {content.sites.map((site) => (
                <div className={`gov-card border-t-4 ${site.borderColor} ${site.ringClass || ""}`} key={site.id}>
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ID: {site.id}</span>
                        <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{site.name}</h3>
                      </div>
                      <HealthScoreRing score={site.healthScore} color={site.healthColor} />
                    </div>
                    <div className="flex-1 space-y-4 mb-6">
                      <div className={`p-3 rounded-lg flex items-center justify-between ${site.infoBgClass} ${site.infoBorderClass || ""}`}>
                        <span className={`text-xs font-bold ${site.infoLabelClass}`}>{site.infoLabel}</span>
                        <span className={`text-xs font-black ${site.infoValueClass}`}>{site.infoValue}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">{site.checkLabel}</span>
                        <span className="text-xs font-black text-gray-800">{site.checkValue}</span>
                      </div>
                    </div>
                    <button className={`w-full py-3 ${site.buttonBgClass} ${site.buttonHoverClass} text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2`} type="button">
                      <span className="material-symbols-outlined text-[18px]">{site.buttonIcon}</span> {site.buttonLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CO2 Data Integrity & Audit Trail Table */}
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pb-20" data-help-id="co2-integrity-evidence" id="integrity-compliance">
            <div className="bg-white border border-[var(--kr-gov-border-light)] rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-700">rule</span>
                    {content.tableTitle}
                  </h2>
                  <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-widest">{content.tableSubtitle}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
                    <input className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder={content.searchPlaceholder} type="text" />
                  </div>
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 flex items-center gap-1 transition-colors" type="button">
                    <span className="material-symbols-outlined text-[16px]">filter_list</span> {content.filterLabel}
                  </button>
                  <button className="px-4 py-2 bg-[var(--kr-gov-blue)] text-white font-bold text-xs rounded-lg hover:bg-[var(--kr-gov-blue-hover)] flex items-center gap-1 transition-colors" type="button">
                    <span className="material-symbols-outlined text-[16px]">download</span> {content.exportLabel}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full integrity-table">
                  <thead>
                    <tr>
                      {content.tableHeaders.map((header, index) => (
                        <th key={header} className={index === content.tableHeaders.length - 1 ? "text-right" : ""}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {content.tableRows.map((row) => (
                      <tr className="hover:bg-gray-50/50 transition-colors" key={row.code}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800">{row.code}</span>
                            <span className="text-[10px] text-gray-400">{row.source}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`px-2 py-1 ${row.statusBgClass} ${row.statusTextClass} text-[10px] font-bold rounded flex items-center w-fit gap-1`}>
                            <span className={`w-1 h-1 rounded-full ${row.statusPulse ? "animate-pulse" : ""}`} style={{ backgroundColor: "currentColor" }} /> {row.statusLabel}
                          </span>
                        </td>
                        <td>
                          {row.riskIcon ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`material-symbols-outlined text-[16px] ${row.riskIconClass || ""}`}>{row.riskIcon}</span>
                              <span className={`text-xs font-bold ${row.riskLabelClass}`}>{row.riskLabel}</span>
                            </div>
                          ) : (
                            <span className={`text-xs ${row.riskLabelClass}`}>{row.riskLabel}</span>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-col text-xs text-gray-600">
                            <span className="font-bold">{row.auditPerson}</span>
                            <span>{row.auditDate}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex -space-x-2">
                            {row.verifyIcons.map((v) => (
                              <div className={`w-6 h-6 rounded-full ${v.bgClass} border-2 border-white flex items-center justify-center`} key={v.icon} title={v.title}>
                                <span className={`material-symbols-outlined text-[12px] ${v.colorClass}`}>{v.icon}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="text-right">
                          <button className={`text-xs ${row.actionClass}`} type="button">{row.actionLabel}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-gray-50 flex items-center justify-between">
                <p className="text-[11px] text-gray-400 font-bold">{content.paginationInfo}</p>
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50" type="button">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-xs font-bold px-2">1 / 5</span>
                  <button className="w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50" type="button">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
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
                {content.footerLinks.map((link, index) => (
                  <a
                    className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-gray-600 hover:underline"}
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
