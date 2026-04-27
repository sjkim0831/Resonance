import { useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type MethodologyCard = {
  icon: string;
  toneClassName: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
};

type CurriculumLesson = {
  title: string;
  titleEn: string;
  duration: string;
  highlighted?: boolean;
};

type CurriculumModule = {
  number: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  highlighted?: boolean;
  lessons?: CurriculumLesson[];
};

type InstructorCard = {
  name: string;
  nameEn: string;
  badge: string;
  badgeEn: string;
  badgeClassName: string;
  bio: string;
  bioEn: string;
  quote: string;
  quoteEn: string;
  imageUrl: string;
};

type Testimonial = {
  author: string;
  authorEn: string;
  quote: string;
  quoteEn: string;
  rating: 4 | 5;
};

const METHODOLOGY_CARDS: MethodologyCard[] = [
  {
    icon: "video_library",
    toneClassName: "text-indigo-500",
    title: "무제한 다시보기",
    titleEn: "Unlimited Replay",
    body: "수강 기간 내 모든 강의를 횟수 제한 없이 자유롭게 반복 학습 가능합니다.",
    bodyEn: "Replay every lecture freely during the enrollment period without view limits."
  },
  {
    icon: "lab_profile",
    toneClassName: "text-emerald-500",
    title: "실무 템플릿 제공",
    titleEn: "Practical Templates",
    body: "배출량 산정 시트, 품질보증 체크리스트 등 실제 현장 서식을 제공합니다.",
    bodyEn: "Provides field-ready worksheets, assurance checklists, and reporting templates."
  },
  {
    icon: "forum",
    toneClassName: "text-blue-500",
    title: "1:1 질의응답",
    titleEn: "1:1 Expert Q&A",
    body: "현업 전문가 강사진이 24시간 이내에 학습 질문에 직접 답변합니다.",
    bodyEn: "Industry experts answer learner questions directly within 24 hours."
  }
];

const CURRICULUM_MODULES: CurriculumModule[] = [
  {
    number: "01",
    title: "기후변화 대응 체계 및 NDC 로드맵 이해",
    titleEn: "Climate Response Framework and NDC Roadmap",
    subtitle: "글로벌 규제 동향 및 국가 온실가스 목표 분석",
    subtitleEn: "Global regulation trends and national greenhouse gas target analysis",
    lessons: [
      {
        title: "파리협정 이후의 글로벌 탄소 무역 장벽 (CBAM 포함)",
        titleEn: "Global carbon trade barriers after the Paris Agreement, including CBAM",
        duration: "15:00"
      },
      {
        title: "국가 온실가스 감축 목표(NDC) 상세 분해",
        titleEn: "Detailed breakdown of the Nationally Determined Contribution roadmap",
        duration: "22:00"
      }
    ]
  },
  {
    number: "02",
    title: "조직 경계 설정 및 배출원 규명",
    titleEn: "Organizational Boundary Setting and Source Identification",
    subtitle: "ISO 14064-1 기반의 배출 인벤토리 구축 실무",
    subtitleEn: "Practical inventory design based on ISO 14064-1"
  },
  {
    number: "03",
    title: "Tier 기반 배출량 산정 방법론 심화",
    titleEn: "Advanced Tier-Based Emissions Methodology",
    subtitle: "이 과정의 핵심: 직접 vs 간접 배출 산정 로직",
    subtitleEn: "Core module: direct vs indirect emission accounting logic",
    highlighted: true,
    lessons: [
      {
        title: "고정연소 및 이동연소 배출 계수 적용법",
        titleEn: "Applying emission factors to stationary and mobile combustion",
        duration: "45:00",
        highlighted: true
      },
      {
        title: "전력 및 열 에너지 간접 배출 산정 절차",
        titleEn: "Indirect accounting procedure for electricity and heat energy",
        duration: "30:00"
      }
    ]
  }
];

const INSTRUCTORS: InstructorCard[] = [
  {
    name: "김탄소 박사",
    nameEn: "Dr. Kim Carbon",
    badge: "현장 검증 전문가",
    badgeEn: "Field Verification Expert",
    badgeClassName: "text-indigo-600 bg-indigo-50",
    bio: "전) 한국에너지공단 온실가스 검증 심사원\n현) CCUS 통합관리본부 기술 자문위원",
    bioEn: "Former greenhouse gas verification auditor at KEMCO\nCurrent technical advisor at the CCUS Integrated Office",
    quote: "\"실제 검증 현장에서 가장 많이 발생하는 오류 사례를 중심으로 명확한 가이드를 제시해 드립니다.\"",
    quoteEn: "\"I focus on the most common field verification errors and show how to prevent them clearly.\"",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAyTVJ5jySpbm3-fA6ETuKIPg2zCenpzRJYkFjjyedUhl0j8Ju3vWw0K9CoCQi8X_LkfRau5Jgyy4muzueR39SlbJC2rvZMpjBwTAoXp1FiqxRlEGNW7ym73PCC97GlK4In0mEojSPJRyHbNPt-0jWOD2R6aVBleNinn-6L9QPFWdRUCR2l3ceZuZ39NN0tzfgTHSowGzR4kVhJ29En_TFxMFpapxZ8rn81CDy0wU7hgMxJjGzdHvdo-DtpMJYHzGMaRjlapn6ku2M"
  },
  {
    name: "이그린 수석",
    nameEn: "Lee Green, Principal",
    badge: "전략 컨설턴트",
    badgeEn: "Strategy Consultant",
    badgeClassName: "text-emerald-600 bg-emerald-50",
    bio: "ESG 지속가능경영 보고서 작성 실무\n글로벌 공정 배출계수 산정 로직 설계",
    bioEn: "Hands-on ESG sustainability reporting\nDesigning global process emission factor logic",
    quote: "\"숫자로 증명하는 탄소중립, 데이터의 신뢰성을 확보하는 전략적 접근법을 공유합니다.\"",
    quoteEn: "\"I share a strategic approach for proving net zero with credible, defensible data.\"",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-GNkqvc1vKrKdRVexuf3on8CxcXrup7v_BsTMjMu6QGh_zvH3Ox3TepedEe8Rth-PSwSLRIBJAPgE3GgN-o4HmRpaTe5GRRFEA6lSjH8HJoEL3eKvG_uaqZALzcg6Cy1mEySgoO95HIbsUCiAKv_1bKzMwBiPclUdHPzsiHY5w7iF2l7COGMLbs5lW66zvhrY5Pgmy1ucLexEiVygSGh9I0LtEBDQUbBYUinDinvDx1ji0AOG7Qhuo-64vDW9eV1lv4dbkced5Go"
  }
];

const TESTIMONIALS: Testimonial[] = [
  {
    author: "박*준 (제조업체 관리자)",
    authorEn: "Park *jun (Manufacturing Manager)",
    quote: "막막했던 배출량 산정이 강의를 들으면서 명확해졌습니다. 특히 제공해주신 엑셀 템플릿은 바로 실무에 적용할 수 있을 정도로 완성도가 높습니다.",
    quoteEn: "Emission accounting used to feel vague, but the lectures made it practical. The Excel templates were polished enough to use immediately at work.",
    rating: 5
  },
  {
    author: "최*영 (컨설팅 사)",
    authorEn: "Choi *young (Consulting Firm)",
    quote: "이론보다는 실제 사례 위주로 구성되어 있어 이해가 빠릅니다. 현업 담당자라면 반드시 들어야 할 필수 강의라고 생각합니다.",
    quoteEn: "It is built around real cases rather than abstract theory, so understanding comes fast. For working practitioners, this feels essential.",
    rating: 4
  }
];

const SUB_NAV_ITEMS = [
  { id: "methodology", label: "학습 방법론", labelEn: "Methodology" },
  { id: "curriculum", label: "커리큘럼 상세", labelEn: "Curriculum" },
  { id: "prerequisites", label: "수강 대상", labelEn: "Audience" },
  { id: "instructors", label: "강사진 소개", labelEn: "Instructors" },
  { id: "testimonials", label: "수강생 후기", labelEn: "Reviews" }
];

function SectionTitle(props: { id: string; title: string }) {
  return (
    <h3 className="mb-6 flex scroll-mt-36 items-center gap-2 text-2xl font-black" id={props.id}>
      <span className="h-8 w-2 rounded-full bg-[var(--kr-gov-blue)]" />
      {props.title}
    </h3>
  );
}

export function EduCourseDetailMigrationPage() {
  const en = isEnglish();
  const [expandedModule, setExpandedModule] = useState("03");

  const copy = useMemo(() => ({
    brandTitle: en ? "Carbon Neutral Expert Academy" : "탄소중립 전문가 양성과정",
    brandSubtitle: "Expert Training Academy",
    navList: en ? "Course Catalog" : "교육 과정 목록",
    navDetail: en ? "Course Detail" : "과정 상세",
    navClassroom: en ? "My Classroom" : "나의 강의실",
    managerName: en ? "Manager Lee Hyun-jang" : "이현장 관리자님",
    managerStatus: en ? "2 certified completions" : "인증 수료 완료 2건",
    courseTitle: en ? "Practical NDC Response and Verification Strategy" : "국가 온실가스 감축 목표(NDC) 대응 실무 및 검증 전략",
    ratingMeta: en ? "(128 reviews)" : "(128개 리뷰)",
    applyCta: en ? "Enroll Now" : "수강 신청하기",
    heroBadge: "BEST SELLER",
    heroTitle: en ? "Master Class for Strengthening Carbon Market Response Capability" : "탄소 배출권 거래제 대응을 위한\n핵심 실무 역량 강화 마스터 클래스",
    heroBody: en ? "A field-oriented course designed around real corporate emission accounting and verification workflows." : "실제 기업 배출량 산정 및 검증 프로세스를 바탕으로 설계된 현장 중심의 교육 과정입니다.",
    curriculumMeta: en ? "12 modules / 24 hours total" : "총 12개 모듈 / 24시간 과정",
    audienceTitle: en ? "Target Audience" : "수강 대상",
    audienceItems: en
      ? [
          "Corporate greenhouse gas and ESG practitioners",
          "Managers designing carbon neutrality response strategy",
          "Job seekers and consultants in environment and energy"
        ]
      : [
          "기업 온실가스 관리 담당자 (ESG 실무자)",
          "탄소 중립 대응 전략을 수립하는 관리자",
          "환경/에너지 분야 취업 준비생 및 컨설턴트"
        ],
    prerequisiteTitle: en ? "Recommended Prerequisites" : "선수 학습 추천",
    prerequisiteItems: en
      ? [
          "Basic carbon neutrality concepts (CCUS-Basic recommended)",
          "Basic Excel skills for data aggregation"
        ]
      : [
          "탄소중립 기본 개념 (CCUS-Basic 수료 권장)",
          "기초적인 엑셀 활용 능력 (데이터 집계용)"
        ],
    reviewAll: en ? "View all 128 reviews" : "수강 후기 128개 모두 보기",
    price: en ? "KRW 450,000" : "₩ 450,000",
    originalPrice: en ? "KRW 600,000" : "₩ 600,000",
    discount: "25% OFF",
    benefitItems: en
      ? [
          { icon: "schedule", text: "Access period: Unlimited (lifetime access)" },
          { icon: "verified_user", text: "Certificate: Available with verification number" },
          { icon: "download", text: "Materials: Combined PDF/PPT pack included" }
        ]
      : [
          { icon: "schedule", text: "수강 기간: 무제한 (평생 소장)" },
          { icon: "verified_user", text: "수료증: 발급 가능 (인증 번호 부여)" },
          { icon: "download", text: "강의 자료: PDF/PPT 통합 제공" }
        ],
    payNow: en ? "Pay Now" : "지금 바로 결제하기",
    addCart: en ? "Add to Cart" : "장바구니 담기",
    paymentGuide: en
      ? "Secure payment is enabled. Full refund available before the course starts. Separate policy applies after access begins."
      : "안심 결제 시스템이 적용되었습니다.\n수강 시작 전 100% 환불 가능 (수강 시작 후 별도 규정 적용)",
    groupBenefitTitle: en ? "Group Enrollment Benefits" : "단체 수강 혜택",
    groupBenefitBody: en ? "Up to 40% discount is available for groups of five or more learners." : "5인 이상 수강 시 최대 40% 할인 혜택을 드립니다.",
    groupBenefitCta: en ? "Contact for Corporate Training" : "기업 교육 문의하기",
    footerTitle: en ? "CCUS Education Academy" : "CCUS 교육 아카데미",
    footerAddress: en
      ? "110 Sejong-daero, Jung-gu, Seoul | Education Support Team: 02-1234-5678 | help@ccus-edu.go.kr"
      : "서울특별시 중구 세종대로 110 | 교육 지원팀: 02-1234-5678 | help@ccus-edu.go.kr",
    footerBody: en
      ? "This platform operates to strengthen greenhouse gas reduction education and practical capability for enterprises."
      : "본 플랫폼은 기업의 온실가스 감축 교육 및 실무 역량 강화를 위해 운영됩니다.",
    footerLinks: en ? ["Privacy Policy", "Terms of Use", "Learning Guide"] : ["개인정보처리방침", "이용약관", "학습가이드"],
    copyright: en ? "© 2025 CCUS Carbon Footprint Academy. All Rights Reserved." : "© 2025 CCUS Carbon Footprint Academy. All Rights Reserved."
  }), [en]);

  return (
    <div
      className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f8fafc",
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white shadow-sm">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex shrink-0 items-center gap-3">
              <a className="flex items-center gap-2" href={buildLocalizedPath("/edu/course_list", "/en/edu/course_list")}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>school</span>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black leading-tight tracking-tight text-[var(--kr-gov-text-primary)]">{copy.brandTitle}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{copy.brandSubtitle}</p>
                </div>
              </a>
            </div>
            <nav className="ml-12 hidden h-full flex-1 items-center space-x-1 xl:flex" data-help-id="edu-course-detail-primary-nav">
              <a className="flex h-full items-center border-b-4 border-transparent px-4 text-[15px] font-bold text-gray-500 transition-all hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/edu/course_list", "/en/edu/course_list")}>{copy.navList}</a>
              <a className="flex h-full items-center border-b-4 border-[var(--kr-gov-blue)] px-4 text-[15px] font-bold text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/edu/course_detail", "/en/edu/course_detail")}>{copy.navDetail}</a>
              <a className="flex h-full items-center border-b-4 border-transparent px-4 text-[15px] font-bold text-gray-500 transition-all hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/mypage", "/en/mypage")}>{copy.navClassroom}</a>
            </nav>
            <div className="flex items-center gap-4">
              <div className="mr-2 hidden text-right md:flex md:flex-col md:items-end">
                <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.managerName}</span>
                <span className="text-[10px] font-bold text-indigo-600">{copy.managerStatus}</span>
              </div>
              <button className="rounded-full bg-gray-100 p-2 transition-colors hover:bg-gray-200" type="button">
                <span className="material-symbols-outlined text-gray-600">notifications</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-20 z-40 border-b border-gray-200 bg-white shadow-sm" data-help-id="edu-course-detail-summary-bar">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4 overflow-hidden">
            <h2 className="truncate text-lg font-bold">{copy.courseTitle}</h2>
            <div className="hidden shrink-0 items-center gap-1 text-amber-500 sm:flex">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              <span className="text-sm font-bold">4.8</span>
              <span className="text-xs font-medium text-gray-400">{copy.ratingMeta}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-lg font-black text-[var(--kr-gov-blue)] md:block">{copy.price}</span>
            <button
              className="flex items-center gap-2 rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-2.5 font-bold text-white transition-all hover:bg-[var(--kr-gov-blue-hover)]"
              onClick={() => navigate(buildLocalizedPath("/edu/apply", "/en/edu/apply"))}
              type="button"
            >
              {copy.applyCta}
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <div className="sticky top-36 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-md" data-help-id="edu-course-detail-section-nav">
        <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-3 lg:px-8">
          {SUB_NAV_ITEMS.map((item) => (
            <a
              className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
              href={`#${item.id}`}
              key={item.id}
            >
              {en ? item.labelEn : item.label}
            </a>
          ))}
        </div>
      </div>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8" id="main-content">
        <div className="space-y-12 lg:w-2/3">
          <section className="group relative aspect-video overflow-hidden rounded-2xl bg-slate-900" data-help-id="edu-course-detail-hero">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.5),transparent_35%),linear-gradient(135deg,#0f172a_10%,#1e293b_55%,#111827_100%)]" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-900/80 to-transparent p-8">
              <span className="mb-4 inline-block w-fit rounded-full bg-indigo-500 px-3 py-1 text-[11px] font-bold text-white">{copy.heroBadge}</span>
              <h3 className="mb-2 whitespace-pre-line text-3xl font-black leading-tight text-white">{copy.heroTitle}</h3>
              <p className="max-w-lg text-slate-300">{copy.heroBody}</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--kr-gov-blue)] shadow-xl" type="button">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
          </section>

          <section data-help-id="edu-course-detail-methodology">
            <SectionTitle id="methodology" title={en ? "Learning Methodology" : "학습 방법론"} />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {METHODOLOGY_CARDS.map((item) => (
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm" key={item.title}>
                  <span className={`material-symbols-outlined mb-4 text-[32px] ${item.toneClassName}`}>{item.icon}</span>
                  <h4 className="mb-2 font-bold">{en ? item.titleEn : item.title}</h4>
                  <p className="text-sm leading-relaxed text-gray-500">{en ? item.bodyEn : item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section data-help-id="edu-course-detail-curriculum">
            <div className="mb-6 flex items-center justify-between">
              <SectionTitle id="curriculum" title={en ? "Curriculum Details" : "커리큘럼 상세"} />
              <span className="text-sm font-medium text-gray-400">{copy.curriculumMeta}</span>
            </div>
            <div className="space-y-4">
              {CURRICULUM_MODULES.map((module) => {
                const expanded = expandedModule === module.number;
                return (
                  <div
                    className={`overflow-hidden rounded-xl border bg-white ${module.highlighted ? "border-[var(--kr-gov-blue)] ring-1 ring-[var(--kr-gov-blue)]" : "border-gray-200"}`}
                    key={module.number}
                  >
                    <button
                      className={`flex w-full items-center justify-between px-6 py-5 text-left transition-colors ${module.highlighted ? "bg-blue-50/30" : "bg-gray-50/50 hover:bg-gray-100"}`}
                      onClick={() => setExpandedModule((current) => current === module.number ? "" : module.number)}
                      type="button"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-indigo-600">{module.number}</span>
                        <div>
                          <h4 className="font-bold text-gray-800">{en ? module.titleEn : module.title}</h4>
                          <p className={`mt-1 text-xs ${module.highlighted ? "font-bold text-blue-600" : "text-gray-400"}`}>{en ? module.subtitleEn : module.subtitle}</p>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined ${module.highlighted ? "text-blue-600" : "text-gray-400"}`}>{expanded ? "expand_less" : "expand_more"}</span>
                    </button>
                    {expanded && module.lessons ? (
                      <div className={`px-6 py-4 ${module.highlighted ? "border-t border-blue-100" : "border-t border-gray-100"}`}>
                        <ul className="space-y-3">
                          {module.lessons.map((lesson) => (
                            <li className={`flex items-center justify-between rounded p-2 text-sm ${lesson.highlighted ? "bg-indigo-50/50" : ""}`} key={lesson.title}>
                              <div className={`flex items-center gap-2 ${lesson.highlighted ? "font-bold" : ""}`}>
                                <span className={`material-symbols-outlined text-[18px] ${lesson.highlighted ? "text-indigo-600" : "text-gray-300"}`}>play_circle</span>
                                <span>{en ? lesson.titleEn : lesson.title}</span>
                              </div>
                              <span className={lesson.highlighted ? "font-bold text-indigo-600" : "text-gray-400"}>{lesson.duration}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section data-help-id="edu-course-detail-prerequisites">
            <SectionTitle id="prerequisites" title={en ? "Audience and Prerequisites" : "수강 대상 및 선수 학습"} />
            <div className="flex flex-col gap-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-8 md:flex-row">
              <div className="flex-1">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-indigo-900">
                  <span className="material-symbols-outlined text-lg">groups</span>
                  {copy.audienceTitle}
                </h4>
                <ul className="space-y-2 text-sm text-indigo-800">
                  {copy.audienceItems.map((item) => <li className="flex items-start gap-2" key={item}>• {item}</li>)}
                </ul>
              </div>
              <div className="hidden w-px bg-indigo-200 md:block" />
              <div className="flex-1">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-indigo-900">
                  <span className="material-symbols-outlined text-lg">menu_book</span>
                  {copy.prerequisiteTitle}
                </h4>
                <ul className="space-y-2 text-sm text-indigo-800">
                  {copy.prerequisiteItems.map((item) => <li className="flex items-start gap-2" key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section data-help-id="edu-course-detail-instructors">
            <SectionTitle id="instructors" title={en ? "Meet the Instructors" : "강사진 소개"} />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {INSTRUCTORS.map((instructor) => (
                <div className="flex gap-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm" key={instructor.name}>
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gray-200">
                    <img alt={en ? instructor.nameEn : instructor.name} className="h-full w-full object-cover" src={instructor.imageUrl} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-lg font-black">{en ? instructor.nameEn : instructor.name}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${instructor.badgeClassName}`}>{en ? instructor.badgeEn : instructor.badge}</span>
                    </div>
                    <p className="mb-3 whitespace-pre-line text-[12px] text-gray-500">{en ? instructor.bioEn : instructor.bio}</p>
                    <p className="line-clamp-2 text-xs text-gray-400">{en ? instructor.quoteEn : instructor.quote}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-12" data-help-id="edu-course-detail-testimonials">
            <SectionTitle id="testimonials" title={en ? "Learner Reviews" : "수강생 후기"} />
            <div className="space-y-4">
              {TESTIMONIALS.map((item) => (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-6" key={item.author}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex text-amber-500">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span className="material-symbols-outlined text-[16px]" key={`${item.author}-${index}`} style={{ fontVariationSettings: `'FILL' ${index < item.rating ? 1 : 0}` }}>star</span>
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-gray-400">{en ? item.authorEn : item.author}</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-gray-700">"{en ? item.quoteEn : item.quote}"</p>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full rounded-xl border border-dashed border-gray-300 py-4 text-sm font-bold text-gray-400 transition-all hover:border-indigo-600 hover:bg-white hover:text-indigo-600" type="button">
              {copy.reviewAll}
            </button>
          </section>
        </div>

        <aside className="lg:w-1/3">
          <div className="sticky top-40 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl" data-help-id="edu-course-detail-purchase">
              <div className="p-8">
                <div className="mb-6 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-900">{copy.price}</span>
                  <span className="text-sm font-bold text-gray-400 line-through">{copy.originalPrice}</span>
                  <span className="text-sm font-black text-red-500">{copy.discount}</span>
                </div>
                <ul className="mb-8 space-y-4">
                  {copy.benefitItems.map((item) => (
                    <li className="flex items-center gap-3 text-sm text-gray-600" key={item.text}>
                      <span className="material-symbols-outlined text-[20px] text-indigo-500">{item.icon}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3">
                  <button
                    className="w-full rounded-xl bg-[var(--kr-gov-blue)] py-4 font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-[var(--kr-gov-blue-hover)]"
                    onClick={() => navigate(buildLocalizedPath("/edu/apply", "/en/edu/apply"))}
                    type="button"
                  >
                    {copy.payNow}
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-4 font-bold text-gray-700 transition-all hover:bg-gray-50" type="button">
                    <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                    {copy.addCart}
                  </button>
                </div>
                <p className="mt-6 whitespace-pre-line text-center text-[11px] text-gray-400">{copy.paymentGuide}</p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-slate-900 p-6" data-help-id="edu-course-detail-group-benefit">
              <div className="relative z-10">
                <h4 className="mb-2 text-lg font-black text-white">{copy.groupBenefitTitle}</h4>
                <p className="mb-4 text-xs leading-relaxed text-slate-400">{copy.groupBenefitBody}</p>
                <a className="inline-flex items-center text-xs font-bold text-indigo-400 transition-all hover:gap-2" href={buildLocalizedPath("/mtn/my_inquiry", "/en/mtn/my_inquiry")}>
                  {copy.groupBenefitCta}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </a>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 rotate-12 text-[100px] text-white opacity-5">corporate_fare</span>
            </div>
          </div>
        </aside>
      </main>

      <footer className="mt-20 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-gray-400">school</span>
                <span className="text-lg font-black text-gray-800">{copy.footerTitle}</span>
              </div>
              <address className="not-italic text-sm leading-relaxed text-gray-500">
                {copy.footerAddress}
                <br />
                {copy.footerBody}
              </address>
            </div>
            <div className="flex gap-8 text-sm font-bold text-gray-500">
              {copy.footerLinks.map((item) => (
                <a className="hover:text-[var(--kr-gov-blue)]" href="#" key={item}>{item}</a>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 text-xs text-gray-400 md:flex-row">
            <p>{copy.copyright}</p>
            <div className="flex gap-4">
              <img
                alt={en ? "Government mark" : "정부상징"}
                className="h-6 opacity-30"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default EduCourseDetailMigrationPage;
