import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";

type NoticeItem = {
  id: string;
  category: "CRITICAL" | "SYSTEM" | "NOTICE" | "POLICY";
  pinned: boolean;
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  summaryEn: string;
  date: string;
  views: string;
  attachmentCount: number;
};

const categoryOptions = [
  { value: "ALL", labelKo: "전체", labelEn: "All" },
  { value: "CRITICAL", labelKo: "긴급", labelEn: "Critical" },
  { value: "SYSTEM", labelKo: "시스템", labelEn: "System" },
  { value: "NOTICE", labelKo: "일반공지", labelEn: "Notice" },
  { value: "POLICY", labelKo: "정책/지침", labelEn: "Policy" }
] as const;

const noticeItems: NoticeItem[] = [
  {
    id: "NTC-2026-041",
    category: "CRITICAL",
    pinned: true,
    titleKo: "2026 배출량 산정 기준 개정 반영 일정 안내",
    titleEn: "Notice on the 2026 Emission Calculation Standard Update",
    summaryKo: "4월 정기 반영분부터 신규 산정 기준과 검증 체크 항목이 적용됩니다. 사업장 담당자는 사전 점검 가이드를 확인해 주세요.",
    summaryEn: "New calculation standards and validation checkpoints apply from the April scheduled update. Please review the pre-check guide.",
    date: "2026.04.01",
    views: "2,481",
    attachmentCount: 2
  },
  {
    id: "NTC-2026-037",
    category: "SYSTEM",
    pinned: true,
    titleKo: "플랫폼 정기 점검 안내 (04/06 01:00~04:00)",
    titleEn: "Scheduled Platform Maintenance (Apr 6, 01:00-04:00)",
    summaryKo: "점검 시간에는 모니터링, 보고서 제출, 고객지원 일부 기능이 일시 제한됩니다.",
    summaryEn: "Monitoring, report submission, and parts of customer support will be temporarily unavailable during maintenance.",
    date: "2026.03.29",
    views: "1,904",
    attachmentCount: 1
  },
  {
    id: "NTC-2026-033",
    category: "POLICY",
    pinned: false,
    titleKo: "외부 검증 대응용 증빙자료 제출 가이드 배포",
    titleEn: "Submission Guide for External Verification Evidence Released",
    summaryKo: "배출량 검증, REC 확인, 실적 보고 단계에서 공통으로 사용하는 증빙자료 목록을 정리했습니다.",
    summaryEn: "This guide consolidates the evidence checklist commonly used for emission validation, REC checks, and performance reporting.",
    date: "2026.03.24",
    views: "1,336",
    attachmentCount: 3
  },
  {
    id: "NTC-2026-028",
    category: "NOTICE",
    pinned: false,
    titleKo: "우수 감축 사업장 사례집 다운로드 제공",
    titleEn: "Best Reduction Site Casebook Now Available",
    summaryKo: "감축 시나리오, 모니터링, 거래 연계까지 포함된 우수 사례집을 자료실과 함께 제공합니다.",
    summaryEn: "A new casebook covering reduction scenarios, monitoring, and trading linkage is now available.",
    date: "2026.03.18",
    views: "982",
    attachmentCount: 1
  },
  {
    id: "NTC-2026-021",
    category: "SYSTEM",
    pinned: false,
    titleKo: "모니터링 대시보드 성능 개선 배포 완료",
    titleEn: "Monitoring Dashboard Performance Improvements Released",
    summaryKo: "실시간 차트 초기 렌더링과 경보 목록 조회 속도가 개선되었습니다.",
    summaryEn: "Initial chart rendering and alert list retrieval performance have been improved.",
    date: "2026.03.11",
    views: "745",
    attachmentCount: 0
  },
  {
    id: "NTC-2026-014",
    category: "POLICY",
    pinned: false,
    titleKo: "온실가스 감축 실적 제출 마감 일정 재안내",
    titleEn: "Reminder on the Greenhouse Gas Reduction Submission Deadline",
    summaryKo: "분기 실적 제출 기한과 반려 보완 재접수 마감일을 함께 공지합니다.",
    summaryEn: "This reminder covers both the quarterly submission deadline and the resubmission deadline for rejected cases.",
    date: "2026.03.04",
    views: "1,118",
    attachmentCount: 2
  }
];

function labelOf(option: { labelKo: string; labelEn: string }, en: boolean) {
  return en ? option.labelEn : option.labelKo;
}

function textOf(item: NoticeItem, en: boolean, field: "title" | "summary") {
  if (field === "title") {
    return en ? item.titleEn : item.titleKo;
  }
  return en ? item.summaryEn : item.summaryKo;
}

