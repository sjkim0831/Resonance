import { useEffect, useMemo } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
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
  brandTitle: string;
  brandSubtitle: string;
  displayRole: string;
  displayName: string;
  logout: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroButton: string;
  queueTitle: string;
  queueSubtitle: string;
  versionTitle: string;
  versionSubtitle: string;
  currentVersion: string;
  latestVersion: string;
  currentStatus: string;
  currentStatusHint: string;
  releaseTitle: string;
  releaseSubtitle: string;
  actionTitle: string;
  actionSubtitle: string;
  relatedInquiry: string;
  referenceNoteTitle: string;
  referenceNoteBody: string;
  footerOrg: string;
  footerAddress: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
};

type QueueCard = {
  level: string;
  due: string;
  title: string;
  description: string;
  action: string;
  toneClass: string;
  badgeClass: string;
};

type ReleaseItem = {
  version: string;
  date: string;
  title: string;
  summary: string;
  bullets: string[];
};

type ActionItem = {
  icon: string;
  title: string;
  body: string;
  href: string;
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    homePath: "/home",
    brandTitle: "버전 관리",
    brandSubtitle: "Update Assistant Workspace",
    displayRole: "총괄 책임자",
    displayName: "이현장 관리자님",
    logout: "로그아웃",
    heroEyebrow: "업데이트 비서",
    heroTitle: "플랫폼 버전과 배포 이력을 한 화면에서 관리합니다.",
    heroBody: "참조 설계의 핵심 흐름인 우선 작업 큐, 버전 정보, 최신 릴리스 요약을 사용자 포털 패턴에 맞춰 정리했습니다.",
    heroButton: "전체 워크플로우 보기",
    queueTitle: "우선 확인 항목",
    queueSubtitle: "업데이트 이후 바로 점검해야 하는 주요 변화입니다.",
    versionTitle: "버전 정보",
    versionSubtitle: "현재 운영 중인 화면과 최신 배포 버전을 비교합니다.",
    currentVersion: "현재 적용 버전",
    latestVersion: "최신 배포 버전",
    currentStatus: "최신 버전 이용 중",
    currentStatusHint: "하드 리프레시 없이도 신규 기능과 안내 문구가 반영된 상태입니다.",
    releaseTitle: "최근 릴리스 노트",
    releaseSubtitle: "참조 산출물에서 반복되던 업데이트 비서 및 고객지원 개선 포인트를 기준으로 구성했습니다.",
    actionTitle: "빠른 작업",
    actionSubtitle: "관련 화면으로 이동해 바로 후속 조치를 진행할 수 있습니다.",
    relatedInquiry: "관련 문의 열기",
    referenceNoteTitle: "참조 산출물 정리 메모",
    referenceNoteBody: "설계 폴더명은 버전 관리이지만 일부 HTML 내 본문은 배출지 대시보드까지 확장되어 있어 충돌이 있었습니다. 이번 구현은 반복적으로 나타난 버전 정보, 업데이트 비서, 빠른 이동 요소만 채택하고 무관한 배출지 운영 대시보드 내용은 제외했습니다.",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 고객지원센터: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    homePath: "/en/home",
    brandTitle: "Version Management",
    brandSubtitle: "Update Assistant Workspace",
    displayRole: "Chief Overseer",
    displayName: "Hyeon-jang Lee",
    logout: "Logout",
    heroEyebrow: "Update Assistant",
    heroTitle: "Manage platform versions and deployment history in one place.",
    heroBody: "This page restructures the design references into the live portal pattern with a priority queue, version status, and recent release notes.",
    heroButton: "Open Full Workflow",
    queueTitle: "Priority Checks",
    queueSubtitle: "Review these items first after a version update.",
    versionTitle: "Version Information",
    versionSubtitle: "Compare the currently active build with the latest release.",
    currentVersion: "Current Runtime Version",
    latestVersion: "Latest Release Version",
    currentStatus: "Running the latest version",
    currentStatusHint: "The newest feature set and guidance copy are already reflected without a manual fallback path.",
    releaseTitle: "Recent Release Notes",
    releaseSubtitle: "Organized around the update-assistant and support improvements that repeated across the reference versions.",
    actionTitle: "Quick Actions",
    actionSubtitle: "Jump directly to related screens for follow-up work.",
    relatedInquiry: "Open related inquiries",
    referenceNoteTitle: "Reference Conflict Note",
    referenceNoteBody: "The design folder name points to version management, but several HTML exports still describe the broader update-assistant dashboard. This implementation preserves the repeated version-oriented elements and drops unrelated emission-site dashboard details.",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support Center: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "Last Updated:",
    footerWaAlt: "Web Accessibility Quality Mark"
  }
};

