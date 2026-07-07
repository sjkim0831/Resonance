import type {
  AuthorGroup,
  AuthorGroupSection,
  AuthorRoleProfile,
  FeatureCatalogSection
} from "./authTypes";

export type MemberEditPagePayload = Record<string, unknown> & {
  member?: {
    entrprsmberId: string;
    applcntNm: string;
    applcntEmailAdres: string;
    zip: string;
    adres: string;
    detailAdres: string;
    marketingYn: string;
    deptNm: string;
  };
  phoneNumber?: string;
  memberTypeOptions?: Array<{ code: string; label: string }>;
  memberStatusOptions?: Array<{ code: string; label: string }>;
  permissionAuthorGroups?: AuthorGroup[];
  permissionFeatureSections?: FeatureCatalogSection[];
  permissionSelectedAuthorCode?: string;
  permissionEffectiveFeatureCodes?: string[];
  permissionRoleFeatureCodesByAuthorCode?: Record<string, string[]>;
  assignedRoleProfile?: AuthorRoleProfile;
  member_editError?: string;
  member_editUpdated?: boolean;
  canViewMemberEdit?: boolean;
  canUseMemberSave?: boolean;
  currentUserInsttId?: string;
  canManageAllCompanies?: boolean;
  canManageOwnCompany?: boolean;
  memberManagementScopeMode?: string;
  memberManagementRequiresInsttId?: boolean;
  targetMemberInsttId?: string;
  targetMemberType?: string;
};

export type PasswordResetPagePayload = Record<string, unknown> & {
  passwordResetHistoryList?: Array<Record<string, string>>;
  companyOptions?: Array<Record<string, string>>;
  selectedInsttId?: string;
  canManageAllCompanies?: boolean;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  searchKeyword?: string;
  resetSource?: string;
  passwordResetError?: string;
  canViewResetHistory?: boolean;
  canUseResetPassword?: boolean;
};

export type AdminPermissionPagePayload = Record<string, unknown> & {
  adminPermissionTarget?: {
    emplyrId: string;
    userNm: string;
    emailAdres: string;
    insttId: string;
    esntlId: string;
  };
  permissionAuthorGroups?: AuthorGroup[];
  permissionFeatureSections?: FeatureCatalogSection[];
  permissionSelectedAuthorCode?: string;
  permissionEffectiveFeatureCodes?: string[];
  adminPermissionError?: string;
  adminPermissionUpdated?: boolean;
  canViewAdminPermissionEdit?: boolean;
  canUseAdminPermissionSave?: boolean;
};

export type CompanySearchPayload = {
  list: Array<{
    insttId: string;
    cmpnyNm: string;
    bizrno: string;
    cxfc: string;
    joinStat: string;
    entrprsSeCode: string;
    chargerNm?: string;
    chargerEmail?: string;
    chargerTel?: string;
  }>;
  totalCnt: number;
  page: number;
  size: number;
  totalPages: number;
};

export type AdminAccountCreatePagePayload = Record<string, unknown> & {
  currentUserId?: string;
  adminAccountCreatePreset?: string;
  adminAccountCreatePresetAuthorCodes?: Record<string, string>;
  adminAccountCreatePresetFeatureCodes?: Record<string, string[]>;
  permissionFeatureSections?: FeatureCatalogSection[];
  permissionFeatureCount?: number;
  permissionPageCount?: number;
  adminAccountCreateError?: string;
  canViewAdminAccountCreate?: boolean;
  canUseAdminAccountCreate?: boolean;
};

export type CompanyAccountPagePayload = Record<string, unknown> & {
  companyAccountForm?: {
    insttId?: string;
    entrprsSeCode?: string;
    insttNm?: string;
    reprsntNm?: string;
    bizrno?: string;
    zip?: string;
    adres?: string;
    detailAdres?: string;
    chargerNm?: string;
    chargerEmail?: string;
    chargerTel?: string;
  };
  companyAccountFiles?: Array<{
    fileId?: string;
    orignlFileNm?: string;
    fileMg?: number;
  }>;
  companyAccountErrors?: string[];
  companyAccountSaved?: boolean;
  canViewCompanyAccount?: boolean;
  canUseCompanyAccountSave?: boolean;
  isEditMode?: boolean;
};

export type AdminListPagePayload = Record<string, unknown> & {
  member_list?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  sbscrbSttus?: string;
  canViewAdminList?: boolean;
  canUseAdminListActions?: boolean;
};

export type CompanyListPagePayload = Record<string, unknown> & {
  company_list?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  sbscrbSttus?: string;
  company_listError?: string;
  canViewCompanyList?: boolean;
  canUseCompanyListActions?: boolean;
};

export type MemberApprovePagePayload = Record<string, unknown> & {
  approvalRows?: Array<Record<string, unknown>>;
  memberApprovalTotalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  membershipType?: string;
  sbscrbSttus?: string;
  memberApprovalError?: string;
  memberApprovalResultMessage?: string;
  canViewMemberApprove?: boolean;
  canUseMemberApproveAction?: boolean;
};

export type CompanyApprovePagePayload = Record<string, unknown> & {
  approvalRows?: Array<Record<string, unknown>>;
  memberApprovalTotalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  sbscrbSttus?: string;
  memberApprovalError?: string;
  memberApprovalResultMessage?: string;
  canViewCompanyApprove?: boolean;
  canUseCompanyApproveAction?: boolean;
};

export type CertificateApprovePagePayload = Record<string, unknown> & {
  approvalRows?: Array<Record<string, unknown>>;
  certificateApprovalTotalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  requestType?: string;
  status?: string;
  certificateApprovalError?: string;
  certificateApprovalResultMessage?: string;
  canViewCertificateApprove?: boolean;
  canUseCertificateApproveAction?: boolean;
};

