import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton } from "../home-ui/common";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  homePath: string;
  heroTitle: string;
  heroBody: string;
  placeholder: string;
  search: string;
  recommended: string;
  recommendedKeywords: string[];
  faqTitle: string;
  faqSubtitle: string;
  moreFaq: string;
  noticeTitle: string;
  noticeSubtitle: string;
  viewAll: string;
  quickTitle: string;
  quickBody: string;
  quickPrimary: string;
  quickSecondary: string;
  footerOrg: string;
  footerAddress: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  displayRole: string;
  displayName: string;
  logout: string;
};

type FaqItem = { id: string; question: string; answer: string };
type NoticeItem = { type: string; date: string; title: string; summary: string; tone: "urgent" | "update" | "notice" };

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    homePath: "/home",
    heroTitle: "무엇을 도와드릴까요?",
    heroBody: "감독관님의 원활한 업무 처리를 위해 핵심 가이드와 공지사항을 제공합니다.",
    placeholder: "도움말, 규정, 시설 코드 등을 검색하세요...",
    search: "검색",
    recommended: "추천 검색어",
    recommendedKeywords: ["배출계수 산정", "증빙서류 반려 사유", "정기 점검 일정"],
    faqTitle: "자주 묻는 질문 (FAQ)",
    faqSubtitle: "Frequently Asked Questions",
    moreFaq: "자주 묻는 질문 더보기",
    noticeTitle: "중요 공지사항",
    noticeSubtitle: "Critical Announcements",
    viewAll: "전체보기",
    quickTitle: "빠른 지원",
    quickBody: "문의 등록, 자료실, AI 가이드로 바로 이동해 필요한 지원을 빠르게 찾을 수 있습니다.",
    quickPrimary: "문의 등록하기",
    quickSecondary: "자료실 보기",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    displayRole: "총괄 책임자",
    displayName: "이현장 관리자님",
    logout: "로그아웃"
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    homePath: "/en/home",
    heroTitle: "How can we help?",
    heroBody: "Get fast answers, operating guides, and important notices for site supervisors.",
    placeholder: "Search guides, policy terms, or facility codes...",
    search: "Search",
    recommended: "Recommended",
    recommendedKeywords: ["Emission factor calculation", "Rejected evidence", "Inspection schedule"],
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Support Knowledge Base",
    moreFaq: "View More Questions",
    noticeTitle: "Critical Announcements",
    noticeSubtitle: "Latest Updates",
    viewAll: "View All",
    quickTitle: "Quick Support",
    quickBody: "Jump directly to inquiry registration, file library, or the AI guide for faster support.",
    quickPrimary: "Open Inquiry",
    quickSecondary: "Open Library",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Field Support Team: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "Last Updated:",
    footerWaAlt: "Web Accessibility Quality Mark",
    displayRole: "Chief Overseer",
    displayName: "Lee Hyeon-jang",
    logout: "Logout"
  }
};

