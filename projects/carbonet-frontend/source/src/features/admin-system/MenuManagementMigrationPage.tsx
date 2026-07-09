import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { refreshAdminMenuTree } from "../../lib/api/adminShell";
import { postFormUrlEncoded } from "../../lib/api/core";
import { getNormalizedAdminMenuTree, getNormalizedHomeMenu } from "../../lib/api/menuNormalization";
import { fetchMenuManagementPage } from "../../lib/api/platform";
import type { MenuManagementPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { numberOf, stringOf } from "./adminSystemShared";
import { GovernanceCompressionNav } from "./GovernanceCompressionNav";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  BUILDER_INSTALL_ARTIFACTS,
  BUILDER_INSTALL_REQUIRED_BINDINGS,
  BUILDER_INSTALL_VALIDATOR_CHECKS,
  type BuilderInstallBindingKey,
  type BuilderInstallValidatorCheckKey,
  describeBuilderInstallBinding,
  describeBuilderValidatorCheck
} from "../screen-builder/shared/installableBuilderContract";
import { buildMenuTree, buildSuggestedPageCode, flattenMenuOrderPayload, type MenuTreeNode, updateMenuSortOrders } from "./menuTreeShared";
import { toDisplayMenuUrl } from "./menuUrlDisplay";

type MenuNode = MenuTreeNode;

type MenuSnapshot = {
  sortOrdr: number;
  expsrAt: string;
};

function buildStandardAdminMenuRows(en: boolean) {
  const rows: Array<Record<string, unknown>> = [];
  const menuTree = getNormalizedAdminMenuTree();
  Object.entries(menuTree).forEach(([domainCode, domain], domainIndex) => {
    rows.push({
      code: domainCode,
      codeNm: domain.label || domainCode,
      codeDc: domain.labelEn || domain.label || domainCode,
      menuUrl: "",
      menuIcon: "dashboard",
      sortOrdr: domainIndex + 1,
      useAt: "Y",
      expsrAt: "Y"
    });
    (domain.groups || []).forEach((group, groupIndex) => {
      const groupCode = `${domainCode}${String(groupIndex + 1).padStart(2, "0")}`;
      rows.push({
        code: groupCode,
        codeNm: group.title || groupCode,
        codeDc: group.titleEn || group.title || groupCode,
        menuUrl: "",
        menuIcon: group.icon || "folder_open",
        sortOrdr: groupIndex + 1,
        useAt: "Y",
        expsrAt: "Y"
      });
      (group.links || []).forEach((link, linkIndex) => {
        rows.push({
          code: `${groupCode}${String(linkIndex + 1).padStart(2, "0")}`,
          codeNm: link.text || link.tEn || link.code || `${groupCode}${linkIndex + 1}`,
          codeDc: link.tEn || link.text || link.code || `${groupCode}${linkIndex + 1}`,
          menuUrl: link.u || "",
          menuIcon: link.icon || "chevron_right",
          sortOrdr: linkIndex + 1,
          useAt: "Y",
          expsrAt: "Y",
          standardMenuCode: link.code || "",
          standardSource: en ? "Normalized admin menu" : "신규 표준 관리자 메뉴"
        });
      });
    });
  });
  return rows;
}

function buildStandardHomeMenuRows(en: boolean) {
  const rows: Array<Record<string, unknown>> = [];
  getNormalizedHomeMenu(en).forEach((menu, menuIndex) => {
    const menuCode = `U${String(menuIndex + 1).padStart(3, "0")}`;
    rows.push({
      code: menuCode,
      codeNm: menu.label || menuCode,
      codeDc: menu.label || menuCode,
      menuUrl: menu.url || "",
      menuIcon: "web",
      sortOrdr: menuIndex + 1,
      useAt: "Y",
      expsrAt: "Y",
      standardSource: en ? "Normalized home menu" : "신규 표준 홈 메뉴"
    });
    (menu.sections || []).forEach((section, sectionIndex) => {
      const sectionCode = `${menuCode}${String(sectionIndex + 1).padStart(2, "0")}`;
      rows.push({
        code: sectionCode,
        codeNm: section.label || sectionCode,
        codeDc: section.label || sectionCode,
        menuUrl: "",
        menuIcon: "folder_open",
        sortOrdr: sectionIndex + 1,
        useAt: "Y",
        expsrAt: "Y",
        standardSource: en ? "Normalized home menu" : "신규 표준 홈 메뉴"
      });
      (section.items || []).forEach((item, itemIndex) => {
        rows.push({
          code: `${sectionCode}${String(itemIndex + 1).padStart(2, "0")}`,
          codeNm: item.label || `${sectionCode}${itemIndex + 1}`,
          codeDc: item.label || `${sectionCode}${itemIndex + 1}`,
          menuUrl: item.url || "",
          menuIcon: "chevron_right",
          sortOrdr: itemIndex + 1,
          useAt: "Y",
          expsrAt: "Y",
          standardSource: en ? "Normalized home menu" : "신규 표준 홈 메뉴"
        });
      });
    });
  });
  return rows;
}

