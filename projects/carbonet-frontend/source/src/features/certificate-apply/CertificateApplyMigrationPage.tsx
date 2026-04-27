import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type StepState = "complete" | "active" | "pending";

type StepItem = {
  label: string;
  state: StepState;
  value: string;
  icon?: string;
};

type SiteOption = {
  id: string;
  name: string;
  meta: string;
};

type ApplyContent = {
  pageTitle: string;
  pageSubtitle: string;
  heroBadge: string;
  heroHeading: string;
  heroBody: string;
  breadcrumbHome: string;
  breadcrumbSection: string;
  breadcrumbCurrent: string;
  wizardTitle: string;
  wizardBody: string;
  stepCounter: string;
  siteLabel: string;
  managerLabel: string;
  contactLabel: string;
  periodLabel: string;
  tipTitle: string;
  tipBodyPrefix: string;
  tipBodySuffix: string;
  previousStep: string;
  nextStep: string;
  draftLabel: string;
  cancelLabel: string;
  assistantTitle: string;
  assistantBody: string;
  assistantLink: string;
  steps: StepItem[];
  sites: SiteOption[];
  managerName: string;
  managerContact: string;
};

const APPLY_CONTENT: Record<"ko" | "en", ApplyContent> = {
  ko: {
    pageTitle: "인증서 신청",
    pageSubtitle: "Certificate Application Workspace",
    heroBadge: "임시저장 가능 (30일 보관)",
    heroHeading: "인증서 신청 가이드 워크플로우",
    heroBody: "정확한 배출 데이터 기반의 공식 탄소중립 인증서 발급을 위한 단계별 절차입니다.",
    breadcrumbHome: "홈",
    breadcrumbSection: "보고서 및 인증서",
    breadcrumbCurrent: "인증서 신청",
    wizardTitle: "Step 02. 시설 및 관리 주체 정보",
    wizardBody: "배출량 산정의 기준이 되는 시설 정보를 확정합니다.",
    stepCounter: "2 / 5",
    siteLabel: "대상 배출지 선택",
    managerLabel: "현장 책임자 성명",
    contactLabel: "비상 연락처",
    periodLabel: "인증 대상 기간",
    tipTitle: "지능형 입력 도우미의 팁",
    tipBodyPrefix: "선택하신",
    tipBodySuffix: "은 지난 분기 대비 배출량이 4.2% 감소했습니다. 감축 성과를 증빙할 수 있는 별도의 설비 개선 내역이 있다면 다음 단계에서 함께 제출해 주시기 바랍니다.",
    previousStep: "이전 단계",
    nextStep: "다음 단계: 서류 업로드",
    draftLabel: "신청서 임시저장",
    cancelLabel: "신청 취소",
    assistantTitle: "Update Assistant",
    assistantBody: "인증 신청 중 '울산 제3 화학기지'의 데이터 보완 요청이 감지되었습니다. 신청을 마치고 확인하시겠습니까?",
    assistantLink: "대기 중인 업데이트 큐 보기",
    steps: [
      { label: "유형 선택", state: "complete", value: "01", icon: "check" },
      { label: "시설 정보 입력", state: "active", value: "02" },
      { label: "증빙 서류 업로드", state: "pending", value: "03" },
      { label: "데이터 검토", state: "pending", value: "04" },
      { label: "신청 완료", state: "pending", value: "05" }
    ],
    sites: [
      { id: "PH-001", name: "포항 제1 열연공장", meta: "ID: PH-001 | 핵심 관리 배출지" },
      { id: "US-042", name: "울산 제3 화학기지", meta: "ID: US-042 | 누락 서류 존재" }
    ],
    managerName: "이현장",
    managerContact: "010-1234-5678"
  },
  en: {
    pageTitle: "Certificate Application",
    pageSubtitle: "Certificate Application Workspace",
    heroBadge: "Draft can be saved for 30 days",
    heroHeading: "Certificate Application Guided Workflow",
    heroBody: "A step-by-step process for issuing an official carbon neutrality certificate based on verified emission data.",
    breadcrumbHome: "Home",
    breadcrumbSection: "Reports & Certificates",
    breadcrumbCurrent: "Certificate Apply",
    wizardTitle: "Step 02. Facility and Responsible Owner",
    wizardBody: "Confirm the facility details that determine the baseline for certificate issuance.",
    stepCounter: "2 / 5",
    siteLabel: "Select target site",
    managerLabel: "Site manager name",
    contactLabel: "Emergency contact",
    periodLabel: "Certification period",
    tipTitle: "Intelligent assistant tip",
    tipBodyPrefix: "The selected site,",
    tipBodySuffix: ", recorded a 4.2% emission decrease from the previous quarter. If facility improvements support that reduction, attach those records in the next step.",
    previousStep: "Previous step",
    nextStep: "Next: Upload evidence",
    draftLabel: "Save draft application",
    cancelLabel: "Cancel application",
    assistantTitle: "Update Assistant",
    assistantBody: "A supplement request was detected for Ulsan Chemical Base 3 during certificate submission. Review it after finishing this step?",
    assistantLink: "Open pending update queue",
    steps: [
      { label: "Type Selection", state: "complete", value: "01", icon: "check" },
      { label: "Facility Details", state: "active", value: "02" },
      { label: "Upload Evidence", state: "pending", value: "03" },
      { label: "Review Data", state: "pending", value: "04" },
      { label: "Complete", state: "pending", value: "05" }
    ],
    sites: [
      { id: "PH-001", name: "Pohang Hot Rolling Mill 1", meta: "ID: PH-001 | Primary managed site" },
      { id: "US-042", name: "Ulsan Chemical Base 3", meta: "ID: US-042 | Missing evidence" }
    ],
    managerName: "Lee Supervisor",
    managerContact: "010-1234-5678"
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
        --kr-gov-radius: 6px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; background: var(--kr-gov-blue); color: white; padding: 12px; z-index: 100; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .gov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--kr-gov-radius); font-weight: 700; transition: background-color .2s ease, border-color .2s ease, color .2s ease; }
      .gov-btn-primary { background: var(--kr-gov-blue); color: white; }
      .gov-btn-primary:hover { background: var(--kr-gov-blue-hover); }
      .gov-btn-outline { border: 1px solid var(--kr-gov-border-light); background: white; color: var(--kr-gov-text-secondary); }
      .gov-btn-outline:hover { background: #f8fafc; }
      .form-input { width: 100%; border: 1px solid var(--kr-gov-border-light); border-radius: 10px; padding: 12px 16px; background: white; outline: none; transition: box-shadow .2s ease, border-color .2s ease; }
      .form-input:focus { border-color: var(--kr-gov-blue); box-shadow: 0 0 0 3px rgba(0, 55, 139, 0.12); }
      .form-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; color: var(--kr-gov-text-primary); }
      .wizard-step { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; text-align: center; }
      .wizard-line { position: absolute; top: 20px; left: 50%; width: 100%; height: 2px; background: #e5e7eb; z-index: 0; }
      .wizard-circle { position: relative; z-index: 1; display: flex; height: 40px; width: 40px; align-items: center; justify-content: center; border-radius: 9999px; border: 2px solid #d1d5db; background: white; color: #9ca3af; font-weight: 800; }
      .step-active .wizard-circle { border-color: var(--kr-gov-blue); background: var(--kr-gov-blue); color: white; }
      .step-complete .wizard-circle { border-color: var(--kr-gov-blue); color: var(--kr-gov-blue); }
    `}</style>
  );
}

function stepClassName(state: StepState) {
  if (state === "complete") return "step-complete";
  if (state === "active") return "step-active";
  return "step-pending";
}

export function CertificateApplyMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = APPLY_CONTENT[en ? "en" : "ko"];
  const [selectedSiteId, setSelectedSiteId] = useState(content.sites[0]?.id ?? "");
  const [managerName, setManagerName] = useState(content.managerName);
  const [managerContact, setManagerContact] = useState(content.managerContact);
  const [periodStart, setPeriodStart] = useState("2025-01-01");
  const [periodEnd, setPeriodEnd] = useState("2025-06-30");

  const selectedSite = useMemo(
    () => content.sites.find((site) => site.id === selectedSiteId) ?? content.sites[0],
    [content.sites, selectedSiteId]
  );

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-apply", {
      language: en ? "en" : "ko",
      selectedSiteId,
      managerName,
      periodStart,
      periodEnd
    });
  }, [en, managerName, periodEnd, periodStart, selectedSiteId]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Carbon certificate management system." : "대한민국 정부 공식 서비스 | 탄소발자국 관리 시스템"}
        />
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <button className="flex items-center gap-3 bg-transparent p-0 text-left" type="button" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}>
              <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]">verified</span>
              <div>
                <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
              </div>
            </button>
            <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/monitoring/track", "/en/monitoring/track")}>{en ? "Monitoring" : "배출지 모니터링"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/emission/data_input", "/en/emission/data_input")}>{en ? "Data Input" : "데이터 산정"}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/certificate/apply", "/en/certificate/apply")}>{en ? "Certificate Apply" : "인증서 신청"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/co2/analysis", "/en/co2/analysis")}>{en ? "Analytics" : "성과 분석"}</a>
            </nav>
            <div className="flex items-center gap-3">
              <UserLanguageToggle en={en} onKo={() => navigate("/certificate/apply")} onEn={() => navigate("/en/certificate/apply")} />
              {session.value?.authenticated ? (
                <button className="gov-btn gov-btn-primary px-4 py-2" type="button" onClick={() => void session.logout()}>{en ? "Logout" : "로그아웃"}</button>
              ) : (
                <a className="gov-btn border border-[var(--kr-gov-blue)] px-4 py-2 text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Login" : "로그인"}</a>
              )}
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="border-b border-slate-200 bg-white py-10" data-help-id="certificate-apply-hero">
            <div className="mx-auto max-w-4xl px-4 lg:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <nav aria-label="Breadcrumb" className="mb-2 flex text-sm text-slate-500">
                    <ol className="flex items-center gap-2">
                      <li><a className="hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/home", "/en/home")}>{content.breadcrumbHome}</a></li>
                      <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                      <li><a className="hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{content.breadcrumbSection}</a></li>
                      <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                      <li className="font-bold text-[var(--kr-gov-blue)]">{content.breadcrumbCurrent}</li>
                    </ol>
                  </nav>
                  <h2 className="text-3xl font-black">{content.heroHeading}</h2>
                  <p className="mt-2 text-sm text-slate-500">{content.heroBody}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2">
                  <span className="material-symbols-outlined text-[20px] text-blue-600">info</span>
                  <span className="text-xs font-bold text-blue-700">{content.heroBadge}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-4 py-10 lg:px-8" data-help-id="certificate-apply-steps">
            <div className="flex items-start justify-between gap-3">
              {content.steps.map((step, index) => (
                <div className={`wizard-step ${stepClassName(step.state)}`} key={step.label}>
                  {index < content.steps.length - 1 ? <div className="wizard-line" /> : null}
                  <div className="wizard-circle">
                    {step.icon ? <span className="material-symbols-outlined text-lg">{step.icon}</span> : step.value}
                  </div>
                  <span className={`mt-2 text-xs font-bold ${step.state === "pending" ? "text-slate-400" : step.state === "active" ? "text-[var(--kr-gov-text-primary)]" : "text-[var(--kr-gov-blue)]"}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-4 pb-24 lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]" data-help-id="certificate-apply-form">
              <div className="flex items-center justify-between bg-slate-950 px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white">
                    <span className="material-symbols-outlined">factory</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{content.wizardTitle}</h3>
                    <p className="text-xs text-indigo-300">{content.wizardBody}</p>
                  </div>
                </div>
                <span className="text-sm font-mono tracking-[0.32em] text-white/40">{content.stepCounter}</span>
              </div>

              <div className="space-y-8 p-8">
                <div data-help-id="certificate-apply-sites">
                  <label className="form-label">{content.siteLabel} <span className="text-red-500">*</span></label>
                  <div className="grid gap-4 md:grid-cols-2">
                    {content.sites.map((site) => {
                      const selected = site.id === selectedSiteId;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${selected ? "border-[var(--kr-gov-blue)] bg-blue-50/60" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}
                          key={site.id}
                          type="button"
                          onClick={() => setSelectedSiteId(site.id)}
                        >
                          <span className={`material-symbols-outlined ${selected ? "text-[var(--kr-gov-blue)]" : "text-slate-300"}`}>{selected ? "check_circle" : "radio_button_unchecked"}</span>
                          <div>
                            <p className={`text-sm font-bold ${selected ? "text-[var(--kr-gov-text-primary)]" : "text-slate-700"}`}>{site.name}</p>
                            <p className="text-[10px] text-slate-500">{site.meta}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2" data-help-id="certificate-apply-fields">
                  <label>
                    <span className="form-label">{content.managerLabel} <span className="text-red-500">*</span></span>
                    <input className="form-input" value={managerName} onChange={(event) => setManagerName(event.target.value)} />
                  </label>
                  <label>
                    <span className="form-label">{content.contactLabel} <span className="text-red-500">*</span></span>
                    <input className="form-input" type="tel" value={managerContact} onChange={(event) => setManagerContact(event.target.value)} />
                  </label>
                  <div className="md:col-span-2">
                    <span className="form-label">{content.periodLabel} <span className="text-red-500">*</span></span>
                    <div className="flex items-center gap-3">
                      <input className="form-input flex-1" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                      <span className="text-slate-400">~</span>
                      <input className="form-input flex-1" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-r-xl border-l-4 border-amber-400 bg-amber-50 p-5" data-help-id="certificate-apply-tip">
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-amber-600">lightbulb</span>
                    <div>
                      <h4 className="text-sm font-bold text-amber-800">{content.tipTitle}</h4>
                      <p className="mt-1 text-xs leading-6 text-amber-900">{content.tipBodyPrefix} <strong>'{selectedSite?.name}'</strong>{content.tipBodySuffix}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row" data-help-id="certificate-apply-actions">
                  <button className="gov-btn gov-btn-outline sm:w-1/3 px-5 py-3" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list"))}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    {content.previousStep}
                  </button>
                  <button className="gov-btn gov-btn-primary sm:w-2/3 px-5 py-3" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_form", "/en/certificate/report_form"))}>
                    {content.nextStep}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-6">
              <button className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-[var(--kr-gov-blue)]" type="button">
                <span className="material-symbols-outlined text-[16px]">save</span>
                {content.draftLabel}
              </button>
              <span className="text-slate-200">|</span>
              <button className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list"))}>
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                {content.cancelLabel}
              </button>
            </div>
          </section>

          <div className="fixed bottom-8 right-6 z-[60] hidden flex-col items-end gap-4 lg:flex" data-help-id="certificate-apply-assistant">
            <div className="w-72 rounded-3xl border border-indigo-100 bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <h4 className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">{content.assistantTitle}</h4>
              </div>
              <p className="mb-3 text-[11px] font-bold leading-5 text-slate-700">{content.assistantBody}</p>
              <a className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:underline" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>
                {content.assistantLink}
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
            <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--kr-gov-blue)] text-white shadow-2xl transition-colors hover:bg-[var(--kr-gov-blue-hover)]" type="button">
              <span className="material-symbols-outlined text-[32px]">smart_toy</span>
            </button>
          </div>
        </main>

        <UserPortalFooter
          orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
          addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
          serviceLine={en ? "Field support desk for guided certificate applications." : "인증서 신청 가이드 및 현장 지원 데스크를 운영합니다."}
          footerLinks={en ? ["Privacy Policy", "Terms of Use", "Certification Guideline"] : ["개인정보처리방침", "이용약관", "인증 가이드라인"]}
          copyright="© 2026 CCUS Carbon Footprint Platform. Guided Certification Portal."
          lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
          waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}

export default CertificateApplyMigrationPage;
