import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useDeferredValue, useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSystemCodePage } from "../../lib/api/member";
import type { SystemCodePagePayload } from "../../lib/api/memberTypes";
import {
  buildLocalizedPath,
  getNavigationEventName,
  getSearchParam,
  isEnglish
} from "../../lib/navigation/runtime";
import { stringOf, submitFormRequest } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ADMIN_BUTTON_LABELS } from "../admin-ui/labels";
import {
  AdminInput,
  AdminSelect,
  AdminTable,
  GridToolbar,
  LookupContextStrip,
  MemberButton,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  ActiveFilterChipBar,
  RecentWorkPanel,
  ShortcutNotice,
  type RecentWorkItem,
  UseStatusFilterBar,
  type UseStatusFilter
} from "./SystemCodeSupportPanels";

type DetailSortOption = "code-asc" | "code-desc" | "name-asc" | "useAt";
type SystemCodeFormKind = "class-create" | "class-update" | "group-create" | "group-update" | "detail-create" | "detail-update" | "other";
const SYSTEM_CODE_UI_STATE_STORAGE_KEY = "carbonet.system-code.ui-state";

function normalizeUseStatusFilter(value: string): UseStatusFilter {
  return value === "Y" || value === "N" ? value : "";
}

function readDetailCodeIdFromLocation() {
  return getSearchParam("detailCodeId");
}

function readSystemCodeUiStateFromLocation() {
  return {
    classSearchKeyword: getSearchParam("classSearchKeyword"),
    codeSearchKeyword: getSearchParam("codeSearchKeyword"),
    detailSearchKeyword: getSearchParam("detailSearchKeyword"),
    codeFilterClassCode: getSearchParam("codeFilterClassCode"),
    detailSortOption: (getSearchParam("detailSortOption") as DetailSortOption) || "code-asc",
    useStatusFilter: normalizeUseStatusFilter(getSearchParam("useStatusFilter"))
  };
}

function readSystemCodeUiStateFromSession() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SYSTEM_CODE_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      detailCodeId: String(parsed.detailCodeId || ""),
      classSearchKeyword: String(parsed.classSearchKeyword || ""),
      codeSearchKeyword: String(parsed.codeSearchKeyword || ""),
      detailSearchKeyword: String(parsed.detailSearchKeyword || ""),
      codeFilterClassCode: String(parsed.codeFilterClassCode || ""),
      detailSortOption: ((String(parsed.detailSortOption || "code-asc")) as DetailSortOption),
      useStatusFilter: normalizeUseStatusFilter(String(parsed.useStatusFilter || ""))
    };
  } catch {
    return null;
  }
}

function writeSystemCodeUiStateToSession(state: {
  detailCodeId: string;
  classSearchKeyword: string;
  codeSearchKeyword: string;
  detailSearchKeyword: string;
  codeFilterClassCode: string;
  detailSortOption: DetailSortOption;
  useStatusFilter: UseStatusFilter;
}) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(SYSTEM_CODE_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore session storage failures
  }
}

function createDetailRowKey(row: Record<string, unknown> | null | undefined) {
  return `${stringOf(row, "codeId", "CODE_ID")}::${stringOf(row, "code", "CODE")}`;
}

function numberOf(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function normalizeCodeToken(value: FormDataEntryValue | null) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTextValue(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function resolveSystemCodeFormKind(action: string): SystemCodeFormKind {
  if (action.includes("/code/class/create")) return "class-create";
  if (action.includes("/code/class/update")) return "class-update";
  if (action.includes("/code/group/create")) return "group-create";
  if (action.includes("/code/group/update")) return "group-update";
  if (action.includes("/code/detail/create")) return "detail-create";
  if (action.includes("/code/detail/update")) return "detail-update";
  return "other";
}

function parseDetailCodeIdFromResponseUrl(url: string) {
  try {
    return new URL(url, window.location.origin).searchParams.get("detailCodeId") || "";
  } catch {
    return "";
  }
}

function focusDetailCodeInput() {
  window.requestAnimationFrame(() => {
    const element = document.getElementById("detailCode");
    if (element instanceof HTMLInputElement) {
      element.focus();
      element.select();
    }
  });
}

function focusElementById(id: string) {
  window.requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.focus();
      if (element instanceof HTMLInputElement) {
        element.select();
      }
    }
  });
}

