import { buildAdminApiPath, buildQueryString, fetchJson, fetchPageJson } from "./core";
import { buildPageCacheKey, fetchCachedJson, fetchJsonWithoutCache } from "./pageCache";
import type {
  AuthChangeHistoryRow,
  AuthChangePagePayload,
  AuthGroupPagePayload,
  DeptRolePagePayload
} from "./authTypes";
import type {
  AdminAccountCreatePagePayload,
  AdminListPagePayload,
  AdminPermissionPagePayload,
  CertificateApprovePagePayload,
  CompanyAccountPagePayload,
  CompanyApprovePagePayload,
  CompanyDetailPagePayload,
  CompanyListPagePayload,
  CompanySearchPayload,
  MemberApprovePagePayload,
  MemberDetailPagePayload,
  MemberEditPagePayload,
  MemberListPagePayload
} from "./memberTypes";

type DuplicateCheckResponse = {
  valid?: boolean;
  duplicated?: boolean;
  message?: string;
};

type AdminMemberQueryParams = Record<string, string | number | boolean | null | undefined>;

function createAdminMemberPageErrorResolver<T extends Record<string, unknown>>(
  fallbackMessage: string,
  errorKey?: keyof T & string
) {
  return (body: T, status: number) => {
    if (errorKey) {
      const message = body[errorKey];
      if (Array.isArray(message)) {
        return String(message[0] || `${fallbackMessage}: ${status}`);
      }
      if (message) {
        return String(message);
      }
    }
    return `${fallbackMessage}: ${status}`;
  };
}

function buildAdminMemberQuery(
  paramsOrQuery?: AdminMemberQueryParams | string
) {
  if (typeof paramsOrQuery === "string") {
    return paramsOrQuery;
  }
  return buildQueryString(paramsOrQuery);
}

function buildAdminMemberUrl(
  path: string,
  paramsOrQuery?: AdminMemberQueryParams | string
) {
  return `${buildAdminApiPath(path)}${buildAdminMemberQuery(paramsOrQuery)}`;
}

async function checkIdentifierAvailability(
  path: string,
  params: AdminMemberQueryParams,
  fallbackMessage: string
): Promise<{ valid: boolean; duplicated: boolean; message: string }> {
  const body = await fetchPageJson<DuplicateCheckResponse>(buildAdminMemberUrl(path, params), {
    fallbackMessage
  });
  return {
    valid: Boolean(body.valid),
    duplicated: Boolean(body.duplicated),
    message: String(body.message || "")
  };
}

async function searchCompanyDirectory(
  path: string,
  params: AdminMemberQueryParams,
  fallbackMessage: string
): Promise<CompanySearchPayload> {
  return fetchJson<CompanySearchPayload>(buildAdminMemberUrl(path, params)).catch((error) => {
    throw new Error(error instanceof Error ? error.message : fallbackMessage);
  });
}

async function fetchCachedAdminMemberPage<T>(
  cacheKey: string,
  path: string,
  paramsOrQuery: AdminMemberQueryParams | string | undefined,
  mapError: (body: T, status: number) => string
): Promise<T> {
  const query = buildAdminMemberQuery(paramsOrQuery);
  return fetchCachedJson<T>({
    cacheKey: buildPageCacheKey(`${cacheKey}${query}`),
    url: buildAdminMemberUrl(path, paramsOrQuery),
    mapError
  });
}

async function fetchCachedAdminMemberData<T>(
  cacheKey: string,
  path: string,
  mapError: (body: T, status: number) => string
): Promise<T> {
  return fetchCachedAdminMemberPage<T>(cacheKey, path, undefined, mapError);
}

async function fetchUncachedAdminMemberPage<T>(
  path: string,
  paramsOrQuery: AdminMemberQueryParams | string | undefined,
  mapError: (body: T, status: number) => string
): Promise<T> {
  return fetchJsonWithoutCache<T>({
    url: buildAdminMemberUrl(path, paramsOrQuery),
    mapError
  });
}

