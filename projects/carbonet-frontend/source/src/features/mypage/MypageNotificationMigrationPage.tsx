import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import {
  fetchMypageSection,
  saveMypageMarketing
} from "../../lib/api/portal";
import type { MypageSectionItem, MypageSectionPayload } from "../../lib/api/portalTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeLinkButton } from "../home-ui/common";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  homePath: string;
  title: string;
  subtitle: string;
  logout: string;
  accountSettings: string;
  displayRole: string;
  loginRequired: string;
  loginMove: string;
  save: string;
  saving: string;
  saveUnavailable: string;
  saveSuccess: string;
  helperTitle: string;
  helperText: string;
  recommendationTitle: string;
  recommendationBody: string;
  summaryLabels: [string, string, string];
  summaryValues: [string, string, string];
  settingsTitle: string;
  settingsDesc: string;
  marketingTitle: string;
  marketingDesc: string;
  readonlyTitle: string;
  readonlyDesc: string;
  emailChannel: string;
  smsChannel: string;
  appChannel: string;
  marketingChannel: string;
  emailValueLabel: string;
  statusOn: string;
  statusOff: string;
  statusReadonly: string;
  profileLabel: string;
  securityLabel: string;
  companyLabel: string;
  staffLabel: string;
  notificationLabel: string;
  footerOrg: string;
  footerAddress: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    homePath: "/home",
    title: "알림 설정",
    subtitle: "중요도 높은 안내와 운영 알림을 우선순위에 맞게 관리합니다.",
    logout: "로그아웃",
    accountSettings: "계정 및 설정",
    displayRole: "총괄 감독관",
    loginRequired: "로그인 후 이용 가능합니다.",
    loginMove: "로그인 페이지로 이동",
    save: "알림 설정 저장",
    saving: "저장 중...",
    saveUnavailable: "현재 저장할 수 없습니다.",
    saveSuccess: "알림 설정을 저장했습니다.",
    helperTitle: "Assistant's Suggestions",
    helperText: "현재 DB 구조에서는 알림 이메일과 마케팅 수신만 실제 저장됩니다. SMS와 앱 채널은 읽기 전용 안내 상태입니다.",
    recommendationTitle: "추천 설정",
    recommendationBody: "보고 누락과 검증 마감 알림은 이메일을 항상 켜두고, 앱 푸시는 후속 채널 확장 시 함께 적용하는 구성이 적합합니다.",
    summaryLabels: ["집중 관리 사업장", "평균 응답 속도", "읽지 않은 알림"],
    summaryValues: ["3개소", "24분", "0건"],
    settingsTitle: "통합 알림 수신 설정",
    settingsDesc: "운영 중인 사업장 전반에 적용되는 기본 알림 정책입니다.",
    marketingTitle: "마케팅 및 안내 수신",
    marketingDesc: "뉴스레터, 서비스 공지, 이벤트 소식 수신 여부를 저장합니다.",
    readonlyTitle: "채널 적용 범위",
    readonlyDesc: "채널별 세부 컬럼이 아직 없어 이메일 외 채널은 현재 읽기 전용으로 표시합니다.",
    emailChannel: "긴급 보안 및 누락 안내",
    smsChannel: "점검 일정 및 운영 리마인드",
    appChannel: "시스템 공지 및 승인 결과",
    marketingChannel: "마케팅 수신 동의",
    emailValueLabel: "알림 수신 이메일",
    statusOn: "사용",
    statusOff: "미사용",
    statusReadonly: "읽기 전용",
    profileLabel: "내 정보",
    securityLabel: "보안 설정",
    companyLabel: "기업 정보",
    staffLabel: "담당자 관리",
    notificationLabel: "알림 설정",
    footerOrg: "탄소중립 CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Integrated Management Portal. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    homePath: "/en/home",
    title: "Notification Settings",
    subtitle: "Manage high-priority notices and operational alerts with clear channel priorities.",
    logout: "Logout",
    accountSettings: "Account & Settings",
    displayRole: "General Overseer",
    loginRequired: "Please sign in first.",
    loginMove: "Go to Sign In",
    save: "Save Notification Settings",
    saving: "Saving...",
    saveUnavailable: "Saving is currently unavailable.",
    saveSuccess: "Notification settings saved.",
    helperTitle: "Assistant's Suggestions",
    helperText: "The current database persists the notification email and marketing consent only. SMS and app channels are shown as read-only guidance.",
    recommendationTitle: "Recommended Configuration",
    recommendationBody: "Keep omission and verification deadline alerts active on email, then expand app push once channel-specific persistence is added.",
    summaryLabels: ["Critical Sites", "Average Response", "Unread Alerts"],
    summaryValues: ["3 sites", "24 min", "0"],
    settingsTitle: "Integrated Notification Settings",
    settingsDesc: "Baseline notification policy applied across managed sites.",
    marketingTitle: "Marketing & Service Notices",
    marketingDesc: "Stores whether you receive newsletters, service updates, and event announcements.",
    readonlyTitle: "Channel Coverage",
    readonlyDesc: "Detailed per-channel columns are not available yet, so channels other than email are currently read-only.",
    emailChannel: "Urgent security and omission alerts",
    smsChannel: "Inspection schedules and reminders",
    appChannel: "System announcements and approval results",
    marketingChannel: "Marketing consent",
    emailValueLabel: "Notification email",
    statusOn: "On",
    statusOff: "Off",
    statusReadonly: "Read-only",
    profileLabel: "My Profile",
    securityLabel: "Security",
    companyLabel: "Company",
    staffLabel: "Staff",
    notificationLabel: "Notifications",
    footerOrg: "Carbon Neutral CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Phone: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Integrated Management Portal. All rights reserved.",
    footerLastModifiedLabel: "Last Updated:",
    footerWaAlt: "Web Accessibility Quality Mark"
  }
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function findItemValue(items: MypageSectionItem[] | undefined, label: string) {
  return items?.find((item) => item.label === label)?.value || "";
}

