export type EmissionGwpValuesPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  sectionCode?: string;
  selectedRowId?: string;
  documentName?: string;
  documentSourcePath?: string;
  documentTargetPath?: string;
  pdfOcrStatus?: string;
  pdfOcrStatusLabel?: string;
  pdfOcrStatusDetail?: string;
  pdfOcrInstallHint?: string;
  pdfComparePolicy?: string;
  pdfComparePolicyLabel?: string;
  pdfComparePolicyOptions?: Array<Record<string, string>>;
  pdfCompareLoaded?: boolean;
  pdfCompareScope?: string;
  summaryCards?: Array<Record<string, string>>;
  pdfComparisonSummary?: Array<Record<string, string>>;
  sectionOptions?: Array<Record<string, string>>;
  gwpRows?: Array<Record<string, string>>;
  selectedRow?: Record<string, string>;
  governanceNotes?: Array<Record<string, string>>;
  methaneGuidance?: Array<Record<string, string>>;
};

export type EmissionLciClassificationPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  level?: string;
  useAt?: string;
  selectedCode?: string;
  catalogSource?: string;
  catalogSourceLabel?: string;
  summaryCards?: Array<Record<string, string>>;
  levelOptions?: Array<Record<string, string>>;
  classificationRows?: Array<Record<string, unknown>>;
  selectedClassification?: Record<string, unknown> | null;
  governanceNotes?: Array<Record<string, string>>;
};

export type EmissionLciClassificationSavePayload = {
  originalCode?: string;
  code: string;
  label: string;
  tierLabel: string;
  aliases: string;
  useAt: string;
};

export type EmissionGwpValueSavePayload = {
  rowId?: string;
  sectionCode: string;
  commonName: string;
  formula: string;
  ar4Value: string;
  ar5Value: string;
  ar6Value: string;
  source: string;
  manualInputValue: string;
  note: string;
  sortOrder: number;
};

export type EmissionGwpValueSaveResponse = {
  success: boolean;
  message: string;
  rowId?: string;
  row?: Record<string, string>;
  compareStatus?: string;
  compareStatusLabel?: string;
  compareMismatchLabels?: string;
  compareMismatchFields?: string[];
  pdfCompareStatus?: string;
  pdfCompareStatusLabel?: string;
  pdfComparePage?: string;
  pdfCompareSource?: string;
  pdfCompareSourceLabel?: string;
  pdfCompareDetail?: string;
};

export type EmissionSiteManagementPagePayload = {
  isEn?: boolean;
  menuCode?: string;
  menuUrl?: string;
  homeReferenceUrl?: string;
  referenceFolder?: string;
  summaryCards?: Array<Record<string, string>>;
  quickLinks?: Array<Record<string, string>>;
  operationCards?: Array<Record<string, string>>;
  featureRows?: Array<Record<string, string>>;
  referenceRows?: Array<Record<string, string>>;
};

export type EmissionValidatePagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  resultId?: string;
  searchKeyword?: string;
  verificationStatus?: string;
  priorityFilter?: string;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  totalCount?: number;
  pendingCount?: number;
  inProgressCount?: number;
  failedCount?: number;
  highPriorityCount?: number;
  summaryCards?: Array<Record<string, string>>;
  queueRows?: Array<Record<string, string>>;
  selectedResultFound?: boolean;
  selectedResult?: Record<string, string>;
  priorityLegend?: Array<Record<string, string>>;
  policyRows?: Array<Record<string, string>>;
  actionLinks?: Array<Record<string, string>>;
};

export type EmissionManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  menuUrl?: string;
  pageTitle?: string;
  pageTitleEn?: string;
  pageDescription?: string;
  pageDescriptionEn?: string;
  elementRegistrySummary?: Array<Record<string, string>>;
  elementRegistryRows?: Array<Record<string, unknown>>;
  selectedElementDefinition?: Record<string, unknown>;
  elementTypeOptions?: Array<Record<string, string>>;
  layoutZoneOptions?: Array<Record<string, string>>;
  componentTypeOptions?: Array<Record<string, string>>;
  formulaReference?: Record<string, unknown>;
  rolloutSummaryCards?: Array<Record<string, string>>;
  rolloutStatusRows?: Array<Record<string, unknown>>;
  definitionScopeSummaryCards?: Array<Record<string, string>>;
  definitionScopeRows?: Array<Record<string, unknown>>;
  definitionDraftRows?: Array<Record<string, unknown>>;
  definitionPolicyOptions?: Array<Record<string, string>>;
  selectedDefinitionDraft?: Record<string, unknown>;
  publishedDefinitionRows?: Array<Record<string, unknown>>;
  selectedPublishedDefinition?: Record<string, unknown>;
};

export type EmissionSurveyAdminColumn = {
  key: string;
  label: string;
  headerPath?: string;
};

export type EmissionSurveyAdminRow = {
  rowId?: string;
  values?: Record<string, string>;
};

