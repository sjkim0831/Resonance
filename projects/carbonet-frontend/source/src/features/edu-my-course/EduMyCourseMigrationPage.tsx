import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput, HomeLinkButton, HomeSelect } from "../home-ui/common";
import { PageStatusNotice } from "../member/common";

type CourseStatus = "in-progress" | "scheduled" | "completed";
type CourseTrack = "mandatory" | "role" | "leadership";

type MyCourseItem = {
  id: string;
  title: string;
  titleEn: string;
  provider: string;
  providerEn: string;
  status: CourseStatus;
  track: CourseTrack;
  dueDate: string;
  duration: string;
  completedLessons: number;
  totalLessons: number;
  progress: number;
  mentor: string;
  mentorEn: string;
};

type MilestoneItem = {
  label: string;
  labelEn: string;
  value: string;
  accentClassName: string;
  icon: string;
};

type ActivityItem = {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  time: string;
  icon: string;
};

type RecommendedItem = {
  id: string;
  badge: string;
  badgeEn: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
};

const MY_COURSES: MyCourseItem[] = [
  {
    id: "edu-plan-1",
    title: "CCUS 플랜트 운영 심화",
    titleEn: "Advanced CCUS Plant Operations",
    provider: "국가환경교육원",
    providerEn: "National Environmental Learning Center",
    status: "in-progress",
    track: "mandatory",
    dueDate: "2026.04.12",
    duration: "24시간",
    completedLessons: 9,
    totalLessons: 12,
    progress: 78,
    mentor: "이정민 책임교수",
    mentorEn: "Professor Jungmin Lee"
  },
  {
    id: "edu-plan-2",
    title: "배출 데이터 검증 실무",
    titleEn: "Emission Data Verification Practice",
    provider: "탄소중립 전문인력 아카데미",
    providerEn: "Carbon Neutrality Academy",
    status: "scheduled",
    track: "role",
    dueDate: "2026.04.22",
    duration: "16시간",
    completedLessons: 0,
    totalLessons: 8,
    progress: 0,
    mentor: "박서연 수석연구원",
    mentorEn: "Senior Researcher Seoyeon Park"
  },
  {
    id: "edu-plan-3",
    title: "친환경 조직 리더십 워크숍",
    titleEn: "Sustainable Leadership Workshop",
    provider: "공공혁신교육센터",
    providerEn: "Public Innovation Training Center",
    status: "completed",
    track: "leadership",
    dueDate: "2026.03.08",
    duration: "8시간",
    completedLessons: 6,
    totalLessons: 6,
    progress: 100,
    mentor: "김아름 퍼실리테이터",
    mentorEn: "Facilitator Areum Kim"
  }
];

const MILESTONES: MilestoneItem[] = [
  { label: "이번 주 학습 시간", labelEn: "This week's study", value: "7.5h", accentClassName: "from-indigo-500 to-sky-500", icon: "schedule" },
  { label: "남은 필수 과정", labelEn: "Mandatory courses left", value: "2", accentClassName: "from-amber-500 to-orange-500", icon: "workspace_premium" },
  { label: "획득 배지", labelEn: "Badges earned", value: "14", accentClassName: "from-emerald-500 to-teal-500", icon: "military_tech" }
];

const ACTIVITIES: ActivityItem[] = [
  {
    id: "activity-1",
    title: "모듈 9 학습 완료",
    titleEn: "Completed module 9",
    description: "CCUS 플랜트 운영 심화의 안전 점검 파트를 수강했습니다.",
    descriptionEn: "You finished the safety inspection lesson in Advanced CCUS Plant Operations.",
    time: "오늘 09:40",
    icon: "play_circle"
  },
  {
    id: "activity-2",
    title: "보충 자료 다운로드",
    titleEn: "Downloaded support material",
    description: "배출 데이터 검증 실무 과정의 샘플 체크리스트를 내려받았습니다.",
    descriptionEn: "You downloaded the sample checklist for Emission Data Verification Practice.",
    time: "어제 16:10",
    icon: "download"
  },
  {
    id: "activity-3",
    title: "수료증 발급 완료",
    titleEn: "Certificate issued",
    description: "친환경 조직 리더십 워크숍 수료증이 마이페이지에 등록되었습니다.",
    descriptionEn: "The certificate for Sustainable Leadership Workshop was added to My Page.",
    time: "2026.03.08",
    icon: "verified"
  }
];

const RECOMMENDED: RecommendedItem[] = [
  {
    id: "rec-1",
    badge: "다음 추천",
    badgeEn: "Next up",
    title: "MRV 보고서 품질 점검",
    titleEn: "MRV Report Quality Review",
    body: "현재 수강 중인 과정과 연결되는 후속 검증 트랙입니다.",
    bodyEn: "A follow-up verification track that connects directly to your active courses."
  },
  {
    id: "rec-2",
    badge: "직무 연계",
    badgeEn: "Role link",
    title: "환경 규정 업데이트 브리핑",
    titleEn: "Environmental Regulation Update Briefing",
    body: "이번 분기 필수 규정 반영 사항을 90분 안에 정리합니다.",
    bodyEn: "Covers this quarter's mandatory regulation updates in a 90-minute briefing."
  }
];

