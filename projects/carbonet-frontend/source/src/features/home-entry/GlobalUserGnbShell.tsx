import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "./HomeEntrySections";
import { LOCALIZED_CONTENT } from "./homeEntryContent";

const USER_GNB_EXCLUDED_PATHS = [
  "/signin/",
  "/join/",
  "/find/",
  "/error/",
  "/admin/emission/survey-report-print",
  "/admin/emission/survey-report-lca-summary"
];

export function shouldUseGlobalUserGnb(pathname: string) {
  const normalized = pathname.replace(/^\/en(?=\/)/, "") || "/";
  if (normalized.startsWith("/admin")) return false;
  return !USER_GNB_EXCLUDED_PATHS.some((path) => normalized.startsWith(path));
}

export function GlobalUserGnbShell({ children }: { children: ReactNode }) {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const home = useAsyncValue(() => fetchHomePayload(), [en], {
    initialValue: { isLoggedIn: false, isEn: en, homeMenu: [] },
    onError: () => undefined
  });
  const session = useFrontendSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const payload = home.value || { isLoggedIn: false, isEn: en, homeMenu: [] };

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  return (
    <>
      <HomeInlineStyles en={en} />
      <style>{`
        [data-global-user-page] > header,
        [data-global-user-page] > div > header,
        [data-global-user-page] > div > div > header:first-child { display: none !important; }
      `}</style>
      <header className="sticky top-0 z-[1000] border-b-2 border-[#001e40] bg-white" data-global-user-gnb="">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="relative flex h-16 items-center">
            <div aria-hidden="true" className="h-11 w-11 shrink-0 xl:hidden" />
            <HeaderBrand content={content} en={en} />
            <HeaderDesktopNav en={en} homeMenu={payload.homeMenu || []} />
            <div className={`ml-auto flex shrink-0 items-center ${en ? "gap-2" : "gap-3"}`}>
              <div className="hidden overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] xl:flex">
                <button className={`px-2 py-1 text-xs font-bold ${en ? "bg-white text-slate-600" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate(location.pathname.replace(/^\/en/, "") || "/home")} type="button">KO</button>
                <button className={`border-l px-2 py-1 text-xs font-bold ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-slate-600"}`} onClick={() => navigate(`/en${location.pathname}${location.search}`)} type="button">EN</button>
              </div>
              {payload.isLoggedIn ? (
                <button className="hidden rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" onClick={() => void session.logout()} type="button">{content.logout}</button>
              ) : (
                <>
                  <a className="hidden rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                  <a className="hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-white px-5 py-2.5 font-bold text-[var(--kr-gov-blue)] xl:inline-flex" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                </>
              )}
              <button aria-controls="global-mobile-menu" aria-expanded={mobileMenuOpen} aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button>
            </div>
          </div>
        </div>
      </header>
      <div aria-hidden={!mobileMenuOpen} className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[1100] xl:hidden`} id="global-mobile-menu">
        <button aria-label={content.closeAllMenu} className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" />
        <HeaderMobileMenu content={content} en={en} homeMenu={payload.homeMenu || []} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} />
      </div>
      <div data-global-user-page="">{children}</div>
    </>
  );
}
