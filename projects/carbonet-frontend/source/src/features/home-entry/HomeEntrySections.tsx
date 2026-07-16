import { buildLocalizedPath, navigate } from "../../lib/navigation/runtime";
import { useMemo, useState } from "react";
import { HomeButton, HomeInput, HomeLinkButton } from "../home-ui/common";
import { HOME_ENTRY_ASSETS, LOCALIZED_CONTENT, LocalizedHomeContent } from "./homeEntryContent";
import { HomeMenuItem, HomeQuickLink } from "./homeEntryTypes";
import { noticeItems } from "../notice-list/NoticeListMigrationPage";
import { supportEntries } from "../qna-list/QnaListMigrationPage";
import { RESOURCE_ITEMS } from "../download-list/DownloadListMigrationPage";

function getDesktopNavClass(en: boolean) {
  return en
    ? "hidden xl:flex items-center h-full ml-3 2xl:ml-6 flex-1 justify-center min-w-0"
    : "hidden xl:flex items-center gap-0.5 h-full ml-4 2xl:ml-6 flex-1 justify-center min-w-0";
}

function getDesktopNavLinkClass(en: boolean) {
  return en
    ? "gov-text-label h-full flex items-center justify-center px-1.5 2xl:px-2 font-bold whitespace-normal text-center break-words max-w-[96px] 2xl:max-w-[108px] tracking-[-0.01em] text-[var(--kr-gov-text-primary)] border-b-4 border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)] transition-all focus-visible"
    : "gov-text-label h-full flex items-center px-2.5 2xl:px-3 font-bold whitespace-nowrap text-[var(--kr-gov-text-primary)] border-b-4 border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)] transition-all focus-visible";
}

function resolveFooterHref(label: string) {
  if (label === "사이트맵") {
    return "/sitemap";
  }
  if (label === "Sitemap") {
    return "/en/sitemap";
  }
  return "#";
}