export async function fetchAuthGroupPage(params: {
  authorCode?: string;
  roleCategory?: string;
  insttId?: string;
  menuCode?: string;
  featureCode?: string;
  userSearchKeyword?: string;
}): Promise<AuthGroupPagePayload> {
  const fallbackMessage = "Failed to load auth-group page";
  return fetchCachedAdminMemberPage<AuthGroupPagePayload>(
    "auth-groups/page",
    "/api/admin/auth-groups/page",
    params,
    createAdminMemberPageErrorResolver<AuthGroupPagePayload>(fallbackMessage)
  );
}

export async function fetchAuthChangePage(params?: { searchKeyword?: string; pageIndex?: number }): Promise<AuthChangePagePayload> {
  const fallbackMessage = "Failed to load auth-change page";
  return fetchCachedAdminMemberPage<AuthChangePagePayload>(
    "auth-change/page",
    "/api/admin/auth-change/page",
    {
      searchKeyword: params?.searchKeyword,
      pageIndex: params?.pageIndex && params.pageIndex > 1 ? params.pageIndex : undefined
    },
    createAdminMemberPageErrorResolver<AuthChangePagePayload>(fallbackMessage)
  );
}

export async function fetchAuthChangeHistory(): Promise<AuthChangeHistoryRow[]> {
  const fallbackMessage = "Failed to load auth-change history";
  const response = await fetchCachedAdminMemberData<{ items?: AuthChangeHistoryRow[] }>(
    "auth-change/history",
    "/api/admin/auth-change/history",
    createAdminMemberPageErrorResolver<{ items?: AuthChangeHistoryRow[] }>(fallbackMessage)
  );
  return Array.isArray(response.items) ? response.items : [];
}

export async function fetchDeptRolePage(params?: {
  insttId?: string;
  memberSearchKeyword?: string;
  memberPageIndex?: number;
}): Promise<DeptRolePagePayload> {
  const fallbackMessage = "Failed to load dept-role page";
  return fetchCachedAdminMemberPage<DeptRolePagePayload>(
    "dept-role/page",
    "/api/admin/dept-role-mapping/page",
    {
      insttId: params?.insttId,
      memberSearchKeyword: params?.memberSearchKeyword,
      memberPageIndex: params?.memberPageIndex && params.memberPageIndex > 1 ? params.memberPageIndex : undefined
    },
    createAdminMemberPageErrorResolver<DeptRolePagePayload>(fallbackMessage)
  );
}

export async function fetchMemberEditPage(memberId: string, options?: { updated?: string }): Promise<MemberEditPagePayload> {
  const fallbackMessage = "Failed to load member edit page";
  return fetchUncachedAdminMemberPage<MemberEditPagePayload>(
    "/api/admin/member/edit",
    { memberId, updated: options?.updated },
    createAdminMemberPageErrorResolver<MemberEditPagePayload>(fallbackMessage)
  );
}

export async function checkMemberRegisterId(memberId: string) {
  return checkIdentifierAvailability(
    "/api/admin/member/register/check-id",
    { memberId },
    "Failed to check member ID"
  );
}

export async function fetchAdminPermissionPage(emplyrId: string, options?: { updated?: string; mode?: string }) {
  const fallbackMessage = "Failed to load admin permission page";
  return fetchCachedAdminMemberPage<AdminPermissionPagePayload>(
    "admin-permission/page",
    "/api/admin/member/admin-account/permissions",
    { emplyrId, updated: options?.updated, mode: options?.mode },
    createAdminMemberPageErrorResolver<AdminPermissionPagePayload>(fallbackMessage)
  );
}

export async function fetchAdminAccountCreatePage() {
  const fallbackMessage = "Failed to load admin account create page";
  return fetchCachedAdminMemberData<AdminAccountCreatePagePayload>(
    "admin-account-create/page",
    "/api/admin/member/admin-account/page",
    createAdminMemberPageErrorResolver<AdminAccountCreatePagePayload>(fallbackMessage)
  );
}

export async function fetchCompanyAccountPage(insttId?: string, options?: { saved?: string }) {
  const fallbackMessage = "Failed to load company account page";
  return fetchCachedAdminMemberPage<CompanyAccountPagePayload>(
    "company-account/page",
    "/api/admin/member/company-account/page",
    { insttId, saved: options?.saved },
    createAdminMemberPageErrorResolver<CompanyAccountPagePayload>(fallbackMessage, "companyAccountErrors")
  );
}

