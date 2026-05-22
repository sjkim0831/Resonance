import { buildLocalizedPath } from "../../lib/navigation/runtime";

const AUTHORITY_NAV_ITEMS = [
  { id: "auth-group", labelKo: "권한 그룹", labelEn: "Authority Groups", koPath: "/admin/auth/group", enPath: "/en/admin/auth/group", icon: "admin_panel_settings" },
  { id: "auth-change", labelKo: "권한 변경", labelEn: "Authority Change", koPath: "/admin/member/auth-change", enPath: "/en/admin/member/auth-change", icon: "sync_alt" },
  { id: "dept-role", labelKo: "부서 권한", labelEn: "Department Roles", koPath: "/admin/member/dept-role-mapping", enPath: "/en/admin/member/dept-role-mapping", icon: "lan" },
  { id: "admin-permission", labelKo: "관리자 권한", labelEn: "Admin Permissions", koPath: "/admin/member/admin_account/permissions", enPath: "/en/admin/member/admin_account/permissions", icon: "key" },
  { id: "member-list", labelKo: "회원 목록", labelEn: "Members", koPath: "/admin/member/list", enPath: "/en/admin/member/list", icon: "group" },
  { id: "admin-list", labelKo: "관리자 목록", labelEn: "Admins", koPath: "/admin/member/admin_list", enPath: "/en/admin/member/admin_list", icon: "manage_accounts" }
];

export function MemberAuthorityNav({ activeId, en }: { activeId: string; en: boolean }) {
  return (
    <nav className="mb-4" data-help-id="member-authority-nav">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {AUTHORITY_NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <a
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.25rem] items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] border px-3 py-2 text-center text-sm font-black transition-colors ${
                active
                  ? "border-[var(--kr-gov-blue)] bg-blue-50 text-[var(--kr-gov-blue)]"
                  : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:bg-blue-50"
              }`}
              href={buildLocalizedPath(item.koPath, item.enPath)}
              key={item.id}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="min-w-0 truncate">{en ? item.labelEn : item.labelKo}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
