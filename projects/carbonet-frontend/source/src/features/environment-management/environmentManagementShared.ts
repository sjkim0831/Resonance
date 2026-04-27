import { findManifestByMenuCodeOrRoutePath, normalizeManifestLookupPath } from "../../platform/screen-registry/pageManifestIndex";
import { getScreenCommandChainValues } from "../../lib/api/screenCommand";
import type { FullStackGovernanceRegistryEntry, ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";
import { buildSuggestedPageCode as buildSharedSuggestedPageCode } from "../menu-management/menuTreeShared";
import { toDisplayMenuUrl } from "../menu-management/menuUrlDisplay";
export {
  buildCurrentRuntimeComparePath,
  buildRepairWorkbenchPath,
  buildScreenBuilderPath,
  buildScreenRuntimePath
} from "../screen-builder/screenBuilderPaths";

export type ManagedMenuRow = {
  code: string;
  label: string;
  labelEn: string;
  menuUrl: string;
  menuIcon: string;
  useAt: string;
  sortOrdr: number;
  parentCode: string;
};

export type FeatureDraft = {
  featureCode: string;
  featureNm: string;
  featureNmEn: string;
  featureDc: string;
  useAt: string;
};

export type SelectedMenuDraft = {
  codeNm: string;
  codeDc: string;
  menuUrl: string;
  menuIcon: string;
  useAt: string;
};

export type FeatureDeleteImpact = {
  featureCode: string;
  assignedRoleCount: number;
  userOverrideCount: number;
};

export type PageDeleteImpact = {
  code: string;
  defaultViewFeatureCode: string;
  linkedFeatureCodes: string[];
  nonDefaultFeatureCodes: string[];
  defaultViewRoleRefCount: number;
  defaultViewUserOverrideCount: number;
  blocked: boolean;
};

export type UrlValidation = {
  tone: "neutral" | "success" | "warning";
  message: string;
};

export type GovernanceRemediationItem = {
  title: string;
  description: string;
  href?: string;
  actionLabel: string;
  actionKind: "link" | "autoCollect" | "permissions";
};

export type GovernanceOverview = {
  summary: string;
  pageId: string;
  source: string;
  tags: string[];
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
};

export type GovernanceChildElement = {
  instanceKey: string;
  componentId: string;
  componentName: string;
  layoutZone: string;
  designReference: string;
  notes: string;
};

export type GovernanceSurfaceChain = {
  surfaceId: string;
  label: string;
  selector: string;
  componentId: string;
  layoutZone: string;
  notes: string;
  childElements: GovernanceChildElement[];
  events: Array<{
    eventId: string;
    label: string;
    eventType: string;
    frontendFunction: string;
    triggerSelector: string;
    notes: string;
    functionInputs: Array<{ fieldId: string; type: string; source: string; required: boolean; notes: string }>;
    functionOutputs: Array<{ fieldId: string; type: string; source: string; required: boolean; notes: string }>;
    apis: Array<{
      apiId: string;
      label: string;
      method: string;
      endpoint: string;
      controllerActions: string[];
      serviceMethods: string[];
      mapperQueries: string[];
      requestFields: Array<{ fieldId: string; type: string; source: string; required: boolean; notes: string }>;
      responseFields: Array<{ fieldId: string; type: string; source: string; required: boolean; notes: string }>;
      schemaIds: string[];
      relatedTables: string[];
      schemas: Array<{ schemaId: string; label: string; tableName: string; columns: string[]; notes: string }>;
    }>;
  }>;
};

export type GovernanceSurfaceEventTableRow = {
  surfaceLabel: string;
  surfaceId: string;
  childElements: string;
  eventLabel: string;
  eventId: string;
  eventType: string;
  frontendFunction: string;
  parameters: string;
  results: string;
  apiLabels: string;
  controllerActions: string;
  serviceMethods: string;
  mapperQueries: string;
};

export type ScreenBuilderIssueBreakdown = {
  unregisteredCount: number;
  missingCount: number;
  deprecatedCount: number;
};

export type ScreenBuilderFreshnessSummary = {
  state: "UNPUBLISHED" | "FRESH" | "AGING" | "STALE" | "UNKNOWN";
  label: string;
  detail: string;
};

export type ScreenBuilderParitySummary = {
  state: "UNAVAILABLE" | "MATCH" | "DRIFT" | "GAP";
  label: string;
  detail: string;
  traceId: string;
};

export type ScreenBuilderStatus = {
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

export const ENVIRONMENT_MANAGEMENT_MENU_CODE = "A0060118";

const KNOWN_GOVERNANCE_PAGE_IDS: Record<string, string> = {
  A0060118: "environment-management"
};

export function resolveDefaultSelectedMenuCode(menuType: string, explicitMenuCode: string) {
  if (explicitMenuCode) {
    return explicitMenuCode;
  }
  return menuType === "ADMIN" ? ENVIRONMENT_MANAGEMENT_MENU_CODE : "";
}

export function normalizeRows(rows: Array<Record<string, unknown>>): ManagedMenuRow[] {
  return rows
    .map((row) => {
      const code = stringOf(row, "code").toUpperCase();
      return {
        code,
        label: stringOf(row, "codeNm"),
        labelEn: stringOf(row, "codeDc"),
        menuUrl: toDisplayMenuUrl(stringOf(row, "menuUrl")),
        menuIcon: stringOf(row, "menuIcon") || "menu",
        useAt: stringOf(row, "useAt") || "Y",
        sortOrdr: numberOf(row, "sortOrdr"),
        parentCode: code.length === 8 ? code.slice(0, 6) : code.length === 6 ? code.slice(0, 4) : ""
      };
    })
    .filter((row) => row.code.length === 8)
    .sort((left, right) => {
      const orderLeft = left.sortOrdr > 0 ? left.sortOrdr : Number.MAX_SAFE_INTEGER;
      const orderRight = right.sortOrdr > 0 ? right.sortOrdr : Number.MAX_SAFE_INTEGER;
      if (orderLeft !== orderRight) {
        return orderLeft - orderRight;
      }
      return left.code.localeCompare(right.code);
    });
}

export function buildSuggestedPageCode(parentCode: string, rows: ManagedMenuRow[]) {
  return buildSharedSuggestedPageCode(parentCode, rows);
}

export function createEmptyFeatureDraft(): FeatureDraft {
  return {
    featureCode: "",
    featureNm: "",
    featureNmEn: "",
    featureDc: "",
    useAt: "Y"
  };
}

export function createEmptySelectedMenuDraft(): SelectedMenuDraft {
  return {
    codeNm: "",
    codeDc: "",
    menuUrl: "",
    menuIcon: "web",
    useAt: "Y"
  };
}

export function validateManagedUrl(
  value: string,
  menuType: string,
  rows: ManagedMenuRow[],
  currentCode?: string,
  en?: boolean
): UrlValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      tone: "warning",
      message: en ? "URL is required." : "URL은 필수입니다."
    };
  }
  const normalized = toDisplayMenuUrl(trimmed);
  const validPrefix = menuType === "USER"
    ? (normalized.startsWith("/home") || normalized.startsWith("/en/home"))
    : (normalized.startsWith("/admin/") || normalized.startsWith("/en/admin/"));
  if (!validPrefix) {
    return {
      tone: "warning",
      message: en
        ? (menuType === "USER" ? "Home URLs must start with /home or /en/home." : "Admin URLs must start with /admin/ or /en/admin/.")
        : (menuType === "USER" ? "홈 URL은 /home 또는 /en/home 으로 시작해야 합니다." : "관리자 URL은 /admin/ 또는 /en/admin/ 으로 시작해야 합니다.")
    };
  }
  const duplicated = rows.find((row) => row.menuUrl === normalized && row.code !== (currentCode || ""));
  if (duplicated) {
    return {
      tone: "warning",
      message: en ? `URL is already used by ${duplicated.code}.` : `이미 ${duplicated.code} 메뉴가 사용하는 URL입니다.`
    };
  }
  return {
    tone: "success",
    message: en ? "Available URL pattern." : "사용 가능한 URL 패턴입니다."
  };
}

