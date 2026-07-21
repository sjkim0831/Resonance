import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";

type Row = Record<string, unknown>;
type Detail = { success?: boolean; item?: Row; designGate?: Row; bindings?: Row[]; contracts?: Row[]; capabilities?: Row[]; fields?: Row[]; tests?: Row[]; assets?: Row[]; blueprints?: Row[]; message?: string };
const text = (row: Row | undefined, key: string) => row?.[key] == null ? "" : String(row[key]);
const bool = (row: Row | undefined, key: string) => row?.[key] === true || row?.[key] === "true";
const contractTextKeys = [
  ["businessPurpose","업무 목적"],["entryCondition","진입 조건"],["exitCondition","완료 조건"],
  ["kpiContract","KPI 계약"],["sectionContract","섹션 계약"],["fieldContract","필드 계약"],
  ["commandContract","명령 계약"],["stateContract","상태·예외 계약"],["apiContract","API 계약"],
  ["dataContract","DB·데이터 계약"],["evidenceContract","증빙·감사 계약"],
  ["responsiveContract","반응형 계약"],["accessibilityContract","접근성 계약"],["securityContract","보안·권한 계약"],
] as const;
const verificationKeys = [
  ["apiVerified","API"],["databaseVerified","DB"],["authorityVerified","권한"],
  ["responsiveVerified","반응형"],["accessibilityVerified","접근성"],["exceptionStatesVerified","예외·복구"],
] as const;

