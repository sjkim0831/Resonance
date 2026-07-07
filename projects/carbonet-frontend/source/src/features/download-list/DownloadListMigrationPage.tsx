import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";

type ResourceCategory = "ALL" | "MANUAL" | "FORM" | "GUIDE" | "CASE";

type ResourceItem = {
  id: string;
  category: Exclude<ResourceCategory, "ALL">;
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  summaryEn: string;
  format: string;
  size: string;
  updatedAt: string;
  downloads: string;
  toneClass: string;
  icon: string;
  featured?: boolean;
};

const CATEGORY_OPTIONS: { value: ResourceCategory; labelKo: string; labelEn: string }[] = [
  { value: "ALL", labelKo: "전체 자료", labelEn: "All Resources" },
  { value: "MANUAL", labelKo: "매뉴얼", labelEn: "Manuals" },
  { value: "FORM", labelKo: "양식", labelEn: "Forms" },
  { value: "GUIDE", labelKo: "가이드", labelEn: "Guides" },
  { value: "CASE", labelKo: "사례집", labelEn: "Casebooks" }
];

const RESOURCE_ITEMS: ResourceItem[] = [
  {
    id: "LIB-2026-001",
    category: "MANUAL",
    titleKo: "2026 현장 감독관 운영 매뉴얼",
    titleEn: "2026 Site Supervisor Operations Manual",
    summaryKo: "플랫폼 핵심 메뉴, 데이터 검증 흐름, 보고서 제출 절차를 한 권에 정리한 종합 매뉴얼입니다.",
    summaryEn: "A full manual covering key menus, data validation workflows, and report submission procedures.",
    format: "PDF",
    size: "12.4 MB",
    updatedAt: "2026.04.01",
    downloads: "3,842",
    toneClass: "bg-blue-50 text-blue-700",
    icon: "menu_book",
    featured: true
  },
  {
    id: "LIB-2026-004",
    category: "FORM",
    titleKo: "증빙 서류 표준 양식 모음",
    titleEn: "Standard Evidence Form Bundle",
    summaryKo: "에너지 사용내역, 설비 가동기록, 검증 보완서 등 자주 제출하는 양식을 ZIP으로 제공합니다.",
    summaryEn: "A ZIP bundle of commonly submitted forms including energy logs, operation records, and verification supplements.",
    format: "ZIP",
    size: "8.2 MB",
    updatedAt: "2026.03.29",
    downloads: "2,916",
    toneClass: "bg-emerald-50 text-emerald-700",
    icon: "assignment_add",
    featured: true
  },
  {
    id: "LIB-2026-007",
    category: "GUIDE",
    titleKo: "배출량 산정 알고리즘 가이드",
    titleEn: "Emission Calculation Algorithm Guide",
    summaryKo: "Tier 1부터 Tier 3까지 산정 방식과 시스템 계산 로직을 기술 문서 형식으로 설명합니다.",
    summaryEn: "Technical guidance on Tier 1 to Tier 3 methodologies and the platform's calculation logic.",
    format: "PDF",
    size: "4.1 MB",
    updatedAt: "2026.03.25",
    downloads: "1,488",
    toneClass: "bg-orange-50 text-orange-700",
    icon: "integration_instructions"
  },
  {
    id: "LIB-2026-010",
    category: "CASE",
    titleKo: "우수 감축 사업장 사례집",
    titleEn: "Best Reduction Site Casebook",
    summaryKo: "감축 시나리오 수립, 모니터링, 검증 대응까지 실제 현장 사례를 중심으로 정리했습니다.",
    summaryEn: "Real field cases covering reduction planning, monitoring, and verification responses.",
    format: "PDF",
    size: "6.8 MB",
    updatedAt: "2026.03.18",
    downloads: "1,102",
    toneClass: "bg-violet-50 text-violet-700",
    icon: "auto_stories"
  },
  {
    id: "LIB-2026-012",
    category: "FORM",
    titleKo: "분기 실적 제출 엑셀 템플릿",
    titleEn: "Quarterly Submission Excel Template",
    summaryKo: "분기별 실적 보고 시 바로 업로드할 수 있도록 구조화한 제출용 서식입니다.",
    summaryEn: "A structured spreadsheet template for quarterly performance submission uploads.",
    format: "XLSX",
    size: "1.1 MB",
    updatedAt: "2026.03.12",
    downloads: "2,337",
    toneClass: "bg-sky-50 text-sky-700",
    icon: "table_view"
  },
  {
    id: "LIB-2026-015",
    category: "GUIDE",
    titleKo: "외부 검증 대응 체크리스트",
    titleEn: "External Verification Checklist",
    summaryKo: "검증기관 대응 전에 준비해야 할 파일, 담당자 확인 포인트, 자주 누락되는 항목을 정리했습니다.",
    summaryEn: "A pre-verification checklist covering files, owner checkpoints, and commonly missed items.",
    format: "PDF",
    size: "2.4 MB",
    updatedAt: "2026.03.05",
    downloads: "1,954",
    toneClass: "bg-amber-50 text-amber-700",
    icon: "fact_check"
  }
];

