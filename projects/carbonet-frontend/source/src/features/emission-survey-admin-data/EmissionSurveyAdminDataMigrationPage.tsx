import { Fragment, useEffect, useRef, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchEmissionGwpValuesPage,
  fetchEmissionSurveyAdminDataPage,
  getEmissionSurveyAdminBlankTemplateDownloadUrl,
  previewEmissionSurveySharedDataset,
  replaceEmissionSurveySharedDatasetSections
} from "../../lib/api/emission";
import type {
  EmissionSurveyAdminDataPagePayload,
  EmissionSurveyAdminRow,
  EmissionSurveyAdminSection
} from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { hasUnitMappingIssue, isMappedUnitValue, normalizeUnitValue, UNIT_OPTIONS } from "../emission-common/unitOptions";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, MemberButton, PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, AdminTextarea } from "../member/common";

type GwpCandidateRow = Record<string, string>;
type FactorType = "ECOINVENT" | "AR4" | "AR5" | "AR6" | "DIRECT";
type ArFactorType = "AR4" | "AR5" | "AR6";
type RowSourceChoice = "UPLOAD" | "DB";
type EditablePreviewRow = EmissionSurveyAdminRow & {
  __clientState?: {
    isNew?: boolean;
    isDeleted?: boolean;
  };
};
type EditablePreviewSection = Omit<EmissionSurveyAdminSection, "rows"> & {
  rows?: EditablePreviewRow[];
};

type MappingTarget = {
  sectionIndex: number;
  rowIndex: number;
  rowId: string;
  materialName: string;
  allowArSelection: boolean;
};

function stringOf(row: Record<string, unknown> | null | undefined, key: string) {
  if (!row) {
    return "";
  }
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeComparableText(value: unknown) {
  return normalizedValue(value).replace(/\s+/g, " ").toLowerCase();
}

function matchesGwpCandidate(row: GwpCandidateRow, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return true;
  }
  return [
    row.commonName,
    row.formula,
    row.sectionLabel,
    row.source,
    row.note,
    row.manualInputValue,
    row.ar4Value,
    row.ar5Value,
    row.ar6Value
  ].some((value) => normalizeText(String(value || "")).includes(normalizedKeyword));
}

function normalizedValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function displayValue(value: unknown) {
  const normalized = normalizedValue(value);
  return normalized === "" ? "-" : normalized;
}

function toNonEmptyStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toNonEmptyStringList(item))
      .filter(Boolean);
  }
  const normalized = normalizedValue(value);
  return normalized ? [normalized] : [];
}

function collectProductNameCandidates(source: Record<string, unknown> | null | undefined) {
  if (!source) {
    return [];
  }
  const candidates = [
    ...toNonEmptyStringList(source.productName),
    ...toNonEmptyStringList(source.productNames),
    ...toNonEmptyStringList(source.selectedProductName),
    ...toNonEmptyStringList(source.outputProduct),
    ...toNonEmptyStringList(source.outputProducts),
    ...toNonEmptyStringList(source.OUTPUT_PRODUCTS)
  ];
  return Array.from(new Set(candidates.map((item) => normalizedValue(item)).filter(Boolean)));
}

function resolvePreviewProductNames(
  previewPayload: Record<string, unknown> | null,
  sections: EditablePreviewSection[]
) {
  const names = new Set<string>();
  collectProductNameCandidates(previewPayload).forEach((name) => names.add(name));

  sections.forEach((section) => {
    collectProductNameCandidates(section as unknown as Record<string, unknown>).forEach((name) => names.add(name));

    ((section.metadata || []) as Array<Record<string, unknown>>).forEach((metadataRow) => {
      const label = normalizeText(stringOf(metadataRow, "label"));
      const value = normalizedValue(metadataRow.value);
      if ((label === "제품명" || label === "product name" || label === "productname") && value) {
        names.add(value);
      }
    });

    ((section.rows || []) as Array<Record<string, unknown>>).forEach((row) => {
      const values = ((row.values || {}) as Record<string, unknown>);
      [
        values.productName,
        values.product,
        values.outputProduct,
        values.outputProducts,
        values.OUTPUT_PRODUCTS
      ].forEach((candidate) => {
        toNonEmptyStringList(candidate).forEach((name) => names.add(name));
      });
    });
  });

  return Array.from(names).filter(Boolean);
}

function normalizeSectionUnits(sections: EmissionSurveyAdminSection[]) {
  return sections.map((section) => ({
    ...section,
    rows: ((section.rows || []) as EmissionSurveyAdminRow[]).map((row) => ({
      ...row,
      values: {
        ...((row.values || {}) as Record<string, string>),
        annualUnit: normalizeUnitValue(String(((row.values || {}) as Record<string, string>).annualUnit || ""))
      }
    }))
  }));
}

function isArFactorType(value: string): value is ArFactorType {
  return value === "AR4" || value === "AR5" || value === "AR6";
}

function mapPriority(row: GwpCandidateRow, keyword: string) {
  const commonName = normalizeText(String(row.commonName || ""));
  const formula = normalizeText(String(row.formula || ""));
  const source = normalizeText(String(row.source || ""));
  const note = normalizeText(String(row.note || ""));
  const normalizedKeyword = normalizeText(keyword);
  if (source.includes("ecoinvent") || note.includes("ecoinvent")) {
    return 0;
  }
  if (commonName === normalizedKeyword) {
    return 1;
  }
  if (formula === normalizedKeyword) {
    return 1;
  }
  if (commonName.includes(normalizedKeyword)) {
    return 2;
  }
  if (formula.includes(normalizedKeyword)) {
    return 2;
  }
  return 3;
}

function filterAndSortGwpCandidates(rows: GwpCandidateRow[], keyword: string) {
  return rows
    .filter((row) => matchesGwpCandidate(row, keyword))
    .slice()
    .sort((left, right) => {
      const priority = mapPriority(left, keyword) - mapPriority(right, keyword);
      if (priority !== 0) {
        return priority;
      }
      return String(left.commonName || "").localeCompare(String(right.commonName || ""));
    });
}

function resolveSearchKeyword(values: Record<string, string>) {
  return normalizedValue(values.gwpMappedName) || normalizedValue(values.materialName);
}

function isAirEmissionSection(section: Record<string, unknown> | EmissionSurveyAdminSection) {
  const sectionCode = normalizeText(stringOf(section as Record<string, unknown>, "sectionCode")).replace(/\s+/g, "");
  const sectionLabel = normalizeText(stringOf(section as Record<string, unknown>, "sectionLabel")).replace(/\s+/g, "");
  return sectionCode === "output_air" || sectionLabel === "대기배출물";
}

function hasMappedValue(values: Record<string, string>) {
  return mappingSummary(values) !== null;
}

function needsMappingAttention(values: Record<string, string>) {
  return Boolean(resolveSearchKeyword(values)) && !hasMappedValue(values);
}

function cloneSections(sections: EmissionSurveyAdminSection[]) {
  return sections.map((section) => ({
    ...section,
    metadata: Array.isArray(section.metadata) ? section.metadata.map((item) => ({ ...item })) : [],
    columns: Array.isArray(section.columns) ? section.columns.map((column) => ({ ...column })) : [],
    rows: Array.isArray(section.rows)
      ? section.rows.map((row) => ({
          ...row,
          values: { ...((row.values || {}) as Record<string, string>) }
        }))
      : []
  }));
}

