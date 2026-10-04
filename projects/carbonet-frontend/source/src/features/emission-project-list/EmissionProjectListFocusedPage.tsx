import { FormEvent, useEffect, useMemo, useState } from "react";
import {CommonBreadcrumb} from '../../components/common-design/CommonBreadcrumb';
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";
import "./emissionProjectListV1.css";
import "./EmissionProjectListSelection.css";
import {CommonSearchSection} from '../../components/common-design/CommonSearchSection';
import { EmissionWorkSidebar, emissionWorkSidebarStyles } from "./EmissionWorkSidebar";

type Site={id:string;name:string};
type Row={id:string;name:string;sites:Site[];periodStart:string|null;periodEnd:string|null;legacyPeriod?:string;status:string;calculatedStatus:string;updatedAt:string|null};
type Payload={contractVersion:number;items:Row[];sites:Site[];totalCount:number;page:number;pageSize:number;canCreate:boolean;scopeNotice?:string};
type Filters={keyword:string;siteId:string;status:string;periodFrom:string;periodTo:string;page:number;pageSize:number;sort:string};
const defaults:Filters={keyword:"",siteId:"",status:"",periodFrom:"",periodTo:"",page:1,pageSize:20,sort:"UPDATED_DESC"};
const statusLabels:Record<string,[string,string]>={IN_PROGRESS:["진행중","In progress"],COMPLETED:["완료","Complete"],REPORT_COMPLETED:["내부 보고 완료","Internal report complete"],STOPPED:["중단","Stopped"],UNKNOWN:["상태 확인 필요","Check status"]};
const calculationLabels:Record<string,[string,string]>={NOT_CALCULATED:["미산정","Not calculated"],RUNNING:["계산중","Calculating"],CALCULATED:["산정됨","Calculated"],STALE:["재산정 필요","Recalculation needed"],FAILED:["실패","Failed"],UNKNOWN:["확인 필요","Check required"]};
function initialFilters():Filters {
 const q=new URLSearchParams(location.search);
 const page=Number(q.get("page")||1),size=Number(q.get("pageSize")||20);
 return {keyword:(q.get("keyword")||"").slice(0,100),siteId:q.get("siteId")||"",status:["IN_PROGRESS","REPORT_COMPLETED","COMPLETED","STOPPED"].includes(q.get("status")||"")?q.get("status")!:"",periodFrom:q.get("periodFrom")||"",periodTo:q.get("periodTo")||"",page:Number.isInteger(page)&&page>0&&page<=1000000?page:1,pageSize:[20,50,100].includes(size)?size:20,sort:["UPDATED_DESC","UPDATED_ASC","NAME_ASC","NAME_DESC"].includes(q.get("sort")||"")?q.get("sort")!:"UPDATED_DESC"};
}
function query(f:Filters){return new URLSearchParams(Object.entries(f).map(([k,v])=>[k,String(v)]));}
function displayTime(value:string|null){
 if(!value)return "—";
 const d=new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value.replace(" ","T")+"+09:00");
 return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
}
export function EmissionProjectListMigrationPage(){
 const en=isEnglish(),text=(ko:string,eng:string)=>en?eng:ko,content=LOCALIZED_CONTENT[en?"en":"ko"],session=useFrontendSession();
 const empty=useMemo<HomePayload>(()=>({isLoggedIn:false,isEn:en,homeMenu:[]}),[en]);
 const home=useAsyncValue<HomePayload>(()=>fetchHomePayload(),[en],{initialValue:empty,onError:()=>undefined});
 const [mobile,setMobile]=useState(false),[filters,setFilters]=useState(initialFilters),[draft,setDraft]=useState(initialFilters);
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[validation,setValidation]=useState(""),[retry,setRetry]=useState(0),[authExpired,setAuthExpired]=useState(false);
 const api=buildLocalizedPath("/home/api/emission-project-list-v1","/en/home/api/emission-project-list-v1");
 useEffect(()=>{document.body.classList.toggle("mobile-menu-open",mobile);return()=>document.body.classList.remove("mobile-menu-open");},[mobile]);
 useEffect(()=>{
   const pop=()=>{const f=initialFilters();setFilters(f);setDraft(f);};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);
 },[]);
 useEffect(()=>{
   const controller=new AbortController();let current=true;setLoading(true);setError("");setAuthExpired(false);
   fetch(`${api}?${query(filters)}`,{credentials:"include",signal:controller.signal}).then(async response=>{
     if(response.status===401){setAuthExpired(true);throw Error(text("로그인이 만료되었습니다. 다시 로그인해 주세요.","Please sign in again."));}
     if(response.status===403)throw Error(text("프로젝트 조회 권한이 없습니다.","You cannot view these projects."));
     const type=response.headers.get("content-type")||"";
     if(!type.includes("application/json"))throw Error(text("목록 조회 API가 아직 준비되지 않았습니다. 관리자에게 문의하세요.","The list API is not ready."));
     const body=await response.json();if(!response.ok)throw Error(body.message||text("목록 조회에 실패했습니다.","Could not load projects."));
     if(body.contractVersion!==1||!Array.isArray(body.items)||!Array.isArray(body.sites)||!Number.isInteger(body.totalCount))throw Error(text("목록 응답 형식이 설계와 다릅니다.","The list response is incompatible."));
     if(current){setData(body);if(body.page!==filters.page){const next={...filters,page:body.page};history.replaceState(null,"",`${location.pathname}?${query(next)}`);setFilters(next);setDraft(next);}}
   }).catch(e=>{if(current&&e.name!=="AbortError")setError(e.message);}).finally(()=>{if(current)setLoading(false);});
   return()=>{current=false;controller.abort();};
 },[api,filters,retry,en]);
 function apply(next:Filters){setValidation("");setFilters(next);setDraft(next);history.replaceState(null,"",`${location.pathname}?${query(next)}`);}
 function search(e:FormEvent){e.preventDefault();if(draft.periodFrom&&draft.periodTo&&draft.periodFrom>draft.periodTo){setValidation(text("시작일은 종료일보다 늦을 수 없습니다.","Start must not be after end."));return;}apply({...draft,keyword:draft.keyword.trim(),page:1});}
 function remember(){sessionStorage.setItem("ccus.emission.list.return",location.pathname+location.search);sessionStorage.setItem("ccus.emission.list.scroll",String(scrollY));}
 useEffect(()=>{if(!loading&&!error&&data){const previous=sessionStorage.getItem("ccus.emission.list.return");if(previous===location.pathname+location.search){const y=Number(sessionStorage.getItem("ccus.emission.list.scroll")||0);requestAnimationFrame(()=>scrollTo(0,y));sessionStorage.removeItem("ccus.emission.list.scroll");}}},[loading,error,data]);
 const label=(labels:Record<string,[string,string]>,value:string)=>(labels[value]||labels.UNKNOWN)[en?1:0];
 const ready=Boolean(data&&!loading&&!error),pages=Math.max(1,Math.ceil((data?.totalCount||0)/filters.pageSize));
 const visiblePages=Array.from({length:Math.min(5,pages)},(_,i)=>Math.max(1,Math.min(filters.page-2,pages-4))+i);
 const filtered=Boolean(filters.keyword||filters.siteId||filters.status||filters.periodFrom||filters.periodTo);
 function openProject(row:Row){remember();navigate(buildLocalizedPath(`/emission/project/detail?projectId=${encodeURIComponent(row.id)}`,`/en/emission/project/detail?projectId=${encodeURIComponent(row.id)}`));}
 const homeData=home.value||empty;
 return <><HomeInlineStyles en={en}/><style>{emissionWorkSidebarStyles}</style><div className="emission-list-v1" data-design-id="EMI-001" data-design-version="1">
 <a className="skip-link" href="#project-list-main">{content.skipLink}</a>
 <header className="border-b-2 border-[#001e40] bg-white"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center gap-3"><HeaderBrand content={content} en={en}/><HeaderDesktopNav en={en} homeMenu={homeData.homeMenu||[]}/><div className="ml-auto flex items-center gap-2"><button onClick={()=>navigate(en?"/emission/project_list":"/en/emission/project_list")} type="button">{en?"KO":"EN"}</button>{homeData.isLoggedIn?<button onClick={()=>void session.logout()} type="button">{content.logout}</button>:<a href={buildLocalizedPath("/signin/loginView","/en/signin/loginView")}>{content.login}</a>}<button className="xl:hidden" aria-expanded={mobile} aria-label={content.openAllMenu} onClick={()=>setMobile(true)} type="button">{text("메뉴","Menu")}</button></div></div></div></header>
 {mobile&&<div className="fixed inset-0 z-[70] bg-black/50"><HeaderMobileMenu content={content} en={en} homeMenu={homeData.homeMenu||[]} isLoggedIn={Boolean(homeData.isLoggedIn)} onClose={()=>setMobile(false)} onLogout={session.logout}/></div>}
 <main id="project-list-main" className="el-main">
 <CommonBreadcrumb/>
 <div className="ew-work-layout el-work-layout">
 <EmissionWorkSidebar homeMenu={homeData.homeMenu||[]} currentPath={window.location.pathname}/>
 <div className="min-w-0">
 <div className="el-project-title"><div><h1>{text("배출량 프로젝트","Emission projects")}</h1></div>{data?.canCreate&&<a className="el-button el-primary" onClick={remember} href={buildLocalizedPath("/emission/project/create","/en/emission/project/create")}>{text("＋ 프로젝트 등록","＋ New project")}</a>}</div>
 <form onSubmit={search} className="ccus-search-host" aria-label={text("프로젝트 조회","Project search")}>
 <CommonSearchSection basic={<><label>{text("프로젝트 검색","Project search")}<input type="search" maxLength={100} placeholder={text("프로젝트명 또는 프로젝트 ID","Project name or ID")} value={draft.keyword} onChange={e=>setDraft({...draft,keyword:e.target.value})}/></label><label>{text("참여 사업장","Participating site")}<select value={draft.siteId} onChange={e=>setDraft({...draft,siteId:e.target.value})}><option value="">{text("전체 사업장","All sites")}</option>{data?.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>{text("진행 상태","Status")}<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="">{text("전체 상태","All statuses")}</option>{["IN_PROGRESS","REPORT_COMPLETED","COMPLETED","STOPPED"].map(s=><option key={s} value={s}>{label(statusLabels,s)}</option>)}</select></label></>}
 advanced={<><label>{text("산정 기간 시작","Period from")}<input type="date" value={draft.periodFrom} aria-invalid={Boolean(validation)} onChange={e=>setDraft({...draft,periodFrom:e.target.value})}/></label><label>{text("산정 기간 종료","Period to")}<input type="date" value={draft.periodTo} aria-invalid={Boolean(validation)} onChange={e=>setDraft({...draft,periodTo:e.target.value})}/></label></>}
 actions={<><button className="el-primary" type="submit">{text("검색","Search")}</button><button type="button" onClick={()=>apply({...defaults})}>{text("초기화","Reset")}</button></>}/>
 {validation&&<p role="alert" className="el-error">{validation}</p>}</form>
 <div className="el-project-layout"><section className="el-list-column" aria-label={text("프로젝트 목록","Project list")}>
 <div className="el-result-meta"><p aria-live="polite">{text("검색 결과","Search results")} <b>{ready?data!.totalCount.toLocaleString():"—"}</b>{text("건","")}</p></div>
 <section className="el-list-card"><div className="el-list-toolbar"><h2>{text("프로젝트 목록","Projects")} <span>{ready?data!.totalCount.toLocaleString():"—"}</span></h2><div className="el-list-tools"><label>{text("표시 건수","Rows")}<select aria-label={text("표시 건수","Page size")} value={filters.pageSize} onChange={e=>apply({...filters,pageSize:Number(e.target.value),page:1})}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>{text("정렬","Sort")}<select aria-label={text("정렬","Sort")} value={filters.sort} onChange={e=>apply({...filters,sort:e.target.value,page:1})}><option value="UPDATED_DESC">{text("최근 수정일 순","Recently updated")}</option><option value="UPDATED_ASC">{text("오래된 수정일 순","Least recently updated")}</option><option value="NAME_ASC">{text("프로젝트명 순","Project name")}</option><option value="NAME_DESC">{text("프로젝트명 역순","Project name, Z–A")}</option></select></label></div></div>
 {error?<section role="alert" className="el-error"><p>{error}</p>{authExpired?<a className="el-button" href={buildLocalizedPath("/signin/loginView","/en/signin/loginView")} onClick={remember}>{text("로그인","Sign in")}</a>:<button onClick={()=>setRetry(x=>x+1)}>{text("다시 시도","Retry")}</button>}</section>:<div className="el-table-scroll" tabIndex={0} role="region" aria-label={text("프로젝트 목록 표","Projects table")} aria-busy={loading}>
 <table><caption className="sr-only">{text("배출량 프로젝트 목록","Emission projects")}</caption><thead><tr><th scope="col" aria-sort={filters.sort.startsWith("NAME")?(filters.sort.endsWith("ASC")?"ascending":"descending"):"none"}><button type="button" onClick={()=>apply({...filters,sort:filters.sort==="NAME_ASC"?"NAME_DESC":"NAME_ASC",page:1})}>{text("프로젝트명 · ID","Project name · ID")} ↕</button></th><th scope="col">{text("참여 사업장","Sites")}</th><th scope="col">{text("산정 기간","Period")}</th><th scope="col">{text("진행 상태","Status")}</th><th scope="col">{text("산정 상태","Calculation")}</th><th scope="col" aria-sort={filters.sort.startsWith("UPDATED")?(filters.sort.endsWith("ASC")?"ascending":"descending"):"none"}><button type="button" onClick={()=>apply({...filters,sort:filters.sort==="UPDATED_DESC"?"UPDATED_ASC":"UPDATED_DESC",page:1})}>{text("최근 수정일","Last updated")} ↕</button></th></tr></thead><tbody>
 {loading?<tr><td colSpan={6} className="el-empty">{text("프로젝트를 불러오는 중입니다…","Loading projects…")}</td></tr>:data?.items.length?data.items.map(row=><tr key={row.id}><td><a className="el-row-select" href={buildLocalizedPath(`/emission/project/detail?projectId=${encodeURIComponent(row.id)}`,`/en/emission/project/detail?projectId=${encodeURIComponent(row.id)}`)} onClick={event=>{event.preventDefault();openProject(row)}}>{row.name}</a><small>{row.id}</small></td><td>{row.sites.length?row.sites.slice(0,2).map(s=><span className="el-site" key={s.id}>{s.name}</span>):text("사업장 매핑 확인 필요","Site mapping required")}{row.sites.length>2&&<details><summary>{text(`외 ${row.sites.length-2}개`,`+${row.sites.length-2} sites`)}</summary>{row.sites.slice(2).map(s=><span className="el-site" key={s.id}>{s.name}</span>)}</details>}</td><td>{row.periodStart&&row.periodEnd?<>{row.periodStart}<br/>~ {row.periodEnd}</>:<>{row.legacyPeriod||"—"}<small>{text("기간 확인 필요","Check dates")}</small></>}</td><td><span className={`el-status ${row.status==="COMPLETED"?"el-done":""}`}>{label(statusLabels,row.status)}</span></td><td>{label(calculationLabels,row.calculatedStatus)}</td><td>{displayTime(row.updatedAt)}</td></tr>):<tr><td colSpan={6} className="el-empty">{filtered?text("검색 조건에 맞는 프로젝트가 없습니다.","No projects match the filters."):text("등록된 프로젝트가 없습니다.","No projects have been registered.")}{filtered&&<button type="button" onClick={()=>apply({...defaults})}>{text("검색 초기화","Reset filters")}</button>}</td></tr>}
 </tbody></table></div>}
 {ready&&pages>1&&<nav className="el-pages" aria-label={text("페이지 이동","Pagination")}><button disabled={filters.page===1} onClick={()=>apply({...filters,page:1})}>{text("처음","First")}</button><button disabled={filters.page===1} onClick={()=>apply({...filters,page:filters.page-1})}>{text("이전","Previous")}</button>{visiblePages.map(n=><button key={n} aria-current={n===filters.page?"page":undefined} onClick={()=>apply({...filters,page:n})}>{n}</button>)}<button disabled={filters.page===pages} onClick={()=>apply({...filters,page:filters.page+1})}>{text("다음","Next")}</button><button disabled={filters.page===pages} onClick={()=>apply({...filters,page:pages})}>{text("마지막","Last")}</button></nav>}
 </section>
 </section></div>
 </div>
 </div>
 </main><footer className="el-footer">CCUS · {text("탄소중립 플랫폼","Carbon neutrality platform")}</footer></div></>;
}
