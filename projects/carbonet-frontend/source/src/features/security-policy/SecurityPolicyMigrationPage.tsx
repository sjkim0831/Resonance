import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  clearSecurityPolicySuppressions,
  dispatchSecurityPolicyNotifications,
  fetchSecurityPolicyPage,
  runMenuPermissionAutoCleanup,
  runSecurityPolicyAutoFix,
  runSecurityPolicyBulkAutoFix,
  runSecurityPolicyRollback,
  saveSecurityPolicyFindingState,
  saveSecurityPolicyNotificationConfig
} from "../../lib/api/security";
import { readBootstrappedSecurityPolicyPageData } from "../../lib/api/bootstrap";
import type { MenuPermissionAutoCleanupResponse, SecurityPolicyPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { verifyRuntimeContextKeys } from "../admin-ui/contextKeyPresets";
import { AdminInput, AdminSelect, CopyableCodeBlock, DiagnosticCard, GridToolbar, MemberButtonGroup, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminPolicyPageFrame, AdminSummaryStrip } from "../admin-ui/pageFrames";
import { useEffect, useMemo, useState } from "react";

const SECURITY_POLICY_BASELINE_STORAGE_KEY = "securityPolicyDetectionBaseline.v1";
const SECURITY_POLICY_SUPPRESSED_STORAGE_KEY = "securityPolicyDetectionSuppressed.v1";
const SECURITY_POLICY_ACTIVITY_STORAGE_KEY = "securityPolicyDetectionActivity.v1";
const FINDING_STATE_OPTIONS = ["OPEN", "ACKNOWLEDGED", "APPROVED", "EXECUTED", "VERIFIED", "RESOLVED", "FALSE_POSITIVE"];

export function SecurityPolicyMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedSecurityPolicyPageData(), []);
  const sessionState = useFrontendSession();
  const session = sessionState.value;
  const [copiedSqlKey, setCopiedSqlKey] = useState("");
  const [copiedPromptKey, setCopiedPromptKey] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<MenuPermissionAutoCleanupResponse | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [findingKeyword, setFindingKeyword] = useState("");
  const [findingSeverityFilter, setFindingSeverityFilter] = useState("ALL");
  const [findingCategoryFilter, setFindingCategoryFilter] = useState("ALL");
  const [findingActionFilter, setFindingActionFilter] = useState("ALL");
  const [findingEngineFilter, setFindingEngineFilter] = useState("ALL");
  const [findingFreshnessFilter, setFindingFreshnessFilter] = useState("ALL");
  const [findingBlockedOnly, setFindingBlockedOnly] = useState(false);
  const [findingStateFilter, setFindingStateFilter] = useState("ALL");
  const [findingFixModeFilter, setFindingFixModeFilter] = useState("ALL");
  const [findingImpactFilter, setFindingImpactFilter] = useState("ALL");
  const [findingBaselineFilter, setFindingBaselineFilter] = useState("ALL");
  const [findingEngineTab, setFindingEngineTab] = useState("ALL");
  const [baselineFingerprints, setBaselineFingerprints] = useState<string[]>([]);
  const [suppressedFingerprints, setSuppressedFingerprints] = useState<string[]>([]);
  const [activityHistory, setActivityHistory] = useState<Array<Record<string, string>>>([]);
  const [selectedFindingFingerprint, setSelectedFindingFingerprint] = useState("");
  const [findingStateStatus, setFindingStateStatus] = useState("");
  const [findingStateOwner, setFindingStateOwner] = useState("");
  const [findingStateNote, setFindingStateNote] = useState("");
  const [findingStateExpiresAt, setFindingStateExpiresAt] = useState("");
  const [findingStateSuppressed, setFindingStateSuppressed] = useState(false);
  const [findingStateSaving, setFindingStateSaving] = useState(false);
  const [findingAutoFixRunning, setFindingAutoFixRunning] = useState("");
  const [bulkAutoFixRunning, setBulkAutoFixRunning] = useState(false);
  const [findingRollbackRunning, setFindingRollbackRunning] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationDispatchRunning, setNotificationDispatchRunning] = useState(false);
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
  const pageState = useAsyncValue<SecurityPolicyPagePayload>(fetchSecurityPolicyPage, [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  const cards = (page?.securityPolicySummary || []) as Array<Record<string, string>>;
  const rows = (page?.securityPolicyRows || []) as Array<Record<string, string>>;
  const playbooks = (page?.securityPolicyPlaybooks || []) as Array<Record<string, string>>;
  const diagnostics = (page?.menuPermissionDiagnostics || {}) as Record<string, unknown>;
  const duplicatedMenuUrls = (diagnostics.duplicatedMenuUrls || []) as Array<Record<string, string>>;
  const duplicatedViewMappings = (diagnostics.duplicatedViewMappings || []) as Array<Record<string, string>>;
  const menusMissingView = (diagnostics.menusMissingView || []) as Array<Record<string, string>>;
  const inactiveAuthorFeatureRelations = (diagnostics.inactiveAuthorFeatureRelations || []) as Array<Record<string, string>>;
  const inactiveUserOverrides = (diagnostics.inactiveUserOverrides || []) as Array<Record<string, string>>;
  const sensitiveRoleExposures = (diagnostics.sensitiveRoleExposures || []) as Array<Record<string, string>>;
  const companyScopeSensitiveExposures = (diagnostics.companyScopeSensitiveExposures || []) as Array<Record<string, string>>;
  const securityInsightItems = (diagnostics.securityInsightItems || []) as Array<Record<string, string>>;
  const securityInsightGate = (diagnostics.securityInsightGate || {}) as Record<string, unknown>;
  const securityInsightConfig = (diagnostics.securityInsightConfig || {}) as Record<string, unknown>;
  const securityInsightExplorer = (diagnostics.securityInsightExplorer || {}) as Record<string, unknown>;
  const securityInsightHistoryRows = (diagnostics.securityInsightHistoryRows || []) as Array<Record<string, string>>;
  const securityInsightActivityRows = (diagnostics.securityInsightActivityRows || []) as Array<Record<string, string>>;
  const securityInsightDeliveryRows = (diagnostics.securityInsightDeliveryRows || []) as Array<Record<string, string>>;
  const securityInsightNotificationConfig = (diagnostics.securityInsightNotificationConfig || {}) as Record<string, string>;
  const securityInsightStateSummary = (diagnostics.securityInsightStateSummary || {}) as Record<string, unknown>;
  const securityInsightTotal = Number(diagnostics.securityInsightTotal || securityInsightItems.length || 0);
  const duplicatedMenuUrlCount = duplicatedMenuUrls.length;
  const duplicatedViewMappingCount = duplicatedViewMappings.length;
  const cleanupRecommendationCount = duplicatedMenuUrlCount + duplicatedViewMappingCount;
  const likelyAutoCleanupCount = duplicatedMenuUrlCount;
  const manualReviewRequiredCount = duplicatedViewMappingCount;
  const integrityIssueCount = menusMissingView.length + inactiveAuthorFeatureRelations.length + inactiveUserOverrides.length;
  const highRiskExposureCount = sensitiveRoleExposures.length;
  const scopeViolationCount = companyScopeSensitiveExposures.length;
  const extendedIssueCount = cleanupRecommendationCount + integrityIssueCount + highRiskExposureCount + scopeViolationCount;
  const gateBlocked = String(securityInsightGate.blocked || "").toLowerCase() === "true";
  const severityOptions = useMemo(() => Array.from(new Set(securityInsightItems.map((row) => stringOf(row, "severity").toUpperCase()).filter(Boolean))), [securityInsightItems]);
  const categoryOptions = useMemo(() => Array.from(new Set(securityInsightItems.map((row) => stringOf(row, "category")).filter(Boolean))).sort(), [securityInsightItems]);
  const actionOptions = useMemo(() => Array.from(new Set(securityInsightItems.map((row) => stringOf(row, "action")).filter(Boolean))).sort(), [securityInsightItems]);
  const engineOptions = useMemo(() => Array.from(new Set(securityInsightItems.map((row) => stringOf(row, "engine")).filter(Boolean))).sort(), [securityInsightItems]);
  const engineTabOptions = useMemo(() => ["ALL", ...engineOptions], [engineOptions]);
  const decorateFinding = (row: Record<string, string>) => {
    const severity = stringOf(row, "severity").toUpperCase();
    const category = stringOf(row, "category");
    const action = stringOf(row, "action");
    const confidence = Number(stringOf(row, "confidence") || "0");
    const fixMode = category === "duplicate-menu-url"
      || category === "duplicate-view-feature"
      || category === "inactive-role-grant"
      || category === "inactive-user-override"
      || category === "sensitive-feature-exposure"
      || category === "company-scope-sensitive-exposure"
      ? "auto-fixable"
      : category === "missing-view-feature" || category === "permission-drift"
        ? "review-required"
        : "manual-governance";
    const impactTier = severity === "CRITICAL" || action === "immediate" || confidence >= 95
      ? "high-impact"
      : severity === "HIGH" || action === "required" || confidence >= 88
        ? "elevated-impact"
        : "standard-impact";
    return { ...row, fixMode, impactTier };
  };
  const findingFixModeOptions = ["auto-fixable", "review-required", "manual-governance"];
  const findingImpactOptions = ["high-impact", "elevated-impact", "standard-impact"];
  const normalizedAuthorCode = String(session?.authorCode || "").trim().toUpperCase();
  const canManageDetectionState = Boolean(session?.authenticated);
  const canAutoFixFinding = normalizedAuthorCode === "ROLE_SYSTEM_MASTER" || normalizedAuthorCode === "ROLE_SYSTEM_ADMIN";
  const canSuppressFinding = canManageDetectionState;
  const buildFindingFingerprint = (row: Record<string, string>) => [
    stringOf(row, "severity"),
    stringOf(row, "category"),
    stringOf(row, "engine"),
    stringOf(row, "target"),
    stringOf(row, "subject"),
    stringOf(row, "title")
  ].join("::");
  const filteredSecurityInsightItems = useMemo(() => {
    const keyword = findingKeyword.trim().toLowerCase();
    return securityInsightItems.map(decorateFinding).filter((row) => {
      const severity = stringOf(row, "severity").toUpperCase();
      const category = stringOf(row, "category");
      const action = stringOf(row, "action");
      const engine = stringOf(row, "engine");
      const isNew = stringOf(row, "isNew") === "Y";
      const stateStatus = stringOf(row, "stateStatus").toUpperCase();
      const fixMode = stringOf(row, "fixMode");
      const impactTier = stringOf(row, "impactTier");
      const fingerprint = buildFindingFingerprint(row);
      const inBaseline = baselineFingerprints.includes(fingerprint);
      const suppressed = suppressedFingerprints.includes(fingerprint) || stringOf(row, "stateSuppressed") === "Y";
      const searchable = [
        stringOf(row, "target"),
        stringOf(row, "subject"),
        stringOf(row, "title"),
        stringOf(row, "remediation"),
        stringOf(row, "engine"),
        stringOf(row, "category"),
        fixMode,
        impactTier
      ].join(" ").toLowerCase();
      if (findingSeverityFilter !== "ALL" && severity !== findingSeverityFilter) {
        return false;
      }
      if (findingCategoryFilter !== "ALL" && category !== findingCategoryFilter) {
        return false;
      }
      if (findingActionFilter !== "ALL" && action !== findingActionFilter) {
        return false;
      }
      if (findingEngineFilter !== "ALL" && engine !== findingEngineFilter) {
        return false;
      }
      if (findingEngineTab !== "ALL" && engine !== findingEngineTab) {
        return false;
      }
      if (findingFixModeFilter !== "ALL" && fixMode !== findingFixModeFilter) {
        return false;
      }
      if (findingImpactFilter !== "ALL" && impactTier !== findingImpactFilter) {
        return false;
      }
      if (findingFreshnessFilter === "NEW_ONLY" && !isNew) {
        return false;
      }
      if (findingFreshnessFilter === "BASELINE_ONLY" && isNew) {
        return false;
      }
      if (findingBaselineFilter === "NEW_SINCE_BASELINE" && inBaseline) {
        return false;
      }
      if (findingBaselineFilter === "KNOWN_BASELINE_ONLY" && !inBaseline) {
        return false;
      }
      if (findingBlockedOnly && action !== "immediate" && action !== "required") {
        return false;
      }
      if (findingStateFilter === "FALSE_POSITIVE_ONLY" && stateStatus !== "FALSE_POSITIVE") {
        return false;
      }
      if (findingStateFilter === "ACTIVE_ONLY" && stateStatus === "FALSE_POSITIVE") {
        return false;
      }
      if (findingStateFilter !== "ALL" && findingStateFilter !== "FALSE_POSITIVE_ONLY" && findingStateFilter !== "ACTIVE_ONLY" && stateStatus !== findingStateFilter) {
        return false;
      }
      if (suppressed) {
        return false;
      }
      if (keyword && !searchable.includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [baselineFingerprints, findingActionFilter, findingBaselineFilter, findingBlockedOnly, findingCategoryFilter, findingEngineFilter, findingEngineTab, findingFixModeFilter, findingFreshnessFilter, findingImpactFilter, findingKeyword, findingSeverityFilter, findingStateFilter, securityInsightItems, suppressedFingerprints]);
  const filteredCriticalFindingCount = filteredSecurityInsightItems.filter((row) => stringOf(row, "severity").toUpperCase() === "CRITICAL").length;
  const filteredHighFindingCount = filteredSecurityInsightItems.filter((row) => stringOf(row, "severity").toUpperCase() === "HIGH").length;
  const filteredActionRequiredCount = filteredSecurityInsightItems.filter((row) => {
    const action = stringOf(row, "action");
    return action === "required" || action === "immediate";
  }).length;
  const filteredAutoFixableCount = filteredSecurityInsightItems.filter((row) => stringOf(row, "fixMode") === "auto-fixable").length;
  const filteredHighImpactCount = filteredSecurityInsightItems.filter((row) => stringOf(row, "impactTier") === "high-impact").length;
  const filteredNewSinceBaselineCount = filteredSecurityInsightItems.filter((row) => !baselineFingerprints.includes(buildFindingFingerprint(row))).length;
  const filteredFalsePositiveCount = filteredSecurityInsightItems.filter((row) => stringOf(row, "stateStatus").toUpperCase() === "FALSE_POSITIVE").length;
  const filteredApprovedCount = filteredSecurityInsightItems.filter((row) => ["APPROVED", "EXECUTED", "VERIFIED"].includes(stringOf(row, "stateStatus").toUpperCase())).length;
  const effectiveSuppressedCount = Number(securityInsightStateSummary.suppressedCount || 0);
  const previousSecurityInsightSnapshot = securityInsightHistoryRows.length > 1 ? securityInsightHistoryRows[1] : null;
  const trendDelta = previousSecurityInsightSnapshot
    ? securityInsightTotal - Number(stringOf(previousSecurityInsightSnapshot, "totalFindings") || "0")
    : 0;
  const combinedActivityHistory = useMemo(() => {
    const normalizedServerRows = securityInsightActivityRows.map((row) => ({
      ...row,
      source: stringOf(row, "source") || "server"
    }));
    const normalizedLocalRows = activityHistory.map((row) => ({
      ...row,
      source: stringOf(row, "source") || "local"
    }));
    return [...normalizedServerRows, ...normalizedLocalRows]
      .sort((left, right) => stringOf(right, "happenedAt").localeCompare(stringOf(left, "happenedAt")))
      .slice(0, 20);
  }, [activityHistory, securityInsightActivityRows]);
  const selectedFinding = filteredSecurityInsightItems.find((row) => buildFindingFingerprint(row) === selectedFindingFingerprint)
    || securityInsightItems.map(decorateFinding).find((row) => buildFindingFingerprint(row) === selectedFindingFingerprint)
    || filteredSecurityInsightItems[0]
    || null;
  const selectedFindingFingerprintValue = selectedFinding ? buildFindingFingerprint(selectedFinding) : "";
  const selectedFindingWorkflow = selectedFinding ? ["OPEN", "ACKNOWLEDGED", "APPROVED", "EXECUTED", "VERIFIED", "RESOLVED"].map((step) => ({
    step,
    active: stringOf(selectedFinding, "stateStatus").toUpperCase() === step,
    reached: ["OPEN", "ACKNOWLEDGED", "APPROVED", "EXECUTED", "VERIFIED", "RESOLVED"].indexOf(stringOf(selectedFinding, "stateStatus").toUpperCase()) >= ["OPEN", "ACKNOWLEDGED", "APPROVED", "EXECUTED", "VERIFIED", "RESOLVED"].indexOf(step)
  })) : [];
  const blockEscalationCount = rows.filter((row) => stringOf(row, "action").includes("차단") || stringOf(row, "action").toLowerCase().includes("block")).length;
  const challengeCount = rows.filter((row) => stringOf(row, "action").includes("CAPTCHA") || stringOf(row, "action").toLowerCase().includes("captcha")).length;
  const selectedPolicy = rows.find((row) => stringOf(row, "policyId") === selectedPolicyId) || rows[0] || null;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SECURITY_POLICY_BASELINE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { fingerprints?: string[] } | null;
        setBaselineFingerprints(Array.isArray(parsed?.fingerprints) ? parsed!.fingerprints!.filter(Boolean) : []);
      }
    } catch {
      setBaselineFingerprints([]);
    }
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SECURITY_POLICY_SUPPRESSED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { fingerprints?: string[] } | null;
        setSuppressedFingerprints(Array.isArray(parsed?.fingerprints) ? parsed!.fingerprints!.filter(Boolean) : []);
      }
    } catch {
      setSuppressedFingerprints([]);
    }
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SECURITY_POLICY_ACTIVITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { items?: Array<Record<string, string>> } | null;
        setActivityHistory(Array.isArray(parsed?.items) ? parsed!.items!.filter(Boolean) : []);
      }
    } catch {
      setActivityHistory([]);
    }
  }, []);
  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "security-policy", {
      route: window.location.pathname,
      summaryCardCount: cards.length,
      policyRowCount: rows.length,
      duplicatedMenuUrlCount: duplicatedMenuUrls.length,
      duplicatedViewMappingCount: duplicatedViewMappings.length,
      integrityIssueCount,
      highRiskExposureCount,
      scopeViolationCount
    });
    logGovernanceScope("COMPONENT", "security-policy-table", {
      component: "security-policy-table",
      rowCount: rows.length,
      playbookCount: playbooks.length
    });
  }, [cards.length, duplicatedMenuUrls.length, duplicatedViewMappings.length, highRiskExposureCount, integrityIssueCount, page, playbooks.length, rows.length, scopeViolationCount]);
  useEffect(() => {
    if (!rows.length) {
      setSelectedPolicyId("");
      return;
    }
    setSelectedPolicyId((current) => {
      if (current && rows.some((row) => stringOf(row, "policyId") === current)) {
        return current;
      }
      return stringOf(rows[0], "policyId");
    });
  }, [rows]);
  useEffect(() => {
    if (!selectedFinding) {
      setSelectedFindingFingerprint("");
      setFindingStateStatus("");
      setFindingStateOwner("");
      setFindingStateNote("");
      setFindingStateExpiresAt("");
      setFindingStateSuppressed(false);
      return;
    }
    setSelectedFindingFingerprint(selectedFindingFingerprintValue);
    setFindingStateStatus(stringOf(selectedFinding, "stateStatus"));
    setFindingStateOwner(stringOf(selectedFinding, "stateOwner"));
    setFindingStateNote(stringOf(selectedFinding, "stateNote"));
    setFindingStateExpiresAt(stringOf(selectedFinding, "stateExpiresAt"));
    setFindingStateSuppressed(stringOf(selectedFinding, "stateSuppressed") === "Y");
  }, [selectedFinding, selectedFindingFingerprintValue]);
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
  function buildEnvironmentUrl(menuCode: string) {
    const normalizedMenuCode = (menuCode || "").trim();
    const query = normalizedMenuCode ? `?menuCode=${encodeURIComponent(normalizedMenuCode)}` : "";
    return buildLocalizedPath(`/admin/system/environment-management${query}`, `/en/admin/system/environment-management${query}`);
  }
  function buildAuthGroupUrl(menuCode: string, featureCode?: string) {
    const search = new URLSearchParams();
    if ((menuCode || "").trim()) {
      search.set("menuCode", menuCode.trim());
    }
    if ((featureCode || "").trim()) {
      search.set("featureCode", featureCode!.trim());
    }
    const query = search.toString() ? `?${search.toString()}` : "";
    return buildLocalizedPath(`/admin/auth/group${query}`, `/en/admin/auth/group${query}`);
  }
  async function copySqlPreview(copyKey: string, sql: string) {
    if (!sql.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(sql);
      recordActivity("copy-sql", copyKey, sql.split("\n")[0] || "SQL");
      setCopiedSqlKey(copyKey);
      window.setTimeout(() => {
        setCopiedSqlKey((current) => (current === copyKey ? "" : current));
      }, 1800);
    } catch {
      setCopiedSqlKey("");
    }
  }
  async function copyCodexPrompt(copyKey: string, prompt: string) {
    if (!prompt.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      recordActivity("copy-codex", copyKey, prompt.split("\n")[0] || "Codex CLI");
      setCopiedPromptKey(copyKey);
      window.setTimeout(() => {
        setCopiedPromptKey((current) => (current === copyKey ? "" : current));
      }, 1800);
    } catch {
      setCopiedPromptKey("");
    }
  }
  async function handleAutoCleanup(targetMenuUrls?: string[]) {
    if (cleanupRunning) {
      return;
    }
    setCleanupRunning(true);
    setCleanupError("");
    try {
      const result = await runMenuPermissionAutoCleanup(targetMenuUrls || duplicatedMenuUrls.map((row) => stringOf(row, "menuUrl")).filter(Boolean));
      setCleanupResult(result);
      recordActivity("auto-cleanup", (targetMenuUrls || []).join(", ") || "all-duplicates", result.message || (en ? "Auto cleanup completed." : "자동 정리 완료"));
      await pageState.reload();
    } catch (error) {
      recordActivity("auto-cleanup-error", (targetMenuUrls || []).join(", ") || "all-duplicates", error instanceof Error ? error.message : "cleanup-failed");
      setCleanupError(error instanceof Error ? error.message : (en ? "Cleanup failed." : "자동 정리에 실패했습니다."));
    } finally {
      setCleanupRunning(false);
    }
  }
  function downloadFindingReport(format: "json" | "csv") {
    const rowsToExport = filteredSecurityInsightItems.map((row) => ({
      severity: stringOf(row, "severity"),
      category: stringOf(row, "category"),
      target: stringOf(row, "target"),
      subject: stringOf(row, "subject"),
      title: stringOf(row, "title"),
      remediation: stringOf(row, "remediation"),
      action: stringOf(row, "action"),
      engine: stringOf(row, "engine"),
      fixMode: stringOf(row, "fixMode"),
      impactTier: stringOf(row, "impactTier"),
      confidence: stringOf(row, "confidence"),
      stateStatus: stringOf(row, "stateStatus"),
      stateOwner: stringOf(row, "stateOwner"),
      stateSuppressed: stringOf(row, "stateSuppressed")
    }));
    const blob = format === "json"
      ? new Blob([JSON.stringify({
        generatedAt: new Date().toISOString(),
        total: rowsToExport.length,
        rows: rowsToExport
      }, null, 2)], { type: "application/json;charset=utf-8" })
      : new Blob([[
        ["severity", "category", "target", "subject", "title", "action", "engine", "fixMode", "impactTier", "confidence", "stateStatus", "stateOwner", "stateSuppressed"].join(","),
        ...rowsToExport.map((row) => [
          row.severity, row.category, row.target, row.subject, row.title, row.action, row.engine, row.fixMode, row.impactTier, row.confidence, row.stateStatus, row.stateOwner, row.stateSuppressed
        ].map((value) => `"${String(value || "").replace(/"/g, "\"\"")}"`).join(","))
      ].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `security-policy-findings-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    recordActivity(`download-${format}`, "security-policy", `${rowsToExport.length}`);
  }
  async function saveSelectedFindingState() {
    if (!selectedFinding || !selectedFindingFingerprintValue || findingStateSaving || !canManageDetectionState) {
      return;
    }
    setFindingStateSaving(true);
    try {
      const message = await saveSecurityPolicyFindingState({
        fingerprint: selectedFindingFingerprintValue,
        category: stringOf(selectedFinding, "category"),
        target: stringOf(selectedFinding, "target"),
        title: stringOf(selectedFinding, "title"),
        status: findingStateStatus,
        owner: findingStateOwner,
        note: findingStateNote,
        expiresAt: findingStateExpiresAt,
        suppressed: findingStateSuppressed ? "Y" : "N"
      });
      recordActivity("save-state", stringOf(selectedFinding, "category"), String(message.message || ""));
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Failed to save finding state." : "탐지 상태 저장에 실패했습니다."));
    } finally {
      setFindingStateSaving(false);
    }
  }
  async function clearAllServerSuppressions() {
    if (!canSuppressFinding) {
      return;
    }
    try {
      const result = await clearSecurityPolicySuppressions();
      recordActivity("clear-server-suppressions", "security-policy", String(result.message || ""));
      persistSuppressedFingerprints([]);
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Failed to clear suppressions." : "숨김 해제에 실패했습니다."));
    }
  }
  async function runFindingAutoFix(row: Record<string, string>) {
    const fingerprint = buildFindingFingerprint(row);
    if (!fingerprint || findingAutoFixRunning || !canAutoFixFinding) {
      return;
    }
    setFindingAutoFixRunning(fingerprint);
    setCleanupError("");
    try {
      const result = await runSecurityPolicyAutoFix({
        fingerprint,
        category: stringOf(row, "category"),
        target: stringOf(row, "target"),
        subject: stringOf(row, "subject"),
        featureCode: stringOf(row, "featureCode"),
        featureCodes: stringOf(row, "featureCodes")
      });
      recordActivity("finding-auto-fix", stringOf(row, "category"), String(result.message || ""));
      setCleanupResult(result as MenuPermissionAutoCleanupResponse);
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Auto-fix failed." : "자동 정리에 실패했습니다."));
    } finally {
      setFindingAutoFixRunning("");
    }
  }
  async function runBulkFindingAutoFix() {
    if (!canAutoFixFinding || bulkAutoFixRunning) {
      return;
    }
    const findings = filteredSecurityInsightItems
      .filter((row) => stringOf(row, "fixMode") === "auto-fixable")
      .map((row) => ({
        fingerprint: buildFindingFingerprint(row),
        category: stringOf(row, "category"),
        target: stringOf(row, "target"),
        subject: stringOf(row, "subject"),
        featureCode: stringOf(row, "featureCode"),
        featureCodes: stringOf(row, "featureCodes")
      }));
    if (findings.length === 0) {
      setCleanupError(en ? "No auto-fixable findings in the current filter." : "현재 필터에 자동 정리 가능한 항목이 없습니다.");
      return;
    }
    setBulkAutoFixRunning(true);
    setCleanupError("");
    try {
      const result = await runSecurityPolicyBulkAutoFix({ findings });
      recordActivity("bulk-auto-fix", "security-policy", String(result.message || ""));
      setCleanupResult(result as MenuPermissionAutoCleanupResponse);
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Bulk auto-fix failed." : "일괄 자동 정리에 실패했습니다."));
    } finally {
      setBulkAutoFixRunning(false);
    }
  }
  async function saveNotificationRouting() {
    if (!canAutoFixFinding || notificationSaving) {
      return;
    }
    setNotificationSaving(true);
    setCleanupError("");
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
      recordActivity("save-notification-config", "security-policy", String(result.message || ""));
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Failed to save notification routing." : "알림 라우팅 저장에 실패했습니다."));
    } finally {
      setNotificationSaving(false);
    }
  }
  async function dispatchNotificationRouting(criticalOnly: boolean) {
    if (!canAutoFixFinding || notificationDispatchRunning) {
      return;
    }
    setNotificationDispatchRunning(true);
    setCleanupError("");
    try {
      const result = await dispatchSecurityPolicyNotifications({
        criticalOnly: criticalOnly ? "Y" : "N",
        includeHigh: criticalOnly ? "N" : "Y"
      });
      recordActivity("dispatch-notification", criticalOnly ? "critical-only" : "critical-high", String(result.message || ""));
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Notification dispatch failed." : "알림 발송에 실패했습니다."));
    } finally {
      setNotificationDispatchRunning(false);
    }
  }
  async function runFindingRollback(row: Record<string, string>) {
    const fingerprint = buildFindingFingerprint(row);
    if (!fingerprint || findingRollbackRunning || !canAutoFixFinding) {
      return;
    }
    setFindingRollbackRunning(fingerprint);
    setCleanupError("");
    try {
      const result = await runSecurityPolicyRollback({
        fingerprint,
        category: stringOf(row, "category"),
        target: stringOf(row, "target"),
        subject: stringOf(row, "subject"),
        featureCode: stringOf(row, "featureCode"),
        featureCodes: stringOf(row, "featureCodes")
      });
      recordActivity("finding-rollback", stringOf(row, "category"), String(result.message || ""));
      setCleanupResult(result as MenuPermissionAutoCleanupResponse);
      await pageState.reload();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : (en ? "Rollback failed." : "원복 실행에 실패했습니다."));
    } finally {
      setFindingRollbackRunning("");
    }
  }
  function rebuildFindingBaseline() {
    const nextFingerprints = securityInsightItems.map((row) => buildFindingFingerprint(row)).filter(Boolean);
    setBaselineFingerprints(nextFingerprints);
    recordActivity("baseline-rebuild", "security-policy", `${nextFingerprints.length}`);
    try {
      window.localStorage.setItem(SECURITY_POLICY_BASELINE_STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        fingerprints: nextFingerprints
      }));
    } catch {
      // ignore storage failures and keep in-memory baseline only
    }
  }
  function persistSuppressedFingerprints(nextFingerprints: string[]) {
    setSuppressedFingerprints(nextFingerprints);
    try {
      window.localStorage.setItem(SECURITY_POLICY_SUPPRESSED_STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        fingerprints: nextFingerprints
      }));
    } catch {
      // ignore storage failures
    }
  }
  function recordActivity(action: string, target: string, detail: string) {
    setActivityHistory((current) => {
      const next = [{
        happenedAt: new Date().toISOString(),
        action,
        target,
        detail
      }, ...current].slice(0, 12);
      try {
        window.localStorage.setItem(SECURITY_POLICY_ACTIVITY_STORAGE_KEY, JSON.stringify({
          savedAt: new Date().toISOString(),
          items: next
        }));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }
  function suppressFinding(row: Record<string, string>) {
    if (!canSuppressFinding) {
      return;
    }
    const fingerprint = buildFindingFingerprint(row);
    if (!fingerprint || suppressedFingerprints.includes(fingerprint)) {
      return;
    }
    recordActivity("suppress", stringOf(row, "category") || stringOf(row, "title"), stringOf(row, "target") || stringOf(row, "subject"));
    persistSuppressedFingerprints([...suppressedFingerprints, fingerprint]);
    void saveSecurityPolicyFindingState({
      fingerprint,
      category: stringOf(row, "category"),
      target: stringOf(row, "target"),
      title: stringOf(row, "title"),
      status: stringOf(row, "stateStatus"),
      owner: stringOf(row, "stateOwner"),
      note: stringOf(row, "stateNote"),
      expiresAt: stringOf(row, "stateExpiresAt"),
      suppressed: "Y"
    }).then(() => pageState.reload()).catch(() => {
      // keep local suppression as fallback
    });
  }
  function clearSuppressedFindings() {
    if (!canSuppressFinding) {
      return;
    }
    recordActivity("clear-suppressions", "security-policy", `${suppressedFingerprints.length}`);
    persistSuppressedFingerprints([]);
    void clearAllServerSuppressions();
  }
  function buildAutoFixSql(row: Record<string, string>) {
    const directSqlPreview = stringOf(row, "sqlPreview");
    if (directSqlPreview) {
      return directSqlPreview;
    }
    const category = stringOf(row, "category");
    const target = stringOf(row, "target");
    const subject = stringOf(row, "subject");
    if (category === "inactive-role-grant") {
      return [
        "-- inactive-role-grant auto-fix preview",
        `SELECT * FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '${subject}' AND FEATURE_CODE = '${target}';`,
        `DELETE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '${subject}' AND FEATURE_CODE = '${target}';`,
        "",
        "-- rollback",
        "INSERT INTO COMTNAUTHORFUNCTIONRELATE (AUTHOR_CODE, FEATURE_CODE, REGIST_DT)",
        `SELECT '${subject}', '${target}', CURRENT_TIMESTAMP FROM db_root`,
        "WHERE NOT EXISTS (",
        `  SELECT 1 FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '${subject}' AND FEATURE_CODE = '${target}'`,
        ");"
      ].join("\n");
    }
    if (category === "inactive-user-override") {
      return [
        "-- inactive-user-override auto-fix preview",
        `SELECT * FROM COMTNUSERFEATUREOVERRIDE WHERE SCRTY_DTRMN_TRGET_ID = '${subject}' AND FEATURE_CODE = '${target}' AND COALESCE(USE_AT,'Y')='Y';`,
        `UPDATE COMTNUSERFEATUREOVERRIDE SET USE_AT = 'N' WHERE SCRTY_DTRMN_TRGET_ID = '${subject}' AND FEATURE_CODE = '${target}' AND COALESCE(USE_AT,'Y')='Y';`,
        "",
        "-- rollback",
        `UPDATE COMTNUSERFEATUREOVERRIDE SET USE_AT = 'Y' WHERE SCRTY_DTRMN_TRGET_ID = '${subject}' AND FEATURE_CODE = '${target}';`
      ].join("\n");
    }
    return "";
  }
  function buildRollbackSql(row: Record<string, string>) {
    return stringOf(row, "rollbackSql");
  }
  function buildFindingCodexPrompt(row: Record<string, string>) {
    const severity = stringOf(row, "severity").toUpperCase() || "-";
    const category = stringOf(row, "category") || "-";
    const target = stringOf(row, "target") || "-";
    const subject = stringOf(row, "subject") || "-";
    const title = stringOf(row, "title") || "-";
    const remediation = stringOf(row, "remediation") || "-";
    const action = stringOf(row, "action") || "-";
    const engine = stringOf(row, "engine") || "-";
    const fixMode = stringOf(row, "fixMode") || "-";
    const impactTier = stringOf(row, "impactTier") || "-";
    const confidence = stringOf(row, "confidence") || "-";
    const categorySpecificRequest = category === "duplicate-view-feature"
      ? [
          "  1. 대표 VIEW 1건만 유지하는 기준을 제안",
          "  2. 권한 영향 role/override 범위를 확인",
          "  3. USE_AT='N' 기준 SQL preview와 rollback SQL 제안",
          "  4. 운영 반영 순서를 제안"
        ]
      : category === "inactive-role-grant"
        ? [
            "  1. 비활성 기능을 참조하는 role-feature 관계를 확인",
            "  2. 삭제 또는 비활성화 기준 SQL preview와 rollback SQL 제안",
            "  3. 영향 역할/메뉴 범위를 요약",
            "  4. 실행 후 재진단 순서를 제안"
          ]
        : category === "inactive-user-override"
          ? [
              "  1. 비활성 기능을 참조하는 user override 범위를 확인",
              "  2. USE_AT='N' 또는 삭제 기준 SQL preview와 rollback SQL 제안",
              "  3. 영향 사용자와 기능 범위를 요약",
              "  4. 재발 방지 포인트를 제안"
            ]
          : category.includes("exposure") || category.includes("scope")
            ? [
                "  1. 이 탐지항목의 실제 영향 메뉴/기능/권한 범위를 확인",
                "  2. 자동 정리가 불가능하면 SQL preview와 rollback SQL 제안",
                "  3. 운영 반영 전 확인 포인트와 위험도 요약",
                "  4. 가능한 경우 Codex CLI 기준 실행 순서까지 제안"
              ]
            : category.startsWith("source-")
              ? [
                  "  1. 탐지 라인의 실제 코드 문맥을 확인",
                  "  2. 오탐 여부를 먼저 판별",
                  "  3. 실제 이슈면 코드 수정안과 검증 방법을 제안",
                  "  4. 필요한 경우 apply_patch 기준 수정 방향을 제안"
                ]
              : [
                  "  1. 이 탐지항목의 실제 영향 메뉴/기능/권한 범위를 확인",
                  "  2. 자동 정리가 불가능하면 SQL preview와 rollback SQL 제안",
                  "  3. 운영 반영 전 확인 포인트와 위험도 요약",
                  "  4. 가능한 경우 Codex CLI 기준 실행 순서까지 제안"
                ];
    return [
      "`/admin/system/security-policy` 탐지항목 후속 조치 요청",
      `- severity: ${severity}`,
      `- category: ${category}`,
      `- target: ${target}`,
      `- subject: ${subject}`,
      `- detection: ${title}`,
      `- remediation: ${remediation}`,
      `- action: ${action}`,
      `- engine: ${engine}`,
      `- fix mode: ${fixMode}`,
      `- impact tier: ${impactTier}`,
      `- confidence: ${confidence}`,
      "- 요청:",
      ...categorySpecificRequest
    ].join("\n");
  }
  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Security Policy" : "보안 정책 관리" }
      ]}
      title={en ? "Security Policy Management" : "보안 정책 관리"}
      subtitle={en ? "Manage thresholds and automatic response rules for login, APIs, and admin access." : "로그인, 검색 API, 관리자 접근에 대한 임계치와 자동 대응 규칙을 관리합니다."}
      contextStrip={
        <ContextKeyStrip items={verifyRuntimeContextKeys} />
      }
    >
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      {cleanupError ? <PageStatusNotice tone="error">{cleanupError}</PageStatusNotice> : null}
      {cleanupResult?.message ? <PageStatusNotice tone="success">{cleanupResult.message}</PageStatusNotice> : null}
      <AdminPolicyPageFrame>
      <section className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4" data-help-id="security-policy-ops-summary">
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Policy Rules" : "정책 룰 수"}</p>
          <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{rows.length}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Active response rules managed on this page" : "이 화면에서 관리하는 활성 대응 규칙 수"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Block Escalations" : "차단 승격"}</p>
          <p className="mt-3 text-3xl font-black text-red-600">{blockEscalationCount}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Rules escalating to temporary block" : "임시 차단까지 승격되는 정책 수"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Captcha Challenges" : "CAPTCHA 정책"}</p>
          <p className="mt-3 text-3xl font-black text-amber-600">{challengeCount}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Rules with challenge fallback" : "봇 검증 단계가 포함된 정책 수"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Detection Findings" : "탐지 항목"}</p>
          <p className="mt-3 text-3xl font-black text-emerald-600">{securityInsightTotal}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Governance findings mapped into security detections" : "보안 탐지 형태로 재구성한 거버넌스 이슈 수"}</p>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-[0.92fr_1.08fr]" data-help-id="security-policy-threat-overview">
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Security Detection Overview" : "보안 탐지 개요"}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Critical" : "Critical"} value={<span className="text-2xl font-black text-red-700">{filteredCriticalFindingCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "High" : "High"} value={<span className="text-2xl font-black text-amber-700">{filteredHighFindingCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Action Required" : "즉시 조치"} value={<span className="text-2xl font-black text-[var(--kr-gov-blue)]">{filteredActionRequiredCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Gate Status" : "게이트 상태"} value={<span className={`text-2xl font-black ${gateBlocked ? "text-red-700" : "text-emerald-700"}`}>{gateBlocked ? (en ? "Blocked" : "차단") : (en ? "Open" : "허용")}</span>} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Auto-fixable" : "자동 정리 가능"} value={<span className="text-2xl font-black text-emerald-700">{filteredAutoFixableCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "High Impact" : "고영향"} value={<span className="text-2xl font-black text-fuchsia-700">{filteredHighImpactCount}</span>} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "New Since Baseline" : "베이스라인 이후 신규"} value={<span className="text-2xl font-black text-[var(--kr-gov-blue)]">{filteredNewSinceBaselineCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Baseline Size" : "베이스라인 크기"} value={<span className="text-2xl font-black text-slate-700">{baselineFingerprints.length}</span>} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Suppressed" : "숨김"} value={<span className="text-2xl font-black text-slate-700">{effectiveSuppressedCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Trend vs Previous" : "직전 대비"} value={<span className={`text-2xl font-black ${trendDelta > 0 ? "text-red-700" : trendDelta < 0 ? "text-emerald-700" : "text-slate-700"}`}>{trendDelta > 0 ? `+${trendDelta}` : trendDelta}</span>} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title="FALSE_POSITIVE" value={<span className="text-2xl font-black text-amber-700">{filteredFalsePositiveCount}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Approved Flow" : "승인 흐름"} value={<span className="text-2xl font-black text-blue-700">{filteredApprovedCount}</span>} />
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
            {stringOf(diagnostics, "securityInsightMessage") || (en ? "No detection message." : "탐지 메시지가 없습니다.")}
            <br />
            engine: <span className="font-mono">{String(securityInsightConfig.profile || "governed-admin")}</span>
            <br />
            baseline: <span className="font-mono">{String(securityInsightConfig.baselineCount || "0")}</span>
            <br />
            event-engine: <span className="font-mono">{String(securityInsightConfig.includeEventEngine || false)}</span>
          </div>
        </article>
        <article className="gov-card p-0 overflow-hidden">
          <GridToolbar
            actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Filtered" : "필터 결과"} <strong>{filteredSecurityInsightItems.length}</strong>{en ? ` / ${securityInsightTotal}` : ` / 총 ${securityInsightTotal}건`}</span>}
            title={en ? "Security Detection Findings" : "보안 탐지 목록"}
          />
          <div className="border-b border-[var(--kr-gov-border-light)] bg-white px-6 py-3">
            <div className="flex flex-wrap gap-2">
              {engineTabOptions.map((option) => (
                <button
                  key={option}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${findingEngineTab === option ? "border-[var(--kr-gov-blue)] bg-blue-50 text-[var(--kr-gov-blue)]" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)]"}`}
                  onClick={() => setFindingEngineTab(option)}
                  type="button"
                >
                  {option === "ALL" ? (en ? "All Engines" : "전체 엔진") : option}
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-6 py-5">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_repeat(8,minmax(0,1fr))]">
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "키워드"}</span>
                <AdminInput
                  placeholder={en ? "Target, detection, remediation" : "대상, 탐지 내용, 조치 문구 검색"}
                  value={findingKeyword}
                  onChange={(event) => setFindingKeyword(event.target.value)}
                />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">Severity</span>
                <AdminSelect value={findingSeverityFilter} onChange={(event) => setFindingSeverityFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Category" : "분류"}</span>
                <AdminSelect value={findingCategoryFilter} onChange={(event) => setFindingCategoryFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action" : "조치"}</span>
                <AdminSelect value={findingActionFilter} onChange={(event) => setFindingActionFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {actionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Engine" : "엔진"}</span>
                <AdminSelect value={findingEngineFilter} onChange={(event) => setFindingEngineFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {engineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Freshness" : "신규 여부"}</span>
                <AdminSelect value={findingFreshnessFilter} onChange={(event) => setFindingFreshnessFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  <option value="NEW_ONLY">{en ? "New only" : "신규만"}</option>
                  <option value="BASELINE_ONLY">{en ? "Baseline only" : "기존만"}</option>
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Fix Mode" : "정리 방식"}</span>
                <AdminSelect value={findingFixModeFilter} onChange={(event) => setFindingFixModeFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {findingFixModeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Impact Tier" : "영향도"}</span>
                <AdminSelect value={findingImpactFilter} onChange={(event) => setFindingImpactFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {findingImpactOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Baseline Compare" : "베이스라인 비교"}</span>
                <AdminSelect value={findingBaselineFilter} onChange={(event) => setFindingBaselineFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  <option value="NEW_SINCE_BASELINE">{en ? "New since baseline" : "베이스라인 이후 신규"}</option>
                  <option value="KNOWN_BASELINE_ONLY">{en ? "Known baseline only" : "기준선에 있던 항목만"}</option>
                </AdminSelect>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "State" : "상태"}</span>
                <AdminSelect value={findingStateFilter} onChange={(event) => setFindingStateFilter(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  <option value="ACTIVE_ONLY">{en ? "Active only" : "활성만"}</option>
                  <option value="FALSE_POSITIVE_ONLY">{en ? "False positive only" : "오탐만"}</option>
                  {FINDING_STATE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </label>
            </div>
            <MemberButtonGroup className="mt-3">
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${findingBlockedOnly ? "border-red-300 bg-red-50 text-red-700" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)]"}`}
                onClick={() => setFindingBlockedOnly((current) => !current)}
                type="button"
              >
                {en ? "Blocked / Action-required only" : "차단/즉시조치만"}
              </button>
              <button
                className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={() => {
                  setFindingKeyword("");
                  setFindingSeverityFilter("ALL");
                  setFindingCategoryFilter("ALL");
                  setFindingActionFilter("ALL");
                  setFindingEngineFilter("ALL");
                  setFindingFreshnessFilter("ALL");
                  setFindingFixModeFilter("ALL");
                  setFindingImpactFilter("ALL");
                  setFindingBaselineFilter("ALL");
                  setFindingStateFilter("ALL");
                  setFindingEngineTab("ALL");
                  setFindingBlockedOnly(false);
                }}
                type="button"
              >
                {en ? "Reset Filters" : "필터 초기화"}
              </button>
              <button
                className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={rebuildFindingBaseline}
                type="button"
              >
                {en ? "Rebuild Baseline" : "베이스라인 재구축"}
              </button>
              <button
                className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
                disabled={!canSuppressFinding}
                onClick={clearSuppressedFindings}
                type="button"
              >
                {en ? "Clear Suppressions" : "숨김 해제"}
              </button>
              <button
                className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={() => downloadFindingReport("csv")}
                type="button"
              >
                {en ? "Download CSV" : "CSV 다운로드"}
              </button>
              <button
                className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={() => downloadFindingReport("json")}
                type="button"
              >
                {en ? "Download JSON" : "JSON 다운로드"}
              </button>
              <button
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-60"
                disabled={!canAutoFixFinding || bulkAutoFixRunning || filteredAutoFixableCount === 0}
                onClick={() => { void runBulkFindingAutoFix(); }}
                type="button"
              >
                {bulkAutoFixRunning
                  ? (en ? "Bulk Auto-fixing..." : "일괄 자동 정리 중...")
                  : (en ? `Bulk Auto-fix ${filteredAutoFixableCount}` : `자동 정리 가능 ${filteredAutoFixableCount}건 일괄 실행`)}
              </button>
              <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? `Critical/High findings can be narrowed with combined filters. Suppressed: ${effectiveSuppressedCount}` : `Severity, 분류, 조치, 엔진, 신규 여부를 조합해서 실제 조치 대상만 빠르게 좁힐 수 있습니다. 숨김 ${effectiveSuppressedCount}건`}
              </span>
            </MemberButtonGroup>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {filteredSecurityInsightItems.length === 0 ? (
              <div className="px-6 py-10 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No security finding detected." : "탐지된 보안 항목이 없습니다."}</div>
            ) : (
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">{en ? "Category" : "분류"}</th>
                    <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                    <th className="px-4 py-3">{en ? "Detection" : "탐지 내용"}</th>
                    <th className="px-4 py-3">{en ? "Action" : "조치"}</th>
                    <th className="px-4 py-3">{en ? "Engine" : "엔진"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSecurityInsightItems.map((row, idx) => {
                    const severity = stringOf(row, "severity").toUpperCase();
                    const severityTone = severity === "CRITICAL"
                      ? "bg-red-100 text-red-700"
                      : severity === "HIGH"
                        ? "bg-amber-100 text-amber-700"
                        : severity === "MEDIUM"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-700";
                    const action = stringOf(row, "action");
                    const actionTone = action === "immediate"
                      ? "bg-red-100 text-red-700"
                      : action === "required"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700";
                    const fixMode = stringOf(row, "fixMode");
                    const impactTier = stringOf(row, "impactTier");
                    const targetUrl = stringOf(row, "target");
                    const autoFixSql = buildAutoFixSql(row);
                    const rollbackSql = buildRollbackSql(row);
                    const canAutoFix = fixMode === "auto-fixable" && stringOf(row, "category") === "duplicate-menu-url" && Boolean(targetUrl);
                    const canCopyAutoFixSql = fixMode === "auto-fixable" && !canAutoFix && Boolean(autoFixSql);
                    const canCopySqlPreview = !canAutoFix && Boolean(autoFixSql);
                    const canCopyRollbackSql = Boolean(rollbackSql);
                    const canCopyPrompt = fixMode !== "auto-fixable";
                    const canRunRollback = fixMode === "auto-fixable" && ["duplicate-view-feature", "inactive-role-grant", "inactive-user-override", "sensitive-feature-exposure", "company-scope-sensitive-exposure"].includes(stringOf(row, "category"));
                    const isNewSinceBaseline = !baselineFingerprints.includes(buildFindingFingerprint(row));
                    return (
                      <tr className={`hover:bg-gray-50/50 ${selectedFindingFingerprintValue === buildFindingFingerprint(row) ? "bg-blue-50" : ""}`} key={`security-finding-${idx}`} onClick={() => setSelectedFindingFingerprint(buildFindingFingerprint(row))}>
                        <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${severityTone}`}>{severity || "-"}</span></td>
                        <td className="px-4 py-3 font-mono text-[12px]">{stringOf(row, "category")}</td>
                        <td className="px-4 py-3 font-mono text-[12px]">{stringOf(row, "target") || stringOf(row, "subject")}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "title")}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "remediation")}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${actionTone}`}>{action || "-"}</span>
                          <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">confidence {stringOf(row, "confidence") || "-"}</p>
                          <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{fixMode} / {impactTier}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {isNewSinceBaseline ? <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">{en ? "NEW VS BASELINE" : "베이스라인 이후 신규"}</span> : null}
                            {canAutoFix ? (
                              <button
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                disabled={cleanupRunning || !canAutoFixFinding}
                                onClick={() => { void handleAutoCleanup([targetUrl]); }}
                                type="button"
                              >
                                {en ? "Run Auto-fix" : "즉시 자동 정리"}
                              </button>
                            ) : null}
                            {!canAutoFix && fixMode === "auto-fixable" ? (
                              <button
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                disabled={findingAutoFixRunning === buildFindingFingerprint(row) || !canAutoFixFinding}
                                onClick={() => { void runFindingAutoFix(row); }}
                                type="button"
                              >
                                {findingAutoFixRunning === buildFindingFingerprint(row) ? (en ? "Running..." : "실행 중...") : (en ? "Run Finding Auto-fix" : "탐지 자동 정리")}
                              </button>
                            ) : null}
                            {canRunRollback ? (
                              <button
                                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700"
                                disabled={findingRollbackRunning === buildFindingFingerprint(row) || !canAutoFixFinding}
                                onClick={() => { void runFindingRollback(row); }}
                                type="button"
                              >
                                {findingRollbackRunning === buildFindingFingerprint(row) ? (en ? "Rolling back..." : "원복 중...") : (en ? "Run Rollback" : "원복 실행")}
                              </button>
                            ) : null}
                            {canCopyAutoFixSql ? (
                              <button
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                onClick={() => { void copySqlPreview(`autofix-${idx}`, autoFixSql); }}
                                type="button"
                              >
                                {copiedSqlKey === `autofix-${idx}` ? (en ? "Copied" : "복사됨") : (en ? "Copy Auto-fix SQL" : "자동 정리 SQL 복사")}
                              </button>
                            ) : null}
                            {!canCopyAutoFixSql && canCopySqlPreview ? (
                              <button
                                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700"
                                onClick={() => { void copySqlPreview(`sqlpreview-${idx}`, autoFixSql); }}
                                type="button"
                              >
                                {copiedSqlKey === `sqlpreview-${idx}` ? (en ? "Copied" : "복사됨") : (en ? "Copy SQL Preview" : "SQL Preview 복사")}
                              </button>
                            ) : null}
                            {canCopyRollbackSql ? (
                              <button
                                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                                onClick={() => { void copySqlPreview(`rollback-${idx}`, rollbackSql); }}
                                type="button"
                              >
                                {copiedSqlKey === `rollback-${idx}` ? (en ? "Copied" : "복사됨") : (en ? "Copy Rollback SQL" : "Rollback SQL 복사")}
                              </button>
                            ) : null}
                            {canCopyPrompt ? (
                              <button
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700"
                                onClick={() => { void copyCodexPrompt(`finding-${idx}`, buildFindingCodexPrompt(row)); }}
                                type="button"
                              >
                                {copiedPromptKey === `finding-${idx}` ? (en ? "Copied" : "복사됨") : (en ? "Copy Codex CLI Prompt" : "Codex CLI 요청문 복사")}
                              </button>
                            ) : null}
                            <button
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                              disabled={!canSuppressFinding}
                              onClick={() => suppressFinding(row)}
                              type="button"
                            >
                              {en ? "Suppress" : "숨김"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-[12px]">{stringOf(row, "engine")}</p>
                          {stringOf(row, "isNew") === "Y" ? <p className="mt-1 text-[11px] font-bold text-emerald-700">NEW</p> : null}
                          {stringOf(row, "stateStatus") ? <p className="mt-1 text-[11px] font-bold text-blue-700">{stringOf(row, "stateStatus")}</p> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-[0.98fr_1.02fr]" data-help-id="security-policy-finding-state">
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Selected Finding State" : "선택 탐지 운영 상태"}</h3>
          {!selectedFinding ? (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a finding to manage state." : "상태를 관리할 탐지를 선택하세요."}</div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(selectedFinding, "category")}</div>
                <div className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedFinding, "title")}</div>
                <div className="mt-2 font-mono text-[12px] text-[var(--kr-gov-text-secondary)]">{stringOf(selectedFinding, "target") || stringOf(selectedFinding, "subject")}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-white px-2.5 py-1 font-bold text-slate-700">
                    {en ? "Actor" : "작업자"}: <span className="font-mono">{String(session?.userId || "-")}</span>
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-bold text-slate-700">
                    {en ? "Role" : "권한"}: <span className="font-mono">{normalizedAuthorCode || "-"}</span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "State" : "상태"}</span>
                  <AdminSelect value={findingStateStatus} onChange={(event) => setFindingStateStatus(event.target.value)}>
                    <option value="">{en ? "Unassigned" : "미지정"}</option>
                    {FINDING_STATE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "담당자"}</span>
                  <AdminInput value={findingStateOwner} onChange={(event) => setFindingStateOwner(event.target.value)} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Suppress" : "숨김"}</span>
                  <AdminSelect value={findingStateSuppressed ? "Y" : "N"} onChange={(event) => setFindingStateSuppressed(event.target.value === "Y")}>
                    <option value="N">{en ? "Visible" : "표시"}</option>
                    <option value="Y">{en ? "Suppressed" : "숨김"}</option>
                  </AdminSelect>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Expire At" : "만료일시"}</span>
                  <AdminInput type="datetime-local" value={findingStateExpiresAt} onChange={(event) => setFindingStateExpiresAt(event.target.value)} />
                </label>
              </div>
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Operator Note" : "운영 메모"}</span>
                <textarea className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm" rows={4} value={findingStateNote} onChange={(event) => setFindingStateNote(event.target.value)} />
              </label>
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
                {canAutoFixFinding
                  ? (en ? "State save, suppress, and auto-fix are all available in this session." : "현재 세션은 상태 저장, 숨김, 자동 정리를 모두 실행할 수 있습니다.")
                  : canManageDetectionState
                    ? (en ? "State save and suppress are available. Auto-fix is restricted to system administrators." : "상태 저장과 숨김은 가능하지만 자동 정리는 시스템 관리자 이상만 실행할 수 있습니다.")
                    : (en ? "Login is required to manage detection workflow." : "탐지 워크플로우를 관리하려면 로그인 세션이 필요합니다.")}
              </div>
              <MemberButtonGroup>
                <button className="primary-button" disabled={findingStateSaving || !canManageDetectionState} onClick={() => { void saveSelectedFindingState(); }} type="button">
                  {findingStateSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Detection State" : "탐지 상태 저장")}
                </button>
                <button className="secondary-button" onClick={() => {
                  setFindingStateStatus("");
                  setFindingStateOwner("");
                  setFindingStateNote("");
                  setFindingStateExpiresAt("");
                  setFindingStateSuppressed(false);
                }} type="button">
                  {en ? "Reset Form" : "입력 초기화"}
                </button>
              </MemberButtonGroup>
            </div>
          )}
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Detection State Summary" : "탐지 상태 요약"}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title="ACKNOWLEDGED" value={<span className="text-2xl font-black text-blue-700">{String(securityInsightStateSummary.acknowledgedCount || 0)}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title="RESOLVED" value={<span className="text-2xl font-black text-emerald-700">{String(securityInsightStateSummary.resolvedCount || 0)}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title="FALSE_POSITIVE" value={<span className="text-2xl font-black text-amber-700">{String(securityInsightStateSummary.falsePositiveCount || 0)}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Suppressed" : "숨김"} value={<span className="text-2xl font-black text-slate-700">{String(securityInsightStateSummary.suppressedCount || 0)}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Temporary Suppress" : "임시 suppress"} value={<span className="text-2xl font-black text-indigo-700">{String(securityInsightStateSummary.temporarySuppressionCount || 0)}</span>} />
            <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Expired Cleared" : "만료 해제"} value={<span className="text-2xl font-black text-emerald-700">{String(securityInsightStateSummary.expiredSuppressionCount || 0)}</span>} />
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
            {previousSecurityInsightSnapshot
              ? (en
                ? `Compared to ${stringOf(previousSecurityInsightSnapshot, "generatedAt")}, total findings changed by ${trendDelta}.`
                : `${stringOf(previousSecurityInsightSnapshot, "generatedAt")} 대비 총 탐지가 ${trendDelta}건 변동했습니다.`)
              : (en ? "No previous snapshot to compare yet." : "비교할 이전 스냅샷이 아직 없습니다.")}
          </div>
          {selectedFinding ? (
            <div className="mt-4 rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Workflow" : "승인 워크플로우"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedFindingWorkflow.map((step) => (
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${step.active ? "bg-blue-600 text-white" : step.reached ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}
                    key={step.step}
                  >
                    {step.step}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-[1.02fr_0.98fr]" data-help-id="security-policy-history">
        <article className="gov-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Detection Snapshot History" : "탐지 스냅샷 이력"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Recent detection snapshots persisted from the backend." : "백엔드에서 저장한 최근 탐지 스냅샷입니다."}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{securityInsightHistoryRows.length}{en ? " snapshots" : "건"}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Captured At" : "생성 시각"}</th>
                  <th className="px-4 py-3">{en ? "Total" : "총 탐지"}</th>
                  <th className="px-4 py-3">Critical/High</th>
                  <th className="px-4 py-3">{en ? "Top Category" : "상위 분류"}</th>
                  <th className="px-4 py-3">{en ? "Profile" : "프로파일"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {securityInsightHistoryRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>{en ? "No snapshot history." : "탐지 이력이 없습니다."}</td>
                  </tr>
                ) : securityInsightHistoryRows.map((row, idx) => (
                  <tr className="hover:bg-gray-50/50" key={`security-history-${idx}`}>
                    <td className="px-4 py-3 font-mono text-[12px]">{stringOf(row, "generatedAt")}</td>
                    <td className="px-4 py-3 font-bold">{stringOf(row, "totalFindings")}</td>
                    <td className="px-4 py-3">{`${stringOf(row, "criticalCount")}/${stringOf(row, "highCount")}`}</td>
                    <td className="px-4 py-3">{stringOf(row, "topCategory") || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[12px]">{stringOf(row, "profile") || "-"}</div>
                      <div className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{stringOf(row, "topEngine") || "-"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="gov-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Operator Action History" : "운영 액션 이력"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Merged server and local trail for suppress, baseline, SQL copy, and auto-cleanup actions." : "숨김, 베이스라인, SQL 복사, 자동 정리 같은 운영 액션을 서버 공용 이력과 브라우저 로컬 이력으로 함께 보여줍니다."}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{combinedActivityHistory.length}{en ? " actions" : "건"}</span>
          </div>
          <div className="mt-4 space-y-3">
            {combinedActivityHistory.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No operator action history." : "운영 액션 이력이 없습니다."}</div>
            ) : combinedActivityHistory.map((item, idx) => (
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`security-activity-${idx}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{stringOf(item, "action")}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${stringOf(item, "source") === "server" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {stringOf(item, "source") === "server" ? (en ? "server" : "서버") : (en ? "local" : "로컬")}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{stringOf(item, "happenedAt")}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item, "target") || "-"}</div>
                <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "detail") || "-"}</div>
                {stringOf(item, "actorUserId") ? (
                  <div className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                    {en ? "actor" : "작업자"}: <span className="font-mono">{stringOf(item, "actorUserId")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-[1fr_1fr]" data-help-id="security-policy-notification-report">
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Notification Routing" : "알림 라우팅"}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Digest" : "일일 요약"}</span>
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
          <div className="mt-4 grid grid-cols-1 gap-4">
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
              <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Webhook URL" : "Webhook URL"}</span>
              <AdminInput value={notificationWebhookUrl} onChange={(event) => setNotificationWebhookUrl(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
            {en
              ? `updatedAt=${stringOf(securityInsightNotificationConfig, "updatedAt") || "-"} / updatedBy=${stringOf(securityInsightNotificationConfig, "updatedBy") || "-"}`
              : `최근 저장: ${stringOf(securityInsightNotificationConfig, "updatedAt") || "-"} / 작업자: ${stringOf(securityInsightNotificationConfig, "updatedBy") || "-"}`}
            <div className="mt-2">
              {en
                ? `lastDigestAt=${stringOf(securityInsightNotificationConfig, "lastDigestAt") || "-"} / status=${stringOf(securityInsightNotificationConfig, "lastDigestStatus") || "-"}`
                : `최근 digest: ${stringOf(securityInsightNotificationConfig, "lastDigestAt") || "-"} / 상태: ${stringOf(securityInsightNotificationConfig, "lastDigestStatus") || "-"}`}
            </div>
          </div>
          <MemberButtonGroup className="mt-4">
            <button className="primary-button" disabled={notificationSaving || !canAutoFixFinding} onClick={() => { void saveNotificationRouting(); }} type="button">
              {notificationSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Routing" : "알림 라우팅 저장")}
            </button>
            <button className="secondary-button" disabled={notificationDispatchRunning || !canAutoFixFinding} onClick={() => { void dispatchNotificationRouting(false); }} type="button">
              {notificationDispatchRunning ? (en ? "Dispatching..." : "발송 중...") : (en ? "Dispatch Critical/High" : "Critical/High 발송")}
            </button>
            <button className="secondary-button" disabled={notificationDispatchRunning || !canAutoFixFinding} onClick={() => { void dispatchNotificationRouting(true); }} type="button">
              {notificationDispatchRunning ? (en ? "Dispatching..." : "발송 중...") : (en ? "Dispatch Critical Only" : "Critical만 발송")}
            </button>
            <span className="text-xs text-[var(--kr-gov-text-secondary)]">
              {canAutoFixFinding
                ? (en ? "Global admins can manage shared notification routing." : "전체 관리자는 공용 알림 라우팅을 저장할 수 있습니다.")
                : (en ? "Shared routing is editable by system/global administrators only." : "공용 라우팅은 시스템/전체 관리자만 수정할 수 있습니다.")}
            </span>
          </MemberButtonGroup>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="font-bold text-red-700">{en ? "Critical" : "Critical"}</div>
              <div className="mt-1 text-red-900">{en ? "Route immediately to Slack / mail / incident owner." : "즉시 Slack / 메일 / 인시던트 담당자에게 전달해야 합니다."}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="font-bold text-amber-700">{en ? "High" : "High"}</div>
              <div className="mt-1 text-amber-900">{en ? "Daily digest plus owner acknowledgement required." : "일일 요약과 담당자 확인이 필요합니다."}</div>
            </div>
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "False Positive / Allowlist Guidance" : "오탐 / 허용목록 가이드"}</h3>
          <div className="mt-4 space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "1. Mark repeated non-actionable items as FALSE_POSITIVE before suppression." : "1. 반복되는 비조치 항목은 suppress 전에 FALSE_POSITIVE로 먼저 표기합니다."}</div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "2. Use expiresAt for temporary suppressions instead of permanent hide." : "2. 영구 숨김 대신 expiresAt을 넣어 임시 suppress를 사용합니다."}</div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "3. Keep owner and note filled for every APPROVED / FALSE_POSITIVE item." : "3. APPROVED / FALSE_POSITIVE 항목은 담당자와 메모를 반드시 남깁니다."}</div>
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="security-policy-security-explorer">
        <article className="gov-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Security Source / Log Explorer" : "보안 소스/로그 탐색 제어"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Operational controls aligned with the msaManager security tab." : "msaManager 보안 탭의 운영 옵션을 현재 탐지 화면에 맞춰 정렬한 제어 패널입니다."}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${String(securityInsightConfig.sourceScanEnabled || false) === "true" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
              {String(securityInsightConfig.sourceScanEnabled || false) === "true" ? (en ? "SCAN ON" : "스캔 ON") : (en ? "SCAN OFF" : "스캔 OFF")}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1 font-bold text-[var(--kr-gov-text-secondary)] border border-[var(--kr-gov-border-light)]">
              {en ? "Profile" : "탐지 프로파일"}: <span className="font-mono">{String(securityInsightConfig.profile || "balanced")}</span>
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-bold text-[var(--kr-gov-text-secondary)] border border-[var(--kr-gov-border-light)]">
              {en ? "Last Scan" : "마지막 스캔"}: <span className="font-mono">{String(securityInsightConfig.lastScanAt || stringOf(diagnostics, "generatedAt") || "-")}</span>
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-bold text-[var(--kr-gov-text-secondary)] border border-[var(--kr-gov-border-light)]">
              cached: <span className="font-mono">{String(securityInsightConfig.cachedItems || securityInsightTotal)}</span>
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-4">
            <div className="text-xs font-bold text-amber-700 mb-3">{en ? "Commercial-grade Options" : "상용급 옵션"}</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 text-xs text-[var(--kr-gov-text-secondary)]">
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "Event engine" : "이벤트 엔진"}: <strong>{String(securityInsightConfig.includeEventEngine || false)}</strong></span>
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "External engine" : "외부 엔진"}: <strong>{String(securityInsightConfig.includeExternalEngine || false)}</strong></span>
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "New only mode" : "신규만 보기"}: <strong>{String(securityInsightConfig.newOnlyMode || false)}</strong></span>
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "Gate Critical" : "Critical 차단"}: <strong>{String(securityInsightConfig.gateCritical || securityInsightGate.gateCritical || false)}</strong></span>
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "Gate High" : "High 차단"}: <strong>{String(securityInsightConfig.gateHigh || securityInsightGate.gateHigh || false)}</strong></span>
              <span className="rounded-full bg-white px-3 py-1 border border-amber-200">{en ? "Baseline" : "베이스라인"}: <strong>{String(securityInsightConfig.baselineCount || baselineFingerprints.length)}</strong></span>
            </div>
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Explorer Status" : "탐색 엔진 상태"}</h3>
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-4">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
              <span>{`phase: ${String(securityInsightExplorer.phase || "idle")}`}</span>
              <span>{`ETA: ${String(securityInsightExplorer.etaSeconds || 0)}s`}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
              <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${filteredSecurityInsightItems.length === 0 ? 0 : Math.min(100, Math.round((Number(securityInsightExplorer.matchedCount || filteredSecurityInsightItems.length) / Math.max(1, securityInsightTotal)) * 100))}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-indigo-800">
              <span>{`files: ${String(securityInsightExplorer.scannedFiles || 0)}/${String(securityInsightExplorer.totalFiles || 0)}`}</span>
              <span>{`matched: ${String(securityInsightExplorer.matchedCount || filteredSecurityInsightItems.length)}`}</span>
              <span>{`elapsed: ${String(securityInsightExplorer.elapsedSeconds || 0)}s`}</span>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-[#2a2f44] bg-[#0f1320] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-emerald-300">Security Explorer Terminal</div>
              <div className="max-w-[70%] truncate text-[11px] text-cyan-300">{String(securityInsightExplorer.currentTarget || "-")}</div>
            </div>
            <pre className="h-[180px] overflow-auto rounded border border-[#1f2438] bg-[#090c16] p-3 text-[11px] whitespace-pre-wrap text-emerald-300">{[
              `mode=${String(securityInsightExplorer.mode || "source+governance")}`,
              `phase=${String(securityInsightExplorer.phase || "idle")}`,
              `matched=${String(securityInsightExplorer.matchedCount || filteredSecurityInsightItems.length)}`,
              `profile=${String(securityInsightConfig.profile || "balanced")}`,
              `eventEngine=${String(securityInsightConfig.includeEventEngine || false)}`,
              `externalEngine=${String(securityInsightConfig.includeExternalEngine || false)}`,
              `currentTarget=${String(securityInsightExplorer.currentTarget || "-")}`
            ].join("\n")}</pre>
          </div>
        </article>
        <article className="gov-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Notification Delivery History" : "알림 발송 이력"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Server-side dispatch attempts recorded from the security policy console." : "보안정책 화면에서 실행한 알림 발송 시도를 서버 기준으로 기록합니다."}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{securityInsightDeliveryRows.length}{en ? " deliveries" : "건"}</span>
          </div>
          <div className="mt-4 space-y-3">
            {securityInsightDeliveryRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No delivery history." : "알림 발송 이력이 없습니다."}</div>
            ) : securityInsightDeliveryRows.map((item, idx) => (
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`security-delivery-${idx}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${stringOf(item, "status") === "RECORDED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{stringOf(item, "status") || "-"}</span>
                  <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{stringOf(item, "sentAt")}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item, "mode")} / {stringOf(item, "findingCount")}{en ? " findings" : "건"}</div>
                <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "topFinding") || "-"}</div>
                <div className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">actor: <span className="font-mono">{stringOf(item, "actorUserId") || "-"}</span></div>
                <div className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">detail: <span className="font-mono">{stringOf(item, "deliveryDetail") || "-"}</span></div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">slack: {stringOf(item, "slackStatus") || "-"}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">mail: {stringOf(item, "mailStatus") || "-"}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">webhook: {stringOf(item, "webhookStatus") || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <AdminSummaryStrip data-help-id="security-policy-summary">
        {cards.map((card, idx) => (
          <SummaryMetricCard
            accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
            className="gov-card"
            description={card.description}
            key={idx}
            surfaceClassName="bg-white"
            title={card.title}
            value={<span className="text-2xl font-black">{card.value}</span>}
          />
        ))}
      </AdminSummaryStrip>
      <section className="gov-card p-0 overflow-hidden" data-help-id="security-policy-table">
        <GridToolbar
          actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total" : "총"} <strong>{rows.length}</strong>{en ? "" : "건"}</span>}
          title={en ? "Applied Policy List" : "적용 정책 목록"}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Policy ID" : "정책 ID"}</th><th className="px-4 py-3">{en ? "Target URL" : "대상 URL"}</th><th className="px-4 py-3">{en ? "Policy Name" : "정책명"}</th><th className="px-4 py-3">{en ? "Threshold" : "기본 임계치"}</th><th className="px-4 py-3">Burst</th><th className="px-4 py-3">{en ? "Action" : "조치"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th><th className="px-4 py-3">{en ? "Updated At" : "수정일시"}</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => {
                const policyId = stringOf(row, "policyId");
                const selected = selectedPolicyId === policyId;
                const action = stringOf(row, "action");
                const actionTone = action.includes("차단") || action.toLowerCase().includes("block")
                  ? "bg-red-100 text-red-700"
                  : action.includes("CAPTCHA") || action.toLowerCase().includes("captcha")
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700";
                return <tr className={selected ? "bg-blue-50" : "hover:bg-gray-50/50"} key={idx} onClick={() => setSelectedPolicyId(policyId)}>
                  <td className="px-4 py-3 font-bold">{policyId}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "targetUrl")}</td>
                  <td className="px-4 py-3">{stringOf(row, "policyName")}</td>
                  <td className="px-4 py-3">{stringOf(row, "threshold")}</td>
                  <td className="px-4 py-3">{stringOf(row, "burst")}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${actionTone}`}>{action}</span></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">{stringOf(row, "status")}</span></td>
                  <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "updatedAt")}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]" data-help-id="security-policy-selected-detail">
        <article className="gov-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Selected Policy" : "선택 정책 상세"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Inspect threshold, response path, and next operational move for the selected policy." : "선택한 정책의 임계치, 대응 흐름, 다음 운영 액션을 한 번에 확인합니다."}</p>
            </div>
            {selectedPolicy ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stringOf(selectedPolicy, "policyId")}</span> : null}
          </div>
          {selectedPolicy ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target URL" : "대상 URL"}</p>
                <p className="mt-2 font-mono text-sm">{stringOf(selectedPolicy, "targetUrl")}</p>
                <p className="mt-3 text-lg font-bold">{stringOf(selectedPolicy, "policyName")}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Threshold" : "기본 임계치"} value={<span className="text-base font-black">{stringOf(selectedPolicy, "threshold")}</span>} />
                <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title="Burst" value={<span className="text-base font-black">{stringOf(selectedPolicy, "burst")}</span>} />
                <SummaryMetricCard accentClassName="text-[var(--kr-gov-text-secondary)] text-xs" className="rounded-lg" surfaceClassName="bg-[var(--kr-gov-surface-subtle)]" title={en ? "Last Update" : "수정일시"} value={<span className="text-base font-black">{stringOf(selectedPolicy, "updatedAt")}</span>} />
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                <p className="text-xs font-bold text-blue-700">{en ? "Response Path" : "대응 흐름"}</p>
                <p className="mt-2 text-sm leading-6 text-blue-900">{stringOf(selectedPolicy, "action")}</p>
              </div>
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                {stringOf(selectedPolicy, "action").includes("차단") || stringOf(selectedPolicy, "action").toLowerCase().includes("block")
                  ? (en ? "Review unblock procedure, owner scope, and audit trail before changing this policy." : "이 정책을 조정하기 전 차단 해제 절차, 소유 범위, 감사 이력을 먼저 검토해야 합니다.")
                  : stringOf(selectedPolicy, "action").includes("CAPTCHA") || stringOf(selectedPolicy, "action").toLowerCase().includes("captcha")
                    ? (en ? "Check bot-challenge false positives before relaxing threshold or burst values." : "임계치나 burst를 완화하기 전에 CAPTCHA 오탐 여부를 먼저 확인해야 합니다.")
                    : (en ? "Alert-oriented rules should be paired with monitoring and incident ownership." : "알림 중심 정책은 모니터링과 인시던트 담당 체계를 함께 확인해야 합니다.")}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No policy selected." : "선택된 정책이 없습니다."}</div>
          )}
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Policy Operation Checklist" : "정책 운영 체크리스트"}</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "1. Check duplicate menu URL / VIEW mappings before tuning thresholds." : "1. 임계치 조정 전에 중복 메뉴 URL / VIEW 매핑부터 정리합니다."}</div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "2. Policies escalating to block should have unblock owner and retention rule documented." : "2. 차단까지 승격되는 정책은 해제 담당자와 보존 규칙이 문서화돼 있어야 합니다."}</div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "3. Search/API rules should be validated with cache and token scope together." : "3. 검색/API 정책은 캐시 전략과 토큰 범위를 함께 검증해야 합니다."}</div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">{en ? "4. Login policies should be checked with captcha, WAF, and account lock messages together." : "4. 로그인 정책은 CAPTCHA, WAF, 계정 잠금 메시지를 함께 점검해야 합니다."}</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <MemberLinkButton href={stringOf(page, "menuPermissionEnvironmentUrl")} variant="secondary">{en ? "Open Environment" : "환경관리 열기"}</MemberLinkButton>
            <MemberLinkButton href={stringOf(page, "menuPermissionAuthGroupUrl")} variant="secondary">{en ? "Open Auth Group" : "권한 그룹 열기"}</MemberLinkButton>
            <MemberLinkButton href={stringOf(page, "menuPermissionDiagnosticSqlDownloadUrl")} variant="info">{en ? "Download SQL" : "진단 SQL 다운로드"}</MemberLinkButton>
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]" data-help-id="security-policy-diagnostics">
        <DiagnosticCard
          actions={(
            <>
              <button
                className="primary-button"
                disabled={cleanupRunning || duplicatedMenuUrlCount === 0 || !canAutoFixFinding}
                onClick={() => { void handleAutoCleanup(); }}
                type="button"
              >
                {cleanupRunning
                  ? (en ? "Cleaning..." : "자동 정리 중...")
                  : (en ? "Run Likely Auto-cleanup" : "자동 정리 실행")}
              </button>
              <MemberLinkButton href={stringOf(page, "menuPermissionDiagnosticSqlDownloadUrl")} variant="info">
                {en ? "Download SQL" : "진단 SQL 다운로드"}
              </MemberLinkButton>
              <MemberLinkButton href={stringOf(page, "menuPermissionAuthGroupUrl")} variant="secondary">
                {en ? "Open Auth Group" : "권한 그룹 열기"}
              </MemberLinkButton>
              <MemberLinkButton href={stringOf(page, "menuPermissionEnvironmentUrl")} variant="secondary">
                {en ? "Open Environment Management" : "환경관리 열기"}
              </MemberLinkButton>
            </>
          )}
          description={stringOf(diagnostics, "message") || (en ? "No diagnostic message." : "진단 메시지가 없습니다.")}
          eyebrow={en ? "Menu Permission Diagnostics" : "메뉴 권한 진단"}
          status={extendedIssueCount > 0 ? (en ? "Needs Review" : "검토 필요") : (en ? "Healthy" : "정상")}
          statusTone={extendedIssueCount > 0 ? "warning" : "healthy"}
          summary={(
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryMetricCard
                  accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                  className="rounded-lg"
                  surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                  title={en ? "Duplicated Menu URLs" : "중복 메뉴 URL"}
                  value={<span className="text-2xl font-black">{stringOf(diagnostics, "menuUrlDuplicateCount") || "0"}</span>}
                />
                <SummaryMetricCard
                  accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                  className="rounded-lg"
                  surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                  title={en ? "Duplicated VIEW Mappings" : "중복 VIEW 매핑"}
                  value={<span className="text-2xl font-black">{stringOf(diagnostics, "viewFeatureDuplicateCount") || "0"}</span>}
                />
                <SummaryMetricCard
                  accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                  className="rounded-lg"
                  surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                  title={en ? "Integrity Issues" : "무결성 이슈"}
                  value={<span className="text-2xl font-black">{String(integrityIssueCount)}</span>}
                />
                <SummaryMetricCard
                  accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                  className="rounded-lg"
                  surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                  title={en ? "High-risk Exposures" : "고위험 권한"}
                  value={<span className="text-2xl font-black">{String(highRiskExposureCount + scopeViolationCount)}</span>}
                />
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-4">
                <p className="text-xs font-bold text-amber-700">{en ? "Cleanup Recommendations" : "정리 추천"}</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {en
                    ? `Review ${extendedIssueCount} targets. Duplicates: ${cleanupRecommendationCount}, integrity issues: ${integrityIssueCount}, high-risk exposures: ${highRiskExposureCount}, scope violations: ${scopeViolationCount}.`
                    : `중복 ${cleanupRecommendationCount}건, 무결성 이슈 ${integrityIssueCount}건, 고위험 권한 ${highRiskExposureCount}건, 범위 오류 ${scopeViolationCount}건으로 총 ${extendedIssueCount}건입니다.`}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                    <p className="text-xs font-bold text-amber-700">{en ? "Menu URL Duplicates" : "메뉴 URL 중복"}</p>
                    <p className="mt-1 text-lg font-black text-amber-900">{duplicatedMenuUrlCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Usually safe after primary menu confirmation" : "대표 메뉴만 확정되면 비교적 안전하게 정리 가능"}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-white px-3 py-3">
                    <p className="text-xs font-bold text-red-700">{en ? "VIEW Duplicates" : "VIEW 중복"}</p>
                    <p className="mt-1 text-lg font-black text-red-900">{duplicatedViewMappingCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Needs feature-level confirmation before cleanup" : "기능 코드 영향 확인 후 정리해야 함"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <p className="text-xs font-bold text-emerald-700">{en ? "Likely Auto-cleanup" : "자동 정리 가능 후보"}</p>
                    <p className="mt-1 text-lg font-black text-emerald-900">{likelyAutoCleanupCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Menu URL duplicates where only primary menu confirmation is typically needed" : "대표 메뉴만 확정하면 되는 메뉴 URL 중복 건수"}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                    <p className="text-xs font-bold text-red-700">{en ? "Manual Review Required" : "수동 확인 필수"}</p>
                    <p className="mt-1 text-lg font-black text-red-900">{manualReviewRequiredCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "VIEW duplicates that need feature/authority impact review" : "기능/권한 영향 확인이 필요한 VIEW 중복 건수"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-blue-200 bg-white px-3 py-3">
                    <p className="text-xs font-bold text-blue-700">{en ? "Integrity Issues" : "무결성 이슈"}</p>
                    <p className="mt-1 text-lg font-black text-blue-900">{integrityIssueCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Active menus without VIEW or grants pointing to inactive features" : "활성 메뉴에 VIEW가 없거나 비활성 기능을 참조하는 권한"}</p>
                  </div>
                  <div className="rounded-lg border border-fuchsia-200 bg-white px-3 py-3">
                    <p className="text-xs font-bold text-fuchsia-700">{en ? "Scope / High-risk" : "범위 / 고위험"}</p>
                    <p className="mt-1 text-lg font-black text-fuchsia-900">{highRiskExposureCount + scopeViolationCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Sensitive system features assigned beyond the intended role scope" : "민감 시스템 기능이 의도 범위를 넘어 부여된 권한"}</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">{en ? "Generated At" : "생성 시각"}: {stringOf(diagnostics, "generatedAt") || "-"}</p>
            </>
          )}
          title={en ? "Duplicate URL / VIEW Mapping Check" : "중복 URL / VIEW 매핑 점검"}
        />
        <article className="gov-card p-0 overflow-hidden">
          <GridToolbar title={en ? "Detected Duplicate Targets" : "감지된 중복 대상"} />
          <div className="max-h-[420px] overflow-auto">
            {duplicatedMenuUrls.length === 0 && duplicatedViewMappings.length === 0 ? (
              <div className="px-6 py-10 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No duplicate active menu URL or VIEW feature mapping was found." : "활성 메뉴 URL 또는 VIEW 기능 중복 매핑이 없습니다."}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {duplicatedMenuUrls.map((row, idx) => (
                  <div className="px-6 py-4" key={`menu-url-${idx}`}>
                    <p className="text-xs font-bold text-amber-700">{en ? "Duplicated Menu URL" : "중복 메뉴 URL"}</p>
                    <p className="mt-2 font-mono text-[13px]">{stringOf(row, "menuUrl")}</p>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Menu Codes" : "메뉴 코드"}: {stringOf(row, "menuCodes")}</p>
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{en ? "Likely Auto-cleanup Candidate" : "자동 정리 유력"}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? "Confirm primary menu only" : "대표 메뉴만 확인 필요"}</span>
                      </div>
                      <p className="font-bold text-amber-800">{en ? "Recommended Cleanup" : "추천 정리안"}</p>
                      <p className="mt-1 text-amber-900">{en ? "Primary Menu" : "대표 유지 메뉴"}: <span className="font-mono">{stringOf(row, "recommendedPrimaryMenuCode")}</span></p>
                      <p className="mt-1 text-amber-900">{en ? "Disable Candidates" : "비활성 후보"}: <span className="font-mono">{stringOf(row, "recommendedDisableMenuCodes") || "-"}</span></p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="secondary-button"
                          disabled={cleanupRunning}
                          onClick={() => { void handleAutoCleanup([stringOf(row, "menuUrl")]); }}
                          type="button"
                        >
                          {en ? "Run Auto-cleanup" : "자동 정리 실행"}
                        </button>
                        <MemberLinkButton href={buildEnvironmentUrl(stringOf(row, "recommendedPrimaryMenuCode"))} size="xs" variant="secondary">
                          {en ? "Open Environment" : "환경관리 열기"}
                        </MemberLinkButton>
                        <MemberLinkButton href={buildAuthGroupUrl(stringOf(row, "recommendedPrimaryMenuCode"))} size="xs" variant="secondary">
                          {en ? "Open Auth Group" : "권한 그룹 열기"}
                        </MemberLinkButton>
                      </div>
                      <CopyableCodeBlock
                        copiedLabel={en ? "Copied" : "복사됨"}
                        copied={copiedSqlKey === `menu-${idx}`}
                        copyLabel={en ? "Copy SQL" : "SQL 복사"}
                        onCopy={() => { void copySqlPreview(`menu-${idx}`, stringOf(row, "recommendedSqlPreview")); }}
                        title="SQL Preview"
                        value={stringOf(row, "recommendedSqlPreview")}
                      />
                    </div>
                  </div>
                ))}
                {duplicatedViewMappings.map((row, idx) => (
                  <div className="px-6 py-4" key={`view-map-${idx}`}>
                    <p className="text-xs font-bold text-red-700">{en ? "Duplicated VIEW Mapping" : "중복 VIEW 매핑"}</p>
                    <p className="mt-2 font-mono text-[13px]">{stringOf(row, "menuUrl")}</p>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Menu Codes" : "메뉴 코드"}: {stringOf(row, "menuCodes")}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Feature Codes" : "기능 코드"}: {stringOf(row, "featureCodes")}</p>
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">{en ? "Manual Review Required" : "수동 검토 필요"}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? "Feature impact must be checked" : "기능 영향 확인 필수"}</span>
                      </div>
                      <p className="font-bold text-red-800">{en ? "Recommended Cleanup" : "추천 정리안"}</p>
                      <p className="mt-1 text-red-900">{en ? "Primary Menu" : "대표 유지 메뉴"}: <span className="font-mono">{stringOf(row, "recommendedPrimaryMenuCode") || "-"}</span></p>
                      <p className="mt-1 text-red-900">{en ? "Primary VIEW Feature" : "대표 VIEW 기능"}: <span className="font-mono">{stringOf(row, "recommendedPrimaryFeatureCode")}</span></p>
                      <p className="mt-1 text-red-900">{en ? "Remove Candidates" : "정리 후보 기능"}: <span className="font-mono">{stringOf(row, "recommendedRemoveFeatureCodes") || "-"}</span></p>
                      <p className="mt-1 text-red-900">{en ? "Authority Impact" : "권한 영향"}: <span className="font-mono">{stringOf(row, "referenceImpactSummary") || "-"}</span></p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MemberLinkButton href={buildEnvironmentUrl(stringOf(row, "recommendedPrimaryMenuCode"))} size="xs" variant="secondary">
                          {en ? "Open Environment" : "환경관리 열기"}
                        </MemberLinkButton>
                        <MemberLinkButton href={buildAuthGroupUrl(stringOf(row, "recommendedPrimaryMenuCode"), stringOf(row, "recommendedPrimaryFeatureCode"))} size="xs" variant="secondary">
                          {en ? "Open Focused Auth Group" : "포커스 권한 그룹 열기"}
                        </MemberLinkButton>
                      </div>
                      <CopyableCodeBlock
                        copiedLabel={en ? "Copied" : "복사됨"}
                        copied={copiedPromptKey === `codex-${idx}`}
                        copyLabel={en ? "Copy Codex CLI Prompt" : "Codex CLI 요청문 복사"}
                        onCopy={() => { void copyCodexPrompt(`codex-${idx}`, stringOf(row, "codexCliPrompt")); }}
                        title={en ? "Codex CLI Request" : "Codex CLI 요청문"}
                        value={stringOf(row, "codexCliPrompt")}
                      />
                      <CopyableCodeBlock
                        copiedLabel={en ? "Copied" : "복사됨"}
                        copied={copiedSqlKey === `view-${idx}`}
                        copyLabel={en ? "Copy SQL" : "SQL 복사"}
                        onCopy={() => { void copySqlPreview(`view-${idx}`, stringOf(row, "recommendedSqlPreview")); }}
                        title="SQL Preview"
                        value={stringOf(row, "recommendedSqlPreview")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3" data-help-id="security-policy-integrity">
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Integrity: Missing VIEW" : "무결성: VIEW 누락"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Active menus that expose a route without any active VIEW feature." : "활성 메뉴인데 활성 VIEW 기능이 없는 경로입니다."}</p>
          <div className="mt-4 space-y-3">
            {menusMissingView.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No missing VIEW issue." : "VIEW 누락 이슈가 없습니다."}</div>
            ) : (
              menusMissingView.slice(0, 8).map((row, idx) => (
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`missing-view-${idx}`}>
                  <p className="font-mono text-[13px]">{stringOf(row, "menuUrl")}</p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "menuCode")}</p>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Integrity: Inactive Grants" : "무결성: 비활성 권한 참조"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Roles or overrides that still reference missing or inactive menu features." : "누락되었거나 비활성인 기능을 아직 참조하는 역할/override입니다."}</p>
          <div className="mt-4 space-y-3">
            {[...inactiveAuthorFeatureRelations.slice(0, 4), ...inactiveUserOverrides.slice(0, 4)].length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No inactive grant issue." : "비활성 권한 참조 이슈가 없습니다."}</div>
            ) : (
              <>
                {inactiveAuthorFeatureRelations.slice(0, 4).map((row, idx) => (
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`inactive-author-${idx}`}>
                    <p className="text-sm font-bold">{stringOf(row, "authorNm")} <span className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "authorCode")}</span></p>
                    <p className="mt-1 font-mono text-[13px]">{stringOf(row, "featureCode")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "issueLabel")}</p>
                  </div>
                ))}
                {inactiveUserOverrides.slice(0, 4).map((row, idx) => (
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`inactive-override-${idx}`}>
                    <p className="text-sm font-bold">{stringOf(row, "targetId")} <span className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "memberTypeCode")}</span></p>
                    <p className="mt-1 font-mono text-[13px]">{stringOf(row, "featureCode")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "issueLabel")}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "High-risk Scope Exposure" : "고위험 범위 노출"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Sensitive system features that are granted outside the strictest role scope." : "민감한 시스템 기능이 엄격한 역할 범위 밖으로 부여된 상태입니다."}</p>
          <div className="mt-4 space-y-3">
            {[...sensitiveRoleExposures.slice(0, 4), ...companyScopeSensitiveExposures.slice(0, 4)].length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No high-risk scope issue." : "고위험 범위 이슈가 없습니다."}</div>
            ) : (
              <>
                {sensitiveRoleExposures.slice(0, 4).map((row, idx) => (
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3" key={`risk-role-${idx}`}>
                    <p className="text-sm font-bold">{stringOf(row, "authorNm")} <span className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "authorCode")}</span></p>
                    <p className="mt-1 font-mono text-[13px]">{stringOf(row, "menuUrl")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "featureCode")}</p>
                  </div>
                ))}
                {companyScopeSensitiveExposures.slice(0, 4).map((row, idx) => (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" key={`scope-risk-${idx}`}>
                    <p className="text-sm font-bold text-red-800">{stringOf(row, "authorNm")} <span className="font-mono text-xs text-red-700">{stringOf(row, "authorCode")}</span></p>
                    <p className="mt-1 font-mono text-[13px] text-red-900">{stringOf(row, "menuUrl")}</p>
                    <p className="mt-1 text-xs text-red-700">{stringOf(row, "riskLabel")}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3" data-help-id="security-policy-playbooks">
        {playbooks.map((item, idx) => <article className="gov-card" key={idx}><h3 className="text-lg font-bold">{stringOf(item, "title")}</h3><p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body")}</p></article>)}
      </section>
      <section className="gov-card" data-help-id="security-policy-cleanup-plan">
        <h3 className="text-lg font-bold">{en ? "Cleanup Execution Guidance" : "정리 실행 가이드"}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-bold text-emerald-800">{en ? "Can be solved" : "해결 가능"}</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {en
                ? "Menu URL duplicates are usually resolvable by keeping one active menu and disabling the rest after confirming the primary code."
                : "메뉴 URL 중복은 대표 메뉴 1건을 확정한 뒤 나머지를 비활성화하는 방식으로 대부분 해결 가능합니다."}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-sm font-bold text-red-800">{en ? "Needs caution" : "주의 필요"}</p>
            <p className="mt-2 text-sm leading-6 text-red-900">
              {en
                ? "VIEW duplicates are also solvable, but feature removal must be checked against actual authority usage first."
                : "VIEW 중복도 해결 가능하지만, 기능 제거 전 실제 권한 사용 범위를 먼저 확인해야 합니다."}
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="gov-table-header">
                <th className="px-4 py-3">{en ? "Category" : "분류"}</th>
                <th className="px-4 py-3">{en ? "Count" : "건수"}</th>
                <th className="px-4 py-3">{en ? "Action Basis" : "판단 기준"}</th>
                <th className="px-4 py-3">{en ? "Execution Note" : "실행 메모"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-bold text-emerald-700">{en ? "Likely Auto-cleanup" : "자동 정리 가능 후보"}</td>
                <td className="px-4 py-3">{likelyAutoCleanupCount}</td>
                <td className="px-4 py-3">{en ? "Duplicated active menu URL" : "활성 메뉴 URL 중복"}</td>
                <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{en ? "Keep one primary menu and disable others after owner confirmation." : "대표 메뉴 1건만 유지하고 나머지를 비활성화합니다."}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-red-700">{en ? "Manual Review Required" : "수동 확인 필수"}</td>
                <td className="px-4 py-3">{manualReviewRequiredCount}</td>
                <td className="px-4 py-3">{en ? "Duplicated VIEW feature mapping" : "VIEW 기능 중복 매핑"}</td>
                <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{en ? "Copy the generated Codex CLI prompt, review authority impact, then approve the suggested SQL preview." : "생성된 Codex CLI 요청문으로 영향 분석을 받은 뒤 SQL preview를 승인하는 흐름이 적합합니다."}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </AdminPolicyPageFrame>
    </AdminPageShell>
  );
}