export function summarizeBuilderBlockingReason(issueCount: number, en: boolean) {
  if (issueCount <= 0) {
    return en ? "No registry issue. Publish can run immediately." : "레지스트리 이슈가 없어 바로 Publish 가능합니다.";
  }
  return en ? `${issueCount} registry issues require cleanup before publish.` : `${issueCount}건 레지스트리 이슈를 먼저 정리해야 Publish 됩니다.`;
}

export function summarizeBuilderIssueBreakdown(
  counts: { unregisteredCount?: number; missingCount?: number; deprecatedCount?: number } | null | undefined,
  en: boolean
) {
  const parts: string[] = [];
  const unregisteredCount = counts?.unregisteredCount || 0;
  const missingCount = counts?.missingCount || 0;
  const deprecatedCount = counts?.deprecatedCount || 0;
  if (unregisteredCount > 0) {
    parts.push(en ? `unregistered ${unregisteredCount}` : `미등록 ${unregisteredCount}건`);
  }
  if (missingCount > 0) {
    parts.push(en ? `missing ${missingCount}` : `누락 ${missingCount}건`);
  }
  if (deprecatedCount > 0) {
    parts.push(en ? `deprecated ${deprecatedCount}` : `Deprecated ${deprecatedCount}건`);
  }
  if (!parts.length) {
    return en ? "No registry issue. Publish can run immediately." : "레지스트리 이슈가 없어 바로 Publish 가능합니다.";
  }
  return parts.join(en ? " / " : " / ");
}

