import {CommonBreadcrumb} from '../../components/common-design/CommonBreadcrumb';
import { useMemo, useState } from "react";
import { EmissionPageIntro } from "../emission-common/EmissionPageIntro";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

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
  const en=isEnglish(), meta=PAGE[pageKey];
  const projects=useAsyncValue<ProjectPayload>(async()=>{const r=await fetch(buildLocalizedPath("/home/api/emission-projects?page=1&size=100","/en/home/api/emission-projects?page=1&size=100"),{credentials:"include",headers:{Accept:"application/json"}});if(!r.ok)throw new Error("프로젝트 목록을 불러오지 못했습니다.");return r.json()},[en],{initialValue:{items:[],total:0}});
  const [keyword,setKeyword]=useState("");
  const rows=useMemo(()=>projects.value?.items.filter(p=>`${p.name} ${p.site} ${p.owner} ${p.id}`.toLowerCase().includes(keyword.toLowerCase()))||[],[projects.value,keyword]);
  const href=(path:string,id:string)=>buildLocalizedPath(`${path}${path.includes("?")?"&":"?"}projectId=${encodeURIComponent(id)}`,`/en${path}${path.includes("?")?"&":"?"}projectId=${encodeURIComponent(id)}`);
  const actionPath=(id:string)=>pageKey==="request"?`/emission/activity-data?tab=submission&projectId=${id}`:pageKey==="external"?`/emission/activity-data?tab=external&projectId=${id}`:pageKey==="finalize"?`/emission/project-completion?projectId=${id}`:`/emission/report_submit?projectId=${id}`;
  return <div className="min-h-screen bg-[#f5f7fa]"><main className="mx-auto max-w-7xl px-4 py-10 lg:px-8"><CommonBreadcrumb/>
    
    <EmissionPageIntro category={meta.eyebrow} title={meta.title} description={meta.description} actions={<a href={buildLocalizedPath(meta.next,`/en${meta.next}`)}>{meta.nextLabel}</a>} />
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="w-full max-w-xl text-sm font-bold text-slate-700">프로젝트 검색<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="프로젝트명, 사업장, 담당자"/></label><span className="text-sm font-bold text-slate-500">{rows.length}개 프로젝트</span></div></section>
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-4">프로젝트</th><th className="p-4">사업장·기간</th><th className="p-4">담당자</th><th className="p-4">현재 단계</th><th className="p-4">진행률</th><th className="p-4 text-center">업무</th></tr></thead><tbody>{rows.map(p=><tr className="border-t hover:bg-blue-50/40" key={p.id}><td className="p-4"><strong className="block text-[#052b57]">{p.name}</strong><small className="text-slate-500">{p.id}</small></td><td className="p-4"><strong>{p.site}</strong><small className="block text-slate-500">{p.period}</small></td><td className="p-4 font-bold">{p.owner}</td><td className="p-4"><span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-800">{p.step}</span></td><td className="p-4"><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:`${p.progress}%`}}/></div><strong>{p.progress}%</strong></div></td><td className="p-4 text-center"><a className="inline-flex min-h-10 items-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={buildLocalizedPath(actionPath(p.id),`/en${actionPath(p.id)}`)}>{meta.primary}</a></td></tr>)}{!projects.loading&&!rows.length?<tr><td className="p-12 text-center text-slate-500" colSpan={6}>조건에 맞는 프로젝트가 없습니다.</td></tr>:null}</tbody></table></div></section>
    <div className="mt-6 flex flex-wrap justify-between gap-3"><a className="font-bold text-blue-700 underline" href={buildLocalizedPath("/emission/project_list","/en/emission/project_list")}>프로젝트 목록</a>{rows[0]?<a className="font-bold text-blue-700 underline" href={href(meta.next,rows[0].id)}>다음 업무로 이동</a>:null}</div>
  </main></div>;
}

