import type { HTMLAttributes, ReactNode } from "react";
import { MemberIconButton, MemberModalFooter } from "./common";

type MemberSectionCardProps = HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  icon?: string;
  iconClassName?: string;
  children: ReactNode;
  bodyClassName?: string;
};

export function MemberSectionCard({
  title,
  icon,
  iconClassName = "text-[var(--kr-gov-blue)]",
  children,
  className = "",
  bodyClassName = "",
  ...props
}: MemberSectionCardProps) {
  return (
    <section
      {...props}
      className={`border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm ${className}`.trim()}
    >
      <div className="flex items-center gap-2 border-b pb-4 mb-5">
        {icon ? <span className={`material-symbols-outlined ${iconClassName}`}>{icon}</span> : null}
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function MemberInsetNotice({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

type MemberStateCardProps = HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  description: ReactNode;
  icon?: string;
  tone?: "neutral" | "warning" | "danger";
  actions?: ReactNode;
};

export function MemberStateCard({
  title,
  description,
  icon = "info",
  tone = "neutral",
  actions,
  className = "",
  ...props
}: MemberStateCardProps) {
  const toneClassName = tone === "danger"
    ? "border-red-200 bg-red-50"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";
  const iconClassName = tone === "danger"
    ? "text-red-500"
    : tone === "warning"
      ? "text-amber-500"
      : "text-[var(--kr-gov-blue)]";

  return (
    <section
      {...props}
      className={`rounded-[var(--kr-gov-radius)] border px-6 py-6 shadow-sm ${toneClassName} ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined text-[28px] ${iconClassName}`.trim()}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{description}</p>
          {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

type DetailSummaryCardProps = HTMLAttributes<HTMLElement> & {
  icon: string;
  title: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  metaRows?: Array<{ label: ReactNode; value: ReactNode }>;
};

export function DetailSummaryCard({
  icon,
  title,
  badges,
  actions,
  metaRows = [],
  className = "",
  ...props
}: DetailSummaryCardProps) {
  return (
    <section
      {...props}
      className={`border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
          <span className="material-symbols-outlined text-[48px] text-gray-400">{icon}</span>
        </div>
        <h3 className="mb-2 text-xl font-bold">{title}</h3>
        {badges ? <div className="mb-3 flex flex-wrap justify-center gap-2">{badges}</div> : null}
        {metaRows.length > 0 ? (
          <div className="w-full rounded-[var(--kr-gov-radius)] bg-gray-50 p-4 text-left text-sm">
            {metaRows.map((row, index) => (
              <div className={`${index < metaRows.length - 1 ? "mb-2" : ""} flex justify-between gap-4`} key={`${String(row.label)}-${index}`}>
                <span className="text-[var(--kr-gov-text-secondary)]">{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {actions ? <div className="mt-4 w-full">{actions}</div> : null}
      </div>
    </section>
  );
}

type ReviewModalProps = {
  title: ReactNode;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  maxWidthClassName?: string;
};

export function ReviewModalFrame({
  title,
  open,
  onClose,
  children,
  footerLeft,
  footerRight,
  maxWidthClassName = "max-w-2xl"
}: ReviewModalProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className={`flex max-h-[90vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-lg bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] bg-white px-6 py-4">
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">assignment_ind</span>
            {title}
          </h3>
          <MemberIconButton icon="close" onClick={onClose} type="button" variant="ghost" />
        </div>
        <div className="space-y-6 overflow-y-auto px-6 py-6">
          {children}
        </div>
        <MemberModalFooter left={footerLeft} right={footerRight} />
      </div>
    </div>
  );
}
