import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter
} from "../../components/user-shell/UserPortalChrome";

type FeaturedCard = {
  id: string;
  tone: "critical" | "faq" | "resource";
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  summaryEn: string;
  actionKo: string;
  actionEn: string;
};

type SupportEntry = {
  id: string;
  kind: "QNA" | "NOTICE" | "RESOURCE";
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  summaryEn: string;
  tagKo: string;
  tagEn: string;
  date: string;
  views: number;
  statusKo?: string;
  statusEn?: string;
  answered?: boolean;
  downloadLabelKo?: string;
  downloadLabelEn?: string;
};

const quickKeywords = {
  ko: ["#에너지공단검증", "#Tier3산정", "#보완서류양식"],
  en: ["#KoreaEnergyValidation", "#Tier3Calculation", "#EvidenceTemplate"]
};

const featuredCards: FeaturedCard[] = [
  {
    id: "featured-notice",
    tone: "critical",
    titleKo: "2026년 상반기 배출량 검증 일정 변경 안내",
    titleEn: "Updated Schedule for the 2026 First-Half Emission Verification",
    summaryKo: "국가 온실가스 산정 지침 개정 반영으로 검증 접수와 현장 점검 일정이 일부 조정되었습니다.",
    summaryEn: "Verification intake and on-site inspection dates have been adjusted to reflect the revised national GHG guidelines.",
    actionKo: "상세보기",
    actionEn: "View details"
  },
  {
    id: "featured-faq",
    tone: "faq",
    titleKo: "Tier 3 산정 시 공정별 누락 데이터 보정 방법",
    titleEn: "How to Correct Missing Process Data in Tier 3 Calculations",
    summaryKo: "누락 구간이 있는 경우 선형 보간과 대체 증빙 적용 기준을 함께 확인할 수 있습니다.",
    summaryEn: "Review both interpolation guidance and substitute-evidence rules for missing sections in Tier 3 workflows.",
    actionKo: "해결 방법 보기",
    actionEn: "Open solution"
  },
  {
    id: "featured-resource",
    tone: "resource",
    titleKo: "최신 업종별 탄소 배출계수 데이터북(2026)",
    titleEn: "Updated Carbon Emission Factor Databook by Industry (2026)",
    summaryKo: "산정 자동화와 보고서 검증에 사용하는 최신 배출계수, API 연계 규격, 샘플 파일이 포함됩니다.",
    summaryEn: "Includes the latest factors, API linkage specifications, and sample files used for calculation automation and report review.",
    actionKo: "다운로드 페이지",
    actionEn: "Download page"
  }
];

