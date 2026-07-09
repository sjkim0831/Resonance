import type { BootstrappedHomePayload } from "./appBootstrapTypes";
import type { AdminMenuTreePayload } from "./adminShellTypes";

type HomeMenuSection = {
  label?: string;
  items?: Array<{ label?: string; url?: string }>;
};

type HomeMenuRecord = {
  label?: string;
  url?: string;
  sections?: HomeMenuSection[];
};

const EMISSION_HOME_MENU_KO: HomeMenuRecord = {
  label: "탄소 배출",
  url: "/emission/index",
  sections: [
    {
      label: "업무 시작",
      items: [
        { label: "탄소 배출 대시보드", url: "/emission/index" },
        { label: "배출량 관리", url: "/emission/project_list" },
        { label: "내 배출 업무", url: "/emission/my-tasks" }
      ]
    },
    {
      label: "입력·검증",
      items: [
        { label: "활동자료 입력", url: "/emission/data_input" },
        { label: "증빙 자료함", url: "/emission/evidence" },
        { label: "검증·보정", url: "/emission/validate" }
      ]
    },
    {
      label: "산정·보고",
      items: [
        { label: "배출량 산정", url: "/emission/simulate" },
        { label: "산정 결과 조회", url: "/emission/result" },
        { label: "배출량 보고서 작성", url: "/emission/report_submit" }
      ]
    },
    {
      label: "분석·감축",
      items: [
        { label: "LCA 분석", url: "/emission/lca" },
        { label: "감축 시나리오", url: "/emission/reduction" },
        { label: "LCI DB 조회", url: "/emission/lci" }
      ]
    }
  ]
};

const EMISSION_HOME_MENU_EN: HomeMenuRecord = {
  label: "Carbon Emission",
  url: "/en/emission/index",
  sections: [
    {
      label: "Start",
      items: [
        { label: "Emission Dashboard", url: "/en/emission/index" },
        { label: "Emission Management", url: "/en/emission/project_list" },
        { label: "My Emission Tasks", url: "/en/emission/my-tasks" }
      ]
    },
    {
      label: "Input & Validation",
      items: [
        { label: "Activity Data Input", url: "/en/emission/data_input" },
        { label: "Evidence Library", url: "/en/emission/evidence" },
        { label: "Validation & Correction", url: "/en/emission/validate" }
      ]
    },
    {
      label: "Calculation & Report",
      items: [
        { label: "Emission Calculation", url: "/en/emission/simulate" },
        { label: "Calculation Results", url: "/en/emission/result" },
        { label: "Emission Report", url: "/en/emission/report_submit" }
      ]
    },
    {
      label: "Analysis & Reduction",
      items: [
        { label: "LCA Analysis", url: "/en/emission/lca" },
        { label: "Reduction Scenario", url: "/en/emission/reduction" },
        { label: "LCI DB", url: "/en/emission/lci" }
      ]
    }
  ]
};