export function recommendBuilderNextAction(
  counts: { unregisteredCount?: number; missingCount?: number; deprecatedCount?: number } | null | undefined,
  en: boolean
) {
  const unregisteredCount = counts?.unregisteredCount || 0;
  const missingCount = counts?.missingCount || 0;
  const deprecatedCount = counts?.deprecatedCount || 0;
  if (unregisteredCount > 0) {
    return en ? "Register reusable components for unregistered nodes first." : "미등록 노드를 먼저 재사용 컴포넌트로 등록하세요.";
  }
  if (missingCount > 0) {
    return en ? "Repair or relink missing component references in Screen Builder." : "화면 빌더에서 누락된 컴포넌트 참조를 먼저 복구하세요.";
  }
  if (deprecatedCount > 0) {
    return en ? "Run deprecated replacement before publish." : "Publish 전에 Deprecated 대체를 먼저 실행하세요.";
  }
  return en ? "No blocking issue. You can publish this page now." : "차단 이슈가 없습니다. 지금 이 페이지를 Publish 할 수 있습니다.";
}

export function describeScreenBuilderFilter(
  screenBuilderFilter: "ALL" | "PUBLISHED_ONLY" | "DRAFT_ONLY" | "READY_ONLY" | "BLOCKED_ONLY" | "ISSUE_ONLY" | "STALE_PUBLISH_ONLY" | "PARITY_DRIFT_ONLY" | "PARITY_GAP_ONLY",
  screenBuilderIssueReasonFilter: "ALL" | "UNREGISTERED" | "MISSING" | "DEPRECATED",
  en: boolean
) {
  const scopeLabel = (() => {
    switch (screenBuilderFilter) {
      case "PUBLISHED_ONLY":
        return en ? "Published only" : "Publish만";
      case "DRAFT_ONLY":
        return en ? "No publish yet" : "Publish 없음";
      case "READY_ONLY":
        return en ? "Ready only" : "가능만";
      case "BLOCKED_ONLY":
        return en ? "Blocked only" : "차단만";
      case "ISSUE_ONLY":
        return en ? "Issue pages only" : "이슈만";
      case "STALE_PUBLISH_ONLY":
        return en ? "Stale publish only" : "노후 발행만";
      case "PARITY_DRIFT_ONLY":
        return en ? "Parity drift only" : "정합성 드리프트만";
      case "PARITY_GAP_ONLY":
        return en ? "Parity gap only" : "정합성 갭만";
      default:
        return en ? "All pages" : "전체 메뉴";
    }
  })();
  const reasonLabel = (() => {
    switch (screenBuilderIssueReasonFilter) {
      case "UNREGISTERED":
        return en ? "Unregistered only" : "미등록만";
      case "MISSING":
        return en ? "Missing only" : "누락만";
      case "DEPRECATED":
        return en ? "Deprecated only" : "Deprecated만";
      default:
        return en ? "All reasons" : "전체 사유";
    }
  })();
  return `${scopeLabel} / ${reasonLabel}`;
}

