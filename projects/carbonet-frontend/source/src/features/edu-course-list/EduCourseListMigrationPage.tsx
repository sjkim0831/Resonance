import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type CourseCategory = "analysis" | "policy" | "safety" | "digital" | "leadership";
type CourseLevel = "beginner" | "intermediate" | "advanced";

type CourseCard = {
  id: string;
  category: CourseCategory;
  level: CourseLevel;
  badgeColor: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  hours: string;
  enrollment: string;
  completionRate: string;
  format: string;
  formatEn: string;
};

type Recommendation = {
  badge: string;
  badgeEn: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  meta: string;
  metaEn: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    badge: "직무 추천",
    badgeEn: "Role Match",
    title: "탄소배출권 거래 실무 심화",
    titleEn: "Advanced Carbon Credit Trading Practice",
    summary: "거래 전략, 리스크 점검, 정산 흐름까지 한 번에 정리합니다.",
    summaryEn: "Covers strategy, risk checks, and settlement flow in one path.",
    meta: "12시간 · 추천도 98%",
    metaEn: "12h · 98% match"
  },
  {
    badge: "필수 이수",
    badgeEn: "Mandatory",
    title: "2026 환경안전 법령 업데이트",
    titleEn: "2026 Environmental Safety Law Update",
    summary: "올해 개정된 규정과 현장 적용 포인트를 빠르게 확인합니다.",
    summaryEn: "Quickly review this year's revisions and field implications.",
    meta: "4시간 · 마감 임박",
    metaEn: "4h · deadline soon"
  },
  {
    badge: "역량 강화",
    badgeEn: "Skill Up",
    title: "에너지 데이터 기반 공정 진단",
    titleEn: "Process Diagnostics with Energy Data",
    summary: "설비 데이터로 개선 지점을 찾는 실무형 분석 과정입니다.",
    summaryEn: "A practical analysis course for identifying process improvements.",
    meta: "8시간 · 수강생 1.8k+",
    metaEn: "8h · 1.8k+ learners"
  }
];

