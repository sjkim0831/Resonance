type Row = Record<string, unknown>;

const text = (row: Row, key: string) => String(row[key] ?? "");
const number = (row: Row, key: string) => Number(row[key] ?? 0);

type Props = {
  busy: boolean;
  payload?: Row;
  onAudit: () => void;
};

export function ProcessClosingPanel({ busy, payload = {}, onAudit }: Props) {
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary as Row : {};
  const rows = Array.isArray(payload.rows) ? payload.rows as Row[] : [];
  const total = number(summary, "totalProcesses");
  const closed = number(summary, "closedProcesses");
  const percent = total ? Math.round((closed / total) * 100) : 0;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.12em] text-blue-700">PROCESS CLOSING GATE</p>
          <h2 className="mt-1 text-2xl font-black text-[#052b57]">프로세스 설계 Closing</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">액터, 상태 전이, 업무 규칙, 입출력 데이터, 화면 경로, API, 증적, 업무 순서와 안전 테스트 5종이 모두 일치할 때만 닫힙니다. 구현 증적은 다음 단계의 별도 게이트입니다.</p>
        </div>
        <button className="min-h-11 rounded-lg bg-[#246beb] px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={busy} onClick={onAudit} type="button">{busy ? "검사 중" : "전체 프로세스 재검사"}</button>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["전체 프로세스", total], ["전체 단계", number(summary, "totalSteps")],
        ["설계 Closing", closed], ["검토 필요", number(summary, "reviewRequiredProcesses")],
        ["차단", number(summary, "blockedProcesses")], ["구현 Closing", number(summary, "implementationClosedProcesses")]
      ].map(([label, metric]) => <article className="rounded-xl border bg-white p-4" key={String(label)}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{metric}</strong></article>)}
    </section>

    <section className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4"><strong className="text-[#052b57]">설계 Closing 진행률</strong><span className="text-lg font-black text-[#246beb]">{percent}%</span></div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#246beb]" style={{ width: `${percent}%` }} /></div>
      <p className="mt-3 text-sm text-slate-600">구조 차단 {number(summary, "structuralBlockers")}건 · 누락 경로 {number(summary, "missingRoutes")}건 · 검사 시각 {text(payload, "evaluatedAt") || "-"}</p>
    </section>

    <section className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-[1380px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-600"><tr>{["프로세스", "판정", "단계", "액터", "상태", "규칙", "데이터", "경로", "화면", "API", "증적", "순서", "안전 테스트", "구현 증적", "다음 작업"].map(head => <th className="border-b px-3 py-3" key={head}>{head}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr className="border-b last:border-b-0" key={text(row, "processCode")}>
          <td className="px-3 py-3"><strong className="block text-[#052b57]">{text(row, "processName")}</strong><span className="text-xs text-slate-500">{text(row, "processCode")}</span></td>
          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${text(row, "closingStatus") === "PROCESS_DESIGN_CLOSED" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{text(row, "closingStatus")}</span></td>
          {["stepCount", "actorGaps", "stateGaps", "businessRuleGaps", "dataContractGaps", "routeGaps", "screenContractGaps", "apiContractGaps", "evidenceGaps", "sequenceGaps"].map(key => <td className="px-3 py-3" key={key}>{text(row, key)}</td>)}
          <td className="px-3 py-3">{text(row, "approvedSafetyTestTypeCount")}/5</td>
          <td className="px-3 py-3">{text(row, "verifiedJobs")}/{text(row, "requiredJobs")}</td>
          <td className="px-3 py-3 font-bold text-slate-700">{text(row, "nextAction")}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
