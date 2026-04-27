import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { fetchWbsManagementPage, saveWbsManagementEntry } from "../../lib/api/platform";
import type { WbsManagementPagePayload } from "../../lib/api/platformTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";
import { buildMenuTree, type MenuTreeNode } from "../menu-management/menuTreeShared";

type MenuNode = MenuTreeNode;

type WbsEditorState = {
  owner: string;
  status: string;
  progress: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  notes: string;
  codexInstruction: string;
};

type WbsCloseoutRow = {
  labelKo: string;
  labelEn: string;
  stateKo: string;
  stateEn: string;
  tone: "ready" | "blocked";
  notesKo: string;
  notesEn: string;
};

const WBS_CLOSEOUT_ROWS: WbsCloseoutRow[] = [
  {
    labelKo: "메뉴 기반 WBS 인벤토리",
    labelEn: "Menu-backed WBS inventory",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "HOME/ADMIN 메뉴 트리를 기준으로 페이지 메뉴별 WBS 행을 생성합니다.",
    notesEn: "Builds WBS rows from the HOME/ADMIN DB menu tree."
  },
  {
    labelKo: "계획/실적 일정 저장",
    labelEn: "Planned and actual schedule save",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "담당자, 상태, 진행률, 예상/실적 시작·종료일, 메모, Codex 지시문을 파일 저장소에 upsert합니다.",
    notesEn: "Upserts owner, status, progress, planned/actual dates, notes, and Codex instruction into the file-backed registry."
  },
  {
    labelKo: "편차/지연/정시율 산출",
    labelEn: "Variance, overdue, and on-time metrics",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "저장된 일정에서 편차일, 지연 여부, 평균 편차, 정시 완료율, 주간 타임라인을 계산합니다.",
    notesEn: "Derives variance days, overdue state, average variance, on-time rate, and weekly timeline from stored dates."
  },
  {
    labelKo: "Codex 작업 지시문",
    labelEn: "Codex work instruction",
    stateKo: "부분 가능",
    stateEn: "Partially available",
    tone: "ready",
    notesKo: "화면/메뉴/권한/API 메타와 추가 지시를 합쳐 복사 가능한 지시문을 만들고 Codex 요청 화면으로 이동합니다.",
    notesEn: "Builds a copyable instruction from screen/menu/permission/API metadata and links to the Codex request console."
  },
  {
    labelKo: "저장 감사 기록",
    labelEn: "Save audit record",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "단일 WBS 저장 시 AuditTrailService에 실행자, 메뉴, 전후 payload를 기록합니다.",
    notesEn: "Records actor, menu, and saved payload through AuditTrailService on single-entry save."
  },
  {
    labelKo: "SR 티켓 직접 연결",
    labelEn: "Direct SR ticket linkage",
    stateKo: "차단",
    stateEn: "Blocked",
    tone: "blocked",
    notesKo: "현재는 Codex 요청 화면 이동까지만 제공하며, WBS 행에서 SR 티켓을 생성·연결·상태 동기화하는 API는 없습니다.",
    notesEn: "The page only opens the Codex request console; no API creates, links, or syncs SR tickets from a WBS row yet."
  },
  {
    labelKo: "Bulk update / 감사 export",
    labelEn: "Bulk update / audit export",
    stateKo: "차단",
    stateEn: "Blocked",
    tone: "blocked",
    notesKo: "여러 WBS 행 일괄 변경, 부분 실패 처리, 감사 증적 조회·내보내기 UI/API가 필요합니다.",
    notesEn: "Bulk row mutation, partial-failure handling, and audit evidence query/export UI/API are still needed."
  }
];

const WBS_ACTION_CONTRACT = [
  { labelKo: "SR 티켓 생성", labelEn: "Create SR Ticket" },
  { labelKo: "SR 링크 동기화", labelEn: "Sync SR Link" },
  { labelKo: "Bulk 일정 업데이트", labelEn: "Bulk Schedule Update" },
  { labelKo: "감사 증적 내보내기", labelEn: "Export Audit Evidence" }
];

