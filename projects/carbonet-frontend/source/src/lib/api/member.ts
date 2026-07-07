import { buildQueryParams, buildQueryString, buildAdminApiPath, fetchLocalizedPageJson, fetchPageJson } from "./core";
import type {
  CertificateObjectionListPagePayload,
  CertificatePendingPagePayload,
  CertificateReviewPagePayload,
  MemberRegisterPagePayload,
  MemberStatsPagePayload,
  PasswordResetPagePayload,
  RefundAccountReviewPagePayload,
  SystemCodePagePayload
} from "./memberTypes";

type MemberQueryParams = Record<string, string | number | boolean | null | undefined>;

function buildMemberAdminUrl(
  path: string,
  params?: MemberQueryParams
) {
  return `${buildAdminApiPath(path)}${buildQueryString(params)}`;
}

function createMemberPageErrorResolver<T extends Record<string, unknown>>(
  fallbackMessage: string,
  errorKey: keyof T & string
) {
  return (body: T, status: number) => String(body[errorKey] || `${fallbackMessage}: ${status}`);
}

async function fetchLocalizedMemberPageJson<T>(
  koPath: string,
  enPath: string,
  params?: MemberQueryParams,
  fallbackMessage?: string,
  resolveError?: (body: T, status: number) => string
) {
  return fetchLocalizedPageJson<T>(koPath, enPath, {
    query: buildQueryParams(params),
    fallbackMessage,
    resolveError
  });
}

async function fetchAdminMemberPageJson<T>(
  path: string,
  params?: MemberQueryParams,
  fallbackMessage?: string,
  resolveError?: (body: T, status: number) => string
) {
  return fetchPageJson<T>(buildMemberAdminUrl(path, params), {
    fallbackMessage,
    resolveError
  });
}

export async function fetchPasswordResetPage(params?: { memberId?: string; pageIndex?: number; searchKeyword?: string; resetSource?: string; insttId?: string; }) {
  return fetchAdminMemberPageJson<PasswordResetPagePayload>(
    "/api/admin/member/reset-password",
    params,
    "Failed to load password reset page"
  );
}

export async function fetchCertificatePendingPage(params?: { pageIndex?: number; searchKeyword?: string; certificateType?: string; processStatus?: string; applicationId?: string; insttId?: string; }) {
  const fallbackMessage = "Failed to load certificate pending page";
  return fetchLocalizedMemberPageJson<CertificatePendingPagePayload>(
    "/admin/certificate/pending_list/page-data",
    "/en/admin/certificate/pending_list/page-data",
    params,
    fallbackMessage,
    createMemberPageErrorResolver<CertificatePendingPagePayload>(fallbackMessage, "certificatePendingError")
  );
}

export async function fetchRefundAccountReviewPage(params?: { pageIndex?: number; searchKeyword?: string; verificationStatus?: string; payoutStatus?: string; }) {
  const fallbackMessage = "Failed to load refund account review page";
  return fetchLocalizedMemberPageJson<RefundAccountReviewPagePayload>(
    "/admin/payment/virtual_issue/page-data",
    "/en/admin/payment/virtual_issue/page-data",
    params,
    fallbackMessage,
    createMemberPageErrorResolver<RefundAccountReviewPagePayload>(fallbackMessage, "refundAccountReviewError")
  );
}

export async function fetchCertificateObjectionListPage(params?: { pageIndex?: number; searchKeyword?: string; status?: string; priority?: string; }) {
  const fallbackMessage = "Failed to load certificate objection list page";
  return fetchLocalizedMemberPageJson<CertificateObjectionListPagePayload>(
    "/admin/certificate/objection_list/page-data",
    "/en/admin/certificate/objection_list/page-data",
    params,
    fallbackMessage,
    createMemberPageErrorResolver<CertificateObjectionListPagePayload>(fallbackMessage, "certificateObjectionError")
  );
}

export async function fetchCertificateReviewPage(params?: { pageIndex?: number; searchKeyword?: string; status?: string; certificateType?: string; applicationId?: string; }) {
  const fallbackMessage = "Failed to load certificate review page";
  return fetchLocalizedMemberPageJson<CertificateReviewPagePayload>(
    "/admin/certificate/review/page-data",
    "/en/admin/certificate/review/page-data",
    params,
    fallbackMessage,
    createMemberPageErrorResolver<CertificateReviewPagePayload>(fallbackMessage, "certificateReviewError")
  );
}

export async function fetchMemberStatsPage() {
  return fetchLocalizedMemberPageJson<MemberStatsPagePayload>(
    "/admin/member/stats/page-data",
    "/en/admin/member/stats/page-data",
    undefined,
    "Failed to load member stats page"
  );
}

export async function fetchMemberRegisterPage() {
  return fetchLocalizedMemberPageJson<MemberRegisterPagePayload>(
    "/admin/member/register/page-data",
    "/en/admin/member/register/page-data",
    undefined,
    "Failed to load member register page"
  );
}

export async function fetchSystemCodePage(detailCodeId?: string) {
  const fallbackMessage = "Failed to load system code page";
  return fetchLocalizedMemberPageJson<SystemCodePagePayload>(
    "/admin/system/code/page-data",
    "/en/admin/system/code/page-data",
    detailCodeId ? { detailCodeId } : undefined,
    fallbackMessage,
    createMemberPageErrorResolver<SystemCodePagePayload>(fallbackMessage, "codeMgmtError")
  );
}