export type CertificatePendingPagePayload = Record<string, unknown> & {
  certificatePendingRows?: Array<Record<string, unknown>>;
  certificatePendingSummary?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  certificateType?: string;
  processStatus?: string;
  applicationId?: string;
  insttId?: string;
  selectedApplicationId?: string;
  selectedInsttId?: string;
  selectedInsttName?: string;
  selectedInsttNameEn?: string;
  canViewCertificatePending?: boolean;
  certificatePendingError?: string;
};

export type RefundAccountReviewPagePayload = Record<string, unknown> & {
  refundAccountRows?: Array<Record<string, unknown>>;
  refundAccountSummary?: Array<Record<string, unknown>>;
  refundAccountGuidance?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  searchKeyword?: string;
  verificationStatus?: string;
  payoutStatus?: string;
  canViewRefundAccountReview?: boolean;
  refundAccountReviewError?: string;
  isEn?: boolean;
};

export type CertificateObjectionListPagePayload = Record<string, unknown> & {
  certificateObjectionRows?: Array<Record<string, unknown>>;
  certificateObjectionSummary?: Array<Record<string, unknown>>;
  certificateObjectionGuidance?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  searchKeyword?: string;
  status?: string;
  priority?: string;
  canViewCertificateObjectionList?: boolean;
  certificateObjectionError?: string;
  isEn?: boolean;
};

export type CertificateReviewPagePayload = Record<string, unknown> & {
  certificateReviewRows?: Array<Record<string, unknown>>;
  certificateReviewSummary?: Array<Record<string, unknown>>;
  certificateReviewGuidance?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  searchKeyword?: string;
  status?: string;
  certificateType?: string;
  applicationId?: string;
  selectedRequestId?: string;
  canViewCertificateReview?: boolean;
  certificateReviewError?: string;
  isEn?: boolean;
};

export type CertificateRecCheckPagePayload = Record<string, unknown> & {
  duplicateGroups?: Array<Record<string, unknown>>;
  totalCount?: number;
  blockedCount?: number;
  reviewCount?: number;
  highestRisk?: number;
  lastRefreshedAt?: string;
  isEn?: boolean;
};

export type MemberListPagePayload = Record<string, unknown> & {
  member_list?: Array<Record<string, unknown>>;
  totalCount?: number;
  pageIndex?: number;
  totalPages?: number;
  searchKeyword?: string;
  membershipType?: string;
  sbscrbSttus?: string;
  member_listError?: string;
  canViewMemberList?: boolean;
  canUseMemberListActions?: boolean;
  currentUserInsttId?: string;
  canManageAllCompanies?: boolean;
  canManageOwnCompany?: boolean;
  memberManagementScopeMode?: string;
  memberManagementRequiresInsttId?: boolean;
  allowedMembershipTypes?: string[];
  memberTypeOptions?: Array<{ code: string; label: string }>;
  memberStatusOptions?: Array<{ code: string; label: string }>;
};

export type MemberDetailPagePayload = Record<string, unknown> & {
  member?: Record<string, unknown>;
  membershipTypeLabel?: string;
  statusLabel?: string;
  statusBadgeClass?: string;
  phoneNumber?: string;
  passwordResetHistoryRows?: Array<Record<string, string>>;
  latestPasswordResetAt?: string;
  latestPasswordResetBy?: string;
  member_detailError?: string;
  canViewMemberDetail?: boolean;
  canUseMemberEditLink?: boolean;
  currentUserInsttId?: string;
  canManageAllCompanies?: boolean;
  canManageOwnCompany?: boolean;
  memberManagementScopeMode?: string;
  memberManagementRequiresInsttId?: boolean;
  targetMemberInsttId?: string;
  targetMemberType?: string;
};

export type CompanyDetailPagePayload = Record<string, unknown> & {
  company?: Record<string, unknown>;
  companyFiles?: Array<Record<string, unknown>>;
  companyStatusLabel?: string;
  companyStatusBadgeClass?: string;
  companyTypeLabel?: string;
  companyDetailError?: string;
  canViewCompanyDetail?: boolean;
  canUseCompanyEditLink?: boolean;
};

export type SystemCodePagePayload = Record<string, unknown> & {
  clCodeList?: Array<Record<string, unknown>>;
  codeList?: Array<Record<string, unknown>>;
  detailCodeList?: Array<Record<string, unknown>>;
  detailCodeId?: string;
  useAtOptions?: string[];
  codeMgmtError?: string;
  isEn?: boolean;
};

export type MemberStatsPagePayload = Record<string, unknown> & {
  totalMembers?: number;
  memberTypeStats?: Array<Record<string, string>>;
  monthlySignupStats?: Array<Record<string, string>>;
  regionalDistribution?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type MemberRegisterPagePayload = Record<string, unknown> & {
  memberTypeOptions?: Array<Record<string, string>>;
  permissionOptions?: Array<Record<string, string>>;
  defaultOrganizationName?: string;
  departmentMappings?: Array<Record<string, string>>;
  memberAssignableAuthorGroups?: AuthorGroup[];
  memberAssignableAuthorGroupSections?: AuthorGroupSection[];
  roleProfilesByAuthorCode?: Record<string, AuthorRoleProfile>;
  currentUserInsttId?: string;
  canManageAllCompanies?: boolean;
  canManageOwnCompany?: boolean;
  canViewMemberRegister?: boolean;
  canUseMemberRegisterIdCheck?: boolean;
  canUseMemberRegisterOrgSearch?: boolean;
  canUseMemberRegisterSave?: boolean;
  memberRegisterFeatureCodes?: string[];
  isEn?: boolean;
};