function editorFromRow(row: Record<string, unknown> | null): WbsEditorState {
  return {
    owner: stringOf(row, "owner"),
    status: stringOf(row, "status") || "NOT_STARTED",
    progress: String(numberOf(row, "progress")),
    plannedStartDate: stringOf(row, "plannedStartDate", "startDate"),
    plannedEndDate: stringOf(row, "plannedEndDate", "endDate"),
    actualStartDate: stringOf(row, "actualStartDate"),
    actualEndDate: stringOf(row, "actualEndDate"),
    notes: stringOf(row, "notes"),
    codexInstruction: stringOf(row, "codexInstruction")
  };
}

function statusTone(status: string) {
  if (status === "DONE") return "bg-emerald-100 text-emerald-700";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  if (status === "BLOCKED") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function varianceTone(varianceDays: number) {
  if (varianceDays > 0) return "text-red-700";
  if (varianceDays < 0) return "text-emerald-700";
  return "text-slate-600";
}

function spanActive(startDate: string, endDate: string, slotStart: string, slotEnd: string) {
  if (!startDate || !endDate) {
    return false;
  }
  return !(endDate < slotStart || startDate > slotEnd);
}

function WbsTreeNode(props: {
  node: MenuNode;
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  const { node, selectedCode, onSelect } = props;
  const isPage = node.code.length === 8;
  return (
    <li className="space-y-2">
      <button
        className={`flex w-full items-center gap-2 rounded-[var(--kr-gov-radius)] px-3 py-2 text-left text-sm ${selectedCode === node.code ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-primary)] hover:bg-slate-50"} ${isPage ? "border border-slate-200" : "border border-transparent font-semibold"}`}
        onClick={() => {
          if (isPage) onSelect(node.code);
        }}
        type="button"
      >
        <span className="material-symbols-outlined text-base">{node.icon || (isPage ? "article" : "folder")}</span>
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        <span className="text-[11px] opacity-70">{node.code}</span>
      </button>
      {node.children.length > 0 ? (
        <ul className="ml-3 space-y-2 border-l border-slate-200 pl-3">
          {node.children.map((child) => (
            <WbsTreeNode key={child.code} node={child} onSelect={onSelect} selectedCode={selectedCode} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WbsManagementMigrationPage() {
  const en = isEnglish();
  const [menuType, setMenuType] = useState("USER");
  const pageState = useAsyncValue<WbsManagementPagePayload>(() => fetchWbsManagementPage(menuType), [menuType]);
  const [selectedMenuCode, setSelectedMenuCode] = useState("");
  const [editor, setEditor] = useState<WbsEditorState>(editorFromRow(null));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  const menuRows = (pageState.value?.menuRows || []) as Array<Record<string, unknown>>;
  const wbsRows = (pageState.value?.wbsRows || []) as Array<Record<string, unknown>>;
  const inventorySummary = (pageState.value?.inventorySummary || {}) as Record<string, unknown>;
  const waveSummary = (pageState.value?.waveSummary || []) as Array<Record<string, unknown>>;
  const timeline = (pageState.value?.timeline || {}) as Record<string, unknown>;
  const timelineWeeks = (timeline.weeks || []) as Array<Record<string, unknown>>;
  const timelineMonths = (timeline.months || []) as Array<Record<string, unknown>>;
  const statusOptions = (pageState.value?.statusOptions || []) as Array<Record<string, string>>;

  useEffect(() => {
    if (!selectedMenuCode && wbsRows.length > 0) {
      setSelectedMenuCode(stringOf(wbsRows[0], "menuCode"));
      return;
    }
    if (selectedMenuCode && !wbsRows.some((row) => stringOf(row, "menuCode") === selectedMenuCode) && wbsRows.length > 0) {
      setSelectedMenuCode(stringOf(wbsRows[0], "menuCode"));
    }
  }, [selectedMenuCode, wbsRows]);

  const selectedRow = (wbsRows.find((row) => stringOf(row, "menuCode") === selectedMenuCode) || null) as Record<string, unknown> | null;

  useEffect(() => {
    setEditor(editorFromRow(selectedRow));
  }, [selectedMenuCode, selectedRow]);

  const tree = useMemo(() => buildMenuTree(menuRows, { labelKeys: ["codeNm", "code"] }), [menuRows]);

  const filteredRows = useMemo(() => wbsRows.filter((row) => {
    if (statusFilter !== "ALL" && stringOf(row, "status") !== statusFilter) {
      return false;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return (
      stringOf(row, "menuName").toLowerCase().includes(keyword)
      || stringOf(row, "menuCode").toLowerCase().includes(keyword)
      || stringOf(row, "menuUrl").toLowerCase().includes(keyword)
      || stringOf(row, "owner").toLowerCase().includes(keyword)
    );
  }), [searchKeyword, statusFilter, wbsRows]);

  async function handleSave() {
    if (!selectedRow) return;
    logGovernanceScope("ACTION", "wbs-management-save", {
      menuType,
      menuCode: stringOf(selectedRow, "menuCode"),
      status: editor.status,
      progress: editor.progress
    });
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await saveWbsManagementEntry({
        menuType,
        menuCode: stringOf(selectedRow, "menuCode"),
        owner: editor.owner,
        status: editor.status,
        progress: Number(editor.progress || 0),
        plannedStartDate: editor.plannedStartDate,
        plannedEndDate: editor.plannedEndDate,
        actualStartDate: editor.actualStartDate,
        actualEndDate: editor.actualEndDate,
        startDate: editor.plannedStartDate,
        endDate: editor.plannedEndDate,
        notes: editor.notes,
        codexInstruction: editor.codexInstruction
      });
      setMessage(response.message || (en ? "Saved." : "저장했습니다."));
      await pageState.reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : (en ? "Failed to save." : "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  const selectedPrompt = stringOf(selectedRow, "codexPrompt");
  const promptPreview = editor.codexInstruction && !selectedPrompt.includes(editor.codexInstruction)
    ? `${selectedPrompt}\n추가 지시: ${editor.codexInstruction}`
    : selectedPrompt;
  const excelDownloadHref = useMemo(() => {
    const query = new URLSearchParams();
    query.set("menuType", menuType);
    if (statusFilter) {
      query.set("statusFilter", statusFilter);
    }
    if (searchKeyword.trim()) {
      query.set("searchKeyword", searchKeyword.trim());
    }
    return buildLocalizedPath(`/admin/api/admin/wbs-management/excel?${query.toString()}`, `/en/admin/api/admin/wbs-management/excel?${query.toString()}`);
  }, [menuType, searchKeyword, statusFilter]);

  useEffect(() => {
    logGovernanceScope("PAGE", "wbs-management", {
      language: en ? "en" : "ko",
      menuType,
      selectedMenuCode,
      statusFilter,
      searchKeyword: searchKeyword.trim(),
      rowCount: filteredRows.length,
      saving
    });
    logGovernanceScope("COMPONENT", "wbs-summary-cards", {
      scope: stringOf(inventorySummary, "scope"),
      rowCount: filteredRows.length,
      waveCount: waveSummary.length,
      timelineWeekCount: timelineWeeks.length,
      timelineMonthCount: timelineMonths.length
    });
  }, [en, filteredRows.length, inventorySummary, menuType, saving, searchKeyword, selectedMenuCode, statusFilter, timelineMonths.length, timelineWeeks.length, waveSummary.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: "WBS" }
      ]}
      title={en ? "WBS Management" : "WBS 관리"}
      subtitle={en ? "Manage planned vs actual schedules, delay indicators, and Codex execution prompts per DB menu." : "DB 메뉴 기준으로 예상일정/실적일정, 지연 지표, Codex 작업 지시문을 함께 관리합니다."}
    >
      <AdminWorkspacePageFrame>
      {pageState.error || error ? <PageStatusNotice tone="error">{error || pageState.error}</PageStatusNotice> : null}
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6" data-help-id="wbs-summary-cards">
        <SummaryMetricCard title={en ? "Scope" : "범위"} value={stringOf(inventorySummary, "scope") || "-"} />
        <SummaryMetricCard title={en ? "Page Menus" : "페이지 메뉴"} value={numberOf(inventorySummary, "pageMenus")} />
        <SummaryMetricCard accentClassName="text-red-700" surfaceClassName="bg-red-50" title={en ? "Overdue" : "지연"} value={numberOf(inventorySummary, "overdue")} />
        <SummaryMetricCard title={en ? "On-time Rate" : "정시 완료율"} value={`${numberOf(inventorySummary, "onTimeCompletionRate")}%`} />
        <SummaryMetricCard title={en ? "Avg Variance" : "평균 편차"} value={`${numberOf(inventorySummary, "averageVarianceDays")}d`} />
        <SummaryMetricCard title={en ? "Missing Plan" : "예상일정 미입력"} value={numberOf(inventorySummary, "noPlannedDate")} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="wbs-closeout-gate">
          <GridToolbar
            meta={en ? "Separates implemented WBS behavior from the remaining SR/bulk/audit-export contracts." : "이미 구현된 WBS 기능과 아직 필요한 SR/bulk/audit-export 계약을 구분합니다."}
            title={en ? "WBS Completion Gate" : "WBS 완료 게이트"}
          />
          <div className="divide-y divide-slate-100">
            {WBS_CLOSEOUT_ROWS.map((row) => (
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[220px_96px_minmax(0,1fr)]" key={row.labelKo}>
                <div className="font-semibold text-[var(--kr-gov-text-primary)]">{en ? row.labelEn : row.labelKo}</div>
                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.tone === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                    {en ? row.stateEn : row.stateKo}
                  </span>
                </div>
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? row.notesEn : row.notesKo}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="gov-card min-w-0 p-5" data-help-id="wbs-action-contract">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">lock</span>
            <h2 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{en ? "Blocked Actions" : "차단된 조치"}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
            {en
              ? "These actions need backend contracts for SR linkage, bulk mutation, authority checks, and audit evidence before operators can run them."
              : "아래 조치는 SR 연결, 일괄 변경, 권한 검사, 감사 증적 API가 연결되기 전까지 실행하지 않습니다."}
          </p>
          <div className="mt-4 grid gap-2">
            {WBS_ACTION_CONTRACT.map((action) => (
              <button className="gov-btn gov-btn-outline justify-center opacity-60" disabled key={action.labelKo} type="button">
                {en ? action.labelEn : action.labelKo}
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <CollectionResultPanel description={en ? "Filter the WBS tree by menu scope and status before editing a row." : "메뉴 범위와 상태로 WBS 트리를 먼저 좁힌 뒤 행을 수정합니다."} icon="filter_alt" title={en ? "WBS Scope Filter" : "WBS 조회 조건"}>
            <div className="flex flex-wrap gap-2">
              <button className={`gov-btn ${menuType === "USER" ? "gov-btn-primary" : "gov-btn-outline"}`} onClick={() => setMenuType("USER")} type="button">HOME</button>
              <button className={`gov-btn ${menuType === "ADMIN" ? "gov-btn-primary" : "gov-btn-outline"}`} onClick={() => setMenuType("ADMIN")} type="button">ADMIN</button>
            </div>
            <div className="mt-4">
              <label className="gov-label" htmlFor="wbs-search">{en ? "Search" : "검색"}</label>
              <input className="gov-input" id="wbs-search" onChange={(event) => setSearchKeyword(event.target.value)} value={searchKeyword} />
            </div>
            <div className="mt-4">
              <label className="gov-label" htmlFor="wbs-status-filter">{en ? "Status Filter" : "상태 필터"}</label>
              <select className="gov-select" id="wbs-status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{en ? option.labelEn : option.label}</option>
                ))}
              </select>
            </div>
          </CollectionResultPanel>

          <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="wbs-menu-tree">
            <GridToolbar actions={<span className="text-xs text-[var(--kr-gov-text-secondary)]">{wbsRows.length}</span>} meta={en ? "Select a page menu to load the editable plan and Codex prompt." : "페이지 메뉴를 선택하면 편집 폼과 Codex 지시문이 같이 갱신됩니다."} title={en ? "Menu Tree" : "메뉴 트리"} />
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <ul className="space-y-2">
                {tree.map((node) => (
                  <WbsTreeNode key={node.code} node={node} onSelect={setSelectedMenuCode} selectedCode={selectedMenuCode} />
                ))}
              </ul>
            </div>
          </article>
        </aside>

        <div className="min-w-0 space-y-6">
          <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="wbs-execution-table">
            <GridToolbar actions={<a className="gov-btn gov-btn-outline shrink-0" href={excelDownloadHref}>{en ? "Excel Download" : "엑셀 다운로드"}</a>} meta={en ? "Rows are sorted by the earliest planned schedule. Planned and actual dates are separated." : "가장 빠른 예상일정 순으로 정렬되고, 예상일정과 실적일정을 분리해서 봅니다."} title={en ? "Execution WBS" : "실행용 WBS"} />
            <div className="p-6">
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-[var(--kr-gov-text-secondary)]">
              {waveSummary.map((wave) => (
                <span className="rounded-full bg-slate-100 px-3 py-1" key={`${stringOf(wave, "waveOrder")}-${stringOf(wave, "waveLabel")}`}>
                  {stringOf(wave, "waveLabel")} {numberOf(wave, "done")}/{numberOf(wave, "count")} · {en ? "Overdue" : "지연"} {numberOf(wave, "overdue")}
                </span>
              ))}
            </div>
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[1500px] w-full text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3 text-left">WBS</th>
                    <th className="px-4 py-3 text-left">{en ? "Menu" : "메뉴"}</th>
                    <th className="px-4 py-3 text-left">URL</th>
                    <th className="px-4 py-3 text-left">{en ? "Planned" : "예상일정"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Actual" : "작업일정"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Variance" : "편차"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Owner" : "담당"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Progress" : "진행률"}</th>
                    <th className="px-4 py-3 text-left">{en ? "Coverage" : "메타"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                    <tr className={`cursor-pointer align-top ${selectedMenuCode === stringOf(row, "menuCode") ? "bg-blue-50" : "bg-white"}`} key={stringOf(row, "menuCode")} onClick={() => setSelectedMenuCode(stringOf(row, "menuCode"))}>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold">{stringOf(row, "wbsId")}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{stringOf(row, "menuName")}</div>
                        <div className="text-xs text-gray-500">{stringOf(row, "menuCode")} · {stringOf(row, "waveLabel")}</div>
                      </td>
                      <td className="px-4 py-4">
                        <a className="text-[var(--kr-gov-blue)] underline break-all" href={stringOf(row, "menuUrl")} target="_blank" rel="noreferrer">{stringOf(row, "menuUrl") || "-"}</a>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{stringOf(row, "plannedStartDate") || "-"} ~ {stringOf(row, "plannedEndDate") || "-"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{stringOf(row, "actualStartDate") || "-"} ~ {stringOf(row, "actualEndDate") || "-"}</td>
                      <td className={`px-4 py-4 font-semibold ${varianceTone(numberOf(row, "varianceDays"))}`}>
                        {numberOf(row, "varianceDays")}d
                        {stringOf(row, "status") !== "DONE" && String(row["overdue"]) === "true" ? <div className="text-xs text-red-700">{en ? "Overdue" : "지연"}</div> : null}
                      </td>
                      <td className="px-4 py-4">{stringOf(row, "owner") || "-"}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                      <td className="px-4 py-4">{numberOf(row, "progress")}%</td>
                      <td className="px-4 py-4">{numberOf(row, "coverageScore")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </article>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="wbs-editor-panel">
              <GridToolbar meta={selectedRow ? `${stringOf(selectedRow, "menuName")} / ${stringOf(selectedRow, "menuCode")}` : (en ? "Select a menu row." : "메뉴 행을 선택하세요.")} title={en ? "Selected Menu Plan" : "선택 메뉴 계획"} />
              <div className="p-6">
              {!selectedRow ? <div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No menu selected." : "선택된 메뉴가 없습니다."}</div> : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="gov-label" htmlFor="wbs-owner">{en ? "Owner" : "담당자"}</label>
                      <input className="gov-input" id="wbs-owner" onChange={(event) => setEditor((current) => ({ ...current, owner: event.target.value }))} value={editor.owner} />
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="wbs-status">{en ? "Status" : "상태"}</label>
                      <select className="gov-select" id="wbs-status" onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value }))} value={editor.status}>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{en ? option.labelEn : option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="wbs-planned-start">{en ? "Planned Start" : "예상 시작일"}</label>
                      <input className="gov-input" id="wbs-planned-start" onChange={(event) => setEditor((current) => ({ ...current, plannedStartDate: event.target.value }))} type="date" value={editor.plannedStartDate} />
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="wbs-planned-end">{en ? "Planned End" : "예상 종료일"}</label>
                      <input className="gov-input" id="wbs-planned-end" onChange={(event) => setEditor((current) => ({ ...current, plannedEndDate: event.target.value }))} type="date" value={editor.plannedEndDate} />
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="wbs-actual-start">{en ? "Actual Start" : "작업 시작일"}</label>
                      <input className="gov-input" id="wbs-actual-start" onChange={(event) => setEditor((current) => ({ ...current, actualStartDate: event.target.value }))} type="date" value={editor.actualStartDate} />
                    </div>
                    <div>
                      <label className="gov-label" htmlFor="wbs-actual-end">{en ? "Actual End" : "작업 종료일"}</label>
                      <input className="gov-input" id="wbs-actual-end" onChange={(event) => setEditor((current) => ({ ...current, actualEndDate: event.target.value }))} type="date" value={editor.actualEndDate} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="gov-label" htmlFor="wbs-progress">{en ? "Progress" : "진행률"}</label>
                      <div className="flex items-center gap-3">
                        <input className="w-full" id="wbs-progress" max={100} min={0} onChange={(event) => setEditor((current) => ({ ...current, progress: event.target.value }))} type="range" value={editor.progress} />
                        <span className="w-12 text-right text-sm font-bold">{editor.progress}%</span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="gov-label" htmlFor="wbs-notes">{en ? "Execution Notes" : "작업 메모"}</label>
                      <textarea className="w-full min-h-[120px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm" id="wbs-notes" onChange={(event) => setEditor((current) => ({ ...current, notes: event.target.value }))} value={editor.notes} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="gov-label" htmlFor="wbs-codex-instruction">{en ? "Codex Extra Instruction" : "Codex 추가 지시"}</label>
                      <textarea className="w-full min-h-[120px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm" id="wbs-codex-instruction" onChange={(event) => setEditor((current) => ({ ...current, codexInstruction: event.target.value }))} value={editor.codexInstruction} />
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Page ID" : "페이지 ID"}</div>
                      <div className="mt-1 font-semibold">{stringOf(selectedRow, "pageId") || "-"}</div>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Variance" : "일정 편차"}</div>
                      <div className={`mt-1 font-semibold ${varianceTone(numberOf(selectedRow, "varianceDays"))}`}>{numberOf(selectedRow, "varianceDays")}d</div>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Planned Days" : "예상 공기"}</div>
                      <div className="mt-1 font-semibold">{numberOf(selectedRow, "plannedDurationDays")}d</div>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Actual Days" : "실작업 공기"}</div>
                      <div className="mt-1 font-semibold">{numberOf(selectedRow, "actualDurationDays")}d</div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button className="gov-btn gov-btn-primary" disabled={saving} onClick={() => { void handleSave(); }} type="button">{saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Plan" : "계획 저장")}</button>
                    <button className="gov-btn gov-btn-outline" onClick={() => setEditor(editorFromRow(selectedRow))} type="button">{en ? "Reset Form" : "폼 초기화"}</button>
                    <a className="gov-btn gov-btn-outline" href={stringOf(selectedRow, "menuUrl")} rel="noreferrer" target="_blank">{en ? "Open Page" : "화면 열기"}</a>
                  </div>
                </>
              )}
              </div>
            </article>

            <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="wbs-codex-prompt">
              <GridToolbar meta={en ? "Prompt includes planned/actual dates, variance, backend chain, and extra instruction." : "지시문에 예상/실적 일정, 편차, 백엔드 체인, 추가 지시를 함께 넣습니다."} title={en ? "Codex Work Instruction" : "Codex 작업 지시문"} />
              <div className="p-6">
              <textarea className="w-full min-h-[420px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100" readOnly value={promptPreview} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="gov-btn gov-btn-primary" onClick={() => { void navigator.clipboard.writeText(promptPreview); }} type="button">{en ? "Copy Prompt" : "지시문 복사"}</button>
                <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/system/codex-request", "/en/admin/system/codex-request")} target="_blank" rel="noreferrer">{en ? "Open Codex Request" : "Codex 요청 열기"}</a>
              </div>
              </div>
            </article>
          </section>

          <article className="gov-card min-w-0 overflow-hidden p-0">
            <GridToolbar meta={en ? "Week view is the most readable here. Planned bars use light tone and actual bars use stronger tone." : "월/일보다 주차 기준이 가장 보기 좋아서 주간 보기로 고정했습니다. 예상 막대는 연한 톤, 실제 막대는 진한 톤으로 구분합니다."} title={en ? "Weekly Schedule Timeline" : "주차 기준 일정표"} />
            <div className="p-6">
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[1800px] w-full text-xs">
                <thead>
                  <tr className="gov-table-header">
                    <th className="sticky left-0 z-20 bg-slate-100 px-4 py-3 text-left" rowSpan={2}>Menu</th>
                    {timelineMonths.map((month) => (
                      <th className="px-3 py-2 text-center" colSpan={Math.max(1, numberOf(month, "span"))} key={stringOf(month, "key")}>{stringOf(month, "label")}</th>
                    ))}
                  </tr>
                  <tr className="gov-table-header">
                    {timelineWeeks.map((week) => (
                      <th className="px-3 py-3 text-center" key={stringOf(week, "key")}>{stringOf(week, "label")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={`timeline-${stringOf(row, "menuCode")}`}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <div className="font-semibold">{stringOf(row, "menuName")}</div>
                        <div className="text-[11px] text-slate-500">{stringOf(row, "menuCode")} · {stringOf(row, "owner") || "-"}</div>
                      </td>
                      {timelineWeeks.map((week) => {
                        const plannedActive = spanActive(stringOf(row, "plannedStartDate"), stringOf(row, "plannedEndDate"), stringOf(week, "startDate"), stringOf(week, "endDate"));
                        const actualActive = spanActive(stringOf(row, "actualStartDate"), stringOf(row, "actualEndDate"), stringOf(week, "startDate"), stringOf(week, "endDate"));
                        return (
                          <td className="px-2 py-2" key={`${stringOf(row, "menuCode")}-${stringOf(week, "key")}`}>
                            <div className="space-y-1">
                              <div className={`h-3 rounded-full ${plannedActive ? "bg-slate-300" : "bg-slate-50"}`} />
                              <div className={`h-3 rounded-full ${actualActive ? (stringOf(row, "status") === "DONE" ? "bg-emerald-500" : stringOf(row, "status") === "BLOCKED" ? "bg-red-500" : "bg-blue-500") : "bg-slate-100"}`} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--kr-gov-text-secondary)]">
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-full bg-slate-300" />{en ? "Planned" : "예상일정"}</span>
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-full bg-blue-500" />{en ? "Actual In Progress" : "작업일정 진행중"}</span>
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-full bg-emerald-500" />{en ? "Actual Done" : "작업일정 완료"}</span>
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-full bg-red-500" />{en ? "Actual Blocked" : "작업일정 지연"}</span>
            </div>
            </div>
          </article>
        </div>
      </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
