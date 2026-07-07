import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type StepState = "completed" | "active" | "upcoming";

type StepItem = {
  label: string;
  state: StepState;
  value: string;
  icon?: string;
};

type LocalizedFormContent = {
  pageTitle: string;
  pageSubtitle: string;
  draftSaved: string;
  heroBadge: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  breadcrumbHome: string;
  breadcrumbSection: string;
  breadcrumbCurrent: string;
  completionLabel: string;
  facilityLabel: string;
  periodLabel: string;
  scope1Title: string;
  scope2Title: string;
  basicTitle: string;
  guideTitle: string;
  guideStrong: string;
  guideBody: string;
  cautionTitle: string;
  cautionBody: string;
  supportTitle: string;
  supportBody: string;
  reportTypeLabel: string;
  titleLabel: string;
  companyLabel: string;
  siteLabel: string;
  assigneeLabel: string;
  facilityHelp: string;
  fuelUsageLabel: string;
  fuelUnit: string;
  electricityUsageLabel: string;
  electricityUnit: string;
  docUploadLabel: string;
  uploadTitle: string;
  uploadHint: string;
  calculationLabel: string;
  calculationStatus: string;
  factorLabel: string;
  factorValue: string;
  previousStep: string;
  saveDraft: string;
  nextStep: string;
  reportTypes: string[];
  facilities: string[];
  steps: StepItem[];
};