export type EmissionSurveyAdminSection = {
  sectionCode?: string;
  majorCode?: string;
  majorLabel?: string;
  sectionLabel?: string;
  sheetName?: string;
  titleRowLabel?: string;
  guidance?: string[];
  metadata?: Array<Record<string, string>>;
  columns?: EmissionSurveyAdminColumn[];
  rows?: EmissionSurveyAdminRow[];
};

export type EmissionSurveyDatasetReplacePayload = {
  sourceFileName?: string;
  sourcePath?: string;
  targetPath?: string;
  sections: Array<Record<string, unknown>>;
};

export type EmissionSurveyClassificationLoadResponse = Record<string, unknown> & {
  lciMajorCode?: string;
  lciMiddleCode?: string;
  lciSmallCode?: string;
  caseCode?: string;
  productName?: string;
  matchedCount?: number;
  matchedCaseMap?: Record<string, Record<string, unknown>>;
  message?: string;
};

export type EmissionSurveyAdminPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  currentActorId?: string;
  pageTitle?: string;
  pageDescription?: string;
  sourceFileName?: string;
  sourcePath?: string;
  targetPath?: string;
  uploaded?: boolean;
  summaryCards?: Array<Record<string, string>>;
  majorOptions?: Array<Record<string, string>>;
  sectionOptions?: Array<Record<string, string>>;
  caseOptions?: Array<Record<string, string>>;
  productOptions?: Array<Record<string, string>>;
  selectedProductName?: string;
  workbookGuidance?: string[];
  sections?: EmissionSurveyAdminSection[];
  savedCaseMap?: Record<string, Record<string, unknown>>;
  savedSetMap?: Record<string, Record<string, unknown>>;
  uploadLogRows?: Array<Record<string, unknown>>;
  uploadAudit?: Record<string, unknown>;
};

export type EmissionSurveyCaseDraftSavePayload = {
  ownerActorId?: string;
  datasetId?: string;
  datasetName?: string;
  productName?: string;
  sectionCode: string;
  caseCode: string;
  majorCode: string;
  lciMajorCode: string;
  lciMajorLabel?: string;
  lciMiddleCode: string;
  lciMiddleLabel?: string;
  lciSmallCode: string;
  lciSmallLabel?: string;
  sectionLabel: string;
  sourceFileName?: string;
  sourcePath?: string;
  targetPath?: string;
  titleRowLabel?: string;
  guidance?: string[];
  columns?: EmissionSurveyAdminColumn[];
  rows: Array<{
    rowId: string;
    values: Record<string, string>;
  }>;
};

export type EmissionSurveyDraftSetSavePayload = {
  setId?: string;
  setName: string;
  sourceFileName?: string;
  sourcePath?: string;
  targetPath?: string;
  sections: Array<Record<string, unknown>>;
};

export type EmissionSurveyAdminDataPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  currentActorId?: string;
  pageTitle?: string;
  pageDescription?: string;
  lciMajorCode?: string;
  lciMiddleCode?: string;
  lciSmallCode?: string;
  status?: string;
  datasetId?: string;
  logId?: string;
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  summaryCards?: Array<Record<string, string>>;
  statusOptions?: Array<Record<string, string>>;
  datasetRows?: Array<Record<string, unknown>>;
  uploadLogRows?: Array<Record<string, unknown>>;
  selectedDatasetSectionRows?: Array<Record<string, unknown>>;
  selectedLog?: Record<string, unknown>;
  selectedLogSectionResults?: Array<Record<string, unknown>>;
};

export type EmissionManagementElementSavePayload = {
  definitionId?: string;
  elementKey: string;
  elementName: string;
  elementType: string;
  layoutZone: string;
  componentType: string;
  bindingTarget: string;
  defaultLabel: string;
  defaultLabelEn: string;
  description: string;
  variableScope: string;
  policyNote: string;
  directRequiredCodes: string[];
  fallbackCodes: string[];
  autoCalculatedCodes: string[];
  useYn: string;
  tags: string[];
};

export type EmissionManagementElementSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  definitionId?: string;
  message?: string;
  elementRegistryRows?: Array<Record<string, unknown>>;
  selectedElementDefinition?: Record<string, unknown>;
};

export type EmissionDefinitionStudioPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  menuUrl?: string;
  pageTitle?: string;
  pageTitleEn?: string;
  pageDescription?: string;
  pageDescriptionEn?: string;
  summaryCards?: Array<Record<string, string>>;
  quickLinks?: Array<Record<string, string>>;
  seedCategories?: Array<Record<string, string>>;
  seedTiers?: Array<Record<string, string>>;
  policyOptions?: Array<Record<string, string>>;
  saveChecklist?: Array<Record<string, string>>;
  governanceNotes?: Array<Record<string, string>>;
  definitionRows?: Array<Record<string, unknown>>;
  selectedDefinition?: Record<string, unknown>;
  sections?: Array<Record<string, unknown>>;
};

