import { FormEvent, useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchFunctionManagementPage } from "../../lib/api/platform";
import type { FunctionManagementPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf, submitFormRequest } from "../admin-system/adminSystemShared";
import { ADMIN_BUTTON_LABELS } from "../admin-ui/labels";
import { AdminInput, AdminSelect, AdminTable, CollectionResultPanel, GridToolbar, MemberButton, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  menuType: string;
  searchMenuCode: string;
  searchKeyword: string;
};

export function FunctionManagementMigrationPage() {
  const en = isEnglish();
  const searchParams = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState<Filters>({
    menuType: searchParams.get("menuType") || "ADMIN",
    searchMenuCode: searchParams.get("searchMenuCode") || "",
    searchKeyword: searchParams.get("searchKeyword") || ""
  });
  const [draft, setDraft] = useState(filters);
  const [actionError, setActionError] = useState("");
  const pageState = useAsyncValue<FunctionManagementPagePayload>(
    () => fetchFunctionManagementPage(filters),
    [filters.menuType, filters.searchMenuCode, filters.searchKeyword],
    {
      onSuccess(payload) {
        setDraft({
          menuType: String(payload.menuType || filters.menuType || "ADMIN"),
          searchMenuCode: String(payload.searchMenuCode || ""),
          searchKeyword: String(payload.searchKeyword || "")
        });
      }
    }
  );
  const page = pageState.value;
  const featurePageOptions = (page?.featurePageOptions || []) as Array<Record<string, unknown>>;
  const featureRows = (page?.featureRows || []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "function-management", {
      route: window.location.pathname,
      menuType: filters.menuType,
      featureRowCount: featureRows.length,
      featurePageOptionCount: featurePageOptions.length,
      unassignedCount: Number(page.featureUnassignedCount || 0)
    });
    logGovernanceScope("COMPONENT", "function-management-list", {
      component: "function-management-list",
      rowCount: featureRows.length,
      searchMenuCode: filters.searchMenuCode
    });
  }, [featurePageOptions.length, featureRows.length, filters.menuType, filters.searchMenuCode, page]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    logGovernanceScope("ACTION", "function-management-submit", {
      menuType: draft.menuType,
      searchMenuCode: draft.searchMenuCode,
      searchKeyword: draft.searchKeyword
    });
    setActionError("");
    try {
      await submitFormRequest(event.currentTarget);
      event.currentTarget.reset();
      await pageState.reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Request failed." : "요청 처리에 실패했습니다."));
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Function Management" : "기능 관리" }
      ]}
      title={en ? "Function Management" : "기능 관리"}
      subtitle={en ? "Connect feature codes to pages and authority mapping targets." : "COMTNMENUINFO 기준 페이지에 기능 코드를 연결합니다. 이후 회원 수정 화면에서 기능 코드 기준 권한 매핑을 추가할 수 있도록 구성합니다."}
    >
      {pageState.error || actionError || page?.featureMgmtError ? (
        <PageStatusNotice tone="error">
          {actionError || page?.featureMgmtError || pageState.error}
        </PageStatusNotice>
      ) : null}

      {Number(page?.featureUnassignedCount || 0) > 0 ? (
        <WarningPanel title={en ? "Authority review required" : "권한 검토 필요"}>
          <span className="font-bold">{Number(page?.featureUnassignedCount || 0)}</span>
          {en ? " features are not linked to any authority group yet." : "개 기능이 아직 어떤 권한 그룹에도 연결되지 않았습니다. 자동 부여 대신 권한 그룹 화면에서 검토 후 수동 반영하세요."}
        </WarningPanel>
      ) : null}

      <AdminWorkspacePageFrame>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard title={en ? "Feature Count" : "등록 기능 수"} value={Number(page?.featureTotalCount || 0)} description={en ? "All registered features" : "전체 등록 건수"} />
        <SummaryMetricCard title={en ? "Authority Review" : "권한 검토 필요"} value={Number(page?.featureUnassignedCount || 0)} description={en ? "Not linked to any role" : "권한 그룹 미연결"} />
        <SummaryMetricCard title={en ? "Visible Pages" : "대상 페이지 수"} value={featurePageOptions.length} description={en ? "Selectable page targets" : "선택 가능한 페이지"} />
        <SummaryMetricCard title={en ? "Search Results" : "조회 결과"} value={featureRows.length} description={en ? "Current filter rows" : "현재 필터 기준"} />
      </section>
      <section className="gov-card" data-help-id="function-management-register">
        <GridToolbar
          actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">extension</span>}
          className="mb-4"
          meta={en ? "Register a global feature code and bind it to a managed page." : "전역 기능 코드를 등록하고 관리 대상 페이지에 연결합니다."}
          title={en ? "Register Feature" : "기능 등록"}
        />

        <form action={buildLocalizedPath("/admin/system/feature-management/create", "/en/admin/system/feature-management/create")} className="grid grid-cols-1 xl:grid-cols-6 gap-4" method="post" onSubmit={handleSubmit}>
          <input name="menuType" type="hidden" value={draft.menuType} />
          <div>
            <label className="gov-label" htmlFor="menuTypeDisplay">{en ? "Page Scope" : "화면 구분"}</label>
            <AdminSelect id="menuTypeDisplay" value={draft.menuType} onChange={(event) => {
              const nextMenuType = event.target.value;
              setDraft((current) => ({ ...current, menuType: nextMenuType, searchMenuCode: "" }));
              setFilters((current) => ({ ...current, menuType: nextMenuType, searchMenuCode: "" }));
            }}>
              <option value="USER">{en ? "Home" : "홈"}</option>
              <option value="ADMIN">{en ? "Admin" : "관리자"}</option>
            </AdminSelect>
          </div>
          <div className="xl:col-span-2">
            <label className="gov-label" htmlFor="menuCode">{en ? "Target Page" : "대상 페이지"}</label>
            <AdminSelect id="menuCode" name="menuCode" defaultValue={draft.searchMenuCode}>
              <option value="">{en ? "Select" : "선택"}</option>
              {featurePageOptions.map((option) => (
                <option key={stringOf(option, "menuCode")} value={stringOf(option, "menuCode")}>
                  {`${stringOf(option, "menuNm")} (${stringOf(option, "menuCode")})`}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="gov-label" htmlFor="featureCode">{en ? "Feature Code" : "기능 코드"}</label>
            <AdminInput id="featureCode" name="featureCode" placeholder="MENU_CREATE" />
          </div>
          <div>
            <label className="gov-label" htmlFor="featureNm">{en ? "Feature Name" : "기능명"}</label>
            <AdminInput id="featureNm" name="featureNm" placeholder={en ? "Create Menu" : "예: 메뉴 등록"} />
          </div>
          <div>
            <label className="gov-label" htmlFor="featureNmEn">{en ? "Feature Name (EN)" : "영문 기능명"}</label>
            <AdminInput id="featureNmEn" name="featureNmEn" placeholder="Create Menu" />
          </div>
          <div className="xl:col-span-4">
            <label className="gov-label" htmlFor="featureDc">{en ? "Description" : "기능 설명"}</label>
            <AdminInput id="featureDc" name="featureDc" placeholder={en ? "Feature description" : "회원 수정 화면의 권한 매핑 기준 설명"} />
          </div>
          <div>
            <label className="gov-label" htmlFor="useAt">{en ? "Use" : "사용 여부"}</label>
            <AdminSelect defaultValue="Y" id="useAt" name="useAt">
              <option value="Y">Y</option>
              <option value="N">N</option>
            </AdminSelect>
          </div>
          <div className="xl:col-span-6">
            <CollectionResultPanel description={en ? "Feature codes are reused as the shared key in member and authority editors." : "기능 코드는 회원/권한 편집 화면에서 공통 키로 재사용됩니다."} title={en ? "Shared governance rule" : "공통 거버넌스 규칙"}>
              {en ? "Store feature codes as globally unique values and review role linkage after creation." : "기능 코드는 전역 고유값으로 저장하고, 등록 후 권한 그룹 연계를 별도로 검토해야 합니다."}
            </CollectionResultPanel>
          </div>
          <div className="xl:col-span-6 flex justify-end gap-2">
            <MemberButton type="submit" variant="primary">{en ? "Add Feature" : ADMIN_BUTTON_LABELS.create}</MemberButton>
          </div>
        </form>
      </section>

      <section className="gov-card" data-help-id="function-management-list">
        <GridToolbar
          actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">view_list</span>}
          className="mb-4"
          title={en ? "Registered Features" : "등록 기능 목록"}
        />

        <form className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4" onSubmit={(event) => {
          event.preventDefault();
          logGovernanceScope("ACTION", "function-management-search", {
            menuType: draft.menuType,
            searchMenuCode: draft.searchMenuCode,
            searchKeyword: draft.searchKeyword
          });
          setFilters(draft);
        }}>
          <div>
            <label className="gov-label" htmlFor="searchMenuType">{en ? "Page Scope" : "화면 구분"}</label>
            <AdminSelect id="searchMenuType" value={draft.menuType} onChange={(event) => setDraft((current) => ({ ...current, menuType: event.target.value, searchMenuCode: "" }))}>
              <option value="USER">{en ? "Home" : "홈"}</option>
              <option value="ADMIN">{en ? "Admin" : "관리자"}</option>
            </AdminSelect>
          </div>
          <div>
            <label className="gov-label" htmlFor="searchMenuCode">{en ? "Page" : "페이지"}</label>
            <AdminSelect id="searchMenuCode" value={draft.searchMenuCode} onChange={(event) => setDraft((current) => ({ ...current, searchMenuCode: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              {featurePageOptions.map((option) => (
                <option key={stringOf(option, "menuCode")} value={stringOf(option, "menuCode")}>
                  {`${stringOf(option, "menuNm")} (${stringOf(option, "menuCode")})`}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="gov-label" htmlFor="searchKeyword">{en ? "Keyword" : "기능 검색"}</label>
            <AdminInput id="searchKeyword" placeholder={en ? "Feature code or name" : "기능 코드 또는 기능명"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
          </div>
          <div className="flex items-end gap-2">
            <MemberButton className="w-full" type="submit">{en ? "Search" : ADMIN_BUTTON_LABELS.search}</MemberButton>
            <MemberButton className="w-full" onClick={() => {
              const reset = { menuType: draft.menuType, searchMenuCode: "", searchKeyword: "" };
              logGovernanceScope("ACTION", "function-management-reset", reset);
              setDraft(reset);
              setFilters(reset);
            }} type="button">{en ? "Reset" : ADMIN_BUTTON_LABELS.reset}</MemberButton>
          </div>
        </form>

        <div className="overflow-x-auto">
          <AdminTable>
            <thead>
              <tr className="gov-table-header">
                <th className="px-4 py-3">{en ? "Page" : "페이지"}</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">{en ? "Feature Code" : "기능 코드"}</th>
                <th className="px-4 py-3">{en ? "Feature Name" : "기능명"}</th>
                <th className="px-4 py-3">{en ? "Feature Name (EN)" : "영문 기능명"}</th>
                <th className="px-4 py-3">{en ? "Description" : "설명"}</th>
                <th className="px-4 py-3 text-center">{en ? "Authority" : "권한 연계"}</th>
                <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                <th className="px-4 py-3 text-center">{en ? "Actions" : "관리"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {featureRows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>{en ? "No features registered." : "등록된 기능이 없습니다."}</td></tr>
              ) : featureRows.map((row) => {
                const featureCode = stringOf(row, "featureCode");
                const assignedRoleCount = Number(row.assignedRoleCount || 0);
                const unassigned = Boolean(row.unassignedToRole);
                return (
                  <tr key={featureCode}>
                    <td className="px-4 py-3 min-w-[12rem]">
                      <p className="font-bold">{stringOf(row, "menuNm")}</p>
                      <p className="text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "menuCode")}</p>
                    </td>
                    <td className="px-4 py-3 min-w-[14rem] break-all text-[var(--kr-gov-text-secondary)]">{stringOf(row, "menuUrl")}</td>
                    <td className="px-4 py-3 font-bold whitespace-nowrap">{featureCode}</td>
                    <td className="px-4 py-3">{stringOf(row, "featureNm")}</td>
                    <td className="px-4 py-3">{stringOf(row, "featureNmEn")}</td>
                    <td className="px-4 py-3 min-w-[14rem] text-[var(--kr-gov-text-secondary)]">{stringOf(row, "featureDc")}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${unassigned ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {unassigned ? (en ? "Unassigned" : "미할당") : `Role ${assignedRoleCount}${en ? "" : "개"}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{stringOf(row, "useAt")}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <form action={buildLocalizedPath("/admin/system/feature-management/delete", "/en/admin/system/feature-management/delete")} method="post" onSubmit={handleSubmit}>
                        <input name="featureCode" type="hidden" value={featureCode} />
                        <input name="menuType" type="hidden" value={filters.menuType} />
                        <input name="searchMenuCode" type="hidden" value={filters.searchMenuCode} />
                        <input name="searchKeyword" type="hidden" value={filters.searchKeyword} />
                        <MemberButton type="submit" variant="danger">{en ? "Delete" : "삭제"}</MemberButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </div>
      </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
