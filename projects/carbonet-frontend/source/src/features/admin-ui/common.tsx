import type { HTMLAttributes, ReactNode } from "react";
import {
  AppButton,
  AppCheckbox,
  AppIconButton,
  AppInput,
  AppLinkButton,
  AppPermissionButton,
  AppRadio,
  AppSelect,
  AppTable,
  AppTextarea,
  getAppButtonClassName,
  type AppButtonSize as MemberButtonSize,
  type AppButtonVariant as MemberButtonVariant
} from "../app-ui/primitives";
export { ADMIN_BUTTON_LABELS, MEMBER_BUTTON_LABELS, MEMBER_LIST_LABELS } from "./labels";

export function getMemberButtonClassName({
  variant = "secondary",
  size = "md",
  className = ""
}: { variant?: MemberButtonVariant; size?: MemberButtonSize; className?: string } = {}) {
  return getAppButtonClassName({ variant, size, className });
}

export const MemberButton = AppButton;
export const MemberLinkButton = AppLinkButton;
export const MemberPermissionButton = AppPermissionButton;
export const MemberIconButton = AppIconButton;
export const AdminInput = AppInput;
export const AdminSelect = AppSelect;
export const AdminTextarea = AppTextarea;
export const AdminTable = AppTable;
export const AdminCheckbox = AppCheckbox;
export const AdminRadio = AppRadio;

