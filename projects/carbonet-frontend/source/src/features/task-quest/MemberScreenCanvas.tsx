import design from './member-screen-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const memberScreenGroups=design.groups;
export function MemberScreenCanvas({group}:{group:number}){
 const current=memberScreenGroups[group];if(!current)return null;
 return <ClassifiedWorkflowCanvas id={current.id} kind="member" title={current.name} flow={current.flow} pages={current.pages} next={memberScreenGroups[group+1]?.name}/>;
}