const QUEUE: Record<"ko" | "en", QueueCard[]> = {
  ko: [
    {
      level: "CRITICAL",
      due: "D-0",
      title: "고객지원 허브 문구 갱신 확인",
      description: "문의, FAQ, 자료실로 연결되는 공통 헤더와 버튼 문구가 최신 사양과 일치하는지 점검합니다.",
      action: "지원 화면 열기",
      toneClass: "border-l-red-500",
      badgeClass: "bg-red-500/20 text-red-300"
    },
    {
      level: "REQUIRED",
      due: "D-1",
      title: "버전 배너 노출 상태 확인",
      description: "현재 버전과 최신 버전 비교 카드가 사용자 포털에서 정상 노출되는지 확인합니다.",
      action: "버전 카드 검토",
      toneClass: "border-l-orange-500",
      badgeClass: "bg-orange-500/20 text-orange-300"
    },
    {
      level: "NOTICE",
      due: "D-2",
      title: "릴리스 노트 링크 점검",
      description: "최근 변경 요약과 관련 후속 화면 이동 링크를 검토합니다.",
      action: "릴리스 보기",
      toneClass: "border-l-blue-500",
      badgeClass: "bg-blue-500/20 text-blue-300"
    }
  ],
  en: [
    {
      level: "CRITICAL",
      due: "D-0",
      title: "Validate support hub copy refresh",
      description: "Check whether the shared header and buttons across inquiry, FAQ, and library match the latest wording.",
      action: "Open Support Screens",
      toneClass: "border-l-red-500",
      badgeClass: "bg-red-500/20 text-red-300"
    },
    {
      level: "REQUIRED",
      due: "D-1",
      title: "Confirm version banner visibility",
      description: "Verify that the current-versus-latest comparison card is rendered correctly in the user portal.",
      action: "Review Version Card",
      toneClass: "border-l-orange-500",
      badgeClass: "bg-orange-500/20 text-orange-300"
    },
    {
      level: "NOTICE",
      due: "D-2",
      title: "Review release-note links",
      description: "Check the recent change summary and the follow-up navigation targets.",
      action: "View Release Notes",
      toneClass: "border-l-blue-500",
      badgeClass: "bg-blue-500/20 text-blue-300"
    }
  ]
};

