import { FormEvent, useEffect, useMemo, useState } from "react";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter, UserPortalHeader } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type Invite = { success?: boolean; status?: string; message?: string; insttId?: string; companyName?: string; managerName?: string; email?: string; expiresAt?: string };

export function CompanyMasterInviteMigrationPage() {
  const en = isEnglish();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [invite, setInvite] = useState<Invite>({});
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [userName, setUserName] = useState("");
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/join/api/company-master-invitation?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ body }) => { setInvite(body); setUserName(body.managerName || ""); setMessage(body.message || ""); })
      .catch(() => setMessage("초대 정보를 불러오지 못했습니다."))
      .finally(() => setBusy(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage("비밀번호 확인 값이 일치하지 않습니다."); return; }
    setBusy(true);
    const response = await fetch("/join/api/company-master-invitation/activate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, insttId: invite.insttId, accountId, password, userName }) });
    const body = await response.json();
    setMessage(body.message || "처리 결과를 확인해 주세요.");
    setDone(response.ok && body.success === true);
    setBusy(false);
  }

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <UserGovernmentBar governmentText="대한민국 정부 공식 서비스" guidelineText="디지털 정부서비스" />
    <UserPortalHeader brandTitle="CCUS 탄소중립 플랫폼" brandSubtitle="기업 마스터 계정 개설" homeHref={buildLocalizedPath("/home", "/en/home")} rightContent={<UserLanguageToggle en={en} onKo={() => navigate(`/join/companyMasterInvite?token=${encodeURIComponent(token)}`)} onEn={() => navigate(`/join/en/companyMasterInvite?token=${encodeURIComponent(token)}`)} />} />
    <main className="mx-auto w-full max-w-3xl px-4 py-12" id="main-content">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 md:p-10">
        <p className="text-sm font-black text-blue-700">회원사 승인 후속 절차 · 1회용 초대</p>
        <h1 className="mt-2 text-3xl font-black">기업 마스터 계정 설정</h1>
        {invite.companyName && <div className="mt-6 rounded-2xl bg-blue-50 p-5"><strong className="text-lg">{invite.companyName}</strong><p className="mt-1 text-sm text-slate-600">초대 대상 {invite.email} · 유효기한 {invite.expiresAt}</p></div>}
        <div className={`mt-6 rounded-xl border p-4 text-sm font-bold ${done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : invite.success ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{busy ? "처리 중입니다..." : message}</div>
        {invite.success && !done && <form className="mt-7 grid gap-5" onSubmit={submit}>
          <label className="grid gap-2 font-bold">담당자 이름<input className="min-h-12 rounded-xl border border-slate-300 px-4" value={userName} onChange={(e)=>setUserName(e.target.value)} required /></label>
          <label className="grid gap-2 font-bold">로그인 아이디<input className="min-h-12 rounded-xl border border-slate-300 px-4" value={accountId} onChange={(e)=>setAccountId(e.target.value)} pattern="[A-Za-z][A-Za-z0-9._-]{4,39}" required /></label>
          <label className="grid gap-2 font-bold">비밀번호<input className="min-h-12 rounded-xl border border-slate-300 px-4" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={10} required /><span className="text-xs font-normal text-slate-500">영문 대·소문자, 숫자, 특수문자를 포함한 10자 이상</span></label>
          <label className="grid gap-2 font-bold">비밀번호 확인<input className="min-h-12 rounded-xl border border-slate-300 px-4" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} minLength={10} required /></label>
          <button disabled={busy} className="min-h-12 rounded-xl bg-blue-800 px-5 font-black text-white disabled:opacity-50">계정 설정 완료</button>
        </form>}
        {done && <button className="mt-6 min-h-12 w-full rounded-xl bg-blue-800 px-5 font-black text-white" onClick={()=>navigate("/signin/loginView")}>최초 로그인</button>}
      </section>
    </main>
    <UserPortalFooter orgName="CCUS 통합관리본부" addressLine="기업 계정 지원센터" footerLinks={["개인정보처리방침","이용약관"]} copyright="© 2026 CCUS Integration Management Portal." lastModifiedLabel="최종 업데이트" waAlt="웹 접근성" serviceLine="승인된 회원사만 기업 마스터 계정을 개설할 수 있습니다." />
  </div>;
}

export default CompanyMasterInviteMigrationPage;
