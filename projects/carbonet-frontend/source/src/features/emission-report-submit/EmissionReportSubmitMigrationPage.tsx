import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderMobileMenu } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomeMenuItem, HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type StepItem = {
  label: string;
  state: "completed" | "active" | "upcoming";
  value: string;
  icon?: string;
};

type LocalizedReportContent = {
  govGuide: string;
  breadcrumbHome: string;
  breadcrumbSection: string;
  pageTitle: string;
  pageSubtitle: string;
  draftSaved: string;
  managerLabel: string;
  logout: string;
  directHeading: string;
  indirectHeading: string;
  facilityLabel: string;
  periodLabel: string;
  facilityHelp: string;
  usageLabel: string;
  usageUnit: string;
  calculationLabel: string;
  calculationWaiting: string;
  factorLabel: string;
  factorValue: string;
  electricityLabel: string;
  electricityUnit: string;
  billCopyLabel: string;
  uploadTitle: string;
  uploadHint: string;
  previousStep: string;
  saveDraft: string;
  nextStep: string;
  guideTitle: string;
  guideStrong: string;
  guideBody: string;
  cautionTitle: string;
  cautionBody: string;
  factorLink: string;
  supportTitle: string;
  supportBody: string;
  footerOrg: string;
  footerAddress: string;
  footerPolicy: string;
  footerTerms: string;
  footerNoSpam: string;
  footerCopyright: string;
  footerUpdated: string;
  stepItems: StepItem[];
  facilities: string[];
};

