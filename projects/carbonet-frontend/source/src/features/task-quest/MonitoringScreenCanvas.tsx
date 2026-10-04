import design from './monitoring-screen-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const monitoringScreenGroups=design.groups;
export function MonitoringScreenCanvas({code}:{code:string}) {
 const g=design.groups.find(g=>g.id===code)||design.groups[0];
 return <ClassifiedWorkflowCanvas kind="monitoring" id={g.id} title={g.name} flow={g.flow} pages={g.pages} next="필요한 경보·규제·출력·공유·정기보고 업무 선택">
 <div data-monitoring-contract><p><strong>조건:</strong> {g.condition}</p><p><strong>입력:</strong> {g.input}</p><p><strong>출력:</strong> {g.output}</p><p>실행 프로세스: {g.code}. 화면 선택은 완료 표시가 아닙니다.</p>
 <details><summary>도움말·설계·QA 계약</summary>{design.limitations.map(x=><p key={x}>{x}</p>)}<p>QA: 동일 조회 범위·기준시각·버전 확인 → 원본 재조회 → 결과 비교 → 출력·공유 시 권한·파일·전송 기록 확인. 이 업무 릴레이는 미검증입니다.</p></details>
 <details><summary>기존 상태 계약</summary>{g.steps.map(s=><p key={s.stepCode}>{s.stepName}: {s.fromState} → {s.toState}<br/>{s.completionRule}</p>)}</details>
 <details><summary>기존 상위 프로세스 연결(기술 화면 포함)</summary>{design.related.map(s=><p key={s.stepCode}>{s.stepName}: <a href={s.adminPath}>{s.adminPath}</a></p>)}</details></div>
 </ClassifiedWorkflowCanvas>;
}