export function PageDesignStudioPage() {
  const base = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");
  const itemId = new URLSearchParams(window.location.search).get("itemId") ?? "";
  const [detail,setDetail] = useState<Detail>({});
  const [selectedId,setSelectedId] = useState("");
  const [draft,setDraft] = useState<Row>({});
  const [tab,setTab] = useState("contract");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const load = useCallback(async () => {
    if(!itemId) return;
    const response=await fetch(`${base}/page-development-master/${itemId}`,{credentials:"include"});
    const body=await response.json();
    if(!response.ok) throw new Error(body.message||"설계 정보를 불러오지 못했습니다.");
    setDetail(body);
    setSelectedId(current=>current||String(body.contracts?.[0]?.contractId||""));
  },[base,itemId]);
  useEffect(()=>{void load().catch(reason=>setMessage(reason instanceof Error?reason.message:"조회 실패"));},[load]);
  const selected = useMemo(()=>(detail.contracts??[]).find(row=>text(row,"contractId")===selectedId),[detail.contracts,selectedId]);
  useEffect(()=>{if(selected)setDraft({...selected});},[selected]);
  const gate=detail.designGate??{};
  const item=detail.item??{};
  const processCode=text(selected,"processCode")||text((detail.bindings??[])[0],"processCode");
  const save=async()=>{
    if(!selectedId)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch(`${base}/professional-screen-contracts`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,contractId:selectedId})});
      const body=await response.json();if(!response.ok)throw new Error(body.message||"설계 저장에 실패했습니다.");
      setMessage(`저장 완료 · 설계 게이트 ${body.designGate?.status??"재검증"} ${body.designGate?.score??""}`);await load();
    }catch(reason){setMessage(reason instanceof Error?reason.message:"설계 저장 실패");}finally{setBusy(false);}
  };
  const execute=async(path:string,payload:Row)=>{
    setBusy(true);setMessage("");
    try{const response=await fetch(`${base}${path}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.message||"실행 실패");setMessage(`${body.status??"완료"} · ${body.nextAction??"검증 결과를 확인하세요."}`);await load();}
    catch(reason){setMessage(reason instanceof Error?reason.message:"실행 실패");}finally{setBusy(false);}
  };
  if(!itemId)return <AdminPageShell title="전문 설계 스튜디오" breadcrumbs={[{label:"홈",href:"/admin/"},{label:"페이지 개발 마스터",href:"/admin/system/page-development-master"},{label:"전문 설계 스튜디오"}]}><p className="rounded-xl border border-amber-200 bg-amber-50 p-6 font-bold text-amber-800">페이지 개발 마스터에서 설계할 화면을 선택해 주세요.</p></AdminPageShell>;

  return <AdminPageShell title="전문 설계 스튜디오" breadcrumbs={[{label:"홈",href:"/admin/"},{label:"페이지 개발 마스터",href:"/admin/system/page-development-master"},{label:text(item,"screen_name")||text(item,"screenName")||"전문 설계"}]}>
    <GovernanceCompressionNav activeId="actor-process" en={false}/>
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-5 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-blue-200">EXECUTABLE DESIGN STUDIO</p><h2 className="mt-1 text-2xl font-black">{text(item,"screen_name")||text(item,"screenName")}</h2><code className="mt-1 block text-xs text-blue-100">{text(item,"route_key")||text(item,"routePath")}</code></div><div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-right"><span className="text-xs">설계 완전성 게이트</span><strong className="block text-2xl">{text(gate,"score")||"0"}점 · {text(gate,"status")||"FAILED"}</strong></div></div></section>
      {message&&<p className="rounded-xl border border-blue-200 bg-blue-50 p-3 font-bold text-blue-800">{message}</p>}
      <section className="grid min-h-[680px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_390px]">
        <aside className="rounded-2xl border bg-white p-4"><h3 className="font-black text-[#052b57]">설계 탐색기</h3><p className="mt-1 text-xs text-slate-500">액터 → 프로세스 → 단계 → 화면 계약</p><div className="mt-4 space-y-2">{(detail.contracts??[]).map(row=><button key={text(row,"contractId")} type="button" onClick={()=>setSelectedId(text(row,"contractId"))} className={`w-full rounded-xl border p-3 text-left text-xs ${selectedId===text(row,"contractId")?"border-blue-500 bg-blue-50":"border-slate-200"}`}><strong className="block text-sm text-slate-900">{text(row,"processCode")}</strong><span>{text(row,"stepCode")} · {text(row,"audience")}</span><span className="mt-1 block text-slate-500">{text(row,"actorCode")}</span></button>)}</div><GateList gate={gate}/></aside>
        <main className="space-y-4 overflow-hidden">
          <section className="overflow-x-auto rounded-2xl border bg-white p-4"><h3 className="font-black text-[#052b57]">업무 실행 그래프</h3><div className="mt-4 flex min-w-[940px] items-stretch gap-2"><FlowNode title="액터·권한" value={text(selected,"actorCode")}/><Arrow/><FlowNode title="진입 조건" value={text(selected,"entryCondition")}/><Arrow/><FlowNode title="화면" value={text(item,"screen_name")||text(item,"screenName")}/><Arrow/><FlowNode title="명령·API" value={`${(detail.capabilities??[]).length}개 기능`}/><Arrow/><FlowNode title="DB·증빙" value={`${(detail.fields??[]).length}개 필드`}/><Arrow/><FlowNode title="완료·다음 단계" value={text(selected,"exitCondition")}/></div></section>
          <section className="rounded-2xl border bg-white"><nav className="flex overflow-x-auto border-b p-2">{[["contract","설계 계약"],["frontend","프론트"],["backend","백엔드·DB"],["tests","테스트"],["assets","공통 자산"],["preview","생성 미리보기"]].map(([id,label])=><button key={id} type="button" onClick={()=>setTab(id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${tab===id?"bg-[#052b57] text-white":"text-slate-600"}`}>{label}</button>)}</nav><div className="max-h-[610px] overflow-y-auto p-4">
            {tab==="contract"&&<ContractEditor draft={draft} setDraft={setDraft}/>} 
            {tab==="frontend"&&<SimpleTable rows={detail.fields??[]} columns={[["fieldName","필드"],["controlType","컴포넌트"],["apiProperty","API 속성"],["required","필수"]]}/>} 
            {tab==="backend"&&<><SimpleTable rows={detail.capabilities??[]} columns={[["capabilityName","기능"],["capabilityType","유형"],["implementationStatus","구현"],["commandContract","명령 계약"]]}/><div className="mt-4"><SimpleTable rows={detail.fields??[]} columns={[["fieldName","필드"],["sourceTable","DB 테이블"],["sourceColumn","컬럼"],["lineageStatus","계보"]]}/></div></>}
            {tab==="tests"&&<SimpleTable rows={detail.tests??[]} columns={[["caseName","시나리오"],["caseType","유형"],["caseStatus","상태"]]}/>} 
            {tab==="assets"&&<SimpleTable rows={detail.assets??[]} columns={[["assetLayer","계층"],["assetRef","공통 자산"],["decision","판정"],["managementRoute","관리 화면"]]}/>} 
            {tab==="preview"&&<SimpleTable rows={detail.blueprints??[]} columns={[["blueprintCode","블루프린트"],["screenType","화면 유형"],["templateCode","템플릿"],["validationStatus","검증"]]}/>} 
          </div></section>
        </main>
        <aside className="rounded-2xl border bg-white p-4"><h3 className="font-black text-[#052b57]">계약·검증·생성</h3><p className="mt-1 text-xs leading-5 text-slate-500">설계 저장 후 게이트를 재평가합니다. 모든 게이트를 통과한 경우에만 코드 생성이 허용됩니다.</p><div className="mt-4 grid gap-2"><button type="button" disabled={busy||!selectedId} onClick={()=>void save()} className="min-h-11 rounded-lg bg-[#246beb] px-4 font-bold text-white disabled:opacity-40">설계 저장·재검증</button><button type="button" disabled={busy||!processCode} onClick={()=>void execute("/design/validate",{processCode})} className="min-h-11 rounded-lg border border-blue-300 px-4 font-bold text-blue-700 disabled:opacity-40">프로세스 전체 검증</button><button type="button" disabled={busy||text(gate,"status")!=="PASSED"||!processCode} onClick={()=>void execute("/development/direct",{processCode,force:false})} className="min-h-11 rounded-lg bg-emerald-600 px-4 font-bold text-white disabled:bg-slate-300">프론트·백엔드·DB 생성</button></div><p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">{text(gate,"issues")||"모든 설계 게이트를 통과했습니다."}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs">{[["테마","/admin/system/theme-management"],["섹션","/admin/system/section-management"],["컴포넌트","/admin/system/component-management"],["CSS","/admin/system/css-management"],["API","/admin/system/api-management"],["DB","/admin/system/db-table-management"],["테스트","/admin/system/verification-asset-management"],["메뉴","/admin/system/menu"]].map(([label,href])=><a key={href} href={href} className="rounded-lg border p-3 font-bold text-blue-700">{label} 관리</a>)}</div></aside>
      </section>
    </div>
  </AdminPageShell>;
}