function badgeClass(category: NoticeItem["category"]) {
  switch (category) {
    case "CRITICAL":
      return "border-red-200 bg-red-50 text-red-700";
    case "SYSTEM":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "POLICY":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

export function NoticeListMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("ALL");

  const filteredNotices = noticeItems.filter((item) => {
    const matchesCategory = category === "ALL" || item.category === category;
    const lookup = `${item.titleKo} ${item.titleEn} ${item.summaryKo} ${item.summaryEn}`.toLowerCase();
    const matchesKeyword = !keyword.trim() || lookup.includes(keyword.trim().toLowerCase());
    return matchesCategory && matchesKeyword;
  });

  useEffect(() => {
    logGovernanceScope("PAGE", "notice-list", {
      language: en ? "en" : "ko",
      keyword,
      category,
      resultCount: filteredNotices.length
    });
  }, [category, en, filteredNotices.length, keyword]);

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f8fafc_18%,#ffffff_100%)] text-[var(--kr-gov-text-primary)]"
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
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar
        governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
        guidelineText={en ? "This website complies with the 2025 Digital Government UI/UX Guidelines." : "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다."}
      />
      <UserPortalHeader
        brandTitle={en ? "CCUS Support Center" : "CCUS 고객지원센터"}
        brandSubtitle="Notice and Guidance"
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden lg:flex items-center rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)] shadow-sm">
              {en ? "Policy updates, system notices, and evidence guides" : "정책 변경, 시스템 점검, 증빙 가이드를 한 곳에서 확인"}
            </div>
            <UserLanguageToggle
              en={en}
              onKo={() => navigate("/support/notice_list")}
              onEn={() => navigate("/en/support/notice_list")}
            />
          </>
        )}
      />

      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8" id="main-content">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-[radial-gradient(circle_at_top_left,#1d4ed8_0,#0f172a_48%,#111827_100%)] px-6 py-10 text-white shadow-xl lg:px-10" data-help-id="notice-list-hero">
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_52%,transparent_52%,transparent_100%)] bg-[length:72px_72px]" />
          </div>
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">{en ? "Support Notices" : "Support Notices"}</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">
                {en ? "Announcements and Operational Guidance" : "공지사항 및 운영 안내"}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
                {en
                  ? "Review critical updates, maintenance windows, policy changes, and downloadable guidance for the CCUS platform."
                  : "CCUS 플랫폼 운영에 필요한 긴급 공지, 점검 일정, 정책 변경, 다운로드 자료를 공지 중심으로 빠르게 확인할 수 있습니다."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">{en ? "Pinned" : "상단 고정"}</p>
                <p className="mt-2 text-2xl font-black">{noticeItems.filter((item) => item.pinned).length}</p>
                <p className="mt-1 text-xs text-slate-200">{en ? "High-priority notices" : "우선 확인 공지"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">{en ? "This Month" : "이번 달 게시"}</p>
                <p className="mt-2 text-2xl font-black">{noticeItems.length}</p>
                <p className="mt-1 text-xs text-slate-200">{en ? "Published notices" : "등록 공지 건수"}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <article className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm" data-help-id="notice-list-filters">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Support Menu" : "고객지원 메뉴"}</p>
              <div className="mt-5 space-y-2">
                <button className="flex w-full items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-[var(--kr-gov-blue)]" type="button">
                  <span>{en ? "Announcements" : "공지사항"}</span>
                  <span className="material-symbols-outlined text-[18px]">campaign</span>
                </button>
                <button className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-500 transition hover:bg-slate-50" onClick={() => navigate(buildLocalizedPath("/sitemap", "/en/sitemap"))} type="button">
                  <span>{en ? "Sitemap" : "사이트맵"}</span>
                  <span className="material-symbols-outlined text-[18px]">map</span>
                </button>
                <button className="flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-500 transition hover:bg-slate-50" onClick={() => navigate(buildLocalizedPath("/support/download_list", "/en/support/download_list"))} type="button">
                  <span>{en ? "Download Center" : "자료실"}</span>
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                </button>
              </div>
            </article>

            <article className="rounded-[24px] bg-[linear-gradient(160deg,#eff6ff,#dbeafe)] p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{en ? "Operator Help" : "운영 지원"}</p>
              <h3 className="mt-3 text-xl font-black text-slate-900">{en ? "Need a direct response?" : "별도 문의가 필요하신가요?"}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {en
                  ? "Check the latest notices first, then move to the main portal or support desk for additional help."
                  : "최신 공지를 먼저 확인한 뒤 추가 확인이 필요하면 메인 포털 또는 운영 지원 창구로 이동하세요."}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button className="rounded-xl bg-[var(--kr-gov-blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  {en ? "Go to Home" : "홈으로 이동"}
                </button>
                <a className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 transition hover:bg-blue-50" href="mailto:support@ccus-platform.go.kr">
                  support@ccus-platform.go.kr
                </a>
              </div>
            </article>
          </aside>

            <section className="space-y-6" data-help-id="notice-list-table">
            <article className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                      className="w-full rounded-2xl border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:bg-white"
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder={en ? "Search titles or summaries" : "제목 또는 요약으로 검색"}
                      value={keyword}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Category" : "카테고리"}</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)] px-4 py-3 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:bg-white"
                    onChange={(event) => setCategory(event.target.value)}
                    value={category}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{labelOf(option, en)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </article>

            <article className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[var(--kr-gov-border-light)] px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Notice Board" : "공지 목록"}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{en ? "Latest Notices" : "최신 공지사항"}</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                  {en ? `${filteredNotices.length} notices found` : `${filteredNotices.length}건 조회됨`}
                </div>
              </div>

              <div className="divide-y divide-[var(--kr-gov-border-light)]">
                {filteredNotices.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-lg font-bold text-slate-700">{en ? "No notices matched your filters." : "조건에 맞는 공지사항이 없습니다."}</p>
                    <p className="mt-2 text-sm text-slate-500">{en ? "Try another keyword or broaden the category filter." : "검색어를 바꾸거나 카테고리 범위를 넓혀 보세요."}</p>
                  </div>
                ) : filteredNotices.map((item) => (
                  <article className={`px-6 py-5 transition hover:bg-slate-50 ${item.pinned ? "bg-blue-50/40" : ""}`} key={item.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.pinned ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                              {en ? "Pinned" : "고정"}
                            </span>
                          ) : null}
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${badgeClass(item.category)}`}>
                            {labelOf(categoryOptions.find((option) => option.value === item.category) || categoryOptions[0], en)}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{item.id}</span>
                        </div>
                        <h4 className="mt-3 text-xl font-black leading-snug text-slate-900">{textOf(item, en, "title")}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{textOf(item, en, "summary")}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                          <span>{en ? "Published" : "등록일"} {item.date}</span>
                          <span>{en ? "Views" : "조회수"} {item.views}</span>
                          <span>{en ? "Attachments" : "첨부"} {item.attachmentCount}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100" type="button">
                          {en ? "Preview" : "미리보기"}
                        </button>
                        <button className="rounded-xl bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                          {en ? "Open" : "열기"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" id="resource-center">
              <article className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Featured Resources" : "연관 자료"}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-black text-slate-900">{en ? "Frequently referenced guides" : "자주 함께 확인하는 자료"}</h3>
                  <button className="text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" onClick={() => navigate(buildLocalizedPath("/support/download_list", "/en/support/download_list"))} type="button">
                    {en ? "Open library" : "자료실 열기"}
                  </button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      icon: "description",
                      titleKo: "배출량 산정 증빙자료 체크리스트",
                      titleEn: "Emission Evidence Checklist",
                      metaKo: "PDF · 2.4MB",
                      metaEn: "PDF · 2.4MB"
                    },
                    {
                      icon: "table_view",
                      titleKo: "분기 실적 제출 양식",
                      titleEn: "Quarterly Submission Template",
                      metaKo: "XLSX · 1.1MB",
                      metaEn: "XLSX · 1.1MB"
                    }
                  ].map((item) => (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.titleKo}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--kr-gov-blue)] shadow-sm">
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{en ? item.titleEn : item.titleKo}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{en ? item.metaEn : item.metaKo}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[24px] border border-blue-100 bg-blue-50 p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{en ? "Notice Rule" : "공지 확인 기준"}</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  <li>{en ? "Check pinned or critical notices before submitting reports." : "보고서 제출 전에는 고정 또는 긴급 공지를 먼저 확인합니다."}</li>
                  <li>{en ? "Review system maintenance windows before scheduled uploads." : "예약 업로드 전에는 시스템 점검 일정을 함께 확인합니다."}</li>
                  <li>{en ? "Download the latest evidence guide when policy notices are updated." : "정책 공지가 바뀌면 최신 증빙 가이드를 함께 내려받아 확인합니다."}</li>
                </ul>
              </article>
            </section>
          </section>
        </section>
      </main>

      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management HQ" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Phone: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678"}
        serviceLine={en ? "This service provides support notices, operational guidance, and policy updates for platform users." : "본 서비스는 플랫폼 이용자를 위한 운영 공지, 정책 안내, 지원 정보를 제공합니다."}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"]}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Certification Mark" : "웹 접근성 품질인증 마크"}
      />
    </div>
  );
}
