import { useEffect, useState } from "react";

type Note = {
  routeKey: string; routePath: string; pageId: string; pageTitle: string;
  designNote: string; functionNote: string; acceptanceNote: string;
  status: string; version: number; updatedBy?: string; updatedAt?: string;
};

const EMPTY: Note = { routeKey: "", routePath: "", pageId: "", pageTitle: "", designNote: "", functionNote: "", acceptanceNote: "", status: "DRAFT", version: 0 };

async function readJson(response: Response) {
  const type=response.headers.get("content-type")||"";
  if(!type.includes("application/json"))throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  return response.json();
}

export function ScreenDevelopmentNotePanel({ pageId, routePath }: { pageId: string; routePath: string }) {
  const [available,setAvailable]=useState(false);
  const [open,setOpen]=useState(false);
  const [note,setNote]=useState<Note>(EMPTY);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const endpoint="/api/platform/screen-development-note";

  useEffect(()=>{
    let cancelled=false;
    setOpen(false);setMessage("");
    fetch(`${endpoint}?routePath=${encodeURIComponent(routePath)}`,{credentials:"include"})
      .then(async response=>{
        if(response.status===401||response.status===403){if(!cancelled)setAvailable(false);return null;}
        const body=await readJson(response);if(!response.ok)throw new Error(body.message||"화면 설계를 불러오지 못했습니다.");return body;
      })
      .then(body=>{if(!cancelled&&body){setAvailable(true);setNote({...EMPTY,...body,pageId:body.pageId||pageId,pageTitle:body.pageTitle||document.title});}})
      .catch(error=>{if(!cancelled){setAvailable(true);setMessage(error instanceof Error?error.message:String(error));}});
    return()=>{cancelled=true;};
  },[pageId,routePath]);

  async function save(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch(endpoint,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...note,pageId,routePath,pageTitle:note.pageTitle||document.title})});
      const body=await readJson(response);if(!response.ok)throw new Error(body.message||"화면 설계를 저장하지 못했습니다.");
      setNote({...EMPTY,...body});setMessage(`화면 설계 v${body.version}을 개발 기준으로 저장했습니다.`);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }

  if(!available)return null;
  return <aside className={`fixed right-4 z-[1250] sm:right-6 ${open?"bottom-5":"bottom-20"}`} data-screen-development-note="">
    {!open?<button className="flex min-h-12 items-center gap-2 rounded-full border border-[#174ea6] bg-[#052b57] px-5 font-black text-white shadow-[0_14px_40px_rgba(5,43,87,.28)]" onClick={()=>setOpen(true)} type="button"><span className="material-symbols-outlined text-[20px]">design_services</span>화면 설계{note.version>0?<span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">v{note.version}</span>:null}</button>:
    <section className="flex max-h-[calc(100vh-2rem)] w-[min(31rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(5,43,87,.3)]">
      <header className="flex shrink-0 items-start justify-between gap-3 bg-[#052b57] px-5 py-4 text-white"><div><p className="text-xs font-black text-blue-200">SCREEN DEVELOPMENT BASIS</p><h2 className="mt-1 text-lg font-black">화면 설계·기능 메모</h2></div><button aria-label="화면 설계 닫기" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15" onClick={()=>setOpen(false)} type="button"><span className="material-symbols-outlined">close</span></button></header>
      <div className="overflow-y-auto p-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm"><p className="font-black text-[#052b57]">현재 URL</p><p className="mt-1 break-all text-slate-700">{window.location.origin}{routePath}</p><p className="mt-1 text-xs font-bold text-slate-500">페이지 ID: {pageId || "미등록"} · 저장 버전: {note.version}</p></div>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">화면 제목</span><input className="gov-input mt-1" value={note.pageTitle} onChange={event=>setNote(current=>({...current,pageTitle:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">UI·레이아웃 설계</span><textarea className="gov-input mt-1 min-h-24 py-3" placeholder="섹션 순서, 컴포넌트, 반응형, KRDS 적용 기준을 기록합니다." value={note.designNote} onChange={event=>setNote(current=>({...current,designNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">필요 기능·업무 규칙</span><textarea className="gov-input mt-1 min-h-28 py-3" placeholder="액터의 행동, 입력·조회·저장·승인, API·DB 연계와 예외 처리를 기록합니다." value={note.functionNote} onChange={event=>setNote(current=>({...current,functionNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">완료·테스트 기준</span><textarea className="gov-input mt-1 min-h-24 py-3" placeholder="정상·예외·권한·격리·복구 테스트의 기대값을 기록합니다." value={note.acceptanceNote} onChange={event=>setNote(current=>({...current,acceptanceNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">설계 상태</span><select className="gov-select mt-1" value={note.status} onChange={event=>setNote(current=>({...current,status:event.target.value}))}><option value="DRAFT">초안</option><option value="READY">개발 준비</option><option value="IN_DEVELOPMENT">개발 중</option><option value="VERIFIED">검증 완료</option></select></label>
        {note.updatedAt?<p className="mt-3 text-xs text-slate-500">최근 저장: {note.updatedAt} · {note.updatedBy||"-"}</p>:null}
        {message?<p className={`mt-3 rounded-lg p-3 text-sm font-bold ${message.includes("저장했습니다")?"bg-emerald-50 text-emerald-800":"bg-rose-50 text-rose-800"}`} role="status">{message}</p>:null}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold text-slate-500">저장 내용은 개발 작업 명세에 자동 포함됩니다.</p><button className="min-h-11 shrink-0 rounded-lg bg-[#246beb] px-5 font-black text-white disabled:opacity-50" disabled={busy} onClick={()=>void save()} type="button">{busy?"저장 중...":"설계 저장"}</button></footer>
    </section>}
  </aside>;
}
