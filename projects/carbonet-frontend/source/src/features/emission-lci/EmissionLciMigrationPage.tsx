import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type LciRecord = {
  code: string;
  nameKo: string;
  nameEn: string;
  unit: string;
  gwp: number;
  region: "GLOBAL" | "KR" | "EU" | "NA" | "AS";
  process: "MANUFACTURING" | "TRANSPORT" | "ENERGY" | "RECYCLE";
  impact: "ALL" | "GWP" | "ADP" | "AP" | "EP";
  sourceKo: string;
  sourceEn: string;
  datasetYear: string;
  reliability: number;
};

type SiteCard = {
  statusKo: string;
  statusEn: string;
  statusClass: string;
  id: string;
  titleKo: string;
  titleEn: string;
  progress: number;
  progressClass: string;
  groupTitleKo: string;
  groupTitleEn: string;
  links: Array<{ labelKo: string; labelEn: string; ctaKo: string; ctaEn: string }>;
  actionKo: string;
  actionEn: string;
  actionClass: string;
  accentClass: string;
};

type DatasetShare = {
  labelKo: string;
  labelEn: string;
  percent: number;
  barClass: string;
};

const RECORDS: LciRecord[] = [
  { code: "KR-MAT-0012", nameKo: "포틀랜드 시멘트", nameEn: "Portland Cement", unit: "1 kg", gwp: 0.824, region: "KR", process: "MANUFACTURING", impact: "GWP", sourceKo: "KR / 환경성적표지", sourceEn: "KR / Environmental Product Declaration", datasetYear: "2024", reliability: 4 },
  { code: "KR-NRG-0005", nameKo: "산업용 전력", nameEn: "Industrial Electricity, Low Voltage", unit: "1 kWh", gwp: 0.459, region: "KR", process: "ENERGY", impact: "GWP", sourceKo: "KR / 국가 LCI DB", sourceEn: "KR / National LCI DB", datasetYear: "2024", reliability: 5 },
  { code: "KR-TRA-0021", nameKo: "화물차 운송", nameEn: "Truck, 15t payload", unit: "1 tkm", gwp: 0.112, region: "KR", process: "TRANSPORT", impact: "GWP", sourceKo: "KR / 국가 LCI DB", sourceEn: "KR / National LCI DB", datasetYear: "2023", reliability: 3 },
  { code: "EU-MAT-0199", nameKo: "재생 알루미늄 슬러그 처리", nameEn: "Secondary Aluminium Slag Treatment", unit: "1 kg", gwp: 0.291, region: "EU", process: "RECYCLE", impact: "ADP", sourceKo: "EU / Ecoinvent", sourceEn: "EU / Ecoinvent", datasetYear: "2023", reliability: 4 },
  { code: "GLB-WAT-0047", nameKo: "공업용수 공급", nameEn: "Industrial Water Supply", unit: "1 m3", gwp: 0.073, region: "GLOBAL", process: "ENERGY", impact: "EP", sourceKo: "Global / OpenLCA", sourceEn: "Global / OpenLCA", datasetYear: "2022", reliability: 4 },
  { code: "NA-CHE-0110", nameKo: "암모니아 촉매 전구체", nameEn: "Ammonia Catalyst Precursor", unit: "1 kg", gwp: 1.264, region: "NA", process: "MANUFACTURING", impact: "AP", sourceKo: "NA / USLCI", sourceEn: "NA / USLCI", datasetYear: "2024", reliability: 2 }
];

