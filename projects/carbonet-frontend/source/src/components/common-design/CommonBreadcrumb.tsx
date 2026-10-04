import screens from '../../features/emission-common/emission-workflow-screens.json';
import {createContext,useContext} from 'react';
import {ALL_ROUTE_DEFINITIONS} from '../../app/routes/routeCatalog';
import './commonBreadcrumb.css';
export const BreadcrumbOwnerContext=createContext(false);
const areas:Record<string,{name:string;root?:string}>={emission:{name:'탄소배출 관리',root:'/emission/index'},lca:{name:'제품 LCA'},reduction:{name:'감축 관리'},monitoring:{name:'모니터링·분석'},co2:{name:'탄소·자원 거래'},trade:{name:'탄소·자원 거래'},education:{name:'교육·지원'},support:{name:'교육·지원'},mypage:{name:'마이페이지'},policy:{name:'이용 안내'},join:{name:'회원가입'},signin:{name:'로그인'},find:{name:'계정 찾기'}};
const aliases:Record<string,string>={
 '/emission/project_list':'배출량 프로젝트','/emission/project/create':'프로젝트 등록',
 '/emission/project/detail':'프로젝트 상세','/emission/result':'산정 결과',
 '/emission/calculation-results':'산정 결과','/emission/validate':'검증·보완',
 '/emission/correction':'활동자료 보완','/emission/data_input':'활동자료 입력',
 '/emission/external-data':'외부 데이터 연계'
};
export function CommonBreadcrumb(){
 const owned=useContext(BreadcrumbOwnerContext);
 const en=location.pathname.startsWith('/en/'),path=location.pathname.replace(/^\/en\//,'/').replace(/\/$/,''),q=new URLSearchParams(location.search),id=q.get('projectId')||q.get('id');
 const tab=q.get('tab'),definition=screens.find(s=>s.path===path+(tab&&['quality','submission'].includes(tab)?'?tab='+tab:''));
 const registered=ALL_ROUTE_DEFINITIONS.find(r=>r.koPath===path||r.enPath===location.pathname);
 const name=path==='/emission/index'?'배출량 현황':aliases[path]||definition?.name||registered?.label;
 if(owned||!name||path.startsWith('/admin')||path.startsWith('/projects/P006')||['','/home','/home/index'].includes(path))return null;
 const local=(url:string)=>(en?'/en':'')+url;
 const crumbs:{label:string;href?:string}[]=[{label:en?'Home':'홈',href:local('/home')}];
 const area=areas[path.split('/')[1]];
 if(area&&area.name!==name)crumbs.push({label:area.name,href:area.root?local(area.root):undefined});
 const projectPage=path!=='/emission/index'&&(Boolean(definition)||['/emission/project/create','/emission/project/detail','/emission/result','/emission/validate','/emission/calculation-results','/emission/correction','/emission/data_input'].includes(path));
 if(projectPage&&path!=='/emission/project_list')crumbs.push({label:en?'Emission projects':'배출량 프로젝트',href:local('/emission/project_list')});
 if(projectPage&&id&&!['/emission/project_list','/emission/project/detail','/emission/project/create'].includes(path))crumbs.push({label:en?'Project details':'프로젝트 상세',href:local('/emission/project/detail?projectId='+encodeURIComponent(id))});
 crumbs.push({label:name});
 return <nav className="ccus-common-breadcrumb" data-common-component="COMMON_BREADCRUMB" aria-label={en?'Breadcrumb':'현재 위치'}><ol>{crumbs.map((c,i)=><li key={i}>{i>0&&<span className="breadcrumb-separator" aria-hidden="true">›</span>}{c.href?<a href={c.href} aria-label={i===0?(en?'Home':'홈'):undefined}>{i===0?<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" focusable="false"><path d="M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9"/></svg><span className="breadcrumb-home-label">{c.label}</span></>:c.label}</a>:<span aria-current={i===crumbs.length-1?'page':undefined}>{c.label}</span>}</li>)}</ol></nav>;
}
