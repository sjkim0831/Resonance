import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = { base: string; processes: Row[] };
const value = (row: Row, key: string) => String(row[key] ?? "");

export function ScreenWorkflowTestPanel({ base, processes }: Props) {
  const [processCode, setProcessCode] = useState("");
  const [screens, setScreens] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>();
  const [detail, setDetail] = useState<Row>();
  const [result, setResult] = useState<Row>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!processCode && processes.length) setProcessCode(value(processes[0], "processCode"));
  }, [processCode, processes]);

  const loadScreens = useCallback(async () => {
    if (!processCode) return;
    setBusy(true); setError(""); setSelected(undefined); setDetail(undefined); setResult(undefined);
    try {
      const response = await fetch(`${base}/page-development-master?processCode=${encodeURIComponent(processCode)}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "화면 목록을 불러오지 못했습니다.");
      setScreens(Array.isArray(body.items) ? body.items : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [base, processCode]);
  useEffect(() => { void loadScreens(); }, [loadScreens]);

  async function selectScreen(row: Row) {
    setBusy(true); setError(""); setSelected(row); setResult(undefined);
    try {
      const response = await fetch(`${base}/page-development-master/${value(row, "itemId")}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "화면 계약을 불러오지 못했습니다.");
      setDetail(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  const bindings = useMemo(() => Array.isArray(detail?.bindings) ? detail.bindings as Row[] : [], [detail]);
  async function runTest() {
    const binding = bindings.find(row => value(row, "processCode") === processCode) ?? bindings[0];
    if (!selected || !binding) { setError("선택한 화면에 활성 프로세스·단계 연결이 없습니다."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/screen-workflow-test`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: Number(selected.itemId), processCode: value(binding, "processCode"), stepCode: value(binding, "stepCode") })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "결정론적 테스트에 실패했습니다.");
      setResult(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  const capabilities = Array.isArray(detail?.capabilities) ? detail.capabilities as Row[] : [];
  const fields = Array.isArray(detail?.fields) ? detail.fields as Row[] : [];
  const tests = Array.isArray(detail?.tests) ? detail.tests as Row[] : [];
  const checks = Array.isArray(result?.checks) ? result.checks as Row[] : [];

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <p className="text-xs font-black tracking-[0.12em] text-blue-700">AI-INDEPENDENT WORKFLOW GUIDE</p>
      <h2 className="mt-1 text-2xl font-black text-[#052b57]">화면별 업무·기능·필드·테스트</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">업무 프로세스와 화면을 선택하면 등록된 계약만으로 기능, 필드, 권한, 상태 전이와 5종 안전 테스트를 검사하고 증적을 저장합니다. 누락은 자동 추론하지 않고 차단합니다.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select className="h-11 min-w-72 rounded-lg border border-slate-300 bg-white px-3 text-sm" value={processCode} onChange={event => setProcessCode(event.target.value)}>
          {processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} · {value(row, "processCode")}</option>)}
        </select>
        <button className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700" disabled={busy} onClick={() => void loadScreens()} type="button">목록 새로고침</button>
      </div>
    </section>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,2.2fr)]">
      <section className="max-h-[720px] overflow-auto rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between px-2 py-2"><strong className="text-[#052b57]">연결 화면</strong><span className="text-sm text-slate-500">{screens.length}개</span></div>
        <div className="space-y-2">{screens.map(row => <button className={`w-full rounded-xl border p-3 text-left ${value(selected ?? {}, "itemId") === value(row, "itemId") ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`} key={value(row, "itemId")} onClick={() => void selectScreen(row)} type="button">
          <strong className="block text-sm text-[#052b57]">{value(row, "screenName")}</strong><span className="mt-1 block truncate text-xs text-slate-500">{value(row, "routePath")}</span><span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{value(row, "customerReadiness")}</span>
        </button>)}</div>
      </section>
      <section className="space-y-4">
        {!detail && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">왼쪽에서 화면을 선택하면 설계 계약과 테스트가 표시됩니다.</div>}
        {detail && <>
          <div className="rounded-2xl border bg-white p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="text-xl font-black text-[#052b57]">{value(selected ?? {}, "screenName")}</h3><a className="mt-1 block text-sm font-bold text-blue-700 hover:underline" href={value(selected ?? {}, "routePath")} target="_blank" rel="noreferrer">{value(selected ?? {}, "routePath")}</a></div><button className="min-h-11 rounded-lg bg-[#246beb] px-5 text-sm font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void runTest()} type="button">{busy ? "검사 중" : "AI 없이 전체 테스트"}</button></div></div>
          <MetricGrid values={[["프로세스·단계", bindings.length],["기능", capabilities.length],["필드", fields.length],["테스트", tests.length]]}/>
          <ContractTable title="프로세스·단계" heads={["프로세스","단계","액터","대상"]} rows={bindings.map(row => [value(row,"processName"),value(row,"stepName"),value(row,"actorName") || value(row,"actorCode"),value(row,"audience")])}/>
          <ContractTable title="화면 기능" heads={["코드","기능","유형","구현"]} rows={capabilities.map(row => [value(row,"capabilityCode"),value(row,"capabilityName"),value(row,"capabilityType"),value(row,"implementationStatus")])}/>
          <ContractTable title="필드·DB 계약" heads={["필드","필수","API","DB","계보"]} rows={fields.map(row => [value(row,"fieldName"),String(row.required === true ? "필수" : "선택"),value(row,"apiProperty"),`${value(row,"sourceTable")}.${value(row,"sourceColumn")}`,value(row,"lineageStatus")])}/>
          <ContractTable title="테스트 시나리오" heads={["유형","시나리오","상태"]} rows={tests.map(row => [value(row,"caseType"),value(row,"caseName"),value(row,"caseStatus")])}/>
          {result && <div className={`rounded-2xl border p-5 ${value(result,"result") === "PASSED" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><div className="flex items-center justify-between"><strong className="text-lg text-[#052b57]">결정론적 Closing 결과</strong><span className="rounded-full bg-white px-3 py-1 text-sm font-black">{value(result,"result")} · {value(result,"passedCheckCount")}/{value(result,"totalCheckCount")}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map(row => <div className="rounded-lg border bg-white p-3" key={value(row,"code")}><strong className={row.passed === true ? "text-emerald-700" : "text-red-700"}>{row.passed === true ? "통과" : "차단"} · {value(row,"name")}</strong><span className="mt-1 block text-xs text-slate-500">{value(row,"code")}</span></div>)}</div></div>}
        </>}
      </section>
    </div>
  </div>;
}

function MetricGrid({ values }: { values: [string, number][] }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, count]) => <article className="rounded-xl border bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{count}</strong></article>)}</div>; }
function ContractTable({ title, heads, rows }: { title: string; heads: string[]; rows: string[][] }) { return <div className="overflow-x-auto rounded-2xl border bg-white"><h3 className="border-b px-5 py-4 font-black text-[#052b57]">{title}</h3><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-slate-50"><tr>{heads.map(head => <th className="px-4 py-3 text-xs text-slate-600" key={head}>{head}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,index) => <tr className="border-t" key={index}>{row.map((cell,cellIndex) => <td className="px-4 py-3" key={cellIndex}>{cell || "-"}</td>)}</tr>) : <tr><td className="px-4 py-5 text-center text-slate-500" colSpan={heads.length}>등록된 항목이 없습니다.</td></tr>}</tbody></table></div>; }
