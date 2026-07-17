import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = {
  actors: Row[];
  artifacts: Row[];
  cases: Row[];
  jobs: Row[];
  processes: Row[];
  steps: Row[];
  processCode: string;
  onProcessChange: (processCode: string) => void;
  onDirectDevelop: (processCode: string) => void;
  busy: boolean;
};

const text=(row:Row,key:string)=>String(row[key]??"");
const yes=(value:unknown)=>value===true||value==="true"||value==="Y";
const requiredJobTypes=(step:Row)=>[
  yes(step.requiresDatabase)&&"DATABASE",yes(step.requiresApi)&&"API",yes(step.requiresApi)&&"BACKEND",
  yes(step.requiresUserPage)&&"FRONTEND_USER",yes(step.requiresAdminPage)&&"FRONTEND_ADMIN","TEST","INTEGRATION",
].filter(Boolean) as string[];

function screenType(step:Row){
  const value=`${text(step,"stepCode")} ${text(step,"stepName")} ${text(step,"requirementText")}`.toUpperCase();
  if(/UPLOAD|업로드|수집/.test(value))return "업로드·오류 보정";
  if(/MAP|매핑/.test(value))return "데이터 매핑";
  if(/APPROV|승인|검토/.test(value))return "상세·검토·승인";
  if(/REPORT|보고서|인증서/.test(value))return "보고서·발행";
  if(/CALCUL|산정/.test(value))return "산정 작업공간";
  if(/DASH|현황|모니터/.test(value))return "대시보드";
  return yes(step.requiresUserPage)||yes(step.requiresAdminPage)?"업무 등록·상세":"자동 처리";
}

