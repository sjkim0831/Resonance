
export function text(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function rowsOf(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? v as Array<Record<string, unknown>> : [];
}

export function badgeClass(value: unknown): string {
  const s = String(value || "").toUpperCase();
  if (s.includes("ACTIVE") || s.includes("RUNNING") || s.includes("SUCCESS") || s.includes("COMPLETED") || s.includes("OK") || s.includes("HEALTHY") || s.includes("PASS") || s.includes("HIGH") || s.includes("정상") || s === "Y") return "bg-emerald-100 text-emerald-700";
  if (s.includes("PENDING") || s.includes("READY") || s.includes("DRAINING") || s.includes("MEDIUM") || s.includes("WARN") || s.includes("경고")) return "bg-amber-100 text-amber-700";
  if (s.includes("FAIL") || s.includes("ERROR") || s.includes("CRITICAL") || s.includes("LOW") || s.includes("STOPPED") || s.includes("TIMEOUT") || s.includes("POOR")) return "bg-rose-100 text-rose-700";
  if (s.includes("INFO") || s.includes("INTERPRETED")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export function Badge({ value }: { value: unknown }) {
  return <span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-black " + badgeClass(value)}>{text(value)}</span>;
}

export function SimpleTable({ rows, columns, onRowClick }: { rows: Array<Record<string, unknown>>; columns: Array<{ key: string; label: string; badge?: boolean; wide?: boolean }>; onRowClick?: (row: Record<string, unknown>) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
        <thead className="bg-slate-50">
          <tr>{columns.map((c) => <th className={"px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)] " + (c.wide ? "min-w-[18rem]" : "")} key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
          {rows.length === 0 ? (
            <tr><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={columns.length}>No data</td></tr>
          ) : rows.map((row, index) => (
            <tr
              key={text(row.id) || text(row.name) || index}
              className={onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td className="max-w-2xl px-4 py-3 align-top" key={col.key}>
                  {col.badge ? <Badge value={row[col.key]} /> : <span className="break-words">{text(row[col.key])}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabBar({ tabs, active, setActive, extra }: { tabs: Array<{ key: string; label: string }>; active: string; setActive: (k: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button className={"gov-btn " + (active === t.key ? "gov-btn-primary" : "gov-btn-outline")} key={t.key} onClick={() => setActive(t.key)} type="button">{t.label}</button>
          ))}
        </div>
        {extra && <div className="ml-auto flex gap-2">{extra as React.ReactNode}</div>}
      </div>
    </div>
  );
}

export function SummaryCards({ cards }: { cards: Array<{ title: string; value: string; desc: string }> }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <div className="gov-card p-5" key={i}>
          <p className="text-sm text-[var(--kr-gov-text-secondary)]">{c.title}</p>
          <p className="mt-1 text-2xl font-black">{c.value}</p>
          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{c.desc}</p>
        </div>
      ))}
    </section>
  );
}