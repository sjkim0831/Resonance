import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput } from "../home-ui/common";

type RenewalCard = {
  id: string;
  badgeKo: string;
  badgeEn: string;
  deadline: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  progress: number;
  actionKo: string;
  actionEn: string;
  toneClassName: string;
  progressClassName: string;
};

type LinkedCourse = {
  id: string;
  badgeKo: string;
  badgeEn: string;
  titleKo: string;
  titleEn: string;
  linkedCertKo: string;
  linkedCertEn: string;
  progress: number;
  moduleKo: string;
  moduleEn: string;
  actionKo: string;
  actionEn: string;
  completed?: boolean;
  toneClassName: string;
};

type CertificationRow = {
  id: string;
  nameKo: string;
  nameEn: string;
  licenseNo: string;
  issueDate: string;
  expiryDate: string;
  statusKo: string;
  statusEn: string;
  statusClassName: string;
};

type RoadmapItem = {
  id: string;
  monthKo: string;
  monthEn: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  actionKo?: string;
  actionEn?: string;
  dotClassName: string;
};

const RENEWAL_CARDS: RenewalCard[] = [
  {
    id: "renew-ghg",
    badgeKo: "만료 임박",
    badgeEn: "Expiring Soon",
    deadline: "D-12",
    titleKo: "온실가스관리기사",
    titleEn: "GHG Management Engineer",
    bodyKo: "필수 보수교육 미이수 시 자격 정지 대상입니다.",
    bodyEn: "The qualification may be suspended if refresher training is not completed.",
    progress: 20,
    actionKo: "교육 즉시 시작",
    actionEn: "Start training now",
    toneClassName: "border-l-red-500",
    progressClassName: "bg-red-500"
  },
  {
    id: "renew-auditor",
    badgeKo: "유지 관리",
    badgeEn: "Maintenance",
    deadline: "D-45",
    titleKo: "에너지진단사 1급",
    titleEn: "Energy Auditor Class 1",
    bodyKo: "전문역량 유지 목적의 심화 교육 수강이 권장됩니다.",
    bodyEn: "Advanced training is recommended to maintain professional readiness.",
    progress: 0,
    actionKo: "시험 일정 확인",
    actionEn: "Check exam schedule",
    toneClassName: "border-l-orange-500",
    progressClassName: "bg-orange-500"
  },
  {
    id: "renew-safety",
    badgeKo: "진행 중",
    badgeEn: "In Progress",
    deadline: "D-82",
    titleKo: "산업안전기사",
    titleEn: "Industrial Safety Engineer",
    bodyKo: "온라인 과정을 마치면 자동 갱신 절차로 이어집니다.",
    bodyEn: "The qualification will move into automatic renewal when the course is completed.",
    progress: 85,
    actionKo: "수료증 다운로드",
    actionEn: "Download certificate",
    toneClassName: "border-l-emerald-500",
    progressClassName: "bg-emerald-500"
  }
];

const LINKED_COURSES: LinkedCourse[] = [
  {
    id: "course-emission",
    badgeKo: "온라인 교육",
    badgeEn: "Online Training",
    titleKo: "배출권 거래 심화 과정",
    titleEn: "Emissions Trading Advanced Course",
    linkedCertKo: "연계 자격: 온실가스관리기사",
    linkedCertEn: "Linked cert: GHG Management Engineer",
    progress: 64,
    moduleKo: "04. 검증 대응 프로세스",
    moduleEn: "04. Verification response process",
    actionKo: "과정 이어보기",
    actionEn: "Resume course",
    toneClassName: "border-t-indigo-500"
  },
  {
    id: "course-safety",
    badgeKo: "오프라인 실습",
    badgeEn: "Offline Practice",
    titleKo: "CCUS 플랜트 안전감독",
    titleEn: "CCUS Plant Safety Supervision",
    linkedCertKo: "연계 자격: 산업안전기사",
    linkedCertEn: "Linked cert: Industrial Safety Engineer",
    progress: 100,
    moduleKo: "전 과정 이수 완료",
    moduleEn: "All courses successfully completed",
    actionKo: "갱신 신청",
    actionEn: "Apply for renewal",
    completed: true,
    toneClassName: "border-t-emerald-500"
  }
];