function buildStandardGroupOptions(rows: Array<Record<string, unknown>>) {
  return rows
    .filter((row) => {
      const code = stringOf(row, "code");
      return code.length === 4 || code.length === 6;
    })
    .map((row) => ({
      value: stringOf(row, "code"),
      label: `${stringOf(row, "code")} ${stringOf(row, "codeNm")}`
    }));
}

function readMenuTypeFromLocation() {
  return new URLSearchParams(window.location.search).get("menuType") || "ADMIN";
}

function flattenNodes(items: MenuNode[], output: MenuNode[] = []) {
  items.forEach((item) => {
    output.push(item);
    flattenNodes(item.children, output);
  });
  return output;
}

function filterTree(nodes: MenuNode[], keyword: string): MenuNode[] {
  if (!keyword) {
    return nodes;
  }
  const normalizedKeyword = keyword.trim().toLowerCase();
  return nodes.flatMap((node): MenuNode[] => {
    const filteredChildren: MenuNode[] = filterTree(node.children, keyword);
    const matches = [
      node.code,
      node.label,
      node.url,
      node.icon,
      node.useAt,
      node.expsrAt
    ].join(" ").toLowerCase().includes(normalizedKeyword);
    if (!matches && filteredChildren.length === 0) {
      return [];
    }
    return [{ ...node, children: filteredChildren }];
  });
}

function buildSnapshot(rows: Array<Record<string, unknown>>) {
  return rows.reduce<Record<string, MenuSnapshot>>((result, row) => {
    const code = stringOf(row, "code").toUpperCase();
    if (!code) {
      return result;
    }
    result[code] = {
      sortOrdr: numberOf(row, "sortOrdr"),
      expsrAt: stringOf(row, "expsrAt") || "Y"
    };
    return result;
  }, {});
}

function validateCreateForm(params: {
  en: boolean;
  parentCodeValue: string;
  codeNm: string;
  menuUrl: string;
  menuType: string;
}) {
  const { en, parentCodeValue, codeNm, menuUrl, menuType } = params;
  if (!parentCodeValue) {
    return en ? "Select a group menu first." : "그룹 메뉴를 먼저 선택하세요.";
  }
  if (!codeNm.trim()) {
    return en ? "Enter a page name." : "페이지명을 입력하세요.";
  }
  if (!menuUrl.trim()) {
    return en ? "Enter a page URL." : "페이지 URL을 입력하세요.";
  }
  if (!menuUrl.startsWith("/")) {
    return en ? "Page URL must start with /." : "페이지 URL은 / 로 시작해야 합니다.";
  }
  if (menuType === "ADMIN" && !menuUrl.startsWith("/admin/")) {
    return en ? "Admin menu URL must start with /admin/." : "관리자 메뉴 URL은 /admin/으로 시작해야 합니다.";
  }
  if (menuType === "USER" && menuUrl.startsWith("/admin/")) {
    return en ? "Home menu URL must not start with /admin/." : "홈 메뉴 URL은 /admin/으로 시작할 수 없습니다.";
  }
  return "";
}

