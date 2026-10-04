import design from './reduction-screen-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const reductionScreenGroups=design.groups;
export function ReductionScreenCanvas({code}:{code:string}){
 const index=design.groups.findIndex(g=>g.id===code),current=design.groups[index];if(!current)return null;
 return <ClassifiedWorkflowCanvas kind="reduction" id={current.id} title={current.name} flow={current.flow} pages={current.pages} next={design.groups[index+1]?.name}><details><summary>기존 실행 절차·QA 확인</summary><p>전용 메뉴는 업무 안내와 실행 원장 연결 화면입니다. 입력·저장·후속 인계는 미검증이며, 기존 단계 코드와 전용 화면의 매핑 불일치가 확인되었습니다. 아래 기존 실행 경로는 삭제하지 않았습니다.</p>{current.legacy.map(s=><p key={s.stepCode}><a href={s.path}>{s.name} · {s.stepCode}</a></p>)}<p><a href={design.related.path}>관련 업무: {design.related.name} ({design.related.owner})</a></p></details></ClassifiedWorkflowCanvas>;
}
