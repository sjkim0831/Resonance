export type ProjectVersionOverviewPayload = {
  projectId: string;
  projectDisplayName?: string;
  activeRuntimeVersion?: string;
  activeCommonCoreVersion?: string;
  activeAdapterContractVersion?: string;
  activeAdapterArtifactVersion?: string;
  installedArtifactSet?: Array<Record<string, unknown>>;
  installedPackageSet?: Array<Record<string, unknown>>;
  rollbackReadyReleaseUnitId?: string;
};

export type ProjectVersionListPayload = {
  projectId: string;
  itemSet?: Array<Record<string, unknown>>;
  totalCount?: number;
};

export type ProjectVersionServerStatePayload = {
  projectId: string;
  serverStateSet?: Array<Record<string, unknown>>;
};

export type ProjectFleetUpgradeGovernancePayload = {
  projectId: string;
  artifactLocks?: ProjectVersionListPayload;
  compatibilityRuns?: ProjectVersionListPayload;
  recommendedNextStepSet?: Array<Record<string, unknown>>;
};

export type ProjectVersionManagementPagePayload = {
  overview: ProjectVersionOverviewPayload;
  adapterHistory: ProjectVersionListPayload;
  releaseUnits: ProjectVersionListPayload;
  serverDeployState: ProjectVersionServerStatePayload;
  candidateArtifacts: ProjectVersionListPayload;
  fleetGovernance: ProjectFleetUpgradeGovernancePayload;
};

export type DbChangeCaptureSummaryPayload = {
  projectId?: string;
  totalChangeCount?: number;
  autoQueuedChangeCount?: number;
  approvalRequiredChangeCount?: number;
  blockedChangeCount?: number;
  pendingQueueCount?: number;
  pendingApprovalQueueCount?: number;
};

export type DbBusinessChangeLogRow = Record<string, unknown>;
export type DbDeployablePatchQueueRow = Record<string, unknown>;
export type DbDeployablePatchResultRow = Record<string, unknown>;

export type ProjectVersionOpsJobPayload = {
  jobId?: string;
  projectId?: string;
  executionType?: string;
  profileName?: string;
  remoteDeployMode?: string;
  actorId?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  duration?: string;
  resultMessage?: string;
  logLines?: string[];
};

export type ProjectVersionOpsPayload = {
  projectId?: string;
  remoteHost?: string;
  launcherPath?: string;
  scriptPath?: string;
  defaultRemoteDeployMode?: string;
  remoteDeployModeOptionSet?: Array<Record<string, unknown>>;
  launcherPresentYn?: string;
  scriptPresentYn?: string;
  deployAutomationConfiguredYn?: string;
  backupCoverageSet?: string[];
  launcherExclusiveSet?: string[];
  recommendedFlowSet?: string[];
  recentDeploymentHistory?: Array<Record<string, unknown>>;
  currentRemoteJob?: ProjectVersionOpsJobPayload | null;
  recentRemoteJobs?: ProjectVersionOpsJobPayload[];
  remoteJobStarted?: boolean;
  remoteJobId?: string;
  message?: string;
};

export type ProjectVersionTargetArtifactPayload = {
  artifactId: string;
  artifactVersion: string;
};

export type ProjectUpgradeImpactResponse = {
  projectId: string;
  currentVersionSet?: Record<string, unknown>;
  targetVersionSet?: Record<string, unknown>;
  compatibilityClass?: string;
  adapterImpactSummary?: string;
  artifactDelta?: Array<Record<string, unknown>>;
  packageDelta?: Array<Record<string, unknown>>;
  runtimePackageDelta?: string;
  blockerSet?: string[];
  rollbackTargetReleaseId?: string;
  upgradeReadyYn?: boolean;
};

export type ProjectApplyUpgradeResponse = {
  projectId: string;
  releaseUnitId?: string;
  runtimePackageId?: string;
  appliedArtifactSet?: Array<Record<string, unknown>>;
  compatibilityClass?: string;
  deployReadyYn?: boolean;
  rollbackTargetReleaseId?: string;
};

export type ProjectRollbackResponse = {
  projectId: string;
  rolledBackToReleaseUnitId?: string;
  runtimePackageId?: string;
  deployTraceId?: string;
  status?: string;
  restoredArtifactSet?: Array<Record<string, unknown>>;
  rollbackTargetReleaseId?: string;
};

