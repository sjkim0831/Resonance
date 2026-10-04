import {useState} from 'react';
import screens from './emission-workflow-screens.json';
import './emission-workflow-navigation.css';

/** Presentation contract only. Never advances business state or grants permissions. */
export function EmissionWorkflowNavigator(){
 const path=location.pathname.replace(/^\/en\//,'/'),params=new URLSearchParams(location.search),id=params.get('projectId')||params.get('id')||'';
 const [expanded,setExpanded]=useState(false),en=location.pathname.startsWith('/en/');
 const tab=params.get('tab');
 const index=screens.findIndex(s=>s.path===path+(tab&&['quality','submission'].includes(tab)?'?tab='+tab:''));
 if(index<0||!id||path==='/emission/project/detail'||path==='/emission/activity-data')return null;
 const current=screens[index];
 const href=(target:string)=>{const u=new URL(target,location.origin);u.searchParams.set('projectId',id);return (en?'/en':'')+u.pathname+u.search;};
 return <section className="emission-workflow-navigation" aria-label="프로젝트 업무 화면 연결">
  <div className="workflow-nav-bar"><a href={href('/emission/project/detail')}>프로젝트 상세</a><span>{id}</span><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>전체 업무 화면 {expanded?'접기':'보기'} ({screens.length})</button></div>
  <details className="workflow-page-guide"><summary>이 화면에서 할 일 · {current.name}</summary><p>{current.action}</p><dl><dt>입력</dt><dd>{current.input}</dd><dt>처리 결과</dt><dd>{current.output}</dd></dl><p>순서는 업무 안내입니다. 업로드는 직접 입력의 대안이며, 보완은 이전 단계로 돌아갑니다. 실제 완료·권한은 서버의 저장 결과로 판단합니다.</p></details>
  {expanded&&<div className="workflow-map-table"><table><caption>프로젝트 업무 화면과 연결 순서</caption><thead><tr><th>순서</th><th>화면</th><th>입력</th><th>처리 결과</th></tr></thead><tbody>{screens.map((s,i)=><tr key={s.path}><td>{i+1}</td><td><a href={href(s.path)} aria-current={i===index?'page':undefined}>{s.name}{i===index?' (현재)':''}</a></td><td>{s.input}</td><td>{s.output}</td></tr>)}</tbody></table></div>}
 </section>;
}
