import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  dispatchSecurityPolicyNotifications,
  fetchNotificationPage,
  saveSecurityPolicyNotificationConfig
} from "../../lib/api/security";
import { readBootstrappedNotificationPageData } from "../../lib/api/bootstrap";
import type { SecurityPolicyPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminInput, AdminSelect, DiagnosticCard, MemberButton, MemberButtonGroup, MemberLinkButton, MemberPagination, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type NotificationCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const NOTIFICATION_CLOSEOUT_ROWS: NotificationCloseoutRow[] = [
  {
    titleKo: "보안 알림 라우팅 저장",
    titleEn: "Security alert routing save",
    status: "Available",
    detailKo: "Slack, Mail, Webhook, severity, digest 설정은 전체 관리자 권한으로 저장할 수 있습니다.",
    detailEn: "Slack, mail, webhook, severity, and digest settings can be saved by global administrators."
  },
  {
    titleKo: "발송/운영 이력",
    titleEn: "Delivery / activity history",
    status: "Available",
    detailKo: "발송 이력과 운영자 조치 이력은 필터와 페이지네이션으로 확인할 수 있습니다.",
    detailEn: "Delivery and operator activity history are available with filters and pagination."
  },
  {
    titleKo: "알림 규칙 CRUD",
    titleEn: "Notification rule CRUD",
    status: "Blocked",
    detailKo: "현재 화면은 보안 정책 알림 라우팅 중심입니다. 범용 알림 rule 생성/수정/비활성화 모델이 필요합니다.",
    detailEn: "This page is centered on security-policy routing. Generic notification rule create/update/disable models are still required."
  },
  {
    titleKo: "수신자 Scope",
    titleEn: "Recipient scope",
    status: "Blocked",
    detailKo: "역할, 부서, 담당자, 외부 시스템별 수신자 범위와 미리보기/마스킹 계약이 필요합니다.",
    detailEn: "Recipient scope by role, department, owner, or external system needs preview and masking contracts."
  },
  {
    titleKo: "테스트 발송/재시도",
    titleEn: "Test dispatch / retry",
    status: "Blocked",
    detailKo: "운영 발송과 분리된 테스트 발송, 실패 건 재시도, 멱등키, 재시도 감사가 필요합니다.",
    detailEn: "A test dispatch path separate from production dispatch, failed-delivery retry, idempotency keys, and retry audit are required."
  }
];

const NOTIFICATION_ACTION_CONTRACT = [
  {
    labelKo: "알림 규칙 생성",
    labelEn: "Create Rule",
    noteKo: "범용 rule 저장 API와 rule-level feature code가 필요합니다.",
    noteEn: "Requires generic rule save API and rule-level feature codes."
  },
  {
    labelKo: "수신자 Scope 미리보기",
    labelEn: "Preview Recipients",
    noteKo: "역할/부서/담당자별 수신자 해석과 마스킹 응답이 필요합니다.",
    noteEn: "Requires recipient resolution by role/department/owner and masked response."
  },
  {
    labelKo: "테스트 발송",
    labelEn: "Test Dispatch",
    noteKo: "운영 발송과 분리된 테스트 전용 API와 결과 이력이 필요합니다.",
    noteEn: "Requires a test-only API and result history separated from production dispatch."
  },
  {
    labelKo: "실패 재시도",
    labelEn: "Retry Failed",
    noteKo: "실패 delivery id, 멱등키, 재시도 제한, 재시도 감사가 필요합니다.",
    noteEn: "Requires failed delivery id, idempotency key, retry limit, and retry audit."
  }
];

function normalizeFlag(value: string, fallback = "N") {
  return value === "Y" ? "Y" : fallback;
}

function countEnabledChannels(config: Record<string, string>) {
  return ["slackEnabled", "mailEnabled", "webhookEnabled"]
    .map((key) => stringOf(config, key))
    .filter((value) => value === "Y")
    .length;
}

function countDeliveryFailures(rows: Array<Record<string, string>>) {
  return rows.filter((row) => {
    const status = stringOf(row, "deliveryStatus", "status").toUpperCase();
    return status.includes("FAIL") || status.includes("ERROR") || status.includes("BLOCK");
  }).length;
}

function countRoutingIssues(config: Record<string, string>) {
  let count = 0;
  if (normalizeFlag(stringOf(config, "slackEnabled")) === "Y" && !stringOf(config, "slackChannel")) {
    count += 1;
  }
  if (normalizeFlag(stringOf(config, "mailEnabled")) === "Y" && !stringOf(config, "mailRecipients")) {
    count += 1;
  }
  if (normalizeFlag(stringOf(config, "webhookEnabled")) === "Y" && !stringOf(config, "webhookUrl")) {
    count += 1;
  }
  return count;
}

function toneClasses(tone: string) {
  if (tone === "danger") {
    return {
      accent: "text-red-700",
      surface: "bg-red-50",
      panel: "border-red-200 bg-red-50",
      title: "text-red-700",
      body: "text-red-900"
    };
  }
  if (tone === "warning") {
    return {
      accent: "text-amber-700",
      surface: "bg-amber-50",
      panel: "border-amber-200 bg-amber-50",
      title: "text-amber-700",
      body: "text-amber-900"
    };
  }
  return {
    accent: "text-[var(--kr-gov-blue)]",
    surface: "bg-[#f8fbff]",
    panel: "border-slate-200 bg-slate-50",
    title: "text-[var(--kr-gov-text-primary)]",
    body: "text-[var(--kr-gov-text-secondary)]"
  };
}

function readInitialNotificationQuery() {
  if (typeof window === "undefined") {
    return {
      historyTab: "delivery" as const,
      deliveryChannel: "ALL",
      deliveryStatus: "ALL",
      deliveryKeyword: "",
      deliveryPage: 1,
      activityAction: "ALL",
      activityKeyword: "",
      activityPage: 1
    };
  }
  const search = new URLSearchParams(window.location.search);
  const historyTab: "delivery" | "activity" = search.get("historyTab") === "activity" ? "activity" : "delivery";
  const deliveryChannel = search.get("deliveryChannel") || "ALL";
  const deliveryStatus = search.get("deliveryStatus") || "ALL";
  const deliveryKeyword = search.get("deliveryKeyword") || "";
  const deliveryPage = Math.max(1, Number(search.get("deliveryPage") || "1") || 1);
  const activityAction = search.get("activityAction") || "ALL";
  const activityKeyword = search.get("activityKeyword") || "";
  const activityPage = Math.max(1, Number(search.get("activityPage") || "1") || 1);
  return {
    historyTab,
    deliveryChannel,
    deliveryStatus,
    deliveryKeyword,
    deliveryPage,
    activityAction,
    activityKeyword,
    activityPage
  };
}

function buildDeliveryFilterLabels({
  en,
  channel,
  status,
  keyword
}: {
  en: boolean;
  channel: string;
  status: string;
  keyword: string;
}) {
  const labels: string[] = [];
  if (channel) {
    labels.push(en ? `Channel: ${channel}` : `채널: ${channel}`);
  }
  if (status) {
    labels.push(en ? `Status: ${status}` : `상태: ${status}`);
  }
  if (keyword) {
    labels.push(en ? `Keyword: ${keyword}` : `검색어: ${keyword}`);
  }
  return labels;
}

function buildActivityFilterLabels({
  en,
  action,
  keyword
}: {
  en: boolean;
  action: string;
  keyword: string;
}) {
  const labels: string[] = [];
  if (action) {
    labels.push(en ? `Action: ${action}` : `조치: ${action}`);
  }
  if (keyword) {
    labels.push(en ? `Keyword: ${keyword}` : `검색어: ${keyword}`);
  }
  return labels;
}

export function NotificationCenterMigrationPage() {
  const en = isEnglish();
  const initialQuery = useMemo(() => readInitialNotificationQuery(), []);
  const initialPayload = useMemo(() => readBootstrappedNotificationPageData(), []);
  const [bootstrapEnabled, setBootstrapEnabled] = useState(Boolean(initialPayload));
  const sessionState = useFrontendSession();
  const session = sessionState.value;
  const normalizedAuthorCode = String(session?.authorCode || "").trim().toUpperCase();
  const canManageNotification = normalizedAuthorCode === "ROLE_SYSTEM_MASTER" || normalizedAuthorCode === "ROLE_SYSTEM_ADMIN";

  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationDispatchRunning, setNotificationDispatchRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notificationSlackEnabled, setNotificationSlackEnabled] = useState("Y");
  const [notificationMailEnabled, setNotificationMailEnabled] = useState("Y");
  const [notificationWebhookEnabled, setNotificationWebhookEnabled] = useState("N");
  const [notificationCriticalEnabled, setNotificationCriticalEnabled] = useState("Y");
  const [notificationHighEnabled, setNotificationHighEnabled] = useState("Y");
  const [notificationNewOnlyMode, setNotificationNewOnlyMode] = useState("Y");
  const [notificationDigestEnabled, setNotificationDigestEnabled] = useState("Y");
  const [notificationDigestHour, setNotificationDigestHour] = useState("09");
  const [notificationDigestMinute, setNotificationDigestMinute] = useState("00");
  const [notificationSlackChannel, setNotificationSlackChannel] = useState("");
  const [notificationMailRecipients, setNotificationMailRecipients] = useState("");
  const [notificationWebhookUrl, setNotificationWebhookUrl] = useState("");
  const [historyTab, setHistoryTab] = useState<"delivery" | "activity">(initialQuery.historyTab);
  const [deliveryChannelFilter, setDeliveryChannelFilter] = useState(initialQuery.deliveryChannel);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState(initialQuery.deliveryStatus);
  const [deliveryKeyword, setDeliveryKeyword] = useState(initialQuery.deliveryKeyword);
  const [activityActionFilter, setActivityActionFilter] = useState(initialQuery.activityAction);
  const [activityKeyword, setActivityKeyword] = useState(initialQuery.activityKeyword);
  const [appliedDeliveryChannelFilter, setAppliedDeliveryChannelFilter] = useState(initialQuery.deliveryChannel === "ALL" ? "" : initialQuery.deliveryChannel);
  const [appliedDeliveryStatusFilter, setAppliedDeliveryStatusFilter] = useState(initialQuery.deliveryStatus === "ALL" ? "" : initialQuery.deliveryStatus);
  const [appliedDeliveryKeyword, setAppliedDeliveryKeyword] = useState(initialQuery.deliveryKeyword.trim());
  const [appliedDeliveryPage, setAppliedDeliveryPage] = useState(initialQuery.deliveryPage);
  const [appliedActivityActionFilter, setAppliedActivityActionFilter] = useState(initialQuery.activityAction === "ALL" ? "" : initialQuery.activityAction);
  const [appliedActivityKeyword, setAppliedActivityKeyword] = useState(initialQuery.activityKeyword.trim());
  const [appliedActivityPage, setAppliedActivityPage] = useState(initialQuery.activityPage);
  const hasAppliedServerFilters = Boolean(
    appliedDeliveryChannelFilter
    || appliedDeliveryStatusFilter
    || appliedDeliveryKeyword
    || appliedActivityActionFilter
    || appliedActivityKeyword
  );
  const pageState = useAsyncValue<SecurityPolicyPagePayload>(() => fetchNotificationPage({
    deliveryChannel: appliedDeliveryChannelFilter,
    deliveryStatus: appliedDeliveryStatusFilter,
    deliveryKeyword: appliedDeliveryKeyword,
    deliveryPage: appliedDeliveryPage,
    activityAction: appliedActivityActionFilter,
    activityKeyword: appliedActivityKeyword,
    activityPage: appliedActivityPage
  }), [
    appliedDeliveryChannelFilter,
    appliedDeliveryStatusFilter,
    appliedDeliveryKeyword,
    appliedDeliveryPage,
    appliedActivityActionFilter,
    appliedActivityKeyword,
    appliedActivityPage
  ], {
    initialValue: bootstrapEnabled ? initialPayload : null,
    skipInitialLoad: bootstrapEnabled
  });
  const page = pageState.value;
  const diagnostics = (page?.menuPermissionDiagnostics || {}) as Record<string, unknown>;
  const securityInsightNotificationConfig = (diagnostics.securityInsightNotificationConfig || {}) as Record<string, string>;
  const securityInsightActivityRows = (diagnostics.securityInsightActivityRows || []) as Array<Record<string, string>>;
  const securityInsightDeliveryRows = (diagnostics.securityInsightDeliveryRows || []) as Array<Record<string, string>>;
  const securityInsightItems = (diagnostics.securityInsightItems || []) as Array<Record<string, string>>;
  const notificationCenterSummary = ((page?.notificationCenterSummary || []) as Array<Record<string, string>>);
  const notificationCenterQuickLinks = ((page?.notificationCenterQuickLinks || []) as Array<Record<string, string>>);
  const notificationCenterGuidance = ((page?.notificationCenterGuidance || []) as Array<Record<string, string>>);
  const notificationCenterMeta = ((page?.notificationCenterMeta || {}) as Record<string, unknown>);
  const notificationCenterFilterOptions = ((page?.notificationCenterFilterOptions || {}) as Record<string, unknown>);

  useEffect(() => {
    if (bootstrapEnabled && hasAppliedServerFilters) {
      setBootstrapEnabled(false);
    }
  }, [bootstrapEnabled, hasAppliedServerFilters]);

  useEffect(() => {
    const search = new URLSearchParams();
    if (historyTab === "activity") {
      search.set("historyTab", "activity");
    }
    if (appliedDeliveryChannelFilter) {
      search.set("deliveryChannel", appliedDeliveryChannelFilter);
    }
    if (appliedDeliveryStatusFilter) {
      search.set("deliveryStatus", appliedDeliveryStatusFilter);
    }
    if (appliedDeliveryKeyword) {
      search.set("deliveryKeyword", appliedDeliveryKeyword);
    }
    if (appliedDeliveryPage > 1) {
      search.set("deliveryPage", String(appliedDeliveryPage));
    }
    if (appliedActivityActionFilter) {
      search.set("activityAction", appliedActivityActionFilter);
    }
    if (appliedActivityKeyword) {
      search.set("activityKeyword", appliedActivityKeyword);
    }
    if (appliedActivityPage > 1) {
      search.set("activityPage", String(appliedActivityPage));
    }
    const query = search.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [
    historyTab,
    appliedDeliveryChannelFilter,
    appliedDeliveryStatusFilter,
    appliedDeliveryKeyword,
    appliedDeliveryPage,
    appliedActivityActionFilter,
    appliedActivityKeyword,
    appliedActivityPage
  ]);

  useEffect(() => {
    setNotificationSlackEnabled(stringOf(securityInsightNotificationConfig, "slackEnabled") || "Y");
    setNotificationMailEnabled(stringOf(securityInsightNotificationConfig, "mailEnabled") || "Y");
    setNotificationWebhookEnabled(stringOf(securityInsightNotificationConfig, "webhookEnabled") || "N");
    setNotificationCriticalEnabled(stringOf(securityInsightNotificationConfig, "notifyCritical") || "Y");
    setNotificationHighEnabled(stringOf(securityInsightNotificationConfig, "notifyHigh") || "Y");
    setNotificationNewOnlyMode(stringOf(securityInsightNotificationConfig, "newOnlyMode") || "Y");
    setNotificationDigestEnabled(stringOf(securityInsightNotificationConfig, "digestEnabled") || "Y");
    setNotificationDigestHour(stringOf(securityInsightNotificationConfig, "digestHour") || "09");
    setNotificationDigestMinute(stringOf(securityInsightNotificationConfig, "digestMinute") || "00");
    setNotificationSlackChannel(stringOf(securityInsightNotificationConfig, "slackChannel"));
    setNotificationMailRecipients(stringOf(securityInsightNotificationConfig, "mailRecipients"));
    setNotificationWebhookUrl(stringOf(securityInsightNotificationConfig, "webhookUrl"));
  }, [securityInsightNotificationConfig]);

  const enabledChannelCount = Number(notificationCenterMeta.enabledChannelCount || countEnabledChannels(securityInsightNotificationConfig));
  const deliveryFailureCount = Number(notificationCenterMeta.deliveryFailureCount || countDeliveryFailures(securityInsightDeliveryRows));
  const routingIssueCount = Number(notificationCenterMeta.routingIssueCount || countRoutingIssues(securityInsightNotificationConfig));
  const pendingCriticalFindings = Number(notificationCenterMeta.pendingCriticalFindings || securityInsightItems.filter((row) => stringOf(row, "severity").toUpperCase() === "CRITICAL").length);
  const summaryRows = notificationCenterSummary.length > 0
    ? notificationCenterSummary
    : [
      { title: en ? "Enabled Channels" : "활성 채널", value: `${enabledChannelCount}/3`, description: en ? "Slack, mail, webhook active count" : "Slack, 메일, Webhook 활성 수", tone: "neutral" },
      { title: en ? "Delivery Failures" : "발송 실패", value: String(deliveryFailureCount), description: en ? "Recent blocked or failed deliveries" : "최근 차단 또는 실패 건수", tone: deliveryFailureCount > 0 ? "danger" : "neutral" },
      { title: en ? "Routing Issues" : "라우팅 점검", value: String(routingIssueCount), description: en ? "Missing channel destination or webhook target" : "채널 목적지 또는 Webhook 대상 누락", tone: routingIssueCount > 0 ? "warning" : "neutral" },
      { title: en ? "Critical Findings" : "Critical 탐지", value: String(pendingCriticalFindings), description: en ? "Potential urgent alerts from policy diagnostics" : "정책 진단 기준 긴급 발송 후보", tone: pendingCriticalFindings > 0 ? "danger" : "neutral" }
    ];
  const quickLinks = notificationCenterQuickLinks.length > 0
    ? notificationCenterQuickLinks
    : [
      { label: en ? "Security Policy" : "보안 정책", targetRoute: buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy") },
      { label: en ? "Security Monitoring" : "보안 모니터링", targetRoute: buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring") },
      { label: en ? "Unified Log" : "통합 로그", targetRoute: buildLocalizedPath("/admin/system/unified_log", "/en/admin/system/unified_log") }
    ];
  const guidanceRows = notificationCenterGuidance.length > 0
    ? notificationCenterGuidance
    : [
      { title: en ? "Critical" : "Critical", body: en ? "Use immediate Slack or mail delivery for urgent security and runtime failures." : "긴급 보안 이슈와 런타임 장애는 Slack 또는 메일 즉시 발송으로 운영합니다.", tone: "danger" },
      { title: en ? "High" : "High", body: en ? "Keep daily digest on and require owner acknowledgement for recurring alerts." : "반복 알림은 일일 요약을 유지하고 담당자 확인 흐름과 같이 관리합니다.", tone: "warning" },
      { title: en ? "Check Logs" : "로그 확인", body: en ? "If routing looks healthy but delivery still fails, inspect the unified log and monitoring pages." : "라우팅은 정상인데 발송이 실패하면 통합 로그와 보안 모니터링 화면에서 상세 원인을 확인합니다.", tone: "neutral" }
    ];
  const deliveryChannelOptions = useMemo(() => ["ALL", ...(((notificationCenterFilterOptions.deliveryChannels || []) as string[]))], [notificationCenterFilterOptions.deliveryChannels]);
  const deliveryStatusOptions = useMemo(() => ["ALL", ...(((notificationCenterFilterOptions.deliveryStatuses || []) as string[]))], [notificationCenterFilterOptions.deliveryStatuses]);
  const activityActionOptions = useMemo(() => ["ALL", ...(((notificationCenterFilterOptions.activityActions || []) as string[]))], [notificationCenterFilterOptions.activityActions]);
  const filteredDeliveryRows = securityInsightDeliveryRows;
  const filteredActivityRows = securityInsightActivityRows;
  const filteredDeliveryCount = Number(notificationCenterMeta.filteredDeliveryCount || filteredDeliveryRows.length);
  const filteredActivityCount = Number(notificationCenterMeta.filteredActivityCount || filteredActivityRows.length);
  const totalDeliveryCount = Number(notificationCenterMeta.totalDeliveryCount || filteredDeliveryCount);
  const totalActivityCount = Number(notificationCenterMeta.totalActivityCount || filteredActivityCount);
  const deliveryPage = Math.max(1, Number(notificationCenterMeta.deliveryPage || appliedDeliveryPage || 1));
  const activityPage = Math.max(1, Number(notificationCenterMeta.activityPage || appliedActivityPage || 1));
  const deliveryTotalPages = Math.max(1, Number(notificationCenterMeta.deliveryTotalPages || 1));
  const activityTotalPages = Math.max(1, Number(notificationCenterMeta.activityTotalPages || 1));

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "notification", {
      language: en ? "en" : "ko",
      enabledChannelCount,
      deliveryCount: filteredDeliveryRows.length,
      activityCount: filteredActivityRows.length,
      pendingCriticalFindings,
      historyTab,
      deliveryChannel: appliedDeliveryChannelFilter,
      deliveryStatus: appliedDeliveryStatusFilter,
      activityAction: appliedActivityActionFilter
    });
  }, [
    appliedActivityActionFilter,
    appliedDeliveryChannelFilter,
    appliedDeliveryStatusFilter,
    enabledChannelCount,
    en,
    filteredActivityRows.length,
    filteredDeliveryRows.length,
    historyTab,
    page,
    pendingCriticalFindings
  ]);

  const deliveryFilterLabels = useMemo(() => buildDeliveryFilterLabels({
    en,
    channel: appliedDeliveryChannelFilter,
    status: appliedDeliveryStatusFilter,
    keyword: appliedDeliveryKeyword
  }), [appliedDeliveryChannelFilter, appliedDeliveryKeyword, appliedDeliveryStatusFilter, en]);

  const activityFilterLabels = useMemo(() => buildActivityFilterLabels({
    en,
    action: appliedActivityActionFilter,
    keyword: appliedActivityKeyword
  }), [appliedActivityActionFilter, appliedActivityKeyword, en]);

  async function saveNotificationRouting() {
    if (!canManageNotification || notificationSaving) {
      return;
    }
    setNotificationSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await saveSecurityPolicyNotificationConfig({
        slackEnabled: notificationSlackEnabled,
        mailEnabled: notificationMailEnabled,
        webhookEnabled: notificationWebhookEnabled,
        notifyCritical: notificationCriticalEnabled,
        notifyHigh: notificationHighEnabled,
        newOnlyMode: notificationNewOnlyMode,
        digestEnabled: notificationDigestEnabled,
        digestHour: notificationDigestHour,
        digestMinute: notificationDigestMinute,
        slackChannel: notificationSlackChannel,
        mailRecipients: notificationMailRecipients,
        webhookUrl: notificationWebhookUrl
      });
      setMessage(String(result.message || (en ? "Notification routing saved." : "알림 라우팅을 저장했습니다.")));
      await pageState.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (en ? "Failed to save notification routing." : "알림 라우팅 저장에 실패했습니다."));
    } finally {
      setNotificationSaving(false);
    }
  }

  async function dispatchNotificationRouting(criticalOnly: boolean) {
    if (!canManageNotification || notificationDispatchRunning) {
      return;
    }
    setNotificationDispatchRunning(true);
    setError("");
    setMessage("");
    try {
      const result = await dispatchSecurityPolicyNotifications({
        criticalOnly: criticalOnly ? "Y" : "N",
        includeHigh: criticalOnly ? "N" : "Y"
      });
      setMessage(String(result.message || (en ? "Notification dispatch completed." : "알림 발송을 완료했습니다.")));
      await pageState.reload();
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : (en ? "Notification dispatch failed." : "알림 발송에 실패했습니다."));
    } finally {
      setNotificationDispatchRunning(false);
    }
  }

  function applyDeliveryFilters() {
    setBootstrapEnabled(false);
    setAppliedDeliveryChannelFilter(deliveryChannelFilter === "ALL" ? "" : deliveryChannelFilter);
    setAppliedDeliveryStatusFilter(deliveryStatusFilter === "ALL" ? "" : deliveryStatusFilter);
    setAppliedDeliveryKeyword(deliveryKeyword.trim());
    setAppliedDeliveryPage(1);
  }

  function resetDeliveryFilters() {
    setBootstrapEnabled(false);
    setDeliveryChannelFilter("ALL");
    setDeliveryStatusFilter("ALL");
    setDeliveryKeyword("");
    setAppliedDeliveryChannelFilter("");
    setAppliedDeliveryStatusFilter("");
    setAppliedDeliveryKeyword("");
    setAppliedDeliveryPage(1);
  }

  function applyActivityFilters() {
    setBootstrapEnabled(false);
    setAppliedActivityActionFilter(activityActionFilter === "ALL" ? "" : activityActionFilter);
    setAppliedActivityKeyword(activityKeyword.trim());
    setAppliedActivityPage(1);
  }

  function resetActivityFilters() {
    setBootstrapEnabled(false);
    setActivityActionFilter("ALL");
    setActivityKeyword("");
    setAppliedActivityActionFilter("");
    setAppliedActivityKeyword("");
    setAppliedActivityPage(1);
  }

  function changeDeliveryPage(nextPage: number) {
    if (nextPage === deliveryPage) {
      return;
    }
    setBootstrapEnabled(false);
    setAppliedDeliveryPage(nextPage);
  }

  function changeActivityPage(nextPage: number) {
    if (nextPage === activityPage) {
      return;
    }
    setBootstrapEnabled(false);
    setAppliedActivityPage(nextPage);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Notification Center" : "알림센터" }
      ]}
      title={en ? "Notification Center" : "알림센터"}
      subtitle={en ? "Manage shared alert routing, dispatch, and delivery visibility for system operations." : "시스템 운영 공용 알림 라우팅, 즉시 발송, 전달 상태를 한 화면에서 관리합니다."}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading notification center..." : "알림센터를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}

        <DiagnosticCard
          data-help-id="notification-snapshot"
          title={en ? "Operations Snapshot" : "운영 현황"}
          description={en ? "Check alert routing health first, then move into response screens." : "알림 경로 상태를 먼저 점검한 뒤 상세 대응 화면으로 이동합니다."}
          actions={(
            <MemberButtonGroup>
              {quickLinks.map((item, index) => (
                <MemberLinkButton href={stringOf(item, "targetRoute")} key={`${stringOf(item, "label", "targetRoute")}-${index}`} variant="secondary">
                  {stringOf(item, "label")}
                </MemberLinkButton>
              ))}
            </MemberButtonGroup>
          )}
        />

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="notification-summary">
          {summaryRows.map((item, index) => {
            const tone = toneClasses(stringOf(item, "tone"));
            return (
              <SummaryMetricCard
                key={`${stringOf(item, "title")}-${index}`}
                title={stringOf(item, "title")}
                value={stringOf(item, "value")}
                description={stringOf(item, "description")}
                accentClassName={tone.accent}
                surfaceClassName={tone.surface}
              />
            );
          })}
        </section>

        <section className="gov-card mt-6 overflow-hidden" data-help-id="notification-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for a general notification center" : "범용 알림센터 완성을 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This screen already handles security-policy notification routing, production dispatch, and history visibility. It is not yet a generic notification rule console until rule CRUD, recipient scope, test dispatch, retry, and audit contracts are generalized."
                    : "이 화면은 이미 보안 정책 알림 라우팅, 운영 발송, 이력 조회를 처리합니다. 다만 rule CRUD, 수신자 scope, 테스트 발송, 재시도, 감사 계약이 일반화되기 전까지는 범용 알림 규칙 콘솔이 아닙니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / generic actions blocked" : "PARTIAL / 범용 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {NOTIFICATION_CLOSEOUT_ROWS.map((row) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={row.titleEn}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${row.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.status}
                  </span>
                  <h3 className="mt-3 text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? row.titleEn : row.titleKo}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? row.detailEn : row.detailKo}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="notification-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Generic Notification Actions" : "차단된 범용 알림 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Security routing actions remain active below; generic notification actions stay disabled until backend contracts and audit are added." : "아래 보안 라우팅 조치는 유지하되, 범용 알림 조치는 백엔드 계약과 감사가 생기기 전까지 비활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <article className="gov-card" data-help-id="notification-routing">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Notification Routing" : "알림 라우팅"}</h2>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Configure global channels and digest rules for shared operational alerts." : "공용 운영 알림에 사용할 채널과 digest 규칙을 설정합니다."}
              </p>
            </div>
            <div className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">Slack</span>
                  <AdminSelect value={notificationSlackEnabled} onChange={(event) => setNotificationSlackEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">Mail</span>
                  <AdminSelect value={notificationMailEnabled} onChange={(event) => setNotificationMailEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">Webhook</span>
                  <AdminSelect value={notificationWebhookEnabled} onChange={(event) => setNotificationWebhookEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Daily Digest" : "일일 요약"}</span>
                  <AdminSelect value={notificationDigestEnabled} onChange={(event) => setNotificationDigestEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Digest Hour" : "Digest 시"}</span>
                  <AdminInput value={notificationDigestHour} onChange={(event) => setNotificationDigestHour(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Digest Minute" : "Digest 분"}</span>
                  <AdminInput value={notificationDigestMinute} onChange={(event) => setNotificationDigestMinute(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Notify Critical" : "Critical 알림"}</span>
                  <AdminSelect value={notificationCriticalEnabled} onChange={(event) => setNotificationCriticalEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Notify High" : "High 알림"}</span>
                  <AdminSelect value={notificationHighEnabled} onChange={(event) => setNotificationHighEnabled(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "New Only Mode" : "신규만 알림"}</span>
                  <AdminSelect value={notificationNewOnlyMode} onChange={(event) => setNotificationNewOnlyMode(event.target.value)}>
                    <option value="Y">{en ? "Enabled" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Slack Channel" : "Slack 채널"}</span>
                  <AdminInput value={notificationSlackChannel} onChange={(event) => setNotificationSlackChannel(event.target.value)} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Mail Recipients" : "메일 수신자"}</span>
                  <AdminInput value={notificationMailRecipients} onChange={(event) => setNotificationMailRecipients(event.target.value)} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">Webhook URL</span>
                  <AdminInput value={notificationWebhookUrl} onChange={(event) => setNotificationWebhookUrl(event.target.value)} />
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
                {en
                  ? `updatedAt=${stringOf(securityInsightNotificationConfig, "updatedAt") || "-"} / updatedBy=${stringOf(securityInsightNotificationConfig, "updatedBy") || "-"}`
                  : `최근 저장: ${stringOf(securityInsightNotificationConfig, "updatedAt") || "-"} / 작업자: ${stringOf(securityInsightNotificationConfig, "updatedBy") || "-"}`}
                <div className="mt-2">
                  {en
                    ? `lastDigestAt=${stringOf(securityInsightNotificationConfig, "lastDigestAt") || "-"} / status=${stringOf(securityInsightNotificationConfig, "lastDigestStatus") || "-"}`
                    : `최근 digest: ${stringOf(securityInsightNotificationConfig, "lastDigestAt") || "-"} / 상태: ${stringOf(securityInsightNotificationConfig, "lastDigestStatus") || "-"}`}
                </div>
              </div>

              <MemberButtonGroup>
                <button className="primary-button" disabled={notificationSaving || !canManageNotification} onClick={() => { void saveNotificationRouting(); }} type="button">
                  {notificationSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Routing" : "알림 라우팅 저장")}
                </button>
                <button className="secondary-button" disabled={notificationDispatchRunning || !canManageNotification} onClick={() => { void dispatchNotificationRouting(false); }} type="button">
                  {notificationDispatchRunning ? (en ? "Dispatching..." : "발송 중...") : (en ? "Dispatch Critical/High" : "Critical/High 발송")}
                </button>
                <button className="secondary-button" disabled={notificationDispatchRunning || !canManageNotification} onClick={() => { void dispatchNotificationRouting(true); }} type="button">
                  {notificationDispatchRunning ? (en ? "Dispatching..." : "발송 중...") : (en ? "Dispatch Critical Only" : "Critical만 발송")}
                </button>
              </MemberButtonGroup>
              <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                {canManageNotification
                  ? (en ? "Global administrators can save shared routing and trigger dispatch." : "전체 관리자는 공용 라우팅 저장과 즉시 발송을 수행할 수 있습니다.")
                  : (en ? "Shared routing is editable by system/global administrators only." : "공용 라우팅은 시스템/전체 관리자만 수정할 수 있습니다.")}
              </p>
            </div>
          </article>

          <div className="space-y-6">
            <article className="gov-card" data-help-id="notification-history">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Delivery Visibility" : "전달 현황"}</h2>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Track the latest delivery attempts and operator activity." : "최근 알림 전달 시도와 운영자 작업 이력을 확인합니다."}
                </p>
              </div>
              <div className="space-y-4 px-6 py-6">
                <div className="flex flex-wrap items-center gap-2">
                  <MemberButton onClick={() => setHistoryTab("delivery")} type="button" variant={historyTab === "delivery" ? "primary" : "secondary"}>
                    {en ? "Delivery History" : "발송 이력"}
                  </MemberButton>
                  <MemberButton onClick={() => setHistoryTab("activity")} type="button" variant={historyTab === "activity" ? "primary" : "secondary"}>
                    {en ? "Operator Activity" : "운영자 조치"}
                  </MemberButton>
                </div>

                {historyTab === "delivery" ? (
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black">{en ? "Recent Deliveries" : "최근 발송 이력"}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {filteredDeliveryCount}/{totalDeliveryCount}{en ? " rows" : "건"}
                    </span>
                  </div>
                  {deliveryFilterLabels.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deliveryFilterLabels.map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label>
                      <span className="mb-2 block text-[12px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Channel" : "채널"}</span>
                      <AdminSelect value={deliveryChannelFilter} onChange={(event) => setDeliveryChannelFilter(event.target.value)}>
                        {deliveryChannelOptions.map((option) => (
                          <option key={option} value={option}>{option === "ALL" ? (en ? "All" : "전체") : option}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <label>
                      <span className="mb-2 block text-[12px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</span>
                      <AdminSelect value={deliveryStatusFilter} onChange={(event) => setDeliveryStatusFilter(event.target.value)}>
                        {deliveryStatusOptions.map((option) => (
                          <option key={option} value={option}>{option === "ALL" ? (en ? "All" : "전체") : option}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <label>
                      <span className="mb-2 block text-[12px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
                      <AdminInput placeholder={en ? "subject, target, message" : "제목, 대상, 메시지"} value={deliveryKeyword} onChange={(event) => setDeliveryKeyword(event.target.value)} />
                    </label>
                  </div>
                  <MemberButtonGroup className="mt-3 justify-end">
                    <MemberButton onClick={resetDeliveryFilters} type="button" variant="secondary">
                      {en ? "Reset" : "초기화"}
                    </MemberButton>
                    <MemberButton onClick={applyDeliveryFilters} type="button" variant="primary">
                      {en ? "Apply" : "적용"}
                    </MemberButton>
                  </MemberButtonGroup>
                  <div className="mt-3 space-y-3">
                    {filteredDeliveryRows.length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No delivery history for the current filter." : "현재 필터에 해당하는 발송 이력이 없습니다."}</p>
                    ) : filteredDeliveryRows.map((item, index) => (
                      <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${stringOf(item, "deliveryId", "occurredAt", "channel")}-${index}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-black text-white">{stringOf(item, "channel", "deliveryType") || "-"}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">{stringOf(item, "deliveryStatus", "status") || "-"}</span>
                          <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(item, "occurredAt", "createdAt") || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title", "subject", "status") || (en ? "Delivery event" : "전달 이벤트")}</p>
                        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "message", "description", "target") || "-"}</p>
                      </article>
                    ))}
                  </div>
                  {filteredDeliveryCount > 0 ? (
                    <>
                      <p className="mt-3 text-xs text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? `Page ${deliveryPage} of ${deliveryTotalPages} · filtered ${filteredDeliveryCount} of ${totalDeliveryCount}`
                          : `${deliveryPage}/${deliveryTotalPages} 페이지 · 필터 ${filteredDeliveryCount}건 / 전체 ${totalDeliveryCount}건`}
                      </p>
                      <MemberPagination className="mt-3 px-0" currentPage={deliveryPage} onPageChange={changeDeliveryPage} totalPages={deliveryTotalPages} />
                    </>
                  ) : null}
                </section>
                ) : null}

                {historyTab === "activity" ? (
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black">{en ? "Operator Activity" : "운영자 조치"}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {filteredActivityCount}/{totalActivityCount}{en ? " rows" : "건"}
                    </span>
                  </div>
                  {activityFilterLabels.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activityFilterLabels.map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-[12px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action" : "조치 유형"}</span>
                      <AdminSelect value={activityActionFilter} onChange={(event) => setActivityActionFilter(event.target.value)}>
                        {activityActionOptions.map((option) => (
                          <option key={option} value={option}>{option === "ALL" ? (en ? "All" : "전체") : option}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <label>
                      <span className="mb-2 block text-[12px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
                      <AdminInput placeholder={en ? "action, actor, summary" : "조치, 작업자, 요약"} value={activityKeyword} onChange={(event) => setActivityKeyword(event.target.value)} />
                    </label>
                  </div>
                  <MemberButtonGroup className="mt-3 justify-end">
                    <MemberButton onClick={resetActivityFilters} type="button" variant="secondary">
                      {en ? "Reset" : "초기화"}
                    </MemberButton>
                    <MemberButton onClick={applyActivityFilters} type="button" variant="primary">
                      {en ? "Apply" : "적용"}
                    </MemberButton>
                  </MemberButtonGroup>
                  <div className="mt-3 space-y-3">
                    {filteredActivityRows.length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No activity for the current filter." : "현재 필터에 해당하는 조치 이력이 없습니다."}</p>
                    ) : filteredActivityRows.map((item, index) => (
                      <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(item, "recordedAt", "actionCode", "actorId")}-${index}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--kr-gov-blue)] px-2.5 py-1 text-[11px] font-black text-white">{stringOf(item, "actionCode", "action") || "-"}</span>
                          <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(item, "recordedAt", "createdAt") || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "summary", "message", "category") || "-"}</p>
                        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "actorId", "owner") || "-"}</p>
                      </article>
                    ))}
                  </div>
                  {filteredActivityCount > 0 ? (
                    <>
                      <p className="mt-3 text-xs text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? `Page ${activityPage} of ${activityTotalPages} · filtered ${filteredActivityCount} of ${totalActivityCount}`
                          : `${activityPage}/${activityTotalPages} 페이지 · 필터 ${filteredActivityCount}건 / 전체 ${totalActivityCount}건`}
                      </p>
                      <MemberPagination className="mt-3 px-0" currentPage={activityPage} onPageChange={changeActivityPage} totalPages={activityTotalPages} />
                    </>
                  ) : null}
                </section>
                ) : null}
              </div>
            </article>

            <article className="gov-card" data-help-id="notification-guidance">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Routing Guide" : "운영 가이드"}</h2>
              </div>
              <div className="space-y-3 px-6 py-6 text-sm">
                {guidanceRows.map((item, index) => {
                  const tone = toneClasses(stringOf(item, "tone"));
                  return (
                    <div className={`rounded-lg border px-4 py-3 ${tone.panel}`.trim()} key={`${stringOf(item, "title")}-${index}`}>
                      <div className={`font-bold ${tone.title}`.trim()}>{stringOf(item, "title")}</div>
                      <div className={`mt-1 ${tone.body}`.trim()}>{stringOf(item, "body")}</div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
