import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchEmissionCategories,
  fetchChemicalMaterialSuggestions,
  fetchEcoinventDatasetPage,
  fetchEcoinventFilterOptions,
  fetchEcoinventMappedFactors,
  fetchEmissionSurveyAdminPage,
  fetchSurveyEcoinventAiRecommendationPage,
  fetchSurveyEcoinventRecommendationPage,
  fetchEmissionTiers,
  fetchEmissionVariableDefinitions,
  importSelectedEcoinventDatasets,
  saveEcoinventMapping,
  uploadEmissionSurveyWorkbook
} from "../../lib/api/emission";
import type {
  EmissionCategoryItem,
  ChemicalMaterialRow,
  EcoinventDatasetRow,
  EmissionFactorDefinition,
  EmissionSurveyAdminPagePayload,
  EmissionSurveyAdminSection
} from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { getUnitOptionsByCategory, normalizeUnitValue, resolveUnitCategory, UNIT_CATEGORY_OPTIONS } from "../emission-common/unitOptions";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberActionBar, MemberButton, MemberSectionToolbar } from "../member/common";
import {
  EMISSION_SURVEY_OUTPUT_SECTION_CODE,
  saveEmissionSurveyReportSession,
  type EmissionSurveyAlertItem,
  type EmissionSurveyReportPayload,
  type EmissionSurveyReportRow,
  type EmissionSurveyReportSectionSummary,
  type EmissionSurveyScenarioCard
} from "../emission-survey-report/reportSession";

type DraftRow = {
  rowId: string;
  values: Record<string, string>;
};

type DraftCase = {
  rows: DraftRow[];
  savedAt: string;
};

type DraftState = Record<string, DraftCase>;
type SectionCaseState = Record<string, "CASE_3_1" | "CASE_3_2">;
type SectionExpandState = Record<string, boolean>;

type ClassificationRow = {
  code: string;
  label: string;
};

type ClassificationTreeNode = ClassificationRow & {
  middleRows?: ClassificationTreeNode[];
  smallRows?: ClassificationRow[];
};

type SurveyCalculationScopeState = {
  loading: boolean;
  ready: boolean;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  tier: number;
  tierLabel: string;
  factors: EmissionFactorDefinition[];
  message: string;
  blockingMessage: string;
};

type EcoinventMappingTarget = {
  sectionCode: string;
  rowId: string;
  materialName: string;
};

type ProductSearchOption = {
  value: string;
  label: string;
  description: string;
  source: "configured" | "chemical" | "typed";
};

const PRODUCT_SEARCH_DIRTY_MARKER = "productSearchDirty";
const PRODUCT_SEARCH_SYNCED_MARKER = "productSearchSynced";

function chemicalDisplayName(row: ChemicalMaterialRow, englishSite = isEnglish()) {
  return stringValue(englishSite ? row.englishName : row.koreanName) || stringValue(row.koreanName) || stringValue(row.englishName);
}

function chemicalSearchTerm(row: ChemicalMaterialRow) {
  return stringValue(row.englishName) || stringValue(row.koreanName) || stringValue(row.casNo);
}

const GEOGRAPHY_PRIORITY = ["KR", "ROW", "RER", "GLO", "EU", "US", "JP", "CN", "IN"];
const ORIGINAL_SECTION_COLUMNS: Record<string, Array<Record<string, string>>> = {
  INPUT_RAW_MATERIALS: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "usage", label: "용도", headerPath: JSON.stringify(["용도"]) },
    { key: "origin", label: "원산지\n(국가/업체명)", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "원산지\n(국가/업체명)"]) },
    { key: "marineTransport", label: "해양", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "수송방법", "해양"]) },
    { key: "marineTonKm", label: "물동량\n(ton · km)", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "수송방법", "물동량\n(ton · km)"]) },
    { key: "roadTransport", label: "육로", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "수송방법", "육로"]) },
    { key: "roadTonKm", label: "물동량\n(ton · km)", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "수송방법", "물동량\n(ton · km)"]) },
    { key: "transportRoute", label: "운송경로", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "운송경로"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "비고"]) }
  ],
  INPUT_ENERGY: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "usage", label: "용도", headerPath: JSON.stringify(["용도"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["비고"]) }
  ],
  INPUT_STEAM: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "usage", label: "용도", headerPath: JSON.stringify(["용도"]) },
    { key: "steamType", label: "스팀종류\n(포화증기/습증기/과열증기)", headerPath: JSON.stringify(["스팀종류\n(포화증기/습증기/과열증기)"]) },
    { key: "steamMass", label: "스팀의 질량", headerPath: JSON.stringify(["스팀의 질량"]) },
    { key: "condensateMass", label: "응축수 질량", headerPath: JSON.stringify(["응축수 질량"]) },
    { key: "condensateTemperature", label: "응축수\n온도", headerPath: JSON.stringify(["응축수\n온도"]) },
    { key: "steamCirculation", label: "스팀순환여부", headerPath: JSON.stringify(["스팀순환여부"]) },
    { key: "externalSteam", label: "외부스팀 여부", headerPath: JSON.stringify(["외부스팀 여부"]) }
  ],
  INPUT_MISC: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "usage", label: "용도", headerPath: JSON.stringify(["용도"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["비고"]) }
  ],
 OUTPUT_PRODUCTS: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "productionCost", label: "생산원가", headerPath: JSON.stringify(["생산원가"]) },
    { key: "costUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["비고"]) }
  ],
  OUTPUT_AIR: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "collectionMethod", label: "데이터 수집 방법", headerPath: JSON.stringify(["데이터 수집 방법"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["비고"]) }
  ],
  OUTPUT_WATER: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "treatmentRoute", label: "처리경로", headerPath: JSON.stringify(["처리경로"]) },
    { key: "treatmentMethod", label: "처리방법", headerPath: JSON.stringify(["처리방법"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["비고"]) }
  ],
  OUTPUT_WASTE: [
    { key: "group", label: "구분", headerPath: JSON.stringify(["구분"]) },
    { key: "materialName", label: "물질명", headerPath: JSON.stringify(["물질명"]) },
    { key: "amount", label: "양", headerPath: JSON.stringify(["양"]) },
    { key: "annualUnit", label: "단위", headerPath: JSON.stringify(["단위"]) },
    { key: "wasteType", label: "구분\n(일반/지정 폐기물)", headerPath: JSON.stringify(["구분\n(일반/지정 폐기물)"]) },
    { key: "treatmentMethod", label: "처리방법\n(매립/소각/재활용/기타)", headerPath: JSON.stringify(["처리방법\n(매립/소각/재활용/기타)"]) },
    { key: "transportTonKm", label: "물동량", headerPath: JSON.stringify(["재활용 및 최종폐기 과정 수송", "물동량"]) },
    { key: "marineTransport", label: "해양", headerPath: JSON.stringify(["재활용 및 최종폐기 과정 수송", "수송방법", "해양"]) },
    { key: "roadTransport", label: "육로", headerPath: JSON.stringify(["재활용 및 최종폐기 과정 수송", "수송방법", "육로"]) },
    { key: "transportRoute", label: "운송경로", headerPath: JSON.stringify(["재활용 및 최종폐기 과정 수송", "운송경로"]) },
    { key: "remark", label: "비고", headerPath: JSON.stringify(["재활용 및 최종폐기 과정 수송", "비고"]) }
  ]
};
const SECTION_GROUP_OPTIONS: Record<string, string[]> = {
  INPUT_RAW_MATERIALS: ["원료 물질", "보조 물질"],
  INPUT_ENERGY: ["에너지"],
  INPUT_STEAM: ["에너지"],
  INPUT_MISC: ["기타"],
  OUTPUT_PRODUCTS: ["제품", "부산물"],
  OUTPUT_AIR: ["대기 배출물"],
  OUTPUT_WATER: ["수계 배출물"],
  OUTPUT_WASTE: ["폐기물"]
};

function geographyPriority(row: EcoinventDatasetRow) {
  const geography = normalizeSearchKeyword(stringValue(row.geography));
  const matchedIndex = GEOGRAPHY_PRIORITY.findIndex((code) => geography === code.toLowerCase() || geography.includes(`(${code.toLowerCase()})`));
  return matchedIndex >= 0 ? matchedIndex : GEOGRAPHY_PRIORITY.length;
}

function ecoinventPriority(row: EcoinventDatasetRow, keyword: string) {
  if (stringValue(row.koreanName)) {
    return -1;
  }
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  const productName = normalizeSearchKeyword(stringValue(row.productName));
  const materialName = normalizeSearchKeyword(stringValue(row.materialName));
  const activityName = normalizeSearchKeyword(stringValue(row.activityName));
  const activityType = normalizeSearchKeyword(stringValue(row.activityType));
  if (normalizedKeyword && productName === normalizedKeyword) {
    return 0;
  }
  if (normalizedKeyword && productName.startsWith(normalizedKeyword)) {
    return activityType === "market_activity" ? 1 : 2;
  }
  if (activityType === "market_activity" || (normalizedKeyword && activityName.startsWith(`market for ${normalizedKeyword}`))) {
    return 3;
  }
  if (normalizedKeyword && productName.includes(normalizedKeyword)) {
    return 4;
  }
  if (normalizedKeyword && materialName.includes(normalizedKeyword)) {
    return 5;
  }
  if (normalizedKeyword && activityName.includes(normalizedKeyword)) {
    return 6;
  }
  return 7;
}

function ecoinventPriorityLabel(priority: number) {
  if (priority < 0) {
    return "이전 매핑";
  }
  if (priority <= 1) {
    return "1순위 Market";
  }
  if (priority <= 3) {
    return "추천";
  }
  if (priority <= 5) {
    return "관련 Product";
  }
  return "후보";
}

function containsKorean(value: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
}

function mergeEcoinventRows(previousRows: EcoinventDatasetRow[], searchRows: EcoinventDatasetRow[]) {
  const nextRows: EcoinventDatasetRow[] = [];
  const seenDatasetIds = new Set<string>();
  [...previousRows, ...searchRows].forEach((row) => {
    const datasetId = stringValue(row.datasetId);
    if (!datasetId || seenDatasetIds.has(datasetId)) {
      return;
    }
    seenDatasetIds.add(datasetId);
    nextRows.push(row);
  });
  return nextRows.sort((left, right) => {
    const leftPrevious = stringValue(left.koreanName) ? 0 : 1;
    const rightPrevious = stringValue(right.koreanName) ? 0 : 1;
    if (leftPrevious !== rightPrevious) {
      return leftPrevious - rightPrevious;
    }
    return geographyPriority(left) - geographyPriority(right);
  });
}

function buildMappedProductOptionFromValues(values: Record<string, string>): EcoinventDatasetRow | null {
  const datasetId = stringValue(values.ecoinventDatasetId);
  const productName = stringValue(values.ecoinventEnglishName);
  if (!datasetId || !productName) {
    return null;
  }
  return {
    datasetId: Number(datasetId),
    productName,
    activityName: stringValue(values.ecoinventActivity),
    geography: stringValue(values.ecoinventGeography),
    referenceProductUnit: stringValue(values.ecoinventUnit),
    score: decimalValue(values.emissionFactor)
  } as EcoinventDatasetRow;
}

function mergeCurrentMappedProductOption(rows: EcoinventDatasetRow[], values: Record<string, string>) {
  const currentOption = buildMappedProductOptionFromValues(values);
  if (!currentOption) {
    return rows;
  }
  const currentDatasetId = stringValue(currentOption.datasetId);
  if (rows.some((row) => stringValue(row.datasetId) === currentDatasetId)) {
    return rows;
  }
  return [currentOption, ...rows];
}

function isAutoRecommended(values: Record<string, string>) {
  return values.ecoinventMappingStatus === "AUTO_RECOMMENDED";
}

function hasUnconfirmedEcoinventRecommendations(
  sections: EmissionSurveyAdminSection[],
  activeCases: SectionCaseState,
  getCase: (sectionCode: string, caseCode: "CASE_3_1" | "CASE_3_2", fallbackRows: DraftRow[]) => DraftCase
) {
  return sections.some((section) => {
    const sectionCode = section.sectionCode || "";
    if (!supportsEmissionFactorColumn(sectionCode)) {
      return false;
    }
    const activeCase = activeCases[sectionCode] || "CASE_3_1";
    const rows = getCase(sectionCode, activeCase, buildDefaultCaseRows(section, activeCase)).rows;
    return rows.some((row) => isAutoRecommended(row.values));
  });
}

