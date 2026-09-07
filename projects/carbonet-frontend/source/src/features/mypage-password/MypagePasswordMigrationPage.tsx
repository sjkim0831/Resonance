import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { MypageKrdsLayout } from "../../components/mypage/MypageKrdsLayout";

const COPY = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "마이페이지 | 비밀번호 변경 및 계정 보안 설정",
    brandTitle: "마이페이지",
    brandSubtitle: "계정 보안 설정",
    title: "비밀번호 변경",
    subtitle: "개인정보 보호를 위해 주기적으로 비밀번호를 변경해 주세요.",
    securityLabel: "계정 보안 상태",
    securityValue: "정상",
    menuTitle: "마이페이지 메뉴",
    menuProfile: "개인 정보",
    menuPassword: "비밀번호 변경",
    menuNotification: "알림 설정",
    menuStaff: "담당자 관리",
    menuWithdraw: "회원 탈퇴",
    helpTitle: "도움이 필요하신가요?",
    helpBody: "보안 정책에 따라 3개월마다 비밀번호를 변경하는 것을 권장합니다.",
    helpLink: "보안 정책 보기",
    lastUpdated: "최근 변경일",
    currentPassword: "현재 비밀번호",
    newPassword: "새 비밀번호",
    confirmPassword: "새 비밀번호 확인",
    currentPlaceholder: "현재 비밀번호 입력",
    newPlaceholder: "영문, 숫자, 특수문자 포함 8~20자",
    confirmPlaceholder: "새 비밀번호 재입력",
    requirementTitle: "비밀번호 규칙",
    requirements: [
      "8자 이상 20자 이하로 입력해야 합니다.",
      "영문 대/소문자, 숫자, 특수문자 중 3종류 이상을 조합해야 합니다.",
      "아이디와 동일하거나 3자 이상 연속된 문자/숫자는 사용할 수 없습니다."
    ],
    strengthPending: "보안 수준: 입력 대기",
    strengthWeak: "보안 수준: 보통",
    strengthStrong: "보안 수준: 강함",
    cancel: "취소",
    submit: "비밀번호 변경",
    forgot: "비밀번호를 잊으셨나요?",
    recovery: "계정 복구 및 본인 확인 센터",
    mfaTitle: "다중 인증(MFA) 관리",
    mfaSubtitle: "비밀번호 외에 이메일 인증번호를 한 번 더 확인하여 계정을 보호합니다.",
    mfaEnabled: "활성화",
    mfaDisabled: "미사용",
    mfaRequest: "인증번호 받기",
    mfaVerify: "인증하고 활성화",
    mfaDisable: "MFA 해제",
    mfaCode: "6자리 인증번호",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)",
    footerLinks: ["개인정보처리방침", "이용약관", "사이트맵"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Member Security Services.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerServiceLine: "본 플랫폼은 기업용 온실가스 배출지 운영 및 계정 보안 관리를 지원합니다."
  },
  en: {
    skip: "Skip to main content",
    government: "Official Government Service of the Republic of Korea",
    guideline: "My Page | Password update and account security settings",
    brandTitle: "My Page",
    brandSubtitle: "Account Security Settings",
    title: "Change Password",
    subtitle: "Please update your password periodically to protect your personal information.",
    securityLabel: "Account Security",
    securityValue: "Normal",
    menuTitle: "Profile Hub Menu",
    menuProfile: "Personal Info",
    menuPassword: "Change Password",
    menuNotification: "Notifications",
    menuStaff: "Staff Management",
    menuWithdraw: "Close Account",
    helpTitle: "Need Help?",
    helpBody: "Per security policy, we recommend updating your password every 3 months.",
    helpLink: "View Security Policy",
    lastUpdated: "Last Updated",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    currentPlaceholder: "Enter current password",
    newPlaceholder: "Letters, numbers, symbols (8-20 chars)",
    confirmPlaceholder: "Re-enter new password",
    requirementTitle: "Password Requirements",
    requirements: [
      "Must be between 8 and 20 characters long.",
      "Combine at least 3 of uppercase, lowercase, numbers, or special characters.",
      "Avoid passwords identical to your ID or using 3+ consecutive characters or numbers."
    ],
    strengthPending: "Security Level: Pending Input",
    strengthWeak: "Security Level: Medium",
    strengthStrong: "Security Level: Strong",
    cancel: "Cancel",
    submit: "Update Password",
    forgot: "Forgot your password?",
    recovery: "Account Recovery & Identity Verification Center",
    mfaTitle: "Multi-factor authentication (MFA)",
    mfaSubtitle: "Protect your account with an email verification code in addition to your password.",
    mfaEnabled: "Enabled",
    mfaDisabled: "Disabled",
    mfaRequest: "Request code",
    mfaVerify: "Verify and enable",
    mfaDisable: "Disable MFA",
    mfaCode: "6-digit verification code",
    footerOrg: "CCUS Integrated Management HQ",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Contact: +82 2-1234-5678",
    footerLinks: ["Privacy Policy", "Terms of Service", "Sitemap"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Member Security Services.",
    footerLastModifiedLabel: "Last Modified:",
    footerWaAlt: "Web Accessibility Certification Mark",
    footerServiceLine: "This platform is optimized for corporate greenhouse gas site management and account security."
  }
} as const;