export function matchesScreenBuilderIssueReason(
  detail: ScreenBuilderIssueBreakdown | undefined,
  reason: "UNREGISTERED" | "MISSING" | "DEPRECATED"
) {
  if (reason === "UNREGISTERED") {
    return (detail?.unregisteredCount || 0) > 0;
  }
  if (reason === "MISSING") {
    return (detail?.missingCount || 0) > 0;
  }
  return (detail?.deprecatedCount || 0) > 0;
}

export function describeScreenBuilderIssueReason(
  reason: "UNREGISTERED" | "MISSING" | "DEPRECATED" | null,
  en: boolean
) {
  switch (reason) {
    case "UNREGISTERED":
      return en ? "Unregistered" : "미등록";
    case "MISSING":
      return en ? "Missing" : "누락";
    case "DEPRECATED":
      return en ? "Deprecated" : "Deprecated";
    default:
      return en ? "Issue" : "이슈";
  }
}

export function describeScreenBuilderQueueFocus(
  queue: { remainingPublished: number; remainingDraft: number },
  en: boolean
) {
  if (queue.remainingPublished <= 0 && queue.remainingDraft <= 0) {
    return en ? "No remaining queue in this issue family." : "이 이슈 유형에서 남은 대상이 없습니다.";
  }
  if (queue.remainingPublished > queue.remainingDraft) {
    return en ? "Prioritize published pages first because runtime impact is higher." : "런타임 영향이 큰 Publish 페이지부터 먼저 정리하세요.";
  }
  if (queue.remainingDraft > queue.remainingPublished) {
    return en ? "Clear draft pages first to reduce pending builder backlog." : "빌더 적체를 줄이기 위해 초안 페이지부터 먼저 정리하세요.";
  }
  return en ? "Published and draft queues are balanced. Follow the current order." : "Publish와 초안이 비슷하므로 현재 순서대로 진행하면 됩니다.";
}

export function parseAuditSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as Record<string, unknown> : null;
}

export function summarizeMenuAuditDiff(row: Record<string, unknown>, en: boolean) {
  const changedFields = Array.isArray(row.changedFields) ? row.changedFields as Array<Record<string, unknown>> : [];
  if (changedFields.length > 0) {
    return changedFields.slice(0, 3).map((field) => {
      const label = String(field.field || "-");
      const beforeValue = String(field.before || "-");
      const afterValue = String(field.after || "-");
      return `${label} ${beforeValue} -> ${afterValue}`;
    }).join(" / ");
  }
  const before = parseAuditSnapshot(row.beforeSummaryJson || row.beforeData || row.beforeSummary);
  const after = parseAuditSnapshot(row.afterSummaryJson || row.afterData || row.afterSummary);
  if (!before || !after) {
    return en ? "No interpreted diff available." : "해석 가능한 diff가 없습니다.";
  }
  const labels: Array<[string, string, string]> = [
    ["codeNm", en ? "Name" : "메뉴명", ""],
    ["codeDc", en ? "English name" : "영문명", ""],
    ["menuUrl", "URL", ""],
    ["menuIcon", en ? "Icon" : "아이콘", ""],
    ["useAt", en ? "Use" : "사용 여부", ""]
  ];
  const changes = labels.flatMap(([key, label]) => {
    const beforeValue = String(before[key] || "");
    const afterValue = String(after[key] || "");
    return beforeValue && afterValue && beforeValue !== afterValue
      ? [`${label} ${beforeValue} -> ${afterValue}`]
      : [];
  });
  return changes.length > 0 ? changes.join(" / ") : (en ? "No interpreted diff available." : "해석 가능한 diff가 없습니다.");
}

export function resolveGovernancePageId(
  selectedMenu: ManagedMenuRow | null,
  pages: ScreenCommandPagePayload["pages"] | undefined
) {
  if (!selectedMenu) {
    return "";
  }
  const menuCode = selectedMenu.code.toUpperCase();
  const knownPageId = KNOWN_GOVERNANCE_PAGE_IDS[menuCode];
  if (knownPageId) {
    return knownPageId;
  }
  const menuPath = normalizeManifestLookupPath(selectedMenu.menuUrl);
  const matchedCatalogPage = (pages || []).find((item) => (
    String(item.menuCode || "").toUpperCase() === menuCode
      || normalizeManifestLookupPath(String(item.routePath || "")) === menuPath
  ));
  if (matchedCatalogPage?.pageId) {
    return String(matchedCatalogPage.pageId);
  }
  const matchedManifest = findManifestByMenuCodeOrRoutePath(menuCode, menuPath);
  return matchedManifest?.pageId || "";
}

