import { useState, type ComponentProps } from "react";
import { WorkDesignViews, type WorkDesignView } from "./WorkDesignViews";
import { ProcessStructureEditor } from "./ProcessStructureEditor";
import { StepResourcesPanel } from "./StepResourcesPanel";

type Props = ComponentProps<typeof WorkDesignViews> & { onStructureSaved?:()=>Promise<unknown>;onPageSelected?:(route:string)=>void };
type Row = Record<string, unknown>;
const str = (r: Row | undefined, key: string) => { const raw = r?.[key] == null ? "" : String(r[key]); return key === 'actorCode' ? human(raw) : raw; };
const labels: Record<string,string> = { COMPANY_MANAGER:'기업 관리자',PUBLIC_APPLICANT:'가입 신청자',ADMIN:'관리자',SITE_DATA_OWNER:'사업장 자료 담당자',tenantId:'소속 기업',projectName:'프로젝트명',siteId:'사업장',periodStart:'시작일',periodEnd:'종료일',organizationBoundary:'조직 경계',methodologyCode:'산정 방법',companyManager:'기업 관리자',siteDataOwner:'자료 담당자',calculator:'산정 담당자',verifier:'검증 담당자',approver:'승인 담당자',projectId:'프로젝트 ID',boundarySnapshot:'경계 설정 기록',actorAssignments:'담당자 배정',dueDates:'업무 기한',workflowExecutionId:'업무 실행 ID',required:'필수',produces:'생성 결과',DRAFT:'작성 중',PLANNED:'계획 확정',CONFIRM_SCOPE:'범위 확정' };
const human = (value: string) => labels[value] || value;
const contract = (v: unknown): string => {
  if (!v) return "미정의";
  if (typeof v === "string") { try { return contract(JSON.parse(v)); } catch { return human(v); } }
  if (Array.isArray(v)) return v.map(contract).join(" · ");
  if (typeof v === "object") return Object.entries(v).map(([k,x]) => `${human(k)}: ${contract(x)}`).join("\n");
  return String(v);
};

