import { useEffect, useState } from "react";
import { ScreenDesignSummary } from "../task-quest/ScreenDesignSummary";
import { fetchFrontendSession, getFrontendSessionInvalidationEventName } from "../../lib/api/adminShell";
import { ScreenHtmlMockupManager, type ScreenHtmlMockup } from "./ScreenHtmlMockupManager";
import { normalizeScreenRoute, type ScreenWorkContext } from "../runtime-assist/screenWorkContext";

type Note = {
  routeKey: string; routePath: string; pageId: string; pageTitle: string;
  designNote: string; functionNote: string; acceptanceNote: string;
  status: string; version: number; updatedBy?: string; updatedAt?: string;
  mockups?: ScreenHtmlMockup[];
};

const EMPTY: Note = { routeKey: "", routePath: "", pageId: "", pageTitle: "", designNote: "", functionNote: "", acceptanceNote: "", status: "DRAFT", version: 0 };

class DesignNoteAuthenticationError extends Error {}

async function readJson(response: Response) {
  const type=response.headers.get("content-type")||"";
  const finalPath=(()=>{try{return new URL(response.url).pathname;}catch{return "";}})();
  if(response.redirected&&finalPath.includes("/login"))throw new DesignNoteAuthenticationError("관리자 로그인이 필요합니다.");
  if(!type.includes("application/json")){
    const raw=await response.text();
    if(/^\s*<!doctype|^\s*<html/i.test(raw))throw new DesignNoteAuthenticationError("관리자 로그인 세션을 확인해 주세요.");
    throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  }
  return response.json();
}

