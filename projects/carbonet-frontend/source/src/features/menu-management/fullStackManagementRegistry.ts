import {
  findManifestByMenuCodeOrRoutePath,
  normalizeManifestLookupPath
} from "../../platform/screen-registry/pageManifestIndex";
import {
  type FullStackGovernanceRegistryEntry,
  type ScreenCommandPagePayload
} from "../../lib/api/platformTypes";
import { stringOf } from "../admin-system/adminSystemShared";
import { buildMenuTree, flattenMenuOrderPayload, type MenuTreeNode, updateMenuSortOrders } from "./menuTreeShared";
import { toDisplayMenuUrl } from "./menuUrlDisplay";

export type MenuNode = MenuTreeNode;

export type RegistryEditorState = {
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

export function resolveGovernancePageId(
  selectedMenuRow: Record<string, unknown> | null,
  pages: ScreenCommandPagePayload["pages"] | undefined
) {
  if (!selectedMenuRow) {
    return "";
  }
  const menuCode = stringOf(selectedMenuRow, "code").toUpperCase();
  const menuPath = normalizeManifestLookupPath(stringOf(selectedMenuRow, "menuUrl"));
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

export function buildTree(rows: Array<Record<string, unknown>>) {
  return buildMenuTree(rows, { includeUseAt: true, mapUrl: toDisplayMenuUrl });
}

export function updateSortOrders(items: MenuNode[]) {
  updateMenuSortOrders(items);
}

export function flattenPayload(items: MenuNode[], output: string[] = []) {
  return flattenMenuOrderPayload(items, output);
}

export function summarizeFields(items: Array<{ fieldId: string; type: string }> | undefined) {
  if (!items || items.length === 0) {
    return "-";
  }
  return items.map((item) => `${item.fieldId}:${item.type}`).join(", ");
}

function joinLines(items: string[] | undefined) {
  return (items || []).join("\n");
}

export function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueLines(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function mergeLineBlock(current: string, additions: string[]) {
  return uniqueLines([...splitLines(current), ...additions]).join("\n");
}

export function validateRegistryEditor(editor: RegistryEditorState, en: boolean) {
  const errors: string[] = [];
  const tablePattern = /^[A-Z][A-Z0-9_]*$/;
  const columnPattern = /^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/;
  const upperTokenPattern = /^[A-Z][A-Z0-9_]*$/;
  const fieldSpecPattern = /^[^:\s][^:]*:[^:\s][^:]*(:[^:\s][^:]*)?$/;

  const checkLines = (value: string, pattern: RegExp, messageKo: string, messageEn: string) => {
    const invalid = splitLines(value).find((item) => !pattern.test(item.trim().toUpperCase()));
    if (invalid) {
      errors.push(en ? `${messageEn}: ${invalid}` : `${messageKo}: ${invalid}`);
    }
  };

  checkLines(editor.tableNames, tablePattern, "테이블은 TABLE_NAME 형식이어야 합니다", "Tables must use TABLE_NAME format");
  checkLines(editor.columnNames, columnPattern, "컬럼은 TABLE_NAME.COLUMN_NAME 형식이어야 합니다", "Columns must use TABLE_NAME.COLUMN_NAME format");
  checkLines(editor.featureCodes, upperTokenPattern, "기능 코드는 FEATURE_CODE 형식이어야 합니다", "Feature codes must use FEATURE_CODE format");
  checkLines(editor.commonCodeGroups, upperTokenPattern, "공통코드 그룹은 CODE_GROUP 형식이어야 합니다", "Common code groups must use CODE_GROUP format");

  const invalidParam = splitLines(editor.parameterSpecs).find((item) => !fieldSpecPattern.test(item));
  if (invalidParam) {
    errors.push(en ? `Parameters must use name:type or name:type:source format: ${invalidParam}` : `파라미터는 name:type 또는 name:type:source 형식이어야 합니다: ${invalidParam}`);
  }
  const invalidResult = splitLines(editor.resultSpecs).find((item) => !fieldSpecPattern.test(item));
  if (invalidResult) {
    errors.push(en ? `Results must use name:type or name:type:source format: ${invalidResult}` : `결과값은 name:type 또는 name:type:source 형식이어야 합니다: ${invalidResult}`);
  }

  return errors;
}

export function editorFromRegistry(entry: FullStackGovernanceRegistryEntry): RegistryEditorState {
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

export function buildSeedRegistry(
  menuCode: string,
  selectedRow: Record<string, unknown> | null,
  governancePageId: string,
  governanceDetail: ScreenCommandPagePayload["page"] | null
): FullStackGovernanceRegistryEntry {
  return {
    menuCode,
    pageId: governancePageId || "",
    menuUrl: stringOf(selectedRow, "menuUrl") || governanceDetail?.menuLookupUrl || "",
    summary: governanceDetail?.summary || "",
    ownerScope: "",
    notes: "",
    frontendSources: governanceDetail?.source ? [governanceDetail.source] : [],
    componentIds: Array.from(new Set([
      ...(governanceDetail?.surfaces || []).map((item) => item.componentId).filter(Boolean),
      ...((governanceDetail?.manifestRegistry?.components || []).map((item) => String(item.componentId || "")).filter(Boolean))
    ])),
    eventIds: (governanceDetail?.events || []).map((item) => item.eventId),
    functionIds: Array.from(new Set((governanceDetail?.events || []).map((item) => item.frontendFunction).filter(Boolean))),
    parameterSpecs: (governanceDetail?.events || []).flatMap((item) => (item.functionInputs || []).map((field) => `${field.fieldId}:${field.type}:${field.source || "input"}`)),
    resultSpecs: (governanceDetail?.events || []).flatMap((item) => (item.functionOutputs || []).map((field) => `${field.fieldId}:${field.type}:${field.source || "output"}`)),
    apiIds: (governanceDetail?.apis || []).map((item) => item.apiId),
    controllerActions: [],
    serviceMethods: [],
    mapperQueries: [],
    schemaIds: (governanceDetail?.schemas || []).map((item) => item.schemaId),
    tableNames: Array.from(new Set([
      ...(governanceDetail?.schemas || []).map((item) => item.tableName).filter(Boolean),
      ...(governanceDetail?.apis || []).flatMap((item) => item.relatedTables || []),
      ...(governanceDetail?.menuPermission?.relationTables || [])
    ])),
    columnNames: Array.from(new Set((governanceDetail?.schemas || []).flatMap((item) => item.columns || []))),
    featureCodes: Array.from(new Set([
      ...(governanceDetail?.menuPermission?.featureCodes || []),
      ...((governanceDetail?.menuPermission?.featureRows || []).map((item) => item.featureCode))
    ])),
    commonCodeGroups: (governanceDetail?.commonCodeGroups || []).map((item) => item.codeGroupId),
    tags: [],
    updatedAt: "",
    source: "DERIVED"
  };
}
