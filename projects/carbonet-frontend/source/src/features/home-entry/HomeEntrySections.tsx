import { buildLocalizedPath, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeLinkButton } from "../home-ui/common";
import { HOME_ENTRY_ASSETS, LOCALIZED_CONTENT, LocalizedHomeContent } from "./homeEntryContent";
import { HomeMenuItem } from "./homeEntryTypes";

function getDesktopNavClass(_en: boolean) {
  return "hidden md:flex gap-6";
}

function getDesktopNavLinkClass(_en: boolean) {
  return "text-primary font-bold border-b-2 border-transparent hover:text-primary hover:border-primary transition-colors duration-200 text-label-md";
}

function resolveFooterHref(label: string, en: boolean) {
  if (label === "사이트맵" || label === "Sitemap") {
    return en ? "/en/sitemap" : "/sitemap";
  }
  return "#";
}

export function HomeInlineStyles(_props: { en: boolean }) {
  return (
    <style>{`
      :root {
        --primary: #001e40;
        --secondary: #1b6d24;
        --surface: #f8f9fa;
        --surface-container-lowest: #ffffff;
        --surface-container: #edeeef;
        --surface-container-high: #e7e8e9;
        --surface-container-highest: #e1e3e4;
        --on-primary: #ffffff;
        --on-surface: #191c1d;
        --on-surface-variant: #43474f;
        --outline: #737780;
        --outline-variant: #c3c6d1;
        --primary-container: #003366;
        --secondary-container: #a0f399;
        --primary-fixed: #d5e3ff;
        --primary-fixed-dim: #a7c8ff;
        --error: #ba1a1a;
      }
      body { font-family: 'Inter', 'Noto Sans KR', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--primary);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .focus-visible:focus-visible {
        outline: 3px solid var(--primary);
        outline-offset: 2px;
      }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
        vertical-align: middle;
      }
      .glass-effect {
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(8px);
      }
      .font-headline-lg { font-family: 'Public Sans', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.3; }
      .font-headline-md { font-family: 'Public Sans', sans-serif; font-size: 24px; font-weight: 600; line-height: 1.4; }
      .font-display-lg { font-family: 'Public Sans', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
      .font-label-md { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: 0.05em; }
      .font-body-lg { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 400; line-height: 1.6; }
      .font-body-md { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 400; line-height: 1.6; }
      .font-body-sm { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.5; }
      .max-w-container-max { max-width: 1280px; }
      .px-margin-desktop { padding-left: 40px; padding-right: 40px; }
      .py-stack-lg { padding-top: 32px; padding-bottom: 32px; }
      .gap-gutter { gap: 24px; }
      .stack-md { margin-top: 16px; margin-bottom: 16px; }
      .stack-sm { margin-top: 8px; margin-bottom: 8px; }
      .rounded-lg { border-radius: 0.25rem; }
      .rounded-xl { border-radius: 0.5rem; }
      .rounded-2xl { border-radius: 0.75rem; }
      .rounded-full { border-radius: 9999px; }
      .text-headline-lg { font-family: 'Public Sans', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.3; color: var(--primary); }
      .text-headline-md { font-family: 'Public Sans', sans-serif; font-size: 24px; font-weight: 600; line-height: 1.4; color: var(--on-surface); }
      .text-display-lg { font-family: 'Public Sans', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; color: white; }
      .text-label-md { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: 0.05em; color: var(--on-surface-variant); }
      .text-body-lg { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 400; line-height: 1.6; color: white; }
      .text-body-md { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 400; line-height: 1.6; color: var(--on-surface); }
      .text-body-sm { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--on-surface-variant); }
      .bg-primary { background-color: var(--primary); }
      .bg-secondary { background-color: var(--secondary); }
      .bg-surface { background-color: var(--surface); }
      .bg-surface-container-lowest { background-color: var(--surface-container-lowest); }
      .bg-surface-container { background-color: var(--surface-container); }
      .bg-surface-container-high { background-color: var(--surface-container-high); }
      .bg-surface-container-highest { background-color: var(--surface-container-highest); }
      .bg-primary-fixed { background-color: var(--primary-fixed); }
      .bg-white { background-color: white; }
      .text-primary { color: var(--primary); }
      .text-secondary { color: var(--secondary); }
      .text-on-primary { color: var(--on-primary); }
      .text-on-surface { color: var(--on-surface); }
      .text-on-surface-variant { color: var(--on-surface-variant); }
      .text-white { color: white; }
      .border-primary { border-color: var(--primary); }
      .border-outline-variant { border-color: var(--outline-variant); }
      .border-white\\/20 { border-color: rgba(255,255,255,0.2); }
      .border-b-2 { border-bottom-width: 2px; }
      .border-t { border-top-width: 1px; }
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
      .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
      .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.05); }
      .hover\\:bg-surface-container:hover { background-color: var(--surface-container); }
      .hover\\:opacity-90:hover { opacity: 0.9; }
      .hover\\:translate-x-1:hover { transform: translateX(4px); }
      .hover\\:border-primary:hover { border-color: var(--primary); }
      .hover\\:shadow-xl:hover { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
      .hover\\:-translate-y-1:hover { transform: translateY(-4px); }
      .group:hover .group-hover\\:translate-x-1 { transform: translateX(4px); }
      .group-hover\\:scale-110 { transition: transform 0.2s ease; }
      .group:hover .group-hover\\:scale-110 { transform: scale(1.1); }
      .group:hover .group-hover\\:text-white { color: white; }
      .transition-all { transition: all 0.2s ease; }
      .transition-colors { transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease; }
      .active\\:scale-95:active { transform: scale(0.95); }
      .line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
      .min-h-\\[280px\\] { min-height: 280px; }
      .tracking-wider { letter-spacing: 0.05em; }
      .tracking-tighter { letter-spacing: -0.02em; }
      .text-4xl { font-size: 2.25rem; }
      .uppercase { text-transform: uppercase; }
      body.mobile-menu-open { overflow: hidden; }
      @media (max-width: 768px) {
        .px-margin-desktop { padding-left: 16px; padding-right: 16px; }
        .text-display-lg { font-size: 24px; }
      }
    `}</style>
  );
}

