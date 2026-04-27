import { useEffect } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import type { SyntheticEvent } from "react";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type QueueCard = {
  badge: string;
  badgeClassName: string;
  deadline: string;
  title: string;
  description: string;
  actionText: string;
  actionIcon: string;
};

type DataMatrixRow = {
  siteName: string;
  reportLabel: string;
  reportLabelClassName: string;
  energyStatus: string;
  energyStatusClassName: string;
  energyIcon: string;
  factorStatus: string;
  factorStatusClassName: string;
  factorIcon: string;
  evidenceStatus: string;
  evidenceStatusClassName: string;
  evidenceIcon: string;
  evidencePulse?: boolean;
  qaStatus: string;
  qaStatusClassName: string;
  qaIcon: string;
  fulfillmentRate: string;
  fulfillmentRateClassName: string;
  fulfillmentWidth: string;
  fulfillmentColorClass: string;
  actionLabel: string;
  actionClassName: string;
};

type PendingReport = {
  title: string;
  missingCount: string;
  deadline: string;
  deadlineClassName: string;
};

type DemandPageContent = {
  skipLink: string;
  govAlt: string;
  govText: string;
  statusLabel: string;
  logoTitle: string;
  logoSubtitle: string;
  navItems: string[];
  activeNavIndex: number;
  managerRole: string;
  managerName: string;
  notificationCount: string;
  systemExit: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescription: string;
  dashboardButton: string;
  queueTitle: string;
  queueCards: QueueCard[];
  matrixTitle: string;
  matrixSubtitle: string;
  filterTabs: string[];
  exportButton: string;
  tableHeaders: string[];
  tableRows: DataMatrixRow[];
  tableFooter: string;
  pagination: number[];
  statsTitle: string;
  auditTitle: string;
  auditValue: string;
  auditLabel: string;
  auditDate: string;
  auditButton: string;
  pendingTitle: string;
  pendingReports: PendingReport[];
  footerTitle: string;
  footerAddress: string;
  footerDescription: string;
  footerLinks: string[];
  footerCopyright: string;
  footerChip: string;
  waAlt: string;
};

