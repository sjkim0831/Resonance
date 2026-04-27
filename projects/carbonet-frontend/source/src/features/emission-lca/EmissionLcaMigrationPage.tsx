import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderMobileMenu } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type QueueAlert = { label: string; labelClass: string; title: string; due: string };
type ComplianceRow = {
  site: string;
  siteId: string;
  standards: Array<{ label: string; className: string }>;
  status: string;
  statusClass: string;
  dotClass: string;
  intensity: string;
  unit: string;
  action: string;
  actionClass: string;
  actionIcon: string;
};
type Milestone = { date: string; statusClass: string; dotClass: string; title: string; body: string; progress?: string };
type SiteHubCard = {
  icon: string;
  iconWrapClass: string;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string; tone: string }>;
  primaryLabel: string;
  primaryClass: string;
  primaryIcon: string;
  secondaryLabel: string;
};
type LocalizedLcaContent = {
  skipLink: string;
  govAlt: string;
  govText: string;
  govNotice: string;
  title: string;
  subtitle: string;
  roleLabel: string;
  userName: string;
  logout: string;
  navItems: string[];
  queueTitle: string;
  queueSubtitle: string;
  queueAlerts: QueueAlert[];
  statusTitle: string;
  statusSubtitle: string;
  filterLabel: string;
  reportLabel: string;
  tableHeaders: string[];
  complianceRows: ComplianceRow[];
  milestonesTitle: string;
  milestones: Milestone[];
  watchTitle: string;
  watchLabel: string;
  watchHeadline: string;
  watchBody: string;
  watchLink: string;
  watchButton: string;
  siteHubTitle: string;
  siteHubSubtitle: string;
  siteCards: SiteHubCard[];
  footerTitle: string;
  footerAddress: string;
  footerPolicy: string;
  footerTerms: string;
  footerManual: string;
  footerCopy: string;
};

