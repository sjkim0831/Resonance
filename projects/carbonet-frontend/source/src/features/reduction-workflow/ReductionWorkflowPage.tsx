import contract from "./reductionWorkflow.contract.json";
import { isEnglish } from "../../lib/navigation/runtime";

type Step = (typeof contract.steps)[number];

function currentStep(): Step {
  const path = window.location.pathname.replace(/^\/en(?=\/)/, "");
  return contract.steps.find(step => step.path === path) || contract.steps[0];
}

export function ReductionWorkflowPage() {
  const en = isEnglish();
  const step = currentStep();
  const previous = contract.steps[step.order - 2];
  const next = contract.steps[step.order];
  return <main className="min-h-screen bg-slate-50 text-slate-900" data-help-id={`reduction-${step.code.toLowerCase()}`} data-reduction-process={contract.processCode} data-reduction-step={step.code}>
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <p className="text-sm font-black text-[#246beb]">{contract.processName} · {step.order}/17</p>
        <h1 className="mt-2 text-3xl font-black text-[#052b57]">{step.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{step.inputs.join(" · ")}을 입력하고 {step.functions.join(" · ")}을 수행하여 {step.outputs.join(" · ")}을 생성합니다.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-800">계정 {step.account}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">액터 {step.actor}</span>
          {step.permissions.map(permission => <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-700" key={permission}>{permission}</span>)}
        </div>
      </div>
    </section>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="감축 관리 프로세스">
        <strong className="text-sm text-[#052b57]">17단계 업무 절차</strong>
        <ol className="mt-3 space-y-1">{contract.steps.map(item => <li key={item.code}><a aria-current={item.code === step.code ? "step" : undefined} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold ${item.code === step.code ? "bg-[#246beb] text-white" : "text-slate-600 hover:bg-slate-100"}`} href={en ? `/en${item.path}` : item.path}><span>{item.order}</span><span>{item.name}</span></a></li>)}</ol>
      </aside>
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3" data-workflow-section="INPUT_FUNCTION_OUTPUT">
          {[["입력값",step.inputs,"input"],["수행 기능",step.functions,"settings"],["출력값",step.outputs,"output"]].map(([title,items,icon]) => <article className="rounded-2xl border border-slate-200 bg-white p-5" key={String(title)}><span className="material-symbols-outlined text-[#246beb]">{String(icon)}</span><h2 className="mt-2 font-black text-[#052b57]">{String(title)}</h2><ul className="mt-3 space-y-2 text-sm text-slate-700">{(items as readonly string[]).map(item => <li className="rounded-lg bg-slate-50 px-3 py-2" key={item}>{item}</li>)}</ul></article>)}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5" data-workflow-section="AUTHORITY_QA">
          <h2 className="font-black text-[#052b57]">권한·QA 계약</h2>
          <p className="mt-2 text-sm text-slate-600">tenant · project · dataScope · actor · assignment · active period가 모두 일치해야 합니다.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">{contract.qaScenarios.map(item => <div className="rounded-lg border border-slate-200 p-3 text-center text-xs font-bold" key={item}>{item}</div>)}</div>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between" data-workflow-section="HANDOFF">
          <div><p className="text-xs font-black text-blue-700">다음 업무 인계</p><strong className="mt-1 block text-lg text-[#052b57]">{next ? `${next.name} · ${next.actor}` : "프로세스 완료"}</strong></div>
          <div className="flex gap-2">{previous ? <a className="rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-800" href={en ? `/en${previous.path}` : previous.path}>이전</a> : null}{next ? <a className="rounded-lg bg-[#246beb] px-4 py-3 text-sm font-black text-white" href={en ? `/en${next.path}` : next.path}>다음 단계</a> : <a className="rounded-lg bg-[#246beb] px-4 py-3 text-sm font-black text-white" href={en ? "/en/emission/my-tasks" : "/emission/my-tasks"}>전체 업무 보기</a>}</div>
        </section>
      </div>
    </div>
  </main>;
}

export default ReductionWorkflowPage;