export function buildGovernanceOverview(
  entry: FullStackGovernanceRegistryEntry | null,
  page: ScreenCommandPagePayload["page"] | null
): GovernanceOverview {
  return {
    summary: entry?.summary || page?.summary || "",
    pageId: entry?.pageId || page?.pageId || "",
    source: entry?.source || page?.source || "",
    tags: entry?.tags || [],
    componentIds: entry?.componentIds || Array.from(new Set([
      ...((page?.surfaces || []).map((item) => item.componentId).filter(Boolean)),
      ...((page?.manifestRegistry?.components || []).map((item) => String(item.componentId || "")).filter(Boolean))
    ])),
    eventIds: entry?.eventIds || (page?.events || []).map((item) => item.eventId).filter(Boolean),
    functionIds: entry?.functionIds || Array.from(new Set((page?.events || []).map((item) => item.frontendFunction).filter(Boolean))),
    parameterSpecs: entry?.parameterSpecs || (page?.events || []).flatMap((item) => (
      item.functionInputs || []
    ).map((field) => `${field.fieldId}:${field.type}:${field.source || "input"}`)),
    resultSpecs: entry?.resultSpecs || (page?.events || []).flatMap((item) => (
      item.functionOutputs || []
    ).map((field) => `${field.fieldId}:${field.type}:${field.source || "output"}`)),
    apiIds: entry?.apiIds || (page?.apis || []).map((item) => item.apiId).filter(Boolean),
    controllerActions: entry?.controllerActions || Array.from(new Set((page?.apis || []).flatMap((item) => (
      getScreenCommandChainValues(item.controllerActions, item.controllerAction)
    )))),
    serviceMethods: entry?.serviceMethods || Array.from(new Set((page?.apis || []).flatMap((item) => (
      getScreenCommandChainValues(item.serviceMethods, item.serviceMethod)
    )))),
    mapperQueries: entry?.mapperQueries || Array.from(new Set((page?.apis || []).flatMap((item) => (
      getScreenCommandChainValues(item.mapperQueries, item.mapperQuery)
    )))),
    schemaIds: entry?.schemaIds || (page?.schemas || []).map((item) => item.schemaId).filter(Boolean),
    tableNames: entry?.tableNames || Array.from(new Set([
      ...(page?.schemas || []).map((item) => item.tableName).filter(Boolean),
      ...(page?.apis || []).flatMap((item) => item.relatedTables || []),
      ...(page?.menuPermission?.relationTables || [])
    ])),
    columnNames: entry?.columnNames || Array.from(new Set((page?.schemas || []).flatMap((item) => item.columns || []))),
    featureCodes: entry?.featureCodes || Array.from(new Set([
      ...(page?.menuPermission?.featureCodes || []),
      ...((page?.menuPermission?.featureRows || []).map((item) => item.featureCode))
    ])),
    commonCodeGroups: entry?.commonCodeGroups || (page?.commonCodeGroups || []).map((item) => item.codeGroupId).filter(Boolean)
  };
}

export function isDraftOnlyGovernancePage(
  entry: FullStackGovernanceRegistryEntry | null,
  page: ScreenCommandPagePayload["page"] | null
) {
  if (entry && String(entry.source || "").trim()) {
    return false;
  }
  return String(page?.source || "").trim() === "UI_PAGE_MANIFEST draft registry";
}