export async function fetchAdminListPage(params?: { pageIndex?: number; searchKeyword?: string; sbscrbSttus?: string; }) {
  const fallbackMessage = "Failed to load admin list page";
  return fetchCachedAdminMemberPage<AdminListPagePayload>(
    "admin-list/page",
    "/api/admin/member/admin-list/page",
    params,
    createAdminMemberPageErrorResolver<AdminListPagePayload>(fallbackMessage)
  );
}

export async function fetchCompanyListPage(params?: { pageIndex?: number; searchKeyword?: string; sbscrbSttus?: string; }) {
  const fallbackMessage = "Failed to load company list page";
  return fetchCachedAdminMemberPage<CompanyListPagePayload>(
    "company-list/page",
    "/api/admin/member/company-list/page",
    params,
    createAdminMemberPageErrorResolver<CompanyListPagePayload>(fallbackMessage, "company_listError")
  );
}

export async function fetchMemberApprovePage(params?: { pageIndex?: number; searchKeyword?: string; membershipType?: string; sbscrbSttus?: string; result?: string; }) {
  const fallbackMessage = "Failed to load member approval page";
  return fetchCachedAdminMemberPage<MemberApprovePagePayload>(
    "member-approve/page",
    "/api/admin/member/approve/page",
    params,
    createAdminMemberPageErrorResolver<MemberApprovePagePayload>(fallbackMessage, "memberApprovalError")
  );
}

export async function fetchCompanyApprovePage(params?: { pageIndex?: number; searchKeyword?: string; sbscrbSttus?: string; result?: string; }) {
  const fallbackMessage = "Failed to load company approval page";
  return fetchCachedAdminMemberPage<CompanyApprovePagePayload>(
    "company-approve/page",
    "/api/admin/member/company-approve/page",
    params,
    createAdminMemberPageErrorResolver<CompanyApprovePagePayload>(fallbackMessage, "memberApprovalError")
  );
}

export async function fetchCertificateApprovePage(params?: { pageIndex?: number; searchKeyword?: string; requestType?: string; status?: string; result?: string; }) {
  const fallbackMessage = "Failed to load certificate approval page";
  return fetchCachedAdminMemberPage<CertificateApprovePagePayload>(
    "certificate-approve/page",
    "/api/admin/certificate/approve/page",
    params,
    createAdminMemberPageErrorResolver<CertificateApprovePagePayload>(fallbackMessage, "certificateApprovalError")
  );
}

export async function fetchMemberListPage(params?: { pageIndex?: number; searchKeyword?: string; membershipType?: string; sbscrbSttus?: string; }) {
  const fallbackMessage = "Failed to load member list page";
  return fetchCachedAdminMemberPage<MemberListPagePayload>(
    "member-list/page",
    "/api/admin/member/list/page",
    params,
    createAdminMemberPageErrorResolver<MemberListPagePayload>(fallbackMessage)
  );
}

export async function fetchMemberDetailPage(memberId: string) {
  const fallbackMessage = "Failed to load member detail page";
  return fetchUncachedAdminMemberPage<MemberDetailPagePayload>(
    "/api/admin/member/detail/page",
    { memberId },
    createAdminMemberPageErrorResolver<MemberDetailPagePayload>(fallbackMessage, "member_detailError")
  );
}

export async function fetchCompanyDetailPage(insttId: string) {
  const fallbackMessage = "Failed to load company detail page";
  return fetchCachedAdminMemberPage<CompanyDetailPagePayload>(
    "company-detail/page",
    "/api/admin/member/company-detail/page",
    { insttId },
    createAdminMemberPageErrorResolver<CompanyDetailPagePayload>(fallbackMessage, "companyDetailError")
  );
}

export async function checkAdminAccountId(adminId: string) {
  return checkIdentifierAvailability(
    "/api/admin/member/admin-account/check-id",
    { adminId },
    "Failed to check admin ID"
  );
}

export async function searchAdminCompanies(params: {
  keyword: string;
  page?: number;
  size?: number;
  status?: string;
  membershipType?: string;
}) {
  return searchCompanyDirectory(
    "/api/admin/companies/search",
    params,
    "Failed to search companies"
  );
}
