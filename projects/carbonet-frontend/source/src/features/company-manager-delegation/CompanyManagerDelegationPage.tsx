import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Project = { projectId: string; projectName: string };
type Account = { accountId: string; accountName: string; department?: string };
type Delegation = { delegationId: string; projectId: string; predecessorAccountId: string; successorAccountId: string; reason: string; status: string; requestedBy?: string; requestedAt?: string };
type Workspace = { canRequest: boolean; canApprove: boolean; projects: Project[]; accounts: Account[]; items: Delegation[] };

const STATUS: Record<string,string> = { REQUESTED:"승인 대기", APPROVED:"인계 대기", COMPLETED:"인계 완료", REJECTED:"반려", CANCELLED:"취소" };

export function CompanyManagerDelegationPage() {
  const en=isEnglish();
  const session=useFrontendSession();
  const initialProject=new URLSearchParams(location.search).get("projectId")||"";
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [projectId,setProjectId]=useState(initialProject);
  const [successor,setSuccessor]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const csrf=useMemo(()=>session.value?.csrfHeaderName&&session.value.csrfToken?{[session.value.csrfHeaderName]:session.value.csrfToken}: {},[session.value]);

  async function json(response:Response) { const body=await response.json(); if(!response.ok) throw new Error(body?.message||`HTTP ${response.status}`); return body; }
  async function load(next=projectId) {
    const query=next?`?projectId=${encodeURIComponent(next)}`:"";
    const body=await json(await fetch(`${buildLocalizedPath("/home/api/company-manager-delegations","/en/home/api/company-manager-delegations")}${query}`,{credentials:"include",headers:{Accept:"application/json"}})) as Workspace;
    const selected=next||body.projects?.[0]?.projectId||"";
    setWorkspace(body); setProjectId(selected);
    if(!next&&selected) await load(selected);
  }
  useEffect(()=>{ void load().catch(error=>setMessage(String(error.message||error))); },[]);

  async function command(url:string,body?:unknown) {
    setBusy(true);setMessage("");
    try { await json(await fetch(url,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json",...csrf},body:body?JSON.stringify(body):undefined})); await load(); setMessage(en?"The workflow state was saved.":"업무 상태와 감사 이력을 저장했습니다."); }
    catch(error) { setMessage(error instanceof Error?error.message:String(error)); }
    finally { setBusy(false); }
  }
  const base=buildLocalizedPath("/home/api/company-manager-delegations","/en/home/api/company-manager-delegations");
  const request=()=>command(base,{projectId,successorAccountId:successor,reason,idempotencyKey:crypto.randomUUID()});

  return <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900 lg:px-8">
    <div className="mx-auto max-w-[96rem]">
      <section className="rounded-3xl bg-[#052b57] p-6 text-white shadow-xl lg:p-8">
        <p className="text-sm font-bold text-blue-200">MEMBER · COMPANY MANAGER DELEGATION</p>
        <h1 className="mt-2 text-3xl font-black">{en?"Company manager delegation and handover":"회원사 관리자 위임·승계·업무 인계"}</h1>
        <p className="mt-3 max-w-4xl text-sm text-blue-100">{en?"Request a successor, obtain independent approval, and atomically transfer open work without an authority gap.":"후임자를 요청하고 독립 승인 후 미결 업무를 원자적으로 인계하여 권한 공백과 중복을 방지합니다."}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {["1. 위임·승계 요청","2. 직무분리·권한 승인","3. 미결업무 인계·종결"].map((label,index)=><div className="rounded-xl border border-white/20 bg-white/10 p-4" key={label}><span className="text-xs font-black text-blue-200">STEP {index+1}</span><strong className="mt-1 block text-sm">{label.substring(3)}</strong></div>)}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-black text-[#052b57]">{en?"Project":"프로젝트"}<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 md:max-w-xl" value={projectId} onChange={event=>{setProjectId(event.target.value);void load(event.target.value);}}>{(workspace?.projects||[]).map(item=><option key={item.projectId} value={item.projectId}>{item.projectName} · {item.projectId}</option>)}</select></label>
      </section>

      {workspace?.canRequest?<section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-[#052b57]">1. 위임·승계 요청</h2><p className="mt-1 text-sm text-slate-600">같은 회사의 활성 계정만 후임자로 지정할 수 있습니다.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm font-bold">후임 관리자<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3" value={successor} onChange={event=>setSuccessor(event.target.value)}><option value="">후임자 선택</option>{(workspace.accounts||[]).map(item=><option key={item.accountId} value={item.accountId}>{item.accountName} · {item.accountId}{item.department?` · ${item.department}`:""}</option>)}</select></label><label className="text-sm font-bold">위임 사유<textarea className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3" maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} /></label></div>
        <button className="mt-4 min-h-12 rounded-lg bg-[#0755b5] px-6 font-black text-white disabled:bg-slate-300" disabled={busy||!projectId||!successor||!reason.trim()} onClick={request} type="button">승인 요청</button>
      </section>:null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b bg-slate-50 px-5 py-4"><h2 className="text-xl font-black text-[#052b57]">위임 진행 현황</h2></div><div className="overflow-x-auto"><table className="min-w-[64rem] w-full text-left text-sm"><thead className="bg-[#f3f7fc] text-[#052b57]"><tr>{["상태","선임 관리자","후임 관리자","요청 사유","다음 작업"].map(value=><th className="px-4 py-3" key={value}>{value}</th>)}</tr></thead><tbody>{(workspace?.items||[]).map(item=><tr className="border-t" key={item.delegationId}><td className="px-4 py-4 font-black">{STATUS[item.status]||item.status}</td><td className="px-4 py-4">{item.predecessorAccountId}</td><td className="px-4 py-4">{item.successorAccountId}</td><td className="max-w-md px-4 py-4">{item.reason}</td><td className="px-4 py-4"><div className="flex gap-2">{workspace?.canApprove&&item.status==="REQUESTED"?<><button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" disabled={busy} onClick={()=>command(`${base}/${item.delegationId}/decision`,{decision:"APPROVE"})}>승인</button><button className="rounded-lg border border-rose-300 px-4 py-2 font-bold text-rose-700" disabled={busy} onClick={()=>command(`${base}/${item.delegationId}/decision`,{decision:"REJECT",reason:"권한 충돌 또는 증빙 보완 필요"})}>반려</button></>:null}{workspace?.canRequest&&item.status==="APPROVED"?<button className="rounded-lg bg-[#0755b5] px-4 py-2 font-bold text-white" disabled={busy} onClick={()=>command(`${base}/${item.delegationId}/complete`)}>인계 완료</button>:null}{!["REQUESTED","APPROVED"].includes(item.status)?<span className="text-slate-500">처리 완료</span>:null}</div></td></tr>)}{!workspace?.items?.length?<tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>등록된 위임 요청이 없습니다.</td></tr>:null}</tbody></table></div></section>
      {message?<p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-900" role="status">{message}</p>:null}
    </div>
  </main>;
}
