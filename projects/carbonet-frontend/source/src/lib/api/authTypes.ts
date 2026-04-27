export type AuthGroupOption = {
  code: string;
  name: string;
};

export type AuthorGroup = {
  authorCode: string;
  authorNm: string;
  authorDc: string;
};

export type AuthorGroupSection = {
  layerKey: string;
  sectionLabel: string;
  groups: AuthorGroup[];
};

export type AuthorRoleProfile = {
  authorCode: string;
  displayTitle: string;
  priorityWorks: string[];
  description: string;
  memberEditVisibleYn: string;
  roleType?: string;
  baseRoleYn?: string;
  parentAuthorCode?: string;
  assignmentScope?: string;
  defaultMemberTypes?: string[];
  updatedAt?: string;
};

export type FeatureCatalogItem = {
  featureCode: string;
  featureNm: string;
  featureNmEn?: string;
  featureDc: string;
  useAt?: string;
  assignedRoleCount?: number;
  unassignedToRole?: boolean;
};

export type FeatureCatalogSection = {
  menuCode: string;
  menuNm: string;
  menuNmEn: string;
  menuUrl: string;
  features: FeatureCatalogItem[];
};

export type AuthGroupPagePayload = {
  isEn: boolean;
  currentUserId: string;
  isWebmaster: boolean;
  filteredAuthorGroups: AuthorGroup[];
  generalAuthorGroups?: AuthorGroup[];
  referenceAuthorGroups?: AuthorGroup[];
  featureSections: FeatureCatalogSection[];
  roleCategoryOptions: AuthGroupOption[];
  roleCategories?: Array<Record<string, string>>;
  recommendedRoleSections?: Array<Record<string, unknown>>;
  assignmentAuthorities?: Array<Record<string, string>>;
  selectedRoleCategory: string;
  selectedAuthorCode: string;
  selectedAuthorName: string;
  selectedFeatureCodes: string[];
  authorGroupCount: number;
  featureCount: number;
  catalogFeatureCount: number;
  pageCount: number;
  unassignedFeatureCount: number;
  canManageScopedAuthorityGroups: boolean;
  canManageAllCompanies?: boolean;
  canManageOwnCompany?: boolean;
  authGroupCompanyOptions: Array<{ insttId: string; cmpnyNm: string }>;
  authGroupSelectedInsttId: string;
  authGroupDepartmentRows?: Array<Record<string, string>>;
  authGroupDepartmentRoleSummaries?: Array<Record<string, string>>;
  userAuthorityTargets?: Array<Record<string, string>>;
  userSearchKeyword?: string;
  focusedMenuCode?: string;
  focusedFeatureCode?: string;
  selectedAuthorProfile?: AuthorRoleProfile;
  referenceAuthorProfilesByCode?: Record<string, AuthorRoleProfile>;
  authGroupError: string;
};

export type AdminRoleAssignment = {
  emplyrId: string;
  userNm: string;
  orgnztId: string;
  authorCode: string;
  authorNm: string;
  emplyrSttusCode: string;
};

export type AuthChangeHistoryRow = {
  changedAt: string;
  changedBy: string;
  targetUserId: string;
  beforeAuthorCode: string;
  beforeAuthorName: string;
  afterAuthorCode: string;
  afterAuthorName: string;
  resultStatus: string;
};

export type AuthChangePagePayload = {
  isEn: boolean;
  currentUserId: string;
  isWebmaster: boolean;
  canEditAuthChange?: boolean;
  roleAssignments: AdminRoleAssignment[];
  authorGroups: AuthorGroup[];
  authorGroupSections?: AuthorGroupSection[];
  recentRoleChangeHistory: AuthChangeHistoryRow[];
  assignmentCount: number;
  assignmentPageIndex: number;
  assignmentPageSize: number;
  assignmentTotalPages: number;
  assignmentSearchKeyword: string;
  authChangeUpdated: boolean;
  authChangeTargetUserId: string;
  authChangeMessage: string;
  authChangeError: string;
};

export type DeptRolePagePayload = {
  isEn: boolean;
  deptRoleUpdated: boolean;
  deptRoleTargetInsttId: string;
  deptRoleMessage: string;
  deptRoleError: string;
  currentUserId: string;
  isWebmaster: boolean;
  canManageAllCompanies: boolean;
  canManageOwnCompany: boolean;
  departmentMappings: Array<Record<string, string>>;
  departmentAuthorGroups: AuthorGroup[];
  memberAssignableAuthorGroups: AuthorGroup[];
  departmentCompanyOptions: Array<{ insttId: string; cmpnyNm: string }>;
  selectedInsttId: string;
  companyMembers: Array<{
    userId: string;
    userNm: string;
    deptNm: string;
    authorCode: string;
    authorNm: string;
  }>;
  roleProfilesByAuthorCode?: Record<string, AuthorRoleProfile>;
  companyMemberCount: number;
  companyMemberPageIndex?: number;
  companyMemberPageSize?: number;
  companyMemberTotalPages?: number;
  companyMemberSearchKeyword?: string;
  mappingCount: number;
};
