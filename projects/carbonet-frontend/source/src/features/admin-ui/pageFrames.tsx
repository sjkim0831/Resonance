import type { HTMLAttributes, ReactNode } from "react";

type AdminPageFrameProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

function joinClassName(baseClassName: string, className = "") {
  return `${baseClassName} ${className}`.trim();
}

export function AdminPageFrame({ children, className = "", ...props }: AdminPageFrameProps) {
  return (
    <div {...props} className={joinClassName("space-y-6", className)}>
      {children}
    </div>
  );
}

// Aliases for backward compatibility - all identical implementations
export const AdminListPageFrame = AdminPageFrame;
export const AdminEditPageFrame = AdminPageFrame;
export const AdminAuthorityPageFrame = AdminPageFrame;
export const AdminPolicyPageFrame = AdminPageFrame;
export const AdminWorkspacePageFrame = AdminPageFrame;

export function AdminSummaryStrip({ children, className = "", ...props }: AdminPageFrameProps) {
  return (
    <section {...props} className={joinClassName("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </section>
  );
}
