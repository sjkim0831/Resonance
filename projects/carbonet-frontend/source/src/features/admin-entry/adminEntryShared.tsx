import { ReactNode, SyntheticEvent } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

function handleGovSymbolError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

export function AdminLoginFrame({ children }: { children: ReactNode }) {
  const en = isEnglish();

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              alt={en ? "Government Symbol of the Republic of Korea" : "대한민국 정부 상징"}
              className="h-4"
              data-fallback-applied="0"
              onError={handleGovSymbolError}
              src={GOV_SYMBOL}
            />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
            </span>
          </div>
        </div>
      </div>
      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <a className="flex items-center gap-2" href={buildLocalizedPath("/", "/en/home")}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>shield_person</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)]">
                      {en ? "CCUS Integrated Management Portal" : "CCUS 통합관리 포털"}
                    </h1>
                    <span className="bg-[#1e293b] text-white text-[10px] px-1.5 py-0.5 rounded font-black tracking-widest">ADMIN</span>
                  </div>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">
                    Carbon Capture, Utilization and Storage System
                  </p>
                </div>
              </a>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-700 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                <span className="material-symbols-outlined text-[16px]">security</span>
                {en ? "Secure Session Active" : "보안 세션 활성화됨"}
              </div>
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <a className={`px-3 py-1 text-xs font-bold ${!en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} href="/admin/login/loginView">KO</a>
                <a className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} href="/en/admin/login/loginView">EN</a>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-4" id="main-content">
        {children}
      </main>
    </div>
  );
}

export function AdminHomeShell({ children }: { children: ReactNode }) {
  return (
    <div className="gov-page gov-page-admin">
      <div className="gov-admin-shell">
        <aside className="gov-admin-sidebar">
          <div className="gov-admin-sidebar-head">
            <h2>Operation Tools</h2>
          </div>
          <a className="active" href={buildLocalizedPath("/admin/", "/en/admin/")}>운영 대시보드</a>
          <a href={buildLocalizedPath("/admin/auth/group", "/en/admin/auth/group")}>권한 그룹</a>
          <a href={buildLocalizedPath("/admin/member/list", "/en/admin/member/list")}>회원 목록</a>
          <a href={buildLocalizedPath("/admin/member/company_list", "/en/admin/member/company_list")}>회원사 목록</a>
          <div className="gov-admin-side-status">
            <strong>시스템 상태: 정상</strong>
            <p>2025.08 가이드라인 적용</p>
          </div>
        </aside>
        <main className="gov-admin-content">{children}</main>
      </div>
    </div>
  );
}