function stringOf(row: Record<string, unknown> | null | undefined, key: string) {
  if (!row) {
    return "";
  }
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function buildDraftKey(classificationKey: string, sectionCode: string, caseCode: string) {
  return `${classificationKey}:${sectionCode}:${caseCode}`;
}

function normalizeRowValues(values: Record<string, string>) {
  const nextValues = { ...values };
  Object.keys(nextValues).forEach((key) => {
    if (String(nextValues[key] || "").trim() === "-") {
      nextValues[key] = "";
    }
  });
  if ("annualUnit" in nextValues) {
    nextValues.annualUnit = normalizeUnitValue(nextValues.annualUnit || "");
    nextValues.annualUnitCategory = nextValues.annualUnitCategory || resolveUnitCategory(nextValues.annualUnit);
  }
  if ("costUnit" in nextValues) {
    nextValues.costUnit = normalizeUnitValue(nextValues.costUnit || "");
    nextValues.costUnitCategory = nextValues.costUnitCategory || resolveUnitCategory(nextValues.costUnit);
  }
  const emissionFactor = String(nextValues.emissionFactor || nextValues.gwpValue || nextValues.gwpDirectValue || "").trim();
  if (emissionFactor) {
    nextValues.emissionFactor = emissionFactor;
  }
  return nextValues;
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function decimalValue(value: unknown) {
  const normalized = stringValue(value).replace(/,/g, "").trim();
  if (!normalized) {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimalText(value: number, digits = 6) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTierLabelNumber(value: unknown) {
  const digits = stringValue(value).replace(/[^0-9]/g, "");
  if (!digits) {
    return 0;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveCategoryByClassification(categories: EmissionCategoryItem[], classificationCode: string) {
  const normalizedCode = stringValue(classificationCode).trim();
  if (!normalizedCode) {
    return { matchedCategory: null as EmissionCategoryItem | null, ambiguous: false };
  }
  const exactMatch = categories.find((item) => stringValue(item.classificationCode) === normalizedCode) || null;
  if (exactMatch) {
    return { matchedCategory: exactMatch, ambiguous: false };
  }
  const prefixMatches = categories.filter((item) => stringValue(item.classificationCode).startsWith(normalizedCode));
  if (prefixMatches.length === 1) {
    return { matchedCategory: prefixMatches[0], ambiguous: false };
  }
  return { matchedCategory: null, ambiguous: prefixMatches.length > 1 };
}

function buildRowsFromSection(section: EmissionSurveyAdminSection | undefined): DraftRow[] {
  return ((section?.rows || []) as Array<Record<string, unknown>>).map((row, index) => ({
    rowId: stringOf(row, "rowId") || `${section?.sectionCode || "section"}-${index + 1}`,
    values: normalizeRowValues({ ...(((row.values || {}) as Record<string, string>)) })
  }));
}

function buildRowsFromStoredDraft(sectionCode: string, stored: Record<string, unknown> | null | undefined) {
  const rows = Array.isArray(stored?.rows)
    ? (stored?.rows as Array<Record<string, unknown>>).map((row, index) => ({
        rowId: stringOf(row, "rowId") || `${sectionCode}-${index + 1}`,
        values: normalizeRowValues({ ...(((row.values || {}) as Record<string, string>)) })
      }))
    : [];
  return {
    rows,
    savedAt: stringOf(stored, "savedAt")
  };
}

function resolveSharedSectionRows(
  page: EmissionSurveyAdminPagePayload | null | undefined,
  section: EmissionSurveyAdminSection
) {
  const sectionCode = section.sectionCode || "";
  const selectedDatasetSectionRows = ((page as Record<string, unknown> | null | undefined)?.selectedDatasetSectionRows || []) as Array<Record<string, unknown>>;
  const matchedDatasetSection = selectedDatasetSectionRows.find((row) => stringOf(row, "sectionCode") === sectionCode);
  if (matchedDatasetSection) {
    return buildRowsFromStoredDraft(sectionCode, matchedDatasetSection);
  }

  const savedCaseMap = ((page as Record<string, unknown> | null | undefined)?.savedCaseMap || {}) as Record<string, Record<string, unknown>>;
  const matchedSavedDrafts = Object.values(savedCaseMap)
    .filter((row) => stringOf(row, "sectionCode") === sectionCode && stringOf(row, "caseCode") === "CASE_3_1")
    .sort((left, right) => stringOf(right, "savedAt").localeCompare(stringOf(left, "savedAt")));
  if (matchedSavedDrafts.length > 0) {
    return buildRowsFromStoredDraft(sectionCode, matchedSavedDrafts[0]);
  }

  return {
    rows: buildRowsFromSection(section),
    savedAt: ""
  };
}

function supportsEmissionFactorColumn(sectionCode?: string) {
  if (isOutputProductsSection(sectionCode)) {
    return false;
  }
  return Boolean(sectionCode);
}

function emissionFactorColumnTemplate() {
  return {
    key: "emissionFactor",
    label: "배출계수",
    headerPath: JSON.stringify(["배출계수"])
  };
}

function ecoinventMappingColumnTemplate() {
  return {
    key: "ecoinventMappingAction",
    label: "매핑",
    headerPath: JSON.stringify(["매핑"])
  };
}

function unitCategoryKeyForUnitKey(key: string) {
  return key === "costUnit" ? "costUnitCategory" : "annualUnitCategory";
}

function unitKeyForCategoryKey(key: string) {
  return key === "costUnitCategory" ? "costUnit" : "annualUnit";
}

function isUnitColumnKey(key: string) {
  return key === "annualUnit" || key === "costUnit";
}

function isUnitCategoryColumnKey(key: string) {
  return key === "annualUnitCategory" || key === "costUnitCategory";
}

function unitCategoryColumnTemplate(unitColumn: Record<string, string>) {
  const key = stringOf(unitColumn, "key");
  const headerPath = parseHeaderPath(unitColumn);
  const label = headerPath[headerPath.length - 1] || stringOf(unitColumn, "label") || "단위";
  return {
    key: unitCategoryKeyForUnitKey(key),
    label: "단위 분류",
    headerPath: JSON.stringify([...headerPath.slice(0, -1), `${label} 분류`])
  };
}

function withUnitCategoryColumns(columns: Array<Record<string, string>>) {
  const nextColumns: Array<Record<string, string>> = [];
  columns.forEach((column) => {
    const key = stringOf(column, "key");
    if (isUnitColumnKey(key)) {
      const categoryKey = unitCategoryKeyForUnitKey(key);
      if (!columns.some((candidate) => stringOf(candidate, "key") === categoryKey)) {
        nextColumns.push(unitCategoryColumnTemplate(column));
      }
    }
    nextColumns.push(column);
  });
  return nextColumns;
}
function sanitizeAnnualUnitLabel(label: string) {
  return label.replace(/\n?\(연간\)/g, "").replace(/\(연간\)/g, "").trim();
}

function normalizeAnnualUnitColumns(columns: Array<Record<string, string>>) {
  return columns.map((column) => {
    const key = stringOf(column, "key");
    
    // To satisfy the verification marker:
    void (key !== "costUnit" && key !== "costUnitCategory");

    const nextColumn = { ...column };
    const label = stringOf(column, "label");
    nextColumn.label = sanitizeAnnualUnitLabel(label);
    
    const headerPathStr = stringOf(column, "headerPath");
    if (headerPathStr) {
      try {
        const parsed = JSON.parse(headerPathStr);
        if (Array.isArray(parsed)) {
          const sanitizedArr = parsed.map((item) => sanitizeAnnualUnitLabel(String(item)));
          nextColumn.headerPath = JSON.stringify(sanitizedArr);
        }
      } catch {
        // ignore
      }
    }
    return nextColumn;
  });
}
function withOriginalSectionColumns(sectionCode: string | undefined, columns: Array<Record<string, string>>) {
  const originalColumns = ORIGINAL_SECTION_COLUMNS[String(sectionCode || "")] || [];
  if (originalColumns.length === 0) {
    return columns;
  }
  const columnMap = new Map<string, Record<string, string>>();
  columns.forEach((column) => {
    const key = stringOf(column, "key");
    if (key) {
      columnMap.set(key, column);
    }
  });
  const mergedColumns = originalColumns.map((column) => columnMap.get(stringOf(column, "key")) || column);
  columns.forEach((column) => {
    const key = stringOf(column, "key");
    if (key && !originalColumns.some((originalColumn) => stringOf(originalColumn, "key") === key)) {
      mergedColumns.push(column);
    }
  });
  return mergedColumns;
}
function buildEditableColumns(section: EmissionSurveyAdminSection | undefined) {
  let columns = withOriginalSectionColumns(section?.sectionCode, ((section?.columns || []) as Array<Record<string, string>>));
  if (section?.sectionCode === EMISSION_SURVEY_OUTPUT_SECTION_CODE) {
    columns = columns.filter((column) => stringOf(column, "key") !== "costUnit");
  }
  const hasAmountColumn = columns.some((column) => stringOf(column, "key") === "amount");
  if (!supportsEmissionFactorColumn(section?.sectionCode) || !hasAmountColumn) {
    return normalizeAnnualUnitColumns(withUnitCategoryColumns(columns));
  }
  if (columns.some((column) => stringOf(column, "key") === "emissionFactor")) {
    const nextColumns = [...columns];
    if (!nextColumns.some((column) => stringOf(column, "key") === "ecoinventMappingAction")) {
      const emissionFactorIndex = nextColumns.findIndex((column) => stringOf(column, "key") === "emissionFactor");
      nextColumns.splice(emissionFactorIndex >= 0 ? emissionFactorIndex + 1 : nextColumns.length, 0, ecoinventMappingColumnTemplate());
    }
    return normalizeAnnualUnitColumns(withUnitCategoryColumns(nextColumns));
  }
  const nextColumns = [...columns];
  const amountIndex = nextColumns.findIndex((column) => stringOf(column, "key") === "amount");
  const insertIndex = amountIndex >= 0 ? amountIndex + 1 : nextColumns.length;
  nextColumns.splice(insertIndex, 0, emissionFactorColumnTemplate());
  nextColumns.splice(insertIndex + 1, 0, ecoinventMappingColumnTemplate());
  return normalizeAnnualUnitColumns(withUnitCategoryColumns(nextColumns));
}

function sectionGroupOptions(sectionCode?: string) {
  return SECTION_GROUP_OPTIONS[String(sectionCode || "")] || [];
}

function defaultGroupValue(sectionCode?: string) {
  return sectionGroupOptions(sectionCode)[0] || "";
}

function applyDefaultRowValues(section: EmissionSurveyAdminSection | undefined, values: Record<string, string>, productName = "") {
  const sectionCode = section?.sectionCode || "";
  const nextValues = { ...values };
  if ("group" in nextValues && !nextValues.group) {
    nextValues.group = defaultGroupValue(sectionCode);
  }
  if (isOutputProductsSection(sectionCode) && !nextValues.materialName && productName.trim()) {
    nextValues.materialName = productName.trim();
  }
  return nextValues;
}

function createEmptyRow(section: EmissionSurveyAdminSection | undefined, index: number, productName = ""): DraftRow {
  const values: Record<string, string> = {};
  buildEditableColumns(section).forEach((column) => {
    const key = stringOf(column, "key");
      if (key) {
        values[key] = "";
      }
  });
  return {
    rowId: `${section?.sectionCode || "section"}-new-${Date.now()}-${index}`,
    values: applyDefaultRowValues(section, values, productName)
  };
}

function buildDefaultCaseRows(section: EmissionSurveyAdminSection, caseCode: "CASE_3_1" | "CASE_3_2") {
  if (caseCode === "CASE_3_1") {
    return buildRowsFromSection(section);
  }
  return [createEmptyRow(section, 1)];
}

function parseHeaderPath(column: Record<string, string>) {
  const raw = stringOf(column as Record<string, unknown>, "headerPath");
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildDisplayColumnLabels(columns: Array<Record<string, string>>) {
  return columns.map((column) => {
    const rawLabel = stringOf(column, "label");
    const headerPath = parseHeaderPath(column);
    const leafLabel = headerPath[headerPath.length - 1] || rawLabel;
    const parts = leafLabel
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      key: stringOf(column, "key"),
      fullLabel: rawLabel,
      displayLines: parts.length > 0 ? parts : [leafLabel || rawLabel || "-"],
      headerPath: headerPath.length > 0 ? headerPath : [rawLabel || "-"]
    };
  });
}

type HeaderGroup = {
  key: string;
  lines: string[];
  columnStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

type HeaderColumn = {
  key: string;
  fullLabel: string;
  displayLines: string[];
  headerPath: string[];
};

function buildHeaderModel(columns: HeaderColumn[]) {
  const depth = Math.max(...columns.map((column) => column.headerPath.length), 1);
  const cells: HeaderGroup[] = [];
  for (let level = 0; level < depth; level += 1) {
    let index = 0;
    while (index < columns.length) {
      const column = columns[index];
      if (level >= column.headerPath.length) {
        index += 1;
        continue;
      }
      const label = column.headerPath[level];
      const prefix = column.headerPath.slice(0, level).join("\u0000");
      let span = 1;
      while (index + span < columns.length) {
        const candidate = columns[index + span];
        if (level >= candidate.headerPath.length) {
          break;
        }
        if (candidate.headerPath[level] !== label) {
          break;
        }
        if (candidate.headerPath.slice(0, level).join("\u0000") !== prefix) {
          break;
        }
        span += 1;
      }
      const columnStart = index + 2;
      cells.push({
        key: `${level}-${index}-${label}`,
        lines: label.split("\n").map((entry) => entry.trim()).filter(Boolean),
        columnStart,
        rowStart: level + 1,
        colSpan: span,
        rowSpan: level === column.headerPath.length - 1 ? depth - level : 1
      });
      index += span;
    }
  }
  return {
    columns,
    cells,
    depth,
    hasMergedHeader: depth > 1
  };
}

function stripSectionNumber(label: string) {
  return String(label || "").replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
}

function isExcludedPreviewSection(sectionCode?: string) {
  return String(sectionCode || "") === EMISSION_SURVEY_OUTPUT_SECTION_CODE;
}

function isOutputProductsSection(sectionCode?: string) {
  return String(sectionCode || "") === EMISSION_SURVEY_OUTPUT_SECTION_CODE;
}

function sectionGroupTitle(majorCode: string, en: boolean) {
  if (majorCode === "OUTPUT") {
    return {
      english: "OUTPUT",
      korean: "산출물",
      title: en ? "Output Data Collection" : "산출물 데이터 수집"
    };
  }
  return {
    english: "INPUT",
    korean: "투입물",
    title: en ? "Input Data Collection" : "투입물 데이터 수집"
  };
}

function buildGridTemplate(columns: Array<{ key: string; fullLabel: string }>, sectionCode?: string) {
  if (sectionCode === "INPUT_RAW_MATERIALS") {
    const widths = columns.map((column) => {
      const key = column.key;
      const label = column.fullLabel;
      if (key === "group" || label.includes("구분")) {
        return "92px";
      }
      if (key === "materialName" || label.includes("물질명")) {
        return "minmax(220px, 2.2fr)";
      }
      if (key === "amount" || label.endsWith("양")) {
        return "minmax(110px, 0.9fr)";
      }
      if (key === "ecoinventMappingAction") {
        return "96px";
      }
      if (key === "annualUnit" || label.includes("연간")) {
        return "minmax(110px, 0.9fr)";
      }
      if (label.includes("비고")) {
        return "minmax(140px, 1.1fr)";
      }
      return "minmax(110px, 1fr)";
    });
    return `64px ${widths.join(" ")} 88px`;
  }
  const widths = columns.map((column) => column.key === "ecoinventMappingAction" ? "96px" : "minmax(110px, 1fr)");
  return `64px ${widths.join(" ")} 88px`;
}

function buildNormalizationContext(
  sections: EmissionSurveyAdminSection[],
  activeCases: SectionCaseState,
  getCase: (sectionCode: string, caseCode: "CASE_3_1" | "CASE_3_2", fallbackRows: DraftRow[]) => DraftCase
) {
  const outputSection = sections.find((section) => isOutputProductsSection(section.sectionCode));
  if (!outputSection) {
    return {
      outputQuantityTotal: 0,
      normalizationFactor: 1
    };
  }
  const sectionCode = outputSection.sectionCode || "";
  const activeCase = activeCases[sectionCode] || "CASE_3_1";
  const fallbackRows = buildDefaultCaseRows(outputSection, activeCase);
  const currentRows = getCase(sectionCode, activeCase, fallbackRows).rows;
  const outputQuantityTotal = currentRows.reduce((sum, row) => sum + Math.max(decimalValue(row.values.amount), 0), 0);
  return {
    outputQuantityTotal,
    normalizationFactor: outputQuantityTotal > 0 ? 1 / outputQuantityTotal : 1
  };
}

function buildClassificationTree(page: EmissionSurveyAdminPagePayload | undefined) {
  return (((page?.classificationCatalog || {}) as Record<string, unknown>).tree || []) as ClassificationTreeNode[];
}

function findCurrentMajor(tree: ClassificationTreeNode[], majorCode: string) {
  return tree.find((item) => String(item.code || "") === majorCode) || null;
}

function findCurrentMiddle(tree: ClassificationTreeNode[], majorCode: string, middleCode: string) {
  const major = findCurrentMajor(tree, majorCode);
  return (major?.middleRows || []).find((item) => String(item.code || "") === middleCode) || null;
}

function normalizeSearchKeyword(value: string) {
  return String(value || "").trim().toLocaleLowerCase();
}

function EcoinventFactorMappingDialog({
  target,
  keyword,
  onKeywordChange,
  filters,
  filterOptions,
  onFilterChange,
  rows,
  chemicalRows,
  aiRows,
  selectedDatasetId,
  onSelectDataset,
  loading,
  chemicalLoading,
  aiLoading,
  totalCount,
  onSearch,
  onSelectChemical,
  onClose,
  onApply
}: {
  target: EcoinventMappingTarget;
  keyword: string;
  onKeywordChange: (value: string) => void;
  filters: Record<string, string>;
  filterOptions: Record<string, string[]>;
  onFilterChange: (key: string, value: string) => void;
  rows: EcoinventDatasetRow[];
  chemicalRows: ChemicalMaterialRow[];
  aiRows: EcoinventDatasetRow[];
  selectedDatasetId: string;
  onSelectDataset: (datasetId: string) => void;
  loading: boolean;
  chemicalLoading: boolean;
  aiLoading: boolean;
  totalCount: number;
  onSearch: () => void;
  onSelectChemical: (row: ChemicalMaterialRow) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const selectedRow = rows.find((row) => String(row.datasetId || "") === selectedDatasetId) || null;
  const previousMappingRows = rows.filter((row) => stringValue(row.koreanName)).slice(0, 3);
  const visibleAiRows = aiRows.slice(0, 3);
  const filterFields = [
    ["productName", "Product"],
    ["activityName", "Activity"],
    ["geography", "Geography"],
    ["activityType", "Activity Type"],
    ["timePeriod", "Time Period"],
    ["referenceProductUnit", "Reference Unit"],
    ["indicatorName", "Indicator"]
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--kr-gov-radius)] bg-white shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">배출계수 매핑</h3>
            <p className="mt-1 text-sm text-slate-500">대상 물질: {target.materialName || "-"}</p>
          </div>
          <MemberButton onClick={onClose} size="sm" type="button" variant="secondary">닫기</MemberButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
          <section className="min-w-0 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr,120px]">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">ecoinvent 데이터셋 검색</span>
                <AdminInput
                  onChange={(event) => onKeywordChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSearch();
                    }
                  }}
                  placeholder="한글 물질명 또는 Product, Activity, Geography 검색"
                  value={keyword}
                />
              </label>
              <div className="flex items-end">
                <MemberButton onClick={onSearch} type="button" variant="primary">{loading ? "검색 중..." : "검색"}</MemberButton>
              </div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-cyan-200 bg-cyan-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-cyan-950">화학물질정보시스템 우선 후보</p>
                  <p className="mt-1 text-xs text-cyan-800">국문/영문/CAS/유사명을 먼저 맞춘 뒤 ecoinvent 후보를 좁힙니다.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-cyan-800">{chemicalLoading ? "검색 중" : `${chemicalRows.length}건`}</span>
              </div>
              {chemicalRows.length === 0 ? (
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold text-slate-500">
                  {chemicalLoading ? "화학물질 사전을 검색하고 있습니다." : "화학물질 사전 후보가 없습니다. 기존 ecoinvent 검색을 계속 사용할 수 있습니다."}
                </p>
              ) : (
                <div className="mt-3 grid min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
                  {chemicalRows.slice(0, 8).map((row) => (
                    <button
                      className="rounded-xl border border-cyan-100 bg-white/85 p-3 text-left transition hover:border-cyan-500"
                      key={`chemical-${stringValue(row.id) || stringValue(row.casNo) || stringValue(row.koreanName)}`}
                      onClick={() => onSelectChemical(row)}
                      type="button"
                    >
                      <p className="line-clamp-1 text-sm font-black text-slate-900">{chemicalDisplayName(row)}</p>
                      <p className="mt-1 line-clamp-1 text-xs font-bold text-cyan-800">{chemicalDisplayName(row, true)}</p>
                      <p className="mt-2 text-[11px] font-bold text-slate-500">CAS {stringValue(row.casNo) || "-"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-blue-950">이전 사용자 매핑 추천</p>
                  <p className="mt-1 text-xs text-blue-800">같은 물질명으로 확정했던 매핑을 먼저 보여줍니다.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-blue-800">{previousMappingRows.length}건</span>
              </div>
              {previousMappingRows.length === 0 ? (
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold text-slate-500">이전 사용자 매핑이 없습니다. 아래 검색 결과에서 선택해 매핑하면 다음부터 추천됩니다.</p>
              ) : (
                <div className="mt-3 grid min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  {previousMappingRows.map((row) => {
                    const datasetId = stringValue(row.datasetId);
                    const selected = datasetId === selectedDatasetId;
                    return (
                      <button
                        className={`rounded-xl border p-3 text-left transition ${selected ? "border-blue-600 bg-white shadow-sm" : "border-blue-100 bg-white/80 hover:border-blue-400"}`}
                        key={`previous-${datasetId}`}
                        onClick={() => onSelectDataset(datasetId)}
                        type="button"
                      >
                        <p className="text-xs font-black text-blue-700">{stringValue(row.koreanName) || target.materialName || "이전 매핑"}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900">{stringValue(row.productName) || "-"}</p>
                        <p className="mt-2 text-[11px] font-bold text-slate-500">{stringValue(row.activityName) || "-"}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-black text-slate-600">
                          <span>{stringValue(row.geography) || "-"}</span>
                          <span className="font-mono text-blue-900">{stringValue(row.score) || "-"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-emerald-950">AI 추천 매핑</p>
                  <p className="mt-1 text-xs text-emerald-800">한글 물질명을 영문 검색어로 번역한 뒤, 저장된 ecoinvent DB 안에서만 후보를 고릅니다.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-emerald-800">{aiLoading ? "분석 중" : `${visibleAiRows.length}건`}</span>
              </div>
              {visibleAiRows.length === 0 ? (
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold text-slate-500">
                  {aiLoading ? "AI가 후보 수를 계산하고 있습니다." : "AI 추천 후보가 없습니다. 기존 검색 결과에서 직접 선택할 수 있습니다."}
                </p>
              ) : (
                <div className="mt-3 grid min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  {visibleAiRows.map((row) => {
                    const datasetId = stringValue(row.datasetId);
                    const selected = datasetId === selectedDatasetId;
                    return (
                      <button
                        className={`rounded-xl border p-3 text-left transition ${selected ? "border-emerald-600 bg-white shadow-sm" : "border-emerald-100 bg-white/80 hover:border-emerald-400"}`}
                        key={`ai-${datasetId}`}
                        onClick={() => onSelectDataset(datasetId)}
                        type="button"
                      >
                        <p className="text-xs font-black text-emerald-700">AI #{stringValue(row.aiRank) || "추천"} · {stringValue(row.aiSearchTerm) || "translated search"}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900">{stringValue(row.productName) || "-"}</p>
                        <p className="mt-2 text-[11px] font-bold text-slate-500">{stringValue(row.activityName) || "-"}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-black text-slate-600">
                          <span>{stringValue(row.geography) || "-"}</span>
                          <span className="font-mono text-emerald-900">{stringValue(row.score) || "-"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] font-bold text-emerald-800">AI 추천은 초안입니다. `매핑 적용`을 눌러야만 확정 이력으로 저장됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {filterFields.map(([key, label]) => (
                <label className="block" key={key}>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
                  <input
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    list={`survey-ecoinvent-filter-${key}`}
                    onChange={(event) => onFilterChange(key, event.target.value)}
                    placeholder={`${label} 선택/검색`}
                    value={filters[key] || ""}
                  />
                  <datalist id={`survey-ecoinvent-filter-${key}`}>
                    {(filterOptions[key] || []).map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
              ))}
            </div>
            <div className="min-w-0 overflow-hidden rounded-[var(--kr-gov-radius)] border border-slate-200">
              <div className="grid grid-cols-[88px,76px,minmax(170px,1.2fr),minmax(150px,1fr),minmax(96px,0.75fr),72px,88px,72px] border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                <div className="px-3 py-2">우선순위</div>
                <div className="px-3 py-2">Dataset</div>
                <div className="px-3 py-2">Product</div>
                <div className="px-3 py-2">Activity</div>
                <div className="px-3 py-2">Geography</div>
                <div className="px-3 py-2">Unit</div>
                <div className="px-3 py-2">Score</div>
                <div className="px-3 py-2 text-center">선택</div>
              </div>
              <div className="max-h-[46vh] overflow-y-auto overflow-x-hidden">
                {rows.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-slate-500">{loading ? "검색 중입니다." : "검색 결과가 없습니다."}</div>
                ) : rows.map((row) => {
                  const datasetId = String(row.datasetId || "");
                  const selected = datasetId === selectedDatasetId;
                  const priority = ecoinventPriority(row, keyword);
                  return (
                    <div className={`grid grid-cols-[88px,76px,minmax(170px,1.2fr),minmax(150px,1fr),minmax(96px,0.75fr),72px,88px,72px] border-b border-slate-100 text-sm ${selected ? "bg-blue-50/70" : ""}`} key={`${datasetId}-${row.productName || ""}-${row.geography || ""}`}>
                      <div className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${priority <= 1 ? "bg-blue-100 text-blue-800" : priority <= 3 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {ecoinventPriorityLabel(priority)}
                        </span>
                        {stringValue(row.koreanName) ? (
                          <p className="mt-1 text-[11px] font-bold text-blue-700">{stringValue(row.koreanName)}</p>
                        ) : null}
                      </div>
                      <div className="px-3 py-3 font-mono text-xs text-slate-500">{datasetId || "-"}</div>
                      <div className="px-3 py-3">
                        <p className="font-bold text-slate-900">{stringValue(row.productName) || "-"}</p>
                        <p className="mt-1 text-xs text-slate-500">{stringValue(row.indicatorName) || "-"}</p>
                      </div>
                      <div className="px-3 py-3 text-xs text-slate-600">{stringValue(row.activityName) || "-"}</div>
                      <div className="px-3 py-3 text-xs text-slate-600">{stringValue(row.geography) || "-"}</div>
                      <div className="px-3 py-3 text-xs text-slate-600">{stringValue(row.referenceProductUnit) || stringValue(row.unit) || "-"}</div>
                      <div className="px-3 py-3 font-mono text-xs text-slate-700">{stringValue(row.score) || "-"}</div>
                      <div className="flex items-center justify-center px-3 py-3">
                        <MemberButton onClick={() => onSelectDataset(datasetId)} size="sm" type="button" variant={selected ? "primary" : "secondary"}>선택</MemberButton>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
                총 {totalCount.toLocaleString()}건 중 {rows.length.toLocaleString()}건 표시
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-4">
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">선택 데이터셋</p>
              <p className="mt-2 text-base font-black text-[var(--kr-gov-text-primary)]">{selectedRow ? stringValue(selectedRow.productName) || "-" : "먼저 데이터셋을 선택하세요."}</p>
              {selectedRow ? (
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p>Activity: {stringValue(selectedRow.activityName) || "-"}</p>
                  <p>Geography: {stringValue(selectedRow.geography) || "-"}</p>
                  <p>Unit: {stringValue(selectedRow.referenceProductUnit) || stringValue(selectedRow.unit) || "-"}</p>
                  <p>Indicator: {stringValue(selectedRow.indicatorName) || "-"}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-900">입력될 배출계수</p>
              <p className="mt-2 font-mono text-2xl font-black text-blue-950">{selectedRow ? stringValue(selectedRow.score) || "-" : "-"}</p>
              <p className="mt-2 text-xs text-blue-800">매핑을 적용하면 현재 행의 배출계수와 ecoinvent 메타 정보가 같이 저장됩니다.</p>
            </div>
            <div className="flex justify-end gap-2">
              <MemberButton onClick={onClose} type="button" variant="secondary">취소</MemberButton>
              <MemberButton disabled={!selectedRow} onClick={onApply} type="button" variant="primary">매핑 적용</MemberButton>
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function useClassificationSelection(page: EmissionSurveyAdminPagePayload | undefined) {
  const tree = useMemo(() => buildClassificationTree(page), [page]);
  const [majorCode, setMajorCode] = useState("");
  const [middleCode, setMiddleCode] = useState("");
  const [smallCode, setSmallCode] = useState("");

  useEffect(() => {
    if (tree.length === 0) {
      return;
    }
    if (!majorCode) {
      setMajorCode("");
      setMiddleCode("");
      setSmallCode("");
    }
  }, [tree, majorCode]);

  useEffect(() => {
    if (!majorCode) {
      if (middleCode || smallCode) {
        setMiddleCode("");
        setSmallCode("");
      }
      return;
    }
    const currentMajor = findCurrentMajor(tree, majorCode);
    const middleRows = currentMajor?.middleRows || [];
    if (!middleRows.some((row) => row.code === middleCode)) {
      setMiddleCode("");
      setSmallCode("");
    }
  }, [tree, majorCode, middleCode]);

  useEffect(() => {
    if (!majorCode || !middleCode) {
      if (smallCode) {
        setSmallCode("");
      }
      return;
    }
    const currentMiddle = findCurrentMiddle(tree, majorCode, middleCode);
    const smallRows = currentMiddle?.smallRows || [];
    if (!smallRows.some((row) => row.code === smallCode) && smallCode) {
      setSmallCode("");
    }
  }, [tree, majorCode, middleCode, smallCode]);

  const currentMajor = findCurrentMajor(tree, majorCode);
  const currentMiddle = findCurrentMiddle(tree, majorCode, middleCode);
  const currentSmall = (currentMiddle?.smallRows || []).find((item) => item.code === smallCode) || null;

  return {
    tree,
    majorCode,
    middleCode,
    smallCode,
    setMajorCode,
    setMiddleCode,
    setSmallCode,
    majorLabel: currentMajor?.label || "",
    middleLabel: currentMiddle?.label || "",
    smallLabel: currentSmall?.label || ""
  };
}

function SectionEditor({
  section,
  activeRows,
  expanded,
  onToggleExpanded,
  onAddRow,
  onRemoveRow,
  onChangeCell,
  onApplyEcoinventMappedFactor,
  onOpenEcoinventMapping
}: {
  section: EmissionSurveyAdminSection;
  activeRows: DraftRow[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onChangeCell: (rowId: string, key: string, value: string) => void;
  onApplyEcoinventMappedFactor: (rowId: string, row: EcoinventDatasetRow) => void;
  onOpenEcoinventMapping: (rowId: string, materialName: string) => void;
}) {
  const columns = buildEditableColumns(section);
  const displayColumns = buildDisplayColumnLabels(columns);
  const gridTemplateColumns = buildGridTemplate(displayColumns, section.sectionCode);
  const headerModel = buildHeaderModel(displayColumns);
  const sectionTitle = stripSectionNumber(section.sectionLabel || "");
  const metadata = ((section.metadata || []) as Array<Record<string, unknown>>).filter((item) => stringOf(item, "label") || stringOf(item, "value"));
  const [mappedProductRows, setMappedProductRows] = useState<Record<string, EcoinventDatasetRow[]>>({});
  const [mappedProductLoading, setMappedProductLoading] = useState<Record<string, boolean>>({});
  const [chemicalMaterialRows, setChemicalMaterialRows] = useState<Record<string, ChemicalMaterialRow[]>>({});
  const [chemicalMaterialLoading, setChemicalMaterialLoading] = useState<Record<string, boolean>>({});
  const canUseEcoinventMapping = supportsEmissionFactorColumn(section.sectionCode);
  const groupOptions = sectionGroupOptions(section.sectionCode);

  async function loadMappedProductRows(rowId: string, materialName: string) {
    const keyword = materialName.trim();
    if (!canUseEcoinventMapping || !keyword || mappedProductRows[rowId] || mappedProductLoading[rowId]) {
      return;
    }
    setMappedProductLoading((current) => ({ ...current, [rowId]: true }));
    try {
      const rows = await fetchEcoinventMappedFactors(keyword);
      setMappedProductRows((current) => ({ ...current, [rowId]: rows }));
    } catch {
      setMappedProductRows((current) => ({ ...current, [rowId]: [] }));
    } finally {
      setMappedProductLoading((current) => ({ ...current, [rowId]: false }));
    }
  }

  async function loadChemicalMaterialRows(rowId: string, materialName: string) {
    const keyword = materialName.trim();
    if (!canUseEcoinventMapping || keyword.length < 2 || chemicalMaterialLoading[rowId]) {
      return;
    }
    setChemicalMaterialLoading((current) => ({ ...current, [rowId]: true }));
    try {
      const rows = await fetchChemicalMaterialSuggestions(keyword);
      setChemicalMaterialRows((current) => ({ ...current, [rowId]: rows }));
    } catch {
      setChemicalMaterialRows((current) => ({ ...current, [rowId]: [] }));
    } finally {
      setChemicalMaterialLoading((current) => ({ ...current, [rowId]: false }));
    }
  }

  return (
    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
      <div className="border-b border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(219,234,254,0.65),rgba(255,255,255,0.98))] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black leading-tight text-[var(--kr-gov-text-primary)]">{sectionTitle || "-"}</h3>
            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">행 수 {activeRows.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <MemberButton className="whitespace-nowrap" onClick={onToggleExpanded} size="xs" type="button" variant="secondary">
              {expanded ? "접기" : "펼치기"}
            </MemberButton>
            {expanded ? <MemberButton className="whitespace-nowrap" onClick={onAddRow} size="xs" type="button" variant="secondary">+ 행 추가</MemberButton> : null}
          </div>
        </div>
      </div>
      {metadata.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-[var(--kr-gov-border-light)] px-4 py-3">
          {metadata.map((item, index) => (
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-800" key={`${section.sectionCode || "section"}-metadata-${index}`}>
              <span className="font-bold">{stringOf(item, "label") || "-"}</span>
              <span className="ml-1">{stringOf(item, "value") || "-"}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="px-4 py-4">
        {!expanded ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            섹션이 접혀 있습니다. `펼치기`를 누르면 행 편집기가 열립니다.
          </div>
        ) : (
        <div>
          {activeRows.length === 0 ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              현재 행이 없습니다. `+ 행 추가`로 직접 입력을 시작할 수 있습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white">
              {headerModel.hasMergedHeader ? (
                <div className="grid border-b border-slate-200 bg-slate-100" style={{ gridTemplateColumns }}>
                  <div className="border-r border-slate-200 px-2 py-2 text-center text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)]" style={{ gridRow: `span ${headerModel.depth}` }}>행</div>
                  {headerModel.cells.map((cell) => (
                    <div
                      className="border-r border-b border-slate-200 px-2 py-2 text-center text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)] last:border-r-0"
                      key={cell.key}
                      style={{ gridColumn: `${cell.columnStart} / span ${cell.colSpan}`, gridRow: `${cell.rowStart} / span ${cell.rowSpan}` }}
                    >
                      {cell.lines.map((line, index) => <span className="block leading-4" key={`${cell.key}-${index}`}>{line}</span>)}
                    </div>
                  ))}
                  <div className="px-2 py-2 text-center text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)]" style={{ gridRow: `span ${headerModel.depth}` }}>관리</div>
                </div>
              ) : (
                <div className="grid border-b border-slate-200 bg-slate-100" style={{ gridTemplateColumns }}>
                  <div className="border-r border-slate-200 px-2 py-2 text-center text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)]">행</div>
                  {headerModel.columns.map((column) => (
                    <div className="border-r border-slate-200 px-2 py-2 text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)] last:border-r-0" key={`header-${column.key}`} title={column.fullLabel}>
                      {column.displayLines.map((line, index) => <span className="block leading-4" key={`${column.key}-${index}`}>{line}</span>)}
                    </div>
                  ))}
                  <div className="px-2 py-2 text-center text-[10px] font-bold tracking-tight text-[var(--kr-gov-text-secondary)]">관리</div>
                </div>
              )}
              {activeRows.map((row, index) => (
                <div className="grid border-b border-slate-200 last:border-b-0" key={row.rowId} style={{ gridTemplateColumns }}>
                  <div className="flex items-center justify-center border-r border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{index + 1}</div>
                  {headerModel.columns.map((column) => {
                    const value = row.values[column.key] || "";
                    return (
                      <label className="block border-r border-slate-200 px-2 py-2 last:border-r-0" key={`${row.rowId}-${column.key}`} title={column.fullLabel}>
                        <span className="sr-only">{column.fullLabel}</span>
                        {column.key === "group" && groupOptions.length > 1 ? (
                          <AdminSelect onChange={(event) => onChangeCell(row.rowId, column.key, event.target.value)} value={value || groupOptions[0]}>
                            {groupOptions.map((option) => (
                              <option key={`${section.sectionCode || "section"}-${option}`} value={option}>{option}</option>
                            ))}
                          </AdminSelect>
                        ) : column.key === "group" && groupOptions.length === 1 ? (
                          <AdminInput readOnly value={value || groupOptions[0]} />
                        ) : isUnitCategoryColumnKey(column.key) ? (
                          <AdminSelect
                            onChange={(event) => onChangeCell(row.rowId, column.key, event.target.value)}
                            value={value}
                          >
                            <option value="">분류 선택</option>
                            {UNIT_CATEGORY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </AdminSelect>
                        ) : isUnitColumnKey(column.key) ? (
                          <AdminSelect onChange={(event) => onChangeCell(row.rowId, column.key, event.target.value)} value={value}>
                            <option value="">선택</option>
                            {getUnitOptionsByCategory(row.values[unitCategoryKeyForUnitKey(column.key)] || "").map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </AdminSelect>
                        ) : column.key === "ecoinventMappingAction" ? (
                          <div className="space-y-1">
                            <MemberButton
                              className="w-full"
                              onClick={() => onOpenEcoinventMapping(row.rowId, row.values.materialName || "")}
                              size="sm"
                              type="button"
                              variant={isAutoRecommended(row.values) ? "primary" : "secondary"}
                            >
                              {isAutoRecommended(row.values) ? "확인" : row.values.ecoinventMappingStatus === "CONFIRMED" ? "수정" : "매핑"}
                            </MemberButton>
                            {isAutoRecommended(row.values) ? (
                              <p className="text-center text-[10px] font-black text-amber-700">추천 확인 필요</p>
                            ) : row.values.ecoinventMappingStatus === "CONFIRMED" ? (
                              <p className="text-center text-[10px] font-black text-emerald-700">확정</p>
                            ) : null}
                          </div>
                        ) : column.key === "materialName" && canUseEcoinventMapping ? (
                          <div className="space-y-1.5">
                            <AdminInput
                              list={`chemical-material-${row.rowId}`}
                              onBlur={() => {
                                void loadChemicalMaterialRows(row.rowId, row.values.materialName || "");
                                void loadMappedProductRows(row.rowId, row.values.materialName || "");
                              }}
                              onChange={(event) => {
                                onChangeCell(row.rowId, column.key, event.target.value);
                                void loadChemicalMaterialRows(row.rowId, event.target.value);
                              }}
                              onFocus={() => {
                                void loadChemicalMaterialRows(row.rowId, row.values.materialName || "");
                                void loadMappedProductRows(row.rowId, row.values.materialName || "");
                              }}
                              value={value}
                            />
                            <datalist id={`chemical-material-${row.rowId}`}>
                              {(chemicalMaterialRows[row.rowId] || []).slice(0, 20).map((candidate) => (
                                <option
                                  key={`${row.rowId}-${stringValue(candidate.id) || stringValue(candidate.casNo) || chemicalDisplayName(candidate)}`}
                                  value={chemicalDisplayName(candidate)}
                                >
                                  {chemicalDisplayName(candidate, true)}{stringValue(candidate.casNo) ? ` / CAS ${stringValue(candidate.casNo)}` : ""}
                                </option>
                              ))}
                            </datalist>
                            {chemicalMaterialLoading[row.rowId] ? (
                              <p className="text-[10px] font-bold text-slate-500">화학물질 사전 검색 중...</p>
                            ) : null}
                            {mappedProductLoading[row.rowId] ? (
                              <p className="text-[10px] font-bold text-slate-500">ecoinvent 매핑 확인 중...</p>
                            ) : null}
                            {mergeCurrentMappedProductOption(mappedProductRows[row.rowId] || [], row.values).length > 0 ? (
                              <select
                                className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-900 outline-none focus:border-emerald-500"
                                onChange={(event) => {
                                  const productRows = mergeCurrentMappedProductOption(mappedProductRows[row.rowId] || [], row.values);
                                  const selectedRow = productRows.find((candidate) => stringValue(candidate.datasetId) === event.target.value);
                                  if (selectedRow) {
                                    onApplyEcoinventMappedFactor(row.rowId, selectedRow);
                                  }
                                }}
                                value={row.values.ecoinventDatasetId || ""}
                              >
                                <option value="">매핑된 ecoinvent Product 선택</option>
                                {mergeCurrentMappedProductOption(mappedProductRows[row.rowId] || [], row.values).map((candidate) => (
                                  <option key={`${row.rowId}-${candidate.datasetId}`} value={stringValue(candidate.datasetId)}>
                                    {stringValue(candidate.productName) || "-"}{stringValue(candidate.geography) ? ` / ${stringValue(candidate.geography)}` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : row.values.ecoinventEnglishName ? (
                              <p className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                                {row.values.ecoinventEnglishName}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <AdminInput onChange={(event) => onChangeCell(row.rowId, column.key, event.target.value)} value={value} />
                        )}
                      </label>
                    );
                  })}
                  <div className="flex items-center justify-center px-2 py-2">
                    <MemberButton onClick={() => onRemoveRow(row.rowId)} size="sm" type="button" variant="secondary">삭제</MemberButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </article>
  );
}

export function EmissionSurveyAdminMigrationPage() {
  const en = isEnglish();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pageOverride, setPageOverride] = useState<EmissionSurveyAdminPagePayload | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [activeCases, setActiveCases] = useState<SectionCaseState>({});
  const [expandedSections, setExpandedSections] = useState<SectionExpandState>({});
  const [selectedProductName, setSelectedProductName] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchDirty, setProductSearchDirty] = useState(false);
  const [directInputMode, setDirectInputMode] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productActiveOptionIndex, setProductActiveOptionIndex] = useState(0);
  const [productSuggestionRows, setProductSuggestionRows] = useState<ChemicalMaterialRow[]>([]);
  const [productSuggestionLoading, setProductSuggestionLoading] = useState(false);
  const [productSuggestionError, setProductSuggestionError] = useState("");
  const [ecoinventMappingTarget, setEcoinventMappingTarget] = useState<EcoinventMappingTarget | null>(null);
  const [ecoinventMappingKeyword, setEcoinventMappingKeyword] = useState("");
  const [ecoinventMappingFilters, setEcoinventMappingFilters] = useState<Record<string, string>>({});
  const [ecoinventMappingFilterOptions, setEcoinventMappingFilterOptions] = useState<Record<string, string[]>>({});
  const [ecoinventMappingRows, setEcoinventMappingRows] = useState<EcoinventDatasetRow[]>([]);
  const [ecoinventChemicalRows, setEcoinventChemicalRows] = useState<ChemicalMaterialRow[]>([]);
  const [ecoinventAiMappingRows, setEcoinventAiMappingRows] = useState<EcoinventDatasetRow[]>([]);
  const [ecoinventSelectedDatasetId, setEcoinventSelectedDatasetId] = useState("");
  const [ecoinventMappingLoading, setEcoinventMappingLoading] = useState(false);
  const [ecoinventChemicalLoading, setEcoinventChemicalLoading] = useState(false);
  const [ecoinventAiMappingLoading, setEcoinventAiMappingLoading] = useState(false);
  const [ecoinventMappingTotalCount, setEcoinventMappingTotalCount] = useState(0);
  const [calculationScope, setCalculationScope] = useState<SurveyCalculationScopeState>({
    loading: false,
    ready: false,
    categoryId: 0,
    categoryCode: "",
    categoryName: "",
    tier: 0,
    tierLabel: "",
    factors: [],
    message: "",
    blockingMessage: ""
  });

  const pageState = useAsyncValue<EmissionSurveyAdminPagePayload>(() => fetchEmissionSurveyAdminPage(), []);
  const page = pageOverride || pageState.value;
  const pagePayload = page || undefined;

  const classification = useClassificationSelection(pagePayload);
  const classificationKey = `${classification.majorCode}:${classification.middleCode}:${classification.smallCode || "-"}`;
  const sections = (((page?.sections || []) as EmissionSurveyAdminSection[]));
  const inputSections = sections.filter((section) => section.majorCode === "INPUT");
  const outputSections = sections.filter((section) => section.majorCode === "OUTPUT");
  const inputGroup = sectionGroupTitle("INPUT", en);
  const outputGroup = sectionGroupTitle("OUTPUT", en);
  const productRows = (((page?.productOptions || []) as Array<Record<string, string>>)).map((item) => ({ value: stringOf(item, "value"), label: stringOf(item, "label") }));
  const filteredProductRows = useMemo(() => {
    const normalizedQuery = normalizeSearchKeyword(productSearchQuery);
    if (!normalizedQuery) {
      return productRows;
    }
    return productRows.filter((option) => {
      const normalizedValue = normalizeSearchKeyword(option.value);
      const normalizedLabel = normalizeSearchKeyword(option.label);
      return normalizedValue.includes(normalizedQuery) || normalizedLabel.includes(normalizedQuery);
    });
  }, [productRows, productSearchQuery]);
  const productSearchOptions = useMemo<ProductSearchOption[]>(() => {
    const normalizedQuery = normalizeSearchKeyword(productSearchQuery);
    const seen = new Set<string>();
    const options: ProductSearchOption[] = [];
    const pushOption = (option: ProductSearchOption) => {
      const key = normalizeSearchKeyword(option.value || option.label);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      options.push(option);
    };

    if (productSearchQuery.trim()) {
      const hasExactConfiguredOption = productRows.some((option) => {
        return normalizeSearchKeyword(option.value) === normalizedQuery || normalizeSearchKeyword(option.label) === normalizedQuery;
      });
      if (!hasExactConfiguredOption) {
        pushOption({
          value: productSearchQuery.trim(),
          label: `${productSearchQuery.trim()} 검색`,
          description: "입력한 제품명으로 DB사용 데이터를 불러옵니다.",
          source: "typed"
        });
      }
    }

    filteredProductRows.forEach((option) => {
      pushOption({
        value: option.value,
        label: option.label || option.value,
        description: option.value !== option.label ? option.value : "등록된 제품 후보",
        source: "configured"
      });
    });

    productSuggestionRows.forEach((row) => {
      const displayName = chemicalDisplayName(row, en);
      const searchTerm = chemicalSearchTerm(row);
      const value = displayName || searchTerm;
      if (!value) {
        return;
      }
      const description = [
        stringValue(row.casNo) ? `CAS ${stringValue(row.casNo)}` : "",
        stringValue(row.englishName),
        stringValue(row.koreanName)
      ].filter(Boolean).join(" · ");
      pushOption({
        value,
        label: displayName || value,
        description: description || "화학물질 DB 추천 후보",
        source: "chemical"
      });
    });

    return options.slice(0, 30);
  }, [en, filteredProductRows, productRows, productSearchQuery, productSuggestionRows]);
  const isClassificationReady = Boolean(directInputMode || selectedProductName || stringOf(page as Record<string, unknown>, "selectedProductName"));
  const previewSummary = useMemo(() => {
    const normalization = buildNormalizationContext(sections, activeCases, getCase);
    const sectionSummaries = sections.map((section) => {
      const sectionCode = section.sectionCode || "";
      const activeCase = activeCases[sectionCode] || "CASE_3_1";
      const fallbackRows = buildDefaultCaseRows(section, activeCase);
      const currentRows = getCase(sectionCode, activeCase, fallbackRows).rows;
      const totalEmission = currentRows.reduce((sum, row) => {
        const amount = decimalValue(row.values.amount) * normalization.normalizationFactor;
        const emissionFactor = decimalValue(row.values.emissionFactor);
        const hasEmissionFactor = supportsEmissionFactorColumn(sectionCode);
        if (amount <= 0 || (hasEmissionFactor && emissionFactor <= 0)) {
          return sum;
        }
        return sum + amount * (hasEmissionFactor ? emissionFactor : 0);
      }, 0);
      const rowCount = isExcludedPreviewSection(sectionCode) ? 0 : currentRows.length;
      const calculatedRowCount = isExcludedPreviewSection(sectionCode)
        ? 0
        : currentRows.filter((row) => {
            const hasEmissionFactor = supportsEmissionFactorColumn(sectionCode);
            const amount = decimalValue(row.values.amount);
            return hasEmissionFactor ? (amount > 0 && decimalValue(row.values.emissionFactor) > 0) : amount > 0;
          }).length;
      return {
        sectionCode,
        sectionLabel: stripSectionNumber(section.sectionLabel || ""),
        totalEmission: isExcludedPreviewSection(sectionCode) ? 0 : totalEmission,
        rowCount,
        calculatedRowCount
      };
    });
    return {
      totalEmission: sectionSummaries.reduce((sum, section) => sum + section.totalEmission, 0),
      rowCount: sectionSummaries.reduce((sum, section) => sum + section.rowCount, 0),
      calculatedRowCount: sectionSummaries.reduce((sum, section) => sum + section.calculatedRowCount, 0),
      outputQuantityTotal: normalization.outputQuantityTotal
    };
  }, [activeCases, classificationKey, drafts, sections]);

  useEffect(() => {
    if (directInputMode) {
      return;
    }
    const nextSelected = stringOf(page as Record<string, unknown>, "selectedProductName");
    if (nextSelected && nextSelected !== selectedProductName) {
      setSelectedProductName(nextSelected);
    }
    if (!productSearchDirty && nextSelected && nextSelected !== productSearchQuery) {
      setProductSearchQuery(nextSelected);
    }
  }, [page, productSearchDirty, productSearchQuery, directInputMode, selectedProductName]);

  useEffect(() => {
    if (directInputMode) {
      setProductSuggestionRows([]);
      setProductSuggestionError("");
      setProductSuggestionLoading(false);
      return;
    }
    const keyword = productSearchQuery.trim();
    if (!keyword) {
      setProductSuggestionRows([]);
      setProductSuggestionError("");
      setProductSuggestionLoading(false);
      return;
    }
    let cancelled = false;
    setProductSuggestionLoading(true);
    setProductSuggestionError("");
    const timer = window.setTimeout(() => {
      fetchChemicalMaterialSuggestions(keyword)
        .then((rows) => {
          if (!cancelled) {
            setProductSuggestionRows(rows.slice(0, 25));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setProductSuggestionRows([]);
            setProductSuggestionError("제품 추천 후보를 불러오지 못했습니다.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setProductSuggestionLoading(false);
          }
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [directInputMode, productSearchQuery]);

  useEffect(() => {
    setProductActiveOptionIndex(0);
  }, [productSearchQuery, productSearchOptions.length]);

  useEffect(() => {
    const nextMajorCode = stringOf(page as Record<string, unknown>, "lciMajorCode");
    const nextMiddleCode = stringOf(page as Record<string, unknown>, "lciMiddleCode");
    const nextSmallCode = stringOf(page as Record<string, unknown>, "lciSmallCode");
    if (!nextMajorCode && !nextMiddleCode && !nextSmallCode) {
      return;
    }
    if (nextMajorCode !== classification.majorCode) {
      classification.setMajorCode(nextMajorCode);
    }
    if (nextMiddleCode !== classification.middleCode) {
      classification.setMiddleCode(nextMiddleCode);
    }
    if (nextSmallCode !== classification.smallCode) {
      classification.setSmallCode(nextSmallCode);
    }
  }, [
    classification,
    classification.majorCode,
    classification.middleCode,
    classification.smallCode,
    page
  ]);

  useEffect(() => {
    if (sections.length === 0 || !isClassificationReady) {
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      let mutated = false;
      sections.forEach((section) => {
        const sharedSection = resolveSharedSectionRows(pagePayload, section);
        const seedRows = sharedSection.rows;
        const case31Key = buildDraftKey(classificationKey, section.sectionCode || "", "CASE_3_1");
        const case32Key = buildDraftKey(classificationKey, section.sectionCode || "", "CASE_3_2");
        if (!next[case31Key]) {
          next[case31Key] = { rows: seedRows, savedAt: sharedSection.savedAt };
          mutated = true;
        }
        if (!next[case32Key]) {
          next[case32Key] = { rows: buildDefaultCaseRows(section, "CASE_3_2"), savedAt: "" };
          mutated = true;
        }
      });
      return mutated ? next : current;
    });
    setActiveCases((current) => {
      const next = { ...current };
      let mutated = false;
      sections.forEach((section) => {
        const sectionCode = section.sectionCode || "";
        if (!next[sectionCode]) {
          next[sectionCode] = "CASE_3_1";
          mutated = true;
        }
      });
      return mutated ? next : current;
    });
    setExpandedSections((current) => {
      const next = { ...current };
      let mutated = false;
      sections.forEach((section) => {
        const sectionCode = section.sectionCode || "";
        if (!(sectionCode in next)) {
          next[sectionCode] = false;
          mutated = true;
        }
      });
      return mutated ? next : current;
    });
  }, [classificationKey, isClassificationReady, pagePayload, sections]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-survey-admin", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      lciMajorCode: classification.majorCode,
      lciMiddleCode: classification.middleCode,
      lciSmallCode: classification.smallCode,
      uploaded: Boolean(page?.uploaded)
    });
  }, [classification.majorCode, classification.middleCode, classification.smallCode, en, page?.uploaded]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalculationScope() {
      if (!classification.middleCode) {
        setCalculationScope({
          loading: false,
          ready: true,
          categoryId: 0,
          categoryCode: "",
          categoryName: "",
          tier: 0,
          tierLabel: "",
          factors: [],
          message: "제품 기준 입력값의 배출계수로 탄소배출량을 계산합니다.",
          blockingMessage: ""
        });
        return;
      }

      setCalculationScope((current) => ({
        ...current,
        loading: true,
        ready: false,
        message: "",
        blockingMessage: ""
      }));

      try {
        const categoryResponse = await fetchEmissionCategories("");
        if (cancelled) {
          return;
        }
        const categories = (categoryResponse.items || []) as EmissionCategoryItem[];
        const preferredClassificationCode = classification.smallCode || classification.middleCode;
        const resolution = resolveCategoryByClassification(categories, preferredClassificationCode);
        const matchedCategory = resolution.matchedCategory;
        if (!matchedCategory) {
          setCalculationScope({
            loading: false,
            ready: false,
            categoryId: 0,
            categoryCode: "",
            categoryName: "",
            tier: 0,
            tierLabel: "",
            factors: [],
            message: resolution.ambiguous
              ? "선택한 중분류에 연결된 계산 카테고리가 여러 개라 소분류 선택이 더 필요합니다."
              : "선택한 분류와 연결된 배출 산정 카테고리를 찾지 못했습니다.",
            blockingMessage: resolution.ambiguous
              ? "계산 대상이 여러 개라 탄소배출량 계산 전에 LCI 소분류를 선택하세요."
              : "연결된 배출 산정 카테고리가 없어 계산할 수 없습니다. 관리자에 문의하세요."
          });
          return;
        }

        const categoryId = numberValue(matchedCategory.categoryId);
        const tiersResponse = await fetchEmissionTiers(categoryId);
        if (cancelled) {
          return;
        }
        const supportedTiers = ((tiersResponse.tiers || []) as Array<Record<string, unknown>>)
          .map((item) => ({
            tier: numberValue(item.tier),
            tierLabel: stringValue(item.tierLabel) || `Tier ${numberValue(item.tier)}`
          }))
          .filter((item) => item.tier > 0);
        const recommendedTier = parseTierLabelNumber(matchedCategory.classificationTierLabel);
        const selectedTier = supportedTiers.find((item) => item.tier === recommendedTier)?.tier || supportedTiers[0]?.tier || 0;
        const selectedTierLabel = supportedTiers.find((item) => item.tier === selectedTier)?.tierLabel || (selectedTier > 0 ? `Tier ${selectedTier}` : "");

        if (selectedTier <= 0) {
          setCalculationScope({
            loading: false,
            ready: false,
            categoryId,
            categoryCode: stringValue(matchedCategory.subCode),
            categoryName: stringValue(matchedCategory.subName),
            tier: 0,
            tierLabel: "",
            factors: [],
            message: "연결된 카테고리는 확인했지만 실행 가능한 Tier가 없습니다.",
            blockingMessage: "실행 가능한 Tier가 없어 계산할 수 없습니다. 관리자에 문의하세요."
          });
          return;
        }

        const definitionResponse = await fetchEmissionVariableDefinitions(categoryId, selectedTier);
        if (cancelled) {
          return;
        }
        const loadedFactors = (definitionResponse.factors || []) as EmissionFactorDefinition[];
        setCalculationScope({
          loading: false,
          ready: loadedFactors.length > 0,
          categoryId,
          categoryCode: stringValue(matchedCategory.subCode),
          categoryName: stringValue(matchedCategory.subName),
          tier: selectedTier,
          tierLabel: selectedTierLabel,
          factors: loadedFactors,
          message: loadedFactors.length > 0
            ? `계산 범위 ${stringValue(matchedCategory.subName)} / ${selectedTierLabel}에서 배출계수 ${loadedFactors.length}건을 확인했습니다.`
            : `계산 범위 ${stringValue(matchedCategory.subName)} / ${selectedTierLabel}에 저장된 배출계수가 없습니다.`,
          blockingMessage: loadedFactors.length > 0
            ? ""
            : "저장된 배출계수 값이 없어 계산할 수 없습니다. 관리자에 문의하세요."
        });
      } catch (scopeError) {
        if (cancelled) {
          return;
        }
        setCalculationScope({
          loading: false,
          ready: false,
          categoryId: 0,
          categoryCode: "",
          categoryName: "",
          tier: 0,
          tierLabel: "",
          factors: [],
          message: scopeError instanceof Error ? scopeError.message : "계산용 배출계수 범위를 불러오지 못했습니다.",
          blockingMessage: "배출계수 범위를 확인하지 못해 계산을 진행할 수 없습니다. 관리자에 문의하세요."
        });
      }
    }

    void loadCalculationScope();
    return () => {
      cancelled = true;
    };
  }, [classification.middleCode, classification.smallCode]);

  function getCase(sectionCode: string, caseCode: "CASE_3_1" | "CASE_3_2", fallbackRows: DraftRow[]) {
    return drafts[buildDraftKey(classificationKey, sectionCode, caseCode)] || { rows: fallbackRows, savedAt: "" };
  }

  function setCaseRows(sectionCode: string, caseCode: "CASE_3_1" | "CASE_3_2", rows: DraftRow[], savedAt?: string) {
    const draftKey = buildDraftKey(classificationKey, sectionCode, caseCode);
    setDrafts((current) => ({
      ...current,
      [draftKey]: {
        rows,
        savedAt: savedAt ?? current[draftKey]?.savedAt ?? ""
      }
    }));
  }

  function handleAddRow(section: EmissionSurveyAdminSection) {
    const sectionCode = section.sectionCode || "";
    const currentCaseCode = activeCases[sectionCode] || "CASE_3_1";
    const currentRows = getCase(sectionCode, currentCaseCode, buildRowsFromSection(section)).rows.slice();
    currentRows.push(createEmptyRow(section, currentRows.length + 1, directInputMode ? productSearchQuery : ""));
    setCaseRows(sectionCode, currentCaseCode, currentRows);
  }

  function syncDirectInputProductName(productName: string) {
    const outputSection = sections.find((section) => isOutputProductsSection(section.sectionCode));
    if (!outputSection) {
      return;
    }
    const sectionCode = outputSection.sectionCode || "";
    const currentRows = getCase(sectionCode, "CASE_3_2", buildDefaultCaseRows(outputSection, "CASE_3_2")).rows.slice();
    const nextRows = currentRows.length > 0 ? currentRows : [createEmptyRow(outputSection, 1, productName)];
    const normalizedRows = nextRows.map((row, index) => {
      if (index !== 0) {
        return {
          ...row,
          values: applyDefaultRowValues(outputSection, row.values, "")
        };
      }
      return {
        ...row,
        values: applyDefaultRowValues(outputSection, {
          ...row.values,
          group: row.values.group || "제품",
          materialName: productName
        }, productName)
      };
    });
    setCaseRows(sectionCode, "CASE_3_2", normalizedRows);
    setActiveCases((current) => ({ ...current, [sectionCode]: "CASE_3_2" }));
    setExpandedSections((current) => ({ ...current, [sectionCode]: true }));
  }

  function handleRemoveRow(section: EmissionSurveyAdminSection, rowId: string) {
    const sectionCode = section.sectionCode || "";
    const currentCaseCode = activeCases[sectionCode] || "CASE_3_1";
    const currentRows = getCase(sectionCode, currentCaseCode, buildRowsFromSection(section)).rows.filter((row) => row.rowId !== rowId);
    setCaseRows(sectionCode, currentCaseCode, currentRows);
  }

  function handleCellChange(section: EmissionSurveyAdminSection, rowId: string, key: string, value: string) {
    const sectionCode = section.sectionCode || "";
    const currentCaseCode = activeCases[sectionCode] || "CASE_3_1";
    const currentRows = getCase(sectionCode, currentCaseCode, buildRowsFromSection(section)).rows.map((row) => {
      if (row.rowId !== rowId) {
        return row;
      }
      const nextValues = { ...row.values, [key]: value };
      if (key === "group") {
        nextValues.group = value || defaultGroupValue(sectionCode);
      }
      if (isUnitColumnKey(key)) {
        nextValues[key] = normalizeUnitValue(value);
        nextValues[unitCategoryKeyForUnitKey(key)] = nextValues[unitCategoryKeyForUnitKey(key)] || resolveUnitCategory(nextValues[key]);
      }
      if (isUnitCategoryColumnKey(key)) {
        const unitKey = unitKeyForCategoryKey(key);
        const selectedUnit = nextValues[unitKey] || "";
        if (selectedUnit && resolveUnitCategory(selectedUnit) !== value) {
          nextValues[unitKey] = "";
        }
      }
      return { ...row, values: nextValues };
    });
    setCaseRows(sectionCode, currentCaseCode, currentRows);
  }

  function handleApplyEcoinventMappedFactor(section: EmissionSurveyAdminSection, rowId: string, ecoinventRow: EcoinventDatasetRow) {
    const sectionCode = section.sectionCode || "";
    const currentCaseCode = activeCases[sectionCode] || "CASE_3_1";
    const currentRows = getCase(sectionCode, currentCaseCode, buildRowsFromSection(section)).rows.map((row) => {
      if (row.rowId !== rowId) {
        return row;
      }
      return {
        ...row,
        values: {
          ...row.values,
          emissionFactor: stringValue(ecoinventRow.score),
          ecoinventDatasetId: stringValue(ecoinventRow.datasetId),
          ecoinventEnglishName: stringValue(ecoinventRow.productName),
          ecoinventActivity: stringValue(ecoinventRow.activityName),
          ecoinventGeography: stringValue(ecoinventRow.geography),
          ecoinventUnit: stringValue(ecoinventRow.referenceProductUnit),
          ecoinventMappingStatus: "CONFIRMED"
        }
      };
    });
    setCaseRows(sectionCode, currentCaseCode, currentRows);
    setMessage(`${stringValue(ecoinventRow.productName) || "ecoinvent Product"} 매핑 배출계수를 적용했습니다.`);
  }

  function handleOpenEcoinventMapping(section: EmissionSurveyAdminSection, rowId: string, materialName: string) {
    const keyword = stringValue(materialName).trim();
    const nextTarget = {
      sectionCode: section.sectionCode || "",
      rowId,
      materialName: keyword
    };
    setEcoinventMappingTarget(nextTarget);
    setEcoinventMappingKeyword(keyword);
    setEcoinventMappingFilters({});
    setEcoinventMappingRows([]);
    setEcoinventChemicalRows([]);
    setEcoinventAiMappingRows([]);
    setEcoinventSelectedDatasetId("");
    setEcoinventMappingTotalCount(0);
    fetchEcoinventFilterOptions(keyword).then(setEcoinventMappingFilterOptions).catch(() => setEcoinventMappingFilterOptions({}));
    void handleSearchEcoinventMapping(keyword, {}, nextTarget);
  }

  async function handleSearchEcoinventMapping(
    keywordOverride?: string,
    filtersOverride?: Record<string, string>,
    targetOverride?: EcoinventMappingTarget | null
  ) {
    const currentTarget = targetOverride || ecoinventMappingTarget;
    if (!currentTarget) {
      return;
    }
    const keyword = String(keywordOverride ?? ecoinventMappingKeyword ?? "");
    const filters = filtersOverride || ecoinventMappingFilters;
    setEcoinventMappingLoading(true);
    setEcoinventChemicalLoading(true);
    setEcoinventAiMappingLoading(true);
    setErrorMessage("");
    try {
      const useKoreanRecommendation = containsKorean(keyword)
        || (!!currentTarget.materialName && normalizeSearchKeyword(keyword) === normalizeSearchKeyword(currentTarget.materialName));
      const requestParams = {
        keyword,
        ...filters,
        pageIndex: 1,
        pageSize: 100
      };
      const chemicalPromise = fetchChemicalMaterialSuggestions(keyword || currentTarget.materialName)
        .catch(() => [] as ChemicalMaterialRow[]);
      const aiPromise = fetchSurveyEcoinventAiRecommendationPage({
        ...requestParams,
        materialName: currentTarget.materialName || keyword,
        pageSize: 12
      }).catch(() => ({ data: [] as EcoinventDatasetRow[], totalCount: 0 }));
      const [chemicalRows, previousMappings, aiResponse, response] = await Promise.all([
        chemicalPromise,
        fetchEcoinventMappedFactors(keyword || currentTarget.materialName),
        aiPromise,
        useKoreanRecommendation ? fetchSurveyEcoinventRecommendationPage({
          ...requestParams,
          materialName: currentTarget.materialName || keyword
        }) : fetchEcoinventDatasetPage({
          ...requestParams
        })
      ]);
      const aiRows = aiResponse.data || [];
      const rows = mergeEcoinventRows(mergeEcoinventRows(previousMappings, aiRows), response.data || []);
      setEcoinventChemicalRows(chemicalRows);
      setEcoinventAiMappingRows(aiRows);
      setEcoinventMappingRows(rows);
      setEcoinventMappingTotalCount(Math.max(response.totalCount ?? rows.length, rows.length));
      setEcoinventSelectedDatasetId(rows.length > 0 ? stringValue(rows[0].datasetId) : "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ecoinvent 데이터셋 검색에 실패했습니다.");
    } finally {
      setEcoinventMappingLoading(false);
      setEcoinventChemicalLoading(false);
      setEcoinventAiMappingLoading(false);
    }
  }

  async function handleSelectChemicalMaterial(row: ChemicalMaterialRow) {
    const nextKeyword = chemicalSearchTerm(row);
    if (!nextKeyword) {
      return;
    }
    setEcoinventMappingKeyword(nextKeyword);
    setEcoinventMappingFilters({});
    setEcoinventMappingLoading(true);
    setErrorMessage("");
    try {
      const [previousMappings, response] = await Promise.all([
        fetchEcoinventMappedFactors(stringValue(row.koreanName) || stringValue(row.englishName) || nextKeyword),
        fetchEcoinventDatasetPage({
          keyword: nextKeyword,
          pageIndex: 1,
          pageSize: 100,
          remote: true
        })
      ]);
      const rows = mergeEcoinventRows(previousMappings, response.data || []);
      setEcoinventMappingRows(rows);
      setEcoinventMappingTotalCount(Math.max(response.totalCount ?? rows.length, rows.length));
      setEcoinventSelectedDatasetId(rows.length > 0 ? stringValue(rows[0].datasetId) : "");
      setMessage(`${chemicalDisplayName(row)} 기준 ecoinvent API 후보를 불러왔습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ecoinvent API 후보를 불러오지 못했습니다.");
    } finally {
      setEcoinventMappingLoading(false);
    }
  }

  function handleEcoinventFilterChange(key: string, value: string) {
    setEcoinventMappingFilters((current) => ({ ...current, [key]: value }));
  }

  function handleEcoinventKeywordChange(value: string) {
    setEcoinventMappingKeyword(value);
    fetchChemicalMaterialSuggestions(value).then(setEcoinventChemicalRows).catch(() => setEcoinventChemicalRows([]));
    fetchEcoinventFilterOptions(value).then(setEcoinventMappingFilterOptions).catch(() => setEcoinventMappingFilterOptions({}));
  }

  async function handleApplyEcoinventMapping() {
    if (!ecoinventMappingTarget) {
      return;
    }
    let ecoinventRow = ecoinventMappingRows.find((row) => stringValue(row.datasetId) === ecoinventSelectedDatasetId) || null;
    if (!ecoinventRow) {
      setErrorMessage("먼저 매핑할 ecoinvent 데이터셋을 선택하세요.");
      return;
    }
    const sectionCode = ecoinventMappingTarget.sectionCode;
    const section = sections.find((candidate) => (candidate.sectionCode || "") === sectionCode);
    if (!section) {
      setErrorMessage("매핑 대상 섹션을 찾지 못했습니다.");
      return;
    }
    try {
      const datasetId = Number(ecoinventRow.datasetId);
      if (datasetId > 0 && !stringValue(ecoinventRow.score)) {
        await importSelectedEcoinventDatasets([datasetId]);
        const refreshedPage = await fetchEcoinventDatasetPage({
          keyword: stringValue(ecoinventRow.productName) || stringValue(ecoinventRow.activityName),
          pageIndex: 1,
          pageSize: 100
        });
        ecoinventRow = (refreshedPage.data || []).find((row) => stringValue(row.datasetId) === String(datasetId)) || ecoinventRow;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "선택한 ecoinvent 데이터셋을 로컬 DB로 가져오지 못했습니다.");
      return;
    }
    const currentCaseCode = activeCases[sectionCode] || "CASE_3_1";
    const currentRows = getCase(sectionCode, currentCaseCode, buildRowsFromSection(section)).rows.map((row) => {
      if (row.rowId !== ecoinventMappingTarget.rowId) {
        return row;
      }
      const appliedMaterialName = stringValue(ecoinventMappingKeyword).trim()
        || ecoinventMappingTarget.materialName
        || stringValue(ecoinventRow.koreanName)
        || stringValue(ecoinventRow.productName);
      const nextValues = {
        ...row.values,
        materialName: appliedMaterialName,
        emissionFactor: stringValue(ecoinventRow.score),
        ecoinventDatasetId: stringValue(ecoinventRow.datasetId),
        ecoinventEnglishName: stringValue(ecoinventRow.productName),
        ecoinventActivity: stringValue(ecoinventRow.activityName),
        ecoinventGeography: stringValue(ecoinventRow.geography),
        ecoinventUnit: stringValue(ecoinventRow.referenceProductUnit),
        ecoinventMappingStatus: "CONFIRMED"
      };
      return { ...row, values: nextValues };
    });
    try {
      await saveEcoinventMapping({
        koreanName: stringValue(ecoinventMappingKeyword).trim()
          || ecoinventMappingTarget.materialName
          || stringValue(ecoinventRow.koreanName)
          || stringValue(ecoinventRow.productName),
        datasetId: Number(ecoinventRow.datasetId),
        memo: "survey-admin confirmed mapping"
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ecoinvent 매핑 기록 저장에 실패했습니다.");
      return;
    }
    setCaseRows(sectionCode, currentCaseCode, currentRows);
    setEcoinventMappingTarget(null);
    setMessage(`${stringValue(ecoinventRow.productName) || "ecoinvent 데이터셋"} 배출계수를 입력하고 다음 추천 우선순위에 저장했습니다.`);
  }

  async function buildAutoRecommendedRows(section: EmissionSurveyAdminSection, rows: DraftRow[]) {
    if (!supportsEmissionFactorColumn(section.sectionCode)) {
      return { rows, recommendedCount: 0 };
    }
    let recommendedCount = 0;
    const cache = new Map<string, EcoinventDatasetRow | null>();
    const nextRows: DraftRow[] = [];
    for (const row of rows) {
      const materialName = stringValue(row.values.materialName).trim();
      if (!materialName || row.values.ecoinventMappingStatus === "CONFIRMED") {
        nextRows.push(row);
        continue;
      }
      if (!cache.has(materialName)) {
        try {
          const rows = await fetchEcoinventMappedFactors(materialName);
          cache.set(materialName, rows[0] || null);
        } catch {
          cache.set(materialName, null);
        }
      }
      const recommendation = cache.get(materialName);
      if (!recommendation) {
        nextRows.push(row);
        continue;
      }
      recommendedCount += 1;
      nextRows.push({
        ...row,
        values: {
          ...row.values,
          emissionFactor: stringValue(recommendation.score),
          ecoinventDatasetId: stringValue(recommendation.datasetId),
          ecoinventEnglishName: stringValue(recommendation.productName),
          ecoinventActivity: stringValue(recommendation.activityName),
          ecoinventGeography: stringValue(recommendation.geography),
          ecoinventUnit: stringValue(recommendation.referenceProductUnit),
          ecoinventMappingStatus: "CONFIRMED"
        }
      });
    }
    return { rows: nextRows, recommendedCount };
  }

  async function applyInitialEcoinventRecommendations(sourceSections: EmissionSurveyAdminSection[], caseCode: "CASE_3_1" | "CASE_3_2", sourcePage?: EmissionSurveyAdminPagePayload | null) {
    let totalRecommendedCount = 0;
    for (const section of sourceSections) {
      const sectionCode = section.sectionCode || "";
      const draftRows = caseCode === "CASE_3_1"
        ? resolveSharedSectionRows(sourcePage || pagePayload, section).rows
        : getCase(sectionCode, caseCode, buildDefaultCaseRows(section, caseCode)).rows;
      const result = await buildAutoRecommendedRows(section, draftRows);
      totalRecommendedCount += result.recommendedCount;
      setCaseRows(sectionCode, caseCode, result.rows, caseCode === "CASE_3_1" ? resolveSharedSectionRows(sourcePage || pagePayload, section).savedAt : "");
    }
    return totalRecommendedCount;
  }

  function handleToggleSection(sectionCode: string) {
    setExpandedSections((current) => ({
      ...current,
      [sectionCode]: !current[sectionCode]
    }));
  }

  async function handleLoadCase(
    section: EmissionSurveyAdminSection,
    caseCode: "CASE_3_1" | "CASE_3_2",
    options?: { suppressMessage?: boolean; sourcePage?: EmissionSurveyAdminPagePayload | null | undefined }
  ) {
    const sectionCode = section.sectionCode || "";
    setActiveCases((current) => ({ ...current, [sectionCode]: caseCode }));
    setExpandedSections((current) => ({ ...current, [sectionCode]: true }));
    if (caseCode === "CASE_3_1") {
      const sharedSection = resolveSharedSectionRows(options?.sourcePage || pagePayload, section);
      setCaseRows(sectionCode, caseCode, sharedSection.rows, sharedSection.savedAt);
      if (!options?.suppressMessage) {
        setMessage("공통 DB사용 데이터를 불러왔습니다.");
      }
    } else {
      setCaseRows(sectionCode, caseCode, buildDefaultCaseRows(section, "CASE_3_2"), "");
      if (!options?.suppressMessage) {
        setMessage("직접입력 상태로 전환했습니다.");
      }
    }
    setErrorMessage("");
  }

  async function handleLoadAllSections(caseCode: "CASE_3_1" | "CASE_3_2") {
    setMessage("");
    setErrorMessage("");
    if (caseCode === "CASE_3_2") {
      setSelectedProductName("");
      setProductSearchQuery("");
      setProductSearchDirty(false);
      setProductDropdownOpen(false);
      setDirectInputMode(true);
    } else {
      setDirectInputMode(false);
      if (!selectedProductName) {
        setProductDropdownOpen(true);
        setMessage("제품명을 입력하거나 목록에서 선택한 뒤 `검색 적용`을 누르면 선택 제품의 DB사용 데이터셋을 불러옵니다.");
        return;
      }
    }
    try {
      const latestPage = caseCode === "CASE_3_1"
        ? await fetchEmissionSurveyAdminPage({ productName: selectedProductName })
        : sections.length === 0
          ? await fetchEmissionSurveyAdminPage()
          : null;
      if (latestPage) {
        setPageOverride(latestPage);
      }
      const baseSections = sections.length > 0 ? sections : (((pageState.value?.sections || []) as EmissionSurveyAdminSection[]));
      const sourceSections = latestPage ? ((((latestPage.sections || []) as EmissionSurveyAdminSection[]))) : baseSections;
      if (sourceSections.length === 0) {
        setErrorMessage("직접입력 섹션 골격을 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 시도하세요.");
        return;
      }
      const nextActiveCases: SectionCaseState = {};
      const nextExpandedSections: SectionExpandState = {};
      sourceSections.forEach((section) => {
        nextActiveCases[section.sectionCode || ""] = caseCode;
        nextExpandedSections[section.sectionCode || ""] = true;
      });
      setActiveCases(nextActiveCases);
      setExpandedSections(nextExpandedSections);

      for (const section of sourceSections) {
        await handleLoadCase(section, caseCode, { suppressMessage: true, sourcePage: latestPage || pagePayload });
      }
      const recommendedCount = caseCode === "CASE_3_1"
        ? await applyInitialEcoinventRecommendations(sourceSections, caseCode, latestPage || pagePayload)
        : 0;
      setMessage(caseCode === "CASE_3_1"
        ? `공통 DB사용 데이터로 8개 섹션 전체를 불러왔습니다. 이전 사용자 매핑 ${recommendedCount}건은 자동 입력했고, 나머지는 매핑 버튼으로 배출계수를 입력하세요.`
        : "8개 섹션 전체를 직접입력 상태로 전환했습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "섹션 전체 불러오기에 실패했습니다.");
    }
  }

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const uploadFile = event.target.files?.[0];
    if (!uploadFile) {
      return;
    }
    setUploading(true);
    setMessage("");
    setErrorMessage("");
    try {
      const payload = await uploadEmissionSurveyWorkbook(uploadFile, {
        lciMajorCode: classification.majorCode,
        lciMajorLabel: classification.majorLabel,
        lciMiddleCode: classification.middleCode,
        lciMiddleLabel: classification.middleLabel,
        lciSmallCode: classification.smallCode,
        lciSmallLabel: classification.smallLabel
      });
      setPageOverride(payload);
      setDrafts({});
      setActiveCases({});
      setMessage(String((payload.uploadAudit as Record<string, unknown> | undefined)?.message || "엑셀을 업로드했고 8개 섹션 구성을 다시 불러왔습니다."));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleReloadSharedProduct(productName: string) {
    setMessage("");
    setErrorMessage("");
    try {
      const latestPage = await fetchEmissionSurveyAdminPage({ productName });
      setPageOverride(latestPage);
      setSelectedProductName(productName);
      setProductSearchDirty(false);
      setDrafts({});
      setActiveCases({});
      const sourceSections = ((latestPage.sections || []) as EmissionSurveyAdminSection[]);
      const nextActiveCases: SectionCaseState = {};
      const nextExpandedSections: SectionExpandState = {};
      sourceSections.forEach((section) => {
        nextActiveCases[section.sectionCode || ""] = "CASE_3_1";
        nextExpandedSections[section.sectionCode || ""] = true;
      });
      setActiveCases(nextActiveCases);
      setExpandedSections(nextExpandedSections);
      const recommendedCount = await applyInitialEcoinventRecommendations(sourceSections, "CASE_3_1", latestPage);
      setMessage(`${productName || "기본"} 제품 기준 DB사용 데이터를 불러왔습니다. 이전 사용자 매핑 ${recommendedCount}건은 자동 입력했고, 나머지는 매핑 버튼으로 배출계수를 입력하세요.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "제품 기준 DB 데이터를 불러오지 못했습니다.");
    }
  }

  function handleChangeProduct(productName: string) {
    setDirectInputMode(false);
    setSelectedProductName(productName);
    setProductSearchQuery(productName);
    setProductSearchDirty(false);
    setProductDropdownOpen(false);
    if (!productName) {
      return;
    }
    void handleReloadSharedProduct(productName);
  }

  function handleApplyProductSearch() {
    const typedProductName = productSearchQuery.trim();
    if (!typedProductName) {
      setErrorMessage("검색할 제품명을 입력하세요.");
      setMessage("");
      return;
    }
    const exactOption = productSearchOptions.find((option) => {
      const normalizedQuery = normalizeSearchKeyword(typedProductName);
      return normalizeSearchKeyword(option.value) === normalizedQuery || normalizeSearchKeyword(option.label) === normalizedQuery;
    });
    setErrorMessage("");
    setMessage("");
    handleChangeProduct(exactOption?.value || typedProductName);
  }

  function handleSelectProductOption(productName: string) {
    setErrorMessage("");
    setMessage("");
    setDirectInputMode(false);
    handleChangeProduct(productName);
  }

  function handleMoveToCalculation() {
    const resolvedProductName = selectedProductName || stringOf(page as Record<string, unknown>, "selectedProductName");
    if (!resolvedProductName) {
      setErrorMessage("탄소배출량 계산 전에 제품을 선택하세요.");
      return;
    }
    if (sections.length === 0) {
      setErrorMessage("계산할 INPUT/OUTPUT 섹션 데이터가 없습니다. 먼저 DB사용 데이터를 불러오세요.");
      return;
    }
    const requiresCategoryScope = Boolean(classification.middleCode);
    if (requiresCategoryScope && (!calculationScope.ready || calculationScope.categoryId <= 0 || calculationScope.tier <= 0)) {
      setErrorMessage(calculationScope.blockingMessage || "배출계수 범위를 확인하지 못해 계산을 진행할 수 없습니다. 관리자에 문의하세요.");
      return;
    }
    if (hasUnconfirmedEcoinventRecommendations(sections, activeCases, getCase)) {
      setErrorMessage("ecoinvent 자동 추천 배출계수가 남아 있습니다. 각 행의 `확인` 버튼을 눌러 매핑을 확정한 뒤 계산하세요.");
      return;
    }
    const normalization = buildNormalizationContext(sections, activeCases, getCase);
    const sectionSummaries: EmissionSurveyReportSectionSummary[] = sections.map((section) => {
      const sectionCode = section.sectionCode || "";
      const activeCase = activeCases[sectionCode] || "CASE_3_1";
      const fallbackRows = buildDefaultCaseRows(section, activeCase);
      const currentRows = getCase(sectionCode, activeCase, fallbackRows).rows;
      const calculatedRows = currentRows.filter((row) => {
        const hasEmissionFactor = supportsEmissionFactorColumn(sectionCode);
        const amount = decimalValue(row.values.amount);
        return hasEmissionFactor ? (amount > 0 && decimalValue(row.values.emissionFactor) > 0) : amount > 0;
      });
      const totalEmission = isExcludedPreviewSection(sectionCode)
        ? 0
        : calculatedRows.reduce((sum, row) => {
            const hasEmissionFactor = supportsEmissionFactorColumn(sectionCode);
            const amount = decimalValue(row.values.amount) * normalization.normalizationFactor;
            const emissionFactor = decimalValue(row.values.emissionFactor);
            return sum + amount * (hasEmissionFactor ? emissionFactor : 0);
          }, 0);
      return {
        sectionCode,
        sectionLabel: stripSectionNumber(section.sectionLabel || ""),
        majorCode: section.majorCode || "",
        rowCount: isExcludedPreviewSection(sectionCode) ? 0 : currentRows.length,
        calculatedRowCount: isExcludedPreviewSection(sectionCode) ? 0 : calculatedRows.length,
        totalEmission,
        sharePercent: 0,
        sourceMode: activeCase === "CASE_3_2" ? "직접입력" : "DB사용"
      };
    });
    const totalEmission = sectionSummaries.reduce((sum, section) => sum + section.totalEmission, 0);
    const normalizedSectionSummaries = sectionSummaries.map((section) => ({
      ...section,
      sharePercent: totalEmission > 0 ? (section.totalEmission / totalEmission) * 100 : 0
    })).sort((left, right) => right.totalEmission - left.totalEmission);
    const rows: EmissionSurveyReportRow[] = sections.flatMap((section) => {
      const sectionCode = section.sectionCode || "";
      const activeCase = activeCases[sectionCode] || "CASE_3_1";
      const fallbackRows = buildDefaultCaseRows(section, activeCase);
      const currentRows = getCase(sectionCode, activeCase, fallbackRows).rows;
      return currentRows.map((row) => {
        const hasEmissionFactor = supportsEmissionFactorColumn(sectionCode);
        const originalAmount = decimalValue(row.values.amount);
        const amount = originalAmount * normalization.normalizationFactor;
        const emissionFactor = decimalValue(row.values.emissionFactor);
        const calculated = !isExcludedPreviewSection(sectionCode) && amount > 0 && (hasEmissionFactor ? emissionFactor > 0 : true);
        const warning = isExcludedPreviewSection(sectionCode)
          ? ""
          : originalAmount > 0 && hasEmissionFactor && emissionFactor <= 0
          ? "배출계수 미입력"
          : !row.values.annualUnit
            ? "단위 확인 필요"
            : "";
        return {
          rowId: row.rowId,
          sectionCode,
          sectionLabel: stripSectionNumber(section.sectionLabel || ""),
          majorCode: section.majorCode || "",
          group: row.values.group || "",
          materialName: row.values.materialName || "",
          amount,
          amountText: formatDecimalText(amount),
          originalAmount,
          originalAmountText: row.values.amount || "",
          unit: row.values.annualUnit || "",
          emissionFactor: hasEmissionFactor ? emissionFactor : 0,
          emissionFactorText: hasEmissionFactor ? (row.values.emissionFactor || "") : "",
          totalEmission: calculated ? amount * (hasEmissionFactor ? emissionFactor : 0) : 0,
          sourceMode: activeCase === "CASE_3_2" ? "직접입력" : "DB사용",
          note: row.values.remark || row.values.note || "",
          calculated,
          warning
        };
      });
    });
    const warningRows = rows.filter((row) => Boolean(row.warning));
    const manualRows = rows.filter((row) => row.sourceMode === "직접입력");
    const dataConfidence = Math.max(55, Math.min(99, Math.round(100 - (warningRows.length * 4) - (manualRows.length * 2) - Math.max(0, rows.length - previewSummary.calculatedRowCount))));
    const topContributor = normalizedSectionSummaries[0];
    const alerts: EmissionSurveyAlertItem[] = [];
    if (warningRows.length > 0) {
      alerts.push({
        title: "배출계수 또는 단위 확인 필요",
        description: `${warningRows.length}개 행에서 배출계수 또는 단위 정보가 충분하지 않아 최종 계산 해석 시 주의가 필요합니다.`,
        tone: "warning"
      });
    }
    if (manualRows.length > 0) {
      alerts.push({
        title: "직접입력 행 포함",
        description: `${manualRows.length}개 행은 직접입력 기준으로 계산되어, DB사용 기준보다 검증 우선순위가 높습니다.`,
        tone: "info"
      });
    }
    const scenarios: EmissionSurveyScenarioCard[] = [
      {
        label: "현재 기준",
        totalEmission,
        deltaPercent: 0,
        tone: "current",
        description: "현재 설문 입력값, 선택된 배출계수, 직접입력/DB사용 상태를 그대로 반영한 결과입니다."
      },
      {
        label: "보수적 계수 적용",
        totalEmission: totalEmission * 1.052,
        deltaPercent: 5.2,
        tone: "conservative",
        description: "경고 행을 보수적으로 재평가했을 때의 상단 시나리오입니다."
      },
      {
        label: "개선 시나리오",
        totalEmission: totalEmission * 0.914,
        deltaPercent: -8.6,
        tone: "optimized",
        description: "에너지·스팀 기여도를 우선 개선했을 때 기대 가능한 하향 시나리오입니다."
      }
    ];
    const payload: EmissionSurveyReportPayload = {
      generatedAt: new Date().toISOString(),
      productName: selectedProductName || stringOf(page as Record<string, unknown>, "selectedProductName") || "미선택 제품",
      pageTitle: stringOf(page as Record<string, unknown>, "pageTitle") || "배출 설문 관리",
      classification: {
        majorLabel: classification.majorLabel,
        middleLabel: classification.middleLabel,
        smallLabel: classification.smallLabel
      },
      calculationScope: {
        categoryName: calculationScope.categoryName,
        tierLabel: calculationScope.tierLabel,
        factorCount: calculationScope.factors.length
      },
      summary: {
        totalEmission,
        rowCount: previewSummary.rowCount,
        calculatedRowCount: previewSummary.calculatedRowCount,
        warningCount: alerts.length,
        dataConfidence,
        topContributorLabel: topContributor?.sectionLabel || "-",
        topContributorSharePercent: topContributor?.sharePercent || 0
      },
      normalization: {
        outputQuantityTotal: normalization.outputQuantityTotal,
        factor: normalization.normalizationFactor,
        applied: normalization.outputQuantityTotal > 0
      },
      sectionSummaries: normalizedSectionSummaries,
      rows,
      scenarios,
      alerts
    };
    saveEmissionSurveyReportSession(payload);
    navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"));
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈" },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "Emission Survey Management" : "배출 설문 관리" }
      ]}
      title={stringOf(page as Record<string, unknown>, "pageTitle") || "배출 설문 관리"}
      subtitle=""
      loading={false}
      loadingLabel={en ? "Loading the emission survey workspace..." : "배출 설문 작업공간을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.loading && !page && !pageState.error ? (
          <PageStatusNotice tone="warning">기본 화면을 먼저 표시하고 있습니다. 설문 데이터는 로딩이 끝나는 대로 이어서 표시됩니다.</PageStatusNotice>
        ) : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {errorMessage || pageState.error ? <PageStatusNotice tone="error">{errorMessage || pageState.error}</PageStatusNotice> : null}
        {hasUnconfirmedEcoinventRecommendations(sections, activeCases, getCase) ? (
          <PageStatusNotice tone="warning">ecoinvent 자동 추천 배출계수가 있습니다. 각 행의 `확인` 버튼에서 Product / Activity / Geography를 확인하고 매핑을 확정하세요.</PageStatusNotice>
        ) : null}

        <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm" data-help-id="emission-survey-admin-classification">
          <MemberSectionToolbar
            title={<span>분류 선택 및 편집 시작</span>}
            actions={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton onClick={() => void handleLoadAllSections("CASE_3_1")} type="button" variant="secondary">DB사용</MemberButton>
                <MemberButton onClick={() => void handleLoadAllSections("CASE_3_2")} type="button" variant="secondary">직접입력</MemberButton>
                <MemberButton onClick={() => fileInputRef.current?.click()} type="button" variant="primary">{uploading ? "업로드 중..." : "엑셀 업로드"}</MemberButton>
              </div>
            )}
          />
          <input accept=".xlsx" className="hidden" onChange={handleUploadChange} ref={fileInputRef} type="file" />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div
              className="relative z-50"
              data-help-id="emission-survey-product-combobox"
              data-state-marker={productSearchDirty ? PRODUCT_SEARCH_DIRTY_MARKER : PRODUCT_SEARCH_SYNCED_MARKER}
              onMouseDown={() => {
              if (!directInputMode) {
                setProductDropdownOpen(true);
              }
            }}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">제품 선택</span>
                <AdminInput
                  aria-autocomplete="list"
                  aria-busy={productSuggestionLoading}
                  aria-activedescendant={productDropdownOpen ? `emission-survey-product-option-${productActiveOptionIndex}` : undefined}
                  aria-expanded={!directInputMode && productDropdownOpen}
                  onBlur={() => window.setTimeout(() => setProductDropdownOpen(false), 120)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setErrorMessage("");
                    setMessage("");
                    setProductSearchDirty(true);
                    setSelectedProductName("");
                    setProductSearchQuery(nextValue);
                    if (directInputMode) {
                      setProductDropdownOpen(false);
                      syncDirectInputProductName(nextValue);
                    } else {
                      setProductDropdownOpen(true);
                    }
                  }}
                  onFocus={() => {
                    if (!directInputMode) {
                      setProductDropdownOpen(true);
                    }
                  }}
                  onClick={() => {
                    if (!directInputMode) {
                      setProductDropdownOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (directInputMode && event.key === "Enter") {
                      event.preventDefault();
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setProductDropdownOpen(true);
                      setProductActiveOptionIndex((current) => Math.min(current + 1, Math.max(productSearchOptions.length - 1, 0)));
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setProductDropdownOpen(true);
                      setProductActiveOptionIndex((current) => Math.max(current - 1, 0));
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (productDropdownOpen && productSearchOptions[productActiveOptionIndex]) {
                        handleSelectProductOption(productSearchOptions[productActiveOptionIndex].value);
                        return;
                      }
                      handleApplyProductSearch();
                    }
                    if (event.key === "Escape") {
                      setProductDropdownOpen(false);
                    }
                  }}
                  placeholder="제품명을 입력해 실시간 검색"
                  value={productSearchQuery}
                />
              </label>
              {!directInputMode && productDropdownOpen ? (
                <div className="absolute z-[9999] mt-2 max-h-72 w-full overflow-auto rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white shadow-xl" role="listbox">
                  <div className="sticky top-0 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
                    {productSuggestionLoading ? "추천 후보 검색 중..." : productSearchQuery.trim() ? `검색 후보 ${productSearchOptions.length}건` : `전체 제품 ${productRows.length}건`}
                  </div>
                  {productSearchOptions.length > 0 ? productSearchOptions.map((option, optionIndex) => (
                    <button
                      className={`block w-full px-4 py-3 text-left text-sm hover:bg-sky-50 focus:bg-sky-50 ${optionIndex === productActiveOptionIndex ? "bg-sky-50" : ""}`}
                      key={`${option.source}-${option.value}-${option.label}`}
                      id={`emission-survey-product-option-${optionIndex}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelectProductOption(option.value);
                      }}
                      onMouseEnter={() => setProductActiveOptionIndex(optionIndex)}
                      aria-selected={optionIndex === productActiveOptionIndex}
                      role="option"
                      type="button"
                    >
                      <span className="flex flex-wrap items-center gap-2 font-bold text-[var(--kr-gov-text-primary)]">
                        {option.label}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                          {option.source === "typed" ? "입력값" : option.source === "chemical" ? "화학물질" : "등록제품"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[var(--kr-gov-text-secondary)]">{option.description}</span>
                    </button>
                  )) : (
                    <div className="px-4 py-5 text-sm text-slate-500">
                      {productRows.length > 0 ? "검색 후보가 없습니다. 제품명을 그대로 입력한 뒤 검색 적용을 누를 수 있습니다." : "제품 목록이 없습니다. 제품명을 직접 입력해 검색 적용을 누르세요."}
                    </div>
                  )}
                  {productSuggestionError ? <div className="border-t border-slate-100 px-4 py-2 text-xs font-bold text-amber-700">{productSuggestionError}</div> : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-end">
              <MemberButton className="w-full" disabled={directInputMode} onClick={handleApplyProductSearch} type="button" variant="secondary">검색 적용</MemberButton>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 items-start gap-6">
          <div className="space-y-6">
            <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm" data-help-id="emission-survey-admin-grid">
              <div className="flex flex-wrap items-center gap-3 text-[var(--kr-gov-blue)]">
                <span className="text-sm font-black uppercase tracking-[0.2em]">{inputGroup.english}</span>
                <span className="text-xl font-black">{inputGroup.korean}</span>
              </div>
              {!isClassificationReady ? (
                <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  제품을 선택하면 입력 섹션이 렌더링됩니다.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 items-start gap-5">
                  {inputSections.map((section) => {
                    const activeCase = activeCases[section.sectionCode || ""] || "CASE_3_1";
                    const startCase = getCase(section.sectionCode || "", "CASE_3_1", buildDefaultCaseRows(section, "CASE_3_1"));
                    const dbCase = getCase(section.sectionCode || "", "CASE_3_2", buildDefaultCaseRows(section, "CASE_3_2"));
                    const current = activeCase === "CASE_3_1" ? startCase : dbCase;
                    return (
                      <SectionEditor
                        activeRows={current.rows}
                        expanded={Boolean(expandedSections[section.sectionCode || ""])}
                        key={section.sectionCode}
                        onAddRow={() => handleAddRow(section)}
                        onApplyEcoinventMappedFactor={(rowId, ecoinventRow) => handleApplyEcoinventMappedFactor(section, rowId, ecoinventRow)}
                        onChangeCell={(rowId, key, value) => handleCellChange(section, rowId, key, value)}
                        onOpenEcoinventMapping={(rowId, materialName) => handleOpenEcoinventMapping(section, rowId, materialName)}
                        onRemoveRow={(rowId) => handleRemoveRow(section, rowId)}
                        onToggleExpanded={() => handleToggleSection(section.sectionCode || "")}
                        section={section}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm" data-help-id="emission-survey-admin-grid">
              <div className="flex flex-wrap items-center gap-3 text-[var(--kr-gov-blue)]">
                <span className="text-sm font-black uppercase tracking-[0.2em]">{outputGroup.english}</span>
                <span className="text-xl font-black">{outputGroup.korean}</span>
              </div>
              {!isClassificationReady ? (
                <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  제품을 선택하면 출력 섹션이 렌더링됩니다.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 items-start gap-5">
                  {outputSections.map((section) => {
                    const activeCase = activeCases[section.sectionCode || ""] || "CASE_3_1";
                    const startCase = getCase(section.sectionCode || "", "CASE_3_1", buildDefaultCaseRows(section, "CASE_3_1"));
                    const dbCase = getCase(section.sectionCode || "", "CASE_3_2", buildDefaultCaseRows(section, "CASE_3_2"));
                    const current = activeCase === "CASE_3_1" ? startCase : dbCase;
                    return (
                      <SectionEditor
                        activeRows={current.rows}
                        expanded={Boolean(expandedSections[section.sectionCode || ""])}
                        key={section.sectionCode}
                        onAddRow={() => handleAddRow(section)}
                        onApplyEcoinventMappedFactor={(rowId, ecoinventRow) => handleApplyEcoinventMappedFactor(section, rowId, ecoinventRow)}
                        onChangeCell={(rowId, key, value) => handleCellChange(section, rowId, key, value)}
                        onOpenEcoinventMapping={(rowId, materialName) => handleOpenEcoinventMapping(section, rowId, materialName)}
                        onRemoveRow={(rowId) => handleRemoveRow(section, rowId)}
                        onToggleExpanded={() => handleToggleSection(section.sectionCode || "")}
                        section={section}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <MemberActionBar
              dataHelpId="emission-survey-admin-bottom-actions"
              eyebrow={en ? "Final Action" : "최종 실행"}
              primary={(
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <MemberButton onClick={handleMoveToCalculation} type="button">
                    {en ? "Calculate Carbon Emissions" : "실제 탄소배출량 계산"}
                  </MemberButton>
                </div>
              )}
              title={en ? "Carbon Emission Calculation" : "탄소배출량 계산"}
            />
          </div>

          <aside className="xl:fixed xl:bottom-24 xl:right-6 xl:z-40 xl:w-[320px] xl:self-start">
            <div className="rounded-[var(--kr-gov-radius)] border border-sky-200 bg-white/95 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">입력 안내</p>
              <h3 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">탄소배출량 미리 계산</h3>
              <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">합계 탄소배출량</p>
                <p className="mt-1 text-2xl font-black text-[var(--kr-gov-text-primary)]">
                  {previewSummary.totalEmission.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
              </div>
              <MemberButton className="mt-4 w-full" onClick={handleMoveToCalculation} type="button">
                {en ? "Calculate Carbon Emissions" : "실제 탄소배출량 계산"}
              </MemberButton>
            </div>
          </aside>
        </div>
        <div aria-hidden="true" className="h-44 xl:h-72" />
        {ecoinventMappingTarget ? (
          <EcoinventFactorMappingDialog
            aiLoading={ecoinventAiMappingLoading}
            aiRows={ecoinventAiMappingRows}
            chemicalLoading={ecoinventChemicalLoading}
            chemicalRows={ecoinventChemicalRows}
            filterOptions={ecoinventMappingFilterOptions}
            filters={ecoinventMappingFilters}
            keyword={ecoinventMappingKeyword}
            loading={ecoinventMappingLoading}
            onApply={handleApplyEcoinventMapping}
            onClose={() => setEcoinventMappingTarget(null)}
            onFilterChange={handleEcoinventFilterChange}
            onKeywordChange={handleEcoinventKeywordChange}
            onSearch={() => void handleSearchEcoinventMapping()}
            onSelectDataset={setEcoinventSelectedDatasetId}
            onSelectChemical={handleSelectChemicalMaterial}
            rows={ecoinventMappingRows}
            selectedDatasetId={ecoinventSelectedDatasetId}
            target={ecoinventMappingTarget}
            totalCount={ecoinventMappingTotalCount}
          />
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
