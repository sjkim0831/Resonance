import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { refreshAdminMenuTree } from "../../lib/api/adminShell";
import { postFormUrlEncoded } from "../../lib/api/core";
import { fetchContentMenuManagementPage } from "../../lib/api/platform";
import type { MenuManagementPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { buildMenuTree, buildSuggestedPageCode, flattenMenuOrderPayload, type MenuTreeNode, updateMenuSortOrders } from "./menuTreeShared";
import { toDisplayMenuUrl } from "./menuUrlDisplay";

type MenuNode = MenuTreeNode;

type MenuSnapshot = {
  sortOrdr: number;
  expsrAt: string;
};

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
    const filteredChildren = filterTree(node.children, keyword);
    const matches = [node.code, node.label, node.url, node.icon, node.useAt, node.expsrAt]
      .join(" ")
      .toLowerCase()
      .includes(normalizedKeyword);
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

function validateCreateForm(params: { en: boolean; parentCodeValue: string; codeNm: string; menuUrl: string }) {
  const { en, parentCodeValue, codeNm, menuUrl } = params;
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
  if (!menuUrl.startsWith("/admin/content/")) {
    return en ? "Content menu URL must start with /admin/content/." : "콘텐츠 메뉴 URL은 /admin/content/로 시작해야 합니다.";
  }
  return "";
}

export function FaqMenuManagementMigrationPage() {
  const en = isEnglish();
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [parentCodeValue, setParentCodeValue] = useState("");
  const [codeNm, setCodeNm] = useState("");
  const [codeDc, setCodeDc] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuIcon, setMenuIcon] = useState("article");
  const [useAt, setUseAt] = useState("Y");
  const [treeData, setTreeData] = useState<MenuNode[]>([]);

  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const pageState = useAsyncValue<MenuManagementPagePayload>(() => fetchContentMenuManagementPage(), []);
  const page = pageState.value;
  const rows = useMemo(() => ((page?.menuRows || []) as Array<Record<string, unknown>>), [page?.menuRows]);
  const menuCodeRows = useMemo(() => rows.map((row) => ({ code: stringOf(row, "code").toUpperCase() })), [rows]);
  const groupMenuOptions = ((page?.groupMenuOptions || []) as Array<Record<string, string>>);
  const iconOptions = ((page?.iconOptions || []) as string[]);
  const useAtOptions = ((page?.useAtOptions || []) as string[]);

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

  useEffect(() => {
    setTreeData(buildMenuTree(rows, { includeExposure: true, includeUseAt: true, mapUrl: toDisplayMenuUrl }));
  }, [rows]);

  useEffect(() => {
    if (!parentCodeValue && groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [groupMenuOptions, parentCodeValue]);

  useEffect(() => {
    logGovernanceScope("PAGE", "faq-menu-management", {
      route: window.location.pathname,
      rowCount: rows.length,
      rootNodeCount: treeData.length,
      visibleNodeCount: visibleNodes.length,
      groupMenuOptionCount: groupMenuOptions.length,
      searchKeyword: deferredSearchKeyword,
      dirtyOrderCount: dirtyOrderRows.length
    });
  }, [deferredSearchKeyword, dirtyOrderRows.length, groupMenuOptions.length, rows.length, treeData.length, visibleNodes.length]);

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
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", "ADMIN");
    body.set("orderPayload", flattenMenuOrderPayload(treeData).join(","));
    await postFormUrlEncoded(buildLocalizedPath("/admin/content/menu/order", "/en/admin/content/menu/order"), body);
    refreshAdminMenuTree();
    await pageState.reload();
    setActionMessage(en ? "FAQ menu order has been saved." : "FAQ 메뉴 순서를 저장했습니다.");
  }

  function findSuggestedPageCode() {
    return buildSuggestedPageCode(parentCodeValue, menuCodeRows);
  }

  async function createPageMenu() {
    setActionError("");
    setActionMessage("");
    const validationError = validateCreateForm({ en, parentCodeValue, codeNm, menuUrl });
    if (validationError) {
      setActionError(validationError);
      return;
    }
    const body = new URLSearchParams();
    body.set("menuType", "ADMIN");
    body.set("parentCode", parentCodeValue);
    body.set("codeNm", codeNm.trim());
    body.set("codeDc", codeDc.trim());
    body.set("menuUrl", menuUrl.trim());
    body.set("menuIcon", menuIcon);
    body.set("useAt", useAt);
    const responseBody = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
      buildLocalizedPath("/admin/content/menu/create-page", "/en/admin/content/menu/create-page"),
      body
    );
    if (!responseBody.success) {
      throw new Error(responseBody.message || "Failed to create FAQ page menu.");
    }
    refreshAdminMenuTree();
    await pageState.reload();
    setActionMessage(responseBody.message || (en ? "The FAQ page has been created." : "FAQ 페이지 메뉴를 생성했습니다."));
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
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
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)] break-all">{node.url || (en ? "No linked URL" : "연결 URL 없음")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="gov-btn gov-btn-outline" disabled={index === 0 || Boolean(deferredSearchKeyword)} onClick={() => updateLevel(currentPath, -1)} type="button">{en ? "Up" : "위로"}</button>
                    <button className="gov-btn gov-btn-outline" disabled={index === nodes.length - 1 || Boolean(deferredSearchKeyword)} onClick={() => updateLevel(currentPath, 1)} type="button">{en ? "Down" : "아래로"}</button>
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
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "FAQ Management" : "FAQ 관리", href: buildLocalizedPath("/admin/content/faq_list", "/en/admin/content/faq_list") },
        { label: en ? "Menu Management" : "메뉴 관리" }
      ]}
      title={en ? "FAQ Menu Management" : "FAQ 메뉴 관리"}
      subtitle={en ? "Operate the FAQ-management menu tree and register FAQ-related content pages under /admin/content/." : "FAQ 관리 계열 메뉴 트리를 운영하고 /admin/content/ 하위의 FAQ 관련 페이지를 등록합니다."}
    >
      <AdminWorkspacePageFrame>
        {page?.menuMgmtMessage || actionMessage ? <PageStatusNotice tone="success">{actionMessage || String(page?.menuMgmtMessage)}</PageStatusNotice> : null}
        {pageState.error || actionError || page?.menuMgmtError ? <PageStatusNotice tone="error">{actionError || page?.menuMgmtError || pageState.error}</PageStatusNotice> : null}

        <section className="rounded-[28px] border border-[#c9def7] bg-[linear-gradient(135deg,#f7fbff_0%,#eef6ff_52%,#f9fcff_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(26,71,128,0.08)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--kr-gov-blue)] shadow-sm">
                <span className="material-symbols-outlined text-[18px]">quiz</span>
                {en ? "FAQ Operations Hub" : "FAQ 운영 허브"}
              </span>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-[var(--kr-gov-text-primary)]">
                  {en ? "Manage FAQ, Q&A, and tag navigation from one dedicated screen." : "FAQ, Q&A, 태그 메뉴 구조를 전용 화면에서 함께 정리합니다."}
                </h2>
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page is dedicated to the FAQ branch. Use it to control menu order, register new FAQ-related pages, and keep the operator navigation in sync."
                    : "이 화면은 FAQ 가지 전용입니다. FAQ 관련 메뉴 순서 조정, 신규 페이지 등록, 운영자 좌측 내비게이션 동기화를 여기서 처리합니다."}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3 xl:min-w-[420px]">
              <a className="rounded-[20px] border border-white/80 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-[1px]" href={buildLocalizedPath("/admin/content/faq_list", "/en/admin/content/faq_list")}>
                <div className="flex items-center gap-2 text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined text-[20px]">quiz</span>
                  <strong>{en ? "FAQ" : "FAQ 관리"}</strong>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Review exposed FAQ items and status." : "노출 중인 FAQ 항목과 상태를 확인합니다."}</p>
              </a>
              <a className="rounded-[20px] border border-white/80 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-[1px]" href={buildLocalizedPath("/admin/content/qna", "/en/admin/content/qna")}>
                <div className="flex items-center gap-2 text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined text-[20px]">category</span>
                  <strong>{en ? "Q&A" : "Q&A 분류"}</strong>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Maintain category structure used by Q&A flows." : "Q&A 화면에서 쓰는 분류 구조를 관리합니다."}</p>
              </a>
              <a className="rounded-[20px] border border-white/80 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-[1px]" href={buildLocalizedPath("/admin/content/tag", "/en/admin/content/tag")}>
                <div className="flex items-center gap-2 text-[var(--kr-gov-blue)]">
                  <span className="material-symbols-outlined text-[20px]">sell</span>
                  <strong>{en ? "Tags" : "태그 관리"}</strong>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Inspect connected tags and navigation labels." : "연결된 태그와 탐색 라벨을 함께 점검합니다."}</p>
              </a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Visible Nodes" : "표시 노드"} value={`${visibleNodes.length} / ${allNodes.length}`} description={en ? "FAQ-menu search results / total" : "FAQ 메뉴 검색 결과 / 전체"} />
          <SummaryMetricCard title={en ? "Order Changes" : "순서 변경"} value={String(dirtyOrderRows.length)} description={en ? "Pending before save" : "저장 전 변경 건"} />
          <SummaryMetricCard title={en ? "Group Menus" : "그룹 메뉴"} value={String(groupMenuOptions.length)} description={en ? "FAQ-management parents" : "FAQ 관리 부모 메뉴"} />
          <SummaryMetricCard title={en ? "Scope" : "범위"} value="FAQ" description={en ? "A004 FAQ tree only" : "A004 FAQ 트리 전용"} />
        </section>

        <CollectionResultPanel
          data-help-id="admin-menu-placeholder-card"
          description={en ? "This screen handles the A004 FAQ-management menu tree. Reordering is limited to sibling menus under the same parent." : "이 화면은 A004 FAQ 관리 메뉴 트리를 다룹니다. 순서 이동은 같은 부모 메뉴 하위에서만 가능합니다."}
          icon="folder_managed"
          title={en ? "FAQ Menu Scope and Search" : "FAQ 메뉴 범위와 검색"}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.2fr] items-end">
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Pages created here should start with /admin/content/ and belong to the FAQ-management branch." : "이 화면에서 생성하는 페이지 URL은 /admin/content/로 시작하고 FAQ 관리 가지에 속해야 합니다."}
            </div>
            <div>
              <label className="gov-label" htmlFor="faqMenuSearchKeyword">{en ? "Search FAQ menu tree" : "FAQ 메뉴 트리 검색"}</label>
              <input className="gov-input" id="faqMenuSearchKeyword" onChange={(event) => setSearchKeyword(event.target.value)} placeholder={en ? "Menu code, name, URL" : "메뉴 코드, 메뉴명, URL"} value={searchKeyword} />
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="faq-menu-management-register">
          <GridToolbar meta={en ? "Register FAQ-related pages under existing FAQ-management groups." : "기존 FAQ 관리 그룹 아래에 FAQ 관련 페이지를 등록합니다."} title={en ? "Quick FAQ Page Registration" : "빠른 FAQ 페이지 등록"} />
          <div className="p-6">
            <WarningPanel className="mb-4" title={en ? "FAQ branch boundary" : "FAQ 관리 경계"}>
              {en ? "System menu management stays at /admin/system/menu. This page only manages the FAQ-management branch under content." : "시스템 메뉴 관리는 /admin/system/menu에 유지됩니다. 이 화면은 콘텐츠 아래 FAQ 관리 가지 전용입니다."}
            </WarningPanel>
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="gov-label" htmlFor="faqParentCode">{en ? "FAQ Group Menu" : "FAQ 그룹 메뉴"}</label>
                  <select className="gov-select" id="faqParentCode" value={parentCodeValue} onChange={(event) => setParentCodeValue(event.target.value)}>
                    {groupMenuOptions.map((option) => (
                      <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="gov-label" htmlFor="faqSuggestedCode">{en ? "Generated Page Code" : "생성 예정 페이지 코드"}</label>
                  <input className="gov-input bg-gray-50" id="faqSuggestedCode" readOnly value={findSuggestedPageCode()} />
                </div>
                <div>
                  <label className="gov-label" htmlFor="faqCodeNm">{en ? "Page Name" : "페이지명"}</label>
                  <input className="gov-input" id="faqCodeNm" value={codeNm} onChange={(event) => setCodeNm(event.target.value)} />
                </div>
                <div>
                  <label className="gov-label" htmlFor="faqCodeDc">{en ? "English Page Name" : "영문 페이지명"}</label>
                  <input className="gov-input" id="faqCodeDc" value={codeDc} onChange={(event) => setCodeDc(event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label" htmlFor="faqMenuUrl">{en ? "Page URL" : "페이지 URL"}</label>
                  <input className="gov-input" id="faqMenuUrl" placeholder="/admin/content/..." value={menuUrl} onChange={(event) => setMenuUrl(event.target.value)} />
                </div>
                <div>
                  <label className="gov-label" htmlFor="faqMenuIcon">{en ? "Icon" : "아이콘"}</label>
                  <select className="gov-select" id="faqMenuIcon" value={menuIcon} onChange={(event) => setMenuIcon(event.target.value)}>
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="gov-label" htmlFor="faqUseAt">{en ? "Use" : "사용 여부"}</label>
                  <select className="gov-select" id="faqUseAt" value={useAt} onChange={(event) => setUseAt(event.target.value)}>
                    {useAtOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-5 py-4">
                <h4 className="font-bold text-[var(--kr-gov-blue)]">{en ? "What gets created" : "함께 생성되는 항목"}</h4>
                <ul className="mt-3 space-y-2 text-sm text-[var(--kr-gov-text-secondary)] list-disc pl-5">
                  <li>{en ? "FAQ-branch detail code and menu metadata" : "FAQ 관리 가지의 상세코드와 메뉴 메타데이터"}</li>
                  <li>{en ? "Default VIEW feature for the new FAQ page" : "신규 FAQ 페이지의 기본 VIEW 기능"}</li>
                  <li>{en ? "Initial sibling sort order under the selected FAQ group" : "선택한 FAQ 그룹 하위의 초기 정렬 순서"}</li>
                </ul>
                <div className="mt-4">
                  <button className="gov-btn gov-btn-primary w-full" onClick={() => { void createPageMenu().catch((error: Error) => setActionError(error.message)); }} type="button">
                    {en ? "Create FAQ Page Menu" : "FAQ 페이지 메뉴 생성"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="faq-menu-management-tree">
          <GridToolbar actions={<div className="flex flex-wrap items-center gap-2"><button className="gov-btn gov-btn-primary" onClick={() => { void saveOrder().catch((error: Error) => setActionError(error.message)); }} type="button">{en ? "Save Order" : "순서 저장"}</button></div>} meta={en ? "Review FAQ-menu depth and sibling ordering before saving." : "FAQ 메뉴 깊이와 같은 부모 기준 정렬 변경을 확인한 뒤 저장합니다."} title={en ? "FAQ Menu Tree" : "FAQ 메뉴 트리"} />
          <div className="p-6">
            <WarningPanel className="mb-4" title={en ? "Exposure note" : "노출 안내"}>
              {en ? "This page manages FAQ-branch menu metadata. FAQ, Q&A, and tag business data keep running on each operational screen." : "이 화면은 FAQ 관리 가지의 메뉴 메타데이터를 관리합니다. FAQ, Q&A, 태그 업무 데이터는 각 운영 화면에서 계속 관리합니다."}
            </WarningPanel>
            {visibleNodes.length === 0 ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No FAQ menus matched the current search." : "현재 검색 조건에 맞는 FAQ 메뉴가 없습니다."}
              </div>
            ) : renderNodes(filteredTreeData)}
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