const CERTIFICATION_ROWS: CertificationRow[] = [
  {
    id: "cert-ghg",
    nameKo: "온실가스관리기사",
    nameEn: "GHG Management Engineer",
    licenseNo: "20-Q3-00452",
    issueDate: "2020.10.12",
    expiryDate: "2025.10.11",
    statusKo: "갱신 필요",
    statusEn: "Renewal Required",
    statusClassName: "bg-red-100 text-red-600 border border-red-200"
  },
  {
    id: "cert-safety",
    nameKo: "산업안전기사",
    nameEn: "Industrial Safety Engineer",
    licenseNo: "18-Q1-09881",
    issueDate: "2018.03.15",
    expiryDate: "2026.03.14",
    statusKo: "유효",
    statusEn: "Valid",
    statusClassName: "bg-emerald-100 text-emerald-600 border border-emerald-200"
  },
  {
    id: "cert-auditor",
    nameKo: "에너지진단사 1급",
    nameEn: "Energy Auditor Class 1",
    licenseNo: "22-D4-00129",
    issueDate: "2022.12.01",
    expiryDate: "2025.11.30",
    statusKo: "갱신 준비중",
    statusEn: "Pending Renewal",
    statusClassName: "bg-orange-100 text-orange-600 border border-orange-200"
  }
];

const ROADMAP: RoadmapItem[] = [
  {
    id: "oct",
    monthKo: "2025.10",
    monthEn: "Oct 2025",
    titleKo: "온실가스관리기사 만료",
    titleEn: "GHG management expiry",
    bodyKo: "필수 교육 마감: 2025.09.30까지",
    bodyEn: "Mandatory training deadline: by 2025.09.30",
    actionKo: "제출처 확인",
    actionEn: "Check venue",
    dotClassName: "bg-red-500 ring-4 ring-red-100"
  },
  {
    id: "nov",
    monthKo: "2025.11",
    monthEn: "Nov 2025",
    titleKo: "에너지진단사 갱신 기간",
    titleEn: "Energy auditor renewal window",
    bodyKo: "시험 접수 시작: 2025.10.15부터",
    bodyEn: "Exam registration starts from 2025.10.15",
    actionKo: "알림 등록",
    actionEn: "Set reminder",
    dotClassName: "bg-orange-400 ring-4 ring-orange-50"
  },
  {
    id: "mar",
    monthKo: "2026.03",
    monthEn: "Mar 2026",
    titleKo: "산업안전기사 자동 갱신",
    titleEn: "Safety engineer auto-renewal",
    bodyKo: "과정 100% 완료 후 다음 갱신 절차 자동 반영",
    bodyEn: "The next renewal process is automated after 100% completion.",
    dotClassName: "bg-blue-400 ring-4 ring-blue-50"
  }
];

