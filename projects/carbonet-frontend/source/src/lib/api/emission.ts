import { buildLocalizedPath } from "../navigation/runtime";
import {
  apiFetch,
  buildAdminApiPath,
  buildQueryParams,
  buildQueryString,
  buildResilientCsrfHeaders,
  fetchJson,
  fetchLocalizedPageJson,
  postFormData,
  postAdminJson,
  postJson,
  postLocalizedAction,
  readJsonResponse
} from "./core";
import type {
  EmissionCategoryItem,
  EmissionDataHistoryPagePayload,
  EmissionDefinitionMaterializeResponse,
  EmissionDefinitionDraftSavePayload,
  EmissionDefinitionDraftSaveResponse,
  EmissionDefinitionStudioPagePayload,
  EmissionFactorDefinition,
  EmissionGwpValueSavePayload,
  EmissionGwpValueSaveResponse,
  EmissionGwpValuesPagePayload,
  EmissionInputSessionSavePayload,
  EmissionLciClassificationPagePayload,
  EmissionLciClassificationSavePayload,
  EmissionManagementPagePayload,
  EmissionManagementElementSavePayload,
  EmissionManagementElementSaveResponse,
  EmissionResultDetailPagePayload,
  EmissionResultListPagePayload,
  EmissionSiteManagementPagePayload,
  EmissionSurveyAdminDataPagePayload,
  EmissionSurveyAdminPagePayload,
  EmissionSurveyCaseDraftSavePayload,
  EmissionSurveyClassificationLoadResponse,
  EmissionSurveyDatasetReplacePayload,
  EmissionSurveyDraftSetSavePayload,
  EmissionTierResponse,
  EmissionVariableDefinition,
  EmissionValidatePagePayload
} from "./emissionTypes";

type EmissionQueryParams = Record<string, string | number | boolean | null | undefined>;

function buildEmissionQuery(params?: EmissionQueryParams) {
  return buildQueryString(params);
}

export async function fetchEmissionGwpValuesPage(params?: {
  searchKeyword?: string;
  sectionCode?: string;
  rowId?: string;
  pdfComparePolicy?: string;
  includePdfCompare?: boolean;
  pdfCompareScope?: string;
}): Promise<EmissionGwpValuesPagePayload> {
  return fetchLocalizedPageJson<EmissionGwpValuesPagePayload>(
    "/admin/emission/gwp-values/page-data",
    "/en/admin/emission/gwp-values/page-data",
    { query: buildQueryParams(params) }
  );
}

