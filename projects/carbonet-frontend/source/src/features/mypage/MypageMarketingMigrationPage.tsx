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
  menuTitle: string;
  profileLabel: string;
  securityLabel: string;
  notificationLabel: string;
  marketingLabel: string;
  companyLabel: string;
  helperTitle: string;
  helperText: string;
  guideTitle: string;
  guideDesc: string;
  emailTitle: string;
  emailDesc: string;
  smsTitle: string;
  smsDesc: string;
  pushTitle: string;
  pushDesc: string;
  partnerTitle: string;
  partnerDesc: string;
  on: string;
  off: string;
  readonly: string;
  save: string;
  saving: string;
  saveSuccess: string;
  saveUnavailable: string;
  privacyTitle: string;
  privacyDesc: string;
  faqTitle: string;
  faqDesc: string;
  displayRole: string;
  loginRequired: string;
  loginMove: string;
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
    title: "마케팅 수신",
    subtitle: "서비스 업데이트와 유용한 정보를 어떤 방식으로 받을지 관리합니다.",
    logout: "로그아웃",
    menuTitle: "My Page Menu",
    profileLabel: "프로필 설정",
    securityLabel: "보안 및 계정",
    notificationLabel: "알림 설정",
    marketingLabel: "마케팅 수신 동의",
    companyLabel: "기업 정보",
    helperTitle: "도움이 필요하신가요?",
    helperText: "수신 설정은 언제든지 다시 변경할 수 있으며, 법정 필수 고지는 동의 여부와 무관하게 발송됩니다.",
    guideTitle: "마케팅 수신 설정",
    guideDesc: "CCUS 플랫폼의 최신 소식과 유용한 정보를 수신하는 방법을 관리합니다.",
    emailTitle: "이메일 수신 동의",
    emailDesc: "업종별 탄소 감축 리포트, 신규 기능 업데이트, 정기 뉴스레터를 이메일로 받아봅니다.",
    smsTitle: "SMS 문자 알림 수신",
    smsDesc: "긴급한 검증 일정 변경 소식과 보안 강화 안내는 현재 읽기 전용 가이드입니다.",
    pushTitle: "플랫폼 푸시/인앱 알림",
    pushDesc: "대시보드 상단 알림 바 기반 인앱 알림은 현재 읽기 전용 상태입니다.",
    partnerTitle: "제3자 정보 제공 동의",
    partnerDesc: "파트너사 컨설팅과 정부 지원 사업 안내는 현재 읽기 전용 안내로 제공합니다.",
    on: "수신",
    off: "미수신",
    readonly: "읽기 전용",
    save: "설정 저장하기",
    saving: "저장 중...",
    saveSuccess: "마케팅 수신 설정을 저장했습니다.",
    saveUnavailable: "현재 저장할 수 없습니다.",
    privacyTitle: "개인정보 처리방침",
    privacyDesc: "귀하의 데이터는 암호화되어 안전하게 관리되며, 동의 없이 외부에 제공되지 않습니다.",
    faqTitle: "수신 설정 FAQ",
    faqDesc: "알림이 오지 않거나 이메일 주소를 변경하고 싶으신가요? 도움말을 확인하세요.",
    displayRole: "현장 감독관",
    loginRequired: "로그인 후 이용 가능합니다.",
    loginMove: "로그인 페이지로 이동",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Unified Account Hub.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    homePath: "/en/home",
    title: "Marketing Consent",
    subtitle: "Manage how you receive service updates and useful information.",
    logout: "Logout",
    menuTitle: "My Page Menu",
    profileLabel: "Profile Settings",
    securityLabel: "Security & Account",
    notificationLabel: "Notification Settings",
    marketingLabel: "Marketing Consent",
    companyLabel: "Company Info",
    helperTitle: "Need help?",
    helperText: "You can revise preferences at any time, while mandatory legal notices are still delivered regardless of consent.",
    guideTitle: "Marketing Consent Settings",
    guideDesc: "Manage how you receive the latest CCUS platform updates and useful information.",
    emailTitle: "Email Consent",
    emailDesc: "Receive reduction trend reports, feature updates, and regular newsletters by email.",
    smsTitle: "SMS Alerts",
    smsDesc: "Urgent schedule changes and security notices are currently shown as read-only guidance.",
    pushTitle: "Platform Push / In-app Alerts",
    pushDesc: "Top-bar in-app notices are currently displayed as read-only guidance.",
    partnerTitle: "Third-party Sharing Consent",
    partnerDesc: "Partner consulting and government program notices are currently read-only guidance.",
    on: "On",
    off: "Off",
    readonly: "Read-only",
    save: "Save Settings",
    saving: "Saving...",
    saveSuccess: "Marketing preference saved.",
    saveUnavailable: "Saving is currently unavailable.",
    privacyTitle: "Privacy Policy",
    privacyDesc: "Your data is encrypted and managed safely, and is never shared without consent.",
    faqTitle: "Preference FAQ",
    faqDesc: "Not receiving alerts or need to change your email? Check the help guide.",
    displayRole: "Field Supervisor",
    loginRequired: "Please sign in first.",
    loginMove: "Go to Sign In",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Field Support Team: 02-1234-5678",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Unified Account Hub.",
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

