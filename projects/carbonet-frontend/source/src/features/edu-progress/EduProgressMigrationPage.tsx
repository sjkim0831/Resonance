import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput } from "../home-ui/common";

type LocalizedCourse = {
  id: string;
  category: string;
  categoryEn: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  status: string;
  statusEn: string;
  statusClassName: string;
  metricLabel: string;
  metricLabelEn: string;
  metricValue: string;
  metricToneClassName: string;
  note: string;
  noteEn: string;
  action: string;
  actionEn: string;
  progress: number;
  imageClassName: string;
};

type InterestCourse = {
  id: string;
  format: string;
  formatEn: string;
  formatClassName: string;
  favorite: boolean;
  title: string;
  titleEn: string;
  meta: string;
  metaEn: string;
  price: string;
  action: string;
  actionEn: string;
};

const RECOMMENDED_COURSES = [
  {
    id: "rec-1",
    badge: "Gap Fill",
    title: "산업 전과정 평가(LCA) 심화 실무",
    titleEn: "Advanced Industrial LCA Practice",
    summary: "환경성적표지와 탄소발자국 산정을 위한 정밀 LCA 방법론을 정리합니다.",
    summaryEn: "Master detailed LCA methodology for EPD and carbon footprint reporting.",
    meta: "강의 보기",
    metaEn: "View course",
    accentClassName: "border-indigo-500/30 bg-indigo-500/20 text-indigo-300",
    stat: "인기",
    statEn: "Popular",
    icon: "arrow_forward"
  },
  {
    id: "rec-2",
    badge: "Strategic",
    title: "그린 택소노미 대응 전략 세미나",
    titleEn: "Green Taxonomy Response Strategy Seminar",
    summary: "K-택소노미 가이드라인에 맞춘 공시 전략과 적합성 평가를 다룹니다.",
    summaryEn: "Covers disclosure strategy and fit assessment aligned to the K-taxonomy.",
    meta: "신청하기",
    metaEn: "Apply now",
    accentClassName: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
    stat: "NEW",
    statEn: "NEW",
    icon: "calendar_today"
  }
];

const ACTIVE_COURSES: LocalizedCourse[] = [
  {
    id: "active-1",
    category: "환경 경영",
    categoryEn: "Environmental Management",
    title: "CCUS 기술 동향 및 비즈니스 모델",
    titleEn: "CCUS Technology Trends and Business Models",
    summary: "정책 동향과 사업화 모델을 함께 점검하는 핵심 과정입니다.",
    summaryEn: "A core course reviewing policy trends and commercialization models.",
    status: "수강 중",
    statusEn: "In Progress",
    statusClassName: "bg-indigo-600 text-white",
    metricLabel: "학습 진척도",
    metricLabelEn: "Progress",
    metricValue: "68%",
    metricToneClassName: "text-[var(--kr-gov-blue)]",
    note: "12시간 남음",
    noteEn: "12 hours remaining",
    action: "학습 이어가기",
    actionEn: "Continue learning",
    progress: 68,
    imageClassName: "from-slate-700 via-slate-600 to-indigo-700"
  },
  {
    id: "active-2",
    category: "전문 자격",
    categoryEn: "Professional Certification",
    title: "온실가스 관리 기사 실전 마스터",
    titleEn: "Practical Greenhouse Gas Engineer Master",
    summary: "모의고사와 최종 과제까지 포함된 자격 대비 과정입니다.",
    summaryEn: "A certification-prep course with mock tests and final assignments.",
    status: "제출 대기",
    statusEn: "Pending Submission",
    statusClassName: "bg-orange-500 text-white",
    metricLabel: "최종 과제",
    metricLabelEn: "Final Assignment",
    metricValue: "D-3",
    metricToneClassName: "text-orange-600",
    note: "모의고사 2회 완료",
    noteEn: "2 mock exams completed",
    action: "과제 제출하기",
    actionEn: "Submit assignment",
    progress: 92,
    imageClassName: "from-stone-700 via-orange-700 to-amber-500"
  },
  {
    id: "active-3",
    category: "데이터 분석",
    categoryEn: "Data Analytics",
    title: "기업 ESG 공시 데이터 프로세싱",
    titleEn: "Enterprise ESG Disclosure Data Processing",
    summary: "데이터 정제와 리포트 자동화 역량을 강화하는 수료 완료 과정입니다.",
    summaryEn: "A completed course focused on data refinement and report automation.",
    status: "수료 완료",
    statusEn: "Completed",
    statusClassName: "bg-emerald-500 text-white",
    metricLabel: "최종 성적",
    metricLabelEn: "Final Grade",
    metricValue: "Grade A+",
    metricToneClassName: "text-emerald-600",
    note: "자격 증명 발급됨",
    noteEn: "Credential issued",
    action: "수료증 출력",
    actionEn: "Print certificate",
    progress: 100,
    imageClassName: "from-emerald-700 via-teal-700 to-slate-700"
  }
];

