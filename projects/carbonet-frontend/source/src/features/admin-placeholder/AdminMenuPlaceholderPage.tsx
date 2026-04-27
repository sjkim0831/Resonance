import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchAdminMenuPlaceholderPage } from "../../lib/api/appBootstrap";
import type { AdminMenuPlaceholderPagePayload } from "../../lib/api/appBootstrapTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function AdminMenuPlaceholderPage() {
  const en = isEnglish();
  const requestPath = `${window.location.pathname}${window.location.search || ""}`;
  const pageState = useAsyncValue<AdminMenuPlaceholderPagePayload>(
    () => fetchAdminMenuPlaceholderPage(requestPath),
    [requestPath]
  );
  const page = pageState.value;
  const title = stringOf(page?.placeholderTitle) || (en ? "Menu Placeholder" : "메뉴 플레이스홀더");
  const code = stringOf(page?.placeholderCode);
  const url = stringOf(page?.placeholderUrl) || requestPath;
  const icon = stringOf(page?.placeholderIcon) || "web";
  const description = stringOf(page?.placeholderDescription)
    || (en
      ? "This page is connected for menu access, but the detailed business screen has not been migrated yet."
      : "메뉴 접근을 위해 연결된 화면이며, 상세 업무 화면은 아직 React로 완전히 이관되지 않았습니다.");

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Menu Placeholder" : "메뉴 플레이스홀더" }
      ]}
      sidebarVariant="system"
      subtitle={description}
      title={title}
    >
      {pageState.error ? (
        <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageState.error}
        </div>
      ) : null}
      <section className="gov-card max-w-5xl" data-help-id="admin-menu-placeholder-card">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-[42px] text-[var(--kr-gov-blue)]">{icon}</span>
          <div>
            <h2 className="text-3xl font-black mb-2">{title}</h2>
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">{description}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2">{en ? "Menu Code" : "메뉴 코드"}</p>
            <p className="font-bold">{code || "-"}</p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2">{en ? "Linked URL" : "연결 URL"}</p>
            <p className="font-bold break-all">{url || "-"}</p>
          </div>
        </div>
      </section>
    </AdminPageShell>
  );
}