export type PlatformInstallPagePayload = {
  summary?: Record<string, unknown>;
  installedModels?: Array<Record<string, unknown>>;
  runtimeProfiles?: Array<Record<string, unknown>>;
  runnerProfiles?: Array<Record<string, unknown>>;
  routerProfiles?: Array<Record<string, unknown>>;
  agentProfiles?: Array<Record<string, unknown>>;
  toolchainProfiles?: Array<Record<string, unknown>>;
  commonJarSet?: Array<Record<string, unknown>>;
  projectPackageSet?: Array<Record<string, unknown>>;
  k8sReleaseProfiles?: Array<Record<string, unknown>>;
  builderStructure?: Record<string, unknown>;
  promotionWaveStatus?: Array<Record<string, unknown>>;
  operationReadiness?: Array<Record<string, unknown>>;
  patternReferenceManifestPath?: string;
  bundleChecklist?: string[];
  recommendedActions?: string[];
  message?: string;
};

export type PlatformOperationPreviewPayload = {
  operationId?: string;
  scriptPath?: string;
  fileReadyYn?: string;
  commandReadyYn?: string;
  status?: string;
  note?: string;
  previewLines?: string[];
};

export type PlatformOperationVerifyPayload = {
  operationId?: string;
  status?: string;
  checks?: Array<Record<string, unknown>>;
  summaryMessage?: string;
};

export type PlatformOperationDryRunPayload = {
  operationId?: string;
  status?: string;
  summaryMessage?: string;
  commandPreview?: string[];
  resolvedInputs?: Array<Record<string, unknown>>;
  plannedSteps?: string[];
};

export type ScreenBuilderNode = {
  nodeId: string;
  componentId?: string;
  parentNodeId?: string;
  componentType: string;
  slotName?: string;
  sortOrder: number;
  props: Record<string, unknown>;
};

export type ScreenBuilderEventBinding = {
  eventBindingId: string;
  nodeId: string;
  eventName: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
};

export type ScreenBuilderPaletteItem = {
  componentType: string;
  label: string;
  labelEn?: string;
  description?: string;
};

export type ScreenBuilderComponentRegistryItem = {
  componentId: string;
  componentType: string;
  label: string;
  labelEn?: string;
  description?: string;
  status?: string;
  replacementComponentId?: string;
  sourceType?: string;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  propsTemplate?: Record<string, unknown>;
};

export type ScreenBuilderComponentUsage = {
  usageSource: string;
  usageStatus?: string;
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
  layoutZone?: string;
  instanceKey?: string;
  nodeId?: string;
  componentId: string;
  versionId?: string;
};

export type ScreenBuilderRegistryIssue = {
  nodeId: string;
  componentId?: string;
  componentType: string;
  label: string;
  reason: string;
  replacementComponentId?: string;
};

export type ScreenBuilderComponentPromptSurface = {
  componentId: string;
  componentType: string;
  status?: string;
  replacementComponentId?: string;
  label: string;
  description?: string;
  allowedPropKeys: string[];
  propsTemplate: Record<string, unknown>;
};

export type ScreenBuilderRegistryScanItem = {
  menuCode: string;
  pageId: string;
  menuTitle: string;
  unregisteredCount: number;
  missingCount: number;
  deprecatedCount: number;
};

export type ScreenBuilderAutoReplacePreviewItem = {
  nodeId: string;
  fromComponentId: string;
  toComponentId: string;
  label: string;
};

export type ScreenBuilderVersionSummary = {
  versionId: string;
  versionStatus: string;
  menuCode: string;
  pageId: string;
  templateType: string;
  savedAt: string;
  nodeCount: number;
  eventCount: number;
};

export type ScreenBuilderPagePayload = {
  isEn: boolean;
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
  builderId: string;
  versionId: string;
  versionStatus: string;
  templateType: string;
  authorityProfile?: {
    roleKey?: string;
    authorCode?: string;
    label?: string;
    description?: string;
    tier?: string;
    actorType?: string;
    scopePolicy?: string;
    hierarchyLevel?: number;
    featureCodes?: string[];
    tags?: string[];
  };
  componentPalette: ScreenBuilderPaletteItem[];
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  componentTypeOptions?: string[];
  registryDiagnostics?: {
    unregisteredNodes?: ScreenBuilderRegistryIssue[];
    missingNodes?: ScreenBuilderRegistryIssue[];
    deprecatedNodes?: ScreenBuilderRegistryIssue[];
    componentPromptSurface?: ScreenBuilderComponentPromptSurface[];
  };
  nodes: ScreenBuilderNode[];
  events: ScreenBuilderEventBinding[];
  versionHistory?: ScreenBuilderVersionSummary[];
  publishedVersionId?: string;
  publishedSavedAt?: string;
  releaseUnitId?: string;
  runtimePackageId?: string;
  deployTraceId?: string;
  artifactEvidence?: {
    artifactSourceSystem?: string;
    artifactTargetSystem?: string;
    releaseUnitId?: string;
    runtimePackageId?: string;
    deployTraceId?: string;
    publishedVersionId?: string;
    publishedSavedAt?: string;
    artifactKind?: string;
    artifactPathHint?: string;
  };
  previewAvailable: boolean;
  screenBuilderMessage?: string;
};

