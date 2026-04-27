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
      .gnb-item:hover .gnb-depth2 { display: block; }
      .gnb-depth2 { width: 560px !important; padding: 10px; }
      .gnb-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .gnb-section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: #fafafa; }
      .gnb-section-title { display: block; font-size: 12px; font-weight: 700; color: var(--kr-gov-blue); margin-bottom: 6px; padding: 0 4px; }
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
          <a className={getDesktopNavLinkClass(en)} href={top.url || "#"}>
            {top.label || (en ? "Menu" : "메뉴")}
          </a>
          {top.sections && top.sections.length > 0 ? (
            <div className="gnb-depth2 hidden absolute top-full left-0 w-56 bg-white border border-[var(--kr-gov-border-light)] shadow-lg rounded-b-[var(--kr-gov-radius)] py-2">
              <div className="gnb-sections">
                {top.sections.map((section, sectionIndex) => (
                  <div className="gnb-section" key={`${section.label || "section"}-${sectionIndex}`}>
                    <strong className="gnb-section-title">{section.label || (en ? "Section" : "섹션")}</strong>
                    {(section.items || []).map((item, itemIndex) => (
                      <a className="block px-4 py-2 hover:bg-gray-50 text-sm" href={item.url || "#"} key={`${item.label || "item"}-${itemIndex}`}>
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
    <section className="relative h-[480px] bg-slate-900 overflow-hidden" data-help-id="home-hero">
      <div className="absolute inset-0">
        <img alt="Carbon capture facility" className="w-full h-full object-cover opacity-60" src={HOME_ENTRY_ASSETS.HERO_IMAGE} />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--kr-gov-blue)]/90 via-[var(--kr-gov-blue)]/40 to-transparent" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 h-full flex flex-col justify-center items-start text-white">
        <span className="px-4 py-1.5 rounded-full bg-white/20 border border-white/30 text-sm font-bold mb-6 backdrop-blur-sm">{content.heroBadge}</span>
        <h2 className="text-5xl font-extrabold mb-4 leading-tight">{content.heroTitle.split("\n").map((line, index) => (<span key={`${line}-${index}`}>{line}{index === 0 ? <br /> : null}</span>))}</h2>
        <p className="text-xl text-blue-50/90 mb-10 max-w-2xl font-medium leading-relaxed">{content.heroDescription}</p>
        <div className="flex gap-4">
          <HomeButton type="button" className="px-8 py-4 text-lg" variant="secondary">
            {content.heroButton} <span className="material-symbols-outlined">arrow_forward</span>
          </HomeButton>
          <div className="flex items-center gap-2 mt-auto self-end pb-4 ml-8">
            <HomeButton type="button" className="w-10 h-10 rounded-full border-white/30 !bg-transparent !p-0 !text-white hover:!bg-white/10" variant="ghost"><span className="material-symbols-outlined">chevron_left</span></HomeButton>
            <span className="text-sm font-bold tracking-widest">1 / 4</span>
            <HomeButton type="button" className="w-10 h-10 rounded-full border-white/30 !bg-transparent !p-0 !text-white hover:!bg-white/10" variant="ghost"><span className="material-symbols-outlined">chevron_right</span></HomeButton>
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

type SearchCandidate = {
  label: string;
  href: string;
  tone: "menu" | "service" | "tag";
};

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
    <section className="bg-[var(--kr-gov-bg-gray)] py-14 border-b border-[var(--kr-gov-border-light)]" data-help-id="home-search">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h3 className="text-2xl font-bold mb-8 text-[var(--kr-gov-text-primary)]">{content.searchTitle}</h3>
        <div className="relative group max-w-3xl mx-auto">
          <HomeInput className="h-16 border-2 border-[var(--kr-gov-blue)] pl-8 pr-20 text-lg shadow-sm placeholder-gray-500 focus:border-[var(--kr-gov-blue)] focus:ring-4 focus:ring-[var(--kr-gov-blue)]/10" placeholder={content.searchPlaceholder} type="text" aria-label={content.searchAria} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { executeSearch(); } }} />
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
        <div className="mt-6 flex flex-wrap justify-center items-center gap-3 text-sm">
          <span className="font-bold text-[var(--kr-gov-text-secondary)]">{content.popularSearches}</span>
          {content.popularTags.map((tag) => (
            <HomeButton type="button" className="rounded-full px-3 py-1 text-[13px]" key={tag.label} onClick={() => { setQuery(tag.query || tag.label); executeSearch(tag.query || tag.label, tag); }} variant="secondary">{tag.label}</HomeButton>
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

export function SummarySection({ content }: { content: LocalizedHomeContent }) {
  return (
    <section className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] py-20" data-help-id="home-summary">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">{content.summaryTitle}</h2>
            <p className="text-[var(--kr-gov-text-secondary)] font-medium">{content.summaryDescription}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--kr-gov-text-secondary)] font-bold">
            <span className="material-symbols-outlined text-[18px]">update</span>
            {content.summaryUpdated}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] hover:shadow-md transition-shadow">
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
            </div>
          </div>
          <div className="bg-white p-8 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] hover:shadow-md transition-shadow">
            <h4 className="font-bold text-[var(--kr-gov-text-secondary)] mb-6">{content.summaryCards[1].title}</h4>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {(content.summaryCards[1].statBlocks || []).map((block) => (
                <div className="text-center p-4 bg-gray-50 rounded-[var(--kr-gov-radius)]" key={block.label}>
                  <p className="text-xs font-bold text-gray-400 mb-1">{block.label}</p>
                  <p className="text-2xl font-black">{block.value}<span className="text-sm ml-1">{block.unit}</span></p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--kr-gov-blue)]">
              <span className="material-symbols-outlined">trending_up</span>
              {content.summaryCards[1].note}
            </div>
          </div>
          <div className="bg-white p-8 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] hover:shadow-md transition-shadow">
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