const INTEREST_COURSES: InterestCourse[] = [
  {
    id: "wish-1",
    format: "온라인",
    formatEn: "Online",
    formatClassName: "bg-gray-100 text-gray-500",
    favorite: true,
    title: "RE100 이행을 위한 재생에너지 조달 실무",
    titleEn: "Renewable Procurement Practice for RE100",
    meta: "학습 시간 18시간 · 정원 50명",
    metaEn: "18 hours · Capacity 50",
    price: "무료",
    action: "수강신청",
    actionEn: "Enroll"
  },
  {
    id: "wish-2",
    format: "오프라인",
    formatEn: "Offline",
    formatClassName: "bg-blue-100 text-[var(--kr-gov-blue)]",
    favorite: true,
    title: "ISO 14064-1 온실가스 타당성 확인 심사원 교육",
    titleEn: "ISO 14064-1 Verification Auditor Training",
    meta: "학습 시간 40시간 · 모집중",
    metaEn: "40 hours · Open for registration",
    price: "₩450,000",
    action: "상세보기",
    actionEn: "View details"
  },
  {
    id: "wish-3",
    format: "온라인",
    formatEn: "Online",
    formatClassName: "bg-gray-100 text-gray-500",
    favorite: false,
    title: "순환경제 구축을 위한 플라스틱 재활용 기술",
    titleEn: "Plastic Recycling Technology for Circular Economy",
    meta: "학습 시간 8시간 · 신규",
    metaEn: "8 hours · New",
    price: "무료",
    action: "수강신청",
    actionEn: "Enroll"
  }
];

const SKILL_BARS = [
  { label: "탄소 배출 산정 (L1)", labelEn: "Carbon Accounting (L1)", value: "82%", width: "82%", toneClassName: "bg-indigo-500" },
  { label: "에너지 효율 컨설팅", labelEn: "Energy Efficiency Consulting", value: "45%", width: "45%", toneClassName: "bg-indigo-300" },
  { label: "기후 변화 규제 대응", labelEn: "Climate Regulation Response", value: "95%", width: "95%", toneClassName: "bg-indigo-600" }
];

const CERTIFICATES = [
  { title: "온실가스 관리 기사", titleEn: "Greenhouse Gas Engineer", date: "2024.12.15", icon: "badge", iconClassName: "bg-blue-50 text-blue-600" },
  { title: "GRI 심화 수료증", titleEn: "GRI Advanced Certificate", date: "2025.02.01", icon: "school", iconClassName: "bg-emerald-50 text-emerald-600" }
];

const BADGES = [
  { label: "ESG 기본", labelEn: "ESG Basics", icon: "verified", iconClassName: "bg-indigo-100 text-indigo-600", locked: false },
  { label: "Net-Zero", labelEn: "Net-Zero", icon: "nature", iconClassName: "bg-emerald-100 text-emerald-600", locked: false },
  { label: "데이터 전문가", labelEn: "Data Expert", icon: "leaderboard", iconClassName: "bg-amber-100 text-amber-600", locked: false },
  { label: "정책 컨설턴트", labelEn: "Policy Consultant", icon: "lock", iconClassName: "bg-gray-100 text-gray-400", locked: true }
];

