import type { ChangeEvent, ReactNode } from "react";
import type { ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { AdminInput, CollectionResultPanel, KeyValueGridPanel, SummaryMetricCard } from "../admin-ui/common";

type SummaryMetricItem = {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  accentClassName?: string;
  surfaceClassName?: string;
  dataHelpId?: string;
};

type CatalogListItem = {
  key: string;
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  active?: boolean;
  onSelect: () => void;
};

type SelectionOverviewItem = {
  label: ReactNode;
  value: ReactNode;
};

export function createEmptyScreenCommandPagePayload(): ScreenCommandPagePayload {
  return {
    selectedPageId: "",
    pages: [],
    page: {
      pageId: "",
      label: "",
      routePath: "",
      menuCode: "",
      domainCode: "",
      summary: "",
      source: "",
      menuLookupUrl: "",
      summaryMetrics: {
        surfaceCount: 0,
        eventCount: 0,
        apiCount: 0,
        schemaCount: 0,
        changeTargetCount: 0,
        featureCount: 0,
        relationTableCount: 0,
        componentCount: 0
      },
      surfaces: [],
      events: [],
      apis: [],
      schemas: [],
      commonCodeGroups: [],
      menuPermission: {
        menuCode: "",
        menuLookupUrl: "",
        routePath: "",
        requiredViewFeatureCode: "",
        featureCodes: [],
        featureRows: [],
        relationTables: [],
        resolverNotes: []
      },
      changeTargets: []
    }
  };
}

export function resolveScreenCommandSummaryMetrics(page?: ScreenCommandPagePayload["page"]) {
  return {
    surfaceCount: page?.summaryMetrics?.surfaceCount ?? page?.surfaces?.length ?? 0,
    eventCount: page?.summaryMetrics?.eventCount ?? page?.events?.length ?? 0,
    apiCount: page?.summaryMetrics?.apiCount ?? page?.apis?.length ?? 0,
    schemaCount: page?.summaryMetrics?.schemaCount ?? page?.schemas?.length ?? 0,
    changeTargetCount: page?.summaryMetrics?.changeTargetCount ?? page?.changeTargets?.length ?? 0,
    featureCount: page?.summaryMetrics?.featureCount ?? page?.menuPermission?.featureRows?.length ?? 0,
    relationTableCount: page?.summaryMetrics?.relationTableCount ?? page?.menuPermission?.relationTables?.length ?? 0,
    componentCount: page?.summaryMetrics?.componentCount ?? page?.manifestRegistry?.componentCount ?? 0
  };
}

export function ScreenManagementSummaryGrid({
  items,
  className = "",
  dataHelpId
}: {
  items: SummaryMetricItem[];
  className?: string;
  dataHelpId?: string;
}) {
  return (
    <section className={`grid grid-cols-1 gap-4 xl:grid-cols-4 ${className}`.trim()} data-help-id={dataHelpId}>
      {items.map((item, index) => (
        <SummaryMetricCard
          accentClassName={item.accentClassName}
          data-help-id={item.dataHelpId}
          description={item.description}
          key={String(item.dataHelpId || index)}
          surfaceClassName={item.surfaceClassName}
          title={item.title}
          value={item.value}
        />
      ))}
    </section>
  );
}

export function ScreenManagementCatalogPanel({
  title,
  count,
  filterValue,
  onFilterChange,
  filterPlaceholder,
  items,
  emptyLabel,
  className = "",
  dataHelpId
}: {
  title: ReactNode;
  count: ReactNode;
  filterValue: string;
  onFilterChange: (event: ChangeEvent<HTMLInputElement>) => void;
  filterPlaceholder: string;
  items: CatalogListItem[];
  emptyLabel: ReactNode;
  className?: string;
  dataHelpId?: string;
}) {
  return (
    <section className={`gov-card ${className}`.trim()} data-help-id={dataHelpId}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{count}</span>
      </div>
      <AdminInput className="mb-4" onChange={onFilterChange} placeholder={filterPlaceholder} value={filterValue} />
      <div className="max-h-[70vh] space-y-2 overflow-y-auto">
        {items.map((item) => (
          <button
            className={`w-full rounded-[var(--kr-gov-radius)] border px-3 py-3 text-left transition-colors ${item.active ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-[var(--kr-gov-border-light)] bg-white hover:border-[var(--kr-gov-blue)] hover:bg-slate-50"}`}
            key={item.key}
            onClick={item.onSelect}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.title}</p>
                {item.subtitle ? <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.subtitle}</p> : null}
                {item.description ? <div className="mt-1 break-all text-xs text-[var(--kr-gov-text-secondary)]">{item.description}</div> : null}
              </div>
              {item.badge ? <div className="shrink-0">{item.badge}</div> : null}
            </div>
          </button>
        ))}
        {items.length === 0 ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-5 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ScreenManagementSelectionOverview({
  title,
  description,
  metaTitle,
  metaDescription,
  metaItems,
  badges,
  className = ""
}: {
  title: string;
  description?: ReactNode;
  metaTitle: string;
  metaDescription?: ReactNode;
  metaItems: SelectionOverviewItem[];
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <CollectionResultPanel className={className} description={description} title={title}>
      <KeyValueGridPanel description={metaDescription} items={metaItems} title={metaTitle} />
      {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
    </CollectionResultPanel>
  );
}
