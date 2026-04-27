import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { findManifestByMenuCodeOrRoutePath, normalizeManifestLookupPath } from "../../platform/screen-registry/pageManifestIndex";
import {
  autoCollectFullStackGovernanceRegistry,
  createSrTicket,
  fetchFullStackGovernanceRegistry,
  fetchFullStackManagementPage,
  fetchSrWorkbenchPage,
  saveFullStackGovernanceRegistry
} from "../../lib/api/platform";
import { fetchScreenCommandPage } from "../../lib/api/platform";
import { getScreenCommandChainText, getScreenCommandChainValues } from "../../lib/api/screenCommand";
import type {
  FullStackGovernanceRegistryEntry,
  MenuManagementPagePayload,
  ScreenCommandPagePayload,
  SrWorkbenchPagePayload
} from "../../lib/api/platformTypes";
import { postFormUrlEncoded } from "../../lib/api/core";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { KeyValueGridPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { authorDesignContextKeys } from "../admin-ui/contextKeyPresets";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";

type FocusTab =
  | "overview"
  | "surfaces"
  | "events"
  | "functions"
  | "apis"
  | "controllers"
  | "db"
  | "columns"
  | "automation";

type RegistryEditor = {
  summary: string;
  ownerScope: string;
  notes: string;
  frontendSources: string;
  componentIds: string;
  eventIds: string;
  functionIds: string;
  parameterSpecs: string;
  resultSpecs: string;
  apiIds: string;
  schemaIds: string;
  tableNames: string;
  columnNames: string;
  featureCodes: string;
  commonCodeGroups: string;
  tags: string;
};

type TargetSelection = {
  surfaceIds: string[];
  eventIds: string[];
  functionIds: string[];
  apiIds: string[];
  schemaIds: string[];
  tableNames: string[];
  columnNames: string[];
  changeTargetId: string;
};

type GovernanceOverview = {
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

type GovernanceSurfaceChain = {
  surfaceId: string;
  label: string;
  selector: string;
  componentId: string;
  layoutZone: string;
  notes: string;
  childElements: Array<{
    instanceKey: string;
    componentId: string;
    componentName: string;
    layoutZone: string;
    designReference: string;
    notes: string;
  }>;
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

type GovernanceSurfaceEventTableRow = {
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

const TAB_OPTIONS: Array<{ id: FocusTab; labelKo: string; labelEn: string }> = [
  { id: "overview", labelKo: "개요", labelEn: "Overview" },
  { id: "surfaces", labelKo: "화면 요소", labelEn: "Surfaces" },
  { id: "events", labelKo: "이벤트", labelEn: "Events" },
  { id: "functions", labelKo: "함수", labelEn: "Functions" },
  { id: "apis", labelKo: "API", labelEn: "APIs" },
  { id: "controllers", labelKo: "컨트롤러", labelEn: "Controllers" },
  { id: "db", labelKo: "DB 테이블", labelEn: "DB Tables" },
  { id: "columns", labelKo: "컬럼", labelEn: "Columns" },
  { id: "automation", labelKo: "작업 지시", labelEn: "Automation" }
];

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function joinLines(values: string[] | undefined) {
  return (values || []).join("\n");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function summaryListOf(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function resolveGovernancePageId(
  selectedSummary: Record<string, unknown> | null,
  pages: ScreenCommandPagePayload["pages"] | undefined
) {
  if (!selectedSummary) {
    return "";
  }
  const summaryPageId = stringOf(selectedSummary, "pageId");
  if (summaryPageId) {
    return summaryPageId;
  }
  const menuCode = stringOf(selectedSummary, "menuCode").toUpperCase();
  const menuPath = normalizeManifestLookupPath(stringOf(selectedSummary, "menuUrl"));
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

function buildGovernanceOverview(
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
    columnNames: entry?.columnNames || Array.from(new Set((page?.schemas || []).flatMap((item) => item.columns || []).map((column) => String(column)))),
    featureCodes: entry?.featureCodes || Array.from(new Set([
      ...(page?.menuPermission?.featureCodes || []),
      ...((page?.menuPermission?.featureRows || []).map((item) => item.featureCode))
    ])),
    commonCodeGroups: entry?.commonCodeGroups || (page?.commonCodeGroups || []).map((item) => item.codeGroupId).filter(Boolean)
  };
}

function renderMetaList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--kr-gov-text-secondary)]">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-mono text-[var(--kr-gov-text-primary)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function buildSurfaceChains(page: ScreenCommandPagePayload["page"] | null): GovernanceSurfaceChain[] {
  if (!page) {
    return [];
  }
  const events = page.events || [];
  const apis = page.apis || [];
  const schemas = page.schemas || [];
  const manifestComponents = (page.manifestRegistry?.components || []) as Array<Record<string, unknown>>;
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
      events: surfaceEvents.map((event) => ({
        eventId: event.eventId,
        label: event.label,
        eventType: event.eventType,
        frontendFunction: event.frontendFunction,
        triggerSelector: event.triggerSelector,
        notes: event.notes,
        functionInputs: event.functionInputs || [],
        functionOutputs: event.functionOutputs || [],
        apis: (event.apiIds || [])
          .map((apiId) => apis.find((candidate) => candidate.apiId === apiId))
          .filter(Boolean)
          .map((api) => ({
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
            schemas: (api!.schemaIds || [])
              .map((schemaId) => schemas.find((schema) => schema.schemaId === schemaId))
              .filter(Boolean)
              .map((schema) => ({
                schemaId: schema!.schemaId,
                label: schema!.label,
                tableName: schema!.tableName,
                columns: schema!.columns || [],
                notes: schema!.notes
              }))
          }))
      }))
    };
  });
}

function buildSurfaceEventTableRows(chains: GovernanceSurfaceChain[]): GovernanceSurfaceEventTableRow[] {
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

function parseFocus(): FocusTab {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get("focus") || "").trim() as FocusTab;
  return TAB_OPTIONS.some((item) => item.id === requested) ? requested : "overview";
}

function validateRegistryEditor(editor: RegistryEditor, en: boolean) {
  const errors: string[] = [];
  const tablePattern = /^[A-Z][A-Z0-9_]*$/;
  const columnPattern = /^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/;
  const upperTokenPattern = /^[A-Z][A-Z0-9_]*$/;
  const fieldSpecPattern = /^[^:\s][^:]*:[^:\s][^:]*(:[^:\s][^:]*)?$/;
  const check = (value: string, pattern: RegExp, ko: string, enMsg: string) => {
    const invalid = splitLines(value).find((item) => !pattern.test(item.trim().toUpperCase()));
    if (invalid) {
      errors.push((en ? enMsg : ko) + `: ${invalid}`);
    }
  };
  check(editor.tableNames, tablePattern, "테이블 형식 오류", "Invalid table format");
  check(editor.columnNames, columnPattern, "컬럼 형식 오류", "Invalid column format");
  check(editor.featureCodes, upperTokenPattern, "기능 코드 형식 오류", "Invalid feature code format");
  check(editor.commonCodeGroups, upperTokenPattern, "공통코드 그룹 형식 오류", "Invalid common-code group format");
  const invalidParam = splitLines(editor.parameterSpecs).find((item) => !fieldSpecPattern.test(item));
  if (invalidParam) errors.push(en ? `Invalid parameter spec: ${invalidParam}` : `파라미터 형식 오류: ${invalidParam}`);
  const invalidResult = splitLines(editor.resultSpecs).find((item) => !fieldSpecPattern.test(item));
  if (invalidResult) errors.push(en ? `Invalid result spec: ${invalidResult}` : `결과값 형식 오류: ${invalidResult}`);
  return errors;
}