export function ProcessDesignMap(props:Props){
  const active=props.processCode||text(props.processes[0]||{},"processCode");
  const process=props.processes.find(row=>text(row,"processCode")===active)||{};
  const steps=useMemo(()=>props.steps.filter(row=>text(row,"processCode")===active).sort((a,b)=>Number(a.stepOrder)-Number(b.stepOrder)),[active,props.steps]);
  const [selected,setSelected]=useState("");
  const selectedStep=steps.find(row=>text(row,"stepCode")===(selected||text(steps[0]||{},"stepCode")))||{};
  const actor=props.actors.find(row=>text(row,"actorCode")===text(selectedStep,"actorCode"))||{};
  const processCases=props.cases.filter(row=>text(row,"processCode")===active);
  const safetyTypes=new Set(processCases.map(row=>text(row,"caseType")));
  const stepRows=steps.map(step=>{
    const code=text(step,"stepCode"), jobs=props.jobs.filter(row=>text(row,"processCode")===active&&text(row,"stepCode")===code);
    const required=requiredJobTypes(step), present=new Set(jobs.map(row=>text(row,"jobType")));
    const missing=required.filter(type=>!present.has(type));
    const contractMissing=[!text(step,"actorCode")&&"액터",!text(step,"fromState")&&"시작 상태",!text(step,"toState")&&"완료 상태",!text(step,"completionRule")&&"완료 조건",!text(step,"requirementText")&&"상세 설계"].filter(Boolean) as string[];
    const ready=missing.length===0&&contractMissing.length===0&&safetyTypes.size>=5;
    return {step,jobs,missing,contractMissing,ready};
  });
  const complete=stepRows.filter(row=>row.ready).length;
  const readiness=steps.length?Math.round(complete*100/steps.length):0;
  const selectedStatus=stepRows.find(row=>text(row.step,"stepCode")===text(selectedStep,"stepCode"));
  const routes=[text(selectedStep,"userPath"),text(selectedStep,"adminPath")].filter(Boolean);
  const selectedArtifacts=props.artifacts.filter(row=>text(row,"processCode")===active&&text(row,"stepCode")===text(selectedStep,"stepCode"));
  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black tracking-wider text-blue-700">CANONICAL PROCESS DESIGN</p><h2 className="mt-1 text-2xl font-black text-[#052b57]">액터·프로세스·Task·화면·개발·테스트 전체 설계도</h2><p className="mt-2 text-sm text-slate-600">공통 계약을 기준으로 누락을 먼저 차단한 뒤 변경된 설계만 개발 큐로 보냅니다.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><select className="h-11 min-w-72 rounded-lg border bg-white px-3 font-bold" value={active} onChange={event=>props.onProcessChange(event.target.value)}>{props.processes.map(row=><option key={text(row,"processCode")} value={text(row,"processCode")}>{text(row,"processName")} ({text(row,"processCode")})</option>)}</select><button className="h-11 rounded-lg bg-[#0f7b49] px-5 font-black text-white disabled:opacity-40" disabled={props.busy||readiness<100} onClick={()=>props.onDirectDevelop(active)}>설계부터 개발 큐까지 즉시 반영</button></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["설계 완성도",`${readiness}%`],["프로세스 단계",steps.length],["안전 테스트 유형",`${safetyTypes.size}/5`],["개발 가능 단계",`${complete}/${steps.length}`]].map(([label,value])=><div className="rounded-xl border bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{value}</strong></div>)}</div>
      {readiness<100&&<p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">누락이 있는 단계는 자동 개발이 차단됩니다. 빨간 단계를 선택해 상세 누락 항목을 보완하십시오.</p>}
    </section>

    <section className="rounded-2xl border bg-white p-4 lg:p-6">
      <div className="mb-4"><h3 className="font-black text-[#052b57]">{text(process,"processName")}</h3><p className="text-sm text-slate-600">{text(process,"goal")}</p></div>
      <div className="flex flex-col gap-3 overflow-x-auto pb-2 md:flex-row md:items-stretch">
        {stepRows.map((row,index)=>{const step=row.step,code=text(step,"stepCode"),isSelected=code===text(selectedStep,"stepCode");return <div className="contents" key={code}><button className={`min-w-64 rounded-xl border-2 p-4 text-left transition ${isSelected?"border-[#246beb] bg-blue-50":row.ready?"border-emerald-200 bg-emerald-50":"border-red-200 bg-red-50"}`} onClick={()=>setSelected(code)}><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{index+1}</span><span className={`text-xs font-black ${row.ready?"text-emerald-700":"text-red-700"}`}>{row.ready?"READY":"DESIGN GAP"}</span></div><strong className="mt-3 block text-base text-[#052b57]">{text(step,"stepName")}</strong><p className="mt-1 text-xs font-bold text-blue-700">{text(step,"actorCode")||"액터 미지정"}</p><p className="mt-3 text-xs text-slate-600">{text(step,"fromState")} → {text(step,"toState")}</p><div className="mt-3 flex flex-wrap gap-1">{[screenType(step),`${row.jobs.length} tasks`].map(tag=><span className="rounded bg-white px-2 py-1 text-[11px] font-bold" key={tag}>{tag}</span>)}</div></button>{index<stepRows.length-1&&<div className="flex items-center justify-center text-xl font-black text-slate-300 md:px-1">→</div>}</div>})}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <article className="rounded-2xl border bg-white p-5"><p className="text-xs font-black text-blue-700">SELECTED STEP</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{text(selectedStep,"stepName")||"단계를 선택하십시오"}</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{[["수행 액터",`${text(actor,"actorName")||"미지정"} (${text(selectedStep,"actorCode")||"-"})`],["화면 유형",screenType(selectedStep)],["명령",text(selectedStep,"commandCode")||"미지정"],["완료 조건",text(selectedStep,"completionRule")||"미지정"],["사용 화면",routes.join(" · ")||"화면 없음"],["API",text(selectedStep,"apiContract")||"API 없음"]].map(([label,value])=><div className="rounded-lg bg-slate-50 p-3" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p></div>)}</div><h4 className="mt-5 font-black text-[#052b57]">상세 요구사항</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{text(selectedStep,"requirementText")||"상세 요구사항이 없습니다."}</p></article>
      <article className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">개발·검증 계약</h3><div className="mt-4 space-y-3">{[["DB·API·백엔드·화면·테스트",selectedStatus?.missing.length?`누락: ${selectedStatus.missing.join(", ")}`:"작업 계약 연결"],["설계 필수 항목",selectedStatus?.contractMissing.length?`누락: ${selectedStatus.contractMissing.join(", ")}`:"필수 계약 완성"],["정상·예외·권한·격리·복구",safetyTypes.size>=5?"5종 테스트 연결":`테스트 유형 ${5-safetyTypes.size}개 부족`],["산출물",`${selectedArtifacts.length}개 · 검증 ${selectedArtifacts.filter(row=>text(row,"status")==="VERIFIED").length}개`]].map(([label,value])=><div className={`rounded-lg border p-3 ${String(value).includes("누락")||String(value).includes("부족")?"border-red-200 bg-red-50":"border-emerald-200 bg-emerald-50"}`} key={label}><span className="text-xs font-black text-slate-500">{label}</span><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>)}</div></article>
    </section>
  </div>;
}
