import design from './lca-screen-design.json';
import { ClassifiedWorkflowCanvas } from './ClassifiedWorkflowCanvas';
export const lcaScreenGroups=design.groups;
export function LcaScreenCanvas({code}:{code:string}) {
 const group=design.groups.find(g=>g.id===code)||design.groups[0];
 const index=design.groups.indexOf(group);
 const next=index===7?'일반 수행 흐름 종료 · 필요한 경우에만 조건부 검증':index>=8?'적용 조건에 따라 목표·범위 또는 산정·보고 업무로 복귀':design.groups[index+1]?.name;
 return <ClassifiedWorkflowCanvas kind="lca" id={group.id} title={group.name} flow={group.flow} pages={group.pages} next={next}>
  <div data-lca-contract>
   <p><strong>적용 조건:</strong> {group.condition}</p>
   <p><strong>입력:</strong> {group.input}</p><p><strong>산출물:</strong> {group.output}</p>
   <p><strong>실행 원장 연결:</strong> {group.processCodes.join(', ')} · 탐색 순서 변경이며 DB 상태전이는 변경하지 않았습니다.</p>
   <p>홈·관리자는 역할별 진입점입니다. 업로드는 직접 입력의 대안이며, 반려·보완은 입력 또는 산정 단계로 돌아갑니다. 조건부 업무는 적용 여부를 확인합니다.</p>
   <p>PCR·비교주장 검토가 필요한 경우 목적·범위 설정 시 적용 기준을 먼저 확인하고, 결과 작성 후 검증합니다. 배경 DB 변경은 데이터 선택·매핑으로 돌아가는 별도 변경 흐름입니다. 9~11번을 보고서 발행 후 모두 수행하는 순서가 아닙니다.</p>
   <details className="mt-4"><summary>도움말 · 설계 · QA 검증 기준</summary>{design.limitations.map(x=><p key={x}>{x}</p>)}<p>QA: 프로젝트/메뉴 식별자 유지 → 입력 버전 확인 → 저장 후 재조회 → 최신 결과 검토 → 현재 승인 요청 확인 → 보고서 재조회. 이 릴레이는 아직 E2E 검증되지 않았습니다.</p></details>
   <details className="mt-4"><summary>기존 실행 절차와 상태 계약 ({design.legacyContracts.filter(s=>group.processCodes.includes(s.processCode)).length})</summary>{design.legacyContracts.filter(s=>group.processCodes.includes(s.processCode)).map(s=><p key={s.stepCode}>{s.stepName} · {s.fromState} → {s.toState}<br/>{s.completionRule}<br/><a href={s.adminPath}>기존 실행 절차 열기</a></p>)}</details>
   <details className="mt-4"><summary>대안 자동생성 경로 ({design.related.length}) · 기존 경로 보존</summary>{design.related.map(p=><p key={p.path}><a href={p.path}>{p.name} · {p.path}</a></p>)}</details>
  </div>
 </ClassifiedWorkflowCanvas>;
}