const FAQS: Record<"ko" | "en", FaqItem[]> = {
  ko: [
    { id: "Q1", question: "에너지 고지서 대조 시 불일치 알림이 뜨는 경우 해결 방법은?", answer: "오차가 5%를 초과하면 시스템이 자동 탐지합니다. 단위 설정과 소수점 입력을 먼저 확인한 뒤, 반복 불일치 시 오차 소명서를 첨부해 제출해 주세요." },
    { id: "Q2", question: "Tier 3 산정 로직 적용 시 필요한 추가 증빙 서류 목록은?", answer: "원료 탄소 함량 분석 결과서, 유량계 교정 성적서, 공정 흐름도 내 계측 지점 명시 서류가 필요합니다. 상세 양식은 자료실에서 받을 수 있습니다." },
    { id: "Q3", question: "검증 완료 후 보고서 수정이 가능한가요?", answer: "검증 완료 보고서는 원칙적으로 수정할 수 없습니다. 다만 오기나 단순 누락은 수정 신청서 승인 후 한시적으로 수정 권한이 부여됩니다." },
    { id: "Q4", question: "신규 배출지 등록 시 시설 코드는 어떻게 발급받나요?", answer: "사업장 등록 번호와 공정 유형을 기준으로 시스템이 자동 생성합니다. 신규 배출지 등록 단계에서 즉시 확인할 수 있습니다." }
  ],
  en: [
    { id: "Q1", question: "How do I resolve a mismatch alert during utility bill reconciliation?", answer: "The system flags gaps above 5% automatically. Review unit settings and decimal inputs first, then attach an explanation memo if the mismatch persists." },
    { id: "Q2", question: "Which supporting documents are required for Tier 3 calculation logic?", answer: "Prepare the carbon content analysis report, flowmeter calibration certificate, and process map showing measurement points." },
    { id: "Q3", question: "Can a report be edited after verification is completed?", answer: "Verified reports are normally locked. Minor typos or omissions can be corrected only after an approved revision request." },
    { id: "Q4", question: "How is the facility code issued for a new emission site?", answer: "The platform generates it automatically from the business registration number and process type during registration." }
  ]
};

const NOTICES: Record<"ko" | "en", NoticeItem[]> = {
  ko: [
    { type: "Urgent", date: "2026.04.02", title: "시스템 보안 점검에 따른 서비스 일시 중단 안내", summary: "오늘 자정부터 오전 4시까지 정기 보안 업데이트가 진행됩니다.", tone: "urgent" },
    { type: "Update", date: "2026.03.28", title: "FAQ 검색 및 지원 허브 기능 개선 배포", summary: "FAQ, 자료실, 문의 화면 간 이동성이 개선되었습니다.", tone: "update" },
    { type: "Notice", date: "2026.03.24", title: "2026년도 배출량 산정 지침 개정안 안내", summary: "최신 배출계수 및 산정 가이드라인을 확인해 주세요.", tone: "notice" },
    { type: "Notice", date: "2026.03.18", title: "현장 감독관 대상 온라인 워크숍 개최", summary: "플랫폼 활용 능력 향상을 위한 무료 교육 신청이 시작되었습니다.", tone: "notice" }
  ],
  en: [
    { type: "Urgent", date: "2026.04.02", title: "Scheduled service pause for security maintenance", summary: "Regular security updates will run from midnight to 4 AM tonight.", tone: "urgent" },
    { type: "Update", date: "2026.03.28", title: "FAQ search and support hub enhancements deployed", summary: "Navigation across FAQ, library, and inquiry pages has been improved.", tone: "update" },
    { type: "Notice", date: "2026.03.24", title: "2026 emission calculation guideline revision", summary: "Please review the latest factors and calculation guide.", tone: "notice" },
    { type: "Notice", date: "2026.03.18", title: "Online workshop for site supervisors", summary: "Registration for the free enablement session is now open.", tone: "notice" }
  ]
};

function noticeToneClass(tone: NoticeItem["tone"]) {
  if (tone === "urgent") return "bg-red-50 border-l-red-500 hover:bg-red-100";
  if (tone === "update") return "bg-blue-50 border-l-blue-500 hover:bg-blue-100";
  return "bg-gray-50 border-l-gray-300 hover:bg-gray-100";
}

function noticeBadgeClass(tone: NoticeItem["tone"]) {
  if (tone === "urgent") return "bg-red-500";
  if (tone === "update") return "bg-blue-500";
  return "bg-gray-500";
}