const CONTENT: Record<"ko" | "en", LocalizedLcaContent> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "대한민국 정부 공식 서비스 | 규제 대응 지능형 LCA 관리 시스템",
    govNotice: "규제 업데이트 탐지: 2시간 전 (CBAM 신규 요건)",
    title: "LCA 분석 & 규제 준수 센터",
    subtitle: "Regulatory Compliance & Reporting Hub",
    roleLabel: "환경 규제 총괄",
    userName: "이현장 관리자님",
    logout: "로그아웃",
    navItems: ["전체 모니터링", "LCA 분석", "규제 대응 보고서", "검증 이력 관리"],
    queueTitle: "Your Update Queue",
    queueSubtitle: "실시간 규제 업데이트 알림",
    queueAlerts: [
      { label: "Critical", labelClass: "bg-red-500 text-white", title: "울산 제3: CBAM 보고서 누락", due: "마감: D-2" },
      { label: "Required", labelClass: "bg-amber-500 text-white", title: "포항 제1: ISO 14067 갱신", due: "마감: D-15" },
      { label: "Task", labelClass: "bg-blue-500 text-white", title: "광양 제2: 검증 증빙 업로드", due: "마감: D-7" }
    ],
    statusTitle: "LCA Compliance Status",
    statusSubtitle: "관리 사이트별 산업 표준 및 규제 준수 현황",
    filterLabel: "필터",
    reportLabel: "통합 리포트",
    tableHeaders: ["배출지 / 시설 ID", "적용 표준", "인증 현황", "배출 집약도", "준수 보고서"],
    complianceRows: [
      { site: "포항 제1 열연공장", siteId: "PH-001", standards: [{ label: "ISO 14067", className: "bg-blue-50 text-blue-600 border border-blue-100" }, { label: "WBCSD", className: "bg-slate-50 text-slate-600 border border-slate-200" }], status: "인증 유효", statusClass: "text-emerald-600", dotClass: "bg-emerald-500", intensity: "1.84", unit: "kgCO2e/kg", action: "생성", actionClass: "text-[var(--kr-gov-blue)]", actionIcon: "picture_as_pdf" },
      { site: "울산 제3 화학기지", siteId: "US-042", standards: [{ label: "EU CBAM", className: "bg-indigo-50 text-indigo-600 border border-indigo-100" }, { label: "ISO 14044", className: "bg-slate-50 text-slate-600 border border-slate-200" }], status: "갱신 지연", statusClass: "text-red-600", dotClass: "bg-red-500", intensity: "3.12", unit: "kgCO2e/kg", action: "보완 필요", actionClass: "text-red-500", actionIcon: "priority_high" },
      { site: "광양 제2 에너지센터", siteId: "GN-112", standards: [{ label: "ISO 14067", className: "bg-blue-50 text-blue-600 border border-blue-100" }], status: "검증 진행중", statusClass: "text-blue-600", dotClass: "bg-blue-500", intensity: "0.45", unit: "kgCO2e/MJ", action: "대기", actionClass: "text-slate-400", actionIcon: "lock" }
    ],
    milestonesTitle: "Verification Milestones",
    milestones: [
      { date: "2025.08.01 - Completed", statusClass: "text-emerald-600", dotClass: "bg-emerald-500", title: "내부 LCA 데이터 전수 조사", body: "포항/인천 전 사이트 데이터 확정 완료" },
      { date: "2025.08.14 - In Progress", statusClass: "text-blue-600", dotClass: "bg-blue-500", title: "외부 3자 검증 개시", body: "한국표준협회(KSA) 현장 심사 진행 중", progress: "65%" },
      { date: "2025.09.10 - Scheduled", statusClass: "text-slate-400", dotClass: "bg-slate-300", title: "ISO 14067 인증서 발급", body: "최종 심의 및 인증 등록 예정" }
    ],
    watchTitle: "Compliance Watch",
    watchLabel: "New Regulation Alert",
    watchHeadline: "EU CBAM 4차 보고 의무화",
    watchBody: "간접 배출량 산정 방식 변경 적용 필요",
    watchLink: "지침 확인하기",
    watchButton: "규제 대응 매뉴얼 다운로드",
    siteHubTitle: "Site-Specific Reporting Hub",
    siteHubSubtitle: "각 사이트별 LCA 상세 분석 및 공식 보고서 생성",
    siteCards: [
      { icon: "factory", iconWrapClass: "bg-blue-50 text-[var(--kr-gov-blue)]", badge: "Audit Ready", badgeClass: "bg-emerald-100 text-emerald-700", title: "포항 제1 열연공장", subtitle: "마지막 검증: 2025.07.20", metrics: [{ label: "GWP Total", value: "4,120 t", tone: "text-slate-800" }, { label: "Data Quality", value: "High (98%)", tone: "text-emerald-600" }], primaryLabel: "LCA 보고서 생성", primaryClass: "bg-[var(--kr-gov-blue)] text-white", primaryIcon: "post_add", secondaryLabel: "상세 산정 로직 확인" },
      { icon: "science", iconWrapClass: "bg-orange-50 text-orange-600", badge: "Action Required", badgeClass: "bg-orange-100 text-orange-700", title: "울산 제3 화학기지", subtitle: "규제 보완 요청: 3시간 전", metrics: [{ label: "GWP Total", value: "8,540 t", tone: "text-slate-800" }, { label: "Data Quality", value: "Medium (72%)", tone: "text-orange-600" }], primaryLabel: "데이터 보완하기", primaryClass: "bg-orange-600 text-white", primaryIcon: "upload_file", secondaryLabel: "검증관 코멘트 (2)" },
      { icon: "energy_savings_leaf", iconWrapClass: "bg-blue-50 text-blue-600", badge: "Verifying", badgeClass: "bg-blue-100 text-blue-700", title: "광양 제2 에너지센터", subtitle: "검증 종료 예정: D-10", metrics: [{ label: "GWP Total", value: "12,890 t", tone: "text-slate-800" }, { label: "Compliance", value: "In Progress", tone: "text-blue-600" }], primaryLabel: "실시간 검증 현황", primaryClass: "bg-blue-600 text-white", primaryIcon: "visibility", secondaryLabel: "이전 인증 이력 보기" }
    ],
    footerTitle: "CCUS Integrated HO",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Compliance Support: 02-1234-5678\nThis platform supports corporate LCA analysis and regulatory optimization.",
    footerPolicy: "Privacy Policy",
    footerTerms: "Terms of Service",
    footerManual: "Regulatory Manual",
    footerCopy: "© 2025 CCUS LCA Compliance Portal. Regulatory-Minded Site Management."
  },
  en: {
    skipLink: "Skip to content",
    govAlt: "Government Symbol",
    govText: "Republic of Korea Official Service | Regulatory-Minded Intelligent LCA Management System",
    govNotice: "Regulatory Update: 2 hours ago (New CBAM Requirements)",
    title: "LCA Analysis & Compliance Center",
    subtitle: "Regulatory Compliance & Reporting Hub",
    roleLabel: "Environmental Regulatory Lead",
    userName: "Admin Hyunjang Lee",
    logout: "Logout",
    navItems: ["Full Monitoring", "LCA Analysis", "Compliance Reports", "Verification History"],
    queueTitle: "Your Update Queue",
    queueSubtitle: "Real-time Regulatory Alerts",
    queueAlerts: [
      { label: "Critical", labelClass: "bg-red-500 text-white", title: "Ulsan #3: CBAM Report Missing", due: "Due: D-2" },
      { label: "Required", labelClass: "bg-amber-500 text-white", title: "Pohang #1: ISO 14067 Renewal", due: "Due: D-15" },
      { label: "Task", labelClass: "bg-blue-500 text-white", title: "Gwangyang #2: Upload Evidence", due: "Due: D-7" }
    ],
    statusTitle: "LCA Compliance Status",
    statusSubtitle: "Compliance status by managed site against industry standards",
    filterLabel: "Filter",
    reportLabel: "Consolidated Report",
    tableHeaders: ["Site / Facility ID", "Applied Standards", "Certification Status", "Emission Intensity", "Compliance Report"],
    complianceRows: [
      { site: "Pohang #1 Hot Rolling Mill", siteId: "PH-001", standards: [{ label: "ISO 14067", className: "bg-blue-50 text-blue-600 border border-blue-100" }, { label: "WBCSD", className: "bg-slate-50 text-slate-600 border border-slate-200" }], status: "Certified", statusClass: "text-emerald-600", dotClass: "bg-emerald-500", intensity: "1.84", unit: "kgCO2e/kg", action: "Generate", actionClass: "text-[var(--kr-gov-blue)]", actionIcon: "picture_as_pdf" },
      { site: "Ulsan #3 Chemical Base", siteId: "US-042", standards: [{ label: "EU CBAM", className: "bg-indigo-50 text-indigo-600 border border-indigo-100" }, { label: "ISO 14044", className: "bg-slate-50 text-slate-600 border border-slate-200" }], status: "Renewal Overdue", statusClass: "text-red-600", dotClass: "bg-red-500", intensity: "3.12", unit: "kgCO2e/kg", action: "Action Required", actionClass: "text-red-500", actionIcon: "priority_high" },
      { site: "Gwangyang #2 Energy Center", siteId: "GN-112", standards: [{ label: "ISO 14067", className: "bg-blue-50 text-blue-600 border border-blue-100" }], status: "Verifying", statusClass: "text-blue-600", dotClass: "bg-blue-500", intensity: "0.45", unit: "kgCO2e/MJ", action: "Pending", actionClass: "text-slate-400", actionIcon: "lock" }
    ],
    milestonesTitle: "Verification Milestones",
    milestones: [
      { date: "2025.08.01 - Completed", statusClass: "text-emerald-600", dotClass: "bg-emerald-500", title: "Internal LCA Data Census", body: "Data finalized for all Pohang/Incheon sites" },
      { date: "2025.08.14 - In Progress", statusClass: "text-blue-600", dotClass: "bg-blue-500", title: "3rd-Party Verification Start", body: "KSA on-site audit now in progress", progress: "65%" },
      { date: "2025.09.10 - Scheduled", statusClass: "text-slate-400", dotClass: "bg-slate-300", title: "ISO 14067 Certificate Issuance", body: "Final review and certification registration pending" }
    ],
    watchTitle: "Compliance Watch",
    watchLabel: "New Regulation Alert",
    watchHeadline: "EU CBAM 4th Phase Reporting Mandate",
    watchBody: "Indirect emission calculation method update required",
    watchLink: "View Guidelines",
    watchButton: "Download Compliance Manual",
    siteHubTitle: "Site-Specific Reporting Hub",
    siteHubSubtitle: "Detailed LCA analysis and official report generation for each site",
    siteCards: [
      { icon: "factory", iconWrapClass: "bg-blue-50 text-[var(--kr-gov-blue)]", badge: "Audit Ready", badgeClass: "bg-emerald-100 text-emerald-700", title: "Pohang #1 Hot Rolling Mill", subtitle: "Last verification: 2025.07.20", metrics: [{ label: "GWP Total", value: "4,120 t", tone: "text-slate-800" }, { label: "Data Quality", value: "High (98%)", tone: "text-emerald-600" }], primaryLabel: "Generate LCA Report", primaryClass: "bg-[var(--kr-gov-blue)] text-white", primaryIcon: "post_add", secondaryLabel: "View Calculation Logic" },
      { icon: "science", iconWrapClass: "bg-orange-50 text-orange-600", badge: "Action Required", badgeClass: "bg-orange-100 text-orange-700", title: "Ulsan #3 Chemical Base", subtitle: "Regulatory supplement requested: 3 hours ago", metrics: [{ label: "GWP Total", value: "8,540 t", tone: "text-slate-800" }, { label: "Data Quality", value: "Medium (72%)", tone: "text-orange-600" }], primaryLabel: "Update Data", primaryClass: "bg-orange-600 text-white", primaryIcon: "upload_file", secondaryLabel: "Auditor Comments (2)" },
      { icon: "energy_savings_leaf", iconWrapClass: "bg-blue-50 text-blue-600", badge: "Verifying", badgeClass: "bg-blue-100 text-blue-700", title: "Gwangyang #2 Energy Center", subtitle: "Verification ends in D-10", metrics: [{ label: "GWP Total", value: "12,890 t", tone: "text-slate-800" }, { label: "Compliance", value: "In Progress", tone: "text-blue-600" }], primaryLabel: "Live Status", primaryClass: "bg-blue-600 text-white", primaryIcon: "visibility", secondaryLabel: "View Past Certifications" }
    ],
    footerTitle: "CCUS Integrated HO",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Compliance Support: 02-1234-5678\nThis platform supports corporate LCA analysis and regulatory optimization.",
    footerPolicy: "Privacy Policy",
    footerTerms: "Terms of Service",
    footerManual: "Regulatory Manual",
    footerCopy: "© 2025 CCUS LCA Compliance Portal. Regulatory-Minded Site Management."
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

function InlineStyles({ en }: { en: boolean }) {
  return <style>{`
    :root { --kr-gov-blue:#00378b; --kr-gov-blue-hover:#002d72; --kr-gov-text-primary:#1a1a1a; --kr-gov-text-secondary:#4d4d4d; --kr-gov-border-light:#d9d9d9; --kr-gov-focus:#005fde; --kr-gov-bg-gray:#f2f2f2; --kr-gov-radius:5px; }
    body { font-family:${en ? "'Public Sans', 'Noto Sans KR', sans-serif" : "'Noto Sans KR', 'Public Sans', sans-serif"}; -webkit-font-smoothing:antialiased; background:#f4f7fa; }
    .skip-link { position:absolute; top:-100px; left:0; background:var(--kr-gov-blue); color:white; padding:12px; z-index:100; transition:top .2s ease; }
    .skip-link:focus { top:0; }
    .focus-visible:focus-visible { outline:3px solid var(--kr-gov-focus); outline-offset:2px; }
    .material-symbols-outlined { font-variation-settings:'wght' 400, 'opsz' 24; font-size:24px; }
    .gov-btn { border-radius:var(--kr-gov-radius); font-weight:700; transition:background-color .2s ease, color .2s ease, border-color .2s ease; }
    .audit-table-row { border-bottom:1px solid #f1f5f9; transition:background-color .2s ease; }
    .audit-table-row:hover { background:#f8fafc; }
    .timeline-dot { width:10px; height:10px; border-radius:9999px; border:2px solid white; position:absolute; left:-5px; top:4px; }
    .status-pill { padding:2px 8px; border-radius:6px; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:-0.01em; }
    body.mobile-menu-open { overflow:hidden; }
  `}</style>;
}

export function EmissionLcaMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const sharedContent = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const payloadState = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], {
    initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
    onError: () => undefined
  });

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
    logGovernanceScope("PAGE", "emission-lca", { language: en ? "en" : "ko", queueCount: content.queueAlerts.length, complianceRowCount: content.complianceRows.length, siteCardCount: content.siteCards.length });
    logGovernanceScope("COMPONENT", "emission-lca-dashboard", { milestoneCount: content.milestones.length, isLoggedIn: Boolean(payload.isLoggedIn), menuCount: homeMenu.length });
  }, [content.complianceRows.length, content.milestones.length, content.queueAlerts.length, content.siteCards.length, en, homeMenu.length, payload.isLoggedIn]);

  return (
    <>
      <InlineStyles en={en} />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" src={GOV_SYMBOL} onError={handleGovSymbolError} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{content.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]"><p>{content.govNotice}</p></div>
          </div>
        </div>
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="relative flex justify-between items-center h-20">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <a className="flex items-center gap-2 shrink-0" href={buildLocalizedPath("/emission/lca", "/en/emission/lca")}>
                <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>analytics</span>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.title}</h1>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.subtitle}</p>
                </div>
              </a>
              <nav className="hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => <a key={item} className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === 1 ? "text-[var(--kr-gov-blue)] border-[var(--kr-gov-blue)]" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`} href={index === 1 ? buildLocalizedPath("/emission/lca", "/en/emission/lca") : "#"}>{item}</a>)}
              </nav>
              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.roleLabel}</span>
                  <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{content.userName}</span>
                </div>
                <div className="hidden md:flex relative w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200">
                  <span className="material-symbols-outlined text-slate-600">notifications</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
                </div>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/lca")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/lca")}>EN</button>
                </div>
                <button type="button" className="hidden xl:inline-flex gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] px-4 py-2 text-sm" onClick={() => void session.logout()}>{content.logout}</button>
                <button id="mobile-menu-toggle" className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible" type="button" aria-controls="mobile-menu" aria-expanded={mobileMenuOpen} aria-label={sharedContent.openAllMenu} onClick={() => setMobileMenuOpen((current) => !current)}>
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={sharedContent.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu content={sharedContent} en={en} homeMenu={homeMenu} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} />
        </div>
        <main id="main-content">
          <section className="bg-slate-800 border-b border-slate-700 py-6" data-help-id="emission-lca-queue">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="flex items-center gap-4 shrink-0">
                  <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20"><span className="material-symbols-outlined text-[28px]">smart_toy</span></div>
                  <div><h2 className="text-white font-black text-lg">{content.queueTitle}</h2><p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">{content.queueSubtitle}</p></div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  {content.queueAlerts.map((alert) => <div className="bg-white/5 border border-white/10 p-3 rounded-lg flex items-center justify-between group hover:bg-white/10 cursor-pointer transition-all" key={alert.title}><div className="flex items-center gap-3"><span className={`status-pill ${alert.labelClass}`}>{alert.label}</span><div className="text-xs"><p className="text-white font-bold">{alert.title}</p><p className="text-slate-400">{alert.due}</p></div></div><span className="material-symbols-outlined text-indigo-400 group-hover:translate-x-1 transition-transform">arrow_forward</span></div>)}
                </div>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-10" data-help-id="emission-lca-status">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <div className="bg-white border border-[var(--kr-gov-border-light)] rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                    <div><h2 className="text-xl font-black text-slate-800">{content.statusTitle}</h2><p className="text-sm text-slate-500 font-medium">{content.statusSubtitle}</p></div>
                    <div className="flex gap-2">
                      <button className="gov-btn bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 flex items-center gap-2 px-4 py-2 text-sm" type="button"><span className="material-symbols-outlined text-[18px]">filter_list</span>{content.filterLabel}</button>
                      <button className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] flex items-center gap-2 px-4 py-2 text-sm" type="button"><span className="material-symbols-outlined text-[18px]">download</span>{content.reportLabel}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-gray-200">{content.tableHeaders.map((header) => <th className="px-6 py-4" key={header}>{header}</th>)}</tr></thead>
                      <tbody className="text-sm">
                        {content.complianceRows.map((row) => <tr className="audit-table-row" key={row.siteId}><td className="px-6 py-5"><div className="flex flex-col"><span className="font-bold text-slate-800">{row.site}</span><span className="text-[10px] text-slate-400">{row.siteId}</span></div></td><td className="px-6 py-5"><div className="flex flex-wrap gap-1">{row.standards.map((standard) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${standard.className}`} key={standard.label}>{standard.label}</span>)}</div></td><td className="px-6 py-5"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${row.dotClass}`} /><span className={`font-bold ${row.statusClass}`}>{row.status}</span></div></td><td className="px-6 py-5"><div className="flex items-baseline gap-1"><span className="font-black text-slate-800">{row.intensity}</span><span className="text-[10px] font-bold text-slate-400">{row.unit}</span></div></td><td className="px-6 py-5"><button className={`${row.actionClass} font-bold flex items-center gap-1 hover:underline`} type="button"><span className="material-symbols-outlined text-[16px]">{row.actionIcon}</span>{row.action}</button></td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/3 space-y-6">
                <div className="bg-white border border-[var(--kr-gov-border-light)] rounded-xl p-6 shadow-sm" data-help-id="emission-lca-milestones">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">event_repeat</span>{content.milestonesTitle}</h3>
                  <div className="space-y-6 ml-1 border-l border-gray-100 relative">
                    {content.milestones.map((milestone) => <div className="relative pl-6" key={milestone.title}><span className={`timeline-dot ${milestone.dotClass}`} /><p className={`text-[10px] font-bold uppercase ${milestone.statusClass}`}>{milestone.date}</p><h4 className="text-xs font-bold text-slate-800">{milestone.title}</h4><p className="text-[11px] text-slate-500">{milestone.body}</p>{milestone.progress ? <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: milestone.progress }} /></div> : null}</div>)}
                  </div>
                </div>
                <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg shadow-indigo-900/20 relative overflow-hidden" data-help-id="emission-lca-watch">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><span className="material-symbols-outlined text-[80px]">gavel</span></div>
                  <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-4">{content.watchTitle}</h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-white/10 rounded-lg border border-white/10"><p className="text-[11px] font-bold text-indigo-200">{content.watchLabel}</p><h4 className="text-sm font-bold">{content.watchHeadline}</h4><p className="text-[11px] text-indigo-100/70 mt-1">{content.watchBody}</p><a className="inline-flex items-center gap-1 text-[10px] font-black text-white mt-3 underline" href="#">{content.watchLink}</a></div>
                    <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-xs font-black transition-colors" type="button">{content.watchButton}</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="bg-white border-t border-gray-200 py-12" data-help-id="emission-lca-site-hub">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="mb-8"><h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-[var(--kr-gov-blue)]">description</span>{content.siteHubTitle}</h2><p className="text-slate-500 text-sm">{content.siteHubSubtitle}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.siteCards.map((card) => <div className="border border-gray-200 rounded-xl p-6 transition-all hover:border-[var(--kr-gov-blue)]" key={card.title}><div className="flex justify-between items-start mb-6"><div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.iconWrapClass}`}><span className="material-symbols-outlined">{card.icon}</span></div><span className={`status-pill ${card.badgeClass}`}>{card.badge}</span></div><h3 className="text-lg font-black text-slate-800 mb-1">{card.title}</h3><p className="text-xs text-slate-400 mb-6 font-medium tracking-tight">{card.subtitle}</p><div className="grid grid-cols-2 gap-3 mb-6">{card.metrics.map((metric) => <div className="bg-slate-50 p-3 rounded-lg border border-slate-100" key={metric.label}><p className="text-[10px] text-slate-400 font-bold uppercase">{metric.label}</p><p className={`text-lg font-black tracking-tighter ${metric.tone}`}>{metric.value}</p></div>)}</div><div className="space-y-2"><button className={`w-full py-2.5 text-[12px] font-black rounded-lg flex items-center justify-center gap-2 ${card.primaryClass}`} type="button"><span className="material-symbols-outlined text-[18px]">{card.primaryIcon}</span>{card.primaryLabel}</button><button className="w-full py-2.5 bg-white border border-gray-200 text-slate-600 text-[12px] font-bold rounded-lg hover:bg-slate-50 transition-colors" type="button">{card.secondaryLabel}</button></div></div>)}
              </div>
            </div>
          </section>
        </main>
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4"><div className="flex items-center gap-3"><img alt={content.govAlt} className="h-8 grayscale" src={GOV_SYMBOL} onError={handleGovSymbolError} /><span className="text-xl font-black text-slate-800">{content.footerTitle}</span></div><address className="not-italic text-sm text-slate-500 leading-relaxed whitespace-pre-line">{content.footerAddress}</address></div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold text-slate-600"><a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{content.footerPolicy}</a><a className="hover:underline" href="#">{content.footerTerms}</a><a className="hover:underline" href="#">{content.footerManual}</a></div>
            </div>
            <div className="mt-8 text-xs font-medium text-slate-400"><p>{content.footerCopy}</p></div>
          </div>
        </footer>
      </div>
    </>
  );
}
