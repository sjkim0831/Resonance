import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchMenuManagementPage, fetchScreenCommandPage, saveScreenCommandMenuMapping } from "../../lib/api/platform";
import type { MenuManagementPagePayload, ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GridToolbar, KeyValueGridPanel, PageStatusNotice, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { stringOf } from "../admin-system/adminSystemShared";
import { toDisplayMenuUrl } from "../menu-management/menuUrlDisplay";
import { AdminSelect, MemberButton } from "../member/common";
import {
  createEmptyScreenCommandPagePayload,
  resolveScreenCommandSummaryMetrics,
  ScreenManagementCatalogPanel,
  ScreenManagementSelectionOverview,
  ScreenManagementSummaryGrid
} from "./shared";

type AssignmentRow = {
  menuCode: string;
  menuName: string;
  menuUrl: string;
  menuIcon: string;
  useAt: string;
  expsrAt: string;
  pageId: string;
  routePath: string;
  status: "assigned" | "unassigned";
};

type ScreenMenuAssignmentCloseoutRow = {
  labelKo: string;
  labelEn: string;
  status: "available" | "blocked";
  descriptionKo: string;
  descriptionEn: string;
};

const SCREEN_MENU_ASSIGNMENT_CLOSEOUT_ROWS: ScreenMenuAssignmentCloseoutRow[] = [
  {
    labelKo: "메뉴 인벤토리 / 귀속 목록",
    labelEn: "Menu inventory / assignment list",
    status: "available",
    descriptionKo: "관리자/홈 메뉴 수집, 귀속/미귀속 필터, 선택 메뉴 메타데이터 확인은 현재 화면에서 제공합니다.",
    descriptionEn: "Admin/home menu collection, assigned/unassigned filtering, and selected menu metadata are available."
  },
  {
    labelKo: "단일 메뉴 매핑 저장",
    labelEn: "Single menu mapping save",
    status: "available",
    descriptionKo: "선택 메뉴를 screen command page에 단건 매핑하는 저장 흐름은 연결되어 있습니다.",
    descriptionEn: "A single selected menu can be mapped to a screen command page through the current save flow."
  },
  {
    labelKo: "중복 / 충돌 검증",
    labelEn: "Duplicate / conflict detection",
    status: "blocked",
    descriptionKo: "동일 route/pageId/menuCode 중복, 관리자/홈 scope 충돌, 기존 귀속 교체 검증 계약이 필요합니다.",
    descriptionEn: "Duplicate route/pageId/menuCode checks, admin/home scope conflict checks, and replacement validation contracts are required."
  },
  {
    labelKo: "권한 영향도 Preview",
    labelEn: "Authority impact preview",
    status: "blocked",
    descriptionKo: "매핑 저장 전에 feature, role, user override, required VIEW 영향도를 계산하는 preview가 필요합니다.",
    descriptionEn: "A preview is required before save to calculate feature, role, user override, and required VIEW impact."
  },
  {
    labelKo: "Rollback / 감사 증적",
    labelEn: "Rollback / audit evidence",
    status: "blocked",
    descriptionKo: "변경 전후 귀속 상태, rollback anchor, 승인자, 실행자를 감사 증적으로 남기는 계약이 필요합니다.",
    descriptionEn: "Before/after assignment state, rollback anchor, approver, and actor must be stored as audit evidence."
  }
];

const SCREEN_MENU_ASSIGNMENT_ACTION_CONTRACT = [
  { labelKo: "충돌 검사", labelEn: "Check Conflicts" },
  { labelKo: "권한 영향도 Preview", labelEn: "Preview Authority Impact" },
  { labelKo: "Bulk 매핑", labelEn: "Bulk Mapping" },
  { labelKo: "Rollback", labelEn: "Rollback" },
  { labelKo: "감사 증적 내보내기", labelEn: "Export Audit Evidence" }
];

function isPageMenu(row: Record<string, unknown>) {
  return stringOf(row, "code").trim().length === 8 && stringOf(row, "menuUrl").trim() !== "";
}

function normalizePath(value: string) {
  return value.trim().replace(/^\/en/, "");
}

function buildAssignments(
  menuRows: Array<Record<string, unknown>>,
  pages: ScreenCommandPagePayload["pages"] | undefined
) {
  const pageList = pages || [];
  return menuRows
    .filter(isPageMenu)
    .map((row): AssignmentRow => {
      const menuCode = stringOf(row, "code").toUpperCase();
      const menuUrl = toDisplayMenuUrl(stringOf(row, "menuUrl"));
      const matched = pageList.find((page) => (
        String(page.menuCode || "").toUpperCase() === menuCode
          || normalizePath(String(page.routePath || "")) === normalizePath(menuUrl)
      ));
      return {
        menuCode,
        menuName: stringOf(row, "codeNm", "codeDc", "code"),
        menuUrl,
        menuIcon: stringOf(row, "menuIcon") || "menu",
        useAt: stringOf(row, "useAt") || "Y",
        expsrAt: stringOf(row, "expsrAt") || "Y",
        pageId: matched?.pageId || "",
        routePath: matched?.routePath || "",
        status: matched ? "assigned" : "unassigned"
      };
    });
}

export function ScreenMenuAssignmentManagementMigrationPage() {
  const en = isEnglish();
  const [menuType, setMenuType] = useState("ADMIN");
  const [filter, setFilter] = useState("");
  const [selectedMenuCode, setSelectedMenuCode] = useState("");
  const [selectedTargetPageId, setSelectedTargetPageId] = useState("");
  const [mappingMessage, setMappingMessage] = useState("");
  const [mappingError, setMappingError] = useState("");
  const [mappingSaving, setMappingSaving] = useState(false);
  const menuState = useAsyncValue<MenuManagementPagePayload>(() => fetchMenuManagementPage(menuType), [menuType]);
  const catalogState = useAsyncValue<ScreenCommandPagePayload>(() => fetchScreenCommandPage(""), []);
  const assignments = useMemo(
    () => buildAssignments((menuState.value?.menuRows || []) as Array<Record<string, unknown>>, catalogState.value?.pages),
    [catalogState.value?.pages, menuState.value?.menuRows]
  );
  const filteredAssignments = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) {
      return assignments;
    }
    return assignments.filter((row) => {
      const haystack = `${row.menuCode} ${row.menuName} ${row.menuUrl} ${row.pageId} ${row.routePath}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [assignments, filter]);

  useEffect(() => {
    setSelectedMenuCode("");
  }, [menuType]);

  useEffect(() => {
    if (!selectedMenuCode && filteredAssignments.length > 0) {
      setSelectedMenuCode(filteredAssignments[0].menuCode);
      return;
    }
    if (selectedMenuCode && filteredAssignments.every((item) => item.menuCode !== selectedMenuCode) && filteredAssignments.length > 0) {
      setSelectedMenuCode(filteredAssignments[0].menuCode);
    }
  }, [filteredAssignments, selectedMenuCode]);

  const selectedAssignment = filteredAssignments.find((item) => item.menuCode === selectedMenuCode) || null;
  const detailState = useAsyncValue<ScreenCommandPagePayload>(
    () => (selectedAssignment?.pageId ? fetchScreenCommandPage(selectedAssignment.pageId) : Promise.resolve(createEmptyScreenCommandPagePayload())),
    [selectedAssignment?.pageId || ""]
  );

  const orphanPages = useMemo(() => {
    const linkedPageIds = new Set(assignments.map((item) => item.pageId).filter(Boolean));
    return (catalogState.value?.pages || []).filter((page) => !linkedPageIds.has(page.pageId));
  }, [assignments, catalogState.value?.pages]);

  const error = menuState.error || catalogState.error || detailState.error;
  const assignedCount = assignments.filter((item) => item.status === "assigned").length;
  const unassignedCount = assignments.filter((item) => item.status === "unassigned").length;
  const detailPage = detailState.value?.page || createEmptyScreenCommandPagePayload().page;
  const detailMetrics = resolveScreenCommandSummaryMetrics(detailPage);
  const availablePageOptions = useMemo(() => {
    const targetDomain = menuType === "ADMIN" ? "admin" : "home";
    return (catalogState.value?.pages || []).filter((page) => {
      const routePath = String(page.routePath || "");
      const domainCode = String(page.domainCode || "").toLowerCase();
      if (targetDomain === "admin") {
        return routePath.startsWith("/admin/") || routePath.startsWith("/en/admin/") || domainCode === "admin";
      }
      return !routePath.startsWith("/admin/") && !routePath.startsWith("/en/admin/") && domainCode !== "admin";
    });
  }, [catalogState.value?.pages, menuType]);

  useEffect(() => {
    if (!selectedAssignment) {
      setSelectedTargetPageId("");
      return;
    }
    const defaultPageId = selectedAssignment.pageId || availablePageOptions[0]?.pageId || "";
    setSelectedTargetPageId(defaultPageId);
  }, [availablePageOptions, selectedAssignment]);

  useEffect(() => {
    logGovernanceScope("PAGE", "screen-menu-assignment-management", {
      language: en ? "en" : "ko",
      menuType,
      selectedMenuCode,
      assignmentCount: assignments.length,
      assignedCount,
      unassignedCount,
      orphanPageCount: orphanPages.length
    });
    logGovernanceScope("COMPONENT", "screen-menu-assignment-catalog", {
      filter,
      filteredAssignmentCount: filteredAssignments.length,
      selectedMenuCode
    });
  }, [assignedCount, assignments.length, en, filter, filteredAssignments.length, menuType, orphanPages.length, selectedMenuCode, unassignedCount]);

  async function handleSaveMapping() {
    if (!selectedAssignment || !selectedTargetPageId) {
      return;
    }
    setMappingSaving(true);
    setMappingError("");
    setMappingMessage("");
    try {
      const targetPage = availablePageOptions.find((item) => item.pageId === selectedTargetPageId);
      await saveScreenCommandMenuMapping({
        pageId: selectedTargetPageId,
        menuCode: selectedAssignment.menuCode,
        menuName: selectedAssignment.menuName || targetPage?.label || selectedTargetPageId,
        menuUrl: selectedAssignment.menuUrl,
        domainCode: menuType === "ADMIN" ? "admin" : "home"
      });
      await Promise.all([menuState.reload(), catalogState.reload(), detailState.reload()]);
      setMappingMessage(en ? "Menu mapping saved." : "메뉴 귀속을 저장했습니다.");
    } catch (nextError) {
      setMappingError(nextError instanceof Error ? nextError.message : (en ? "Failed to save menu mapping." : "메뉴 귀속 저장에 실패했습니다."));
    } finally {
      setMappingSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Environment" : "환경" },
        { label: en ? "Screen-Menu Assignment Management" : "화면-메뉴 귀속 관리" }
      ]}
      title={en ? "Screen-Menu Assignment Management" : "화면-메뉴 귀속 관리"}
      subtitle={en ? "Check which page menu is bound to which screen command page, and spot unassigned or orphaned entries." : "페이지 메뉴가 어떤 screen command 페이지에 귀속됐는지 확인하고, 미귀속/고아 상태를 점검합니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {mappingError ? <PageStatusNotice tone="error">{mappingError}</PageStatusNotice> : null}
        {mappingMessage ? <PageStatusNotice tone="success">{mappingMessage}</PageStatusNotice> : null}

        <ScreenManagementSummaryGrid
          dataHelpId="screen-menu-assignment-summary"
          items={[
            {
              title: en ? `${menuType} Page Menus` : `${menuType === "ADMIN" ? "관리자" : "홈"} 페이지 메뉴`,
              value: assignments.length,
              description: en ? "8-digit page menus with a runtime route." : "runtime URL이 등록된 8자리 페이지 메뉴 수입니다."
            },
            {
              title: en ? "Assigned" : "귀속 완료",
              value: assignedCount,
              description: en ? "Menus linked to a screen command page." : "screen command 페이지와 연결된 메뉴 수입니다.",
              accentClassName: "text-emerald-700",
              surfaceClassName: "bg-emerald-50",
              dataHelpId: "screen-menu-assignment-catalog"
            },
            {
              title: en ? "Unassigned" : "미귀속",
              value: unassignedCount,
              description: en ? "Menus still missing a matching page." : "연결 화면이 아직 없는 메뉴 수입니다.",
              accentClassName: "text-amber-700",
              surfaceClassName: "bg-amber-50"
            },
            {
              title: en ? "Orphaned Screens" : "고아 화면",
              value: orphanPages.length,
              description: en ? "Screen pages with no linked page menu." : "페이지 메뉴에 연결되지 않은 화면 수입니다.",
              accentClassName: "text-slate-700",
              surfaceClassName: "bg-slate-100"
            }
          ]}
        />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.65fr]">
          <article className="gov-card" data-help-id="screen-menu-assignment-closeout-gate">
            <div className="flex flex-col gap-2 border-b border-[var(--kr-gov-border-light)] pb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
              <h2 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Current mapping support vs. blocked governance actions" : "현재 매핑 지원 범위와 차단된 거버넌스 조치"}</h2>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Single menu mapping is available, but conflict checks, authority impact preview, rollback, and audit evidence remain blocked governance work."
                  : "단일 메뉴 매핑은 가능하지만 충돌 검증, 권한 영향도 preview, rollback, 감사 증적은 아직 차단된 거버넌스 작업입니다."}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {SCREEN_MENU_ASSIGNMENT_CLOSEOUT_ROWS.map((row) => (
                <article key={row.labelEn} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? row.labelEn : row.labelKo}</h3>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${row.status === "available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.status === "available" ? (en ? "Available" : "가능") : (en ? "Blocked" : "차단")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? row.descriptionEn : row.descriptionKo}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="gov-card" data-help-id="screen-menu-assignment-action-contract">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Action Contract" : "실행 계약"}</p>
            <h2 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Disabled until governance APIs exist" : "거버넌스 API 연결 전까지 비활성"}</h2>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {SCREEN_MENU_ASSIGNMENT_ACTION_CONTRACT.map((action) => (
                <button key={action.labelEn} className="gov-btn gov-btn-outline justify-center opacity-65" type="button" disabled>
                  {en ? action.labelEn : action.labelKo}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold text-[var(--kr-gov-text-secondary)]">
              {en ? "These actions require conflict rules, authority impact calculation, rollback state, and audit persistence." : "이 조치들은 충돌 규칙, 권한 영향 계산, rollback 상태, 감사 저장이 연결되어야 합니다."}
            </p>
          </article>
        </section>

        <section className="gov-card p-6">
          <GridToolbar
            meta={en ? "Collect menu inventory from menu management and switch between admin and home sources." : "메뉴 관리 기준으로 메뉴 인벤토리를 수집하고 관리자/홈 소스를 전환합니다."}
            title={en ? "Menu Collection Source" : "메뉴 수집 소스"}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <MemberButton onClick={() => setMenuType("ADMIN")} type="button" variant={menuType === "ADMIN" ? "primary" : "secondary"}>
              {en ? "Admin Menus" : "관리자 메뉴"}
            </MemberButton>
            <MemberButton onClick={() => setMenuType("HOME")} type="button" variant={menuType === "HOME" ? "primary" : "secondary"}>
              {en ? "Home Menus" : "홈 메뉴"}
            </MemberButton>
            <MemberButton onClick={() => { void menuState.reload(); }} type="button" variant="secondary">
              {en ? "Collect Again" : "다시 수집"}
            </MemberButton>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[24rem_1fr]">
          <ScreenManagementCatalogPanel
            count={filteredAssignments.length}
            dataHelpId="screen-menu-assignment-catalog"
            emptyLabel={en ? "No assignments matched the filter." : "검색 조건과 일치하는 귀속 대상이 없습니다."}
            filterPlaceholder={en ? "Search menu code, path, page ID" : "메뉴 코드, 경로, page ID 검색"}
            filterValue={filter}
            items={filteredAssignments.map((row) => ({
              key: row.menuCode,
              title: row.menuName,
              subtitle: row.menuCode,
              description: row.menuUrl || "-",
              badge: (
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.status === "assigned" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {row.status === "assigned" ? (en ? "Assigned" : "귀속") : (en ? "Unassigned" : "미귀속")}
                </span>
              ),
              active: row.menuCode === selectedMenuCode,
              onSelect: () => setSelectedMenuCode(row.menuCode)
            }))}
            onFilterChange={(event) => setFilter(event.target.value)}
            title={en ? "Menu Assignment List" : "귀속 목록"}
          />

          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <ScreenManagementSelectionOverview
                className="flex-1"
                badges={selectedAssignment ? (
                  <>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedAssignment.status === "assigned" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {selectedAssignment.status === "assigned" ? (en ? "Screen linked" : "화면 연결됨") : (en ? "No linked screen" : "연결된 화면 없음")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {`${en ? "Use" : "사용"} ${selectedAssignment.useAt} / ${en ? "Expose" : "노출"} ${selectedAssignment.expsrAt}`}
                    </span>
                  </>
                ) : null}
                description={selectedAssignment?.menuUrl || "-"}
                metaDescription={en ? "The selected menu's runtime path and linked page identity." : "선택 메뉴의 runtime 경로와 연결 화면 식별자입니다."}
                metaItems={[
                  { label: en ? "Menu Code" : "메뉴 코드", value: selectedAssignment?.menuCode || "-" },
                  { label: en ? "Page ID" : "페이지 ID", value: selectedAssignment?.pageId || "-" },
                  { label: en ? "Route" : "경로", value: selectedAssignment?.routePath || "-" },
                  { label: en ? "Linked Components" : "연결 컴포넌트", value: detailMetrics.componentCount }
                ]}
                metaTitle={en ? "Selected Assignment Metadata" : "선택 귀속 메타데이터"}
                title={selectedAssignment?.menuName || (en ? "Select a menu" : "메뉴를 선택하세요")}
              />
              {selectedAssignment?.pageId ? (
                <div className="shrink-0 pt-1 pl-1">
                  <a
                    href={buildLocalizedPath(`/admin/system/asset-detail?id=UI-${selectedAssignment.pageId}`, `/en/admin/system/asset-detail?id=UI-${selectedAssignment.pageId}`)}
                    className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--kr-gov-blue)] focus:ring-offset-1"
                  >
                    {en ? "View Asset details" : "자산 거버넌스 상세"}
                  </a>
                </div>
              ) : null}
            </div>

            <section className="gov-card overflow-hidden p-0" data-help-id="screen-menu-assignment-detail">
              <GridToolbar
                meta={en ? "Inspect registry binding, required VIEW feature, and relation-table traces." : "레지스트리 귀속, 필수 VIEW 기능, 권한 연계 테이블을 함께 점검합니다."}
                title={en ? "Assignment Detail" : "귀속 상세"}
              />
              <div className="p-6">
                {!selectedAssignment ? (
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a menu to inspect the binding." : "귀속 상태를 보려면 메뉴를 선택하세요."}</p>
                ) : selectedAssignment.status === "unassigned" ? (
                  <div className="space-y-4">
                    <WarningPanel title={en ? "No linked screen page" : "연결된 화면 페이지 없음"}>
                      {en ? "This menu exists in menu management, but no screen command page is linked by menu code or route path yet." : "이 메뉴는 menu management에는 존재하지만, 메뉴 코드 또는 route path 기준으로 연결된 screen command 페이지가 아직 없습니다."}
                    </WarningPanel>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Page" : "매핑 대상 페이지"}</span>
                        <AdminSelect value={selectedTargetPageId} onChange={(event) => setSelectedTargetPageId(event.target.value)}>
                          <option value="">{en ? "Select page" : "페이지 선택"}</option>
                          {availablePageOptions.map((page) => (
                            <option key={page.pageId} value={page.pageId}>
                              {`${page.label || page.pageId} · ${page.pageId}`}
                            </option>
                          ))}
                        </AdminSelect>
                      </label>
                      <MemberButton disabled={!selectedTargetPageId || mappingSaving} onClick={() => { void handleSaveMapping(); }} type="button" variant="primary">
                        {mappingSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Map Selected Menu" : "선택 메뉴 매핑")}
                      </MemberButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Page" : "매핑 대상 페이지"}</span>
                        <AdminSelect value={selectedTargetPageId} onChange={(event) => setSelectedTargetPageId(event.target.value)}>
                          <option value="">{en ? "Select page" : "페이지 선택"}</option>
                          {availablePageOptions.map((page) => (
                            <option key={page.pageId} value={page.pageId}>
                              {`${page.label || page.pageId} · ${page.pageId}`}
                            </option>
                          ))}
                        </AdminSelect>
                      </label>
                      <MemberButton disabled={!selectedTargetPageId || mappingSaving} onClick={() => { void handleSaveMapping(); }} type="button" variant="primary">
                        {mappingSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Mapping" : "매핑 저장")}
                      </MemberButton>
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <KeyValueGridPanel
                        description={en ? "Registry identity and layout version resolved from the selected page." : "선택 화면에서 해석된 registry 식별자와 레이아웃 버전입니다."}
                        items={[
                          { label: en ? "Page Name" : "페이지명", value: detailPage.manifestRegistry?.pageName || detailPage.label || "-" },
                          { label: en ? "Layout Version" : "레이아웃 버전", value: detailPage.manifestRegistry?.layoutVersion || "-" },
                          { label: en ? "Components" : "컴포넌트 수", value: detailMetrics.componentCount },
                          { label: en ? "Surfaces / Events" : "Surface / 이벤트", value: `${detailMetrics.surfaceCount} / ${detailMetrics.eventCount}` }
                        ]}
                        title={en ? "Manifest Registry" : "Manifest Registry"}
                      />
                      <KeyValueGridPanel
                        description={en ? "Permission binding remains the canonical source for menu VIEW access." : "메뉴 VIEW 접근은 여기 표시된 권한 귀속을 기준으로 봅니다."}
                        items={[
                          { label: en ? "Required View Feature" : "필수 VIEW 기능", value: detailPage.menuPermission?.requiredViewFeatureCode || "-" },
                          { label: en ? "Feature Rows" : "기능 행 수", value: detailMetrics.featureCount },
                          { label: en ? "Relation Tables" : "연계 테이블", value: (detailPage.menuPermission?.relationTables || []).join(", ") || "-" },
                          { label: en ? "Schemas" : "스키마", value: detailMetrics.schemaCount }
                        ]}
                        title={en ? "Permission Binding" : "권한 귀속"}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="gov-card overflow-hidden p-0" data-help-id="screen-menu-assignment-orphans">
              <GridToolbar
                meta={en ? "These pages exist in the screen registry but have no matching page menu binding." : "screen registry에는 있지만 대응하는 페이지 메뉴 귀속이 없는 화면입니다."}
                title={en ? "Orphaned Screen Pages" : "고아 화면 목록"}
              />
              <div className="overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>{en ? "Page ID" : "페이지 ID"}</th>
                      <th>{en ? "Label" : "화면명"}</th>
                      <th>{en ? "Route" : "경로"}</th>
                      <th>{en ? "Menu Code" : "메뉴 코드"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanPages.length === 0 ? (
                      <tr>
                        <td className="text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                          {en ? "No orphaned screen page exists." : "고아 상태의 화면 페이지가 없습니다."}
                        </td>
                      </tr>
                    ) : (
                      orphanPages.map((page) => (
                        <tr key={page.pageId}>
                          <td>{page.pageId}</td>
                          <td>{page.label || "-"}</td>
                          <td>{page.routePath || "-"}</td>
                          <td>{page.menuCode || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
