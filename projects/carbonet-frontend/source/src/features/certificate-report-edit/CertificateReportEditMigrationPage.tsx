import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type StepState = "completed" | "active" | "upcoming";

type StepItem = {
  label: string;
  value: string;
  state: StepState;
  icon?: string;
};

type TimelineItem = {
  badge: string;
  title: string;
  description: string;
  tone: "critical" | "warning" | "neutral";
};

type IssueItem = {
  category: string;
  title: string;
  body: string;
  dueLabel: string;
  tone: "critical" | "warning" | "info";
};

type ChecklistItem = {
  id: string;
  label: string;
};

type LocalizedEditContent = {
  pageTitle: string;
  pageSubtitle: string;
  heroBadge: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  breadcrumbHome: string;
  breadcrumbSection: string;
  breadcrumbCurrent: string;
  currentStatus: string;
  deadlineLabel: string;
  completionLabel: string;
  timelineTitle: string;
  timelineSubtitle: string;
  issueSectionTitle: string;
  issueSectionBody: string;
  contextTitle: string;
  correctionsTitle: string;
  revalidationTitle: string;
  documentIdLabel: string;
  reportTypeLabel: string;
  companyLabel: string;
  siteLabel: string;
  assigneeLabel: string;
  revisionReasonLabel: string;
  periodLabel: string;
  evidenceStatusLabel: string;
  fuelUsageLabel: string;
  electricityUsageLabel: string;
  fuelUnit: string;
  electricityUnit: string;
  estimatedEmissionLabel: string;
  deltaEmissionLabel: string;
  uploadTitle: string;
  uploadHint: string;
  checklistTitle: string;
  checklistSummary: string;
  previousStep: string;
  saveAction: string;
  validateAction: string;
  submitAction: string;
  issuePriorityLabel: string;
  timelineItems: TimelineItem[];
  issueItems: IssueItem[];
  steps: StepItem[];
  checklist: ChecklistItem[];
};