function ChannelRow({
  description,
  label,
  status,
  value
}: {
  description: string;
  label: string;
  status: string;
  value: "on" | "off" | "readonly";
}) {
  const active = value === "on";
  const readonly = value === "readonly";
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${readonly ? "bg-slate-100 text-slate-500" : active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
          {status}
        </span>
        <div className={`flex h-7 w-12 items-center rounded-full px-1 ${readonly ? "bg-slate-300" : active ? "bg-indigo-600" : "bg-slate-400"}`}>
          <span className={`h-5 w-5 rounded-full bg-white transition-transform ${active ? "translate-x-5" : "translate-x-0"}`} />
        </div>
      </div>
    </div>
  );
}

export function MypageNotificationMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sectionState = useAsyncValue<MypageSectionPayload>(() => fetchMypageSection("notification", en), [en]);
  const page = sectionState.value;
  const sessionState = useFrontendSession({ enabled: page?.authenticated !== false });

  useEffect(() => {
    setError(sectionState.error);
  }, [sectionState.error]);

  useEffect(() => {
    if (page?.authenticated === false && page.redirectUrl) {
      navigate(String(page.redirectUrl));
    }
  }, [page]);

  const items = page?.items || [];
  const email = findItemValue(items, "알림 수신 이메일") || "-";
  const marketingValue = findItemValue(items, "마케팅 수신");
  const guideText = findItemValue(items, "안내") || copy.helperText;
  const [marketingEnabled, setMarketingEnabled] = useState(marketingValue === "Y");

  useEffect(() => {
    setMarketingEnabled(marketingValue === "Y");
  }, [marketingValue]);

  const member = useMemo(() => (page?.member || {}) as Record<string, unknown>, [page]);
  const displayName = stringValue(member.applcntNm) || stringValue(page?.userId) || "-";
  const sidebarItems = [
    { label: copy.profileLabel, href: buildLocalizedPath("/mypage/profile", "/en/mypage/profile"), icon: "account_circle" },
    { label: copy.securityLabel, href: buildLocalizedPath("/mypage/security", "/en/mypage/security"), icon: "security" },
    { label: copy.companyLabel, href: buildLocalizedPath("/mypage/company", "/en/mypage/company"), icon: "business" },
    { label: copy.staffLabel, href: buildLocalizedPath("/mypage/staff", "/en/mypage/staff"), icon: "groups" },
    { label: copy.notificationLabel, href: buildLocalizedPath("/mypage/notification", "/en/mypage/notification"), icon: "notifications_active", active: true }
  ];

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "mypage-notification", {
      route: window.location.pathname,
      actorUserId: sessionState.value?.userId || "",
      actorInsttId: sessionState.value?.insttId || "",
      section: page.section || "",
      canViewSection: Boolean(page.canViewSection),
      canUseSection: Boolean(page.canUseSection),
      marketingEnabled
    });
  }, [marketingEnabled, page, sessionState.value]);

  async function handleSave() {
    const session = sessionState.value;
    if (!session) {
      setError(copy.saveUnavailable);
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await saveMypageMarketing(session, marketingEnabled ? "Y" : "N", en, stringValue(member.insttId));
      await sectionState.reload();
      setMessage(copy.saveSuccess);
      logGovernanceScope("ACTION", "mypage-save-notification", {
        actorUserId: session.userId || "",
        actorInsttId: session.insttId || "",
        marketingEnabled
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.saveUnavailable);
    } finally {
      setSubmitting(false);
    }
  }

  if (!page) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  if (page.authenticated === false) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-24">
        <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">{copy.loginRequired}</h2>
          <HomeLinkButton className="mt-6 px-5 py-3 text-sm" href={stringValue(page.redirectUrl) || buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} variant="primary">
            {copy.loginMove}
          </HomeLinkButton>
        </div>
      </main>
    );
  }

  return (
    <div className="bg-[#f8fafc] text-[var(--kr-gov-text-primary)] min-h-screen">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandSubtitle={en ? "Notification Control Center" : "알림 제어 센터"}
        brandTitle={copy.title}
        homeHref={copy.homePath}
        rightContent={
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/mypage/notification")} onKo={() => navigate("/mypage/notification")} />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-500">{copy.displayRole}</span>
              <span className="text-sm font-black text-slate-900">{displayName}</span>
            </div>
            <HomeButton className="min-h-0 rounded-[var(--kr-gov-radius)] px-4 py-2 text-sm" onClick={() => void sessionState.logout()} type="button" variant="primary">
              {copy.logout}
            </HomeButton>
          </div>
        }
      />

      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8" id="main-content">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <nav className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="px-4 py-3 text-xs font-bold uppercase tracking-[0.28em] text-slate-400">{copy.accountSettings}</h2>
              <div className="mt-1 flex flex-col gap-1">
                {sidebarItems.map((item) => (
                  <HomeLinkButton
                    className={item.active
                      ? "flex items-center gap-3 rounded-[18px] border border-indigo-100 bg-indigo-50 px-4 py-4 text-sm font-bold text-indigo-700"
                      : "flex items-center gap-3 rounded-[18px] px-4 py-4 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-[var(--kr-gov-blue)]"}
                    href={item.href}
                    key={item.href}
                    variant="ghost"
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </HomeLinkButton>
                ))}
              </div>
            </nav>

            <section className="overflow-hidden rounded-[24px] border border-indigo-100 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-5 py-4">
                <span className="material-symbols-outlined text-[20px] text-indigo-600">lightbulb</span>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-indigo-900">{copy.helperTitle}</h2>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{copy.recommendationTitle}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{copy.recommendationBody}</p>
                </div>
                <p className="text-xs leading-6 text-slate-500">{guideText}</p>
              </div>
            </section>
          </aside>

          <section className="space-y-8">
            <section className="overflow-hidden rounded-[28px] bg-slate-900 text-white shadow-xl" data-help-id="mypage-notification-hero">
              <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-10">
                <div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-indigo-200">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Intelligent Assistant Core
                  </div>
                  <h1 className="mt-5 text-3xl font-black leading-tight lg:text-4xl">{copy.title}</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">{copy.subtitle}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300">{copy.emailValueLabel}</span>
                    <span className="material-symbols-outlined text-indigo-300">alternate_email</span>
                  </div>
                  <p className="mt-6 break-all text-2xl font-black">{email}</p>
                  <p className="mt-4 text-xs leading-6 text-slate-400">{copy.helperText}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3" data-help-id="mypage-notification-summary">
              {copy.summaryLabels.map((label, index) => (
                <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm" key={label}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{copy.summaryValues[index]}</p>
                </div>
              ))}
            </section>

            {error ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-error)]/30 bg-[var(--kr-gov-error)]/5 px-4 py-3 text-sm text-[var(--kr-gov-error)]">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-success)]/30 bg-[var(--kr-gov-success)]/5 px-4 py-3 text-sm text-[var(--kr-gov-success)]">
                {message}
              </div>
            ) : null}

            {!page.canViewSection ? (
              <section className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-black text-slate-900">{copy.notificationLabel}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{stringValue(page.sectionReason) || copy.helperText}</p>
              </section>
            ) : (
              <>
                <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" data-help-id="mypage-notification-settings">
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{copy.settingsTitle}</h2>
                      <p className="mt-1 text-sm text-slate-500">{copy.settingsDesc}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {page.canUseSection ? copy.statusOn : copy.statusReadonly}
                    </div>
                  </div>
                  <div>
                    <ChannelRow
                      description={`${copy.emailValueLabel}: ${email}`}
                      label={copy.emailChannel}
                      status={copy.statusOn}
                      value="on"
                    />
                    <ChannelRow
                      description={copy.readonlyDesc}
                      label={copy.smsChannel}
                      status={copy.statusReadonly}
                      value="readonly"
                    />
                    <ChannelRow
                      description={copy.readonlyDesc}
                      label={copy.appChannel}
                      status={copy.statusReadonly}
                      value="readonly"
                    />
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-help-id="mypage-notification-marketing">
                    <h2 className="text-lg font-black text-slate-900">{copy.marketingTitle}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{copy.marketingDesc}</p>
                    <div className="mt-6 flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-5">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{copy.marketingChannel}</p>
                        <p className="mt-1 text-xs text-slate-500">{marketingEnabled ? copy.statusOn : copy.statusOff}</p>
                      </div>
                      <button
                        className={`flex h-8 w-14 items-center rounded-full px-1 ${marketingEnabled ? "bg-indigo-600" : "bg-slate-400"}`}
                        onClick={() => setMarketingEnabled((value) => !value)}
                        type="button"
                      >
                        <span className={`h-6 w-6 rounded-full bg-white transition-transform ${marketingEnabled ? "translate-x-6" : "translate-x-0"}`} />
                      </button>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <HomeButton className="px-5 py-3 text-sm" disabled={submitting} onClick={() => void handleSave()} type="button" variant="primary">
                        {submitting ? copy.saving : copy.save}
                      </HomeButton>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900">{copy.readonlyTitle}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{copy.readonlyDesc}</p>
                    <div className="mt-6 space-y-3">
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{copy.emailValueLabel}</p>
                        <p className="mt-2 break-all text-sm font-bold text-slate-800">{email}</p>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">DB Note</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{guideText}</p>
                      </div>
                    </div>
                  </section>
                </section>
              </>
            )}
          </section>
        </div>
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