function categoryLabel(value: ResourceCategory, en: boolean) {
  const option = CATEGORY_OPTIONS.find((item) => item.value === value) ?? CATEGORY_OPTIONS[0];
  return en ? option.labelEn : option.labelKo;
}

function resourceText(item: ResourceItem, en: boolean, field: "title" | "summary") {
  return field === "title" ? (en ? item.titleEn : item.titleKo) : (en ? item.summaryEn : item.summaryKo);
}

export function DownloadListMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<ResourceCategory>("ALL");

  const filteredResources = RESOURCE_ITEMS.filter((item) => {
    const matchesCategory = category === "ALL" || item.category === category;
    const lookup = `${item.titleKo} ${item.titleEn} ${item.summaryKo} ${item.summaryEn}`.toLowerCase();
    const matchesKeyword = keyword.trim() === "" || lookup.includes(keyword.trim().toLowerCase());
    return matchesCategory && matchesKeyword;
  });

  useEffect(() => {
    logGovernanceScope("PAGE", "download-list", {
      language: en ? "en" : "ko",
      keyword,
      category,
      resultCount: filteredResources.length
    });
  }, [category, en, filteredResources.length, keyword]);

  return (
    <div
      className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]"
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
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar
        governmentText={en ? "Official Government Service of the Republic of Korea | Portal for On-site Supervisors" : "대한민국 정부 공식 서비스 | 현장 감독관 전용 포털"}
        guidelineText={en ? "Live support queue: 2 operators available" : "실시간 상담 대기: 2명 (원활)"}
      />
      <UserPortalHeader
        brandTitle={en ? "Support Resource Center" : "감독관 지원 자료실"}
        brandSubtitle="Site Overseer Support Hub"
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <nav className="hidden xl:flex items-center gap-6 text-sm font-bold text-slate-500">
              <button className="transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))} type="button">
                {en ? "Announcements" : "공지사항"}
              </button>
              <button className="text-[var(--kr-gov-blue)]" type="button">
                {en ? "Library" : "자료실"}
              </button>
              <button className="transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/support/faq", "/en/support/faq"))} type="button">
                FAQ
              </button>
            </nav>
            <UserLanguageToggle en={en} onKo={() => navigate("/support/download_list")} onEn={() => navigate("/en/support/download_list")} />
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden bg-slate-900 py-16" data-help-id="download-list-hero">
          <div className="absolute inset-0 opacity-10">
            <svg height="100%" width="100%">
              <pattern height="60" id="download-grid" patternUnits="userSpaceOnUse" width="60">
                <circle cx="2" cy="2" fill="white" r="1" />
              </pattern>
              <rect fill="url(#download-grid)" height="100%" width="100%" />
            </svg>
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {en ? "Recommended support resources" : "추천 지원 자료"}
              </div>
              <h2 className="mt-5 text-4xl font-black leading-tight text-white">
                {en ? "Download manuals, forms, and evidence guides in one place." : "매뉴얼, 양식, 증빙 가이드를 한 곳에서 내려받으세요."}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {en
                  ? "The resource center is based on the support-hub design and groups the most frequently used operator documents by task."
                  : "고객지원 허브형 설계를 기준으로, 현장 감독관이 가장 자주 찾는 운영 자료를 업무 목적별로 묶어 제공합니다."}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{en ? "Total Files" : "전체 자료"}</p>
                  <p className="mt-2 text-2xl font-black">{RESOURCE_ITEMS.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{en ? "Featured" : "추천 자료"}</p>
                  <p className="mt-2 text-2xl font-black">{RESOURCE_ITEMS.filter((item) => item.featured).length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{en ? "Updated" : "이번 달 갱신"}</p>
                  <p className="mt-2 text-2xl font-black">4</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{en ? "Smart Filter" : "자료 찾기"}</p>
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold text-slate-200">{en ? "Keyword" : "검색어"}</span>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-indigo-400"
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder={en ? "Search manuals, forms, or guides" : "매뉴얼, 양식, 가이드를 검색하세요"}
                    value={keyword}
                  />
                </div>
              </label>
              <div className="mt-5">
                <p className="mb-3 text-sm font-bold text-slate-200">{en ? "Category" : "카테고리"}</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                        category === option.value ? "bg-indigo-500 text-white" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      }`}
                      key={option.value}
                      onClick={() => setCategory(option.value)}
                      type="button"
                    >
                      {en ? option.labelEn : option.labelKo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6 text-xs text-slate-300">
                <p>{en ? "Fast links" : "빠른 이동"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-full bg-white/10 px-3 py-2 font-bold hover:bg-white/15" onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))} type="button">
                    {en ? "View Notices" : "공지사항 보기"}
                  </button>
                  <button className="rounded-full bg-white/10 px-3 py-2 font-bold hover:bg-white/15" onClick={() => navigate(buildLocalizedPath("/support/faq", "/en/support/faq"))} type="button">
                    {en ? "Open FAQ" : "FAQ 열기"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <div className="space-y-6">
            <article className="rounded-[26px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm" data-help-id="download-list-cards">
              <div className="flex flex-col gap-3 border-b border-[var(--kr-gov-border-light)] pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Download List" : "자료 목록"}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{en ? "Support Documents" : "고객지원 문서"}</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                  {en ? `${filteredResources.length} results` : `${filteredResources.length}건 조회됨`}
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {filteredResources.map((item) => (
                  <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5" key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.toneClass}`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.featured ? <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black text-indigo-700">{en ? "Recommended" : "추천"}</span> : null}
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500">{categoryLabel(item.category, en)}</span>
                      </div>
                    </div>
                    <h4 className="mt-4 text-lg font-black leading-snug text-slate-900">{resourceText(item, en, "title")}</h4>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{resourceText(item, en, "summary")}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                      <span>{item.format}</span>
                      <span>{item.size}</span>
                      <span>{en ? "Updated" : "업데이트"} {item.updatedAt}</span>
                      <span>{en ? "Downloads" : "다운로드"} {item.downloads}</span>
                    </div>
                    <div className="mt-5 flex gap-3">
                      <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100" type="button">
                        {en ? "Preview" : "미리보기"}
                      </button>
                      <button className="rounded-xl bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                        {en ? "Download" : "다운로드"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {filteredResources.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-lg font-bold text-slate-700">{en ? "No matching documents found." : "조건에 맞는 자료가 없습니다."}</p>
                  <p className="mt-2 text-sm text-slate-500">{en ? "Try a broader keyword or switch categories." : "검색어를 줄이거나 다른 카테고리를 선택해 보세요."}</p>
                </div>
              ) : null}
            </article>

            <article className="rounded-[26px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Recommended Bundle" : "추천 묶음"}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{en ? "Frequently downloaded together" : "함께 내려받는 자료"}</h3>
                </div>
                <button className="text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))} type="button">
                  {en ? "See related notices" : "연관 공지 보기"}
                </button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {RESOURCE_ITEMS.filter((item) => item.featured || item.category === "GUIDE").slice(0, 3).map((item) => (
                  <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4" key={`bundle-${item.id}`}>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{categoryLabel(item.category, en)}</p>
                    <p className="mt-2 font-bold text-slate-900">{resourceText(item, en, "title")}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.format} · {item.size}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="space-y-6">
            <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" data-help-id="download-list-support-desk">
              <div className="bg-[var(--kr-gov-blue)] p-6 text-white">
                <h3 className="text-xl font-black">{en ? "Support Desk" : "고객센터 안내"}</h3>
                <p className="mt-1 text-xs text-blue-100">{en ? "Need additional help?" : "도움이 더 필요하신가요?"}</p>
              </div>
              <div className="space-y-6 p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Phone" : "상담 전화"}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">02-1234-5678</p>
                  <p className="mt-1 text-xs text-slate-500">{en ? "Weekdays 09:00-18:00" : "평일 09:00 ~ 18:00"}</p>
                </div>
                <div className="border-t border-slate-100 pt-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Live Channels" : "채널별 실시간 지원"}</p>
                  <div className="mt-4 space-y-3">
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100" type="button">
                      <span className="material-symbols-outlined text-[20px] text-indigo-500">chat</span>
                      {en ? "1:1 Chat Support" : "1:1 채팅 상담"}
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100" type="button">
                      <span className="material-symbols-outlined text-[20px] text-indigo-500">mail</span>
                      {en ? "Email Inquiry" : "이메일 문의하기"}
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100" type="button">
                      <span className="material-symbols-outlined text-[20px] text-indigo-500">laptop_windows</span>
                      {en ? "Remote Support Request" : "원격 지원 요청"}
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-indigo-100 bg-indigo-50 p-6 shadow-sm" data-help-id="download-list-urgent-notices">
              <h3 className="flex items-center gap-2 text-lg font-black text-indigo-900">
                <span className="material-symbols-outlined text-[20px]">campaign</span>
                {en ? "Urgent Notices" : "시스템 긴급 공지"}
              </h3>
              <div className="mt-4 space-y-4">
                {[
                  {
                    date: "2026.04.02",
                    titleKo: "[공지] 4월 정기 점검으로 일부 다운로드가 일시 중단됩니다.",
                    titleEn: "[Notice] Some downloads will pause during the April maintenance window."
                  },
                  {
                    date: "2026.03.28",
                    titleKo: "[안내] 2026 상반기 검증 대응 교육 자료가 갱신되었습니다.",
                    titleEn: "[Update] 2026 first-half verification training materials were refreshed."
                  }
                ].map((notice) => (
                  <button
                    className="block w-full border-b border-indigo-100 pb-4 text-left last:border-b-0 last:pb-0"
                    key={notice.date}
                    onClick={() => navigate(buildLocalizedPath("/support/notice_list", "/en/support/notice_list"))}
                    type="button"
                  >
                    <p className="text-sm font-bold leading-6 text-indigo-900 hover:underline">{en ? notice.titleEn : notice.titleKo}</p>
                    <span className="mt-1 block text-[11px] font-bold text-indigo-400">{notice.date}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "FAQ" : "자주 묻는 질문"}</p>
              <div className="mt-4 space-y-4">
                {[
                  {
                    titleKo: "에너지 데이터 확정 후 수정이 가능한가요?",
                    titleEn: "Can confirmed energy data still be edited?"
                  },
                  {
                    titleKo: "2차 인증 설정은 어디서 변경하나요?",
                    titleEn: "Where can I change the two-factor authentication method?"
                  }
                ].map((faq) => (
                  <button className="block w-full rounded-2xl bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100" key={faq.titleKo} onClick={() => navigate(buildLocalizedPath("/support/faq", "/en/support/faq"))} type="button">
                    <p className="text-sm font-bold leading-6 text-slate-800">{en ? faq.titleEn : faq.titleKo}</p>
                  </button>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </main>

      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management HQ" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul" : "(04551) 서울특별시 중구 세종대로 110"}
        serviceLine={en ? "Field support team: 02-1234-5678" : "현장 관리 지원팀: 02-1234-5678"}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"]}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Certification Mark" : "웹 접근성 품질인증 마크"}
      />
    </div>
  );
}