export { EmissionDataRequestFunctionalPage as EmissionDataRequestPage } from "./EmissionDataRequestFunctionalPage";
function ExternalDataIntegrationWorkspace(){
  const en=isEnglish();
  const params=new URLSearchParams(window.location.search);
  const selectedId=params.get("projectId")||"";
  const projects=useAsyncValue<ProjectPayload>(async()=>{const r=await fetch(buildLocalizedPath("/home/api/emission-projects?page=1&size=100","/en/home/api/emission-projects?page=1&size=100"),{credentials:"include",headers:{Accept:"application/json"}});if(!r.ok)throw new Error("프로젝트 목록을 불러오지 못했습니다.");return r.json()},[en],{initialValue:{items:[],total:0}});
  const [keyword,setKeyword]=useState("");
  const rows=useMemo(()=>projects.value?.items.filter(p=>`${p.name} ${p.site} ${p.owner} ${p.id}`.toLowerCase().includes(keyword.toLowerCase()))||[],[projects.value,keyword]);
  const selected=projects.value?.items.find(p=>p.id===selectedId);
  const selectionHref=(id:string)=>buildLocalizedPath(`/emission/external-data?projectId=${encodeURIComponent(id)}`,`/en/emission/external-data?projectId=${encodeURIComponent(id)}`);
  return <div className="min-h-screen bg-[#f5f7fa]"><main className="mx-auto max-w-7xl px-4 py-8 lg:px-8"><CommonBreadcrumb/>
    <EmissionPageIntro category="활동자료" title="외부 데이터 연계" description="프로젝트를 선택해 외부 원천 연계 여부를 확인합니다. 연결된 수집 기능이 없으면 활동자료 화면에서 직접 입력할 수 있습니다." actions={<a href={buildLocalizedPath("/emission/activity-data","/en/emission/activity-data")}>활동자료 관리</a>} />
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="w-full max-w-2xl text-sm font-bold text-slate-700">프로젝트 검색<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="프로젝트명, 사업장, 담당자 또는 ID"/></label><span className="text-sm text-slate-600">{projects.value?.total??rows.length}개 프로젝트</span></div></section>
    {projects.error?<div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-5 text-red-800">프로젝트 목록을 불러오지 못했습니다. 로그인 상태와 접근 권한을 확인한 뒤 새로고침해 주세요.</div>:null}
    {selected?<section className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">선택 프로젝트</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{selected.name}</h2><p className="mt-1 text-sm text-slate-600">{selected.id} · {selected.site} · {selected.period}</p></div><a className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" href={buildLocalizedPath("/emission/external-data","/en/emission/external-data")}>프로젝트 변경</a></div>
      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">외부 수집 미연결</span><span className="text-sm text-amber-900">이 화면에 연결된 탄소배출 자료 수집·미리보기·저장 API가 없습니다.</span></div><p className="mt-3 text-sm leading-6 text-slate-700">따라서 현재는 전력·연료·ERP 자료를 여기서 자동으로 가져오거나 활동자료에 반영할 수 없습니다. 연결 성공이나 동기화 진행률도 확인되지 않은 상태입니다.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">원천 등록</p><p className="mt-2 font-bold">미구현</p><p className="mt-1 text-sm text-slate-600">연계 원천·인증·매핑 설정 API 미확인</p></div><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">수집·검증</p><p className="mt-2 font-bold">미구현</p><p className="mt-1 text-sm text-slate-600">가져오기·미리보기·품질검사 API 미확인</p></div><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">활동자료 반영</p><p className="mt-2 font-bold">자동 반영 불가</p><p className="mt-1 text-sm text-slate-600">연계 저장 및 이력 API 미확인</p></div></div>
      <div className="mt-6 flex flex-wrap gap-3"><a className="inline-flex min-h-11 items-center rounded-lg bg-[#246beb] px-5 font-bold text-white" href={buildLocalizedPath(`/emission/activity-data?projectId=${encodeURIComponent(selected.id)}`,`/en/emission/activity-data?projectId=${encodeURIComponent(selected.id)}`)}>이 프로젝트 활동자료 입력</a><a className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 font-bold text-slate-700" href={buildLocalizedPath("/emission/evidence","/en/emission/evidence")}>증빙자료 확인</a></div>
    </section>:<section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-extrabold text-slate-900">프로젝트 선택</h2><p className="mt-1 text-sm text-slate-600">선택한 프로젝트의 연계 상태와 활동자료 입력 경로를 확인합니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-4">프로젝트</th><th className="p-4">사업장·기간</th><th className="p-4">담당자</th><th className="p-4">선택</th></tr></thead><tbody>{rows.map(p=><tr className="border-t hover:bg-blue-50/40" key={p.id}><td className="p-4"><strong className="block text-[#052b57]">{p.name}</strong><small className="text-slate-500">{p.id}</small></td><td className="p-4"><strong>{p.site}</strong><small className="block text-slate-500">{p.period}</small></td><td className="p-4">{p.owner}</td><td className="p-4"><a className="inline-flex min-h-10 items-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={selectionHref(p.id)}>연계 상태 확인</a></td></tr>)}{!projects.loading&&!rows.length?<tr><td className="p-10 text-center text-slate-500" colSpan={4}>{keyword?"검색 조건에 맞는 프로젝트가 없습니다.":"접근 가능한 프로젝트가 없습니다."}</td></tr>:null}</tbody></table></div></section>}
    <p className="mt-5 text-xs leading-5 text-slate-500">표시 기준: 서버 프로젝트 조회 결과만 표시합니다. 연결/API가 확인되지 않은 항목은 미연결·미구현으로 표시하며 임의의 수집 상태나 실적을 만들지 않습니다.</p>
  </main></div>;
}
export function EmissionExternalDataPage(){return <ExternalDataIntegrationWorkspace/>}
export function EmissionFinalizationPage(){return <WorkflowPage pageKey="finalize"/>}
export function EmissionReportSubmissionPage(){return <WorkflowPage pageKey="submit"/>}