function handleRowKeyboardSelect(
  event: ReactKeyboardEvent<HTMLElement>,
  onSelect: () => void
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

async function copyText(value: string) {
  if (!value) {
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function useSystemCodePage() {
  const initialSessionState = readSystemCodeUiStateFromSession();
  const [detailCodeId, setDetailCodeId] = useState(readDetailCodeIdFromLocation() || initialSessionState?.detailCodeId || "");
  const state = useAsyncValue<SystemCodePagePayload>(() => fetchSystemCodePage(detailCodeId || undefined), [detailCodeId], {
    onSuccess(payload) {
      const nextDetailCodeId = String(payload.detailCodeId || "");
      setDetailCodeId((currentValue) => (currentValue === nextDetailCodeId ? currentValue : nextDetailCodeId));
    }
  });

  useEffect(() => {
    function syncDetailCodeIdFromLocation() {
      const nextDetailCodeId = readDetailCodeIdFromLocation();
      setDetailCodeId((currentValue) => (currentValue === nextDetailCodeId ? currentValue : nextDetailCodeId));
    }
    const navigationEventName = getNavigationEventName();
    window.addEventListener("popstate", syncDetailCodeIdFromLocation);
    window.addEventListener(navigationEventName, syncDetailCodeIdFromLocation);
    return () => {
      window.removeEventListener("popstate", syncDetailCodeIdFromLocation);
      window.removeEventListener(navigationEventName, syncDetailCodeIdFromLocation);
    };
  }, []);

  useEffect(() => {
    const currentSearch = new URLSearchParams(window.location.search);
    if (detailCodeId) {
      currentSearch.set("detailCodeId", detailCodeId);
    } else {
      currentSearch.delete("detailCodeId");
    }
    const nextQuery = currentSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [detailCodeId]);

  return { ...state, detailCodeId, setDetailCodeId };
}

function filterClassRows(rows: Array<Record<string, unknown>>, keyword: string) {
  if (!keyword) {
    return rows;
  }
  const normalizedKeyword = keyword.trim().toLowerCase();
  return rows.filter((row) => {
    const text = [
      stringOf(row, "clCode", "CL_CODE"),
      stringOf(row, "clCodeNm", "CL_CODE_NM"),
      stringOf(row, "clCodeDc", "CL_CODE_DC"),
      stringOf(row, "useAt", "USE_AT")
    ].join(" ").toLowerCase();
    return text.includes(normalizedKeyword);
  });
}

function filterCodeRows(rows: Array<Record<string, unknown>>, keyword: string) {
  if (!keyword) {
    return rows;
  }
  const normalizedKeyword = keyword.trim().toLowerCase();
  return rows.filter((row) => {
    const text = [
      stringOf(row, "codeId", "CODE_ID"),
      stringOf(row, "codeIdNm", "CODE_ID_NM"),
      stringOf(row, "codeIdDc", "CODE_ID_DC"),
      stringOf(row, "clCode", "CL_CODE"),
      stringOf(row, "clCodeNm", "CL_CODE_NM"),
      stringOf(row, "useAt", "USE_AT")
    ].join(" ").toLowerCase();
    return text.includes(normalizedKeyword);
  });
}

function filterCodeRowsByClassCode(rows: Array<Record<string, unknown>>, classCode: string) {
  if (!classCode) {
    return rows;
  }
  return rows.filter((row) => stringOf(row, "clCode", "CL_CODE") === classCode);
}

function filterDetailRows(rows: Array<Record<string, unknown>>, keyword: string) {
  if (!keyword) {
    return rows;
  }
  const normalizedKeyword = keyword.trim().toLowerCase();
  return rows.filter((row) => {
    const text = [
      stringOf(row, "codeId", "CODE_ID"),
      stringOf(row, "code", "CODE"),
      stringOf(row, "codeNm", "CODE_NM"),
      stringOf(row, "codeDc", "CODE_DC"),
      stringOf(row, "useAt", "USE_AT")
    ].join(" ").toLowerCase();
    return text.includes(normalizedKeyword);
  });
}

function filterRowsByUseAt(rows: Array<Record<string, unknown>>, useStatusFilter: UseStatusFilter) {
  if (!useStatusFilter) {
    return rows;
  }
  return rows.filter((row) => (stringOf(row, "useAt", "USE_AT") || "Y") === useStatusFilter);
}

function hasClassCode(rows: Array<Record<string, unknown>>, classCode: string) {
  if (!classCode) {
    return false;
  }
  return rows.some((row) => stringOf(row, "clCode", "CL_CODE") === classCode);
}

function resolvePreferredGroupCreateClassCode(
  rows: Array<Record<string, unknown>>,
  filteredClassCode: string,
  selectedClassCode: string
) {
  if (hasClassCode(rows, filteredClassCode)) {
    return filteredClassCode;
  }
  if (hasClassCode(rows, selectedClassCode)) {
    return selectedClassCode;
  }
  return stringOf(rows[0], "clCode", "CL_CODE");
}

function sortDetailRows(rows: Array<Record<string, unknown>>, sortOption: DetailSortOption) {
  const nextRows = [...rows];
  nextRows.sort((left, right) => {
    const leftCode = stringOf(left, "code", "CODE");
    const rightCode = stringOf(right, "code", "CODE");
    const leftName = stringOf(left, "codeNm", "CODE_NM");
    const rightName = stringOf(right, "codeNm", "CODE_NM");
    const leftUseAt = stringOf(left, "useAt", "USE_AT") || "Y";
    const rightUseAt = stringOf(right, "useAt", "USE_AT") || "Y";
    if (sortOption === "code-desc") {
      return rightCode.localeCompare(leftCode, undefined, { numeric: true });
    }
    if (sortOption === "name-asc") {
      return leftName.localeCompare(rightName, undefined, { numeric: true })
        || leftCode.localeCompare(rightCode, undefined, { numeric: true });
    }
    if (sortOption === "useAt") {
      return leftUseAt.localeCompare(rightUseAt)
        || leftName.localeCompare(rightName, undefined, { numeric: true })
        || leftCode.localeCompare(rightCode, undefined, { numeric: true });
    }
    return leftCode.localeCompare(rightCode, undefined, { numeric: true });
  });
  return nextRows;
}

export function SystemCodeMigrationPage() {
  const en = isEnglish();
  const { value: page, error, reload, detailCodeId, setDetailCodeId } = useSystemCodePage();
  const initialSessionState = readSystemCodeUiStateFromSession();
  const initialUiState = { ...initialSessionState, ...readSystemCodeUiStateFromLocation() };
  const [actionError, setActionError] = useState("");
  const [classSearchKeyword, setClassSearchKeyword] = useState(initialUiState.classSearchKeyword);
  const [codeSearchKeyword, setCodeSearchKeyword] = useState(initialUiState.codeSearchKeyword);
  const [detailSearchKeyword, setDetailSearchKeyword] = useState(initialUiState.detailSearchKeyword);
  const [codeFilterClassCode, setCodeFilterClassCode] = useState(initialUiState.codeFilterClassCode);
  const [detailSortOption, setDetailSortOption] = useState<DetailSortOption>(initialUiState.detailSortOption);
  const [useStatusFilter, setUseStatusFilter] = useState<UseStatusFilter>(initialUiState.useStatusFilter);
  const [selectedClassCode, setSelectedClassCode] = useState("");
  const [selectedGroupCodeId, setSelectedGroupCodeId] = useState("");
  const [groupCreateClassCode, setGroupCreateClassCode] = useState("");
  const [selectedDetailRowKey, setSelectedDetailRowKey] = useState("");
  const [selectedDetailRowKeys, setSelectedDetailRowKeys] = useState<string[]>([]);
  const [copiedMessage, setCopiedMessage] = useState("");
  const [recentWorks, setRecentWorks] = useState<RecentWorkItem[]>([]);
  const [highlightKey, setHighlightKey] = useState("");

  const deferredClassSearchKeyword = useDeferredValue(classSearchKeyword);
  const deferredCodeSearchKeyword = useDeferredValue(codeSearchKeyword);
  const deferredDetailSearchKeyword = useDeferredValue(detailSearchKeyword);

  const clCodeList = (page?.clCodeList || []) as Array<Record<string, unknown>>;
  const codeList = (page?.codeList || []) as Array<Record<string, unknown>>;
  const detailCodeList = (page?.detailCodeList || []) as Array<Record<string, unknown>>;
  const classCodeRefCounts = (page?.classCodeRefCounts || {}) as Record<string, unknown>;
  const codeDetailRefCounts = (page?.codeDetailRefCounts || {}) as Record<string, unknown>;

  const filteredClassList = filterRowsByUseAt(filterClassRows(clCodeList, deferredClassSearchKeyword), useStatusFilter);
  const filteredCodeList = filterRowsByUseAt(filterCodeRowsByClassCode(filterCodeRows(codeList, deferredCodeSearchKeyword), codeFilterClassCode), useStatusFilter);
  const filteredDetailCodeList = sortDetailRows(filterRowsByUseAt(filterDetailRows(detailCodeList, deferredDetailSearchKeyword), useStatusFilter), detailSortOption);

  const selectedClassRow = filteredClassList.find((row) => stringOf(row, "clCode", "CL_CODE") === selectedClassCode)
    || clCodeList.find((row) => stringOf(row, "clCode", "CL_CODE") === selectedClassCode)
    || null;
  const selectedGroupRow = filteredCodeList.find((row) => stringOf(row, "codeId", "CODE_ID") === selectedGroupCodeId)
    || codeList.find((row) => stringOf(row, "codeId", "CODE_ID") === selectedGroupCodeId)
    || null;
  const selectedDetailRow = filteredDetailCodeList.find((row) => createDetailRowKey(row) === selectedDetailRowKey)
    || detailCodeList.find((row) => createDetailRowKey(row) === selectedDetailRowKey)
    || null;
  const selectedClassRefCount = selectedClassRow ? numberOf(classCodeRefCounts, stringOf(selectedClassRow, "clCode", "CL_CODE")) : 0;
  const selectedGroupRefCount = selectedGroupRow ? numberOf(codeDetailRefCounts, stringOf(selectedGroupRow, "codeId", "CODE_ID")) : 0;
  const preferredGroupCreateClassCode = resolvePreferredGroupCreateClassCode(clCodeList, codeFilterClassCode, selectedClassCode);

  useEffect(() => {
    if (!detailCodeId && codeList.length > 0) {
      setDetailCodeId(stringOf(codeList[0], "codeId", "CODE_ID"));
    }
  }, [codeList, detailCodeId, setDetailCodeId]);

  useEffect(() => {
    setSelectedClassCode((currentValue) => {
      if (filteredClassList.some((row) => stringOf(row, "clCode", "CL_CODE") === currentValue)) {
        return currentValue;
      }
      return stringOf(filteredClassList[0], "clCode", "CL_CODE");
    });
  }, [filteredClassList]);

  useEffect(() => {
    setCodeFilterClassCode((currentValue) => {
      if (!currentValue) {
        return "";
      }
      if (clCodeList.some((row) => stringOf(row, "clCode", "CL_CODE") === currentValue)) {
        return currentValue;
      }
      return "";
    });
  }, [clCodeList]);

  useEffect(() => {
    setSelectedGroupCodeId((currentValue) => {
      if (filteredCodeList.some((row) => stringOf(row, "codeId", "CODE_ID") === currentValue)) {
        return currentValue;
      }
      return detailCodeId || stringOf(filteredCodeList[0], "codeId", "CODE_ID");
    });
  }, [detailCodeId, filteredCodeList]);

  useEffect(() => {
    setSelectedDetailRowKey((currentValue) => {
      if (filteredDetailCodeList.some((row) => createDetailRowKey(row) === currentValue)) {
        return currentValue;
      }
      return createDetailRowKey(filteredDetailCodeList[0]);
    });
  }, [filteredDetailCodeList]);

  useEffect(() => {
    setSelectedDetailRowKeys((currentValue) => currentValue.filter((rowKey) => detailCodeList.some((row) => createDetailRowKey(row) === rowKey)));
  }, [detailCodeList]);

  useEffect(() => {
    if (selectedGroupCodeId && selectedGroupCodeId !== detailCodeId) {
      setDetailCodeId(selectedGroupCodeId);
    }
  }, [detailCodeId, selectedGroupCodeId, setDetailCodeId]);

  useEffect(() => {
    const nextClassCode = stringOf(selectedGroupRow, "clCode", "CL_CODE");
    if (!nextClassCode) {
      return;
    }
    setSelectedClassCode((currentValue) => currentValue === nextClassCode ? currentValue : nextClassCode);
  }, [selectedGroupRow]);

  useEffect(() => {
    setGroupCreateClassCode((currentValue) => {
      if (hasClassCode(clCodeList, currentValue)) {
        return currentValue;
      }
      return preferredGroupCreateClassCode;
    });
  }, [clCodeList, preferredGroupCreateClassCode]);

  useEffect(() => {
    if (detailCodeId) {
      focusDetailCodeInput();
    }
  }, [detailCodeId]);

  useEffect(() => {
    function syncUiStateFromLocation() {
      const nextState = readSystemCodeUiStateFromLocation();
      setClassSearchKeyword((currentValue) => currentValue === nextState.classSearchKeyword ? currentValue : nextState.classSearchKeyword);
      setCodeSearchKeyword((currentValue) => currentValue === nextState.codeSearchKeyword ? currentValue : nextState.codeSearchKeyword);
      setDetailSearchKeyword((currentValue) => currentValue === nextState.detailSearchKeyword ? currentValue : nextState.detailSearchKeyword);
      setCodeFilterClassCode((currentValue) => currentValue === nextState.codeFilterClassCode ? currentValue : nextState.codeFilterClassCode);
      setDetailSortOption((currentValue) => currentValue === nextState.detailSortOption ? currentValue : nextState.detailSortOption);
      setUseStatusFilter((currentValue) => currentValue === nextState.useStatusFilter ? currentValue : nextState.useStatusFilter);
    }
    const navigationEventName = getNavigationEventName();
    window.addEventListener("popstate", syncUiStateFromLocation);
    window.addEventListener(navigationEventName, syncUiStateFromLocation);
    return () => {
      window.removeEventListener("popstate", syncUiStateFromLocation);
      window.removeEventListener(navigationEventName, syncUiStateFromLocation);
    };
  }, []);

  useEffect(() => {
    const currentSearch = new URLSearchParams(window.location.search);
    if (detailCodeId) {
      currentSearch.set("detailCodeId", detailCodeId);
    } else {
      currentSearch.delete("detailCodeId");
    }
    if (classSearchKeyword) {
      currentSearch.set("classSearchKeyword", classSearchKeyword);
    } else {
      currentSearch.delete("classSearchKeyword");
    }
    if (codeSearchKeyword) {
      currentSearch.set("codeSearchKeyword", codeSearchKeyword);
    } else {
      currentSearch.delete("codeSearchKeyword");
    }
    if (detailSearchKeyword) {
      currentSearch.set("detailSearchKeyword", detailSearchKeyword);
    } else {
      currentSearch.delete("detailSearchKeyword");
    }
    if (codeFilterClassCode) {
      currentSearch.set("codeFilterClassCode", codeFilterClassCode);
    } else {
      currentSearch.delete("codeFilterClassCode");
    }
    if (detailSortOption && detailSortOption !== "code-asc") {
      currentSearch.set("detailSortOption", detailSortOption);
    } else {
      currentSearch.delete("detailSortOption");
    }
    if (useStatusFilter) {
      currentSearch.set("useStatusFilter", useStatusFilter);
    } else {
      currentSearch.delete("useStatusFilter");
    }
    const nextQuery = currentSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [detailCodeId, classSearchKeyword, codeSearchKeyword, detailSearchKeyword, codeFilterClassCode, detailSortOption, useStatusFilter]);

  useEffect(() => {
    writeSystemCodeUiStateToSession({
      detailCodeId,
      classSearchKeyword,
      codeSearchKeyword,
      detailSearchKeyword,
      codeFilterClassCode,
      detailSortOption,
      useStatusFilter
    });
  }, [detailCodeId, classSearchKeyword, codeSearchKeyword, detailSearchKeyword, codeFilterClassCode, detailSortOption, useStatusFilter]);

  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    const timeout = window.setTimeout(() => setHighlightKey(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightKey]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        focusElementById("detailSearchKeyword");
        return;
      }
      if (event.key === "Escape" && !isTypingTarget) {
        event.preventDefault();
        resetFilters();
        return;
      }
      if ((event.key === "n" || event.key === "N") && !isTypingTarget) {
        event.preventDefault();
        if (detailCodeId) {
          setSelectedGroupCodeId(detailCodeId);
          focusDetailCodeInput();
        }
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [detailCodeId]);

  function pushRecentWork(item: RecentWorkItem) {
    setRecentWorks((current) => [item, ...current].slice(0, 8));
  }

  function openRecentWork(item: RecentWorkItem) {
    if (item.kind === "class") {
      setSelectedClassCode(item.targetId);
      setHighlightKey(`class:${item.targetId}`);
      return;
    }
    if (item.kind === "group") {
      setSelectedGroupCodeId(item.targetId);
      setDetailCodeId(item.detailCodeId || item.targetId);
      setHighlightKey(`group:${item.targetId}`);
      return;
    }
    setSelectedGroupCodeId(item.detailCodeId || "");
    setDetailCodeId(item.detailCodeId || "");
    setSelectedDetailRowKey(item.targetId);
    setHighlightKey(`detail:${item.targetId}`);
  }

  function syncSelectionAfterSubmit(
    formKind: SystemCodeFormKind,
    formData: FormData,
    redirectedDetailCodeId: string
  ) {
    if (redirectedDetailCodeId) {
      setDetailCodeId(redirectedDetailCodeId);
      setSelectedGroupCodeId(redirectedDetailCodeId);
    }
    if (formKind === "class-create") {
      const clCode = normalizeCodeToken(formData.get("clCode"));
      setSelectedClassCode(clCode);
      setHighlightKey(`class:${clCode}`);
      pushRecentWork({
        id: `class:${clCode}:${Date.now()}`,
        kind: "class",
        label: en ? `Class created: ${clCode}` : `분류 코드 등록: ${clCode}`,
        targetId: clCode
      });
      return;
    }
    if (formKind === "group-create") {
      const codeId = normalizeCodeToken(formData.get("codeId"));
      const clCode = normalizeCodeToken(formData.get("clCode"));
      setSelectedGroupCodeId(codeId);
      setDetailCodeId(codeId);
      setSelectedClassCode(clCode);
      setGroupCreateClassCode(clCode);
      setHighlightKey(`group:${codeId}`);
      pushRecentWork({
        id: `group:${codeId}:${Date.now()}`,
        kind: "group",
        label: en ? `Code ID created: ${codeId}` : `코드 ID 등록: ${codeId}`,
        targetId: codeId,
        detailCodeId: codeId
      });
      focusDetailCodeInput();
      return;
    }
    if (formKind === "detail-create") {
      const codeId = normalizeCodeToken(formData.get("codeId"));
      const code = normalizeCodeToken(formData.get("code"));
      setSelectedGroupCodeId(codeId);
      setDetailCodeId(codeId);
      setSelectedDetailRowKey(`${codeId}::${code}`);
      setHighlightKey(`detail:${codeId}::${code}`);
      pushRecentWork({
        id: `detail:${codeId}:${code}:${Date.now()}`,
        kind: "detail",
        label: en ? `Detail code created: ${codeId} / ${code}` : `상세 코드 등록: ${codeId} / ${code}`,
        targetId: `${codeId}::${code}`,
        detailCodeId: codeId
      });
      focusDetailCodeInput();
      return;
    }
    if (formKind === "class-update") {
      const clCode = normalizeCodeToken(formData.get("clCode"));
      setHighlightKey(`class:${clCode}`);
      pushRecentWork({
        id: `class-update:${clCode}:${Date.now()}`,
        kind: "class",
        label: en ? `Class updated: ${clCode}` : `분류 코드 수정: ${clCode}`,
        targetId: clCode
      });
      return;
    }
    if (formKind === "group-update") {
      const codeId = normalizeCodeToken(formData.get("codeId"));
      setHighlightKey(`group:${codeId}`);
      pushRecentWork({
        id: `group-update:${codeId}:${Date.now()}`,
        kind: "group",
        label: en ? `Code ID updated: ${codeId}` : `코드 ID 수정: ${codeId}`,
        targetId: codeId,
        detailCodeId: codeId
      });
      return;
    }
    if (formKind === "detail-update") {
      const codeId = normalizeCodeToken(formData.get("codeId"));
      const code = normalizeCodeToken(formData.get("code"));
      setHighlightKey(`detail:${codeId}::${code}`);
      pushRecentWork({
        id: `detail-update:${codeId}:${code}:${Date.now()}`,
        kind: "detail",
        label: en ? `Detail code updated: ${codeId} / ${code}` : `상세 코드 수정: ${codeId} / ${code}`,
        targetId: `${codeId}::${code}`,
        detailCodeId: codeId
      });
      focusDetailCodeInput();
    }
  }

  function resetFilters() {
    setClassSearchKeyword("");
    setCodeSearchKeyword("");
    setDetailSearchKeyword("");
    setCodeFilterClassCode("");
    setDetailSortOption("code-asc");
    setUseStatusFilter("");
  }

  function toggleDetailRowSelection(rowKey: string) {
    setSelectedDetailRowKeys((currentValue) => currentValue.includes(rowKey)
      ? currentValue.filter((item) => item !== rowKey)
      : [...currentValue, rowKey]);
  }

  function toggleAllVisibleDetailRows(checked: boolean) {
    if (!checked) {
      setSelectedDetailRowKeys([]);
      return;
    }
    setSelectedDetailRowKeys(filteredDetailCodeList.map((row) => createDetailRowKey(row)));
  }

  const selectedDetailRowsForBulk = detailCodeList.filter((row) => selectedDetailRowKeys.includes(createDetailRowKey(row)));
  const allVisibleDetailRowsSelected = filteredDetailCodeList.length > 0
    && filteredDetailCodeList.every((row) => selectedDetailRowKeys.includes(createDetailRowKey(row)));

  async function handleCopy(value: string, label: string) {
    try {
      await copyText(value);
      setCopiedMessage(en ? `${label} copied.` : `${label} 복사됨`);
    } catch (nextError) {
      setCopiedMessage(nextError instanceof Error ? nextError.message : (en ? "Copy failed." : "복사에 실패했습니다."));
    }
  }

  const activeFilterChips = [
    classSearchKeyword ? { key: "classSearchKeyword", label: en ? `Class: ${classSearchKeyword}` : `분류: ${classSearchKeyword}`, clear: () => setClassSearchKeyword("") } : null,
    codeSearchKeyword ? { key: "codeSearchKeyword", label: en ? `Code ID: ${codeSearchKeyword}` : `코드 ID: ${codeSearchKeyword}`, clear: () => setCodeSearchKeyword("") } : null,
    detailSearchKeyword ? { key: "detailSearchKeyword", label: en ? `Detail: ${detailSearchKeyword}` : `상세: ${detailSearchKeyword}`, clear: () => setDetailSearchKeyword("") } : null,
    codeFilterClassCode ? { key: "codeFilterClassCode", label: en ? `Class Filter: ${codeFilterClassCode}` : `분류 필터: ${codeFilterClassCode}`, clear: () => setCodeFilterClassCode("") } : null,
    detailSortOption !== "code-asc" ? { key: "detailSortOption", label: en ? `Sort: ${detailSortOption}` : `정렬: ${detailSortOption}`, clear: () => setDetailSortOption("code-asc") } : null,
    useStatusFilter ? { key: "useStatusFilter", label: useStatusFilter === "Y" ? (en ? "Use: Active" : "사용: 사용중") : (en ? "Use: Inactive" : "사용: 미사용"), clear: () => setUseStatusFilter("") } : null
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "system-code", {
      route: window.location.pathname,
      detailCodeId,
      classCodeCount: clCodeList.length,
      filteredClassCodeCount: filteredClassList.length,
      codeGroupCount: codeList.length,
      filteredCodeGroupCount: filteredCodeList.length,
      codeFilterClassCode,
      detailCodeCount: detailCodeList.length,
      filteredDetailCodeCount: filteredDetailCodeList.length,
      detailSortOption
    });
    logGovernanceScope("COMPONENT", "system-code-detail-table", {
      component: "system-code-detail-table",
      detailCodeId,
      rowCount: filteredDetailCodeList.length
    });
  }, [
    clCodeList.length,
    codeList.length,
    detailCodeId,
    detailCodeList.length,
    filteredClassList.length,
    filteredCodeList.length,
    filteredDetailCodeList.length,
    codeFilterClassCode,
    detailSortOption,
    page
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const formKind = resolveSystemCodeFormKind(form.action);
    const confirmMessage = form.dataset.confirmMessage || "";
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    const validationError = validateSystemCodeForm(formKind, formData, {
      clCodeList,
      codeList,
      detailCodeList
    }, en);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    logGovernanceScope("ACTION", "system-code-submit", {
      detailCodeId,
      action: form.action
    });
    setActionError("");
    try {
      const response = await submitFormRequest(form);
      syncSelectionAfterSubmit(formKind, formData, parseDetailCodeIdFromResponseUrl(response.url));
      if (form.dataset.resetOnSuccess === "true") {
        form.reset();
      }
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Request failed." : "요청 처리에 실패했습니다."));
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Code Management" : "코드 관리" }
      ]}
      title={en ? "Code Management" : "코드 관리"}
      subtitle={en ? "Manage class codes, code IDs, and detail codes." : "공통 분류 코드, 코드 ID, 상세 코드를 등록/수정/삭제합니다."}
    >
      {error || actionError || page?.codeMgmtError ? (
        <PageStatusNotice aria-live="assertive" role="alert" tone="error">
          {actionError || page?.codeMgmtError || error}
        </PageStatusNotice>
      ) : null}
      {page?.codeMgmtMessage ? (
        <PageStatusNotice aria-live="polite" role="status" tone="success">
          {String(page.codeMgmtMessage)}
        </PageStatusNotice>
      ) : null}
      {copiedMessage ? (
        <PageStatusNotice aria-live="polite" role="status" tone="success">
          {copiedMessage}
        </PageStatusNotice>
      ) : null}

      <LookupContextStrip
        action={(
          <div className="flex flex-wrap gap-2">
            {detailCodeId ? (
              <MemberButton
                onClick={() => {
                  setSelectedGroupCodeId(detailCodeId);
                  focusDetailCodeInput();
                }}
                type="button"
                variant="secondary"
              >
                {en ? "Add Detail Code" : "상세 코드 추가"}
              </MemberButton>
            ) : null}
            <MemberButton
              onClick={() => setDetailSortOption("useAt")}
              type="button"
              variant="secondary"
            >
              {en ? "Unused First" : "미사용 우선"}
            </MemberButton>
            <MemberButton onClick={resetFilters} type="button" variant="secondary">
              {en ? "Reset Filters" : "검색 초기화"}
            </MemberButton>
          </div>
        )}
        label={en ? "Current Working Context" : "현재 작업 컨텍스트"}
        value={detailCodeId
          ? (en
            ? `Detail work is scoped to ${detailCodeId}. Class/code-ID edits will keep this selection.`
            : `상세 코드 작업 기준은 ${detailCodeId} 입니다. 분류/코드ID 작업 후에도 이 선택을 유지합니다.`)
          : (en ? "No code ID is selected yet." : "선택된 코드 ID가 아직 없습니다.")}
      />

      <ShortcutNotice en={en} />

      <UseStatusFilterBar en={en} onChange={setUseStatusFilter} useStatusFilter={useStatusFilter} />

      <ActiveFilterChipBar chips={activeFilterChips} />

      <RecentWorkPanel en={en} onClear={() => setRecentWorks([])} onOpen={openRecentWork} recentWorks={recentWorks} />

      <section className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
        <SummaryMetricCard title={en ? "Class Codes" : "분류 코드"} value={`${filteredClassList.length} / ${clCodeList.length}`} description={en ? "Visible / total" : "검색 결과 / 전체"} />
        <SummaryMetricCard title={en ? "Code IDs" : "코드 ID"} value={`${filteredCodeList.length} / ${codeList.length}`} description={en ? "Visible / total" : "검색 결과 / 전체"} />
        <SummaryMetricCard title={en ? "Detail Codes" : "상세 코드"} value={`${filteredDetailCodeList.length} / ${detailCodeList.length}`} description={en ? "Visible / selected code ID" : "검색 결과 / 선택된 코드 ID"} />
        <SummaryMetricCard title={en ? "Selected Code ID" : "선택 코드 ID"} value={detailCodeId || "-"} description={en ? "Synced to URL query" : "URL 쿼리와 동기화"} />
      </section>

      <AdminWorkspacePageFrame>
        <section className="gov-card" data-help-id="system-code-class">
          <GridToolbar
            actions={selectedClassRow ? (
              <MemberButton
                onClick={() => setCodeFilterClassCode(stringOf(selectedClassRow, "clCode", "CL_CODE"))}
                type="button"
                variant={codeFilterClassCode === stringOf(selectedClassRow, "clCode", "CL_CODE") ? "primary" : "secondary"}
              >
                {en ? "Filter Code IDs" : "코드 ID 필터 적용"}
              </MemberButton>
            ) : (
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">category</span>
            )}
            className="mb-4"
            meta={en ? "Search and select a class code before editing." : "검색 후 분류 코드를 선택해 수정합니다."}
            title={en ? "Class Codes" : "분류 코드"}
          />

          <div className="mb-4 grid grid-cols-1 gap-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="gov-label" htmlFor="classSearchKeyword">{en ? "Search class codes" : "분류 코드 검색"}</label>
              <AdminInput id="classSearchKeyword" onChange={(event) => setClassSearchKeyword(event.target.value)} placeholder={en ? "Class code, name, description" : "분류 코드, 분류명, 설명"} value={classSearchKeyword} />
            </div>
            <div>
              <label className="gov-label" htmlFor="selectedClassCode">{en ? "Edit target" : "수정 대상"}</label>
              <AdminSelect id="selectedClassCode" onChange={(event) => setSelectedClassCode(event.target.value)} value={selectedClassCode}>
                {filteredClassList.length === 0 ? <option value="">{en ? "No results" : "검색 결과 없음"}</option> : filteredClassList.map((row) => {
                  const clCode = stringOf(row, "clCode", "CL_CODE");
                  return <option key={clCode} value={clCode}>{`${clCode} - ${stringOf(row, "clCodeNm", "CL_CODE_NM")}`}</option>;
                })}
              </AdminSelect>
            </div>
          </div>

          <form action={buildLocalizedPath("/admin/system/code/class/create", "/en/admin/system/code/class/create")} className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-5" data-reset-on-success="true" method="post" onSubmit={handleSubmit}>
            <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
            <div>
              <label className="gov-label" htmlFor="clCode">{en ? "Class Code" : "분류 코드"}</label>
              <AdminInput id="clCode" name="clCode" placeholder={en ? "e.g., HME" : "예: HME"} />
            </div>
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="clCodeNm">{en ? "Class Name" : "분류명"}</label>
              <AdminInput id="clCodeNm" name="clCodeNm" placeholder={en ? "e.g., Home Menu" : "예: 홈 메뉴"} />
            </div>
            <div>
              <label className="gov-label" htmlFor="clCodeDc">{en ? "Description (EN)" : "설명"}</label>
              <AdminInput id="clCodeDc" name="clCodeDc" placeholder={en ? "Description" : "분류 설명"} />
            </div>
            <div>
              <label className="gov-label" htmlFor="clUseAt">{en ? "Use" : "사용여부"}</label>
              <AdminSelect defaultValue="Y" id="clUseAt" name="useAt">
                <option value="Y">Y</option>
                <option value="N">N</option>
              </AdminSelect>
            </div>
            <div className="md:col-span-5 flex justify-end gap-2">
              <MemberButton type="submit" variant="primary">{en ? "Add Class Code" : ADMIN_BUTTON_LABELS.create}</MemberButton>
            </div>
          </form>

          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Class Code" : "분류 코드"}</th>
                  <th className="px-4 py-3">{en ? "Class Name" : "분류명"}</th>
                  <th className="px-4 py-3">{en ? "Description (EN)" : "설명(영문)"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Actions" : "작업"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClassList.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>{en ? "No class codes found." : "분류 코드가 없습니다."}</td></tr>
                ) : filteredClassList.map((row) => {
                  const clCode = stringOf(row, "clCode", "CL_CODE");
                  const isSelected = clCode === selectedClassCode;
                  return (
                    <tr
                      aria-label={en ? `Select class code ${clCode}` : `${clCode} 분류 코드 선택`}
                      className={`${isSelected ? "bg-[var(--kr-gov-surface-subtle)]" : ""} ${highlightKey === `class:${clCode}` ? "bg-amber-50" : ""} cursor-pointer transition-colors`}
                      key={clCode}
                      onClick={() => setSelectedClassCode(clCode)}
                      onKeyDown={(event) => handleRowKeyboardSelect(event, () => setSelectedClassCode(clCode))}
                      tabIndex={0}
                    >
                      <td className="px-4 py-3 font-bold">{clCode}</td>
                      <td className="px-4 py-3">{stringOf(row, "clCodeNm", "CL_CODE_NM") || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{stringOf(row, "clCodeDc", "CL_CODE_DC") || "-"}</td>
                      <td className="px-4 py-3 text-center">{stringOf(row, "useAt", "USE_AT") || "Y"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <MemberButton aria-label={en ? `Copy class code ${clCode}` : `${clCode} 분류 코드 복사`} onClick={() => void handleCopy(clCode, en ? "Class code" : "분류 코드")} type="button" variant="secondary">
                            {en ? "Copy" : "복사"}
                          </MemberButton>
                          <MemberButton onClick={() => setSelectedClassCode(clCode)} type="button" variant={isSelected ? "primary" : "secondary"}>
                            {isSelected ? (en ? "Selected" : "선택됨") : (en ? "Select" : "선택")}
                          </MemberButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>

          {selectedClassRow ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Edit class code" : "분류 코드 수정"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedClassRow, "clCode", "CL_CODE")}</h3>
                    <MemberButton onClick={() => void handleCopy(stringOf(selectedClassRow, "clCode", "CL_CODE"), en ? "Class code" : "분류 코드")} type="button" variant="secondary">{en ? "Copy" : "복사"}</MemberButton>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {selectedClassRefCount > 0
                      ? (en ? `${selectedClassRefCount} code IDs are linked. Delete is blocked until they are cleared.` : `${selectedClassRefCount}개의 코드 ID가 연결되어 있어 삭제할 수 없습니다.`)
                      : (en ? "No linked code IDs. Delete is available." : "연결된 코드 ID가 없어 삭제할 수 있습니다.")}
                  </p>
                </div>
                <form action={buildLocalizedPath("/admin/system/code/class/delete", "/en/admin/system/code/class/delete")} data-confirm-message={en ? "Delete the selected class code?" : "선택한 분류 코드를 삭제하시겠습니까?"} method="post" onSubmit={handleSubmit}>
                  <input name="clCode" type="hidden" value={stringOf(selectedClassRow, "clCode", "CL_CODE")} />
                  <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
                  <MemberButton disabled={selectedClassRefCount > 0} type="submit" variant="danger">{en ? "Delete" : "삭제"}</MemberButton>
                </form>
              </div>
              <form action={buildLocalizedPath("/admin/system/code/class/update", "/en/admin/system/code/class/update")} className="grid grid-cols-1 gap-4 md:grid-cols-4" method="post" onSubmit={handleSubmit}>
                <input name="clCode" type="hidden" value={stringOf(selectedClassRow, "clCode", "CL_CODE")} />
                <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
                <div>
                  <label className="gov-label" htmlFor="selectedClCodeNm">{en ? "Class Name" : "분류명"}</label>
                  <AdminInput defaultValue={stringOf(selectedClassRow, "clCodeNm", "CL_CODE_NM")} id="selectedClCodeNm" name="clCodeNm" />
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label" htmlFor="selectedClCodeDc">{en ? "Description (EN)" : "설명(영문)"}</label>
                  <AdminInput defaultValue={stringOf(selectedClassRow, "clCodeDc", "CL_CODE_DC")} id="selectedClCodeDc" name="clCodeDc" />
                </div>
                <div>
                  <label className="gov-label" htmlFor="selectedClUseAt">{en ? "Use" : "사용여부"}</label>
                  <AdminSelect defaultValue={stringOf(selectedClassRow, "useAt", "USE_AT") || "Y"} id="selectedClUseAt" name="useAt">
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </AdminSelect>
                </div>
                <div className="md:col-span-4 flex justify-end gap-2">
                  <MemberButton type="submit">{en ? "Update" : ADMIN_BUTTON_LABELS.save}</MemberButton>
                </div>
              </form>
            </div>
          ) : null}
        </section>

        <section className="gov-card" data-help-id="system-code-group">
          <GridToolbar
            actions={codeFilterClassCode ? (
              <MemberButton onClick={() => setCodeFilterClassCode("")} type="button" variant="secondary">
                {en ? "Show All Classes" : "전체 분류 보기"}
              </MemberButton>
            ) : (
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">list_alt</span>
            )}
            className="mb-4"
            meta={codeFilterClassCode
              ? (en
                ? `Showing code IDs in class ${codeFilterClassCode}. Select "Show All Classes" to clear the scope.`
                : `${codeFilterClassCode} 분류의 코드 ID만 표시 중입니다. "전체 분류 보기"로 범위를 해제할 수 있습니다.`)
              : (en ? "Search code IDs and bind the detail panel to the selected code." : "코드 ID를 검색하고 상세 코드 패널과 연결합니다.")}
            title={en ? "Code IDs" : "코드 ID"}
          />

          <div className="mb-4 grid grid-cols-1 gap-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="gov-label" htmlFor="codeSearchKeyword">{en ? "Search code IDs" : "코드 ID 검색"}</label>
              <AdminInput id="codeSearchKeyword" onChange={(event) => setCodeSearchKeyword(event.target.value)} placeholder={en ? "Code ID, name, class code" : "코드 ID, 코드명, 분류 코드"} value={codeSearchKeyword} />
            </div>
            <div>
              <label className="gov-label" htmlFor="codeFilterClassCode">{en ? "Class filter" : "분류 필터"}</label>
              <AdminSelect id="codeFilterClassCode" onChange={(event) => setCodeFilterClassCode(event.target.value)} value={codeFilterClassCode}>
                <option value="">{en ? "All classes" : "전체 분류"}</option>
                {clCodeList.map((row) => {
                  const clCode = stringOf(row, "clCode", "CL_CODE");
                  return <option key={clCode} value={clCode}>{`${clCode} - ${stringOf(row, "clCodeNm", "CL_CODE_NM")}`}</option>;
                })}
              </AdminSelect>
            </div>
            <div>
              <label className="gov-label" htmlFor="selectedGroupCodeId">{en ? "Detail target code ID" : "상세 대상 코드 ID"}</label>
              <AdminSelect id="selectedGroupCodeId" onChange={(event) => setSelectedGroupCodeId(event.target.value)} value={selectedGroupCodeId}>
                {filteredCodeList.length === 0 ? <option value="">{en ? "No results" : "검색 결과 없음"}</option> : filteredCodeList.map((row) => {
                  const codeId = stringOf(row, "codeId", "CODE_ID");
                  return <option key={codeId} value={codeId}>{`${codeId} - ${stringOf(row, "codeIdNm", "CODE_ID_NM")}`}</option>;
                })}
              </AdminSelect>
            </div>
          </div>

          <form action={buildLocalizedPath("/admin/system/code/group/create", "/en/admin/system/code/group/create")} className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-6" data-reset-on-success="true" method="post" onSubmit={handleSubmit}>
            <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
            <div>
              <label className="gov-label" htmlFor="codeId">{en ? "Code ID" : "코드 ID"}</label>
              <AdminInput id="codeId" name="codeId" placeholder="HMENU1" />
            </div>
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="codeIdNm">{en ? "Code Name" : "코드명"}</label>
              <AdminInput id="codeIdNm" name="codeIdNm" placeholder={en ? "Home Menu" : "예: 홈 메뉴"} />
            </div>
            <div>
              <label className="gov-label" htmlFor="codeIdDc">{en ? "Description (EN)" : "설명(영문)"}</label>
              <AdminInput id="codeIdDc" name="codeIdDc" />
            </div>
            <div>
              <label className="gov-label" htmlFor="groupClCode">{en ? "Class Code" : "분류 코드"}</label>
              <AdminSelect id="groupClCode" name="clCode" onChange={(event) => setGroupCreateClassCode(event.target.value)} value={groupCreateClassCode}>
                {clCodeList.map((row) => (
                  <option key={stringOf(row, "clCode", "CL_CODE")} value={stringOf(row, "clCode", "CL_CODE")}>
                    {`${stringOf(row, "clCode", "CL_CODE")} - ${stringOf(row, "clCodeNm", "CL_CODE_NM")}`}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="gov-label" htmlFor="codeUseAt">{en ? "Use" : "사용여부"}</label>
              <AdminSelect defaultValue="Y" id="codeUseAt" name="useAt">
                <option value="Y">Y</option>
                <option value="N">N</option>
              </AdminSelect>
            </div>
            <div className="md:col-span-6 flex justify-end gap-2">
              <MemberButton type="submit" variant="primary">{en ? "Add Code ID" : ADMIN_BUTTON_LABELS.create}</MemberButton>
            </div>
          </form>

          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Code ID" : "코드 ID"}</th>
                  <th className="px-4 py-3">{en ? "Code Name" : "코드명"}</th>
                  <th className="px-4 py-3">{en ? "Description (EN)" : "설명(영문)"}</th>
                  <th className="px-4 py-3">{en ? "Class" : "분류"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Actions" : "작업"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCodeList.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={6}>{en ? "No code IDs found." : "코드 ID가 없습니다."}</td></tr>
                ) : filteredCodeList.map((row) => {
                  const codeId = stringOf(row, "codeId", "CODE_ID");
                  const isSelected = codeId === selectedGroupCodeId;
                  return (
                    <tr
                      aria-label={en ? `Select code ID ${codeId}` : `${codeId} 코드 ID 선택`}
                      className={`${isSelected ? "bg-[var(--kr-gov-surface-subtle)]" : ""} ${highlightKey === `group:${codeId}` ? "bg-amber-50" : ""} cursor-pointer transition-colors`}
                      key={codeId}
                      onClick={() => {
                        setSelectedGroupCodeId(codeId);
                        setDetailCodeId(codeId);
                      }}
                      onKeyDown={(event) => handleRowKeyboardSelect(event, () => {
                        setSelectedGroupCodeId(codeId);
                        setDetailCodeId(codeId);
                      })}
                      tabIndex={0}
                    >
                      <td className="px-4 py-3 font-bold">{codeId}</td>
                      <td className="px-4 py-3">{stringOf(row, "codeIdNm", "CODE_ID_NM") || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{stringOf(row, "codeIdDc", "CODE_ID_DC") || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{stringOf(row, "clCodeNm", "CL_CODE_NM") || stringOf(row, "clCode", "CL_CODE") || "-"}</td>
                      <td className="px-4 py-3 text-center">{stringOf(row, "useAt", "USE_AT") || "Y"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <MemberButton aria-label={en ? `Copy code ID ${codeId}` : `${codeId} 코드 ID 복사`} onClick={() => void handleCopy(codeId, en ? "Code ID" : "코드 ID")} type="button" variant="secondary">
                            {en ? "Copy" : "복사"}
                          </MemberButton>
                          <MemberButton
                            onClick={() => {
                              setSelectedGroupCodeId(codeId);
                              setDetailCodeId(codeId);
                            }}
                            type="button"
                            variant={isSelected ? "primary" : "secondary"}
                          >
                            {isSelected ? (en ? "Selected" : "선택됨") : (en ? "Select" : "선택")}
                          </MemberButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>

          {selectedGroupRow ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Edit code ID" : "코드 ID 수정"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedGroupRow, "codeId", "CODE_ID")}</h3>
                    <MemberButton onClick={() => void handleCopy(stringOf(selectedGroupRow, "codeId", "CODE_ID"), en ? "Code ID" : "코드 ID")} type="button" variant="secondary">{en ? "Copy" : "복사"}</MemberButton>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {selectedGroupRefCount > 0
                      ? (en ? `${selectedGroupRefCount} detail codes are linked. Delete is blocked until they are cleared.` : `${selectedGroupRefCount}개의 상세 코드가 연결되어 있어 삭제할 수 없습니다.`)
                      : (en ? "No linked detail codes. Delete is available." : "연결된 상세 코드가 없어 삭제할 수 있습니다.")}
                  </p>
                </div>
                <form action={buildLocalizedPath("/admin/system/code/group/delete", "/en/admin/system/code/group/delete")} data-confirm-message={en ? "Delete the selected code ID?" : "선택한 코드 ID를 삭제하시겠습니까?"} method="post" onSubmit={handleSubmit}>
                  <input name="codeId" type="hidden" value={stringOf(selectedGroupRow, "codeId", "CODE_ID")} />
                  <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
                  <MemberButton disabled={selectedGroupRefCount > 0} type="submit" variant="danger">{en ? "Delete" : "삭제"}</MemberButton>
                </form>
              </div>
              <form action={buildLocalizedPath("/admin/system/code/group/update", "/en/admin/system/code/group/update")} className="grid grid-cols-1 gap-4 md:grid-cols-5" method="post" onSubmit={handleSubmit}>
                <input name="codeId" type="hidden" value={stringOf(selectedGroupRow, "codeId", "CODE_ID")} />
                <input name="currentDetailCodeId" type="hidden" value={detailCodeId} />
                <div>
                  <label className="gov-label" htmlFor="selectedCodeIdNm">{en ? "Code Name" : "코드명"}</label>
                  <AdminInput defaultValue={stringOf(selectedGroupRow, "codeIdNm", "CODE_ID_NM")} id="selectedCodeIdNm" name="codeIdNm" />
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label" htmlFor="selectedCodeIdDc">{en ? "Description (EN)" : "설명(영문)"}</label>
                  <AdminInput defaultValue={stringOf(selectedGroupRow, "codeIdDc", "CODE_ID_DC")} id="selectedCodeIdDc" name="codeIdDc" />
                </div>
                <div>
                  <label className="gov-label" htmlFor="selectedGroupClCode">{en ? "Class Code" : "분류 코드"}</label>
                  <AdminSelect defaultValue={stringOf(selectedGroupRow, "clCode", "CL_CODE")} id="selectedGroupClCode" name="clCode">
                    {clCodeList.map((classRow) => (
                      <option key={stringOf(classRow, "clCode", "CL_CODE")} value={stringOf(classRow, "clCode", "CL_CODE")}>
                        {`${stringOf(classRow, "clCode", "CL_CODE")} - ${stringOf(classRow, "clCodeNm", "CL_CODE_NM")}`}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div>
                  <label className="gov-label" htmlFor="selectedCodeUseAt">{en ? "Use" : "사용여부"}</label>
                  <AdminSelect defaultValue={stringOf(selectedGroupRow, "useAt", "USE_AT") || "Y"} id="selectedCodeUseAt" name="useAt">
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </AdminSelect>
                </div>
                <div className="md:col-span-5 flex justify-end gap-2">
                  <MemberButton type="submit">{en ? "Update" : ADMIN_BUTTON_LABELS.save}</MemberButton>
                </div>
              </form>
            </div>
          ) : null}
        </section>

        <section className="gov-card" data-help-id="system-code-detail">
          <GridToolbar
            actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">fact_check</span>}
            className="mb-4"
            meta={en ? "The selected code ID is reflected in the URL and detail create form." : "선택된 코드 ID는 URL과 상세 코드 등록 폼에 함께 반영됩니다."}
            title={en ? "Detail Codes" : "상세 코드"}
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">
              {selectedDetailRowKeys.length > 0
                ? (en ? `${selectedDetailRowKeys.length} detail codes selected for bulk update.` : `${selectedDetailRowKeys.length}개의 상세 코드를 일괄 수정 대상으로 선택했습니다.`)
                : (en ? "Select detail codes to change use status in bulk." : "상세 코드를 선택하면 사용 여부를 일괄 변경할 수 있습니다.")}
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={buildLocalizedPath("/admin/system/code/detail/bulk-use", "/en/admin/system/code/detail/bulk-use")} method="post" onSubmit={handleSubmit}>
                <input name="codeId" type="hidden" value={detailCodeId} />
                <input name="codes" type="hidden" value={selectedDetailRowsForBulk.map((row) => stringOf(row, "code", "CODE")).join(",")} />
                <input name="useAt" type="hidden" value="Y" />
                <MemberButton disabled={selectedDetailRowKeys.length === 0} type="submit" variant="secondary">{en ? "Mark Active" : "사용중 변경"}</MemberButton>
              </form>
              <form action={buildLocalizedPath("/admin/system/code/detail/bulk-use", "/en/admin/system/code/detail/bulk-use")} method="post" onSubmit={handleSubmit}>
                <input name="codeId" type="hidden" value={detailCodeId} />
                <input name="codes" type="hidden" value={selectedDetailRowsForBulk.map((row) => stringOf(row, "code", "CODE")).join(",")} />
                <input name="useAt" type="hidden" value="N" />
                <MemberButton disabled={selectedDetailRowKeys.length === 0} type="submit" variant="secondary">{en ? "Mark Inactive" : "미사용 변경"}</MemberButton>
              </form>
              <MemberButton disabled={selectedDetailRowKeys.length === 0} onClick={() => setSelectedDetailRowKeys([])} type="button" variant="secondary">{en ? "Clear Selection" : "선택 해제"}</MemberButton>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] p-4 lg:grid-cols-3">
            <div>
              <label className="gov-label" htmlFor="detailCodeId">{en ? "Selected Code ID" : "선택 코드 ID"}</label>
              <AdminSelect id="detailCodeId" onChange={(event) => {
                setSelectedGroupCodeId(event.target.value);
                setDetailCodeId(event.target.value);
              }} value={detailCodeId}>
                {codeList.map((row) => (
                  <option key={stringOf(row, "codeId", "CODE_ID")} value={stringOf(row, "codeId", "CODE_ID")}>
                    {`${stringOf(row, "codeId", "CODE_ID")} - ${stringOf(row, "codeIdNm", "CODE_ID_NM")}`}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="lg:col-span-2">
              <label className="gov-label" htmlFor="detailSearchKeyword">{en ? "Search detail codes" : "상세 코드 검색"}</label>
              <AdminInput id="detailSearchKeyword" onChange={(event) => setDetailSearchKeyword(event.target.value)} placeholder={en ? "Code value, name, description" : "코드값, 코드명, 설명"} value={detailSearchKeyword} />
            </div>
            <div>
              <label className="gov-label" htmlFor="detailSortOption">{en ? "Sort" : "정렬"}</label>
              <AdminSelect id="detailSortOption" onChange={(event) => setDetailSortOption(event.target.value as DetailSortOption)} value={detailSortOption}>
                <option value="code-asc">{en ? "Code ascending" : "코드값 오름차순"}</option>
                <option value="code-desc">{en ? "Code descending" : "코드값 내림차순"}</option>
                <option value="name-asc">{en ? "Name ascending" : "코드명 오름차순"}</option>
                <option value="useAt">{en ? "Use status first" : "사용여부 우선"}</option>
              </AdminSelect>
            </div>
          </div>

          <form action={buildLocalizedPath("/admin/system/code/detail/create", "/en/admin/system/code/detail/create")} className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-6" data-reset-on-success="true" method="post" onSubmit={handleSubmit}>
            <div>
              <label className="gov-label" htmlFor="detailCodeIdInput">{en ? "Code ID" : "코드 ID"}</label>
              <AdminSelect id="detailCodeIdInput" name="codeId" onChange={(event) => {
                setSelectedGroupCodeId(event.target.value);
                setDetailCodeId(event.target.value);
              }} value={detailCodeId}>
                {codeList.map((row) => (
                  <option key={stringOf(row, "codeId", "CODE_ID")} value={stringOf(row, "codeId", "CODE_ID")}>
                    {stringOf(row, "codeId", "CODE_ID")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="gov-label" htmlFor="detailCode">{en ? "Code Value" : "코드값"}</label>
              <AdminInput id="detailCode" name="code" placeholder={en ? "e.g., H001" : "예: H001"} />
            </div>
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="detailCodeNm">{en ? "Code Name" : "코드명"}</label>
              <AdminInput id="detailCodeNm" name="codeNm" placeholder={en ? "Menu Name" : "메뉴명"} />
            </div>
            <div>
              <label className="gov-label" htmlFor="detailCodeDc">{en ? "Description (EN)" : "설명(영문)"}</label>
              <AdminInput id="detailCodeDc" name="codeDc" />
            </div>
            <div>
              <label className="gov-label" htmlFor="detailUseAt">{en ? "Use" : "사용여부"}</label>
              <AdminSelect defaultValue="Y" id="detailUseAt" name="useAt">
                <option value="Y">Y</option>
                <option value="N">N</option>
              </AdminSelect>
            </div>
            <div className="md:col-span-6 flex justify-end gap-2">
              <MemberButton type="submit" variant="primary">{en ? "Add Detail Code" : ADMIN_BUTTON_LABELS.create}</MemberButton>
            </div>
          </form>

          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3 text-center">
                    <input
                      aria-label={en ? "Select all visible detail codes" : "현재 보이는 상세 코드 전체 선택"}
                      checked={allVisibleDetailRowsSelected}
                      onChange={(event) => toggleAllVisibleDetailRows(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3">{en ? "Code ID" : "코드 ID"}</th>
                  <th className="px-4 py-3">{en ? "Code Value" : "코드값"}</th>
                  <th className="px-4 py-3">{en ? "Code Name" : "코드명"}</th>
                  <th className="px-4 py-3">{en ? "Description (EN)" : "설명(영문)"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                  <th className="px-4 py-3 text-center">{en ? "Actions" : "작업"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDetailCodeList.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={7}>{en ? "No detail codes found." : "상세 코드가 없습니다."}</td></tr>
                ) : filteredDetailCodeList.map((row) => {
                  const rowKey = createDetailRowKey(row);
                  const isSelected = rowKey === selectedDetailRowKey;
                  const isChecked = selectedDetailRowKeys.includes(rowKey);
                  return (
                    <tr
                      aria-label={en ? `Select detail code ${stringOf(row, "code", "CODE")}` : `${stringOf(row, "code", "CODE")} 상세 코드 선택`}
                      className={`${isSelected ? "bg-[var(--kr-gov-surface-subtle)]" : ""} ${highlightKey === `detail:${rowKey}` ? "bg-amber-50" : ""} cursor-pointer transition-colors`}
                      key={rowKey}
                      onClick={() => setSelectedDetailRowKey(rowKey)}
                      onKeyDown={(event) => handleRowKeyboardSelect(event, () => setSelectedDetailRowKey(rowKey))}
                      tabIndex={0}
                    >
                      <td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={en ? `Select detail code ${stringOf(row, "code", "CODE")}` : `${stringOf(row, "code", "CODE")} 상세 코드 선택`}
                          checked={isChecked}
                          onChange={() => toggleDetailRowSelection(rowKey)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold">{stringOf(row, "codeId", "CODE_ID")}</td>
                      <td className="px-4 py-3">{stringOf(row, "code", "CODE")}</td>
                      <td className="px-4 py-3">{stringOf(row, "codeNm", "CODE_NM") || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{stringOf(row, "codeDc", "CODE_DC") || "-"}</td>
                      <td className="px-4 py-3 text-center">{stringOf(row, "useAt", "USE_AT") || "Y"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <MemberButton aria-label={en ? `Copy detail code ${stringOf(row, "code", "CODE")}` : `${stringOf(row, "code", "CODE")} 상세 코드 복사`} onClick={() => void handleCopy(stringOf(row, "code", "CODE"), en ? "Detail code" : "상세 코드")} type="button" variant="secondary">
                            {en ? "Copy" : "복사"}
                          </MemberButton>
                          <form action={buildLocalizedPath("/admin/system/code/detail/update", "/en/admin/system/code/detail/update")} method="post" onSubmit={handleSubmit}>
                            <input name="codeId" type="hidden" value={stringOf(row, "codeId", "CODE_ID")} />
                            <input name="code" type="hidden" value={stringOf(row, "code", "CODE")} />
                            <input name="codeNm" type="hidden" value={stringOf(row, "codeNm", "CODE_NM")} />
                            <input name="codeDc" type="hidden" value={stringOf(row, "codeDc", "CODE_DC")} />
                            <input name="useAt" type="hidden" value={(stringOf(row, "useAt", "USE_AT") || "Y") === "Y" ? "N" : "Y"} />
                            <MemberButton aria-label={(stringOf(row, "useAt", "USE_AT") || "Y") === "Y"
                              ? (en ? `Set detail code ${stringOf(row, "code", "CODE")} inactive` : `${stringOf(row, "code", "CODE")} 상세 코드를 미사용으로 변경`)
                              : (en ? `Set detail code ${stringOf(row, "code", "CODE")} active` : `${stringOf(row, "code", "CODE")} 상세 코드를 사용중으로 변경`)} type="submit" variant="secondary">
                              {(stringOf(row, "useAt", "USE_AT") || "Y") === "Y"
                                ? (en ? "Set Inactive" : "미사용")
                                : (en ? "Set Active" : "사용중")}
                            </MemberButton>
                          </form>
                          <MemberButton onClick={() => setSelectedDetailRowKey(rowKey)} type="button" variant={isSelected ? "primary" : "secondary"}>
                            {isSelected ? (en ? "Selected" : "선택됨") : (en ? "Select" : "선택")}
                          </MemberButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>

          {selectedDetailRow ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Edit detail code" : "상세 코드 수정"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--kr-gov-text-primary)]">
                      {`${stringOf(selectedDetailRow, "codeId", "CODE_ID")} / ${stringOf(selectedDetailRow, "code", "CODE")}`}
                    </h3>
                    <MemberButton onClick={() => void handleCopy(stringOf(selectedDetailRow, "code", "CODE"), en ? "Detail code" : "상세 코드")} type="button" variant="secondary">{en ? "Copy" : "복사"}</MemberButton>
                  </div>
                </div>
                <form action={buildLocalizedPath("/admin/system/code/detail/delete", "/en/admin/system/code/detail/delete")} data-confirm-message={en ? "Delete the selected detail code?" : "선택한 상세 코드를 삭제하시겠습니까?"} method="post" onSubmit={handleSubmit}>
                  <input name="codeId" type="hidden" value={stringOf(selectedDetailRow, "codeId", "CODE_ID")} />
                  <input name="code" type="hidden" value={stringOf(selectedDetailRow, "code", "CODE")} />
                  <MemberButton type="submit" variant="danger">{en ? "Delete" : "삭제"}</MemberButton>
                </form>
              </div>
              <form action={buildLocalizedPath("/admin/system/code/detail/update", "/en/admin/system/code/detail/update")} className="grid grid-cols-1 gap-4 md:grid-cols-4" method="post" onSubmit={handleSubmit}>
                <input name="codeId" type="hidden" value={stringOf(selectedDetailRow, "codeId", "CODE_ID")} />
                <input name="code" type="hidden" value={stringOf(selectedDetailRow, "code", "CODE")} />
                <div>
                  <label className="gov-label" htmlFor="selectedDetailCodeNm">{en ? "Code Name" : "코드명"}</label>
                  <AdminInput defaultValue={stringOf(selectedDetailRow, "codeNm", "CODE_NM")} id="selectedDetailCodeNm" name="codeNm" />
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label" htmlFor="selectedDetailCodeDc">{en ? "Description (EN)" : "설명(영문)"}</label>
                  <AdminInput defaultValue={stringOf(selectedDetailRow, "codeDc", "CODE_DC")} id="selectedDetailCodeDc" name="codeDc" />
                </div>
                <div>
                  <label className="gov-label" htmlFor="selectedDetailUseAt">{en ? "Use" : "사용여부"}</label>
                  <AdminSelect defaultValue={stringOf(selectedDetailRow, "useAt", "USE_AT") || "Y"} id="selectedDetailUseAt" name="useAt">
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </AdminSelect>
                </div>
                <div className="md:col-span-4 flex justify-end gap-2">
                  <MemberButton type="submit">{en ? "Update" : ADMIN_BUTTON_LABELS.save}</MemberButton>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

function validateSystemCodeForm(
  formKind: SystemCodeFormKind,
  formData: FormData,
  lists: {
    clCodeList: Array<Record<string, unknown>>;
    codeList: Array<Record<string, unknown>>;
    detailCodeList: Array<Record<string, unknown>>;
  },
  en: boolean
) {
  const identifierPattern = /^[A-Z0-9_]+$/;
  if (formKind === "class-create") {
    const clCode = normalizeCodeToken(formData.get("clCode"));
    const clCodeNm = normalizeTextValue(formData.get("clCodeNm"));
    if (!clCode || !clCodeNm) {
      return en ? "Enter both class code and class name." : "분류 코드와 분류명을 입력하세요.";
    }
    if (!identifierPattern.test(clCode)) {
      return en ? "Class code must use only uppercase letters, numbers, or underscore." : "분류 코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.";
    }
    if (clCode.length > 15) {
      return en ? "Class code must be 15 characters or fewer." : "분류 코드는 15자 이하여야 합니다.";
    }
    if (lists.clCodeList.some((row) => stringOf(row, "clCode", "CL_CODE").toUpperCase() === clCode)) {
      return en ? "That class code already exists." : "이미 등록된 분류 코드입니다.";
    }
  }
  if (formKind === "group-create") {
    const codeId = normalizeCodeToken(formData.get("codeId"));
    const codeIdNm = normalizeTextValue(formData.get("codeIdNm"));
    if (!codeId || !codeIdNm) {
      return en ? "Enter both code ID and code name." : "코드 ID와 코드명을 입력하세요.";
    }
    if (!identifierPattern.test(codeId)) {
      return en ? "Code ID must use only uppercase letters, numbers, or underscore." : "코드 ID는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.";
    }
    if (codeId.length > 15) {
      return en ? "Code ID must be 15 characters or fewer." : "코드 ID는 15자 이하여야 합니다.";
    }
    if (lists.codeList.some((row) => stringOf(row, "codeId", "CODE_ID").toUpperCase() === codeId)) {
      return en ? "That code ID already exists." : "이미 등록된 코드 ID입니다.";
    }
  }
  if (formKind === "detail-create") {
    const codeId = normalizeCodeToken(formData.get("codeId"));
    const code = normalizeCodeToken(formData.get("code"));
    const codeNm = normalizeTextValue(formData.get("codeNm"));
    if (!codeId || !code || !codeNm) {
      return en ? "Enter code ID, code value, and code name." : "코드 ID, 코드값, 코드명을 입력하세요.";
    }
    if (!identifierPattern.test(code)) {
      return en ? "Code value must use only uppercase letters, numbers, or underscore." : "코드값은 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.";
    }
    if (code.length > 15) {
      return en ? "Code value must be 15 characters or fewer." : "코드값은 15자 이하여야 합니다.";
    }
    if (lists.detailCodeList.some((row) =>
      stringOf(row, "codeId", "CODE_ID").toUpperCase() === codeId
      && stringOf(row, "code", "CODE").toUpperCase() === code)) {
      return en ? "That detail code already exists in the selected code ID." : "선택한 코드 ID에 이미 등록된 상세 코드입니다.";
    }
  }
  return "";
}
// agent note: updated by FreeAgent Ultra
