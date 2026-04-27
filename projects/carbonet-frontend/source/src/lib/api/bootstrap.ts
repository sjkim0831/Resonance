import { getRuntimeLocale } from "../navigation/runtime";
import {
  readSessionStorageCache,
  SESSION_STORAGE_CACHE_PREFIX,
  writeSessionStorageCache
} from "./pageCache";
import type { BootstrappedHomePayload } from "./appBootstrapTypes";
import type {
  EmissionDataHistoryPagePayload,
  EmissionDefinitionStudioPagePayload,
  EmissionResultDetailPagePayload,
  EmissionResultListPagePayload,
  EmissionSiteManagementPagePayload,
  EmissionValidatePagePayload
} from "./emissionTypes";
import type {
  CertificateRecCheckPagePayload,
  CertificateReviewPagePayload,
  MemberEditPagePayload,
  MemberStatsPagePayload
} from "./memberTypes";
import type {
  NotificationPagePayload,
  SecurityAuditPagePayload,
  SecurityMonitoringPagePayload,
  SecurityPolicyPagePayload
} from "./securityTypes";
import type {
  CertificateStatisticsPagePayload,
  RefundListPagePayload,
  SettlementCalendarPagePayload,
  TradeApprovePagePayload,
  TradeDuplicatePagePayload,
  TradeListPagePayload,
  TradeRejectPagePayload,
  TradeStatisticsPagePayload
} from "./tradeTypes";
import type {
  AdminHomePagePayload,
  BackupConfigPagePayload,
  CertificateAuditLogPagePayload,
  ExternalMonitoringPagePayload,
  SchedulerManagementPagePayload
} from "./opsTypes";
import type {
  AuthChangePagePayload,
  AuthGroupPagePayload,
  DeptRolePagePayload
} from "./authTypes";
import type { MypagePayload } from "./portalTypes";
import type {
  NewPagePagePayload,
  ScreenBuilderPagePayload
} from "./platformTypes";

export type BootstrapPayloadKey =
  | "frontendSession"
  | "adminMenuTree"
  | "adminHomePageData"
  | "newPagePageData"
  | "authGroupPageData"
  | "authChangePageData"
  | "deptRolePageData"
  | "memberEditPageData"
  | "homePayload"
  | "mypagePayload"
  | "mypageContext"
  | "memberStatsPageData"
  | "tradeListPageData"
  | "tradeStatisticsPageData"
  | "settlementCalendarPageData"
  | "tradeDuplicatePageData"
  | "refundListPageData"
  | "tradeApprovePageData"
  | "tradeRejectPageData"
  | "certificateReviewPageData"
  | "securityPolicyPageData"
  | "notificationPageData"
  | "externalMonitoringPageData"
  | "securityMonitoringPageData"
  | "securityAuditPageData"
  | "certificateAuditLogPageData"
  | "certificateRecCheckPageData"
  | "schedulerManagementPageData"
  | "backupConfigPageData"
  | "emissionResultListPageData"
  | "emissionResultDetailPageData"
  | "certificateStatisticsPageData"
  | "emissionDataHistoryPageData"
  | "emissionDefinitionStudioPageData"
  | "emissionSiteManagementPageData"
  | "emissionValidatePageData"
  | "screenBuilderPageData";

let runtimeBootstrapCache: Partial<Record<BootstrapPayloadKey, unknown>> = {};
let runtimeBootstrapCachePath = "";

const HOME_PAYLOAD_STORAGE_KEY_KO = `${SESSION_STORAGE_CACHE_PREFIX}home-payload:ko`;
const HOME_PAYLOAD_STORAGE_KEY_EN = `${SESSION_STORAGE_CACHE_PREFIX}home-payload:en`;
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

