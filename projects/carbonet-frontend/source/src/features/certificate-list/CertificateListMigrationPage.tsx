import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type CertificateStatusKey = "expiring" | "renewal" | "valid" | "verify" | "reissue";

type CertificateCard = {
  id: string;
  title: string;
  site: string;
  siteCode: string;
  issuedAt: string;
  expiryAt: string;
  reportName: string;
  reportSize: string;
  statusKey: CertificateStatusKey;
  statusLabel: string;
  dueLabel: string;
  accentClassName: string;
  badgeClassName: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

type SummaryCard = {
  label: string;
  value: number;
  icon: string;
  accentClassName: string;
  surfaceClassName: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  navDashboard: string;
  navList: string;
  navApply: string;
  navStats: string;
  managerRole: string;
  managerName: string;
  summaryTitle: string;
  summaryBody: string;
  listTitle: string;
  listBody: string;
  searchPlaceholder: string;
  statusFilterLabel: string;
  statusOptions: Array<{ value: "ALL" | CertificateStatusKey; label: string }>;
  filterLabel: string;
  createLabel: string;
  openCountLabel: string;
  noResultsTitle: string;
  noResultsBody: string;
  issuedLabel: string;
  expiryLabel: string;
  reportLabel: string;
  lastSyncLabel: string;
  summaryCards: SummaryCard[];
  cards: CertificateCard[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "인증서 통합 관리",
    pageSubtitle: "Certification PM Dashboard",
    navDashboard: "대시보드",
    navList: "인증서 목록",
    navApply: "갱신 신청",
    navStats: "통계 리포트",
    managerRole: "프로젝트 총괄",
    managerName: "이현장 매니저님",
    summaryTitle: "현황 요약 (Summary)",
    summaryBody: "인증서 갱신, 검증 대기, 재발급 필요 항목을 우선 확인하세요.",
    listTitle: "인증서 상세 목록",
    listBody: "만료 일정과 검증 리포트 상태를 카드 단위로 검토하고 바로 후속 작업으로 이동합니다.",
    searchPlaceholder: "인증서 명칭, 배출지 코드 검색...",
    statusFilterLabel: "상태",
    statusOptions: [
      { value: "ALL", label: "전체 상태" },
      { value: "expiring", label: "만료 임박" },
      { value: "renewal", label: "갱신 심사중" },
      { value: "verify", label: "검증 대기" },
      { value: "reissue", label: "재발급 준비" },
      { value: "valid", label: "유효 인증서" }
    ],
    filterLabel: "필터",
    createLabel: "신규 등록",
    openCountLabel: "조회 결과",
    noResultsTitle: "조건에 맞는 인증서가 없습니다.",
    noResultsBody: "검색어 또는 상태 필터를 조정해 다시 확인하십시오.",
    issuedLabel: "발급 일자",
    expiryLabel: "만료 일자",
    reportLabel: "최종 검증 리포트",
    lastSyncLabel: "마지막 데이터 동기화: 방금 전",
    summaryCards: [
      { label: "30일 내 만료 예정", value: 3, icon: "event_busy", accentClassName: "text-red-600", surfaceClassName: "border-l-red-500 bg-red-50" },
      { label: "갱신 진행 중", value: 5, icon: "pending_actions", accentClassName: "text-amber-600", surfaceClassName: "border-l-amber-500 bg-amber-50" },
      { label: "유효 인증서", value: 24, icon: "check_circle", accentClassName: "text-emerald-600", surfaceClassName: "border-l-emerald-500 bg-emerald-50" },
      { label: "검증 리포트 대기", value: 2, icon: "description", accentClassName: "text-blue-600", surfaceClassName: "border-l-blue-500 bg-blue-50" }
    ],
    cards: [
      {
        id: "CERT-2025-012",
        title: "ISO 14064-1 온실가스 검증",
        site: "포항 제1 열연공장",
        siteCode: "PH-001",
        issuedAt: "2023.01.20",
        expiryAt: "2025.08.30",
        reportName: "최종 검증 보고서_PH001.pdf",
        reportSize: "2.4 MB",
        statusKey: "expiring",
        statusLabel: "만료 임박",
        dueLabel: "D-12",
        accentClassName: "border-t-red-500",
        badgeClassName: "border-red-100 bg-red-50 text-red-600",
        actionLabel: "갱신 신청하기",
        actionHref: "/certificate/apply",
        secondaryLabel: "상세 보기",
        secondaryHref: "/certificate/report_edit"
      },
      {
        id: "CERT-2025-042",
        title: "K-ETS 명세서 인증",
        site: "울산 제3 화학기지",
        siteCode: "US-042",
        issuedAt: "2025.08.05",
        expiryAt: "2025.09.15",
        reportName: "갱신 심사 검토의견_US042.pdf",
        reportSize: "1.2 MB",
        statusKey: "renewal",
        statusLabel: "갱신 심사중",
        dueLabel: "심사 5일차",
        accentClassName: "border-t-amber-500",
        badgeClassName: "border-amber-100 bg-amber-50 text-amber-600",
        actionLabel: "검증 현황 보기",
        actionHref: "/certificate/report_edit",
        secondaryLabel: "신청서 열기",
        secondaryHref: "/certificate/apply"
      },
      {
        id: "CERT-2026-008",
        title: "CCUS 감축 성과 인증서",
        site: "서부 포집 시범단지",
        siteCode: "WC-008",
        issuedAt: "2026.01.12",
        expiryAt: "2027.01.11",
        reportName: "감축성과_발급본_WC008.pdf",
        reportSize: "3.1 MB",
        statusKey: "valid",
        statusLabel: "유효",
        dueLabel: "보관 중",
        accentClassName: "border-t-emerald-500",
        badgeClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
        actionLabel: "재발급 요청",
        actionHref: "/certificate/apply",
        secondaryLabel: "발급 문서 열람",
        secondaryHref: "/certificate/report_list"
      },
      {
        id: "CERT-2026-015",
        title: "REC 전력 사용 검증서",
        site: "남부 CO2 회수센터",
        siteCode: "SC-015",
        issuedAt: "2026.02.18",
        expiryAt: "2026.12.31",
        reportName: "REC_보완검증_SC015.xlsx",
        reportSize: "880 KB",
        statusKey: "verify",
        statusLabel: "검증 리포트 대기",
        dueLabel: "승인 대기",
        accentClassName: "border-t-blue-500",
        badgeClassName: "border-blue-100 bg-blue-50 text-blue-600",
        actionLabel: "보완 수정",
        actionHref: "/certificate/report_edit",
        secondaryLabel: "작성 화면 이동",
        secondaryHref: "/certificate/report_form"
      },
      {
        id: "CERT-2024-037",
        title: "자발적 감축 이행 인증",
        site: "광양 제2 제철소",
        siteCode: "GY-037",
        issuedAt: "2024.04.22",
        expiryAt: "2026.04.20",
        reportName: "재발급요청_첨부_GY037.pdf",
        reportSize: "1.6 MB",
        statusKey: "reissue",
        statusLabel: "재발급 준비",
        dueLabel: "재발급 검토",
        accentClassName: "border-t-fuchsia-500",
        badgeClassName: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700",
        actionLabel: "재발급 접수",
        actionHref: "/certificate/apply",
        secondaryLabel: "기존 발급본 보기",
        secondaryHref: "/certificate/report_list"
      },
      {
        id: "CERT-2025-021",
        title: "준수 확인서",
        site: "수도권 준수 점검단",
        siteCode: "CP-021",
        issuedAt: "2025.06.10",
        expiryAt: "2026.06.09",
        reportName: "준수확인_최종본_CP021.pdf",
        reportSize: "2.0 MB",
        statusKey: "valid",
        statusLabel: "유효",
        dueLabel: "정상 운영",
        accentClassName: "border-t-slate-500",
        badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
        actionLabel: "운영 메모 보기",
        actionHref: "/certificate/report_list",
        secondaryLabel: "통계 리포트 이동",
        secondaryHref: "/admin/certificate/statistics"
      }
    ]
  },
  en: {
    pageTitle: "Certificate Operations",
    pageSubtitle: "Certification PM Dashboard",
    navDashboard: "Dashboard",
    navList: "Certificates",
    navApply: "Renewal",
    navStats: "Statistics",
    managerRole: "Program Owner",
    managerName: "Lee Hyun-jang",
    summaryTitle: "Summary",
    summaryBody: "Prioritize renewals, pending verification, and reissue candidates.",
    listTitle: "Certificate Portfolio",
    listBody: "Review expiry timing and verification report status card by card, then move straight into the next action.",
    searchPlaceholder: "Search certificate title or site code...",
    statusFilterLabel: "Status",
    statusOptions: [
      { value: "ALL", label: "All status" },
      { value: "expiring", label: "Expiring soon" },
      { value: "renewal", label: "Renewal review" },
      { value: "verify", label: "Verification pending" },
      { value: "reissue", label: "Ready for reissue" },
      { value: "valid", label: "Valid certificate" }
    ],
    filterLabel: "Filter",
    createLabel: "New registration",
    openCountLabel: "Results",
    noResultsTitle: "No certificates matched the current filters.",
    noResultsBody: "Adjust the keyword or status filter and try again.",
    issuedLabel: "Issued",
    expiryLabel: "Expires",
    reportLabel: "Latest verification report",
    lastSyncLabel: "Last sync: just now",
    summaryCards: [
      { label: "Expiring within 30 days", value: 3, icon: "event_busy", accentClassName: "text-red-600", surfaceClassName: "border-l-red-500 bg-red-50" },
      { label: "Renewals in progress", value: 5, icon: "pending_actions", accentClassName: "text-amber-600", surfaceClassName: "border-l-amber-500 bg-amber-50" },
      { label: "Valid certificates", value: 24, icon: "check_circle", accentClassName: "text-emerald-600", surfaceClassName: "border-l-emerald-500 bg-emerald-50" },
      { label: "Reports waiting for verification", value: 2, icon: "description", accentClassName: "text-blue-600", surfaceClassName: "border-l-blue-500 bg-blue-50" }
    ],
    cards: [
      {
        id: "CERT-2025-012",
        title: "ISO 14064-1 GHG Verification",
        site: "Pohang Hot Rolling Mill 1",
        siteCode: "PH-001",
        issuedAt: "2023.01.20",
        expiryAt: "2025.08.30",
        reportName: "final_verification_report_PH001.pdf",
        reportSize: "2.4 MB",
        statusKey: "expiring",
        statusLabel: "Expiring soon",
        dueLabel: "D-12",
        accentClassName: "border-t-red-500",
        badgeClassName: "border-red-100 bg-red-50 text-red-600",
        actionLabel: "Start renewal",
        actionHref: "/en/certificate/apply",
        secondaryLabel: "Open detail",
        secondaryHref: "/en/certificate/report_edit"
      },
      {
        id: "CERT-2025-042",
        title: "K-ETS Statement Certification",
        site: "Ulsan Chemical Base 3",
        siteCode: "US-042",
        issuedAt: "2025.08.05",
        expiryAt: "2025.09.15",
        reportName: "renewal_review_feedback_US042.pdf",
        reportSize: "1.2 MB",
        statusKey: "renewal",
        statusLabel: "Renewal review",
        dueLabel: "Day 5",
        accentClassName: "border-t-amber-500",
        badgeClassName: "border-amber-100 bg-amber-50 text-amber-600",
        actionLabel: "View verification status",
        actionHref: "/en/certificate/report_edit",
        secondaryLabel: "Open application",
        secondaryHref: "/en/certificate/apply"
      },
      {
        id: "CERT-2026-008",
        title: "CCUS Reduction Performance Certificate",
        site: "West Coast Capture Pilot",
        siteCode: "WC-008",
        issuedAt: "2026.01.12",
        expiryAt: "2027.01.11",
        reportName: "issued_copy_WC008.pdf",
        reportSize: "3.1 MB",
        statusKey: "valid",
        statusLabel: "Valid",
        dueLabel: "Archived",
        accentClassName: "border-t-emerald-500",
        badgeClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
        actionLabel: "Request reissue",
        actionHref: "/en/certificate/apply",
        secondaryLabel: "Open issued file",
        secondaryHref: "/en/certificate/report_list"
      },
      {
        id: "CERT-2026-015",
        title: "REC Power Verification",
        site: "Southern CO2 Recovery Center",
        siteCode: "SC-015",
        issuedAt: "2026.02.18",
        expiryAt: "2026.12.31",
        reportName: "REC_revision_SC015.xlsx",
        reportSize: "880 KB",
        statusKey: "verify",
        statusLabel: "Verification pending",
        dueLabel: "Approval waiting",
        accentClassName: "border-t-blue-500",
        badgeClassName: "border-blue-100 bg-blue-50 text-blue-600",
        actionLabel: "Revise report",
        actionHref: "/en/certificate/report_edit",
        secondaryLabel: "Open drafting",
        secondaryHref: "/en/certificate/report_form"
      },
      {
        id: "CERT-2024-037",
        title: "Voluntary Reduction Implementation",
        site: "Gwangyang Steel Site 2",
        siteCode: "GY-037",
        issuedAt: "2024.04.22",
        expiryAt: "2026.04.20",
        reportName: "reissue_request_GY037.pdf",
        reportSize: "1.6 MB",
        statusKey: "reissue",
        statusLabel: "Ready for reissue",
        dueLabel: "Reissue review",
        accentClassName: "border-t-fuchsia-500",
        badgeClassName: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700",
        actionLabel: "Register reissue",
        actionHref: "/en/certificate/apply",
        secondaryLabel: "Open original issue",
        secondaryHref: "/en/certificate/report_list"
      },
      {
        id: "CERT-2025-021",
        title: "Compliance Confirmation Certificate",
        site: "Capital Compliance Group",
        siteCode: "CP-021",
        issuedAt: "2025.06.10",
        expiryAt: "2026.06.09",
        reportName: "compliance_final_CP021.pdf",
        reportSize: "2.0 MB",
        statusKey: "valid",
        statusLabel: "Valid",
        dueLabel: "Healthy",
        accentClassName: "border-t-slate-500",
        badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
        actionLabel: "Open ops memo",
        actionHref: "/en/certificate/report_list",
        secondaryLabel: "Open statistics",
        secondaryHref: "/en/admin/certificate/statistics"
      }
    ]
  }
};

function InlineStyles() {
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
        --kr-gov-radius: 8px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; background: var(--kr-gov-blue); color: white; padding: 12px; z-index: 100; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .gov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--kr-gov-radius); font-weight: 700; transition: background-color .2s ease, border-color .2s ease, color .2s ease; }
      .gov-card { border: 1px solid var(--kr-gov-border-light); border-radius: 18px; background: white; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05); }
      .status-badge { display: inline-flex; align-items: center; border-radius: 999px; border-width: 1px; padding: 0.25rem 0.625rem; font-size: 11px; font-weight: 800; }
      .stat-card { border-left-width: 4px; border-radius: 20px; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 1.5rem; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
      .search-input, .search-select { width: 100%; border: 1px solid #dbe2ea; border-radius: 14px; background: white; padding: 0.8rem 1rem; font-size: 0.875rem; outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
      .search-input:focus, .search-select:focus { border-color: var(--kr-gov-blue); box-shadow: 0 0 0 3px rgba(0, 55, 139, 0.12); }
    `}</style>
  );
}

function iconToneClassName(statusKey: CertificateStatusKey) {
  if (statusKey === "expiring") return "bg-red-50 text-red-600";
  if (statusKey === "renewal") return "bg-amber-50 text-amber-600";
  if (statusKey === "verify") return "bg-blue-50 text-blue-600";
  if (statusKey === "reissue") return "bg-fuchsia-50 text-fuchsia-700";
  return "bg-emerald-50 text-emerald-600";
}

export function CertificateListMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = CONTENT[en ? "en" : "ko"];
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CertificateStatusKey>("ALL");

  const filteredCards = useMemo(() => content.cards.filter((card) => {
    const loweredKeyword = keyword.trim().toLowerCase();
    const matchesKeyword = !loweredKeyword || [card.id, card.title, card.site, card.siteCode, card.reportName].some((value) => value.toLowerCase().includes(loweredKeyword));
    const matchesStatus = statusFilter === "ALL" || card.statusKey === statusFilter;
    return matchesKeyword && matchesStatus;
  }), [content.cards, keyword, statusFilter]);

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-list", {
      language: en ? "en" : "ko",
      keyword,
      statusFilter,
      filteredCount: filteredCards.length
    });
  }, [en, filteredCards.length, keyword, statusFilter]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? content.lastSyncLabel : `대한민국 정부 공식 서비스 | 프로젝트 매니저 전용 포털 · ${content.lastSyncLabel}`}
        />

        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <button className="flex items-center gap-3 bg-transparent p-0 text-left" type="button" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}>
              <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]">verified_user</span>
              <div>
                <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
              </div>
            </button>

            <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{content.navDashboard}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/certificate/list", "/en/certificate/list")}>{content.navList}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/apply", "/en/certificate/apply")}>{content.navApply}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/admin/certificate/statistics", "/en/admin/certificate/statistics")}>{content.navStats}</a>
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--kr-gov-text-secondary)]">{content.managerRole}</p>
                <p className="text-sm font-black">{content.managerName}</p>
              </div>
              <UserLanguageToggle en={en} onKo={() => navigate("/certificate/list")} onEn={() => navigate("/en/certificate/list")} />
              {session.value?.authenticated ? (
                <button className="gov-btn bg-[var(--kr-gov-blue)] px-4 py-2 text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => void session.logout()}>
                  {en ? "Logout" : "로그아웃"}
                </button>
              ) : (
                <a className="gov-btn border border-[var(--kr-gov-blue)] px-4 py-2 text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                  {en ? "Login" : "로그인"}
                </a>
              )}
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="border-b border-slate-200 bg-slate-50 py-10" data-help-id="certificate-list-summary">
            <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">{content.summaryTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{content.summaryBody}</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {content.summaryCards.map((card) => (
                  <article className={`stat-card ${card.surfaceClassName}`} key={card.label}>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.surfaceClassName}`}>
                      <span className={`material-symbols-outlined text-[28px] ${card.accentClassName}`}>{card.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">{card.label}</p>
                      <p className={`mt-1 text-3xl font-black ${card.accentClassName}`}>{card.value}<span className="ml-1 text-sm font-semibold text-slate-400">{en ? "items" : "건"}</span></p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black" data-help-id="certificate-list-header">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">format_list_bulleted</span>
                  {content.listTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{content.listBody}</p>
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row" data-help-id="certificate-list-filters">
                <label className="relative min-w-[280px] flex-1 lg:w-80">
                  <span className="sr-only">{content.searchPlaceholder}</span>
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
                  <input className="search-input pl-10" placeholder={content.searchPlaceholder} type="text" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                </label>
                <label className="min-w-[180px]">
                  <span className="sr-only">{content.statusFilterLabel}</span>
                  <select className="search-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | CertificateStatusKey)}>
                    {content.statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button className="gov-btn border border-slate-300 bg-white px-4 py-3 text-xs text-slate-700 hover:bg-slate-50" type="button">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  {content.filterLabel}
                </button>
                <a className="gov-btn bg-[var(--kr-gov-blue)] px-4 py-3 text-xs text-white hover:bg-[var(--kr-gov-blue-hover)]" href={buildLocalizedPath("/certificate/apply", "/en/certificate/apply")}>
                  <span className="material-symbols-outlined text-sm">add</span>
                  {content.createLabel}
                </a>
              </div>
            </div>

            <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4" data-help-id="certificate-list-toolbar">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{content.openCountLabel}</p>
                <p className="mt-1 text-lg font-black text-slate-800">{filteredCards.length} {en ? "certificates" : "개 인증서"}</p>
              </div>
              <a className="inline-flex items-center gap-1 text-sm font-black text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>
                {en ? "Open report workspace" : "보고서 작업면 열기"}
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </a>
            </div>

            {filteredCards.length === 0 ? (
              <section className="gov-card px-6 py-10 text-center" data-help-id="certificate-list-grid">
                <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
                <h3 className="mt-4 text-xl font-black text-slate-800">{content.noResultsTitle}</h3>
                <p className="mt-2 text-sm text-slate-500">{content.noResultsBody}</p>
              </section>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" data-help-id="certificate-list-grid">
                {filteredCards.map((card) => (
                  <article className={`gov-card overflow-hidden border-t-4 ${card.accentClassName}`} key={card.id}>
                    <div className="border-b border-slate-100 p-6">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span className={`status-badge ${card.badgeClassName}`}>{card.statusLabel} ({card.dueLabel})</span>
                        <span className="text-[10px] font-bold text-slate-400">ID: {card.id}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800">{card.title}</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">{card.site} ({card.siteCode})</p>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{content.issuedLabel}</p>
                          <p className="text-sm font-bold text-slate-700">{card.issuedAt}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{content.expiryLabel}</p>
                          <p className={`text-sm font-bold ${card.statusKey === "expiring" ? "text-red-500" : "text-slate-700"}`}>{card.expiryAt}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{content.reportLabel}</p>
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-2xl ${iconToneClassName(card.statusKey)}`}>description</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-bold text-slate-700">{card.reportName}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{card.reportSize}</p>
                          </div>
                          <button className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-blue-200 hover:bg-white hover:text-blue-600" type="button" aria-label={en ? "Download report" : "리포트 다운로드"}>
                            <span className="material-symbols-outlined text-base">download</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-4">
                      <a className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--kr-gov-blue)] px-4 py-3 text-xs font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" href={card.actionHref}>
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                        {card.actionLabel}
                      </a>
                      <a className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-600" href={card.secondaryHref}>
                        {card.secondaryLabel}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        <UserPortalFooter
          orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
          addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
          serviceLine={en ? "Certificate renewal, verification, and reissue workspace for field operators." : "현장 운영자를 위한 인증서 갱신, 검증, 재발급 작업 공간을 제공합니다."}
          footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"]}
          copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
          lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
          waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}

export default CertificateListMigrationPage;
