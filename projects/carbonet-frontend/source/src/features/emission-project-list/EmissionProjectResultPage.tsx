import { useEffect, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";

type Factor = {
  id: string;
  name: string;
  category: string;
  unit: string;
  value: number;
  source: string;
};
type SourceItem = {
  id: number;
  name: string;
  category: string;
  period: string;
  quantity: number;
  unit: string;
  note: string;
  submissionId: number;
  factorId?: string;
  factorName?: string;
  factorValue?: number;
  factorUnit?: string;
  factorSource?: string;
  mappingMethod?: string;
  confidence?: number;
  unitMatch?: boolean;
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
};
type ResultItem = {
  name: string;
  category: string;
  period: string;
  quantity: number;
  unit: string;
  factorId: string;
  factorName: string;
  factorUnit: string;
  factorSource: string;
  factorValue: number;
  emissionValue: number;
  formula: string;
};
type Run = {
  id: number;
  version: number;
  status: string;
  totalEmission: number;
  resultUnit: string;
  submissionIds: string;
  snapshotHash: string;
  methodology: string;
  calculatedBy: string;
  calculatedAt: string;
};
type Data = {
  project: { id: string; name: string; site: string; step?: string };
  activityCount: number;
  unmappedCount: number;
  incompatibleUnitCount: number;
  acceptedSubmissionCount: number;
  actorRoles: string[];
  factors: Factor[];
  sourceItems: SourceItem[];
  runs: Run[];
  items: ResultItem[];
};
type DiffItem = {
  activityId: number;
  name: string;
  category: string;
  previousQuantity?: number;
  currentQuantity?: number;
  previousFactorId?: string;
  currentFactorId?: string;
  previousFactorValue?: number;
  currentFactorValue?: number;
  previousEmission?: number;
  currentEmission?: number;
  emissionDelta: number;
  changeType: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
};
type CalculationDiff = {
  comparable: boolean;
  message?: string;
  current?: Run;
  previous?: Run;
  summary: { totalDelta?: number; percentDelta?: number | string; added?: number; removed?: number; changed?: number; unchanged?: number; itemCount?: number };
  items: DiffItem[];
};
type ResultLock = { lockId: number; submissionId: number; calculationId: number; version: number; totalEmission: number; resultUnit: string; snapshotHash: string; lockHash: string; status: string; lockedBy: string; lockedAt: string; integrity: string };
type ResultLockWorkflow = { projectId: string; approvedTarget?: { submissionId: number; calculationId: number; version: number; totalEmission: number; resultUnit: string; snapshotHash: string; status: string; approvedAt: string; approvedBy: string }; lock?: ResultLock; eligible: boolean; message: string };

function CalculationProjectSelector({ en }: { en: boolean }) {
  const [rows, setRows] = useState<Array<{id:string;name:string;site?:string;period?:string;periodStart?:string;periodEnd?:string;owner?:string}>>([]);
  const [query,setQuery] = useState(""), [keyword,setKeyword] = useState("");
  const [page,setPage] = useState(1), [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true), [error,setError] = useState(""), [retry,setRetry] = useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    const path=`/home/api/emission-projects?keyword=${encodeURIComponent(keyword)}&page=${page}&size=10`;
    void fetch(buildLocalizedPath(path,`/en${path}`),{credentials:"include",headers:{Accept:"application/json"},signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||(en?"Could not load projects.":"프로젝트를 불러오지 못했습니다."));return body;})
      .then(body=>{setRows(Array.isArray(body.items)?body.items:[]);setTotal(Number(body.total)||0);})
      .catch(reason=>{if(!controller.signal.aborted){setRows([]);setError(reason instanceof Error?reason.message:String(reason));}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[keyword,page,retry,en]);
  function target(id:string){const params=new URLSearchParams(location.search);params.set("projectId",id);return `${location.pathname}?${params}`;}
  return <CommonPageContainer>
    <header className="py-6"><h1 className="text-3xl font-black text-[#052b57]">{en?"Emission calculation":"배출량 산정"}</h1><p className="mt-2 text-slate-600">{en?"Select a project to review accepted activity data, assign emission factors, and create a calculation version.":"프로젝트를 선택하고 접수된 활동자료와 배출계수를 확인한 뒤 산정 버전을 생성합니다."}</p></header>
    <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-5" onSubmit={event=>{event.preventDefault();setPage(1);setKeyword(query.trim());setRetry(value=>value+1);}}><label className="min-w-0 flex-1 font-bold">{en?"Project search":"프로젝트 검색"}<input className="mt-2 h-11 w-full rounded border border-slate-300 px-3 font-normal" value={query} onChange={event=>setQuery(event.target.value)} placeholder={en?"Project, site, or owner":"프로젝트명·사업장·담당자"}/></label><button className="min-h-11 rounded bg-[#003675] px-5 font-bold text-white" disabled={loading}>{en?"Search":"조회"}</button></form>
    <section className="mt-5 overflow-hidden rounded-lg border bg-white" aria-busy={loading}>
      <h2 className="border-b p-4 text-lg font-bold">{en?"Select project":"산정할 프로젝트 선택"}</h2>
      {error?<div role="alert" className="p-5 text-red-700">{error}<button className="ml-3 underline" onClick={()=>setRetry(value=>value+1)}>{en?"Retry":"다시 조회"}</button></div>:loading?<p role="status" className="p-8 text-center">{en?"Loading projects…":"프로젝트를 불러오는 중입니다."}</p>:<>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en?["Project","Site","Period","Action"]:["프로젝트","사업장","산정 기간","업무"]).map(label=><th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-4"><strong>{row.name}</strong><small className="block text-slate-500">{row.id}</small></td><td className="p-4">{row.site||"—"}</td><td className="p-4">{row.period||(row.periodStart&&row.periodEnd?`${row.periodStart} ~ ${row.periodEnd}`:"—")}</td><td className="p-4"><a className="inline-flex min-h-11 items-center rounded border border-blue-800 px-4 font-bold text-blue-900" href={target(row.id)}>{en?"Open calculation":"산정 자료 확인"}</a></td></tr>)}{!rows.length&&<tr><td colSpan={4} className="p-8 text-center">{en?"No matching accessible projects.":"조회 조건에 맞는 접근 가능한 프로젝트가 없습니다."}</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-center gap-4 border-t p-4"><button disabled={page===1} className="rounded border px-4 py-2 disabled:opacity-40" onClick={()=>setPage(value=>value-1)}>{en?"Previous":"이전"}</button><span>{page} / {Math.max(1,Math.ceil(total/10))}</span><button disabled={page*10>=total} className="rounded border px-4 py-2 disabled:opacity-40" onClick={()=>setPage(value=>value+1)}>{en?"Next":"다음"}</button></div>
      </>}
    </section>
  </CommonPageContainer>;
}

export function EmissionProjectResultPage() {
  const en = isEnglish(),
    params = new URLSearchParams(location.search),
    id = params.get("projectId") || "",
    lockMode = params.get("mode") === "lock";
  const [data, setData] = useState<Data | null>(null),
    [diff, setDiff] = useState<CalculationDiff | null>(null),
    [lock, setLock] = useState<ResultLockWorkflow | null>(null),
    [lockAudit, setLockAudit] = useState<ResultLock[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mappingId, setMappingId] = useState<number | null>(null);
  const api = buildLocalizedPath(
      `/home/api/emission-projects/${encodeURIComponent(id)}/calculation`,
      `/en/home/api/emission-projects/${encodeURIComponent(id)}/calculation`,
    ),
    activityApi = buildLocalizedPath(
      `/home/api/emission-projects/${id}/activities`,
      `/en/home/api/emission-projects/${id}/activities`,
    ),
    diffApi = buildLocalizedPath(
      `/home/api/emission-projects/${id}/calculation/diff`,
      `/en/home/api/emission-projects/${id}/calculation/diff`,
    ),
    lockApi = buildLocalizedPath(`/home/api/emission-projects/${id}/result-lock`, `/en/home/api/emission-projects/${id}/result-lock`),
    lockAuditApi = `${lockApi}/audit`;
  async function request(url: string, init?: RequestInit) {
    const r = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        ...init,
      }),
      b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.message || "요청 처리에 실패했습니다.");
    return b;
  }
  async function load() {
    setError("");
    try {
      setData(await request(api));
      try { setDiff(await request(diffApi)); } catch { setDiff(null); }
      if (lockMode) {
        setLock(await request(lockApi));
        const audit = await request(lockAuditApi);
        setLockAudit(audit.items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    if (id) void load();
  }, [id]);
  const canCalculate = data?.actorRoles?.includes("CALCULATOR"),
    latest = data?.runs?.[0],
    ready =
      !!data?.activityCount &&
      !data?.unmappedCount &&
      !data?.incompatibleUnitCount;
  async function map(item: SourceItem, factorId: string) {
    setMappingId(item.id);
    setMessage("");
    setError("");
    try {
      await request(`${activityApi}/${item.id}/factor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorId,
          reason:
            "산정 워크스페이스에서 접수 제출본과 단위를 확인한 후 직접 선택",
        }),
      });
      setMessage(
        en
          ? "Factor decision saved with audit evidence."
          : "배출계수 결정과 근거 이력을 저장했습니다.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMappingId(null);
    }
  }
  async function autoMap() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const b = await request(`${activityApi}/auto-map`, { method: "POST" });
      setMessage(
        en
          ? `${b.count} new rows mapped. Review low-confidence or unit-mismatch rows.`
          : `신규 ${b.count}건을 자동 매핑했습니다. 낮은 신뢰도와 단위 불일치 행을 검토하세요.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function calculate() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await request(api, { method: "POST" });
      setMessage(
        en
          ? "Immutable calculation version created and validation task opened."
          : "불변 산정 버전을 생성하고 검증 업무를 열었습니다.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function lockApprovedResult() {
    if (!lock?.approvedTarget) return;
    setBusy(true);setError("");setMessage("");
    try {
      await request(lockApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({submissionId:lock.approvedTarget.submissionId,calculationId:lock.approvedTarget.calculationId,idempotencyKey:`RESULT-LOCK-${id}-${lock.approvedTarget.calculationId}`})});
      setMessage(en?"Approved result locked immutably.":"승인 결과를 불변 잠금했습니다.");await load();
    } catch(e) { setError(e instanceof Error?e.message:String(e)); } finally { setBusy(false); }
  }
  if (!id) return <CalculationProjectSelector en={en}/>;
  if (!data) return <CommonPageContainer><h1 className="mt-6 text-3xl font-black">{en?"Emission calculation":"배출량 산정"}</h1>{error?<div role="alert" className="my-6 rounded border border-red-300 p-5 text-red-800">{error}<button className="ml-3 underline" onClick={()=>void load()}>{en?"Retry":"다시 조회"}</button></div>:<p role="status" className="py-8">{en?"Loading calculation data…":"산정 자료를 불러오는 중입니다."}</p>}<a className="text-blue-800 underline" href={location.pathname}>{en?"Select another project":"다른 프로젝트 선택"}</a></CommonPageContainer>;
  return (
    <CommonPageContainer className="min-w-0 overflow-x-hidden">

        <div className="mt-4 flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="font-bold text-blue-700">{data.project.name} · {data.project.site}</p>
            <a className="text-sm text-blue-800 underline" href={location.pathname}>{en?"Change project":"프로젝트 변경"}</a>
            <a className="ml-4 text-sm font-bold text-blue-800 underline" href={buildLocalizedPath(`/home/emission/factor-reference?projectId=${encodeURIComponent(id)}`, `/en/home/emission/factor-reference?projectId=${encodeURIComponent(id)}`)}>{en?"Review methodology and factors":"산정 기준·배출계수 확인"} →</a>
            <h1 className="text-3xl font-black text-[#052b57]">
              {en
                ? "Emission calculation"
                : "배출량 산정"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {en
                ? "Only manager-accepted submission snapshots are mapped and calculated. Every factor decision and calculation version remains auditable."
                : "접수된 활동자료의 배출계수와 단위를 확인하고 산정을 실행하세요."}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <button
              className="min-h-12 w-full rounded-lg border border-blue-700 bg-white px-5 font-black text-blue-800 disabled:opacity-40 sm:w-auto"
              disabled={busy || mappingId !== null || !canCalculate || !data?.activityCount}
              onClick={autoMap}
            >
              {en ? "Auto-map accepted rows" : "접수 자료 자동 매핑"}
            </button>
            <button
              className="min-h-12 w-full rounded-lg bg-[#246beb] px-6 font-black text-white disabled:opacity-40 sm:w-auto"
              disabled={busy || mappingId !== null || !canCalculate || !ready}
              onClick={calculate}
            >
              {busy
                ? en
                  ? "Processing..."
                  : "처리 중..."
                : en
                  ? "Create calculation version"
                  : "산정 버전 생성"}
            </button>
          </div>
        </div>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={en?"Selected project readiness":"선택 프로젝트 준비 상태"}>
          {[[en?"Accepted submissions":"접수 제출본",data.acceptedSubmissionCount],[en?"Activity rows":"활동자료 행",data.activityCount],[en?"Unmapped rows":"미매핑 행",data.unmappedCount],[en?"Unit mismatches":"단위 불일치",data.incompatibleUnitCount]].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-white p-4"><span className="block text-sm text-slate-600">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{value}</strong></div>)}
        </section>
        {error && (
          <div
            className="mt-5 rounded-lg border border-red-300 bg-red-50 p-4 font-bold text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            className="mt-5 rounded-lg border border-blue-300 bg-blue-50 p-4 font-bold text-blue-800"
            role="status"
          >
            {message}
          </div>
        )}
        {lockMode && <section className="mt-5 overflow-hidden rounded-xl border border-blue-300 bg-white" data-testid="result-lock-contract">
          <div className="flex flex-col justify-between gap-4 border-b bg-blue-50 p-5 sm:flex-row sm:items-center">
            <div><p className="text-sm font-black text-blue-700">LOCK_RESULT · APPROVER</p><h2 className="text-2xl font-black text-[#052b57]">{en?"Immutable Approved Result Lock":"승인 결과 불변 잠금"}</h2><p className="mt-1 text-sm text-slate-600">{lock?.message}</p></div>
            <button className="min-h-12 rounded-lg bg-[#246beb] px-6 font-black text-white disabled:bg-slate-300" disabled={busy||!lock?.eligible} onClick={lockApprovedResult}>{lock?.lock?(en?"LOCKED":"잠금 완료"):(en?"Lock approved result":"승인 결과 잠금")}</button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[[en?"Calculation version":"산정 버전",lock?.lock?.version??lock?.approvedTarget?.version??"-"],[en?"Total emission":"총 배출량",lock?.lock?.totalEmission??lock?.approvedTarget?.totalEmission??"-"],[en?"Lock integrity":"잠금 무결성",lock?.lock?.integrity??(lock?.eligible?"READY":"-")],[en?"Locked by":"잠금 담당자",lock?.lock?.lockedBy??"-"]].map(([label,value])=><div className="rounded-lg bg-slate-50 p-4" key={String(label)}><p className="text-xs font-bold text-slate-500">{label}</p><strong className="mt-1 block break-all text-[#052b57]">{value}</strong></div>)}
          </div>
          {lock?.lock?.lockHash&&<div className="mx-5 mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">SHA-256 RESULT LOCK HASH</p><code className="mt-1 block break-all font-bold text-emerald-950">{lock.lock.lockHash}</code></div>}
          <div className="border-t p-5"><h3 className="font-black text-[#052b57]">{en?"Lock audit ledger":"결과 잠금 감사 원장"}</h3>{lockAudit.length===0?<p className="mt-2 text-sm text-slate-500">{en?"No lock event yet.":"아직 잠금 이력이 없습니다."}</p>:lockAudit.map(row=><div className="mt-3 grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4" key={row.lockId}><strong>#{row.lockId} · v{row.version}</strong><span>{row.lockedBy}</span><span>{row.lockedAt}</span><strong className={row.integrity==="VERIFIED"?"text-emerald-700":"text-red-700"}>{row.integrity}</strong></div>)}</div>
        </section>}
        {!data?.acceptedSubmissionCount && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <strong>
              {en ? "Calculation is waiting for accepted activity data" : "산정 준비 상태: 접수된 활동자료를 기다리고 있습니다."}
            </strong>
            <p className="mt-1 text-sm">
              {en
                ? "Enter activity data and evidence, submit it, then have the responsible manager accept it. The calculation table remains available below."
                : "현재 선택 프로젝트의 접수 제출본과 활동자료 건수를 위에서 확인할 수 있습니다. 활동자료 입력 → 자료 제출 → 담당자 접수 후 아래 표에서 계수를 확인하고 산정하세요."}
            </p>
            <a
              className="mt-3 inline-block font-bold text-blue-700 underline"
              href={buildLocalizedPath(
                `/emission/data-request?projectId=${id}`,
                `/en/emission/data-request?projectId=${id}`,
              )}
            >
              {en ? "Open request acceptance" : "자료 제출·접수 확인"}
            </a>
            <a className="ml-5 inline-block font-bold text-blue-700 underline" href={buildLocalizedPath(`/emission/activity-data?projectId=${encodeURIComponent(id)}`,`/en/emission/activity-data?projectId=${encodeURIComponent(id)}`)}>{en?"Open activity data":"활동자료 입력"}</a>
          </div>
        )}
        <section className="mt-5 overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row">
            <div>
              <h2 className="text-xl font-black text-[#052b57]">
                {en
                  ? "1. Accepted Input & Factor Decisions"
                  : "1. 접수 입력·배출계수 결정"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {en
                  ? "Confirm source, unit compatibility, confidence, and formula preview for every row."
                  : "각 행의 출처, 단위 호환성, 신뢰도와 계산식 미리보기를 확인합니다."}
              </p>
            </div>
            <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">
              {ready
                ? en
                  ? "READY"
                  : "산정 가능"
                : en
                  ? "ACTION REQUIRED"
                  : "조치 필요"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {(en
                    ? [
                        "Accepted activity",
                        "Quantity",
                        "Evidence",
                        "Factor decision",
                        "Source / Unit",
                        "Confidence",
                        "Formula preview",
                      ]
                    : [
                        "접수 활동자료",
                        "활동량",
                        "증빙",
                        "배출계수 결정",
                        "출처·단위",
                        "신뢰도",
                        "계산식 미리보기",
                      ]
                  ).map((x) => (
                    <th className="p-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.sourceItems.map((row) => (
                  <tr className="border-b align-top" key={row.id}>
                    <td className="p-3">
                      <strong>{row.name}</strong>
                      <small className="mt-1 block text-slate-500">
                        {row.category} · {row.period} · 제출 #{row.submissionId}
                      </small>
                    </td>
                    <td className="p-3 font-bold">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="max-w-52 p-3 text-slate-600">{row.note}</td>
                    <td className="p-3">
                      <select
                        aria-label={`${row.name} 배출계수`}
                        className="h-11 min-w-72 rounded-lg border px-2"
                        disabled={busy || !canCalculate || mappingId !== null}
                        value={row.factorId || ""}
                        onChange={(e) =>
                          e.target.value && map(row, e.target.value)
                        }
                      >
                        <option value="">
                          {en ? "Select factor" : "배출계수 선택"}
                        </option>
                        {data.factors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} · {f.value}/{f.unit}
                          </option>
                        ))}
                      </select>
                      {row.decisionReason && (
                        <small className="mt-1 block max-w-72 text-slate-500">
                          {row.mappingMethod} · {row.decidedBy} ·{" "}
                          {row.decisionReason}
                        </small>
                      )}
                    </td>
                    <td className="p-3">
                      <strong>{row.factorSource || "-"}</strong>
                      <small
                        className={`mt-1 block font-bold ${row.unitMatch === false ? "text-red-700" : "text-green-700"}`}
                      >
                        {row.factorUnit
                          ? `${row.unit} → ${row.factorUnit} ${row.unitMatch === false ? "불일치" : "일치"}`
                          : "-"}
                      </small>
                    </td>
                    <td className="p-3">
                      {row.confidence != null
                        ? `${Math.round(Number(row.confidence) * 100)}%`
                        : "-"}
                    </td>
                    <td className="p-3 font-mono">
                      {row.factorValue != null
                        ? `${row.quantity} × ${row.factorValue} = ${(Number(row.quantity) * Number(row.factorValue)).toFixed(8)} tCO₂e`
                        : "-"}
                    </td>
                  </tr>
                ))}
                {!data?.sourceItems.length && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500">
                      {en
                        ? "No accepted activity rows."
                        : "접수된 산정 대상 자료가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {latest && <section className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 overflow-hidden rounded-xl border bg-white">
            <div className="border-b p-5">
              <h2 className="text-xl font-black text-[#052b57]">
                {en ? "2. Latest Calculation Detail" : "2. 최신 산정 상세"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {latest
                  ? `v${latest.version} · ${latest.calculatedBy} · ${latest.calculatedAt}`
                  : en
                    ? "Create a version after all factors are confirmed."
                    : "모든 계수를 확정한 뒤 산정 버전을 생성하세요."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {(en
                      ? [
                          "Activity",
                          "Quantity",
                          "Factor evidence",
                          "Formula",
                          "Emission",
                        ]
                      : ["활동자료", "활동량", "계수 근거", "계산식", "배출량"]
                    ).map((x) => (
                      <th className="p-3" key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((x, i) => (
                    <tr className="border-b" key={`${x.name}-${i}`}>
                      <td className="p-3 font-bold">
                        {x.name}
                        <small className="block text-slate-500">
                          {x.category} · {x.period}
                        </small>
                      </td>
                      <td className="p-3">
                        {x.quantity} {x.unit}
                      </td>
                      <td className="p-3">
                        {x.factorName}
                        <small className="block text-slate-500">
                          {x.factorSource} · {x.factorValue}/{x.factorUnit}
                        </small>
                      </td>
                      <td className="p-3 font-mono">{x.formula}</td>
                      <td className="p-3 font-black">
                        {Number(x.emissionValue).toFixed(8)} tCO₂e
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td
                        className="p-10 text-center text-slate-500"
                        colSpan={5}
                      >
                        {en
                          ? "No calculation version yet."
                          : "생성된 산정 버전이 없습니다."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="rounded-xl bg-[#052b57] p-6 text-white">
            <p className="text-sm font-bold text-blue-200">
              {en ? "LATEST IMMUTABLE VERSION" : "최신 불변 산정 버전"}
            </p>
            <strong className="mt-3 block text-3xl">
              {latest
                ? `${Number(latest.totalEmission).toFixed(6)} ${latest.resultUnit}`
                : "-"}
            </strong>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-blue-200">
                  {en ? "Methodology" : "방법론"}
                </dt>
                <dd className="mt-1 font-bold">
                  {latest?.methodology || "ACTIVITY_X_FACTOR"}
                </dd>
              </div>
              <div>
                <dt className="text-blue-200">
                  {en ? "Accepted submissions" : "접수 제출본"}
                </dt>
                <dd className="mt-1 font-bold">
                  {latest?.submissionIds || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-blue-200">
                  {en ? "Input fingerprint" : "입력 지문"}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {latest?.snapshotHash || "-"}
                </dd>
              </div>
            </dl>
            {latest && (
              <a
                className="mt-6 block rounded-lg bg-white px-4 py-3 text-center font-black text-[#052b57]"
                href={buildLocalizedPath(
                  `/emission/validate?projectId=${id}&calculationId=${latest.id}`,
                  `/en/emission/validate?projectId=${id}&calculationId=${latest.id}`,
                )}
              >
                {en ? "Continue to validation" : "검증 업무로 이동"}
              </a>
            )}
          </aside>
        </section>}
        {diff?.comparable && <details className="mt-5 overflow-hidden rounded-xl border bg-white" data-testid="recalculation-diff"><summary className="cursor-pointer p-5 font-bold">산정 버전 비교</summary>
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black text-[#052b57]">{en ? "Recalculation Version Difference" : "재산정 버전 차이"}</h2>
              <p className="mt-1 text-sm text-slate-600">{en ? "Compares the latest two immutable calculation versions by activity ID." : "최근 불변 산정 버전 2개를 활동자료 ID 기준으로 비교합니다."}</p>
            </div>
            <span className={`self-start rounded-full px-3 py-1 text-sm font-black ${diff?.comparable ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
              {diff?.comparable ? `${en ? "v" : "버전 "}${diff.previous?.version} → ${en ? "v" : "버전 "}${diff.current?.version}` : (en ? "Needs two versions" : "버전 2개 필요")}
            </span>
          </div>
          {!diff?.comparable ? (
            <p className="p-5 text-sm font-bold text-amber-800">{diff?.message || (en ? "Only calculators can view recalculation differences." : "재산정 차이는 산정 담당자만 조회할 수 있습니다.")}</p>
          ) : (
            <>
              <div className="grid gap-3 border-b p-5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [en ? "Previous total" : "이전 총량", Number(diff.previous?.totalEmission || 0).toFixed(6)],
                  [en ? "Current total" : "현재 총량", Number(diff.current?.totalEmission || 0).toFixed(6)],
                  [en ? "Total delta" : "총량 증감", Number(diff.summary.totalDelta || 0).toFixed(6)],
                  [en ? "Changed" : "변경", diff.summary.changed || 0],
                  [en ? "Added" : "추가", diff.summary.added || 0],
                  [en ? "Removed" : "삭제", diff.summary.removed || 0],
                ].map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={String(label)}><p className="text-xs font-bold text-slate-500">{label}</p><strong className="mt-1 block text-lg text-[#052b57]">{value}</strong></div>)}
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100"><tr>{(en ? ["Change","Activity","Previous qty","Current qty","Previous factor","Current factor","Previous emission","Current emission","Delta"] : ["변경","활동자료","이전 활동량","현재 활동량","이전 계수","현재 계수","이전 배출량","현재 배출량","증감"]).map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead>
                  <tbody>{diff.items.filter(row=>row.changeType!=="UNCHANGED").map(row=><tr className="border-t" key={row.activityId}><td className="p-3 font-black text-blue-800">{row.changeType}</td><td className="p-3"><strong>{row.name}</strong><small className="block text-slate-500">{row.category}</small></td><td className="p-3">{row.previousQuantity ?? "-"}</td><td className="p-3">{row.currentQuantity ?? "-"}</td><td className="p-3">{row.previousFactorId || "-"}<small className="block">{row.previousFactorValue ?? "-"}</small></td><td className="p-3">{row.currentFactorId || "-"}<small className="block">{row.currentFactorValue ?? "-"}</small></td><td className="p-3">{row.previousEmission ?? "-"}</td><td className="p-3">{row.currentEmission ?? "-"}</td><td className="p-3 font-black">{Number(row.emissionDelta || 0).toFixed(6)}</td></tr>)}</tbody>
                </table>
                {!diff.items.some(row=>row.changeType!=="UNCHANGED") && <p className="p-5 text-center font-bold text-emerald-700">{en ? "No value changed between the two versions." : "두 버전 사이에 변경된 값이 없습니다."}</p>}
              </div>
            </>
          )}
        </details>}
        {!!data.runs.length && <details className="mt-5 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-bold">산정 이력 보기 ({data.runs.length}건)</summary>
          <h2 className="text-xl font-black text-[#052b57]">
            {en ? "3. Version History" : "3. 산정 버전 이력"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.runs.map((run) => (
              <article className="rounded-lg border p-4" key={run.id}>
                <div className="flex justify-between">
                  <strong>v{run.version}</strong>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
                    {run.status}
                  </span>
                </div>
                <p className="mt-2 text-xl font-black">
                  {Number(run.totalEmission).toFixed(6)} {run.resultUnit}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {run.calculatedBy} · {run.calculatedAt}
                </p>
                <code className="mt-2 block truncate text-xs text-slate-400">
                  {run.snapshotHash}
                </code>
              </article>
            ))}
          </div>
        </details>}
    </CommonPageContainer>
  );
}
