export type IpWhitelistPagePayload = Record<string, unknown> & {
  ipWhitelistSummary?: Array<Record<string, string>>;
  ipWhitelistRows?: Array<Record<string, string>>;
  ipWhitelistRequestRows?: Array<Record<string, string>>;
  searchIp?: string;
  accessScope?: string;
  status?: string;
};

export type AdminHomePagePayload = Record<string, unknown> & {
  summaryCards?: Array<Record<string, string>>;
  reviewQueueRows?: Array<Record<string, string>>;
  reviewProgressRows?: Array<Record<string, string>>;
  operationalStatusRows?: Array<Record<string, string>>;
  systemLogs?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type CertificateAuditLogPagePayload = Record<string, unknown> & {
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  searchKeyword?: string;
  auditType?: string;
  status?: string;
  certificateType?: string;
  startDate?: string;
  endDate?: string;
  lastUpdated?: string;
  certificateAuditSummary?: Array<Record<string, string>>;
  certificateAuditAlerts?: Array<Record<string, string>>;
  certificateAuditRows?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type OperationsCenterPagePayload = Record<string, unknown> & {
  overallStatus?: string;
  refreshedAt?: string;
  summaryCards?: Array<Record<string, string> & { domainType?: string; targetRoute?: string }>;
  priorityItems?: Array<Record<string, string> & { domainType?: string; sourceType?: string }>;
  widgetGroups?: Array<Record<string, unknown> & { domainType?: string; targetRoute?: string; quickLinks?: Array<Record<string, string>> }>;
  navigationSections?: Array<Record<string, unknown> & { links?: Array<Record<string, string>> }>;
  recentActions?: Array<Record<string, string>>;
  playbooks?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ProjectRuntimeRegistryItem = Record<string, string> & {
  projectId?: string;
  projectName?: string;
  owner?: string;
  status?: string;
  runtimeMode?: string;
  sharedRuntimeId?: string;
  compatibilityClass?: string;
  selectorPath?: string;
  routePrefix?: string;
  externalBaseUrl?: string;
  domainHost?: string;
  managementPath?: string;
  infoPath?: string;
  bootTarget?: string;
};

export type ProjectRuntimeRegistryPayload = {
  items?: ProjectRuntimeRegistryItem[];
};

export type PerformancePagePayload = Record<string, unknown> & {
  overallStatus?: string;
  refreshedAt?: string;
  slowThresholdMs?: number;
  requestWindowSize?: number;
  runtimeSummary?: Array<Record<string, string>>;
  requestSummary?: Array<Record<string, string>>;
  hotspotRoutes?: Array<Record<string, string>>;
  recentSlowRequests?: Array<Record<string, string>>;
  responseStatusSummary?: Array<Record<string, string>>;
  quickLinks?: Array<Record<string, string>>;
  guidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalConnectionListPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalConnectionSummary?: Array<Record<string, string>>;
  externalConnectionRows?: Array<Record<string, string>>;
  externalConnectionIssueRows?: Array<Record<string, string>>;
  externalConnectionQuickLinks?: Array<Record<string, string>>;
  externalConnectionGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalSchemaPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalSchemaSummary?: Array<Record<string, string>>;
  externalSchemaRows?: Array<Record<string, string>>;
  externalSchemaReviewRows?: Array<Record<string, string>>;
  externalSchemaQuickLinks?: Array<Record<string, string>>;
  externalSchemaGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalKeysPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalKeysSummary?: Array<Record<string, string>>;
  externalKeyRows?: Array<Record<string, string>>;
  externalKeyRotationRows?: Array<Record<string, string>>;
  externalKeyQuickLinks?: Array<Record<string, string>>;
  externalKeyGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalUsagePagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalUsageSummary?: Array<Record<string, string>>;
  externalUsageRows?: Array<Record<string, string>>;
  externalUsageKeyRows?: Array<Record<string, string>>;
  externalUsageTrendRows?: Array<Record<string, string>>;
  externalUsageQuickLinks?: Array<Record<string, string>>;
  externalUsageGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalLogsPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalLogSummary?: Array<Record<string, string>>;
  externalLogRows?: Array<Record<string, string>>;
  externalLogIssueRows?: Array<Record<string, string>>;
  externalLogConnectionRows?: Array<Record<string, string>>;
  externalLogQuickLinks?: Array<Record<string, string>>;
  externalLogGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalConnectionFormPagePayload = Record<string, unknown> & {
  connectionProfile?: Record<string, string>;
  refreshedAt?: string;
  externalConnectionFormSummary?: Array<Record<string, string>>;
  externalConnectionIssueRows?: Array<Record<string, string>>;
  externalConnectionQuickLinks?: Array<Record<string, string>>;
  externalConnectionGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
  mode?: string;
  success?: boolean;
  message?: string;
};

export type ExternalWebhooksPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  keyword?: string;
  syncMode?: string;
  status?: string;
  externalWebhookSummary?: Array<Record<string, string>>;
  externalWebhookRows?: Array<Record<string, string>>;
  externalWebhookDeliveryRows?: Array<Record<string, string>>;
  externalWebhookQuickLinks?: Array<Record<string, string>>;
  externalWebhookGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalSyncPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  externalSyncSummary?: Array<Record<string, string>>;
  externalSyncRows?: Array<Record<string, string>>;
  externalSyncQueueRows?: Array<Record<string, string>>;
  externalSyncExecutionRows?: Array<Record<string, string>>;
  externalSyncQuickLinks?: Array<Record<string, string>>;
  externalSyncGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalMonitoringPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalMonitoringSummary?: Array<Record<string, string>>;
  externalMonitoringRows?: Array<Record<string, string>>;
  externalMonitoringAlertRows?: Array<Record<string, string>>;
  externalMonitoringTimelineRows?: Array<Record<string, string>>;
  externalMonitoringQuickLinks?: Array<Record<string, string>>;
  externalMonitoringGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalMaintenancePagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  externalMaintenanceSummary?: Array<Record<string, string>>;
  externalMaintenanceRows?: Array<Record<string, string>>;
  externalMaintenanceImpactRows?: Array<Record<string, string>>;
  externalMaintenanceRunbooks?: Array<Record<string, string>>;
  externalMaintenanceQuickLinks?: Array<Record<string, string>>;
  externalMaintenanceGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type ExternalRetryPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  overallStatus?: string;
  externalRetrySummary?: Array<Record<string, string>>;
  externalRetryRows?: Array<Record<string, string>>;
  externalRetryPolicyRows?: Array<Record<string, string>>;
  externalRetryExecutionRows?: Array<Record<string, string>>;
  externalRetryQuickLinks?: Array<Record<string, string>>;
  externalRetryGuidance?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type SensorListPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  totalCount?: number;
  sensorSummary?: Array<Record<string, string>>;
  sensorRows?: Array<Record<string, string>>;
  sensorActivityRows?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type SchedulerManagementPagePayload = Record<string, unknown> & {
  jobStatus?: string;
  executionType?: string;
  schedulerSummary?: Array<Record<string, string>>;
  schedulerJobRows?: Array<Record<string, string>>;
  schedulerNodeRows?: Array<Record<string, string>>;
  schedulerExecutionRows?: Array<Record<string, string>>;
  schedulerPlaybooks?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type DbPromotionPolicyPagePayload = Record<string, unknown> & {
  dbPromotionPolicySummary?: Array<Record<string, string>>;
  dbPromotionPolicyRows?: Array<Record<string, string>>;
  dbPromotionPolicyRecentChangeRows?: Array<Record<string, string>>;
  dbPromotionPolicyGuidance?: Array<Record<string, string>>;
  dbPromotionPolicyMessage?: string;
  dbPromotionPolicySelectedTable?: string;
  isEn?: boolean;
  success?: boolean;
  message?: string;
};

export type DbSyncDeployPagePayload = Record<string, unknown> & {
  dbSyncDeploySummary?: Array<Record<string, string>>;
  dbSyncDeployGuardrailRows?: Array<Record<string, string>>;
  dbSyncDeploySqlFileRows?: Array<Record<string, string>>;
  dbSyncDeployExecutionContractRows?: Array<Record<string, string>>;
  dbSyncDeployPolicyValidationRows?: Array<Record<string, string>>;
  dbSyncDeployScriptChainRows?: Array<Record<string, string>>;
  dbSyncDeployGuidance?: Array<Record<string, string>>;
  dbSyncDeployExecutionRows?: Array<Record<string, string>>;
  dbSyncDeployExecutionLogRows?: Array<Record<string, string>>;
  dbSyncDeployHistoryRows?: Array<Record<string, string>>;
  dbSyncDeployScriptPath?: string;
  dbSyncDeployGeneratedAt?: string;
  dbSyncDeployAnalyzeMessage?: string;
  dbSyncDeployValidateMessage?: string;
  dbSyncDeployExecuteMessage?: string;
  isEn?: boolean;
  success?: boolean;
  message?: string;
};

export type BatchManagementPagePayload = Record<string, unknown> & {
  refreshedAt?: string;
  batchSummary?: Array<Record<string, string>>;
  batchJobRows?: Array<Record<string, string>>;
  batchQueueRows?: Array<Record<string, string>>;
  batchNodeRows?: Array<Record<string, string>>;
  batchExecutionRows?: Array<Record<string, string>>;
  batchRunbooks?: Array<Record<string, string>>;
  isEn?: boolean;
};

export type BackupConfigPagePayload = Record<string, unknown> & {
  backupConfigSummary?: Array<Record<string, string>>;
  backupConfigForm?: Record<string, string>;
  backupStorageRows?: Array<Record<string, string>>;
  backupExecutionRows?: Array<Record<string, string>>;
  backupVersionRows?: Array<Record<string, string>>;
  backupGitPrecheckRows?: Array<Record<string, string>>;
  backupRestoreGitRows?: Array<Record<string, string>>;
  backupRestoreSqlRows?: Array<Record<string, string>>;
  backupRestorePhysicalRows?: Array<Record<string, string>>;
  backupRestorePitrInfo?: Record<string, string>;
  backupRecoveryPlaybooks?: Array<Record<string, string>>;
  backupCurrentJob?: Record<string, unknown> | null;
  backupRecentJobs?: Array<Record<string, unknown>>;
  canUseBackupConfigSave?: boolean;
  canUseBackupExecution?: boolean;
  canUseDbBackupExecution?: boolean;
  canUseGitBackupExecution?: boolean;
  backupConfigUpdated?: boolean;
  backupConfigMessage?: string;
  backupJobStarted?: boolean;
  backupJobId?: string;
  isEn?: boolean;
};
