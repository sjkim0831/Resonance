import { Fragment, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchEmissionGwpValuesPage, saveEmissionGwpValue } from "../../lib/api/emission";
import type { EmissionGwpValuesPagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, LookupContextStrip, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { EmissionClassificationCatalogPanel } from "../emission-common/EmissionClassificationCatalogPanel";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTable, AdminTextarea, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";

type Filters = {
  searchKeyword: string;
  sectionCode: string;
  selectedRowId: string;
  pdfComparePolicy: string;
};

type GwpForm = {
  rowId: string;
  sectionCode: string;
  commonName: string;
  formula: string;
  ar4Value: string;
  ar5Value: string;
  ar6Value: string;
  source: string;
  manualInputValue: string;
  note: string;
  sortOrder: string;
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return { searchKeyword: "", sectionCode: "ALL", selectedRowId: "", pdfComparePolicy: "AUTO" };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    sectionCode: search.get("sectionCode") || "ALL",
    selectedRowId: search.get("rowId") || "",
    pdfComparePolicy: search.get("pdfComparePolicy") || "AUTO"
  };
}

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPdfHighlightTokens(row: Record<string, string> | null | undefined) {
  const candidates = [
    { value: stringOf(row, "commonName"), tone: "name" as const },
    { value: stringOf(row, "formula"), tone: "formula" as const },
    { value: stringOf(row, "ar4Value"), tone: "value" as const },
    { value: stringOf(row, "ar5Value"), tone: "value" as const },
    { value: stringOf(row, "ar6Value"), tone: "value" as const }
  ];
  const seen = new Set<string>();
  return candidates
    .filter((item) => item.value.length > 0)
    .sort((left, right) => right.value.length - left.value.length)
    .filter((item) => {
      const normalized = item.value.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function renderHighlightedPdfSnippet(snippet: string, row: Record<string, string> | null | undefined) {
  const tokens = buildPdfHighlightTokens(row);
  if (!snippet || tokens.length === 0) {
    return snippet;
  }
  const pattern = new RegExp(`(${tokens.map((token) => escapeRegExp(token.value)).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  return parts.map((part, index) => {
    const matchedToken = tokens.find((token) => token.value.toLowerCase() === part.toLowerCase());
    if (!matchedToken) {
      return <Fragment key={`pdf-snippet-${index}`}>{part}</Fragment>;
    }
    const className = matchedToken.tone === "name"
      ? "rounded bg-emerald-100 px-1 font-bold text-emerald-800"
      : matchedToken.tone === "formula"
      ? "rounded bg-violet-100 px-1 font-bold text-violet-800"
      : "rounded bg-amber-100 px-1 font-bold text-amber-800";
    return <mark className={className} key={`pdf-snippet-${index}`}>{part}</mark>;
  });
}

function buildEmptyForm(): GwpForm {
  return {
    rowId: "",
    sectionCode: "MAJOR_GHG",
    commonName: "",
    formula: "",
    ar4Value: "",
    ar5Value: "",
    ar6Value: "",
    source: "",
    manualInputValue: "",
    note: "",
    sortOrder: "0"
  };
}

function buildFormFromRow(row: Record<string, string> | null | undefined): GwpForm {
  if (!row) {
    return buildEmptyForm();
  }
  return {
    rowId: stringOf(row, "rowId"),
    sectionCode: stringOf(row, "sectionCode") || "MAJOR_GHG",
    commonName: stringOf(row, "commonName"),
    formula: stringOf(row, "formula"),
    ar4Value: stringOf(row, "ar4Value"),
    ar5Value: stringOf(row, "ar5Value"),
    ar6Value: stringOf(row, "ar6Value"),
    source: stringOf(row, "source"),
    manualInputValue: stringOf(row, "manualInputValue"),
    note: stringOf(row, "note"),
    sortOrder: stringOf(row, "sortOrder") || "0"
  };
}

function pdfStatusRank(row: Record<string, string> | null | undefined) {
  const status = stringOf(row, "pdfCompareStatus");
  if (status === "MATCH") return 3;
  if (status === "PARTIAL") return 2;
  if (status === "MISSING") return 1;
  return 0;
}

function pdfSourceRank(row: Record<string, string> | null | undefined) {
  const source = stringOf(row, "pdfCompareSource");
  if (source === "TEXT") return 2;
  if (source === "OCR") return 1;
  return 0;
}

function pdfDetailRank(row: Record<string, string> | null | undefined) {
  const detail = stringOf(row, "pdfCompareDetail");
  if (detail.includes("복수 값") || detail.includes("multiple values")) return 5;
  if (detail.includes("단일 값") || detail.includes("one value")) return 4;
  if (detail.includes("물질명과 값") || detail.includes("Name and value")) return 3;
  if (detail.includes("화학식과 값") || detail.includes("Formula and value")) return 3;
  if (detail.includes("물질명만") || detail.includes("Name only")) return 2;
  if (detail.includes("화학식만") || detail.includes("Formula only")) return 2;
  if (detail.includes("값만") || detail.includes("value matched")) return 1;
  return 0;
}

function pdfPageClosenessRank(row: Record<string, string> | null | undefined) {
  const sourcePage = Number.parseInt(stringOf(row, "sourcePageNo"), 10);
  const matchedPage = Number.parseInt(stringOf(row, "pdfComparePage"), 10);
  if (!Number.isFinite(sourcePage) || !Number.isFinite(matchedPage)) {
    return 0;
  }
  const distance = Math.abs(sourcePage - matchedPage);
  if (distance === 0) return 3;
  if (distance === 1) return 2;
  if (distance === 2) return 1;
  return 0;
}

function buildRecommendationReason(row: Record<string, string> | null | undefined, en: boolean) {
  if (!row) {
    return "";
  }
  const parts: string[] = [];
  const status = stringOf(row, "pdfCompareStatusLabel");
  if (status) {
    parts.push(en ? `status ${status}` : `상태 ${status}`);
  }
  const detail = stringOf(row, "pdfCompareDetail");
  if (detail) {
    parts.push(en ? `detail ${detail}` : `상세 ${detail}`);
  }
  const source = stringOf(row, "pdfCompareSourceLabel");
  if (source) {
    parts.push(en ? `source ${source}` : `출처 ${source}`);
  }
  const sourcePage = Number.parseInt(stringOf(row, "sourcePageNo"), 10);
  const matchedPage = Number.parseInt(stringOf(row, "pdfComparePage"), 10);
  if (Number.isFinite(sourcePage) && Number.isFinite(matchedPage)) {
    const distance = Math.abs(sourcePage - matchedPage);
    if (distance === 0) {
      parts.push(en ? "page exact match" : "페이지 정확히 일치");
    } else if (distance === 1) {
      parts.push(en ? "page near match" : "페이지 근접 일치");
    }
  }
  return parts.join(" / ");
}

export function EmissionGwpValuesMigrationPage() {
  const policyOrder = ["AUTO", "TEXT_ONLY", "OCR_PREFERRED"] as const;
  const en = isEnglish();
  const [showReferenceCompare, setShowReferenceCompare] = useState(false);
  const [showPolicyCompare, setShowPolicyCompare] = useState(false);
  const [loadAllPdfEvidence, setLoadAllPdfEvidence] = useState(false);
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);
  const [showOnlyPdfGaps, setShowOnlyPdfGaps] = useState(false);
  const [pdfDetailFilter, setPdfDetailFilter] = useState("ALL");
  const [pdfSourceFilter, setPdfSourceFilter] = useState("ALL");
  const [appliedFilters, setAppliedFilters] = useState<Filters>(readInitialFilters);
  const [searchDraft, setSearchDraft] = useState(() => {
    const initial = readInitialFilters();
    return {
      searchKeyword: initial.searchKeyword,
      sectionCode: initial.sectionCode,
      pdfComparePolicy: initial.pdfComparePolicy
    };
  });
  const [form, setForm] = useState<GwpForm>(buildEmptyForm);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const requestedRowId = showReferenceCompare ? appliedFilters.selectedRowId : "";

  const pageState = useAsyncValue<EmissionGwpValuesPagePayload>(
    () => fetchEmissionGwpValuesPage({
      searchKeyword: appliedFilters.searchKeyword,
      sectionCode: appliedFilters.sectionCode,
      rowId: requestedRowId,
      pdfComparePolicy: appliedFilters.pdfComparePolicy,
      includePdfCompare: showReferenceCompare,
      pdfCompareScope: loadAllPdfEvidence ? "ALL" : "SELECTED"
    }),
    [appliedFilters.searchKeyword, appliedFilters.sectionCode, requestedRowId, appliedFilters.pdfComparePolicy, showReferenceCompare, loadAllPdfEvidence]
  );
  const autoPolicyState = useAsyncValue<EmissionGwpValuesPagePayload>(
    () => fetchEmissionGwpValuesPage({
      searchKeyword: appliedFilters.searchKeyword,
      sectionCode: appliedFilters.sectionCode,
      rowId: appliedFilters.selectedRowId,
      pdfComparePolicy: "AUTO",
      includePdfCompare: true,
      pdfCompareScope: "SELECTED"
    }),
    [appliedFilters.searchKeyword, appliedFilters.sectionCode, appliedFilters.selectedRowId],
    {
      enabled: showReferenceCompare && showPolicyCompare && Boolean(appliedFilters.selectedRowId) && appliedFilters.pdfComparePolicy !== "AUTO"
    }
  );
  const textOnlyPolicyState = useAsyncValue<EmissionGwpValuesPagePayload>(
    () => fetchEmissionGwpValuesPage({
      searchKeyword: appliedFilters.searchKeyword,
      sectionCode: appliedFilters.sectionCode,
      rowId: appliedFilters.selectedRowId,
      pdfComparePolicy: "TEXT_ONLY",
      includePdfCompare: true,
      pdfCompareScope: "SELECTED"
    }),
    [appliedFilters.searchKeyword, appliedFilters.sectionCode, appliedFilters.selectedRowId],
    {
      enabled: showReferenceCompare && showPolicyCompare && Boolean(appliedFilters.selectedRowId) && appliedFilters.pdfComparePolicy !== "TEXT_ONLY"
    }
  );
  const ocrPreferredPolicyState = useAsyncValue<EmissionGwpValuesPagePayload>(
    () => fetchEmissionGwpValuesPage({
      searchKeyword: appliedFilters.searchKeyword,
      sectionCode: appliedFilters.sectionCode,
      rowId: appliedFilters.selectedRowId,
      pdfComparePolicy: "OCR_PREFERRED",
      includePdfCompare: true,
      pdfCompareScope: "SELECTED"
    }),
    [appliedFilters.searchKeyword, appliedFilters.sectionCode, appliedFilters.selectedRowId],
    {
      enabled: showReferenceCompare && showPolicyCompare && Boolean(appliedFilters.selectedRowId) && appliedFilters.pdfComparePolicy !== "OCR_PREFERRED"
    }
  );

  const page = pageState.value;
  const pdfCompareLoaded = Boolean(page?.pdfCompareLoaded);
  const pdfCompareScope = stringOf(page as Record<string, unknown>, "pdfCompareScope") || "SELECTED";
  const pdfCompareAllRowsLoaded = pdfCompareLoaded && pdfCompareScope === "ALL";
  const pdfCompareBusy = showReferenceCompare && (!pdfCompareLoaded || pageState.loading);
  const summaryCards = ((page?.summaryCards || []) as Array<Record<string, string>>);
  const comparisonSummary = ((page?.comparisonSummary || []) as Array<Record<string, string>>);
  const pdfComparisonSummary = ((page?.pdfComparisonSummary || []) as Array<Record<string, string>>);
  const sectionOptions = ((page?.sectionOptions || []) as Array<Record<string, string>>);
  const dimensionCards = ((page?.dimensionCards || []) as Array<Record<string, string>>);
  const rows = ((page?.gwpRows || []) as Array<Record<string, string>>);
  const selectedRowFromResponse = ((page?.selectedRow || null) as Record<string, string> | null);
  const governanceNotes = ((page?.governanceNotes || []) as Array<Record<string, string>>);
  const methaneGuidance = ((page?.methaneGuidance || []) as Array<Record<string, string>>);
  const dataIntegrity = ((page?.dataIntegrity || null) as Record<string, unknown> | null);
  const integrityChecks = (((dataIntegrity?.checks as Array<Record<string, string>> | undefined) || []));
  const integrityAnchors = (((dataIntegrity?.anchorRows as Array<Record<string, string>> | undefined) || []));
  const pageError = actionError || pageState.error;
  const selectedRow = useMemo(() => {
    if (appliedFilters.selectedRowId) {
      const matchedRow = rows.find((row) => stringOf(row, "rowId") === appliedFilters.selectedRowId);
      if (matchedRow) {
        return matchedRow;
      }
    }
    return selectedRowFromResponse;
  }, [appliedFilters.selectedRowId, rows, selectedRowFromResponse]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedFilters.searchKeyword) {
      params.set("searchKeyword", appliedFilters.searchKeyword);
    }
    if (appliedFilters.sectionCode && appliedFilters.sectionCode !== "ALL") {
      params.set("sectionCode", appliedFilters.sectionCode);
    }
    if (appliedFilters.pdfComparePolicy && appliedFilters.pdfComparePolicy !== "AUTO") {
      params.set("pdfComparePolicy", appliedFilters.pdfComparePolicy);
    }
    if (stringOf(selectedRow, "rowId") || appliedFilters.selectedRowId) {
      params.set("rowId", stringOf(selectedRow, "rowId") || appliedFilters.selectedRowId);
    }
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [appliedFilters.searchKeyword, appliedFilters.sectionCode, appliedFilters.selectedRowId, appliedFilters.pdfComparePolicy, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    const nextRowId = stringOf(selectedRow, "rowId");
    if (nextRowId && nextRowId !== appliedFilters.selectedRowId) {
      setAppliedFilters((current) => ({ ...current, selectedRowId: nextRowId }));
    }
  }, [appliedFilters.selectedRowId, selectedRow]);

  useEffect(() => {
    const nextRowId = stringOf(selectedRow, "rowId");
    setForm((current) => {
      if (!nextRowId) {
        if (!current.rowId) {
          return current;
        }
        return buildEmptyForm();
      }
      if (current.rowId === nextRowId) {
        return current;
      }
      return buildFormFromRow(selectedRow);
    });
  }, [selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-gwp-values", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      sectionCode: appliedFilters.sectionCode,
      resultCount: rows.length,
      selectedRowId: stringOf(selectedRow, "rowId")
    });
  }, [en, appliedFilters.sectionCode, rows.length, selectedRow]);

  const visibleSummaryCards = useMemo(() => summaryCards.slice(0, 4), [summaryCards]);
  const visibleComparisonSummary = useMemo(() => comparisonSummary.slice(0, 3), [comparisonSummary]);
  const visiblePdfComparisonSummary = useMemo(() => pdfComparisonSummary.slice(0, 4), [pdfComparisonSummary]);
  const pdfDetailOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [{ value: "ALL", label: en ? "All PDF match details" : "전체 PDF 매칭 상세" }];
    if (!pdfCompareAllRowsLoaded) {
      return options;
    }
    rows.forEach((row) => {
      const detail = stringOf(row, "pdfCompareDetail");
      if (!detail || seen.has(detail)) {
        return;
      }
      seen.add(detail);
      options.push({ value: detail, label: detail });
    });
    return options;
  }, [en, pdfCompareAllRowsLoaded, rows]);
  const pdfComparePolicyOptions = ((page?.pdfComparePolicyOptions || []) as Array<Record<string, string>>);
  const policyComparisonRows = useMemo(() => {
    if (!showReferenceCompare || !showPolicyCompare || !selectedRow) {
      return [];
    }
    const policyPages: Record<string, EmissionGwpValuesPagePayload | null> = {
      AUTO: appliedFilters.pdfComparePolicy === "AUTO" ? page : autoPolicyState.value,
      TEXT_ONLY: appliedFilters.pdfComparePolicy === "TEXT_ONLY" ? page : textOnlyPolicyState.value,
      OCR_PREFERRED: appliedFilters.pdfComparePolicy === "OCR_PREFERRED" ? page : ocrPreferredPolicyState.value
    };
    return policyOrder.map((policy) => {
      const policyPage = policyPages[policy];
      const policySelectedRow = ((policyPage?.selectedRow || null) as Record<string, string> | null);
      return {
        policy,
        policyLabel: stringOf(policyPage as Record<string, unknown>, "pdfComparePolicyLabel")
          || stringOf(pdfComparePolicyOptions.find((option) => stringOf(option, "value") === policy), "label")
          || policy,
        row: policySelectedRow,
        loading: policy === appliedFilters.pdfComparePolicy
          ? false
          : policy === "AUTO"
            ? autoPolicyState.loading
            : policy === "TEXT_ONLY"
              ? textOnlyPolicyState.loading
              : ocrPreferredPolicyState.loading
      };
    });
  }, [
    appliedFilters.pdfComparePolicy,
    autoPolicyState.loading,
    autoPolicyState.value,
    ocrPreferredPolicyState.loading,
    ocrPreferredPolicyState.value,
    page,
    pdfComparePolicyOptions,
    selectedRow,
    showPolicyCompare,
    showReferenceCompare,
    textOnlyPolicyState.loading,
    textOnlyPolicyState.value
  ]);
  const recommendedPolicy = useMemo(() => {
    if (!showReferenceCompare || !showPolicyCompare || policyComparisonRows.length === 0) {
      return "";
    }
    const ranked = [...policyComparisonRows]
      .filter((item) => !item.loading && item.row)
      .sort((left, right) => {
        const statusDelta = pdfStatusRank(right.row) - pdfStatusRank(left.row);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        const detailDelta = pdfDetailRank(right.row) - pdfDetailRank(left.row);
        if (detailDelta !== 0) {
          return detailDelta;
        }
        const sourceDelta = pdfSourceRank(right.row) - pdfSourceRank(left.row);
        if (sourceDelta !== 0) {
          return sourceDelta;
        }
        const pageDelta = pdfPageClosenessRank(right.row) - pdfPageClosenessRank(left.row);
        if (pageDelta !== 0) {
          return pageDelta;
        }
        if (right.policy === appliedFilters.pdfComparePolicy) return 1;
        if (left.policy === appliedFilters.pdfComparePolicy) return -1;
        return 0;
      });
    return ranked[0]?.policy || "";
  }, [appliedFilters.pdfComparePolicy, policyComparisonRows, showPolicyCompare, showReferenceCompare]);
  const pdfSourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [{ value: "ALL", label: en ? "All PDF evidence sources" : "전체 PDF 근거 출처" }];
    if (!pdfCompareAllRowsLoaded) {
      return options;
    }
    rows.forEach((row) => {
      const source = stringOf(row, "pdfCompareSource");
      if (!source || seen.has(source)) {
        return;
      }
      seen.add(source);
      options.push({
        value: source,
        label: stringOf(row, "pdfCompareSourceLabel") || source
      });
    });
    return options;
  }, [en, pdfCompareAllRowsLoaded, rows]);
  const pdfSourceSummary = useMemo(() => {
    if (!showReferenceCompare || !pdfCompareAllRowsLoaded) {
      return [];
    }
    const counts = new Map<string, { label: string; value: number }>();
    rows.forEach((row) => {
      const source = stringOf(row, "pdfCompareSource");
      if (!source) {
        return;
      }
      const current = counts.get(source);
      if (current) {
        current.value += 1;
        return;
      }
      counts.set(source, {
        label: stringOf(row, "pdfCompareSourceLabel") || source,
        value: 1
      });
    });
    return Array.from(counts.values());
  }, [pdfCompareAllRowsLoaded, rows, showReferenceCompare]);
  const pdfSourceMetrics = useMemo(() => {
    if (!showReferenceCompare || !pdfCompareAllRowsLoaded) {
      return [];
    }
    const metrics = new Map<string, {
      source: string;
      label: string;
      total: number;
      match: number;
      partial: number;
      gap: number;
    }>();
    rows.forEach((row) => {
      const source = stringOf(row, "pdfCompareSource");
      if (!source) {
        return;
      }
      const current = metrics.get(source) || {
        source,
        label: stringOf(row, "pdfCompareSourceLabel") || source,
        total: 0,
        match: 0,
        partial: 0,
        gap: 0
      };
      current.total += 1;
      const status = stringOf(row, "pdfCompareStatus");
      if (status === "MATCH") {
        current.match += 1;
      } else if (status === "PARTIAL") {
        current.partial += 1;
      } else {
        current.gap += 1;
      }
      metrics.set(source, current);
    });
    return Array.from(metrics.values()).map((item) => ({
      ...item,
      matchRate: item.total > 0 ? Math.round((item.match / item.total) * 100) : 0
    }));
  }, [pdfCompareAllRowsLoaded, rows, showReferenceCompare]);
  const waitingForAllPdfEvidenceFilters = showReferenceCompare
    && !pdfCompareAllRowsLoaded
    && (showOnlyPdfGaps || pdfDetailFilter !== "ALL" || pdfSourceFilter !== "ALL");
  const visibleRows = useMemo(() => {
    if (waitingForAllPdfEvidenceFilters) {
      return [];
    }
    let nextRows = rows;
    if (showReferenceCompare && showOnlyMismatches) {
      nextRows = nextRows.filter((row) => stringOf(row, "compareStatus") !== "MATCH");
    }
    if (showReferenceCompare && pdfCompareAllRowsLoaded && showOnlyPdfGaps) {
      nextRows = nextRows.filter((row) => {
        const status = stringOf(row, "pdfCompareStatus");
        return status === "PARTIAL" || status === "MISSING" || status === "UNAVAILABLE";
      });
    }
    if (showReferenceCompare && pdfCompareAllRowsLoaded && pdfDetailFilter !== "ALL") {
      nextRows = nextRows.filter((row) => stringOf(row, "pdfCompareDetail") === pdfDetailFilter);
    }
    if (showReferenceCompare && pdfCompareAllRowsLoaded && pdfSourceFilter !== "ALL") {
      nextRows = nextRows.filter((row) => stringOf(row, "pdfCompareSource") === pdfSourceFilter);
    }
    return nextRows;
  }, [pdfCompareAllRowsLoaded, pdfDetailFilter, pdfSourceFilter, rows, showOnlyMismatches, showOnlyPdfGaps, showReferenceCompare, waitingForAllPdfEvidenceFilters]);
  const groupedRows = useMemo(() => {
    const groups: Array<{ sectionCode: string; sectionLabel: string; rows: Array<Record<string, string>> }> = [];
    visibleRows.forEach((row) => {
      const sectionCode = stringOf(row, "sectionCode");
      const sectionLabel = stringOf(row, "sectionLabel");
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.sectionCode !== sectionCode) {
        groups.push({ sectionCode, sectionLabel, rows: [row] });
        return;
      }
      lastGroup.rows.push(row);
    });
    return groups;
  }, [visibleRows]);

  function updateForm<K extends keyof GwpForm>(key: K, value: GwpForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function ensureAllPdfEvidenceLoaded() {
    if (!showReferenceCompare || loadAllPdfEvidence) {
      return;
    }
    setLoadAllPdfEvidence(true);
  }

  function hasFieldDiff(row: Record<string, string> | null | undefined, field: string) {
    return showReferenceCompare && stringOf(row, `diff${field}`) === "Y";
  }

  function compareInputClassName(row: Record<string, string> | null | undefined, field: string) {
    return hasFieldDiff(row, field) ? "border-rose-400 text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : "";
  }

  function referenceValue(row: Record<string, string> | null | undefined, field: string) {
    return stringOf(row, `reference${field}`);
  }

  function mismatchTitle(row: Record<string, string> | null | undefined, field: string, label: string) {
    if (!hasFieldDiff(row, field)) {
      return undefined;
    }
    const actual = stringOf(row, field.charAt(0).toLowerCase() + field.slice(1));
    const reference = referenceValue(row, field);
    return `${label} ${en ? "reference" : "정본"}: ${reference || "-"} / ${en ? "current" : "현재"}: ${actual || "-"}`;
  }

  function pdfEvidenceTitle(row: Record<string, string> | null | undefined) {
    const statusLabel = stringOf(row, "pdfCompareStatusLabel");
    const page = stringOf(row, "pdfComparePage");
    const sourceLabel = stringOf(row, "pdfCompareSourceLabel");
    const snippet = stringOf(row, "pdfCompareSnippet");
    if (!statusLabel && !snippet) {
      return undefined;
    }
    const header = `${en ? "PDF" : "PDF"}: ${statusLabel || "-"}`;
    const pageText = page ? `${en ? "page" : "페이지"} ${page}` : "";
    const sourceText = sourceLabel ? `${en ? "source" : "출처"} ${sourceLabel}` : "";
    if (!snippet) {
      return [header, pageText, sourceText].filter(Boolean).join(" / ");
    }
    return [header, pageText, sourceText, snippet].filter(Boolean).join("\n");
  }

  function cellEvidenceTitle(row: Record<string, string> | null | undefined, field: string, label: string) {
    const parts = [mismatchTitle(row, field, label), pdfEvidenceTitle(row)].filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  function escapeCsv(value: string) {
    const normalized = value.replace(/"/g, "\"\"");
    return `"${normalized}"`;
  }

  function downloadMismatchCsv() {
    const mismatchRows = rows.filter((row) => stringOf(row, "compareStatus") !== "MATCH");
    if (mismatchRows.length === 0) {
      setActionError(en ? "No mismatched rows to export." : "내보낼 불일치 행이 없습니다.");
      return;
    }
    const headers = [
      "rowId",
      "sectionCode",
      "commonName",
      "formula",
      "ar4Value",
      "ar5Value",
      "ar6Value",
      "source",
      "manualInputValue",
      "note",
      "compareStatus",
      "compareMismatchLabels",
      "referenceSectionCode",
      "referenceCommonName",
      "referenceFormula",
      "referenceAr4Value",
      "referenceAr5Value",
      "referenceAr6Value",
      "referenceNote"
    ];
    const lines = [
      headers.join(","),
      ...mismatchRows.map((row) => headers.map((header) => escapeCsv(stringOf(row, header))).join(","))
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gwp-reference-mismatches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setActionError("");
    setMessage(en ? "Mismatch CSV downloaded." : "불일치 CSV를 다운로드했습니다.");
  }

  function downloadPdfGapCsv() {
    const pdfGapRows = rows.filter((row) => {
      const status = stringOf(row, "pdfCompareStatus");
      return status === "PARTIAL" || status === "MISSING" || status === "UNAVAILABLE";
    });
    if (pdfGapRows.length === 0) {
      setActionError(en ? "No PDF gap rows to export." : "내보낼 PDF 미일치 행이 없습니다.");
      return;
    }
    const headers = [
      "rowId",
      "sectionCode",
      "commonName",
      "formula",
      "ar4Value",
      "ar5Value",
      "ar6Value",
      "source",
      "manualInputValue",
      "note",
      "pdfCompareStatus",
      "pdfCompareStatusLabel",
      "pdfComparePage",
      "pdfCompareSnippet",
      "compareStatus",
      "compareMismatchLabels",
      "referenceCommonName",
      "referenceFormula",
      "referenceAr4Value",
      "referenceAr5Value",
      "referenceAr6Value"
    ];
    const lines = [
      headers.join(","),
      ...pdfGapRows.map((row) => headers.map((header) => escapeCsv(stringOf(row, header))).join(","))
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gwp-pdf-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setActionError("");
    setMessage(en ? "PDF gap CSV downloaded." : "PDF 미일치 CSV를 다운로드했습니다.");
  }

  function downloadPdfSourceCsv() {
    const pdfSourceRows = rows.filter((row) => {
      if (!stringOf(row, "pdfCompareSource")) {
        return false;
      }
      if (pdfSourceFilter === "ALL") {
        return true;
      }
      return stringOf(row, "pdfCompareSource") === pdfSourceFilter;
    });
    if (pdfSourceRows.length === 0) {
      setActionError(en ? "No PDF source rows to export." : "내보낼 PDF 근거 출처 행이 없습니다.");
      return;
    }
    const headers = [
      "rowId",
      "sectionCode",
      "commonName",
      "formula",
      "ar4Value",
      "ar5Value",
      "ar6Value",
      "source",
      "manualInputValue",
      "note",
      "pdfCompareSource",
      "pdfCompareSourceLabel",
      "pdfCompareStatus",
      "pdfCompareStatusLabel",
      "pdfCompareDetail",
      "pdfComparePage",
      "pdfCompareSnippet",
      "compareStatus",
      "compareMismatchLabels"
    ];
    const lines = [
      headers.join(","),
      ...pdfSourceRows.map((row) => headers.map((header) => escapeCsv(stringOf(row, header))).join(","))
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gwp-pdf-source-${(pdfSourceFilter === "ALL" ? "all" : pdfSourceFilter.toLowerCase())}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setActionError("");
    setMessage(en ? "PDF evidence source CSV downloaded." : "PDF 근거 출처 CSV를 다운로드했습니다.");
  }

  function applyRecommendedPolicy() {
    if (!recommendedPolicy || recommendedPolicy === appliedFilters.pdfComparePolicy) {
      return;
    }
    setSearchDraft((current) => ({ ...current, pdfComparePolicy: recommendedPolicy }));
    setAppliedFilters((current) => ({ ...current, pdfComparePolicy: recommendedPolicy }));
    const recommendedLabel = stringOf(
      pdfComparePolicyOptions.find((option) => stringOf(option, "value") === recommendedPolicy),
      "label"
    ) || recommendedPolicy;
    setActionError("");
    setMessage(en ? `Compare policy switched to ${recommendedLabel}.` : `비교 정책을 ${recommendedLabel}(으)로 전환했습니다.`);
  }

  function resolvePdfGapReason(row: Record<string, string> | null | undefined) {
    const status = stringOf(row, "pdfCompareStatus");
    if (status === "MATCH") {
      return en ? "Parser found the row text and value pattern in the PDF." : "파서가 PDF에서 행 텍스트와 값 패턴을 찾았습니다.";
    }
    if (status === "PARTIAL") {
      return en ? "Parser found only part of the row. Check the PDF snippet and grouped values." : "파서가 행 일부만 찾았습니다. PDF 근거와 값 묶음을 함께 확인해야 합니다.";
    }
    if (status === "MISSING") {
      return en ? "Parser did not find a reliable matching line in the PDF text." : "파서가 PDF 텍스트에서 신뢰할 만한 일치 행을 찾지 못했습니다.";
    }
    if (status === "UNAVAILABLE") {
      return en ? "PDF file is missing or could not be parsed in this runtime." : "현재 런타임에서 PDF 파일이 없거나 파싱할 수 없습니다.";
    }
    return "";
  }

  const currentReferenceDiffLabels = useMemo(() => {
    if (!selectedRow || stringOf(selectedRow, "compareHasReference") !== "Y") {
      return [];
    }
    const diffs: string[] = [];
    if (form.sectionCode !== referenceValue(selectedRow, "SectionCode")) diffs.push(en ? "Section" : "섹션");
    if (form.commonName !== referenceValue(selectedRow, "CommonName")) diffs.push(en ? "Common Name" : "물질명");
    if (form.formula !== referenceValue(selectedRow, "Formula")) diffs.push(en ? "Chemical Formula" : "화학식");
    if (form.ar4Value !== referenceValue(selectedRow, "Ar4Value")) diffs.push("AR4");
    if (form.ar5Value !== referenceValue(selectedRow, "Ar5Value")) diffs.push("AR5");
    if (form.ar6Value !== referenceValue(selectedRow, "Ar6Value")) diffs.push("AR6");
    if (form.note !== referenceValue(selectedRow, "Note")) diffs.push(en ? "Note" : "비고");
    return diffs;
  }, [en, form.ar4Value, form.ar5Value, form.ar6Value, form.commonName, form.formula, form.note, form.sectionCode, selectedRow]);

  function applySearchFilters() {
    setAppliedFilters((current) => ({
      ...current,
      searchKeyword: searchDraft.searchKeyword.trim(),
      sectionCode: searchDraft.sectionCode,
      selectedRowId: "",
      pdfComparePolicy: searchDraft.pdfComparePolicy
    }));
    setForm(buildEmptyForm());
    setMessage("");
    setActionError("");
  }

  function resetSearchFilters() {
    setSearchDraft({ searchKeyword: "", sectionCode: "ALL", pdfComparePolicy: "AUTO" });
    setAppliedFilters({ searchKeyword: "", sectionCode: "ALL", selectedRowId: "", pdfComparePolicy: "AUTO" });
    setForm(buildEmptyForm());
    setMessage("");
    setActionError("");
  }

  function handleSelectRow(rowId: string) {
    setAppliedFilters((current) => ({ ...current, selectedRowId: rowId }));
    setMessage("");
    setActionError("");
  }

  async function handleSave() {
    setActionError("");
    setMessage("");
    if (selectedRow && currentReferenceDiffLabels.length > 0) {
      const confirmed = typeof window === "undefined"
        ? true
        : window.confirm(
          en
            ? `This save differs from the reference seed for: ${currentReferenceDiffLabels.join(", ")}. Continue?`
            : `이번 저장값은 정본 시드와 다음 항목이 다릅니다: ${currentReferenceDiffLabels.join(", ")}. 계속하시겠습니까?`
        );
      if (!confirmed) {
        return;
      }
    }
    setSaving(true);
    try {
      const response = await saveEmissionGwpValue({
        rowId: form.rowId || undefined,
        sectionCode: form.sectionCode,
        commonName: form.commonName.trim(),
        formula: form.formula.trim(),
        ar4Value: form.ar4Value.trim(),
        ar5Value: form.ar5Value.trim(),
        ar6Value: form.ar6Value.trim(),
        source: form.source.trim(),
        manualInputValue: form.manualInputValue.trim(),
        note: form.note.trim(),
        sortOrder: Number(form.sortOrder || "0") || 0
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to save GWP value." : "GWP 값 저장에 실패했습니다."));
      }
      const nextRowId = String(response.rowId || "");
      const savedRow = (response.row || null) as Record<string, string> | null;
      const compareStatusLabel = stringOf(response as Record<string, unknown>, "compareStatusLabel");
      const pdfCompareStatusLabel = stringOf(response as Record<string, unknown>, "pdfCompareStatusLabel");
      const pdfComparePage = stringOf(response as Record<string, unknown>, "pdfComparePage");
      const saveMessageParts = [
        response.message || (en ? "GWP value row saved." : "GWP 값 행을 저장했습니다.")
      ];
      if (compareStatusLabel) {
        saveMessageParts.push(en ? `Reference: ${compareStatusLabel}` : `정본: ${compareStatusLabel}`);
      }
      if (pdfCompareStatusLabel) {
        saveMessageParts.push(en
          ? `PDF: ${pdfCompareStatusLabel}${pdfComparePage ? ` (p.${pdfComparePage})` : ""}`
          : `PDF: ${pdfCompareStatusLabel}${pdfComparePage ? ` (${pdfComparePage}p)` : ""}`);
      }
      setMessage(saveMessageParts.join(" / "));
      if (savedRow) {
        setForm(buildFormFromRow(savedRow));
        pageState.setValue((current) => {
          if (!current) {
            return current;
          }
          const currentRows = (((current.gwpRows as Array<Record<string, string>> | undefined) || []));
          const nextRows = currentRows.some((row) => stringOf(row, "rowId") === nextRowId)
            ? currentRows.map((row) => (stringOf(row, "rowId") === nextRowId ? savedRow : row))
            : [savedRow, ...currentRows];
          return {
            ...current,
            selectedRow: savedRow,
            selectedRowId: nextRowId,
            gwpRows: nextRows
          } as EmissionGwpValuesPagePayload;
        });
      }
      setAppliedFilters((current) => ({ ...current, selectedRowId: nextRowId || current.selectedRowId }));
      void pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to save GWP value." : "GWP 값 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "GWP Value Management" : "GWP 값 관리" }
      ]}
      title={en ? "GWP Value Management" : "GWP 값 관리"}
      subtitle={en
        ? "Manage the August 2024 GHG Protocol global warming potential catalog with AR4, AR5, and AR6 values."
        : "GHG Protocol 2024년 8월판 지구온난화지수 카탈로그를 AR4, AR5, AR6 기준으로 관리합니다."}
      loading={pageState.loading && !page && !pageError}
      loadingLabel={en ? "Loading GWP values..." : "GWP 값을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageError ? <PageStatusNotice tone="error">{pageError}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}

        <PageStatusNotice tone="warning">
          {en
            ? `Source PDF: ${stringOf(page as Record<string, unknown>, "documentSourcePath")} / target path request: ${stringOf(page as Record<string, unknown>, "documentTargetPath")}`
            : `기준 PDF: ${stringOf(page as Record<string, unknown>, "documentSourcePath")} / 요청 대상 경로: ${stringOf(page as Record<string, unknown>, "documentTargetPath")}`}
        </PageStatusNotice>
        {stringOf(page as Record<string, unknown>, "pdfOcrStatusLabel") ? (
          <PageStatusNotice tone={stringOf(page as Record<string, unknown>, "pdfOcrStatus") === "ENABLED" ? "success" : "warning"}>
            {en
              ? `Image OCR: ${stringOf(page as Record<string, unknown>, "pdfOcrStatusLabel")}`
              : `이미지 OCR: ${stringOf(page as Record<string, unknown>, "pdfOcrStatusLabel")}`}
            {stringOf(page as Record<string, unknown>, "pdfOcrStatusDetail")
              ? ` / ${stringOf(page as Record<string, unknown>, "pdfOcrStatusDetail")}`
              : ""}
            {stringOf(page as Record<string, unknown>, "pdfOcrStatus") === "ENABLED"
              ? ""
              : ` / ${stringOf(page as Record<string, unknown>, "pdfOcrInstallHint")}`}
          </PageStatusNotice>
        ) : null}
        {pdfCompareBusy ? (
          <PageStatusNotice tone="warning">
            {en
              ? (loadAllPdfEvidence
                ? "Reference comparison is loading PDF evidence for all rows in the background. The page table stays available while OCR/text parsing finishes."
                : "Reference comparison is loading PDF evidence for the selected row in the background. The page table stays available while OCR/text parsing finishes.")
              : (loadAllPdfEvidence
                ? "정본 대조용 전체 행 PDF 근거를 백그라운드에서 불러오는 중입니다. OCR/본문 파싱이 끝날 때까지 기본 표는 계속 사용할 수 있습니다."
                : "정본 대조용 선택 행 PDF 근거를 백그라운드에서 불러오는 중입니다. OCR/본문 파싱이 끝날 때까지 기본 표는 계속 사용할 수 있습니다.")}
          </PageStatusNotice>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="emission-gwp-summary">
          {visibleSummaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card, "title")}-${index}`}
              title={stringOf(card, "title")}
              value={stringOf(card, "value")}
              description={stringOf(card, "description")}
              accentClassName={index === 1 ? "text-[var(--kr-gov-blue)]" : index === 2 ? "text-emerald-700" : undefined}
              surfaceClassName={index === 1 ? "bg-blue-50" : index === 2 ? "bg-emerald-50" : undefined}
            />
          ))}
        </section>

        <EmissionClassificationCatalogPanel
          catalog={(page?.classificationCatalog || null) as Record<string, unknown> | null}
          title={en ? "LCI DB Classification Reference" : "LCI DB 분류 기준"}
        />

        <CollectionResultPanel
          title={en ? "Reference Comparison" : "정본 대조"}
          description={en
            ? "Compare each DB row against the curated seed catalog derived from the August 2024 reference PDF."
            : "각 DB 행을 2024년 8월 기준 PDF에서 정리한 정본 시드 카탈로그와 대조합니다."}
          icon="rule"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <label className="inline-flex items-center gap-3 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                <AdminCheckbox checked={showReferenceCompare} onChange={(event) => {
                  const checked = event.target.checked;
                  setShowReferenceCompare(checked);
                  if (!checked) {
                    setLoadAllPdfEvidence(false);
                    setShowPolicyCompare(false);
                    setShowOnlyMismatches(false);
                    setShowOnlyPdfGaps(false);
                    setPdfDetailFilter("ALL");
                    setPdfSourceFilter("ALL");
                  }
                }} />
                <span>{en ? "Show reference comparison highlights" : "정본 대조 강조 표시 보기"}</span>
              </label>
              <label className={`inline-flex items-center gap-3 text-sm font-bold ${showReferenceCompare ? "text-[var(--kr-gov-text-primary)]" : "text-slate-400"}`}>
                <AdminCheckbox checked={showPolicyCompare} disabled={!showReferenceCompare} onChange={(event) => setShowPolicyCompare(event.target.checked)} />
                <span>{en ? "Show compare policy board" : "비교 정책 보드 보기"}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <MemberButton
                  disabled={!showReferenceCompare || pdfCompareBusy || loadAllPdfEvidence}
                  onClick={() => setLoadAllPdfEvidence(true)}
                  type="button"
                  variant={loadAllPdfEvidence ? "primary" : "secondary"}
                >
                  {loadAllPdfEvidence
                    ? (en ? "PDF evidence for all rows loaded" : "전체 행 PDF 근거 로드됨")
                    : (en ? "Load PDF evidence for all rows" : "전체 행 PDF 근거 로드")}
                </MemberButton>
                {showReferenceCompare && !loadAllPdfEvidence ? (
                  <span className="text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Default mode loads PDF evidence only for the selected row."
                      : "기본 모드는 선택한 행에 대해서만 PDF 근거를 불러옵니다."}
                  </span>
                ) : null}
              </div>
              <label className={`inline-flex items-center gap-3 text-sm font-bold ${showReferenceCompare ? "text-[var(--kr-gov-text-primary)]" : "text-slate-400"}`}>
                <AdminCheckbox checked={showOnlyMismatches} disabled={!showReferenceCompare} onChange={(event) => setShowOnlyMismatches(event.target.checked)} />
                <span>{en ? "Show mismatches only" : "불일치 행만 보기"}</span>
              </label>
              <label className={`inline-flex items-center gap-3 text-sm font-bold ${showReferenceCompare ? "text-[var(--kr-gov-text-primary)]" : "text-slate-400"}`}>
                <AdminCheckbox checked={showOnlyPdfGaps} disabled={!showReferenceCompare} onChange={(event) => {
                  const checked = event.target.checked;
                  setShowOnlyPdfGaps(checked);
                  if (checked) {
                    ensureAllPdfEvidenceLoaded();
                  }
                }} />
                <span>{en ? "Show PDF gaps only" : "PDF 미일치 행만 보기"}</span>
              </label>
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                <span className={!showReferenceCompare ? "text-slate-400" : ""}>{en ? "PDF match detail" : "PDF 매칭 상세"}</span>
                <AdminSelect disabled={!showReferenceCompare || !pdfCompareAllRowsLoaded} value={pdfDetailFilter} onChange={(event) => {
                  const nextValue = event.target.value;
                  setPdfDetailFilter(nextValue);
                  if (nextValue !== "ALL") {
                    ensureAllPdfEvidenceLoaded();
                  }
                }}>
                  {pdfDetailOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </label>
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                <span className={!showReferenceCompare ? "text-slate-400" : ""}>{en ? "Compare policy" : "비교 정책"}</span>
                <AdminSelect
                  disabled={!showReferenceCompare || !pdfCompareLoaded}
                  value={searchDraft.pdfComparePolicy}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchDraft((current) => ({ ...current, pdfComparePolicy: value }));
                    setAppliedFilters((current) => ({ ...current, pdfComparePolicy: value }));
                  }}
                >
                  {pdfComparePolicyOptions.map((option) => (
                    <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                  ))}
                </AdminSelect>
              </label>
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                <span className={!showReferenceCompare ? "text-slate-400" : ""}>{en ? "PDF evidence source" : "PDF 근거 출처"}</span>
                <AdminSelect disabled={!showReferenceCompare || !pdfCompareAllRowsLoaded} value={pdfSourceFilter} onChange={(event) => {
                  const nextValue = event.target.value;
                  setPdfSourceFilter(nextValue);
                  if (nextValue !== "ALL") {
                    ensureAllPdfEvidenceLoaded();
                  }
                }}>
                  {pdfSourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </label>
              <div className="flex flex-wrap gap-2">
                <MemberButton disabled={!showReferenceCompare || !pdfCompareAllRowsLoaded} onClick={() => setPdfSourceFilter("ALL")} type="button" variant={pdfSourceFilter === "ALL" ? "primary" : "secondary"}>
                  {en ? "All sources" : "전체 출처"}
                </MemberButton>
                <MemberButton disabled={!showReferenceCompare || !pdfCompareAllRowsLoaded || !pdfSourceOptions.some((option) => option.value === "TEXT")} onClick={() => {
                  ensureAllPdfEvidenceLoaded();
                  setPdfSourceFilter("TEXT");
                }} type="button" variant={pdfSourceFilter === "TEXT" ? "primary" : "secondary"}>
                  {en ? "PDF text only" : "PDF 본문만"}
                </MemberButton>
                <MemberButton disabled={!showReferenceCompare || !pdfCompareAllRowsLoaded || !pdfSourceOptions.some((option) => option.value === "OCR")} onClick={() => {
                  ensureAllPdfEvidenceLoaded();
                  setPdfSourceFilter("OCR");
                }} type="button" variant={pdfSourceFilter === "OCR" ? "primary" : "secondary"}>
                  {en ? "OCR only" : "OCR만"}
                </MemberButton>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {visibleComparisonSummary.map((card, index) => (
                <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${index === 1 ? "border-rose-200 bg-rose-50" : index === 2 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`} key={`${stringOf(card, "title")}-${index}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title")}</p>
                  <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "value")}</p>
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description")}</p>
                </div>
              ))}
            </div>
          </div>
          {showReferenceCompare && pdfSourceSummary.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <span>{en ? "Policy" : "정책"}</span>
                <span>{stringOf(page as Record<string, unknown>, "pdfComparePolicyLabel")}</span>
              </span>
              {pdfSourceSummary.map((item) => (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700" key={item.label}>
                  <span>{item.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">{item.value}</span>
                </span>
              ))}
            </div>
          ) : null}
          {showReferenceCompare && pdfSourceMetrics.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {pdfSourceMetrics.map((item) => (
                <section className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4" key={item.source}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${item.matchRate >= 70 ? "bg-emerald-50 text-emerald-700" : item.matchRate >= 40 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                      {en ? "Match rate" : "일치율"} {item.matchRate}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div className="rounded-[var(--kr-gov-radius-sm)] bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{en ? "Total" : "전체"}</p>
                      <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{item.total}</p>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius-sm)] bg-blue-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">MATCH</p>
                      <p className="mt-1 text-lg font-black text-blue-700">{item.match}</p>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius-sm)] bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">PARTIAL</p>
                      <p className="mt-1 text-lg font-black text-amber-700">{item.partial}</p>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius-sm)] bg-rose-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600">{en ? "Gap" : "미일치"}</p>
                      <p className="mt-1 text-lg font-black text-rose-700">{item.gap}</p>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          ) : null}
          {showReferenceCompare && pdfCompareLoaded && showPolicyCompare && selectedRow && policyComparisonRows.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recommendedPolicy && recommendedPolicy !== appliedFilters.pdfComparePolicy ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="text-sm font-bold text-emerald-800">
                    {en ? "Recommended policy is available." : "추천 정책을 바로 적용할 수 있습니다."}
                  </span>
                  <MemberButton onClick={applyRecommendedPolicy} type="button" variant="primary">
                    {en ? "Apply recommended policy" : "추천 정책 적용"}
                  </MemberButton>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {policyComparisonRows.map((item) => (
                <section className={`rounded-[var(--kr-gov-radius)] border px-4 py-4 ${item.policy === appliedFilters.pdfComparePolicy ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"}`} key={item.policy}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.policyLabel}</p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {item.policy === recommendedPolicy ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">{en ? "Recommended" : "추천"}</span>
                      ) : null}
                      {item.policy === appliedFilters.pdfComparePolicy ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-700">{en ? "Active" : "현재 적용"}</span>
                      ) : null}
                    </div>
                  </div>
                  {item.loading ? (
                    <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading policy comparison..." : "정책 비교 로딩 중..."}</p>
                  ) : (
                    <div className="mt-3 space-y-2 text-sm">
                      <p><span className="font-bold">{en ? "Status" : "상태"}</span> {stringOf(item.row, "pdfCompareStatusLabel") || "-"}</p>
                      <p><span className="font-bold">{en ? "Source" : "출처"}</span> {stringOf(item.row, "pdfCompareSourceLabel") || "-"}</p>
                      <p><span className="font-bold">{en ? "Detail" : "상세"}</span> {stringOf(item.row, "pdfCompareDetail") || "-"}</p>
                      <p><span className="font-bold">{en ? "Page" : "페이지"}</span> {stringOf(item.row, "pdfComparePage") || "-"}</p>
                      {item.policy === recommendedPolicy ? (
                        <p className="rounded-[var(--kr-gov-radius-sm)] bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                          <span className="font-bold">{en ? "Why recommended" : "추천 사유"}</span> {buildRecommendationReason(item.row, en)}
                        </p>
                      ) : null}
                    </div>
                  )}
                </section>
              ))}
              </div>
            </div>
          ) : null}
          {showReferenceCompare && pdfCompareAllRowsLoaded ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <MemberButton onClick={downloadMismatchCsv} type="button" variant="secondary">
                {en ? "Download mismatch CSV" : "불일치 CSV 다운로드"}
              </MemberButton>
              <MemberButton onClick={downloadPdfGapCsv} type="button" variant="secondary">
                {en ? "Download PDF gap CSV" : "PDF 미일치 CSV 다운로드"}
              </MemberButton>
              <MemberButton onClick={downloadPdfSourceCsv} type="button" variant="secondary">
                {en ? "Download PDF source CSV" : "PDF 근거 출처 CSV 다운로드"}
              </MemberButton>
            </div>
          ) : null}
          {showReferenceCompare ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-[var(--kr-gov-text-secondary)]">
              {pdfCompareLoaded
                ? (en
                ? "Mismatched cells are shown with red underline. Hover a highlighted value to see the seed reference in a tooltip. Small 'ref' text under a value shows the curated reference inline."
                : "불일치 셀은 빨간 밑줄로 표시됩니다. 강조된 값에 마우스를 올리면 정본 기준값이 툴팁으로 보입니다. 값 아래의 '정본' 표시는 기준값을 즉시 보여줍니다.")
                : (en
                  ? "Seed comparison is visible immediately. PDF text/OCR evidence appears after the deferred comparison load completes."
                  : "정본 시드 대조는 즉시 표시되며, PDF 본문/OCR 근거는 지연 로드가 끝난 뒤 표시됩니다.")}
              {showReferenceCompare && pdfCompareLoaded && !pdfCompareAllRowsLoaded
                ? ` ${en ? "PDF filters, export, and source metrics unlock after loading all-row evidence." : "PDF 필터, 내보내기, 출처 통계는 전체 행 근거를 로드한 뒤 사용할 수 있습니다."}`
                : ""}
            </div>
          ) : null}
          {showReferenceCompare && pdfCompareAllRowsLoaded && visiblePdfComparisonSummary.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visiblePdfComparisonSummary.map((card, index) => (
                <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                  index === 0 ? "border-blue-200 bg-blue-50" :
                  index === 1 ? "border-amber-200 bg-amber-50" :
                  index === 2 ? "border-slate-200 bg-slate-50" :
                  "border-rose-200 bg-rose-50"
                }`} key={`${stringOf(card, "title")}-${index}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title")}</p>
                  <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "value")}</p>
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {dimensionCards.map((card, index) => (
            <section className="gov-card border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,#ffffff_0%,#f6f8fc_100%)]" key={`${stringOf(card, "title")}-${index}`}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{stringOf(card, "title")}</p>
              <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "value")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(card, "body")}</p>
            </section>
          ))}
        </section>

        {integrityChecks.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr,1.1fr]">
            <CollectionResultPanel
              className="mb-0 border-slate-200 bg-slate-50"
              description={en ? "Startup now creates and seeds the DB catalog before the first page open." : "이제 첫 화면 진입 전 서버 기동 시점에 DB 카탈로그를 생성하고 시드합니다."}
              icon="verified"
              title={en ? "Integrity Snapshot" : "무결성 스냅샷"}
            >
              <ul className="space-y-3 text-sm leading-6">
                {integrityChecks.map((item, index) => (
                  <li className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={`${stringOf(item, "title")}-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${stringOf(item, "ok") === "Y" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {stringOf(item, "ok") === "Y" ? (en ? "OK" : "정상") : (en ? "Check" : "점검")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                    <p className="mt-2 font-mono text-xs text-slate-600">
                      {en ? "expected" : "기준"}: {stringOf(item, "expected")} / {en ? "actual" : "현재"}: {stringOf(item, "actual")}
                    </p>
                  </li>
                ))}
              </ul>
            </CollectionResultPanel>

            <CollectionResultPanel
              className="mb-0 border-slate-200 bg-slate-50"
              description={en ? "Anchor rows are the practical checksum for names, formulas, and AR values that operators care about first." : "대표 앵커 행은 운영자가 가장 먼저 보는 물질명, 화학식, AR 값을 실무 기준으로 점검합니다."}
              icon="dataset"
              title={en ? "Anchor Row Checks" : "대표 행 점검"}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {integrityAnchors.map((item, index) => (
                  <section className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={`${stringOf(item, "commonName")}-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "commonName")}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${stringOf(item, "ok") === "Y" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {stringOf(item, "ok") === "Y" ? (en ? "Match" : "일치") : (en ? "Mismatch" : "불일치")}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600">{stringOf(item, "actualFormula") || "-"} / AR4 {stringOf(item, "actualAr4Value") || "-"} / AR5 {stringOf(item, "actualAr5Value") || "-"} / AR6 {stringOf(item, "actualAr6Value") || "-"}</p>
                  </section>
                ))}
              </div>
            </CollectionResultPanel>
          </section>
        ) : null}

        <CollectionResultPanel
          data-help-id="emission-gwp-search"
          title={en ? "Search GWP Catalog" : "GWP 카탈로그 검색"}
          description={en
            ? "Filter by section and keyword before editing an official row."
            : "공식 행을 수정하기 전에 섹션과 검색어로 범위를 좁힙니다."}
          icon="manage_search"
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,auto,auto]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="gwpKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput
                id="gwpKeyword"
                placeholder={en ? "Common name, formula, value" : "물질명, 화학식, 값"}
                value={searchDraft.searchKeyword}
                onChange={(event) => setSearchDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applySearchFilters();
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="gwpSection">{en ? "Section" : "섹션"}</label>
              <AdminSelect id="gwpSection" value={searchDraft.sectionCode} onChange={(event) => setSearchDraft((current) => ({ ...current, sectionCode: event.target.value }))}>
                {sectionOptions.map((option) => (
                  <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="gwpPdfComparePolicy">{en ? "Compare Policy" : "비교 정책"}</label>
              <AdminSelect id="gwpPdfComparePolicy" value={searchDraft.pdfComparePolicy} onChange={(event) => setSearchDraft((current) => ({ ...current, pdfComparePolicy: event.target.value }))}>
                {pdfComparePolicyOptions.map((option) => (
                  <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <MemberButton onClick={applySearchFilters} type="button" variant="primary">
                {en ? "Search" : "검색"}
              </MemberButton>
            </div>
            <div className="flex items-end gap-2">
              <MemberButton onClick={resetSearchFilters} type="button" variant="secondary">
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </div>
        </CollectionResultPanel>

        {selectedRow ? (
          <LookupContextStrip
            action={(
              <div className="flex flex-wrap gap-2">
                <MemberLinkButton href={buildLocalizedPath("/admin/emission/result_list", "/en/admin/emission/result_list")} size="xs" variant="secondary">
                  {en ? "Result List" : "산정결과 목록"}
                </MemberLinkButton>
                <MemberLinkButton href={buildLocalizedPath("/admin/emission/definition-studio", "/en/admin/emission/definition-studio")} size="xs" variant="primary">
                  {en ? "Definition Studio" : "배출 정의 관리"}
                </MemberLinkButton>
              </div>
            )}
            label={en ? "Selected GWP Row" : "선택된 GWP 행"}
            value={(
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{stringOf(selectedRow, "commonName")}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{stringOf(selectedRow, "formula")}</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(selectedRow, "sectionLabel")}</span>
              </div>
            )}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr,0.75fr]">
          <section className="gov-card overflow-hidden p-0" data-help-id="emission-gwp-table">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <MemberSectionToolbar
                actions={<span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? "Results" : "조회 결과"} {visibleRows.length}</span>}
                meta={en ? "The table header mirrors the PDF: substance name, chemical formula, then the grouped 100-year GWP horizon columns." : "표 헤더는 PDF 원문처럼 물질명, 화학식, 그리고 100년 GWP 그룹 열 순서를 유지합니다."}
                title={en ? "IPCC GWP Table Migration" : "IPCC GWP 표 마이그레이션"}
              />
            </div>
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-slate-100 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="min-w-[320px] px-4 py-4 text-left align-middle" rowSpan={2}>{en ? "Common chemical name or industrial designation" : "일반명 또는 산업 표기"}</th>
                    <th className="min-w-[160px] px-4 py-4 text-left align-middle" rowSpan={2}>{en ? "Chemical formula" : "화학식"}</th>
                    <th className="px-4 py-3 text-center align-middle" colSpan={3}>{en ? "GWP values for 100-year time horizon" : "100년 기준 GWP 값"}</th>
                    <th className="min-w-[140px] px-4 py-4 text-left align-middle" rowSpan={2}>{en ? "Source / Manual" : "출처 / 임의 입력값"}</th>
                    <th className="min-w-[88px] px-4 py-4 text-center align-middle" rowSpan={2}>{en ? "Select" : "선택"}</th>
                  </tr>
                  <tr className="border-b border-[var(--kr-gov-border-light)] bg-white text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="min-w-[120px] px-4 py-3 text-center">{en ? "Fourth Assessment Report (AR4)" : "제4차 평가보고서 (AR4)"}</th>
                    <th className="min-w-[120px] px-4 py-3 text-center">{en ? "Fifth Assessment Report (AR5)" : "제5차 평가보고서 (AR5)"}</th>
                    <th className="min-w-[120px] px-4 py-3 text-center">{en ? "Sixth Assessment Report (AR6)" : "제6차 평가보고서 (AR6)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {waitingForAllPdfEvidenceFilters
                          ? (en ? "Loading all-row PDF evidence before applying PDF filters." : "PDF 필터 적용을 위해 전체 행 PDF 근거를 불러오는 중입니다.")
                          : showReferenceCompare && showOnlyMismatches && showOnlyPdfGaps
                          ? (en ? "No rows match both mismatch and PDF gap filters." : "불일치와 PDF 미일치 조건을 동시에 만족하는 행이 없습니다.")
                          : showReferenceCompare && showOnlyMismatches
                          ? (en ? "No mismatched rows match the current filters." : "현재 조건에서 불일치 행이 없습니다.")
                          : showReferenceCompare && showOnlyPdfGaps
                          ? (en ? "No PDF gap rows match the current filters." : "현재 조건에서 PDF 미일치 행이 없습니다.")
                          : (en ? "No GWP rows match the current filters." : "현재 조건에 맞는 GWP 행이 없습니다.")}
                      </td>
                    </tr>
                  ) : groupedRows.map((group) => (
                    <Fragment key={group.sectionCode}>
                      <tr className="bg-[linear-gradient(90deg,#eef4ff_0%,#f8fbff_100%)]">
                        <td className="px-4 py-3 text-left text-sm font-black text-[var(--kr-gov-blue)]" colSpan={7}>
                          {group.sectionLabel}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr className={stringOf(row, "rowId") === stringOf(selectedRow, "rowId") ? "bg-blue-50/60" : "hover:bg-gray-50/60"} key={stringOf(row, "rowId")}>
                          <td className="px-4 py-4">
                            <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "commonName")}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--kr-gov-text-secondary)]">
                              {stringOf(row, "note") ? <span>{stringOf(row, "note")}</span> : null}
                              {stringOf(row, "sourcePageNo") ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">{en ? `PDF p.${stringOf(row, "sourcePageNo")}` : `PDF ${stringOf(row, "sourcePageNo")}p`}</span> : null}
                              {showReferenceCompare ? (
                                <>
                                  <span className={`rounded-full px-2 py-0.5 font-bold ${stringOf(row, "compareStatus") === "DIFF" ? "bg-rose-50 text-rose-700" : stringOf(row, "compareStatus") === "EXTRA" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    {stringOf(row, "compareStatusLabel")}
                                  </span>
                                  {pdfCompareAllRowsLoaded ? (
                                    <>
                                      <span className={`rounded-full px-2 py-0.5 font-bold ${stringOf(row, "pdfCompareStatus") === "MATCH" ? "bg-blue-50 text-blue-700" : stringOf(row, "pdfCompareStatus") === "PARTIAL" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`} title={pdfEvidenceTitle(row)}>
                                        {stringOf(row, "pdfCompareStatusLabel")}{stringOf(row, "pdfComparePage") ? ` · p.${stringOf(row, "pdfComparePage")}` : ""}
                                      </span>
                                      {stringOf(row, "pdfCompareSourceLabel") ? (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600" title={pdfEvidenceTitle(row)}>
                                          {stringOf(row, "pdfCompareSourceLabel")}
                                        </span>
                                      ) : null}
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td className={`px-4 py-4 font-mono text-sm ${hasFieldDiff(row, "Formula") ? "text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : ""}`} title={cellEvidenceTitle(row, "Formula", en ? "Formula" : "화학식")}>
                            <div>{stringOf(row, "formula")}</div>
                            {hasFieldDiff(row, "Formula") ? <div className="mt-1 text-[11px] font-bold text-rose-600">{en ? "ref" : "정본"}: {referenceValue(row, "Formula") || "-"}</div> : null}
                          </td>
                          <td className={`px-4 py-4 text-center ${hasFieldDiff(row, "Ar4Value") ? "text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : ""}`} title={cellEvidenceTitle(row, "Ar4Value", "AR4")}>
                            <div>{stringOf(row, "ar4Value") || "-"}</div>
                            {hasFieldDiff(row, "Ar4Value") ? <div className="mt-1 text-[11px] font-bold text-rose-600">{en ? "ref" : "정본"}: {referenceValue(row, "Ar4Value") || "-"}</div> : null}
                          </td>
                          <td className={`px-4 py-4 text-center ${hasFieldDiff(row, "Ar5Value") ? "text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : ""}`} title={cellEvidenceTitle(row, "Ar5Value", "AR5")}>
                            <div>{stringOf(row, "ar5Value") || "-"}</div>
                            {hasFieldDiff(row, "Ar5Value") ? <div className="mt-1 text-[11px] font-bold text-rose-600">{en ? "ref" : "정본"}: {referenceValue(row, "Ar5Value") || "-"}</div> : null}
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-[var(--kr-gov-blue)] ${hasFieldDiff(row, "Ar6Value") ? "text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : ""}`} title={cellEvidenceTitle(row, "Ar6Value", "AR6")}>
                            <div>{stringOf(row, "ar6Value") || "-"}</div>
                            {hasFieldDiff(row, "Ar6Value") ? <div className="mt-1 text-[11px] font-bold text-rose-600">{en ? "ref" : "정본"}: {referenceValue(row, "Ar6Value") || "-"}</div> : null}
                          </td>
                          <td className="px-4 py-4 text-left text-xs text-[var(--kr-gov-text-secondary)]">
                            <div>{stringOf(row, "source") || "-"}</div>
                            <div className="mt-1 font-mono text-slate-500">{stringOf(row, "manualInputValue") || "-"}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <MemberButton onClick={() => handleSelectRow(stringOf(row, "rowId"))} size="xs" type="button" variant={stringOf(row, "rowId") === stringOf(selectedRow, "rowId") ? "primary" : "secondary"}>
                              {en ? "Select" : "선택"}
                            </MemberButton>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          </section>

          <section className="space-y-4" data-help-id="emission-gwp-detail">
            <section className="gov-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{form.rowId ? (en ? "Edit GWP Row" : "GWP 행 편집") : (en ? "Create GWP Row" : "GWP 행 등록")}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{form.rowId || (en ? "NEW" : "신규")}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Section" : "섹션"}</span>
                    <AdminSelect className={compareInputClassName(selectedRow, "SectionCode")} value={form.sectionCode} onChange={(event) => updateForm("sectionCode", event.target.value)}>
                      {sectionOptions.filter((option) => stringOf(option, "value") !== "ALL").map((option) => (
                        <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Sort Order" : "정렬 순서"}</span>
                    <AdminInput inputMode="numeric" value={form.sortOrder} onChange={(event) => updateForm("sortOrder", event.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                </div>
                <label className="text-sm font-bold">
                  <span className="mb-1 block">{en ? "Common Name" : "물질명"}</span>
                  <AdminInput className={compareInputClassName(selectedRow, "CommonName")} value={form.commonName} onChange={(event) => updateForm("commonName", event.target.value)} />
                </label>
                <label className="text-sm font-bold">
                  <span className="mb-1 block">{en ? "Chemical Formula" : "화학식"}</span>
                  <AdminInput className={compareInputClassName(selectedRow, "Formula")} value={form.formula} onChange={(event) => updateForm("formula", event.target.value)} />
                </label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">AR4</span>
                    <AdminInput className={compareInputClassName(selectedRow, "Ar4Value")} value={form.ar4Value} onChange={(event) => updateForm("ar4Value", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">AR5</span>
                    <AdminInput className={compareInputClassName(selectedRow, "Ar5Value")} value={form.ar5Value} onChange={(event) => updateForm("ar5Value", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">AR6</span>
                    <AdminInput className={compareInputClassName(selectedRow, "Ar6Value")} value={form.ar6Value} onChange={(event) => updateForm("ar6Value", event.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Source" : "출처"}</span>
                    <AdminInput value={form.source} onChange={(event) => updateForm("source", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Manual Input Value" : "임의 입력값"}</span>
                    <AdminInput value={form.manualInputValue} onChange={(event) => updateForm("manualInputValue", event.target.value)} />
                  </label>
                </div>
                <label className="text-sm font-bold">
                  <span className="mb-1 block">{en ? "Note" : "비고"}</span>
                  <AdminTextarea className={compareInputClassName(selectedRow, "Note")} rows={4} value={form.note} onChange={(event) => updateForm("note", event.target.value)} />
                </label>
                {selectedRow ? (
                  <dl className="grid grid-cols-1 gap-2 rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "Last Change" : "최종 변경"}</dt>
                      <dd>{stringOf(selectedRow, "lastChangedAt")} / {stringOf(selectedRow, "lastChangedBy")}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "PDF Source" : "PDF 출처"}</dt>
                      <dd>{stringOf(page as Record<string, unknown>, "documentName")} / {en ? "page" : "페이지"} {stringOf(selectedRow, "sourcePageNo") || "-"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "Catalog Source" : "카탈로그 출처"}</dt>
                      <dd>{stringOf(selectedRow, "source") || "-"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "Manual Input Value" : "임의 입력값"}</dt>
                      <dd>{stringOf(selectedRow, "manualInputValue") || "-"}</dd>
                    </div>
                    {showReferenceCompare ? (
                      <div className="flex items-start justify-between gap-4">
                        <dt className="font-bold">{en ? "Reference diff" : "정본 차이"}</dt>
                        <dd className={stringOf(selectedRow, "compareStatus") === "MATCH" ? "text-emerald-700" : "text-rose-700"}>
                          {stringOf(selectedRow, "compareStatus") === "MATCH"
                            ? (en ? "No mismatch" : "불일치 없음")
                            : stringOf(selectedRow, "compareMismatchLabels") || (en ? "Extra row not found in seed catalog" : "정본 시드에 없는 추가 행")}
                        </dd>
                      </div>
                    ) : null}
                    {showReferenceCompare && pdfCompareLoaded ? (
                      <div className="flex items-start justify-between gap-4">
                        <dt className="font-bold">{en ? "PDF parser" : "PDF 파서"}</dt>
                        <dd className={stringOf(selectedRow, "pdfCompareStatus") === "MATCH" ? "text-blue-700" : stringOf(selectedRow, "pdfCompareStatus") === "PARTIAL" ? "text-amber-700" : "text-slate-600"}>
                          {stringOf(selectedRow, "pdfCompareStatusLabel")}{stringOf(selectedRow, "pdfComparePage") ? ` / p.${stringOf(selectedRow, "pdfComparePage")}` : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {showReferenceCompare && pdfCompareLoaded && selectedRow && stringOf(selectedRow, "pdfCompareSnippet") ? (
                  <CollectionResultPanel
                    className="mb-0 border-blue-200 bg-blue-50/40"
                    description={en ? "Best-effort PDF text line matched by the built-in parser." : "내장 PDF 파서가 찾은 가장 가까운 원문 텍스트 줄입니다."}
                    icon="description"
                    title={en ? "PDF Evidence" : "PDF 근거"}
                  >
                    <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-800">{en ? "Name" : "물질명"}</span>
                      <span className="rounded bg-violet-100 px-2 py-1 text-violet-800">{en ? "Formula" : "화학식"}</span>
                      <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">{en ? "AR value" : "AR 값"}</span>
                    </div>
                    <p className="font-mono text-xs leading-7 text-slate-700">
                      {renderHighlightedPdfSnippet(stringOf(selectedRow, "pdfCompareSnippet"), selectedRow)}
                    </p>
                  </CollectionResultPanel>
                ) : null}
                {showReferenceCompare && pdfCompareLoaded && selectedRow ? (
                  <CollectionResultPanel
                    className="mb-0 border-slate-200 bg-slate-50"
                    description={en ? "This tells you whether the evidence came from PDF text extraction or OCR on rendered images." : "이 항목은 근거가 PDF 본문 추출인지, 렌더링 이미지 OCR인지 보여줍니다."}
                    icon="image_search"
                    title={en ? "PDF Evidence Source" : "PDF 근거 출처"}
                  >
                    <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                      {stringOf(selectedRow, "pdfCompareSourceLabel") || (en ? "No source available" : "출처 정보 없음")}
                    </p>
                  </CollectionResultPanel>
                ) : null}
                {showReferenceCompare && pdfCompareLoaded && selectedRow ? (
                  <CollectionResultPanel
                    className="mb-0 border-slate-200 bg-slate-50"
                    description={en ? "This tells you which PDF evidence class the parser actually found." : "이 항목은 PDF 파서가 실제로 어떤 근거 수준을 찾았는지 보여줍니다."}
                    icon="analytics"
                    title={en ? "PDF Match Detail" : "PDF 매칭 상세"}
                  >
                    <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                      {stringOf(selectedRow, "pdfCompareDetail") || (en ? "No detail available" : "상세 정보 없음")}
                    </p>
                  </CollectionResultPanel>
                ) : null}
                {showReferenceCompare && pdfCompareLoaded && selectedRow ? (
                  <CollectionResultPanel
                    className="mb-0 border-slate-200 bg-slate-50"
                    description={en ? "This explains why the PDF parser marked the row as matched, partial, or missing." : "이 설명은 PDF 파서가 해당 행을 일치, 부분일치, 미일치로 본 이유를 요약합니다."}
                    icon="find_in_page"
                    title={en ? "PDF Compare Reason" : "PDF 대조 사유"}
                  >
                    <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{resolvePdfGapReason(selectedRow)}</p>
                  </CollectionResultPanel>
                ) : null}
                {showReferenceCompare && selectedRow ? (
                  <CollectionResultPanel
                    className="mb-0 border-rose-200 bg-rose-50/40"
                    description={en ? "Actual values are compared to the curated seed reference row." : "현재 값과 정본 시드 기준 행을 직접 비교합니다."}
                    icon="difference"
                    title={en ? "Reference Detail" : "정본 기준 상세"}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        { label: en ? "Section" : "섹션", actual: form.sectionCode, reference: stringOf(selectedRow, "referenceSectionCode"), diff: hasFieldDiff(selectedRow, "SectionCode") },
                        { label: en ? "Common Name" : "물질명", actual: form.commonName, reference: stringOf(selectedRow, "referenceCommonName"), diff: hasFieldDiff(selectedRow, "CommonName") },
                        { label: en ? "Chemical Formula" : "화학식", actual: form.formula, reference: stringOf(selectedRow, "referenceFormula"), diff: hasFieldDiff(selectedRow, "Formula") },
                        { label: "AR4", actual: form.ar4Value, reference: stringOf(selectedRow, "referenceAr4Value"), diff: hasFieldDiff(selectedRow, "Ar4Value") },
                        { label: "AR5", actual: form.ar5Value, reference: stringOf(selectedRow, "referenceAr5Value"), diff: hasFieldDiff(selectedRow, "Ar5Value") },
                        { label: "AR6", actual: form.ar6Value, reference: stringOf(selectedRow, "referenceAr6Value"), diff: hasFieldDiff(selectedRow, "Ar6Value") },
                        { label: en ? "Note" : "비고", actual: form.note, reference: stringOf(selectedRow, "referenceNote"), diff: hasFieldDiff(selectedRow, "Note") }
                      ].map((item) => (
                        <section className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${item.diff ? "border-rose-200 bg-white" : "border-emerald-200 bg-white"}`} key={item.label}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold text-[var(--kr-gov-text-primary)]">{item.label}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-black ${item.diff ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {item.diff ? (en ? "Diff" : "차이") : (en ? "Match" : "일치")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{en ? "Current" : "현재"}</p>
                          <p className={`mt-1 text-sm ${item.diff ? "text-rose-700 underline decoration-2 decoration-rose-500 underline-offset-4" : "text-[var(--kr-gov-text-primary)]"}`}>{item.actual || "-"}</p>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{en ? "Reference" : "정본"}</p>
                          <p className="mt-1 text-sm text-slate-700">{item.reference || "-"}</p>
                        </section>
                      ))}
                    </div>
                  </CollectionResultPanel>
                ) : null}
                {showReferenceCompare && selectedRow && currentReferenceDiffLabels.length > 0 ? (
                  <PageStatusNotice tone="warning">
                    {en
                      ? `Current edit differs from reference: ${currentReferenceDiffLabels.join(", ")}`
                      : `현재 편집값이 정본과 다릅니다: ${currentReferenceDiffLabels.join(", ")}`}
                  </PageStatusNotice>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <MemberButton disabled={saving} onClick={() => { void handleSave(); }} type="button" variant="primary">
                    {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save" : "저장")}
                  </MemberButton>
                </div>
              </div>
            </section>

            <CollectionResultPanel
              className="mb-0 border-slate-200 bg-slate-50"
              description={en ? "This guidance comes directly from the official methane handling notes in the source PDF." : "이 안내는 원문 PDF의 메탄 처리 지침을 기반으로 합니다."}
              icon="fact_check"
              title={en ? "Methane Guidance" : "메탄 사용 지침"}
            >
              <ul className="space-y-2 text-sm leading-6">
                {methaneGuidance.map((item, index) => (
                  <li key={`${stringOf(item, "title")}-${index}`}>
                    <span className="font-bold">{stringOf(item, "title")}</span> {stringOf(item, "body")}
                  </li>
                ))}
              </ul>
            </CollectionResultPanel>

            <CollectionResultPanel
              className="mb-0 border-slate-200 bg-slate-50"
              description={en ? "Keep the official column intent intact when editing or extending rows." : "행을 수정하거나 확장할 때 공식 컬럼 의미를 유지해야 합니다."}
              icon="rule"
              title={en ? "Governance Notes" : "운영 기준"}
            >
              <ul className="space-y-2 text-sm leading-6">
                {governanceNotes.map((item, index) => (
                  <li key={`${stringOf(item, "title")}-${index}`}>
                    <span className="font-bold">{stringOf(item, "title")}</span> {stringOf(item, "body")}
                  </li>
                ))}
              </ul>
            </CollectionResultPanel>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
