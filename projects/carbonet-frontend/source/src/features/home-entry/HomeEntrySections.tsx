import { buildLocalizedPath, navigate } from "../../lib/navigation/runtime";
import { useMemo, useState } from "react";
import { HomeButton, HomeInput, HomeLinkButton } from "../home-ui/common";
import { HOME_ENTRY_ASSETS, LOCALIZED_CONTENT, LocalizedHomeContent } from "./homeEntryContent";
import { HomeMenuItem, HomeQuickLink } from "./homeEntryTypes";

function getDesktopNavClass(en: boolean) {
  return en
    ? "hidden xl:flex items-center h-full ml-4 2xl:ml-8 flex-1 justify-center min-w-0"
    : "hidden xl:flex items-center space-x-1 h-full ml-8 flex-1 justify-center";
}

function getDesktopNavLinkClass(en: boolean) {
  return en
    ? "h-full flex items-center justify-center px-[6px] 2xl:px-2 text-[12px] 2xl:text-[13px] font-bold whitespace-normal text-center leading-[1.15] break-words max-w-[92px] 2xl:max-w-[104px] tracking-[-0.01em] text-[var(--kr-gov-text-primary)] border-b-4 border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)] transition-all focus-visible"
    : "h-full flex items-center px-4 text-[17px] font-bold text-[var(--kr-gov-text-primary)] border-b-4 border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)] transition-all focus-visible";
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
        font-size: inherit !important;
        line-height: 1.2 !important;
      }
      .home-brand-subtitle {
        margin: 0 !important;
        line-height: 1.2;
      }
      .gnb-item:hover .gnb-depth2, .gnb-item:focus-within .gnb-depth2 { display: block; }
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
      body.mobile-menu-open { overflow: hidden; }
    `}</style>
  );
}

export function HeaderBrand({ content, en }: { content: LocalizedHomeContent; en: boolean }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 xl:static xl:translate-x-0 flex items-center gap-3 shrink-0">
      <HomeLinkButton className="max-w-[78vw] xl:max-w-none !min-h-0 !border-0 !bg-transparent !p-0 !text-inherit !font-inherit hover:!bg-transparent focus-visible flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")} variant="ghost">
        <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
        <div className="home-brand-copy flex flex-col">
          <h1 className="home-brand-title text-base sm:text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
          <p className={`home-brand-subtitle ${en ? "hidden 2xl:block" : "hidden sm:block"} text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider`}>{content.logoSubtitle}</p>
        </div>
      </HomeLinkButton>
    </div>
  );
}

export function HeaderDesktopNav({ en, homeMenu }: { en: boolean; homeMenu: HomeMenuItem[] }) {
  return (
    <nav className={getDesktopNavClass(en)} aria-label={en ? LOCALIZED_CONTENT.en.navAria : LOCALIZED_CONTENT.ko.navAria}>
      {homeMenu.map((top, index) => (
        <div className="gnb-item h-full relative group min-w-0" key={`${top.label || "top"}-${index}`}>
          <a aria-current={typeof window !== "undefined" && top.url && window.location.pathname.startsWith(top.url) ? "page" : undefined} className={getDesktopNavLinkClass(en)} href={top.url || "#"}>
            {top.label || (en ? "Menu" : "메뉴")}
          </a>
          {top.sections && top.sections.length > 0 ? (
            <div className="gnb-depth2 hidden fixed left-1/2 top-16 -translate-x-1/2 overflow-hidden border border-slate-300 shadow-[0_12px_32px_rgba(15,42,76,.14)] rounded-b-xl">
              <div className="grid grid-cols-[240px_minmax(0,1fr)]">
                <aside className="border-r border-[#164f86] bg-[#063a74] p-5 text-white">
                  <strong className="krds-type-label flex items-center gap-2 font-black text-white"><span className="material-symbols-outlined text-xl text-teal-300">star</span>{en ? "Favorites" : "즐겨찾기"}</strong>
                  <div className="krds-component mt-3 rounded-lg border border-dashed border-white/35 bg-[#0b4b8f] text-center text-xs font-semibold leading-5 text-blue-50">
                    <span className="material-symbols-outlined mb-2 block text-2xl text-teal-300">star</span>
                    {en ? "Select the star next to a menu to add a shortcut." : "메뉴의 별 아이콘을 선택해 즐겨찾기에 추가하세요."}
                  </div>
                  <strong className="krds-type-label mt-5 flex items-center gap-2 border-t border-white/20 pt-5 font-black text-white"><span className="material-symbols-outlined text-xl text-teal-300">history</span>{en ? "Recent" : "최근 메뉴"}</strong>
                  <div className="mt-2 space-y-1">
                    {(top.sections || []).flatMap((section) => section.items || []).slice(0, 5).map((item, recentIndex) => (
                      <a className="krds-control flex !min-h-10 items-center justify-between rounded-lg !px-2 text-xs font-bold text-blue-50 hover:bg-white/10 hover:text-white" href={item.url || "#"} key={`recent-${recentIndex}`}><span className="truncate">{item.label}</span><span className="material-symbols-outlined text-base text-teal-300">chevron_right</span></a>
                    ))}
                  </div>
                  <div className="krds-control mt-5 flex items-center justify-between rounded-xl border border-white/25 bg-white/10 text-xs font-black text-white"><span>{en ? "All menus" : "전체 메뉴"}</span><span className="rounded-full bg-teal-300 px-2 py-0.5 text-[#062c55]">{(top.sections || []).reduce((sum, section) => sum + (section.items || []).length, 0)}{en ? "" : "개"}</span></div>
                </aside>
                <div className="gnb-sections">
                {top.sections.map((section, sectionIndex) => (
                  <div className="gnb-section" key={`${section.label || "section"}-${sectionIndex}`}>
                    <strong className="gnb-section-title">{section.label || (en ? "Section" : "섹션")}</strong>
                    {(section.items || []).map((item, itemIndex) => (
                      <a className="flex items-center rounded-md px-2 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[var(--kr-gov-blue)]" href={item.url || "#"} key={`${item.label || "item"}-${itemIndex}`}>
                        {item.label || (en ? "Item" : "항목")}
                      </a>
                    ))}
                  </div>
                ))}
                </div>
              </div>
            </div>
          ) : null}
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
        <strong className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{content.allMenu}</strong>
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
              <h3 className="text-sm font-extrabold text-[var(--kr-gov-blue)] mb-2">{top.label || (en ? "Menu" : "메뉴")}</h3>
              {(top.sections || []).map((section, sectionIndex) => (
                <div key={`${section.label || "mobile-section"}-${sectionIndex}`}>
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mt-2 mb-1">{section.label || (en ? "Section" : "섹션")}</p>
                  <div className="space-y-1 text-sm mb-2">
                    {(section.items || []).map((item, itemIndex) => (
                      <a className="block py-1" href={item.url || "#"} key={`${item.label || "mobile-item"}-${itemIndex}`}>
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
        <h1 className="text-4xl font-black leading-tight tracking-tight lg:text-5xl">{content.heroTitle.replace("\n", " ")}</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg font-semibold leading-8 text-blue-100/95">{content.heroDescription}</p>
      </div>
    </section>
  );
}

type SearchSectionProps = {
  content: LocalizedHomeContent;
  homeMenu: HomeMenuItem[];
};

type SearchCandidate = {
  label: string;
  href: string;
  tone: "menu" | "service" | "tag";
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

function buildSearchCandidates(content: LocalizedHomeContent, homeMenu: HomeMenuItem[]) {
  const menuCandidates = homeMenu.flatMap((top) => {
    const topItem = top.label && top.url ? [{ label: top.label, href: top.url, tone: "menu" as const }] : [];
    const sectionItems = (top.sections || []).flatMap((section) =>
      (section.items || [])
        .filter((item) => item.label && item.url)
        .map((item) => ({ label: String(item.label), href: String(item.url), tone: "menu" as const }))
    );
    return [...topItem, ...sectionItems];
  });
  const serviceCandidates = content.services.map((service) => ({
    label: service.title,
    href: service.href,
    tone: "service" as const
  }));
  const tagCandidates = content.popularTags.map((tag) => ({
    label: tag.query || tag.label,
    href: tag.href,
    tone: "tag" as const
  }));
  const deduped = new Map<string, SearchCandidate>();
  [...menuCandidates, ...serviceCandidates, ...tagCandidates].forEach((candidate) => {
    deduped.set(`${candidate.label}::${candidate.href}`, candidate);
  });
  return Array.from(deduped.values());
}

export function SearchSection({ content, homeMenu }: SearchSectionProps) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(() => buildSearchCandidates(content, homeMenu), [content, homeMenu]);
  const normalizedQuery = normalizeSearchValue(query);
  const suggestions = normalizedQuery
    ? candidates.filter((candidate) => normalizeSearchValue(candidate.label).includes(normalizedQuery)).slice(0, 6)
    : [];

  function executeSearch(nextQuery?: string, preferredLink?: HomeQuickLink) {
    const effectiveQuery = normalizeSearchValue(nextQuery ?? query);
    if (preferredLink?.href) {
      navigate(preferredLink.href);
      return;
    }
    const match = candidates.find((candidate) => normalizeSearchValue(candidate.label).includes(effectiveQuery));
    navigate(match?.href || buildLocalizedPath("/home", "/en/home"));
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
          {suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white text-left shadow-xl overflow-hidden">
              {suggestions.map((candidate) => (
                <HomeButton key={`${candidate.label}-${candidate.href}`} type="button" className="flex w-full items-center justify-between gap-3 !border-0 !bg-transparent px-5 py-4 text-sm hover:!bg-slate-50" onClick={() => navigate(candidate.href)} variant="ghost">
                  <span className="font-bold text-[var(--kr-gov-text-primary)]">{candidate.label}</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{candidate.tone}</span>
                </HomeButton>
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
            <p className="krds-type-label mb-2 font-black uppercase tracking-[.18em] text-teal-700">Carbon Operations</p>
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
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded">{content.summaryCards[0].badge}</span>
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
          <div className="krds-component bg-white border border-blue-100 border-t-[3px] border-t-teal-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <h4 className="font-bold text-[var(--kr-gov-text-secondary)] mb-6">{content.summaryCards[1].title}</h4>
            <div className="mb-6 divide-y divide-slate-200 border-y border-slate-200">
              {(en ? ["Activity data submission", "Emission calculation review", "Annual report approval", "Evidence supplementation"] : ["활동자료 제출 요청", "배출량 산정 검토", "연간 보고서 승인", "증빙자료 보완"]).map((task, index) => <div className="flex items-center justify-between gap-3 py-3 text-sm" key={task}><span className="truncate font-semibold">{task}</span><span className={`shrink-0 rounded px-2 py-1 text-[11px] font-black ${index < 2 ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{index < 2 ? (en ? "Active" : "진행중") : (en ? "Planned" : "예정")}</span></div>)}
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
        <article>
          <div className="flex items-center justify-between border-b border-slate-300 pb-4"><h2 className="text-2xl font-black text-[#001e40]">{en ? "Notices" : "공지사항"}</h2><a className="text-sm font-bold hover:underline" href={en ? "/en/support/notice" : "/support/notice"}>{en ? "View all" : "전체보기"}</a></div>
          <div className="divide-y divide-slate-200">
            {notices.map(([day, title, description]) => <a className="grid grid-cols-[54px_1fr] gap-4 py-5 hover:bg-slate-50" href={en ? "/en/support/notice" : "/support/notice"} key={title}><span className="flex h-12 w-12 flex-col items-center justify-center bg-blue-50 text-lg font-black text-[#003366]">{day}<small className="text-[9px]">{en ? "JUL" : "7월"}</small></span><span><strong className="block text-sm text-slate-950">{title}</strong><span className="mt-1 block truncate text-xs text-slate-500">{description}</span></span></a>)}
          </div>
        </article>
        <article className="rounded-xl bg-slate-100 p-7">
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
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-[var(--kr-gov-border-light)]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img alt={content.govAlt} className="h-8 grayscale" src={HOME_ENTRY_ASSETS.FOOTER_SYMBOL} />
              <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">{content.footerOrg}</span>
            </div>
            <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
              {content.footerAddress}<br />
              {content.footerDesc}
            </address>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
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
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs font-medium text-[var(--kr-gov-text-secondary)]">
            <p>© 2025 CCUS Carbon Footprint Platform. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-xs font-bold text-[var(--kr-gov-text-secondary)]">
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