export type ScreenBuilderPreviewPayload = {
  isEn: boolean;
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
  templateType: string;
  authorityProfile?: ScreenBuilderPagePayload["authorityProfile"];
  versionStatus?: string;
  releaseUnitId?: string;
  artifactEvidence?: ScreenBuilderPagePayload["artifactEvidence"];
  registryDiagnostics?: {
    unregisteredNodes?: ScreenBuilderRegistryIssue[];
    missingNodes?: ScreenBuilderRegistryIssue[];
    deprecatedNodes?: ScreenBuilderRegistryIssue[];
    componentPromptSurface?: ScreenBuilderComponentPromptSurface[];
  };
  nodes: ScreenBuilderNode[];
  events: ScreenBuilderEventBinding[];
};

export type ScreenBuilderStatusSummaryItem = {
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
  publishedVersionId: string;
  publishedSavedAt: string;
  releaseUnitId: string;
  artifactTargetSystem: string;
  runtimePackageId: string;
  deployTraceId: string;
  publishFreshnessState: "UNPUBLISHED" | "FRESH" | "AGING" | "STALE" | "UNKNOWN";
  publishFreshnessLabel: string;
  publishFreshnessDetail: string;
  parityState: "UNAVAILABLE" | "MATCH" | "DRIFT" | "GAP";
  parityLabel: string;
  parityDetail: string;
  parityTraceId: string;
  versionCount: number;
  unregisteredCount: number;
  missingCount: number;
  deprecatedCount: number;
};

export type ScreenBuilderStatusSummaryResponse = {
  items: ScreenBuilderStatusSummaryItem[];
  count: number;
  projectId: string;
};

export type AuditEventSearchPayload = {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  items: Array<Record<string, unknown>>;
};

export type TraceEventSearchPayload = {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  items: Array<Record<string, unknown>>;
};

export type CodexHistoryPayload = {
  totalCount: number;
  items: Array<Record<string, unknown>>;
};