function ToggleRow({
  title,
  description,
  status,
  checked,
  onToggle,
  readonly = false
}: {
  title: string;
  description: string;
  status: string;
  checked: boolean;
  onToggle?: () => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-gray-50 pb-8 last:border-b-0 last:pb-0">
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
        <p className="mt-2 text-xs font-bold text-slate-400">{status}</p>
      </div>
      <button
        aria-pressed={checked}
        className={`relative mt-1 inline-flex h-6 w-11 items-center rounded-full px-1 ${checked ? "bg-[var(--kr-gov-blue)]" : "bg-gray-200"} ${readonly ? "cursor-default" : ""}`}
        onClick={readonly ? undefined : onToggle}
        type="button"
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export function MypageMarketingMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sectionState = useAsyncValue<MypageSectionPayload>(() => fetchMypageSection("marketing", en), [en]);
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
  const marketingValue = findItemValue(items, "현재 수신 설정");
  const [marketingEnabled, setMarketingEnabled] = useState(marketingValue === "Y");

  useEffect(() => {
    setMarketingEnabled(marketingValue === "Y");
  }, [marketingValue]);

  const member = useMemo(() => (page?.member || {}) as Record<string, unknown>, [page]);
  const displayName = stringValue(member.applcntNm) || stringValue(page?.userId) || "-";
  const sidebarItems = [
    { label: copy.profileLabel, href: buildLocalizedPath("/mypage/profile", "/en/mypage/profile"), icon: "person" },
    { label: copy.securityLabel, href: buildLocalizedPath("/mypage/security", "/en/mypage/security"), icon: "security" },
    { label: copy.notificationLabel, href: buildLocalizedPath("/mypage/notification", "/en/mypage/notification"), icon: "notifications_active" },
    { label: copy.marketingLabel, href: buildLocalizedPath("/mypage/marketing", "/en/mypage/marketing"), icon: "mail", active: true },
    { label: copy.companyLabel, href: buildLocalizedPath("/mypage/company", "/en/mypage/company"), icon: "business" }
  ];

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "mypage-marketing", {
      route: window.location.pathname,
      actorUserId: sessionState.value?.userId || "",
      actorInsttId: sessionState.value?.insttId || "",
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
      logGovernanceScope("ACTION", "mypage-save-marketing", {
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
        brandSubtitle="Unified Account Hub"
        brandTitle={copy.title}
        homeHref={copy.homePath}
        rightContent={
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/mypage/marketing")} onKo={() => navigate("/mypage/marketing")} />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.displayRole}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{displayName}</span>
            </div>
            <HomeButton className="min-h-0 rounded-[var(--kr-gov-radius)] px-4 py-2 text-sm" onClick={() => void sessionState.logout()} type="button" variant="primary">
              {copy.logout}
            </HomeButton>
          </div>
        }
      />

      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-10" id="main-content">
        <div className="flex flex-col gap-10 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-72">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 border-b border-gray-100 px-4 py-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">{copy.menuTitle}</h2>
              </div>
              <nav className="space-y-1">
                {sidebarItems.map((item) => (
                  <HomeLinkButton
                    className={item.active
                      ? "flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)]"
                      : "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-[var(--kr-gov-blue)]"}
                    href={item.href}
                    key={item.href}
                    variant="ghost"
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </HomeLinkButton>
                ))}
              </nav>
            </div>
            <div className="mt-6 rounded-xl bg-slate-900 p-6 text-white">
              <h3 className="text-sm font-bold">{copy.helperTitle}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{copy.helperText}</p>
            </div>
          </aside>

          <div className="flex-1">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" data-help-id="mypage-marketing-hero">
              <div className="border-b border-gray-100 p-8">
                <h1 className="mb-2 text-2xl font-black text-gray-900">{copy.guideTitle}</h1>
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{copy.guideDesc}</p>
              </div>
              <div className="p-8">
                {error ? (
                  <div className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-error)]/30 bg-[var(--kr-gov-error)]/5 px-4 py-3 text-sm text-[var(--kr-gov-error)]">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-success)]/30 bg-[var(--kr-gov-success)]/5 px-4 py-3 text-sm text-[var(--kr-gov-success)]">
                    {message}
                  </div>
                ) : null}

                {!page.canViewSection ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                    {stringValue(page.sectionReason)}
                  </div>
                ) : (
                  <>
                    <div className="space-y-8" data-help-id="mypage-marketing-consent">
                      <ToggleRow
                        checked={marketingEnabled}
                        description={copy.emailDesc}
                        onToggle={() => setMarketingEnabled((value) => !value)}
                        status={marketingEnabled ? copy.on : copy.off}
                        title={copy.emailTitle}
                      />
                      <ToggleRow checked={false} description={copy.smsDesc} readonly status={copy.readonly} title={copy.smsTitle} />
                      <ToggleRow checked={true} description={copy.pushDesc} readonly status={copy.readonly} title={copy.pushTitle} />
                      <ToggleRow checked={false} description={copy.partnerDesc} readonly status={copy.readonly} title={copy.partnerTitle} />
                    </div>

                    <div className="mt-12 flex items-center justify-between rounded-lg bg-gray-50 p-6">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{copy.marketingLabel}</p>
                        <p className="mt-1 text-xs text-gray-400">{page.canUseSection ? copy.helperText : stringValue(page.sectionReason)}</p>
                      </div>
                      <HomeButton className="px-8 py-3 font-bold" disabled={submitting || !page.canUseSection} onClick={() => void handleSave()} type="button" variant="primary">
                        {submitting ? copy.saving : copy.save}
                      </HomeButton>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-help-id="mypage-marketing-privacy">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">privacy_tip</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{copy.privacyTitle}</h3>
                  <p className="mt-1 text-xs leading-normal text-gray-500">{copy.privacyDesc}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-50">
                  <span className="material-symbols-outlined text-gray-400">help</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{copy.faqTitle}</h3>
                  <p className="mt-1 text-xs leading-normal text-gray-500">{copy.faqDesc}</p>
                </div>
              </div>
            </div>
          </div>
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
