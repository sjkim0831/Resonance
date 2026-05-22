import { buildLocalizedPath } from "../../lib/navigation/runtime";

type BuilderNavItem = {
  id: string;
  labelKo: string;
  labelEn: string;
  koPath: string;
  enPath: string;
  icon: string;
};

const BUILDER_GOVERNANCE_NAV_ITEMS: BuilderNavItem[] = [
  { id: "platform-studio", labelKo: "플랫폼 스튜디오", labelEn: "Platform Studio", koPath: "/admin/system/platform-studio", enPath: "/en/admin/system/platform-studio", icon: "dashboard_customize" },
  { id: "screen-elements-management", labelKo: "화면 요소 관리", labelEn: "Screen Elements", koPath: "/admin/system/screen-elements-management", enPath: "/en/admin/system/screen-elements-management", icon: "widgets" },
  { id: "event-management-console", labelKo: "이벤트 관리", labelEn: "Events", koPath: "/admin/system/event-management-console", enPath: "/en/admin/system/event-management-console", icon: "bolt" },
  { id: "function-management-console", labelKo: "함수 콘솔", labelEn: "Functions", koPath: "/admin/system/function-management-console", enPath: "/en/admin/system/function-management-console", icon: "functions" },
  { id: "api-management-console", labelKo: "API 관리", labelEn: "APIs", koPath: "/admin/system/api-management-console", enPath: "/en/admin/system/api-management-console", icon: "api" },
  { id: "controller-management-console", labelKo: "컨트롤러 관리", labelEn: "Controllers", koPath: "/admin/system/controller-management-console", enPath: "/en/admin/system/controller-management-console", icon: "account_tree" },
  { id: "db-table-management", labelKo: "DB 테이블 관리", labelEn: "DB Tables", koPath: "/admin/system/db-table-management", enPath: "/en/admin/system/db-table-management", icon: "table" },
  { id: "column-management-console", labelKo: "컬럼 관리", labelEn: "Columns", koPath: "/admin/system/column-management-console", enPath: "/en/admin/system/column-management-console", icon: "view_column" },
  { id: "automation-studio", labelKo: "자동화 스튜디오", labelEn: "Automation", koPath: "/admin/system/automation-studio", enPath: "/en/admin/system/automation-studio", icon: "precision_manufacturing" },
  { id: "development-pattern-management", labelKo: "개발 패턴 관리", labelEn: "Dev Patterns", koPath: "/admin/system/development-pattern-management", enPath: "/en/admin/system/development-pattern-management", icon: "schema" },
  { id: "theme-management", labelKo: "테마 관리", labelEn: "Themes", koPath: "/admin/system/theme-management", enPath: "/en/admin/system/theme-management", icon: "palette" },
  { id: "css-management", labelKo: "CSS 관리", labelEn: "CSS", koPath: "/admin/system/css-management", enPath: "/en/admin/system/css-management", icon: "css" },
  { id: "ai-developer-team", labelKo: "AI 개발팀", labelEn: "AI Team", koPath: "/admin/system/ai-developer-team", enPath: "/en/admin/system/ai-developer-team", icon: "groups" },
  { id: "asset-inventory", labelKo: "자산 인벤토리", labelEn: "Assets", koPath: "/admin/system/asset-inventory", enPath: "/en/admin/system/asset-inventory", icon: "inventory_2" },
  { id: "verification-assets", labelKo: "검증 자산 관리", labelEn: "Verification Assets", koPath: "/admin/system/verification-assets", enPath: "/en/admin/system/verification-assets", icon: "verified" }
];

export function BuilderGovernanceNav({ activeId, en }: { activeId: string; en: boolean }) {
  return (
    <nav className="mb-4" data-help-id="builder-governance-nav">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {BUILDER_GOVERNANCE_NAV_ITEMS.map((item) => {
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
