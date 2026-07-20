import type { HTMLAttributes, ReactNode } from "react";

export function CommonStatusBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span data-common-component="COMMON_STATUS_BADGE" className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-tight ${className}`}>{children}</span>;
}

export function CommonContentCard({ children, className = "", ...attributes }: HTMLAttributes<HTMLElement>) {
  return <article {...attributes} data-common-component="COMMON_CONTENT_CARD" className={`rounded-xl border border-[var(--kr-gov-border-light)] bg-white shadow-sm ${className}`}>{children}</article>;
}

export function CommonDataTable({ children, label }: { children: ReactNode; label: string }) {
  return <div data-common-component="COMMON_DATA_TABLE" className="overflow-x-auto"><table className="w-full border-collapse text-left" aria-label={label}>{children}</table></div>;
}

export function CommonTimeline({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <CommonContentCard className="p-6" ><h3 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3><div data-common-component="COMMON_STEP_FLOW" className="relative ml-1 space-y-6 border-l border-gray-100">{children}</div></CommonContentCard>;
}

export function CommonActionBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-common-component="COMMON_ACTION_BAR" className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}