const FORM_CONTENT: Record<"ko" | "en", LocalizedFormContent> = {
  ko: {
    pageTitle: "보고서 작성 허브",
    pageSubtitle: "배출 데이터, 증빙 자료, 인증 연계 메모를 한 화면에서 정리합니다.",
    draftSaved: "임시 저장됨: 2026.04.02 09:20",
    heroBadge: "Document Draft Studio",
    heroTitle: "제출 전 검토를 줄이도록 보고서 데이터와 증빙 맥락을 함께 작성합니다.",
    heroBody: "정기 보고서, 인증 갱신 첨부 문서, 내부 검토 메모를 같은 초안 안에서 관리해 다음 승인 단계로 곧바로 넘길 수 있습니다.",
    primaryCta: "목록으로 돌아가기",
    secondaryCta: "검토 큐 보기",
    breadcrumbHome: "홈",
    breadcrumbSection: "보고서 및 인증서",
    breadcrumbCurrent: "보고서 작성",
    completionLabel: "필수 항목 8개 중 6개 완료",
    facilityLabel: "배출 시설 선택",
    periodLabel: "측정 기간",
    scope1Title: "직접 배출 데이터 (Scope 1)",
    scope2Title: "간접 배출 데이터 및 증빙 (Scope 2)",
    basicTitle: "문서 기본 정보",
    guideTitle: "작성 가이드",
    guideStrong: "검토자 기준으로 문서를 묶어 두기",
    guideBody: "보고서 제목, 사업장, 측정 기간, 담당자를 먼저 맞추면 내부 검토와 인증 연계 검토가 빨라집니다.",
    cautionTitle: "주의사항",
    cautionBody: "수치 입력은 실제 계측 자료와 세금계산서, 고지서 기준으로 맞춰야 하며 보완 요청 시 동일 파일을 다시 추적할 수 있어야 합니다.",
    supportTitle: "연계 메모",
    supportBody: "인증서 갱신과 함께 제출할 예정이라면 적용 기준, 내부 검토자, 예상 제출일을 메모에 남겨 두십시오.",
    reportTypeLabel: "문서 유형",
    titleLabel: "문서 제목",
    companyLabel: "회원사",
    siteLabel: "배출지",
    assigneeLabel: "담당자",
    facilityHelp: "등록된 사업장 내 주요 배출 시설을 선택하십시오.",
    fuelUsageLabel: "연료 사용량 (Activity Data)",
    fuelUnit: "Nm³",
    electricityUsageLabel: "전력 사용량",
    electricityUnit: "MWh",
    docUploadLabel: "증빙서류 업로드",
    uploadTitle: "파일을 끌어다 놓거나 클릭하여 업로드",
    uploadHint: "PDF, XLSX, JPG, PNG (최대 10MB)",
    calculationLabel: "예상 CO2 환산량",
    calculationStatus: "자동 계산 준비 완료",
    factorLabel: "적용 배출 계수",
    factorValue: "2.1456 tCO2/10³Nm³ (2026 국가표준)",
    previousStep: "이전 단계",
    saveDraft: "임시 저장",
    nextStep: "검토 단계로 이동",
    reportTypes: ["정기 보고서", "분기 배출 보고서", "인증서 갱신 첨부", "준수 확인서 초안"],
    facilities: ["A-01 보일러 (LNG)", "B-05 소각로", "C-02 비상용 발전기"],
    steps: [
      { label: "문서 기본 정보", state: "completed", value: "1", icon: "check" },
      { label: "배출 데이터 입력", state: "active", value: "2" },
      { label: "증빙서류 첨부", state: "upcoming", value: "3" },
      { label: "최종 검토 및 제출", state: "upcoming", value: "4" }
    ]
  },
  en: {
    pageTitle: "Report Draft Studio",
    pageSubtitle: "Organize emission data, evidence files, and certification notes in one drafting workspace.",
    draftSaved: "Draft Saved: 2026.04.02 09:20",
    heroBadge: "Document Draft Studio",
    heroTitle: "Prepare report data and evidence context together to reduce review rework before submission.",
    heroBody: "Periodic reports, certificate renewal attachments, and internal review notes stay in a single draft so the next approval stage can move immediately.",
    primaryCta: "Back to portfolio",
    secondaryCta: "Open review queue",
    breadcrumbHome: "Home",
    breadcrumbSection: "Reports & Certificates",
    breadcrumbCurrent: "Report Form",
    completionLabel: "6 of 8 required items completed",
    facilityLabel: "Select Emission Facility",
    periodLabel: "Measurement Period",
    scope1Title: "Direct Emission Data (Scope 1)",
    scope2Title: "Indirect Emission Data and Evidence (Scope 2)",
    basicTitle: "Document Basics",
    guideTitle: "Drafting Guide",
    guideStrong: "Group the file around how reviewers will inspect it",
    guideBody: "Lock the report title, company, period, and owner first so internal review and certificate linkage review can progress faster.",
    cautionTitle: "Caution",
    cautionBody: "Numeric entries must match actual meter data, invoices, and utility bills, and each evidence file should remain traceable during supplement requests.",
    supportTitle: "Linkage Notes",
    supportBody: "If the draft will be submitted with a certificate renewal, leave the applied standard, reviewer, and target submission date in the memo.",
    reportTypeLabel: "Document Type",
    titleLabel: "Document Title",
    companyLabel: "Company",
    siteLabel: "Site",
    assigneeLabel: "Assignee",
    facilityHelp: "Select the primary emission facility registered at the workplace.",
    fuelUsageLabel: "Fuel Consumption (Activity Data)",
    fuelUnit: "Nm³",
    electricityUsageLabel: "Electricity Consumption",
    electricityUnit: "MWh",
    docUploadLabel: "Evidence Upload",
    uploadTitle: "Drag files here or click to upload",
    uploadHint: "PDF, XLSX, JPG, PNG (Max 10MB)",
    calculationLabel: "Estimated CO2 Equivalent",
    calculationStatus: "Auto-calculation ready",
    factorLabel: "Applied Emission Factor",
    factorValue: "2.1456 tCO2/10³Nm³ (2026 National Standard)",
    previousStep: "Previous Step",
    saveDraft: "Save Draft",
    nextStep: "Move to Review",
    reportTypes: ["Periodic report", "Quarterly emission report", "Certificate renewal attachment", "Compliance draft"],
    facilities: ["A-01 Boiler (LNG)", "B-05 Incinerator", "C-02 Emergency Generator"],
    steps: [
      { label: "Document Basics", state: "completed", value: "1", icon: "check" },
      { label: "Emission Data", state: "active", value: "2" },
      { label: "Evidence Files", state: "upcoming", value: "3" },
      { label: "Review & Submit", state: "upcoming", value: "4" }
    ]
  }
};

