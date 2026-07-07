import { buildLocalizedPath, navigate } from "../../../lib/navigation/runtime";
import { LOCALIZED_CONTENT } from "../../home-entry/homeEntryContent";
import { HomePayload } from "../../home-entry/homeEntryTypes";
import { GOV_SYMBOL, handleGovSymbolError } from "./EmissionProjectListTypes";

interface HeaderProps {
  en: boolean;
  payload: HomePayload;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function EmissionProjectListHeader({
  en,
  payload,
  onLogout,
  mobileMenuOpen,
  onMobileMenuToggle
}: HeaderProps) {
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const homeMenu = payload.homeMenu || [];

  return (
    <>
      {/* Government Banner */}
      <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              alt={en ? "Government symbol" : "대한민국 정부 상징"}
              className="h-4"
              data-fallback-applied="0"
              onError={handleGovSymbolError}
              src={GOV_SYMBOL}
            />
            <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Official Government Service | Carbon Emission Management System"
                : "대한민국 정부 공식 서비스 | 탄소 배출량 관리 시스템"}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <PulseDot color="#22c55e" />
              {en ? "System Active" : "시스템 운영중"}
            </span>
            <span>{new Date().toLocaleDateString(en ? "en-US" : "ko-KR")}</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="relative flex items-center h-24">
            {/* Mobile Menu Toggle */}
            <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />

            {/* Logo & Brand */}
            <a
              href={buildLocalizedPath("/home", "/en/home")}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--kr-gov-blue)] to-blue-600 flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-white text-xl">eco</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-gray-900 tracking-tight">
                  {en ? "Carbon Emission" : "탄소 배출량"}
                </h1>
                <p className="text-[11px] font-medium text-gray-500">
                  {en ? "Management System" : "관리 시스템"}
                </p>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex ml-12 gap-6" aria-label={content.navAria}>
              {homeMenu.slice(0, 6).map((menu, index) => (
                <a
                  key={`${menu.label || "menu"}-${index}`}
                  className="text-[var(--kr-gov-text-secondary)] font-bold hover:text-[var(--kr-gov-blue)] transition-colors text-sm border-b-2 border-transparent hover:border-[var(--kr-gov-blue)] pb-1"
                  href={menu.url || "#"}
                >
                  {menu.label || (en ? "Menu" : "메뉴")}
                </a>
              ))}
            </nav>

            {/* Right Section */}
            <div className="ml-auto flex items-center gap-3 shrink-0">
              {/* Language Toggle */}
              <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-bold transition-colors focus-visible ${
                    en
                      ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-50"
                      : "bg-[var(--kr-gov-blue)] text-white"
                  }`}
                  onClick={() => navigate("/home")}
                >
                  KO
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-bold border-l border-[var(--kr-gov-border-light)] transition-colors focus-visible ${
                    en
                      ? "bg-[var(--kr-gov-blue)] text-white"
                      : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-50"
                  }`}
                  onClick={() => navigate("/en/home")}
                >
                  EN
                </button>
              </div>

              {/* Login/Logout */}
              {payload.isLoggedIn ? (
                <button
                  type="button"
                  className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]"
                  onClick={onLogout}
                >
                  {content.logout}
                </button>
              ) : (
                <>
                  <a
                    className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center"
                    href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}
                  >
                    {content.login}
                  </a>
                  <a
                    className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center"
                    href={buildLocalizedPath("/join/step1", "/join/en/step1")}
                  >
                    {content.signup}
                  </a>
                </>
              )}

              {/* Mobile Menu Button */}
              <button
                id="mobile-menu-toggle"
                className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible"
                type="button"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                aria-label={content.openAllMenu}
                onClick={onMobileMenuToggle}
              >
                <span className="material-symbols-outlined">
                  {mobileMenuOpen ? "close" : "menu"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-0 z-[70]" aria-hidden={!mobileMenuOpen}>
          <button
            type="button"
            id="mobile-menu-backdrop"
            className="absolute inset-0 bg-black/50"
            aria-label={content.closeAllMenu}
            onClick={onMobileMenuToggle}
          />
          <nav className="absolute right-0 top-0 h-full w-80 max-w-full bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">
                  {en ? "Menu" : "전체 메뉴"}
                </span>
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  onClick={onMobileMenuToggle}
                >
                  <span className="material-symbols-outlined text-gray-500">close</span>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-1">
              {homeMenu.map((menu, index) => (
                <a
                  key={`${menu.label || "menu"}-${index}`}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--kr-gov-blue)] rounded-lg transition-colors"
                  href={menu.url || "#"}
                >
                  {menu.label || (en ? "Menu" : "메뉴")}
                </a>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 mt-auto">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 text-xs font-bold border border-gray-200 rounded-lg"
                  onClick={() => navigate("/home")}
                >
                  KO
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 text-xs font-bold border border-gray-200 rounded-lg"
                  onClick={() => navigate("/en/home")}
                >
                  EN
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function PulseDot({ color = "#22c55e" }: { color?: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}