const REPORT_CONTENT: Record<"ko" | "en", LocalizedReportContent> = {
  ko: {
    govGuide: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    breadcrumbHome: "홈",
    breadcrumbSection: "탄소배출",
    pageTitle: "배출량 보고서 작성",
    pageSubtitle: "2025년 하반기 정기 탄소배출량 데이터를 입력합니다.",
    draftSaved: "임시 저장됨: 2025.08.20 14:30",
    managerLabel: "홍길동 담당자님",
    logout: "로그아웃",
    directHeading: "직접 배출원 (Scope 1)",
    indirectHeading: "간접 배출원 (Scope 2)",
    facilityLabel: "배출 시설 선택",
    periodLabel: "측정 기간",
    facilityHelp: "등록된 사업장 내 주요 배출 시설을 선택하십시오.",
    usageLabel: "연료 사용량 (Activity Data)",
    usageUnit: "Nm³",
    calculationLabel: "자동 계산 결과 (CO₂ 환산량)",
    calculationWaiting: "계산 대기 중",
    factorLabel: "적용 배출 계수",
    factorValue: "2.1456 tCO2/10³Nm³ (2025 국가표준)",
    electricityLabel: "전력 사용량",
    electricityUnit: "MWh",
    billCopyLabel: "고지서 사본 (선택)",
    uploadTitle: "파일을 끌어다 놓거나 클릭하여 업로드",
    uploadHint: "PDF, JPG, PNG (최대 10MB)",
    previousStep: "이전 단계",
    saveDraft: "임시 저장",
    nextStep: "다음 단계",
    guideTitle: "작성 가이드",
    guideStrong: "정확한 배출원 선택",
    guideBody: "신고 누락을 방지하기 위해 사업장 허가증에 명시된 모든 시설이 포함되어야 합니다.",
    cautionTitle: "주의사항",
    cautionBody: "입력된 데이터는 향후 외부 검증 기관의 심사 자료로 사용되므로, 반드시 실제 계측 데이터나 고지서를 바탕으로 입력하십시오.",
    factorLink: "국가 배출계수 목록 조회",
    supportTitle: "도움이 필요하신가요?",
    supportBody: "입력 방법이 복잡하거나 데이터 변환이 어려울 경우 기술 지원팀에 문의하세요.",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)\n본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다.",
    footerPolicy: "개인정보처리방침",
    footerTerms: "이용약관",
    footerNoSpam: "이메일무단수집거부",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerUpdated: "최종 수정일:",
    stepItems: [
      { label: "사업장 정보", state: "completed", value: "1", icon: "check" },
      { label: "배출 데이터 입력", state: "active", value: "2" },
      { label: "증빙서류 첨부", state: "upcoming", value: "3" },
      { label: "최종 검토 및 제출", state: "upcoming", value: "4" }
    ],
    facilities: ["A-01 보일러 (LNG)", "B-05 소각로", "C-02 비상용 발전기"]
  },
  en: {
    govGuide: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    breadcrumbHome: "Home",
    breadcrumbSection: "Carbon Emissions",
    pageTitle: "Create Emission Report",
    pageSubtitle: "Enter periodic carbon emission data for the second half of 2025.",
    draftSaved: "Draft Saved: 2025.08.20 14:30",
    managerLabel: "Manager Gildong Hong",
    logout: "Logout",
    directHeading: "Direct Emissions (Scope 1)",
    indirectHeading: "Indirect Emissions (Scope 2)",
    facilityLabel: "Select Emission Facility",
    periodLabel: "Measurement Period",
    facilityHelp: "Please select the primary emission facility registered at the workplace.",
    usageLabel: "Fuel Consumption (Activity Data)",
    usageUnit: "Nm³",
    calculationLabel: "Calculation Result (CO₂ Equivalent)",
    calculationWaiting: "Waiting for Calculation",
    factorLabel: "Applied Emission Factor",
    factorValue: "2.1456 tCO2/10³Nm³ (2025 National Standard)",
    electricityLabel: "Electricity Consumption",
    electricityUnit: "MWh",
    billCopyLabel: "Utility Bill Copy (Optional)",
    uploadTitle: "Drag & drop files or click to upload",
    uploadHint: "PDF, JPG, PNG (Max 10MB)",
    previousStep: "Previous Step",
    saveDraft: "Save Draft",
    nextStep: "Next Step",
    guideTitle: "Reporting Guide",
    guideStrong: "Accurate Source Selection",
    guideBody: "To prevent reporting omissions, ensure all facilities specified in the workplace permit are included.",
    cautionTitle: "Caution",
    cautionBody: "The entered data will be used for external verification review, so use actual metering data or utility bills.",
    factorLink: "View National Emission Factors",
    supportTitle: "Need Help?",
    supportBody: "Contact the technical support team if the input process is complex or data conversion is difficult.",
    footerOrg: "CCUS Integrated Operations Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main line: 02-1234-5678 (Weekdays 09:00-18:00)\nThis service manages greenhouse gas reduction performance under applicable laws.",
    footerPolicy: "Privacy Policy",
    footerTerms: "Terms of Use",
    footerNoSpam: "No Unauthorized Email Collection",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerUpdated: "Last updated:",
    stepItems: [
      { label: "Facility Info", state: "completed", value: "1", icon: "check" },
      { label: "Emission Data", state: "active", value: "2" },
      { label: "Documentation", state: "upcoming", value: "3" },
      { label: "Review & Submit", state: "upcoming", value: "4" }
    ],
    facilities: ["A-01 Boiler (LNG)", "B-05 Incinerator", "C-02 Emergency Generator"]
  }
};

