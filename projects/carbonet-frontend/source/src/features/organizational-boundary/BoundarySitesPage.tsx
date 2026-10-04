import {useEffect,useState} from 'react';
type Data={project:{name:string;periodStart:string;periodEnd:string};sites:{id:number;name:string}[];items:{siteId?:number;factorId?:string}[]};
export function BoundarySitesPage(){
 const id=new URLSearchParams(location.search).get('projectId')||'';
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{if(!id)throw Error('프로젝트를 먼저 선택하세요.');const r=await fetch(`/home/api/emission-projects/${encodeURIComponent(id)}/activities`,{credentials:'include'});if(!r.ok)throw Error(`사업장 현황 조회 실패 (${r.status})`);setData(await r.json());}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 useEffect(()=>{void load();},[id]);
 const detail=`/emission/project/detail?projectId=${encodeURIComponent(id)}`;
 return <main className="ccus-boundary-public"><div style={{maxWidth:1156,margin:'0 auto',padding:'24px 0 48px'}}>
 <h1>산정 대상 사업장 확인</h1>
 <div style={{display:'flex',gap:8,margin:'24px 0'}}><a className="gov-btn" href={detail}>프로젝트 상세</a><button className="gov-btn" disabled={busy} onClick={load}>현황 새로고침</button></div>
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">사업장 현황을 불러오는 중입니다.</p>}
 {data&&!error&&<><h2>프로젝트 정보</h2><dl><dt>프로젝트명</dt><dd>{data.project.name}</dd><dt>산정 기간</dt><dd>{data.project.periodStart} ~ {data.project.periodEnd}</dd></dl>
 <h2 style={{marginTop:32}}>참여 사업장 ({data.sites.length}개)</h2>
 <p>프로젝트에 연결된 모든 사업장을 대상으로 합니다. 자료 건수는 입력 현황이며 제출·승인 완료를 의미하지 않습니다.</p>
 {!data.sites.length&&<p role="alert">연결된 사업장이 없습니다. 프로젝트의 참여 사업장을 확인하세요.</p>}
 {data.items.some(x=>!data.sites.some(s=>String(s.id)===String(x.siteId)))&&<p role="alert">사업장 연결을 확인해야 하는 활동자료가 있습니다.</p>}
 <div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:620,borderCollapse:'collapse'}}><thead><tr>{['사업장','활동자료','계수 미연결','입력 상태','업무'].map(x=><th style={{padding:16,background:'#f3f4f6',textAlign:'left'}} key={x}>{x}</th>)}</tr></thead><tbody>{data.sites.map(s=>{const rows=data.items.filter(x=>String(x.siteId)===String(s.id));return <tr key={s.id}>{[s.name,`${rows.length}건`,`${rows.filter(x=>!x.factorId).length}건`,rows.length?'입력 자료 있음':'입력 전'].map((v,i)=><td key={i} style={{padding:16,borderBottom:'1px solid #ddd'}}>{v}</td>)}<td><a className="gov-btn" href={`/emission/activity-data?projectId=${encodeURIComponent(id)}&siteId=${s.id}`}>활동자료 입력</a></td></tr>})}</tbody></table></div>
 <details style={{marginTop:28}}><summary>이 화면의 업무 안내</summary><ol><li>프로젝트 등록 시 선택한 사업장과 산정 기간을 확인합니다.</li><li>사업장별 활동자료 입력을 눌러 사용량·단위·기간·증빙을 저장합니다.</li><li>돌아와 현황 새로고침을 누르면 저장한 자료 건수가 반영됩니다.</li><li>제출·접수된 자료에 배출계수를 연결한 뒤 산정합니다.</li></ol><p>이 화면은 조회용으로 별도 저장·승인을 요구하지 않습니다. 사업장 제외·지분율은 일반 산정에 적용하지 않습니다.</p></details></>}
 </div></main>;
}