const STATUS_STYLE: Record<CourseStatus, string> = {
  "in-progress": "bg-sky-50 text-sky-700 border border-sky-100",
  scheduled: "bg-amber-50 text-amber-700 border border-amber-100",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-100"
};

const TRACK_STYLE: Record<CourseTrack, string> = {
  mandatory: "bg-indigo-600 text-white",
  role: "bg-slate-900 text-white",
  leadership: "bg-emerald-600 text-white"
};

const COPY = {
  ko: {
    skip: "본문 바로가기",
    governmentText: "전문 감독관 자격 인증 포털 | 대한민국 정부 공식 교육 플랫폼",
    guidelineText: "오늘의 학습 목표 달성까지 2시간 남음",
    brandTitle: "전문 자격 인증 허브",
    brandSubtitle: "Professional Certification Hub",
    portalNote: "학습, 수료, 인증 현황을 하나의 포털에서 관리합니다.",
    pageTitle: "나의 교육",
    pageBody: "선택한 reference 대시보드 구성을 현재 포털 구조에 맞춰 옮겼습니다. 진행 중 과정, 예정 과정, 수료 흐름을 한 화면에서 이어서 확인합니다.",
    pageStatus: "reference HTML을 기반으로 재구성된 React 마이그레이션 화면입니다.",
    searchPlaceholder: "과정명, 기관명, 멘토명 검색",
    statusAll: "전체 상태",
    trackAll: "전체 트랙",
    summaryTitle: "이번 달 학습 현황",
    summaryBody: "진행률, 남은 필수 과정, 배지 획득 현황을 우선순위로 확인합니다.",
    learningGoalLabel: "월간 학습 목표",
    learningGoalValue: "12 / 16 시간",
    completionLabel: "평균 수강 진도",
    completionValue: "76%",
    continueLabel: "이어보기",
    certificateLabel: "수료증 보기",
    courseListLabel: "전체 과정 보기",
    sectionCourses: "내 과정 보드",
    sectionCoursesBody: "진행 중, 예정, 수료 완료 과정을 상태별로 정리했습니다.",
    lessonsLabel: "차시",
    dueDateLabel: "마감",
    mentorLabel: "담당 멘토",
    activityTitle: "최근 학습 활동",
    activityBody: "최근 학습, 자료 다운로드, 수료 처리 기록입니다.",
    recommendTitle: "추천 후속 과정",
    recommendBody: "현재 학습 흐름과 연결되는 다음 과정을 제안합니다.",
    timelineTitle: "이번 주 학습 일정",
    timelineBody: "오늘과 이번 주 안에 처리해야 할 학습 과업입니다.",
    timelineItems: [
      "오늘 14:00 라이브 질의응답 세션 참여",
      "금요일까지 플랜트 운영 심화 최종 평가 응시",
      "다음 주 시작 전 배출 데이터 검증 실무 사전 설문 제출"
    ],
    footerOrg: "전문인력 교육운영센터",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 학습지원센터 1588-1234",
    footerServiceLine: "공공과 산업 현장의 탄소중립 전문인력 양성을 지원합니다.",
    footerLinks: ["개인정보처리방침", "이용약관", "사이트맵"],
    footerWaAlt: "웹 접근성 품질인증 마크",
    lastModifiedLabel: "최종 수정일:"
  },
  en: {
    skip: "Skip to main content",
    governmentText: "Professional Certification Portal | Official Government Learning Platform",
    guidelineText: "Two hours left to hit today's learning goal",
    brandTitle: "Professional Certification Hub",
    brandSubtitle: "Professional Certification Hub",
    portalNote: "Manage study, completion, and certification progress from one portal.",
    pageTitle: "My Courses",
    pageBody: "The selected reference dashboard was rebuilt in the current portal shell. Review active courses, scheduled learning, and completion flow on one page.",
    pageStatus: "This is a React migration page rebuilt from the reference HTML.",
    searchPlaceholder: "Search course, provider, or mentor",
    statusAll: "All statuses",
    trackAll: "All tracks",
    summaryTitle: "Monthly learning snapshot",
    summaryBody: "Prioritize progress, remaining mandatory tracks, and earned badges.",
    learningGoalLabel: "Monthly goal",
    learningGoalValue: "12 / 16 hours",
    completionLabel: "Average completion",
    completionValue: "76%",
    continueLabel: "Continue",
    certificateLabel: "View Certificate",
    courseListLabel: "Browse Catalog",
    sectionCourses: "My course board",
    sectionCoursesBody: "In-progress, scheduled, and completed programs are organized by status.",
    lessonsLabel: "Lessons",
    dueDateLabel: "Due",
    mentorLabel: "Mentor",
    activityTitle: "Recent learning activity",
    activityBody: "Recent study, downloads, and certificate events.",
    recommendTitle: "Recommended next courses",
    recommendBody: "Suggested follow-up tracks connected to your current learning path.",
    timelineTitle: "This week's learning timeline",
    timelineBody: "Tasks you should handle today and this week.",
    timelineItems: [
      "Join the live Q&A session at 14:00 today",
      "Finish the final assessment for plant operations by Friday",
      "Submit the pre-course survey before next week's verification class"
    ],
    footerOrg: "Professional Learning Operations Center",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Help desk: 1588-1234",
    footerServiceLine: "Supporting carbon-neutrality professionals across public and industrial sectors.",
    footerLinks: ["Privacy Policy", "Terms of Use", "Sitemap"],
    footerWaAlt: "Web accessibility quality mark",
    lastModifiedLabel: "Last Modified:"
  }
};