export type HelpManagementItem = {
  itemId: string;
  title: string;
  body: string;
  anchorSelector: string;
  displayOrder: number;
  activeYn: string;
  placement: string;
  imageUrl: string;
  iconName: string;
  highlightStyle: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type HelpManagementPagePayload = {
  pageId: string;
  source: string;
  title: string;
  summary: string;
  helpVersion: string;
  activeYn: string;
  items: HelpManagementItem[];
};

export type ScreenCommandPageOption = {
  pageId: string;
  label: string;
  routePath: string;
  menuCode: string;
  domainCode: string;
};

export type ScreenCommandSurface = {
  surfaceId: string;
  label: string;
  selector: string;
  componentId: string;
  layoutZone: string;
  eventIds: string[];
  notes: string;
};

export type ScreenCommandFieldSpec = {
  fieldId: string;
  type: string;
  required: boolean;
  source: string;
  notes: string;
};

export type ScreenCommandMaskRule = {
  fieldId: string;
  strategy: string;
  notes: string;
};

export type ScreenCommandEvent = {
  eventId: string;
  label: string;
  eventType: string;
  frontendFunction: string;
  triggerSelector: string;
  apiIds: string[];
  notes: string;
  functionInputs: ScreenCommandFieldSpec[];
  functionOutputs: ScreenCommandFieldSpec[];
  guardConditions: string[];
  sideEffects: string[];
};

export type ScreenCommandApi = {
  apiId: string;
  label: string;
  method: string;
  endpoint: string;
  controllerAction: string;
  controllerActions?: string[];
  serviceMethod: string;
  serviceMethods?: string[];
  mapperQuery: string;
  mapperQueries?: string[];
  relatedTables: string[];
  schemaIds: string[];
  notes: string;
  requestFields: ScreenCommandFieldSpec[];
  responseFields: ScreenCommandFieldSpec[];
  maskingRules: ScreenCommandMaskRule[];
};

export type ScreenCommandSchema = {
  schemaId: string;
  label: string;
  tableName: string;
  columns: string[];
  writePatterns: string[];
  notes: string;
};

export type ScreenCommandCodeGroup = {
  codeGroupId: string;
  label: string;
  values: string[];
  notes: string;
};

export type ScreenCommandChangeTarget = {
  targetId: string;
  label: string;
  editableFields: string[];
  notes: string;
};

export type ScreenCommandFeatureRow = {
  menuCode: string;
  menuNm: string;
  menuNmEn: string;
  menuUrl: string;
  featureCode: string;
  featureNm: string;
  featureNmEn: string;
  featureDc: string;
  useAt: string;
};

export type ScreenCommandMenuPermission = {
  menuCode: string;
  menuLookupUrl: string;
  routePath: string;
  requiredViewFeatureCode: string;
  featureCodes: string[];
  featureRows: ScreenCommandFeatureRow[];
  relationTables: string[];
  resolverNotes: string[];
};

export type ScreenCommandPageDetail = ScreenCommandPageOption & {
  summary: string;
  source: string;
  menuLookupUrl: string;
  summaryMetrics?: {
    surfaceCount: number;
    eventCount: number;
    apiCount: number;
    schemaCount: number;
    changeTargetCount: number;
    featureCount: number;
    relationTableCount: number;
    componentCount: number;
  };
  manifestRegistry?: {
    pageId: string;
    pageName: string;
    routePath: string;
    menuCode: string;
    domainCode: string;
    layoutVersion: string;
    designTokenVersion: string;
    componentCount: number;
    components: Array<Record<string, unknown>>;
  };
  surfaces: ScreenCommandSurface[];
  events: ScreenCommandEvent[];
  apis: ScreenCommandApi[];
  schemas: ScreenCommandSchema[];
  commonCodeGroups: ScreenCommandCodeGroup[];
  menuPermission: ScreenCommandMenuPermission;
  changeTargets: ScreenCommandChangeTarget[];
};

export type ScreenCommandPagePayload = {
  selectedPageId: string;
  pages: ScreenCommandPageOption[];
  page: ScreenCommandPageDetail;
};

export type FullStackGovernanceRegistryEntry = {
  menuCode: string;
  pageId: string;
  menuUrl: string;
  summary: string;
  ownerScope: string;
  notes: string;
  frontendSources: string[];
  componentIds: string[];
  eventIds: string[];
  functionIds: string[];
  parameterSpecs: string[];
  resultSpecs: string[];
  apiIds: string[];
  controllerActions: string[];
  serviceMethods: string[];
  mapperQueries: string[];
  schemaIds: string[];
  tableNames: string[];
  columnNames: string[];
  featureCodes: string[];
  commonCodeGroups: string[];
  tags: string[];
  updatedAt: string;
  source: string;
};

export type FullStackGovernanceAutoCollectRequest = {
  menuCode: string;
  pageId: string;
  menuUrl: string;
  mergeExisting?: boolean;
  save?: boolean;
};

export type SrTicketRow = {
  ticketId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastActionBy: string;
  approvedBy: string;
  approvedAt: string;
  approvalComment: string;
  executionPreparedAt: string;
  executionPreparedBy: string;
  executionStatus: string;
  executionComment: string;
  queueStatus: string;
  queueMode: string;
  queueSubmittedAt: string;
  queueStartedAt: string;
  queueCompletedAt: string;
  queueRequestedBy: string;
  queueLaneId: string;
  queueTmuxSessionName: string;
  queueErrorMessage: string;
  pageId: string;
  pageLabel: string;
  routePath: string;
  menuCode: string;
  menuLookupUrl: string;
  surfaceId: string;
  surfaceLabel: string;
  eventId: string;
  eventLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string;
  instruction: string;
  technicalContext: string;
  generatedDirection: string;
  commandPrompt: string;
  planRunId: string;
  planStartedAt: string;
  planCompletedAt: string;
  planLogPath: string;
  planStderrPath: string;
  planResultPath: string;
  executionRunId: string;
  executionStartedAt: string;
  executionStartedBy: string;
  executionCompletedAt: string;
  executionCompletedBy: string;
  executionLogPath: string;
  executionStderrPath: string;
  executionDiffPath: string;
  executionChangedFiles: string;
  executionWorktreePath: string;
  backendVerifyLogPath: string;
  backendVerifyStderrPath: string;
  frontendVerifyLogPath: string;
  frontendVerifyStderrPath: string;
  deployLogPath: string;
  deployStderrPath: string;
  backendVerifyExitCode: number | null;
  frontendVerifyExitCode: number | null;
  deployExitCode: number | null;
  deployCommand: string;
  healthCheckStatus: string;
  rollbackStatus: string;
  rollbackLogPath: string;
  rollbackStderrPath: string;
};

export type SrTicketArtifactSummary = {
  artifactType: string;
  label: string;
  filePath: string;
  available: boolean;
};

export type SrTicketArtifactPayload = {
  success: boolean;
  ticketId: string;
  artifactType: string;
  label: string;
  filePath: string;
  available: boolean;
  content: string;
  truncated: boolean;
  message: string;
};

export type SrWorkbenchStackItem = {
  stackItemId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  pageId: string;
  pageLabel: string;
  routePath: string;
  menuCode: string;
  menuLookupUrl: string;
  surfaceId: string;
  surfaceLabel: string;
  selector: string;
  componentId: string;
  eventId: string;
  eventLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string;
  instruction: string;
  technicalContext: string;
  traceId: string;
  requestId: string;
};

export type SrTicketDetailPayload = {
  success: boolean;
  ticket: SrTicketRow;
  availableArtifacts: SrTicketArtifactSummary[];
  reviewSummary?: {
    planStderrSnippet?: string;
    buildStderrSnippet?: string;
    backendVerifySnippet?: string;
    frontendVerifySnippet?: string;
    deploySnippet?: string;
    rollbackSnippet?: string;
  };
};

export type SrWorkbenchPagePayload = {
  selectedPageId: string;
  codexEnabled: boolean;
  codexHistoryFile: string;
  ticketCount: number;
  stackCount: number;
  stackItems: SrWorkbenchStackItem[];
  tickets: SrTicketRow[];
  screenOptions: ScreenCommandPageOption[];
};

export type FunctionManagementPagePayload = Record<string, unknown> & {
  menuType?: string;
  featurePageOptions?: Array<Record<string, unknown>>;
  featureRows?: Array<Record<string, unknown>>;
  featureTotalCount?: number;
  featureUnassignedCount?: number;
  useAtOptions?: string[];
  searchMenuCode?: string;
  searchKeyword?: string;
  featureMgmtError?: string;
};

export type MenuManagementPagePayload = Record<string, unknown> & {
  menuType?: string;
  menuRows?: Array<Record<string, unknown>>;
  menuTypes?: Array<Record<string, unknown>>;
  groupMenuOptions?: Array<Record<string, string>>;
  iconOptions?: string[];
  useAtOptions?: string[];
  expsrAtOptions?: string[];
  fullStackSummaryRows?: Array<Record<string, unknown>>;
  menuMgmtError?: string;
  menuMgmtMessage?: string;
  menuMgmtGuide?: string;
  siteMapMgmtGuide?: string;
};

export type WbsManagementPagePayload = Record<string, unknown> & {
  menuType?: string;
  scope?: string;
  menuRows?: Array<Record<string, unknown>>;
  wbsRows?: Array<Record<string, unknown>>;
  inventorySummary?: Record<string, unknown>;
  waveSummary?: Array<Record<string, unknown>>;
  statusOptions?: Array<Record<string, string>>;
  timeline?: Record<string, unknown>;
  today?: string;
};

export type VerificationCenterPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  serverGeneratedAt?: string;
  summary?: Record<string, unknown>;
  quickActions?: Array<Record<string, unknown>>;
  baselineRegistry?: Array<Record<string, unknown>>;
  verificationRuns?: Array<Record<string, unknown>>;
  managedVault?: Record<string, unknown>;
  actionQueue?: Array<Record<string, unknown>>;
};

