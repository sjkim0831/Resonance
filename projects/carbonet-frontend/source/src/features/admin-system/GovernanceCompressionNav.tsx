import { buildLocalizedPath } from "../../lib/navigation/runtime";

type GovernanceNavItem = {
  id: string;
  labelKo: string;
  labelEn: string;
  koPath: string;
  enPath: string;
  icon: string;
};

const SYSTEM_GOVERNANCE_NAV_ITEMS: GovernanceNavItem[] = [
  {
    id: "code-list",
    labelKo: "공통코드 조회",
    labelEn: "Common Code Search",
    koPath: "/admin/system/code/list",
    enPath: "/en/admin/system/code/list",
    icon: "manage_search"
  },
  {
    id: "code-register",
    labelKo: "공통코드 등록",
    labelEn: "Common Code Register",
    koPath: "/admin/system/code/register",
    enPath: "/en/admin/system/code/register",
    icon: "add_circle"
  },
  {
    id: "menu",
    labelKo: "메뉴 관리",
    labelEn: "Menu",
    koPath: "/admin/system/menu",
    enPath: "/en/admin/system/menu",
    icon: "account_tree"
  },
  {
    id: "full-stack",
    labelKo: "메뉴 통합 관리",
    labelEn: "Integrated Menu",
    koPath: "/admin/system/full-stack-management",
    enPath: "/en/admin/system/full-stack-management",
    icon: "hub"
  },
  {
    id: "page",
    labelKo: "페이지 관리",
    labelEn: "Page",
    koPath: "/admin/system/page-management",
    enPath: "/en/admin/system/page-management",
    icon: "web_asset"
  },
  {
    id: "flow",
    labelKo: "화면 흐름 관리",
    labelEn: "Screen Flow",
    koPath: "/admin/system/screen-flow-management",
    enPath: "/en/admin/system/screen-flow-management",
    icon: "timeline"
  },
  {
    id: "design",
    labelKo: "설계 완성도",
    labelEn: "Design Coverage",
    koPath: "/admin/system/design-governance",
    enPath: "/en/admin/system/design-governance",
    icon: "fact_check"
  },
  {
    id: "actor-process",
    labelKo: "액터·프로세스",
    labelEn: "Actors & Processes",
    koPath: "/admin/system/actor-process",
    enPath: "/en/admin/system/actor-process",
    icon: "diversity_3"
  },
  {
    id: "assignment",
    labelKo: "화면 메뉴 귀속 관리",
    labelEn: "Screen Menu Binding",
    koPath: "/admin/system/screen-menu-assignment-management",
    enPath: "/en/admin/system/screen-menu-assignment-management",
    icon: "link"
  },
  {
    id: "function",
    labelKo: "기능 관리",
    labelEn: "Function",
    koPath: "/admin/system/feature-management",
    enPath: "/en/admin/system/feature-management",
    icon: "extension"
  },
  {
    id: "development-pattern-management",
    labelKo: "개발 패턴 관리",
    labelEn: "Dev Patterns",
    koPath: "/admin/system/development-pattern-management",
    enPath: "/en/admin/system/development-pattern-management",
    icon: "schema"
  },
  {
    id: "theme-management",
    labelKo: "테마 관리",
    labelEn: "Theme",
    koPath: "/admin/system/theme-management",
    enPath: "/en/admin/system/theme-management",
    icon: "palette"
  },
  {
    id: "theme",
    labelKo: "테마 관리",
    labelEn: "Theme",
    koPath: "/admin/system/theme",
    enPath: "/en/admin/system/theme",
    icon: "palette"
  },
  {
    id: "module",
    labelKo: "모듈 관리",
    labelEn: "Module",
    koPath: "/admin/system/module",
    enPath: "/en/admin/system/module",
    icon: "view_module"
  },
  {
    id: "full-stack-management",
    labelKo: "풀스택 관리",
    labelEn: "Full Stack",
    koPath: "/admin/system/full-stack-management",
    enPath: "/en/admin/system/full-stack-management",
    icon: "hub"
  },
  {
    id: "platform-studio",
    labelKo: "플랫폼 스튜디오",
    labelEn: "Platform Studio",
    koPath: "/admin/system/platform-studio",
    enPath: "/en/admin/system/platform-studio",
    icon: "dashboard_customize"
  },
  {
    id: "screen-elements-management",
    labelKo: "화면 요소 관리",
    labelEn: "Screen Elements",
    koPath: "/admin/system/screen-elements-management",
    enPath: "/en/admin/system/screen-elements-management",
    icon: "crop_landscape"
  },
  {
    id: "event-management",
    labelKo: "이벤트 관리",
    labelEn: "Event Management",
    koPath: "/admin/system/event-management",
    enPath: "/en/admin/system/event-management",
    icon: "bolt"
  },
  {
    id: "function-console",
    labelKo: "함수 콘솔",
    labelEn: "Function Console",
    koPath: "/admin/system/function-console",
    enPath: "/en/admin/system/function-console",
    icon: "functions"
  },
  {
    id: "api-management",
    labelKo: "API 관리",
    labelEn: "API Management",
    koPath: "/admin/system/api-management",
    enPath: "/en/admin/system/api-management",
    icon: "api"
  },
  {
    id: "controller-management",
    labelKo: "컨트롤러 관리",
    labelEn: "Controller Management",
    koPath: "/admin/system/controller-management",
    enPath: "/en/admin/system/controller-management",
    icon: "account_tree"
  },
  {
    id: "db-table-management",
    labelKo: "DB 테이블 관리",
    labelEn: "DB Table Management",
    koPath: "/admin/system/db-table-management",
    enPath: "/en/admin/system/db-table-management",
    icon: "database"
  },
  {
    id: "column-management",
    labelKo: "컬럼 관리",
    labelEn: "Column Management",
    koPath: "/admin/system/column-management",
    enPath: "/en/admin/system/column-management",
    icon: "view_column"
  },
  {
    id: "automation-studio",
    labelKo: "자동화 스튜디오",
    labelEn: "Automation Studio",
    koPath: "/admin/system/automation-studio",
    enPath: "/en/admin/system/automation-studio",
    icon: "smart_toy"
  },
  {
    id: "asset-inventory",
    labelKo: "자산 인벤토리",
    labelEn: "Asset Inventory",
    koPath: "/admin/system/asset-inventory",
    enPath: "/en/admin/system/asset-inventory",
    icon: "inventory_2"
  },
  {
    id: "asset-detail",
    labelKo: "자산 상세",
    labelEn: "Asset Detail",
    koPath: "/admin/system/asset-detail",
    enPath: "/en/admin/system/asset-detail",
    icon: "info"
  },
  {
    id: "asset-impact",
    labelKo: "자산 영향도",
    labelEn: "Asset Impact",
    koPath: "/admin/system/asset-impact",
    enPath: "/en/admin/system/asset-impact",
    icon: "query_stats"
  },
  {
    id: "asset-lifecycle",
    labelKo: "자산 생명주기",
    labelEn: "Asset Lifecycle",
    koPath: "/admin/system/asset-lifecycle",
    enPath: "/en/admin/system/asset-lifecycle",
    icon: "alt_route"
  },
  {
    id: "asset-deficiency-queue",
    labelKo: "자산 미흡 큐",
    labelEn: "Asset Deficiency Queue",
    koPath: "/admin/system/asset-deficiency-queue",
    enPath: "/en/admin/system/asset-deficiency-queue",
    icon: "running_with_errors"
  },
  {
    id: "verification-asset-management",
    labelKo: "검증 자산 관리",
    labelEn: "Verification Asset Management",
    koPath: "/admin/system/verification-asset-management",
    enPath: "/en/admin/system/verification-asset-management",
    icon: "fact_check"
  },
  {
    id: "css-management",
    labelKo: "CSS 관리",
    labelEn: "CSS",
    koPath: "/admin/system/css-management",
    enPath: "/en/admin/system/css-management",
    icon: "css"
  },
  {
    id: "ai-developer-team",
    labelKo: "AI 개발팀",
    labelEn: "AI Team",
    koPath: "/admin/system/ai-developer-team",
    enPath: "/en/admin/system/ai-developer-team",
    icon: "groups"
  }
];

export function GovernanceCompressionNav({
  activeId,
  en
}: {
  activeId: string;
  en: boolean;
}) {
  return (
    <nav className="mb-4" data-help-id="system-governance-compression-nav">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {SYSTEM_GOVERNANCE_NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <a
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-[3.5rem] items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] border px-3 py-2 text-center text-sm font-black transition-colors ${
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
