import { useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput, HomeRadio, HomeSelect, HomeTextarea } from "../home-ui/common";

type StepState = "complete" | "active" | "pending";

type StepItem = {
  label: string;
  labelEn: string;
  state: StepState;
  value: string;
};

type CourseOption = {
  id: string;
  badge: string;
  badgeEn: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  status: string;
  statusEn: string;
  duration: string;
  durationEn: string;
};

type SessionOption = {
  id: string;
  label: string;
  labelEn: string;
  schedule: string;
  scheduleEn: string;
};

const STEPS: StepItem[] = [
  { value: "01", label: "과정 선택", labelEn: "Course", state: "complete" },
  { value: "02", label: "신청 정보", labelEn: "Applicant", state: "active" },
  { value: "03", label: "검토 및 확정", labelEn: "Review", state: "pending" },
  { value: "04", label: "접수 완료", labelEn: "Complete", state: "pending" }
];

const COURSES: CourseOption[] = [
  {
    id: "edu-course-1",
    badge: "정원 임박",
    badgeEn: "Almost Full",
    title: "탄소배출권 거래 실무 심화",
    titleEn: "Advanced Carbon Credit Trading Practice",
    summary: "배출권 거래 구조, 가격 전략, 정산 프로세스를 사례 중심으로 학습합니다.",
    summaryEn: "Learn trading structure, pricing strategy, and settlement flow through practical cases.",
    status: "승인 후 즉시 확정",
    statusEn: "Confirmed after approval",
    duration: "3일 집합 교육",
    durationEn: "3-day onsite program"
  },
  {
    id: "edu-course-2",
    badge: "기관 추천",
    badgeEn: "Recommended",
    title: "CCUS 플랜트 운영과 안전관리",
    titleEn: "CCUS Plant Operations and Safety",
    summary: "현장 운영 리스크, 안전 점검 절차, 설비 이상 징후 대응을 다룹니다.",
    summaryEn: "Covers operating risks, safety inspections, and abnormal facility response.",
    status: "사전 서류 검토 필요",
    statusEn: "Pre-screening required",
    duration: "2일 혼합형 교육",
    durationEn: "2-day blended program"
  },
  {
    id: "edu-course-3",
    badge: "온라인 병행",
    badgeEn: "Hybrid",
    title: "에너지 데이터 기반 공정 진단",
    titleEn: "Process Diagnostics with Energy Data",
    summary: "설비 데이터 분석과 공정 개선 과제를 실습형으로 구성한 과정입니다.",
    summaryEn: "A hands-on course on equipment data analysis and process optimization.",
    status: "부서장 승인 필요",
    statusEn: "Manager approval needed",
    duration: "4주 온라인+워크숍",
    durationEn: "4-week online + workshop"
  }
];

const SESSIONS: SessionOption[] = [
  {
    id: "session-1",
    label: "2026년 4월 3주차",
    labelEn: "Week 3 of April 2026",
    schedule: "2026.04.21 - 2026.04.23 / 서울 교육장",
    scheduleEn: "Apr 21, 2026 - Apr 23, 2026 / Seoul Center"
  },
  {
    id: "session-2",
    label: "2026년 5월 1주차",
    labelEn: "Week 1 of May 2026",
    schedule: "2026.05.07 - 2026.05.09 / 대전 교육장",
    scheduleEn: "May 7, 2026 - May 9, 2026 / Daejeon Center"
  }
];

function stepClassName(state: StepState) {
  if (state === "complete") {
    return "border-emerald-500 bg-emerald-500 text-white";
  }
  if (state === "active") {
    return "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white shadow-lg ring-4 ring-blue-100";
  }
  return "border-slate-200 bg-white text-slate-400";
}