const EMISSION_ADMIN_DOMAIN = {
  label: "배출량 관리",
  labelEn: "Emission Management",
  summary: "배출지, 계수, 입력 템플릿, 검증, 산정, 보고서, 증빙, 감사, 외부연계를 관리합니다.",
  groups: [
    {
      title: "기준정보",
      titleEn: "Master Data",
      icon: "account_tree",
      links: [
        { code: "AMENU_EMISSION_SITE_SOURCE", text: "배출지·배출원 원장", tEn: "Sites & Sources", u: "/admin/emission/site-management", icon: "domain" },
        { code: "AMENU_EMISSION_FACTOR", text: "배출계수 관리", tEn: "Emission Factors", u: "/admin/emission/factor-management", icon: "science" },
        { code: "AMENU_EMISSION_CALC_RULE", text: "산정식 관리", tEn: "Calculation Rules", u: "/admin/emission/calculation-rule", icon: "functions" },
        { code: "AMENU_EMISSION_INPUT_TEMPLATE", text: "입력 템플릿 관리", tEn: "Input Templates", u: "/admin/emission/input-template", icon: "view_list" }
      ]
    },
    {
      title: "검증·승인",
      titleEn: "Validation & Approval",
      icon: "fact_check",
      links: [
        { code: "AMENU_EMISSION_VALIDATE", text: "검증 관리", tEn: "Validation Queue", u: "/admin/emission/validate", icon: "rule" },
        { code: "AMENU_EMISSION_VALIDATION_RULE", text: "검증 규칙 관리", tEn: "Validation Rules", u: "/admin/emission/validation-rule", icon: "rule_settings" },
        { code: "AMENU_EMISSION_APPROVAL_WORKFLOW", text: "승인 워크플로우 관리", tEn: "Approval Workflow", u: "/admin/emission/approval-workflow", icon: "approval" }
      ]
    },
    {
      title: "산정·보고",
      titleEn: "Calculation & Report",
      icon: "summarize",
      links: [
        { code: "AMENU_EMISSION_RESULT_LIST", text: "산정 결과 관리", tEn: "Calculation Results", u: "/admin/emission/result_list", icon: "analytics" },
        { code: "AMENU_EMISSION_REPORT_TEMPLATE", text: "보고서 템플릿 관리", tEn: "Report Templates", u: "/admin/emission/report-template", icon: "description" },
        { code: "AMENU_EMISSION_GWP", text: "GWP 값 관리", tEn: "GWP Values", u: "/admin/emission/gwp-values", icon: "public" },
        { code: "AMENU_EMISSION_ECOINVENT", text: "ecoinvent 배출계수 관리", tEn: "ecoinvent Factors", u: "/admin/emission/ecoinvent", icon: "science" }
      ]
    },
    {
      title: "증빙·감사·연계",
      titleEn: "Evidence, Audit & Integration",
      icon: "verified_user",
      links: [
        { code: "AMENU_EMISSION_EVIDENCE", text: "증빙 관리", tEn: "Evidence Management", u: "/admin/emission/evidence-management", icon: "folder_open" },
        { code: "AMENU_EMISSION_DATA_HISTORY", text: "데이터 변경 이력", tEn: "Data Change History", u: "/admin/emission/data_history", icon: "history" },
        { code: "AMENU_EMISSION_AUDIT_LOG", text: "감사 로그", tEn: "Audit Log", u: "/admin/emission/audit-log", icon: "receipt_long" },
        { code: "AMENU_EMISSION_SYSTEM_LINK", text: "외부 시스템 연계", tEn: "External System Links", u: "/admin/emission/system-link", icon: "hub" }
      ]
    },
    {
      title: "설문·LCA",
      titleEn: "Survey & LCA",
      icon: "assignment",
      links: [
        { code: "AMENU_EMISSION_SURVEY_ADMIN", text: "배출 설문 관리", tEn: "Emission Survey", u: "/admin/emission/survey-admin", icon: "assignment" },
        { code: "AMENU_EMISSION_SURVEY_DATA", text: "배출 설문 데이터셋", tEn: "Survey Dataset", u: "/admin/emission/survey-admin-data", icon: "dataset" },
        { code: "AMENU_EMISSION_LCI_CLASS", text: "LCI 분류 관리", tEn: "LCI Classification", u: "/admin/emission/lci-classification", icon: "category" },
        { code: "AMENU_EMISSION_DEFINITION", text: "배출 정의 관리", tEn: "Emission Definition", u: "/admin/emission/definition-studio", icon: "schema" }
      ]
    }
  ]
};

function isEmissionHomeMenu(menu: HomeMenuRecord) {
  const label = String(menu.label || "");
  const url = String(menu.url || "");
  return label.includes("탄소") || label.toLowerCase().includes("emission") || url.includes("/emission/");
}

export function normalizeHomeEmissionMenu<T extends BootstrappedHomePayload | null | undefined>(payload: T): T {
  if (!payload) {
    return payload;
  }
  const emissionMenu = payload.isEn ? EMISSION_HOME_MENU_EN : EMISSION_HOME_MENU_KO;
  const sourceMenu = (payload.homeMenu || []) as HomeMenuRecord[];
  const nextMenu = sourceMenu.length
    ? sourceMenu.map((menu) => (isEmissionHomeMenu(menu) ? emissionMenu : menu))
    : [emissionMenu];
  if (!nextMenu.some(isEmissionHomeMenu)) {
    nextMenu.unshift(emissionMenu);
  }
  return { ...payload, homeMenu: nextMenu as Array<Record<string, unknown>> } as T;
}

export function normalizeAdminEmissionMenuTree(payload: AdminMenuTreePayload): AdminMenuTreePayload {
  const nextTree: AdminMenuTreePayload = { ...(payload || {}) };
  nextTree.A002 = EMISSION_ADMIN_DOMAIN;
  return nextTree;
}
