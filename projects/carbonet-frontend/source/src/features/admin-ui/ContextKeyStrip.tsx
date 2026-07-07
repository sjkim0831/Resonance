export type ContextKeyItem = {
  label: string;
  value: string;
};

type ContextKeyStripProps = {
  items: ContextKeyItem[];
  className?: string;
};

export function ContextKeyStrip({ items, className = "" }: ContextKeyStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Governed context keys"
      className={`mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] px-4 py-4 shadow-sm ${className}`.trim()}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3"
            key={`${item.label}-${item.value}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--kr-gov-text-secondary)]">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--kr-gov-text-primary)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
