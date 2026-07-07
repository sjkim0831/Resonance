import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type TemplateFrameConfig = {
  titleKo: string;
  titleEn: string;
  koPath: string;
  enPath: string;
};

const ADMIN_TEMPLATE_FRAME_CONFIG: Record<string, TemplateFrameConfig> = {
  "member-stats": {
    titleKo: "회원 통계",
    titleEn: "Member Stats",
    koPath: "/admin/member/stats",
    enPath: "/en/admin/member/stats"
  },
  "member-register": {
    titleKo: "회원 등록",
    titleEn: "Member Register",
    koPath: "/admin/member/register",
    enPath: "/en/admin/member/register"
  },
  "emission-result-list": {
    titleKo: "배출 결과 목록",
    titleEn: "Emission Result List",
    koPath: "/admin/emission/result_list",
    enPath: "/en/admin/emission/result_list"
  },
  "system-code": {
    titleKo: "시스템 코드",
    titleEn: "System Code",
    koPath: "/admin/system/code",
    enPath: "/en/admin/system/code"
  },
  "page-management": {
    titleKo: "화면 관리",
    titleEn: "Screen Management",
    koPath: "/admin/system/page-management",
    enPath: "/en/admin/system/page-management"
  },
  "function-management": {
    titleKo: "기능 관리",
    titleEn: "Function Management",
    koPath: "/admin/system/feature-management",
    enPath: "/en/admin/system/feature-management"
  },
  "menu-management": {
    titleKo: "메뉴 관리",
    titleEn: "Menu Management",
    koPath: "/admin/system/menu",
    enPath: "/en/admin/system/menu"
  },
  "full-stack-management": {
    titleKo: "풀스택 관리",
    titleEn: "Full-Stack Management",
    koPath: "/admin/system/full-stack-management",
    enPath: "/en/admin/system/full-stack-management"
  },
  "platform-studio": {
    titleKo: "플랫폼 스튜디오",
    titleEn: "Platform Studio",
    koPath: "/admin/system/platform-studio",
    enPath: "/en/admin/system/platform-studio"
  },
  "screen-elements-management": {
    titleKo: "화면 요소 관리",
    titleEn: "Screen Elements",
    koPath: "/admin/system/screen-elements-management",
    enPath: "/en/admin/system/screen-elements-management"
  },
  "event-management-console": {
    titleKo: "이벤트 관리",
    titleEn: "Event Management",
    koPath: "/admin/system/event-management-console",
    enPath: "/en/admin/system/event-management-console"
  },
  "function-management-console": {
    titleKo: "함수 콘솔",
    titleEn: "Function Console",
    koPath: "/admin/system/function-management-console",
    enPath: "/en/admin/system/function-management-console"
  },
  "api-management-console": {
    titleKo: "API 관리",
    titleEn: "API Management",
    koPath: "/admin/system/api-management-console",
    enPath: "/en/admin/system/api-management-console"
  },
  "controller-management-console": {
    titleKo: "컨트롤러 관리",
    titleEn: "Controller Management",
    koPath: "/admin/system/controller-management-console",
    enPath: "/en/admin/system/controller-management-console"
  },
  "db-table-management": {
    titleKo: "DB 테이블 관리",
    titleEn: "DB Table Management",
    koPath: "/admin/system/db-table-management",
    enPath: "/en/admin/system/db-table-management"
  },
  "column-management-console": {
    titleKo: "컬럼 관리",
    titleEn: "Column Management",
    koPath: "/admin/system/column-management-console",
    enPath: "/en/admin/system/column-management-console"
  },
  "automation-studio": {
    titleKo: "자동화 스튜디오",
    titleEn: "Automation Studio",
    koPath: "/admin/system/automation-studio",
    enPath: "/en/admin/system/automation-studio"
  },
  "wbs-management": {
    titleKo: "WBS 관리",
    titleEn: "WBS Management",
    koPath: "/admin/system/wbs-management",
    enPath: "/en/admin/system/wbs-management"
  },
  "ip-whitelist": {
    titleKo: "IP 화이트리스트",
    titleEn: "IP Whitelist",
    koPath: "/admin/system/ip_whitelist",
    enPath: "/en/admin/system/ip_whitelist"
  },
  "login-history": {
    titleKo: "로그인 이력",
    titleEn: "Login History",
    koPath: "/admin/member/login_history",
    enPath: "/en/admin/member/login_history"
  },
  "member-security-history": {
    titleKo: "접근 차단 이력",
    titleEn: "Access Block History",
    koPath: "/admin/member/security",
    enPath: "/en/admin/member/security"
  },
  "security-history": {
    titleKo: "접근 차단 이력",
    titleEn: "Access Block History",
    koPath: "/admin/system/security",
    enPath: "/en/admin/system/security"
  },
  "security-policy": {
    titleKo: "보안 정책",
    titleEn: "Security Policy",
    koPath: "/admin/system/security-policy",
    enPath: "/en/admin/system/security-policy"
  },
  "security-monitoring": {
    titleKo: "보안 모니터링",
    titleEn: "Security Monitoring",
    koPath: "/admin/system/security-monitoring",
    enPath: "/en/admin/system/security-monitoring"
  },
  "blocklist": {
    titleKo: "차단 목록",
    titleEn: "Blocklist",
    koPath: "/admin/system/blocklist",
    enPath: "/en/admin/system/blocklist"
  },
  "security-audit": {
    titleKo: "보안 감사",
    titleEn: "Security Audit",
    koPath: "/admin/system/security-audit",
    enPath: "/en/admin/system/security-audit"
  },
  "scheduler-management": {
    titleKo: "스케줄러 관리",
    titleEn: "Scheduler Management",
    koPath: "/admin/system/scheduler",
    enPath: "/en/admin/system/scheduler"
  },
  "backup-config": {
    titleKo: "백업 설정",
    titleEn: "Backup Settings",
    koPath: "/admin/system/backup_config",
    enPath: "/en/admin/system/backup_config"
  },
  "backup-execution": {
    titleKo: "백업 실행",
    titleEn: "Backup Execution",
    koPath: "/admin/system/backup",
    enPath: "/en/admin/system/backup"
  },
  "restore-execution": {
    titleKo: "복구 실행",
    titleEn: "Restore Execution",
    koPath: "/admin/system/restore",
    enPath: "/en/admin/system/restore"
  },
  "version-management": {
    titleKo: "버전 관리",
    titleEn: "Version Management",
    koPath: "/admin/system/version",
    enPath: "/en/admin/system/version"
  },
  "codex-request": {
    titleKo: "Codex 요청",
    titleEn: "Codex Request",
    koPath: "/admin/system/codex-request",
    enPath: "/en/admin/system/codex-request"
  }
};

function resolveRouteId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("route") || "";
}

export function AdminTemplateFramePage() {
  const en = isEnglish();
  const routeId = resolveRouteId();
  const config = ADMIN_TEMPLATE_FRAME_CONFIG[routeId];

  if (!config) {
    return (
      <main className="bg-[#f8f9fa] min-h-screen p-8">
        <section className="mx-auto max-w-4xl rounded-[var(--kr-gov-radius)] border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-[var(--kr-gov-text-primary)]">
            {en ? "Admin parity route not found" : "관리자 패리티 경로를 찾을 수 없습니다"}
          </h1>
        </section>
      </main>
    );
  }

  const sourceUrl = buildLocalizedPath(config.koPath, config.enPath);

  return (
    <main className="min-h-screen bg-white">
      <iframe
        className="block h-screen w-full border-0 bg-white"
        src={sourceUrl}
        title={en ? config.titleEn : config.titleKo}
      />
    </main>
  );
}
