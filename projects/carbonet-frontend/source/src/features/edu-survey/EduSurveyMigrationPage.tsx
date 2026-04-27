import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type QuestionOption = {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
};

const OPTIONS: QuestionOption[] = [
  {
    id: "very-good",
    label: "매우 그렇다",
    labelEn: "Strongly agree",
    description: "실무 프로세스와 밀접하게 연결되어 즉시 적용할 수 있습니다.",
    descriptionEn: "Closely linked to real work so it can be applied immediately."
  },
  {
    id: "good",
    label: "그렇다",
    labelEn: "Agree",
    description: "전반적으로 실무 이해와 수행에 도움이 됩니다.",
    descriptionEn: "Helpful overall for understanding and performing the work."
  },
  {
    id: "neutral",
    label: "보통이다",
    labelEn: "Neutral",
    description: "기초 지식 습득에는 적절하지만 현장 적용성은 보통입니다.",
    descriptionEn: "Suitable for foundational learning, with moderate practical value."
  },
  {
    id: "not-good",
    label: "그렇지 않다",
    labelEn: "Disagree",
    description: "이론 중심이라 실제 업무에 적용하기에는 보완이 필요합니다.",
    descriptionEn: "Needs improvement because it feels too theory-heavy for practical use."
  }
];

const TIMELINE = {
  ko: [
    "오늘 14:00 라이브 질의응답 세션 참여",
    "금요일까지 최종 평가 응시",
    "다음 주 시작 전 사전 설문 제출 완료"
  ],
  en: [
    "Join the live Q&A session at 14:00 today",
    "Take the final assessment by Friday",
    "Complete the pre-course survey before next week starts"
  ]
};

