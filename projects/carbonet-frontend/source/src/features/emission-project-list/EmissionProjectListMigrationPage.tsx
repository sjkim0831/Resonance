import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type QueueItem = {
  level: string;
  levelClass: string;
  due: string;
  title: string;
  description: string;
  cta: string;
  icon: string;
};

type SiteCard = {
  status: string;
  statusClass: string;
  id: string;
  title: string;
  noticeClass: string;
  noticeIcon: string;
  notice: string;
  noticeLink: string;
  valueLabel: string;
  value: string;
  valueTone: string;
  actions: Array<{ label: string; icon: string; solid?: boolean }>;
  activity: Array<{ title: string; meta: string }>;
  sparkline: string;
  accentClass: string;
  pinClass: string;
};

type GeneralSite = {
  id: string;
  title: string;
  value: string;
  status: string;
  statusClass: string;
  action: string;
  actionClass: string;
};

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionProjectListInlineStyles() {
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
      }
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
        transition: background-color .2s ease, color .2s ease, border-color .2s ease;
        outline: none;
      }
      .gov-card {
        border: 1px solid var(--kr-gov-border-light);
        border-radius: var(--kr-gov-radius);
        background: white;
        transition: all .2s ease;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .status-badge {
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
      }
      .activity-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: .5rem;
        width: .375rem;
        height: .375rem;
        border-radius: 9999px;
        background: #d1d5db;
      }
      .activity-item:not(:last-child)::after {
        content: '';
        position: absolute;
        left: 2.5px;
        top: 1rem;
        width: 1px;
        height: calc(100% + .5rem);
        background: #f3f4f6;
      }
      .urgent-pulse {
        animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .home-brand-copy { min-width: 0; }
      .home-brand-title {
        margin: 0 !important;
        font-size: inherit !important;
        line-height: 1.2 !important;
      }
      .home-brand-subtitle {
        margin: 0 !important;
        line-height: 1.2;
      }
      .gnb-item:hover .gnb-depth2 { display: block; }
      .gnb-depth2 { width: 560px !important; padding: 10px; }
      .gnb-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .gnb-section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: #fafafa; }
      .gnb-section-title { display: block; font-size: 12px; font-weight: 700; color: var(--kr-gov-blue); margin-bottom: 6px; padding: 0 4px; }
      body.mobile-menu-open { overflow: hidden; }
      @keyframes pulse-ring {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
    `}</style>
  );
}

export function EmissionProjectListMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
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
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];
  const adminSiteManagementHref = buildLocalizedPath(
    "/admin/emission/site-management",
    "/en/admin/emission/site-management"
  );

  const queueItems = useMemo<QueueItem[]>(() => en ? [
    { level: "CRITICAL", levelClass: "bg-red-500/20 text-red-400", due: "D-2", title: "Ulsan Site 3: Supplement Document", description: "Missing supporting files detected after emission-factor recalculation.", cta: "Start update", icon: "arrow_forward" },
    { level: "REQUIRED", levelClass: "bg-orange-500/20 text-orange-400", due: "D-5", title: "Pohang Site 1: Energy Data", description: "August week-2 power statement must be reconciled and confirmed.", cta: "Open data input", icon: "open_in_new" },
    { level: "VERIFICATION", levelClass: "bg-blue-500/20 text-blue-400", due: "D-12", title: "Gwangyang Site 2: Verification", description: "QA checklist is 85% complete and 3 items remain.", cta: "Open checklist", icon: "fact_check" },
    { level: "INSIGHT", levelClass: "bg-emerald-500/20 text-emerald-400", due: "TODAY", title: "Emission target variance", description: "Current trend is moving outside this year's reduction target range.", cta: "Open analysis report", icon: "trending_down" }
  ] : [
    { level: "CRITICAL", levelClass: "bg-red-500/20 text-red-400", due: "D-2", title: "울산 제3: 보완 서류 제출", description: "공정 배출계수 재산정 로직에 따른 증빙 서류 누락 탐지", cta: "업데이트 시작", icon: "arrow_forward" },
    { level: "REQUIRED", levelClass: "bg-orange-500/20 text-orange-400", due: "D-5", title: "포항 제1: 에너지 데이터", description: "8월 2주차 전력 사용량 고지서 대조 및 최종 확정 필요", cta: "데이터 입력기", icon: "open_in_new" },
    { level: "VERIFICATION", levelClass: "bg-blue-500/20 text-blue-400", due: "D-12", title: "광양 제2: 검증 준비", description: "품질 보증 체크리스트 85% 완료. 마지막 3개 항목 확인", cta: "체크리스트 열기", icon: "fact_check" },
    { level: "INSIGHT", levelClass: "bg-emerald-500/20 text-emerald-400", due: "TODAY", title: "배출 목표 분석 확인", description: "현재 배출 트렌드가 올해 감축 목표 범위를 벗어남", cta: "분석 리포트", icon: "trending_down" }
  ], [en]);

  const dedicatedSites = useMemo<SiteCard[]>(() => en ? [
    {
      status: "Normal Operation", statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200", id: "PH-001", title: "Pohang Hot Rolling Mill 1",
      noticeClass: "bg-indigo-50/50 border-b border-indigo-100", noticeIcon: "notifications_active", notice: "Week-2 August data reconciliation is required.", noticeLink: "Run now",
      valueLabel: "Current Emission (Real-time)", value: "2,341", valueTone: "text-[var(--kr-gov-blue)]",
      actions: [{ label: "Data Input", icon: "edit_square" }, { label: "Calculation Logic", icon: "calculate" }],
      activity: [{ title: "Energy data confirmed (Admin)", meta: "12 min ago · validation completed" }, { title: "Tier 3 factor updated", meta: "Yesterday · auto optimization" }],
      sparkline: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4", accentClass: "border-t-[var(--kr-gov-blue)]", pinClass: "text-[var(--kr-gov-blue)]"
    },
    {
      status: "Input Delayed (65%)", statusClass: "bg-orange-100 text-orange-700 border border-orange-200", id: "US-042", title: "Ulsan Chemical Base 3",
      noticeClass: "bg-red-50 border-b border-red-100", noticeIcon: "warning", notice: "Two supporting documents are missing.", noticeLink: "Upload now",
      valueLabel: "Accumulated Emission", value: "4,812", valueTone: "text-orange-600",
      actions: [{ label: "Supplement Document", icon: "upload_file", solid: true }, { label: "History", icon: "history" }],
      activity: [{ title: "Reviewer supplement request", meta: "3 hours ago · reason: insufficient proof" }, { title: "Data correction (Site Admin)", meta: "Yesterday · 12% combustion section adjustment" }],
      sparkline: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22", accentClass: "border-t-orange-500 ring-2 ring-orange-500/20", pinClass: "text-orange-500"
    },
    {
      status: "Verification In Progress", statusClass: "bg-blue-100 text-blue-700 border border-blue-200", id: "GN-112", title: "Gwangyang Energy Center 2",
      noticeClass: "bg-blue-50/50 border-b border-blue-100", noticeIcon: "verified", notice: "KEA verification phase 1 has passed.", noticeLink: "Download result",
      valueLabel: "Annual Accumulation", value: "12,890", valueTone: "text-blue-700",
      actions: [{ label: "Verification Status", icon: "fact_check" }, { label: "Report Export", icon: "description" }],
      activity: [{ title: "External verification started", meta: "2 days ago · KEMCO audit launched" }, { title: "Report final approval", meta: "2025.08.10 · site overseer confirmed" }],
      sparkline: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15", accentClass: "border-t-blue-500", pinClass: "text-blue-500"
    }
  ] : [
    {
      status: "정상 운영", statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200", id: "PH-001", title: "포항 제1 열연공장",
      noticeClass: "bg-indigo-50/50 border-b border-indigo-100", noticeIcon: "notifications_active", notice: "8월 2주차 데이터 대조가 필요합니다.", noticeLink: "지금 바로 실행",
      valueLabel: "현재 배출량 (Real-time)", value: "2,341", valueTone: "text-[var(--kr-gov-blue)]",
      actions: [{ label: "데이터 입력", icon: "edit_square" }, { label: "산정 로직", icon: "calculate" }],
      activity: [{ title: "에너지 데이터 확정 (Admin)", meta: "12분 전 · 데이터 유효성 검증 완료" }, { title: "Tier 3 산정 계수 업데이트", meta: "어제 · 시스템 자동 최적화" }],
      sparkline: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4", accentClass: "border-t-[var(--kr-gov-blue)]", pinClass: "text-[var(--kr-gov-blue)]"
    },
    {
      status: "입력 지연 (65%)", statusClass: "bg-orange-100 text-orange-700 border border-orange-200", id: "US-042", title: "울산 제3 화학기지",
      noticeClass: "bg-red-50 border-b border-red-100", noticeIcon: "warning", notice: "산정 증빙 서류 2건이 누락되었습니다.", noticeLink: "즉시 업로드",
      valueLabel: "누적 배출량", value: "4,812", valueTone: "text-orange-600",
      actions: [{ label: "서류 보완하기", icon: "upload_file", solid: true }, { label: "이력 확인", icon: "history" }],
      activity: [{ title: "검증관(김검증) 보완 요청 알림", meta: "3시간 전 · '증빙 자료 부족' 사유" }, { title: "데이터 수정 (이현장)", meta: "어제 · 고정 연소 섹션 12% 보정" }],
      sparkline: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22", accentClass: "border-t-orange-500 ring-2 ring-orange-500/20", pinClass: "text-orange-500"
    },
    {
      status: "검증 진행중", statusClass: "bg-blue-100 text-blue-700 border border-blue-200", id: "GN-112", title: "광양 제2 에너지센터",
      noticeClass: "bg-blue-50/50 border-b border-blue-100", noticeIcon: "verified", notice: "에너지공단 검증 1단계 통과 완료.", noticeLink: "결과서 다운로드",
      valueLabel: "연간 누적치", value: "12,890", valueTone: "text-blue-700",
      actions: [{ label: "검증 현황", icon: "fact_check" }, { label: "보고서 출력", icon: "description" }],
      activity: [{ title: "한국에너지공단 심사 개시", meta: "2일 전 · 외부 검증 절차 착수" }, { title: "보고서 최종 승인 완료", meta: "2025.08.10 · 현장 감독관 확정" }],
      sparkline: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15", accentClass: "border-t-blue-500", pinClass: "text-blue-500"
    }
  ], [en]);

  const generalSites = useMemo<GeneralSite[]>(() => en ? [
    { id: "IC-005", title: "Incheon Logistics Center", value: "452 tCO2", status: "Normal", statusClass: "text-emerald-600", action: "View Details", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" },
    { id: "DJ-021", title: "Daejeon R&D Campus", value: "210 tCO2", status: "Input Pending", statusClass: "text-orange-600", action: "Start Input", actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50" },
    { id: "PJ-088", title: "Paju Data Center", value: "890 tCO2", status: "Normal", statusClass: "text-emerald-600", action: "View Details", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" }
  ] : [
    { id: "IC-005", title: "인천 물류센터", value: "452 tCO2", status: "정상", statusClass: "text-emerald-600", action: "데이터 상세", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" },
    { id: "DJ-021", title: "대전 R&D 캠퍼스", value: "210 tCO2", status: "입력대기", statusClass: "text-orange-600", action: "입력 개시", actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50" },
    { id: "PJ-088", title: "파주 전산센터", value: "890 tCO2", status: "정상", statusClass: "text-emerald-600", action: "데이터 상세", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" }
  ], [en]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-project-list", {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      searchKeyword: searchKeyword.trim(),
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn)
    });
    logGovernanceScope("COMPONENT", "emission-project-dashboard", {
      queueCount: queueItems.length,
      dedicatedSiteCount: dedicatedSites.length,
      generalSiteCount: generalSites.length
    });
  }, [dedicatedSites.length, en, generalSites.length, homeMenu.length, mobileMenuOpen, payload.isLoggedIn, queueItems.length, searchKeyword]);

  return (
    <>
      <EmissionProjectListInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Official Government Service | Site Overseer Portal" : "대한민국 정부 공식 서비스 | 현장 감독관 전용 포털"}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{en ? "Last update detected: just now" : "마지막 업데이트 탐지: 방금 전"}</p>
            </div>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible"
                  type="button"
                  aria-controls="mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={content.openAllMenu}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={content}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={session.logout}
          />
        </div>

        <main id="main-content">
          <section className="bg-slate-900 py-10 relative overflow-hidden border-b border-slate-800" data-help-id="emission-project-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="xl:w-1/4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">auto_awesome</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{en ? "Update Assistant" : "업데이트 비서"}</h2>
                      <p className="text-indigo-400 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" /> Intelligent Assistant
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {en
                      ? <>AI analyzed emission data in real time and detected pending update tasks. <br className="hidden xl:block" /><strong className="text-white">4 priority tasks</strong> are waiting.</>
                      : <>AI가 배출지 데이터를 실시간 분석하여 필요한 업데이트 업무를 감지했습니다. <br className="hidden xl:block" /><strong className="text-white">4개의 우선 업무</strong>가 대기 중입니다.</>}
                  </p>
                  <button className="w-full py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white text-sm font-bold transition-all flex items-center justify-center gap-2" type="button">
                    <span className="material-symbols-outlined text-sm">checklist</span>
                    {en ? "View Full Workflow" : "전체 워크플로우 보기"}
                  </button>
                </div>
                <div className="xl:w-3/4 w-full">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">priority_high</span>
                    {en ? "Your Update Queue (Priority Order)" : "Your Update Queue (우선순위순)"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-help-id="emission-project-queue">
                    {queueItems.map((item) => (
                      <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-r-lg group hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden border-l-4" key={item.title} style={{ borderLeftColor: item.level === "CRITICAL" ? "#ef4444" : item.level === "REQUIRED" ? "#f97316" : item.level === "VERIFICATION" ? "#3b82f6" : "#10b981" }}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.levelClass}`}>{item.level}</span>
                          <span className="text-[10px] font-bold text-slate-500 tracking-tighter">{item.due}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                        <p className="text-slate-400 text-[11px] mb-4">{item.description}</p>
                        <a className="inline-flex items-center text-[11px] font-bold text-indigo-400 hover:text-indigo-300 gap-1 mt-auto" href="#">
                          {item.cta} <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 -mt-8 relative z-20" data-help-id="emission-project-admin-linkage">
            <div className="bg-white shadow-2xl rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center border border-gray-100">
              <div className="relative flex-1 w-full">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
                <input
                  className="w-full pl-12 pr-4 h-14 border-none bg-gray-50 rounded-lg focus:ring-2 focus:ring-[var(--kr-gov-blue)] text-sm"
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder={en ? "Search by facility code, emission site name, or process..." : "시설 코드, 배출지 명칭, 또는 관리 중인 특정 프로세스를 입력하세요..."}
                  value={searchKeyword}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <a className="flex-1 md:flex-none px-6 h-14 bg-[var(--kr-gov-blue)] text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--kr-gov-blue-hover)] transition-colors" href={adminSiteManagementHref}>
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  {en ? "Register New Emission Site" : "신규 배출지 등록"}
                </a>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="emission-project-site-cards" id="emission-sources">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                  {en ? "Dedicated Sites" : "핵심 관리 배출지 (Dedicated Sites)"}
                </h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{en ? "Pinned top-priority sites managed directly by the overseer." : "감독관님이 직접 핀(Pin) 고정한 최우선 관리 대상입니다."}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">bolt</span>
                  <span className="text-[11px] font-bold text-indigo-700 leading-none">{en ? "Update assistant guide enabled" : "업데이트 비서 가이드 활성화 중"}</span>
                </div>
                <a className="text-xs font-bold text-gray-400 hover:text-[var(--kr-gov-blue)] flex items-center gap-1 transition-colors" href={adminSiteManagementHref}>
                  <span className="material-symbols-outlined text-[18px]">settings</span> {en ? "Manage" : "관리"}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              {dedicatedSites.map((site) => (
                <div className={`gov-card shadow-md relative group border-t-4 ${site.accentClass}`} key={site.id}>
                  <div className="p-6 border-b border-gray-100 bg-blue-50/20 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`status-badge ${site.statusClass}`}>{site.status}</span>
                        <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      </div>
                      <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{site.title}</h3>
                    </div>
                    <button className={site.pinClass} type="button"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span></button>
                  </div>
                  <div className={`px-6 py-3 flex items-center justify-between ${site.noticeClass}`}>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${site.noticeIcon === "warning" ? "text-red-600 urgent-pulse" : site.noticeIcon === "verified" ? "text-blue-600" : "text-indigo-600"}`}>{site.noticeIcon}</span>
                      <span className="text-[11px] font-bold text-slate-800">{site.notice}</span>
                    </div>
                    <a className="text-[10px] font-black underline text-indigo-600" href="#">{site.noticeLink}</a>
                  </div>
                  <div className="p-6 space-y-8 flex-1">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-gray-500 font-bold mb-1">{site.valueLabel}</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-3xl font-black tracking-tighter ${site.valueTone}`}>{site.value}</span>
                          <span className="text-sm font-bold text-gray-400 uppercase">tCO2</span>
                        </div>
                      </div>
                      <div className="w-32 h-16">
                        <svg className="w-full h-full" viewBox="0 0 100 30">
                          <path d={site.sparkline} fill="none" stroke={site.valueTone.includes("orange") ? "#f97316" : "#3b82f6"} strokeLinecap="round" strokeWidth="2.5" />
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {site.actions.map((action) => (
                        <a
                          className={`flex flex-col items-center justify-center p-4 rounded-xl group transition-all ${action.solid ? "bg-orange-600 shadow-lg shadow-orange-600/20" : "bg-gray-50 hover:bg-blue-600"}`}
                          href="#"
                          key={action.label}
                        >
                          <span className={`material-symbols-outlined mb-1 ${action.solid ? "text-white" : "text-gray-400 group-hover:text-white"}`}>{action.icon}</span>
                          <span className={`text-[12px] font-bold ${action.solid ? "text-white" : "text-gray-600 group-hover:text-white"}`}>{action.label}</span>
                        </a>
                      ))}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full" /> Site Activity Feed
                      </p>
                      <ul className="space-y-5">
                        {site.activity.map((item) => (
                          <li className="relative pl-5 activity-item" key={item.title}>
                            <p className="text-[12px] font-bold text-gray-700 leading-tight">{item.title}</p>
                            <span className="text-[10px] text-gray-400">{item.meta}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-700">
                {en ? "General Site Overview" : "일반 배출지 현황"}
                <span className="text-sm font-normal text-gray-400 ml-2">{en ? "18 sites total" : "총 18개소"}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {generalSites.map((site) => (
                <div className="gov-card hover:border-blue-400 transition-colors" key={site.id}>
                  <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      <h4 className="font-bold text-gray-800">{site.title}</h4>
                    </div>
                    <button className="text-gray-300 hover:text-[var(--kr-gov-blue)]" type="button"><span className="material-symbols-outlined text-[18px]">push_pin</span></button>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="text-xs space-y-2 mb-4">
                      <div className="flex justify-between"><span className="text-gray-500">{en ? "Emission" : "배출량"}</span><span className="font-bold">{site.value}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{en ? "Status" : "상태"}</span><span className={`font-bold ${site.statusClass}`}>{site.status}</span></div>
                    </div>
                    <button className={`w-full py-2.5 text-xs font-bold border rounded ${site.actionClass}`} type="button">{site.action}</button>
                  </div>
                </div>
              ))}
              <a className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center p-6 hover:border-[var(--kr-gov-blue)] hover:bg-white transition-all group" href={adminSiteManagementHref}>
                <span className="material-symbols-outlined text-gray-300 group-hover:text-[var(--kr-gov-blue)] mb-2" style={{ fontSize: 32 }}>add_circle</span>
                <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--kr-gov-blue)]">{en ? "Register Additional Site" : "배출지 추가 등록"}</span>
              </a>
            </div>
          </section>

          <section className="bg-white border-y border-gray-200 py-16">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                <div>
                  <h2 className="text-2xl font-black mb-1">{en ? "Integrated Emission Monitoring Report" : "종합 배출 모니터링 리포트"}</h2>
                  <p className="text-[var(--kr-gov-text-secondary)] text-sm">{en ? "Statistics and target progress across all managed emission sites." : "관리 중인 모든 배출지의 통계 및 목표 달성 현황입니다."}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                  <span className="material-symbols-outlined text-[16px]">update</span>
                  {en ? "Last update: 2025.08.14 15:45" : "최종 업데이트: 2025.08.14 15:45"}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm text-gray-600 mb-6">{en ? "Annual accumulation vs target" : "올해 누적 배출량 vs 연간 목표"}</h4>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-black text-[var(--kr-gov-blue)] tracking-tight">45,120</span>
                    <span className="text-sm font-bold text-gray-400">tCO2</span>
                    <span className="ml-auto text-sm font-bold text-emerald-600">{en ? "▼ 4.2% YoY" : "▼ 4.2% (전년동기대비)"}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px] font-bold">
                      <span>{en ? "Annual target (60,000 tCO2)" : "연간 허용 목표 (60,000 tCO2)"}</span>
                      <span className="text-[var(--kr-gov-blue)]">75.2%</span>
                    </div>
                    <div className="h-3 bg-white rounded-full overflow-hidden border border-gray-200">
                      <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: "75.2%" }} />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm text-gray-600 mb-6">{en ? "Site distribution by process" : "프로세스별 배출지 분포"}</h4>
                  <div className="flex gap-4 h-32 items-end">
                    {[
                      { value: "12", label: en ? "Calculated" : "산정완료", color: "bg-emerald-500", height: "h-full" },
                      { value: "5", label: en ? "Input" : "입력중", color: "bg-orange-400", height: "h-[70%]" },
                      { value: "3", label: en ? "Verifying" : "검증중", color: "bg-blue-400", height: "h-[42%]" },
                      { value: "1", label: en ? "Pending" : "대기", color: "bg-gray-300", height: "h-[18%]" }
                    ].map((bar) => (
                      <div className={`flex-1 ${bar.color} ${bar.height} rounded-t-lg relative`} key={bar.label}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">{bar.value}</div>
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 whitespace-nowrap">{bar.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-between">
                  <h4 className="font-bold text-sm text-gray-600 mb-4">{en ? "Certification & verification performance" : "인증 및 검증 성과"}</h4>
                  <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full -rotate-90">
                        <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                        <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset="50" strokeLinecap="round" strokeWidth="8" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black">80%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "Certified" : "인증 완료"}</span><span className="font-bold">8건</span></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "In Progress" : "진행 중"}</span><span className="font-bold">2건</span></div>
                      <div className="mt-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-[11px] font-black flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        {en ? "Quality standard compliant" : "품질 표준 준수 중"}
                      </div>
                    </div>
                  </div>
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
                  <img alt={en ? "Republic of Korea government symbol" : "대한민국 정부 상징"} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed">
                  {en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Site Management Support Team: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678"}<br />
                  {en ? "This platform is optimized for enterprise greenhouse-gas site management." : "본 플랫폼은 기업의 온실가스 감축 현장 관리를 위해 최적화되었습니다."}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Terms of Use" : "이용약관"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Manual Download" : "매뉴얼 다운로드"}</a>
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">{en ? "© 2025 CCUS Carbon Footprint Platform. Dedicated Site Overseer Portal." : "© 2025 CCUS Carbon Footprint Platform. Dedicated Site Overseer Portal."}</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{en ? "V 2.5.0 (AI Assistant Enabled)" : "V 2.5.0 (AI Assistant Enabled)"}</div>
                <img alt={en ? "Web accessibility certification mark" : "웹 접근성 품질인증 마크"} className="h-10 opacity-60" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
