import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  type FrameworkAuthorityRoleContract,
  useFrameworkAuthorityContract
} from "../../framework";
import {
  autoCollectFullStackGovernanceRegistry,
  fetchFullStackGovernanceRegistry,
  fetchFullStackManagementPage,
  fetchScreenCommandPage,
  saveFullStackGovernanceRegistry
} from "../../lib/api/platform";
import { postFormUrlEncoded } from "../../lib/api/core";
import { getScreenCommandChainText, getScreenCommandChainValues } from "../../lib/api/screenCommand";
import type {
  FullStackGovernanceRegistryEntry,
  MenuManagementPagePayload,
  ScreenCommandPagePayload
} from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { authorDesignContextKeys } from "../admin-ui/contextKeyPresets";
import { SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";
import { toDisplayMenuUrl } from "./menuUrlDisplay";
import { buildSuggestedPageCode } from "./menuTreeShared";
import {
  buildSeedRegistry,
  buildTree,
  editorFromRegistry,
  flattenPayload,
  mergeLineBlock,
  resolveGovernancePageId,
  splitLines,
  summarizeFields,
  type MenuNode,
  type RegistryEditorState,
  uniqueLines,
  updateSortOrders,
  validateRegistryEditor
} from "./fullStackManagementRegistry";

export function FullStackManagementMigrationPage() {
  const en = isEnglish();
  const [menuType, setMenuType] = useState(new URLSearchParams(window.location.search).get("menuType") || "ADMIN");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const pageState = useAsyncValue<MenuManagementPagePayload>(() => fetchFullStackManagementPage(menuType), [menuType]);
  const page = pageState.value;
  const [treeData, setTreeData] = useState<MenuNode[]>([]);
  const [parentCodeValue, setParentCodeValue] = useState("");
  const [codeNm, setCodeNm] = useState("");
  const [codeDc, setCodeDc] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuIcon, setMenuIcon] = useState("web");
  const [useAt, setUseAt] = useState("Y");
  const [selectedMenuCode, setSelectedMenuCode] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [screenCatalog, setScreenCatalog] = useState<ScreenCommandPagePayload | null>(null);
  const [governancePage, setGovernancePage] = useState<ScreenCommandPagePayload | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceError, setGovernanceError] = useState("");
  const [registryEntry, setRegistryEntry] = useState<FullStackGovernanceRegistryEntry | null>(null);
  const [registryEditor, setRegistryEditor] = useState<RegistryEditorState>(() => editorFromRegistry(buildSeedRegistry("", null, "", null)));
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registrySaving, setRegistrySaving] = useState(false);
  const [registryCollecting, setRegistryCollecting] = useState(false);
  const [lastAutoCollectedKey, setLastAutoCollectedKey] = useState("");
  const {
    builderReadyRoles: authorityRoles,
    roleCategoryOptions: authorityRoleCategoryOptions,
    assignmentAuthorities: authorityAssignmentAuthorities,
    roleCategories: authorityRoleCategories,
    loading: authorityLoading
  } = useFrameworkAuthorityContract();
  const deferredMenuSearch = useDeferredValue(menuSearch);

  const rows = useMemo(() => (page?.menuRows || []) as Array<Record<string, unknown>>, [page?.menuRows]);
  const menuTypes = ((page?.menuTypes || []) as Array<Record<string, unknown>>);
  const groupMenuOptions = ((page?.groupMenuOptions || []) as Array<Record<string, string>>);
  const iconOptions = ((page?.iconOptions || []) as string[]);
  const useAtOptions = ((page?.useAtOptions || []) as string[]);
  const fullStackSummaryRows = ((page?.fullStackSummaryRows || []) as Array<Record<string, unknown>>);
  const menuCodeRows = useMemo(() => rows.map((row) => ({ code: stringOf(row, "code").toUpperCase() })), [rows]);
  const rowByCode = useMemo(() => {
    const next = new Map<string, Record<string, unknown>>();
    rows.forEach((row) => {
      const code = stringOf(row, "code").toUpperCase();
      if (code) {
        next.set(code, row);
      }
    });
    return next;
  }, [rows]);
  const selectedMenuRow = rowByCode.get(selectedMenuCode) || null;
  const selectedMenuIsPage = selectedMenuCode.length === 8;
  const selectedMenuLabel = stringOf(selectedMenuRow, "codeNm", "codeDc", "code");
  const governanceDetail = governancePage?.page;
  const governancePageId = useMemo(() => {
    return resolveGovernancePageId(selectedMenuRow, screenCatalog?.pages);
  }, [screenCatalog?.pages, selectedMenuRow]);
  const governanceTables = useMemo(() => {
    if (!governanceDetail) {
      return [];
    }
    return Array.from(new Set([
      ...(governanceDetail.apis || []).flatMap((item) => item.relatedTables || []),
      ...(governanceDetail.schemas || []).map((item) => item.tableName).filter(Boolean),
      ...(governanceDetail.menuPermission?.relationTables || [])
    ].filter(Boolean)));
  }, [governanceDetail]);
  const governanceColumns = useMemo(() => (
    governanceDetail?.schemas || []
  ).flatMap((item) => item.columns || []), [governanceDetail]);
  const governanceWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!selectedMenuCode) {
      return warnings;
    }
    if (selectedMenuCode.length !== 8) {
      warnings.push(en ? "Only 8-digit page menus can map to full-stack governance metadata." : "8자리 페이지 메뉴만 풀스택 거버넌스 메타데이터와 직접 연결됩니다.");
    }
    if (selectedMenuCode.length === 8 && !governancePageId) {
      warnings.push(en ? "This page menu exists in menu metadata but is not mapped in the screen command registry." : "이 페이지 메뉴는 메뉴 메타데이터에는 있지만 screen command registry에 매핑되어 있지 않습니다.");
    }
    if (governanceDetail && !governanceDetail.manifestRegistry?.pageId) {
      warnings.push(en ? "UI manifest registry is missing for this page." : "이 페이지의 UI manifest registry가 아직 없습니다.");
    }
    if (governanceDetail && !(governanceDetail.menuPermission?.requiredViewFeatureCode || "")) {
      warnings.push(en ? "Default VIEW permission could not be resolved." : "기본 VIEW 권한을 해석하지 못했습니다.");
    }
    if (governanceDetail && (governanceDetail.schemas || []).length === 0) {
      warnings.push(en ? "No schema or table metadata is registered yet." : "스키마 또는 테이블 메타데이터가 아직 등록되지 않았습니다.");
    }
    return warnings;
  }, [en, governanceDetail, governancePageId, selectedMenuCode]);

  useEffect(() => {
    logGovernanceScope("PAGE", "full-stack-management", {
      language: en ? "en" : "ko",
      menuType,
      selectedMenuCode,
      selectedMenuIsPage,
      filteredMenuCount: rows.length,
      registrySaving,
      registryCollecting
    });
    logGovernanceScope("COMPONENT", "full-stack-management-registry", {
      governancePageId,
      governanceTableCount: governanceTables.length,
      governanceColumnCount: governanceColumns.length,
      warningCount: governanceWarnings.length
    });
  }, [
    en,
    governanceColumns.length,
    governancePageId,
    governanceTables.length,
    governanceWarnings.length,
    menuType,
    registryCollecting,
    registrySaving,
    rows.length,
    selectedMenuCode,
    selectedMenuIsPage
  ]);
  const coverageOverview = useMemo(() => {
    const total = fullStackSummaryRows.length;
    const strong = fullStackSummaryRows.filter((row) => numberOf(row, "coverageScore") >= 70).length;
    const weak = fullStackSummaryRows.filter((row) => numberOf(row, "coverageScore") < 40).length;
    const missingView = fullStackSummaryRows.filter((row) => !stringOf(row, "requiredViewFeatureCode")).length;
    return { total, strong, weak, missingView };
  }, [fullStackSummaryRows]);
  const governanceFeatureCodes = useMemo(() => uniqueLines([
    ...splitLines(registryEditor.featureCodes),
    ...((governanceDetail?.menuPermission?.featureCodes || []).map((item) => String(item || ""))),
    ...((governanceDetail?.menuPermission?.featureRows || []).map((item) => String(item.featureCode || "")))
  ].map((item) => item.toUpperCase())), [governanceDetail, registryEditor.featureCodes]);
  const deferredGovernanceFeatureCodes = useDeferredValue(governanceFeatureCodes);
  const authorityRoleFeatureIndex = useMemo(() => authorityRoles.map((role) => ({
    role,
    explicitFeatureCodes: (role.featureCodes || [])
      .map((item) => String(item || "").toUpperCase())
      .filter((item) => item && item !== "*")
  })), [authorityRoles]);
  const recommendedAuthorityRoles = useMemo(() => {
    const currentFeatures = new Set(deferredGovernanceFeatureCodes);
    return authorityRoleFeatureIndex
      .map(({ role, explicitFeatureCodes }) => {
        const overlapCount = explicitFeatureCodes.filter((item) => currentFeatures.has(item)).length;
        return {
          role,
          overlapCount
        };
      })
      .filter(({ role, overlapCount }) => role.builtIn || overlapCount > 0)
      .sort((left, right) => {
        if (right.overlapCount !== left.overlapCount) {
          return right.overlapCount - left.overlapCount;
        }
        return (right.role.hierarchyLevel || 0) - (left.role.hierarchyLevel || 0);
      })
      .slice(0, 8);
  }, [authorityRoleFeatureIndex, deferredGovernanceFeatureCodes]);

  useEffect(() => {
    setTreeData(buildTree(rows));
  }, [rows]);

  const filteredTreeData = useMemo(() => {
    const keyword = deferredMenuSearch.trim().toLowerCase();
    if (!keyword) {
      return treeData;
    }
    const filterNodes = (nodes: MenuNode[]): MenuNode[] => nodes.reduce<MenuNode[]>((acc, node) => {
      const children = filterNodes(node.children);
      const match = [node.code, node.label, node.url].join(" ").toLowerCase().includes(keyword);
      if (match || children.length > 0) {
        acc.push({ ...node, children });
      }
      return acc;
    }, []);
    return filterNodes(treeData);
  }, [deferredMenuSearch, treeData]);

  useEffect(() => {
    const selectedExists = rows.some((row) => stringOf(row, "code").toUpperCase() === selectedMenuCode);
    if (selectedExists) {
      return;
    }
    const firstPageCode = rows.find((row) => stringOf(row, "code").length === 8);
    setSelectedMenuCode(firstPageCode ? stringOf(firstPageCode, "code").toUpperCase() : "");
  }, [rows, selectedMenuCode]);

  useEffect(() => {
    if (!parentCodeValue && groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [groupMenuOptions, parentCodeValue]);

  useEffect(() => {
    setActionError("");
    setActionMessage("");
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
    setMenuIcon(iconOptions[0] || "web");
    setUseAt(useAtOptions[0] || "Y");
    setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    setLastAutoCollectedKey("");
  }, [menuType]); // reset form when switching scope

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const payload = await fetchScreenCommandPage("");
        if (!cancelled) {
          setScreenCatalog(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setScreenCatalog(null);
          setGovernanceError(error instanceof Error ? error.message : (en ? "Failed to load governance catalog." : "거버넌스 카탈로그를 불러오지 못했습니다."));
        }
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [en, menuType]);

  useEffect(() => {
    let cancelled = false;
    async function loadGovernancePage() {
      if (!selectedMenuCode) {
        setGovernancePage(null);
        setGovernanceError("");
        return;
      }
      if (!selectedMenuIsPage) {
        setGovernancePage(null);
        setGovernanceError(en ? "Select an 8-digit page menu to inspect connected full-stack metadata." : "연결된 풀스택 메타데이터를 보려면 8자리 페이지 메뉴를 선택하세요.");
        return;
      }
      if (!governancePageId) {
        setGovernancePage(null);
        setGovernanceError(en ? "This page menu is not yet linked to the screen command registry." : "이 페이지 메뉴는 아직 화면 command registry와 연결되지 않았습니다.");
        return;
      }
      setGovernanceLoading(true);
      setGovernanceError("");
      try {
        const payload = await fetchScreenCommandPage(governancePageId);
        if (!cancelled) {
          setGovernancePage(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setGovernancePage(null);
          setGovernanceError(error instanceof Error ? error.message : (en ? "Failed to load full-stack governance data." : "풀스택 거버넌스 데이터를 불러오지 못했습니다."));
        }
      } finally {
        if (!cancelled) {
          setGovernanceLoading(false);
        }
      }
    }
    void loadGovernancePage();
    return () => {
      cancelled = true;
    };
  }, [en, governancePageId, selectedMenuCode, selectedMenuIsPage]);

  useEffect(() => {
    let cancelled = false;
    async function loadRegistry() {
      if (!selectedMenuCode || !selectedMenuIsPage) {
        setRegistryEntry(null);
        setRegistryEditor(editorFromRegistry(buildSeedRegistry("", null, "", null)));
        return;
      }
      setRegistryLoading(true);
      try {
        const loaded = await fetchFullStackGovernanceRegistry(selectedMenuCode);
        const normalized = loaded.source === "FILE"
          ? loaded
          : buildSeedRegistry(selectedMenuCode, selectedMenuRow, governancePageId, governanceDetail || null);
        if (!cancelled) {
          setRegistryEntry(loaded);
          setRegistryEditor(editorFromRegistry(normalized));
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = buildSeedRegistry(selectedMenuCode, selectedMenuRow, governancePageId, governanceDetail || null);
          setRegistryEntry(fallback);
          setRegistryEditor(editorFromRegistry(fallback));
        }
      } finally {
        if (!cancelled) {
          setRegistryLoading(false);
        }
      }
    }
    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [governanceDetail, governancePageId, selectedMenuCode, selectedMenuIsPage, selectedMenuRow]);

  useEffect(() => {
    const autoCollectKey = selectedMenuIsPage && governancePageId ? `${selectedMenuCode}:${governancePageId}` : "";
    if (!autoCollectKey) {
      return;
    }
    if (autoCollectKey === lastAutoCollectedKey || governanceLoading || registryLoading || registryCollecting || registrySaving) {
      return;
    }

    let cancelled = false;
    async function autoCollectOnSelection() {
      setRegistryCollecting(true);
      setActionError("");
      try {
        const response = await autoCollectFullStackGovernanceRegistry({
          menuCode: selectedMenuCode,
          pageId: governancePageId,
          menuUrl: stringOf(selectedMenuRow, "menuUrl") || governanceDetail?.menuLookupUrl || "",
          mergeExisting: true,
          save: true
        });
        if (cancelled) {
          return;
        }
        setRegistryEntry(response.entry);
        setRegistryEditor(editorFromRegistry(response.entry));
        setLastAutoCollectedKey(autoCollectKey);
        setActionMessage(response.message || (en ? "Resources were collected automatically for the selected menu." : "선택한 메뉴 기준으로 자원을 자동 수집했습니다."));
        await pageState.reload();
      } catch (error) {
        if (cancelled) {
          return;
        }
        setActionError(error instanceof Error ? error.message : (en ? "Failed to auto collect resources." : "자원 자동 수집에 실패했습니다."));
      } finally {
        if (!cancelled) {
          setRegistryCollecting(false);
        }
      }
    }

    void autoCollectOnSelection();
    return () => {
      cancelled = true;
    };
  }, [
    en,
    governanceDetail?.menuLookupUrl,
    governanceLoading,
    governancePageId,
    lastAutoCollectedKey,
    pageState,
    registryCollecting,
    registryLoading,
    registrySaving,
    selectedMenuCode,
    selectedMenuIsPage,
    selectedMenuRow
  ]);

  function moveNode(nodes: MenuNode[], index: number, direction: number) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= nodes.length) {
      return;
    }
    const nextNodes = [...nodes];
    const moved = nextNodes[index];
    nextNodes[index] = nextNodes[nextIndex];
    nextNodes[nextIndex] = moved;
    updateSortOrders(nextNodes);
    return nextNodes;
  }

  function updateLevel(path: number[], direction: number) {
    setTreeData((current) => {
      const clone = JSON.parse(JSON.stringify(current)) as MenuNode[];
      let level = clone;
      for (let i = 0; i < path.length - 1; i += 1) {
        level = level[path[i]].children;
      }
      const next = moveNode(level, path[path.length - 1], direction);
      if (next) {
        if (path.length === 1) {
          return next;
        }
        let target = clone;
        for (let i = 0; i < path.length - 2; i += 1) {
          target = target[path[i]].children;
        }
        target[path[path.length - 2]].children = next;
      }
      return clone;
    });
  }

  async function saveOrder() {
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("orderPayload", flattenPayload(treeData).join(","));
    await postFormUrlEncoded(
      buildLocalizedPath("/admin/system/menu/order", "/en/admin/system/menu/order"),
      body
    );
    await pageState.reload();
    setActionMessage(en ? "Menu order has been saved." : "메뉴 순서를 저장했습니다.");
  }

  function findSuggestedPageCode() {
    return buildSuggestedPageCode(parentCodeValue, menuCodeRows);
  }

  async function createPageMenu() {
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("parentCode", parentCodeValue);
    body.set("codeNm", codeNm);
    body.set("codeDc", codeDc);
    body.set("menuUrl", menuUrl);
    body.set("menuIcon", menuIcon);
    body.set("useAt", useAt);
    const responseBody = await postFormUrlEncoded<{ success?: boolean; message?: string; createdCode?: string }>(
      buildLocalizedPath("/admin/system/menu/create-page", "/en/admin/system/menu/create-page"),
      body
    );
    if (!responseBody.success) {
      throw new Error(responseBody.message || "Failed to create page menu.");
    }
    await pageState.reload();
    setActionMessage(responseBody.message || (en ? "The page has been created." : "페이지를 생성했습니다."));
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
  }

  async function saveRegistry() {
    if (!selectedMenuCode || !selectedMenuIsPage) {
      setActionError(en ? "Select an 8-digit page menu before saving." : "저장하려면 8자리 페이지 메뉴를 선택하세요.");
      return;
    }
    const validationErrors = validateRegistryEditor(registryEditor, en);
    if (validationErrors.length > 0) {
      setActionError(validationErrors.join(" "));
      return;
    }
    setRegistrySaving(true);
    setActionError("");
    setActionMessage("");
    try {
      const payload: FullStackGovernanceRegistryEntry = {
        menuCode: selectedMenuCode,
        pageId: governancePageId || registryEntry?.pageId || "",
        menuUrl: stringOf(selectedMenuRow, "menuUrl") || registryEntry?.menuUrl || "",
        summary: registryEditor.summary.trim(),
        ownerScope: registryEditor.ownerScope.trim(),
        notes: registryEditor.notes.trim(),
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
      const response = await saveFullStackGovernanceRegistry(payload);
      setRegistryEntry(response.entry);
      setRegistryEditor(editorFromRegistry(response.entry));
      await pageState.reload();
      setActionMessage(response.message || (en ? "Full-stack governance metadata has been saved." : "풀스택 관리 메타데이터를 저장했습니다."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to save full-stack governance metadata." : "풀스택 관리 메타데이터 저장에 실패했습니다."));
    } finally {
      setRegistrySaving(false);
    }
  }

  function applyAuthorityRoleTemplate(role: FrameworkAuthorityRoleContract) {
    const roleFeatureCodes = (role.featureCodes || []).filter((item) => item && item !== "*");
    setRegistryEditor((current) => ({
      ...current,
      ownerScope: current.ownerScope.trim() || `${role.scopePolicy}/${role.authorCode}`,
      featureCodes: mergeLineBlock(current.featureCodes, roleFeatureCodes),
      tags: mergeLineBlock(current.tags, [`role-template:${role.authorCode}`, `role-tier:${role.tier}`]),
      notes: current.notes.trim()
        ? current.notes
        : (en
          ? `Recommended authority template: ${role.authorCode} (${role.label})`
          : `권장 권한 템플릿: ${role.authorCode} (${role.label})`)
    }));
    setActionError("");
    setActionMessage(en
      ? `Applied authority template ${role.authorCode}.`
      : `${role.authorCode} 권한 템플릿을 반영했습니다.`);
  }

  async function autoCollectRegistry() {
    if (!selectedMenuCode || !selectedMenuIsPage) {
      setActionError(en ? "Select an 8-digit page menu before collecting." : "수집하려면 8자리 페이지 메뉴를 선택하세요.");
      return;
    }
    if (!governancePageId) {
      setActionError(en ? "The selected menu is not connected to a managed page yet." : "선택한 메뉴가 아직 관리 대상 페이지와 연결되지 않았습니다.");
      return;
    }
    setRegistryCollecting(true);
    setActionError("");
    setActionMessage("");
    try {
      const response = await autoCollectFullStackGovernanceRegistry({
        menuCode: selectedMenuCode,
        pageId: governancePageId,
        menuUrl: stringOf(selectedMenuRow, "menuUrl") || governanceDetail?.menuLookupUrl || "",
        mergeExisting: true,
        save: true
      });
      setRegistryEntry(response.entry);
      setRegistryEditor(editorFromRegistry(response.entry));
      setActionMessage(response.message || (en ? "Resources collected and saved." : "자원을 자동 수집하고 저장했습니다."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to auto collect resources." : "자원 자동 수집에 실패했습니다."));
    } finally {
      setRegistryCollecting(false);
    }
    try {
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to refresh summary after collection." : "수집 후 요약 새로고침에 실패했습니다."));
    }
  }

  function renderNodes(nodes: MenuNode[], path: number[] = []) {
    return (
      <ol className="gov-tree-list">
        {nodes.map((node, index) => {
          const depth = node.code.length;
          const chipClass = depth === 4 ? "bg-blue-50 text-[var(--kr-gov-blue)]" : depth === 6 ? "bg-amber-50 text-[#8a5a00]" : "bg-green-50 text-[#196c2e]";
          const currentPath = [...path, index];
          return (
            <li key={node.code}>
              <div className="gov-tree-node">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">{node.icon}</span>
                      <strong className="text-base">{node.label}</strong>
                      <span className={`gov-chip ${chipClass}`}>{node.code}</span>
                      <span className={`gov-chip ${node.useAt === "Y" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{node.useAt === "Y" ? (en ? "Use" : "사용") : (en ? "Unused" : "미사용")}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)] break-all">{node.url || (en ? "No linked URL" : "연결 URL 없음")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="gov-btn gov-btn-outline" disabled={index === 0} onClick={() => updateLevel(currentPath, -1)} type="button">{en ? "Up" : "위로"}</button>
                    <button className="gov-btn gov-btn-outline" disabled={index === nodes.length - 1} onClick={() => updateLevel(currentPath, 1)} type="button">{en ? "Down" : "아래로"}</button>
                  </div>
                </div>
              </div>
              <div
                className={`mt-3 rounded-[var(--kr-gov-radius)] border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  selectedMenuCode === node.code
                    ? "border-[var(--kr-gov-focus)] bg-blue-50 text-[var(--kr-gov-blue)]"
                    : "border-[var(--kr-gov-border-light)] bg-[#fafbfd] text-[var(--kr-gov-text-secondary)] hover:bg-[#f3f7ff]"
                }`}
                data-help-id="menu-management-governance-select"
                onClick={() => setSelectedMenuCode(node.code)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMenuCode(node.code);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {selectedMenuCode === node.code
                  ? (en ? "Selected for full-stack governance review" : "풀스택 거버넌스 검토 대상으로 선택됨")
                  : (en ? "Select this menu for full-stack governance review" : "이 메뉴를 풀스택 거버넌스 검토 대상으로 선택")}
              </div>
              {node.children.length > 0 ? <div className="gov-tree-children">{renderNodes(node.children, currentPath)}</div> : null}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Builder Install / Bind Console" : "빌더 설치 / 바인딩 콘솔" },
        { label: en ? "Registry Detail Console" : "레지스트리 상세 콘솔" }
      ]}
      title={en ? "Registry Detail Console" : "레지스트리 상세 콘솔"}
      subtitle={en ? "Inspect one page menu as a governed registry detail, review connected full-stack evidence, and edit the menu-level registry record before install or package handoff." : "하나의 페이지 메뉴를 거버넌스 레지스트리 상세 단위로 검토하고, 연결된 풀스택 증거를 확인한 뒤 설치 또는 패키지 핸드오프 전 메뉴 단위 레지스트리 레코드를 정리합니다."}
      actions={
        <div className="flex flex-wrap gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/system/infra", "/en/admin/system/infra")}>
            {en ? "Infra Console" : "인프라 콘솔"}
          </a>
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/system/performance", "/en/admin/system/performance")}>
            {en ? "Performance" : "성능"}
          </a>
        </div>
      }
      contextStrip={
        <ContextKeyStrip items={authorDesignContextKeys} />
      }
    >
      {page?.menuMgmtMessage || actionMessage ? <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{actionMessage || String(page?.menuMgmtMessage)}</div> : null}
      {pageState.error || actionError || page?.menuMgmtError ? <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError || page?.menuMgmtError || pageState.error}</div> : null}

      <section className="gov-card mb-6" data-help-id="full-stack-management-scope">
        <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-4 items-end">
          <div>
            <label className="gov-label" htmlFor="menuType">{en ? "Detail Lane" : "상세 레인"}</label>
            <select className="gov-select" id="menuType" value={menuType} onChange={(event) => setMenuType(event.target.value)}>
              {menuTypes.map((type) => (
                <option key={stringOf(type, "value")} value={stringOf(type, "value")}>{stringOf(type, "label")}</option>
              ))}
            </select>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "Use this lane to inspect one registry detail at a time. Sibling reorder still follows parent ownership, and saved order is reflected across governed menu surfaces." : "이 레인은 한 번에 하나의 레지스트리 상세를 검토하는 용도입니다. 같은 부모 기준 정렬 규칙은 유지되며, 저장한 순서는 거버넌스 메뉴 표면에 함께 반영됩니다."}
          </div>
        </div>
      </section>

      <section className="gov-card mb-6" data-help-id="full-stack-management-tree">
        <div className="flex items-center justify-between gap-4 border-b pb-4 mb-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold">{en ? "Registry Intake" : "레지스트리 인테이크"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{String(page?.menuMgmtGuide || "")}</p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            {String(page?.siteMapMgmtGuide || "")}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="parentCode">{en ? "Registry Parent" : "레지스트리 부모"}</label>
              <select className="gov-select" id="parentCode" value={parentCodeValue} onChange={(event) => setParentCodeValue(event.target.value)}>
                {groupMenuOptions.map((option) => (
                  <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="suggestedCode">{en ? "Generated Registry Code" : "생성 예정 레지스트리 코드"}</label>
              <input className="gov-input bg-gray-50" id="suggestedCode" readOnly value={findSuggestedPageCode()} />
            </div>
            <div>
              <label className="gov-label" htmlFor="codeNm">{en ? "Registry Name" : "레지스트리명"}</label>
              <input className="gov-input" id="codeNm" value={codeNm} onChange={(event) => setCodeNm(event.target.value)} />
            </div>
            <div>
              <label className="gov-label" htmlFor="codeDc">{en ? "English Registry Name" : "영문 레지스트리명"}</label>
              <input className="gov-input" id="codeDc" value={codeDc} onChange={(event) => setCodeDc(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="menuUrl">{en ? "Binding URL" : "바인딩 URL"}</label>
              <input className="gov-input" id="menuUrl" placeholder={menuType === "USER" ? "/home/..." : "/admin/..."} value={menuUrl} onChange={(event) => setMenuUrl(event.target.value)} />
            </div>
            <div>
              <label className="gov-label" htmlFor="menuIcon">{en ? "Icon" : "아이콘"}</label>
              <select className="gov-select" id="menuIcon" value={menuIcon} onChange={(event) => setMenuIcon(event.target.value)}>
                {iconOptions.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="quickUseAt">{en ? "Use" : "사용 여부"}</label>
              <select className="gov-select" id="quickUseAt" value={useAt} onChange={(event) => setUseAt(event.target.value)}>
                {useAtOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-5 py-4">
            <h4 className="font-bold text-[var(--kr-gov-blue)]">{en ? "What the intake creates" : "인테이크가 만드는 항목"}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[var(--kr-gov-text-secondary)] list-disc pl-5">
              <li>{en ? "Registry code and binding URL metadata" : "레지스트리 코드와 바인딩 URL 메타데이터"}</li>
              <li>{en ? "Default PAGE_CODE_VIEW feature seed" : "기본 PAGE_CODE_VIEW 기능 시드"}</li>
              <li>{en ? "Initial sibling registry order under the selected parent" : "선택 부모 하위의 초기 레지스트리 정렬"}</li>
              <li>{en ? "A menu entry ready for detail inspection, install-bind, and package-builder handoff" : "상세 검토, 설치-바인딩, 패키지 빌더로 넘길 수 있는 메뉴 엔트리"}</li>
            </ul>
            <div className="mt-4">
              <button className="gov-btn gov-btn-primary w-full" onClick={() => { void createPageMenu().catch((error: Error) => setActionError(error.message)); }} type="button">
                {en ? "Create Registry Entry" : "레지스트리 엔트리 생성"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="gov-card">
        <div className="flex items-center justify-between gap-4 border-b pb-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_tree</span>
            <h3 className="text-lg font-bold">{en ? "Registry Tree" : "레지스트리 트리"}</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="gov-input w-64"
              placeholder={en ? "Search registry code, label, URL" : "레지스트리 코드, 이름, URL 검색"}
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
            />
            <button className="gov-btn gov-btn-primary" onClick={() => { void saveOrder().catch((error: Error) => setActionError(error.message)); }} type="button">{en ? "Save Registry Order" : "레지스트리 순서 저장"}</button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-4 py-3">
            <p className="font-bold text-[var(--kr-gov-blue)]">{en ? "Top Registry" : "상위 레지스트리"}</p>
            <p className="text-[var(--kr-gov-text-secondary)]">{en ? "4-digit code" : "4자리 코드"}</p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fcfbf7] px-4 py-3">
            <p className="font-bold text-[#8a5a00]">{en ? "Group Registry" : "그룹 레지스트리"}</p>
            <p className="text-[var(--kr-gov-text-secondary)]">{en ? "6-digit code" : "6자리 코드"}</p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f7fbf8] px-4 py-3">
            <p className="font-bold text-[#196c2e]">{en ? "Page Registry" : "페이지 레지스트리"}</p>
            <p className="text-[var(--kr-gov-text-secondary)]">{en ? "8-digit code" : "8자리 코드"}</p>
          </div>
        </div>

        {renderNodes(filteredTreeData)}
      </section>

      <section className="gov-card mt-6" data-help-id="menu-management-governance-panel">
        <div className="flex items-center justify-between gap-4 border-b pb-4 mb-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold">{en ? "Registry Detail / Governance" : "레지스트리 상세 / 거버넌스"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Review one selected page registry with connected screen elements, events, functions, parameters, outputs, APIs, schema, table, column, permission, and common-code evidence."
                : "선택한 페이지 레지스트리 하나를 기준으로 화면 요소, 이벤트, 함수, 파라미터, 결과값, API, 스키마, 테이블, 컬럼, 권한, 공통코드 증거를 한 번에 확인합니다."}
            </p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            <strong className="block text-[var(--kr-gov-blue)]">{selectedMenuCode || "-"}</strong>
            <span>{selectedMenuLabel || (en ? "No registry selected" : "선택된 레지스트리 없음")}</span>
          </div>
        </div>

        {governanceError ? <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{governanceError}</div> : null}

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <SummaryMetricCard
            accentClassName="text-[var(--kr-gov-blue)]"
            description={governancePageId || "-"}
            surfaceClassName="bg-[#f8fbff]"
            title={en ? "Route / Page" : "라우트 / 페이지"}
            value={<span className="break-all">{governanceDetail?.routePath || toDisplayMenuUrl(stringOf(selectedMenuRow, "menuUrl")) || "-"}</span>}
          />
          <SummaryMetricCard
            accentClassName="text-[#8a5a00]"
            description={`${(governanceDetail?.surfaces || []).length} ${en ? "surfaces" : "요소"} / ${governanceDetail?.manifestRegistry?.componentCount || 0} ${en ? "components" : "컴포넌트"}`}
            surfaceClassName="bg-[#fcfbf7]"
            title={en ? "Frontend / Components" : "프론트엔드 / 컴포넌트"}
            value={governanceDetail?.source || "-"}
          />
          <SummaryMetricCard
            accentClassName="text-[#196c2e]"
            description={`${(governanceDetail?.menuPermission?.featureRows || []).length} ${en ? "feature codes" : "기능 코드"}`}
            surfaceClassName="bg-[#f7fbf8]"
            title={en ? "Functions / APIs" : "함수 / API"}
            value={`${(governanceDetail?.events || []).length} ${en ? "events" : "이벤트"} / ${(governanceDetail?.apis || []).length} API`}
          />
          <SummaryMetricCard
            accentClassName="text-[#6b3ea1]"
            description={governanceDetail?.manifestRegistry?.layoutVersion || "-"}
            surfaceClassName="bg-[#f9f7fb]"
            title={en ? "Schema / Data" : "스키마 / 데이터"}
            value={`${(governanceDetail?.schemas || []).length} ${en ? "schemas" : "스키마"} / ${(governanceDetail?.commonCodeGroups || []).length} ${en ? "common code groups" : "공통코드 그룹"}`}
          />
        </div>

        {governanceWarnings.length > 0 ? (
          <WarningPanel>
            {governanceWarnings.map((warning) => <div key={warning}>{warning}</div>)}
          </WarningPanel>
        ) : null}

        {governanceLoading ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading governance metadata..." : "거버넌스 메타데이터를 불러오는 중입니다..."}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm mb-6">
          <SummaryMetricCard
            accentClassName="text-[var(--kr-gov-blue)]"
            surfaceClassName="bg-[#f8fbff]"
            title={en ? "Registry Detail Rows" : "레지스트리 상세 행"}
            value={coverageOverview.total}
          />
          <SummaryMetricCard
            accentClassName="text-[#196c2e]"
            surfaceClassName="bg-[#f7fbf8]"
            title={en ? "Detail Coverage 70+" : "상세 커버리지 70+"}
            value={coverageOverview.strong}
          />
          <SummaryMetricCard
            accentClassName="text-[#b45f06]"
            surfaceClassName="bg-[#fff8f1]"
            title={en ? "Detail Coverage Under 40" : "상세 커버리지 40 미만"}
            value={coverageOverview.weak}
          />
          <SummaryMetricCard
            accentClassName="text-[#be123c]"
            surfaceClassName="bg-[#fff1f2]"
            title={en ? "Missing Detail VIEW Feature" : "상세 VIEW 권한 누락"}
            value={coverageOverview.missingView}
          />
        </div>

        <div className="table-wrap mb-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>{en ? "Registry" : "레지스트리"}</th>
                <th>{en ? "Coverage" : "커버리지"}</th>
                <th>{en ? "Registry" : "레지스트리"}</th>
                <th>{en ? "Events / APIs" : "이벤트 / API"}</th>
                <th>{en ? "Schema / Table / Column" : "스키마 / 테이블 / 컬럼"}</th>
                <th>{en ? "Gaps" : "누락 항목"}</th>
              </tr>
            </thead>
            <tbody>
              {fullStackSummaryRows.length === 0 ? (
                <tr><td colSpan={6}>{en ? "No registry detail summary rows." : "레지스트리 상세 요약 대상이 없습니다."}</td></tr>
              ) : fullStackSummaryRows.map((row) => (
                <tr key={stringOf(row, "menuCode")}>
                  <td>
                    <strong>{stringOf(row, "menuNm") || stringOf(row, "menuCode")}</strong>
                    <br />
                    <span className="text-[var(--kr-gov-text-secondary)]">{stringOf(row, "menuCode")}</span>
                  </td>
                  <td>{numberOf(row, "coverageScore")}</td>
                  <td>
                    {stringOf(row, "pageId") || "-"}
                    <br />
                    {stringOf(row, "hasManifestRegistry") === "true" ? (en ? "Manifest OK" : "Manifest 연결") : (en ? "Manifest Missing" : "Manifest 없음")}
                  </td>
                  <td>{numberOf(row, "eventCount")} / {numberOf(row, "apiCount")}</td>
                  <td>{numberOf(row, "schemaCount")} / {numberOf(row, "tableCount")} / {numberOf(row, "columnCount")}</td>
                  <td>{((row.gaps as unknown[]) || []).map((item) => String(item)).join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedMenuIsPage ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fcfdff] p-5 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h4 className="font-bold">{en ? "Editable Registry Detail Record" : "편집 가능한 레지스트리 상세 레코드"}</h4>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Seeded from the current screen-command metadata. Fill the gaps and save registry-detail ownership, function, API, schema, table, and column evidence."
                    : "현재 screen-command 메타데이터를 기준으로 자동 채움한 뒤, 부족한 레지스트리 상세 소유권, 함수, API, 스키마, 테이블, 컬럼 증거를 보강해서 저장합니다."}
                </p>
              </div>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                <div><strong>{en ? "Source" : "소스"}</strong>: {registryEntry?.source || "-"}</div>
                <div><strong>{en ? "Updated" : "수정 시각"}</strong>: {registryEntry?.updatedAt || "-"}</div>
              </div>
            </div>

            {registryLoading ? <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading saved registry..." : "저장된 레지스트리를 불러오는 중입니다..."}</p> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="gov-label" htmlFor="registry-summary">{en ? "Summary" : "요약"}</label>
                <textarea className="gov-textarea min-h-[100px]" id="registry-summary" value={registryEditor.summary} onChange={(event) => setRegistryEditor((current) => ({ ...current, summary: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-owner">{en ? "Owner Scope" : "소유 범위"}</label>
                <input className="gov-input" id="registry-owner" placeholder={en ? "ex) platform-console/admin-core" : "예) platform-console/admin-core"} value={registryEditor.ownerScope} onChange={(event) => setRegistryEditor((current) => ({ ...current, ownerScope: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-notes">{en ? "Notes" : "운영 메모"}</label>
                <textarea className="gov-textarea min-h-[92px]" id="registry-notes" value={registryEditor.notes} onChange={(event) => setRegistryEditor((current) => ({ ...current, notes: event.target.value }))} />
              </div>
            </div>

            <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                <h5 className="font-bold">{en ? "Recommended Authority Templates" : "권장 권한 템플릿"}</h5>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {authorityLoading
                      ? (en ? "Loading framework authority contract..." : "프레임워크 권한 계약을 불러오는 중입니다.")
                        : (en ? "Apply role templates to seed owner scope, feature grants, and tags for this registry detail record." : "이 레지스트리 상세 레코드에 role template을 반영해 owner scope, 기능 권한, 태그를 빠르게 채웁니다.")}
                  </p>
                </div>
                <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? `${recommendedAuthorityRoles.length} recommended roles` : `권장 role ${recommendedAuthorityRoles.length}건`}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {recommendedAuthorityRoles.length === 0 ? (
                  <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-white px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "No role templates matched the current feature set yet." : "현재 기능 세트와 직접 매칭된 role template이 아직 없습니다."}
                  </div>
                ) : recommendedAuthorityRoles.map(({ role, overlapCount }) => (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={role.authorCode}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{role.authorCode}</p>
                        <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{role.label}</p>
                        <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{role.description || "-"}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1 text-[10px] font-bold">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{role.tier}</span>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{role.scopePolicy}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                          {en ? `${overlapCount} overlap` : `${overlapCount}개 일치`}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">
                      {(role.featureCodes || []).filter((item) => item && item !== "*").slice(0, 8).join(", ") || (en ? "No explicit feature grants" : "명시된 기능 권한 없음")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="gov-btn gov-btn-outline" onClick={() => applyAuthorityRoleTemplate(role)} type="button">
                        {en ? "Apply Template" : "템플릿 반영"}
                      </button>
                      <button className="gov-btn gov-btn-outline" onClick={() => { void navigator.clipboard.writeText(role.authorCode); }} type="button">
                        {en ? "Copy Role" : "Role 복사"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                <h5 className="font-bold">{en ? "Role Category Options" : "Role Category 옵션"}</h5>
                <div className="mt-3 flex flex-wrap gap-2">
                  {authorityRoleCategoryOptions.map((item) => (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700" key={item.code}>
                      {item.code} · {item.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                <h5 className="font-bold">{en ? "Assignment Authorities" : "권한 할당 가이드"}</h5>
                <div className="mt-3 space-y-3">
                  {authorityAssignmentAuthorities.map((item) => (
                    <div className="rounded border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3" key={item.title}>
                      <p className="text-xs font-black">{item.title}</p>
                      <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                <h5 className="font-bold">{en ? "Role Category Guides" : "권한 카테고리 가이드"}</h5>
                <div className="mt-3 space-y-3">
                  {authorityRoleCategories.map((item) => (
                    <div className="rounded border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3" key={item.title}>
                      <p className="text-xs font-black">{item.title}</p>
                      <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div>
                <label className="gov-label" htmlFor="registry-front">{en ? "Frontend Sources" : "프론트 소스"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-front" value={registryEditor.frontendSources} onChange={(event) => setRegistryEditor((current) => ({ ...current, frontendSources: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-components">{en ? "Component IDs" : "컴포넌트 ID"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-components" value={registryEditor.componentIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, componentIds: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-events">{en ? "Event IDs" : "이벤트 ID"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-events" value={registryEditor.eventIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, eventIds: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-functions">{en ? "Function IDs" : "함수 ID"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-functions" value={registryEditor.functionIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, functionIds: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-params">{en ? "Parameters" : "파라미터"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-params" placeholder={en ? "name:type or name:type:source" : "name:type 또는 name:type:source"} value={registryEditor.parameterSpecs} onChange={(event) => setRegistryEditor((current) => ({ ...current, parameterSpecs: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-results">{en ? "Results" : "결과값"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-results" placeholder={en ? "name:type or name:type:source" : "name:type 또는 name:type:source"} value={registryEditor.resultSpecs} onChange={(event) => setRegistryEditor((current) => ({ ...current, resultSpecs: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-apis">{en ? "API IDs" : "API ID"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-apis" value={registryEditor.apiIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, apiIds: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-schemas">{en ? "Schema IDs" : "스키마 ID"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-schemas" value={registryEditor.schemaIds} onChange={(event) => setRegistryEditor((current) => ({ ...current, schemaIds: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-tables">{en ? "Tables" : "테이블"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-tables" value={registryEditor.tableNames} onChange={(event) => setRegistryEditor((current) => ({ ...current, tableNames: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-columns">{en ? "Columns" : "컬럼"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-columns" value={registryEditor.columnNames} onChange={(event) => setRegistryEditor((current) => ({ ...current, columnNames: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registry-features">{en ? "Feature Codes" : "기능 코드"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-features" value={registryEditor.featureCodes} onChange={(event) => setRegistryEditor((current) => ({ ...current, featureCodes: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-codes">{en ? "Common Code Groups" : "공통코드 그룹"}</label>
                <textarea className="gov-textarea min-h-[140px]" id="registry-codes" value={registryEditor.commonCodeGroups} onChange={(event) => setRegistryEditor((current) => ({ ...current, commonCodeGroups: event.target.value }))} />
                <label className="gov-label mt-4" htmlFor="registry-tags">{en ? "Tags" : "태그"}</label>
                <textarea className="gov-textarea min-h-[100px]" id="registry-tags" value={registryEditor.tags} onChange={(event) => setRegistryEditor((current) => ({ ...current, tags: event.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "One item per line. Tables use `TABLE_NAME`, columns use `TABLE_NAME.COLUMN_NAME`, and parameters/results use `name:type` or `name:type:source`." : "한 줄에 하나씩 입력합니다. 테이블은 `TABLE_NAME`, 컬럼은 `TABLE_NAME.COLUMN_NAME`, 파라미터/결과값은 `name:type` 또는 `name:type:source` 형식을 사용합니다."}
              </p>
              <div className="flex items-center gap-2">
                <button className="gov-btn gov-btn-outline" disabled={registryCollecting} onClick={() => { void autoCollectRegistry(); }} type="button">
                  {registryCollecting ? (en ? "Collecting..." : "수집 중...") : (en ? "Auto Collect" : "자동 수집")}
                </button>
                <button className="gov-btn gov-btn-primary" disabled={registrySaving} onClick={() => { void saveRegistry(); }} type="button">
                  {registrySaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Detail Registry" : "상세 레지스트리 저장")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {governanceDetail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                <h4 className="font-bold mb-2">{en ? "Registry Detail Manifest" : "레지스트리 상세 매니페스트"}</h4>
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{governanceDetail.summary || "-"}</p>
                <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><dt className="font-bold">Menu Code</dt><dd>{governanceDetail.menuCode || "-"}</dd></div>
                  <div><dt className="font-bold">Menu URL</dt><dd>{toDisplayMenuUrl(governanceDetail.menuLookupUrl || "") || "-"}</dd></div>
                  <div><dt className="font-bold">Page ID</dt><dd>{governanceDetail.manifestRegistry?.pageId || "-"}</dd></div>
                  <div><dt className="font-bold">Layout</dt><dd>{governanceDetail.manifestRegistry?.layoutVersion || "-"}</dd></div>
                  <div><dt className="font-bold">Design Token</dt><dd>{governanceDetail.manifestRegistry?.designTokenVersion || "-"}</dd></div>
                  <div><dt className="font-bold">VIEW Feature</dt><dd>{governanceDetail.menuPermission?.requiredViewFeatureCode || "-"}</dd></div>
                </dl>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                <h4 className="font-bold mb-2">{en ? "Permission / Common Code Evidence" : "권한 / 공통코드 증거"}</h4>
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {(governanceDetail.commonCodeGroups || []).map((item) => `${item.codeGroupId}[${item.values.join(", ")}]`).join(" / ") || "-"}
                </p>
                <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                  {(governanceDetail.menuPermission?.resolverNotes || []).join(" ") || "-"}
                </p>
                <p className="mt-3 text-sm">
                  <strong>{en ? "Relation Tables" : "권한 해석 테이블"}:</strong> {(governanceDetail.menuPermission?.relationTables || []).join(", ") || "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-4 py-3">
                <p className="font-bold text-[var(--kr-gov-blue)]">{en ? "Detail Tables" : "상세 테이블"}</p>
                <p className="mt-1">{governanceTables.length}</p>
                <p className="text-[var(--kr-gov-text-secondary)] break-all">{governanceTables.join(", ") || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#fcfbf7] px-4 py-3">
                <p className="font-bold text-[#8a5a00]">{en ? "Detail Columns" : "상세 컬럼"}</p>
                <p className="mt-1">{governanceColumns.length}</p>
                <p className="text-[var(--kr-gov-text-secondary)] break-all">{governanceColumns.join(", ") || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f7fbf8] px-4 py-3">
                <p className="font-bold text-[#196c2e]">{en ? "Detail Events / APIs" : "상세 이벤트 / API"}</p>
                <p className="mt-1">{(governanceDetail.events || []).length} / {(governanceDetail.apis || []).length}</p>
                <p className="text-[var(--kr-gov-text-secondary)]">{en ? "Function and backend linkage count" : "함수 및 백엔드 연결 수"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f9f7fb] px-4 py-3">
                <p className="font-bold text-[#6b3ea1]">{en ? "Permission Evidence Rows" : "권한 증거 행"}</p>
                <p className="mt-1">{(governanceDetail.menuPermission?.featureRows || []).length}</p>
                <p className="text-[var(--kr-gov-text-secondary)]">{(governanceDetail.menuPermission?.featureCodes || []).join(", ") || "-"}</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{en ? "Surface" : "요소"}</th>
                    <th>{en ? "Selector" : "셀렉터"}</th>
                    <th>{en ? "Component" : "컴포넌트"}</th>
                    <th>{en ? "Events" : "이벤트"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(governanceDetail.surfaces || []).length === 0 ? (
                    <tr><td colSpan={4}>{en ? "No linked surfaces." : "연결된 화면 요소가 없습니다."}</td></tr>
                  ) : (governanceDetail.surfaces || []).map((item) => (
                    <tr key={item.surfaceId}>
                      <td>{item.label}</td>
                      <td>{item.selector}</td>
                      <td>{item.componentId}</td>
                      <td>{item.eventIds.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{en ? "Event" : "이벤트"}</th>
                    <th>{en ? "Function" : "함수"}</th>
                    <th>{en ? "Parameters" : "파라미터"}</th>
                    <th>{en ? "Outputs" : "결과값"}</th>
                    <th>{en ? "APIs" : "API"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(governanceDetail.events || []).length === 0 ? (
                    <tr><td colSpan={5}>{en ? "No linked events." : "연결된 이벤트가 없습니다."}</td></tr>
                  ) : (governanceDetail.events || []).map((item) => (
                    <tr key={item.eventId}>
                      <td>{item.label}<br /><span className="text-[var(--kr-gov-text-secondary)]">{item.eventId}</span></td>
                      <td>{item.frontendFunction}</td>
                      <td>{summarizeFields(item.functionInputs)}</td>
                      <td>{summarizeFields(item.functionOutputs)}</td>
                      <td>{item.apiIds.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>API</th>
                    <th>{en ? "Backend Chain" : "백엔드 체인"}</th>
                    <th>{en ? "Request / Response" : "요청 / 응답"}</th>
                    <th>{en ? "DB / Tables" : "DB / 테이블"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(governanceDetail.apis || []).length === 0 ? (
                    <tr><td colSpan={4}>{en ? "No linked APIs." : "연결된 API가 없습니다."}</td></tr>
                  ) : (governanceDetail.apis || []).map((item) => (
                    <tr key={item.apiId}>
                      <td>{item.method} {item.endpoint}</td>
                      <td>
                        {getScreenCommandChainText(item.controllerActions, item.controllerAction)}
                        <br />
                        {getScreenCommandChainText(item.serviceMethods, item.serviceMethod)}
                        <br />
                        {getScreenCommandChainValues(item.mapperQueries, item.mapperQuery).join(", ") || "-"}
                      </td>
                      <td>
                        <strong>REQ</strong> {summarizeFields(item.requestFields)}
                        <br />
                        <strong>RES</strong> {summarizeFields(item.responseFields)}
                      </td>
                      <td>{item.relatedTables.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{en ? "Schema" : "스키마"}</th>
                    <th>{en ? "Table" : "테이블"}</th>
                    <th>{en ? "Columns" : "컬럼"}</th>
                    <th>{en ? "Write Patterns" : "쓰기 패턴"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(governanceDetail.schemas || []).length === 0 ? (
                    <tr><td colSpan={4}>{en ? "No linked schemas." : "연결된 스키마가 없습니다."}</td></tr>
                  ) : (governanceDetail.schemas || []).map((item) => (
                    <tr key={item.schemaId}>
                      <td>{item.label}</td>
                      <td>{item.tableName}</td>
                      <td>{item.columns.join(", ") || "-"}</td>
                      <td>{item.writePatterns.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{en ? "Feature Code" : "기능 코드"}</th>
                    <th>{en ? "Feature Name" : "기능명"}</th>
                    <th>{en ? "Menu URL" : "메뉴 URL"}</th>
                    <th>{en ? "Use" : "사용 여부"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(governanceDetail.menuPermission?.featureRows || []).length === 0 ? (
                    <tr><td colSpan={4}>{en ? "No linked feature codes." : "연결된 기능 코드가 없습니다."}</td></tr>
                  ) : (governanceDetail.menuPermission?.featureRows || []).map((item) => (
                    <tr key={item.featureCode}>
                      <td>{item.featureCode}</td>
                      <td>{item.featureNm}</td>
                      <td>{toDisplayMenuUrl(item.menuUrl)}</td>
                      <td>{item.useAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </AdminPageShell>
  );
}
// agent note: updated by FreeAgent Ultra