export function MemberButtonGroup({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>{children}</div>;
}

export function MemberPageActions({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}>{children}</div>;
}

export function PageHeaderActions(props: HTMLAttributes<HTMLDivElement>) {
  return <MemberPageActions {...props} />;
}

export function MemberToolbar({
  left,
  right,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { left?: ReactNode; right?: ReactNode }) {
  return (
    <div {...props} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{right}</div>
    </div>
  );
}

export function MemberSectionToolbar({
  title,
  meta,
  actions,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & { title?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <MemberToolbar
      {...props}
      className={className}
      left={<div>{title ? <div className="text-sm font-bold">{title}</div> : null}{meta ? <div className="mt-1 text-sm text-gray-500">{meta}</div> : null}</div>}
      right={actions}
    />
  );
}

export function GridToolbar({
  title,
  meta,
  actions,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & { title?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return <div {...props} className={`border-b border-[var(--kr-gov-border-light)] px-6 py-5 ${className}`.trim()}><MemberSectionToolbar actions={actions} meta={meta} title={title} /></div>;
}

export function MemberModalFooter({
  left,
  right,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { left?: ReactNode; right?: ReactNode }) {
  return (
    <div {...props} className={`flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-6 sm:flex-row sm:items-center ${className}`.trim()}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">{right}</div>
    </div>
  );
}

type MemberPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  className?: string;
  dataHelpId?: string;
};

export function MemberPagination({ currentPage, totalPages, onPageChange, className = "", dataHelpId }: MemberPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const visiblePages = safeTotalPages <= 7
    ? Array.from({ length: safeTotalPages }, (_, index) => index + 1)
    : Array.from(new Set([
        1,
        Math.max(1, safeCurrentPage - 1),
        safeCurrentPage,
        Math.min(safeTotalPages, safeCurrentPage + 1),
        safeTotalPages
      ])).sort((left, right) => left - right);
  const pageTokens: Array<number | string> = [];
  visiblePages.forEach((pageNumber, index) => {
    pageTokens.push(pageNumber);
    const nextPageNumber = visiblePages[index + 1];
    if (nextPageNumber && nextPageNumber - pageNumber > 1) {
      pageTokens.push(`ellipsis-${pageNumber}-${nextPageNumber}`);
    }
  });
  return (
    <div className={`border-t border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4 ${className}`.trim()} data-help-id={dataHelpId}>
      <nav className="flex flex-wrap items-center justify-center gap-1">
        <button className="rounded border border-transparent p-1 hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={safeCurrentPage <= 1} onClick={() => onPageChange(1)} type="button"><span className="material-symbols-outlined">first_page</span></button>
        <button className="rounded border border-transparent p-1 hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={safeCurrentPage <= 1} onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))} type="button"><span className="material-symbols-outlined">chevron_left</span></button>
        <div className="mx-4 flex flex-wrap items-center justify-center gap-1">
          {pageTokens.map((pageToken) => typeof pageToken === "string"
            ? <span className="flex h-8 min-w-[24px] items-center justify-center px-1 text-sm text-[var(--kr-gov-text-secondary)]" key={pageToken}>…</span>
            : <button className={`flex h-8 min-w-[32px] items-center justify-center rounded border px-2 text-sm ${pageToken === safeCurrentPage ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] font-bold text-white" : "border-transparent hover:border-gray-200 hover:bg-white"}`} key={pageToken} onClick={() => onPageChange(pageToken)} type="button">{pageToken}</button>)}
        </div>
        <button className="rounded border border-transparent p-1 hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={safeCurrentPage >= safeTotalPages} onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))} type="button"><span className="material-symbols-outlined">chevron_right</span></button>
        <button className="rounded border border-transparent p-1 hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={safeCurrentPage >= safeTotalPages} onClick={() => onPageChange(safeTotalPages)} type="button"><span className="material-symbols-outlined">last_page</span></button>
      </nav>
    </div>
  );
}

type MemberActionBarButton = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: string;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
};

type MemberActionBarProps = {
  primary?: ReactNode;
  secondary?: MemberActionBarButton;
  tertiary?: MemberActionBarButton;
  eyebrow?: string;
  title?: string;
  description?: ReactNode;
  className?: string;
  dataHelpId?: string;
};

function renderActionButton(button: MemberActionBarButton, baseClassName: string) {
  const content = <>{button.icon ? <span className="material-symbols-outlined text-[20px]">{button.icon}</span> : null}<span>{button.label}</span></>;
  if (button.href) {
    return <a className={`${baseClassName} ${button.className || ""}`.trim()} href={button.href}>{content}</a>;
  }
  return <button className={`${baseClassName} ${button.className || ""}`.trim()} disabled={button.disabled} onClick={button.onClick} type={button.type || "button"}>{content}</button>;
}

export function MemberActionBar({ primary, secondary, tertiary, eyebrow, title, description, className = "", dataHelpId }: MemberActionBarProps) {
  const secondaryBaseClassName = `${getMemberButtonClassName({ variant: "secondary", size: "lg" })} min-w-[160px] justify-center`;
  const tertiaryBaseClassName = `${getMemberButtonClassName({ variant: "secondary", size: "lg" })} min-w-[160px] justify-center`;
  const hasGuide = Boolean(eyebrow || title || description);
  return (
    <div className={`mt-8 border-t border-[var(--kr-gov-border-light)] pt-6 ${className}`.trim()} data-help-id={dataHelpId}>
      <div className="overflow-hidden rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(241,245,249,0.72),rgba(255,255,255,0.98))] shadow-sm">
        <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex flex-1 flex-col gap-4">
            {hasGuide ? <div className="space-y-1">{eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{eyebrow}</p> : null}{title ? <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{title}</h3> : null}{description ? <div className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{description}</div> : null}</div> : null}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
              {secondary ? renderActionButton(secondary, secondaryBaseClassName) : null}
              {tertiary ? renderActionButton(tertiary, tertiaryBaseClassName) : null}
            </div>
          </div>
          <div className="flex items-stretch justify-end lg:flex-none lg:shrink-0">{primary}</div>
        </div>
      </div>
    </div>
  );
}

export function DiagnosticCard({
  eyebrow,
  title,
  status,
  statusTone = "neutral",
  description,
  summary,
  actions,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  statusTone?: "neutral" | "healthy" | "warning" | "danger";
  description?: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const toneClassName = statusTone === "healthy" ? "bg-emerald-100 text-emerald-700" : statusTone === "warning" ? "bg-amber-100 text-amber-700" : statusTone === "danger" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700";
  return (
    <article {...props} className={`gov-card ${className}`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{eyebrow}</p> : null}
          <h3 className="mt-2 text-lg font-bold">{title}</h3>
        </div>
        {status ? <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${toneClassName}`}>{status}</span> : null}
      </div>
      {description ? <div className="mt-4 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{description}</div> : null}
      {summary ? <div className="mt-5">{summary}</div> : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}

export function CopyableCodeBlock({
  title = "Code",
  value,
  copied,
  onCopy,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  value: string;
  copied?: boolean;
  onCopy?: () => void;
  copyLabel?: ReactNode;
  copiedLabel?: ReactNode;
}) {
  return (
    <div {...props} className={`rounded border border-[var(--kr-gov-border-light)] bg-white p-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{title}</p>
        {onCopy ? <MemberButton onClick={onCopy} size="xs" type="button" variant="secondary">{copied ? copiedLabel : copyLabel}</MemberButton> : null}
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-[var(--kr-gov-text-primary)]">{value}</pre>
    </div>
  );
}

type PageStatusNoticeTone = "success" | "error" | "warning" | "info";

const pageStatusNoticeToneClassName: Record<PageStatusNoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function PageStatusNotice({
  tone,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  tone: PageStatusNoticeTone;
  children: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`mb-4 rounded-[var(--kr-gov-radius)] border px-4 py-3 text-sm ${pageStatusNoticeToneClassName[tone]} ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function LookupContextStrip({
  label = "Lookup Context",
  value,
  action,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  label?: ReactNode;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-4 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{label}</p>
          <div className="mt-1 text-sm text-[var(--kr-gov-text-primary)]">{value}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function SummaryMetricCard({
  title,
  value,
  description,
  accentClassName = "text-[var(--kr-gov-blue)]",
  surfaceClassName = "bg-[#f8fbff]",
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  accentClassName?: string;
  surfaceClassName?: string;
}) {
  return (
    <article
      {...props}
      className={`rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 ${surfaceClassName} ${className}`.trim()}
    >
      <p className={`font-bold ${accentClassName}`.trim()}>{title}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
      {description ? <p className="text-[var(--kr-gov-text-secondary)]">{description}</p> : null}
    </article>
  );
}

export function BinaryStatusCard({
  title,
  healthy,
  healthyLabel,
  unhealthyLabel,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  healthy: boolean;
  healthyLabel: ReactNode;
  unhealthyLabel: ReactNode;
}) {
  return (
    <article
      {...props}
      className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${healthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"} ${className}`.trim()}
    >
      <p className="text-xs font-black uppercase tracking-[0.08em]">{title}</p>
      <p className="mt-1 text-sm font-bold">{healthy ? healthyLabel : unhealthyLabel}</p>
    </article>
  );
}

export function WarningPanel({
  title,
  children,
  actions,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`mb-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`.trim()}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      <div className={title ? "mt-2" : ""}>{children}</div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

export function CollectionResultPanel({
  title,
  description,
  icon = "task_alt",
  children,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`mb-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-[var(--kr-gov-text-primary)] ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{icon}</span>
        <p className="font-bold">{title}</p>
      </div>
      {description ? <p className="mt-2 text-[var(--kr-gov-text-secondary)]">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

type KeyValueGridPanelItem = {
  label: ReactNode;
  value: ReactNode;
};

export function KeyValueGridPanel({
  title,
  description,
  items,
  children,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  items: KeyValueGridPanelItem[];
  children?: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4 ${className}`.trim()}
    >
      <h4 className="font-bold">{title}</h4>
      {description ? <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{description}</p> : null}
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        {items.map((item, index) => (
          <div key={index}>
            <dt className="font-bold">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

type MetaListPanelSection = {
  label: ReactNode;
  content: ReactNode;
};

export function MetaListPanel({
  sections,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  sections: MetaListPanelSection[];
}) {
  return (
    <section
      {...props}
      className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${className}`.trim()}
    >
      {sections.map((section, index) => (
        <div key={index}>
          <p className="gov-label mb-2">{section.label}</p>
          {section.content}
        </div>
      ))}
    </section>
  );
}