export function MenuManagementMigrationPage() {
  const en = isEnglish();
  void useFrontendSession();
  const [menuType, setMenuType] = useState(readMenuTypeFromLocation());
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [parentCodeValue, setParentCodeValue] = useState("");
  const [codeNm, setCodeNm] = useState("");
  const [codeDc, setCodeDc] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuIcon, setMenuIcon] = useState("web");
  const [useAt, setUseAt] = useState("Y");
  const [isTopMenu, setIsTopMenu] = useState(false);
  const [treeData, setTreeData] = useState<MenuNode[]>([]);

  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const pageState = useAsyncValue<MenuManagementPagePayload>(() => fetchMenuManagementPage(menuType), [menuType]);
  const page = pageState.value;

  const standardAdminRows = useMemo(() => buildStandardAdminMenuRows(en), [en]);
  const standardHomeRows = useMemo(() => buildStandardHomeMenuRows(en), [en]);
  const rawRows = useMemo(() => (page?.menuRows || []) as Array<Record<string, unknown>>, [page?.menuRows]);
  const rows = useMemo(() => {
    if (menuType === "ADMIN") {
      return standardAdminRows;
    }
    if (menuType === "USER") {
      return standardHomeRows;
    }
    return rawRows;
  }, [menuType, rawRows, standardAdminRows, standardHomeRows]);
  const menuTypes = ((page?.menuTypes || []) as Array<Record<string, unknown>>);
  const groupMenuOptions = useMemo(() => (
    menuType === "ADMIN" || menuType === "USER"
      ? buildStandardGroupOptions(rows)
      : ((page?.groupMenuOptions || []) as Array<Record<string, string>>)
  ), [menuType, page?.groupMenuOptions, rows]);
  const iconOptions = ((page?.iconOptions || []) as string[]);
  const useAtOptions = ((page?.useAtOptions || []) as string[]);
  const menuCodeRows = useMemo(() => rows.map((row) => ({ code: stringOf(row, "code").toUpperCase() })), [rows]);

  const originalSnapshot = useMemo(() => buildSnapshot(rows), [rows]);
  const filteredTreeData = useMemo(() => filterTree(treeData, deferredSearchKeyword), [deferredSearchKeyword, treeData]);
  const visibleNodes = useMemo(() => flattenNodes(filteredTreeData), [filteredTreeData]);
  const allNodes = useMemo(() => flattenNodes(treeData), [treeData]);

  const dirtyOrderRows = useMemo(() => (
    allNodes.filter((node) => {
      const snapshot = originalSnapshot[node.code];
      return snapshot && snapshot.sortOrdr !== node.sortOrdr;
    })
  ), [allNodes, originalSnapshot]);
  const intakeValidationMessage = useMemo(() => validateCreateForm({
    en,
    parentCodeValue,
    codeNm,
    menuUrl,
    menuType
  }), [codeNm, en, menuType, menuUrl, parentCodeValue]);
  const intakeReady = intakeValidationMessage.length === 0;
  const intakeBindingStatuses = useMemo(() => ([
    {
      key: "projectId" as BuilderInstallBindingKey,
      ready: true,
      detail: en ? `Lane ${menuType} selected` : `${menuType} 레인 선택`
    },
    {
      key: "menuRoot" as BuilderInstallBindingKey,
      ready: menuType === "ADMIN" ? menuUrl.startsWith("/admin/") : (menuUrl.startsWith("/") && !menuUrl.startsWith("/admin/")),
      detail: menuUrl || "-"
    },
    {
      key: "runtimeClass" as BuilderInstallBindingKey,
      ready: Boolean(parentCodeValue),
      detail: parentCodeValue || "-"
    },
    {
      key: "menuScope" as BuilderInstallBindingKey,
      ready: Boolean(parentCodeValue),
      detail: menuType
    },
    {
      key: "releaseUnitPrefix" as BuilderInstallBindingKey,
      ready: Boolean(codeNm.trim()),
      detail: codeNm.trim() || "-"
    },
    {
      key: "runtimePackagePrefix" as BuilderInstallBindingKey,
      ready: Boolean(findSuggestedPageCode()),
      detail: findSuggestedPageCode() || "-"
    }
  ]), [codeNm, menuType, menuUrl, parentCodeValue, en, menuCodeRows]);
  const intakeValidatorStatuses = useMemo(() => ([
    {
      key: "required-beans-present" as BuilderInstallValidatorCheckKey,
      ready: true,
      detail: en ? "Handled in install-bind console after registry creation." : "레지스트리 생성 후 install-bind 콘솔에서 확인"
    },
    {
      key: "required-properties-present" as BuilderInstallValidatorCheckKey,
      ready: Boolean(codeNm.trim() && menuUrl.trim()),
      detail: intakeValidationMessage || (en ? "Registry intake fields are present." : "레지스트리 인테이크 필드가 준비됨")
    },
    {
      key: "menu-root-resolvable" as BuilderInstallValidatorCheckKey,
      ready: menuType === "ADMIN" ? menuUrl.startsWith("/admin/") : (menuUrl.startsWith("/") && !menuUrl.startsWith("/admin/")),
      detail: menuUrl || "-"
    },
    {
      key: "storage-writable" as BuilderInstallValidatorCheckKey,
      ready: true,
      detail: en ? "Validated when the builder package is attached." : "빌더 패키지 연결 시 검증"
    },
    {
      key: "builder-routes-exposed" as BuilderInstallValidatorCheckKey,
      ready: Boolean(menuUrl.trim()),
      detail: menuUrl || "-"
    }
  ]), [codeNm, en, intakeValidationMessage, menuType, menuUrl]);

  useEffect(() => {
    function syncMenuTypeFromLocation() {
      setMenuType(readMenuTypeFromLocation());
    }
    const navigationEventName = getNavigationEventName();
    window.addEventListener("popstate", syncMenuTypeFromLocation);
    window.addEventListener(navigationEventName, syncMenuTypeFromLocation);
    return () => {
      window.removeEventListener("popstate", syncMenuTypeFromLocation);
      window.removeEventListener(navigationEventName, syncMenuTypeFromLocation);
    };
  }, []);

  useEffect(() => {
    const nextSearch = new URLSearchParams(window.location.search);
    if (menuType) {
      nextSearch.set("menuType", menuType);
    } else {
      nextSearch.delete("menuType");
    }
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [menuType]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "menu-management", {
      route: window.location.pathname,
      menuType,
      rowCount: rows.length,
      rootNodeCount: treeData.length,
      visibleNodeCount: visibleNodes.length,
      groupMenuOptionCount: groupMenuOptions.length,
      searchKeyword: deferredSearchKeyword,
      dirtyOrderCount: dirtyOrderRows.length
    });
    logGovernanceScope("COMPONENT", "menu-management-tree", {
      component: "menu-management-tree",
      rootNodeCount: treeData.length,
      visibleNodeCount: visibleNodes.length,
      menuType
    });
  }, [
    deferredSearchKeyword,
    dirtyOrderRows.length,
    groupMenuOptions.length,
    menuType,
    page,
    rows.length,
    treeData.length,
    visibleNodes.length
  ]);

  useEffect(() => {
    setTreeData(buildMenuTree(rows, { includeExposure: true, includeUseAt: true, mapUrl: toDisplayMenuUrl }));
  }, [rows]);

  useEffect(() => {
    if (!parentCodeValue && groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [groupMenuOptions, parentCodeValue]);

  useEffect(() => {
    setActionError("");
    setActionMessage("");
    setSearchKeyword("");
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
    setMenuIcon(iconOptions[0] || "web");
    setUseAt(useAtOptions[0] || "Y");
    setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
  }, [menuType]);

  function moveNode(nodes: MenuNode[], index: number, direction: number) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= nodes.length) {
      return;
    }
    const nextNodes = [...nodes];
      const moved = nextNodes[index];
      nextNodes[index] = nextNodes[nextIndex];
      nextNodes[nextIndex] = moved;
      updateMenuSortOrders(nextNodes);
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
    logGovernanceScope("ACTION", "menu-management-save-order", {
      menuType,
      payloadCount: flattenMenuOrderPayload(treeData).length,
      dirtyOrderCount: dirtyOrderRows.length
    });
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("orderPayload", flattenMenuOrderPayload(treeData).join(","));
    await postFormUrlEncoded(
      buildLocalizedPath("/admin/system/menu/order", "/en/admin/system/menu/order"),
      body
    );
    refreshAdminMenuTree();
    await pageState.reload();
    setActionMessage(en ? "Menu order has been saved." : "메뉴 순서를 저장했습니다.");
  }

  async function handleUpdateMenu(code: string, label: string, url: string) {
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("code", code);
    body.set("codeNm", label);
    body.set("menuUrl", url);
    try {
      await postFormUrlEncoded(
        buildLocalizedPath("/admin/system/menu/update-page", "/en/admin/system/menu/update-page"),
        body
      );
      refreshAdminMenuTree();
      setActionMessage(en ? "Menu updated successfully." : "메뉴가 수정되었습니다.");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update menu.");
    }
  }

  async function handleDeleteMenu(code: string) {
    if (!confirm(en ? "Delete this menu?" : "이 메뉴를 삭제하시겠습니까?")) return;
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("code", code);
    try {
      await postFormUrlEncoded(
        buildLocalizedPath("/admin/system/menu/delete-page", "/en/admin/system/menu/delete-page"),
        body
      );
      refreshAdminMenuTree();
      setActionMessage(en ? "Menu deleted." : "메뉴가 삭제되었습니다.");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete menu.");
    }
  }

  function findSuggestedPageCode() {
    return buildSuggestedPageCode(parentCodeValue, menuCodeRows);
  }

  async function createPageMenu() {
    setActionError("");
    setActionMessage("");
    if (isTopMenu && parentCodeValue.length !== 4) {
      setActionError(en ? "Enter 4-character code for top menu." : "대메뉴는 4자리 코드를 입력하세요.");
      return;
    }
    if (!isTopMenu && !parentCodeValue) {
      setActionError(en ? "Select a parent menu." : "상위 메뉴를 선택하세요.");
      return;
    }
    if (!codeNm.trim()) {
      setActionError(en ? "Enter menu name." : "메뉴명을 입력하세요.");
      return;
    }
    if (!menuUrl.trim()) {
      setActionError(en ? "Enter URL." : "URL을 입력하세요.");
      return;
    }
    if (!menuUrl.startsWith("/")) {
      setActionError(en ? "URL must start with /." : "URL은 /로 시작해야 합니다.");
      return;
    }
    if (menuType === "ADMIN" && !menuUrl.startsWith("/admin/")) {
      setActionError(en ? "Admin URL must start with /admin/." : "관리자 URL은 /admin/으로 시작해야 합니다.");
      return;
    }
    if (menuType === "USER" && !menuUrl.startsWith("/home/")) {
      setActionError(en ? "Home URL must start with /home/." : "홈 URL은 /home/으로 시작해야 합니다.");
      return;
    }
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    if (isTopMenu) {
      body.set("isTopMenu", "true");
      body.set("directCode", parentCodeValue);
    } else {
      body.set("parentCode", parentCodeValue);
    }
    body.set("codeNm", codeNm.trim());
    body.set("codeDc", codeDc.trim());
    body.set("menuUrl", menuUrl.trim());
    body.set("menuIcon", menuIcon);
    body.set("useAt", useAt);
    try {
      const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
        buildLocalizedPath("/admin/system/menu/create-page", "/en/admin/system/menu/create-page"),
        body
      );
      if (!result.success) {
        throw new Error(result.message || "Failed");
      }
      refreshAdminMenuTree();
      setActionMessage(result.message || (en ? "Menu created." : "메뉴가 생성되었습니다."));
      setCodeNm("");
      setCodeDc("");
      setMenuUrl("");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create menu.");
    }
  }

  function renderNodes(nodes: MenuNode[], path: number[] = []) {
    return (
      <ol className="gov-tree-list">
        {nodes.map((node, index) => {
          const depth = node.code.length;
          const chipClass = depth === 4 ? "bg-blue-50 text-[var(--kr-gov-blue)]" : depth === 6 ? "bg-amber-50 text-[#8a5a00]" : "bg-green-50 text-[#196c2e]";
          const currentPath = [...path, index];
          const snapshot = originalSnapshot[node.code];
          const orderChanged = Boolean(snapshot && snapshot.sortOrdr !== node.sortOrdr);
          return (
            <li key={node.code}>
              <div className={`gov-tree-node ${orderChanged ? "ring-1 ring-[var(--kr-gov-blue)] ring-offset-1" : ""}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">{node.icon}</span>
                      <strong className="text-base">{node.label}</strong>
                      <span className={`gov-chip ${chipClass}`}>{node.code}</span>
                      <span className={`gov-chip ${node.useAt === "Y" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{node.useAt === "Y" ? (en ? "Use" : "사용") : (en ? "Unused" : "미사용")}</span>
                      {orderChanged ? <span className="gov-chip bg-indigo-100 text-indigo-700">{en ? "Order changed" : "순서 변경"}</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)] break-all">{node.url || (en ? "No linked URL" : "연결 URL 없음")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                      {en ? "Sort order" : "정렬순서"}: {node.sortOrdr || "-"}
                      {snapshot ? ` / ${en ? "Original" : "기준"}: ${snapshot.sortOrdr || "-"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="gov-btn gov-btn-outline" disabled={index === 0 || Boolean(deferredSearchKeyword)} onClick={() => updateLevel(currentPath, -1)} type="button">{en ? "Up" : "위로"}</button>
                    <button className="gov-btn gov-btn-outline" disabled={index === nodes.length - 1 || Boolean(deferredSearchKeyword)} onClick={() => updateLevel(currentPath, 1)} type="button">{en ? "Down" : "아래로"}</button>
                    <button
                      className="gov-btn gov-btn-outline"
                      onClick={() => {
                        const newLabel = prompt(en ? "Enter new menu name:" : "메뉴명을 입력하세요:", node.label);
                        if (newLabel && newLabel !== node.label) {
                          const newUrl = prompt(en ? "Enter new URL:" : "URL을 입력하세요:", node.url || "");
                          void handleUpdateMenu(node.code, newLabel, newUrl || "");
                        }
                      }}
                      type="button"
                      title={en ? "Edit" : "수정"}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      className="gov-btn gov-btn-outline text-red-600 hover:bg-red-50"
                      onClick={() => void handleDeleteMenu(node.code)}
                      type="button"
                      title={en ? "Delete" : "삭제"}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                    <a
                      href={buildLocalizedPath(
                        `/admin/system/builder-studio?menuCode=${node.code}&pageId=${node.code}&menuTitle=${encodeURIComponent(node.label)}&menuUrl=${encodeURIComponent(node.url || "")}`,
                        `/en/admin/system/builder-studio?menuCode=${node.code}&pageId=${node.code}&menuTitle=${encodeURIComponent(node.label)}&menuUrl=${encodeURIComponent(node.url || "")}`
                      )}
                      className="gov-btn gov-btn-outline"
                      title={en ? "Open in Builder" : "빌더에서 열기"}
                    >
                      <span className="material-symbols-outlined text-[16px]">construction</span>
                    </a>
                  </div>
                </div>
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
        { label: en ? "Menu Registry Console" : "메뉴 레지스트리 콘솔" }
      ]}
      title={en ? "Menu Registry Console" : "메뉴 레지스트리 콘솔"}
    >
      <GovernanceCompressionNav activeId="menu" en={en} />
      <AdminWorkspacePageFrame>
        {page?.menuMgmtMessage || actionMessage ? <PageStatusNotice tone="success">{actionMessage || String(page?.menuMgmtMessage)}</PageStatusNotice> : null}
        {pageState.error || actionError || page?.menuMgmtError ? <PageStatusNotice tone="error">{actionError || page?.menuMgmtError || pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Registry Nodes" : "레지스트리 노드"} value={`${visibleNodes.length} / ${allNodes.length}`} />
          <SummaryMetricCard title={en ? "Binding Order Changes" : "바인딩 순서 변경"} value={String(dirtyOrderRows.length)} />
          <SummaryMetricCard title={en ? "Registry Parents" : "레지스트리 부모"} value={String(groupMenuOptions.length)} />
          <SummaryMetricCard title={en ? "Current Lane" : "현재 레인"} value={menuType} />
        </section>

        <CollectionResultPanel
          data-help-id="menu-management-install-contract"
          icon="inventory_2"
          title={en ? "Install Package Contract" : "설치 패키지 계약"}
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${intakeReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Registry Intake Readiness" : "레지스트리 인테이크 준비도"}</p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{intakeReady ? (en ? "Ready to hand off" : "인계 가능") : (en ? "Needs more intake fields" : "추가 인테이크 필요")}</p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{intakeValidationMessage || (en ? "Bindings and URL shape are aligned with installable-builder intake." : "바인딩과 URL 형태가 설치형 빌더 인테이크 기준과 정렬됨")}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Artifacts" : "산출물"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BUILDER_INSTALL_ARTIFACTS.map((artifact) => (
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-mono text-[var(--kr-gov-text-primary)]" key={artifact}>{artifact}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Required Bindings" : "필수 바인딩"}</p>
                <div className="mt-2 space-y-2">
                  {intakeBindingStatuses.map((item) => (
                    <div className="flex items-start justify-between gap-3 text-sm" key={item.key}>
                      <div>
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{describeBuilderInstallBinding(item.key, en)}</p>
                        <p className="text-[12px] text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.ready ? (en ? "READY" : "준비") : (en ? "PENDING" : "대기")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Validator Checks" : "검증 체크"}</p>
                <div className="mt-2 space-y-2">
                  {intakeValidatorStatuses.map((item) => (
                    <div className="flex items-start justify-between gap-3 text-sm" key={item.key}>
                      <div>
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{describeBuilderValidatorCheck(item.key, en)}</p>
                        <p className="text-[12px] text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.ready ? (en ? "PASS" : "통과") : (en ? "WAIT" : "대기")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-5 py-4">
              <h4 className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Registry-to-Install Handoff" : "레지스트리에서 설치로 인계"}</h4>
              <ul className="mt-3 space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                <li>{en ? `Bindings tracked: ${BUILDER_INSTALL_REQUIRED_BINDINGS.length}` : `추적 바인딩: ${BUILDER_INSTALL_REQUIRED_BINDINGS.length}`}</li>
                <li>{en ? `Validator checks tracked: ${BUILDER_INSTALL_VALIDATOR_CHECKS.length}` : `추적 검증 체크: ${BUILDER_INSTALL_VALIDATOR_CHECKS.length}`}</li>
                <li>{en ? "Once the registry entry is created, the install-bind console should inherit the same menu code and binding URL without remapping." : "레지스트리 엔트리가 생성되면 install-bind 콘솔은 같은 메뉴 코드와 바인딩 URL을 재매핑 없이 이어받아야 합니다."}</li>
                <li>{en ? "Do not create a page registry entry unless the binding URL already matches the intended install lane." : "바인딩 URL이 목표 설치 레인과 맞지 않으면 페이지 레지스트리 엔트리를 만들지 않습니다."}</li>
              </ul>
            </div>
          </div>
        </CollectionResultPanel>

        <CollectionResultPanel
          data-help-id="menu-management-scope"
          icon="tune"
          title={en ? "Registry Scope and Search" : "레지스트리 범위와 검색"}
        >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr] xl:grid-cols-[16rem_1fr_1.2fr] items-end">
          <div>
            <label className="gov-label" htmlFor="menuType">{en ? "Registry Lane" : "레지스트리 레인"}</label>
            <select className="gov-select" id="menuType" value={menuType} onChange={(event) => setMenuType(event.target.value)}>
              {menuTypes.map((type) => (
                <option key={stringOf(type, "value")} value={stringOf(type, "value")}>{stringOf(type, "label")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="gov-label" htmlFor="menuSearchKeyword">{en ? "Search registry tree" : "레지스트리 트리 검색"}</label>
            <input className="gov-input" id="menuSearchKeyword" onChange={(event) => setSearchKeyword(event.target.value)} placeholder={en ? "Menu code, name, URL" : "메뉴 코드, 메뉴명, URL"} value={searchKeyword} />
          </div>
        </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="menu-management-register">
          <GridToolbar
            title={en ? "Registry Intake" : "레지스트리 인테이크"}
          />
          <div className="p-6">

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTopMenu}
                    onChange={(e) => {
                      setIsTopMenu(e.target.checked);
                      if (e.target.checked) {
                        let maxSuffix = 0;
                        const prefix = "A";
                        menuCodeRows.forEach((row) => {
                          if (row.code.length === 4 && row.code.startsWith(prefix)) {
                            const suffix = Number(row.code.slice(1));
                            if (Number.isFinite(suffix) && suffix > maxSuffix) {
                              maxSuffix = suffix;
                            }
                          }
                        });
                        const newCode = `${prefix}${String(maxSuffix + 1).padStart(3, "0")}`;
                        setParentCodeValue(newCode);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{en ? "Create as Top Menu (4-char)" : "대메뉴로 등록 (4자리)"}</span>
                </label>
              </div>
            </div>

            {isTopMenu ? (
              <div>
                <label className="gov-label" htmlFor="topMenuCode">{en ? "Top Menu Code (4 chars)" : "대메뉴 코드 (4자리)"}</label>
                <input
                  className="gov-input"
                  id="topMenuCode"
                  maxLength={4}
                  value={parentCodeValue}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
                    setParentCodeValue(val);
                  }}
                  placeholder={en ? "e.g. A009" : "예: A009"}
                />
              </div>
            ) : (
              <div>
                <label className="gov-label" htmlFor="parentCode">{en ? "Registry Parent" : "레지스트리 부모"}</label>
                <select className="gov-select" id="parentCode" value={parentCodeValue} onChange={(event) => setParentCodeValue(event.target.value)}>
                  {groupMenuOptions.map((option) => (
                    <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="gov-label" htmlFor="suggestedCode">{en ? "Generated Registry Code" : "생성 예정 레지스트리 코드"}</label>
              <input className="gov-input bg-gray-50" id="suggestedCode" readOnly value={isTopMenu ? parentCodeValue.toUpperCase() : findSuggestedPageCode()} />
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
            <h4 className="font-bold text-[var(--kr-gov-blue)]">{en ? "Registry Output" : "레지스트리 생성 항목"}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[var(--kr-gov-text-secondary)] list-disc pl-5">
              <li>{en ? "Registry code and binding URL metadata" : "레지스트리 코드와 바인딩 URL 메타데이터"}</li>
              <li>{en ? "Default PAGE_CODE_VIEW feature seed" : "기본 PAGE_CODE_VIEW 기능 시드"}</li>
              <li>{en ? "Initial sibling registry order under the selected parent" : "선택 부모 하위의 초기 레지스트리 정렬"}</li>
              <li>{en ? "A menu entry that can hand off to install-bind and package-builder flows" : "설치-바인딩과 패키지 빌더 흐름으로 넘길 수 있는 메뉴 엔트리"}</li>
            </ul>
            <div className="mt-4">
              <button className="gov-btn gov-btn-primary w-full" onClick={() => { void createPageMenu().catch((error: Error) => setActionError(error.message)); }} type="button">
                {en ? "Create Registry Entry" : "레지스트리 엔트리 생성"}
              </button>
            </div>
          </div>
        </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="menu-management-tree">
          <GridToolbar
            actions={<div className="flex flex-wrap items-center gap-2"><button className="gov-btn gov-btn-primary" onClick={() => { void saveOrder().catch((error: Error) => setActionError(error.message)); }} type="button">{en ? "Save Registry Order" : "레지스트리 순서 저장"}</button></div>}
            title={en ? "Registry Tree" : "레지스트리 트리"}
          />
          <div className="p-6">

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

        {dirtyOrderRows.length > 0 ? (
          <CollectionResultPanel className="mb-4" icon="pending_actions" title={en ? "Pending registry changes" : "저장 대기 레지스트리 변경"}>
            <div className="mt-2 flex flex-wrap gap-2">
                {dirtyOrderRows.slice(0, 8).map((node) => <span className="gov-chip bg-indigo-100 text-indigo-700" key={`order-${node.code}`}>{`${node.code} ${en ? "registry order" : "레지스트리 순서"}`}</span>)}
                {dirtyOrderRows.length > 8 ? <span className="gov-chip bg-slate-100 text-slate-700">+{dirtyOrderRows.length - 8}</span> : null}
            </div>
          </CollectionResultPanel>
        ) : null}

        <WarningPanel className="mb-4" title={en ? "Registry visibility rule" : "레지스트리 노출 규칙"}>
          {en
            ? "Sidebar or sitemap exposure is governed separately. This console focuses on registry intake and sibling binding order."
            : "사이드바나 사이트맵 노출 정책은 별도 관리 대상으로 분리합니다. 이 콘솔은 레지스트리 인테이크와 같은 부모 기준 바인딩 순서에 집중합니다."}
        </WarningPanel>

        {visibleNodes.length === 0 ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "No menus matched the current search." : "현재 검색 조건에 맞는 메뉴가 없습니다."}
          </div>
        ) : renderNodes(filteredTreeData)}
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
// agent note: updated by FreeAgent Ultra