const DISTRIBUTION = [
  { label: "수료 완료", labelEn: "Completed", value: "8", dotClassName: "bg-teal-500" },
  { label: "수강 중", labelEn: "In Progress", value: "3", dotClassName: "bg-indigo-500" },
  { label: "대기", labelEn: "Queued", value: "1", dotClassName: "bg-orange-400" }
];

function includesKeyword(values: string[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return values.some((value) => value.toLowerCase().includes(normalized));
}

export function EduProgressMigrationPage() {
  const en = isEnglish();
  const [query, setQuery] = useState("");

  const filteredActiveCourses = useMemo(
    () =>
      ACTIVE_COURSES.filter((course) =>
        includesKeyword(
          [course.title, course.titleEn, course.summary, course.summaryEn, course.category, course.categoryEn],
          query
        )
      ),
    [query]
  );

  const filteredInterestCourses = useMemo(
    () =>
      INTEREST_COURSES.filter((course) =>
        includesKeyword([course.title, course.titleEn, course.meta, course.metaEn, course.format, course.formatEn], query)
      ),
    [query]
  );

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service | Skills and Capability Development Hub" : "대한민국 정부 공식 서비스 | 자격 및 역량 개발 허브",
    guideline: en ? "My learning level: Expert (Level 4)" : "나의 학습 레벨: Expert (Level 4)",
    brandTitle: "Certification Hub",
    brandSubtitle: "Skill Development & Education",
    topNote: en ? "Learner" : "수강생",
    topName: en ? "Learner Lee" : "이현장님",
    analyzerTitle: en ? "Skill Gap Analyzer" : "Skill Gap Analyzer",
    analyzerEyebrow: en ? "Personalized Recommendation" : "Personalized Recommendation",
    analyzerBody: en
      ? 'Based on your selected "Carbon Neutral Strategy Consultant" path, data governance and advanced LCA capability need reinforcement.'
      : '설정하신 "탄소중립 전략 컨설턴트" 경로를 분석한 결과, 현재 데이터 거버넌스 및 LCA 심화 역량이 보완이 필요합니다.',
    analyzerAction: en ? "Run diagnostics again" : "역량 진단 다시 하기",
    recommendationTitle: en ? "Recommended learning courses for you" : "당신을 위한 추천 학습 코스",
    searchPlaceholder: en ? "Search for skills, certificates, or instructors..." : "배우고 싶은 기술, 자격증, 또는 강사명을 입력하세요...",
    filterLabel: en ? "Filters" : "필터",
    showAll: en ? "View all courses" : "전체 강의 보기",
    activeTitle: en ? "Courses in progress" : "진행 중인 교육 과정",
    activeBody: en ? "Courses currently in progress or about to begin." : "현재 수강 중이거나 곧 시작될 교육 목록입니다.",
    downloadAction: en ? "Download learning history" : "학습 이력 다운로드",
    interestTitle: en ? "Courses of interest" : "관심 있는 교육 과정",
    interestBody: en ? "Wish list (4)" : "찜한 목록 (4)",
    viewAll: en ? "View all" : "전체보기",
    findMore: en ? "Find more courses" : "과정 더 찾아보기",
    achievementTitle: "My Achievement Dashboard",
    achievementBody: en ? "Review learning outcomes and certification status at a glance." : "나의 학습 성과와 자격 획득 현황을 한눈에 확인하세요.",
    achievementUpdated: en ? "Last update: 1 hour ago" : "마지막 업데이트: 1시간 전",
    skillTitle: en ? "Overall skill proficiency" : "전체 기술 숙련도",
    expLabel: "Total Exp",
    expValue: "14,250 XP",
    expBody: en ? "Top 5% learner. 750 XP left until the next tier." : "상위 5% 학습자입니다. 다음 등급까지 750 XP 남음",
    badgeTitle: en ? "Certificates and badges earned" : "획득 자격증 및 배지",
    distributionTitle: en ? "Learning distribution and completion status" : "학습 분포 및 완료 현황",
    growthNote: en ? "Learning growth +12%" : "학습 성장률 +12%",
    footerOrg: en ? "CCUS Capability Development Division" : "CCUS 역량개발본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Learning Support Center: 02-987-6543" : "(04551) 서울특별시 중구 세종대로 110 | 학습 지원 센터: 02-987-6543",
    footerService: en ? "This service is optimized to cultivate CCUS specialists for future-value creation." : "본 서비스는 미래 가치 창출을 위한 CCUS 전문 인력 양성을 위해 최적화되었습니다.",
    footerLinks: en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"],
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-focus" as string]: "#005fde",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-[100] focus:bg-[var(--kr-gov-blue)] focus:p-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.topNote}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.topName}</span>
            </div>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 transition-colors hover:bg-indigo-100" type="button">
              <span className="material-symbols-outlined text-indigo-600">psychology</span>
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-[8px] font-bold text-white">2</span>
            </button>
            <HomeButton onClick={() => navigate(buildLocalizedPath("/mypage", "/en/mypage"))}>{en ? "My page" : "마이페이지"}</HomeButton>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/progress")} onEn={() => navigate("/en/edu/progress")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-[#0f172a] py-12" data-help-id="edu-progress-hero">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "40px 40px"
            }}
          />
          <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 lg:px-8 xl:flex-row xl:items-start">
            <div className="xl:w-1/3" data-help-id="edu-progress-journey">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/20">
                  <span className="material-symbols-outlined text-[32px] text-white">analytics</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{copy.analyzerTitle}</h2>
                  <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.24em] text-indigo-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    {copy.analyzerEyebrow}
                  </p>
                </div>
              </div>
              <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <p className="mb-4 text-sm leading-7 text-slate-300">{copy.analyzerBody}</p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded border border-white/20 bg-white/10 px-2 py-1 font-medium text-white">데이터 분석: 85%</span>
                  <span className="rounded border border-white/20 bg-white/10 px-2 py-1 font-medium text-white">{en ? "Policy literacy: 92%" : "정책 이해: 92%"}</span>
                  <span className="rounded border border-indigo-500/40 bg-indigo-500/30 px-2 py-1 font-bold text-indigo-300">{en ? "LCA expertise: 45%" : "LCA 전문성: 45%"}</span>
                </div>
              </div>
              <HomeButton className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-300" onClick={() => {}}>
                <span className="material-symbols-outlined text-[18px]">trending_up</span>
                {copy.analyzerAction}
              </HomeButton>
            </div>

            <div className="w-full xl:w-2/3" data-help-id="edu-progress-guidance">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                {copy.recommendationTitle}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {RECOMMENDED_COURSES.map((course) => (
                  <article className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10" key={course.id}>
                    <div className="mb-3 flex items-start justify-between">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${course.accentClassName}`}>{course.badge}</span>
                      <span className="text-[10px] font-bold text-slate-500">{en ? course.statEn : course.stat}</span>
                    </div>
                    <h4 className="mb-1 text-base font-bold text-white">{en ? course.titleEn : course.title}</h4>
                    <p className="mb-6 text-xs leading-6 text-slate-400">{en ? course.summaryEn : course.summary}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        <span className="h-6 w-6 rounded-full border-2 border-slate-900 bg-gray-400" />
                        <span className="h-6 w-6 rounded-full border-2 border-slate-900 bg-gray-500" />
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 bg-gray-600 text-[8px] text-white">+12</span>
                      </div>
                      <button className="flex items-center gap-1 text-xs font-bold text-indigo-400 group-hover:underline" type="button">
                        {en ? course.metaEn : course.meta}
                        <span className="material-symbols-outlined text-[14px]">{course.icon}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-8 max-w-7xl px-4 lg:px-8" data-help-id="edu-progress-filters">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl md:flex-row">
            <div className="relative w-full flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <HomeInput
                className="h-14 border-none bg-gray-50 pl-12 pr-4"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                value={query}
              />
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <HomeButton className="h-14 flex-1 justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:ring-gray-300 md:flex-none" onClick={() => {}}>
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
                {copy.filterLabel}
              </HomeButton>
              <HomeButton className="h-14 flex-1 justify-center md:flex-none" onClick={() => setQuery("")}>{copy.showAll}</HomeButton>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8" id="education-courses">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black" data-help-id="edu-progress-board">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">list_alt</span>
                {copy.activeTitle}
              </h2>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{copy.activeBody}</p>
            </div>
            <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50" type="button">
              {copy.downloadAction}
            </button>
          </div>

          <div className="mb-16 grid gap-8 lg:grid-cols-3">
            {filteredActiveCourses.map((course) => (
              <article className={`overflow-hidden rounded-[var(--kr-gov-radius)] border bg-white transition-all hover:shadow-xl ${course.id === "active-3" ? "border-blue-100 bg-blue-50/30" : "border-[var(--kr-gov-border-light)]"}`} key={course.id}>
                <div className={`relative h-40 bg-gradient-to-br ${course.imageClassName}`}>
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.5))]" />
                  <div className="absolute left-4 top-4">
                    <span className={`rounded px-2 py-1 text-[10px] font-bold shadow-lg ${course.statusClassName}`}>{en ? course.statusEn : course.status}</span>
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${course.metricToneClassName}`}>{en ? course.categoryEn : course.category}</span>
                    <h3 className="mt-1 text-lg font-black transition-colors hover:text-[var(--kr-gov-blue)]">{en ? course.titleEn : course.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? course.summaryEn : course.summary}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-500">{en ? course.metricLabelEn : course.metricLabel}</span>
                      <span className={course.metricToneClassName}>{course.metricValue}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${course.id === "active-2" ? "bg-orange-500" : course.id === "active-3" ? "bg-emerald-500" : "bg-[var(--kr-gov-blue)]"}`} style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="material-symbols-outlined text-[16px]">{course.id === "active-1" ? "timer" : course.id === "active-2" ? "description" : "verified"}</span>
                      {en ? course.noteEn : course.note}
                    </div>
                    <HomeButton
                      className={course.id === "active-2" ? "bg-orange-600 hover:bg-orange-700 focus-visible:ring-orange-300" : course.id === "active-3" ? "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-300" : "bg-gray-50 text-[var(--kr-gov-blue)] hover:bg-blue-100 focus-visible:ring-blue-200"}
                      onClick={() => {}}
                    >
                      {en ? course.actionEn : course.action}
                    </HomeButton>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-700">
              {copy.interestTitle}
              <span className="ml-2 text-sm font-normal text-gray-400">{copy.interestBody}</span>
            </h2>
            <button className="flex items-center gap-1 text-sm font-bold text-[var(--kr-gov-blue)]" type="button">
              {copy.viewAll}
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {filteredInterestCourses.map((course) => (
              <article className="rounded-xl border border-gray-100 bg-white p-5 transition-all hover:shadow-md" key={course.id}>
                <div className="mb-4 flex justify-between">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${course.formatClassName}`}>{en ? course.formatEn : course.format}</span>
                  <span className={course.favorite ? "text-pink-500" : "text-gray-300"}>
                    <span className="material-symbols-outlined text-[20px]" style={course.favorite ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
                  </span>
                </div>
                <h4 className="mb-2 min-h-[2.5rem] text-sm font-bold text-gray-800">{en ? course.titleEn : course.title}</h4>
                <div className="mb-4 text-[11px] text-gray-400">{en ? course.metaEn : course.meta}</div>
                <div className="flex items-center justify-between">
                  <span className="font-black text-gray-800">{course.price}</span>
                  <button className="text-xs font-bold text-[var(--kr-gov-blue)]" type="button">{en ? course.actionEn : course.action}</button>
                </div>
              </article>
            ))}

            <button className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-6 transition-all hover:border-[var(--kr-gov-blue)] hover:bg-blue-50/30" type="button">
              <span className="material-symbols-outlined mb-2 text-[32px] text-gray-300 group-hover:text-[var(--kr-gov-blue)]">add_circle</span>
              <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--kr-gov-blue)]">{copy.findMore}</span>
            </button>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white py-16" data-help-id="edu-progress-competency">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="mb-1 text-3xl font-black">{copy.achievementTitle}</h2>
                <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)]">{copy.achievementBody}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                <span className="material-symbols-outlined text-[16px]">sync</span>
                {copy.achievementUpdated}
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <section className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-8">
                <h3 className="mb-8 flex items-center gap-2 text-base font-bold text-gray-700">
                  <span className="material-symbols-outlined text-[20px] text-indigo-600">query_stats</span>
                  {copy.skillTitle}
                </h3>
                <div className="flex-1 space-y-6">
                  {SKILL_BARS.map((bar) => (
                    <div className="space-y-2" key={bar.label}>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-600">{en ? bar.labelEn : bar.label}</span>
                        <span className="text-indigo-600">{bar.value}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full border border-gray-200 bg-white">
                        <div className={`h-full ${bar.toneClassName}`} style={{ width: bar.width }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <span className="block text-[10px] font-bold uppercase text-gray-400">{copy.expLabel}</span>
                      <span className="text-xl font-black tracking-tighter text-indigo-600">{copy.expValue}</span>
                    </div>
                    <div className="text-xs leading-5 text-gray-500">{copy.expBody}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-gray-50 p-8" data-help-id="edu-progress-activity">
                <h3 className="mb-8 flex items-center gap-2 text-base font-bold text-gray-700">
                  <span className="material-symbols-outlined text-[20px] text-amber-500">workspace_premium</span>
                  {copy.badgeTitle}
                </h3>
                <div className="mb-8 grid grid-cols-4 gap-4">
                  {BADGES.map((badge) => (
                    <div className={`flex cursor-help flex-col items-center gap-2 ${badge.locked ? "grayscale opacity-40" : ""}`} key={badge.label}>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 ${badge.iconClassName}`}>
                        <span className="material-symbols-outlined">{badge.icon}</span>
                      </div>
                      <span className="text-center text-[10px] font-bold text-gray-400">{en ? badge.labelEn : badge.label}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {CERTIFICATES.map((certificate) => (
                    <article className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3" key={certificate.title}>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded ${certificate.iconClassName}`}>
                          <span className="material-symbols-outlined text-sm">{certificate.icon}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700">{en ? certificate.titleEn : certificate.title}</p>
                          <p className="text-[10px] text-gray-400">{certificate.date}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-sm text-gray-300">open_in_new</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
                <h3 className="mb-8 flex items-center gap-2 text-base font-bold text-gray-700">
                  <span className="material-symbols-outlined text-[20px] text-teal-600">donut_large</span>
                  {copy.distributionTitle}
                </h3>
                <div className="flex items-center gap-8">
                  <div className="relative h-32 w-32">
                    <svg className="h-full w-full -rotate-90">
                      <circle className="text-gray-200" cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" strokeWidth="12" />
                      <circle className="text-teal-500" cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" strokeDasharray="339" strokeDashoffset="68" strokeLinecap="round" strokeWidth="12" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-gray-800">12</span>
                      <span className="text-[10px] font-bold uppercase text-gray-400">Courses</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    {DISTRIBUTION.map((item) => (
                      <div className="flex items-center justify-between text-xs" key={item.label}>
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
                          {en ? item.labelEn : item.label}
                        </span>
                        <span className="font-black text-gray-800">{item.value}</span>
                      </div>
                    ))}
                    <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-[11px] font-bold text-emerald-700">
                      <span className="material-symbols-outlined text-[16px]">trending_up</span>
                      {copy.growthNote}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2025 CCUS Skill Hub. Ambitious Learners Education Portal."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
