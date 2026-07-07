import { useEffect, useMemo, useState } from "react";
import { isEnglish, navigate } from "../../lib/navigation/runtime";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type MenuSection = {
  label: string;
  items: Array<{ label: string; href: string }>;
};

type TopMenu = {
  label: string;
  href: string;
  sections: MenuSection[];
};

type ModuleCard = {
  status: string;
  statusClass: string;
  title: string;
  subtitle: string;
  methodologyLabel: string;
  methodologyValue: string;
  tierLabel: string;
  tierClass: string;
  detailLabel: string;
  detailContent?: string;
  detailTags?: string[];
  accentClass?: string;
  footerClass: string;
  primaryLabel: string;
  primaryClass: string;
  primaryIcon: string;
  secondaryIcon: string;
  secondaryClass: string;
};

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionHomeValidateInlineStyles() {
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
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
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
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .gov-btn {
        padding: 0.625rem 1.25rem;
        font-weight: 700;
        border-radius: var(--kr-gov-radius);
        transition: background-color .2s ease, color .2s ease, border-color .2s ease;
        outline: none;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .status-badge {
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
      }
      .module-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        overflow: hidden;
        transition: all .2s ease;
      }
      .module-card:hover {
        border-color: var(--kr-gov-blue);
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
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

export function EmissionHomeValidateMigrationPage() {
  const en = isEnglish();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const topMenus = useMemo<TopMenu[]>(() => en ? [
    {
      label: "Emission Calculation",
      href: "/en/emission/project_list",
      sections: [
        { label: "Calculation", items: [{ label: "Project List", href: "/en/emission/project_list" }, { label: "Data Input", href: "/en/emission/data_input" }] },
        { label: "Verification", items: [{ label: "Validation", href: "/en/emission/validate" }] }
      ]
    },
    {
      label: "Certificate",
      href: "#",
      sections: [{ label: "Issuance", items: [{ label: "Certificate Guide", href: "#" }, { label: "Verification Status", href: "#" }] }]
    },
    {
      label: "Support",
      href: "#",
      sections: [{ label: "Service", items: [{ label: "User Guide", href: "#" }, { label: "Contact", href: "#" }] }]
    }
  ] : [
    {
      label: "배출량 산정",
      href: "/emission/project_list",
      sections: [
        { label: "산정 관리", items: [{ label: "배출량 관리", href: "/emission/project_list" }, { label: "데이터 입력", href: "/emission/data_input" }] },
        { label: "검증", items: [{ label: "산정검증", href: "/emission/validate" }] }
      ]
    },
    {
      label: "인증서",
      href: "#",
      sections: [{ label: "발급 지원", items: [{ label: "인증 안내", href: "#" }, { label: "검증 현황", href: "#" }] }]
    },
    {
      label: "고객지원",
      href: "#",
      sections: [{ label: "도움말", items: [{ label: "이용 가이드", href: "#" }, { label: "문의하기", href: "#" }] }]
    }
  ], [en]);

  const modules = useMemo<ModuleCard[]>(() => en ? [
    {
      status: "ACTIVE",
      statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      title: "Fixed Combustion (Annual)",
      subtitle: "Stationary Combustion",
      methodologyLabel: "Methodology",
      methodologyValue: "Fuel Consumption",
      tierLabel: "TIER 3",
      tierClass: "bg-blue-50 text-[var(--kr-gov-blue)] border border-blue-100",
      detailLabel: "Current Parameters",
      detailTags: ["LHV Applied", "National Coefficient"],
      footerClass: "bg-gray-50",
      primaryLabel: "Adjust Settings",
      primaryClass: "bg-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-blue-hover)] text-white",
      primaryIcon: "tune",
      secondaryIcon: "menu_book",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    },
    {
      status: "IN PROGRESS",
      statusClass: "bg-blue-100 text-blue-700 border border-blue-200",
      title: "Stack Auto-Measurement (TMS)",
      subtitle: "Flue Gas Analysis",
      methodologyLabel: "Methodology",
      methodologyValue: "Continuous Monitoring",
      tierLabel: "TIER 4",
      tierClass: "bg-indigo-50 text-indigo-700 border border-indigo-100",
      detailLabel: "Current Parameters",
      detailTags: ["Real-time Sync", "Error Rate < 5%"],
      footerClass: "bg-gray-50",
      primaryLabel: "Adjust Settings",
      primaryClass: "bg-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-blue-hover)] text-white",
      primaryIcon: "tune",
      secondaryIcon: "menu_book",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    },
    {
      status: "NEEDS REVIEW",
      statusClass: "bg-orange-100 text-orange-700 border border-orange-200",
      title: "Mobile Combustion",
      subtitle: "Distance Based",
      methodologyLabel: "Methodology",
      methodologyValue: "Distance Based",
      tierLabel: "TIER 1",
      tierClass: "bg-gray-200 text-gray-600",
      detailLabel: "Current Status",
      detailContent: "Mileage data tolerance must be confirmed before applying proprietary coefficients.",
      accentClass: "border-orange-200 bg-orange-50/10",
      footerClass: "bg-orange-50/50",
      primaryLabel: "Correct Data",
      primaryClass: "bg-orange-600 hover:bg-orange-700 text-white",
      primaryIcon: "priority_high",
      secondaryIcon: "history",
      secondaryClass: "border-orange-200 text-orange-600 hover:bg-orange-50"
    },
    {
      status: "INACTIVE",
      statusClass: "bg-gray-100 text-gray-500 border border-gray-200",
      title: "Industrial Process (Hydrogen)",
      subtitle: "Mass Balance",
      methodologyLabel: "Methodology",
      methodologyValue: "Mass Balance",
      tierLabel: "N/A",
      tierClass: "bg-gray-100 text-gray-400 border border-gray-200",
      detailLabel: "System Logic",
      detailContent: "Module is temporarily paused due to process restructuring.",
      footerClass: "bg-gray-50",
      primaryLabel: "Locked",
      primaryClass: "bg-gray-400 text-white cursor-not-allowed",
      primaryIcon: "lock",
      secondaryIcon: "settings",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    }
  ] : [
    {
      status: "활성",
      statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      title: "연도별 고정 연소",
      subtitle: "Stationary Combustion",
      methodologyLabel: "방법론",
      methodologyValue: "Fuel Consumption",
      tierLabel: "TIER 3",
      tierClass: "bg-blue-50 text-[var(--kr-gov-blue)] border border-blue-100",
      detailLabel: "Current Parameters",
      detailTags: ["LHV 적용", "국가 고유계수"],
      footerClass: "bg-gray-50",
      primaryLabel: "설정 변경",
      primaryClass: "bg-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-blue-hover)] text-white",
      primaryIcon: "tune",
      secondaryIcon: "menu_book",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    },
    {
      status: "진행중",
      statusClass: "bg-blue-100 text-blue-700 border border-blue-200",
      title: "굴뚝 자동 측정 (TMS)",
      subtitle: "Flue Gas Analysis",
      methodologyLabel: "방법론",
      methodologyValue: "Continuous Monitoring",
      tierLabel: "TIER 4",
      tierClass: "bg-indigo-50 text-indigo-700 border border-indigo-100",
      detailLabel: "Current Parameters",
      detailTags: ["실시간 전송", "오차율 < 5%"],
      footerClass: "bg-gray-50",
      primaryLabel: "설정 변경",
      primaryClass: "bg-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-blue-hover)] text-white",
      primaryIcon: "tune",
      secondaryIcon: "menu_book",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    },
    {
      status: "보완 필요",
      statusClass: "bg-orange-100 text-orange-700 border border-orange-200",
      title: "이동 연소 (차량용)",
      subtitle: "Mobile Combustion",
      methodologyLabel: "방법론",
      methodologyValue: "Distance Based",
      tierLabel: "TIER 1",
      tierClass: "bg-gray-200 text-gray-600",
      detailLabel: "Current Status",
      detailContent: "주행거리 데이터 오차 범위 확인 필요. 고유 계수 적용 전 검토 대기 중.",
      accentClass: "border-orange-200 bg-orange-50/10",
      footerClass: "bg-orange-50/50",
      primaryLabel: "데이터 정정",
      primaryClass: "bg-orange-600 hover:bg-orange-700 text-white",
      primaryIcon: "priority_high",
      secondaryIcon: "history",
      secondaryClass: "border-orange-200 text-orange-600 hover:bg-orange-50"
    },
    {
      status: "비활성",
      statusClass: "bg-gray-100 text-gray-500 border border-gray-200",
      title: "공정 배출 (수소생산)",
      subtitle: "Industrial Process",
      methodologyLabel: "방법론",
      methodologyValue: "Mass Balance",
      tierLabel: "N/A",
      tierClass: "bg-gray-100 text-gray-400 border border-gray-200",
      detailLabel: "System Logic",
      detailContent: "공정 개편으로 인한 모듈 일시 정지 상태입니다.",
      footerClass: "bg-gray-50",
      primaryLabel: "잠금됨",
      primaryClass: "bg-gray-400 text-white cursor-not-allowed",
      primaryIcon: "lock",
      secondaryIcon: "settings",
      secondaryClass: "border-gray-200 text-gray-500 hover:bg-gray-50"
    }
  ], [en]);

  const filteredModules = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return modules;
    }
    return modules.filter((module) =>
      `${module.title} ${module.subtitle} ${module.methodologyValue}`.toLowerCase().includes(keyword)
    );
  }, [modules, searchKeyword]);

  return (
    <>
      <EmissionHomeValidateInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to main content" : "본문 바로가기"}</a>
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government Symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Official Republic of Korea Service | Emission Calculation Verification Center" : "대한민국 정부 공식 서비스 | 배출량 산정 검증 센터"}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{en ? "Logic status: Latest configuration reflected" : "로직 상태: 최신 구성 반영 완료"}</p>
            </div>
          </div>
        </div>
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <a className="absolute left-1/2 -translate-x-1/2 xl:static xl:translate-x-0 flex items-center gap-3 shrink-0 max-w-[78vw] xl:max-w-none" href={en ? "/en/home" : "/home"}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]">eco</span>
                <div className="home-brand-copy flex flex-col">
                  <h1 className="home-brand-title text-base sm:text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">
                    {en ? "CCUS Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
                  </h1>
                  <p className={`home-brand-subtitle ${en ? "hidden 2xl:block" : "hidden sm:block"} text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider`}>
                    Carbon Footprint Platform
                  </p>
                </div>
              </a>
              <nav className={`${en ? "hidden xl:flex items-center h-full ml-4 2xl:ml-8 flex-1 justify-center min-w-0" : "hidden xl:flex items-center space-x-1 h-full ml-8 flex-1 justify-center"}`} aria-label={en ? "Main menu" : "주 메뉴"}>
                {topMenus.map((top) => (
                  <div className="gnb-item h-full relative group min-w-0" key={top.label}>
                    <a className={`${en ? "h-full flex items-center justify-center px-[6px] 2xl:px-2 text-[12px] 2xl:text-[13px] font-bold whitespace-normal text-center leading-[1.15] break-words max-w-[92px] 2xl:max-w-[104px]" : "h-full flex items-center px-4 text-[17px] font-bold"} text-[var(--kr-gov-text-primary)] border-b-4 border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)] transition-all focus-visible`} href={top.href}>
                      {top.label}
                    </a>
                    <div className="gnb-depth2 hidden absolute top-full left-0 bg-white border border-[var(--kr-gov-border-light)] shadow-lg rounded-b-[var(--kr-gov-radius)] py-2">
                      <div className="gnb-sections">
                        {top.sections.map((section) => (
                          <div className="gnb-section" key={section.label}>
                            <strong className="gnb-section-title">{section.label}</strong>
                            {section.items.map((item) => (
                              <a className="block px-4 py-2 hover:bg-gray-50 text-sm" href={item.href} key={item.label}>
                                {item.label}
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </nav>
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/validate")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/validate")}>EN</button>
                </div>
                <a className="hidden xl:inline-flex items-center px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" href={en ? "/en/signin/loginView" : "/signin/loginView"}>
                  {en ? "Login" : "로그인"}
                </a>
                <button id="mobile-menu-toggle" className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible" type="button" aria-controls="mobile-menu" aria-expanded={mobileMenuOpen} aria-label={en ? "Open all menu" : "전체메뉴 열기"} onClick={() => setMobileMenuOpen((current) => !current)}>
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" className="absolute inset-0 bg-black/50" aria-label={en ? "Close all menu" : "전체메뉴 닫기"} onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute top-0 right-0 h-full w-[90%] max-w-[380px] bg-white shadow-2xl border-l border-[var(--kr-gov-border-light)] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-[var(--kr-gov-border-light)] bg-white">
              <strong className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{en ? "All Menu" : "전체메뉴"}</strong>
              <button className="w-10 h-10 p-0 text-[var(--kr-gov-text-secondary)]" type="button" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button type="button" className={`rounded-[var(--kr-gov-radius)] border px-3 py-2 font-bold ${en ? "text-[var(--kr-gov-text-secondary)]" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/validate")}>KO</button>
                <button type="button" className={`rounded-[var(--kr-gov-radius)] border px-3 py-2 font-bold ${en ? "bg-[var(--kr-gov-blue)] text-white" : "text-[var(--kr-gov-text-secondary)]"}`} onClick={() => navigate("/en/emission/validate")}>EN</button>
              </div>
              <div className="space-y-3">
                {topMenus.map((top) => (
                  <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] p-3" key={top.label}>
                    <h3 className="text-sm font-extrabold text-[var(--kr-gov-blue)] mb-2">{top.label}</h3>
                    {top.sections.map((section) => (
                      <div key={section.label}>
                        <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mt-2 mb-1">{section.label}</p>
                        <div className="space-y-1 text-sm mb-2">
                          {section.items.map((item) => (
                            <a className="block py-1" href={item.href} key={item.label}>{item.label}</a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <main id="main-content">
          <section className="bg-slate-900 py-12 relative overflow-hidden border-b border-slate-800" data-help-id="emission-home-validate-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="emission-validate-dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#emission-validate-dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">settings_suggest</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white">{en ? "Logic Management Console" : "산정 로직 관리 콘솔"}</h2>
                      <p className="text-blue-400 text-sm font-bold flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        {en ? "Currently configuring 'Ulsan Chemical Base #3' modules" : "현재 '울산 제3 화학기지' 산정 모듈 구성 중"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-widest">{en ? "Active Modules" : "활성 모듈"}</p>
                    <p className="text-2xl font-black text-white">12 / 14</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-widest">{en ? "Global Recalculation" : "전역 재산정"}</p>
                    <button className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors" type="button">
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      {en ? "Run Batch Recalculation" : "일괄 재산정 실행"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-10" data-help-id="emission-home-validate-modules">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">grid_view</span>
                  {en ? "Calculation Modules by Methodology" : "방법론별 산정 모듈 구성"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{en ? "Select calculation methodologies for each emission source and fine-tune specific parameters." : "배출원별 산정 방법론을 선택하고 세부 파라미터를 조정할 수 있습니다."}</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
                  <input className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-[var(--kr-gov-blue)] focus:border-[var(--kr-gov-blue)]" onChange={(event) => setSearchKeyword(event.target.value)} placeholder={en ? "Search module name..." : "모듈 명칭 검색..."} value={searchKeyword} type="text" />
                </div>
                <button className="gov-btn border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm" type="button">
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  {en ? "Filter" : "필터"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredModules.map((module) => (
                <div className={`module-card ${module.accentClass || ""}`} key={module.title}>
                  <div className={`p-5 border-b flex justify-between items-start ${module.accentClass ? "border-orange-100 bg-orange-50/50" : "border-gray-100 bg-gray-50/50"}`}>
                    <div>
                      <span className={`status-badge mb-2 inline-block ${module.statusClass}`}>{module.status}</span>
                      <h4 className="font-black text-gray-800">{module.title}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">{module.subtitle}</p>
                    </div>
                    <button className="text-gray-400 hover:text-[var(--kr-gov-blue)] transition-colors" type="button">
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                  </div>
                  <div className={`p-5 space-y-4 ${module.accentClass ? "text-orange-900/70" : ""}`}>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{module.methodologyLabel}</span>
                      <span className="font-bold text-gray-700">{module.methodologyValue}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{en ? "Tier Level" : "Tier 수준"}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${module.tierClass}`}>{module.tierLabel}</span>
                    </div>
                    <div className={`pt-4 border-t border-dashed ${module.accentClass ? "border-orange-200" : "border-gray-100"}`}>
                      <p className={`text-[11px] font-bold mb-2 uppercase tracking-tighter ${module.accentClass ? "text-orange-400" : "text-gray-400"}`}>{module.detailLabel}</p>
                      {module.detailTags ? (
                        <div className="flex flex-wrap gap-2">
                          {module.detailTags.map((tag) => (
                            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded font-bold" key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-[11px] font-medium leading-tight ${module.accentClass ? "" : "text-gray-400 italic"}`}>{module.detailContent}</p>
                      )}
                    </div>
                  </div>
                  <div className={`px-5 py-4 flex gap-2 ${module.footerClass}`}>
                    <button className={`flex-1 py-2 text-[12px] font-bold rounded flex items-center justify-center gap-1 transition-colors ${module.primaryClass}`} type="button">
                      <span className="material-symbols-outlined text-[16px]">{module.primaryIcon}</span>
                      {module.primaryLabel}
                    </button>
                    <button className={`w-10 h-9 flex items-center justify-center border rounded bg-white transition-colors ${module.secondaryClass}`} type="button">
                      <span className="material-symbols-outlined text-[18px]">{module.secondaryIcon}</span>
                    </button>
                  </div>
                </div>
              ))}
              <button className="module-card border-2 border-dashed border-gray-200 bg-white hover:border-[var(--kr-gov-blue)] hover:bg-blue-50/30 flex flex-col items-center justify-center min-h-[300px] group" type="button">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-[var(--kr-gov-blue)] text-[32px]">add_circle</span>
                </div>
                <span className="text-sm font-bold text-gray-400 group-hover:text-[var(--kr-gov-blue)]">{en ? "Add New Calculation Module" : "신규 산정 모듈 추가"}</span>
                <span className="text-[11px] text-gray-300 mt-1">{en ? "Select from methodology library" : "방법론 라이브러리에서 선택"}</span>
              </button>
            </div>
            <div className="mt-12 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-help-id="emission-home-validate-fine-tuning">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-[var(--kr-gov-blue)]">
                    <span className="material-symbols-outlined">analytics</span>
                  </div>
                  <div>
                    <h4 className="font-black text-lg">{en ? "Calculation Logic Fine-tuning" : "산정 로직 정교화 작업"}</h4>
                    <p className="text-sm text-gray-500">{en ? "Manage selected module constants and correction coefficients." : "선택된 모듈의 산정 상수 및 보정 계수를 관리합니다."}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="gov-btn bg-white border border-gray-200 text-gray-600 text-xs font-bold" type="button">{en ? "Change History" : "변경 이력"}</button>
                  <button className="gov-btn bg-[var(--kr-gov-blue)] text-white text-xs font-bold" type="button">{en ? "Save Final Settings" : "최종 설정 저장"}</button>
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">{en ? "Net Calorific Value" : "연료별 순발열량"}</label>
                    <select className="w-full border border-gray-200 rounded-lg text-sm focus:ring-[var(--kr-gov-blue)]">
                      <option>{en ? "2025 national energy statistics (H1)" : "2025년 상반기 국가 에너지 통계 기준"}</option>
                      <option>{en ? "Site-specific measurement (Tier 3)" : "사업장 고유 측정값 (Tier 3)"}</option>
                    </select>
                    <p className="text-[11px] text-indigo-500 font-medium">{en ? "Supporting evidence submission is required during verification." : "검증 단계에서 증빙 서류 제출이 필요합니다."}</p>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">{en ? "Emission Factor" : "배출계수 적용"}</label>
                    <div className="flex items-center gap-4">
                      <input className="w-full border border-gray-200 rounded-lg text-sm focus:ring-[var(--kr-gov-blue)]" defaultValue="0.00234" type="number" />
                      <span className="text-xs font-bold text-gray-400 whitespace-nowrap">tCO2/unit</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">{en ? "Uncertainty" : "불확실성 관리"}</label>
                    <div className="h-2 bg-gray-100 rounded-full mt-2 relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-emerald-500" style={{ width: "95.5%" }} />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-gray-400">{en ? "Confidence" : "신뢰도 수준"}</span>
                      <span className="text-emerald-600">95.5% (Very High)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="bg-gray-50 border-t border-gray-200 py-16" data-help-id="emission-home-validate-actions">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex gap-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                    <span className="material-symbols-outlined text-[32px]">published_with_changes</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-black mb-2">{en ? "Run Real-time Recalculation" : "실시간 재산정 실행"}</h4>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">{en ? "Recalculate historical and current emissions with the updated logic while respecting system load." : "수정된 산정 로직을 기반으로 과거 데이터를 포함한 전체 배출량을 다시 계산합니다."}</p>
                    <button className="gov-btn bg-slate-800 text-white flex items-center gap-2 hover:bg-slate-900" type="button">
                      <span className="material-symbols-outlined text-[18px]">play_circle</span>
                      {en ? "Start Recalculation Workflow" : "재산정 워크플로우 시작"}
                    </button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex gap-6">
                  <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
                    <span className="material-symbols-outlined text-[32px]">fact_check</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-black mb-2">{en ? "Verification Readiness Check" : "검증 준비도 체크"}</h4>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">{en ? "Self-assess compliance readiness based on configured methodologies and current input data." : "현재 설정된 방법론과 데이터 입력 현황을 기반으로 외부 검증 요구사항 준수 여부를 자가 진단합니다."}</p>
                    <button className="gov-btn bg-white border border-gray-300 text-gray-700 flex items-center gap-2 hover:bg-gray-50" type="button">
                      <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                      {en ? "Generate Self-check Report" : "자가 진단 리포트 생성"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