function rowClientState(row: Record<string, unknown> | EditablePreviewRow | EmissionSurveyAdminRow) {
  return (((row as EditablePreviewRow).__clientState || {}) as { isNew?: boolean; isDeleted?: boolean; });
}

function resolveFactorValue(candidate: GwpCandidateRow | null, factorType: FactorType, directValue: string) {
  if (factorType === "DIRECT") {
    return directValue.trim();
  }
  if (!candidate) {
    return "";
  }
  if (factorType === "ECOINVENT") {
    return normalizedValue(candidate.manualInputValue);
  }
  if (factorType === "AR4") {
    return normalizedValue(candidate.ar4Value);
  }
  if (factorType === "AR5") {
    return normalizedValue(candidate.ar5Value);
  }
  return normalizedValue(candidate.ar6Value);
}

function resolveStoredFactorValue(values: Record<string, string>, factorType: ArFactorType) {
  if (factorType === "AR4") {
    return normalizedValue(values.gwpAr4Value);
  }
  if (factorType === "AR5") {
    return normalizedValue(values.gwpAr5Value);
  }
  return normalizedValue(values.gwpAr6Value);
}

function resolveStoredEmissionFactor(values: Record<string, string>) {
  return normalizedValue(values.emissionFactor)
    || normalizedValue(values.gwpValue)
    || normalizedValue(values.gwpDirectValue)
    || normalizedValue(values.gwpReferenceValue);
}

function factorLabel(factorType: string) {
  if (factorType === "ECOINVENT") {
    return "Ecoinvent";
  }
  if (factorType === "AR4" || factorType === "AR5" || factorType === "AR6") {
    return factorType;
  }
  if (factorType === "DIRECT") {
    return "직접입력";
  }
  return factorType || "-";
}

function mappingSummary(values: Record<string, string>) {
  const mappedName = normalizedValue(values.gwpMappedName);
  const factorType = normalizedValue(values.gwpValueType);
  const factorValue = normalizedValue(values.gwpValue);
  if (!mappedName && !factorType && !factorValue) {
    return null;
  }
  return {
    mappedName: mappedName || "-",
    factorType: factorLabel(factorType),
    factorValue: factorValue || "-"
  };
}

function applyMappedValues(values: Record<string, string>, candidate: GwpCandidateRow, factorType: FactorType, directValue: string) {
  const factorValue = resolveFactorValue(candidate, factorType, directValue);
  return {
    ...values,
    emissionFactor: factorValue,
    gwpMappedRowId: normalizedValue(candidate.rowId),
    gwpMappedName: normalizedValue(candidate.commonName),
    gwpMappedSource: normalizedValue(candidate.source),
    gwpValueType: factorType,
    gwpValue: factorValue,
    gwpDirectValue: factorType === "DIRECT" ? directValue.trim() : "",
    gwpReferenceValue: factorType === "ECOINVENT" ? normalizedValue(candidate.manualInputValue) : "",
    gwpAr4Value: normalizedValue(candidate.ar4Value),
    gwpAr5Value: normalizedValue(candidate.ar5Value),
    gwpAr6Value: normalizedValue(candidate.ar6Value)
  };
}

function applyAutoEcoinventMapping(values: Record<string, string>, candidate: GwpCandidateRow | null) {
  if (!candidate || !normalizedValue(candidate.manualInputValue)) {
    return values;
  }
  return applyMappedValues(values, candidate, "ECOINVENT", "");
}

const VISIBLE_COLUMN_KEYS = ["group", "materialName", "annualUnit", "remark"] as const;
const BASE_ALLOWED_VALUE_KEYS = ["group", "materialName", "annualUnit", "remark"] as const;
const GWP_ALLOWED_VALUE_KEYS = [
  "emissionFactor",
  "gwpMappedRowId",
  "gwpMappedName",
  "gwpMappedSource",
  "gwpValueType",
  "gwpValue",
  "gwpDirectValue",
  "gwpReferenceValue",
  "gwpAr4Value",
  "gwpAr5Value",
  "gwpAr6Value"
] as const;

const VISIBLE_COLUMN_LABELS: Record<(typeof VISIBLE_COLUMN_KEYS)[number], string> = {
  group: "구분",
  materialName: "물질명",
  annualUnit: "단위(연간)",
  remark: "비고"
};

function sanitizeRowValues(section: Record<string, unknown> | EmissionSurveyAdminSection, values: Record<string, string>) {
  const allowedKeys = isAirEmissionSection(section)
    ? [...BASE_ALLOWED_VALUE_KEYS, ...GWP_ALLOWED_VALUE_KEYS]
    : [...BASE_ALLOWED_VALUE_KEYS];
  const nextValues: Record<string, string> = {};
  allowedKeys.forEach((key) => {
    nextValues[key] = String(values[key] || "");
  });
  nextValues.annualUnit = normalizeUnitValue(String(nextValues.annualUnit || ""));
  if (isAirEmissionSection(section)) {
    nextValues.emissionFactor = resolveStoredEmissionFactor(nextValues);
  }
  return nextValues;
}

function isMeaningfullyEmptyRow(section: Record<string, unknown> | EmissionSurveyAdminSection, row: Record<string, unknown> | EmissionSurveyAdminRow) {
  const values = sanitizeRowValues(section, (((row as Record<string, unknown>).values || {}) as Record<string, string>));
  return Object.values(values).every((value) => !normalizedValue(value));
}

