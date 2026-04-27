export type AccessHistoryPagePayload = Record<string, unknown> & {
  accessHistoryList?: Array<Record<string, unknown>>;
  companyOptions?: Array<Record<string, string>>;
  selectedInsttId?: string;
  canViewAccessHistory?: boolean;
  canManageAllCompanies?: boolean;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  startPage?: number;
  endPage?: number;
  prevPage?: number;
  nextPage?: number;
  searchKeyword?: string;
  accessHistoryError?: string;
  isEn?: boolean;
};

export type ErrorLogPagePayload = Record<string, unknown> & {
  errorLogList?: Array<Record<string, unknown>>;
  companyOptions?: Array<Record<string, string>>;
  sourceTypeOptions?: Array<Record<string, string>>;
  errorTypeOptions?: Array<Record<string, string>>;
  selectedInsttId?: string;
  selectedSourceType?: string;
  selectedErrorType?: string;
  canViewErrorLog?: boolean;
  canManageAllCompanies?: boolean;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  startPage?: number;
  endPage?: number;
  prevPage?: number;
  nextPage?: number;
  searchKeyword?: string;
  errorLogError?: string;
  isEn?: boolean;
};

export type LoginHistoryPagePayload = Record<string, unknown> & {
  loginHistoryList?: Array<Record<string, unknown>>;
  companyOptions?: Array<Record<string, string>>;
  securityHistoryActionRows?: Array<Record<string, string>>;
  securityHistoryActionByHistoryKey?: Record<string, Record<string, string>>;
  securityHistoryRelatedCountByHistoryKey?: Record<string, Record<string, number>>;
  securityHistoryAggregate?: Record<string, unknown>;
  selectedInsttId?: string;
  canManageAllCompanies?: boolean;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  startPage?: number;
  endPage?: number;
  prevPage?: number;
  nextPage?: number;
  searchKeyword?: string;
  userSe?: string;
  loginResult?: string;
  loginHistoryError?: string;
  isEn?: boolean;
};

export type SecurityHistoryActionResponse = Record<string, unknown> & {
  success?: boolean;
  message?: string;
  savedAction?: Record<string, string>;
};

export type SecurityPolicyPagePayload = Record<string, unknown> & {
  securityPolicySummary?: Array<Record<string, string>>;
  securityPolicyRows?: Array<Record<string, string>>;
  securityPolicyPlaybooks?: Array<Record<string, string>>;
  menuPermissionDiagnosticSqlDownloadUrl?: string;
  menuPermissionAuthGroupUrl?: string;
  menuPermissionEnvironmentUrl?: string;
  menuPermissionDiagnostics?: {
    generatedAt?: string;
    menuUrlDuplicateCount?: number;
    viewFeatureDuplicateCount?: number;
    cleanupRecommendationCount?: number;
    integrityIssueCount?: number;
    highRiskExposureCount?: number;
    scopeViolationCount?: number;
    message?: string;
    autoCleanupExecutableCount?: number;
    codexReviewRequiredCount?: number;
    duplicatedMenuUrls?: Array<Record<string, string>>;
    duplicatedViewMappings?: Array<Record<string, string>>;
    menusMissingView?: Array<Record<string, string>>;
    inactiveAuthorFeatureRelations?: Array<Record<string, string>>;
    inactiveUserOverrides?: Array<Record<string, string>>;
    sensitiveRoleExposures?: Array<Record<string, string>>;
    companyScopeSensitiveExposures?: Array<Record<string, string>>;
    securityInsightItems?: Array<Record<string, string>>;
    securityInsightTotal?: number;
    securityInsightActionRequiredCount?: number;
    securityInsightGradeCounts?: Record<string, number>;
    securityInsightGate?: Record<string, unknown>;
    securityInsightConfig?: Record<string, unknown>;
    securityInsightExplorer?: Record<string, unknown>;
    securityInsightMessage?: string;
  };
  isEn?: boolean;
};

export type NotificationPagePayload = SecurityPolicyPagePayload;

export type MenuPermissionAutoCleanupResponse = {
  success?: boolean;
  message?: string;
  disabledMenuCodes?: string[];
  processedMenuUrls?: string[];
  disabledMenuCount?: number;
  processedTargetCount?: number;
  diagnostics?: SecurityPolicyPagePayload["menuPermissionDiagnostics"];
};

export type SecurityMonitoringPagePayload = Record<string, unknown> & {
  securityMonitoringCards?: Array<Record<string, string>>;
  securityMonitoringTargets?: Array<Record<string, string>>;
  securityMonitoringIps?: Array<Record<string, string>>;
  securityMonitoringEvents?: Array<Record<string, string>>;
  securityMonitoringActivityRows?: Array<Record<string, string>>;
  securityMonitoringBlockCandidates?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type BlocklistPagePayload = Record<string, unknown> & {
  searchKeyword?: string;
  blockType?: string;
  status?: string;
  blocklistSummary?: Array<Record<string, string>>;
  blocklistRows?: Array<Record<string, string>>;
  blocklistReleaseQueue?: Array<Record<string, string>>;
  blocklistReleaseHistory?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type SecurityAuditPagePayload = Record<string, unknown> & {
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  searchKeyword?: string;
  actionType?: string;
  routeGroup?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
  sortDirection?: string;
  filteredBlockedCount?: number;
  filteredAllowedCount?: number;
  filteredUniqueActorCount?: number;
  filteredRouteCount?: number;
  filteredErrorCount?: number;
  filteredSlowCount?: number;
  filteredRepeatedActorCount?: number;
  filteredRepeatedTargetCount?: number;
  filteredRepeatedRemoteAddrCount?: number;
  latestSecurityAuditRow?: Record<string, string> | null;
  securityAuditSummary?: Array<Record<string, string>>;
  securityAuditRepeatedActors?: Array<Record<string, string>>;
  securityAuditRepeatedTargets?: Array<Record<string, string>>;
  securityAuditRepeatedRemoteAddrs?: Array<Record<string, string>>;
  securityAuditRows?: Array<Record<string, string>>;
  isEn?: boolean;
};