const SITE_CARDS: SiteCard[] = [
  {
    statusKo: "데이터 수집 완료",
    statusEn: "Data Collection Complete",
    statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    id: "PH-001",
    titleKo: "포항 제1 열연공장",
    titleEn: "Pohang Hot Rolling Mill 1",
    progress: 95,
    progressClass: "bg-[var(--kr-gov-blue)]",
    groupTitleKo: "Contextual LCI Links",
    groupTitleEn: "Contextual LCI Links",
    links: [
      { labelKo: "연료 소비 LCI DB", labelEn: "Fuel Consumption LCI DB", ctaKo: "조회", ctaEn: "View" },
      { labelKo: "슬래브 원부자재 LCI", labelEn: "Slab Raw Material LCI", ctaKo: "조회", ctaEn: "View" }
    ],
    actionKo: "전과정 영향 평가 보고서 생성",
    actionEn: "Generate Life Cycle Impact Report",
    actionClass: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    accentClass: "border-t-[var(--kr-gov-blue)]"
  },
  {
    statusKo: "DB 매핑 진행중 (65%)",
    statusEn: "DB Mapping In Progress (65%)",
    statusClass: "bg-orange-100 text-orange-700 border border-orange-200",
    id: "US-042",
    titleKo: "울산 제3 화학기지",
    titleEn: "Ulsan Chemical Base 3",
    progress: 65,
    progressClass: "bg-orange-500",
    groupTitleKo: "Missing LCI Matches",
    groupTitleEn: "Missing LCI Matches",
    links: [
      { labelKo: "특수 촉매 (X-92)", labelEn: "Special Catalyst (X-92)", ctaKo: "대체 DB 탐색", ctaEn: "Find Alternate DB" },
      { labelKo: "폐수 처리 공정", labelEn: "Wastewater Treatment Process", ctaKo: "데이터 요청", ctaEn: "Request Data" }
    ],
    actionKo: "데이터 정합성 보완하기",
    actionEn: "Improve Data Consistency",
    actionClass: "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20",
    accentClass: "border-t-orange-500 ring-2 ring-orange-500/20"
  },
  {
    statusKo: "검증 단계",
    statusEn: "Verification Stage",
    statusClass: "bg-blue-100 text-blue-700 border border-blue-200",
    id: "GN-112",
    titleKo: "광양 제2 에너지센터",
    titleEn: "Gwangyang Energy Center 2",
    progress: 100,
    progressClass: "bg-blue-500",
    groupTitleKo: "Verified LCI Datasets",
    groupTitleEn: "Verified LCI Datasets",
    links: [
      { labelKo: "전력 그리드 (KR 2023)", labelEn: "Power Grid (KR 2023)", ctaKo: "검증완료", ctaEn: "Verified" },
      { labelKo: "공업용수 공급", labelEn: "Industrial Water Supply", ctaKo: "검증완료", ctaEn: "Verified" }
    ],
    actionKo: "검증 확인서 내려받기",
    actionEn: "Download Verification Confirmation",
    actionClass: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    accentClass: "border-t-blue-500"
  }
];

