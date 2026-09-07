import { FormEvent, useEffect, useMemo, useState } from "react";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter, UserPortalHeader } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type Invite = { success?: boolean; message?: string; insttId?: string; companyName?: string; memberName?: string; email?: string; actorCode?: string; expiresAt?: string };
const ACTOR_LABELS: Record<string,string> = { COMPANY_MANAGER:"회원사 관리자", SITE_DATA_OWNER:"사업장 자료 담당자", EMISSION_MANAGER:"탄소배출 담당자", VERIFIER:"검증 담당자" };
const fieldClass = "min-h-12 rounded-lg border border-slate-400 px-4 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100";

export function CompanyMemberInviteMigrationPage() {
  const en=isEnglish();
  const token=useMemo(()=>new URLSearchParams(location.search).get("token")||"",[]);
  const [invite,setInvite]=useState<Invite>({});
  const [accountId,setAccountId]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [userName,setUserName]=useState("");
  const [busy,setBusy]=useState(true);
  const [done,setDone]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!token){setMessage("초대 링크가 올바르지 않습니다. 초대를 발급한 관리자에게 새 링크를 요청해 주세요.");setBusy(false);return}
    fetch(`/join/api/company-member-invitation?token=${encodeURIComponent(token)}`,{credentials:"include"})
      .then(async response=>({response,body:await response.json().catch(()=>({}))}))
      .then(({response,body})=>{setInvite(body);setUserName(body.memberName||"");setMessage(response.ok?"":(body.message||"초대 정보를 확인할 수 없습니다."))})
      .catch(()=>setMessage("초대 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(()=>setBusy(false));
  },[token]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(password!==confirm){setMessage("비밀번호와 비밀번호 확인 값이 일치하지 않습니다.");return}
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/join/api/company-member-invitation/activate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,insttId:invite.insttId,accountId,password,userName})});
      const body=await response.json().catch(()=>({}));
      setMessage(body.message||(response.ok?"계정 설정이 완료되었습니다.":"입력 정보를 확인해 주세요."));
      setDone(response.ok&&body.success===true);
    }catch{setMessage("서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.")}finally{setBusy(false)}
  }

  const actorLabel=ACTOR_LABELS[String(invite.actorCode||"")]||"지정된 업무 담당자";
  const expiresLabel=invite.expiresAt?new Date(invite.expiresAt).toLocaleString():"-";
  return <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
    <UserGovernmentBar governmentText="대한민국 정부 공식 서비스" guidelineText="디지털 정부서비스"/>
    <UserPortalHeader brandTitle="CCUS 탄소중립 플랫폼" brandSubtitle="기업 담당자 계정 개설" homeHref={buildLocalizedPath("/home","/en/home")} rightContent={<UserLanguageToggle en={en} onKo={()=>navigate(`/join/companyMemberInvite?token=${encodeURIComponent(token)}`)} onEn={()=>navigate(`/join/en/companyMemberInvite?token=${encodeURIComponent(token)}`)}/>}/>
    <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <header className="border-b border-slate-300 pb-6"><p className="text-sm font-bold text-[#246beb]">회원사 직원 초대 · 2단계</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[#052b57]">담당자 계정 설정</h1><p className="mt-3 text-base text-slate-600">초대받은 회사와 담당 업무를 확인하고 로그인 정보를 설정합니다.</p></header>
      {busy&&<div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5 font-bold text-blue-900" role="status">초대 정보를 확인하고 있습니다.</div>}
      {!busy&&!invite.success&&<section className="mt-8 rounded-2xl border border-amber-300 bg-white p-8 shadow-sm"><h2 className="text-xl font-black text-[#052b57]">초대 링크를 사용할 수 없습니다</h2><p className="mt-3 text-sm leading-6 text-slate-700">{message}</p><button className="mt-6 min-h-11 rounded-lg border border-[#246beb] px-6 font-bold text-[#246beb]" onClick={()=>navigate(buildLocalizedPath("/home","/en/home"))} type="button">홈으로 이동</button></section>}
      {!busy&&invite.success&&!done&&<div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-6"><h2 className="text-lg font-black text-[#052b57]">초대 정보</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-500">회원사</dt><dd className="mt-1 font-bold">{invite.companyName||"-"}</dd></div><div><dt className="text-slate-500">초대 이메일</dt><dd className="mt-1 break-all font-bold">{invite.email||"-"}</dd></div><div><dt className="text-slate-500">담당 업무</dt><dd className="mt-1 font-bold">{actorLabel}<span className="block text-xs font-normal text-slate-500">{invite.actorCode}</span></dd></div><div><dt className="text-slate-500">유효 기한</dt><dd className="mt-1 font-bold">{expiresLabel}</dd></div></dl><p className="mt-6 border-t border-blue-200 pt-4 text-xs leading-5 text-slate-600">회원사와 담당 업무는 초대자가 지정한 값으로 자동 확정되며 변경할 수 없습니다.</p></aside>
        <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm" aria-labelledby="account-form-title"><div className="border-b border-slate-200 pb-5"><h2 className="text-xl font-black text-[#052b57]" id="account-form-title">로그인 정보 입력</h2><p className="mt-2 text-sm text-slate-600"><span className="font-bold text-red-600">*</span> 표시는 필수 입력 항목입니다.</p></div>
          <form className="mt-6 grid gap-5" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-bold">담당자 이름<input autoComplete="name" className={fieldClass} value={userName} onChange={event=>setUserName(event.target.value)} maxLength={50} required/></label>
            <label className="grid gap-2 text-sm font-bold">로그인 아이디<input autoCapitalize="none" autoComplete="username" className={fieldClass} value={accountId} onChange={event=>setAccountId(event.target.value)} pattern="[A-Za-z][A-Za-z0-9._-]{4,39}" required/><span className="text-xs font-normal text-slate-500">영문자로 시작하는 5~40자의 영문, 숫자, 마침표, 밑줄 또는 하이픈</span></label>
            <label className="grid gap-2 text-sm font-bold">비밀번호<input autoComplete="new-password" className={fieldClass} type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={10} required/><span className="text-xs font-normal text-slate-500">10자 이상 입력해 주세요.</span></label>
            <label className="grid gap-2 text-sm font-bold">비밀번호 확인<input autoComplete="new-password" className={fieldClass} type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} minLength={10} required/></label>
            {message&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="alert">{message}</p>}
            <div className="flex justify-end border-t border-slate-200 pt-5"><button disabled={busy} className="min-h-12 rounded-lg bg-[#246beb] px-8 font-bold text-white hover:bg-[#1d56bc] disabled:opacity-50">{busy?"처리 중...":"계정 설정 완료"}</button></div>
          </form>
        </section>
      </div>}
      {done&&<section className="mt-8 rounded-2xl border border-emerald-300 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div><p className="mt-6 text-sm font-bold text-emerald-700">회원사 직원 초대 완료</p><h2 className="mt-2 text-3xl font-black text-[#052b57]">담당자 계정이 생성되었습니다</h2><p className="mt-3 text-slate-600">설정한 아이디와 비밀번호로 로그인할 수 있습니다.</p><button className="mt-7 min-h-12 rounded-lg bg-[#246beb] px-10 font-black text-white hover:bg-[#1d56bc]" onClick={()=>navigate("/signin/loginView")} type="button">로그인으로 이동</button></section>}
    </main>
    <UserPortalFooter orgName="CCUS 통합관리본부" addressLine="기업 계정 지원센터" footerLinks={["개인정보처리방침","이용약관"]} copyright="© 2026 CCUS Integration Management Portal." lastModifiedLabel="최종 업데이트" waAlt="웹 접근성" serviceLine="기업 마스터가 승인한 담당자만 계정을 개설할 수 있습니다."/>
  </div>;
}

export default CompanyMemberInviteMigrationPage;
