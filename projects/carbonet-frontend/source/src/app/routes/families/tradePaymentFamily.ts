import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const TRADE_PAYMENT_ROUTE_DEFINITIONS = [
  { id: "trade-list", label: "거래 목록", group: "home", koPath: "/trade/list", enPath: "/en/trade/list" },
  { id: "trade-market", label: "거래 시장", group: "home", koPath: "/trade/market", enPath: "/en/trade/market" },
  { id: "trade-report", label: "거래 리포트", group: "home", koPath: "/trade/report", enPath: "/en/trade/report" },
  { id: "trade-statistics", label: "정산 리포트", group: "admin", koPath: "/admin/trade/statistics", enPath: "/en/admin/trade/statistics" },
  { id: "refund-list", label: "환불 요청 목록", group: "admin", koPath: "/admin/payment/refund_list", enPath: "/en/admin/payment/refund_list" },
  { id: "settlement-calendar", label: "정산 캘린더", group: "admin", koPath: "/admin/payment/settlement", enPath: "/en/admin/payment/settlement" },
  { id: "trade-duplicate", label: "이상거래 점검", group: "admin", koPath: "/admin/trade/duplicate", enPath: "/en/admin/trade/duplicate" },
  { id: "trade-approve", label: "거래 승인", group: "admin", koPath: "/admin/trade/approve", enPath: "/en/admin/trade/approve" },
  { id: "trade-reject", label: "거래 반려 검토", group: "admin", koPath: "/admin/trade/reject", enPath: "/en/admin/trade/reject" },
  { id: "refund-process", label: "환불 처리", group: "admin", koPath: "/admin/payment/refund_process", enPath: "/en/admin/payment/refund_process" },
  { id: "certificate-review", label: "발급 검토", group: "admin", koPath: "/admin/certificate/review", enPath: "/en/admin/certificate/review" },
  { id: "certificate-statistics", label: "인증서 통계", group: "admin", koPath: "/admin/certificate/statistics", enPath: "/en/admin/certificate/statistics" },
  { id: "trade-buy-request", label: "구매 요청", group: "home", koPath: "/trade/buy_request", enPath: "/en/trade/buy_request" },
  { id: "trade-complete", label: "체결 현황", group: "home", koPath: "/trade/complete", enPath: "/en/trade/complete" },
  { id: "trade-auto-order", label: "자동 매칭", group: "home", koPath: "/trade/auto_order", enPath: "/en/trade/auto_order" },
  { id: "trade-sell", label: "판매 등록", group: "home", koPath: "/trade/sell", enPath: "/en/trade/sell" },
  { id: "trade-price-alert", label: "가격 알림", group: "home", koPath: "/trade/price_alert", enPath: "/en/trade/price_alert" },
  { id: "payment-pay", label: "결제 요청", group: "home", koPath: "/payment/pay", enPath: "/en/payment/pay" },
  { id: "payment-virtual-account", label: "가상계좌", group: "home", koPath: "/payment/virtual_account", enPath: "/en/payment/virtual_account" },
  { id: "payment-refund", label: "결제 환불", group: "home", koPath: "/payment/refund", enPath: "/en/payment/refund" },
  { id: "payment-refund-account", label: "환불 계좌", group: "home", koPath: "/payment/refund_account", enPath: "/en/payment/refund_account" },
  { id: "payment-notify", label: "세금계산서", group: "home", koPath: "/payment/notify", enPath: "/en/payment/notify" },
  { id: "certificate-list", label: "인증서 목록", group: "home", koPath: "/certificate/list", enPath: "/en/certificate/list" },
  { id: "certificate-apply", label: "인증서 신청", group: "home", koPath: "/certificate/apply", enPath: "/en/certificate/apply" },
  { id: "certificate-report-list", label: "보고서 및 인증서 목록", group: "home", koPath: "/certificate/report_list", enPath: "/en/certificate/report_list" },
  { id: "certificate-report-form", label: "보고서 작성", group: "home", koPath: "/certificate/report_form", enPath: "/en/certificate/report_form" },
  { id: "certificate-report-edit", label: "보고서 수정", group: "home", koPath: "/certificate/report_edit", enPath: "/en/certificate/report_edit" },
  { id: "payment-history", label: "결제 내역", group: "home", koPath: "/payment/history", enPath: "/en/payment/history" },
  { id: "payment-receipt", label: "영수증 관리", group: "home", koPath: "/payment/receipt", enPath: "/en/payment/receipt" }
] as const satisfies RouteDefinitionsOf;

