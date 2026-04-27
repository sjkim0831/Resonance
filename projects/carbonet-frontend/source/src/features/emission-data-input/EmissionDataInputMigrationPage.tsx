import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type QueueCard = {
  badge: string;
  badgeClass: string;
  icon: string;
  title: string;
  description: string;
  variant: "upload" | "energy" | "checklist" | "feedback";
  accentClass: string;
  actionLabel: string;
};

type DedicatedSiteCard = {
  status: string;
  statusClass: string;
  id: string;
  title: string;
  pinClass: string;
  noticeClass: string;
  noticeIcon: string;
  noticeIconClass: string;
  notice: string;
  noticeLink?: string;
  metricLabel: string;
  metricValue: string;
  metricValueClass: string;
  sparkline: string;
  sparklineColor: string;
  accentClass: string;
  actions: Array<{ label: string; icon: string; solid?: boolean; solidClass?: string; hoverClass?: string }>;
  activityLabel: string;
  activityItems: Array<{ title: string; meta: string }>;
};

type GeneralSiteCard = {
  id: string;
  title: string;
  emission: string;
  status: string;
  statusClass: string;
  actionLabel: string;
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

function EmissionDataInputInlineStyles() {
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
      .hide-scrollbar::-webkit-scrollbar {
        height: 4px;
      }
      .hide-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      .hide-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
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

export function EmissionDataInputMigrationPage() {
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
  const localePath = buildLocalizedPath("/emission/data_input", "/en/emission/data_input");
  const adminSiteManagementHref = buildLocalizedPath("/admin/emission/site-management", "/en/admin/emission/site-management");

  const queueCards = useMemo<QueueCard[]>(() => en ? [
    { badge: "CRITICAL (D-2)", badgeClass: "bg-red-500", icon: "attachment", title: "Ulsan #3: Submit Missing Docs", description: "Evidence for process emission factor calculation missing", variant: "upload", accentClass: "border-l-red-500", actionLabel: "Upload & Report" },
    { badge: "REQUIRED (D-5)", badgeClass: "bg-orange-500", icon: "bolt", title: "Pohang #1: Energy Data", description: "Confirm final electricity usage for August", variant: "energy", accentClass: "border-l-orange-500", actionLabel: "Confirm Value" },
    { badge: "VERIFICATION (D-12)", badgeClass: "bg-blue-500", icon: "checklist", title: "Gwangyang #2: QA Checklist", description: "Complete final 3 items then request verification", variant: "checklist", accentClass: "border-l-blue-500", actionLabel: "Save Checklist" },
    { badge: "GOAL FEEDBACK", badgeClass: "bg-emerald-500", icon: "trending_up", title: "Incheon: Goal Response Plan", description: "Site opinion required for target shortfall", variant: "feedback", accentClass: "border-l-emerald-500", actionLabel: "Submit Opinion" }
  ] : [
    { badge: "CRITICAL (D-2)", badgeClass: "bg-red-500", icon: "attachment", title: "울산 제3: 보완 서류 제출", description: "공정 배출계수 산정 로직 증빙 서류 누락", variant: "upload", accentClass: "border-l-red-500", actionLabel: "업로드 완료 및 보고" },
    { badge: "REQUIRED (D-5)", badgeClass: "bg-orange-500", icon: "bolt", title: "포항 제1: 에너지 데이터", description: "8월분 전력 사용량 최종 확정 필요", variant: "energy", accentClass: "border-l-orange-500", actionLabel: "수치 확정하기" },
    { badge: "VERIFICATION (D-12)", badgeClass: "bg-blue-500", icon: "checklist", title: "광양 제2: 품질 보증 체크", description: "마지막 3개 항목 확인 후 검증 요청", variant: "checklist", accentClass: "border-l-blue-500", actionLabel: "체크리스트 저장" },
    { badge: "GOAL FEEDBACK", badgeClass: "bg-emerald-500", icon: "trending_up", title: "인천: 배출 목표 대응안", description: "감축 목표 미달에 따른 현장 소견 필요", variant: "feedback", accentClass: "border-l-emerald-500", actionLabel: "의견 등록" }
  ], [en]);

  const dedicatedSites = useMemo<DedicatedSiteCard[]>(() => en ? [
    {
      status: "Normal Operation", statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200", id: "PH-001", title: "Pohang Hot Rolling Mill 1", pinClass: "text-[var(--kr-gov-blue)]",
      noticeClass: "bg-indigo-50/50 border-b border-indigo-100", noticeIcon: "notifications_active", noticeIconClass: "text-indigo-600", notice: "Power statement reconciliation pending", noticeLink: "Input from hub",
      metricLabel: "Current Emission (Real-time)", metricValue: "2,341", metricValueClass: "text-[var(--kr-gov-blue)]", sparkline: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4", sparklineColor: "#3b82f6", accentClass: "border-t-[var(--kr-gov-blue)]",
      actions: [{ label: "Data Detail", icon: "edit_square", hoverClass: "hover:bg-blue-600" }, { label: "Calculation Logic", icon: "calculate", hoverClass: "hover:bg-blue-600" }],
      activityLabel: "Recent Activity", activityItems: [{ title: "Energy data sync completed", meta: "12 min ago · automated bill scan complete" }, { title: "Emission auto-calculation completed", meta: "Yesterday · system active" }]
    },
    {
      status: "Input Delayed (65%)", statusClass: "bg-orange-100 text-orange-700 border border-orange-200", id: "US-042", title: "Ulsan Chemical Base 3", pinClass: "text-orange-500",
      noticeClass: "bg-red-50 border-b border-red-100", noticeIcon: "warning", noticeIconClass: "text-red-600 urgent-pulse", notice: "Complete supporting docs in the input hub.",
      metricLabel: "Accumulated Emission", metricValue: "4,812", metricValueClass: "text-orange-600", sparkline: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22", sparklineColor: "#f97316", accentClass: "border-t-orange-500 ring-2 ring-orange-500/20",
      actions: [{ label: "Write Site Note", icon: "edit_note", solid: true, solidClass: "bg-orange-600 shadow-lg shadow-orange-600/20" }, { label: "Change History", icon: "history", hoverClass: "hover:bg-orange-600" }],
      activityLabel: "Activity Feed", activityItems: [{ title: "Verification supplement requested", meta: "3 hours ago · 'insufficient evidence'" }, { title: "Data correction (Hyun-jang)", meta: "Yesterday · fixed combustion +12% adjusted" }]
    },
    {
      status: "Verification In Progress", statusClass: "bg-blue-100 text-blue-700 border border-blue-200", id: "GN-112", title: "Gwangyang Energy Center 2", pinClass: "text-blue-500",
      noticeClass: "bg-blue-50/50 border-b border-blue-100", noticeIcon: "verified", noticeIconClass: "text-blue-600", notice: "KEA verification phase 1 passed", noticeLink: "View result",
      metricLabel: "Annual Accumulation", metricValue: "12,890", metricValueClass: "text-blue-700", sparkline: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15", sparklineColor: "#3b82f6", accentClass: "border-t-blue-500",
      actions: [{ label: "Verification Status", icon: "fact_check", hoverClass: "hover:bg-blue-600" }, { label: "Export Report", icon: "description", hoverClass: "hover:bg-blue-600" }],
      activityLabel: "Site Progress", activityItems: [{ title: "KEMCO review started", meta: "2 days ago · external verification launched" }, { title: "Final report approved", meta: "2025.08.10 · site overseer confirmed" }]
    }
  ] : [
    {
      status: "정상 운영", statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200", id: "PH-001", title: "포항 제1 열연공장", pinClass: "text-[var(--kr-gov-blue)]",
      noticeClass: "bg-indigo-50/50 border-b border-indigo-100", noticeIcon: "notifications_active", noticeIconClass: "text-indigo-600", notice: "전력 데이터 고지서 대조 대기", noticeLink: "허브에서 입력",
      metricLabel: "현재 배출량 (Real-time)", metricValue: "2,341", metricValueClass: "text-[var(--kr-gov-blue)]", sparkline: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4", sparklineColor: "#3b82f6", accentClass: "border-t-[var(--kr-gov-blue)]",
      actions: [{ label: "데이터 상세", icon: "edit_square", hoverClass: "hover:bg-blue-600" }, { label: "산정 로직", icon: "calculate", hoverClass: "hover:bg-blue-600" }],
      activityLabel: "Recent Activity", activityItems: [{ title: "에너지 데이터 연동 성공", meta: "12분 전 · 고지서 자동 스캔 완료" }, { title: "배출량 자동 산정 완료", meta: "어제 · 시스템 가동" }]
    },
    {
      status: "입력 지연 (65%)", statusClass: "bg-orange-100 text-orange-700 border border-orange-200", id: "US-042", title: "울산 제3 화학기지", pinClass: "text-orange-500",
      noticeClass: "bg-red-50 border-b border-red-100", noticeIcon: "warning", noticeIconClass: "text-red-600 urgent-pulse", notice: "입력 허브에서 서류를 보완하세요.",
      metricLabel: "누적 배출량", metricValue: "4,812", metricValueClass: "text-orange-600", sparkline: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22", sparklineColor: "#f97316", accentClass: "border-t-orange-500 ring-2 ring-orange-500/20",
      actions: [{ label: "현장 소견 작성", icon: "edit_note", solid: true, solidClass: "bg-orange-600 shadow-lg shadow-orange-600/20" }, { label: "변경 이력", icon: "history", hoverClass: "hover:bg-orange-600" }],
      activityLabel: "Activity Feed", activityItems: [{ title: "검증 보완 요청", meta: "3시간 전 · '증빙 자료 부족'" }, { title: "데이터 수정 (이현장)", meta: "어제 · 고정 연소 12% 보정" }]
    },
    {
      status: "검증 진행중", statusClass: "bg-blue-100 text-blue-700 border border-blue-200", id: "GN-112", title: "광양 제2 에너지센터", pinClass: "text-blue-500",
      noticeClass: "bg-blue-50/50 border-b border-blue-100", noticeIcon: "verified", noticeIconClass: "text-blue-600", notice: "에너지공단 검증 1단계 통과", noticeLink: "결과서 보기",
      metricLabel: "연간 누적치", metricValue: "12,890", metricValueClass: "text-blue-700", sparkline: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15", sparklineColor: "#3b82f6", accentClass: "border-t-blue-500",
      actions: [{ label: "검증 현황", icon: "fact_check", hoverClass: "hover:bg-blue-600" }, { label: "보고서 출력", icon: "description", hoverClass: "hover:bg-blue-600" }],
      activityLabel: "Site Progress", activityItems: [{ title: "한국에너지공단 심사 개시", meta: "2일 전 · 외부 검증 절차 착수" }, { title: "보고서 최종 승인 완료", meta: "2025.08.10 · 현장 감독관 확정" }]
    }
  ], [en]);

  const generalSites = useMemo<GeneralSiteCard[]>(() => en ? [
    { id: "IC-005", title: "Incheon Logistics Center", emission: "452 tCO2", status: "Normal", statusClass: "text-emerald-600", actionLabel: "Data Detail", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" },
    { id: "DJ-021", title: "Daejeon R&D Campus", emission: "210 tCO2", status: "Input Pending", statusClass: "text-orange-600", actionLabel: "Start Input", actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50" },
    { id: "PJ-088", title: "Paju Data Center", emission: "890 tCO2", status: "Normal", statusClass: "text-emerald-600", actionLabel: "Data Detail", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" }
  ] : [
    { id: "IC-005", title: "인천 물류센터", emission: "452 tCO2", status: "정상", statusClass: "text-emerald-600", actionLabel: "데이터 상세", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" },
    { id: "DJ-021", title: "대전 R&D 캠퍼스", emission: "210 tCO2", status: "입력대기", statusClass: "text-orange-600", actionLabel: "입력 개시", actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50" },
    { id: "PJ-088", title: "파주 전산센터", emission: "890 tCO2", status: "정상", statusClass: "text-emerald-600", actionLabel: "데이터 상세", actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50" }
  ], [en]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-data-input", {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      searchKeyword: searchKeyword.trim(),
      menuCount: homeMenu.length,
      queueCount: queueCards.length,
      dedicatedSiteCount: dedicatedSites.length
    });
    logGovernanceScope("COMPONENT", "emission-data-input-dashboard", {
      queueCount: queueCards.length,
      dedicatedSiteCount: dedicatedSites.length,
      generalSiteCount: generalSites.length
    });
  }, [dedicatedSites.length, en, generalSites.length, homeMenu.length, mobileMenuOpen, queueCards.length, searchKeyword]);

  function renderQueueCardBody(card: QueueCard) {
    if (card.variant === "upload") {
      return (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">{en ? "File Upload" : "서류 업로드"}</p>
          <button className="group flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-700 p-4 text-center transition-colors hover:bg-slate-700/30" type="button">
            <span className="material-symbols-outlined text-indigo-400 transition-transform group-hover:scale-110">upload</span>
            <span className="text-[11px] text-slate-400">{en ? "Select PDF or Image (Max 20MB)" : "PDF 또는 이미지 파일 선택 (Max 20MB)"}</span>
          </button>
          <button className="mt-3 w-full rounded-md bg-indigo-600 py-2 text-[11px] font-bold text-white hover:bg-indigo-700" type="button">{card.actionLabel}</button>
        </div>
      );
    }
    if (card.variant === "energy") {
      return (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500">{en ? "Usage (kWh)" : "사용량 (kWh)"}</label>
              <input className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" placeholder="0.00" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500">{en ? "Bill Confirmed Date" : "고지서 확인일"}</label>
              <input className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" type="date" />
            </div>
          </div>
          <button className="w-full rounded-md bg-indigo-600 py-2 text-[11px] font-bold text-white hover:bg-indigo-700" type="button">{card.actionLabel}</button>
        </div>
      );
    }
    if (card.variant === "checklist") {
      return (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-3 space-y-2">
            <label className="group flex items-start gap-2">
              <input className="mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" type="checkbox" />
              <span className="text-[11px] text-slate-300 group-hover:text-white">{en ? "Confirm regular calibration of site meters" : "현장 계측기 정기 교정 증명서 확인"}</span>
            </label>
            <label className="group flex items-start gap-2">
              <input className="mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" type="checkbox" />
              <span className="text-[11px] text-slate-300 group-hover:text-white">{en ? "Verify emission activity evidence photos" : "배출 활동 근거 사진 대조 완료"}</span>
            </label>
          </div>
          <button className="w-full rounded-md bg-indigo-600 py-2 text-[11px] font-bold text-white hover:bg-indigo-700" type="button">{card.actionLabel}</button>
        </div>
      );
    }
    return (
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <textarea className="mb-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" placeholder={en ? "Enter site action plan briefly..." : "현장 조치 계획을 간단히 입력하세요..."} rows={2} />
        <button className="w-full rounded-md bg-emerald-600 py-2 text-[11px] font-bold text-white hover:bg-emerald-700" type="button">{card.actionLabel}</button>
      </div>
    );
  }

  return (
    <>
      <EmissionDataInputInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to Main Content" : "본문 바로가기"}</a>
        <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 lg:px-8">
            <div className="flex items-center gap-2">
              <img alt={en ? "Republic of Korea Government Emblem" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Official Republic of Korea Government Service | Dedicated Site Overseer Portal" : "대한민국 정부 공식 서비스 | 현장 감독관 전용 포털"}</span>
            </div>
            <div className="hidden items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)] md:flex">
              <p>{en ? "Real-time Data Syncing: Just now" : "데이터 실시간 연동 중: 방금 전"}</p>
            </div>
          </div>
        </div>
        <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="relative flex h-24 items-center">
              <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] xl:flex">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/data_input")}>KO</button>
                  <button type="button" className={`border-l border-[var(--kr-gov-border-light)] px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/data_input")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)] xl:inline-flex" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden items-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)] xl:inline-flex" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden items-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-white px-5 py-2.5 font-bold text-[var(--kr-gov-blue)] transition-colors hover:bg-[var(--kr-gov-bg-gray)] xl:inline-flex" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button id="mobile-menu-toggle" aria-controls="mobile-menu" aria-expanded={mobileMenuOpen} aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] focus-visible xl:hidden" onClick={() => setMobileMenuOpen((current) => !current)} type="button">
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu content={content} en={en} homeMenu={homeMenu} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} />
        </div>
        <main id="main-content">
          <section className="relative overflow-hidden border-b border-slate-800 bg-[#0f172a] py-10" data-help-id="emission-data-input-hero">
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <svg height="100%" width="100%">
                <pattern height="60" id="emission-data-input-dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#emission-data-input-dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="flex flex-col items-start gap-8 lg:flex-row">
                <div className="shrink-0 lg:w-1/4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
                      <span className="material-symbols-outlined text-[28px] text-white">input_circle</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{en ? "Data Input Hub" : "데이터 입력 허브"}</h2>
                      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-indigo-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />Guided Data Entry</p>
                    </div>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">{en ? <>These are <strong className="text-white">priority data entry tasks</strong> for immediate handling. Update data directly from the field without leaving the dashboard.</> : <>감독관님이 즉시 처리해야 할 <strong className="text-white">우선순위 입력 과업</strong>입니다. 대시보드 이탈 없이 현장에서 바로 데이터를 업데이트하세요.</>}</p>
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-indigo-300">{en ? "Daily Goal" : "오늘의 목표"}</span>
                      <span className="text-xs font-bold text-white">75%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-indigo-950">
                      <div className="h-full bg-indigo-400" style={{ width: "75%" }} />
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-3/4">
                  <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500"><span className="material-symbols-outlined text-[16px]">view_kanban</span>{en ? "Your Update Queue" : "Your Update Queue (대기 중인 입력 과업)"}</h3>
                  <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-4 snap-x" data-help-id="emission-data-input-queue">
                    {queueCards.map((card) => (
                      <div className="min-w-[320px] snap-start overflow-hidden rounded-xl border border-white/10 bg-slate-800/50 md:min-w-[420px]" key={card.title}>
                        <div className={`border-l-4 ${card.accentClass} bg-slate-800/80 p-5`}>
                          <div className="mb-3 flex items-start justify-between">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${card.badgeClass}`}>{card.badge}</span>
                            <span className="material-symbols-outlined text-sm text-slate-400">{card.icon}</span>
                          </div>
                          <h4 className="mb-1 text-sm font-bold text-white">{card.title}</h4>
                          <p className="mb-4 text-[11px] text-slate-400">{card.description}</p>
                          {renderQueueCardBody(card)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="relative z-20 -mt-8 mx-auto max-w-[1440px] px-4 lg:px-8" data-help-id="emission-data-input-search">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl md:flex-row">
              <div className="relative w-full flex-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input className="h-14 w-full rounded-lg border-none bg-gray-50 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[var(--kr-gov-blue)]" onChange={(event) => setSearchKeyword(event.target.value)} placeholder={en ? "Enter facility code, emission site name, or specific managed process..." : "시설 코드, 배출지 명칭, 또는 관리 중인 특정 프로세스를 입력하세요..."} value={searchKeyword} />
              </div>
              <div className="flex w-full gap-2 md:w-auto">
                <a className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-6 font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)] md:flex-none" href={adminSiteManagementHref}><span className="material-symbols-outlined text-[20px]">add</span>{en ? "Register New Site" : "신규 배출지 등록"}</a>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="emission-data-input-sites" id="emission-sources">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black"><span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>{en ? "Dedicated Management Sites" : "핵심 관리 배출지 (Dedicated Sites)"}</h2>
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Priority management targets pinned by the overseer." : "감독관님이 직접 핀(Pin) 고정한 최우선 관리 대상입니다."}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 md:flex">
                  <span className="material-symbols-outlined text-[18px] text-indigo-500">verified_user</span>
                  <span className="text-[11px] font-bold leading-none text-indigo-700">{en ? "Real-time input guide active" : "실시간 데이터 입력 가이드 활성"}</span>
                </div>
                <a className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-[var(--kr-gov-blue)]" href={adminSiteManagementHref}><span className="material-symbols-outlined text-[18px]">settings</span>{en ? "Manage" : "관리"}</a>
              </div>
            </div>
            <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
              {dedicatedSites.map((site) => (
                <div className={`gov-card relative shadow-md ${site.accentClass}`} key={site.id}>
                  <div className="flex items-start justify-between border-b border-gray-100 bg-blue-50/20 p-6">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`status-badge ${site.statusClass}`}>{site.status}</span>
                        <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      </div>
                      <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{site.title}</h3>
                    </div>
                    <button className={site.pinClass} type="button"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span></button>
                  </div>
                  <div className={`flex items-center justify-between px-6 py-3 ${site.noticeClass}`}>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${site.noticeIconClass}`}>{site.noticeIcon}</span>
                      <span className="text-[11px] font-bold text-slate-800">{site.notice}</span>
                    </div>
                    {site.noticeLink ? <a className="text-[10px] font-black text-indigo-600 underline" href={localePath}>{site.noticeLink}</a> : null}
                  </div>
                  <div className="flex-1 space-y-8 p-6">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="mb-1 text-xs font-bold text-gray-500">{site.metricLabel}</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-3xl font-black tracking-tighter ${site.metricValueClass}`}>{site.metricValue}</span>
                          <span className="text-sm font-bold uppercase text-gray-400">tCO2</span>
                        </div>
                      </div>
                      <div className="h-16 w-32">
                        <svg className="h-full w-full" viewBox="0 0 100 30">
                          <path d={site.sparkline} fill="none" stroke={site.sparklineColor} strokeLinecap="round" strokeWidth="2.5" />
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {site.actions.map((action) => (
                        <a className={`group flex flex-col items-center justify-center rounded-xl p-4 transition-all ${action.solid ? `${action.solidClass || "bg-orange-600"} text-white` : `bg-gray-50 ${action.hoverClass || "hover:bg-blue-600"}`}`} href={localePath} key={action.label}>
                          <span className={`material-symbols-outlined mb-1 ${action.solid ? "text-white" : "text-gray-400 group-hover:text-white"}`}>{action.icon}</span>
                          <span className={`text-[12px] font-bold ${action.solid ? "text-white" : "text-gray-600 group-hover:text-white"}`}>{action.label}</span>
                        </a>
                      ))}
                    </div>
                    <div>
                      <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400"><span className="h-1 w-1 rounded-full bg-gray-400" />{site.activityLabel}</p>
                      <ul className="space-y-5">
                        {site.activityItems.map((item) => (
                          <li className="activity-item relative pl-5" key={item.title}>
                            <p className="text-[12px] font-bold leading-tight text-gray-700">{item.title}</p>
                            <span className="text-[10px] text-gray-400">{item.meta}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-700">{en ? "General Site Overview" : "일반 배출지 현황"}<span className="ml-2 text-sm font-normal text-gray-400">{en ? "18 sites total" : "총 18개소"}</span></h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {generalSites.map((site) => (
                <div className="gov-card transition-colors hover:border-blue-400" key={site.id}>
                  <div className="flex items-start justify-between border-b border-gray-100 p-4">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      <h4 className="font-bold text-gray-800">{site.title}</h4>
                    </div>
                    <button className="text-gray-300 hover:text-[var(--kr-gov-blue)]" type="button"><span className="material-symbols-outlined text-[18px]">push_pin</span></button>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div className="mb-4 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">{en ? "Emission" : "배출량"}</span><span className="font-bold">{site.emission}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{en ? "Status" : "상태"}</span><span className={`font-bold ${site.statusClass}`}>{site.status}</span></div>
                    </div>
                    <button className={`w-full rounded border py-2.5 text-xs font-bold ${site.actionClass}`} type="button">{site.actionLabel}</button>
                  </div>
                </div>
              ))}
              <a className="group flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-6 transition-all hover:border-[var(--kr-gov-blue)] hover:bg-white" href={adminSiteManagementHref}>
                <span className="material-symbols-outlined mb-2 text-gray-300 group-hover:text-[var(--kr-gov-blue)]" style={{ fontSize: 32 }}>add_circle</span>
                <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--kr-gov-blue)]">{en ? "Register Additional Site" : "배출지 추가 등록"}</span>
              </a>
            </div>
          </section>
          <section className="border-y border-gray-200 bg-white py-16" data-help-id="emission-data-input-report">
            <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="mb-1 text-2xl font-black">{en ? "Integrated Emission Monitoring Report" : "종합 배출 모니터링 리포트"}</h2>
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Statistics and target progress across all managed emission sites." : "관리 중인 모든 배출지의 통계 및 목표 달성 현황입니다."}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500"><span className="material-symbols-outlined text-[16px]">update</span>{en ? "Last update: 2025.08.14 15:45" : "최종 업데이트: 2025.08.14 15:45"}</div>
              </div>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                  <h4 className="mb-6 text-sm font-bold text-gray-600">{en ? "Annual accumulation vs target" : "올해 누적 배출량 vs 연간 목표"}</h4>
                  <div className="mb-6 flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight text-[var(--kr-gov-blue)]">45,120</span>
                    <span className="text-sm font-bold text-gray-400">tCO2</span>
                    <span className="ml-auto text-sm font-bold text-emerald-600">{en ? "▼ 4.2% YoY" : "▼ 4.2% (전년동기대비)"}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px] font-bold">
                      <span>{en ? "Annual target (60,000 tCO2)" : "연간 허용 목표 (60,000 tCO2)"}</span>
                      <span className="text-[var(--kr-gov-blue)]">75.2%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-white">
                      <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: "75.2%" }} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                  <h4 className="mb-6 text-sm font-bold text-gray-600">{en ? "Site distribution by process" : "프로세스별 배출지 분포"}</h4>
                  <div className="flex h-32 items-end gap-4">
                    {[
                      { value: "12", label: en ? "Calculated" : "산정완료", color: "bg-emerald-500", height: "h-full" },
                      { value: "5", label: en ? "Input" : "입력중", color: "bg-orange-400", height: "h-[70%]" },
                      { value: "3", label: en ? "Verifying" : "검증중", color: "bg-blue-400", height: "h-[42%]" },
                      { value: "1", label: en ? "Pending" : "대기", color: "bg-gray-300", height: "h-[18%]" }
                    ].map((bar) => (
                      <div className={`relative flex-1 rounded-t-lg ${bar.color} ${bar.height}`} key={bar.label}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">{bar.value}</div>
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-gray-400">{bar.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50 p-6">
                  <h4 className="mb-4 text-sm font-bold text-gray-600">{en ? "Certification & verification performance" : "인증 및 검증 성과"}</h4>
                  <div className="flex items-center gap-6">
                    <div className="relative h-24 w-24">
                      <svg className="h-full w-full -rotate-90">
                        <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                        <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset="50" strokeLinecap="round" strokeWidth="8" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black">80%</span></div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "Certified" : "인증 완료"}</span><span className="font-bold">8건</span></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "In Progress" : "진행 중"}</span><span className="font-bold">2건</span></div>
                      <div className="mt-4 flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700"><span className="material-symbols-outlined text-[14px]">verified</span>{en ? "Quality standard compliant" : "품질 표준 준수 중"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-12 lg:px-8">
            <div className="flex flex-col justify-between gap-10 border-b border-gray-100 pb-10 md:flex-row">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={en ? "Republic of Korea government symbol" : "대한민국 정부 상징"} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black tracking-tight text-gray-800">{en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}</span>
                </div>
                <address className="not-italic text-sm leading-relaxed text-gray-500">{en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Site Management Support Team: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678"}<br />{en ? "This platform is optimized for enterprise greenhouse-gas site management." : "본 플랫폼은 기업의 온실가스 감축 현장 관리를 위해 최적화되었습니다."}</address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Terms of Use" : "이용약관"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Manual Download" : "매뉴얼 다운로드"}</a>
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center justify-between gap-6 md:flex-row">
              <p className="text-xs font-medium text-gray-400">© 2025 CCUS Carbon Footprint Platform. Dedicated Site Overseer Portal.</p>
              <div className="flex items-center gap-4">
                <div className="rounded bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-400">V 2.5.0 (AI Assistant Enabled)</div>
                <img alt={en ? "Web accessibility certification mark" : "웹 접근성 품질인증 마크"} className="h-10 opacity-60" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