export function EduApplyMigrationPage() {
  const en = isEnglish();
  const [selectedCourseId, setSelectedCourseId] = useState(COURSES[0]?.id ?? "");
  const [selectedSessionId, setSelectedSessionId] = useState(SESSIONS[0]?.id ?? "");
  const [deliveryMode, setDeliveryMode] = useState("offline");
  const selectedCourse = COURSES.find((course) => course.id === selectedCourseId) ?? COURSES[0];
  const selectedSession = SESSIONS.find((session) => session.id === selectedSessionId) ?? SESSIONS[0];
  const applyPath = buildLocalizedPath("/edu/apply", "/en/edu/apply");
  const listPath = buildLocalizedPath("/edu/course_list", "/en/edu/course_list");

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "Professional training request workflow for carbon-neutrality specialists." : "대한민국 정부 공식 서비스 | 실무자 역량 강화 포털",
    brandTitle: en ? "Carbon Neutrality Training Center" : "탄소중립 교육센터",
    brandSubtitle: "Professional Training Hub",
    portalNote: en ? "Application workflow for role-based training programs" : "직무 맞춤형 교육과정 신청 워크플로우",
    navCatalog: en ? "Course Catalog" : "교육과정 목록",
    navApply: en ? "Apply" : "교육 신청",
    navSupport: en ? "Support Desk" : "학습지원",
    heroBadge: en ? "Priority review within 2 business days" : "영업일 기준 2일 내 우선 검토",
    heroTitle: en ? "Training Application Workflow" : "교육 신청 워크플로우",
    heroSummary: en ? "Finalize the course, select a session, and submit the applicant profile for approval in one guided flow." : "신청 대상 과정 확정, 회차 선택, 신청자 정보 입력을 한 번에 완료하는 가이드형 접수 화면입니다.",
    statusLabel: en ? "Application status" : "신청 상태",
    statusValue: en ? "Draft in progress" : "임시저장 진행 중",
    deadlineLabel: en ? "Deadline" : "접수 마감",
    deadlineValue: en ? "April 18, 2026 18:00" : "2026.04.18 18:00",
    stepsTitle: en ? "Current step" : "현재 진행 단계",
    stepCounter: en ? "Step 2 of 4" : "총 4단계 중 2단계",
    courseSectionTitle: en ? "Select a course" : "신청 과정 선택",
    courseSectionBody: en ? "Choose one priority course from the recommended list. The application summary updates immediately." : "추천 과정 중 우선 신청할 1개 과정을 선택하면 우측 신청 요약이 즉시 갱신됩니다.",
    formSectionTitle: en ? "Applicant information" : "신청자 정보",
    formSectionBody: en ? "Provide the current owner, organization, contact details, and the preferred delivery mode." : "현재 신청 책임자, 소속, 연락처, 수강 방식을 입력합니다.",
    applicantName: en ? "Applicant name" : "신청자명",
    applicantOrg: en ? "Organization / Department" : "소속 기관 / 부서",
    contactNumber: en ? "Contact number" : "연락처",
    sessionLabel: en ? "Session" : "희망 회차",
    deliveryLabel: en ? "Delivery mode" : "수강 방식",
    deliveryOffline: en ? "Onsite" : "집합교육",
    deliveryOnline: en ? "Online + onsite" : "온라인 병행",
    requestLabel: en ? "Notes for the operator" : "운영팀 전달사항",
    requestPlaceholder: en ? "Add approval notes, prerequisites, or equipment constraints." : "사전 승인 메모, 준비 장비, 일정 제약이 있으면 입력하세요.",
    sidebarTitle: en ? "Application summary" : "신청 요약",
    sidebarBody: en ? "Review the selected session, learning format, and operating guidance before submission." : "선택한 회차, 교육 방식, 운영 안내를 최종 제출 전에 다시 확인합니다.",
    scheduleLabel: en ? "Selected session" : "선택 회차",
    supportTitle: en ? "Operator guidance" : "운영 안내",
    supportItems: en
      ? [
          "Manager approval is reflected at 09:00 and 15:00 each business day.",
          "Training materials are released one day before the session.",
          "Onsite courses require an ID check at the front desk."
        ]
      : [
          "부서장 승인 건은 영업일 09:00, 15:00 배치로 반영됩니다.",
          "교육 자료는 회차 시작 하루 전에 학습함으로 배포됩니다.",
          "집합교육은 교육장 입실 시 신분 확인이 진행됩니다."
        ],
    supportWindow: en ? "Support desk: Weekdays 09:00-18:00 / 1588-1234" : "학습지원센터: 평일 09:00-18:00 / 1588-1234",
    cancelLabel: en ? "Back to catalog" : "목록으로 돌아가기",
    draftLabel: en ? "Save draft" : "임시저장",
    submitLabel: en ? "Submit application" : "신청서 제출",
    footerOrg: en ? "Edu Innovation Support Division" : "교육혁신지원단",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Help Desk: 1588-1234" : "(04551) 서울특별시 중구 세종대로 110 | 학습지원센터 1588-1234",
    footerServiceLine: en ? "This platform supports the training of carbon-neutrality specialists across public and industrial sectors." : "본 플랫폼은 공공과 산업 현장의 탄소중립 전문인력 양성을 지원합니다.",
    footerLinks: en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"],
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f3f7fb_0%,#f8fafc_18%,#ffffff_100%)] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-focus" as string]: "#005fde",
        ["--kr-gov-bg-gray" as string]: "#f2f5f8",
        ["--kr-gov-radius" as string]: "10px",
        ["--kr-gov-green" as string]: "#0f9f6e"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <nav className="hidden lg:flex items-center gap-2 text-sm font-bold">
              <a className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={listPath}>{copy.navCatalog}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={applyPath}>{copy.navApply}</a>
              <a className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href="#support-guide">{copy.navSupport}</a>
            </nav>
            <div className="hidden xl:flex items-center rounded-full border border-sky-100 bg-white px-4 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)] shadow-sm">
              {copy.portalNote}
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/apply")} onEn={() => navigate("/en/edu/apply")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="border-b border-[var(--kr-gov-border-light)] bg-white" data-help-id="edu-apply-hero">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-[var(--kr-gov-blue)]">
                <span className="material-symbols-outlined text-[18px]">fact_check</span>
                {copy.heroBadge}
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-900">{copy.heroTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--kr-gov-text-secondary)]">{copy.heroSummary}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#eef4ff)] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{copy.statusLabel}</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{copy.statusValue}</p>
              </article>
              <article className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#fcfcfd,#f4f7fa)] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{copy.deadlineLabel}</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{copy.deadlineValue}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-help-id="edu-apply-steps">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.stepsTitle}</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{copy.stepCounter}</h3>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {STEPS.map((step) => (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-5" key={step.value}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black ${stepClassName(step.state)}`}>
                    {step.state === "complete" ? <span className="material-symbols-outlined text-[18px]">check</span> : step.value}
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-900">{en ? step.labelEn : step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-help-id="edu-apply-courses">
                <h3 className="text-2xl font-black text-slate-900">{copy.courseSectionTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{copy.courseSectionBody}</p>
                <div className="mt-6 grid gap-4">
                  {COURSES.map((course) => {
                    const active = course.id === selectedCourseId;
                    return (
                      <label className={`block cursor-pointer rounded-[20px] border p-5 transition ${active ? "border-[var(--kr-gov-blue)] bg-blue-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`} key={course.id}>
                        <div className="flex items-start gap-4">
                          <HomeRadio checked={active} className="mt-1" name="selected-course" onChange={() => setSelectedCourseId(course.id)} />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{en ? course.badgeEn : course.badge}</span>
                              <span className="text-xs font-bold text-[var(--kr-gov-blue)]">{en ? course.statusEn : course.status}</span>
                            </div>
                            <h4 className="mt-3 text-xl font-black text-slate-900">{en ? course.titleEn : course.title}</h4>
                            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? course.summaryEn : course.summary}</p>
                            <p className="mt-4 text-sm font-bold text-slate-700">{en ? course.durationEn : course.duration}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-help-id="edu-apply-form">
                <h3 className="text-2xl font-black text-slate-900">{copy.formSectionTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{copy.formSectionBody}</p>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-900">{copy.applicantName}</span>
                    <HomeInput defaultValue={en ? "Mina Kim" : "김민아"} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-900">{copy.applicantOrg}</span>
                    <HomeInput defaultValue={en ? "Carbon Strategy Team / Policy Cell" : "탄소전략팀 / 정책기획파트"} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-900">{copy.contactNumber}</span>
                    <HomeInput defaultValue="+82-10-2456-8801" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-900">{copy.sessionLabel}</span>
                    <HomeSelect onChange={(event) => setSelectedSessionId(event.target.value)} value={selectedSessionId}>
                      {SESSIONS.map((session) => (
                        <option key={session.id} value={session.id}>{en ? session.labelEn : session.label}</option>
                      ))}
                    </HomeSelect>
                  </label>
                </div>
                <div className="mt-5">
                  <span className="mb-3 block text-sm font-bold text-slate-900">{copy.deliveryLabel}</span>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 ${deliveryMode === "offline" ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-slate-200 bg-white"}`}>
                      <HomeRadio checked={deliveryMode === "offline"} name="delivery-mode" onChange={() => setDeliveryMode("offline")} />
                      <span className="text-sm font-bold text-slate-900">{copy.deliveryOffline}</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 ${deliveryMode === "hybrid" ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-slate-200 bg-white"}`}>
                      <HomeRadio checked={deliveryMode === "hybrid"} name="delivery-mode" onChange={() => setDeliveryMode("hybrid")} />
                      <span className="text-sm font-bold text-slate-900">{copy.deliveryOnline}</span>
                    </label>
                  </div>
                </div>
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold text-slate-900">{copy.requestLabel}</span>
                  <HomeTextarea className="min-h-[140px]" defaultValue="" placeholder={copy.requestPlaceholder} />
                </label>
              </section>
            </div>

            <aside className="space-y-6" data-help-id="edu-apply-sidebar">
              <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#eef4ff)] p-6 shadow-sm">
                <h3 className="text-2xl font-black text-slate-900">{copy.sidebarTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{copy.sidebarBody}</p>
                <div className="mt-6 rounded-[20px] bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.scheduleLabel}</p>
                  <h4 className="mt-3 text-xl font-black text-slate-900">{en ? selectedCourse.titleEn : selectedCourse.title}</h4>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-blue)]">{en ? selectedSession.labelEn : selectedSession.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? selectedSession.scheduleEn : selectedSession.schedule}</p>
                  <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-500">{en ? "Format" : "교육 방식"}</span>
                      <span className="font-bold text-slate-900">{deliveryMode === "offline" ? copy.deliveryOffline : copy.deliveryOnline}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-500">{en ? "Duration" : "교육 기간"}</span>
                      <span className="font-bold text-slate-900">{en ? selectedCourse.durationEn : selectedCourse.duration}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" id="support-guide">
                <h3 className="text-xl font-black text-slate-900">{copy.supportTitle}</h3>
                <div className="mt-4 space-y-3">
                  {copy.supportItems.map((item) => (
                    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4" key={item}>
                      <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">check_circle</span>
                      <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm font-bold text-slate-700">{copy.supportWindow}</p>
              </section>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-8" data-help-id="edu-apply-actions">
          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:justify-end">
            <HomeButton onClick={() => navigate(listPath)} variant="secondary">{copy.cancelLabel}</HomeButton>
            <HomeButton variant="info">{copy.draftLabel}</HomeButton>
            <HomeButton variant="primary">{copy.submitLabel}</HomeButton>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="COPYRIGHT (C) 2026 CARBONET. ALL RIGHTS RESERVED."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerServiceLine}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