export function ScreenDevelopmentNotePanel({ pageId, routePath, workContext }: {
  pageId: string;
  routePath: string;
  workContext?: ScreenWorkContext | null;
}) {
  const [available,setAvailable]=useState(false);
  const [open,setOpen]=useState(false);
  const [note,setNote]=useState<Note>(EMPTY);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [retry,setRetry]=useState(0);
  const endpoint="/admin/api/system/screen-development-note";
  const generateEndpoint="/admin/api/system/actor-process/design/save-and-generate";
  const designRoutePath=workContext?.identity?.canonicalRoutePath||normalizeScreenRoute(routePath);
  const workClassification=workContext?.classification||(workContext?.workflow||workContext?.candidates?.length?"EXECUTABLE":"REVIEW_REQUIRED");
  const [canUseAdminDesignNotes,setCanUseAdminDesignNotes]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    let generation=0;
    const refresh=()=>{
      const current=++generation;
      setCanUseAdminDesignNotes(false);
      void fetchFrontendSession().then(session=>{
        if(!cancelled&&current===generation)setCanUseAdminDesignNotes(session.authenticated===true&&session.canEnterAdminConsole===true);
      }).catch(()=>{if(!cancelled&&current===generation)setCanUseAdminDesignNotes(false);});
    };
    refresh();
    const eventName=getFrontendSessionInvalidationEventName();
    window.addEventListener(eventName,refresh);
    return()=>{cancelled=true;window.removeEventListener(eventName,refresh);};
  },[routePath,retry]);

  useEffect(()=>{
    let cancelled=false;
    setMessage("");setAvailable(false);setNote(EMPTY);
    if(!canUseAdminDesignNotes){setAvailable(false);return()=>{cancelled=true;};}
    fetch(`${endpoint}?routePath=${encodeURIComponent(designRoutePath)}`,{credentials:"include",headers:{Accept:"application/json"}})
      .then(async response=>{
        if(response.status===401||response.status===403){if(!cancelled)setAvailable(false);return null;}
        const body=await readJson(response);if(!response.ok)throw new Error(body.message||"화면 설계를 불러오지 못했습니다.");return body;
      })
      .then(body=>{if(!cancelled&&body){setAvailable(true);setNote({...EMPTY,...body,pageId:body.pageId||pageId,pageTitle:body.pageTitle||document.title});}})
      .catch(error=>{if(!cancelled){
        setAvailable(false);setMessage(error instanceof DesignNoteAuthenticationError?"관리자 로그인 세션을 다시 확인해 주세요.":error instanceof Error?error.message:String(error));
      }});
    return()=>{cancelled=true;};
  },[canUseAdminDesignNotes,designRoutePath,pageId,retry]);

  async function save(){
    if(!available||!canUseAdminDesignNotes)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch(generateEndpoint,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({
        ...note,pageId,routePath:designRoutePath,pageTitle:note.pageTitle||document.title
      })});
      const body=await readJson(response);if(!response.ok)throw new Error(body.message||"화면 설계를 저장하지 못했습니다.");
      setNote({...EMPTY,...body.note});
      const generated=Array.isArray(body.codeOutputs)?body.codeOutputs.length:0;
      const designHash=String(body.designHash||"").slice(0,12);
      setMessage(body.generationStatus==="GENERATED"
        ? `화면 설계 v${body.note.version}을 저장했습니다. 코드 계약 ${generated}건과 도움말·업무 길잡이·QA·설계 카드를 즉시 갱신했습니다.${designHash?` 설계 해시 ${designHash}`:""}`
        : body.generationStatus==="UNCHANGED"
          ? `화면 설계 v${body.note.version}은 이미 최신입니다.${designHash?` 설계 해시 ${designHash}`:""}`
        : body.generationStatus==="PROCESS_BINDING_REQUIRED"
          ? `화면 설계 v${body.note.version}을 저장했습니다. 프로세스 연결 후 코드가 자동 생성됩니다.`
          : `화면 설계 v${body.note.version}을 저장했지만 품질 게이트 보완이 필요합니다.`);
    }catch(error){setMessage(error instanceof DesignNoteAuthenticationError?"관리자 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.":error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }

  if(!available||!canUseAdminDesignNotes)return <aside className={`fixed bottom-20 right-4 sm:right-6 ${open?'z-[1270]':'z-[1250]'}`} data-screen-development-note="">
    {!open?<button type="button" className="min-h-12 rounded-full border border-[#174ea6] bg-[#052b57] px-5 font-black text-white shadow-lg" onClick={()=>setOpen(true)}>화면 설계</button>:<section className="max-h-[calc(100dvh-7rem)] w-[min(31rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <header className="mb-3 flex items-center justify-between"><h2 className="font-black">화면 설계</h2><button type="button" aria-label="화면 설계 닫기" className="min-h-11 px-3" onClick={()=>setOpen(false)}>닫기</button></header>
      <ScreenDesignSummary routePath={routePath} en={routePath.startsWith('/en/')} />
      <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">{message||(canUseAdminDesignNotes?"설계 문서를 확인 중이거나 조회 권한이 만료되었습니다. 다시 확인해 주세요.":"설계 편집에는 관리자 로그인·권한 확인이 필요합니다. 조회 지연이나 세션 만료가 있어도 이 버튼은 유지됩니다.")}</p>
      <button type="button" className="mt-3 min-h-11 rounded-lg border border-blue-700 px-3 font-bold text-blue-800" onClick={()=>setRetry(value=>value+1)}>권한·설계 다시 확인</button>
    </section>}</aside>;
  return <aside className={`fixed right-4 sm:right-6 ${open?"bottom-5 z-[1270]":"bottom-20 z-[1250]"}`} data-screen-development-note="">
    {!open?<button className="flex min-h-12 items-center gap-2 rounded-full border border-[#174ea6] bg-[#052b57] px-5 font-black text-white shadow-[0_14px_40px_rgba(5,43,87,.28)]" onClick={()=>setOpen(true)} type="button"><span className="material-symbols-outlined text-[20px]">design_services</span>화면 설계{note.version>0?<span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">v{note.version}</span>:null}</button>:
    <section className="flex max-h-[calc(var(--krds-stable-viewport-block)-2rem)] w-[min(31rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(5,43,87,.3)]">
      <header className="flex shrink-0 items-start justify-between gap-3 bg-[#052b57] px-5 py-4 text-white"><div><p className="text-xs font-black text-blue-200">SCREEN DEVELOPMENT BASIS</p><h2 className="mt-1 text-lg font-black">화면 설계·기능 메모</h2></div><button aria-label="화면 설계 닫기" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15" onClick={()=>setOpen(false)} type="button"><span className="material-symbols-outlined">close</span></button></header>
      <div className="overflow-y-auto p-5">
        {/^\/(en\/)?(home(\/index)?)?\/?$/.test(routePath.split(/[?#]/)[0]) && <>
          <ScreenDesignSummary routePath={routePath} context={workContext} en={routePath.startsWith('/en/')} />
          <div className="mb-4 rounded-xl border border-slate-200 p-3 text-sm" data-design-qa-separation="">
            <p className="font-bold text-slate-900">설계 기준과 검증 결과를 구분합니다</p>
            <p className="mt-1 text-slate-600">아래 완료·테스트 기준은 기대 동작입니다. 실제 통과·실패·미검증, 실행 계정·시각, 스크린샷은 QA 업무에서 확인합니다. 설계 상태만으로 테스트 통과를 판단하지 않습니다.</p>
            <button type="button" className="mt-2 min-h-11 rounded-lg border border-blue-700 px-3 font-bold text-blue-800" onClick={()=>{const trigger=document.querySelector<HTMLButtonElement>('button[aria-label="QA 업무"], button[aria-label="QA workflow"]');if(trigger){setOpen(false);trigger.click();}else{setMessage('현재 화면의 QA 업무 진입 버튼을 찾지 못했습니다. 검증 완료로 처리하지 않습니다.');}}}>관련 QA 업무 열기</button>
          </div>
        </>}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm"><p className="font-black text-[#052b57]">현재 URL</p><p className="mt-1 break-all text-slate-700">{window.location.origin}{routePath}</p><p className="mt-1 text-xs font-bold text-slate-500">페이지 ID: {pageId || "미등록"} · 저장 버전: {note.version}</p></div>
        {workContext?.accessRestricted?<div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-950" data-screen-work-context="" data-screen-classification={workClassification} data-screen-access-restricted="true">{workContext.reasonText||"이 화면은 실행 업무 화면이지만 현재 계정의 담당 액터·권한 범위 밖입니다. 설계 누락이 아니므로 업무 배정과 계정 권한을 확인하세요."}</div>:workClassification==="EXECUTABLE"&&workContext?.workflow?<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm" data-screen-work-context="" data-screen-classification={workClassification}><p className="font-black text-emerald-900">연결 업무 계약</p><p className="mt-1 font-bold text-slate-900">{workContext.workflow.processName||workContext.workflow.processCode} · {Number(workContext.workflow.stepOrder||0)}. {workContext.workflow.stepName||workContext.workflow.stepCode}</p><dl className="mt-2 grid gap-1 text-xs text-slate-700"><div><dt className="inline font-black">담당자 </dt><dd className="inline">{workContext.workflow.actorName||workContext.workflow.actorCode||"-"}</dd></div><div><dt className="inline font-black">업무 목적 </dt><dd className="inline">{workContext.workflow.workPurpose||"-"}</dd></div><div><dt className="inline font-black">완료 조건 </dt><dd className="inline">{workContext.workflow.completionRule||"-"}</dd></div></dl><p className="mt-2 border-t border-emerald-200 pt-2 text-[11px] font-bold text-emerald-800">업무 계약은 액터·프로세스 원장에서 읽기 전용으로 연동되며, 아래 설계 메모는 이 공통 화면과 연결된 모든 업무에 반영됩니다.</p></div>:workClassification==="EXECUTABLE"&&workContext?.selectionRequired?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900" data-screen-work-context="" data-screen-classification={workClassification}>이 화면에 {workContext.candidateCount||workContext.candidates?.length||0}개 업무 절차가 연결되어 있습니다. 업무 길잡이에서 절차를 선택하면 설계 계약도 함께 전환됩니다.</div>:workClassification==="INFORMATIONAL"?<div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900" data-screen-work-context="" data-screen-classification={workClassification}>{workContext?.reasonText||"정보 조회 화면입니다. 실행 절차 없이 조회 기준·데이터 출처·도움말 설계를 관리합니다."}</div>:workClassification==="EXCLUDED"?<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700" data-screen-work-context="" data-screen-classification={workClassification}>{workContext?.reasonText||"보안·계정 복구·오류·인쇄 화면으로 업무 실행 연결 대상에서 제외됩니다. 화면 설계 메모는 별도로 관리할 수 있습니다."}</div>:workContext?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-screen-work-context="" data-screen-classification={workClassification}><p className="font-bold">{workContext.reasonText||"실행 업무 계약을 확정하기 위한 설계 검토가 필요합니다."}</p><a className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-3 font-black hover:bg-amber-100" href={`/admin/system/actor-process?tab=design-canvas&routePath=${encodeURIComponent(designRoutePath)}`}>액터·프로세스 설계에서 검토</a></div>:null}
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">화면 제목</span><input className="gov-input mt-1" value={note.pageTitle} onChange={event=>setNote(current=>({...current,pageTitle:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">UI·레이아웃 설계</span><textarea className="gov-input mt-1 min-h-24 py-3" placeholder="섹션 순서, 컴포넌트, 반응형, KRDS 적용 기준을 기록합니다." value={note.designNote} onChange={event=>setNote(current=>({...current,designNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">필요 기능·업무 규칙</span><textarea className="gov-input mt-1 min-h-28 py-3" placeholder="액터의 행동, 입력·조회·저장·승인, API·DB 연계와 예외 처리를 기록합니다." value={note.functionNote} onChange={event=>setNote(current=>({...current,functionNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">완료·테스트 기준</span><textarea className="gov-input mt-1 min-h-24 py-3" placeholder="정상·예외·권한·격리·복구 테스트의 기대값을 기록합니다." value={note.acceptanceNote} onChange={event=>setNote(current=>({...current,acceptanceNote:event.target.value}))}/></label>
        <label className="mt-4 block"><span className="text-sm font-black text-slate-700">설계 상태</span><select className="gov-select mt-1" value={note.status} onChange={event=>setNote(current=>({...current,status:event.target.value}))}><option value="DRAFT">초안</option><option value="READY">개발 준비</option><option value="IN_DEVELOPMENT">개발 중</option><option value="VERIFIED">검증 완료</option></select></label>
        <div className="mt-5"><ScreenHtmlMockupManager routePath={designRoutePath} pageId={pageId} mockups={note.mockups||[]} onChanged={body=>setNote(current=>({...current,...body as Partial<Note>}))} compact/></div>
        {note.updatedAt?<p className="mt-3 text-xs text-slate-500">최근 저장: {note.updatedAt} · {note.updatedBy||"-"}</p>:null}
        {message?<p className={`mt-3 rounded-lg p-3 text-sm font-bold ${message.includes("저장했습니다")||message.includes("이미 최신입니다")?"bg-emerald-50 text-emerald-800":"bg-rose-50 text-rose-800"}`} role="status">{message}</p>:null}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold text-slate-500">저장 즉시 설계 검증·화면 계약·개발 작업을 갱신합니다.</p><button className="min-h-11 shrink-0 rounded-lg bg-[#246beb] px-5 font-black text-white disabled:opacity-50" disabled={busy} onClick={()=>void save()} type="button">{busy?"생성 중...":"저장·즉시 생성"}</button></footer>
    </section>}
  </aside>;
}
