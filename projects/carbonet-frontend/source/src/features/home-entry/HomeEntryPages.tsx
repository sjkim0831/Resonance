import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { LOCALIZED_CONTENT, HOME_ENTRY_ASSETS } from "./homeEntryContent";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu,
  HomeFooter,
  HomeInlineStyles,
  CoreServiceGrid,
  HeroSection,
  DashboardSection,
  AnnouncementsAndSupportSection
} from "./HomeEntrySections";
import { HomePayload } from "./homeEntryTypes";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";

export function HomeLandingPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
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
      <div className="bg-white text-on-surface font-body-md">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <div className="bg-surface border-b border-outline-variant">
          <div className="max-w-container-max mx-auto px-margin-desktop py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" src={HOME_ENTRY_ASSETS.GOV_SYMBOL} />
              <span className="text-[13px] font-medium text-on-surface-variant">{content.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-on-surface-variant">
              <p>{content.govGuide}</p>
            </div>
          </div>
        </div>
        <header className="bg-surface-container-lowest border-b-2 border-primary sticky top-0 z-50 shadow-sm">
          <div className="max-w-container-max mx-auto px-margin-desktop">
            <div className="relative flex items-center h-16">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-outline-variant rounded-lg overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-on-surface-variant hover:bg-surface-container" : "bg-primary text-on-primary"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-outline-variant ${en ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant hover:bg-surface-container"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-primary text-on-primary hover:opacity-90" onClick={() => void sessionState.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-primary text-on-primary hover:opacity-90 items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-white text-primary border-2 border-primary hover:bg-primary/5 items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-lg border border-outline-variant text-primary flex items-center justify-center hover:bg-surface-container focus-visible"
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
          <HeroSection content={content} />
          <DashboardSection content={content} />
          <CoreServiceGrid content={content} />
          <AnnouncementsAndSupportSection content={content} />
        </main>
        <HomeFooter content={content} />
      </div>
    </>
  );
}