function strengthState(value: string, en: boolean) {
  if (!value) {
    return { filled: 0, label: en ? COPY.en.strengthPending : COPY.ko.strengthPending };
  }
  if (value.length < 10) {
    return { filled: 2, label: en ? COPY.en.strengthWeak : COPY.ko.strengthWeak };
  }
  return { filled: 4, label: en ? COPY.en.strengthStrong : COPY.ko.strengthStrong };
}

function MenuItem(props: {
  active?: boolean;
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-all",
        props.danger
          ? "text-red-500 hover:bg-red-50"
          : props.active
            ? "bg-blue-50 text-[var(--kr-gov-blue)]"
            : "text-gray-500 hover:bg-gray-50"
      ].join(" ")}
    >
      <span className="material-symbols-outlined text-[20px]">{props.icon}</span>
      {props.label}
    </button>
  );
}

export function MypagePasswordMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaDestination, setMfaDestination] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaDevelopmentCode, setMfaDevelopmentCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState("");
  const name = useMemo(() => session.value?.userId || (en ? "Hyunjang Lee" : "이현장 관리자"), [en, session.value?.userId]);
  const strength = strengthState(newPassword, en);

  const apiPrefix = en ? "/api/en/mypage" : "/api/mypage";
  const formPost = async (path: string, values: Record<string, string>) => {
    const response = await fetch(`${apiPrefix}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams(values)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const loadMfa = async () => {
    try {
      const response = await fetch(`${apiPrefix}/mfa`, { credentials: "include" });
      const data = await response.json();
      if (data?.redirectUrl) return navigate(data.redirectUrl);
      setMfaEnabled(Boolean(data?.mfaEnabled));
      setMfaDestination(String(data?.destinationMasked || ""));
    } catch {
      setMfaMessage(en ? "Unable to load MFA status." : "MFA 상태를 불러오지 못했습니다.");
    }
  };

  useEffect(() => { void loadMfa(); }, [apiPrefix]);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage(en ? "The new passwords do not match." : "새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setPasswordBusy(true);
    try {
      const data = await formPost("/password", { currentPassword, newPassword, confirmPassword });
      setPasswordMessage(String(data?.message || ""));
      if (data?.saved) setTimeout(() => navigate(en ? "/en/signin/loginView" : "/signin/loginView"), 800);
    } catch {
      setPasswordMessage(en ? "Password update failed." : "비밀번호 변경 요청에 실패했습니다.");
    } finally { setPasswordBusy(false); }
  };

  const requestMfa = async () => {
    setMfaBusy(true);
    try {
      const data = await formPost("/mfa/request", {});
      setMfaChallengeId(String(data?.challengeId || ""));
      setMfaDevelopmentCode(String(data?.developmentCode || ""));
      setMfaMessage(String(data?.message || ""));
    } catch { setMfaMessage(en ? "Code request failed." : "인증번호 요청에 실패했습니다."); }
    finally { setMfaBusy(false); }
  };

  const verifyMfa = async () => {
    setMfaBusy(true);
    try {
      const data = await formPost("/mfa/verify", { challengeId: mfaChallengeId, verificationCode: mfaCode });
      setMfaEnabled(Boolean(data?.mfaEnabled));
      setMfaMessage(String(data?.message || ""));
      if (data?.saved) { setMfaCode(""); setMfaChallengeId(""); setMfaDevelopmentCode(""); }
    } catch { setMfaMessage(en ? "Verification failed." : "인증 확인에 실패했습니다."); }
    finally { setMfaBusy(false); }
  };

  const disableMfa = async () => {
    setMfaBusy(true);
    try {
      const data = await formPost("/mfa/disable", { currentPassword });
      setMfaEnabled(Boolean(data?.mfaEnabled));
      setMfaMessage(String(data?.message || ""));
    } catch { setMfaMessage(en ? "Unable to disable MFA." : "MFA 해제에 실패했습니다."); }
    finally { setMfaBusy(false); }
  };

  logGovernanceScope("PAGE", "mypage-password", {});

  return (
    <div data-mypage-theme="krds-v1"
      className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]"
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
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.securityLabel}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{name}</span>
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/mypage/password")} onEn={() => navigate("/en/mypage/password")} />
          </>
        )}
      />
      <MypageKrdsLayout
        breadcrumb={copy.title}
        title={copy.title}
        description={copy.subtitle}
        statusLabel={copy.securityLabel}
        statusValue={copy.securityValue}
        sidebar={(
          <div data-help-id="mypage-password-menu">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm">
                <p className="mb-2 px-4 py-2 text-xs font-black text-[#052b57]">{copy.menuTitle}</p>
                <div className="space-y-1">
                  <MenuItem icon="person" label={copy.menuProfile} onClick={() => navigate(buildLocalizedPath("/mypage/profile", "/en/mypage/profile"))} />
                  <MenuItem active icon="lock_reset" label={copy.menuPassword} />
                  <MenuItem icon="notifications" label={copy.menuNotification} onClick={() => navigate(buildLocalizedPath("/mypage/notification", "/en/mypage/notification"))} />
                  <MenuItem icon="groups" label={copy.menuStaff} onClick={() => navigate(buildLocalizedPath("/mypage/staff", "/en/mypage/staff"))} />
                  <MenuItem danger icon="logout" label={copy.menuWithdraw} />
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50 p-5">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-900">
                  <span className="material-symbols-outlined text-[18px]">contact_support</span>
                  {copy.helpTitle}
                </h4>
                <p className="mb-4 text-[12px] leading-relaxed text-indigo-700">{copy.helpBody}</p>
                <a className="text-xs font-black text-[#246beb] underline" href="/support/faq">{copy.helpLink}</a>
              </div>
          </div>
        )}
      >
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-right"><span className="text-xs font-bold text-slate-500">{copy.lastUpdated}</span><strong className="ml-3 text-sm text-[#052b57]">2026.04.02 21:47</strong></div>
                <div className="p-8 lg:p-12" data-help-id="mypage-password-form">
                  <div className="mx-auto max-w-xl">
                    <form className="space-y-8" onSubmit={submitPassword}>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700" htmlFor="current-pw">{copy.currentPassword}</label>
                          <div className="relative">
                            <input id="current-pw" className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 pr-12 text-sm transition-all focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]" type={showCurrent ? "text" : "password"} placeholder={copy.currentPlaceholder} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" type="button" onClick={() => setShowCurrent((value) => !value)}>
                              <span className="material-symbols-outlined text-[20px]">{showCurrent ? "visibility_off" : "visibility"}</span>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700" htmlFor="new-pw">{copy.newPassword}</label>
                          <div className="relative">
                            <input id="new-pw" className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 pr-12 text-sm transition-all focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]" type={showNew ? "text" : "password"} placeholder={copy.newPlaceholder} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" type="button" onClick={() => setShowNew((value) => !value)}>
                              <span className="material-symbols-outlined text-[20px]">{showNew ? "visibility_off" : "visibility"}</span>
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <div key={index} className={`h-1 rounded-full ${index < strength.filled ? "bg-[var(--kr-gov-blue)]" : "bg-gray-200"}`} />
                            ))}
                          </div>
                          <p className="text-[11px] text-gray-400">{strength.label}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700" htmlFor="confirm-pw">{copy.confirmPassword}</label>
                          <input id="confirm-pw" className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm transition-all focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]" type="password" placeholder={copy.confirmPlaceholder} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <h5 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700">
                          <span className="material-symbols-outlined text-[16px] text-orange-500">info</span>
                          {copy.requirementTitle}
                        </h5>
                        <ul className="list-disc space-y-1 pl-4 text-[12px] text-gray-500">
                          {copy.requirements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                        <button className="flex-1 rounded-[var(--kr-gov-radius)] border border-gray-200 px-6 py-4 font-bold text-gray-600 transition-colors hover:bg-gray-50" type="button">{copy.cancel}</button>
                        <button disabled={passwordBusy} className="flex-[2] rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-4 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[var(--kr-gov-blue-hover)] disabled:opacity-50" type="submit">{passwordBusy ? "..." : copy.submit}</button>
                      </div>
                      {passwordMessage && <p className="rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-900" role="status">{passwordMessage}</p>}
                    </form>
                    <section className="mt-12 border-t border-gray-200 pt-10" data-help-id="mypage-mfa-management">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h4 className="text-xl font-black">{copy.mfaTitle}</h4>
                          <p className="mt-1 text-sm text-gray-500">{copy.mfaSubtitle}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${mfaEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                          {mfaEnabled ? copy.mfaEnabled : copy.mfaDisabled}
                        </span>
                      </div>
                      <ol className="mt-6 grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-4">
                        {[en ? "1. Check status" : "1. 상태 확인", en ? "2. Request code" : "2. 인증번호 요청", en ? "3. Verify code" : "3. 인증번호 확인", en ? "4. Enable" : "4. 활성화"].map((step) => <li key={step} className="rounded-lg border bg-gray-50 p-3">{step}</li>)}
                      </ol>
                      <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <p className="text-sm font-bold">{mfaDestination || (en ? "Registered email" : "등록 이메일")}</p>
                        {!mfaEnabled ? (
                          <div className="mt-4 space-y-3">
                            <button disabled={mfaBusy} onClick={requestMfa} type="button" className="rounded-lg bg-[var(--kr-gov-blue)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{copy.mfaRequest}</button>
                            {mfaChallengeId && <div className="flex flex-col gap-2 sm:flex-row"><input aria-label={copy.mfaCode} maxLength={6} inputMode="numeric" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} placeholder={copy.mfaCode} className="flex-1 rounded-lg border px-4 py-3" /><button disabled={mfaBusy || mfaCode.length !== 6} onClick={verifyMfa} type="button" className="rounded-lg border border-[var(--kr-gov-blue)] px-5 py-3 text-sm font-bold text-[var(--kr-gov-blue)] disabled:opacity-50">{copy.mfaVerify}</button></div>}
                            {mfaDevelopmentCode && <p className="text-xs font-bold text-orange-700">{en ? "Development verification code" : "개발 인증번호"}: {mfaDevelopmentCode}</p>}
                          </div>
                        ) : (
                          <button disabled={mfaBusy || !currentPassword} onClick={disableMfa} type="button" className="mt-4 rounded-lg border border-red-300 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-50">{copy.mfaDisable}</button>
                        )}
                        {mfaMessage && <p className="mt-3 text-sm font-bold text-gray-700" role="status">{mfaMessage}</p>}
                      </div>
                    </section>
                    <div className="mt-12 border-t border-gray-100 pt-8 text-center">
                      <p className="mb-4 text-sm text-gray-500">{copy.forgot}</p>
                      <a className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2 text-xs font-bold text-gray-600 transition-all hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href="#">
                        <span className="material-symbols-outlined text-[18px]">contact_mail</span>
                        {copy.recovery}
                      </a>
                    </div>
                  </div>
                </div>
      </MypageKrdsLayout>
      <UserPortalFooter orgName={copy.footerOrg} addressLine={copy.footerAddress} footerLinks={[...copy.footerLinks]} copyright={copy.footerCopyright} lastModifiedLabel={copy.footerLastModifiedLabel} waAlt={copy.footerWaAlt} serviceLine={copy.footerServiceLine} />
    </div>
  );
}

export default MypagePasswordMigrationPage;