function handleGovSymbolError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function ReportSubmitInlineStyles({ en }: { en: boolean }) {
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
        --kr-gov-error: #d32f2f;
      }
      body {
        font-family: ${en ? "'Public Sans', 'Noto Sans KR', sans-serif" : "'Noto Sans KR', 'Public Sans', sans-serif"};
        -webkit-font-smoothing: antialiased;
        background: #f8f9fa;
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
      .skip-link:focus {
        top: 0;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .gov-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: var(--kr-gov-radius);
        font-weight: 700;
        transition: background-color .2s ease, border-color .2s ease, color .2s ease;
      }
      .gov-input {
        width: 100%;
        border: 1px solid var(--kr-gov-border-light);
        border-radius: var(--kr-gov-radius);
        padding: 10px 16px;
        background: white;
        outline: none;
        transition: box-shadow .2s ease, border-color .2s ease;
      }
      .gov-input:focus {
        border-color: var(--kr-gov-blue);
        box-shadow: 0 0 0 3px rgba(0, 55, 139, 0.15);
      }
      .gov-label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        font-weight: 700;
        color: var(--kr-gov-text-primary);
      }
      .required-mark::after {
        content: '*';
        color: var(--kr-gov-error);
        margin-left: 4px;
      }
      .step-item.active .step-circle {
        background: var(--kr-gov-blue);
        color: white;
        border-color: var(--kr-gov-blue);
      }
      .step-item.completed .step-circle {
        background: #10b981;
        color: white;
        border-color: #10b981;
      }
      .desktop-nav-item:hover .desktop-nav-depth2 {
        display: block;
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
      body.mobile-menu-open {
        overflow: hidden;
      }
    `}</style>
  );
}

function isEmissionTopMenu(item: HomeMenuItem) {
  const label = String(item.label || "").toLowerCase();
  const url = String(item.url || "").toLowerCase();
  if (label.includes("탄소") || label.includes("배출") || label.includes("carbon") || label.includes("emission")) {
    return true;
  }
  if (url.includes("/emission")) {
    return true;
  }
  return (item.sections || []).some((section) =>
    (section.items || []).some((entry) => String(entry.url || "").toLowerCase().includes("/emission"))
  );
}

function ReportSubmitDesktopNav({ en, homeMenu }: { en: boolean; homeMenu: HomeMenuItem[] }) {
  return (
    <nav className="hidden xl:flex items-center space-x-1 h-full ml-8 flex-1 justify-center" aria-label={en ? "Primary navigation" : "주 메뉴"}>
      {homeMenu.map((top, index) => {
        const active = isEmissionTopMenu(top) || (!homeMenu.some(isEmissionTopMenu) && index === 0);
        return (
          <div className="desktop-nav-item h-full relative group" key={`${top.label || "top"}-${index}`}>
            <a
              className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all focus-visible ${
                active
                  ? "text-[var(--kr-gov-blue)] border-[var(--kr-gov-blue)]"
                  : "text-[var(--kr-gov-text-primary)] border-transparent hover:text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]"
              }`}
              href={top.url || "#"}
            >
              {top.label || (en ? "Menu" : "메뉴")}
            </a>
            {top.sections && top.sections.length > 0 ? (
              <div className="desktop-nav-depth2 hidden absolute top-full left-0 w-56 bg-white border border-[var(--kr-gov-border-light)] shadow-lg rounded-b-[var(--kr-gov-radius)] py-2 z-20">
                {(top.sections || []).flatMap((section) => section.items || []).map((item, itemIndex) => (
                  <a
                    className={`block px-4 py-2 hover:bg-gray-50 text-sm ${String(item.url || "").includes("/emission/report_submit") ? "font-bold text-[var(--kr-gov-blue)]" : ""}`}
                    href={item.url || "#"}
                    key={`${item.label || "sub"}-${itemIndex}`}
                  >
                    {item.label || (en ? "Item" : "항목")}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function EmissionReportSubmitMigrationPage() {
  const en = isEnglish();
  const content = REPORT_CONTENT[en ? "en" : "ko"];
  const sharedContent = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
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

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-report-submit", {
      language: en ? "en" : "ko",
      menuCount: homeMenu.length,
      stepCount: content.stepItems.length,
      mobileMenuOpen
    });
    logGovernanceScope("COMPONENT", "emission-report-submit-form", {
      facilityCount: content.facilities.length,
      hasSupportAside: true,
      hasStepIndicator: true
    });
  }, [content.facilities.length, content.stepItems.length, en, homeMenu.length, mobileMenuOpen]);

  return (
    <>
      <ReportSubmitInlineStyles en={en} />
      <div className="bg-[#f8f9fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{sharedContent.skipLink}</a>
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={sharedContent.govAlt} className="h-4" src={GOV_SYMBOL} onError={handleGovSymbolError} />
              <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">{sharedContent.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{content.govGuide}</p>
            </div>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-20">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={sharedContent} en={en} />
              <ReportSubmitDesktopNav en={en} homeMenu={homeMenu} />
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/report_submit")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/report_submit")}>EN</button>
                </div>
                <span className="hidden xl:inline text-sm font-medium mr-2">{content.managerLabel}</span>
                <button type="button" className="hidden xl:inline-flex gov-btn border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] hover:bg-gray-50 text-sm py-1.5 px-4" onClick={() => void session.logout()}>{content.logout}</button>
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible"
                  type="button"
                  aria-controls="mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={sharedContent.openAllMenu}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={sharedContent.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={sharedContent}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={session.logout}
          />
        </div>

        <main className="pb-20" id="main-content">
          <section className="bg-white border-b border-[var(--kr-gov-border-light)]" data-help-id="emission-report-submit-hero">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
              <nav aria-label="Breadcrumb" className="flex text-sm text-[var(--kr-gov-text-secondary)] mb-4">
                <ol className="flex items-center gap-2">
                  <li><a className="hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/home", "/en/home")}>{content.breadcrumbHome}</a></li>
                  <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                  <li><a className="hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{content.breadcrumbSection}</a></li>
                  <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                  <li className="font-bold text-[var(--kr-gov-text-primary)]">{content.pageTitle}</li>
                </ol>
              </nav>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-2">{content.pageTitle}</h2>
                  <p className="text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-blue-50 text-[var(--kr-gov-blue)] px-4 py-2 rounded-[var(--kr-gov-radius)] font-medium">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  {content.draftSaved}
                </div>
              </div>
            </div>
          </section>

          <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-10">
            <div className="bg-white p-8 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] mb-8" data-help-id="emission-report-submit-steps">
              <div className="flex justify-between items-start max-w-4xl mx-auto relative gap-3">
                <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 -z-0" />
                {content.stepItems.map((step) => (
                  <div className={`step-item relative z-10 flex flex-col items-center gap-3 text-center ${step.state}`} key={step.label}>
                    <div className={`step-circle w-10 h-10 rounded-full border-2 bg-white flex items-center justify-center font-bold ${step.state === "upcoming" ? "text-gray-400" : ""}`}>
                      {step.icon ? <span className="material-symbols-outlined text-xl">{step.icon}</span> : step.value}
                    </div>
                    <span className={`text-sm ${step.state === "completed" || step.state === "active" ? "font-bold" : "font-medium"} ${step.state === "completed" ? "text-emerald-600" : step.state === "active" ? "text-[var(--kr-gov-blue)]" : "text-gray-400"}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white p-8 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] shadow-sm" data-help-id="emission-report-submit-scope1">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-[var(--kr-gov-blue)] rounded-full" />
                    {content.directHeading}
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="gov-label required-mark" htmlFor="facility-select">{content.facilityLabel}</label>
                        <select className="gov-input" defaultValue={content.facilities[0]} id="facility-select">
                          {content.facilities.map((facility) => (
                            <option key={facility} value={facility}>{facility}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[var(--kr-gov-text-secondary)] mt-2">{content.facilityHelp}</p>
                      </div>
                      <div>
                        <label className="gov-label required-mark" htmlFor="period-start">{content.periodLabel}</label>
                        <div className="flex items-center gap-2">
                          <input className="gov-input" defaultValue="2025-07-01" id="period-start" type="date" />
                          <span className="text-gray-400">~</span>
                          <input className="gov-input" defaultValue="2025-07-31" type="date" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-[var(--kr-gov-border-light)] pt-6">
                      <label className="gov-label required-mark" htmlFor="usage-input">{content.usageLabel}</label>
                      <div className="flex gap-2">
                        <input className="gov-input text-right" id="usage-input" placeholder="0.00" type="number" />
                        <span className="bg-gray-100 border border-[var(--kr-gov-border-light)] px-4 py-2.5 rounded-[var(--kr-gov-radius)] text-sm font-bold flex items-center">{content.usageUnit}</span>
                      </div>
                      <div className="mt-4 p-4 bg-gray-50 rounded-[var(--kr-gov-radius)] text-sm border border-[var(--kr-gov-border-light)]">
                        <div className="flex justify-between items-center mb-2 gap-4">
                          <span className="text-[var(--kr-gov-text-secondary)]">{content.calculationLabel}</span>
                          <span className="font-bold text-[var(--kr-gov-blue)]">{content.calculationWaiting}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-[var(--kr-gov-text-secondary)]">{content.factorLabel}</span>
                          <span className="text-xs text-right">{content.factorValue}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-white p-8 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] shadow-sm" data-help-id="emission-report-submit-scope2">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-[var(--kr-gov-blue)] rounded-full" />
                    {content.indirectHeading}
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="gov-label required-mark" htmlFor="electricity-input">{content.electricityLabel}</label>
                      <div className="flex gap-2">
                        <input className="gov-input text-right" id="electricity-input" placeholder="0.00" type="number" />
                        <span className="bg-gray-100 border border-[var(--kr-gov-border-light)] px-4 py-2.5 rounded-[var(--kr-gov-radius)] text-sm font-bold flex items-center">{content.electricityUnit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="upload-area">{content.billCopyLabel}</label>
                      <button className="w-full border-2 border-dashed border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] p-8 text-center bg-gray-50 hover:bg-white transition-colors cursor-pointer group" id="upload-area" type="button">
                        <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-[var(--kr-gov-blue)] mb-2">upload_file</span>
                        <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)]">{content.uploadTitle}</p>
                        <p className="text-xs text-gray-400 mt-1">{content.uploadHint}</p>
                      </button>
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4" data-help-id="emission-report-submit-actions">
                  <button className="gov-btn border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] hover:bg-white px-8 h-14 bg-white shadow-sm" type="button" onClick={() => navigate(buildLocalizedPath("/emission/project_list", "/en/emission/project_list"))}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    {content.previousStep}
                  </button>
                  <div className="flex gap-3 self-end">
                    <button className="gov-btn border border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)] hover:bg-blue-50 px-8 h-14 bg-white" type="button">{content.saveDraft}</button>
                    <button className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] px-10 h-14 shadow-lg" type="button" onClick={() => navigate(buildLocalizedPath("/emission/validate", "/en/emission/validate"))}>
                      {content.nextStep}
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <section className="bg-white p-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] shadow-sm sticky top-24" data-help-id="emission-report-submit-guide">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">lightbulb</span>
                    {content.guideTitle}
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)] mb-1">{content.guideStrong}</p>
                      <p className="text-xs text-[var(--kr-gov-text-secondary)] leading-relaxed">{content.guideBody}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-[var(--kr-gov-radius)] border border-amber-100">
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        {content.cautionTitle}
                      </p>
                      <p className="text-[11px] text-amber-700 leading-relaxed">{content.cautionBody}</p>
                    </div>
                    <div className="pt-4 border-t border-[var(--kr-gov-border-light)]">
                      <a className="text-sm font-bold text-[var(--kr-gov-blue)] flex items-center justify-between hover:underline" href="#">
                        {content.factorLink}
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </a>
                    </div>
                  </div>
                </section>

                <section className="bg-slate-800 text-white p-6 rounded-[var(--kr-gov-radius)] shadow-sm" data-help-id="emission-report-submit-support">
                  <h4 className="font-bold mb-4">{content.supportTitle}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">{content.supportBody}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400">call</span>
                      <span className="text-sm font-bold">02-1234-5678</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400">mail</span>
                      <span className="text-sm">support@ccus.go.kr</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </main>

        <footer className="bg-white border-t border-[var(--kr-gov-border-light)]">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-[var(--kr-gov-border-light)]">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={sharedContent.govAlt} className="h-8 grayscale" src={GOV_SYMBOL} onError={handleGovSymbolError} />
                  <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">{content.footerOrg}</span>
                </div>
                <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed whitespace-pre-line">{content.footerAddress}</address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{content.footerPolicy}</a>
                <a className="text-[var(--kr-gov-text-primary)] hover:underline" href="#">{content.footerTerms}</a>
                <a className="text-[var(--kr-gov-text-primary)] hover:underline" href="#">{content.footerNoSpam}</a>
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-xs font-medium text-[var(--kr-gov-text-secondary)]">
                <p>{content.footerCopyright}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-xs font-bold text-[var(--kr-gov-text-secondary)]">
                  <span>{content.footerUpdated}</span>
                  <time dateTime="2025-08-20">2025.08.20</time>
                </div>
                <img alt="웹 접근성 품질인증 마크" className="h-10" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