export function StudioDesignViews(props: Props) {
  const [view, setView] = useState<WorkDesignView>("list");
  const selected = props.rows.find(r => str(r.process,"processCode") === props.selectedProcessCode && str(r.step,"stepCode") === props.selectedStepCode);
  const steps = props.rows.filter(r => str(r.process,"processCode") === props.selectedProcessCode);
  const types = [...new Map(props.rows.map(r => [str(r.type,"workTypeCode"),r.type])).values()];
  const step = selected?.step;
  const bindings = Array.isArray(step?.screenBindings) ? step.screenBindings as Row[] : [];
  const routes = bindings.filter((b,i,all) => str(b,"routePath").startsWith("/") && !str(b,"routePath").startsWith("//") && all.findIndex(x => str(x,"routePath") === str(b,"routePath")) === i);
  const missing = [!str(step,"actorCode") && "담당 역할", !step?.inputContract && "입력 계약", !step?.outputContract && "출력 계약", !step?.completionRule && "완료 조건", !routes.length && "화면 연결"].filter(Boolean);
  const change = (next: WorkDesignView) => { setView(next); props.onViewChange(next); };
  return <section className="studio-map" aria-label="업무 설계 지도">
    <nav className="studio-tabs" aria-label="작업실 보기">{([['list','설계 목록'],['flow','업무 흐름'],['screens','화면 지도'],['compare','변경 비교']] as const).map(([id,label]) => <button key={id} aria-pressed={view === id} onClick={() => change(id)}>{label}</button>)}</nav>
    {view !== "list" ? <div className="studio-alternate"><WorkDesignViews key={view} {...props} initialView={view} /></div> : <div className="studio-columns">
      <aside className="studio-tree" aria-label="업무 트리"><h2>업무 트리</h2>{types.map(type => {
        const code = str(type,"workTypeCode");
        const processes = [...new Map(props.rows.filter(r => str(r.type,"workTypeCode") === code).map(r => [str(r.process,"processCode"),r.process])).values()];
        return <details key={code} open={code === str(selected?.type,"workTypeCode")}><summary>{str(type,"workTypeName") || code}</summary>{processes.map(p => <button key={str(p,"processCode")} className={str(p,"processCode") === props.selectedProcessCode ? 'selected' : ''} onClick={() => props.onProcessSelect(str(p,"processCode"))}>{str(p,"processName") || str(p,"processCode")}</button>)}</details>;
      })}</aside>
      <div className="studio-center">
        <ProcessStructureEditor processCode={props.selectedProcessCode} stepCode={props.selectedStepCode} onSaved={props.onStructureSaved||(()=>Promise.resolve())}/>
        <StepResourcesPanel key={`${props.selectedProcessCode}:${props.selectedStepCode}`} processCode={props.selectedProcessCode} stepCode={props.selectedStepCode} bindings={bindings} onPageSelected={props.onPageSelected}/>
        <div className="studio-step-picker"><label>업무 단계<select aria-label="업무 단계 선택" value={props.selectedStepCode} onChange={e => props.onStepSelect(props.selectedProcessCode,e.target.value)}>{steps.map(r => <option key={str(r.step,"stepCode")} value={str(r.step,"stepCode")}>{str(r.step,"stepOrder")}. {str(r.step,"stepName")}</option>)}</select></label><span>설계 v{str(selected?.process,"processVersion") || "미확인"}</span></div>
        {step ? <article className="studio-card" aria-label="업무 단계 상세 정보">
          <header><span className="studio-symbol" aria-hidden="true">▤</span><div><p>{str(selected?.process,"processName")}</p><h2>{str(step,"stepName") || props.selectedStepCode}</h2></div></header>
          <div className="studio-badges"><span>설계: {str(step,"designStatus") || '확정 여부 미확인'}</span><span>구현: {str(step,"implementationStatus") || '미확인'}</span><span>검증: {str(step,"testStatus") || '미확인'}</span></div>
          <div className="studio-contracts"><dl><dt>담당 역할</dt><dd>{str(step,"actorCode") || '미정의'}</dd><dt>입력 항목</dt><dd>{contract(step.inputContract)}</dd><dt>출력·다음 업무 인계</dt><dd>{contract(step.outputContract)}</dd><dt>연결 화면</dt><dd>{routes.length ? routes.map(r => <a key={str(r,"routePath")} href={str(r,"routePath")}>{str(r,"screenName") || str(r,"routePath")} ↗</a>) : '화면 연결 미정의'}</dd></dl><section><h3>업무 완료 조건</h3><p>{str(step,"completionRule") || '완료 조건이 아직 정의되지 않았습니다.'}</p><h3>상태 전이</h3><p>{[str(step,"fromState"),str(step,"commandCode"),str(step,"toState")].filter(Boolean).join(' → ') || '미정의'}</p><h3>필수 기능</h3><p>{contract(step.requiredFeatures || step.features || step.apiContract)}</p></section></div>
          <div id="studio-primary-actions"><button className="studio-edit" onClick={() => props.onEdit(props.selectedProcessCode,props.selectedStepCode)}>✎ 설계 수정 · 공식 Revision 저장</button></div>
        </article> : <div className="studio-card">업무와 절차를 선택하세요.</div>}
        <section className="studio-issues" aria-label="이슈 현황"><h3>이슈 현황 <span>정의 확인 필요 {step ? missing.length : 0}건</span></h3><p>{step ? missing.length ? `${missing.join(' · ')} 항목의 근거를 확인해야 합니다.` : '필수 계약 필드가 있습니다. 실제 업무 검증 통과를 의미하지 않습니다.' : '선택한 업무가 없습니다.'}</p><a href="/admin/system/work-implementation">기존 전체 목록 관리 열기 ↗</a></section>
      </div>
    </div>}
  </section>;
}
