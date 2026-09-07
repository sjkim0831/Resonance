import { useEffect, useState } from "react";
import { UserPortalHeader } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type Payload = { data?: Record<string,string>; excludedFields?: string[]; correctionRoutes?: Record<string,string>; exportHistory?: Array<Record<string,string>> };

export function MypagePersonalDataPage() {
  const en = isEnglish();
  const [payload,setPayload] = useState<Payload>({});
  const [message,setMessage] = useState("");
  const load = () => fetch(buildLocalizedPath("/api/mypage/personal-data","/api/en/mypage/personal-data"),{credentials:"include"}).then(r=>r.json()).then(setPayload).catch(()=>setMessage(en?"Unable to load data.":"개인정보를 불러오지 못했습니다."));
  useEffect(() => { void load(); },[en]);
  const labels:Record<string,string>={memberId:"회원 ID",name:"이름",email:"이메일",phone:"휴대전화",companyName:"회사명",institutionId:"기관 ID",department:"부서",zip:"우편번호",address:"주소",detailAddress:"상세주소",marketingConsent:"마케팅 동의",memberStatus:"회원 상태"};
  const download=async()=>{const r=await fetch(buildLocalizedPath("/api/mypage/personal-data/export","/api/en/mypage/personal-data/export"),{credentials:"include"});if(!r.ok){setMessage("다운로드에 실패했습니다.");return;}const b=await r.blob();const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="personal-data.json";a.click();URL.revokeObjectURL(a.href);setMessage(`다운로드 완료 · SHA-256 ${r.headers.get("X-Content-SHA256")||"기록됨"}`);load();};
  return <div className="min-h-screen bg-slate-50 text-slate-900" data-mypage-theme="krds-v1">
    <UserPortalHeader brandTitle="CCUS 탄소중립 플랫폼" brandSubtitle="마이페이지" homeHref="/home" rightContent={<button className="rounded-lg border px-4 py-2" onClick={()=>navigate("/mypage/profile")}>마이페이지</button>}/>
    <main className="mx-auto max-w-5xl px-4 py-10" id="main-content">
      <header className="p-7" data-help-id="mypage-personal-data-hero"><p className="font-bold text-[#246beb]">개인정보 권리 행사</p><h1 className="mt-2 text-3xl font-black">개인정보 열람·정정·다운로드</h1><p className="mt-3 text-slate-600">내 정보만 열람하고, 검증된 정정 화면으로 이동하거나 안전한 JSON 사본을 내려받습니다.</p></header>
      {message&&<p className="mt-6 rounded-xl bg-blue-50 p-4 font-bold text-blue-900">{message}</p>}
      <section className="mt-8 rounded-2xl border bg-white p-6" data-help-id="mypage-personal-data-scope"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">보유 개인정보</h2><button className="rounded-xl bg-[#00378b] px-5 py-3 font-bold text-white" onClick={download}>내 정보 JSON 다운로드</button></div><dl className="mt-5 grid gap-3 md:grid-cols-2">{Object.entries(payload.data||{}).map(([k,v])=><div className="rounded-xl bg-slate-50 p-4" key={k}><dt className="text-xs font-bold text-slate-500">{labels[k]||k}</dt><dd className="mt-1 break-all font-bold">{v||"-"}</dd></div>)}</dl></section>
      <section className="mt-6 grid gap-4 md:grid-cols-3" data-help-id="mypage-personal-data-correction">{[["profile","주소 정정"],["contact","연락처 재인증·정정"],["company","기업정보 정정"]].map(([k,l])=><button className="rounded-2xl border bg-white p-5 text-left font-black hover:border-blue-600" key={k} onClick={()=>navigate(payload.correctionRoutes?.[k]||"/mypage/profile")}>{l}<span className="mt-2 block text-sm font-normal text-slate-500">검증된 정정 화면으로 이동 →</span></button>)}</section>
      <section className="mt-6 rounded-2xl border bg-white p-6" data-help-id="mypage-personal-data-audit"><h2 className="text-xl font-black">최근 다운로드 이력</h2><div className="mt-4 space-y-2">{(payload.exportHistory||[]).length===0?<p className="text-slate-500">다운로드 이력이 없습니다.</p>:(payload.exportHistory||[]).map((h,i)=><div className="rounded-xl bg-slate-50 p-3 text-sm" key={i}>{h.createdAt} · {h.format} · SHA-256 {String(h.sha256||"").slice(0,16)}…</div>)}</div><p className="mt-5 text-sm text-slate-600">제외 항목: {(payload.excludedFields||[]).join(", ")}</p></section>
    </main>
  </div>;
}