export function buildSurfaceChains(page: ScreenCommandPagePayload["page"] | null): GovernanceSurfaceChain[] {
  if (!page) {
    return [];
  }
  const events = page.events || [];
  const apis = page.apis || [];
  const schemas = page.schemas || [];
  const manifestComponents = ((page.manifestRegistry?.components || []) as Array<Record<string, unknown>>);
  return (page.surfaces || []).map((surface) => {
    const surfaceEvents = events.filter((event) => (surface.eventIds || []).includes(event.eventId));
    const childElements = manifestComponents
      .filter((component) => {
        const instanceKey = stringOf(component, "instanceKey");
        const componentId = stringOf(component, "componentId");
        const layoutZone = stringOf(component, "layoutZone");
        return instanceKey === surface.surfaceId
          || componentId === surface.componentId
          || (!surface.componentId && layoutZone === surface.layoutZone)
          || (layoutZone === surface.layoutZone && instanceKey.startsWith(surface.surfaceId));
      })
      .map((component) => ({
        instanceKey: stringOf(component, "instanceKey"),
        componentId: stringOf(component, "componentId"),
        componentName: stringOf(component, "componentName"),
        layoutZone: stringOf(component, "layoutZone"),
        designReference: stringOf(component, "designReference"),
        notes: stringOf(component, "conditionalRuleSummary")
      }));
    return {
      surfaceId: surface.surfaceId,
      label: surface.label,
      selector: surface.selector,
      componentId: surface.componentId,
      layoutZone: surface.layoutZone,
      notes: surface.notes,
      childElements: childElements.filter((item, index, list) => (
        list.findIndex((candidate) => `${candidate.instanceKey}-${candidate.componentId}` === `${item.instanceKey}-${item.componentId}`) === index
      )),
      events: surfaceEvents.map((event) => {
        const connectedApis = (event.apiIds || []).map((apiId) => apis.find((candidate) => candidate.apiId === apiId)).filter(Boolean);
        return {
          eventId: event.eventId,
          label: event.label,
          eventType: event.eventType,
          frontendFunction: event.frontendFunction,
          triggerSelector: event.triggerSelector,
          notes: event.notes,
          functionInputs: event.functionInputs || [],
          functionOutputs: event.functionOutputs || [],
          apis: connectedApis.map((api) => ({
            apiId: api!.apiId,
            label: api!.label,
            method: api!.method,
            endpoint: api!.endpoint,
            controllerActions: getScreenCommandChainValues(api!.controllerActions, api!.controllerAction),
            serviceMethods: getScreenCommandChainValues(api!.serviceMethods, api!.serviceMethod),
            mapperQueries: getScreenCommandChainValues(api!.mapperQueries, api!.mapperQuery),
            requestFields: api!.requestFields || [],
            responseFields: api!.responseFields || [],
            schemaIds: api!.schemaIds || [],
            relatedTables: api!.relatedTables || [],
            schemas: (api!.schemaIds || []).map((schemaId) => schemas.find((schema) => schema.schemaId === schemaId)).filter(Boolean).map((schema) => ({
              schemaId: schema!.schemaId,
              label: schema!.label,
              tableName: schema!.tableName,
              columns: schema!.columns || [],
              notes: schema!.notes
            }))
          }))
        };
      })
    };
  });
}

export function buildSurfaceEventTableRows(chains: GovernanceSurfaceChain[]): GovernanceSurfaceEventTableRow[] {
  return chains.flatMap((surface) => {
    if (surface.events.length === 0) {
      return [{
        surfaceLabel: surface.label,
        surfaceId: surface.surfaceId,
        childElements: surface.childElements.map((item) => item.componentName || item.instanceKey || item.componentId).filter(Boolean).join(", "),
        eventLabel: "-",
        eventId: "-",
        eventType: "-",
        frontendFunction: "-",
        parameters: "-",
        results: "-",
        apiLabels: "-",
        controllerActions: "-",
        serviceMethods: "-",
        mapperQueries: "-"
      }];
    }
    return surface.events.map((event) => ({
      surfaceLabel: surface.label,
      surfaceId: surface.surfaceId,
      childElements: surface.childElements.map((item) => item.componentName || item.instanceKey || item.componentId).filter(Boolean).join(", "),
      eventLabel: event.label,
      eventId: event.eventId,
      eventType: event.eventType,
      frontendFunction: event.frontendFunction,
      parameters: event.functionInputs.map((field) => `${field.fieldId}:${field.type}`).join(", ") || "-",
      results: event.functionOutputs.map((field) => `${field.fieldId}:${field.type}`).join(", ") || "-",
      apiLabels: event.apis.map((api) => `${api.apiId} (${api.method} ${api.endpoint})`).join(", ") || "-",
      controllerActions: event.apis.flatMap((api) => api.controllerActions).join(", ") || "-",
      serviceMethods: event.apis.flatMap((api) => api.serviceMethods).join(", ") || "-",
      mapperQueries: event.apis.flatMap((api) => api.mapperQueries).join(", ") || "-"
    }));
  });
}
