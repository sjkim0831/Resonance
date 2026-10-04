import {useState} from 'react';
import inventory from './emission-screen-classification.json';
const phases=['사전 설정','프로젝트 준비','자료 수집','산정·검증','승인·확정','보고·발급','운영·추적','선택 업무(LCA·감축)'];
export function EmissionScreenDirectory(){
 const [query,setQuery]=useState('');
 const id=new URLSearchParams(location.search).get('projectId')||new URLSearchParams(location.search).get('id');
 const rows=inventory.rows.map(r=>({...r,phase:r.path==='/emission/index'?'프로젝트 준비':r.path==='/admin/emission/regulatory-submissions'?'보고·발급':r.phase}));
 function href(path:string){const url=new URL(path,location.origin);if(id)url.searchParams.set('projectId',id);return url.pathname+url.search;}
 return <details className="mb-5 rounded-lg border border-slate-200 bg-white p-5" data-emission-directory>
 <summary className="cursor-pointer font-bold">탄소배출 전체 화면 목록 ({rows.length}) · 홈·관리자 통합</summary>
 <p className="my-3 text-sm">업무 단계별 화면 찾아보기입니다. 모든 화면이 필수 절차는 아니며, 관리자 설정·선택 업무를 포함합니다. 기존 절차 등록 상태와 화면 기능 검증은 별개입니다.</p>
 <label className="block text-sm font-bold">화면 검색<input className="my-3 block h-11 w-full rounded border px-3" value={query} onChange={e=>setQuery(e.target.value)} placeholder="화면명 또는 경로"/></label>
 {!id&&<p className="text-sm">프로젝트별 화면은 프로젝트를 선택한 뒤 이용하세요.</p>}
 {phases.map((phase,index)=>{const list=rows.filter(r=>r.phase===phase&&`${r.name} ${r.path}`.toLowerCase().includes(query.toLowerCase()));return list.length?<section key={phase} className="my-4"><h4 className="mb-2 font-bold">{index+1}. {phase} ({list.length})</h4><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">화면</th><th className="p-2">구분</th><th className="p-2">절차 등록</th></tr></thead><tbody>{list.map(r=><tr key={r.path} className="border-t"><td className="p-2"><a className="font-bold text-blue-800 underline" href={href(r.path)}>{r.name}</a><small className="block break-all text-slate-500">{r.path}</small></td><td className="p-2">{r.group==='admin'?'관리자':'홈'}</td><td className="p-2">{r.status}</td></tr>)}</tbody></table></div></section>:null;})}
 </details>;
}