const RELEASES: Record<"ko" | "en", ReleaseItem[]> = {
  ko: [
    {
      version: "v2.5.0",
      date: "2026.04.06",
      title: "고객지원 버전 관리 화면 신설",
      summary: "버전 정보, 우선 작업 큐, 최근 릴리스 요약을 하나의 사용자 화면으로 통합했습니다.",
      bullets: [
        "설계 산출물의 업데이트 비서 콘셉트를 사용자 포털 구조에 맞게 재구성",
        "문의, FAQ, 자료실과 연결되는 빠른 작업 카드 추가",
        "현재 적용 버전과 최신 배포 버전 비교 영역 정리"
      ]
    },
    {
      version: "v2.4.2",
      date: "2026.04.02",
      title: "고객지원 허브 연결성 개선",
      summary: "FAQ, 문의 이력, 1:1 문의 화면 간 이동 흐름을 정리했습니다.",
      bullets: [
        "검색 및 탐색 흐름 단순화",
        "고정 헤더와 언어 전환 패턴 일관화",
        "고객지원 공통 안내 문구 최신화"
      ]
    },
    {
      version: "v2.4.0",
      date: "2026.03.28",
      title: "업데이트 비서 카드군 고도화",
      summary: "변경 우선순위를 빠르게 판단할 수 있도록 큐 카드 정보를 강화했습니다.",
      bullets: [
        "우선순위, 기한, 후속 액션 문구 표준화",
        "사용자 포털형 카드 레이아웃으로 정리",
        "릴리스 정보와 후속 화면 링크 연결"
      ]
    }
  ],
  en: [
    {
      version: "v2.5.0",
      date: "2026.04.06",
      title: "Added the support version management page",
      summary: "Version status, priority queue, and recent release notes are now integrated into one user-facing workspace.",
      bullets: [
        "Reframed the update-assistant concept into the live user portal structure",
        "Added quick-action cards that connect to inquiry, FAQ, and library screens",
        "Clarified the current-versus-latest version comparison area"
      ]
    },
    {
      version: "v2.4.2",
      date: "2026.04.02",
      title: "Improved support hub connectivity",
      summary: "Smoothed navigation across FAQ, inquiry history, and 1:1 inquiry pages.",
      bullets: [
        "Simplified search and movement flows",
        "Unified sticky header and language-toggle behavior",
        "Updated shared support guidance copy"
      ]
    },
    {
      version: "v2.4.0",
      date: "2026.03.28",
      title: "Upgraded update-assistant cards",
      summary: "Queue cards now expose clearer priorities and next actions.",
      bullets: [
        "Standardized priority, due-date, and CTA labels",
        "Adjusted the cards to the user-portal layout",
        "Connected release summaries to follow-up screens"
      ]
    }
  ]
};

function buildActions(en: boolean): ActionItem[] {
  return [
    {
      icon: "support_agent",
      title: en ? "1:1 Inquiry" : "1:1 문의",
      body: en ? "Open the direct support intake page." : "직접 문의 등록 화면으로 이동합니다.",
      href: buildLocalizedPath("/mtn/my_inquiry", "/en/mtn/my_inquiry")
    },
    {
      icon: "forum",
      title: en ? "Inquiry History" : "문의 내역",
      body: en ? "Review existing threads and latest responses." : "기존 문의와 최근 답변을 다시 확인합니다.",
      href: buildLocalizedPath("/support/inquiry", "/en/support/inquiry")
    },
    {
      icon: "help",
      title: "FAQ",
      body: en ? "Check the knowledge base for common issues." : "자주 묻는 질문과 해결 가이드를 확인합니다.",
      href: buildLocalizedPath("/support/faq", "/en/support/faq")
    },
    {
      icon: "folder_open",
      title: en ? "Library" : "자료실",
      body: en ? "Open templates and downloadable references." : "양식과 참고 자료를 바로 확인합니다.",
      href: buildLocalizedPath("/support/download_list", "/en/support/download_list")
    }
  ];
}