const CONTENT: Record<"ko" | "en", DemandPageContent> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "대한민국 정부 공식 서비스 | 데이터 관리자 포털",
    statusLabel: "데이터 수요 분석: 실시간 최신화",
    logoTitle: "데이터 이행 통합 허브",
    logoSubtitle: "Data & Reporting Fulfillment Hub",
    navItems: ["수요 정보 (Demand)", "데이터 매트릭스", "보고서 이행 현황", "감사 대응"],
    activeNavIndex: 0,
    managerRole: "데이터 총괄 관리자",
    managerName: "김데이터님",
    notificationCount: "7",
    systemExit: "로그아웃",
    assistantTitle: "업데이트 비서",
    assistantSubtitle: "Intelligent Update Assistant",
    assistantDescription: "보고서 및 감사 대응을 위해 분석된 실시간 데이터 수요(수요 정보)입니다. 데드라인에 따른 우선순위가 자동 설정되었습니다.",
    dashboardButton: "수요 분석 대시보드",
    queueTitle: "Your Update Queue (데드라인 순)",
    queueCards: [
      { badge: "URGENT", badgeClassName: "bg-red-500/20 text-red-400", deadline: "D-1", title: "정기 감사: 배출량 증빙", description: "포항 제1공장 고정 연소 섹션 영수증 5건 누락", actionText: "즉시 증빙 업로드", actionIcon: "upload_file" },
      { badge: "REQUIRED", badgeClassName: "bg-orange-500/20 text-orange-400", deadline: "D-4", title: "월간 리포트: 전력 사용량", description: "광양 제2 에너지센터 8월 전력 데이터 확정 필요", actionText: "데이터 확정하기", actionIcon: "check_circle" },
      { badge: "VERIFICATION", badgeClassName: "bg-blue-500/20 text-blue-400", deadline: "D-10", title: "외부 검증: 공정 계수", description: "울산 제3 화학기지 Tier 3 산정 로직 유효성 확인", actionText: "로직 검토", actionIcon: "calculate" },
      { badge: "UPDATE", badgeClassName: "bg-emerald-500/20 text-emerald-400", deadline: "TODAY", title: "시설 정보 변경 감지", description: "대전 R&D 캠퍼스 신규 배출원 등록 정보 확인", actionText: "마스터 정보 갱신", actionIcon: "edit" }
    ],
    matrixTitle: "Required Data Matrix (데이터 이행 매트릭스)",
    matrixSubtitle: "보고서별 필수 데이터 필드 상태 및 누락 항목을 실시간으로 추적합니다.",
    filterTabs: ["전체 보기", "누락 항목만", "검증 완료"],
    exportButton: "엑셀 추출",
    tableHeaders: ["배출지 및 대상 보고서", "에너지 소비량", "배출 계수", "증빙 서류", "품질 보증(QA)", "이행률", "액션"],
    tableRows: [
      { siteName: "포항 제1 열연공장", reportLabel: "2024 정기 환경 보고서", reportLabelClassName: "text-blue-600 bg-blue-50", energyStatus: "입력 완료", energyStatusClassName: "text-slate-600", energyIcon: "check_circle", factorStatus: "Tier 2 확정", factorStatusClassName: "text-slate-600", factorIcon: "check_circle", evidenceStatus: "1건 대기", evidenceStatusClassName: "text-orange-600 font-medium", evidenceIcon: "pending", evidencePulse: true, qaStatus: "검토 전", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "75%", fulfillmentRateClassName: "text-slate-700", fulfillmentWidth: "75%", fulfillmentColorClass: "bg-indigo-500", actionLabel: "이행하기", actionClassName: "text-[var(--kr-gov-blue)] hover:underline" },
      { siteName: "울산 제3 화학기지", reportLabel: "탄소배출권 특별 감사", reportLabelClassName: "text-red-600 bg-red-50", energyStatus: "누락됨", energyStatusClassName: "text-red-600 font-bold", energyIcon: "error", factorStatus: "Tier 3 적용", factorStatusClassName: "text-slate-600", factorIcon: "check_circle", evidenceStatus: "서류 미제출", evidenceStatusClassName: "text-red-600 font-bold", evidenceIcon: "error", qaStatus: "중단됨", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "20%", fulfillmentRateClassName: "text-red-600", fulfillmentWidth: "20%", fulfillmentColorClass: "bg-red-500", actionLabel: "긴급 조치", actionClassName: "bg-red-600 text-white hover:bg-red-700" },
      { siteName: "광양 제2 에너지센터", reportLabel: "분기별 공시 보고서", reportLabelClassName: "text-emerald-600 bg-emerald-50", energyStatus: "검증 완료", energyStatusClassName: "text-emerald-600", energyIcon: "verified", factorStatus: "검증 완료", factorStatusClassName: "text-emerald-600", factorIcon: "verified", evidenceStatus: "증빙 완료", evidenceStatusClassName: "text-emerald-600", evidenceIcon: "verified", qaStatus: "승인 대기", qaStatusClassName: "text-blue-600 font-bold", qaIcon: "task_alt", fulfillmentRate: "100%", fulfillmentRateClassName: "text-emerald-600", fulfillmentWidth: "100%", fulfillmentColorClass: "bg-emerald-500", actionLabel: "완료됨", actionClassName: "text-slate-400 cursor-not-allowed" },
      { siteName: "인천 물류센터", reportLabel: "온실가스 자율 목표 공시", reportLabelClassName: "text-slate-500 bg-slate-100", energyStatus: "입력 완료", energyStatusClassName: "text-slate-600", energyIcon: "check_circle", factorStatus: "데이터 미설정", factorStatusClassName: "text-slate-400", factorIcon: "circle", evidenceStatus: "서류 미등록", evidenceStatusClassName: "text-slate-400", evidenceIcon: "circle", qaStatus: "준비 중", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "30%", fulfillmentRateClassName: "text-slate-700", fulfillmentWidth: "30%", fulfillmentColorClass: "bg-slate-300", actionLabel: "이행하기", actionClassName: "text-[var(--kr-gov-blue)] hover:underline" }
    ],
    tableFooter: "※ 위 매트릭스는 현재 활성화된 '데이터 이행 수요'를 기반으로 자동 생성되었습니다.",
    pagination: [1, 2],
    statsTitle: "데이터 필드 수요 통계",
    auditTitle: "감사 대응 준비도 (Audit Readiness)",
    auditValue: "72%",
    auditLabel: "2024년 정기 환경 감사 대비",
    auditDate: "기준일: 2025.08.30",
    auditButton: "상세 체크리스트 확인",
    pendingTitle: "데이터 연계 대기 보고서",
    pendingReports: [
      { title: "연간 온실가스 인벤토리", missingCount: "데이터 미이행: 12건", deadline: "D-12", deadlineClassName: "text-red-500" },
      { title: "지속가능경영 보고서 (ESG)", missingCount: "데이터 미이행: 4건", deadline: "D-25", deadlineClassName: "text-orange-500" },
      { title: "에너지공단 정기 신고", missingCount: "데이터 미이행: 1건", deadline: "D-45", deadlineClassName: "text-slate-400" }
    ],
    footerTitle: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 데이터 운영 지원팀: 02-1234-5678",
    footerDescription: "본 플랫폼은 기업의 데이터 이행 및 보고서 품질 관리를 위해 최적화되었습니다.",
    footerLinks: ["개인정보처리방침", "이용약관", "매뉴얼 다운로드"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Manager Hub.",
    footerChip: "V 3.0.0 (Fulfillment Optimized)",
    waAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skipLink: "Skip to main content",
    govAlt: "Republic of Korea Government Symbol",
    govText: "Official ROK Government Service | Data Manager Portal",
    statusLabel: "Data Demand Analysis: Real-time Updates",
    logoTitle: "Fulfillment Hub",
    logoSubtitle: "Data & Reporting Fulfillment Hub",
    navItems: ["Demand Info", "Data Matrix", "Reporting Status", "Audit Response"],
    activeNavIndex: 0,
    managerRole: "Data General Manager",
    managerName: "Kim Data",
    notificationCount: "7",
    systemExit: "Logout",
    assistantTitle: "Update AI",
    assistantSubtitle: "Intelligent Update Assistant",
    assistantDescription: "This is the real-time data demand analyzed for reports and audit response. Priorities are automatically set based on upcoming deadlines.",
    dashboardButton: "Demand Dashboard",
    queueTitle: "Your Update Queue (by Deadline)",
    queueCards: [
      { badge: "URGENT", badgeClassName: "bg-red-500/20 text-red-400", deadline: "D-1", title: "Audit: Emission Proof", description: "Pohang Plant 1: 5 receipts missing in Stationary Combustion section", actionText: "Upload Evidence", actionIcon: "upload_file" },
      { badge: "REQUIRED", badgeClassName: "bg-orange-500/20 text-orange-400", deadline: "D-4", title: "Monthly: Power Usage", description: "Gwangyang Energy Center 2: Confirm Aug power data", actionText: "Finalize Data", actionIcon: "check_circle" },
      { badge: "VERIFICATION", badgeClassName: "bg-blue-500/20 text-blue-400", deadline: "D-10", title: "Ext. Verification: Factor", description: "Ulsan Chem Base 3: Validate Tier 3 calculation logic", actionText: "Review Logic", actionIcon: "calculate" },
      { badge: "UPDATE", badgeClassName: "bg-emerald-500/20 text-emerald-400", deadline: "TODAY", title: "Facility Change Detected", description: "Daejeon R&D: Verify new emission source info", actionText: "Update Master", actionIcon: "edit" }
    ],
    matrixTitle: "Required Data Matrix",
    matrixSubtitle: "Tracks real-time status of mandatory data fields and missing items per report.",
    filterTabs: ["View All", "Missing Only", "Verified"],
    exportButton: "Export Excel",
    tableHeaders: ["Site & Target Report", "Energy Consumption", "Emission Factor", "Evidence Docs", "Quality Assurance", "Fulfillment Rate", "Action"],
    tableRows: [
      { siteName: "Pohang Hot Rolling Plant 1", reportLabel: "2024 Regular Env Report", reportLabelClassName: "text-blue-600 bg-blue-50", energyStatus: "Completed", energyStatusClassName: "text-slate-600", energyIcon: "check_circle", factorStatus: "Tier 2 Fixed", factorStatusClassName: "text-slate-600", factorIcon: "check_circle", evidenceStatus: "1 Pending", evidenceStatusClassName: "text-orange-600 font-medium", evidenceIcon: "pending", evidencePulse: true, qaStatus: "Pre-review", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "75%", fulfillmentRateClassName: "text-slate-700", fulfillmentWidth: "75%", fulfillmentColorClass: "bg-indigo-500", actionLabel: "Process", actionClassName: "text-[var(--kr-gov-blue)] hover:underline" },
      { siteName: "Ulsan Chemical Base 3", reportLabel: "Carbon Audit Special", reportLabelClassName: "text-red-600 bg-red-50", energyStatus: "Missing", energyStatusClassName: "text-red-600 font-bold", energyIcon: "error", factorStatus: "Tier 3 Applied", factorStatusClassName: "text-slate-600", factorIcon: "check_circle", evidenceStatus: "No Files", evidenceStatusClassName: "text-red-600 font-bold", evidenceIcon: "error", qaStatus: "Suspended", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "20%", fulfillmentRateClassName: "text-red-600", fulfillmentWidth: "20%", fulfillmentColorClass: "bg-red-500", actionLabel: "Urgent Action", actionClassName: "bg-red-600 text-white hover:bg-red-700" },
      { siteName: "Gwangyang Energy Center 2", reportLabel: "Quarterly Disclosure", reportLabelClassName: "text-emerald-600 bg-emerald-50", energyStatus: "Verified", energyStatusClassName: "text-emerald-600", energyIcon: "verified", factorStatus: "Verified", factorStatusClassName: "text-emerald-600", factorIcon: "verified", evidenceStatus: "Proven", evidenceStatusClassName: "text-emerald-600", evidenceIcon: "verified", qaStatus: "Awaiting Appr.", qaStatusClassName: "text-blue-600 font-bold", qaIcon: "task_alt", fulfillmentRate: "100%", fulfillmentRateClassName: "text-emerald-600", fulfillmentWidth: "100%", fulfillmentColorClass: "bg-emerald-500", actionLabel: "Done", actionClassName: "text-slate-400 cursor-not-allowed" },
      { siteName: "Incheon Logistics Center", reportLabel: "Voluntary GHG Disclosure", reportLabelClassName: "text-slate-500 bg-slate-100", energyStatus: "Completed", energyStatusClassName: "text-slate-600", energyIcon: "check_circle", factorStatus: "Not Configured", factorStatusClassName: "text-slate-400", factorIcon: "circle", evidenceStatus: "Unregistered", evidenceStatusClassName: "text-slate-400", evidenceIcon: "circle", qaStatus: "Preparing", qaStatusClassName: "text-slate-400", qaIcon: "circle", fulfillmentRate: "30%", fulfillmentRateClassName: "text-slate-700", fulfillmentWidth: "30%", fulfillmentColorClass: "bg-slate-300", actionLabel: "Process", actionClassName: "text-[var(--kr-gov-blue)] hover:underline" }
    ],
    tableFooter: "※ This matrix is automatically generated based on active \"Data Fulfillment Demands\".",
    pagination: [1, 2],
    statsTitle: "Data Field Demand Stats",
    auditTitle: "Audit Readiness",
    auditValue: "72%",
    auditLabel: "2024 Env Audit Preparation",
    auditDate: "Ref Date: 2025.08.30",
    auditButton: "Check Detailed Checklist",
    pendingTitle: "Reports Pending Integration",
    pendingReports: [
      { title: "Annual GHG Inventory", missingCount: "Missing Data: 12 items", deadline: "D-12", deadlineClassName: "text-red-500" },
      { title: "Sustainability Report (ESG)", missingCount: "Missing Data: 4 items", deadline: "D-25", deadlineClassName: "text-orange-500" },
      { title: "KEA Regular Declaration", missingCount: "Missing Data: 1 item", deadline: "D-45", deadlineClassName: "text-slate-400" }
    ],
    footerTitle: "CCUS Integrated HQ",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Data Operations: 02-1234-5678",
    footerDescription: "Optimized for corporate data fulfillment and report quality management.",
    footerLinks: ["Privacy Policy", "Terms of Service", "Download Manual"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Data Manager Hub.",
    footerChip: "V 3.0.0 (Fulfillment Optimized)",
    waAlt: "Web Accessibility Mark"
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

function Co2DemandInlineStyles({ en }: { en: boolean }) {
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
      body { font-family: ${en ? "'Public Sans', sans-serif" : "'Noto Sans KR', 'Public Sans', sans-serif"}; -webkit-font-smoothing: antialiased; }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .gov-btn {
        padding: 0.625rem 1.25rem;
        font-weight: 700;
        border-radius: var(--kr-gov-radius);
        transition: background-color .2s ease, color .2s ease;
        outline: none;
      }
      .matrix-table {
        width: 100%;
        text-align: left;
        border-collapse: collapse;
      }
      .matrix-table th {
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        padding: 0.75rem 1rem;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .matrix-table td {
        padding: 1rem;
        border-bottom: 1px solid #f1f5f9;
        font-size: 14px;
      }
      .urgent-pulse {
        animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes pulse-ring {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      .demand-header-nav-active {
        border-bottom-width: 4px;
        border-color: var(--kr-gov-blue);
        color: var(--kr-gov-blue);
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      @media (max-width: 1279px) {
        .demand-header-nav { display: none; }
      }
    `}</style>
  );
}

export function Co2DemandListMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();

  useEffect(() => {
    function handleNavigationSync() {
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [session]);

  useEffect(() => {
    logGovernanceScope("PAGE", "co2-demand-list", {
      language: en ? "en" : "ko",
      menuCode: "H0030201",
      routePath: en ? "/en/co2/demand_list" : "/co2/demand_list"
    });
  }, [en]);

  return (
    <>
      <Co2DemandInlineStyles en={en} />
      <div className="bg-[#f8fafc] text-[var(--kr-gov-text-primary)] min-h-screen">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
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
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3 shrink-0">
                <a className="flex items-center gap-2 focus-visible" href={buildLocalizedPath("/home", "/en/home")}>
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>dataset</span>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
                    <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.logoSubtitle}</p>
                  </div>
                </a>
              </div>
              <nav className="demand-header-nav hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => (
                  <a
                    className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === content.activeNavIndex ? "demand-header-nav-active" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`}
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
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.managerRole}</span>
                  <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{content.managerName}</span>
                </div>
                <button className="relative w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-100" type="button">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">notifications</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">{content.notificationCount}</span>
                </button>
                <button
                  className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] text-sm focus-visible"
                  onClick={() => {
                    void session.logout();
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
          <section className="bg-slate-900 py-10 relative overflow-hidden border-b border-slate-800" data-help-id="co2-demand-assistant-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%"><pattern height="60" id="demand-dots" patternUnits="userSpaceOnUse" width="60"><circle cx="2" cy="2" fill="white" r="1"></circle></pattern><rect fill="url(#demand-dots)" height="100%" width="100%"></rect></svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="xl:w-1/4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">smart_toy</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.assistantTitle}</h2>
                      <p className="text-indigo-400 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span> {content.assistantSubtitle}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {content.assistantDescription}
                  </p>
                  <button className="w-full py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white text-sm font-bold transition-all flex items-center justify-center gap-2" type="button">
                    <span className="material-symbols-outlined text-sm">priority_high</span> {content.dashboardButton}
                  </button>
                </div>
                <div className="xl:w-3/4 w-full">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">schedule</span> {content.queueTitle}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {content.queueCards.map((card) => (
                      <div className="bg-white/5 backdrop-blur-md border-l-4 border-white/10 p-5 rounded-r-lg group hover:bg-white/10 transition-all cursor-pointer" style={{ borderLeftColor: card.badge.includes("URGENT") ? "#ef4444" : card.badge.includes("REQUIRED") ? "#f97316" : card.badge.includes("VERIFICATION") ? "#3b82f6" : "#10b981" }} key={card.title}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${card.badgeClassName}`}>{card.badge}</span>
                          <span className="text-[10px] font-bold text-slate-500 tracking-tighter">{card.deadline}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{card.title}</h4>
                        <p className="text-slate-400 text-[11px] mb-4">{card.description}</p>
                        <a className="inline-flex items-center text-[11px] font-bold text-indigo-400 hover:text-indigo-300 gap-1" href="#" onClick={(event) => event.preventDefault()}>
                          {card.actionText} <span className="material-symbols-outlined text-[14px]">{card.actionIcon}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="co2-demand-data-matrix">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>view_list</span>
                  {content.matrixTitle}
                </h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{content.matrixSubtitle}</p>
              </div>
              <div className="flex gap-2">
                <div className="bg-white border border-slate-200 rounded-lg p-1 flex shadow-sm">
                  {content.filterTabs.map((tab, index) => (
                    <button className={`px-4 py-2 text-xs font-bold rounded ${index === 0 ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`} key={tab} type="button">
                      {tab}
                    </button>
                  ))}
                </div>
                <button className="gov-btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-2" type="button">
                  <span className="material-symbols-outlined text-[18px]">download</span> {content.exportButton}
                </button>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th className="w-[250px]">{content.tableHeaders[0]}</th>
                      <th>{content.tableHeaders[1]}</th>
                      <th>{content.tableHeaders[2]}</th>
                      <th>{content.tableHeaders[3]}</th>
                      <th>{content.tableHeaders[4]}</th>
                      <th className="text-center">{content.tableHeaders[5]}</th>
                      <th className="text-center">{content.tableHeaders[6]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.tableRows.map((row, rowIndex) => (
                      <tr className="hover:bg-blue-50/30 transition-colors" key={rowIndex}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{row.siteName}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit mt-1 ${row.reportLabelClassName}`}>{row.reportLabel}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[20px] ${row.energyStatus.includes("검증") || row.energyStatus.includes("Verified") || row.energyStatus.includes("Completed") ? "text-emerald-500" : row.energyStatus.includes("누락") || row.energyStatus.includes("Missing") ? "text-red-500" : "text-emerald-500"}`} style={{ animation: row.energyStatus.includes("누락") || row.energyStatus.includes("Missing") ? "pulse-ring 2s infinite" : undefined }}>{row.energyIcon}</span>
                            <span className={`text-xs ${row.energyStatusClassName}`}>{row.energyStatus}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[20px] ${row.factorStatus.includes("검증") || row.factorStatus.includes("Verified") || row.factorStatus.includes("확정") || row.factorStatus.includes("Applied") || row.factorStatus.includes("Fixed") ? "text-emerald-500" : "text-emerald-500"}`}>{row.factorIcon}</span>
                            <span className={`text-xs ${row.factorStatusClassName}`}>{row.factorStatus}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[20px] ${row.evidenceStatus.includes("검증") || row.evidenceStatus.includes("Verified") || row.evidenceStatus.includes("완료") || row.evidenceStatus.includes("Proven") ? "text-emerald-500" : row.evidenceStatus.includes("미제출") || row.evidenceStatus.includes("No Files") ? "text-red-500 urgent-pulse" : row.evidenceStatus.includes("대기") || row.evidenceStatus.includes("Pending") ? "text-orange-500 urgent-pulse" : "text-slate-300"}`}>{row.evidenceIcon}</span>
                            <span className={`text-xs ${row.evidenceStatusClassName}`}>{row.evidenceStatus}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[20px] ${row.qaStatus.includes("검증") || row.qaStatus.includes("Verified") || row.qaStatus.includes("완료") || row.qaStatus.includes("Done") ? "text-blue-500" : "text-slate-300"}`}>{row.qaIcon}</span>
                            <span className={`text-xs ${row.qaStatusClassName}`}>{row.qaStatus}</span>
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-bold ${row.fulfillmentRateClassName}`}>{row.fulfillmentRate}</span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${row.fulfillmentColorClass}`} style={{ width: row.fulfillmentWidth }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center">
                          <button className={`px-3 py-1.5 rounded text-[11px] font-bold ${row.actionClassName}`} type="button">{row.actionLabel}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <p className="text-[11px] text-slate-500 font-medium">{content.tableFooter}</p>
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-white" type="button"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                  {content.pagination.map((num) => (
                    <button key={num} className={`w-8 h-8 rounded border flex items-center justify-center font-bold text-xs ${num === 1 ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 text-slate-500 hover:bg-white"}`} type="button">{num}</button>
                  ))}
                  <button className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-white" type="button"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                </div>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pb-20" data-help-id="co2-demand-stats-cards">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500">analytics</span>
                  {content.statsTitle}
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500">{en ? "Evidence Collection Rate" : "증빙 서류 확보율"}</span>
                      <span className="text-indigo-600">62%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: "62%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500">{en ? "Emission Factor Updates" : "배출 계수 최신화"}</span>
                      <span className="text-emerald-600">88%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: "88%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500">{en ? "Activity Data Consistency" : "활동 자료 정합성"}</span>
                      <span className="text-orange-500">45%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full" style={{ width: "45%" }}></div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 p-4 bg-indigo-50 rounded-lg">
                  <p className="text-[11px] text-indigo-700 font-bold leading-relaxed">
                    <span className="material-symbols-outlined text-[14px] align-middle">lightbulb</span> 
                    {en ? " Currently, 'Activity Data Consistency' shows the lowest value. Please prioritize cross-referencing power and fuel receipts." : " 현재 '활동 자료 정합성'이 가장 낮은 수치를 기록하고 있습니다. 전력 및 연료 영수증 대조 작업을 우선적으로 수행하십시오."}
                  </p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500">fact_check</span>
                  {content.auditTitle}
                </h3>
                <div className="flex-1 flex flex-col items-center justify-center py-4">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90">
                      <circle className="text-slate-100" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="12"></circle>
                      <circle className="text-blue-600" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364.4" strokeDashoffset="100" strokeLinecap="round" strokeWidth="12"></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-800">{content.auditValue}</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-600">{content.auditLabel}</p>
                  <p className="text-xs text-slate-400 mt-1">{content.auditDate}</p>
                </div>
                <button className="w-full py-3 border border-blue-200 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50 transition-colors" type="button">
                  {content.auditButton}
                </button>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">description</span>
                  {content.pendingTitle}
                </h3>
                <div className="space-y-4">
                  {content.pendingReports.map((report, index) => (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100" key={index}>
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400">text_snippet</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">{report.title}</p>
                        <p className="text-[10px] text-slate-500">{report.missingCount}</p>
                      </div>
                      <span className={`text-[10px] font-black ${report.deadlineClassName}`}>{report.deadline}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={content.govAlt} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{content.footerTitle}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed">
                  {content.footerAddress}<br />
                  {content.footerDescription}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                {content.footerLinks.map((link) => (
                  <a className={link === content.footerLinks[0] ? "text-[var(--kr-gov-blue)] hover:underline" : "text-gray-600 hover:underline"} href="#" key={link} onClick={(event) => event.preventDefault()}>
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
