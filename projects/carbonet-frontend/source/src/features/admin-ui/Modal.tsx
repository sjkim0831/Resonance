import type { ReactNode } from "react";

type MemberModalProps = {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  title: ReactNode;
};

const memberModalSizeClassName: Record<"sm" | "md" | "lg", string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl"
};

export function MemberModal({
  children,
  className = "",
  footer,
  onClose,
  size = "md",
  title
}: MemberModalProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className={`relative z-50 w-full ${memberModalSizeClassName[size]} mx-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] px-6 py-4">
          <h2 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{title}</h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-transparent text-[var(--kr-gov-text-secondary)] hover:border-gray-200 hover:bg-gray-50"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className={`max-h-[60vh] overflow-y-auto p-6 ${className}`.trim()}>
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}