export type VerificationCenterRunResponse = Record<string, unknown> & {
  success?: boolean;
  message?: string;
  runId?: string;
  traceId?: string;
  actionType?: string;
  actorId?: string;
  result?: string;
  followupPath?: string;
  startedAt?: string;
};

export type VerificationAssetManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  serverGeneratedAt?: string;
  summary?: Record<string, unknown>;
  baselineRegistry?: Array<Record<string, unknown>>;
  managedVault?: Record<string, unknown>;
  actionQueue?: Array<Record<string, unknown>>;
};

export type VerificationAssetMutationResponse = Record<string, unknown> & {
  success?: boolean;
  message?: string;
  item?: Record<string, unknown>;
  itemType?: string;
};

export type NewPagePagePayload = Record<string, unknown> & {
  isEn?: boolean;
  pageId?: string;
  canonicalMenuUrl?: string;
  localizedMenuUrl?: string;
  menuCode?: string;
  menuName?: string;
  menuNameEn?: string;
  menuIcon?: string;
  useAt?: string;
  sortOrder?: number;
  requiredViewFeatureCode?: string;
  featureCount?: number;
  featureCodes?: string[];
  roleAssignments?: Array<Record<string, unknown>>;
  menuAncestry?: Array<Record<string, unknown>>;
  manifest?: Record<string, unknown>;
  governanceNotes?: Array<Record<string, string>>;
};