export type EmissionDefinitionDraftSavePayload = {
  draftId?: string;
  categoryCode: string;
  categoryName: string;
  tierLabel: string;
  formula: string;
  formulaTree?: Array<Record<string, unknown>>;
  inputMode: string;
  policies: string[];
  directRequiredCodes: string[];
  fallbackCodes: string[];
  autoCalculatedCodes: string[];
  supplementalCodes: string[];
  sections: Array<Record<string, unknown>>;
  variableDefinitions: Array<Record<string, unknown>>;
  runtimeMode?: string;
  note: string;
};

export type EmissionDefinitionDraftSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  published?: boolean;
  draftId?: string;
  message?: string;
  draftDetail?: Record<string, unknown>;
  definitionRows?: Array<Record<string, unknown>>;
};

export type EmissionDefinitionMaterializeResponse = Record<string, unknown> & {
  success?: boolean;
  draftId?: string;
  categoryId?: number;
  categoryCode?: string;
  tier?: number;
  createdCategory?: boolean;
  insertedVariableCount?: number;
  updatedVariableCount?: number;
  skippedFields?: string[];
  message?: string;
};

export type EmissionCategoryItem = Record<string, unknown> & {
  categoryId?: number;
  majorCode?: string;
  majorName?: string;
  subCode?: string;
  subName?: string;
  classificationCode?: string;
  classificationPath?: string;
  classificationTierLabel?: string;
  useYn?: string;
};

export type EmissionTierItem = Record<string, unknown> & {
  tier?: number;
  tierLabel?: string;
};

export type EmissionTierResponse = {
  category?: EmissionCategoryItem;
  tiers?: EmissionTierItem[];
  unsupportedTiers?: EmissionTierItem[];
  warning?: string;
};

export type EmissionVariableDefinition = Record<string, unknown> & {
  variableId?: number;
  categoryId?: number;
  tier?: number;
  varCode?: string;
  varName?: string;
  varDesc?: string;
  unit?: string;
  inputType?: string;
  sourceType?: string;
  isRepeatable?: string;
  isRequired?: string;
  sortOrder?: number;
  useYn?: string;
  commonCodeId?: string;
  options?: Array<Record<string, string>>;
  displayName?: string;
  displayCode?: string;
  uiHint?: string;
  derivedYn?: string;
  supplementalYn?: string;
  repeatGroupKey?: string;
  sectionId?: string;
  sectionOrder?: number;
  sectionTitle?: string;
  sectionDescription?: string;
  sectionFormula?: string;
  sectionPreviewType?: string;
  sectionRelatedFactorCodes?: string;
  visibleWhen?: string;
  disabledWhen?: string;
};

export type EmissionFactorDefinition = Record<string, unknown> & {
  factorId?: number;
  categoryId?: number;
  tier?: number;
  factorCode?: string;
  factorName?: string;
  factorValue?: number;
  unit?: string;
  defaultYn?: string;
  remark?: string;
};

export type EmissionInputValuePayload = {
  varCode: string;
  lineNo?: number;
  valueNum?: number | null;
  valueText?: string;
};

export type EmissionInputSessionSavePayload = {
  categoryId: number;
  tier: number;
  createdBy?: string;
  values: EmissionInputValuePayload[];
};

export type EmissionResultListPagePayload = Record<string, unknown> & {
  emissionResultList?: Array<Record<string, unknown>>;
  totalCount?: number;
  reviewCount?: number;
  verifiedCount?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  startPage?: number;
  endPage?: number;
  prevPage?: number;
  nextPage?: number;
  searchKeyword?: string;
  resultStatus?: string;
  verificationStatus?: string;
  isEn?: boolean;
};

export type EmissionResultDetailPagePayload = Record<string, unknown> & {
  found?: boolean;
  resultId?: string;
  projectName?: string;
  companyName?: string;
  calculatedAt?: string;
  totalEmission?: string;
  resultStatusCode?: string;
  resultStatusLabel?: string;
  verificationStatusCode?: string;
  verificationStatusLabel?: string;
  reportPeriod?: string;
  submittedAt?: string;
  formulaVersion?: string;
  verificationOwner?: string;
  reviewMessage?: string;
  reviewChecklist?: Array<Record<string, unknown>>;
  siteRows?: Array<Record<string, unknown>>;
  evidenceRows?: Array<Record<string, unknown>>;
  historyRows?: Array<Record<string, unknown>>;
  siteCount?: number;
  evidenceCount?: number;
  listUrl?: string;
  verificationActionUrl?: string;
  historyUrl?: string;
  pageError?: string;
  isEn?: boolean;
};

export type EmissionDataHistoryPagePayload = Record<string, unknown> & {
  historyRows?: Array<Record<string, unknown>>;
  totalCount?: number;
  correctionCount?: number;
  approvalCount?: number;
  schemaCount?: number;
  summaryCards?: Array<Record<string, unknown>>;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
  searchKeyword?: string;
  changeType?: string;
  changeTarget?: string;
  changeTypeOptions?: Array<Record<string, unknown>>;
  changeTargetOptions?: Array<Record<string, unknown>>;
  changeTypeMeta?: Record<string, Record<string, unknown>>;
  changeTargetMeta?: Record<string, Record<string, unknown>>;
  isEn?: boolean;
};
