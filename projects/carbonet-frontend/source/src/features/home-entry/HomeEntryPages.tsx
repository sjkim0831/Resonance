import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { LOCALIZED_CONTENT } from "./homeEntryContent";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu,
  HomeFooter,
  HomeInlineStyles,
  CoreServiceGrid,
  HeroSection,
  NewsletterSection,
  RealtimeDashboardSection,
  SearchSection,
  ReferenceHomeLowerSection,
  SummarySection
} from "./HomeEntrySections";
import { HomePayload } from "./homeEntryTypes";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";

export function HomeLandingPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [publishedSections, setPublishedSections] = useState(() => new Set(["SUMMARY", "CERTIFICATE_VERIFY", "CORE_SERVICES", "NOTICE_SUPPORT", "NEWSLETTER"]));
  const payloadState = useAsyncValue<HomePayload>(
    () => initialPayload && !initialPayload.isLoggedIn ? Promise.resolve(initialPayload) : fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );
  const sessionState = useFrontendSession();

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void sessionState.reload();
    }

    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, sessionState]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  useEffect(() => {
    fetch(buildLocalizedPath("/home/api/composition?variant=PUBLIC", "/en/home/api/composition?variant=PUBLIC"), { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("composition unavailable")))
      .then((body) => setPublishedSections(new Set<string>((body.sections || []).map((section: { sectionCode: string }) => section.sectionCode))))
      .catch(() => undefined);
  }, [en]);

  const hasSection = (code: string) => publishedSections.has(code);

  useEffect(() => {
    logGovernanceScope("PAGE", "home-landing", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      mobileMenuOpen,
      menuCount: homeMenu.length
    });
    logGovernanceScope("COMPONENT", "home-landing-navigation", {
      mobileMenuOpen,
      menuCount: homeMenu.length,
      sessionLoaded: Boolean(sessionState.value)
    });
  }, [en, homeMenu.length, mobileMenuOpen, payload.isLoggedIn, sessionState.value]);

  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="gov-home bg-white text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <header className="sticky top-0 z-50 border-b-2 border-[#001e40] bg-white">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="gov-home-header relative flex items-center">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`gov-text-caption px-2 py-1 font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`gov-text-caption px-2 py-1 font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="gov-home-header-action hidden xl:inline-flex items-center font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void sessionState.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="gov-home-header-action hidden xl:inline-flex font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="gov-home-header-action hidden xl:inline-flex font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
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
            onLogout={sessionState.logout}
          />
        </div>
        <main id="main-content">
          <div data-help-id="home-hero">
            <HeroSection content={content} />
          </div>
          <div data-help-id="home-search">
            <SearchSection content={content} homeMenu={homeMenu} />
          </div>
          {hasSection("SUMMARY") ? <div data-help-id="home-summary">
            <SummarySection content={content} />
          </div> : null}
          {hasSection("REALTIME_DASHBOARD") ? <RealtimeDashboardSection en={en} /> : null}
          {hasSection("CERTIFICATE_VERIFY") ? <section className="border-y border-emerald-200 bg-emerald-50/70">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-md" aria-hidden="true">
                  <span className="material-symbols-outlined text-[34px]">verified_user</span>
                </div>
                <div>
                  <p className="gov-text-caption font-black uppercase tracking-[0.18em] text-emerald-700">{en ? "PUBLIC CERTIFICATE CHECK" : "공개 인증 서비스"}</p>
                  <h2 className="gov-text-heading-md mt-1 font-black text-slate-950">{en ? "Certificate Authenticity Verification" : "인증서 진위여부 확인"}</h2>
                  <p className="gov-text-body-sm mt-1 font-semibold text-slate-600">{en ? "Verify a downloaded certificate without signing in." : "로그인 없이 발급 인증서와 리포트의 진위 여부를 확인하세요."}</p>
                </div>
              </div>
              <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] bg-emerald-700 px-6 py-3 font-black text-white hover:bg-emerald-800 focus-visible" href={buildLocalizedPath("/home/certificate-verify", "/en/home/certificate-verify")}>
                <span className="material-symbols-outlined">task_alt</span>
                {en ? "Verify Certificate" : "진위여부 확인하기"}
              </a>
            </div>
          </section> : null}
          {hasSection("CORE_SERVICES") ? <section className="gov-home-section max-w-7xl mx-auto px-4 lg:px-8" data-help-id="home-services">
            <div className="mb-10">
              <h2 className="gov-text-heading-md font-bold text-[var(--kr-gov-text-primary)]">{content.coreServicesTitle}</h2>
              <p className="gov-text-body mt-2 text-[var(--kr-gov-text-secondary)]">{content.coreServicesDescription}</p>
            </div>
            <CoreServiceGrid content={content} />
          </section> : null}
          {hasSection("NOTICE_SUPPORT") ? <ReferenceHomeLowerSection en={en} /> : null}
          {hasSection("NEWSLETTER") ? <NewsletterSection en={en} /> : null}
        </main>
        <HomeFooter content={content} />
      </div>
    </>
  );
}