export function HomeInlineStyles({ en }: { en: boolean }) {
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
      .gov-home {
        --krds-type-caption: .875rem;
        --krds-type-label: 1rem;
        --krds-type-body-sm: 1rem;
        --krds-type-body: 1.125rem;
        --krds-type-subtitle: 1.25rem;
        --krds-type-title: 1.75rem;
        --krds-type-display: 2.5rem;
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
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .home-brand-copy { min-width: 0; }
      .home-brand-title {
        margin: 0 !important;
        font-size: clamp(1.625rem, 1.4rem + .5vw, 1.875rem) !important;
        line-height: 1 !important;
      }
      .home-brand-subtitle {
        margin: 0 !important;
        font-size: clamp(.875rem, .82rem + .15vw, .9375rem) !important;
        line-height: 1.15 !important;
      }
      .gnb-item:hover .gnb-depth2, .gnb-item:focus-within .gnb-depth2 { display: grid; }
      .home-brand-symbol { position: relative; width: 42px; height: 42px; flex: 0 0 42px; }
      .home-brand-symbol img { position: absolute; inset: 0; width: 42px; height: 42px; object-fit: contain; transition: opacity .2s ease, transform .2s ease; }
      .home-brand-symbol .home-brand-symbol-hover { opacity: 0; transform: scale(.94); }
      .home-brand-link:hover .home-brand-symbol-default,
      .home-brand-link:focus-visible .home-brand-symbol-default { opacity: 0; transform: scale(.94); }
      .home-brand-link:hover .home-brand-symbol-hover,
      .home-brand-link:focus-visible .home-brand-symbol-hover { opacity: 1; transform: scale(1); }
      @media (prefers-reduced-motion: reduce) { .home-brand-symbol img { transition: none; } }
      .gnb-depth2 { width: min(1400px, calc(100vw - 32px)) !important; max-height: 520px; overflow: auto; background: #fff; }
      .gnb-sections { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .gnb-section { min-width: 0; border-left: 1px solid #e2e8f0; padding: 26px 28px; background: transparent; }
      .gnb-section-title { display: flex; align-items: center; gap: 8px; font-size: var(--krds-type-subtitle); line-height: var(--krds-line-compact); font-weight: 800; color: #052b57; margin-bottom: var(--krds-space-2); }
      .gnb-section a::after { content: '☆'; margin-left: auto; color: #94a3b8; font-size: 18px; }
      .gnb-section a:focus-visible, .gnb-depth2 aside a:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
      .gnb-section a:hover::after, .gnb-section a:focus-visible::after { color: #006e6a; content: '★'; }
      .gnb-section a { min-height: var(--krds-control-height-sm); border-radius: 8px; }
      .gnb-section a:hover { background: #eef5ff; box-shadow: inset 3px 0 0 #246beb; }
      .gnb-item > a[aria-current='page'] { color: #246beb; border-bottom-color: #246beb; }
      .gov-home main article.min-w-0 > .divide-y > a { grid-template-columns: 54px minmax(0, 1fr); min-width: 0; }
      .gov-home main article.min-w-0 > .divide-y > a > span:last-child { min-width: 0; }
      body.mobile-menu-open { overflow: hidden; }
    `}</style>
  );
}

export function HeaderBrand({ content, en }: { content: LocalizedHomeContent; en: boolean }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 xl:static xl:translate-x-0 flex w-[250px] max-w-[72vw] items-center shrink-0">
      <HomeLinkButton aria-label={content.logoTitle} className="home-brand-link w-full !min-h-0 !border-0 !bg-transparent !p-0 !text-inherit !font-inherit hover:!bg-transparent focus-visible flex items-center gap-2.5" href={buildLocalizedPath("/home", "/en/home")} variant="ghost">
        <span aria-hidden="true" className="home-brand-symbol">
          <img alt="" className="home-brand-symbol-default" src="/assets/react/img/brand/ccus-symbol-concept-02.png" />
          <img alt="" className="home-brand-symbol-hover" src="/assets/react/img/brand/ccus-symbol-concept-04.png" />
        </span>
        <div className="home-brand-copy min-w-0 flex flex-col text-left">
          <strong className="home-brand-title font-black tracking-[-.03em] text-[#082b61]">CCUS</strong>
          <span className="home-brand-subtitle mt-1 whitespace-nowrap font-extrabold tracking-[-.025em] text-[#246beb]">{en ? "Carbon Neutrality Platform" : "탄소중립 플랫폼"}</span>
        </div>
      </HomeLinkButton>
    </div>
  );
}

function isNavigableMenuUrl(url?: string) {
  return Boolean(url && url !== "#" && url.startsWith("/"));
}

function UnavailableMenuLabel({ label, en, className }: { label: string; en: boolean; className?: string }) {
  return <span aria-disabled="true" className={className} title={en ? "This service is being prepared." : "준비 중인 서비스입니다."}>{label}<span className="sr-only"> ({en ? "Coming soon" : "준비 중"})</span></span>;
}

export function HeaderDesktopNav({ en, homeMenu }: { en: boolean; homeMenu: HomeMenuItem[] }) {
  return (
    <nav className={getDesktopNavClass(en)} aria-label={en ? LOCALIZED_CONTENT.en.navAria : LOCALIZED_CONTENT.ko.navAria}>
      {homeMenu.map((top, index) => (
        <div className="gnb-item group relative h-full min-w-0" key={`${top.label || "top"}-${index}`}>
          {isNavigableMenuUrl(top.url) ? <a aria-current={typeof window !== "undefined" && top.url && window.location.pathname.startsWith(top.url) ? "page" : undefined} className={getDesktopNavLinkClass(en)} href={top.url}>
            {top.label || (en ? "Menu" : "메뉴")}
          </a> : <UnavailableMenuLabel className={`${getDesktopNavLinkClass(en)} cursor-default text-slate-500`} en={en} label={top.label || (en ? "Menu" : "메뉴")} />}
          {(top.sections || []).length ? <div className="gnb-depth2 fixed left-1/2 top-24 hidden max-h-[calc(100vh-112px)] w-[min(1400px,calc(100vw-32px))] -translate-x-1/2 grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-b-xl border border-slate-300 bg-white shadow-[0_12px_32px_rgba(15,42,76,.18)]">
            <aside className="overflow-auto border-r border-[#c6d5e5] bg-[#eef5ff] p-5 text-[#052b57]">
              <strong className="gov-text-label flex items-center gap-2 font-black"><span className="material-symbols-outlined text-xl text-[#246beb]">space_dashboard</span>{en ? "Control panel" : "컨트롤 패널"}</strong>
              {isNavigableMenuUrl(top.url) ? <a className="mt-3 flex min-h-11 items-center justify-between rounded-lg border border-[#8eabd0] bg-white px-3 font-bold text-[#17375e] hover:text-[#00378b]" href={top.url}><span>{top.label}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></a> : null}
              <div className="mt-4 rounded-lg border border-[#c6d5e5] bg-white p-3"><p className="gov-text-caption font-bold text-[#526b89]">{en ? "Available tasks" : "이용 가능한 업무"}</p><strong className="mt-1 block text-2xl text-[#00378b]">{(top.sections || []).reduce((sum, section) => sum + (section.items || []).length, 0)}</strong></div>
              <strong className="gov-text-label mt-5 flex items-center gap-2 border-t border-[#c6d5e5] pt-5 font-black"><span className="material-symbols-outlined text-xl text-[#246beb]">history</span>{en ? "Recent menu" : "최근 메뉴"}</strong>
              <div className="mt-2 space-y-1">{(top.sections || []).flatMap((section) => section.items || []).filter((item) => isNavigableMenuUrl(item.url)).slice(0, 5).map((item, recentIndex) => <a className="gov-text-caption flex min-h-10 items-center justify-between rounded-lg px-2 font-bold text-[#334e6f] hover:bg-white hover:text-[#164f86]" href={item.url} key={`recent-${recentIndex}`}><span className="truncate">{item.label}</span><span className="material-symbols-outlined text-base text-[#246beb]">chevron_right</span></a>)}</div>
            </aside>
            <section className="min-w-0 overflow-auto p-6"><div className="mb-5 border-b border-slate-200 pb-4"><strong className="gov-text-heading-sm text-[#052b57]">{top.label}</strong><p className="gov-text-caption mt-1 text-slate-500">{en ? "Select a task to continue" : "중메뉴와 세부 업무를 선택하세요"}</p></div><div className="grid grid-cols-4 gap-5">{(top.sections || []).map((section, sectionIndex) => <div className="min-w-0 border-l border-slate-200 px-4" key={`hover-section-${sectionIndex}`}><strong className="gov-text-label block pb-3 font-black text-[#17375e]">{section.label}</strong><div className="space-y-0.5">{(section.items || []).filter((item) => isNavigableMenuUrl(item.url)).map((item, itemIndex) => <a className="gov-text-body-sm flex min-h-10 items-center justify-between rounded-md px-2 text-slate-700 hover:bg-blue-50 hover:text-[#00378b]" href={item.url} key={`hover-item-${itemIndex}`}><span>{item.label}</span><span className="material-symbols-outlined text-base text-slate-400">chevron_right</span></a>)}</div></div>)}</div></section>
          </div> : null}
        </div>
      ))}
    </nav>
  );
}

export function HeaderMobileMenu({
  content,
  en,
  homeMenu,
  isLoggedIn,
  canEnterAdminConsole = false,
  onClose,
  onLogout
}: {
  content: LocalizedHomeContent;
  en: boolean;
  homeMenu: HomeMenuItem[];
  isLoggedIn: boolean;
  canEnterAdminConsole?: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <aside className="absolute top-0 right-0 h-full w-[90%] max-w-[380px] bg-white shadow-2xl border-l border-[var(--kr-gov-border-light)] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-[var(--kr-gov-border-light)] bg-white">
        <strong className="gov-text-heading-sm font-bold text-[var(--kr-gov-text-primary)]">{content.allMenu}</strong>
        <HomeButton id="mobile-menu-close" className="w-10 h-10 !p-0 text-[var(--kr-gov-text-secondary)]" type="button" aria-label={content.closeAllMenu} onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </HomeButton>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              {canEnterAdminConsole ? (
                <HomeLinkButton className="flex-1" href={buildLocalizedPath("/admin/", "/en/admin/")} variant="secondary">{en ? "Admin Console" : "관리자 콘솔"}</HomeLinkButton>
              ) : null}
              <HomeButton className="flex-1" type="button" onClick={() => void onLogout()} variant="primary">{content.logout}</HomeButton>
            </>
          ) : (
            <>
              <HomeLinkButton className="flex-1" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} variant="primary">{content.login}</HomeLinkButton>
              <HomeLinkButton className="flex-1" href={buildLocalizedPath("/join/step1", "/join/en/step1")} variant="secondary">{content.signup}</HomeLinkButton>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <HomeButton type="button" className={en ? "!text-[var(--kr-gov-text-secondary)]" : ""} onClick={() => navigate("/home")} variant={en ? "secondary" : "primary"}>KO</HomeButton>
          <HomeButton type="button" className={en ? "" : "!text-[var(--kr-gov-text-secondary)]"} onClick={() => navigate("/en/home")} variant={en ? "primary" : "secondary"}>EN</HomeButton>
        </div>
        <div className="space-y-3">
          {homeMenu.map((top, index) => (
            <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] p-3" key={`${top.label || "mobile-top"}-${index}`}>
              <h3 className="gov-text-body font-extrabold text-[var(--kr-gov-blue)] mb-2">{top.label || (en ? "Menu" : "메뉴")}</h3>
              {(top.sections || []).map((section, sectionIndex) => (
                <div key={`${section.label || "mobile-section"}-${sectionIndex}`}>
                  <p className="gov-text-label font-bold text-[var(--kr-gov-text-secondary)] mt-2 mb-1">{section.label || (en ? "Section" : "섹션")}</p>
                  <div className="space-y-1 text-sm mb-2">
                    {(section.items || []).filter((item) => isNavigableMenuUrl(item.url)).map((item, itemIndex) => (
                      <a className="block py-1" href={item.url} key={`${item.label || "mobile-item"}-${itemIndex}`}>
                        {item.label || (en ? "Item" : "항목")}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function HeroSection({ content }: { content: LocalizedHomeContent }) {
  return (
    <section className="relative flex h-[400px] items-center overflow-hidden bg-slate-900" data-help-id="home-hero">
      <div className="absolute inset-0">
        <img alt="CCUS Industrial Facility" className="h-full w-full object-cover" src={HOME_ENTRY_ASSETS.HERO_IMAGE} />
        <div className="absolute inset-0 bg-[#001e40]/60 backdrop-blur-[2px]" />
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 text-center text-white lg:px-8">
        <h1 className="gov-text-heading-lg font-black tracking-tight">{content.heroTitle.replace("\n", " ")}</h1>
        <p className="gov-text-body mx-auto mt-5 max-w-3xl font-semibold text-blue-100/95 sm:mt-6">{content.heroDescription}</p>
      </div>
    </section>
  );
}

type SearchSectionProps = {
  content: LocalizedHomeContent;
  homeMenu: HomeMenuItem[];
};

export type SearchCandidate = {
  label: string;
  description?: string;
  href: string;
  tone: "menu" | "work" | "post";
};

type ServiceMapItem = {
  label: string;
  href: string;
  parentLabel: string;
};

type ServiceMapGroup = {
  key: string;
  labelKo: string;
  labelEn: string;
  descriptionKo: string;
  descriptionEn: string;
  icon: string;
  items: ServiceMapItem[];
};

type ServiceGroupDefinition = Omit<ServiceMapGroup, "items"> & {
  matcher: (href: string) => boolean;
};

const SERVICE_GROUP_DEFINITIONS: ServiceGroupDefinition[] = [
  {
    key: "emission",
    labelKo: "배출·산정",
    labelEn: "Emission & Calculation",
    descriptionKo: "배출 프로젝트, 데이터 입력, LCI, 감축 시나리오와 산정 검증을 묶었습니다.",
    descriptionEn: "Emission projects, data input, LCI, reduction scenarios, and validation.",
    icon: "factory",
    matcher: (href: string) => href.includes("/emission/") || href.includes("/co2/")
  },
  {
    key: "monitoring",
    labelKo: "모니터링·공유",
    labelEn: "Monitoring & Sharing",
    descriptionKo: "대시보드, 실시간 경보, ESG 보고, 추적 리포트와 이해관계자 공유 화면입니다.",
    descriptionEn: "Dashboards, real-time alerts, ESG reports, tracking, and stakeholder sharing.",
    icon: "monitoring",
    matcher: (href: string) => href.includes("/monitoring/")
  },
  {
    key: "trade",
    labelKo: "거래·정산",
    labelEn: "Trading & Settlement",
    descriptionKo: "거래 시장, 구매/판매, 자동 매칭, 가격 알림과 정산 리포트를 묶었습니다.",
    descriptionEn: "Marketplace, buy/sell requests, auto matching, alerts, and settlement reports.",
    icon: "storefront",
    matcher: (href: string) => href.includes("/trade/")
  },
  {
    key: "payment",
    labelKo: "결제·증빙",
    labelEn: "Payment & Evidence",
    descriptionKo: "결제 요청, 가상계좌, 환불, 세금계산서, 영수증 관리를 한 곳에 모았습니다.",
    descriptionEn: "Payment requests, virtual accounts, refunds, invoices, and receipts.",
    icon: "payments",
    matcher: (href: string) => href.includes("/payment/")
  },
  {
    key: "certificate",
    labelKo: "인증서·보고서",
    labelEn: "Certificates & Reports",
    descriptionKo: "인증서 신청, 보고서 작성/수정, 보고서 목록과 발급 상태를 연결합니다.",
    descriptionEn: "Certificate applications, report creation/editing, report lists, and issuance status.",
    icon: "verified",
    matcher: (href: string) => href.includes("/certificate/")
  },
  {
    key: "education",
    labelKo: "교육·자격",
    labelEn: "Education & Qualification",
    descriptionKo: "교육과정, 나의 교육, 진도, 설문, 수료증과 자격 연계를 묶었습니다.",
    descriptionEn: "Courses, my learning, progress, surveys, certificates, and qualifications.",
    icon: "school",
    matcher: (href: string) => href.includes("/edu/")
  },
  {
    key: "support",
    labelKo: "고객지원·자료",
    labelEn: "Support & Resources",
    descriptionKo: "공지사항, 자료실, FAQ, Q&A, 문의 내역과 사이트맵을 모았습니다.",
    descriptionEn: "Notices, resources, FAQ, Q&A, inquiry history, and sitemap.",
    icon: "support_agent",
    matcher: (href: string) => href.includes("/support/") || href.includes("/mtn/") || href.includes("/sitemap")
  },
  {
    key: "mypage",
    labelKo: "마이페이지·계정",
    labelEn: "My Page & Account",
    descriptionKo: "프로필, 기업 정보, 담당자, 비밀번호, 알림과 수신 설정을 묶었습니다.",
    descriptionEn: "Profile, company info, staff, password, notifications, and marketing settings.",
    icon: "person",
    matcher: (href: string) => href.includes("/mypage/")
  },
  {
    key: "join",
    labelKo: "가입·온보딩",
    labelEn: "Join & Onboarding",
    descriptionKo: "회원가입, 기업 등록, 재신청, 가입 상태 조회와 온보딩 화면입니다.",
    descriptionEn: "Sign-up, company registration, reapply, status lookup, and onboarding.",
    icon: "how_to_reg",
    matcher: (href: string) => href.includes("/join/")
  },
  {
    key: "entry",
    labelKo: "로그인·공통",
    labelEn: "Sign-in & Common",
    descriptionKo: "로그인, 아이디/비밀번호 찾기, 권한 안내와 공통 진입 화면입니다.",
    descriptionEn: "Login, account recovery, access guidance, and common entry pages.",
    icon: "login",
    matcher: (href: string) => href.includes("/signin/") || href.includes("/flutter-app") || href.includes("/placeholder")
  }
];

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/#/g, "");
}

export function buildSearchCandidates(content: LocalizedHomeContent, homeMenu: HomeMenuItem[], en: boolean) {
  const menuCandidates = homeMenu.flatMap((top) => {
    const topHref = top.url || top.sections?.flatMap((section) => section.items || []).find((item) => item.url)?.url;
    const topItem = top.label && topHref ? [{ label: top.label, href: topHref, tone: "menu" as const }] : [];
    const sections = (top.sections || []).flatMap((section) => {
      const sectionHref = section.items?.find((item) => item.url)?.url;
      return section.label && sectionHref
        ? [{ label: section.label, description: String(top.label || ""), href: sectionHref, tone: "menu" as const }]
        : [];
    });
    return [...topItem, ...sections];
  });
  const workCandidates = homeMenu.flatMap((top) => (top.sections || []).flatMap((section) =>
    (section.items || []).filter((item) => item.label && item.url).map((item) => ({
      label: String(item.label),
      description: [top.label, section.label].filter(Boolean).join(" · "),
      href: String(item.url),
      tone: "work" as const
    }))
  ));
  const serviceCandidates = content.services.map((service) => ({
    label: service.title,
    description: service.description,
    href: service.href,
    tone: "work" as const
  }));
  const postCandidates: SearchCandidate[] = [
    ...noticeItems.map((item) => ({ label: en ? item.titleEn : item.titleKo, description: en ? item.summaryEn : item.summaryKo, href: buildLocalizedPath(`/support/notice_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`, `/en/support/notice_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`), tone: "post" as const })),
    ...supportEntries.map((item) => ({ label: en ? item.titleEn : item.titleKo, description: en ? item.summaryEn : item.summaryKo, href: buildLocalizedPath(`/support/qna_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`, `/en/support/qna_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`), tone: "post" as const })),
    ...RESOURCE_ITEMS.map((item) => ({ label: en ? item.titleEn : item.titleKo, description: en ? item.summaryEn : item.summaryKo, href: buildLocalizedPath(`/support/download_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`, `/en/support/download_list?searchKeyword=${encodeURIComponent(en ? item.titleEn : item.titleKo)}`), tone: "post" as const }))
  ];
  const deduped = new Map<string, SearchCandidate>();
  [...menuCandidates, ...workCandidates, ...serviceCandidates, ...postCandidates].forEach((candidate) => {
    deduped.set(`${candidate.tone}::${candidate.label}::${candidate.href}`, candidate);
  });
  return Array.from(deduped.values());
}

export function SearchSection({ content, homeMenu }: SearchSectionProps) {
  const [query, setQuery] = useState("");
  const [bannerIndex, setBannerIndex] = useState(0);
  const en = content.skipLink === LOCALIZED_CONTENT.en.skipLink;
  const banners = en ? [
    { eyebrow: "Carbon Operations", title: "Manage emissions projects in one place", body: "Track activity data, calculation, verification, and reporting progress.", href: "/emission/project_list", tone: "from-[#063a74] to-[#246beb]" },
    { eyebrow: "Product LCA", title: "Connect inventory data to impact assessment", body: "Manage materials, energy, transport, products, and byproducts.", href: "/emission/lca", tone: "from-[#164f86] to-[#4777a8]" },
    { eyebrow: "Public Service", title: "Verify certificate authenticity instantly", body: "Check issued certificates and reports without signing in.", href: "/home/certificate-verify", tone: "from-[#344b65] to-[#246beb]" }
  ] : [
    { eyebrow: "탄소배출 관리", title: "배출량 프로젝트를 한곳에서 관리하세요", body: "활동자료부터 산정·검증·보고까지 업무 진행 상황을 확인합니다.", href: "/emission/project_list", tone: "from-[#063a74] to-[#246beb]" },
    { eyebrow: "제품 LCA", title: "인벤토리 데이터와 영향평가를 연결합니다", body: "원료·에너지·운송·제품·부산물 데이터를 체계적으로 관리합니다.", href: "/emission/lca", tone: "from-[#164f86] to-[#4777a8]" },
    { eyebrow: "공공 서비스", title: "인증서 진위 여부를 바로 확인하세요", body: "로그인 없이 발급된 인증서와 보고서의 진위 여부를 검증합니다.", href: "/home/certificate-verify", tone: "from-[#344b65] to-[#246beb]" }
  ];
  const candidates = useMemo(() => buildSearchCandidates(content, homeMenu, en), [content, en, homeMenu]);
  const normalizedQuery = normalizeSearchValue(query);
  const suggestions = normalizedQuery ? candidates.filter((candidate) =>
    normalizeSearchValue(`${candidate.label} ${candidate.description || ""}`).includes(normalizedQuery)
  ) : [];
  const groupedSuggestions = (["menu", "work", "post"] as const).map((tone) => ({
    tone,
    items: suggestions.filter((candidate) => candidate.tone === tone)
  }));

  function executeSearch(nextQuery?: string, preferredLink?: HomeQuickLink) {
    if (preferredLink?.href) {
      navigate(preferredLink.href);
      return;
    }
    const targetQuery = typeof nextQuery === "string" ? nextQuery : query;
    navigate(buildLocalizedPath(`/home/search?q=${encodeURIComponent(targetQuery.trim())}`, `/en/home/search?q=${encodeURIComponent(targetQuery.trim())}`));
  }

  return (
    <section className="relative z-20 -mt-32 border-b border-[var(--kr-gov-border-light)] bg-transparent pb-10" data-help-id="home-search">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h3 className="sr-only">{content.searchTitle}</h3>
        <div className="relative group max-w-3xl mx-auto">
          <HomeInput className="h-16 border border-white/40 bg-white/95 pl-8 pr-20 text-lg shadow-2xl backdrop-blur-md placeholder-gray-500 focus:border-white focus:ring-4 focus:ring-white/20" placeholder={content.searchPlaceholder} type="text" aria-label={content.searchAria} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { executeSearch(); } }} />
          <HomeButton type="button" className="absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 !p-0" onClick={() => executeSearch()} variant="primary">
            <span className="material-symbols-outlined text-[28px]">search</span>
          </HomeButton>
          {normalizedQuery ? (
            <div className="absolute left-0 right-0 z-50 mt-3 max-h-[min(65vh,620px)] overflow-y-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white text-left shadow-2xl">
              <div className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">{en ? `${suggestions.length} integrated search results` : `통합검색 결과 ${suggestions.length}건`}</div>
              {groupedSuggestions.map((group) => (
                <section className="border-b border-slate-100 p-3 last:border-0" key={group.tone}>
                  <div className="flex items-center justify-between px-2 py-2">
                    <h4 className="font-black text-[#052b57]">{{ menu: en ? "Menus" : "메뉴", work: en ? "Work" : "업무", post: en ? "Posts" : "게시글" }[group.tone]}</h4>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-[#164f86]">{group.items.length}</span>
                  </div>
                  {group.items.length ? group.items.slice(0, 10).map((candidate) => (
                    <HomeButton key={`${candidate.tone}-${candidate.label}-${candidate.href}`} type="button" className="flex w-full items-start gap-3 !border-0 !bg-transparent px-3 py-3 text-sm hover:!bg-blue-50" onClick={() => navigate(candidate.href)} variant="ghost">
                      <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#246beb]">{{ menu: "menu", work: "task_alt", post: "article" }[candidate.tone]}</span>
                      <span className="min-w-0"><span className="block font-bold text-[var(--kr-gov-text-primary)]">{candidate.label}</span>{candidate.description ? <span className="mt-1 block truncate text-xs text-slate-500">{candidate.description}</span> : null}</span>
                    </HomeButton>
                  )) : <p className="px-3 py-3 text-sm text-slate-500">{en ? "No matching results." : "일치하는 결과가 없습니다."}</p>}
                  {group.items.length > 10 ? <p className="px-3 py-2 text-xs font-bold text-slate-500">{en ? `and ${group.items.length - 10} more results` : `외 ${group.items.length - 10}건`}</p> : null}
                </section>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/20 bg-[#001e40]/55 px-5 py-2.5 text-sm text-white shadow-lg backdrop-blur-md">
          <span className="mr-1 font-black text-blue-100">{content.popularSearches}</span>
          {content.popularTags.map((tag) => (
            <HomeButton type="button" className="rounded-full !border-white/30 !bg-white/10 px-3 py-1 text-[13px] !text-white hover:!bg-white/20" key={tag.label} onClick={() => { setQuery(tag.query || tag.label); executeSearch(tag.query || tag.label, tag); }} variant="secondary">{tag.label}</HomeButton>
          ))}
        </div>
      </div>
      <div className="krds-responsive-container mt-8 grid w-full max-w-7xl min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={`relative min-h-[250px] min-w-0 max-w-full overflow-hidden rounded-xl bg-gradient-to-r ${banners[bannerIndex].tone} p-7 text-left text-white shadow-lg sm:p-9`} aria-roledescription={en ? "carousel" : "배너 슬라이드"}>
          <div className="relative z-10 max-w-[72%]">
            <p className="krds-type-label font-black text-blue-100">{banners[bannerIndex].eyebrow}</p>
            <h2 className="krds-type-title mt-3 font-black text-white">{banners[bannerIndex].title}</h2>
            <p className="krds-type-body mt-3 font-medium text-blue-50">{banners[bannerIndex].body}</p>
            <a className="krds-control mt-6 inline-flex items-center gap-2 rounded-lg bg-white font-black text-[#063a74] hover:bg-blue-50" href={banners[bannerIndex].href}>{en ? "Go to service" : "서비스 바로가기"}<span className="material-symbols-outlined text-lg">arrow_forward</span></a>
          </div>
          <span className="material-symbols-outlined absolute bottom-4 right-8 text-[118px] text-white/10" aria-hidden="true">monitoring</span>
          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1 rounded-full bg-black/25 p-1">
            <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus-visible" type="button" aria-label={en ? "Previous banner" : "이전 배너"} onClick={() => setBannerIndex((bannerIndex + banners.length - 1) % banners.length)}><span className="material-symbols-outlined">chevron_left</span></button>
            <span className="min-w-12 text-center text-xs font-black">{bannerIndex + 1} / {banners.length}</span>
            <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus-visible" type="button" aria-label={en ? "Next banner" : "다음 배너"} onClick={() => setBannerIndex((bannerIndex + 1) % banners.length)}><span className="material-symbols-outlined">chevron_right</span></button>
          </div>
        </section>
        <aside className="krds-component min-h-[250px] min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-300 bg-white text-left shadow-sm">
          <p className="krds-type-label font-black text-[#246beb]">{en ? "MEMBER SERVICE" : "회원 서비스"}</p>
          <h2 className="krds-type-subtitle mt-2 font-black text-[#052b57]">{en ? "Sign in to continue your work" : "로그인하고 업무를 이어가세요"}</h2>
          <p className="krds-type-body mt-2 text-slate-600">{en ? "Review projects, approvals, schedules, and notifications." : "프로젝트, 승인, 일정과 알림을 한곳에서 확인할 수 있습니다."}</p>
          <div className="mt-6 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <a className="krds-control col-span-2 inline-flex items-center justify-center rounded-lg bg-[#246beb] font-black text-white hover:bg-[#164f86]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Sign in" : "로그인"}</a>
            <a className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] font-black text-[#164f86] hover:bg-blue-50" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{en ? "Sign up" : "회원가입"}</a>
            <a className="krds-control inline-flex items-center justify-center rounded-lg border border-slate-300 font-black text-slate-700 hover:bg-slate-50" href={buildLocalizedPath("/signin/findId", "/en/signin/findId")}>{en ? "Find account" : "계정 찾기"}</a>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs font-bold text-slate-600"><a className="hover:text-[#246beb] hover:underline" href="/support/notice">{en ? "Notices" : "공지사항"}</a><a className="hover:text-[#246beb] hover:underline" href="/support/faq">FAQ</a><a className="hover:text-[#246beb] hover:underline" href="/home/certificate-verify">{en ? "Verify certificate" : "인증서 진위 확인"}</a></div>
        </aside>
      </div>
    </section>
  );
}

export function CoreServiceGrid({ content }: { content: LocalizedHomeContent }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-help-id="home-services">
      {content.services.map((service) => (
        <a className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white transition-all hover:shadow-lg focus-visible outline-none flex flex-col items-start h-full p-6 group h-full" href={service.href} key={service.title}>
          <div className="w-14 h-14 bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-blue)] rounded-[var(--kr-gov-radius)] flex items-center justify-center mb-6 group-hover:bg-[var(--kr-gov-blue)] group-hover:text-white transition-colors border border-[var(--kr-gov-border-light)]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 400" }}>{service.icon}</span>
          </div>
          <h3 className="text-lg font-bold mb-2">{service.title}</h3>
          <p className="text-[var(--kr-gov-text-secondary)] text-sm leading-relaxed">{service.description}</p>
        </a>
      ))}
    </div>
  );
}

export function RealtimeDashboardSection({ en }: { en: boolean }) {
  const updatedAt = new Intl.DateTimeFormat(en ? "en-US" : "ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  return (
    <section className="border-t-4 border-[var(--kr-gov-blue)] bg-white py-14" data-help-id="home-realtime-dashboard">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--kr-gov-blue)]">LIVE STATUS</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{en ? "Real-time Status Dashboard" : "실시간 현황 대시보드"}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">{en ? `Latest operational data · ${updatedAt}` : `최신 운영 데이터 · ${updatedAt}`}</p>
          </div>
          <a className="inline-flex items-center gap-2 text-sm font-black text-[var(--kr-gov-blue)] hover:underline" href={en ? "/en/monitoring/realtime" : "/monitoring/realtime"}>
            {en ? "View details" : "상세 분석 보기"}<span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </a>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <article className="rounded-lg border border-slate-300 bg-white p-7">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-600">{en ? "Cumulative CO₂ reduction" : "누적 CO₂ 절감량"}</p><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{en ? "ON TARGET" : "목표 달성 중"}</span></div>
            <p className="mt-5 text-4xl font-black tabular-nums text-[#002a55]">1,452,890 <span className="text-xl font-semibold">tCO₂</span></p>
            <p className="mt-3 text-sm font-black text-emerald-700">↗ {en ? "+12.4% from previous month" : "전월 대비 +12.4%"}</p>
            <div className="mt-7 flex items-center justify-between text-xs font-bold text-slate-600"><span>{en ? "Annual target" : "연간 목표 달성률"}</span><span>72.6%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[72.6%] rounded-full bg-emerald-700" /></div>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-7">
            <p className="text-sm font-bold text-slate-600">{en ? "Projects in progress" : "진행 중인 프로젝트"}</p>
            <div className="mt-12 grid grid-cols-2 divide-x divide-slate-300">
              <div><p className="text-4xl font-black tabular-nums text-[#002a55]">18</p><p className="mt-2 text-xs font-bold text-slate-600">{en ? "Commercial" : "상용화 단계"}</p></div>
              <div className="pl-8"><p className="text-4xl font-black tabular-nums text-[#002a55]">27</p><p className="mt-2 text-xs font-bold text-slate-600">{en ? "Pilot / demonstration" : "실증·파일럿"}</p></div>
            </div>
            <div className="mt-10 grid grid-cols-[40%_60%] gap-1"><span className="h-2 bg-[#002a55]" /><span className="h-2 bg-blue-300" /></div>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-7">
            <p className="text-sm font-bold text-slate-600">{en ? "Certificate processing" : "인증 처리 상태"}</p>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[conic-gradient(#002a55_0_85%,#e2e8f0_85%)]"><div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white"><strong className="text-2xl text-[#002a55]">85%</strong><span className="text-[10px] font-bold text-slate-500">{en ? "COMPLETE" : "완료율"}</span></div></div>
              <div className="space-y-3 text-sm font-bold"><p><span className="mr-2 inline-block h-3 w-3 bg-[#002a55]" />124{en ? " completed" : "건 인증 완료"}</p><p><span className="mr-2 inline-block h-3 w-3 bg-blue-300" />22{en ? " reviewing" : "건 검토 중"}</p></div>
            </div>
            <a className="mt-5 flex min-h-11 items-center justify-center border border-[#002a55] font-black text-[#002a55] hover:bg-blue-50" href={en ? "/en/home/certificate-verify" : "/home/certificate-verify"}>{en ? "Verify certificate" : "인증서 확인하기"}</a>
          </article>
        </div>
      </div>
    </section>
  );
}

function collectServiceMapItems(homeMenu: HomeMenuItem[]) {
  const byHref = new Map<string, ServiceMapItem>();
  homeMenu.forEach((top) => {
    const parentLabel = top.label || "";
    if (top.label && top.url && top.url !== "#") {
      byHref.set(top.url, { label: top.label, href: top.url, parentLabel });
    }
    (top.sections || []).forEach((section) => {
      (section.items || []).forEach((item) => {
        if (!item.label || !item.url || item.url === "#") return;
        byHref.set(item.url, { label: item.label, href: item.url, parentLabel: section.label || parentLabel });
      });
    });
  });
  return Array.from(byHref.values()).sort((left, right) => left.href.localeCompare(right.href));
}

function buildServiceMapGroups(homeMenu: HomeMenuItem[]) {
  const items = collectServiceMapItems(homeMenu);
  const groups = SERVICE_GROUP_DEFINITIONS.map((definition) => ({
    key: definition.key,
    labelKo: definition.labelKo,
    labelEn: definition.labelEn,
    descriptionKo: definition.descriptionKo,
    descriptionEn: definition.descriptionEn,
    icon: definition.icon,
    items: items.filter((item) => definition.matcher(item.href))
  }));
  const assigned = new Set(groups.flatMap((group) => group.items.map((item) => item.href)));
  const otherItems = items.filter((item) => !assigned.has(item.href));
  if (otherItems.length > 0) {
    groups.push({
      key: "other",
      labelKo: "기타·추가 검토",
      labelEn: "Other & Review",
      descriptionKo: "기존 분류에 속하지 않는 메뉴입니다. 필요 시 작업대에서 유사 화면과 재분류합니다.",
      descriptionEn: "Menus outside the current taxonomy. Reclassify them with related pages in the workbench when needed.",
      icon: "category",
      items: otherItems
    });
  }
  return groups.filter((group) => group.items.length > 0);
}

export function ServiceMapSection({ content, homeMenu }: { content: LocalizedHomeContent; homeMenu: HomeMenuItem[] }) {
  const english = content.skipLink === LOCALIZED_CONTENT.en.skipLink;
  const [activeGroupKey, setActiveGroupKey] = useState<string>("all");
  const groups = useMemo(() => buildServiceMapGroups(homeMenu), [homeMenu]);
  const visibleGroups = activeGroupKey === "all" ? groups : groups.filter((group) => group.key === activeGroupKey);
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-20 border-t border-[var(--kr-gov-border-light)]" data-help-id="home-service-map">
      <div className="krds-responsive-container max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--kr-gov-blue)]">{english ? "Full Service Map" : "전체 서비스 맵"}</p>
            <h2 className="mt-3 text-3xl font-bold text-[var(--kr-gov-text-primary)]">{english ? "All pages grouped by workflow" : "모든 화면을 업무 흐름별로 묶어 확인"}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--kr-gov-text-secondary)]">
              {english
                ? "Every home-facing menu is organized into related sections so incomplete pages can be expanded, renamed, or merged with the right workflow."
                : "홈 페이지의 모든 메뉴를 연관 업무군으로 묶어, 부족한 화면은 확장하고 메뉴명 변경이나 추가 화면 구성 대상을 빠르게 판단할 수 있습니다."}
            </p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
            {english ? "Mapped pages" : "분류된 화면"} <span className="ml-2 text-xl font-black text-[var(--kr-gov-blue)]">{totalCount}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <HomeButton type="button" className="rounded-full px-4 py-2 text-sm" variant={activeGroupKey === "all" ? "primary" : "secondary"} onClick={() => setActiveGroupKey("all")}>
            {english ? "All" : "전체"}
          </HomeButton>
          {groups.map((group) => (
            <HomeButton key={group.key} type="button" className="rounded-full px-4 py-2 text-sm" variant={activeGroupKey === group.key ? "primary" : "secondary"} onClick={() => setActiveGroupKey(group.key)}>
              {english ? group.labelEn : group.labelKo} ({group.items.length})
            </HomeButton>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {visibleGroups.map((group) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm" key={group.key}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined">{group.icon}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{english ? group.labelEn : group.labelKo}</h3>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-[var(--kr-gov-blue)]">{group.items.length}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{english ? group.descriptionEn : group.descriptionKo}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {group.items.slice(0, 12).map((item) => (
                  <a className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-3 py-3 text-sm font-bold text-[var(--kr-gov-text-primary)] transition hover:border-[var(--kr-gov-blue)] hover:bg-blue-50 focus-visible" href={item.href} key={`${group.key}-${item.href}`}>
                    <span className="block truncate">{item.label}</span>
                    {item.parentLabel ? <span className="mt-1 block truncate text-[11px] font-semibold text-[var(--kr-gov-text-secondary)]">{item.parentLabel}</span> : null}
                  </a>
                ))}
              </div>
              {group.items.length > 12 ? (
                <p className="mt-4 text-xs font-bold text-[var(--kr-gov-text-secondary)]">
                  {english ? `${group.items.length - 12} more pages are available from the header menu.` : `나머지 ${group.items.length - 12}개 화면은 상단 메뉴에서 이어서 확인할 수 있습니다.`}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SummarySection({ content }: { content: LocalizedHomeContent }) {
  const en = content.skipLink === LOCALIZED_CONTENT.en.skipLink;
  return (
    <section className="bg-[#f4f7fb] border-y border-[var(--kr-gov-border-light)] py-12" data-help-id="home-summary">
      <div className="krds-responsive-container max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-end mb-7 gap-4">
          <div>
            <p className="krds-type-label mb-2 font-black text-[#246beb]">{en ? "Integrated Monitoring" : "통합 모니터링"}</p>
            <h2 className="krds-type-title font-black text-[#062c55] mb-2">{content.summaryTitle}</h2>
            <p className="krds-type-body text-[var(--kr-gov-text-secondary)] font-medium">{content.summaryDescription}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--kr-gov-text-secondary)] font-bold">
            <span className="material-symbols-outlined text-[18px]">update</span>
            {content.summaryUpdated}
          </div>
        </div>
        <div className="krds-auto-layout !grid-cols-1 lg:!grid-cols-3 !gap-4">
          <div className="krds-component bg-white border border-blue-100 border-t-[3px] border-t-blue-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <h4 className="font-bold text-[var(--kr-gov-text-secondary)]">{content.summaryCards[0].title}</h4>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded">{content.summaryCards[0].badge}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-black text-[var(--kr-gov-blue)] tracking-tight">{content.summaryCards[0].value}</span>
              <span className="text-lg font-bold text-gray-400">{content.summaryCards[0].unit}</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span>{content.summaryCards[0].progressLabel}</span>
                <span className="text-[var(--kr-gov-blue)]">{content.summaryCards[0].progressValue}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: content.summaryCards[0].progressWidth }} />
              </div>
              <div className="mt-6 flex h-20 items-end gap-3 border-b border-slate-200 px-2" aria-label={en ? "Monthly emission trend" : "월별 배출량 추이"}>
                {[48, 70, 58, 82, 64, 76].map((height, index) => <div className="flex flex-1 items-end gap-1" key={index}><span className="w-1/2 bg-slate-200" style={{ height: `${Math.max(20, height - 12)}%` }} /><span className="w-1/2 bg-blue-700" style={{ height: `${height}%` }} /></div>)}
              </div>
            </div>
          </div>
          <div className="krds-component bg-white border border-blue-100 border-t-[3px] border-t-[#246beb] rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-[var(--kr-gov-text-secondary)] mb-6">{content.summaryCards[1].title}</h4>
            <div className="mb-6 divide-y divide-slate-200 border-y border-slate-200">
              {(en ? ["Activity data submission", "Emission calculation review", "Annual report approval", "Evidence supplementation"] : ["활동자료 제출 요청", "배출량 산정 검토", "연간 보고서 승인", "증빙자료 보완"]).map((task, index) => <div className="flex items-center justify-between gap-3 py-3 text-sm" key={task}><span className="truncate font-semibold">{task}</span><span className={`shrink-0 rounded px-2 py-1 text-[11px] font-black ${index < 2 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{index < 2 ? (en ? "Active" : "진행중") : (en ? "Planned" : "예정")}</span></div>)}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--kr-gov-blue)]">
              <span className="material-symbols-outlined">trending_up</span>
              {content.summaryCards[1].note}
            </div>
          </div>
          <div className="krds-component bg-white border border-blue-100 border-t-[3px] border-t-amber-500 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-[var(--kr-gov-text-secondary)] mb-6">{content.summaryCards[2].title}</h4>
            <div className="flex items-center justify-between gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                  <circle className="text-gray-100" cx="48" cy="48" fill="transparent" r="42" stroke="currentColor" strokeWidth="8" />
                  <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="42" stroke="currentColor" strokeDasharray="263.8" strokeDashoffset="39.5" strokeLinecap="round" strokeWidth="8" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold">{content.summaryCards[2].ringText}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {(content.summaryCards[2].rows || []).map((row) => (
                  <div className="flex justify-between items-center" key={row.label}>
                    <span className="text-sm font-medium">{row.label}</span>
                    <span className="text-sm font-bold">{row.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> {content.summaryCards[2].ringNote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReferenceHomeLowerSection({ en }: { en: boolean }) {
  const notices = en ? [
    ["24", "Carbon transaction guideline revision notice", "Important updates for operators and participating companies."],
    ["21", "Project monitoring system upgrade", "Scheduled inspection and service enhancement information."],
    ["18", "Annual CCUS technology symposium", "Registration and presentation schedule announcement."]
  ] : [
    ["24", "탄소 거래제 가이드라인 개정 안내", "운영기관 및 참여기업에 적용되는 주요 개정사항을 안내합니다."],
    ["21", "프로젝트 모니터링 시스템 업그레이드 공지", "정기 점검 및 서비스 고도화 작업 일정을 안내합니다."],
    ["18", "연례 CCUS 기술 심포지엄 참가 신청", "기술 세미나 참가 등록과 발표 일정을 안내합니다."]
  ];
  const supports = en ? [["help", "Help Center", "Frequently asked questions"], ["forum", "Live Chat", "Expert consultation"], ["description", "API Documentation", "Developer guide"], ["mail", "Email Inquiry", "Official support"]] : [["help", "헬프 센터", "자주 묻는 질문"], ["forum", "실시간 채팅", "전문가 즉시 상담"], ["description", "API 문서", "개발자 가이드"], ["mail", "이메일 문의", "공식 서면 지원"]];
  return (
    <section className="bg-white py-14">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <article className="min-w-0">
          <div className="flex items-center justify-between border-b border-slate-300 pb-4"><h2 className="text-2xl font-black text-[#001e40]">{en ? "Notices" : "공지사항"}</h2><a className="text-sm font-bold hover:underline" href={en ? "/en/support/notice" : "/support/notice"}>{en ? "View all" : "전체보기"}</a></div>
          <div className="divide-y divide-slate-200">
            {notices.map(([day, title, description]) => <a className="grid grid-cols-[54px_1fr] gap-4 py-5 hover:bg-slate-50" href={en ? "/en/support/notice" : "/support/notice"} key={title}><span className="flex h-12 w-12 flex-col items-center justify-center bg-blue-50 text-lg font-black text-[#003366]">{day}<small className="text-[9px]">{en ? "JUL" : "7월"}</small></span><span><strong className="block text-sm text-slate-950">{title}</strong><span className="mt-1 block truncate text-xs text-slate-500">{description}</span></span></a>)}
          </div>
        </article>
        <article className="min-w-0 rounded-xl bg-slate-100 p-7">
          <h2 className="text-2xl font-black text-[#001e40]">{en ? "Technical Support Center" : "기술 지원 센터"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{en ? "Get help with emissions reporting, certification, and system usage." : "배출량 보고, 인증 및 시스템 이용에 필요한 도움을 확인하세요."}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">{supports.map(([icon, title, description]) => <a className="border border-slate-300 bg-white p-4 hover:border-[#003366]" href={en ? "/en/support/faq" : "/support/faq"} key={title}><span className="material-symbols-outlined text-[#003366]">{icon}</span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-xs text-slate-500">{description}</span></a>)}</div>
          <div className="mt-5 flex items-center gap-4 border border-slate-300 bg-slate-200 p-4"><span className="flex h-10 w-10 items-center justify-center rounded bg-[#003366] text-white material-symbols-outlined">call</span><div><p className="text-xs font-bold text-slate-500">{en ? "Emergency technical line" : "긴급 기술 지원 라인"}</p><strong className="text-xl text-[#001e40]">080-1234-5678</strong></div></div>
        </article>
      </div>
    </section>
  );
}

export function NewsletterSection({ en }: { en: boolean }) {
  return (
    <section className="border-y border-blue-200 bg-[#eaf3ff]" data-help-id="home-newsletter">
      <div className="krds-responsive-container mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="krds-auto-layout krds-component overflow-hidden rounded-2xl bg-[#003366] shadow-lg">
          <div className="grid gap-8 px-6 py-9 sm:px-9 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 lg:py-11">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-3xl text-white sm:h-14 sm:w-14" aria-hidden="true">mark_email_read</span>
              <div>
                <p className="krds-type-label font-black uppercase tracking-[0.18em] text-blue-200">CCUS Newsletter</p>
                <h2 className="krds-type-title mt-2 font-black text-white">
                  {en ? "Get Carbon Neutrality News First" : "탄소중립 소식을 가장 먼저 만나보세요"}
                </h2>
                <p className="krds-type-body mt-3 max-w-3xl font-medium leading-7 text-blue-100">
                  {en
                    ? "Receive policy updates, CCUS technology trends, education schedules, and platform news in one newsletter."
                    : "정책 변화와 CCUS 기술 동향, 교육 일정, 플랫폼 주요 소식을 뉴스레터 한 편으로 받아보세요."}
                </p>
              </div>
            </div>
            <a
              className="krds-control inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] bg-white px-6 py-3 font-black text-[#003366] transition-colors hover:bg-blue-50 focus-visible lg:w-auto"
              href={buildLocalizedPath("/mypage/marketing", "/en/mypage/marketing")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">mail</span>
              {en ? "Set Newsletter Preferences" : "뉴스레터 수신 설정"}
              <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeFooter({ content }: { content: LocalizedHomeContent }) {
  const english = content.skipLink === LOCALIZED_CONTENT.en.skipLink;
  return (
    <footer className="bg-white border-t border-[var(--kr-gov-border-light)]">
      <div className="gov-home-footer max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col justify-between gap-7 border-b border-[var(--kr-gov-border-light)] pb-7 md:flex-row md:gap-10 md:pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img alt={content.govAlt} className="h-8 grayscale" src={HOME_ENTRY_ASSETS.FOOTER_SYMBOL} />
              <span className="gov-text-heading-sm font-black text-[var(--kr-gov-text-primary)]">{content.footerOrg}</span>
            </div>
            <address className="gov-text-body-sm not-italic text-[var(--kr-gov-text-secondary)]">
              {content.footerAddress}<br />
              {content.footerDesc}
            </address>
          </div>
          <div className="gov-text-body-sm flex flex-wrap gap-x-6 gap-y-3 font-bold md:gap-x-8 md:gap-y-4">
            {content.footerLinks.map((link, index) => (
              <a
                className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-[var(--kr-gov-text-primary)] hover:underline"}
                href={resolveFooterHref(link)}
                key={link}
                onClick={(event) => {
                  if (resolveFooterHref(link) === "#") {
                    event.preventDefault();
                  }
                }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:mt-8 md:flex-row md:items-center md:gap-6">
          <div className="gov-text-caption font-medium text-[var(--kr-gov-text-secondary)]">
            <p>© 2025 CCUS Carbon Footprint Platform. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="gov-text-caption flex items-center gap-2 rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-bg-gray)] px-3 py-1 font-bold text-[var(--kr-gov-text-secondary)]">
              <span>{content.lastModified}</span>
              <time dateTime="2025-08-14">{english ? "Aug 14, 2025" : "2025.08.14"}</time>
            </div>
            <img alt={content.waAlt} className="h-10" src={HOME_ENTRY_ASSETS.WA_MARK} />
          </div>
        </div>
      </div>
    </footer>
  );
}
