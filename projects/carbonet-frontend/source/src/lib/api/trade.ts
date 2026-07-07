import { buildQueryParams, fetchLocalizedPageJson } from "./core";
import type {
  CertificateStatisticsPagePayload,
  RefundListPagePayload,
  RefundProcessPagePayload,
  SettlementCalendarPagePayload,
  TradeApprovePagePayload,
  TradeDuplicatePagePayload,
  TradeListPagePayload,
  TradeRejectPagePayload,
  TradeStatisticsPagePayload
} from "./tradeTypes";

type TradeQueryParams = Record<string, string | number | undefined>;

function createTradePageErrorResolver<T extends Record<string, unknown>>(fallbackMessage: string) {
  return (body: T, status: number) => String(body.message || body.refundProcessError || `${fallbackMessage}: ${status}`);
}

async function fetchTradePage<T extends Record<string, unknown>>(
  koPath: string,
  enPath: string,
  params: TradeQueryParams | undefined,
  fallbackMessage: string
): Promise<T> {
  return fetchLocalizedPageJson<T>(koPath, enPath, {
    query: buildQueryParams(params),
    fallbackMessage,
    resolveError: createTradePageErrorResolver<T>(fallbackMessage)
  });
}

export async function fetchTradeListPage(params?: { pageIndex?: number; searchKeyword?: string; tradeStatus?: string; settlementStatus?: string; }) {
  return fetchTradePage<TradeListPagePayload>(
    "/trade/list/page-data",
    "/en/trade/list/page-data",
    params,
    "Failed to load trade list page"
  );
}

export async function fetchTradeStatisticsPage(params?: { pageIndex?: number; searchKeyword?: string; periodFilter?: string; tradeType?: string; settlementStatus?: string; }) {
  return fetchTradePage<TradeStatisticsPagePayload>(
    "/admin/trade/statistics/page-data",
    "/en/admin/trade/statistics/page-data",
    params,
    "Failed to load trade statistics page"
  );
}

export async function fetchTradeDuplicatePage(params?: { pageIndex?: number; searchKeyword?: string; detectionType?: string; reviewStatus?: string; riskLevel?: string; }) {
  return fetchTradePage<TradeDuplicatePagePayload>(
    "/admin/trade/duplicate/page-data",
    "/en/admin/trade/duplicate/page-data",
    params,
    "Failed to load abnormal trade review page"
  );
}

export async function fetchRefundListPage(params?: { pageIndex?: number; searchKeyword?: string; status?: string; riskLevel?: string; }) {
  return fetchTradePage<RefundListPagePayload>(
    "/admin/payment/refund_list/page-data",
    "/en/admin/payment/refund_list/page-data",
    params,
    "Failed to load refund list page"
  );
}

export async function fetchSettlementCalendarPage(params?: { pageIndex?: number; selectedMonth?: string; searchKeyword?: string; settlementStatus?: string; riskLevel?: string; }) {
  return fetchTradePage<SettlementCalendarPagePayload>(
    "/admin/payment/settlement/page-data",
    "/en/admin/payment/settlement/page-data",
    params,
    "Failed to load settlement calendar page"
  );
}

export async function fetchTradeApprovePage(params?: { pageIndex?: number; searchKeyword?: string; approvalStatus?: string; tradeType?: string; }) {
  return fetchTradePage<TradeApprovePagePayload>(
    "/admin/trade/approve/page-data",
    "/en/admin/trade/approve/page-data",
    params,
    "Failed to load trade approval page"
  );
}

export async function fetchRefundProcessPage(params?: { pageIndex?: number; searchKeyword?: string; refundStatus?: string; refundChannel?: string; priority?: string; }) {
  return fetchTradePage<RefundProcessPagePayload>(
    "/admin/payment/refund_process/page-data",
    "/en/admin/payment/refund_process/page-data",
    params,
    "Failed to load refund processing page"
  );
}

export async function fetchTradeRejectPage(params?: { tradeId?: string; returnUrl?: string; }) {
  return fetchTradePage<TradeRejectPagePayload>(
    "/admin/trade/reject/page-data",
    "/en/admin/trade/reject/page-data",
    params,
    "Failed to load trade reject page"
  );
}

export async function fetchCertificateStatisticsPage(params?: { pageIndex?: number; searchKeyword?: string; periodFilter?: string; certificateType?: string; issuanceStatus?: string; }) {
  return fetchTradePage<CertificateStatisticsPagePayload>(
    "/admin/certificate/statistics/page-data",
    "/en/admin/certificate/statistics/page-data",
    params,
    "Failed to load certificate statistics page"
  );
}
