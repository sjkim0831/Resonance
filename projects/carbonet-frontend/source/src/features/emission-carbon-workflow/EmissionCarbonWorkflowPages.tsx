import { useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";

type Project = { id:string; name:string; site:string; period:string; owner:string; progress:number; step:string; dueDate?:string; status:string };
type ProjectPayload = { items:Project[]; total:number };
type PageKey = "request"|"external"|"finalize"|"submit";

const PAGE = {
  request:{eyebrow:"활동자료",title:"자료 제출 요청",description:"사업장 담당자에게 필요한 활동자료와 증빙을 요청하고 프로젝트별 수집 상태를 관리합니다.",icon:"forward_to_inbox",primary:"요청 대상 선택",next:"/emission/activity-data",nextLabel:"활동자료 관리"},
  external:{eyebrow:"활동자료",title:"외부 데이터 연계",description:"전력·연료·ERP 등 외부 원천의 연결 상태를 확인하고 프로젝트 활동자료로 반영합니다.",icon:"hub",primary:"연계 데이터 확인",next:"/emission/activity-data",nextLabel:"활동자료에서 확인"},
  finalize:{eyebrow:"확정·보고",title:"배출량 확정",description:"검증과 승인이 끝난 산정 버전을 확인하고 보고 기준 버전으로 확정합니다.",icon:"lock",primary:"확정 대상 검토",next:"/emission/review-approval",nextLabel:"검토·승인 확인"},
  submit:{eyebrow:"확정·보고",title:"보고서 제출",description:"작성된 보고서를 최종 점검하고 제출·다운로드·이력 확인 단계로 연결합니다.",icon:"outbox",primary:"제출 대상 확인",next:"/emission/report-write",nextLabel:"보고서 작성"}
} as const;

function WorkflowPage({pageKey}:{pageKey:PageKey}){
  const en=isEnglish(), content=LOCALIZED_CONTENT[en?"en":"ko"], meta=PAGE[pageKey];
  const home=useAsyncValue(()=>fetchHomePayload(),[en]);
  const projects=useAsyncValue<ProjectPayload>(async()=>{const r=await fetch(buildLocalizedPath("/home/api/emission-projects?size=100","/en/home/api/emission-projects?size=100"),{credentials:"include",headers:{Accept:"application/json"}});if(!r.ok)throw new Error("프로젝트 목록을 불러오지 못했습니다.");return r.json()},[en],{initialValue:{items:[],total:0}});
  const [keyword,setKeyword]=useState("");
  const rows=useMemo(()=>projects.value?.items.filter(p=>`${p.name} ${p.site} ${p.owner} ${p.id}`.toLowerCase().includes(keyword.toLowerCase()))||[],[projects.value,keyword]);
  const href=(path:string,id:string)=>buildLocalizedPath(`${path}${path.includes("?")?"&":"?"}projectId=${encodeURIComponent(id)}`,`/en${path}${path.includes("?")?"&":"?"}projectId=${encodeURIComponent(id)}`);
  const actionPath=(id:string)=>pageKey==="request"?`/emission/activity-data?tab=submission&projectId=${id}`:pageKey==="external"?`/emission/activity-data?tab=external&projectId=${id}`:pageKey==="finalize"?`/emission/project-completion?projectId=${id}`:`/emission/report_submit?projectId=${id}`;
  return <><HomeInlineStyles en={en}/><div className="min-h-screen bg-[#f5f7fa]"><header className="border-b-2 border-[#001e40] bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8"><HeaderBrand content={content} en={en}/><HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu||[]}/></div></header><main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
    <nav className="text-sm font-medium text-slate-500"><a href={buildLocalizedPath("/emission/index","/en/emission/index")}>탄소배출 관리</a><span className="mx-2">/</span>{meta.eyebrow}</nav>
    <section className="mt-5 overflow-hidden rounded-2xl bg-[#052b57] p-6 text-white shadow-lg lg:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><span className="inline-flex items-center gap-2 text-sm font-bold text-blue-200"><span className="material-symbols-outlined">{meta.icon}</span>{meta.eyebrow}</span><h1 className="mt-3 text-3xl font-black">{meta.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{meta.description}</p></div><a className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-white px-5 font-black text-[#052b57]" href={buildLocalizedPath(meta.next,`/en${meta.next}`)}>{meta.nextLabel}</a></div></section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="w-full max-w-xl text-sm font-bold text-slate-700">프로젝트 검색<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="프로젝트명, 사업장, 담당자"/></label><span className="text-sm font-bold text-slate-500">{rows.length}개 프로젝트</span></div></section>
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-4">프로젝트</th><th className="p-4">사업장·기간</th><th className="p-4">담당자</th><th className="p-4">현재 단계</th><th className="p-4">진행률</th><th className="p-4 text-center">업무</th></tr></thead><tbody>{rows.map(p=><tr className="border-t hover:bg-blue-50/40" key={p.id}><td className="p-4"><strong className="block text-[#052b57]">{p.name}</strong><small className="text-slate-500">{p.id}</small></td><td className="p-4"><strong>{p.site}</strong><small className="block text-slate-500">{p.period}</small></td><td className="p-4 font-bold">{p.owner}</td><td className="p-4"><span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-800">{p.step}</span></td><td className="p-4"><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:`${p.progress}%`}}/></div><strong>{p.progress}%</strong></div></td><td className="p-4 text-center"><a className="inline-flex min-h-10 items-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={buildLocalizedPath(actionPath(p.id),`/en${actionPath(p.id)}`)}>{meta.primary}</a></td></tr>)}{!projects.loading&&!rows.length?<tr><td className="p-12 text-center text-slate-500" colSpan={6}>조건에 맞는 프로젝트가 없습니다.</td></tr>:null}</tbody></table></div></section>
    <div className="mt-6 flex flex-wrap justify-between gap-3"><a className="font-bold text-blue-700 underline" href={buildLocalizedPath("/emission/project_list","/en/emission/project_list")}>프로젝트 목록</a>{rows[0]?<a className="font-bold text-blue-700 underline" href={href(meta.next,rows[0].id)}>다음 업무로 이동</a>:null}</div>
  </main></div></>;
}

export { EmissionDataRequestFunctionalPage as EmissionDataRequestPage } from "./EmissionDataRequestFunctionalPage";
export function EmissionExternalDataPage(){return <WorkflowPage pageKey="external"/>}
export function EmissionFinalizationPage(){return <WorkflowPage pageKey="finalize"/>}
export function EmissionReportSubmissionPage(){return <WorkflowPage pageKey="submit"/>}