export function EduContentMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const renewalCards = useMemo(
    () => RENEWAL_CARDS.filter((item) => `${item.titleKo} ${item.titleEn} ${item.bodyKo} ${item.bodyEn}`.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery]
  );
  const certificationRows = useMemo(
    () => CERTIFICATION_ROWS.filter((item) => `${item.nameKo} ${item.nameEn} ${item.licenseNo}`.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery]
  );

  useEffect(() => {
    logGovernanceScope("PAGE", "edu-content", {
      language: en ? "en" : "ko",
      query,
      renewalCount: renewalCards.length,
      certificationCount: certificationRows.length,
      userType: session.value?.authorCode || "guest"
    });
  }, [certificationRows.length, en, query, renewalCards.length, session.value?.authorCode]);

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    governmentText: en ? "Official ROK Government Service | Training and qualification linkage center" : "대한민국 정부 공식 서비스 | 교육 및 자격 연계 관리센터",
    guidelineText: en ? "Planner sync: just now" : "플래너 동기화: 방금 전",
    brandTitle: en ? "Qualification & Training" : "자격 및 교육 연계",
    brandSubtitle: en ? "Compliance and Education Planner" : "자격 갱신 및 교육 플래너",
    navDashboard: en ? "Dashboard" : "대시보드",
    navPlanner: en ? "Renewal Planner" : "자격 연계",
    navProgress: en ? "Training Progress" : "진도 관리",
    navPolicy: en ? "Compliance Guide" : "법정 준수",
    managerLabel: en ? "Certification Head" : "자격 관리 책임자",
    managerName: en ? "Admin Lee Hyeon-jang" : "이현장 관리자",
    heroTitle: en ? "Renewal Planner" : "자격 갱신 플래너",
    heroBody: en
      ? "Three certifications expire within the next 90 days. Link refresher training and renewal actions early to keep the operation compliant."
      : "향후 90일 내 만료되는 자격이 3건 있습니다. 보수교육과 갱신 절차를 미리 연결해 운영 준수 상태를 유지합니다.",
    optimizeButton: en ? "Auto-optimize renewal schedule" : "갱신 일정 자동 최적화",
    registerButton: en ? "Register for training" : "교육 등록하기",
    timelineTitle: en ? "Upcoming renewal timeline" : "다가오는 갱신 타임라인",
    sectionLinkage: en ? "Training progress and certification linkage" : "교육 진도 및 자격 연계",
    viewAll: en ? "View all" : "전체 보기",
    applyTraining: en ? "Apply training" : "교육 신청",
    ledgerTitle: en ? "Integrated certification ledger" : "통합 자격 현황 원장",
    totalCerts: en ? "Total 5 certifications" : "총 5개 자격",
    roadmapTitle: en ? "Annual renewal roadmap" : "연간 갱신 로드맵",
    complianceTitle: en ? "Qualification compliance report" : "자격 준수 리포트",
    recommendationTitle: en ? "AI recommendation" : "AI 추천",
    recommendationBody: en
      ? "To match the inspection schedule of Ulsan Site 3, complete the Energy Auditor renewal within October."
      : "울산 제3 화학기지 점검 일정에 맞추려면 에너지진단사 갱신 절차를 10월 안에 완료하는 것이 좋습니다.",
    recommendedCourses: en ? "View recommended courses" : "추천 과정 보기",
    searchPlaceholder: en ? "Search certification, course, or license number" : "자격명, 과정명, 면허번호 검색",
    tableName: en ? "Certification name" : "자격명",
    tableLicense: en ? "License no." : "면허번호",
    tableIssued: en ? "Issue date" : "발급일",
    tableExpiry: en ? "Expiry date" : "만료일",
    tableStatus: en ? "Status" : "상태",
    footerOrg: en ? "CCUS Integrated HQ" : "CCUS 통합본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul" : "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: en ? "Training and certification support: 02-1234-5678" : "교육 및 자격 지원센터 02-1234-5678",
    footerCopyright: en ? "© 2026 CCUS Carbon Footprint Platform. Qualification and Education Portal." : "© 2026 CCUS Carbon Footprint Platform. 자격 및 교육 포털.",
    footerLinks: en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"],
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-focus" as string]: "#005fde",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
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
            <nav className="hidden items-center space-x-1 xl:flex">
              <button className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/edu/course_list", "/en/edu/course_list"))} type="button">{copy.navDashboard}</button>
              <button className="rounded-full bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white" onClick={() => navigate(buildLocalizedPath("/edu/content", "/en/edu/content"))} type="button">{copy.navPlanner}</button>
              <button className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/edu/progress", "/en/edu/progress"))} type="button">{copy.navProgress}</button>
              <button className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/edu/certificate", "/en/edu/certificate"))} type="button">{copy.navPolicy}</button>
            </nav>
            <div className="hidden md:flex flex-col items-end pr-2">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.managerLabel}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.managerName}</span>
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/content")} onEn={() => navigate("/en/edu/content")} />
            <HomeButton onClick={() => void session.logout()} size="sm" variant="primary">{en ? "Logout" : "로그아웃"}</HomeButton>
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-900 py-10" data-help-id="edu-content-hero">
          <div className="absolute inset-0 opacity-10">
            <svg className="h-full w-full" aria-hidden="true">
              <pattern id="edu-content-dots" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#edu-content-dots)" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
              <div className="xl:w-1/4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/20">
                    <span className="material-symbols-outlined text-[28px] text-white">calendar_today</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{copy.heroTitle}</h2>
                    <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      {en ? "Proactive Compliance" : "선제 준수 대응"}
                    </p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-400">{copy.heroBody}</p>
                <div className="space-y-2">
                  <HomeButton className="w-full justify-center border border-white/20 bg-white/10 text-white hover:bg-white/15" icon="event_repeat" onClick={() => navigate(buildLocalizedPath("/edu/content", "/en/edu/content"))} variant="secondary">{copy.optimizeButton}</HomeButton>
                  <HomeButton className="w-full justify-center bg-indigo-600 text-white hover:bg-indigo-700" icon="add_task" onClick={() => navigate(buildLocalizedPath("/edu/apply", "/en/edu/apply"))}>{copy.registerButton}</HomeButton>
                </div>
              </div>
              <div className="w-full xl:w-3/4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    {copy.timelineTitle}
                  </h3>
                  <div className="w-full max-w-sm">
                    <HomeInput className="border-white/10 bg-white/5 text-white placeholder:text-slate-500" onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} value={query} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-help-id="edu-content-renewal">
                  {renewalCards.map((item) => (
                    <article className={`flex flex-col rounded-r-lg border border-white/10 border-l-4 bg-white/5 p-5 backdrop-blur-md transition hover:bg-white/10 ${item.toneClassName}`} key={item.id}>
                      <div className="mb-3 flex items-start justify-between">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${item.progressClassName} bg-opacity-20 text-white`}>{en ? item.badgeEn : item.badgeKo}</span>
                        <span className="text-[10px] font-bold tracking-tight text-slate-400">{item.deadline}</span>
                      </div>
                      <h4 className="mb-1 text-[15px] font-bold text-white">{en ? item.titleEn : item.titleKo}</h4>
                      <p className="mb-4 text-[11px] text-slate-400">{en ? item.bodyEn : item.bodyKo}</p>
                      <div className="mb-4">
                        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                          <span>{en ? "Renewal Progress" : "갱신 진행률"}</span>
                          <span className="font-bold text-white">{item.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${item.progressClassName}`} style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                      <button className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300" type="button">
                        {en ? item.actionEn : item.actionKo}
                        <span className="material-symbols-outlined text-[14px]">launch</span>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-2xl font-black">
                    <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                    {copy.sectionLinkage}
                  </h2>
                  <div className="flex gap-2">
                    <button className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50" onClick={() => navigate(buildLocalizedPath("/edu/my_course", "/en/edu/my_course"))} type="button">{copy.viewAll}</button>
                    <button className="rounded bg-[var(--kr-gov-blue)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => navigate(buildLocalizedPath("/edu/apply", "/en/edu/apply"))} type="button">{copy.applyTraining}</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2" data-help-id="edu-content-linked-courses">
                  {LINKED_COURSES.map((course) => (
                    <article className={`flex h-full flex-col rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm ${course.toneClassName}`} key={course.id}>
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <span className={`mb-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${course.completed ? "border border-emerald-200 bg-emerald-100 text-emerald-700" : "border border-indigo-200 bg-indigo-100 text-indigo-700"}`}>{en ? course.badgeEn : course.badgeKo}</span>
                          <h3 className="text-lg font-bold">{en ? course.titleEn : course.titleKo}</h3>
                          <p className="mt-1 text-xs text-gray-500">{en ? course.linkedCertEn : course.linkedCertKo}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-black tracking-tight ${course.completed ? "text-emerald-600" : "text-indigo-600"}`}>{course.progress}%</span>
                          <p className="text-[10px] font-bold uppercase text-gray-400">{en ? "Progress" : "진도율"}</p>
                        </div>
                      </div>
                      <div className="mb-5 h-3 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full ${course.completed ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${course.progress}%` }} />
                      </div>
                      <div className={`rounded-lg p-4 text-sm ${course.completed ? "border border-emerald-100 bg-emerald-50 text-emerald-800" : "bg-gray-50 text-gray-700"}`}>
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined ${course.completed ? "text-emerald-600" : "text-indigo-500"}`}>{course.completed ? "verified_user" : "play_circle"}</span>
                          <span className="font-medium">{en ? course.moduleEn : course.moduleKo}</span>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-3">
                        <button className="flex-1 rounded border border-gray-200 bg-gray-50 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-100" onClick={() => navigate(buildLocalizedPath("/edu/progress", "/en/edu/progress"))} type="button">{en ? "View history" : "이력 보기"}</button>
                        <button className={`flex-1 rounded py-2.5 text-xs font-bold text-white transition ${course.completed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`} onClick={() => navigate(course.completed ? buildLocalizedPath("/edu/certificate", "/en/edu/certificate") : buildLocalizedPath("/edu/progress", "/en/edu/progress"))} type="button">
                          {en ? course.actionEn : course.actionKo}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <section className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm" data-help-id="edu-content-ledger">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4">
                  <h3 className="flex items-center gap-2 font-bold">
                    <span className="material-symbols-outlined text-gray-500">badge</span>
                    {copy.ledgerTitle}
                  </h3>
                  <span className="text-[11px] font-bold text-gray-400">{copy.totalCerts}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-6 py-3">{copy.tableName}</th>
                        <th className="px-6 py-3">{copy.tableLicense}</th>
                        <th className="px-6 py-3">{copy.tableIssued}</th>
                        <th className="px-6 py-3">{copy.tableExpiry}</th>
                        <th className="px-6 py-3">{copy.tableStatus}</th>
                        <th className="px-6 py-3 text-right">{en ? "Action" : "작업"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {certificationRows.map((item) => (
                        <tr className="transition-colors hover:bg-gray-50" key={item.id}>
                          <td className="px-6 py-4 font-bold text-gray-800">{en ? item.nameEn : item.nameKo}</td>
                          <td className="px-6 py-4 font-mono text-gray-500">{item.licenseNo}</td>
                          <td className="px-6 py-4 text-gray-500">{item.issueDate}</td>
                          <td className={`px-6 py-4 ${item.statusClassName.includes("red") ? "font-bold text-red-500" : "text-gray-500"}`}>{item.expiryDate}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.statusClassName}`}>{en ? item.statusEn : item.statusKo}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="material-symbols-outlined text-gray-400 hover:text-[var(--kr-gov-blue)]" type="button">more_vert</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-8 lg:col-span-4">
              <section className="relative overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-6 shadow-sm" data-help-id="edu-content-roadmap">
                <div className="relative z-10">
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-black">
                    <span className="material-symbols-outlined text-amber-500">schedule</span>
                    {copy.roadmapTitle}
                  </h3>
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-0 h-full w-0.5 bg-gray-100" />
                    {ROADMAP.map((item) => (
                      <div className="relative mb-10 last:mb-0" key={item.id}>
                        <div className={`absolute -left-[23px] top-0 h-3 w-3 rounded-full ${item.dotClassName}`} />
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{en ? item.monthEn : item.monthKo}</p>
                        <h4 className="text-sm font-bold text-gray-800">{en ? item.titleEn : item.titleKo}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{en ? item.bodyEn : item.bodyKo}</p>
                        {item.actionKo ? (
                          <button className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline" type="button">
                            {en ? item.actionEn : item.actionKo}
                            <span className="material-symbols-outlined text-[14px]">launch</span>
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm" data-help-id="edu-content-compliance">
                <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-600">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  {copy.complianceTitle}
                </h3>
                <div className="mb-8 flex items-center gap-6">
                  <div className="relative h-24 w-24">
                    <svg className="h-full w-full -rotate-90">
                      <circle className="text-gray-100" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                      <circle className="text-amber-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset="50" strokeLinecap="round" strokeWidth="8" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-black">80%</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "Fully compliant" : "완전 준수"}</span><span className="font-bold">4</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">{en ? "In progress / grace" : "진행중/유예"}</span><span className="font-bold">1</span></div>
                    <div className="mt-4 flex items-center gap-1 rounded border border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      {en ? "1 non-compliance risk detected" : "비준수 위험 1건 감지"}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  <p className="text-[11px] font-bold text-gray-400">{copy.recommendationTitle}</p>
                  <p className="text-xs leading-relaxed text-gray-700">{copy.recommendationBody}</p>
                  <button className="w-full rounded border border-gray-200 bg-white py-2 text-[11px] font-bold text-gray-600 transition hover:bg-gray-100" onClick={() => navigate(buildLocalizedPath("/edu/course_list", "/en/edu/course_list"))} type="button">{copy.recommendedCourses}</button>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        orgName={copy.footerOrg}
        addressLine={copy.footerAddress}
        serviceLine={copy.footerServiceLine}
        copyright={copy.footerCopyright}
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}

export default EduContentMigrationPage;
