import type { HTMLAttributes, ReactNode } from "react";

type CommonJoinProcessShellProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  screenId: string;
};

export function CommonJoinProcessShell({ children, className = "", screenId, ...attributes }: CommonJoinProcessShellProps) {
  return (
    <div
      {...attributes}
      className={`flex min-h-screen flex-col bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] ${className}`}
      data-common-component="COMMON_JOIN_PROCESS_SHELL"
      data-join-screen={screenId}
    >
      {children}
    </div>
  );
}
