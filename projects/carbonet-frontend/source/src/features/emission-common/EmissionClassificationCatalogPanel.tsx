function stringOf(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

type EmissionClassificationCatalogPanelProps = {
  catalog?: Record<string, unknown> | null;
  highlightedAlias?: string;
  highlightedCode?: string;
  title?: string;
};

export function EmissionClassificationCatalogPanel({
  catalog,
  highlightedAlias = "",
  highlightedCode = "",
  title
}: EmissionClassificationCatalogPanelProps) {
  const rows = Array.isArray(catalog?.rows) ? (catalog?.rows as Array<Record<string, unknown>>) : [];
  const summaryCards = Array.isArray(catalog?.summaryCards) ? (catalog?.summaryCards as Array<Record<string, unknown>>) : [];
  const catalogTitle = title || stringOf(catalog?.title) || "LCI DB 분류 체계";
  if (rows.length === 0) {
    return null;
  }
  const normalizedAlias = stringOf(highlightedAlias).trim().toUpperCase();
  const normalizedCode = stringOf(highlightedCode).trim();
  return (
    <section className="gov-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{catalogTitle}</p>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(catalog?.description)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {stringOf(catalog?.catalogSourceLabel) || stringOf(catalog?.catalogSource) || "-"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {summaryCards.map((card, index) => (
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${stringOf(card.title)}-${index}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(card.title)}</p>
            <p className="mt-2 text-xl font-black text-[var(--kr-gov-blue)]">{stringOf(card.value)}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(card.description)}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
            <tr>
              <th className="px-4 py-3">코드</th>
              <th className="px-4 py-3">대분류</th>
              <th className="px-4 py-3">중분류</th>
              <th className="px-4 py-3">소분류</th>
              <th className="px-4 py-3">Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const aliases = Array.isArray(row.aliases) ? (row.aliases as Array<unknown>).map((item) => stringOf(item).toUpperCase()) : [];
              const matched = (normalizedCode.length > 0 && normalizedCode === stringOf(row.code).trim())
                || (normalizedAlias.length > 0 && aliases.includes(normalizedAlias));
              return (
                <tr className={matched ? "bg-blue-50" : "border-t border-[var(--kr-gov-border-light)]"} key={stringOf(row.code)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{stringOf(row.code)}</td>
                  <td className="px-4 py-3">{stringOf(row.majorName) || "-"}</td>
                  <td className="px-4 py-3">{stringOf(row.middleName) || "-"}</td>
                  <td className="px-4 py-3">{stringOf(row.smallName) || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{stringOf(row.tierLabel) || "-"}</span>
                      {matched ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[var(--kr-gov-blue)]">현재 연계</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
