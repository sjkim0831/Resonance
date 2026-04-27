import { ReactNode } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

export type LoginResponse = {
  status: string;
  errors?: string;
  certified?: boolean;
  userId?: string;
  userSe?: string;
  canEnterAdminConsole?: boolean;
};

export function PublicFrame(props: {
  title: string;
  subtitle?: string;
  languagePathKo: string;
  languagePathEn: string;
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  const en = isEnglish();

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <a className="flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>
                  eco
                </span>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)]">
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">
                    Carbon Capture, Utilization and Storage
                  </p>
                </div>
              </a>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <a className={!en ? "px-3 py-1 text-xs bg-[var(--kr-gov-blue)] text-white font-bold" : "px-3 py-1 text-xs bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100 font-bold"} href={props.languagePathKo}>KO</a>
                <a className={en ? "px-3 py-1 text-xs bg-[var(--kr-gov-blue)] text-white font-bold border-l border-[var(--kr-gov-border-light)]" : "px-3 py-1 text-xs bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100 font-bold border-l border-[var(--kr-gov-border-light)]"} href={props.languagePathEn}>EN</a>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center py-16 px-4" id="main-content">
        <div className="w-full max-w-4xl bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm overflow-hidden p-10 lg:p-14">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-4">{props.title}</h2>
            {props.subtitle ? <p className="text-[var(--kr-gov-text-secondary)]">{props.subtitle}</p> : null}
          </div>
          {props.children}
          {props.footerNote ? (
            <div className="mt-12 pt-8 border-t border-[var(--kr-gov-border-light)] flex flex-col items-center gap-6">
              {props.footerNote}
            </div>
          ) : null}
        </div>
      </main>
      <footer className="bg-white border-t border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  alt={en ? "Government of Korea Emblem" : "대한민국 정부 상징"}
                  className="h-8 grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE"
                />
                <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">
                  {en ? "Carbon Neutral CCUS Management Headquarters" : "탄소중립 CCUS 통합관리본부"}
                </span>
              </div>
              <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
                {en
                  ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Republic of Korea | Representative: 02-1234-5678"
                  : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678"}
                <br />
                © 2025 CCUS Integration Management Portal. All rights reserved.
              </address>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