export function SupportFaqMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const faqs = useMemo(() => FAQS[en ? "en" : "ko"], [en]);
  const notices = useMemo(() => NOTICES[en ? "en" : "ko"], [en]);
  const [query, setQuery] = useState("");
  const filteredFaqs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return faqs;
    return faqs.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalized));
  }, [faqs, query]);

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandSubtitle="Site Overseer Control Center"
        brandTitle={en ? "Support Center" : "고객지원"}
        homeHref={copy.homePath}
        rightContent={
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/support/faq")} onKo={() => navigate("/support/faq")} />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.displayRole}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.displayName}</span>
            </div>
            <HomeButton className="min-h-0 rounded-[var(--kr-gov-radius)] px-4 py-2 text-sm" type="button" variant="primary">
              {copy.logout}
            </HomeButton>
          </div>
        }
      />

      <main id="main-content">
        <section className="relative overflow-hidden bg-slate-900 pb-20 pt-16" data-help-id="support-faq-hero">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%">
              <pattern id="faq-dots" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#faq-dots)" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[800px] px-4 text-center">
            <h1 className="mb-4 text-3xl font-black text-white md:text-4xl">{copy.heroTitle}</h1>
            <p className="mb-10 text-sm text-slate-400 md:text-base">{copy.heroBody}</p>
            <div className="group relative mx-auto max-w-[700px]">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 opacity-0 blur-xl transition-opacity group-focus-within:opacity-100" />
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-6 text-[28px] text-indigo-400">search</span>
                <input
                  className="h-16 w-full rounded-2xl border border-white/20 bg-white/10 pl-16 pr-24 text-lg font-medium text-white placeholder-slate-400 backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.placeholder}
                  type="text"
                  value={query}
                />
                <button className="absolute right-3 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500" type="button">
                  {copy.search}
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{copy.recommended}:</span>
              {copy.recommendedKeywords.map((keyword) => (
                <button className="text-xs text-indigo-400 underline decoration-indigo-400/30 hover:text-white" key={keyword} onClick={() => setQuery(keyword)} type="button">
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-10 max-w-[1440px] px-4 pb-20 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl lg:col-span-7" data-help-id="support-faq-accordion">
              <div className="mb-8 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined">help_center</span>
                </div>
                <div>
                  <h2 className="text-xl font-black">{copy.faqTitle}</h2>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{copy.faqSubtitle}</p>
                </div>
              </div>
              <div className="space-y-4">
                {filteredFaqs.map((item, index) => (
                  <details className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50" key={item.id} open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between p-5 focus:outline-none">
                      <span className="flex items-center gap-3 text-sm font-bold text-gray-800">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-600">{item.id}</span>
                        {item.question}
                      </span>
                      <span className="material-symbols-outlined text-gray-400">expand_more</span>
                    </summary>
                    <div className="px-14 pb-5">
                      <p className="text-sm leading-relaxed text-gray-600">{item.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-8 py-3 font-bold text-gray-500 transition-colors hover:bg-gray-50" type="button">
                  {copy.moreFaq}
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-8 lg:col-span-5">
              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 shadow-xl" data-help-id="support-faq-announcements">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <span className="material-symbols-outlined">campaign</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{copy.noticeTitle}</h2>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{copy.noticeSubtitle}</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))} type="button">
                    {copy.viewAll}
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
                <div className="max-h-[400px] space-y-4 overflow-y-auto pr-2">
                  {notices.map((notice) => (
                    <div className={`group cursor-pointer rounded-r-lg border-l-4 p-4 transition-all ${noticeToneClass(notice.tone)}`} key={`${notice.date}-${notice.title}`}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${noticeBadgeClass(notice.tone)}`}>{notice.type}</span>
                        <span className="text-[11px] font-bold text-gray-400">{notice.date}</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-800">{notice.title}</h3>
                      <p className="mt-1 text-xs text-gray-500">{notice.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-indigo-600 p-8 text-white shadow-xl" data-help-id="support-faq-quick-support">
                <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-black">{copy.quickTitle}</h2>
                  <p className="mt-3 text-sm leading-7 text-indigo-100">{copy.quickBody}</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50" type="button">
                      {copy.quickPrimary}
                    </button>
                    <button className="rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10" onClick={() => navigate(buildLocalizedPath("/support/download_list", "/en/support/download_list"))} type="button">
                      {copy.quickSecondary}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright={copy.footerCopyright}
        lastModifiedLabel={copy.footerLastModifiedLabel}
        orgName={copy.footerOrg}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
