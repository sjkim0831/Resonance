import { useEffect, useMemo, useState } from "react";

export type ScreenHtmlMockup = {
  mockupId?: number; slotNo: number; title: string; prompt: string; html: string;
  status: "DRAFT"|"SELECTED"|"APPLY_REQUESTED"; selected: boolean; version: number;
  updatedBy?: string; updatedAt?: string;
};

type Props = {
  routePath: string;
  pageId: string;
  mockups?: ScreenHtmlMockup[];
  onChanged?: (payload: Record<string, unknown>) => void;
  compact?: boolean;
};

const endpoint="/admin/api/system/screen-development-note";

async function json(response:Response){
  const type=response.headers.get("content-type")||"";
  if(!type.includes("application/json"))throw new Error("관리자 로그인 세션을 확인해 주세요.");
  const body=await response.json();
  if(!response.ok)throw new Error(body.message||"HTML 시안 요청을 처리하지 못했습니다.");
  return body;
}

function empty(slotNo:number):ScreenHtmlMockup{
  return {slotNo,title:`HTML 시안 ${slotNo}`,prompt:"",html:"",status:"DRAFT",selected:false,version:0};
}

export function ScreenHtmlMockupManager({routePath,pageId,mockups,onChanged,compact=false}:Props){
  const [items,setItems]=useState<ScreenHtmlMockup[]>(mockups||[]);
  const normalized=useMemo(()=>Array.from({length:5},(_,index)=>items.find(item=>Number(item.slotNo)===index+1)||empty(index+1)),[items]);
  const initialSelected=items.find(item=>item.selected)?.slotNo||items[0]?.slotNo||1;
  const [slot,setSlot]=useState(initialSelected);
  const [draft,setDraft]=useState<ScreenHtmlMockup>(normalized[initialSelected-1]||empty(initialSelected));
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{if(mockups)setItems(mockups);},[mockups]);
  useEffect(()=>{
    if(mockups!==undefined)return;
    let cancelled=false;
    fetch(`${endpoint}?routePath=${encodeURIComponent(routePath)}`,{credentials:"include",headers:{Accept:"application/json"}})
      .then(json).then(body=>{if(!cancelled)setItems(body.mockups||[]);}).catch(error=>{if(!cancelled)setMessage(error instanceof Error?error.message:String(error));});
    return()=>{cancelled=true;};
  },[routePath,mockups]);

  useEffect(()=>{
    const next=normalized.find(item=>item.slotNo===slot)||empty(slot);
    setDraft(next);
  },[items,slot]);

  function accept(body:Record<string,unknown>){setItems((body.mockups as ScreenHtmlMockup[])||[]);onChanged?.(body);}

  function choose(nextSlot:number){setSlot(nextSlot);setDraft(normalized[nextSlot-1]||empty(nextSlot));setMessage("");}

  async function save(){
    if(!draft.prompt.trim()||!draft.html.trim()){setMessage("프롬프트와 HTML을 모두 입력해 주세요.");return;}
    setBusy(true);setMessage("");
    try{
      const body=await json(await fetch(`${endpoint}/mockups/${slot}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({routePath,pageId,title:draft.title,prompt:draft.prompt,html:draft.html})}));
      accept(body);setMessage(`시안 ${slot} v${body.mockups?.find((item:ScreenHtmlMockup)=>Number(item.slotNo)===slot)?.version||1}을 저장했습니다.`);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  }

  async function select(requestApply:boolean){
    if(!draft.version){setMessage("시안을 먼저 저장해 주세요.");return;}
    setBusy(true);setMessage("");
    try{
      const body=await json(await fetch(`${endpoint}/mockups/${slot}/select`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({routePath,requestApply})}));
      accept(body);setMessage(requestApply?`시안 ${slot}을 선택하고 반영 요청했습니다.`:`시안 ${slot}을 개발 기준으로 선택했습니다.`);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  }

  return <section className={`rounded-xl border border-slate-200 bg-slate-50 ${compact?"p-3":"p-4"}`} data-screen-html-mockups="">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-[#052b57]">프롬프트 기반 HTML 시안</h3><p className="text-xs text-slate-500">화면별 최대 5개 · 저장할 때마다 버전 이력 보존</p></div>{draft.selected?<span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-black text-blue-800">{draft.status==="APPLY_REQUESTED"?"반영 요청됨":"선택 시안"}</span>:null}</div>
    <div className="mt-3 grid grid-cols-5 gap-1" role="tablist" aria-label="HTML 시안 목록">{normalized.map(item=><button key={item.slotNo} type="button" role="tab" aria-selected={slot===item.slotNo} onClick={()=>choose(item.slotNo)} className={`min-h-9 rounded border text-xs font-black ${slot===item.slotNo?"border-blue-700 bg-blue-700 text-white":item.selected?"border-blue-300 bg-blue-50 text-blue-800":"border-slate-200 bg-white text-slate-600"}`}>시안 {item.slotNo}{item.version?` · v${item.version}`:""}</button>)}</div>
    <label className="mt-3 block text-xs font-black text-slate-700">시안 제목<input className="gov-input mt-1" value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))}/></label>
    <label className="mt-3 block text-xs font-black text-slate-700">생성·수정 프롬프트<textarea className="gov-input mt-1 min-h-20 py-2" value={draft.prompt} onChange={event=>setDraft(current=>({...current,prompt:event.target.value}))} placeholder="액터, 업무 목적, 섹션, 기능, 반응형, KRDS 기준을 입력합니다."/></label>
    <label className="mt-3 block text-xs font-black text-slate-700">HTML 시안<textarea className="gov-input mt-1 min-h-32 py-2 font-mono text-xs" value={draft.html} onChange={event=>setDraft(current=>({...current,html:event.target.value}))} placeholder="프롬프트로 생성한 완전한 HTML 시안을 입력하거나 업데이트합니다."/></label>
    {draft.html?<div className="mt-3 overflow-hidden rounded-lg border bg-white"><div className="border-b bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">격리 미리보기</div><iframe className={`w-full bg-white ${compact?"h-44":"h-64"}`} sandbox="" srcDoc={draft.html} title={`HTML 시안 ${slot} 미리보기`}/></div>:null}
    {message?<p className="mt-3 rounded-lg bg-white p-2 text-xs font-bold text-slate-700" role="status">{message}</p>:null}
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={busy} type="button" onClick={()=>void save()} className="min-h-10 rounded-lg border border-blue-700 bg-white px-3 text-xs font-black text-blue-700 disabled:opacity-50">시안 저장·업데이트</button><button disabled={busy||!draft.version} type="button" onClick={()=>void select(false)} className="min-h-10 rounded-lg bg-[#052b57] px-3 text-xs font-black text-white disabled:opacity-50">이 시안 선택</button><button disabled={busy||!draft.version} type="button" onClick={()=>void select(true)} className="min-h-10 rounded-lg bg-blue-700 px-3 text-xs font-black text-white disabled:opacity-50">선택 후 반영 요청</button></div>
  </section>;
}