const COURSES: CourseCard[] = [
  {
    id: "course-1",
    category: "analysis",
    level: "advanced",
    badgeColor: "bg-sky-600",
    title: "AI 기반 온실가스 배출 예측 모델링",
    titleEn: "AI-Based Greenhouse Gas Forecasting",
    summary: "Python과 시계열 분석으로 배출 추세를 예측하고 시나리오를 비교합니다.",
    summaryEn: "Predict emission trends with Python, time-series analysis, and scenario comparison.",
    hours: "24h",
    enrollment: "2.4k+",
    completionRate: "91%",
    format: "온라인",
    formatEn: "Online"
  },
  {
    id: "course-2",
    category: "policy",
    level: "beginner",
    badgeColor: "bg-emerald-600",
    title: "ESG 공시와 핵심 지표 이해",
    titleEn: "Understanding ESG Disclosure and KPIs",
    summary: "글로벌 공시 요구사항과 KPI 설계 기준을 입문자 관점에서 설명합니다.",
    summaryEn: "Explains global disclosure requirements and KPI design for beginners.",
    hours: "15h",
    enrollment: "1.7k+",
    completionRate: "88%",
    format: "혼합형",
    formatEn: "Blended"
  },
  {
    id: "course-3",
    category: "safety",
    level: "intermediate",
    badgeColor: "bg-orange-600",
    title: "CCUS 플랜트 운영과 안전관리",
    titleEn: "CCUS Plant Operations and Safety",
    summary: "탄소 포집 설비 구조와 현장 안전 체크포인트를 실습 중심으로 다룹니다.",
    summaryEn: "Covers carbon capture plant operations and field safety checkpoints.",
    hours: "32h",
    enrollment: "960+",
    completionRate: "94%",
    format: "집합",
    formatEn: "In person"
  },
  {
    id: "course-4",
    category: "digital",
    level: "beginner",
    badgeColor: "bg-violet-600",
    title: "스마트팩토리 IoT 센서 활용",
    titleEn: "IoT Sensors for Smart Factories",
    summary: "센서 설치, 데이터 수집, 클라우드 연계를 기본부터 익힙니다.",
    summaryEn: "Learn sensor deployment, data collection, and cloud integration from scratch.",
    hours: "20h",
    enrollment: "1.2k+",
    completionRate: "86%",
    format: "온라인",
    formatEn: "Online"
  },
  {
    id: "course-5",
    category: "leadership",
    level: "intermediate",
    badgeColor: "bg-slate-700",
    title: "친환경 조직문화를 만드는 리더십",
    titleEn: "Leadership for Sustainable Culture",
    summary: "관리자 관점에서 조직 변화를 설계하고 실행하는 방법을 다룹니다.",
    summaryEn: "Focuses on leading organizational change toward sustainability.",
    hours: "10h",
    enrollment: "740+",
    completionRate: "89%",
    format: "온라인",
    formatEn: "Online"
  },
  {
    id: "course-6",
    category: "analysis",
    level: "beginner",
    badgeColor: "bg-cyan-700",
    title: "엑셀로 배우는 탄소 데이터 보고",
    titleEn: "Carbon Data Reporting with Excel",
    summary: "고급 함수와 피벗 테이블로 탄소 데이터를 정리하고 시각화합니다.",
    summaryEn: "Use advanced functions and pivot tables for carbon data reporting.",
    hours: "12h",
    enrollment: "3.2k+",
    completionRate: "93%",
    format: "온라인",
    formatEn: "Online"
  },
  {
    id: "course-7",
    category: "policy",
    level: "intermediate",
    badgeColor: "bg-teal-700",
    title: "공공부문 넷제로 이행 가이드",
    titleEn: "Public Sector Net Zero Implementation Guide",
    summary: "공공기관 목표관리와 실행계획 수립 절차를 사례 중심으로 설명합니다.",
    summaryEn: "Explains public sector target management and action planning with case studies.",
    hours: "6h",
    enrollment: "2.1k+",
    completionRate: "90%",
    format: "온라인",
    formatEn: "Online"
  },
  {
    id: "course-8",
    category: "digital",
    level: "advanced",
    badgeColor: "bg-fuchsia-700",
    title: "배출 모니터링 대시보드 설계 워크숍",
    titleEn: "Emission Monitoring Dashboard Workshop",
    summary: "지표 설계, 시각화, 경보 체계를 함께 만드는 프로젝트형 과정입니다.",
    summaryEn: "A project workshop on KPI design, visualization, and alert workflows.",
    hours: "18h",
    enrollment: "530+",
    completionRate: "84%",
    format: "워크숍",
    formatEn: "Workshop"
  }
];

const CATEGORY_OPTIONS: Array<{ key: CourseCategory | "all"; label: string; labelEn: string }> = [
  { key: "all", label: "전체", labelEn: "All" },
  { key: "analysis", label: "데이터 분석", labelEn: "Data Analysis" },
  { key: "policy", label: "정책·제도", labelEn: "Policy" },
  { key: "safety", label: "안전관리", labelEn: "Safety" },
  { key: "digital", label: "디지털 전환", labelEn: "Digital" },
  { key: "leadership", label: "리더십", labelEn: "Leadership" }
];

const LEVEL_OPTIONS: Array<{ key: CourseLevel | "all"; label: string; labelEn: string }> = [
  { key: "all", label: "난이도 전체", labelEn: "All Levels" },
  { key: "beginner", label: "입문", labelEn: "Beginner" },
  { key: "intermediate", label: "중급", labelEn: "Intermediate" },
  { key: "advanced", label: "심화", labelEn: "Advanced" }
];

const TAGS = {
  ko: ["#탄소중립", "#데이터역량", "#환경법령", "#ESG공시", "#에너지효율", "#CCUS"],
  en: ["#NetZero", "#DataSkills", "#EnvLaw", "#ESG", "#Efficiency", "#CCUS"]
};