export async function saveEmissionGwpValue(payload: EmissionGwpValueSavePayload): Promise<EmissionGwpValueSaveResponse> {
  return postJson<EmissionGwpValueSaveResponse>(
    buildAdminApiPath("/emission/api/gwp-values/save"),
    payload,
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function deleteEmissionGwpValue(rowId: string): Promise<{ success: boolean; message: string; rowId?: string }> {
  return postJson<{ success: boolean; message: string; rowId?: string }>(
    buildAdminApiPath("/emission/api/gwp-values/delete"),
    { rowId },
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function fetchEmissionResultListPage(params?: { pageIndex?: number; searchKeyword?: string; resultStatus?: string; verificationStatus?: string; }) {
  return fetchLocalizedPageJson<EmissionResultListPagePayload>(
    "/admin/emission/result_list/page-data",
    "/en/admin/emission/result_list/page-data",
    { query: buildQueryParams(params) }
  );
}

export async function fetchEmissionResultDetailPage(resultId: string) {
  return fetchLocalizedPageJson<EmissionResultDetailPagePayload>(
    "/admin/emission/result_detail/page-data",
    "/en/admin/emission/result_detail/page-data",
    { query: buildQueryParams(resultId ? { resultId } : undefined) }
  );
}

export async function fetchEmissionDataHistoryPage(params?: { pageIndex?: number; searchKeyword?: string; changeType?: string; changeTarget?: string; }) {
  return fetchLocalizedPageJson<EmissionDataHistoryPagePayload>(
    "/admin/emission/data_history/page-data",
    "/en/admin/emission/data_history/page-data",
    { query: buildQueryParams(params) }
  );
}

export async function fetchEmissionSiteManagementPage() {
  return fetchLocalizedPageJson<EmissionSiteManagementPagePayload>(
    "/admin/emission/site-management/page-data",
    "/en/admin/emission/site-management/page-data"
  );
}

export async function fetchEmissionManagementPage() {
  return fetchLocalizedPageJson<EmissionManagementPagePayload>(
    "/admin/emission/management/page-data",
    "/en/admin/emission/management/page-data"
  );
}

export async function fetchEmissionLciClassificationPage(params?: {
  searchKeyword?: string;
  level?: string;
  useAt?: string;
  code?: string;
}) {
  return fetchLocalizedPageJson<EmissionLciClassificationPagePayload>(
    "/admin/emission/lci-classification/page-data",
    "/en/admin/emission/lci-classification/page-data",
    { query: buildQueryParams(params) }
  );
}

export async function saveEmissionLciClassification(payload: EmissionLciClassificationSavePayload) {
  return postJson<{ success: boolean; message: string; code?: string; row?: Record<string, unknown> | null }>(
    buildAdminApiPath("/api/admin/emission/lci-classification/save"),
    payload,
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function deleteEmissionLciClassification(code: string) {
  return postJson<{ success: boolean; message: string; code?: string }>(
    buildAdminApiPath("/api/admin/emission/lci-classification/delete"),
    { code },
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function fetchEmissionSurveyAdminPage(params?: { productName?: string }) {
  return fetchLocalizedPageJson<EmissionSurveyAdminPagePayload>(
    "/admin/emission/survey-admin/page-data",
    "/en/admin/emission/survey-admin/page-data",
    { query: buildQueryParams(params) }
  );
}

export async function fetchEmissionSurveyAdminDataPage(filters: {
  lciMajorCode?: string;
  lciMiddleCode?: string;
  lciSmallCode?: string;
  status?: string;
  datasetId?: string;
  logId?: string;
  pageIndex?: number;
  pageSize?: number;
}) {
  return fetchLocalizedPageJson<EmissionSurveyAdminDataPagePayload>(
    "/admin/emission/survey-admin-data/page-data",
    "/en/admin/emission/survey-admin-data/page-data",
    { query: buildQueryParams(filters) }
  );
}

export async function fetchEmissionDefinitionStudioPage() {
  return fetchLocalizedPageJson<EmissionDefinitionStudioPagePayload>(
    "/admin/emission/definition-studio/page-data",
    "/en/admin/emission/definition-studio/page-data"
  );
}

export async function saveEmissionDefinitionDraft(payload: EmissionDefinitionDraftSavePayload) {
  return postJson<EmissionDefinitionDraftSaveResponse>(
    buildAdminApiPath("/api/admin/emission-definition-studio/drafts"),
    payload,
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function publishEmissionDefinitionDraft(draftId: string) {
  return postLocalizedAction<EmissionDefinitionDraftSaveResponse>(
    `/admin/api/admin/emission-definition-studio/drafts/${encodeURIComponent(draftId)}/publish`,
    `/en/admin/api/admin/emission-definition-studio/drafts/${encodeURIComponent(draftId)}/publish`
  );
}

export async function fetchEmissionValidatePage(params?: { pageIndex?: number; resultId?: string; searchKeyword?: string; verificationStatus?: string; priorityFilter?: string; }) {
  return fetchLocalizedPageJson<EmissionValidatePagePayload>(
    "/admin/emission/validate/page-data",
    "/en/admin/emission/validate/page-data",
    { query: buildQueryParams(params) }
  );
}

async function postEmissionJson<T>(koPath: string, enPath: string, payload?: unknown): Promise<T> {
  return postJson<T>(buildLocalizedPath(koPath, enPath), payload, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
}

async function postEmissionFormData<T>(koPath: string, enPath: string, formData: FormData): Promise<T> {
  return postFormData<T>(buildLocalizedPath(koPath, enPath), formData);
}

async function fetchEmissionJson<T>(koPath: string, enPath: string, query?: string): Promise<T> {
  return fetchJson<T>(`${buildLocalizedPath(koPath, enPath)}${query || ""}`, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
}

async function postEmissionAction<T>(koPath: string, enPath: string): Promise<T> {
  return postLocalizedAction<T>(koPath, enPath);
}

async function deleteEmissionAction<T>(koPath: string, enPath: string, query?: string): Promise<T> {
  const response = await apiFetch(`${buildLocalizedPath(koPath, enPath)}${query || ""}`, {
    method: "DELETE",
    credentials: "include",
    headers: await buildResilientCsrfHeaders({
      "X-Requested-With": "XMLHttpRequest"
    })
  });
  return readJsonResponse<T>(response);
}

export async function uploadEmissionSurveyWorkbook(uploadFile: File, context?: Record<string, string>) {
  const form = new FormData();
  form.set("uploadFile", uploadFile);
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      form.set(key, value || "");
    });
  }
  return postEmissionFormData<EmissionSurveyAdminPagePayload>(
    "/admin/api/admin/emission-survey-admin/parse-workbook",
    "/en/admin/api/admin/emission-survey-admin/parse-workbook",
    form
  );
}

export async function previewEmissionSurveySharedDataset(uploadFile: File) {
  const form = new FormData();
  form.append("uploadFile", uploadFile);
  return postEmissionFormData<EmissionSurveyAdminPagePayload>(
    "/admin/api/admin/emission-survey-admin/preview-shared-dataset",
    "/en/admin/api/admin/emission-survey-admin/preview-shared-dataset",
    form
  );
}

export async function replaceEmissionSurveySharedDataset(uploadFile: File) {
  const form = new FormData();
  form.append("uploadFile", uploadFile);
  return postEmissionFormData<EmissionSurveyAdminPagePayload>(
    "/admin/api/admin/emission-survey-admin/replace-shared-dataset",
    "/en/admin/api/admin/emission-survey-admin/replace-shared-dataset",
    form
  );
}

export async function replaceEmissionSurveySharedDatasetSections(payload: EmissionSurveyDatasetReplacePayload) {
  return postEmissionJson<EmissionSurveyAdminPagePayload>(
    "/admin/api/admin/emission-survey-admin/replace-shared-dataset-sections",
    "/en/admin/api/admin/emission-survey-admin/replace-shared-dataset-sections",
    payload
  );
}

export async function saveEmissionSurveyCaseDraft(payload: EmissionSurveyCaseDraftSavePayload) {
  return postEmissionJson<Record<string, unknown>>(
    "/admin/api/admin/emission-survey-admin/case-drafts",
    "/en/admin/api/admin/emission-survey-admin/case-drafts",
    payload
  );
}

export async function loadEmissionSurveyCaseDraftsByClassification(lciMajorCode: string, lciMiddleCode: string, lciSmallCode: string, caseCode: string, productName?: string) {
  return fetchEmissionJson<EmissionSurveyClassificationLoadResponse>(
    "/admin/api/admin/emission-survey-admin/case-drafts/by-classification",
    "/en/admin/api/admin/emission-survey-admin/case-drafts/by-classification",
    buildEmissionQuery({ lciMajorCode, lciMiddleCode, lciSmallCode, caseCode, productName })
  );
}

export async function deleteEmissionSurveyCaseDraft(sectionCode: string, caseCode: string, productName?: string) {
  return deleteEmissionAction<Record<string, unknown>>(
    "/admin/api/admin/emission-survey-admin/case-drafts",
    "/en/admin/api/admin/emission-survey-admin/case-drafts",
    buildEmissionQuery({ sectionCode, caseCode, productName })
  );
}

export async function saveEmissionSurveyDraftSet(payload: EmissionSurveyDraftSetSavePayload) {
  return postEmissionJson<Record<string, unknown>>(
    "/admin/api/admin/emission-survey-admin/draft-sets",
    "/en/admin/api/admin/emission-survey-admin/draft-sets",
    payload
  );
}

export async function deleteEmissionSurveyDraftSet(setId: string) {
  return deleteEmissionAction<Record<string, unknown>>(
    "/admin/api/admin/emission-survey-admin/draft-sets",
    "/en/admin/api/admin/emission-survey-admin/draft-sets",
    buildEmissionQuery({ setId })
  );
}

export function getEmissionSurveyTemplateDownloadUrl() {
  return buildLocalizedPath("/admin/api/admin/emission-survey-admin/template-download", "/en/admin/api/admin/emission-survey-admin/template-download");
}

export function getEmissionSurveySampleDownloadUrl() {
  return buildLocalizedPath("/admin/api/admin/emission-survey-admin/sample-download", "/en/admin/api/admin/emission-survey-admin/sample-download");
}

export function getEmissionSurveyAdminBlankTemplateDownloadUrl() {
  return buildLocalizedPath("/admin/api/admin/emission-survey-admin/admin-template-download", "/en/admin/api/admin/emission-survey-admin/admin-template-download");
}

export async function saveEmissionManagementElementDefinition(payload: EmissionManagementElementSavePayload) {
  return postEmissionJson<EmissionManagementElementSaveResponse>(
    "/admin/api/admin/emission-management/element-definitions",
    "/en/admin/api/admin/emission-management/element-definitions",
    payload
  );
}

export async function fetchEmissionCategories(searchKeyword?: string) {
  return fetchJson<{ items: EmissionCategoryItem[] }>(
    `${buildAdminApiPath("/api/admin/emission-management/categories")}${buildEmissionQuery({ searchKeyword })}`,
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function fetchEmissionTiers(categoryId: number) {
  return fetchJson<EmissionTierResponse>(
    buildAdminApiPath(`/api/admin/emission-management/categories/${encodeURIComponent(String(categoryId))}/tiers`),
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function fetchEmissionVariableDefinitions(categoryId: number, tier: number) {
  return fetchJson<{
    category?: EmissionCategoryItem;
    tier?: number;
    variables?: EmissionVariableDefinition[];
    factors?: EmissionFactorDefinition[];
    formulaSummary?: string;
    formulaDisplay?: string;
    publishedDefinition?: Record<string, unknown>;
    publishedDefinitionApplied?: boolean;
  }>(
    buildAdminApiPath(`/api/admin/emission-management/categories/${encodeURIComponent(String(categoryId))}/tiers/${encodeURIComponent(String(tier))}/variables`),
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function saveEmissionInputSession(payload: EmissionInputSessionSavePayload) {
  return postAdminJson<Record<string, unknown>>("/api/admin/emission-management/input-sessions", payload);
}

export async function fetchEmissionInputSession(sessionId: number) {
  return fetchJson<Record<string, unknown>>(
    buildAdminApiPath(`/api/admin/emission-management/input-sessions/${encodeURIComponent(String(sessionId))}`),
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function calculateEmissionInputSession(sessionId: number) {
  return postEmissionAction<Record<string, unknown>>(
    `/admin/api/admin/emission-management/input-sessions/${encodeURIComponent(String(sessionId))}/calculate`,
    `/en/admin/api/admin/emission-management/input-sessions/${encodeURIComponent(String(sessionId))}/calculate`
  );
}

export async function materializeEmissionDefinitionScope(draftId: string) {
  return postEmissionAction<EmissionDefinitionMaterializeResponse>(
    `/admin/api/admin/emission-management/definition-scopes/${encodeURIComponent(draftId)}/materialize`,
    `/en/admin/api/admin/emission-management/definition-scopes/${encodeURIComponent(draftId)}/materialize`
  );
}

export async function fetchEmissionScopeStatus(categoryCode: string, tier: number) {
  return fetchJson<Record<string, unknown>>(
    buildAdminApiPath(`/api/admin/emission-management/scopes/${encodeURIComponent(categoryCode)}/${encodeURIComponent(String(tier))}/status`),
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}

export async function precheckEmissionDefinitionScope(draftId: string) {
  return postEmissionAction<Record<string, unknown>>(
    `/admin/api/admin/emission-management/definition-scopes/${encodeURIComponent(draftId)}/precheck`,
    `/en/admin/api/admin/emission-management/definition-scopes/${encodeURIComponent(draftId)}/precheck`
  );
}

export async function fetchEmissionLimeDefaultFactor() {
  return fetchJson<Record<string, unknown>>(
    buildAdminApiPath("/api/admin/emission-management/lime/default-factor"),
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }
  );
}