export type PageManagementPagePayload = Record<string, unknown> & {
  pageRows?: Array<Record<string, unknown>>;
  menuType?: string;
  domainOptions?: Array<Record<string, unknown>>;
  iconOptions?: string[];
  useAtOptions?: string[];
  searchKeyword?: string;
  searchUrl?: string;
  pageMgmtError?: string;
  pageMgmtMessage?: string;
  pageMgmtBlockedFeatureLinks?: Array<Record<string, string>>;
};

export type CodexProvisionPagePayload = Record<string, unknown> & {
  codexEnabled?: boolean;
  codexApiKeyConfigured?: boolean;
  codexRunnerEnabled?: boolean;
  codexAvailabilityMessage?: string;
  codexSamplePayload?: string;
  codexRuntimeConfig?: {
    runnerEnabled?: boolean;
    repoRoot?: string;
    workspaceRoot?: string;
    runnerHistoryFile?: string;
    planCommandConfigured?: boolean;
    buildCommandConfigured?: boolean;
    deployCommandConfigured?: boolean;
    planCommand?: string;
    buildCommand?: string;
    deployCommand?: string;
    healthCheckUrl?: string;
    parallelLanes?: number;
  };
  srTicketCount?: number;
  srTickets?: SrTicketRow[];
  executionLaneCount?: number;
  executionLanes?: Array<Record<string, unknown>>;
  isEn?: boolean;
};

export type SystemAssetInventoryVO = {
  assetId: string;
  assetType: string;
  assetName: string;
  assetVersion: string;
  sourcePath: string;
  sourceSymbol: string;
  contentHash: string;
  assetFamily?: string;
  ownerDomain: string;
  ownerScope?: string;
  operatorOwner?: string;
  serviceOwner?: string;
  criticality: string;
  healthStatus: string;
  lastScanAt: string;
  activeYn: string;
  createdAt: string;
  updatedAt: string;
};

export type SystemAssetCompositionVO = {
  compositionId: string;
  parentAssetId: string;
  childAssetId: string;
  relationType: string;
  mappingNotes: string;
  createdAt: string;
};

export type SystemAssetScanLogVO = {
  scanId: string;
  assetId: string;
  previousHash: string;
  currentHash: string;
  scanResult: string;
  scanDetails: string;
  createdAt: string;
};

export type AssetScanSummary = {
  total: number;
  newCount: number;
  updatedCount: number;
  driftedCount: number;
  durationMs: number;
};

export type SystemAssetDetailPayload = {
  asset: SystemAssetInventoryVO;
  compositions: SystemAssetCompositionVO[];
  scanLogs: SystemAssetScanLogVO[];
};

export type SystemAssetEnrichedComposition = {
  composition: SystemAssetCompositionVO;
  asset: SystemAssetInventoryVO;
};

export type SystemAssetImpactPayload = {
  asset: SystemAssetInventoryVO;
  upstream: SystemAssetEnrichedComposition[];
  downstream: SystemAssetEnrichedComposition[];
};

export type SystemAssetGapSummary = {
  missingOwnerCount: number;
  missingCriticalityCount: number;
  driftedCount: number;
  orphanCount: number;
};

export type SystemAssetGapPayload = {
  summary: SystemAssetGapSummary;
  assets?: SystemAssetInventoryVO[];
};

export type SystemAssetLifecyclePayload = {
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
  plans: SystemAssetLifecyclePlanVO[];
  totalEvidenceCount: number;
};

export type SystemAssetLifecyclePlanVO = {
  planId: string;
  assetId: string;
  targetStage: string;
  planStatus: string;
  requesterId: string;
  approverId?: string;
  targetDate?: string;
  reason: string;
  createdAt: string;
  updatedAt?: string;
};

export type SystemAssetLifecycleEvidenceVO = {
  evidenceId: string;
  planId: string;
  checkpointKey: string;
  evidenceType: string;
  evidenceValue: string;
  verifiedBy: string;
  createdAt: string;
};