const TRADE_PAYMENT_PAGE_UNITS = [
  { id: "trade-list", exportName: "TradeListMigrationPage", loader: () => import("../../../features/trade-list/TradeListMigrationPage") },
  { id: "trade-market", exportName: "TradeMarketMigrationPage", loader: () => import("../../../features/trade-market/TradeMarketMigrationPage") },
  { id: "trade-report", exportName: "TradeReportMigrationPage", loader: () => import("../../../features/trade-report/TradeReportMigrationPage") },
  { id: "trade-statistics", exportName: "TradeStatisticsMigrationPage", loader: () => import("../../../features/trade-statistics/TradeStatisticsMigrationPage") },
  { id: "refund-list", exportName: "RefundListMigrationPage", loader: () => import("../../../features/refund-list/RefundListMigrationPage") },
  { id: "settlement-calendar", exportName: "SettlementCalendarMigrationPage", loader: () => import("../../../features/settlement-calendar/SettlementCalendarMigrationPage") },
  { id: "trade-duplicate", exportName: "TradeDuplicateMigrationPage", loader: () => import("../../../features/trade-duplicate/TradeDuplicateMigrationPage") },
  { id: "trade-approve", exportName: "TradeApproveMigrationPage", loader: () => import("../../../features/trade-approve/TradeApproveMigrationPage") },
  { id: "trade-reject", exportName: "TradeRejectMigrationPage", loader: () => import("../../../features/trade-reject/TradeRejectMigrationPage") },
  { id: "refund-process", exportName: "RefundProcessMigrationPage", loader: () => import("../../../features/refund-process/RefundProcessMigrationPage") },
  { id: "certificate-review", exportName: "CertificateReviewMigrationPage", loader: () => import("../../../features/certificate-review/CertificateReviewMigrationPage") },
  { id: "certificate-statistics", exportName: "CertificateStatisticsMigrationPage", loader: () => import("../../../features/certificate-statistics/CertificateStatisticsMigrationPage") },
  { id: "trade-buy-request", exportName: "TradeBuyRequestMigrationPage", loader: () => import("../../../features/trade-buy-request/TradeBuyRequestMigrationPage") },
  { id: "trade-complete", exportName: "TradeCompleteMigrationPage", loader: () => import("../../../features/trade-complete/TradeCompleteMigrationPage") },
  { id: "trade-auto-order", exportName: "TradeAutoOrderMigrationPage", loader: () => import("../../../features/trade-auto-order/TradeAutoOrderMigrationPage") },
  { id: "trade-sell", exportName: "TradeSellMigrationPage", loader: () => import("../../../features/trade-sell/TradeSellMigrationPage") },
  { id: "trade-price-alert", exportName: "TradePriceAlertMigrationPage", loader: () => import("../../../features/trade-price-alert/TradePriceAlertMigrationPage") },
  { id: "payment-pay", exportName: "PaymentPayMigrationPage", loader: () => import("../../../features/payment-pay/PaymentPayMigrationPage") },
  { id: "payment-virtual-account", exportName: "PaymentVirtualAccountMigrationPage", loader: () => import("../../../features/payment-virtual-account/PaymentVirtualAccountMigrationPage") },
  { id: "payment-refund", exportName: "PaymentRefundMigrationPage", loader: () => import("../../../features/payment-refund/PaymentRefundMigrationPage") },
  { id: "payment-refund-account", exportName: "PaymentRefundAccountMigrationPage", loader: () => import("../../../features/payment-refund-account/PaymentRefundAccountMigrationPage") },
  { id: "payment-notify", exportName: "PaymentNotifyMigrationPage", loader: () => import("../../../features/payment-notify/PaymentNotifyMigrationPage") },
  { id: "payment-receipt", exportName: "PaymentReceiptMigrationPage", loader: () => import("../../../features/payment-receipt/PaymentReceiptMigrationPage") },
  { id: "certificate-list", exportName: "CertificateListMigrationPage", loader: () => import("../../../features/certificate-list/CertificateListMigrationPage") },
  { id: "certificate-apply", exportName: "CertificateApplyMigrationPage", loader: () => import("../../../features/certificate-apply/CertificateApplyMigrationPage") },
  { id: "certificate-report-list", exportName: "CertificateReportListMigrationPage", loader: () => import("../../../features/certificate-report-list/CertificateReportListMigrationPage") },
  { id: "certificate-report-form", exportName: "CertificateReportFormMigrationPage", loader: () => import("../../../features/certificate-report-form/CertificateReportFormMigrationPage") },
  { id: "certificate-report-edit", exportName: "CertificateReportEditMigrationPage", loader: () => import("../../../features/certificate-report-edit/CertificateReportEditMigrationPage") },
  { id: "payment-history", exportName: "PaymentHistoryMigrationPage", loader: () => import("../../../features/payment-history/PaymentHistoryMigrationPage") }
] as const satisfies PageUnitsOf<typeof TRADE_PAYMENT_ROUTE_DEFINITIONS>;