function getStatusLabel(status: CourseStatus, en: boolean) {
  if (status === "in-progress") {
    return en ? "In Progress" : "학습 중";
  }
  if (status === "scheduled") {
    return en ? "Scheduled" : "예정";
  }
  return en ? "Completed" : "수료";
}

function getTrackLabel(track: CourseTrack, en: boolean) {
  if (track === "mandatory") {
    return en ? "Mandatory" : "필수";
  }
  if (track === "role") {
    return en ? "Role Track" : "직무";
  }
  return en ? "Leadership" : "리더십";
}

export function EduMyCourseMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [track, setTrack] = useState<CourseTrack | "all">("all");

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return MY_COURSES.filter((course) => {
      const title = en ? course.titleEn : course.title;
      const provider = en ? course.providerEn : course.provider;
      const mentor = en ? course.mentorEn : course.mentor;
      const matchesQuery = !normalizedQuery || `${title} ${provider} ${mentor}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || course.status === status;
      const matchesTrack = track === "all" || course.track === track;
      return matchesQuery && matchesStatus && matchesTrack;
    });
  }, [en, query, status, track]);

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_18%,#ffffff_100%)] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#111827",
        ["--kr-gov-text-secondary" as string]: "#4b5563",
        ["--kr-gov-border-light" as string]: "#d7dce5",
        ["--kr-gov-bg-gray" as string]: "#f3f4f6",
        ["--kr-gov-radius" as string]: "12px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.governmentText} guidelineText={copy.guidelineText} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden lg:flex items-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)] shadow-sm">
              {copy.portalNote}
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/my_course")} onEn={() => navigate("/en/edu/my_course")} />
          </>
        )}
      />

      <main id="main-content" className="pb-16">
        <section className="border-b border-slate-900/10 bg-[radial-gradient(circle_at_top_left,#1e3a8a_0,#312e81_45%,#0f172a_100%)]" data-help-id="edu-my-course-hero">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-100">
                <span className="material-symbols-outlined text-base">school</span>
                {copy.pageTitle}
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-white lg:text-5xl">{copy.pageTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">{copy.pageBody}</p>
              <div className="mt-6 max-w-xl">
                <PageStatusNotice tone="success">{copy.pageStatus}</PageStatusNotice>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <HomeButton size="sm" type="button" variant="primary" icon="play_circle">
                  {copy.continueLabel}
                </HomeButton>
                <HomeLinkButton href={buildLocalizedPath("/edu/course_list", "/en/edu/course_list")} size="sm" variant="secondary" icon="menu_book">
                  {copy.courseListLabel}
                </HomeLinkButton>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md" data-help-id="edu-my-course-summary">
              <div className="rounded-[24px] bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">{copy.summaryTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{copy.summaryBody}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {MILESTONES.map((item) => (
                    <article className="rounded-[20px] bg-slate-50 p-4" key={item.label}>
                      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accentClassName} text-white shadow-lg`}>
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                      </div>
                      <p className="mt-4 text-2xl font-black text-slate-900">{item.value}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{en ? item.labelEn : item.label}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-6 rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#eef2ff)] p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500">{copy.learningGoalLabel}</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{copy.learningGoalValue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-500">{copy.completionLabel}</p>
                      <p className="mt-1 text-2xl font-black text-emerald-600">{copy.completionValue}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[76%] rounded-full bg-[linear-gradient(90deg,#4f46e5,#0ea5e9)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto -mt-8 max-w-7xl px-4 lg:px-8" data-help-id="edu-my-course-filters">
          <div className="rounded-[24px] border border-white bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,0.7fr))_auto]">
              <HomeInput placeholder={copy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
              <HomeSelect value={status} onChange={(event) => setStatus(event.target.value as CourseStatus | "all")}>
                <option value="all">{copy.statusAll}</option>
                <option value="in-progress">{getStatusLabel("in-progress", en)}</option>
                <option value="scheduled">{getStatusLabel("scheduled", en)}</option>
                <option value="completed">{getStatusLabel("completed", en)}</option>
              </HomeSelect>
              <HomeSelect value={track} onChange={(event) => setTrack(event.target.value as CourseTrack | "all")}>
                <option value="all">{copy.trackAll}</option>
                <option value="mandatory">{getTrackLabel("mandatory", en)}</option>
                <option value="role">{getTrackLabel("role", en)}</option>
                <option value="leadership">{getTrackLabel("leadership", en)}</option>
              </HomeSelect>
              <HomeButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setTrack("all");
                }}
              >
                {en ? "Reset" : "초기화"}
              </HomeButton>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8" data-help-id="edu-my-course-board">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-3xl font-black text-slate-900">{copy.sectionCourses}</h3>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{copy.sectionCoursesBody}</p>
            </div>
            <p className="text-sm font-bold text-slate-500">{filteredCourses.length}{en ? " items" : "건"}</p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const title = en ? course.titleEn : course.title;
              const provider = en ? course.providerEn : course.provider;
              const mentor = en ? course.mentorEn : course.mentor;
              return (
                <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl" key={course.id}>
                  <div className="bg-[linear-gradient(135deg,#eff6ff_0%,#eef2ff_42%,#f8fafc_100%)] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${TRACK_STYLE[course.track]}`}>{getTrackLabel(course.track, en)}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[course.status]}`}>{getStatusLabel(course.status, en)}</span>
                    </div>
                    <h4 className="mt-5 text-xl font-black leading-8 text-slate-900">{title}</h4>
                    <p className="mt-2 text-sm text-slate-500">{provider}</p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-3 rounded-[20px] bg-slate-50 p-4 text-sm">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{copy.lessonsLabel}</p>
                        <p className="mt-1 font-black text-slate-900">{course.completedLessons}/{course.totalLessons}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{copy.dueDateLabel}</p>
                        <p className="mt-1 font-black text-slate-900">{course.dueDate}</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-500">{copy.completionLabel}</span>
                        <span className="font-black text-slate-900">{course.progress}%</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#4f46e5,#06b6d4)]" style={{ width: `${course.progress}%` }} />
                      </div>
                    </div>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold text-slate-500">{copy.mentorLabel}</dt>
                        <dd className="text-right font-medium text-slate-900">{mentor}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold text-slate-500">{en ? "Duration" : "학습시간"}</dt>
                        <dd className="text-right font-medium text-slate-900">{course.duration}</dd>
                      </div>
                    </dl>
                    <div className="mt-6 flex gap-3">
                      <HomeButton className="flex-1" type="button" variant="primary" size="sm" icon="play_circle">
                        {copy.continueLabel}
                      </HomeButton>
                      {course.status === "completed" ? (
                        <HomeButton className="flex-1" type="button" variant="secondary" size="sm" icon="workspace_premium">
                          {copy.certificateLabel}
                        </HomeButton>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-help-id="edu-my-course-activity">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{copy.activityTitle}</h3>
                <p className="mt-2 text-sm text-slate-500">{copy.activityBody}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <span className="material-symbols-outlined text-[26px]">history</span>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {ACTIVITIES.map((item) => (
                <article className="flex gap-4 rounded-[20px] border border-slate-100 bg-slate-50 p-4" key={item.id}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="font-black text-slate-900">{en ? item.titleEn : item.title}</h4>
                      <p className="text-xs font-bold text-slate-400">{item.time}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{en ? item.descriptionEn : item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-help-id="edu-my-course-recommend">
              <h3 className="text-2xl font-black text-slate-900">{copy.recommendTitle}</h3>
              <p className="mt-2 text-sm text-slate-500">{copy.recommendBody}</p>
              <div className="mt-5 space-y-4">
                {RECOMMENDED.map((item) => (
                  <article className="rounded-[20px] bg-[linear-gradient(180deg,#eef2ff,#f8fafc)] p-4" key={item.id}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600">{en ? item.badgeEn : item.badge}</p>
                    <h4 className="mt-2 text-lg font-black text-slate-900">{en ? item.titleEn : item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{en ? item.bodyEn : item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm" data-help-id="edu-my-course-timeline">
              <h3 className="text-2xl font-black">{copy.timelineTitle}</h3>
              <p className="mt-2 text-sm text-slate-300">{copy.timelineBody}</p>
              <ul className="mt-5 space-y-4">
                {copy.timelineItems.map((item) => (
                  <li className="flex gap-3" key={item}>
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-sky-200">•</span>
                    <span className="text-sm leading-6 text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 Professional Certification Hub. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerServiceLine}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