function InlineStyles() {
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
        --kr-gov-radius: 6px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; background: var(--kr-gov-blue); color: white; padding: 12px; z-index: 100; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .gov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--kr-gov-radius); font-weight: 700; transition: background-color .2s ease, border-color .2s ease, color .2s ease; }
      .gov-input { width: 100%; border: 1px solid var(--kr-gov-border-light); border-radius: 14px; padding: 12px 16px; background: white; outline: none; transition: box-shadow .2s ease, border-color .2s ease; }
      .gov-input:focus { border-color: var(--kr-gov-blue); box-shadow: 0 0 0 3px rgba(0, 55, 139, 0.12); }
      .gov-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; color: var(--kr-gov-text-primary); }
      .required-mark::after { content: '*'; color: #d32f2f; margin-left: 4px; }
      .gov-card { border: 1px solid var(--kr-gov-border-light); border-radius: 18px; background: white; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); }
      .step-item.active .step-circle { background: var(--kr-gov-blue); border-color: var(--kr-gov-blue); color: white; }
      .step-item.completed .step-circle { background: #10b981; border-color: #10b981; color: white; }
    `}</style>
  );
}

function completionRate(fields: string[]) {
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export function CertificateReportFormMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = FORM_CONTENT[en ? "en" : "ko"];

  const [reportType, setReportType] = useState(content.reportTypes[0]);
  const [title, setTitle] = useState(en ? "Q2 2026 Capture Operations Report" : "2026년 2분기 포집 운영 보고서");
  const [company, setCompany] = useState(en ? "West Coast Capture Pilot" : "서부 포집 시범단지");
  const [site, setSite] = useState(en ? "Capture Module B" : "포집 모듈 B");
  const [assignee, setAssignee] = useState(en ? "Kim Supervisor" : "김담당");
  const [facility, setFacility] = useState(content.facilities[0]);
  const [periodStart, setPeriodStart] = useState("2026-03-01");
  const [periodEnd, setPeriodEnd] = useState("2026-03-31");
  const [fuelUsage, setFuelUsage] = useState("124.50");
  const [electricityUsage, setElectricityUsage] = useState("18.30");

  const estimatedEmission = useMemo(() => {
    const fuel = Number.parseFloat(fuelUsage || "0");
    const electricity = Number.parseFloat(electricityUsage || "0");
    const total = fuel * 2.1456 + electricity * 0.4594;
    return total.toFixed(2);
  }, [electricityUsage, fuelUsage]);

  const completedPercent = completionRate([reportType, title, company, site, assignee, facility, periodStart, periodEnd]);

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-report-form", {
      language: en ? "en" : "ko",
      reportType,
      completedPercent,
      estimatedEmission
    });
  }, [completedPercent, en, estimatedEmission, reportType]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Integrated drafting workspace for reports and certificates." : "대한민국 정부 공식 서비스 | 보고서·인증서 작성 워크스페이스"}
        />
        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <button className="flex items-center gap-3 bg-transparent p-0 text-left" type="button" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}>
              <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]">edit_document</span>
              <div>
                <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.heroBadge}</p>
              </div>
            </button>
            <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/monitoring/track", "/en/monitoring/track")}>{en ? "Monitoring" : "배출지 모니터링"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/emission/data_input", "/en/emission/data_input")}>{en ? "Data Input" : "데이터 산정"}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/certificate/report_form", "/en/certificate/report_form")}>{en ? "Report Form" : "보고서 작성"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{en ? "Portfolio" : "문서 목록"}</a>
            </nav>
            <div className="flex items-center gap-3">
              <UserLanguageToggle en={en} onKo={() => navigate("/certificate/report_form")} onEn={() => navigate("/en/certificate/report_form")} />
              {session.value?.authenticated ? (
                <button className="gov-btn bg-[var(--kr-gov-blue)] px-4 py-2 text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => void session.logout()}>{en ? "Logout" : "로그아웃"}</button>
              ) : (
                <a className="gov-btn border border-[var(--kr-gov-blue)] px-4 py-2 text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Login" : "로그인"}</a>
              )}
            </div>
          </div>
        </header>
        <main id="main-content">
          <section className="bg-slate-950 text-white" data-help-id="certificate-report-form-hero">
            <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
              <nav aria-label="Breadcrumb" className="mb-6 flex text-sm text-slate-300">
                <ol className="flex items-center gap-2">
                  <li><a className="hover:text-white" href={buildLocalizedPath("/home", "/en/home")}>{content.breadcrumbHome}</a></li>
                  <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                  <li><a className="hover:text-white" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{content.breadcrumbSection}</a></li>
                  <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                  <li className="font-bold text-white">{content.breadcrumbCurrent}</li>
                </ol>
              </nav>
              <div className="grid gap-8 xl:grid-cols-[1.45fr,0.9fr] xl:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-sky-200">
                    <span className="material-symbols-outlined text-base">draft_orders</span>
                    {content.draftSaved}
                  </div>
                  <h2 className="text-4xl font-black leading-tight">{content.heroTitle}</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{content.heroBody}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a className="gov-btn bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-500" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{content.primaryCta}</a>
                    <a className="gov-btn border border-white/20 bg-white/10 px-5 py-3 text-white hover:bg-white/15" href={buildLocalizedPath("/admin/certificate/review", "/en/admin/certificate/review")}>{content.secondaryCta}</a>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: en ? "Completion" : "작성 진척", value: `${completedPercent}%`, tone: "text-sky-300" },
                    { label: en ? "Estimated CO2e" : "예상 CO2e", value: `${estimatedEmission} t`, tone: "text-emerald-300" },
                    { label: en ? "Draft Stage" : "현재 단계", value: "2 / 4", tone: "text-orange-300" },
                    { label: en ? "Review Queue" : "검토 큐", value: en ? "Internal" : "내부 검토", tone: "text-rose-300" }
                  ].map((item) => (
                    <article className="rounded-3xl border border-white/10 bg-white/5 p-5" key={item.label}>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                      <p className={`mt-3 text-3xl font-black ${item.tone}`}>{item.value}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-help-id="certificate-report-form-steps">
            <div className="gov-card px-6 py-7">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">{en ? "Draft Workflow" : "보고서 작성 단계"}</h3>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)]">{content.completionLabel}</span>
              </div>
              <div className="relative grid gap-6 md:grid-cols-4">
                <div className="absolute left-0 top-5 hidden h-0.5 w-full bg-slate-200 md:block" />
                {content.steps.map((step) => (
                  <div className={`step-item relative z-10 flex flex-col items-center gap-3 text-center ${step.state}`} key={step.label}>
                    <div className="step-circle flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 bg-white font-black text-slate-500">
                      {step.icon ? <span className="material-symbols-outlined text-lg">{step.icon}</span> : step.value}
                    </div>
                    <span className={`text-sm font-bold ${step.state === "upcoming" ? "text-slate-400" : step.state === "completed" ? "text-emerald-600" : "text-[var(--kr-gov-blue)]"}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 lg:grid-cols-[minmax(0,2fr),360px] lg:px-8">
            <div className="space-y-8">
              <article className="gov-card p-7" data-help-id="certificate-report-form-basic">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <span className="h-6 w-1.5 rounded-full bg-[var(--kr-gov-blue)]" />
                  {content.basicTitle}
                </h3>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <label>
                    <span className="gov-label required-mark">{content.reportTypeLabel}</span>
                    <select className="gov-input" value={reportType} onChange={(event) => setReportType(event.target.value)}>
                      {content.reportTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="gov-label required-mark">{content.assigneeLabel}</span>
                    <input className="gov-input" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
                  </label>
                  <label className="md:col-span-2">
                    <span className="gov-label required-mark">{content.titleLabel}</span>
                    <input className="gov-input" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </label>
                  <label>
                    <span className="gov-label required-mark">{content.companyLabel}</span>
                    <input className="gov-input" value={company} onChange={(event) => setCompany(event.target.value)} />
                  </label>
                  <label>
                    <span className="gov-label required-mark">{content.siteLabel}</span>
                    <input className="gov-input" value={site} onChange={(event) => setSite(event.target.value)} />
                  </label>
                </div>
              </article>
              <article className="gov-card p-7" data-help-id="certificate-report-form-scope1">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <span className="h-6 w-1.5 rounded-full bg-[var(--kr-gov-blue)]" />
                  {content.scope1Title}
                </h3>
                <div className="mt-6 space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <label>
                      <span className="gov-label required-mark">{content.facilityLabel}</span>
                      <select className="gov-input" value={facility} onChange={(event) => setFacility(event.target.value)}>
                        {content.facilities.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{content.facilityHelp}</p>
                    </label>
                    <div>
                      <span className="gov-label required-mark">{content.periodLabel}</span>
                      <div className="flex items-center gap-2">
                        <input className="gov-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                        <span className="text-slate-400">~</span>
                        <input className="gov-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-[var(--kr-gov-border-light)] pt-6">
                    <span className="gov-label required-mark">{content.fuelUsageLabel}</span>
                    <div className="flex gap-2">
                      <input className="gov-input text-right" type="number" step="0.01" value={fuelUsage} onChange={(event) => setFuelUsage(event.target.value)} />
                      <span className="flex items-center rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-100 px-4 text-sm font-bold">{content.fuelUnit}</span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50 p-4 text-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[var(--kr-gov-text-secondary)]">{content.calculationLabel}</span>
                        <span className="font-black text-[var(--kr-gov-blue)]">{estimatedEmission} tCO2e</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--kr-gov-text-secondary)]">{content.factorLabel}</span>
                        <span className="text-xs">{content.factorValue}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="gov-card p-7" data-help-id="certificate-report-form-scope2">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <span className="h-6 w-1.5 rounded-full bg-[var(--kr-gov-blue)]" />
                  {content.scope2Title}
                </h3>
                <div className="mt-6 space-y-6">
                  <div>
                    <span className="gov-label required-mark">{content.electricityUsageLabel}</span>
                    <div className="flex gap-2">
                      <input className="gov-input text-right" type="number" step="0.01" value={electricityUsage} onChange={(event) => setElectricityUsage(event.target.value)} />
                      <span className="flex items-center rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-100 px-4 text-sm font-bold">{content.electricityUnit}</span>
                    </div>
                  </div>
                  <div>
                    <span className="gov-label">{content.docUploadLabel}</span>
                    <div className="rounded-2xl border-2 border-dashed border-[var(--kr-gov-border-light)] bg-slate-50 p-8 text-center transition-colors hover:bg-white">
                      <span className="material-symbols-outlined text-4xl text-slate-300">upload_file</span>
                      <p className="mt-3 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.uploadTitle}</p>
                      <p className="mt-1 text-xs text-slate-400">{content.uploadHint}</p>
                    </div>
                  </div>
                </div>
              </article>
              <div className="gov-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-help-id="certificate-report-form-actions">
                <button className="gov-btn border border-[var(--kr-gov-border-light)] bg-white px-5 py-3 text-[var(--kr-gov-text-secondary)] hover:bg-slate-50" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list"))}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  {content.previousStep}
                </button>
                <div className="flex flex-wrap gap-3">
                  <button className="gov-btn border border-[var(--kr-gov-blue)] bg-white px-5 py-3 text-[var(--kr-gov-blue)] hover:bg-blue-50" type="button">{content.saveDraft}</button>
                  <button className="gov-btn bg-[var(--kr-gov-blue)] px-5 py-3 text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_edit", "/en/certificate/report_edit"))}>
                    {content.nextStep}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
            <aside className="space-y-6" data-help-id="certificate-report-form-guide">
              <section className="gov-card sticky top-24 p-6">
                <h4 className="flex items-center gap-2 text-lg font-black">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">lightbulb</span>
                  {content.guideTitle}
                </h4>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm font-bold">{content.guideStrong}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--kr-gov-text-secondary)]">{content.guideBody}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="flex items-center gap-1 text-xs font-bold text-amber-800">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      {content.cautionTitle}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-amber-900">{content.cautionBody}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold">{content.supportTitle}</p>
                    <p className="mt-2 text-xs leading-6 text-[var(--kr-gov-text-secondary)]">{content.supportBody}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{en ? "Auto status" : "자동 상태"}</p>
                    <p className="mt-2 text-lg font-black">{content.calculationStatus}</p>
                    <p className="mt-1 text-xs text-slate-300">{facility}</p>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        </main>
        <UserPortalFooter
          orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
          addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
          serviceLine={en ? "Document drafting support desk for reports and certificates." : "보고서 및 인증서 문서 작성 지원 데스크를 운영합니다."}
          footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"]}
          copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
          lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
          waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}

export default CertificateReportFormMigrationPage;