export function HeaderBrand({ content }: { content: LocalizedHomeContent }) {
  return (
    <div className="flex items-center gap-8">
      <HomeLinkButton
        className="!min-h-0 !border-0 !bg-transparent !p-0 !text-inherit hover:!bg-transparent flex items-center gap-2"
        href={buildLocalizedPath("/home", "/en/home")}
        variant="ghost"
      >
        <span className="text-headline-md font-bold text-primary">{content.logoTitle}</span>
      </HomeLinkButton>
      <nav className="hidden md:flex gap-6">
      </nav>
    </div>
  );
}

export function HeaderDesktopNav({ en, homeMenu }: { en: boolean; homeMenu: HomeMenuItem[] }) {
  return (
    <nav className={getDesktopNavClass(en)} aria-label={LOCALIZED_CONTENT.en.navAria}>
      {homeMenu.map((top, index) => (
        <div className="gnb-item h-full relative group min-w-0" key={`${top.label || "top"}-${index}`}>
          <a className={getDesktopNavLinkClass(en)} href={top.url || "#"}>
            {top.label || (en ? "Menu" : "메뉴")}
          </a>
          {top.sections && top.sections.length > 0 ? (
            <div className="gnb-depth2 hidden absolute top-full left-0 w-56 bg-white border border-outline-variant shadow-xl rounded-b-lg py-2">
              <div className="gnb-sections">
                {top.sections.map((section, sectionIndex) => (
                  <div className="gnb-section" key={`${section.label || "section"}-${sectionIndex}`}>
                    <strong className="gnb-section-title">{section.label || (en ? "Section" : "섹션")}</strong>
                    {(section.items || []).map((item, itemIndex) => (
                      <a className="block px-4 py-2 hover:bg-surface-container text-sm text-on-surface" href={item.url || "#"} key={`${item.label || "item"}-${itemIndex}`}>
                        {item.label || (en ? "Item" : "항목")}
                      </a>
                    ))}
                  </div>
                ))}
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
    <aside className="absolute top-0 right-0 h-full w-[90%] max-w-[380px] bg-white shadow-2xl border-l border-outline-variant overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-outline-variant bg-surface-container-lowest">
        <strong className="text-lg font-bold text-on-surface">{content.allMenu}</strong>
        <HomeButton className="w-10 h-10 !p-0 text-on-surface-variant" type="button" aria-label={content.closeAllMenu} onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </HomeButton>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <HomeButton className="flex-1" type="button" onClick={() => void onLogout()} variant="primary">{content.logout}</HomeButton>
          ) : (
            <>
              <HomeLinkButton className="flex-1" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} variant="primary">{content.login}</HomeLinkButton>
              <HomeLinkButton className="flex-1" href={buildLocalizedPath("/join/step1", "/join/en/step1")} variant="secondary">{content.signup}</HomeLinkButton>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <HomeButton type="button" className={en ? "!text-on-surface-variant" : ""} onClick={() => navigate("/home")} variant={en ? "secondary" : "primary"}>KO</HomeButton>
          <HomeButton type="button" className={en ? "" : "!text-on-surface-variant"} onClick={() => navigate("/en/home")} variant={en ? "primary" : "secondary"}>EN</HomeButton>
        </div>
        <div className="space-y-3">
          {homeMenu.map((top, index) => (
            <section className="border border-outline-variant rounded-lg p-3" key={`${top.label || "mobile-top"}-${index}`}>
              <h3 className="text-sm font-extrabold text-primary mb-2">{top.label || (en ? "Menu" : "메뉴")}</h3>
              {(top.sections || []).map((section, sectionIndex) => (
                <div key={`${section.label || "mobile-section"}-${sectionIndex}`}>
                  <p className="text-xs font-bold text-on-surface-variant mt-2 mb-1">{section.label || (en ? "Section" : "섹션")}</p>
                  <div className="space-y-1 text-sm">
                    {(section.items || []).map((item, itemIndex) => (
                      <a className="block py-1 text-on-surface" href={item.url || "#"} key={`${item.label || "mobile-item"}-${itemIndex}`}>
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
    <section className="relative h-[400px] flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img alt="CCUS Industrial Facility" className="w-full h-full object-cover" src={HOME_ENTRY_ASSETS.HERO_IMAGE} />
        <div className="absolute inset-0 bg-primary/60 backdrop-blur-[2px]"></div>
      </div>
      <div className="relative z-10 w-full px-margin-desktop max-w-container-max mx-auto text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-display-lg mb-6 leading-tight">{content.heroTitle}</h1>
          <p className="text-primary-fixed text-body-lg mb-8 opacity-90">{content.heroDescription}</p>
          <div className="glass-effect p-2 rounded-xl flex items-center shadow-xl border border-white/20 max-w-2xl mx-auto">
            <span className="material-symbols-outlined text-outline px-4">search</span>
            <input
              className="w-full border-none bg-transparent focus:ring-0 text-on-surface font-body-md py-3 placeholder:text-outline"
              placeholder={content.searchPlaceholder}
              type="text"
            />
            <button className="bg-primary text-on-primary px-8 py-3 rounded text-label-md hover:opacity-90 active:scale-95 transition-all whitespace-nowrap">
              {content.heroButton}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type SearchSectionProps = {
  content: LocalizedHomeContent;
  homeMenu: HomeMenuItem[];
};

export function SearchSection(_props: SearchSectionProps) {
  return null;
}

export function DashboardSection({ content }: { content: LocalizedHomeContent }) {
  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">{content.dashboardTitle}</h2>
          <p className="text-on-surface-variant text-body-sm mt-1">{content.dashboardSubtitle}</p>
        </div>
        <button className="flex items-center gap-2 text-primary text-label-md hover:underline font-bold">
          {content.heroButton} <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <KpiCard1 content={content} />
        <KpiCard2 content={content} />
        <KpiCard3 content={content} />
      </div>
    </section>
  );
}

function KpiCard1({ content }: { content: LocalizedHomeContent }) {
  const card = content.summaryCards[0];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-8 rounded-xl shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <span className="text-on-surface-variant text-label-md tracking-wider">{card.title}</span>
        <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-md font-bold">{card.badge}</span>
      </div>
      <div className="text-[44px] font-bold text-primary leading-none mb-4">
        {card.value} <span className="text-headline-md font-medium text-on-surface-variant">{card.unit}</span>
      </div>
      <div className="flex items-center gap-2 text-secondary font-bold text-body-md">
        <span className="material-symbols-outlined">trending_up</span> 전월 대비 +12.4%
      </div>
      <div className="mt-8">
        <div className="flex justify-between text-label-md mb-2">
          <span className="text-on-surface-variant">{card.progressLabel}</span>
          <span className="text-primary font-bold">{card.progressValue}</span>
        </div>
        <div className="h-3 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-secondary w-[72.6%] rounded-full transition-all duration-1000 ease-out"></div>
        </div>
      </div>
    </div>
  );
}

function KpiCard2({ content }: { content: LocalizedHomeContent }) {
  const card = content.summaryCards[1];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-8 rounded-xl shadow-sm">
      <span className="text-on-surface-variant text-label-md tracking-wider mb-8 block">{card.title}</span>
      <div className="flex gap-4 items-center h-full pb-4">
        <div className="flex-1">
          <div className="text-[44px] font-bold text-primary">{card.statBlocks?.[0].value}</div>
          <div className="text-label-md font-bold text-on-surface-variant">{card.statBlocks?.[0].label}</div>
        </div>
        <div className="w-px h-16 bg-outline-variant"></div>
        <div className="flex-1 text-right">
          <div className="text-[44px] font-bold text-primary">{card.statBlocks?.[1].value}</div>
          <div className="text-label-md font-bold text-on-surface-variant">{card.statBlocks?.[1].label}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className="h-2 bg-surface-container rounded-full flex overflow-hidden">
          <div className="h-full bg-primary w-[40%]"></div>
          <div className="h-full bg-primary-fixed-dim w-[60%]"></div>
        </div>
        <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
          <span>수도권 클러스터 (40%)</span>
          <span>영남권 클러스터 (60%)</span>
        </div>
      </div>
    </div>
  );
}

function KpiCard3({ content }: { content: LocalizedHomeContent }) {
  const card = content.summaryCards[2];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-8 rounded-xl shadow-sm">
      <span className="text-on-surface-variant text-label-md tracking-wider mb-6 block">{card.title}</span>
      <div className="flex items-center gap-8">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle className="stroke-surface-container fill-none" cx="18" cy="18" r="15.9155" strokeWidth="3.5"></circle>
            <circle className="stroke-primary fill-none" cx="18" cy="18" r="15.9155" strokeDasharray="85, 100" strokeLinecap="round" strokeWidth="3.5"></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-headline-md font-bold text-primary">{card.ringText}</span>
            <span className="text-[10px] text-on-surface-variant font-bold">완료율</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm bg-primary"></span>
            <span className="text-body-sm font-bold text-on-surface">{card.rows?.[0].label}: {card.rows?.[0].value}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm bg-primary-fixed-dim"></span>
            <span className="text-body-sm font-bold text-on-surface">{card.rows?.[1].label}: {card.rows?.[1].value}</span>
          </div>
        </div>
      </div>
      <button className="w-full mt-8 py-3 bg-white border-2 border-primary text-primary font-bold text-label-md rounded-lg hover:bg-primary/5 transition-colors">
        {content.services[1].title}
      </button>
    </div>
  );
}

export function CoreServiceGrid({ content }: { content: LocalizedHomeContent }) {
  return (
    <section className="bg-surface-container py-stack-lg border-t border-outline-variant">
      <div className="px-margin-desktop max-w-container-max mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-primary"></div>
          <h2 className="font-headline-lg text-headline-lg">{content.coreServicesTitle}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {content.services.map((service, index) => (
            <a
              className={`${index === 0 ? "bg-primary text-white" : "bg-white border border-outline-variant"} p-8 rounded-xl flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer min-h-[280px]`}
              href={service.href}
              key={service.title}
            >
              <div>
                <span className="material-symbols-outlined text-4xl mb-6 block" style={{ fontVariationSettings: "'wght' 400, 'opsz' 24, 'FILL' 1" }}>{service.icon}</span>
                <h3 className="text-headline-md mb-3">{service.title}</h3>
                <p className={`text-body-sm leading-relaxed ${index === 0 ? "text-on-primary-fixed/90" : "text-on-surface-variant"}`}>{service.description}</p>
              </div>
              <div className={`flex items-center gap-2 font-bold text-label-md mt-6 ${index === 0 ? "text-on-primary" : "text-primary"}`}>
                {service.title === "배출량 시뮬레이션" ? "시뮬레이터 실행" : service.title === "인증 신청" ? "신청 시작하기" : service.title === "CO2 태그 검색" ? "태그 조회" : "리포지토리 방문"} <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AnnouncementsAndSupportSection({ content }: { content: LocalizedHomeContent }) {
  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <div className="flex items-center justify-between mb-8 border-b border-outline-variant pb-4">
          <h3 className="font-headline-md text-headline-md text-primary">{content.announcementsTitle}</h3>
          <a className="text-on-surface-variant text-label-md font-bold hover:text-primary transition-colors" href="#">{content.heroButton}</a>
        </div>
        <div className="space-y-2">
          <AnnouncementItem day="24" month="8월" title="2025년 탄소 격리세 가이드라인 개정 안내" description="중화학 공업 분야의 상업 포집 배출권에 관한 공식 개정안 공고..." />
          <AnnouncementItem day="21" month="8월" title="프로젝트 베타 모니터링 시스템 업그레이드 공지" description="동남권 클러스터 IoT 센서 정기 점검 및 시스템 고도화 작업..." />
          <AnnouncementItem day="18" month="8월" title="제4회 연례 CCUS 기술 심포지엄 참가 신청" description="2025년 환경 과학계 및 산업계 리더들과 함께하는 기술 서밋..." />
        </div>
      </div>
      <div className="bg-surface-container rounded-2xl p-8 flex flex-col shadow-inner">
        <div className="mb-8">
          <h3 className="font-headline-md text-headline-md text-primary mb-4">{content.supportTitle}</h3>
          <p className="text-on-surface-variant text-body-md leading-relaxed">{content.supportDescription}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1">
          <SupportCard icon="help" title="헬프 센터" subtitle="자주 묻는 질문" />
          <SupportCard icon="forum" title="실시간 채팅" subtitle="전문가 즉시 상담" />
          <SupportCard icon="description" title="API 문서" subtitle="개발자 가이드" />
          <SupportCard icon="mail" title="이메일 문의" subtitle="공식 서면 지원" />
        </div>
        <div className="mt-8 pt-8 border-t border-outline-variant/30">
          <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined">call</span>
            </div>
            <div>
              <div className="text-label-md font-bold text-on-surface-variant uppercase tracking-tighter">긴급 기술 지원 라인</div>
              <div className="text-headline-md font-bold text-primary">{content.supportHotline}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnnouncementItem({ day, month, title, description }: { day: string; month: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 p-4 hover:bg-surface-container transition-colors rounded-lg border border-transparent hover:border-outline-variant group cursor-pointer">
      <div className="flex flex-col items-center justify-center min-w-[64px] h-[64px] bg-primary-fixed rounded-lg">
        <span className="text-on-primary-fixed font-bold text-lg">{day}</span>
        <span className="text-on-primary-fixed text-[10px] font-bold uppercase">{month}</span>
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-body-md group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-on-surface-variant text-body-sm mt-1 line-clamp-1">{description}</p>
      </div>
    </div>
  );
}

function SupportCard({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant hover:border-primary transition-all cursor-pointer group">
      <span className="material-symbols-outlined text-primary mb-3 block group-hover:scale-110 transition-transform">{icon}</span>
      <div className="font-bold text-body-sm">{title}</div>
      <div className="text-[11px] text-on-surface-variant mt-1">{subtitle}</div>
    </div>
  );
}

export function HomeFooter({ content }: { content: LocalizedHomeContent }) {
  const english = content.skipLink === LOCALIZED_CONTENT.en.skipLink;
  return (
    <footer className="bg-surface-container-highest border-t border-outline-variant mt-stack-lg">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-desktop py-stack-lg max-w-container-max mx-auto gap-4">
        <div className="flex flex-col items-center md:items-start gap-3">
          <span className="text-headline-md font-bold text-primary">{content.footerOrg}</span>
          <p className="text-on-surface-variant text-body-sm text-center md:text-left">
            {content.footerAddress}
          </p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-on-surface-variant font-medium">사업자등록번호: 000-00-00000</span>
            <span className="text-xs text-on-surface-variant font-medium">대표전화: 02-000-0000</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {content.footerLinks.map((link) => (
            <a
              className="text-on-surface font-bold hover:text-primary transition-colors text-label-md"
              href={resolveFooterHref(link, english)}
              key={link}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}