const EDIT_CONTENT: Record<"ko" | "en", LocalizedEditContent> = {
  ko: {
    pageTitle: "보고서 수정 및 재검증",
    pageSubtitle: "보완 요청 대응, 수치 보정, 재제출 준비를 하나의 작업면에서 처리합니다.",
    heroBadge: "Revision & Revalidation Desk",
    heroTitle: "검토 의견을 빠르게 반영하고 재검증 제출까지 끊김 없이 이어갑니다.",
    heroBody: "수정 요청 사유, 현재 일정, 남은 보완 이슈, 증빙 재업로드 상태를 같은 화면에서 확인해 재제출 누락을 줄입니다.",
    primaryCta: "문서 목록으로",
    secondaryCta: "검토 큐 보기",
    breadcrumbHome: "홈",
    breadcrumbSection: "보고서 및 인증서",
    breadcrumbCurrent: "보고서 수정",
    currentStatus: "수정 요청",
    deadlineLabel: "재제출 마감 D-2",
    completionLabel: "재검증 준비율",
    timelineTitle: "주요 일정 및 보완 마감",
    timelineSubtitle: "오늘 마감과 후속 재검토 일정을 우선 확인하십시오.",
    issueSectionTitle: "보완 이슈 카드",
    issueSectionBody: "검토 의견별 우선순위를 보고 각 항목을 수정한 뒤 재검증 체크리스트를 마무리합니다.",
    contextTitle: "선택 보고서 컨텍스트",
    correctionsTitle: "수치 보정 및 응답 메모",
    revalidationTitle: "재검증 준비",
    documentIdLabel: "문서 번호",
    reportTypeLabel: "문서 유형",
    companyLabel: "회원사",
    siteLabel: "배출지",
    assigneeLabel: "수정 담당자",
    revisionReasonLabel: "보완 요청 사유",
    periodLabel: "측정 기간",
    evidenceStatusLabel: "증빙 상태",
    fuelUsageLabel: "연료 사용량 보정",
    electricityUsageLabel: "전력 사용량 보정",
    fuelUnit: "Nm³",
    electricityUnit: "MWh",
    estimatedEmissionLabel: "수정 후 예상 CO2e",
    deltaEmissionLabel: "기존 대비 변동",
    uploadTitle: "수정 증빙 파일을 업로드하거나 끌어다 놓으십시오.",
    uploadHint: "PDF, XLSX, JPG, PNG (최대 10MB)",
    checklistTitle: "재검증 체크리스트",
    checklistSummary: "4개 항목 중 완료된 조건을 표시해 최종 제출 가능 여부를 확인합니다.",
    previousStep: "이전 단계",
    saveAction: "수정 저장",
    validateAction: "재검증 요청",
    submitAction: "수정본 제출",
    issuePriorityLabel: "우선 보완",
    timelineItems: [
      { badge: "오늘 마감", title: "울산 제3: 연료 소비 증빙 재업로드", description: "검증관 최종 검토 전에 8월분 세금계산서와 계량 로그를 다시 첨부해야 합니다.", tone: "critical" },
      { badge: "D-1", title: "내부 검토자 회신", description: "재산정 수치와 보정 사유 메모를 운영 검토자에게 공유합니다.", tone: "warning" },
      { badge: "4월 5일", title: "재검증 결과 회신 예정", description: "승인 또는 추가 보완 여부가 시스템 알림과 메일로 전달됩니다.", tone: "neutral" }
    ],
    issueItems: [
      { category: "연료 데이터", title: "8월분 LNG 사용량 증빙 누락", body: "검토 의견: 세금계산서 합계와 입력 수치 간 차이가 있어 원본 증빙과 계량기 사진을 함께 제출해야 합니다.", dueLabel: "즉시", tone: "critical" },
      { category: "배출 계수", title: "국가표준 계수 갱신 반영 필요", body: "검토 의견: 직전 초안에 2025 기준 계수가 적용되어 2026 표준 계수로 재산정이 필요합니다.", dueLabel: "오늘", tone: "warning" },
      { category: "메모 보완", title: "인증 연계 사유 추가", body: "검토 의견: 이번 수정본이 갱신 심사와 함께 제출되는 배경과 내부 검토자 확인 내역을 메모에 남겨야 합니다.", dueLabel: "D-1", tone: "info" }
    ],
    steps: [
      { label: "초안 작성", value: "1", state: "completed", icon: "check" },
      { label: "보완 요청 확인", value: "2", state: "completed", icon: "check" },
      { label: "수정 및 재검증 준비", value: "3", state: "active" },
      { label: "수정본 제출", value: "4", state: "upcoming" }
    ],
    checklist: [
      { id: "evidence", label: "누락 증빙 파일 재업로드 완료" },
      { id: "factor", label: "최신 배출 계수로 재산정 완료" },
      { id: "memo", label: "검토 의견 응답 메모 작성 완료" },
      { id: "reviewer", label: "내부 검토자 사전 확인 완료" }
    ]
  },
  en: {
    pageTitle: "Report Revision and Revalidation",
    pageSubtitle: "Handle supplement requests, metric corrections, and resubmission readiness in one workspace.",
    heroBadge: "Revision & Revalidation Desk",
    heroTitle: "Respond to reviewer feedback quickly and move straight into revalidation submission.",
    heroBody: "Review reasons, deadline pressure, outstanding issues, and evidence re-upload status remain visible together so the revised submission does not stall.",
    primaryCta: "Back to portfolio",
    secondaryCta: "Open review queue",
    breadcrumbHome: "Home",
    breadcrumbSection: "Reports & Certificates",
    breadcrumbCurrent: "Report Revision",
    currentStatus: "Revision Requested",
    deadlineLabel: "Resubmission D-2",
    completionLabel: "Revalidation Readiness",
    timelineTitle: "Key Deadlines and Follow-ups",
    timelineSubtitle: "Prioritize items due today and the next review checkpoints.",
    issueSectionTitle: "Issue Cards",
    issueSectionBody: "Work through reviewer comments by priority, then finish the revalidation checklist before submission.",
    contextTitle: "Selected Report Context",
    correctionsTitle: "Corrections and Response Notes",
    revalidationTitle: "Revalidation Preparation",
    documentIdLabel: "Document ID",
    reportTypeLabel: "Document Type",
    companyLabel: "Company",
    siteLabel: "Site",
    assigneeLabel: "Revision Owner",
    revisionReasonLabel: "Supplement Reason",
    periodLabel: "Measurement Period",
    evidenceStatusLabel: "Evidence Status",
    fuelUsageLabel: "Corrected Fuel Usage",
    electricityUsageLabel: "Corrected Electricity Usage",
    fuelUnit: "Nm³",
    electricityUnit: "MWh",
    estimatedEmissionLabel: "Estimated CO2e After Revision",
    deltaEmissionLabel: "Delta vs Previous Draft",
    uploadTitle: "Upload revised evidence files or drop them here.",
    uploadHint: "PDF, XLSX, JPG, PNG (Max 10MB)",
    checklistTitle: "Revalidation Checklist",
    checklistSummary: "Mark completed conditions to confirm whether the revised report is ready for final submission.",
    previousStep: "Previous Step",
    saveAction: "Save Revision",
    validateAction: "Request Revalidation",
    submitAction: "Submit Revised Report",
    issuePriorityLabel: "Priority Fix",
    timelineItems: [
      { badge: "Due Today", title: "Ulsan Site 3: Re-upload Fuel Evidence", description: "The August invoice pack and meter logs must be attached again before final validator review.", tone: "critical" },
      { badge: "D-1", title: "Internal Reviewer Response", description: "Share recalculated values and the correction memo with the operations reviewer.", tone: "warning" },
      { badge: "Apr 5", title: "Revalidation Result Expected", description: "Approval or further supplement feedback will arrive by system alert and email.", tone: "neutral" }
    ],
    issueItems: [
      { category: "Fuel Data", title: "Missing evidence for August LNG usage", body: "Reviewer note: the submitted figure differs from the invoice total, so the original invoice and meter photo must be provided together.", dueLabel: "Immediate", tone: "critical" },
      { category: "Emission Factor", title: "Update to the latest national factor", body: "Reviewer note: the last draft still used the 2025 factor and must be recalculated with the 2026 standard factor.", dueLabel: "Today", tone: "warning" },
      { category: "Linked Memo", title: "Add certificate linkage rationale", body: "Reviewer note: explain why this revision is submitted with the renewal review and record the internal reviewer acknowledgement.", dueLabel: "D-1", tone: "info" }
    ],
    steps: [
      { label: "Draft Completed", value: "1", state: "completed", icon: "check" },
      { label: "Supplement Review", value: "2", state: "completed", icon: "check" },
      { label: "Correction and Revalidation", value: "3", state: "active" },
      { label: "Submit Revision", value: "4", state: "upcoming" }
    ],
    checklist: [
      { id: "evidence", label: "Missing evidence files re-uploaded" },
      { id: "factor", label: "Recalculation completed with latest factor" },
      { id: "memo", label: "Reviewer response memo completed" },
      { id: "reviewer", label: "Internal reviewer pre-check completed" }
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
      .gov-card { border: 1px solid var(--kr-gov-border-light); border-radius: 18px; background: white; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); }
      .gov-input { width: 100%; border: 1px solid var(--kr-gov-border-light); border-radius: 14px; padding: 12px 16px; background: white; outline: none; transition: box-shadow .2s ease, border-color .2s ease; }
      .gov-input:focus { border-color: var(--kr-gov-blue); box-shadow: 0 0 0 3px rgba(0, 55, 139, 0.12); }
      .gov-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; color: var(--kr-gov-text-primary); }
      .required-mark::after { content: '*'; color: #d32f2f; margin-left: 4px; }
      .step-item.active .step-circle { background: var(--kr-gov-blue); border-color: var(--kr-gov-blue); color: white; }
      .step-item.completed .step-circle { background: #10b981; border-color: #10b981; color: white; }
      .timeline-line::before { content: ''; position: absolute; left: 16px; top: 0; bottom: 0; width: 2px; background: #e2e8f0; }
    `}</style>
  );
}

function toneClasses(tone: IssueItem["tone"] | TimelineItem["tone"]) {
  if (tone === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function CertificateReportEditMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = EDIT_CONTENT[en ? "en" : "ko"];

  const [fuelUsage, setFuelUsage] = useState("132.80");
  const [electricityUsage, setElectricityUsage] = useState("19.70");
  const [revisionReason, setRevisionReason] = useState(
    en
      ? "Revised to match August LNG invoice totals and updated with the 2026 national emission factor."
      : "8월 LNG 세금계산서 합계와 일치하도록 수정하고 2026 국가표준 배출 계수를 반영했습니다."
  );
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({
    evidence: true,
    factor: true,
    memo: false,
    reviewer: false
  });

  const estimatedEmission = useMemo(() => {
    const fuel = Number.parseFloat(fuelUsage || "0");
    const electricity = Number.parseFloat(electricityUsage || "0");
    return (fuel * 2.1456 + electricity * 0.4594).toFixed(2);
  }, [electricityUsage, fuelUsage]);

  const previousEmission = 291.84;
  const emissionDelta = useMemo(() => {
    const current = Number.parseFloat(estimatedEmission || "0");
    const delta = current - previousEmission;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} tCO2e`;
  }, [estimatedEmission]);

  const checklistCompleted = useMemo(
    () => Object.values(checklistState).filter(Boolean).length,
    [checklistState]
  );
  const completionPercent = Math.round((checklistCompleted / content.checklist.length) * 100);

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-report-edit", {
      language: en ? "en" : "ko",
      estimatedEmission,
      checklistCompleted,
      completionPercent
    });
  }, [checklistCompleted, completionPercent, en, estimatedEmission]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Official revision workspace for report supplements and revalidation." : "대한민국 정부 공식 서비스 | 보고서 수정·재검증 워크스페이스"}
        />
        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <button className="flex items-center gap-3 bg-transparent p-0 text-left" type="button" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}>
              <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]">assignment_late</span>
              <div>
                <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.heroBadge}</p>
              </div>
            </button>
            <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/monitoring/track", "/en/monitoring/track")}>{en ? "Monitoring" : "배출지 모니터링"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_form", "/en/certificate/report_form")}>{en ? "Draft Form" : "보고서 작성"}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/certificate/report_edit", "/en/certificate/report_edit")}>{en ? "Revision Desk" : "보고서 수정"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{en ? "Portfolio" : "문서 목록"}</a>
            </nav>
            <div className="flex items-center gap-3">
              <UserLanguageToggle en={en} onKo={() => navigate("/certificate/report_edit")} onEn={() => navigate("/en/certificate/report_edit")} />
              {session.value?.authenticated ? (
                <button className="gov-btn bg-[var(--kr-gov-blue)] px-4 py-2 text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => void session.logout()}>{en ? "Logout" : "로그아웃"}</button>
              ) : (
                <a className="gov-btn border border-[var(--kr-gov-blue)] px-4 py-2 text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Login" : "로그인"}</a>
              )}
            </div>
          </div>
        </header>
        <main id="main-content">
          <section className="bg-slate-950 text-white" data-help-id="certificate-report-edit-hero">
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
              <div className="grid gap-8 xl:grid-cols-[1.4fr,0.9fr] xl:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-rose-200">
                    <span className="material-symbols-outlined text-base">assignment_late</span>
                    DOC-2026-002 | {content.currentStatus}
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
                    { label: en ? "Current Status" : "현재 상태", value: content.currentStatus, tone: "text-rose-300" },
                    { label: en ? "Deadline" : "재제출 기한", value: content.deadlineLabel, tone: "text-amber-300" },
                    { label: content.completionLabel, value: `${completionPercent}%`, tone: "text-emerald-300" },
                    { label: content.estimatedEmissionLabel, value: `${estimatedEmission} tCO2e`, tone: "text-sky-300" }
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

          <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-help-id="certificate-report-edit-steps">
            <div className="gov-card p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black">{en ? "Revision Steps" : "수정 단계"}</h3>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">{content.completionLabel} {completionPercent}%</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-4">
                {content.steps.map((step) => (
                  <div className={`step-item rounded-2xl border p-4 ${step.state === "active" ? "border-[var(--kr-gov-blue)] bg-blue-50/60" : "border-slate-200 bg-white"} ${step.state}`} key={step.label}>
                    <div className="flex items-center gap-3">
                      <div className="step-circle flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white font-black text-slate-600">
                        {step.icon ? <span className="material-symbols-outlined text-base">{step.icon}</span> : step.value}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{step.value}</p>
                        <p className="text-sm font-black text-slate-900">{step.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 lg:grid-cols-[320px,minmax(0,1fr)] lg:px-8">
            <aside className="space-y-6">
              <section className="gov-card sticky top-24 p-6" data-help-id="certificate-report-edit-timeline">
                <h3 className="flex items-center gap-2 text-lg font-black">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">event_note</span>
                  {content.timelineTitle}
                </h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{content.timelineSubtitle}</p>
                <div className="timeline-line relative mt-6 space-y-8 pl-10">
                  {content.timelineItems.map((item) => (
                    <div className="relative" key={item.title}>
                      <div className={`absolute -left-[25px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${item.tone === "critical" ? "bg-red-500" : item.tone === "warning" ? "bg-amber-400" : "bg-slate-300"}`} />
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClasses(item.tone)}`}>{item.badge}</span>
                      <h4 className="mt-3 text-sm font-black text-slate-900">{item.title}</h4>
                      <p className="mt-1 text-xs leading-6 text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <div className="space-y-6">
              <section className="gov-card p-6" data-help-id="certificate-report-edit-issues">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black">{content.issueSectionTitle}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.issueSectionBody}</p>
                  </div>
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{content.issuePriorityLabel}</span>
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {content.issueItems.map((issue) => (
                    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5" key={issue.title}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClasses(issue.tone)}`}>{issue.category}</span>
                        <span className="text-xs font-black text-slate-400">{issue.dueLabel}</span>
                      </div>
                      <h4 className="mt-4 text-base font-black text-slate-900">{issue.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{issue.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                <article className="gov-card p-7" data-help-id="certificate-report-edit-context">
                  <h3 className="text-lg font-black">{content.contextTitle}</h3>
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <div>
                      <span className="gov-label">{content.documentIdLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value="DOC-2026-002" />
                    </div>
                    <div>
                      <span className="gov-label">{content.reportTypeLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value={en ? "Certificate Renewal Attachment" : "인증서 갱신 첨부"} />
                    </div>
                    <div>
                      <span className="gov-label">{content.companyLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value={en ? "Ulsan Chemical Base 3" : "울산 제3 화학기지"} />
                    </div>
                    <div>
                      <span className="gov-label">{content.siteLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value={en ? "Chemical Cluster" : "화학 공정군"} />
                    </div>
                    <div>
                      <span className="gov-label">{content.assigneeLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value={en ? "Jung Audit" : "정심사"} />
                    </div>
                    <div>
                      <span className="gov-label">{content.periodLabel}</span>
                      <input className="gov-input bg-slate-50" readOnly value="2026-08-01 ~ 2026-08-31" />
                    </div>
                    <div className="md:col-span-2">
                      <span className="gov-label">{content.evidenceStatusLabel}</span>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                        {en ? "2 original files retained, 1 missing invoice pack must be uploaded again." : "기존 증빙 2건 유지, 누락된 세금계산서 묶음 1건 재업로드 필요"}
                      </div>
                    </div>
                  </div>
                </article>

                <article className="gov-card p-7" data-help-id="certificate-report-edit-corrections">
                  <h3 className="text-lg font-black">{content.correctionsTitle}</h3>
                  <div className="mt-6 space-y-5">
                    <div>
                      <span className="gov-label required-mark">{content.fuelUsageLabel}</span>
                      <div className="flex gap-2">
                        <input className="gov-input text-right" type="number" step="0.01" value={fuelUsage} onChange={(event) => setFuelUsage(event.target.value)} />
                        <span className="flex items-center rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-100 px-4 text-sm font-bold">{content.fuelUnit}</span>
                      </div>
                    </div>
                    <div>
                      <span className="gov-label required-mark">{content.electricityUsageLabel}</span>
                      <div className="flex gap-2">
                        <input className="gov-input text-right" type="number" step="0.01" value={electricityUsage} onChange={(event) => setElectricityUsage(event.target.value)} />
                        <span className="flex items-center rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-100 px-4 text-sm font-bold">{content.electricityUnit}</span>
                      </div>
                    </div>
                    <div>
                      <span className="gov-label required-mark">{content.revisionReasonLabel}</span>
                      <textarea className="gov-input min-h-[140px] resize-y leading-6" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{content.estimatedEmissionLabel}</p>
                        <p className="mt-3 text-3xl font-black text-sky-900">{estimatedEmission} tCO2e</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{content.deltaEmissionLabel}</p>
                        <p className="mt-3 text-3xl font-black text-emerald-900">{emissionDelta}</p>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <section className="gov-card p-7" data-help-id="certificate-report-edit-revalidation">
                <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                  <div>
                    <h3 className="text-lg font-black">{content.revalidationTitle}</h3>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{content.checklistSummary}</p>
                    <div className="mt-5 rounded-2xl border-2 border-dashed border-[var(--kr-gov-border-light)] bg-slate-50 p-8 text-center transition-colors hover:bg-white">
                      <span className="material-symbols-outlined text-4xl text-slate-300">upload_file</span>
                      <p className="mt-3 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.uploadTitle}</p>
                      <p className="mt-1 text-xs text-slate-400">{content.uploadHint}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-base font-black">{content.checklistTitle}</h4>
                      <span className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1 text-xs font-bold text-slate-600">{checklistCompleted}/{content.checklist.length}</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {content.checklist.map((item) => (
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4" key={item.id}>
                          <input
                            checked={Boolean(checklistState[item.id])}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--kr-gov-blue)] focus:ring-[var(--kr-gov-blue)]"
                            type="checkbox"
                            onChange={(event) => setChecklistState((current) => ({ ...current, [item.id]: event.target.checked }))}
                          />
                          <span className="text-sm font-medium leading-6 text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div className="gov-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-help-id="certificate-report-edit-actions">
                <button className="gov-btn border border-[var(--kr-gov-border-light)] bg-white px-5 py-3 text-[var(--kr-gov-text-secondary)] hover:bg-slate-50" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_form", "/en/certificate/report_form"))}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  {content.previousStep}
                </button>
                <div className="flex flex-wrap gap-3">
                  <button className="gov-btn border border-[var(--kr-gov-blue)] bg-white px-5 py-3 text-[var(--kr-gov-blue)] hover:bg-blue-50" type="button">{content.saveAction}</button>
                  <button className="gov-btn border border-emerald-200 bg-emerald-50 px-5 py-3 text-emerald-700 hover:bg-emerald-100" type="button">{content.validateAction}</button>
                  <button className="gov-btn bg-[var(--kr-gov-blue)] px-5 py-3 text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => navigate(buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list"))}>
                    {content.submitAction}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
        <UserPortalFooter
          orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
          addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
          serviceLine={en ? "Revision and revalidation support desk for reports and certificates." : "보고서 및 인증서 수정·재검증 지원 데스크를 운영합니다."}
          footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"]}
          copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
          lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
          waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}

export default CertificateReportEditMigrationPage;