function toEditor(entry: FullStackGovernanceRegistryEntry): RegistryEditor {
  return {
    summary: entry.summary || "",
    ownerScope: entry.ownerScope || "",
    notes: entry.notes || "",
    frontendSources: joinLines(entry.frontendSources),
    componentIds: joinLines(entry.componentIds),
    eventIds: joinLines(entry.eventIds),
    functionIds: joinLines(entry.functionIds),
    parameterSpecs: joinLines(entry.parameterSpecs),
    resultSpecs: joinLines(entry.resultSpecs),
    apiIds: joinLines(entry.apiIds),
    schemaIds: joinLines(entry.schemaIds),
    tableNames: joinLines(entry.tableNames),
    columnNames: joinLines(entry.columnNames),
    featureCodes: joinLines(entry.featureCodes),
    commonCodeGroups: joinLines(entry.commonCodeGroups),
    tags: joinLines(entry.tags)
  };
}

function emptyEditor(): RegistryEditor {
  return toEditor({
    menuCode: "",
    pageId: "",
    menuUrl: "",
    summary: "",
    ownerScope: "",
    notes: "",
    frontendSources: [],
    componentIds: [],
    eventIds: [],
    functionIds: [],
    parameterSpecs: [],
    resultSpecs: [],
    apiIds: [],
    controllerActions: [],
    serviceMethods: [],
    mapperQueries: [],
    schemaIds: [],
    tableNames: [],
    columnNames: [],
    featureCodes: [],
    commonCodeGroups: [],
    tags: [],
    updatedAt: "",
    source: "DEFAULT"
  });
}