const DATASET_SHARE: DatasetShare[] = [
  { labelKo: "국가 LCI DB (환경부)", labelEn: "National LCI DB (MOE)", percent: 65, barClass: "bg-blue-600" },
  { labelKo: "글로벌 DB (Ecoinvent 등)", labelEn: "Global DB (Ecoinvent, etc.)", percent: 25, barClass: "bg-sky-400" },
  { labelKo: "산업별 전문 DB", labelEn: "Industry-Specific DB", percent: 10, barClass: "bg-emerald-400" }
];

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionLciInlineStyles() {
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
        --lci-accent: #0ea5e9;
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
      .gov-card {
        border: 1px solid var(--kr-gov-border-light);
        border-radius: var(--kr-gov-radius);
        background: white;
        transition: all .2s ease;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .search-input {
        width: 100%;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 0.375rem;
        color: white;
        font-size: 0.875rem;
        padding: 0.625rem 0.75rem;
      }
      .search-input::placeholder { color: #94a3b8; }
      .search-input:focus {
        outline: 2px solid var(--lci-accent);
        outline-offset: 1px;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
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
    `}</style>
  );
}

export function EmissionLciMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [materialKeyword, setMaterialKeyword] = useState("");
  const [processFilter, setProcessFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState("ALL");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(1);

  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }

    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  const filteredRecords = useMemo(() => {
    const keyword = materialKeyword.trim().toLowerCase();
    return RECORDS.filter((record) => {
      const matchesKeyword = !keyword
        || `${record.nameKo} ${record.nameEn} ${record.code}`.toLowerCase().includes(keyword);
      const matchesProcess = processFilter === "ALL" || record.process === processFilter;
      const matchesRegion = regionFilter === "ALL" || record.region === regionFilter;
      const matchesImpact = impactFilter === "ALL" || record.impact === impactFilter;
      return matchesKeyword && matchesProcess && matchesRegion && matchesImpact;
    });
  }, [impactFilter, materialKeyword, processFilter, regionFilter]);

  useEffect(() => {
    setPageIndex(1);
    setSelectedCodes((current) => current.filter((code) => filteredRecords.some((record) => record.code === code)));
  }, [filteredRecords]);

  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = filteredRecords.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  const visibleCodes = pagedRecords.map((record) => record.code);
  const allVisibleSelected = visibleCodes.length > 0 && visibleCodes.every((code) => selectedCodes.includes(code));

  function toggleVisibleSelection() {
    setSelectedCodes((current) => {
      if (allVisibleSelected) {
        return current.filter((code) => !visibleCodes.includes(code));
      }
      return Array.from(new Set([...current, ...visibleCodes]));
    });
  }

  function toggleSingleSelection(code: string) {
    setSelectedCodes((current) =>
      current.includes(code)
        ? current.filter((value) => value !== code)
        : [...current, code]
    );
  }

  const labels = useMemo(() => ({
    headerNote: en ? "Official Government Service | Environmental Analyst Portal" : "대한민국 정부 공식 서비스 | 환경 영향 분석가 포털",
    updateNote: en ? "DB latest update: 2025.08.15 09:00" : "DB 최종 업데이트: 2025.08.15 09:00",
    pageTitle: en ? "LCI DB Analysis Portal" : "LCI DB 분석 포털",
    heroTitle: en ? "LCI DB Integrated Search" : "LCI DB 통합 검색",
    heroSubTitle: "Multi-faceted Data Query",
    searchAction: en ? "Search datasets" : "데이터 조회하기",
    resultTitle: en ? "Results" : "조회 결과",
    compareAction: en ? "Compare Data" : "데이터 비교",
    downloadAction: en ? "Download Excel" : "Excel 다운로드",
    sitesTitle: en ? "Analyzed Sites" : "분석 대상 사업장 (Analyzed Sites)",
    sitesDescription: en ? "Core sites currently under analysis with mapped LCI references." : "현재 LCI 데이터를 기반으로 분석이 진행 중인 핵심 사이트입니다.",
    qualityTitle: en ? "DB Quality and Analysis Performance" : "DB 데이터 품질 및 분석 성과",
    qualityDescription: en ? "Reliability and analysis activity for the LCI datasets currently applied in the platform." : "플랫폼 내 적용된 LCI 데이터셋의 신뢰도와 분석 현황입니다."
  }), [en]);

  return (
    <>
      <EmissionLciInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{labels.headerNote}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{labels.updateNote}</p>
            </div>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/lci")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/lci")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
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
          <button type="button" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={content}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={session.logout}
          />
        </div>

        <main id="main-content">
          <section className="bg-slate-900 pt-10 pb-20 relative overflow-hidden border-b border-slate-800" data-help-id="emission-lci-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="emission-lci-dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#emission-lci-dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg bg-[var(--lci-accent)] flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <span className="material-symbols-outlined text-white">search</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{labels.heroTitle}</h2>
                  <p className="text-sky-400 text-[11px] font-bold uppercase tracking-widest">{labels.heroSubTitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{en ? "Material / Resource" : "물질 / 자원명"}</label>
                  <input className="search-input" onChange={(event) => setMaterialKeyword(event.target.value)} placeholder={en ? "Example: cement, steel..." : "예: 시멘트, 조강..."} type="text" value={materialKeyword} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{en ? "Process" : "공정 (Process)"}</label>
                  <select className="search-input appearance-none" onChange={(event) => setProcessFilter(event.target.value)} value={processFilter}>
                    <option value="ALL">{en ? "All Processes" : "전체 공정"}</option>
                    <option value="MANUFACTURING">{en ? "Manufacturing" : "제조 및 생산"}</option>
                    <option value="TRANSPORT">{en ? "Transport & Logistics" : "운송 및 물류"}</option>
                    <option value="ENERGY">{en ? "Energy Supply" : "에너지 공급"}</option>
                    <option value="RECYCLE">{en ? "Disposal & Recycling" : "폐기 및 재활용"}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{en ? "Region" : "지리적 범위 (Region)"}</label>
                  <select className="search-input appearance-none" onChange={(event) => setRegionFilter(event.target.value)} value={regionFilter}>
                    <option value="ALL">{en ? "All Regions" : "전체 (Global)"}</option>
                    <option value="KR">{en ? "Korea" : "대한민국 (KR)"}</option>
                    <option value="EU">{en ? "Europe" : "유럽 (EU)"}</option>
                    <option value="NA">{en ? "North America" : "북미 (NA)"}</option>
                    <option value="AS">{en ? "Asia" : "아시아 (AS)"}</option>
                    <option value="GLOBAL">{en ? "Global" : "글로벌"}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{en ? "Impact" : "영향 범주 (Impact)"}</label>
                  <select className="search-input appearance-none" onChange={(event) => setImpactFilter(event.target.value)} value={impactFilter}>
                    <option value="ALL">{en ? "All Categories" : "전체 범주"}</option>
                    <option value="GWP">GWP</option>
                    <option value="ADP">ADP</option>
                    <option value="AP">AP</option>
                    <option value="EP">EP</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="w-full h-[42px] bg-[var(--lci-accent)] hover:bg-sky-600 text-white font-bold rounded text-sm transition-all flex items-center justify-center gap-2" type="button" onClick={() => setPageIndex(1)}>
                    <span className="material-symbols-outlined text-[18px]">manage_search</span>
                    {labels.searchAction}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 -mt-10 relative z-20 mb-12" data-help-id="emission-lci-results">
            <div className="bg-white shadow-2xl rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white">
                <div className="flex items-center gap-4">
                  <h3 className="font-black text-gray-800 flex items-center gap-2">
                    {labels.resultTitle} <span className="text-[var(--lci-accent)]">{filteredRecords.length}</span>
                  </h3>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded">KR DB</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded">{en ? "Latest Applied" : "최신 기준 적용"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1" type="button">
                    <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                    {labels.compareAction} ({selectedCodes.length})
                  </button>
                  <button className="px-3 py-1.5 border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1" type="button">
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    {labels.downloadAction}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-y border-gray-200 text-left text-[12px] font-bold text-gray-500 uppercase tracking-tight">
                      <th className="px-4 py-3 w-10"><input checked={allVisibleSelected} className="rounded border-gray-300" onChange={toggleVisibleSelection} type="checkbox" /></th>
                      <th className="px-4 py-3">{en ? "Code" : "분류번호"}</th>
                      <th className="px-4 py-3">{en ? "Material / Process" : "물질/공정 명칭"}</th>
                      <th className="px-4 py-3">{en ? "Unit" : "단위"}</th>
                      <th className="px-4 py-3">GWP (kg CO2-eq)</th>
                      <th className="px-4 py-3">{en ? "Region / Source" : "지역/출처"}</th>
                      <th className="px-4 py-3">{en ? "Reliability" : "데이터 신뢰도"}</th>
                      <th className="px-4 py-3 text-right">{en ? "Action" : "관리"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedRecords.map((record) => (
                      <tr className="hover:bg-sky-50/30 transition-colors" key={record.code}>
                        <td className="px-4 py-3 text-sm border-b border-gray-100"><input checked={selectedCodes.includes(record.code)} className="rounded border-gray-300" onChange={() => toggleSingleSelection(record.code)} type="checkbox" /></td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100 font-mono text-xs text-gray-400">{record.code}</td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100">
                          <div className="font-bold text-gray-800">{en ? record.nameEn : record.nameKo}</div>
                          <div className="text-xs text-gray-400">{record.datasetYear}</div>
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100">{record.unit}</td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100 font-bold text-[var(--kr-gov-blue)]">{record.gwp.toFixed(3)}</td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100">{en ? record.sourceEn : record.sourceKo}</td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span className={`w-2 h-2 rounded-full ${index < record.reliability ? "bg-emerald-500" : "bg-gray-200"}`} key={`${record.code}-${index}`} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100 text-right">
                          <button className="p-1 hover:text-[var(--lci-accent)] transition-colors" type="button">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pagedRecords.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={8}>
                          {en ? "No datasets matched the selected filter conditions." : "선택한 조건에 맞는 데이터셋이 없습니다."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-gray-50 flex items-center justify-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white text-gray-400 disabled:opacity-40" disabled={pageIndex === 1} onClick={() => setPageIndex((current) => Math.max(1, current - 1))} type="button">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const value = index + 1;
                  const active = value === pageIndex;
                  return (
                    <button className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${active ? "bg-[var(--kr-gov-blue)] text-white shadow-sm" : "border border-gray-200 hover:bg-white text-gray-600"}`} key={value} onClick={() => setPageIndex(value)} type="button">
                      {value}
                    </button>
                  );
                })}
                <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white text-gray-400 disabled:opacity-40" disabled={pageIndex === totalPages} onClick={() => setPageIndex((current) => Math.min(totalPages, current + 1))} type="button">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="emission-lci-sites">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                  {labels.sitesTitle}
                </h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{labels.sitesDescription}</p>
              </div>
              <button className="text-xs font-bold text-gray-400 hover:text-[var(--kr-gov-blue)] flex items-center gap-1 transition-colors" type="button">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                {en ? "Configure targets" : "대상 설정"}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              {SITE_CARDS.map((site) => (
                <div className={`gov-card border-t-4 shadow-md relative ${site.accentClass}`} key={site.id}>
                  <div className="p-6 border-b border-gray-100 bg-blue-50/20 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${site.statusClass}`}>{en ? site.statusEn : site.statusKo}</span>
                        <span className="text-[10px] font-bold text-gray-400">ID: {site.id}</span>
                      </div>
                      <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? site.titleEn : site.titleKo}</h3>
                    </div>
                  </div>
                  <div className="p-6 space-y-6 flex-1">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-bold">{en ? "LCI Mapping Rate" : "LCI 매핑률"}</span>
                        <span className="font-black text-[var(--kr-gov-blue)]">{site.progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${site.progressClass}`} style={{ width: `${site.progress}%` }} />
                      </div>
                    </div>
                    <div className={`${site.id === "US-042" ? "bg-orange-50/50" : "bg-gray-50"} p-4 rounded-lg space-y-3`}>
                      <p className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${site.id === "US-042" ? "text-orange-400" : "text-gray-400"}`}>
                        <span className={`w-1 h-1 rounded-full ${site.id === "US-042" ? "bg-orange-400" : "bg-gray-400"}`} />
                        {en ? site.groupTitleEn : site.groupTitleKo}
                      </p>
                      <ul className="space-y-2">
                        {site.links.map((link) => (
                          <li className="flex items-center justify-between" key={link.labelKo}>
                            <span className="text-xs text-gray-700 font-medium">{en ? link.labelEn : link.labelKo}</span>
                            <a className={`text-[10px] font-bold underline ${site.id === "US-042" ? "text-orange-600" : "text-[var(--lci-accent)]"}`} href="#">
                              {en ? link.ctaEn : link.ctaKo}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button className={`w-full py-3 rounded-lg text-xs font-bold transition-all ${site.actionClass}`} type="button">
                      {en ? site.actionEn : site.actionKo}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border-y border-gray-200 py-16" data-help-id="emission-lci-quality">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                <div>
                  <h2 className="text-2xl font-black mb-1">{labels.qualityTitle}</h2>
                  <p className="text-[var(--kr-gov-text-secondary)] text-sm">{labels.qualityDescription}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm text-gray-600 mb-6">{en ? "Dataset Source Distribution" : "데이터 소스별 비중"}</h4>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-black text-[var(--kr-gov-blue)] tracking-tight">1,245</span>
                    <span className="text-sm font-bold text-gray-400">Datasets</span>
                  </div>
                  <div className="space-y-4">
                    {DATASET_SHARE.map((item) => (
                      <div className="space-y-1" key={item.labelKo}>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span>{en ? item.labelEn : item.labelKo}</span>
                          <span>{item.percent}%</span>
                        </div>
                        <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                          <div className={`h-full ${item.barClass}`} style={{ width: `${item.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm text-gray-600 mb-6">{en ? "Monthly Analysis Throughput" : "월별 분석 처리 건수"}</h4>
                  <div className="flex gap-4 h-32 items-end">
                    {[42, 58, 75, 92].map((value, index) => (
                      <div className={`flex-1 rounded-t-sm relative ${index === 3 ? "bg-[var(--lci-accent)] h-[90%]" : index === 2 ? "bg-slate-300 h-[70%]" : index === 1 ? "bg-slate-200 h-[55%]" : "bg-slate-200 h-[40%]"}`} key={value}>
                        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold ${index === 3 ? "text-sky-600" : ""}`}>{value}</div>
                        {index === 3 ? <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400">{en ? "Aug" : "8월"}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-between">
                  <h4 className="font-bold text-sm text-gray-600 mb-4">{en ? "Data Integrity Index" : "데이터 무결성 지수"}</h4>
                  <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full -rotate-90">
                        <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                        <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset="30" strokeLinecap="round" strokeWidth="8" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black">88%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "Direct Data" : "직접 데이터"}</span><span className="font-bold">452</span></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "Estimated Data" : "추정 데이터"}</span><span className="font-bold">82</span></div>
                      <div className="mt-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-[11px] font-black flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        {en ? "Maintaining High Reliability" : "높은 신뢰도 유지 중"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{en ? "CCUS Integrated Operations" : "CCUS 통합관리본부"}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed">
                  {en
                    ? "(04551) 110, Sejong-daero, Jung-gu, Seoul | Support: 02-1234-5678"
                    : "(04551) 서울특별시 중구 세종대로 110 | 기술 지원: 02-1234-5678"}
                  <br />
                  {en
                    ? "This portal provides LCI datasets for precise carbon footprint analysis."
                    : "본 포털은 정밀한 탄소 발자국 산정을 위한 LCI 데이터 제공을 목적으로 합니다."}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "LCI Terms of Use" : "LCI 데이터 이용약관"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "DB Manual Download" : "DB 매뉴얼 다운로드"}</a>
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">© 2025 CCUS Carbon Footprint Platform. LCI Analysis Portal.</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">V 2.5.0 (LCI DB Integrated)</div>
                <img alt={en ? "Web accessibility mark" : "웹 접근성 품질인증 마크"} className="h-10 opacity-60" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
