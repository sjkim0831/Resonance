import { buildLocalizedPath } from "../../lib/navigation/runtime";

type BuilderRouteQuery = {
  menuCode?: string;
  pageId?: string;
  menuTitle?: string;
  menuUrl?: string;
  snapshotVersionId?: string;
  projectId?: string;
};

function appendQuery(basePath: string, params: Record<string, string>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildBuilderScopedPath(koPath: string, enPath: string, query: BuilderRouteQuery = {}) {
  return buildLocalizedPath(
    appendQuery(koPath, {
      menuCode: query.menuCode || "",
      pageId: query.pageId || "",
      menuTitle: query.menuTitle || "",
      menuUrl: query.menuUrl || "",
      snapshotVersionId: query.snapshotVersionId || "",
      projectId: query.projectId || ""
    }),
    appendQuery(enPath, {
      menuCode: query.menuCode || "",
      pageId: query.pageId || "",
      menuTitle: query.menuTitle || "",
      menuUrl: query.menuUrl || "",
      snapshotVersionId: query.snapshotVersionId || "",
      projectId: query.projectId || ""
    })
  );
}

export function buildEnvironmentManagementPath(menuCode = "", projectId = "") {
  return buildLocalizedPath(
    appendQuery("/admin/system/environment-management", { menuCode, projectId }),
    appendQuery("/en/admin/system/environment-management", { menuCode, projectId })
  );
}

export function buildScreenBuilderPath(query: BuilderRouteQuery = {}) {
  return buildBuilderScopedPath("/admin/system/screen-builder", "/en/admin/system/screen-builder", query);
}

export function buildScreenRuntimePath(query: BuilderRouteQuery = {}) {
  return buildBuilderScopedPath("/admin/system/screen-runtime", "/en/admin/system/screen-runtime", query);
}

export function buildCurrentRuntimeComparePath(query: BuilderRouteQuery = {}) {
  return buildBuilderScopedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare", query);
}

export function buildRepairWorkbenchPath(query: BuilderRouteQuery = {}) {
  return buildBuilderScopedPath("/admin/system/repair-workbench", "/en/admin/system/repair-workbench", query);
}

export function buildScreenFlowManagementPath() {
  return buildLocalizedPath("/admin/system/screen-flow-management", "/en/admin/system/screen-flow-management");
}

export function buildScreenMenuAssignmentManagementPath() {
  return buildLocalizedPath("/admin/system/screen-menu-assignment-management", "/en/admin/system/screen-menu-assignment-management");
}
