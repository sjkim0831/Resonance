import inventory from './emission-screen-classification.json';
import design from './emission-process-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const emissionScreenGroups=design.groups.slice(0,12).map(g=>g.name);
export function EmissionScreenCanvas({group}:{group:number}){
 const current=design.groups[group];if(!current)return null;
 return <ClassifiedWorkflowCanvas id={String(group)} kind="emission" title={current.name} flow={current.flow} next={design.groups[group+1]?.name} pages={current.paths.map(path=>({path,name:inventory.rows.find(r=>r.path===path)?.name||path,actor:path.startsWith('/admin/')?'관리자':'사용자'}))}><details><summary>관련 업무 참고 · 13개 화면</summary>{design.groups.slice(12).map(g=><div key={g.name}><h4 className="mt-3 font-bold">{g.name}</h4><p>{g.flow}</p>{g.paths.map(path=><p key={path}><a data-emission-related href={path}>{inventory.rows.find(r=>r.path===path)?.name||path}</a></p>)}</div>)}</details></ClassifiedWorkflowCanvas>;
}