const supportEntries: SupportEntry[] = [
  {
    id: "QNA-240814",
    kind: "QNA",
    titleKo: "외부 열원(스팀) 사용량 산정 시 단위 환산 오류 문제",
    titleEn: "Unit Conversion Issue When Calculating External Heat Source (Steam) Usage",
    summaryKo: "Mcal 단위를 GJ 단위로 환산할 때 계수 적용 시 소수점 처리 기준이 어떻게 되나요?",
    summaryEn: "What decimal handling rule should be applied when converting Mcal into GJ for coefficient-based calculations?",
    tagKo: "데이터산정",
    tagEn: "Data Calculation",
    date: "2026.03.31",
    views: 1204,
    statusKo: "답변완료",
    statusEn: "Answered",
    answered: true
  },
  {
    id: "RES-240812",
    kind: "RESOURCE",
    titleKo: "온실가스 배출권거래제 운영을 위한 검증 지침 전문 (개정 2026.03)",
    titleEn: "Full Verification Guidance for the Emissions Trading Scheme (Updated Mar 2026)",
    summaryKo: "시설별 필수 증빙 자료 목록과 최신 검증 지침 전문을 내려받을 수 있습니다.",
    summaryEn: "Download the full verification guidance and the latest facility-by-facility evidence checklist.",
    tagKo: "법령지침",
    tagEn: "Policy Guide",
    date: "2026.03.29",
    views: 944,
    downloadLabelKo: "PDF (2.4MB)",
    downloadLabelEn: "PDF (2.4MB)"
  },
  {
    id: "NTC-240810",
    kind: "NOTICE",
    titleKo: "[안내] 통합 플랫폼 데이터 서버 점검 및 시스템 일시 중단 안내",
    titleEn: "[Notice] Temporary Service Interruption for Platform Data Server Maintenance",
    summaryKo: "점검 일시: 2026.04.06(일) 00:00 ~ 04:00, 해당 시간에는 보고서 제출과 일부 조회 기능이 제한됩니다.",
    summaryEn: "Maintenance window: Apr 6, 2026, 00:00-04:00. Report submission and some inquiry functions will be limited.",
    tagKo: "시스템점검",
    tagEn: "Maintenance",
    date: "2026.03.27",
    views: 1502
  },
  {
    id: "QNA-240808",
    kind: "QNA",
    titleKo: "복수 사업장 관리자 권한 이관 방법 문의",
    titleEn: "Question on Reassigning Administrator Authority Across Multiple Sites",
    summaryKo: "동일 법인 하 여러 배출지의 감독관 권한을 한 번에 이관하는 절차가 있는지 문의드립니다.",
    summaryEn: "Is there a single workflow to transfer supervisor authority across multiple emission sites under the same corporation?",
    tagKo: "계정관리",
    tagEn: "Account",
    date: "2026.03.25",
    views: 452,
    statusKo: "답변준비중",
    statusEn: "Pending",
    answered: false
  }
];

const categoryCounts = {
  ALL: 42,
  NOTICE: 12,
  QNA: 24,
  RESOURCE: 6
} as const;

const filterOptions = [
  { value: "ALL", labelKo: "전체", labelEn: "All" },
  { value: "Data Calculation", labelKo: "데이터산정", labelEn: "Data Calculation" },
  { value: "Report Review", labelKo: "보고서검증", labelEn: "Report Review" },
  { value: "System Error", labelKo: "시스템오류", labelEn: "System Error" },
  { value: "Account", labelKo: "계정관리", labelEn: "Account" },
  { value: "Policy Guide", labelKo: "법령지침", labelEn: "Policy Guide" }
] as const;

const sortOptions = [
  { value: "latest", labelKo: "최신순", labelEn: "Latest" },
  { value: "views", labelKo: "조회순", labelEn: "Most viewed" }
] as const;

function textOf(en: boolean, ko: string, english: string) {
  return en ? english : ko;
}

function featuredToneClass(tone: FeaturedCard["tone"]) {
  if (tone === "critical") {
    return "border-l-red-500 bg-white";
  }
  if (tone === "faq") {
    return "border-l-indigo-500 bg-white";
  }
  return "border-l-teal-500 bg-white";
}

function featuredBadgeClass(tone: FeaturedCard["tone"]) {
  if (tone === "critical") {
    return "bg-red-50 text-red-600";
  }
  if (tone === "faq") {
    return "bg-indigo-50 text-indigo-600";
  }
  return "bg-teal-50 text-teal-700";
}

function featuredBadgeLabel(tone: FeaturedCard["tone"], en: boolean) {
  if (tone === "critical") {
    return en ? "Critical Notice" : "주요 공지";
  }
  if (tone === "faq") {
    return en ? "Most Viewed FAQ" : "필독 FAQ";
  }
  return en ? "New Resource" : "신규 자료";
}

function entryBadgeClass(kind: SupportEntry["kind"]) {
  if (kind === "NOTICE") {
    return "border-red-100 bg-red-50 text-red-600";
  }
  if (kind === "RESOURCE") {
    return "border-indigo-100 bg-indigo-50 text-indigo-600";
  }
  return "border-orange-100 bg-orange-50 text-orange-600";
}