function createPaddedPreviewRow(
  section: Record<string, unknown> | EmissionSurveyAdminSection,
  existingRow?: Record<string, unknown> | EmissionSurveyAdminRow | null
) {
  return {
    rowId: stringOf((existingRow || {}) as Record<string, unknown>, "rowId") || `PADDED_ROW_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    values: sanitizeRowValues(section, {})
  } satisfies EditablePreviewRow;
}

function sanitizeSectionForSave(section: EmissionSurveyAdminSection) {
  const columns = VISIBLE_COLUMN_KEYS.map((columnKey) => {
    const matchedColumn = ((section.columns || []) as Array<Record<string, unknown>>)
      .find((column) => stringOf(column, "key") === columnKey);
    return {
      key: columnKey,
      label: matchedColumn ? stringOf(matchedColumn, "label") || VISIBLE_COLUMN_LABELS[columnKey] : VISIBLE_COLUMN_LABELS[columnKey]
    };
  });
  return {
    ...section,
    columns,
    rows: ((section.rows || []) as EditablePreviewRow[]).map((row) => ({
      rowId: row.rowId,
      values: sanitizeRowValues(section, (row.values || {}) as Record<string, string>)
    }))
  };
}

function rowSelectionKey(sectionCode: string, rowId: string) {
  return `${sectionCode}::${rowId}`;
}

function resolveExistingSection(sectionCode: string, existingSections: Array<Record<string, unknown>>) {
  return existingSections.find((section) => stringOf(section, "sectionCode") === sectionCode) || null;
}

function findMatchingExistingRow(
  section: Record<string, unknown> | EmissionSurveyAdminSection,
  row: Record<string, unknown> | EmissionSurveyAdminRow,
  existingSections: Array<Record<string, unknown>>
) {
  const sectionCode = stringOf(section as Record<string, unknown>, "sectionCode");
  const existingSection = resolveExistingSection(sectionCode, existingSections);
  if (!existingSection) {
    return null;
  }
  const existingRows = ((existingSection.rows || []) as Array<Record<string, unknown>>);
  const rowId = stringOf(row as Record<string, unknown>, "rowId");
  const matchedByRowId = existingRows.find((candidate) => stringOf(candidate, "rowId") === rowId);
  if (matchedByRowId) {
    return matchedByRowId;
  }
  const values = (((row as Record<string, unknown>).values || {}) as Record<string, string>);
  const group = normalizeComparableText(values.group);
  const materialName = normalizeComparableText(values.materialName);
  if (!group && !materialName) {
    return null;
  }
  return existingRows.find((candidate) => {
    const candidateValues = ((candidate.values || {}) as Record<string, string>);
    return normalizeComparableText(candidateValues.group) === group
      && normalizeComparableText(candidateValues.materialName) === materialName;
  }) || null;
}

function buildSectionsForApply(
  sections: EditablePreviewSection[],
  existingSections: Array<Record<string, unknown>>,
  rowSourceSelections: Record<string, RowSourceChoice>
) {
  return sections.map((section) => {
    const sectionCode = stringOf(section as Record<string, unknown>, "sectionCode");
    return {
      ...section,
      rows: ((section.rows || []) as EditablePreviewRow[])
        .filter((row) => !rowClientState(row).isDeleted)
        .map((row) => {
          const selection = rowSourceSelections[rowSelectionKey(sectionCode, String(row.rowId || ""))] || "UPLOAD";
          if (selection !== "DB") {
            return row;
          }
          const matchedExistingRow = findMatchingExistingRow(section, row, existingSections);
          if (!matchedExistingRow) {
            return row;
          }
          return {
            ...row,
            values: { ...(((matchedExistingRow.values || {}) as Record<string, string>)) }
          };
        })
        .filter((row) => !isMeaningfullyEmptyRow(section, row))
    };
  });
}

function padPreviewSectionsWithExistingRows(
  sections: EditablePreviewSection[],
  existingSections: Array<Record<string, unknown>>
) {
  return sections.map((section) => {
    const sectionCode = stringOf(section as Record<string, unknown>, "sectionCode");
    const existingSection = resolveExistingSection(sectionCode, existingSections);
    const existingRows = ((existingSection?.rows || []) as Array<Record<string, unknown>>);
    const previewRows = ((section.rows || []) as EditablePreviewRow[]).slice();
    if (existingRows.length <= previewRows.length) {
      return section;
    }
    const paddedRows = previewRows.slice();
    for (let index = previewRows.length; index < existingRows.length; index += 1) {
      paddedRows.push(createPaddedPreviewRow(section, existingRows[index]));
    }
    return {
      ...section,
      rows: paddedRows
    };
  });
}

function describeRowValues(
  section: Record<string, unknown> | EmissionSurveyAdminSection,
  values: Record<string, string>
) {
  const items = VISIBLE_COLUMN_KEYS.map((columnKey) => ({
    label: VISIBLE_COLUMN_LABELS[columnKey],
    value: displayValue(values[columnKey])
  }));
  if (isAirEmissionSection(section)) {
    items.push({
      label: "배출계수",
      value: displayValue(resolveStoredEmissionFactor(values))
    });
  }
  return items;
}

function renderSectionTable(
  section: Record<string, unknown> | EmissionSurveyAdminSection,
  key: string,
  options?: {
    editable?: boolean;
    sectionIndex?: number;
    onOpenMapping?: (sectionIndex: number, rowIndex: number, row: EmissionSurveyAdminRow) => void;
    onChangeValue?: (sectionIndex: number, rowIndex: number, rowId: string, columnKey: string, value: string) => void;
    onAddRow?: (sectionIndex: number) => void;
    onDeleteRow?: (sectionIndex: number, rowIndex: number, rowId: string) => void;
    existingSections?: Array<Record<string, unknown>>;
    rowSourceSelections?: Record<string, RowSourceChoice>;
    onSelectRowSource?: (sectionCode: string, rowId: string, source: RowSourceChoice) => void;
  }
) {
  const rows = ((section.rows || []) as EditablePreviewRow[]);
  const columns = ((section.columns || []) as Array<Record<string, unknown>>);
  const metadata = ((section.metadata || []) as Array<Record<string, unknown>>).filter(
    (item) => stringOf(item, "label") || stringOf(item, "value")
  );
  const editable = Boolean(options?.editable);
  const showGwpMapping = editable && isAirEmissionSection(section);
  const existingSections = options?.existingSections || [];
  const deletedRows = rows.filter((row) => rowClientState(row).isDeleted).length;
  const visibleColumns = VISIBLE_COLUMN_KEYS.map((columnKey) => {
    const matchedColumn = columns.find((column) => stringOf(column, "key") === columnKey);
    return {
      key: columnKey,
      label: matchedColumn ? stringOf(matchedColumn, "label") || VISIBLE_COLUMN_LABELS[columnKey] : VISIBLE_COLUMN_LABELS[columnKey]
    };
  });
  const comparisonColSpan = 1 + visibleColumns.length + (showGwpMapping ? 1 : 0) + (editable ? 1 : 0);
  return (
    <article className="gov-card overflow-hidden" key={key}>
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{stringOf(section as Record<string, unknown>, "majorCode") || "-"}</p>
            <h3 className="mt-1 text-lg font-bold text-[var(--kr-gov-text-primary)]">{stringOf(section as Record<string, unknown>, "sectionLabel") || stringOf(section as Record<string, unknown>, "sectionCode") || "-"}</h3>
            <p className="mt-1 text-sm text-gray-500">행 수 {rows.length - deletedRows} / 삭제예정 {deletedRows} / 컬럼 {columns.length} / 저장 {stringOf(section as Record<string, unknown>, "savedAt") || "-"}</p>
          </div>
          <div className="flex items-center gap-2">
            {editable ? (
              <MemberButton onClick={() => options?.onAddRow?.(options.sectionIndex || 0)} size="sm" type="button" variant="secondary">
                행 추가
              </MemberButton>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{stringOf(section as Record<string, unknown>, "caseCode") || "CASE_3_1"}</span>
          </div>
        </div>
      </div>
      {metadata.length ? (
        <div className="flex flex-wrap gap-2 border-b border-[var(--kr-gov-border-light)] px-6 py-4">
          {metadata.map((item, index) => (
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-800" key={`${key}-metadata-${index}`}>
              <span className="font-bold">{stringOf(item, "label") || "-"}</span>
              <span className="ml-1">{displayValue(stringOf(item, "value"))}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <AdminTable>
          <thead>
            <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
              <th className="px-6 py-4 text-center w-16">번호</th>
              {visibleColumns.map((column) => (
                <th className="px-6 py-4" key={column.key}>{column.label}</th>
              ))}
              {showGwpMapping ? <th className="px-6 py-4">배출계수 매핑</th> : null}
              {editable ? <th className="px-6 py-4 text-center w-28">상태</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, index) => {
              const values = ((row.values || {}) as Record<string, string>);
              const clientState = rowClientState(row);
              const isNewRow = Boolean(clientState.isNew);
              const isDeletedRow = Boolean(clientState.isDeleted);
              const summary = mappingSummary(values);
              const requiresAttention = showGwpMapping && needsMappingAttention(values);
              const rowId = String(row.rowId || "");
              const sectionCode = stringOf(section as Record<string, unknown>, "sectionCode");
              const matchedExistingRow = editable && !isNewRow ? findMatchingExistingRow(section, row as EmissionSurveyAdminRow, existingSections) : null;
              const selectedSource = options?.rowSourceSelections?.[rowSelectionKey(sectionCode, rowId)] || "UPLOAD";
              const annualUnitValue = String(values.annualUnit || "");
              const hasAnnualUnitIssue = hasUnitMappingIssue(annualUnitValue);
              const isIncomplete = !isDeletedRow && (visibleColumns.some((column) => !normalizedValue(values[column.key])) || hasAnnualUnitIssue || requiresAttention);
              const uploadValueSummary = describeRowValues(section, values);
              const existingValueSummary = matchedExistingRow
                ? describeRowValues(section, ((matchedExistingRow.values || {}) as Record<string, string>))
                : [];
              return (
                <Fragment key={`${key}-${index}`}>
                  <tr className={`hover:bg-gray-50/50 transition-colors ${isDeletedRow ? "bg-rose-50/60 opacity-75" : selectedSource === "DB" ? "bg-sky-50/60" : isIncomplete ? "bg-amber-50/40" : isNewRow ? "bg-emerald-50/40" : ""}`} key={`${key}-${index}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{index + 1}</td>
                    {visibleColumns.map((column) => (
                      <td className="px-6 py-4 align-top" key={`${key}-${index}-${column.key}`}>
                        {editable ? (
                          column.key === "annualUnit" ? (
                            <AdminSelect
                              className={
                                isDeletedRow
                                  ? "border-rose-200 bg-rose-50 text-rose-700 opacity-70"
                                  : hasAnnualUnitIssue
                                  ? "border-pink-400 bg-pink-50 text-pink-800"
                                  : !normalizedValue(values[column.key])
                                    ? "border-amber-300 bg-amber-50"
                                    : ""
                              }
                              disabled={isDeletedRow}
                              onChange={(event) => options?.onChangeValue?.(options.sectionIndex || 0, index, rowId, column.key, event.target.value)}
                              value={normalizeUnitValue(String(values[column.key] || ""))}
                            >
                              <option value="">단위를 선택하세요</option>
                              {hasAnnualUnitIssue ? (
                                <option value={normalizeUnitValue(annualUnitValue)}>
                                  매핑 필요: {normalizeUnitValue(annualUnitValue)}
                                </option>
                              ) : null}
                              {UNIT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </AdminSelect>
                          ) : column.key === "remark" ? (
                            <AdminTextarea
                              className={
                                isDeletedRow
                                  ? "border-rose-200 bg-rose-50 text-rose-700 opacity-70"
                                  : !normalizedValue(values[column.key]) ? "border-amber-300 bg-amber-50" : ""
                              }
                              disabled={isDeletedRow}
                              onChange={(event) => options?.onChangeValue?.(options.sectionIndex || 0, index, rowId, column.key, event.target.value)}
                              rows={3}
                              value={String(values[column.key] || "")}
                            />
                          ) : (
                            <AdminInput
                              className={
                                isDeletedRow
                                  ? "border-rose-200 bg-rose-50 text-rose-700 opacity-70"
                                  : !normalizedValue(values[column.key]) ? "border-amber-300 bg-amber-50" : ""
                              }
                              disabled={isDeletedRow}
                              onChange={(event) => options?.onChangeValue?.(options.sectionIndex || 0, index, rowId, column.key, event.target.value)}
                              value={String(values[column.key] || "")}
                            />
                          )
                        ) : (
                          column.key === "annualUnit" && hasAnnualUnitIssue ? `매핑 필요: ${normalizeUnitValue(annualUnitValue)}` : displayValue(values[column.key])
                        )}
                      </td>
                    ))}
                    {showGwpMapping ? (
                      <td className="min-w-[240px] px-6 py-4 align-top">
                        <div className="space-y-2">
                          {summary ? (
                            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] text-emerald-800">
                              <div className="font-bold">{summary.mappedName}</div>
                              <div>{summary.factorType} / {summary.factorValue}</div>
                            </div>
                          ) : (
                            <div className={`rounded border px-2 py-2 text-[11px] ${requiresAttention ? "border-rose-200 bg-rose-50 text-rose-700" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"}`}>
                              {requiresAttention ? "Ecoinvent 자동 매핑 값이 없습니다. 팝업에서 직접 지정하세요." : "아직 매핑되지 않았습니다."}
                            </div>
                          )}
                          <MemberButton
                            disabled={isDeletedRow}
                            onClick={() => options?.onOpenMapping?.(options.sectionIndex || 0, index, row as EmissionSurveyAdminRow)}
                            size="sm"
                            type="button"
                            variant={requiresAttention ? "primary" : "secondary"}
                          >
                            {summary ? "매핑 수정" : "매핑"}
                          </MemberButton>
                        </div>
                      </td>
                    ) : null}
                    {editable ? (
                      <td className="px-6 py-4 text-center align-top">
                        <div className="space-y-2">
                          <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${isDeletedRow ? "bg-rose-100 text-rose-800" : isNewRow ? "bg-emerald-100 text-emerald-700" : isIncomplete ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                            {isDeletedRow ? "삭제예정" : isNewRow ? "신규" : isIncomplete ? "보정 필요" : "완료"}
                          </span>
                          {matchedExistingRow ? (
                            <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${selectedSource === "DB" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}`}>
                              {selectedSource === "DB" ? "DB 사용" : "업로드 사용"}
                            </span>
                          ) : null}
                          {editable ? (
                            <MemberButton
                              onClick={() => options?.onDeleteRow?.(options.sectionIndex || 0, index, rowId)}
                              size="sm"
                              type="button"
                              variant={isDeletedRow ? "secondary" : "secondary"}
                            >
                              {isDeletedRow ? "삭제 취소" : isNewRow ? "행 제거" : "행 삭제"}
                            </MemberButton>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {editable && matchedExistingRow && !isDeletedRow ? (
                    <tr className="bg-slate-50/80">
                      <td className="px-6 py-4" colSpan={comparisonColSpan}>
                        <div className="grid gap-3 xl:grid-cols-[1fr,1fr,240px]">
                          <div className="rounded border border-violet-200 bg-white px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">현재 업로드 값</p>
                            <div className="mt-2 grid gap-1 text-sm text-slate-700">
                              {uploadValueSummary.map((item) => (
                                <div className="flex justify-between gap-3" key={`${key}-${index}-upload-${item.label}`}>
                                  <span className="font-semibold text-slate-500">{item.label}</span>
                                  <span className="text-right">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded border border-sky-200 bg-sky-50/70 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-sky-700">DB 저장 값</p>
                            <div className="mt-2 grid gap-1 text-sm text-slate-700">
                              {existingValueSummary.map((item) => (
                                <div className="flex justify-between gap-3" key={`${key}-${index}-existing-${item.label}`}>
                                  <span className="font-semibold text-slate-500">{item.label}</span>
                                  <span className="text-right">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">반영 기준</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              <label className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 ${selectedSource === "UPLOAD" ? "border-violet-300 bg-violet-50" : "border-slate-200"}`}>
                                <input
                                  checked={selectedSource === "UPLOAD"}
                                  name={`${key}-${index}-source`}
                                  onChange={() => options?.onSelectRowSource?.(sectionCode, rowId, "UPLOAD")}
                                  type="radio"
                                />
                                <span>새로 입력한 행 데이터를 사용</span>
                              </label>
                              <label className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 ${selectedSource === "DB" ? "border-sky-300 bg-sky-50" : "border-slate-200"}`}>
                                <input
                                  checked={selectedSource === "DB"}
                                  name={`${key}-${index}-source`}
                                  onChange={() => options?.onSelectRowSource?.(sectionCode, rowId, "DB")}
                                  type="radio"
                                />
                                <span>기존 DB 저장값을 유지</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-center text-slate-500" colSpan={Math.max(visibleColumns.length + (showGwpMapping ? 2 : 1) + (editable ? 1 : 0), 2)}>데이터 행이 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminTable>
      </div>
    </article>
  );
}

function GwpMappingModal({
  target,
  searchKeyword,
  onSearchKeywordChange,
  rows,
  selectedCandidateId,
  onSelectCandidate,
  allowArSelection,
  datasetArVersion,
  onDatasetArVersionChange,
  factorType,
  onFactorTypeChange,
  directValue,
  onDirectValueChange,
  onSearch,
  loading,
  onClose,
  onApply
}: {
  target: MappingTarget;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  rows: GwpCandidateRow[];
  selectedCandidateId: string;
  onSelectCandidate: (rowId: string) => void;
  allowArSelection: boolean;
  datasetArVersion: ArFactorType;
  onDatasetArVersionChange: (value: ArFactorType) => void;
  factorType: FactorType;
  onFactorTypeChange: (value: FactorType) => void;
  directValue: string;
  onDirectValueChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const selectedCandidate = rows.find((row) => String(row.rowId || "") === selectedCandidateId) || null;
  const ecoinventValue = normalizedValue(selectedCandidate?.manualInputValue);
  const datasetArPreview = displayValue(
    datasetArVersion === "AR4"
      ? selectedCandidate?.ar4Value
      : datasetArVersion === "AR5"
        ? selectedCandidate?.ar5Value
        : selectedCandidate?.ar6Value
  );
  const factorOptions: Array<{ value: FactorType; label: string; preview: string; disabled?: boolean }> = [
    { value: "ECOINVENT", label: "Ecoinvent", preview: ecoinventValue || "임의 입력값 없음", disabled: !ecoinventValue },
    ...(allowArSelection ? [{ value: datasetArVersion, label: `공통 AR 버전 (${datasetArVersion})`, preview: datasetArPreview }] : []),
    { value: "DIRECT", label: "직접입력", preview: directValue.trim() || "-" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[var(--kr-gov-radius)] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">배출계수 매핑</h3>
            <p className="mt-1 text-sm text-slate-500">대상 물질: {target.materialName || "-"}</p>
          </div>
          <MemberButton onClick={onClose} size="sm" type="button" variant="secondary">닫기</MemberButton>
        </div>
        <div className="grid gap-4 overflow-y-auto px-5 py-5 lg:grid-cols-[1.4fr,1fr]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr,120px]">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">물질 검색</span>
                <AdminInput
                  value={searchKeyword}
                  onChange={(event) => onSearchKeywordChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSearch();
                    }
                  }}
                />
              </label>
              <div className="flex items-end">
                <MemberButton onClick={onSearch} type="button" variant="primary">{loading ? "검색 중..." : "검색"}</MemberButton>
              </div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200">
              <div className="grid grid-cols-[120px,1.2fr,0.8fr,0.7fr,0.7fr,0.7fr,80px] border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                <div className="px-3 py-2">우선순위</div>
                <div className="px-3 py-2">물질</div>
                <div className="px-3 py-2">Ecoinvent</div>
                <div className="px-3 py-2">AR4</div>
                <div className="px-3 py-2">AR5</div>
                <div className="px-3 py-2">AR6</div>
                <div className="px-3 py-2 text-center">선택</div>
              </div>
              <div className="max-h-[48vh] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-slate-500">검색 결과가 없습니다.</div>
                ) : (
                  rows.map((row) => {
                    const selected = String(row.rowId || "") === selectedCandidateId;
                    return (
                      <div className={`grid grid-cols-[120px,1.2fr,0.8fr,0.7fr,0.7fr,0.7fr,80px] border-b border-slate-100 text-sm ${selected ? "bg-blue-50/70" : ""}`} key={String(row.rowId || row.commonName || Math.random())}>
                        <div className="px-3 py-3 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                          {mapPriority(row, searchKeyword) === 0 ? "1순위 Ecoinvent" : mapPriority(row, searchKeyword) === 1 ? "정확 일치" : "후보"}
                        </div>
                        <div className="px-3 py-3">
                          <p className="font-bold text-slate-900">{displayValue(row.commonName)}</p>
                          <p className="mt-1 text-xs text-slate-500">{displayValue(row.note)}</p>
                        </div>
                        <div className="px-3 py-3 font-mono text-xs text-slate-600">{displayValue(row.manualInputValue)}</div>
                        <div className="px-3 py-3">{displayValue(row.ar4Value)}</div>
                        <div className="px-3 py-3">{displayValue(row.ar5Value)}</div>
                        <div className="px-3 py-3">{displayValue(row.ar6Value)}</div>
                        <div className="flex items-center justify-center px-3 py-3">
                          <MemberButton onClick={() => onSelectCandidate(String(row.rowId || ""))} size="sm" type="button" variant={selected ? "primary" : "secondary"}>선택</MemberButton>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">선택된 물질</p>
              <p className="mt-2 text-base font-black text-[var(--kr-gov-text-primary)]">{selectedCandidate ? displayValue(selectedCandidate.commonName) : "먼저 물질을 선택하세요."}</p>
              {selectedCandidate ? (
                <p className="mt-2 text-xs text-slate-500">출처: {displayValue(selectedCandidate.source)} / 임의값: {displayValue(selectedCandidate.manualInputValue)}</p>
              ) : null}
            </div>

            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-800">배출계수 선택</p>
              {allowArSelection ? (
                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">대기 배출물 공통 AR 버전</span>
                  <AdminSelect onChange={(event) => onDatasetArVersionChange(event.target.value as ArFactorType)} value={datasetArVersion}>
                    <option value="AR4">AR4</option>
                    <option value="AR5">AR5</option>
                    <option value="AR6">AR6</option>
                  </AdminSelect>
                </label>
              ) : null}
              <div className="mt-3 space-y-2">
                {factorOptions.map((option) => (
                  <label className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-3 ${factorType === option.value ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`} key={option.value}>
                    <input
                      checked={factorType === option.value}
                      disabled={option.disabled}
                      name="gwp-factor-type"
                      onChange={() => onFactorTypeChange(option.value)}
                      type="radio"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                      <span className="block text-xs text-slate-500">{option.preview}</span>
                    </span>
                  </label>
                ))}
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">직접 입력값</span>
                <AdminInput value={directValue} onChange={(event) => onDirectValueChange(event.target.value)} />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <MemberButton onClick={onClose} type="button" variant="secondary">취소</MemberButton>
              <MemberButton onClick={onApply} type="button" variant="primary">이 행에 적용</MemberButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function EmissionSurveyAdminDataMigrationPage() {
  const en = isEnglish();
  const pageTitle = en ? "Shared Dataset Excel Apply" : "공통 데이터셋 엑셀 반영";
  const pageSubtitle = en
    ? "Upload a workbook, map emission factors, and then replace the shared dataset."
    : "엑셀 파일을 업로드하고 배출계수 매핑까지 확정한 뒤 공통 데이터셋에 반영합니다.";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewPayload, setPreviewPayload] = useState<Record<string, unknown> | null>(null);
  const [editablePreviewSections, setEditablePreviewSections] = useState<EditablePreviewSection[]>([]);
  const [rowSourceSelections, setRowSourceSelections] = useState<Record<string, RowSourceChoice>>({});
  const [mappingTarget, setMappingTarget] = useState<MappingTarget | null>(null);
  const [mappingSearchKeyword, setMappingSearchKeyword] = useState("");
  const [mappingRows, setMappingRows] = useState<GwpCandidateRow[]>([]);
  const [gwpCatalogRows, setGwpCatalogRows] = useState<GwpCandidateRow[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [datasetArVersion, setDatasetArVersion] = useState<ArFactorType>("AR6");
  const [factorType, setFactorType] = useState<FactorType>("ECOINVENT");
  const [directValue, setDirectValue] = useState("");
  const newRowSequenceRef = useRef(0);

  const pageState = useAsyncValue<EmissionSurveyAdminDataPagePayload>(
    () => fetchEmissionSurveyAdminDataPage({}),
    []
  );
  const page = pageState.value || null;
  const previewExistingSections = ((previewPayload?.existingDatasetSectionRows || []) as Array<Record<string, unknown>>);
  const existingSections = previewPayload ? previewExistingSections : [];
  const previewMessage = stringOf((previewPayload || {}) as Record<string, unknown>, "previewMessage");
  const previewProductNames = resolvePreviewProductNames(previewPayload, editablePreviewSections);
  const previewProductTitle = previewProductNames.join(" / ");

  async function autoMapSectionsWithEcoinvent(sections: EditablePreviewSection[]) {
    const searchKeywords = Array.from(
      new Set(
        sections.flatMap((section) =>
          ((section.rows || []) as EmissionSurveyAdminRow[])
            .map((row) => resolveSearchKeyword((row.values || {}) as Record<string, string>))
            .filter(Boolean)
        )
      )
    );
    const results = await Promise.allSettled(
      searchKeywords.map(async (keyword) => {
        const payload = await fetchEmissionGwpValuesPage({ searchKeyword: keyword });
        const rows = (((payload.gwpRows || []) as Array<Record<string, string>>))
          .slice()
          .sort((left, right) => mapPriority(left, keyword) - mapPriority(right, keyword));
        const candidate = rows.find((row) => normalizedValue(row.manualInputValue)) || null;
        return [keyword, candidate] as const;
      })
    );
    const candidateMap = new Map<string, GwpCandidateRow | null>();
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        candidateMap.set(result.value[0], result.value[1]);
      }
    });
    return sections.map((section) => ({
      ...section,
      rows: ((section.rows || []) as EmissionSurveyAdminRow[]).map((row) => {
        const values = { ...((row.values || {}) as Record<string, string>) };
        const candidate = candidateMap.get(resolveSearchKeyword(values)) || null;
        return {
          ...row,
          values: sanitizeRowValues(section, applyAutoEcoinventMapping(values, candidate))
        };
      })
    }));
  }

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-survey-admin-data", {
      language: en ? "en" : "ko",
      existingSectionCount: existingSections.length,
      previewSectionCount: editablePreviewSections.length
    });
  }, [en, existingSections.length, editablePreviewSections.length]);

  useEffect(() => {
    setEditablePreviewSections((current) => current.map((section) => ({
      ...section,
      rows: ((section.rows || []) as EmissionSurveyAdminRow[]).map((row) => {
        const values = { ...((row.values || {}) as Record<string, string>) };
        const currentType = normalizedValue(values.gwpValueType);
        if (!isArFactorType(currentType)) {
          return row;
        }
        return {
          ...row,
          values: sanitizeRowValues(section, {
            ...values,
            gwpValueType: datasetArVersion,
            gwpValue: resolveStoredFactorValue(values, datasetArVersion)
          })
        };
      })
    })));
  }, [datasetArVersion]);

  function handlePreviewValueChange(sectionIndex: number, rowIndex: number, rowId: string, columnKey: string, value: string) {
    const nextValue = columnKey === "annualUnit" ? normalizeUnitValue(value) : value;
    setEditablePreviewSections((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) {
        return section;
      }
      return {
        ...section,
        rows: ((section.rows || []) as EditablePreviewRow[]).map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex || String(row.rowId || "") !== rowId) {
            return row;
          }
          return {
            ...row,
            values: sanitizeRowValues(section, {
              ...((row.values || {}) as Record<string, string>),
              [columnKey]: nextValue
            })
          };
        })
      };
    }));
  }

  function createEditableRow(section: EditablePreviewSection) {
    newRowSequenceRef.current += 1;
    const rowId = `NEW_ROW_${Date.now()}_${newRowSequenceRef.current}`;
    const values: Record<string, string> = {};
    [...BASE_ALLOWED_VALUE_KEYS, ...(isAirEmissionSection(section) ? GWP_ALLOWED_VALUE_KEYS : [])].forEach((key) => {
      values[key] = "";
    });
    return {
      rowId,
      values: sanitizeRowValues(section, values),
      __clientState: { isNew: true, isDeleted: false }
    } satisfies EditablePreviewRow;
  }

  function handleAddPreviewRow(sectionIndex: number) {
    setEditablePreviewSections((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) {
        return section;
      }
      return {
        ...section,
        rows: [...((section.rows || []) as EditablePreviewRow[]), createEditableRow(section)]
      };
    }));
  }

  function handleDeletePreviewRow(sectionIndex: number, rowIndex: number, rowId: string) {
    const sectionCode = stringOf(editablePreviewSections[sectionIndex] as Record<string, unknown>, "sectionCode");
    setEditablePreviewSections((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) {
        return section;
      }
      const nextRows = ((section.rows || []) as EditablePreviewRow[]).flatMap((row, currentRowIndex) => {
        if (currentRowIndex !== rowIndex || String(row.rowId || "") !== rowId) {
          return [row];
        }
        const clientState = rowClientState(row);
        if (clientState.isNew) {
          return [];
        }
        return [{
          ...row,
          __clientState: {
            ...clientState,
            isDeleted: !clientState.isDeleted
          }
        }];
      });
      return {
        ...section,
        rows: nextRows
      };
    }));
    setRowSourceSelections((current) => {
      const next = { ...current };
      delete next[rowSelectionKey(sectionCode, rowId)];
      return next;
    });
  }

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }
    setUploading(true);
    setMessage("");
    setErrorMessage("");
    try {
      const payload = await previewEmissionSurveySharedDataset(nextFile);
      const previewSections = cloneSections(((payload.sections || []) as EmissionSurveyAdminSection[])) as EditablePreviewSection[];
      const existingSections = ((payload.existingDatasetSectionRows || []) as Array<Record<string, unknown>>);
      const autoMappedSections = normalizeSectionUnits(await autoMapSectionsWithEcoinvent(previewSections));
      const paddedSections = padPreviewSectionsWithExistingRows(autoMappedSections, existingSections);
      const totalRows = paddedSections.reduce((sum, section) => sum + (((section.rows || []) as EmissionSurveyAdminRow[]).length), 0);
      const unmappedRows = paddedSections.reduce(
        (sum, section) =>
          sum + (((section.rows || []) as EmissionSurveyAdminRow[]).filter((row) => needsMappingAttention((row.values || {}) as Record<string, string>)).length),
        0
      );
      setUploadedFile(nextFile);
      setPreviewPayload(payload as Record<string, unknown>);
      setEditablePreviewSections(paddedSections);
      setRowSourceSelections({});
      setDatasetArVersion("AR6");
      setMessage(
        stringOf((payload as Record<string, unknown>), "previewMessage")
          || `관리자 업로드 양식 미리보기를 불러왔습니다. ${Math.max(totalRows - unmappedRows, 0)}행은 Ecoinvent로 자동 매핑했고, ${unmappedRows}행은 추가 확인이 필요합니다.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "관리자 업로드 양식 미리보기에 실패했습니다.");
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleApplyUploadedFile() {
    if (!uploadedFile || !previewPayload || editablePreviewSections.length === 0) {
      setErrorMessage("먼저 관리자 업로드 양식을 업로드하세요.");
      return;
    }
    const sectionsToApply = buildSectionsForApply(editablePreviewSections, previewExistingSections, rowSourceSelections);
    for (const section of sectionsToApply) {
      const sectionLabel = String(section.sectionLabel || section.sectionCode || "섹션");
      const rows = ((section.rows || []) as EmissionSurveyAdminRow[]);
      for (let index = 0; index < rows.length; index += 1) {
        const values = ((rows[index].values || {}) as Record<string, string>);
        const unitValue = String(values.annualUnit || "");
        if (!normalizedValue(unitValue)) {
          setErrorMessage(`${sectionLabel} ${index + 1}행의 단위(연간)를 선택해야 저장할 수 있습니다.`);
          return;
        }
        if (!isMappedUnitValue(unitValue)) {
          setErrorMessage(`${sectionLabel} ${index + 1}행의 단위(연간) 값 "${normalizeUnitValue(unitValue)}"은(는) 표준 단위와 매핑되지 않아 저장할 수 없습니다.`);
          return;
        }
      }
    }
    setApplying(true);
    setMessage("");
    setErrorMessage("");
    try {
      const payload = await replaceEmissionSurveySharedDatasetSections({
        sourceFileName: uploadedFile.name,
        sourcePath: stringOf(previewPayload, "sourcePath"),
        targetPath: stringOf(previewPayload, "targetPath"),
        sections: sectionsToApply.map((section) => sanitizeSectionForSave(section)) as Array<Record<string, unknown>>
      });
      setMessage(stringOf((payload as Record<string, unknown>), "message") || "업로드 파일 내용을 DB에 반영했습니다.");
      await pageState.reload();
      setPreviewPayload(null);
      setEditablePreviewSections([]);
      setRowSourceSelections({});
      setUploadedFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "업로드 파일을 DB에 반영하지 못했습니다.");
    } finally {
      setApplying(false);
    }
  }

  function handleOpenMapping(sectionIndex: number, rowIndex: number, row: EmissionSurveyAdminRow) {
    const section = editablePreviewSections[sectionIndex];
    const values = { ...((row.values || {}) as Record<string, string>) };
    const nextTarget = {
      sectionIndex,
      rowIndex,
      rowId: String(row.rowId || ""),
      materialName: String(values.materialName || ""),
      allowArSelection: isAirEmissionSection(section || {})
    };
    const nextKeyword = String(values.gwpMappedName || values.materialName || "");
    setMappingTarget(nextTarget);
    setMappingSearchKeyword(nextKeyword);
    setMappingRows([]);
    setSelectedCandidateId(String(values.gwpMappedRowId || ""));
    setFactorType(isArFactorType(String(values.gwpValueType || "")) ? datasetArVersion : (String(values.gwpValueType || "ECOINVENT") as FactorType));
    setDirectValue(String(values.gwpDirectValue || values.gwpValue || ""));
    void handleSearchMapping(nextKeyword, nextTarget);
  }

  function handleSelectRowSource(sectionCode: string, rowId: string, source: RowSourceChoice) {
    setRowSourceSelections((current) => ({
      ...current,
      [rowSelectionKey(sectionCode, rowId)]: source
    }));
  }

  async function loadGwpCatalogRows() {
    if (gwpCatalogRows.length > 0) {
      return gwpCatalogRows;
    }
    const payload = await fetchEmissionGwpValuesPage();
    const rows = (((payload.gwpRows || []) as Array<Record<string, string>>)).slice();
    setGwpCatalogRows(rows);
    return rows;
  }

  async function handleSearchMapping(keywordOverride?: string, targetOverride?: MappingTarget | null) {
    const currentTarget = targetOverride || mappingTarget;
    if (!currentTarget) {
      return;
    }
    const keyword = String(keywordOverride ?? mappingSearchKeyword ?? "");
    setMappingLoading(true);
    try {
      const catalog = await loadGwpCatalogRows();
      const rows = filterAndSortGwpCandidates(catalog, keyword);
      setMappingRows(rows);
      if (rows.length > 0) {
        const nextSelectedCandidateId = String(rows[0].rowId || "");
        setSelectedCandidateId(nextSelectedCandidateId);
        if (normalizedValue(rows[0].manualInputValue)) {
          setFactorType("ECOINVENT");
        } else if (currentTarget.allowArSelection && factorType !== "DIRECT") {
          setFactorType(datasetArVersion);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "배출계수 검색에 실패했습니다.");
    } finally {
      setMappingLoading(false);
    }
  }

  function handleApplyMapping() {
    if (!mappingTarget) {
      return;
    }
    const candidate = mappingRows.find((row) => String(row.rowId || "") === selectedCandidateId) || null;
    if (!candidate) {
      setErrorMessage("먼저 매핑할 물질을 선택하세요.");
      return;
    }
    if (factorType === "DIRECT" && !directValue.trim()) {
      setErrorMessage("직접 입력값을 입력하세요.");
      return;
    }
    if (factorType === "ECOINVENT" && !normalizedValue(candidate.manualInputValue)) {
      setErrorMessage("선택한 물질에는 Ecoinvent 임의 입력값이 없습니다.");
      return;
    }
    setEditablePreviewSections((current) => current.map((section, sectionIndex) => {
      if (sectionIndex !== mappingTarget.sectionIndex) {
        return section;
      }
      return {
        ...section,
        rows: ((section.rows || []) as EmissionSurveyAdminRow[]).map((row, rowIndex) => {
          if (rowIndex !== mappingTarget.rowIndex || String(row.rowId || "") !== mappingTarget.rowId) {
            return row;
          }
          const values = { ...((row.values || {}) as Record<string, string>) };
          return {
            ...row,
            values: sanitizeRowValues(section, applyMappedValues(values, candidate, factorType, directValue))
          };
        })
      };
    }));
    setMessage(`${String(candidate.commonName || "-")} / ${factorLabel(factorType)} 매핑을 적용했습니다.`);
    setMappingTarget(null);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: pageTitle }
      ]}
      title={pageTitle}
      subtitle={pageSubtitle}
      loading={pageState.loading && !page && !pageState.error}
      loadingLabel={en ? "Loading the survey dataset workspace..." : "설문 데이터셋 작업공간을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {errorMessage || pageState.error ? <PageStatusNotice tone="error">{errorMessage || pageState.error}</PageStatusNotice> : null}

        <CollectionResultPanel
          data-help-id="emission-survey-admin-data-upload"
          description={en
            ? "Upload the DB workbook, map each row to an emission factor option, and then apply the edited dataset to DB."
            : "DB 업로드 양식을 업로드한 뒤 각 행에 대해 배출계수를 매핑하고, 수정된 데이터셋을 DB에 반영합니다."}
          title={en ? "DB Workbook Upload" : "DB 양식 업로드"}
        >
          <input accept=".xlsx" className="hidden" onChange={handleUploadChange} ref={fileInputRef} type="file" />
          <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <MemberButton onClick={() => fileInputRef.current?.click()} type="button" variant="primary">
                {uploading ? (en ? "Uploading..." : "업로드 중...") : (en ? "DB Workbook Upload" : "DB 양식 업로드")}
              </MemberButton>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton onClick={() => { window.location.href = getEmissionSurveyAdminBlankTemplateDownloadUrl(); }} title={en ? "Download the DB workbook" : "DB 업로드 양식을 다운로드합니다."} type="button" variant="secondary">
                  {en ? "DB Workbook" : "DB 업로드 양식"}
                </MemberButton>
                <MemberButton disabled={!uploadedFile || applying || editablePreviewSections.length === 0} onClick={() => void handleApplyUploadedFile()} type="button" variant="secondary">
                  {applying ? (en ? "Applying To DB..." : "DB 반영 중...") : (en ? "Apply To DB" : "DB반영")}
                </MemberButton>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              {uploadedFile
                ? `업로드 파일: ${uploadedFile.name}`
                : "DB 업로드 양식은 업로드 직후 Ecoinvent 자동 매핑을 먼저 시도하고, 분홍색 행만 팝업에서 보정한 뒤 반영 버튼을 눌렀을 때만 기존 DB를 덮어씁니다."}
            </span>
          </div>
        </CollectionResultPanel>

        <section className="mt-4 grid grid-cols-1 gap-4">
          {previewProductTitle ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-100 px-5 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                {en ? "Selected Product" : "제품명 기준"}
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-emerald-950">
                {previewProductTitle}
              </div>
              <div className="mt-2 text-sm text-emerald-800">
                {en
                  ? "Existing DB rows are compared under this uploaded product name."
                  : "이 제품명 기준으로 기존 DB 데이터를 비교합니다."}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50/80 px-4 py-3">
              <div className="text-sm font-semibold text-emerald-900">
                {en ? "Product-name comparison" : "제품명 기준 기존 DB 비교"}
              </div>
              <div className="mt-1 text-sm text-emerald-800">
                {previewPayload
                  ? (en
                    ? "Existing DB rows are grouped and compared under each uploaded product name so you can choose whether to keep DB values or use uploaded values."
                    : "업로드한 제품명 기준으로 기존 DB 데이터를 각 행 아래에 묶어서 비교하며, DB 유지 또는 업로드 사용을 선택할 수 있습니다.")
                  : (en
                    ? "After upload, existing DB rows will be loaded and compared by parsed product name."
                    : "업로드가 완료되면 파싱한 제품명 기준으로 기존 DB 데이터를 불러와 비교합니다.")}
              </div>
            </div>
          )}
          <CollectionResultPanel
            data-help-id="emission-survey-admin-data-preview"
            description={previewPayload
              ? (previewMessage || "업로드한 파일의 내용은 아래와 같습니다. 각 행에서 배출계수를 선택한 뒤 반영 버튼을 누르세요.")
              : "제품이 아직 선택되지 않아 기존 DB를 먼저 표시하지 않습니다. 엑셀 업로드 후 제품명 기준으로 기존 DB와 비교합니다."}
            title={en ? "Uploaded File Preview" : "업로드 파일 미리보기"}
          >
            {!previewPayload ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                아직 업로드한 파일이 없습니다. 업로드가 끝나면 `OUTPUT_PRODUCTS`에서 파싱한 제품명 기준으로 기존 DB 값을 불러와 각 행 아래에서 비교하고, DB 유지/업로드 사용을 선택할 수 있습니다.
              </div>
            ) : editablePreviewSections.length === 0 ? (
              <div className="px-3 py-6 text-sm text-slate-500">파일에서 읽은 섹션이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {editablePreviewSections.map((section, index) => renderSectionTable(section, `preview-${section.sectionCode || index}`, {
                  editable: true,
                  sectionIndex: index,
                  onAddRow: handleAddPreviewRow,
                  onDeleteRow: handleDeletePreviewRow,
                  onOpenMapping: handleOpenMapping,
                  onChangeValue: handlePreviewValueChange,
                  existingSections: previewExistingSections,
                  rowSourceSelections,
                  onSelectRowSource: handleSelectRowSource
                }))}
              </div>
            )}
          </CollectionResultPanel>
        </section>

        {mappingTarget ? (
          <GwpMappingModal
            allowArSelection={mappingTarget.allowArSelection}
            datasetArVersion={datasetArVersion}
            onDatasetArVersionChange={setDatasetArVersion}
            directValue={directValue}
            factorType={factorType}
            loading={mappingLoading}
            onApply={handleApplyMapping}
            onClose={() => setMappingTarget(null)}
            onDirectValueChange={setDirectValue}
            onFactorTypeChange={setFactorType}
            onSearch={() => void handleSearchMapping()}
            onSearchKeywordChange={setMappingSearchKeyword}
            onSelectCandidate={setSelectedCandidateId}
            rows={mappingRows}
            searchKeyword={mappingSearchKeyword}
            selectedCandidateId={selectedCandidateId}
            target={mappingTarget}
          />
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