export const TRADE_PAYMENT_FAMILY = createRouteFamily(TRADE_PAYMENT_ROUTE_DEFINITIONS, TRADE_PAYMENT_PAGE_UNITS, {
  familyId: "trade-payment",
  pageFamily: "registry",
  ownershipLane: "PROJECT",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "tradePaymentFamily",
    templateProfile: "trade-payment-and-certificate-suite",
    frameProfile: "trade-home-and-admin-layout",
    helpBinding: "trade-payment.help",
    accessibilityBinding: "trade-payment-accessibility",
    securityBinding: "trade-payment-route-guard"
  },
  authorityScope: {
    actorFamily: "MEMBER_AND_ADMIN",
    dataScope: "PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "approve", "execute", "export"],
    menuPolicy: "trade, payment, and certificate menus follow project-scoped member/admin visibility policy",
    entryPolicy: "member-or-admin-trade-route",
    queryPolicy: "trade/payment/certificate queries stay project scoped and actor gated",
    actionPolicy: "trade, settlement, payment, and certificate mutations require the same governed scope",
    approvalPolicy: "trade and certificate approvals stay inside the same authority flow",
    auditPolicy: "trade deny, execute, approve, and payment actions emit audit evidence",
    tracePolicy: "trade/payment/certificate traces stay correlated by pageId and menu binding",
    denyState: "trade-payment-denied-state"
  },
  commonDefinition: {
    owner: "app/routes/families/tradePaymentFamily",
    artifacts: ["route family definition", "trade payment page manifests", "trade payment validator", "trade trace baseline"]
  },
  projectBinding: {
    owner: "trade/certificate/payment menu and route binding",
    menuBinding: "trade and payment menu binding",
    routeBinding: "trade/payment/certificate route binding",
    authorityBinding: "trade authority narrowing and approval binding",
    themeBinding: "project trade presentation binding"
  },
  projectExecutor: {
    owner: "trade settlement and certificate project executor",
    responsibilities: ["trade settlement execution", "certificate execution", "payment project execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/trade/list",
    bindingInputs: ["project trade menu binding", "authority narrowing", "settlement/payment binding", "localized route binding"],
    validatorChecks: ["trade manifest linked", "authority scope aligned", "runtime target known", "settlement/certificate evidence linked"],
    runtimeVerificationTarget: "/trade/list",
    compareTarget: "/admin/trade/statistics",
    deploySequence: "frontend build -> package -> restart-18000 -> trade/payment route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> trade/payment route verify",
    validator: "trade-payment route family aggregate validator",
    rollbackEvidence: "trade and certificate install/deploy evidence",
    auditTrace: "trade execution and payment trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(TRADE_PAYMENT_ROUTE_DEFINITIONS, {
    familyId: "trade-payment",
    manifestRoot: "tradePaymentFamily.manifest",
    menuCodePrefix: "TRADE_PAYMENT",
    validator: "trade-payment route family aggregate validator",
    rollbackEvidence: "trade and certificate install/deploy evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for trade-payment; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for trade-payment; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for trade-payment; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for trade-payment; common definition, project binding, and project executor lines are separately traceable."
});