export function EduSurveyMigrationPage() {
  const en = isEnglish();
  const [selectedOption, setSelectedOption] = useState("good");
  const [comment, setComment] = useState("");

  const progressPercent = 30;
  const remainingQuestions = 7;

  const selectedSummary = useMemo(
    () => OPTIONS.find((option) => option.id === selectedOption),
    [selectedOption]
  );

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "Education and performance management service" : "교육 및 성과 관리 서비스",
    brandTitle: en ? "Education Progress Hub" : "교육 진도 관리",
    brandSubtitle: "Education & Feedback Portal",
    portalNote: en ? "Manage course progress, surveys, and completion evidence in one place." : "교육 진도, 설문, 이수 증빙을 한 곳에서 관리합니다.",
    navClassroom: en ? "My Classroom" : "나의 강의실",
    navSurvey: en ? "Survey & Review" : "설문 및 평가",
    navCertificate: en ? "Certificates" : "이수증 발급",
    navLibrary: en ? "Learning Library" : "교육 자료실",
    userLabel: en ? "Learner" : "학습자",
    userName: en ? "Researcher Lee" : "이현장 연구원님",
    heroTitle: en ? "Survey Progress" : "설문 진행 현황",
    heroMeta: "Question 3 of 10",
    progressLabel: en ? `Progress ${progressPercent}%` : `진행률 ${progressPercent}%`,
    remainingLabel: en ? `${remainingQuestions} questions left` : `${remainingQuestions}문항 남음`,
    mandatory: en ? "Mandatory" : "필수",
    courseLabel: en ? "2026 H1 Professional Training" : "2026 상반기 직무 교육",
    questionTitle: en ? "Q3. Was the course content appropriate for practical application?" : "Q3. 본 교육 과정의 내용이 실무에 적용하기에 적절했습니까?",
    questionBody: en
      ? "This item evaluates the course's practical usefulness. Please choose how much the completed module helped with your real field duties."
      : "본 질문은 교육 과정의 실효성을 평가하기 위한 항목입니다. 학습하신 모듈의 내용이 실제 현장 업무에 얼마나 도움이 되었는지 선택해 주세요.",
    optionalComment: en ? "Additional comments (optional)" : "기타 의견 (선택사항)",
    commentPlaceholder: en
      ? "Share any improvements that would help make this course more useful in practice."
      : "실무 적용을 위해 개선되었으면 하는 점이 있다면 자유롭게 적어주세요.",
    previous: en ? "Previous Step" : "이전 단계",
    saveLater: en ? "Save for Later" : "나중에 이어하기",
    next: en ? "Next Question" : "다음 문항",
    guideTitle: en ? "Survey Guide" : "설문 안내",
    guideBody: en
      ? "Responses are processed anonymously and used as baseline data for improving future training programs."
      : "작성하신 내용은 익명으로 처리되며, 교육 과정 개선을 위한 기초 자료로 활용됩니다.",
    helpTitle: en ? "Need Help?" : "도움이 필요하신가요?",
    helpBody: en
      ? "If an error occurs during the survey, contact the learner support team at 02-123-4567."
      : "설문 진행 중 오류가 발생하거나 문의사항이 있을 경우 학습 지원팀(02-123-4567)으로 연락 바랍니다.",
    summaryTitle: en ? "Current Answer" : "현재 선택한 응답",
    summaryBody: en
      ? "You can move forward after checking your selected response and notes."
      : "선택한 응답과 의견을 확인한 뒤 다음 문항으로 진행할 수 있습니다.",
    timelineTitle: en ? "This Week's Learning Tasks" : "이번 주 학습 일정",
    timelineBody: en ? "Keep track of the items that must be completed with this course." : "현재 과정과 함께 처리해야 할 학습 과업입니다.",
    footerOrg: en ? "CCUS Education Operations Center" : "CCUS 교육운영센터",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Education Help Desk: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 교육 지원팀 02-1234-5678",
    footerService: en ? "This service supports practical carbon-neutrality capability building for industrial and public teams." : "본 시스템은 공공과 산업 현장의 탄소중립 실무 역량 강화를 지원합니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Use", "Sitemap"]) : Array.from(["개인정보처리방침", "이용약관", "사이트맵"]),
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#edf3ff_0%,#f8fafc_18%,#ffffff_100%)] text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "10px"
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
            <div className="hidden lg:flex items-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
              {copy.portalNote}
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/survey")} onEn={() => navigate("/en/edu/survey")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,#3730a3_0%,#111827_58%,#0f172a_100%)]" data-help-id="edu-survey-hero">
          <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
            <nav className="mb-8 hidden h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm xl:flex">
              <button className="h-full border-b-4 border-transparent px-3 font-bold text-slate-300 transition hover:text-white" onClick={() => navigate(buildLocalizedPath("/edu/my_course", "/en/edu/my_course"))} type="button">{copy.navClassroom}</button>
              <button className="h-full border-b-4 border-indigo-400 px-3 font-bold text-white" type="button">{copy.navSurvey}</button>
              <button className="h-full border-b-4 border-transparent px-3 font-bold text-slate-300 transition hover:text-white" onClick={() => navigate(buildLocalizedPath("/certificate/list", "/en/certificate/list"))} type="button">{copy.navCertificate}</button>
              <button className="h-full border-b-4 border-transparent px-3 font-bold text-slate-300 transition hover:text-white" onClick={() => navigate(buildLocalizedPath("/edu/course_list", "/en/edu/course_list"))} type="button">{copy.navLibrary}</button>
            </nav>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
                    <span className="material-symbols-outlined">task_alt</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{copy.heroTitle}</h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">{copy.heroMeta}</p>
                  </div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#818cf8,#4f46e5)]" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">{copy.progressLabel}</span>
                  <span className="text-indigo-300">{copy.remainingLabel}</span>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-200">{copy.userLabel}</p>
                <p className="mt-2 text-xl font-black text-white">{copy.userName}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Progress</p>
                    <p className="mt-1 text-2xl font-black text-white">{progressPercent}%</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Queue</p>
                    <p className="mt-1 text-2xl font-black text-white">{remainingQuestions}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto -mt-8 max-w-6xl px-4 pb-16 lg:px-8" data-help-id="edu-survey-form">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_0.8fr]">
            <article className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-10">
              <div className="border-b border-slate-100 pb-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">{copy.mandatory}</span>
                  <span className="text-xs font-medium text-slate-400">{copy.courseLabel}</span>
                </div>
                <h3 className="text-2xl font-black leading-9 text-slate-900 md:text-3xl">{copy.questionTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{copy.questionBody}</p>
              </div>

              <div className="mt-8 space-y-4">
                {OPTIONS.map((option) => {
                  const active = option.id === selectedOption;
                  return (
                    <button
                      className={`flex w-full items-start gap-4 rounded-[20px] border-2 p-5 text-left transition ${active ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/60"}`}
                      key={option.id}
                      onClick={() => setSelectedOption(option.id)}
                      type="button"
                    >
                      <span className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}>
                        {active ? <span className="material-symbols-outlined text-[14px]">done</span> : null}
                      </span>
                      <span className="flex-1">
                        <span className="block text-base font-black text-slate-900">{en ? option.labelEn : option.label}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-500">{en ? option.descriptionEn : option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8">
                <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">chat_bubble</span>
                  {copy.optionalComment}
                </p>
                <textarea
                  className="min-h-[132px] w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={copy.commentPlaceholder}
                  value={comment}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50" type="button">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  {copy.previous}
                </button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50" type="button">
                    {copy.saveLater}
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700" type="button">
                    {copy.next}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </article>

            <aside className="space-y-5">
              <section className="rounded-[24px] border border-indigo-100 bg-[linear-gradient(180deg,#eef2ff,#ffffff)] p-6">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">{copy.summaryTitle}</p>
                <h4 className="mt-3 text-xl font-black text-slate-900">{en ? selectedSummary?.labelEn : selectedSummary?.label}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">{copy.summaryBody}</p>
                <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm shadow-sm">
                  <p className="font-bold text-slate-700">{en ? selectedSummary?.descriptionEn : selectedSummary?.description}</p>
                  <p className="mt-3 text-xs text-slate-400">{comment.trim() ? comment : (en ? "No additional notes yet." : "아직 추가 의견이 없습니다.")}</p>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                <h4 className="text-lg font-black text-slate-900">{copy.timelineTitle}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">{copy.timelineBody}</p>
                <ul className="mt-5 space-y-3">
                  {(en ? TIMELINE.en : TIMELINE.ko).map((item) => (
                    <li className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700" key={item}>
                      <span className="material-symbols-outlined text-[18px] text-indigo-500">schedule</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-6">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-indigo-500">info</span>
                  <div>
                    <h4 className="text-sm font-black text-indigo-900">{copy.guideTitle}</h4>
                    <p className="mt-1 text-sm leading-6 text-indigo-800">{copy.guideBody}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400">help</span>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{copy.helpTitle}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{copy.helpBody}</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 CCUS Carbon Education Portal. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
