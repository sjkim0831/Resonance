import { findGeneratedScreen } from "../../generated/screen-generation/generatedScreenCatalog";
import { isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

function GeneratedContent() {
  const en = isEnglish();
  const screen = findGeneratedScreen(location.pathname);
  if (!screen) return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><h1 className="gov-text-heading-lg font-black">{en ? "Screen contract not found" : "화면 설계 계약을 찾을 수 없습니다."}</h1></main>;
  const scenarios = Array.isArray(screen.traceability.requiredScenarioTypes) ? screen.traceability.requiredScenarioTypes.map(String) : [];
  return <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="gov-text-label font-black text-[#246beb]">{screen.processCode} · {screen.stepCode}</p><h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">{screen.pageName}</h1><p className="gov-text-body mt-2 text-slate-600">{screen.actorCode} · {screen.screenType} · {screen.templateCode}</p></div><a className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] bg-white font-bold text-[#246beb]" href={en?"/en/emission/my-tasks":"/emission/my-tasks"}>{en?"Back to my tasks":"내 업무로 돌아가기"}</a></div>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[en?"Actor":"담당 액터",screen.actorCode],[en?"Process":"프로세스",screen.processCode],[en?"Screen type":"화면 유형",screen.screenType],[en?"Status":"설계 상태",en?"Generated contract":"생성 계약 적용"]].map(([label,value])=><article className="krds-component rounded-xl border bg-white" key={label}><span className="gov-text-label font-bold text-slate-500">{label}</span><strong className="gov-text-heading-sm mt-2 block text-[#052b57]">{value}</strong></article>)}</section>
    <section className="krds-component mt-6 rounded-xl border bg-white"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en?"Work area":"업무 처리 영역"}</h2><p className="gov-text-body mt-2 text-slate-600">{en?"This screen was generated from the approved actor, process step, design template, and test contract. Domain fields and actions are supplied by the corresponding development job.":"승인된 액터·프로세스 단계·디자인 템플릿·테스트 계약으로 생성된 화면입니다. 도메인 입력 항목과 실행 기능은 대응 개발 작업에서 연결됩니다."}</p><div className="mt-5 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-6"><p className="gov-text-label font-black text-blue-900">{screen.blueprintCode}</p><p className="gov-text-body-sm mt-2 text-blue-800">{screen.routePath}</p></div></section>
    <section className="krds-component mt-6 rounded-xl border bg-white"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en?"Acceptance scenarios":"필수 인수 시나리오"}</h2><div className="mt-4 flex flex-wrap gap-2">{scenarios.map(item=><span className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700" key={item}>{item}</span>)}</div></section>
  </main>;
}

export function GeneratedScreenPage() {
  const screen=findGeneratedScreen(location.pathname);
  if(screen?.audience==="ADMIN") return <AdminPageShell breadcrumbs={[{label:"시스템 관리",href:"/admin"},{label:"자동 생성 화면"}]} title={screen.pageName}><GeneratedContent/></AdminPageShell>;
  return <GeneratedContent/>;
}