const ANNOUNCEMENTS = {
  ko: [
    { title: "2026 상반기 필수교육 이수 안내", date: "2026.03.24" },
    { title: "[이벤트] 우수 학습자 포인트 지급", date: "2026.03.18" },
    { title: "교육 플랫폼 정기 점검 예정 안내", date: "2026.03.12" }
  ],
  en: [
    { title: "2026 Mandatory Training Completion Guide", date: "2026.03.24" },
    { title: "[Event] Reward Points for Top Learners", date: "2026.03.18" },
    { title: "Scheduled Maintenance for the Training Platform", date: "2026.03.12" }
  ]
};

function matchesText(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.trim().toLowerCase());
}

export function EduCourseListMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<CourseCategory | "all">("all");
  const [level, setLevel] = useState<CourseLevel | "all">("all");

  const filteredCourses = useMemo(() => {
    return COURSES.filter((course) => {
      const title = en ? course.titleEn : course.title;
      const summary = en ? course.summaryEn : course.summary;
      const sameCategory = category === "all" || course.category === category;
      const sameLevel = level === "all" || course.level === level;
      const sameKeyword = !keyword.trim() || matchesText(`${title} ${summary}`, keyword);
      return sameCategory && sameLevel && sameKeyword;
    });
  }, [category, en, keyword, level]);

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "This website complies with the 2025 Digital Government UI/UX Guidelines." : "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    brandTitle: en ? "Smart Edu Platform" : "스마트 교육 플랫폼",
    brandSubtitle: en ? "Educational Excellence Hub" : "탄소중립 교육 허브",
    portalNote: en ? "Integrated learning portal for public officials and professionals" : "공공기관과 산업 실무자를 위한 통합 학습 포털",
    heroTitle: en ? "Course Catalog" : "교육과정 목록",
    heroSummary: en ? "Personalized courses aligned to your role, compliance schedule, and recent learning history." : "직무, 의무 이수 일정, 최근 학습 이력을 반영한 맞춤형 교육과정을 확인합니다.",
    heroLabel: en ? "Recommended Learning Path" : "추천 학습 경로",
    searchPlaceholder: en ? "Search by course title, keywords, or learning goal" : "과정명, 키워드, 학습 목표로 검색",
    searchButton: en ? "Search" : "검색",
    totalLabel: en ? "Available courses" : "조회 과정",
    totalSuffix: en ? "courses" : "건",
    statsTitle: en ? "My Learning Snapshot" : "나의 학습 현황",
    progressLabel: en ? "Monthly goal" : "월간 목표 달성률",
    progressValue: "85%",
    timeLabel: en ? "Cumulative time" : "누적 학습 시간",
    timeValue: en ? "48 hours" : "48시간",
    suggestTitle: en ? "Need a tailored course?" : "맞춤 과정이 필요하신가요?",
    suggestBody: en ? "Submit a request and the operations team will review a custom program for your organization." : "요청을 남기면 운영팀이 기관 맞춤형 과정을 검토합니다.",
    suggestButton: en ? "Apply for a Course" : "교육 신청하기",
    detailButton: en ? "Details" : "상세보기",
    emptyTitle: en ? "No courses match your filters." : "조건에 맞는 과정이 없습니다.",
    emptyBody: en ? "Try another keyword or broaden the category and level filters." : "검색어를 바꾸거나 카테고리와 난이도를 넓혀 보세요.",
    tagsTitle: en ? "Popular Tags" : "인기 태그",
    noticeTitle: en ? "Announcements" : "공지사항",
    footerOrg: en ? "Edu Innovation Support Division" : "교육혁신지원단",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Help Desk: 1588-1234" : "(04551) 서울특별시 중구 세종대로 110 | 학습지원센터 1588-1234",
    footerServiceLine: en ? "This platform helps foster carbon-neutrality experts across public and industrial sectors." : "본 플랫폼은 공공과 산업 현장의 탄소중립 전문인력 양성을 지원합니다.",
    footerLinks: en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"],
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#eff5ff_0%,#f8fafc_22%,#ffffff_100%)] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#0f3d91",
        ["--kr-gov-blue-hover" as string]: "#0a2f70",
        ["--kr-gov-text-primary" as string]: "#0f172a",
        ["--kr-gov-text-secondary" as string]: "#475569",
        ["--kr-gov-border-light" as string]: "#d7e0ec",
        ["--kr-gov-bg-gray" as string]: "#f3f7fb",
        ["--kr-gov-radius" as string]: "12px"
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
            <div className="hidden lg:flex items-center rounded-full border border-sky-100 bg-white px-4 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)] shadow-sm">
              {copy.portalNote}
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/course_list")} onEn={() => navigate("/en/edu/course_list")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-900/10 bg-[radial-gradient(circle_at_top_left,#1d4ed8_0,#0f172a_48%,#111827_100%)]" data-help-id="edu-course-list-hero">
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_52%,transparent_52%,transparent_100%)] bg-[length:72px_72px]" />
          </div>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1.05fr_1.4fr] lg:px-8 lg:py-16">
            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-white/10 px-4 py-2 text-xs font-bold text-sky-100">
                <span className="material-symbols-outlined text-base">school</span>
                {copy.heroLabel}
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white lg:text-5xl">{copy.heroTitle}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 lg:text-base">{copy.heroSummary}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {RECOMMENDATIONS.map((item) => (
                  <article className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm" key={item.title}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">{en ? item.badgeEn : item.badge}</p>
                    <h3 className="mt-3 text-base font-bold text-white">{en ? item.titleEn : item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{en ? item.summaryEn : item.summary}</p>
                    <p className="mt-4 text-[11px] font-bold text-slate-400">{en ? item.metaEn : item.meta}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="relative z-10 rounded-[24px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
              <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-[20px] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">{copy.totalLabel}</p>
                      <h3 className="mt-2 text-3xl font-black text-slate-900">
                        {filteredCourses.length}
                        <span className="ml-2 text-lg font-bold text-slate-500">{copy.totalSuffix}</span>
                      </h3>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                      <span className="material-symbols-outlined text-[30px]">menu_book</span>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-500">{copy.timeLabel}</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{copy.timeValue}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">{copy.progressLabel}</p>
                        <p className="mt-1 text-2xl font-black text-emerald-600">{copy.progressValue}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-[85%] rounded-full bg-[linear-gradient(90deg,#10b981,#0f3d91)]" />
                    </div>
                  </div>
                </div>
                <div className="rounded-[20px] bg-[linear-gradient(180deg,#eff6ff,#dbeafe)] p-5 shadow-sm">
                  <div className="flex h-full flex-col">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--kr-gov-blue)] shadow-sm">
                      <span className="material-symbols-outlined text-[28px]">tips_and_updates</span>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-slate-900">{copy.suggestTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{copy.suggestBody}</p>
                    <button
                      className="mt-auto rounded-xl bg-[var(--kr-gov-blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]"
                      onClick={() => navigate(buildLocalizedPath("/edu/apply", "/en/edu/apply"))}
                      type="button"
                    >
                      {copy.suggestButton}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 lg:px-8" data-help-id="edu-course-list-catalog">
          <div className="rounded-[24px] border border-white bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.55fr))_auto]">
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">search</span>
                <input
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  value={keyword}
                />
              </label>
              <select
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-sky-400"
                onChange={(event) => setCategory(event.target.value as CourseCategory | "all")}
                value={category}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{en ? option.labelEn : option.label}</option>
                ))}
              </select>
              <select
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-sky-400"
                onChange={(event) => setLevel(event.target.value as CourseLevel | "all")}
                value={level}
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{en ? option.labelEn : option.label}</option>
                ))}
              </select>
              <button
                className="h-14 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:border-sky-300 hover:text-[var(--kr-gov-blue)]"
                onClick={() => {
                  setKeyword("");
                  setCategory("all");
                  setLevel("all");
                }}
                type="button"
              >
                {en ? "Reset" : "초기화"}
              </button>
              <button className="h-14 rounded-2xl bg-[var(--kr-gov-blue)] px-8 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                {copy.searchButton}
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-3xl font-black text-slate-900">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">list_alt</span>
                {copy.heroTitle}
              </h2>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{copy.heroSummary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.slice(1).map((option) => {
                const active = category === option.key;
                return (
                  <button
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-[var(--kr-gov-blue)]"}`}
                    key={option.key}
                    onClick={() => setCategory(option.key)}
                    type="button"
                  >
                    {en ? option.labelEn : option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCourses.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {filteredCourses.map((course) => (
                <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl" key={course.id}>
                  <div className="relative h-44 overflow-hidden bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_45%,#e2e8f0_100%)] p-5">
                    <div className="absolute right-[-18px] top-[-18px] h-28 w-28 rounded-full bg-white/40 blur-2xl" />
                    <div className="absolute bottom-[-26px] left-[-12px] h-24 w-24 rounded-full bg-sky-300/40 blur-2xl" />
                    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold text-white ${course.badgeColor}`}>
                      {en
                        ? CATEGORY_OPTIONS.find((option) => option.key === course.category)?.labelEn
                        : CATEGORY_OPTIONS.find((option) => option.key === course.category)?.label}
                    </div>
                    <div className="mt-10 flex items-end justify-between">
                      <div className="rounded-2xl bg-white/75 px-4 py-3 shadow-sm backdrop-blur-sm">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{en ? "Completion" : "수료율"}</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{course.completionRate}</p>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                        <span className="material-symbols-outlined text-[28px]">school</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span>{en ? course.formatEn : course.format}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{en ? LEVEL_OPTIONS.find((option) => option.key === course.level)?.labelEn : LEVEL_OPTIONS.find((option) => option.key === course.level)?.label}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black leading-7 text-slate-900">{en ? course.titleEn : course.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-500">{en ? course.summaryEn : course.summary}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{en ? "Hours" : "학습시간"}</p>
                        <p className="mt-1 font-black text-slate-900">{course.hours}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{en ? "Learners" : "수강생"}</p>
                        <p className="mt-1 font-black text-slate-900">{course.enrollment}</p>
                      </div>
                    </div>
                    <button
                      className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--kr-gov-blue)] transition hover:gap-2"
                      onClick={() => navigate(`${buildLocalizedPath("/edu/course_detail", "/en/edu/course_detail")}?courseId=${course.id}`)}
                      type="button"
                    >
                      {copy.detailButton}
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <span className="material-symbols-outlined text-[30px]">filter_alt_off</span>
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-900">{copy.emptyTitle}</h3>
              <p className="mt-2 text-sm text-slate-500">{copy.emptyBody}</p>
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-3 lg:px-8">
            <div>
              <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-slate-900">
                <span className="material-symbols-outlined text-sky-600">sell</span>
                {copy.tagsTitle}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(en ? TAGS.en : TAGS.ko).map((tag) => (
                  <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-sky-50 hover:text-[var(--kr-gov-blue)]" key={tag} type="button">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-slate-900">
                <span className="material-symbols-outlined text-sky-600">campaign</span>
                {copy.noticeTitle}
              </h3>
              <ul className="space-y-4">
                {(en ? ANNOUNCEMENTS.en : ANNOUNCEMENTS.ko).map((item) => (
                  <li className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0" key={item.title}>
                    <a className="text-sm font-bold text-slate-800 transition hover:text-[var(--kr-gov-blue)]" href="#">
                      {item.title}
                    </a>
                    <p className="mt-1 text-xs text-slate-400">{item.date}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-slate-900">
                <span className="material-symbols-outlined text-sky-600">query_stats</span>
                {copy.statsTitle}
              </h3>
              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#eef6ff)] p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{copy.timeLabel}</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{copy.timeValue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">{copy.progressLabel}</p>
                    <p className="mt-1 text-3xl font-black text-emerald-600">{copy.progressValue}</p>
                  </div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[85%] rounded-full bg-[linear-gradient(90deg,#10b981,#1d4ed8)]" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 Smart Education Platform. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerServiceLine}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