export function VersionManagementMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const queue = useMemo(() => QUEUE[en ? "en" : "ko"], [en]);
  const releases = useMemo(() => RELEASES[en ? "en" : "ko"], [en]);
  const actions = useMemo(() => buildActions(en), [en]);

  useEffect(() => {
    logGovernanceScope("PAGE", "mtn-version", {
      route: window.location.pathname,
      releaseCount: releases.length,
      actionCount: actions.length
    });
  }, [actions.length, releases.length]);

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandSubtitle={copy.brandSubtitle}
        brandTitle={copy.brandTitle}
        homeHref={copy.homePath}
        rightContent={(
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/mtn/version")} onKo={() => navigate("/mtn/version")} />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.displayRole}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.displayName}</span>
            </div>
            <HomeButton className="min-h-0 rounded-[var(--kr-gov-radius)] px-4 py-2 text-sm" type="button" variant="primary">
              {copy.logout}
            </HomeButton>
          </div>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 pb-16 pt-16" data-help-id="mtn-version-hero">
          <div className="absolute inset-0 pointer-events-none opacity-15">
            <svg height="100%" width="100%">
              <pattern height="60" id="version-dots" patternUnits="userSpaceOnUse" width="60">
                <circle cx="2" cy="2" fill="white" r="1" />
              </pattern>
              <rect fill="url(#version-dots)" height="100%" width="100%" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="grid gap-10 xl:grid-cols-[1.1fr,0.9fr]">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  {copy.heroEyebrow}
                </div>
                <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">{copy.heroTitle}</h1>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{copy.heroBody}</p>
                <button className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15" type="button">
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  {copy.heroButton}
                </button>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm" data-help-id="mtn-version-summary">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white">{copy.versionTitle}</h2>
                    <p className="mt-1 text-sm text-slate-400">{copy.versionSubtitle}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {copy.currentStatus}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy.currentVersion}</p>
                    <p className="mt-3 text-3xl font-black text-white">v2.5.0</p>
                    <p className="mt-3 text-sm text-slate-400">2026.04.06 09:00 KST</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">{copy.latestVersion}</p>
                    <p className="mt-3 text-3xl font-black text-white">v2.5.0</p>
                    <p className="mt-3 text-sm text-indigo-100/80">Update Assistant Ready</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
                  {copy.currentStatusHint}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8" data-help-id="mtn-version-queue">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-2xl lg:p-8">
            <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{copy.queueTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{copy.queueSubtitle}</p>
              </div>
              <a className="inline-flex items-center gap-1 text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" href={buildLocalizedPath("/support/inquiry", "/en/support/inquiry")}>
                {copy.relatedInquiry}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {queue.map((item) => (
                <article className={`flex h-full flex-col rounded-2xl border border-gray-100 border-l-4 bg-slate-950 px-5 py-5 text-white shadow-sm ${item.toneClass}`} key={item.title}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${item.badgeClass}`}>{item.level}</span>
                    <span className="text-[11px] font-bold text-slate-500">{item.due}</span>
                  </div>
                  <h3 className="text-base font-black">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-300">{item.description}</p>
                  <button className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-indigo-300 hover:text-white" type="button">
                    {item.action}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
          <div className="grid gap-8 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-[28px] border border-gray-100 bg-white p-8 shadow-xl" data-help-id="mtn-version-release-notes">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined">new_releases</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{copy.releaseTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{copy.releaseSubtitle}</p>
                </div>
              </div>
              <div className="space-y-5">
                {releases.map((item) => (
                  <article className="rounded-2xl border border-gray-100 bg-gray-50 p-6" key={item.version}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                          <span className="material-symbols-outlined text-[16px]">update</span>
                          {item.version}
                        </div>
                        <h3 className="mt-4 text-xl font-black text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                      </div>
                      <div className="text-sm font-bold text-slate-400">{item.date}</div>
                    </div>
                    <ul className="mt-5 space-y-2">
                      {item.bullets.map((bullet) => (
                        <li className="flex items-start gap-2 text-sm text-slate-700" key={bullet}>
                          <span className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div className="rounded-[28px] border border-gray-100 bg-white p-8 shadow-xl" data-help-id="mtn-version-actions">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <span className="material-symbols-outlined">bolt</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{copy.actionTitle}</h2>
                    <p className="mt-1 text-sm text-slate-500">{copy.actionSubtitle}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {actions.map((item) => (
                    <a className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-md" href={item.href} key={item.title}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] bg-indigo-600 p-8 text-white shadow-xl">
                <h2 className="text-2xl font-black">{copy.referenceNoteTitle}</h2>
                <p className="mt-4 text-sm leading-7 text-indigo-100">{copy.referenceNoteBody}</p>
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
