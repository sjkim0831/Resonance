import design from './trade-screen-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const tradeScreenGroups=design.groups;
export function TradeScreenCanvas({code}:{code:string}) {
 const g=design.groups.find(g=>g.id===code)||design.groups[0];
 return <ClassifiedWorkflowCanvas kind="trade" id={g.id} title={g.name} flow={g.flow} pages={g.pages} next="동일 거래·계약 ID로 필요한 후속 업무 선택">
 <div data-trade-contract><p><strong>적용:</strong> {g.condition}</p><p><strong>입력:</strong> {g.input}</p><p><strong>출력:</strong> {g.output}</p><p>실행 원장: {g.code}. 조회·화면 선택은 완료 근거가 아닙니다.</p>
 <details><summary>도움말·설계·QA 계약</summary>{design.limitations.map(x=><p key={x}>{x}</p>)}<p>QA: 동일 거래/계약/요청 ID·버전 → 승인/반려 → 이행 확인 → 입금·정산 재조회. 취소·환불은 원 결제와 연결해 별도 검증. 실제 금전 처리·기관 발급은 이번 검사 범위가 아닙니다.</p></details>
 <details><summary>기존 상태 계약</summary>{g.steps.map(s=><p key={s.stepCode}>{s.stepName}: {s.fromState} → {s.toState}<br/>{s.completionRule}</p>)}</details>
 <details><summary>그 외 관련 화면</summary>{design.related.map(r=><p key={r.url}><a href={r.url}>{r.name}</a></p>)}</details></div>
 </ClassifiedWorkflowCanvas>;
}