function currentBootstrapScopePath() {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.pathname}${window.location.search}`;
}

function syncRuntimeBootstrapCacheScope() {
  const nextPath = currentBootstrapScopePath();
  if (runtimeBootstrapCachePath === nextPath) {
    return;
  }
  runtimeBootstrapCache = {};
  runtimeBootstrapCachePath = nextPath;
}

export function consumeRuntimeBootstrap<T>(key: BootstrapPayloadKey): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  syncRuntimeBootstrapCacheScope();
  const bootstrapStore = window.__CARBONET_REACT_BOOTSTRAP__ as Partial<Record<BootstrapPayloadKey, unknown>> | undefined;
  if (!bootstrapStore) {
    return (runtimeBootstrapCache[key] as T | undefined) ?? null;
  }
  const payload = bootstrapStore[key] as T | undefined;
  if (typeof payload === "undefined") {
    return (runtimeBootstrapCache[key] as T | undefined) ?? null;
  }
  runtimeBootstrapCache[key] = payload;
  delete bootstrapStore[key];
  return payload ?? null;
}

export function mergeRuntimeBootstrap(payload: Partial<Record<BootstrapPayloadKey, unknown>>) {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.__CARBONET_REACT_BOOTSTRAP__) {
    window.__CARBONET_REACT_BOOTSTRAP__ = {} as Partial<Record<BootstrapPayloadKey, unknown>>;
  }
  Object.assign(window.__CARBONET_REACT_BOOTSTRAP__ as Partial<Record<BootstrapPayloadKey, unknown>>, payload);
}

function resolveHomePayloadStorageKey(isEn: boolean) {
  return isEn ? HOME_PAYLOAD_STORAGE_KEY_EN : HOME_PAYLOAD_STORAGE_KEY_KO;
}

function writeHomePayloadCache(payload: BootstrappedHomePayload | null | undefined) {
  if (!payload) {
    return;
  }
  writeSessionStorageCache(resolveHomePayloadStorageKey(Boolean(payload.isEn)), payload, SESSION_CACHE_TTL_MS);
}

export function readBootstrappedHomePayload(): BootstrappedHomePayload | null {
  const bootstrappedPayload = consumeRuntimeBootstrap<BootstrappedHomePayload>("homePayload");
  if (bootstrappedPayload) {
    writeHomePayloadCache(bootstrappedPayload);
    return bootstrappedPayload;
  }
  return readSessionStorageCache<BootstrappedHomePayload>(
    resolveHomePayloadStorageKey(getRuntimeLocale() === "en")
  );
}

export function readBootstrappedAdminHomePageData(): AdminHomePagePayload | null {
  return consumeRuntimeBootstrap<AdminHomePagePayload>("adminHomePageData");
}

export function readBootstrappedNewPagePageData(): NewPagePagePayload | null {
  return consumeRuntimeBootstrap<NewPagePagePayload>("newPagePageData");
}

export function readBootstrappedEmissionDefinitionStudioPageData(): EmissionDefinitionStudioPagePayload | null {
  return consumeRuntimeBootstrap<EmissionDefinitionStudioPagePayload>("emissionDefinitionStudioPageData");
}

export function readBootstrappedAuthGroupPageData(): AuthGroupPagePayload | null {
  return consumeRuntimeBootstrap<AuthGroupPagePayload>("authGroupPageData");
}

export function readBootstrappedAuthChangePageData(): AuthChangePagePayload | null {
  return consumeRuntimeBootstrap<AuthChangePagePayload>("authChangePageData");
}

export function readBootstrappedDeptRolePageData(): DeptRolePagePayload | null {
  return consumeRuntimeBootstrap<DeptRolePagePayload>("deptRolePageData");
}

export function readBootstrappedMemberEditPageData(): MemberEditPagePayload | null {
  return consumeRuntimeBootstrap<MemberEditPagePayload>("memberEditPageData");
}

export function readBootstrappedMypagePayload(): MypagePayload | null {
  return consumeRuntimeBootstrap<MypagePayload>("mypagePayload");
}

export function readBootstrappedMemberStatsPageData(): MemberStatsPagePayload | null {
  return consumeRuntimeBootstrap<MemberStatsPagePayload>("memberStatsPageData");
}

export function readBootstrappedTradeDuplicatePageData(): TradeDuplicatePagePayload | null {
  return consumeRuntimeBootstrap<TradeDuplicatePagePayload>("tradeDuplicatePageData");
}

export function readBootstrappedSecurityPolicyPageData(): SecurityPolicyPagePayload | null {
  return consumeRuntimeBootstrap<SecurityPolicyPagePayload>("securityPolicyPageData");
}

export function readBootstrappedNotificationPageData(): NotificationPagePayload | null {
  return consumeRuntimeBootstrap<NotificationPagePayload>("notificationPageData")
    || consumeRuntimeBootstrap<NotificationPagePayload>("securityPolicyPageData");
}

export function readBootstrappedExternalMonitoringPageData(): ExternalMonitoringPagePayload | null {
  return consumeRuntimeBootstrap<ExternalMonitoringPagePayload>("externalMonitoringPageData");
}

export function readBootstrappedSecurityMonitoringPageData(): SecurityMonitoringPagePayload | null {
  return consumeRuntimeBootstrap<SecurityMonitoringPagePayload>("securityMonitoringPageData");
}

export function readBootstrappedSecurityAuditPageData(): SecurityAuditPagePayload | null {
  return consumeRuntimeBootstrap<SecurityAuditPagePayload>("securityAuditPageData");
}

export function readBootstrappedCertificateAuditLogPageData(): CertificateAuditLogPagePayload | null {
  return consumeRuntimeBootstrap<CertificateAuditLogPagePayload>("certificateAuditLogPageData");
}

export function readBootstrappedCertificateRecCheckPageData(): CertificateRecCheckPagePayload | null {
  return consumeRuntimeBootstrap<CertificateRecCheckPagePayload>("certificateRecCheckPageData");
}

export function readBootstrappedSchedulerManagementPageData(): SchedulerManagementPagePayload | null {
  return consumeRuntimeBootstrap<SchedulerManagementPagePayload>("schedulerManagementPageData");
}

export function readBootstrappedBackupConfigPageData(): BackupConfigPagePayload | null {
  return consumeRuntimeBootstrap<BackupConfigPagePayload>("backupConfigPageData");
}

export function readBootstrappedEmissionResultListPageData(): EmissionResultListPagePayload | null {
  return consumeRuntimeBootstrap<EmissionResultListPagePayload>("emissionResultListPageData");
}

export function readBootstrappedTradeListPageData(): TradeListPagePayload | null {
  return consumeRuntimeBootstrap<TradeListPagePayload>("tradeListPageData");
}

export function readBootstrappedTradeStatisticsPageData(): TradeStatisticsPagePayload | null {
  return consumeRuntimeBootstrap<TradeStatisticsPagePayload>("tradeStatisticsPageData");
}

export function readBootstrappedRefundListPageData(): RefundListPagePayload | null {
  return consumeRuntimeBootstrap<RefundListPagePayload>("refundListPageData");
}

export function readBootstrappedSettlementCalendarPageData(): SettlementCalendarPagePayload | null {
  return consumeRuntimeBootstrap<SettlementCalendarPagePayload>("settlementCalendarPageData");
}

export function readBootstrappedTradeApprovePageData(): TradeApprovePagePayload | null {
  return consumeRuntimeBootstrap<TradeApprovePagePayload>("tradeApprovePageData");
}

export function readBootstrappedTradeRejectPageData(): TradeRejectPagePayload | null {
  return consumeRuntimeBootstrap<TradeRejectPagePayload>("tradeRejectPageData");
}

export function readBootstrappedCertificateReviewPageData(): CertificateReviewPagePayload | null {
  return consumeRuntimeBootstrap<CertificateReviewPagePayload>("certificateReviewPageData");
}

export function readBootstrappedCertificateStatisticsPageData(): CertificateStatisticsPagePayload | null {
  return consumeRuntimeBootstrap<CertificateStatisticsPagePayload>("certificateStatisticsPageData");
}

export function readBootstrappedEmissionDataHistoryPageData(): EmissionDataHistoryPagePayload | null {
  return consumeRuntimeBootstrap<EmissionDataHistoryPagePayload>("emissionDataHistoryPageData");
}

export function readBootstrappedEmissionSiteManagementPageData(): EmissionSiteManagementPagePayload | null {
  return consumeRuntimeBootstrap<EmissionSiteManagementPagePayload>("emissionSiteManagementPageData");
}

export function readBootstrappedEmissionValidatePageData(): EmissionValidatePagePayload | null {
  return consumeRuntimeBootstrap<EmissionValidatePagePayload>("emissionValidatePageData");
}

export function readBootstrappedScreenBuilderPageData(): ScreenBuilderPagePayload | null {
  return consumeRuntimeBootstrap<ScreenBuilderPagePayload>("screenBuilderPageData");
}

export function readBootstrappedEmissionResultDetailPageData(): EmissionResultDetailPagePayload | null {
  return consumeRuntimeBootstrap<EmissionResultDetailPagePayload>("emissionResultDetailPageData");
}
