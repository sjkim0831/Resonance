import { useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

export function MypageEmailMigrationPage() {
  const en = isEnglish();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(en ? "lee.manager@korea.kr" : "lee.manager@korea.kr");
  const [phone, setPhone] = useState("010-1234-5678");

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "Official Government Service | Site Overseer Portal" : "대한민국 정부 공식 서비스 | 현장 운영 포털",
    brandTitle: en ? "Integrated Site Dashboard" : "통합 현장 대시보드",
    brandSubtitle: en ? "Site Overseer Control Center" : "현장 총괄 제어센터",
    role: en ? "General Manager" : "총괄 관리자",
    user: en ? "Hyun-jang Lee" : "이현장",
    back: en ? "Back to Dashboard" : "대시보드로 돌아가기",
    title: en ? "Account & Contact Settings" : "계정 및 연락처 설정",
    subtitle: en ? "Keep your password and contact information up to date for secure service use." : "안전한 서비스 이용을 위해 비밀번호와 연락처 정보를 최신 상태로 유지해 주세요.",
    passwordSection: en ? "Change Password" : "비밀번호 변경",
    currentPassword: en ? "Current Password" : "현재 비밀번호",
    newPassword: en ? "New Password" : "새 비밀번호",
    confirmPassword: en ? "Confirm New Password" : "새 비밀번호 확인",
    currentPlaceholder: en ? "Enter current password" : "현재 비밀번호 입력",
    newPlaceholder: en ? "Enter new password" : "새 비밀번호 입력",
    confirmPlaceholder: en ? "Re-enter new password" : "새 비밀번호 재입력",
    passwordHint: en ? "Must be at least 10 characters with letters, numbers, and special characters." : "영문, 숫자, 특수문자를 포함해 10자 이상으로 설정해 주세요.",
    savePassword: en ? "Save Password" : "비밀번호 저장",
    contactSection: en ? "Change Email / Phone Number" : "이메일 / 전화번호 변경",
    emailLabel: en ? "Email Address" : "이메일 주소",
    emailHint: en ? "Important notices and reports will be sent to this email address." : "중요 공지와 보고 알림은 이 이메일 주소로 발송됩니다.",
    emailPlaceholder: "example@korea.kr",
    verifyEmail: en ? "Send Verification" : "인증 메일 발송",
    phoneLabel: en ? "Mobile Number" : "휴대전화 번호",
    phoneHint: en ? "Provide an accurate number to receive urgent update notifications." : "긴급 변경 알림을 받을 수 있도록 정확한 번호를 입력해 주세요.",
    phonePlaceholder: "010-0000-0000",
    saveContact: en ? "Save Contact Information" : "연락처 정보 저장",
    noticeTitle: en ? "Security Notice" : "보안 안내",
    noticeBody: en ? "For your privacy, change your password periodically and do not share it with others." : "개인정보 보호를 위해 비밀번호를 주기적으로 변경하고 타인과 공유하지 마세요.",
    footerOrg: en ? "CCUS Integrated Management HQ" : "CCUS 통합관리본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Field Management Support Team: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀 02-1234-5678",
    footerService: en ? "This platform is optimized for greenhouse gas reduction site management." : "본 플랫폼은 온실가스 감축 현장 운영 관리를 위해 최적화되어 있습니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Service", "Download Manual"]) : Array.from(["개인정보처리방침", "이용약관", "매뉴얼 다운로드"]),
    footerWaAlt: en ? "Web Accessibility Certification" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[#f4f7fa] text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-500">{copy.role}</span>
              <span className="text-sm font-black text-slate-900">{copy.user}</span>
            </div>
            <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200" onClick={() => navigate(buildLocalizedPath("/mypage/profile", "/en/mypage/profile"))} type="button">
              {copy.back}
            </button>
            <UserLanguageToggle en={en} onKo={() => navigate("/mypage/email")} onEn={() => navigate("/en/mypage/email")} />
          </>
        )}
      />

      <main className="py-12" id="main-content">
        <div className="mx-auto max-w-[800px] px-4">
          <div className="mb-10" data-help-id="mypage-email-hero">
            <h2 className="text-3xl font-black text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>
          </div>

          <div className="space-y-8">
            <section className="rounded-[10px] border border-slate-200 bg-white p-8 shadow-sm" data-help-id="mypage-email-form">
              <div className="mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">lock</span>
                <h3 className="text-xl font-bold">{copy.passwordSection}</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="current-password">{copy.currentPassword}</label>
                  <input className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#005fde]" id="current-password" onChange={(event) => setCurrentPassword(event.target.value)} placeholder={copy.currentPlaceholder} type="password" value={currentPassword} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="next-password">{copy.newPassword}</label>
                  <input className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#005fde]" id="next-password" onChange={(event) => setNextPassword(event.target.value)} placeholder={copy.newPlaceholder} type="password" value={nextPassword} />
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    {copy.passwordHint}
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="confirm-password">{copy.confirmPassword}</label>
                  <input className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#005fde]" id="confirm-password" onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.confirmPlaceholder} type="password" value={confirmPassword} />
                </div>
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button className="rounded-[10px] bg-[var(--kr-gov-blue)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                    {copy.savePassword}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[10px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">contact_page</span>
                <h3 className="text-xl font-bold">{copy.contactSection}</h3>
              </div>
              <div className="space-y-6">
                <div className="grid items-end gap-4 md:grid-cols-4">
                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="email">{copy.emailLabel}</label>
                    <input className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#005fde]" id="email" onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} type="email" value={email} />
                    <p className="mt-1.5 text-[11px] text-slate-500">{copy.emailHint}</p>
                  </div>
                  <button className="h-[46px] rounded-[10px] border border-[var(--kr-gov-blue)] text-sm font-bold text-[var(--kr-gov-blue)] transition hover:bg-blue-50" type="button">
                    {copy.verifyEmail}
                  </button>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-900" htmlFor="phone">{copy.phoneLabel}</label>
                  <input className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#005fde]" id="phone" onChange={(event) => setPhone(event.target.value)} placeholder={copy.phonePlaceholder} type="tel" value={phone} />
                  <p className="mt-1.5 text-[11px] text-slate-500">{copy.phoneHint}</p>
                </div>
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button className="rounded-[10px] bg-[var(--kr-gov-blue)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                    {copy.saveContact}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[10px] border border-blue-100 bg-blue-50/70 p-6">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-blue-600">verified_user</span>
                <div>
                  <p className="text-sm font-bold text-blue-900">{copy.noticeTitle}</p>
                  <p className="mt-1 text-xs leading-6 text-blue-700">{copy.noticeBody}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
