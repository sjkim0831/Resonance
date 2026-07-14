import { useEffect,useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath,isEnglish } from "../../lib/navigation/runtime";
import { HeaderBrand,HeaderDesktopNav,HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";

type Submission={id:number;version:number;state:string;submittedActor?:string;submittedAt?:string};
type Review={id:number;submissionId:number;stage:string;decision:string;reviewer:string;comment?:string;issueCount:number;createdAt:string};
type Payload={project:{id:string;name:string;site:string};submissions:Submission[];reviews:Review[];actors:{actorCode:string;userId:string}[]};

async function readApiPayload(response:Response){
  const text=await response.text();
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.includes("application/json")){
    if(response.status===401||response.redirected) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
    throw new Error(`서버가 JSON 대신 HTML을 반환했습니다. (${response.status})`);
  }
  try{return JSON.parse(text)}catch{throw new Error(`서버 JSON 응답 형식이 올바르지 않습니다. (${response.status})`)}
}

export function EmissionProjectReviewPage(){
  const en=isEnglish(),content=LOCALIZED_CONTENT[en?"en":"ko"],home=useAsyncValue(()=>fetchHomePayload(),[en]);
  const id=new URLSearchParams(location.search).get("projectId")||"";
  const[data,setData]=useState<Payload|null>(null),[selected,setSelected]=useState<number>(0),[comment,setComment]=useState(""),[issues,setIssues]=useState(0),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const base=buildLocalizedPath(`/home/api/emission-projects/${id}`,`/en/home/api/emission-projects/${id}`);
  async function load(){const r=await fetch(`${base}/review-workflow`,{credentials:"include",headers:{Accept:"application/json"}}),b=await readApiPayload(r);if(!r.ok)throw new Error(b.message||"Load failed");setData(b);setSelected((value)=>value||b.submissions?.[0]?.id||0)}
  useEffect(()=>{if(id)void load().catch(e=>setMessage(e.message))},[id]);
  async function action(path:string,body?:object){if(!selected)return;setBusy(true);setMessage("");try{const r=await fetch(`${base}/submissions/${selected}/${path}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body||{})}),b=await readApiPayload(r);if(!r.ok)throw new Error(b.message||"Action failed");setMessage(en?"The workflow was updated.":"업무 상태가 변경되었습니다.");setComment("");await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  if(!id)return <main className="p-10 font-bold text-red-700">{en?"Select a project first.":"프로젝트를 먼저 선택해 주세요."}</main>;
  const current=data?.submissions.find(x=>x.id===selected);
  return <><HomeInlineStyles en={en}/><div className="min-h-screen bg-[#f5f7fa]"><header className="border-b-2 border-[#001e40] bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8"><HeaderBrand content={content} en={en}/><HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu||[]}/></div></header><main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <nav className="text-sm text-slate-500"><a href={buildLocalizedPath(`/emission/project/detail?id=${id}`,`/en/emission/project/detail?id=${id}`)}>{data?.project.name||id}</a><span className="mx-2">/</span>{en?"Verification & Approval":"검증·승인"}</nav>
    <div className="mt-4"><p className="font-bold text-blue-700">{data?.project.site}</p><h1 className="text-3xl font-black text-[#052b57]">{en?"Verification, Correction And Approval":"검증·보완·승인"}</h1><p className="mt-2 text-slate-600">{en?"Review submitted versions, request corrections, and lock approved calculations.":"제출 버전을 검증하고 보완 요청·승인·산정 결과 잠금을 처리합니다."}</p></div>
    {message&&<p className="mt-4 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">{message}</p>}
    <section className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]"><aside className="rounded-xl border bg-white p-4"><h2 className="font-black">{en?"Submission Versions":"제출 버전"}</h2><div className="mt-3 space-y-2">{data?.submissions.map(x=><button key={x.id} onClick={()=>setSelected(x.id)} className={`w-full rounded-lg border p-3 text-left ${selected===x.id?"border-blue-600 bg-blue-50":"border-slate-200"}`}><strong>V{x.version}</strong><span className="float-right rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{x.state}</span><small className="mt-2 block text-slate-500">{x.submittedActor||"-"}</small></button>)}{!data?.submissions.length&&<p className="py-8 text-center text-slate-500">{en?"No submission.":"제출 자료가 없습니다."}</p>}</div></aside>
      <div className="space-y-5"><section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{en?"Current Decision":"현재 처리"}</h2><p className="text-sm text-slate-500">{current?`V${current.version} · ${current.state}`:"-"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy||current?.state!=="SUBMITTED"} onClick={()=>void action("verification/start")} className="rounded-lg border border-blue-600 px-4 py-2 font-bold text-blue-700 disabled:opacity-40">{en?"Start Verification":"검증 시작"}</button><button disabled={busy||current?.state!=="IN_VERIFICATION"} onClick={()=>void action("verification/decision",{decision:"PASSED",comment,issueCount:issues})} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">{en?"Pass":"검증 통과"}</button><button disabled={busy||current?.state!=="IN_VERIFICATION"||!comment.trim()} onClick={()=>void action("verification/decision",{decision:"CORRECTION_REQUESTED",comment,issueCount:issues})} className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-40">{en?"Request Correction":"보완 요청"}</button><button disabled={busy||current?.state!=="VERIFIED"} onClick={()=>void action("approval/decision",{decision:"APPROVED",comment})} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">{en?"Approve":"승인"}</button><button disabled={busy||current?.state!=="VERIFIED"||!comment.trim()} onClick={()=>void action("approval/decision",{decision:"REJECTED",comment})} className="rounded-lg border border-red-600 px-4 py-2 font-bold text-red-700 disabled:opacity-40">{en?"Reject":"반려"}</button></div></div><div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]"><label className="text-sm font-bold">{en?"Issue Count":"오류 건수"}<input type="number" min={0} value={issues} onChange={e=>setIssues(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm font-bold">{en?"Review Comment":"검토 의견"}<textarea value={comment} onChange={e=>setComment(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border p-2" placeholder={en?"A reason is required for correction or rejection.":"보완 요청과 반려에는 사유가 필수입니다."}/></label></div></section>
      <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[700px] text-left"><thead className="bg-slate-100"><tr>{(en?["Time","Version","Stage","Decision","Reviewer","Comment"]:["처리일시","버전","단계","결정","처리자","의견"]).map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{data?.reviews.map(x=><tr key={x.id} className="border-t"><td className="p-3 text-sm">{x.createdAt}</td><td>#{x.submissionId}</td><td>{x.stage}</td><td className="font-bold">{x.decision}</td><td>{x.reviewer}</td><td>{x.comment||"-"}</td></tr>)}{!data?.reviews.length&&<tr><td colSpan={6} className="p-10 text-center text-slate-500">{en?"No review history.":"검토 이력이 없습니다."}</td></tr>}</tbody></table></section></div>
    </section></main></div></>;
}
