export type FrontendSession = {
  authenticated: boolean;
  actualUserId: string;
  userId: string;
  authorCode: string;
  insttId: string;
  companyScope: string;
  simulationAvailable: boolean;
  simulationActive: boolean;
  canEnterAdminConsole: boolean;
  csrfToken: string;
  csrfHeaderName: string;
  featureCodes: string[];
  capabilityCodes: string[];
};

export type AdminSessionSimulationOption = {
  insttId?: string;
  cmpnyNm?: string;
  emplyrId?: string;
  userNm?: string;
  orgnztId?: string;
  authorCode?: string;
  authorNm?: string;
};

export type AdminSessionSimulationPayload = {
  available: boolean;
  active: boolean;
  actualUserId: string;
  effectiveUserId: string;
  effectiveAuthorCode: string;
  effectiveInsttId: string;
  companyOptions: AdminSessionSimulationOption[];
  adminAccountOptions: AdminSessionSimulationOption[];
  authorOptions: AdminSessionSimulationOption[];
  selectedInsttId: string;
  selectedEmplyrId: string;
  selectedAuthorCode: string;
};

export type AdminMenuLink = {
  code?: string;
  text: string;
  tEn: string;
  u: string;
  icon: string;
};

export type AdminMenuGroup = {
  title: string;
  titleEn: string;
  icon: string;
  links: AdminMenuLink[];
};

export type AdminMenuDomain = {
  label: string;
  labelEn: string;
  summary: string;
  groups: AdminMenuGroup[];
};

export type AdminMenuTreePayload = Record<string, AdminMenuDomain>;

export const ADMIN_MENU_CODE_LABEL_OVERRIDES_KO: Record<string, string> = {
  A001: "회원",
  A00101: "회원",
  A00105: "이력",
  A002: "배출/인증",
  A00201: "배출",
  A003: "거래",
  A004: "콘텐츠",
  A005: "외부 연계",
  A006: "시스템",
  A00601: "환경",
  A00602: "보안",
  A00603: "로그",
  A00604: "백업",
  A007: "대시보드",
  A00701: "대시보드",
  A190: "AI 운영",
  A19001: "AI 작업센터",
  AMENU_AUTH: "권한",
  AMENU_MEMBER: "회원",
  AMENU_COMPANY: "회원사",
  AMENU_ADMIN: "관리자",
  AMENU_SYSTEM: "시스템"
};

export const ADMIN_MENU_CODE_LABEL_OVERRIDES_EN: Record<string, string> = {
  A001: "Members",
  A00101: "Members",
  A00105: "History",
  A002: "Emission",
  A00201: "Emission",
  A003: "Trading",
  A004: "Content",
  A005: "Integrations",
  A006: "System",
  A00601: "Environment",
  A00602: "Security",
  A00603: "Logs",
  A00604: "Backup",
  A007: "Dashboard",
  A00701: "Dashboard",
  A190: "AI Ops",
  A19001: "AI Workbench",
  AMENU_AUTH: "Authority",
  AMENU_MEMBER: "Members",
  AMENU_COMPANY: "Company",
  AMENU_ADMIN: "Admins",
  AMENU_SYSTEM: "System"
};
