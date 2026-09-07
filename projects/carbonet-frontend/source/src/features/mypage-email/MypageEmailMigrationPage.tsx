import { useEffect, useState } from "react";
import {
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

export function MypageEmailMigrationPage() {
  const en = isEnglish();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [challengeId, setChallengeId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingChannel, setPendingChannel] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [message, setMessage] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function readApiPayload(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    const responseText = await response.text();
    if (!contentType.toLowerCase().includes("application/json")) {
      setSessionExpired(true);
      throw new Error(en ? "Your login session has expired. Please sign in again." : "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(en ? "The server response could not be read. Please try again." : "서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  useEffect(() => {
    fetch(buildLocalizedPath("/api/mypage/section/email", "/api/en/mypage/section/email"), { credentials: "include" })
      .then(readApiPayload)
      .then(payload => {
        const member = payload.member || {};
        if (member.applcntEmailAdres) setEmail(member.applcntEmailAdres);
        const digits = `${member.areaNo || ""}${member.entrprsMiddleTelno || ""}${member.entrprsEndTelno || ""}`;
        if (digits.length >= 10) setPhone(digits.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3"));
      }).catch(() => setMessage(en ? "Unable to load current contact information." : "현재 연락처를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [en]);

  async function requestVerification(channel: "EMAIL" | "PHONE") {
    setBusy(true); setMessage(""); setSessionExpired(false);
    try {
      const body = new URLSearchParams({ channel, targetValue: channel === "EMAIL" ? email : phone });
      const response = await fetch(buildLocalizedPath("/api/mypage/contact-verification/request", "/api/en/mypage/contact-verification/request"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
      });
      const payload = await readApiPayload(response);
      if (!payload.challengeId) throw new Error(payload.message || "Verification request failed");
      setChallengeId(payload.challengeId); setPendingChannel(channel); setVerificationCode("");
      setMessage(`${payload.message}${payload.developmentCode ? ` · DEV ${payload.developmentCode}` : ""}`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  async function confirmVerification() {
    setBusy(true); setMessage(""); setSessionExpired(false);
    try {
      const body = new URLSearchParams({ challengeId, verificationCode });
      const response = await fetch(buildLocalizedPath("/api/mypage/contact-verification/confirm", "/api/en/mypage/contact-verification/confirm"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
      });
      const payload = await readApiPayload(response);
      if (!payload.saved) throw new Error(payload.message || "Verification failed");
      setMessage(payload.message); setChallengeId(""); setVerificationCode("");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "Official Government Service | Site Overseer Portal" : "대한민국 정부 공식 서비스 | 현장 운영 포털",
    brandTitle: en ? "CCUS Carbon Neutrality Platform" : "CCUS 탄소중립 플랫폼",
    brandSubtitle: en ? "Carbon Footprint Platform" : "탄소발자국 플랫폼",
    back: en ? "My Page" : "마이페이지",
    title: en ? "Change and verify contact information" : "연락처 변경·재인증",
    subtitle: en ? "Verify and update the email address or mobile number used for service notifications." : "서비스 알림에 사용할 이메일과 휴대전화 번호를 인증하고 변경합니다.",
    contactSection: en ? "Select contact method" : "변경할 연락처 선택",
    emailLabel: en ? "Email Address" : "이메일 주소",
    emailHint: en ? "Important notices and reports will be sent to this email address." : "중요 공지와 보고 알림은 이 이메일 주소로 발송됩니다.",
    emailPlaceholder: "example@korea.kr",
    verifyEmail: en ? "Send Verification" : "인증 메일 발송",
    phoneLabel: en ? "Mobile Number" : "휴대전화 번호",
    phoneHint: en ? "Provide an accurate number to receive urgent update notifications." : "긴급 변경 알림을 받을 수 있도록 정확한 번호를 입력해 주세요.",
    phonePlaceholder: "010-0000-0000",
    saveContact: en ? "Save Contact Information" : "연락처 정보 저장",
    noticeTitle: en ? "Before changing contact information" : "변경 전 확인해 주세요",
    noticeBody: en ? "The new contact information is applied only after verification. Service notices will be sent to the verified contact." : "새 연락처는 인증을 완료한 뒤 적용됩니다. 이후 서비스 알림과 중요 안내는 인증된 연락처로 발송됩니다.",
    footerOrg: en ? "CCUS Integrated Management HQ" : "CCUS 통합관리본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Field Management Support Team: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀 02-1234-5678",
    footerService: en ? "This platform is optimized for greenhouse gas reduction site management." : "본 플랫폼은 온실가스 감축 현장 운영 관리를 위해 최적화되어 있습니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Service", "Download Manual"]) : Array.from(["개인정보처리방침", "이용약관", "매뉴얼 다운로드"]),
    footerWaAlt: en ? "Web Accessibility Certification" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div data-mypage-theme="krds-v1"
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
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200" onClick={() => navigate(buildLocalizedPath("/mypage/profile", "/en/mypage/profile"))} type="button">
              {copy.back}
            </button>
            <UserLanguageToggle en={en} onKo={() => navigate("/mypage/email")} onEn={() => navigate("/en/mypage/email")} />
          </>
        )}
      />

      <main className="pb-14" id="main-content" style={{ paddingTop: "3.5rem" }}>
        <div className="mx-auto max-w-[1040px] px-5 md:px-8">
          <div className="mb-8 border-b border-slate-300 pb-7">
            <p className="mb-2 text-sm font-bold text-[#005fde]">{en ? "MY PAGE" : "마이페이지"}</p>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#052b57] md:text-4xl">{copy.title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-help-id="mypage-email-form">
              <div className="border-b border-slate-200 px-6 py-5 md:px-8">
                <p className="text-lg font-black text-slate-900">{copy.contactSection}</p>
                <p className="mt-1 text-sm text-slate-500">{en ? "Enter a new contact and complete identity verification." : "변경할 새 연락처를 입력하고 본인 인증을 완료해 주세요."}</p>
              </div>
              <div className="space-y-5 p-6 md:p-8">
                <div className="rounded-xl border border-slate-200 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="material-symbols-outlined rounded-full bg-blue-50 p-2 text-[#005fde]">mail</span>
                    <div><h2 className="font-black">{copy.emailLabel}</h2><p className="text-xs text-slate-500">{copy.emailHint}</p></div>
                  </div>
                  <label className="mb-2 block text-sm font-bold" htmlFor="email">{en ? "New email address" : "새 이메일 주소"}</label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <input disabled={loading} className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-[#005fde] focus:ring-2 focus:ring-blue-100" id="email" onChange={(event) => setEmail(event.target.value)} placeholder={loading ? (en ? "Loading..." : "불러오는 중...") : copy.emailPlaceholder} type="email" value={email} />
                    <button disabled={busy || loading || !email.trim()} onClick={() => void requestVerification("EMAIL")} className="min-h-12 rounded-lg bg-[#00378b] px-4 text-sm font-bold text-white hover:bg-[#002d72] disabled:cursor-not-allowed disabled:bg-slate-300" type="button">
                    {copy.verifyEmail}
                  </button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="material-symbols-outlined rounded-full bg-blue-50 p-2 text-[#005fde]">smartphone</span>
                    <div><h2 className="font-black">{copy.phoneLabel}</h2><p className="text-xs text-slate-500">{copy.phoneHint}</p></div>
                  </div>
                  <label className="mb-2 block text-sm font-bold" htmlFor="phone">{en ? "New mobile number" : "새 휴대전화 번호"}</label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                    <input disabled={loading} className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-[#005fde] focus:ring-2 focus:ring-blue-100" id="phone" onChange={(event) => setPhone(event.target.value)} placeholder={loading ? (en ? "Loading..." : "불러오는 중...") : copy.phonePlaceholder} type="tel" value={phone} />
                    <button disabled={busy || loading || !phone.trim()} onClick={() => void requestVerification("PHONE")} className="min-h-12 rounded-lg bg-[#00378b] px-4 text-sm font-bold text-white hover:bg-[#002d72] disabled:cursor-not-allowed disabled:bg-slate-300" type="button">
                    {en ? "Send mobile verification" : "휴대전화 인증번호 발송"}
                  </button>
                  </div>
                </div>
                {challengeId && <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <label className="mb-2 block text-sm font-bold" htmlFor="verification-code">{pendingChannel === "EMAIL" ? copy.emailLabel : copy.phoneLabel} · {en ? "Verification code" : "인증번호"}</label>
                  <div className="flex gap-3"><input id="verification-code" inputMode="numeric" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ""))} className="min-h-12 flex-1 rounded-lg border px-4" placeholder="000000"/><button disabled={busy || verificationCode.length !== 6} onClick={() => void confirmVerification()} className="rounded-lg bg-[var(--kr-gov-blue)] px-5 font-bold text-white disabled:opacity-50">{en ? "Verify & apply" : "인증 및 변경"}</button></div>
                </div>}
                {message && <div role="status" className={`rounded-lg border p-4 text-sm font-bold ${sessionExpired ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50"}`}>
                  <p>{message}</p>
                  {sessionExpired && <button type="button" className="mt-3 rounded-lg bg-[#00378b] px-4 py-2 text-white" onClick={() => navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"))}>{en ? "Go to sign in" : "로그인으로 이동"}</button>}
                </div>}
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-blue-600">verified_user</span>
                <div>
                  <p className="text-sm font-bold text-blue-900">{copy.noticeTitle}</p>
                  <p className="mt-1 text-xs leading-6 text-blue-700">{copy.noticeBody}</p>
                  <ul className="mt-4 space-y-2 border-t border-blue-200 pt-4 text-xs leading-5 text-blue-800">
                    <li>• {en ? "Only one contact can be changed at a time." : "이메일과 휴대전화는 각각 인증합니다."}</li>
                    <li>• {en ? "Expired codes must be reissued." : "인증번호 만료 시 다시 발급해 주세요."}</li>
                    <li>• {en ? "The previous contact remains until completion." : "완료 전까지 기존 연락처가 유지됩니다."}</li>
                  </ul>
                </div>
              </div>
            </aside>
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
