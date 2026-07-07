import { useMemo, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

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
    menuTitle: "Profile Hub Menu",
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
  const name = useMemo(() => session.value?.userId || (en ? "Hyunjang Lee" : "이현장 관리자"), [en, session.value?.userId]);
  const strength = strengthState(newPassword, en);

  logGovernanceScope("PAGE", "mypage-password", {});

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
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-[100] focus:bg-[var(--kr-gov-blue)] focus:p-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
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
      <main className="min-h-screen pb-20" id="main-content">
        <section className="relative overflow-hidden bg-slate-900 pb-24 pt-12" data-help-id="mypage-password-hero">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
              backgroundSize: "30px 30px"
            }}
          />
          <div className="relative z-10 mx-auto flex max-w-[1440px] items-end gap-6 px-4 text-white lg:px-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white/10 bg-indigo-500 shadow-2xl">
              <span className="material-symbols-outlined text-[40px] text-white">manage_accounts</span>
            </div>
            <div className="flex-1 pb-1">
              <h2 className="text-3xl font-black">{copy.brandTitle}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-indigo-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {copy.securityLabel}: <span className="text-white">{copy.securityValue}</span>
              </p>
            </div>
          </div>
        </section>
        <section className="relative z-20 mx-auto -mt-12 max-w-[1440px] px-4 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            <aside className="w-full shrink-0 lg:w-72" data-help-id="mypage-password-menu">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm">
                <p className="mb-2 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">{copy.menuTitle}</p>
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
                <a className="text-xs font-black text-indigo-600 underline" href="#">{copy.helpLink}</a>
              </div>
            </aside>
            <div className="flex-1">
              <div className="overflow-hidden rounded-lg border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-white p-8">
                  <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <h3 className="mb-1 text-2xl font-black text-[var(--kr-gov-text-primary)]">{copy.title}</h3>
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{copy.subtitle}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-tight text-gray-400">{copy.lastUpdated}</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-gray-700">2026.04.02 21:47</span>
                    </div>
                  </div>
                </div>
                <div className="p-8 lg:p-12" data-help-id="mypage-password-form">
                  <div className="mx-auto max-w-xl">
                    <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
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
                        <button className="flex-[2] rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-4 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[var(--kr-gov-blue-hover)]" type="submit">{copy.submit}</button>
                      </div>
                    </form>
                    <div className="mt-12 border-t border-gray-100 pt-8 text-center">
                      <p className="mb-4 text-sm text-gray-500">{copy.forgot}</p>
                      <a className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2 text-xs font-bold text-gray-600 transition-all hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href="#">
                        <span className="material-symbols-outlined text-[18px]">contact_mail</span>
                        {copy.recovery}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <UserPortalFooter orgName={copy.footerOrg} addressLine={copy.footerAddress} footerLinks={[...copy.footerLinks]} copyright={copy.footerCopyright} lastModifiedLabel={copy.footerLastModifiedLabel} waAlt={copy.footerWaAlt} serviceLine={copy.footerServiceLine} />
    </div>
  );
}

export default MypagePasswordMigrationPage;
