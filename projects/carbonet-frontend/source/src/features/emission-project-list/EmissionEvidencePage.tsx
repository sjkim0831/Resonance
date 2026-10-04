import {useEffect,useState} from 'react';
import {CommonPageContainer} from '../../components/common-design/CommonDesignPrimitives';
import {ActivityEvidenceFiles} from '../emission-data-input/EmissionDataInputMigrationPage';
import {buildLocalizedPath,isEnglish} from '../../lib/navigation/runtime';
type Activity={id:number;name:string;siteId?:number;siteName?:string;period:string;note:string};
type Payload={project:{id:string;name:string};items:Activity[];sites?:{id:number;name:string}[]};
export function EmissionEvidencePage(){
 const id=new URLSearchParams(location.search).get('projectId')||'',en=isEnglish();
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[site,setSite]=useState(''),[keyword,setKeyword]=useState(''),[page,setPage]=useState(1);
 const api=buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(id)}/activities`,`/en/home/api/emission-projects/${encodeURIComponent(id)}/activities`);
 async function load(){setLoading(true);setError('');try{const r=await fetch(api,{credentials:'include',headers:{Accept:'application/json'}});if(!r.ok)throw Error(`증빙 대상 조회 실패 (${r.status}). 로그인·프로젝트 권한을 확인하세요.`);const b=await r.json();if(!Array.isArray(b.items))throw Error('활동자료 응답 형식이 올바르지 않습니다.');setData(b);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 useEffect(()=>{if(id)void load()},[id]);
 const items=(data?.items||[]).filter(x=>(!site||String(x.siteId)===site)&&(!keyword||`${x.name} ${x.note}`.includes(keyword))),pages=Math.max(1,Math.ceil(items.length/10)),current=Math.min(page,pages);
 return <CommonPageContainer style={{background:'#fff'}}><header><h1 className="text-3xl font-bold">증빙 자료함</h1><p className="mt-3">{data?.project.name||id} · 활동자료별 원본 증빙을 관리합니다.</p></header>
 {!id?<p role="alert" className="my-6">프로젝트 목록에서 대상을 먼저 선택하세요. <a href="/emission/project_list">프로젝트 목록</a></p>:<>
 <div className="my-6 flex flex-wrap items-end gap-3"><label>활동자료·근거 검색<input className="block rounded border p-2" value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1)}}/></label><label>사업장<select className="block rounded border p-2" value={site} onChange={e=>{setSite(e.target.value);setPage(1)}}><option value="">전체 사업장</option>{data?.sites?.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="rounded border px-4 py-2" disabled={loading} onClick={()=>void load()}>새로고침</button><a className="rounded border px-4 py-2" href={buildLocalizedPath(`/emission/activity-data?projectId=${encodeURIComponent(id)}`,`/en/emission/activity-data?projectId=${encodeURIComponent(id)}`)}>활동자료 입력</a></div>
 {error&&<p role="alert" className="my-4 text-red-800">{error}</p>}{loading&&<p role="status">불러오는 중…</p>}
 {!error&&!loading&&<><p className="my-3">조회 결과 {items.length}건 · 10건씩 표시</p><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-t-2 border-slate-700 bg-gray-100"><tr>{['활동자료','사업장·기간','증빙 식별정보','증빙 파일'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{items.slice((current-1)*10,current*10).map(x=><tr className="border-b align-top" key={x.id}><td className="p-3 font-bold">{x.name}</td><td className="p-3">{x.siteName||'사업장 미지정'}<br/>{x.period}</td><td className="p-3">{x.note||'근거 미입력'}</td><td className="p-3"><ActivityEvidenceFiles activityId={x.id} api={api} en={en}/></td></tr>)}{!items.length&&<tr><td colSpan={4} className="p-8 text-center">대상 활동자료가 없습니다. 활동자료를 저장한 뒤 증빙을 첨부하세요.</td></tr>}</tbody></table></div><nav aria-label="증빙 목록 페이지" className="my-5 flex justify-center gap-4"><button disabled={current===1} onClick={()=>setPage(current-1)}>이전</button><span>{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>다음</button></nav></>}
 <details className="my-6"><summary>증빙 관리 도움말</summary><p className="mt-3">파일은 활동자료에 연결되어 저장됩니다. 첨부·다운로드·삭제는 서버의 프로젝트 권한과 제출 상태 검사를 따릅니다. 지원 파일 PDF·PNG·JPG·XLSX, 최대 10MB입니다. 첨부만으로 제출 또는 승인이 완료되지는 않습니다.</p></details></>}
 </CommonPageContainer>
}
