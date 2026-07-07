import { MemberButton, PageStatusNotice } from "../admin-ui/common";

export type UseStatusFilter = "" | "Y" | "N";

export type RecentWorkItem = {
  id: string;
  label: string;
  kind: "class" | "group" | "detail";
  targetId: string;
  detailCodeId?: string;
};

type FilterChip = {
  key: string;
  label: string;
  clear: () => void;
};

export function ShortcutNotice({ en }: { en: boolean }) {
  return (
    <PageStatusNotice tone="warning">
      {en ? "Shortcuts: / search, N new detail code, Esc reset filters." : "단축키: / 검색, N 상세 코드 신규 입력, Esc 필터 초기화"}
    </PageStatusNotice>
  );
}

export function UseStatusFilterBar({
  en,
  useStatusFilter,
  onChange
}: {
  en: boolean;
  useStatusFilter: UseStatusFilter;
  onChange: (value: UseStatusFilter) => void;
}) {
  return (
    <section className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Use Filter" : "사용 필터"}</span>
      <MemberButton onClick={() => onChange("")} type="button" variant={useStatusFilter === "" ? "primary" : "secondary"}>{en ? "All" : "전체"}</MemberButton>
      <MemberButton onClick={() => onChange("Y")} type="button" variant={useStatusFilter === "Y" ? "primary" : "secondary"}>{en ? "Active" : "사용중"}</MemberButton>
      <MemberButton onClick={() => onChange("N")} type="button" variant={useStatusFilter === "N" ? "primary" : "secondary"}>{en ? "Inactive" : "미사용"}</MemberButton>
    </section>
  );
}

export function ActiveFilterChipBar({
  chips
}: {
  chips: FilterChip[];
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <section className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex items-center gap-2 rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-sm text-[var(--kr-gov-text-primary)]"
          key={chip.key}
          onClick={chip.clear}
          type="button"
        >
          <span>{chip.label}</span>
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      ))}
    </section>
  );
}

export function RecentWorkPanel({
  en,
  recentWorks,
  onClear,
  onOpen
}: {
  en: boolean;
  recentWorks: RecentWorkItem[];
  onClear: () => void;
  onOpen: (item: RecentWorkItem) => void;
}) {
  if (recentWorks.length === 0) {
    return null;
  }
  return (
    <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Recent Work" : "최근 작업"}</p>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-primary)]">{en ? "Jump back to recently changed items." : "방금 변경한 항목으로 바로 이동합니다."}</p>
        </div>
        <MemberButton onClick={onClear} type="button" variant="secondary">{en ? "Clear" : "비우기"}</MemberButton>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {recentWorks.map((item) => (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-3 py-2 text-sm text-[var(--kr-gov-text-primary)]"
            key={item.id}
            onClick={() => onOpen(item)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">{item.kind === "class" ? "category" : item.kind === "group" ? "list_alt" : "fact_check"}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