function entryIconClass(kind: SupportEntry["kind"]) {
  if (kind === "NOTICE") {
    return "bg-red-50 text-red-600";
  }
  if (kind === "RESOURCE") {
    return "bg-indigo-50 text-indigo-600";
  }
  return "bg-orange-50 text-orange-600";
}

function entryIcon(kind: SupportEntry["kind"]) {
  if (kind === "NOTICE") {
    return "campaign";
  }
  if (kind === "RESOURCE") {
    return "description";
  }
  return "quiz";
}

function entryKindLabel(kind: SupportEntry["kind"], en: boolean) {
  if (kind === "NOTICE") {
    return en ? "Notice" : "공지사항";
  }
  if (kind === "RESOURCE") {
    return en ? "Resource" : "자료실";
  }
  return "Q&A";
}

export function QnaListMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]["value"]>("ALL");
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["value"]>("latest");

  const filteredEntries = supportEntries
    .filter((entry) => {
      const matchesFilter = activeFilter === "ALL"
        || entry.tagEn === activeFilter
        || entry.tagKo === activeFilter;
      const lookup = [
        entry.titleKo,
        entry.titleEn,
        entry.summaryKo,
        entry.summaryEn,
        entry.tagKo,
        entry.tagEn
      ].join(" ").toLowerCase();
      const matchesKeyword = !keyword.trim() || lookup.includes(keyword.trim().toLowerCase());
      return matchesFilter && matchesKeyword;
    })
    .sort((left, right) => {
      if (sortBy === "views") {
        return right.views - left.views;
      }
      return right.date.localeCompare(left.date);
    });

  useEffect(() => {
    logGovernanceScope("PAGE", "qna-list", {
      language: en ? "en" : "ko",
      keyword,
      activeFilter,
      sortBy,
      resultCount: filteredEntries.length
    });
  }, [activeFilter, en, filteredEntries.length, keyword, sortBy]);

  return (
    <div
      className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar
        governmentText={en ? "Official Government Service | Carbon Footprint Support Portal" : "대한민국 정부 공식 서비스 | 탄소발자국 고객지원 포털"}
        guidelineText={en ? "Support desk hours 09:00-18:00" : "상담 운영 시간 09:00~18:00"}
      />

      <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 lg:px-8">
          <a className="flex shrink-0 items-center gap-3" href={buildLocalizedPath("/home", "/en/home")}>
            <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]">support_agent</span>
            <div className="flex flex-col">
              <h1 className="text-lg font-black leading-none text-[var(--kr-gov-text-primary)]">{en ? "Support Center" : "고객지원 센터"}</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">Help & Support Hub</p>
            </div>
          </a>

          <nav className="hidden h-full items-center gap-1 xl:flex">
            <button className="h-full border-b-4 border-transparent px-4 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
              {en ? "Dashboard" : "대시보드"}
            </button>
            <button className="h-full border-b-4 border-transparent px-4 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))} type="button">
              {en ? "Notices" : "공지사항"}
            </button>
            <button className="h-full border-b-4 border-[var(--kr-gov-blue)] px-4 text-[15px] font-black text-[var(--kr-gov-blue)]" type="button">
              Q&amp;A
            </button>
            <button className="h-full border-b-4 border-transparent px-4 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/support/faq", "/en/support/faq"))} type="button">
              {en ? "Resources" : "자료실"}
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Signed In" : "로그인 상태"}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Lee Hyeon-jang" : "이현장 관리자님"}</span>
            </div>
            <UserLanguageToggle
              en={en}
              onKo={() => navigate("/support/qna_list")}
              onEn={() => navigate("/en/support/qna_list")}
            />
            <button className="rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => navigate(buildLocalizedPath("/mypage/profile", "/en/mypage/profile"))} type="button">
              {en ? "My Page" : "마이페이지"}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden bg-slate-900 py-16" data-help-id="qna-list-hero">
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_52%,transparent_52%,transparent_100%)] bg-[length:40px_40px]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 text-center lg:px-8">
            <h2 className="text-3xl font-black text-white md:text-4xl">{en ? "How Can We Help?" : "무엇을 도와드릴까요?"}</h2>
            <p className="mt-4 text-sm font-medium text-slate-300 md:text-base">
              {en
                ? "Search calculation methods, report submission rules, and evidence updates in one place."
                : "검색을 통해 산정 방법, 보고서 제출, 증빙 자료 보완 방법을 빠르게 찾으실 수 있습니다."}
            </p>
            <div className="relative mt-8">
              <span className="material-symbols-outlined pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="h-16 w-full rounded-2xl border-none bg-white pl-14 pr-32 text-base font-medium shadow-2xl outline-none ring-4 ring-blue-500/10 focus:ring-blue-500/30"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={en ? "Enter a question, keyword, or form name" : "궁금한 내용을 입력하세요 (예: 배출계수, 검증 일정, 양식명...)"}
                value={keyword}
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--kr-gov-blue)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                {en ? "Search" : "검색하기"}
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="font-bold text-slate-400">{en ? "Trending:" : "자주 찾는 검색어:"}</span>
              {(en ? quickKeywords.en : quickKeywords.ko).map((item) => (
                <button className="text-blue-300 transition hover:underline" key={item} onClick={() => setKeyword(item.replace(/^#/, ""))} type="button">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <section data-help-id="qna-list-featured-cards">
            <div className="mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">star</span>
              <h3 className="text-xl font-black text-slate-900">{en ? "Featured Notices and FAQ" : "주요 소식 및 필독 FAQ"}</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {featuredCards.map((card) => (
                <article className={`rounded-2xl border border-[var(--kr-gov-border-light)] border-l-4 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${featuredToneClass(card.tone)}`} key={card.id}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${featuredBadgeClass(card.tone)}`}>
                    {featuredBadgeLabel(card.tone, en)}
                  </span>
                  <h4 className="mt-4 text-lg font-black leading-snug text-slate-900">{textOf(en, card.titleKo, card.titleEn)}</h4>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{textOf(en, card.summaryKo, card.summaryEn)}</p>
                  <button className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--kr-gov-blue)]" type="button">
                    {textOf(en, card.actionKo, card.actionEn)}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-6" data-help-id="qna-list-sidebar">
              <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--kr-gov-border-light)]">
                <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Categories" : "카테고리"}</h4>
                <div className="mt-4 space-y-1.5">
                  <button className="flex w-full items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-[var(--kr-gov-blue)]" type="button">
                    <span>{en ? "All Content" : "전체보기"}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs">{categoryCounts.ALL}</span>
                  </button>
                  <button className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={() => setActiveFilter("System Error")} type="button">
                    <span>{en ? "Notices" : "공지사항"}</span>
                    <span className="text-xs text-slate-400">{categoryCounts.NOTICE}</span>
                  </button>
                  <button className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={() => setActiveFilter("Account")} type="button">
                    <span>Q&amp;A</span>
                    <span className="text-xs text-slate-400">{categoryCounts.QNA}</span>
                  </button>
                  <button className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={() => setActiveFilter("Policy Guide")} type="button">
                    <span>{en ? "Resources" : "자료실"}</span>
                    <span className="text-xs text-slate-400">{categoryCounts.RESOURCE}</span>
                  </button>
                </div>
              </article>

              <article className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
                <h4 className="text-lg font-black">{en ? "Need 1:1 support?" : "1:1 문의가 필요하신가요?"}</h4>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {en
                    ? "Submit an online inquiry to receive a direct response from a platform operator."
                    : "온라인 상담을 통해 관리 전문가의 답변을 직접 받을 수 있습니다."}
                </p>
                <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100" onClick={() => navigate(buildLocalizedPath("/support/faq", "/en/support/faq"))} type="button">
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  {en ? "Open support channel" : "상담 채널 열기"}
                </button>
              </article>
            </aside>

            <div>
              <article className="mb-8 rounded-2xl border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.map((option) => {
                      const active = activeFilter === option.value;
                      return (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                          key={option.value}
                          onClick={() => setActiveFilter(option.value)}
                          type="button"
                        >
                          #{en ? option.labelEn : option.labelKo}
                        </button>
                      );
                    })}
                  </div>
                  <select
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 outline-none transition focus:border-[var(--kr-gov-blue)] focus:bg-white"
                    onChange={(event) => setSortBy(event.target.value as "latest" | "views")}
                    value={sortBy}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{en ? option.labelEn : option.labelKo}</option>
                    ))}
                  </select>
                </div>
              </article>

              <section data-help-id="qna-list-feed">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h4 className="text-lg font-black text-slate-900">{en ? "Recently Added Questions and Resources" : "최근 등록된 질문 및 자료"}</h4>
                  <span className="text-sm font-medium text-slate-400">
                    {en ? `${filteredEntries.length} results` : `총 ${filteredEntries.length}건`}
                  </span>
                </div>

                <div className="space-y-4">
                  {filteredEntries.length === 0 ? (
                    <article className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                      <p className="text-lg font-bold text-slate-700">{en ? "No matching support content was found." : "조건에 맞는 지원 콘텐츠가 없습니다."}</p>
                      <p className="mt-2 text-sm text-slate-500">{en ? "Try another keyword or filter combination." : "검색어 또는 필터를 변경해 다시 확인해 주세요."}</p>
                    </article>
                  ) : filteredEntries.map((entry) => (
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:bg-slate-50" key={entry.id}>
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${entryIconClass(entry.kind)}`}>
                          {entry.kind === "QNA" ? (
                            <span className="text-sm font-black">Q</span>
                          ) : (
                            <span className="material-symbols-outlined">{entryIcon(entry.kind)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${entryBadgeClass(entry.kind)}`}>
                              {entryKindLabel(entry.kind, en)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">#{textOf(en, entry.tagKo, entry.tagEn)}</span>
                            <span className="text-[10px] font-bold text-slate-400">{entry.date}</span>
                          </div>
                          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <h5 className="text-lg font-black text-slate-800">{textOf(en, entry.titleKo, entry.titleEn)}</h5>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{textOf(en, entry.summaryKo, entry.summaryEn)}</p>
                            </div>
                            {entry.downloadLabelKo && entry.downloadLabelEn ? (
                              <button className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200" type="button">
                                {textOf(en, entry.downloadLabelKo, entry.downloadLabelEn)}
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                            {entry.statusKo && entry.statusEn ? (
                              <span className={entry.answered ? "text-emerald-600" : "text-slate-400"}>
                                {entry.answered ? "● " : "○ "}
                                {textOf(en, entry.statusKo, entry.statusEn)}
                              </span>
                            ) : null}
                            <span>{en ? "Views" : "조회수"} {entry.views.toLocaleString("en-US")}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-10 flex items-center justify-center gap-2">
                  <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50" type="button">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {[1, 2, 3, 4].map((page) => (
                    <button
                      className={`h-10 w-10 rounded-lg text-sm font-bold transition ${page === 1 ? "bg-[var(--kr-gov-blue)] text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                      key={page}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                  <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50" type="button">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management Headquarters" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul" : "(04551) 서울특별시 중구 세종대로 110"}
        serviceLine={en ? "Customer Support Center: 1588-1234 (Weekdays 09:00-18:00)" : "고객지원센터: 1588-1234 (평일 09:00~18:00)"}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"]}
        copyright={en ? "© 2026 CCUS Carbon Footprint Platform. Customer Support Center." : "© 2026 CCUS Carbon Footprint Platform. Customer Support Center."}
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Certification Mark" : "웹 접근성 품질인증 마크"}
      />
    </div>
  );
}