function emptyTargetSelection(): TargetSelection {
  return {
    surfaceIds: [],
    eventIds: [],
    functionIds: [],
    apiIds: [],
    schemaIds: [],
    tableNames: [],
    columnNames: [],
    changeTargetId: ""
  };
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function buildDirection(page: ScreenCommandPagePayload["page"] | undefined, editor: RegistryEditor, selection: TargetSelection, summary: string, instruction: string) {
  return [
    `[SR 요약] ${summary || "요약 없음"}`,
    `대상 화면: ${page?.label || "-"} (${page?.routePath || "-"})`,
    `대상 메뉴: ${page?.menuCode || "-"}`,
    `지목 요소: ${selection.surfaceIds.join(", ") || splitLines(editor.componentIds).join(", ") || "-"}`,
    `지목 이벤트: ${selection.eventIds.join(", ") || splitLines(editor.eventIds).join(", ") || "-"}`,
    `지목 함수: ${selection.functionIds.join(", ") || splitLines(editor.functionIds).join(", ") || "-"}`,
    `지목 API: ${selection.apiIds.join(", ") || splitLines(editor.apiIds).join(", ") || "-"}`,
    `지목 스키마: ${selection.schemaIds.join(", ") || splitLines(editor.schemaIds).join(", ") || "-"}`,
    `지목 테이블: ${selection.tableNames.join(", ") || splitLines(editor.tableNames).join(", ") || "-"}`,
    `지목 컬럼: ${selection.columnNames.join(", ") || splitLines(editor.columnNames).join(", ") || "-"}`,
    `수정 타깃: ${selection.changeTargetId || "-"}`,
    `실행 지시: ${instruction || "구체 지시 필요"}`
  ].join("\n");
}

export function PlatformStudioMigrationPage() {
  const en = isEnglish();
  const [menuType, setMenuType] = useState(new URLSearchParams(window.location.search).get("menuType") || "ADMIN");
  const [focus, setFocus] = useState<FocusTab>(parseFocus());
  const [selectedMenuCode, setSelectedMenuCode] = useState("");
  const [menuSearchKeyword, setMenuSearchKeyword] = useState("");
  const [summary, setSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [registryEditor, setRegistryEditor] = useState<RegistryEditor>(emptyEditor());
  const [registryEntry, setRegistryEntry] = useState<FullStackGovernanceRegistryEntry | null>(null);
  const [savingRegistry, setSavingRegistry] = useState(false);
  const [collectingRegistry, setCollectingRegistry] = useState(false);
  const [targetSelection, setTargetSelection] = useState<TargetSelection>(emptyTargetSelection());
  const [screenCatalog, setScreenCatalog] = useState<ScreenCommandPagePayload | null>(null);
  const pageState = useAsyncValue<MenuManagementPagePayload>(() => fetchFullStackManagementPage(menuType), [menuType]);
  const workbenchState = useAsyncValue<SrWorkbenchPagePayload>(() => fetchSrWorkbenchPage(""), []);
  const page = pageState.value;
  const workbench = workbenchState.value;
  const summaryRows = ((page?.fullStackSummaryRows || []) as Array<Record<string, unknown>>);
  const deferredMenuSearchKeyword = useDeferredValue(menuSearchKeyword);
  const filteredSummaryRows = useMemo(() => {
    const normalizedKeyword = deferredMenuSearchKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return summaryRows;
    }
    return summaryRows.filter((item) => {
      const haystacks = [
        stringOf(item, "menuNm"),
        stringOf(item, "menuCode"),
        stringOf(item, "menuUrl"),
        stringOf(item, "pageId"),
        stringOf(item, "requiredViewFeatureCode")
      ];
      return haystacks.some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [deferredMenuSearchKeyword, summaryRows]);
  const selectedSummary = useMemo(() => summaryRows.find((item) => stringOf(item, "menuCode") === selectedMenuCode) || null, [selectedMenuCode, summaryRows]);
  const pageId = useMemo(() => resolveGovernancePageId(selectedSummary, screenCatalog?.pages), [screenCatalog?.pages, selectedSummary]);
  const commandState = useAsyncValue<ScreenCommandPagePayload>(() => (pageId ? fetchScreenCommandPage(pageId) : Promise.resolve({ selectedPageId: "", pages: [], page: {} as ScreenCommandPagePayload["page"] })), [pageId]);
  const commandPage = pageId ? commandState.value : null;
  const commandDetail = commandPage?.page;
  const governanceOverview = useMemo(() => buildGovernanceOverview(registryEntry, commandDetail || null), [commandDetail, registryEntry]);
  const governanceSurfaceChains = useMemo(() => buildSurfaceChains(commandDetail || null), [commandDetail]);
  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "platform-studio", {
      route: window.location.pathname,
      selectedMenuCode,
      pageId,
      summaryRowCount: summaryRows.length,
      surfaceChainCount: governanceSurfaceChains.length,
      functionCount: governanceOverview.functionIds.length
    });
    logGovernanceScope("COMPONENT", "platform-studio-governance", {
      component: "platform-studio-governance",
      selectedMenuCode,
      pageId,
      apiCount: governanceOverview.apiIds.length,
      schemaCount: governanceOverview.schemaIds.length,
      eventCount: governanceOverview.eventIds.length
    });
  }, [
    governanceOverview.apiIds.length,
    governanceOverview.eventIds.length,
    governanceOverview.functionIds.length,
    governanceOverview.schemaIds.length,
    governanceSurfaceChains.length,
    page,
    pageId,
    selectedMenuCode,
    summaryRows.length
  ]);
  const governanceSurfaceEventRows = useMemo(() => buildSurfaceEventTableRows(governanceSurfaceChains), [governanceSurfaceChains]);
  const selectedGaps = useMemo(() => summaryListOf(selectedSummary, "gaps"), [selectedSummary]);
  const qualityCards = useMemo(() => ([
    { label: en ? "Coverage" : "커버리지", value: String(numberOf(selectedSummary, "coverageScore")), tone: "text-[var(--kr-gov-blue)] bg-[#f8fbff]" },
    { label: en ? "Components" : "컴포넌트", value: `${numberOf(selectedSummary, "componentCount")}`, tone: "text-[#0f4c81] bg-[#f5faff]" },
    { label: en ? "Functions" : "함수", value: `${numberOf(selectedSummary, "functionCount")}`, tone: "text-[#196c2e] bg-[#f7fbf8]" },
    { label: en ? "Controller / Service / Mapper" : "컨트롤러 / 서비스 / 매퍼", value: `${numberOf(selectedSummary, "controllerCount")} / ${numberOf(selectedSummary, "serviceCount")} / ${numberOf(selectedSummary, "mapperCount")}`, tone: "text-[#8a5a00] bg-[#fcfbf7]" },
    { label: en ? "Parameters / Results" : "파라미터 / 결과값", value: `${numberOf(selectedSummary, "parameterCount")} / ${numberOf(selectedSummary, "resultCount")}`, tone: "text-[#6b21a8] bg-[#faf5ff]" },
    { label: en ? "Schema / Table / Column" : "스키마 / 테이블 / 컬럼", value: `${numberOf(selectedSummary, "schemaCount")} / ${numberOf(selectedSummary, "tableCount")} / ${numberOf(selectedSummary, "columnCount")}`, tone: "text-[#be123c] bg-[#fff1f2]" }
  ]), [en, selectedSummary]);

  const derivedSelection = useMemo(() => {
    const events = (commandDetail?.events || []).filter((item) => targetSelection.eventIds.includes(item.eventId));
    const functions = unique([
      ...targetSelection.functionIds,
      ...events.map((item) => item.frontendFunction)
    ]);
    const apis = unique([
      ...targetSelection.apiIds,
      ...events.flatMap((item) => item.apiIds || [])
    ]);
    const schemas = unique([
      ...targetSelection.schemaIds,
      ...(commandDetail?.apis || []).filter((item) => apis.includes(item.apiId)).flatMap((item) => item.schemaIds || [])
    ]);
    const tables = unique([
      ...targetSelection.tableNames,
      ...(commandDetail?.apis || []).filter((item) => apis.includes(item.apiId)).flatMap((item) => item.relatedTables || []),
      ...(commandDetail?.schemas || []).filter((item) => schemas.includes(item.schemaId)).map((item) => item.tableName)
    ]);
    const columns = unique([
      ...targetSelection.columnNames,
      ...(commandDetail?.schemas || []).filter((item) => schemas.includes(item.schemaId)).flatMap((item) => (item.columns || []).map((column) => `${item.tableName}.${column}`))
    ]);
    return { functions, apis, schemas, tables, columns };
  }, [commandDetail, targetSelection]);

  const impactRows = useMemo(() => {
    if (!commandDetail) {
      return [];
    }
    const rows: Array<{ layer: string; id: string; detail: string }> = [];
    (commandDetail.surfaces || []).filter((item) => targetSelection.surfaceIds.includes(item.surfaceId)).forEach((item) => {
      rows.push({ layer: en ? "Surface" : "화면 요소", id: item.surfaceId, detail: `${item.selector} / ${item.componentId}` });
    });
    (commandDetail.events || []).filter((item) => targetSelection.eventIds.includes(item.eventId)).forEach((item) => {
      rows.push({ layer: en ? "Event" : "이벤트", id: item.eventId, detail: `${item.frontendFunction} -> ${(item.apiIds || []).join(", ") || "-"}` });
    });
    derivedSelection.functions.forEach((item) => {
      rows.push({ layer: en ? "Function" : "함수", id: item, detail: en ? "Triggered from selected event" : "선택 이벤트에서 호출" });
    });
    (commandDetail.apis || []).filter((item) => derivedSelection.apis.includes(item.apiId)).forEach((item) => {
      rows.push({ layer: "API", id: item.apiId, detail: `${item.method} ${item.endpoint} / ${getScreenCommandChainText(item.controllerActions, item.controllerAction, " / ")}` });
    });
    (commandDetail.schemas || []).filter((item) => derivedSelection.schemas.includes(item.schemaId)).forEach((item) => {
      rows.push({ layer: en ? "Schema" : "스키마", id: item.schemaId, detail: `${item.tableName} / ${(item.columns || []).length} ${en ? "columns" : "컬럼"}` });
    });
    derivedSelection.tables.forEach((item) => {
      rows.push({ layer: en ? "Table" : "테이블", id: item, detail: derivedSelection.columns.filter((column) => column.startsWith(`${item}.`)).length + ` ${en ? "linked columns" : "연결 컬럼"}` });
    });
    derivedSelection.columns.forEach((item) => {
      rows.push({ layer: en ? "Column" : "컬럼", id: item, detail: targetSelection.changeTargetId || "-" });
    });
    return rows;
  }, [commandDetail, derivedSelection, en, targetSelection]);

  useEffect(() => {
    if (!selectedMenuCode && filteredSummaryRows.length > 0) {
      setSelectedMenuCode(stringOf(filteredSummaryRows[0], "menuCode"));
      return;
    }
    if (selectedMenuCode && filteredSummaryRows.every((item) => stringOf(item, "menuCode") !== selectedMenuCode)) {
      setSelectedMenuCode(stringOf(filteredSummaryRows[0], "menuCode"));
    }
  }, [filteredSummaryRows, selectedMenuCode]);

  useEffect(() => {
    setMenuSearchKeyword("");
  }, [menuType]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const payload = await fetchScreenCommandPage("");
        if (!cancelled) {
          setScreenCatalog(payload);
        }
      } catch {
        if (!cancelled) {
          setScreenCatalog(null);
        }
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [menuType]);

  useEffect(() => {
    let cancelled = false;
    async function loadRegistry() {
      if (!selectedMenuCode) {
        setRegistryEntry(null);
        setRegistryEditor(emptyEditor());
        return;
      }
      try {
        const loaded = await fetchFullStackGovernanceRegistry(selectedMenuCode);
        if (!cancelled) {
          setRegistryEntry(loaded);
          setRegistryEditor(toEditor(loaded));
        }
      } catch {
        if (!cancelled) {
          setRegistryEntry(null);
          setRegistryEditor(emptyEditor());
        }
      }
    }
    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [selectedMenuCode]);

  useEffect(() => {
    if (!commandDetail) {
      setTargetSelection(emptyTargetSelection());
      return;
    }
    setTargetSelection({
      surfaceIds: commandDetail.surfaces?.[0]?.surfaceId ? [commandDetail.surfaces[0].surfaceId] : [],
      eventIds: commandDetail.events?.[0]?.eventId ? [commandDetail.events[0].eventId] : [],
      functionIds: commandDetail.events?.[0]?.frontendFunction ? [commandDetail.events[0].frontendFunction] : [],
      apiIds: commandDetail.apis?.[0]?.apiId ? [commandDetail.apis[0].apiId] : [],
      schemaIds: commandDetail.schemas?.[0]?.schemaId ? [commandDetail.schemas[0].schemaId] : [],
      tableNames: commandDetail.schemas?.[0]?.tableName ? [commandDetail.schemas[0].tableName] : [],
      columnNames: commandDetail.schemas?.[0]
        ? (commandDetail.schemas[0].columns || []).slice(0, 2).map((column) => `${commandDetail.schemas?.[0]?.tableName}.${column}`)
        : [],
      changeTargetId: commandDetail.changeTargets?.[0]?.targetId || ""
    });
  }, [commandDetail]);

  async function createPageMenu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    const formData = new FormData(event.currentTarget);
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    ["parentCode", "codeNm", "codeDc", "menuUrl", "menuIcon", "useAt"].forEach((key) => body.set(key, String(formData.get(key) || "")));
    const result = await postFormUrlEncoded<{ success?: boolean; message?: string; createdCode?: string }>(
      buildLocalizedPath("/admin/system/menu/create-page", "/en/admin/system/menu/create-page"),
      body
    );
    if (!result.success) {
      setActionError(result.message || (en ? "Failed to create page menu." : "페이지 메뉴를 생성하지 못했습니다."));
      return;
    }
    await pageState.reload();
    setSelectedMenuCode(result.createdCode || "");
    setActionMessage(result.message || (en ? "Page menu created." : "페이지 메뉴를 생성했습니다."));
    event.currentTarget.reset();
  }

  async function toggleVisibility(nextUseAt: "Y" | "N") {
    if (!selectedMenuCode) {
      return;
    }
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("menuCode", selectedMenuCode);
    body.set("useAt", nextUseAt);
    const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
      buildLocalizedPath("/admin/system/full-stack-management/menu-visibility", "/en/admin/system/full-stack-management/menu-visibility"),
      body
    );
    if (!result.success) {
      setActionError(result.message || (en ? "Failed to change menu visibility." : "메뉴 표시 상태를 변경하지 못했습니다."));
      return;
    }
    await pageState.reload();
    setActionMessage(result.message || (en ? "Visibility updated." : "표시 상태를 변경했습니다."));
  }

  async function saveRegistry() {
    if (!selectedMenuCode) {
      return;
    }
    const errors = validateRegistryEditor(registryEditor, en);
    if (errors.length > 0) {
      setActionError(errors.join(" "));
      return;
    }
    setSavingRegistry(true);
    setActionError("");
    try {
      const payload: FullStackGovernanceRegistryEntry = {
        menuCode: selectedMenuCode,
        pageId: pageId || registryEntry?.pageId || "",
        menuUrl: commandDetail?.menuLookupUrl || stringOf(selectedSummary, "menuUrl"),
        summary: registryEditor.summary,
        ownerScope: registryEditor.ownerScope,
        notes: registryEditor.notes,
        frontendSources: splitLines(registryEditor.frontendSources),
        componentIds: splitLines(registryEditor.componentIds),
        eventIds: splitLines(registryEditor.eventIds),
        functionIds: splitLines(registryEditor.functionIds),
        parameterSpecs: splitLines(registryEditor.parameterSpecs),
        resultSpecs: splitLines(registryEditor.resultSpecs),
        apiIds: splitLines(registryEditor.apiIds),
        controllerActions: registryEntry?.controllerActions || [],
        serviceMethods: registryEntry?.serviceMethods || [],
        mapperQueries: registryEntry?.mapperQueries || [],
        schemaIds: splitLines(registryEditor.schemaIds),
        tableNames: splitLines(registryEditor.tableNames),
        columnNames: splitLines(registryEditor.columnNames),
        featureCodes: splitLines(registryEditor.featureCodes),
        commonCodeGroups: splitLines(registryEditor.commonCodeGroups),
        tags: splitLines(registryEditor.tags),
        updatedAt: registryEntry?.updatedAt || "",
        source: "FILE"
      };
      const result = await saveFullStackGovernanceRegistry(payload);
      setRegistryEntry(result.entry);
      setRegistryEditor(toEditor(result.entry));
      await pageState.reload();
      setActionMessage(result.message || (en ? "Registry saved." : "레지스트리를 저장했습니다."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to save registry." : "레지스트리 저장에 실패했습니다."));
    } finally {
      setSavingRegistry(false);
    }
  }

  async function createAutomationTicket() {
    if (!commandDetail) {
      return;
    }
    const generatedDirection = buildDirection(commandDetail, registryEditor, targetSelection, summary, instruction);
    const selectedEvent = (commandDetail.events || []).find((item) => item.eventId === targetSelection.eventIds[0]);
    const selectedSurface = (commandDetail.surfaces || []).find((item) => item.surfaceId === targetSelection.surfaceIds[0]);
    const selectedTarget = (commandDetail.changeTargets || []).find((item) => item.targetId === targetSelection.changeTargetId);
    const response = await createSrTicket({
      pageId: commandDetail.pageId || pageId,
      pageLabel: commandDetail.label || "",
      routePath: commandDetail.routePath || "",
      menuCode: commandDetail.menuCode || selectedMenuCode,
      menuLookupUrl: commandDetail.menuLookupUrl || "",
      surfaceId: selectedSurface?.surfaceId || "",
      surfaceLabel: selectedSurface?.label || "",
      eventId: selectedEvent?.eventId || splitLines(registryEditor.eventIds)[0] || "",
      eventLabel: selectedEvent?.label || "",
      targetId: selectedTarget?.targetId || "",
      targetLabel: selectedTarget?.label || "",
      summary,
      instruction,
      generatedDirection,
      commandPrompt: [
        `pageId=${commandDetail.pageId || pageId}`,
        `route=${commandDetail.routePath || ""}`,
        `menuCode=${commandDetail.menuCode || selectedMenuCode}`,
        generatedDirection
      ].join("\n")
    });
    setActionMessage(response.message || (en ? "Automation ticket created." : "작업 지시 티켓을 생성했습니다."));
    await workbenchState.reload();
  }

  async function autoCollectRegistry() {
    if (!selectedMenuCode || !pageId) {
      setActionError(en ? "Select a page menu first." : "먼저 페이지 메뉴를 선택하세요.");
      return;
    }
    setCollectingRegistry(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await autoCollectFullStackGovernanceRegistry({
        menuCode: selectedMenuCode,
        pageId,
        menuUrl: commandDetail?.menuLookupUrl || stringOf(selectedSummary, "menuUrl"),
        mergeExisting: true,
        save: true
      });
      setRegistryEntry(result.entry);
      setRegistryEditor(toEditor(result.entry));
      setActionMessage(result.message || (en ? "Resources collected and saved." : "자원을 자동 수집하고 저장했습니다."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to auto collect resources." : "자원 자동 수집에 실패했습니다."));
    } finally {
      setCollectingRegistry(false);
    }
    try {
      await pageState.reload();
    } catch (error) {
      setActionError((error instanceof Error ? error.message : (en ? "Failed to refresh summary after collection." : "수집 후 요약 새로고침에 실패했습니다.")));
    }
  }

  const tabTitle = TAB_OPTIONS.find((item) => item.id === focus);

  function importSelectionToRegistry() {
    setRegistryEditor((current) => ({
      ...current,
      componentIds: joinLines(unique([...splitLines(current.componentIds), ...targetSelection.surfaceIds])),
      eventIds: joinLines(unique([...splitLines(current.eventIds), ...targetSelection.eventIds])),
      functionIds: joinLines(unique([...splitLines(current.functionIds), ...derivedSelection.functions])),
      apiIds: joinLines(unique([...splitLines(current.apiIds), ...derivedSelection.apis])),
      schemaIds: joinLines(unique([...splitLines(current.schemaIds), ...derivedSelection.schemas])),
      tableNames: joinLines(unique([...splitLines(current.tableNames), ...derivedSelection.tables])),
      columnNames: joinLines(unique([...splitLines(current.columnNames), ...derivedSelection.columns]))
    }));
    setActionMessage(en ? "Selected resources copied to the registry editor." : "선택 자원을 레지스트리 편집기에 반영했습니다.");
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Platform Studio" : "플랫폼 스튜디오" }
      ]}
      title={en ? "Platform Studio" : "플랫폼 스튜디오"}
      subtitle={en ? "Create menu pages, toggle visibility, edit connected resources, and create AI work instructions from one console." : "메뉴 생성, 숨김/보이기, 연결 자원 편집, AI 작업지시 생성까지 하나의 콘솔에서 처리합니다."}
      contextStrip={
        <ContextKeyStrip items={authorDesignContextKeys} />
      }
    >
      {actionMessage ? <PageStatusNotice tone="success">{actionMessage}</PageStatusNotice> : null}
      {actionError ? <PageStatusNotice tone="error">{actionError}</PageStatusNotice> : null}

      <section className="gov-card mb-6" data-help-id="platform-studio-tabs">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`gov-btn ${focus === tab.id ? "gov-btn-primary" : "gov-btn-outline"}`}
              onClick={() => setFocus(tab.id)}
            >
              {en ? tab.labelEn : tab.labelKo}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Current focus" : "현재 포커스"}: {en ? tabTitle?.labelEn : tabTitle?.labelKo}</p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[20rem_1fr] gap-6">
        <aside className="gov-card" data-help-id="platform-studio-menus">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold">{en ? "Managed Menus" : "관리 대상 메뉴"}</h3>
            <select className="gov-select max-w-[8rem]" value={menuType} onChange={(event) => setMenuType(event.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <label className="block mb-4">
            <span className="gov-label">{en ? "Menu Search" : "메뉴 검색"}</span>
            <input
              className="gov-input"
              placeholder={en ? "Menu name, code, URL, pageId" : "메뉴명, 코드, URL, pageId"}
              value={menuSearchKeyword}
              onChange={(event) => setMenuSearchKeyword(event.target.value)}
            />
          </label>
          <p className="mb-3 text-xs text-[var(--kr-gov-text-secondary)]">
            {en
              ? `Showing ${filteredSummaryRows.length} of ${summaryRows.length} managed menus`
              : `관리 대상 메뉴 ${summaryRows.length}건 중 ${filteredSummaryRows.length}건 표시`}
          </p>
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            {filteredSummaryRows.map((row) => {
              const menuCode = stringOf(row, "menuCode");
              const selected = menuCode === selectedMenuCode;
              return (
                <button key={menuCode} type="button" className={`w-full rounded-[var(--kr-gov-radius)] border px-3 py-3 text-left ${selected ? "border-[var(--kr-gov-focus)] bg-blue-50" : "border-[var(--kr-gov-border-light)] bg-white"}`} onClick={() => setSelectedMenuCode(menuCode)}>
                  <strong className="block">{stringOf(row, "menuNm") || menuCode}</strong>
                  <span className="block text-xs text-[var(--kr-gov-text-secondary)]">{menuCode} / {stringOf(row, "menuUrl") || "-"}</span>
                  <span className="block text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Coverage" : "커버리지"} {numberOf(row, "coverageScore")}</span>
                </button>
              );
            })}
            {filteredSummaryRows.length === 0 ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-5 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No managed menu matched the current search." : "현재 검색 조건과 일치하는 관리 대상 메뉴가 없습니다."}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="gov-card" data-help-id="platform-studio-controllers">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Menu / Page Control" : "메뉴 / 페이지 제어"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(selectedSummary, "menuCode")} / {stringOf(selectedSummary, "menuUrl") || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="gov-btn gov-btn-outline" type="button" onClick={() => { void toggleVisibility("Y"); }}>{en ? "Show" : "보이기"}</button>
                <button className="gov-btn gov-btn-outline" type="button" onClick={() => { void toggleVisibility("N"); }}>{en ? "Hide" : "숨기기"}</button>
              </div>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" onSubmit={(event) => { void createPageMenu(event); }}>
              <label>
                <span className="gov-label">{en ? "Parent Code" : "부모 코드"}</span>
                <input className="gov-input" name="parentCode" placeholder="A00601" />
              </label>
              <label>
                <span className="gov-label">{en ? "Page Name" : "페이지명"}</span>
                <input className="gov-input" name="codeNm" />
              </label>
              <label>
                <span className="gov-label">{en ? "Page Name EN" : "영문 페이지명"}</span>
                <input className="gov-input" name="codeDc" />
              </label>
              <label className="md:col-span-2">
                <span className="gov-label">{en ? "Page URL" : "페이지 URL"}</span>
                <input className="gov-input" name="menuUrl" placeholder={menuType === "USER" ? "/home/..." : "/admin/system/..."} />
              </label>
              <label>
                <span className="gov-label">{en ? "Icon" : "아이콘"}</span>
                <input className="gov-input" defaultValue="hub" name="menuIcon" />
              </label>
              <label>
                <span className="gov-label">{en ? "Use At" : "사용 여부"}</span>
                <select className="gov-select" defaultValue="Y" name="useAt">
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </label>
              <div className="flex items-end">
                <button className="gov-btn gov-btn-primary w-full" type="submit">{en ? "Create Page Menu" : "페이지 메뉴 생성"}</button>
              </div>
            </form>
          </section>

          <section className="gov-card" data-help-id="platform-studio-registry">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Coverage / Governance Quality" : "커버리지 / 거버넌스 품질"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Check how much of the selected menu is actually collected before editing by focus."
                    : "포커스별 편집 전에 선택 메뉴가 실제로 얼마나 수집됐는지 먼저 확인합니다."}
                </p>
              </div>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                <div><strong>Page ID</strong>: {stringOf(selectedSummary, "pageId") || "-"}</div>
                <div><strong>{en ? "Registry Source" : "레지스트리 소스"}</strong>: {registryEntry?.source || "-"}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
              {qualityCards.map((card) => (
                <SummaryMetricCard
                  accentClassName="text-[var(--kr-gov-text-primary)]"
                  className={card.tone}
                  key={card.label}
                  surfaceClassName=""
                  title={card.label}
                  value={card.value}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <KeyValueGridPanel
                className="border-[var(--kr-gov-border-light)] bg-[#fcfdff]"
                items={[
                  { label: "Manifest", value: stringOf(selectedSummary, "hasManifestRegistry") === "true" ? "OK" : "-" },
                  { label: "Screen Command", value: stringOf(selectedSummary, "hasScreenCommand") === "true" ? "OK" : "-" },
                  { label: "Governance Registry", value: stringOf(selectedSummary, "hasGovernanceRegistry") === "true" ? "OK" : "-" },
                  { label: "VIEW Feature", value: stringOf(selectedSummary, "requiredViewFeatureCode") || commandDetail?.menuPermission?.requiredViewFeatureCode || "-" },
                  { label: en ? "Relation Tables" : "권한 해석 테이블", value: numberOf(selectedSummary, "relationTableCount") || (commandDetail?.menuPermission?.relationTables || []).length || 0 },
                  { label: en ? "Resolver Notes" : "해석 노트", value: numberOf(selectedSummary, "resolverNoteCount") || (commandDetail?.menuPermission?.resolverNotes || []).length || 0 }
                ]}
                title={en ? "Manifest / Permission" : "매니페스트 / 권한"}
              >
                <p className="text-sm text-[var(--kr-gov-text-secondary)] break-words">
                  {(commandDetail?.menuPermission?.resolverNotes || []).join(" ") || "-"}
                </p>
                <p className="mt-2 text-sm break-words">
                  <strong>{en ? "Relation Tables" : "권한 해석 테이블"}:</strong> {(commandDetail?.menuPermission?.relationTables || []).join(", ") || "-"}
                </p>
              </KeyValueGridPanel>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fffdf7] p-4">
                <h4 className="font-bold mb-2">{en ? "Gaps / Tags" : "누락 항목 / 태그"}</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGaps.length === 0 ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{en ? "No major gaps" : "주요 누락 없음"}</span>
                  ) : selectedGaps.map((gap) => (
                    <span key={gap} className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{gap}</span>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{en ? "Registry Tags" : "레지스트리 태그"}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)] break-words">
                    {(registryEntry?.tags || []).join(", ") || "-"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="gov-card" data-help-id="platform-studio-automation">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Target Picker" : "수정 대상 선택"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Point to the exact surface, event, API, schema, and DB resources before saving or creating an SR ticket." : "저장이나 SR 생성 전에 정확한 화면 요소, 이벤트, API, 스키마, DB 자원을 지목합니다."}</p>
              </div>
              <button className="gov-btn gov-btn-outline" type="button" onClick={importSelectionToRegistry}>{en ? "Copy To Registry" : "레지스트리에 반영"}</button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div>
                <h4 className="mb-2 font-semibold">{en ? "Surfaces" : "화면 요소"}</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {(commandDetail?.surfaces || []).map((item) => (
                    <label key={item.surfaceId} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.surfaceIds.includes(item.surfaceId)} onChange={() => setTargetSelection((current) => ({ ...current, surfaceIds: toggleSelection(current.surfaceIds, item.surfaceId) }))} />
                      <span><strong>{item.surfaceId}</strong><br />{item.label}<br /><span className="text-[var(--kr-gov-text-secondary)]">{item.selector}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">{en ? "Events / Functions" : "이벤트 / 함수"}</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {(commandDetail?.events || []).map((item) => (
                    <label key={item.eventId} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.eventIds.includes(item.eventId)} onChange={() => setTargetSelection((current) => ({ ...current, eventIds: toggleSelection(current.eventIds, item.eventId), functionIds: unique(toggleSelection(current.eventIds, item.eventId).includes(item.eventId) ? [...current.functionIds, item.frontendFunction] : current.functionIds.filter((value) => value !== item.frontendFunction)) }))} />
                      <span><strong>{item.eventId}</strong><br />{item.label}<br /><span className="text-[var(--kr-gov-text-secondary)]">{item.frontendFunction} / {(item.apiIds || []).join(", ") || "-"}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">{en ? "Change Target" : "수정 타깃"}</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {(commandDetail?.changeTargets || []).map((item) => (
                    <label key={item.targetId} className="flex gap-2 text-sm">
                      <input type="radio" name="changeTargetId" checked={targetSelection.changeTargetId === item.targetId} onChange={() => setTargetSelection((current) => ({ ...current, changeTargetId: item.targetId }))} />
                      <span><strong>{item.targetId}</strong><br />{item.label}<br /><span className="text-[var(--kr-gov-text-secondary)]">{(item.editableFields || []).join(", ")}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">API / Schema</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {(commandDetail?.apis || []).map((item) => (
                    <label key={item.apiId} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.apiIds.includes(item.apiId)} onChange={() => setTargetSelection((current) => ({ ...current, apiIds: toggleSelection(current.apiIds, item.apiId) }))} />
                      <span><strong>{item.apiId}</strong><br />{item.method} {item.endpoint}<br /><span className="text-[var(--kr-gov-text-secondary)]">{getScreenCommandChainText(item.controllerActions, item.controllerAction, " / ")}</span></span>
                    </label>
                  ))}
                  {(commandDetail?.schemas || []).map((item) => (
                    <label key={item.schemaId} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.schemaIds.includes(item.schemaId)} onChange={() => setTargetSelection((current) => ({ ...current, schemaIds: toggleSelection(current.schemaIds, item.schemaId) }))} />
                      <span><strong>{item.schemaId}</strong><br />{item.tableName}<br /><span className="text-[var(--kr-gov-text-secondary)]">{(item.columns || []).slice(0, 4).join(", ")}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">{en ? "Tables" : "테이블"}</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {unique([...(registryEntry?.tableNames || []), ...derivedSelection.tables, ...(commandDetail?.schemas || []).map((item) => item.tableName)]).map((item) => (
                    <label key={item} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.tableNames.includes(item)} onChange={() => setTargetSelection((current) => ({ ...current, tableNames: toggleSelection(current.tableNames, item) }))} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">{en ? "Columns" : "컬럼"}</h4>
                <div className="space-y-2 rounded-[var(--kr-gov-radius)] border p-3 max-h-[14rem] overflow-auto">
                  {unique([...(registryEntry?.columnNames || []), ...derivedSelection.columns]).map((item) => (
                    <label key={item} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={targetSelection.columnNames.includes(item)} onChange={() => setTargetSelection((current) => ({ ...current, columnNames: toggleSelection(current.columnNames, item) }))} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Resource Registry" : "자원 레지스트리"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Edit all connected assets in one place. The active tab changes the emphasis, not the source of truth." : "연결 자원을 한 곳에서 편집합니다. 탭은 강조점만 바꾸고 source of truth는 하나입니다."}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="gov-btn gov-btn-outline" disabled={collectingRegistry} type="button" onClick={() => { void autoCollectRegistry(); }}>
                  {collectingRegistry ? (en ? "Collecting..." : "수집 중...") : (en ? "Auto Collect" : "자동 수집")}
                </button>
                <button className="gov-btn gov-btn-primary" disabled={savingRegistry} type="button" onClick={() => { void saveRegistry(); }}>
                  {savingRegistry ? (en ? "Saving..." : "저장 중...") : (en ? "Save Registry" : "레지스트리 저장")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <label className={focus === "overview" ? "xl:col-span-2" : ""}>
                <span className="gov-label">{en ? "Summary" : "요약"}</span>
                <textarea className="gov-textarea min-h-[96px]" value={registryEditor.summary} onChange={(event) => setRegistryEditor((current) => ({ ...current, summary: event.target.value }))} />
              </label>
              <label>
                <span className="gov-label">{en ? "Owner Scope" : "소유 범위"}</span>
                <input className="gov-input" value={registryEditor.ownerScope} onChange={(event) => setRegistryEditor((current) => ({ ...current, ownerScope: event.target.value }))} />
              </label>
              <label>
                <span className="gov-label">{en ? "Notes" : "메모"}</span>
                <input className="gov-input" value={registryEditor.notes} onChange={(event) => setRegistryEditor((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              {(focus === "overview" || focus === "surfaces") ? <label><span className="gov-label">{en ? "Frontend Sources" : "프론트 소스"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.frontendSources} onChange={(event) => setRegistryEditor((current) => ({ ...current, frontendSources: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "surfaces") ? <label><span className="gov-label">{en ? "Component IDs" : "컴포넌트 ID"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.componentIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, componentIds: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "events") ? <label><span className="gov-label">{en ? "Event IDs" : "이벤트 ID"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.eventIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, eventIds: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "functions") ? <label><span className="gov-label">{en ? "Function IDs" : "함수 ID"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.functionIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, functionIds: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "functions") ? <label><span className="gov-label">{en ? "Parameters" : "파라미터"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.parameterSpecs} onChange={(event) => setRegistryEditor((current) => ({ ...current, parameterSpecs: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "functions") ? <label><span className="gov-label">{en ? "Results" : "결과값"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.resultSpecs} onChange={(event) => setRegistryEditor((current) => ({ ...current, resultSpecs: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "apis" || focus === "controllers") ? <label><span className="gov-label">{en ? "API IDs" : "API ID"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.apiIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, apiIds: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "apis" || focus === "controllers") ? <label><span className="gov-label">{en ? "Schema IDs" : "스키마 ID"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.schemaIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, schemaIds: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "db") ? <label><span className="gov-label">{en ? "Tables" : "테이블"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.tableNames} onChange={(event) => setRegistryEditor((current) => ({ ...current, tableNames: event.target.value }))} /></label> : null}
              {(focus === "overview" || focus === "columns") ? <label><span className="gov-label">{en ? "Columns" : "컬럼"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.columnNames} onChange={(event) => setRegistryEditor((current) => ({ ...current, columnNames: event.target.value }))} /></label> : null}
              {focus === "overview" ? <label><span className="gov-label">{en ? "Feature Codes" : "기능 코드"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.featureCodes} onChange={(event) => setRegistryEditor((current) => ({ ...current, featureCodes: event.target.value }))} /></label> : null}
              {focus === "overview" ? <label><span className="gov-label">{en ? "Common Code Groups" : "공통코드 그룹"}</span><textarea className="gov-textarea min-h-[120px]" value={registryEditor.commonCodeGroups} onChange={(event) => setRegistryEditor((current) => ({ ...current, commonCodeGroups: event.target.value }))} /></label> : null}
            </div>
            <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "One item per line. Tables use TABLE_NAME, columns use TABLE_NAME.COLUMN_NAME, and parameter/result use name:type or name:type:source." : "한 줄에 하나씩 입력합니다. 테이블은 TABLE_NAME, 컬럼은 TABLE_NAME.COLUMN_NAME, 파라미터/결과값은 name:type 또는 name:type:source 형식을 사용합니다."}</p>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Connected Metadata" : "연결 메타데이터"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{commandDetail?.routePath || stringOf(selectedSummary, "menuUrl") || "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-[var(--kr-gov-radius)] border px-4 py-3"><strong>{en ? "Surfaces" : "화면 요소"}</strong><div>{commandDetail?.surfaces?.length || 0}</div></div>
              <div className="rounded-[var(--kr-gov-radius)] border px-4 py-3"><strong>{en ? "Events" : "이벤트"}</strong><div>{commandDetail?.events?.length || 0}</div></div>
              <div className="rounded-[var(--kr-gov-radius)] border px-4 py-3"><strong>API</strong><div>{commandDetail?.apis?.length || 0}</div></div>
              <div className="rounded-[var(--kr-gov-radius)] border px-4 py-3"><strong>{en ? "Schemas" : "스키마"}</strong><div>{commandDetail?.schemas?.length || 0}</div></div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>{en ? "Type" : "유형"}</th><th>{en ? "Id / Label" : "ID / 라벨"}</th><th>{en ? "Connection" : "연결"}</th></tr></thead>
                <tbody>
                  {(focus === "events" ? (commandDetail?.events || []).map((item) => ({ type: "event", id: item.eventId, label: item.label, extra: `${item.frontendFunction} / ${(item.apiIds || []).join(", ")}` })) :
                    focus === "functions" ? (commandDetail?.events || []).map((item) => ({ type: "function", id: item.frontendFunction, label: item.label, extra: `${(item.functionInputs || []).length} in / ${(item.functionOutputs || []).length} out` })) :
                    focus === "apis" || focus === "controllers" ? (commandDetail?.apis || []).map((item) => ({ type: "api", id: item.apiId, label: `${item.method} ${item.endpoint}`, extra: `${getScreenCommandChainText(item.controllerActions, item.controllerAction)} -> ${getScreenCommandChainText(item.serviceMethods, item.serviceMethod)}` })) :
                    focus === "db" ? splitLines(registryEditor.tableNames).map((item) => ({ type: "table", id: item, label: item, extra: splitLines(registryEditor.columnNames).filter((column) => column.startsWith(`${item}.`)).length + " columns" })) :
                    focus === "columns" ? splitLines(registryEditor.columnNames).map((item) => ({ type: "column", id: item, label: item, extra: splitLines(registryEditor.apiIds).join(", ") || "-" })) :
                    focus === "surfaces" ? (commandDetail?.surfaces || []).map((item) => ({ type: "surface", id: item.surfaceId, label: item.label, extra: `${item.selector} / ${item.componentId}` })) :
                    [
                      ...(commandDetail?.surfaces || []).map((item) => ({ type: "surface", id: item.surfaceId, label: item.label, extra: item.componentId })),
                      ...(commandDetail?.events || []).map((item) => ({ type: "event", id: item.eventId, label: item.label, extra: item.frontendFunction })),
                      ...(commandDetail?.apis || []).map((item) => ({ type: "api", id: item.apiId, label: `${item.method} ${item.endpoint}`, extra: getScreenCommandChainText(item.controllerActions, item.controllerAction, " / ") }))
                    ]).map((row) => (
                    <tr key={`${row.type}-${row.id}`}>
                      <td>{row.type}</td>
                      <td><strong>{row.id}</strong><div className="text-[var(--kr-gov-text-secondary)]">{row.label}</div></td>
                      <td>{row.extra || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Collected Metadata Overview" : "수집 메타데이터 개요"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {pageId
                    ? (en ? "Same governance resolution and auto-collect basis as environment management." : "환경 관리와 동일한 거버넌스 해석 및 자동 수집 기준으로 표시합니다.")
                    : (en ? "This menu is not linked to a collectable governance page yet." : "이 메뉴는 아직 수집 가능한 거버넌스 페이지와 연결되지 않았습니다.")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-4 py-3">
                <p className="font-bold text-[var(--kr-gov-blue)]">Page ID</p>
                <p className="mt-1 font-mono text-sm">{governanceOverview.pageId || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f7fbf8] px-4 py-3">
                <p className="font-bold text-[#196c2e]">{en ? "Source" : "소스"}</p>
                <p className="mt-1 font-mono text-sm">{governanceOverview.source || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fcfbf7] px-4 py-3">
                <p className="font-bold text-[#8a5a00]">{en ? "Menu URL" : "메뉴 URL"}</p>
                <p className="mt-1 break-all font-mono text-sm">{stringOf(selectedSummary, "menuUrl") || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fff1f2] px-4 py-3">
                <p className="font-bold text-[#be123c]">Summary</p>
                <p className="mt-1 text-sm">{governanceOverview.summary || "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                <h4 className="font-bold mb-2">{en ? "Collected Entities" : "수집 항목"}</h4>
                <div className="space-y-3 text-sm">
                  <div><strong>{en ? "Components" : "컴포넌트"}</strong>{renderMetaList(governanceOverview.componentIds, en ? "No components collected yet." : "수집된 컴포넌트가 없습니다.")}</div>
                  <div><strong>{en ? "Events" : "이벤트"}</strong>{renderMetaList(governanceOverview.eventIds, en ? "No events collected yet." : "수집된 이벤트가 없습니다.")}</div>
                  <div><strong>{en ? "Functions" : "함수"}</strong>{renderMetaList(governanceOverview.functionIds, en ? "No functions collected yet." : "수집된 함수가 없습니다.")}</div>
                  <div><strong>API</strong>{renderMetaList(governanceOverview.apiIds, en ? "No APIs collected yet." : "수집된 API가 없습니다.")}</div>
                  <div><strong>Controller</strong>{renderMetaList(governanceOverview.controllerActions, en ? "No controller actions collected yet." : "수집된 Controller 액션이 없습니다.")}</div>
                  <div><strong>Service</strong>{renderMetaList(governanceOverview.serviceMethods, en ? "No service methods collected yet." : "수집된 Service 메서드가 없습니다.")}</div>
                  <div><strong>Mapper</strong>{renderMetaList(governanceOverview.mapperQueries, en ? "No mapper queries collected yet." : "수집된 Mapper 쿼리가 없습니다.")}</div>
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                <h4 className="font-bold mb-2">{en ? "Schema / Permission / Codes" : "스키마 / 권한 / 코드"}</h4>
                <div className="space-y-3 text-sm">
                  <div><strong>{en ? "Parameters" : "파라미터"}</strong>{renderMetaList(governanceOverview.parameterSpecs, en ? "No parameters collected yet." : "수집된 파라미터가 없습니다.")}</div>
                  <div><strong>{en ? "Results" : "결과값"}</strong>{renderMetaList(governanceOverview.resultSpecs, en ? "No results collected yet." : "수집된 출력값이 없습니다.")}</div>
                  <div><strong>{en ? "Schemas" : "스키마"}</strong>{renderMetaList(governanceOverview.schemaIds, en ? "No schemas collected yet." : "수집된 스키마가 없습니다.")}</div>
                  <div><strong>{en ? "Tables" : "테이블"}</strong>{renderMetaList(governanceOverview.tableNames, en ? "No tables collected yet." : "수집된 테이블이 없습니다.")}</div>
                  <div><strong>{en ? "Columns" : "컬럼"}</strong>{renderMetaList(governanceOverview.columnNames, en ? "No columns collected yet." : "수집된 컬럼이 없습니다.")}</div>
                  <div><strong>{en ? "Feature Codes" : "기능 코드"}</strong>{renderMetaList(governanceOverview.featureCodes, en ? "No feature codes collected yet." : "수집된 기능 코드가 없습니다.")}</div>
                  <div><strong>{en ? "Common Code Groups" : "공통코드 그룹"}</strong>{renderMetaList(governanceOverview.commonCodeGroups, en ? "No common code groups collected yet." : "수집된 공통코드가 없습니다.")}</div>
                  <div><strong>Tags</strong>{renderMetaList(governanceOverview.tags, en ? "No tags collected yet." : "수집된 태그가 없습니다.")}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Surface-Centric Chain" : "화면 요소 기준 상세 체인"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Surface -> child elements -> event -> function -> API -> backend chain" : "화면 요소 -> 작은 요소 -> 이벤트 -> 함수 -> API -> 백엔드 체인"}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {governanceSurfaceChains.length === 0 ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No surface chain collected yet." : "아직 수집된 화면 요소 체인이 없습니다."}</p>
              ) : governanceSurfaceChains.map((surface) => (
                <article key={surface.surfaceId} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold">{surface.label}</h4>
                      <p className="mt-1 font-mono text-xs text-[var(--kr-gov-text-secondary)]">{surface.surfaceId}</p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{surface.selector || "-"}</p>
                    </div>
                    <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                      <div><strong>Component</strong>: {surface.componentId || "-"}</div>
                      <div><strong>Zone</strong>: {surface.layoutZone || "-"}</div>
                    </div>
                  </div>
                  {surface.childElements.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-semibold">{en ? "Child Elements" : "작은 요소"}</p>
                      <div className="flex flex-wrap gap-2">
                        {surface.childElements.map((child) => (
                          <span key={`${child.instanceKey}-${child.componentId}`} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px]">
                            {child.componentName || child.instanceKey || child.componentId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-3">
                    {surface.events.length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No linked event." : "연결된 이벤트가 없습니다."}</p>
                    ) : surface.events.map((event) => (
                      <div key={event.eventId} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{event.label}</p>
                            <p className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{event.eventId}</p>
                          </div>
                          <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                            <div><strong>Type</strong>: {event.eventType || "-"}</div>
                            <div><strong>Function</strong>: {event.frontendFunction || "-"}</div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3 text-sm">
                          <div>
                            <strong>{en ? "Parameters" : "파라미터"}</strong>
                            {renderMetaList(event.functionInputs.map((field) => `${field.fieldId}:${field.type}`), en ? "No parameters" : "파라미터 없음")}
                          </div>
                          <div>
                            <strong>{en ? "Results" : "결과값"}</strong>
                            {renderMetaList(event.functionOutputs.map((field) => `${field.fieldId}:${field.type}`), en ? "No results" : "결과값 없음")}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {event.apis.length === 0 ? (
                            <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No linked API." : "연결된 API가 없습니다."}</p>
                          ) : event.apis.map((api) => (
                            <div key={api.apiId} className="rounded-[var(--kr-gov-radius)] border border-white bg-white p-3 text-sm">
                              <p className="font-semibold">{api.apiId} <span className="font-normal text-[var(--kr-gov-text-secondary)]">({api.method} {api.endpoint})</span></p>
                              <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-3">
                                <div><strong>Controller</strong>{renderMetaList(api.controllerActions, en ? "No controller" : "Controller 없음")}</div>
                                <div><strong>Service</strong>{renderMetaList(api.serviceMethods, en ? "No service" : "Service 없음")}</div>
                                <div><strong>Mapper</strong>{renderMetaList(api.mapperQueries, en ? "No mapper" : "Mapper 없음")}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Surface-Event Mapping Table" : "화면 요소-이벤트 매핑 표"}</h3>
              </div>
            </div>
            <div className="table-wrap max-w-full overflow-x-auto">
              <table className="data-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th>{en ? "Surface" : "화면 요소"}</th>
                    <th>{en ? "Child Elements" : "작은 요소"}</th>
                    <th>{en ? "Event" : "이벤트"}</th>
                    <th>{en ? "Function" : "함수"}</th>
                    <th>{en ? "Parameters / Results" : "파라미터 / 결과값"}</th>
                    <th>API</th>
                    <th>Controller / Service / Mapper</th>
                  </tr>
                </thead>
                <tbody>
                  {governanceSurfaceEventRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-[var(--kr-gov-text-secondary)]">{en ? "No mapping rows collected yet." : "아직 수집된 매핑 행이 없습니다."}</td>
                    </tr>
                  ) : governanceSurfaceEventRows.map((row, index) => (
                    <tr key={`${row.surfaceId}-${row.eventId}-${index}`}>
                      <td><strong>{row.surfaceLabel}</strong><br /><span className="text-[var(--kr-gov-text-secondary)]">{row.surfaceId}</span></td>
                      <td>{row.childElements || "-"}</td>
                      <td><strong>{row.eventLabel}</strong><br /><span className="text-[var(--kr-gov-text-secondary)]">{row.eventId} / {row.eventType}</span></td>
                      <td>{row.frontendFunction || "-"}</td>
                      <td><strong>P</strong>: {row.parameters}<br /><strong>R</strong>: {row.results}</td>
                      <td>{row.apiLabels || "-"}</td>
                      <td><strong>C</strong>: {row.controllerActions}<br /><strong>S</strong>: {row.serviceMethods}<br /><strong>M</strong>: {row.mapperQueries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Impact Preview" : "영향도 미리보기"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Check every linked layer before hide, change, or deletion." : "숨김, 수정, 삭제 전에 연계 레이어를 먼저 확인합니다."}</p>
              </div>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Linked resources" : "연결 자원"}: {impactRows.length}</div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>{en ? "Layer" : "레이어"}</th><th>ID</th><th>{en ? "Impact" : "영향"}</th></tr></thead>
                <tbody>
                  {impactRows.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-[var(--kr-gov-text-secondary)]">{en ? "Select targets to preview impact." : "대상을 선택하면 영향도를 보여줍니다."}</td></tr>
                  ) : impactRows.map((row) => (
                    <tr key={`${row.layer}-${row.id}`}>
                      <td>{row.layer}</td>
                      <td><strong>{row.id}</strong></td>
                      <td>{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-card">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-bold">{en ? "Automation Work Request" : "자동화 작업 지시"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Generate an SR work ticket from the currently selected menu and resources." : "현재 선택한 메뉴와 자원을 기준으로 SR 작업 티켓을 생성합니다."}</p>
              </div>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Tickets" : "티켓"}: {workbench?.ticketCount || 0}</div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
              <div>
                <label className="gov-label" htmlFor="automation-summary">{en ? "Summary" : "요약"}</label>
                <input className="gov-input" id="automation-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
                <label className="gov-label mt-4" htmlFor="automation-instruction">{en ? "Instruction" : "상세 지시"}</label>
                <textarea className="gov-textarea min-h-[150px]" id="automation-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} />
                <button className="gov-btn gov-btn-primary mt-4" type="button" onClick={() => { void createAutomationTicket(); }}>{en ? "Create SR Ticket" : "SR 티켓 생성"}</button>
              </div>
              <div>
                <label className="gov-label">{en ? "Generated Direction" : "생성된 지시문"}</label>
                <textarea className="gov-textarea min-h-[230px]" readOnly value={buildDirection(commandDetail, registryEditor, targetSelection, summary, instruction)} />
              </div>
            </div>
          </section>
        </div>
      </section>
    </AdminPageShell>
  );
}