function ContractEditor({draft,setDraft}:{draft:Row;setDraft:(row:Row)=>void}){return <div className="grid gap-3 lg:grid-cols-2">{contractTextKeys.map(([key,label])=><label key={key} className={`text-xs font-bold text-slate-700 ${["businessPurpose","entryCondition","exitCondition"].includes(key)?"lg:col-span-1":"lg:col-span-2"}`}>{label}<textarea value={text(draft,key)} onChange={event=>setDraft({...draft,[key]:event.target.value})} rows={["businessPurpose","entryCondition","exitCondition"].includes(key)?3:5} className="mt-1 w-full rounded-lg border p-3 font-mono text-xs leading-5"/></label>)}<label className="lg:col-span-2 text-xs font-bold">감사 증적 참조<input value={text(draft,"auditEvidenceRef")} onChange={event=>setDraft({...draft,auditEvidenceRef:event.target.value})} className="mt-1 h-11 w-full rounded-lg border px-3"/></label><div className="lg:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{verificationKeys.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border p-3 text-xs font-bold"><input type="checkbox" checked={bool(draft,key)} onChange={event=>setDraft({...draft,[key]:event.target.checked})}/>{label} 검증 완료</label>)}</div></div>}
function GateList({gate}:{gate:Row}){const entries=[["actorPassed","액터"],["processPassed","프로세스"],["contractPassed","설계 계약"],["lineagePassed","데이터 계보"],["transitionPassed","상태 전이"],["authorityPassed","권한"],["versionPassed","버전·감사"],["exceptionPassed","예외·복구"],["adminCounterpartPassed","관리자 대응"],["testPassed","독립 테스트"]];return <div className="mt-5 space-y-1">{entries.map(([key,label])=><div key={key} className={`flex justify-between rounded-lg px-3 py-2 text-xs font-bold ${bool(gate,key)?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}><span>{label}</span><span>{bool(gate,key)?"통과":"보완"}</span></div>)}</div>}
function FlowNode({title,value}:{title:string;value:string}){return <div className="flex min-h-28 w-36 shrink-0 flex-col justify-center rounded-xl border border-blue-200 bg-blue-50 p-3 text-center"><strong className="text-xs text-blue-800">{title}</strong><span className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{value||"미정"}</span></div>}
function Arrow(){return <span className="flex items-center font-black text-blue-400">→</span>}
function SimpleTable({rows,columns}:{rows:Row[];columns:[string,string][]}){if(rows.length===0)return <p className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-800">등록된 계약이 없습니다. 설계 게이트 통과 전에 보완해야 합니다.</p>;return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr>{columns.map(([,label])=><th key={label} className="border-b bg-slate-50 p-3">{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index} className="border-b">{columns.map(([key])=><td key={key} className="max-w-[320px] break-words p-3 align-top leading-5">{text(row,key)||"-"}</td>)}</tr>)}</tbody></table></div>}
