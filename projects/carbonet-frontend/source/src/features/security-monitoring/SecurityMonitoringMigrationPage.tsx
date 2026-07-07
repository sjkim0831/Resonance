import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  dispatchSecurityMonitoringNotification,
  fetchSecurityMonitoringPage,
  registerSecurityMonitoringBlockCandidate,
  saveSecurityMonitoringState,
  updateSecurityMonitoringBlockCandidate,
} from "../../lib/api/security";
import { readBootstrappedSecurityMonitoringPageData } from "../../lib/api/bootstrap";
import type { SecurityMonitoringPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberPagination } from "../member/common";
import { stringOf } from "../admin-system/adminSystemShared";
import { useEffect, useMemo, useState } from "react";

const EVENT_PAGE_SIZE = 5;
const AUX_PAGE_SIZE = 5;

function parseDetectedAt(value: string) {
  if (!value) {
    return null;
  }
  const normalized = value.replace(" ", "T");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function csvCell(value: string) {
  const normalized = value.replace(/"/g, '""');
  return `"${normalized}"`;
}

function downloadMonitoringBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function firstNonBlankForMonitoring(...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function buildTimeLabel(timestamp: number, en: boolean) {
  const date = new Date(timestamp);
  const hour = String(date.getHours()).padStart(2, "0");
  return en ? `${hour}:00` : `${hour}시`;
}

function clampPageInput(value: string, totalPages: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
}

export function SecurityMonitoringMigrationPage() {
  const en = isEnglish();
  const search = new URLSearchParams(window.location.search);
  const queryFingerprint = search.get("fingerprint") || "";
  const queryIp = search.get("ip") || "";
  const queryUrl = search.get("url") || "";
  const initialPayload = useMemo(() => readBootstrappedSecurityMonitoringPageData(), []);
  const pageState = useAsyncValue<SecurityMonitoringPagePayload>(fetchSecurityMonitoringPage, [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  const cards = (page?.securityMonitoringCards || []) as Array<Record<string, string>>;
  const targets = (page?.securityMonitoringTargets || []) as Array<Record<string, string>>;
  const ips = (page?.securityMonitoringIps || []) as Array<Record<string, string>>;
  const events = (page?.securityMonitoringEvents || []) as Array<Record<string, string>>;
  const activityRows = (page?.securityMonitoringActivityRows || []) as Array<Record<string, string>>;
  const blockCandidateRows = (page?.securityMonitoringBlockCandidates || []) as Array<Record<string, string>>;
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [timeRangeFilter, setTimeRangeFilter] = useState("ALL");
  const [refreshInterval, setRefreshInterval] = useState("OFF");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [ownerKeyword, setOwnerKeyword] = useState("");
  const [noteKeyword, setNoteKeyword] = useState("");
  const [sortMode, setSortMode] = useState("LATEST");
  const [eventStateFilter, setEventStateFilter] = useState("ALL");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("ALL");
  const [selectedEventFingerprint, setSelectedEventFingerprint] = useState(queryFingerprint);
  const [eventPage, setEventPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const [candidatePageInput, setCandidatePageInput] = useState("1");
  const [notificationPageInput, setNotificationPageInput] = useState("1");
  const [notificationChannelFilter, setNotificationChannelFilter] = useState("ALL");
  const [notificationSearchKeyword, setNotificationSearchKeyword] = useState("");
  const [stateHistoryFilter, setStateHistoryFilter] = useState("ALL");
  const [stateHistorySearchKeyword, setStateHistorySearchKeyword] = useState("");
  const [stateHistoryPageInput, setStateHistoryPageInput] = useState("1");
  const [selectedStatus, setSelectedStatus] = useState("NEW");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedNote, setSelectedNote] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [lastNotificationRetryKey, setLastNotificationRetryKey] = useState("");
  const [lastNotificationRetryStatus, setLastNotificationRetryStatus] = useState("");
  const [submittingState, setSubmittingState] = useState(false);
  const [registeringBlockCandidate, setRegisteringBlockCandidate] = useState(false);
  const [dispatchingNotification, setDispatchingNotification] = useState(false);

  useEffect(() => {
    if (refreshInterval === "OFF") {
      return;
    }
    const intervalMs = Number.parseInt(refreshInterval, 10);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      void pageState.reload();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [pageState, refreshInterval]);

  const filteredByTimeEvents = useMemo(() => {
    if (timeRangeFilter === "ALL") {
      return events;
    }
    const rangeMinutes = Number.parseInt(timeRangeFilter, 10);
    if (!Number.isFinite(rangeMinutes) || rangeMinutes <= 0) {
      return events;
    }
    const threshold = Date.now() - rangeMinutes * 60 * 1000;
    return events.filter((row) => {
      const parsed = parseDetectedAt(stringOf(row, "detectedAt"));
      return parsed === null || parsed >= threshold;
    });
  }, [events, timeRangeFilter]);

  const filteredEvents = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    const normalizedOwnerKeyword = ownerKeyword.trim().toLowerCase();
    const normalizedNoteKeyword = noteKeyword.trim().toLowerCase();
    let source = filteredByTimeEvents;
    if (severityFilter !== "ALL") {
      source = source.filter((row) => stringOf(row, "severity").toUpperCase() === severityFilter);
    }
    if (normalizedKeyword) {
      source = source.filter((row) => {
        const haystack = [
          stringOf(row, "title"),
          stringOf(row, "detail"),
          stringOf(row, "severity"),
          stringOf(row, "detectedAt"),
          stringOf(row, "stateStatus"),
          stringOf(row, "stateOwner"),
          stringOf(row, "stateNote"),
          stringOf(row, "sourceIp"),
          stringOf(row, "targetUrl"),
          stringOf(row, "url"),
          stringOf(row, "ip")
        ].join(" ").toLowerCase();
        return haystack.includes(normalizedKeyword);
      });
    }
    if (queryIp) {
      source = source.filter((row) => {
        const haystack = [stringOf(row, "sourceIp"), stringOf(row, "ip"), stringOf(row, "detail")].join(" ").toLowerCase();
        return haystack.includes(queryIp.toLowerCase());
      });
    }
    if (queryUrl) {
      source = source.filter((row) => {
        const haystack = [stringOf(row, "targetUrl"), stringOf(row, "url"), stringOf(row, "detail")].join(" ").toLowerCase();
        return haystack.includes(queryUrl.toLowerCase());
      });
    }
    if (normalizedOwnerKeyword) {
      source = source.filter((row) => stringOf(row, "stateOwner").toLowerCase().includes(normalizedOwnerKeyword));
    }
    if (normalizedNoteKeyword) {
      source = source.filter((row) => stringOf(row, "stateNote").toLowerCase().includes(normalizedNoteKeyword));
    }
    if (eventStateFilter !== "ALL") {
      source = source.filter((row) => (stringOf(row, "stateStatus") || "NEW").toUpperCase() === eventStateFilter);
    }
    const next = [...source];
    if (sortMode === "SEVERITY") {
      const rank = (value: string) => {
        const upper = value.toUpperCase();
        if (upper.includes("CRITICAL")) return 0;
        if (upper.includes("HIGH")) return 1;
        if (upper.includes("MEDIUM")) return 2;
        return 3;
      };
      next.sort((left, right) => rank(stringOf(left, "severity")) - rank(stringOf(right, "severity")));
      return next;
    }
    if (sortMode === "TITLE") {
      next.sort((left, right) => stringOf(left, "title").localeCompare(stringOf(right, "title")));
      return next;
    }
    next.sort((left, right) => {
      const rightTime = parseDetectedAt(stringOf(right, "detectedAt")) || 0;
      const leftTime = parseDetectedAt(stringOf(left, "detectedAt")) || 0;
      return rightTime - leftTime;
    });
    return next;
  }, [eventStateFilter, filteredByTimeEvents, noteKeyword, ownerKeyword, queryIp, queryUrl, searchKeyword, severityFilter, sortMode]);

  useEffect(() => {
    setEventPage(1);
  }, [eventStateFilter, noteKeyword, ownerKeyword, queryIp, queryUrl, searchKeyword, severityFilter, sortMode, timeRangeFilter, page]);

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE));
  const pagedEvents = useMemo(() => {
    const startIndex = (eventPage - 1) * EVENT_PAGE_SIZE;
    return filteredEvents.slice(startIndex, startIndex + EVENT_PAGE_SIZE);
  }, [eventPage, filteredEvents]);

  const selectedEvent = useMemo(() => {
    const byFingerprint = filteredEvents.find((row) => stringOf(row, "fingerprint") === selectedEventFingerprint);
    return byFingerprint || pagedEvents[0] || null;
  }, [filteredEvents, pagedEvents, selectedEventFingerprint]);
  const criticalCount = useMemo(
    () => events.filter((row) => stringOf(row, "severity").toUpperCase().includes("CRITICAL")).length,
    [events]
  );
  const highCount = useMemo(
    () => events.filter((row) => stringOf(row, "severity").toUpperCase().includes("HIGH")).length,
    [events]
  );
  const blockedTargetCount = useMemo(
    () => targets.filter((row) => stringOf(row, "status").includes("차단") || stringOf(row, "status").toLowerCase().includes("block")).length,
    [targets]
  );
  const topTarget = targets[0] || null;
  const topIp = ips[0] || null;
  const groupedIpRows = useMemo(() => {
    return ips.slice(0, 5).map((row) => ({
      key: stringOf(row, "ip"),
      label: stringOf(row, "ip"),
      volume: Number.parseInt(stringOf(row, "requestCount") || "0", 10) || 0,
      action: stringOf(row, "action")
    }));
  }, [ips]);
  const groupedTargetRows = useMemo(() => {
    return targets.slice(0, 5).map((row) => ({
      key: stringOf(row, "url"),
      label: stringOf(row, "url"),
      volume: Number.parseInt((stringOf(row, "rps") || "0").replace(/[^0-9-]/g, ""), 10) || 0,
      action: stringOf(row, "rule")
    }));
  }, [targets]);
  const maxIpVolume = Math.max(1, ...groupedIpRows.map((row) => row.volume));
  const maxTargetVolume = Math.max(1, ...groupedTargetRows.map((row) => row.volume));
  const activeEscalationTarget = selectedEvent ? topIp : null;
  const repeatedIpRecommendation = useMemo(() => {
    if (!groupedIpRows.length) {
      return null;
    }
    const candidate = groupedIpRows[0];
    if (candidate.volume < 3) {
      return null;
    }
    return {
      ip: candidate.label,
      volume: candidate.volume,
      critical: criticalCount,
      shouldEscalate: criticalCount > 0 || candidate.volume >= 10,
      recommendationType: criticalCount > 0 ? "CRITICAL_MIXED" : candidate.volume >= 10 ? "HIGH_VOLUME" : "WATCH",
      reason: criticalCount > 0
        ? (en ? "Critical incidents are already mixed into this IP activity." : "이 IP 활동에 치명 이벤트가 이미 섞여 있습니다.")
        : candidate.volume >= 10
          ? (en ? "Repeated requests crossed the auto-escalation threshold." : "반복 요청이 자동 승격 기준을 넘었습니다.")
          : (en ? "Keep monitoring the next recurrence before escalation." : "다음 재발까지 관찰 후 승격을 검토하세요.")
    };
  }, [criticalCount, en, groupedIpRows]);

  useEffect(() => {
    if (!selectedEvent) {
      setSelectedEventFingerprint("");
      return;
    }
    const fingerprint = stringOf(selectedEvent, "fingerprint");
    if (!selectedEventFingerprint || !filteredEvents.some((row) => stringOf(row, "fingerprint") === selectedEventFingerprint)) {
      setSelectedEventFingerprint(fingerprint);
    }
  }, [filteredEvents, selectedEvent, selectedEventFingerprint]);

  useEffect(() => {
    if (!selectedEvent) {
      setSelectedStatus("NEW");
      setSelectedOwner("");
      setSelectedNote("");
      return;
    }
    setSelectedStatus(stringOf(selectedEvent, "stateStatus") || "NEW");
    setSelectedOwner(stringOf(selectedEvent, "stateOwner"));
    setSelectedNote(stringOf(selectedEvent, "stateNote"));
    setOperationMessage("");
  }, [selectedEvent]);

  const trendRows = useMemo(() => {
    const buckets = [
      { key: "CRITICAL", label: "CRITICAL" },
      { key: "HIGH", label: "HIGH" },
      { key: "MEDIUM", label: "MEDIUM" },
      { key: "LOW", label: "LOW" }
    ];
    return buckets.map((bucket) => {
      const count = filteredByTimeEvents.filter((row) => stringOf(row, "severity").toUpperCase() === bucket.key).length;
      const width = filteredByTimeEvents.length ? Math.max(8, Math.round((count / filteredByTimeEvents.length) * 100)) : 0;
      return { ...bucket, count, width };
    });
  }, [filteredByTimeEvents]);

  const timelineRows = useMemo(() => {
    const bucketCount = timeRangeFilter === "10" ? 5 : timeRangeFilter === "60" ? 6 : timeRangeFilter === "1440" ? 8 : 6;
    if (!filteredByTimeEvents.length) {
      return [];
    }
    const times = filteredByTimeEvents
      .map((row) => parseDetectedAt(stringOf(row, "detectedAt")))
      .filter((value): value is number => value !== null);
    if (!times.length) {
      return [];
    }
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times, minTime + 1);
    const span = Math.max(1, maxTime - minTime);
    const bucketSize = Math.ceil(span / bucketCount);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = minTime + index * bucketSize;
      const bucketEnd = index === bucketCount - 1 ? maxTime + 1 : bucketStart + bucketSize;
      const bucketRows = filteredByTimeEvents.filter((row) => {
        const parsed = parseDetectedAt(stringOf(row, "detectedAt"));
        return parsed !== null && parsed >= bucketStart && parsed < bucketEnd;
      });
      const critical = bucketRows.filter((row) => stringOf(row, "severity").toUpperCase().includes("CRITICAL")).length;
      const high = bucketRows.filter((row) => stringOf(row, "severity").toUpperCase().includes("HIGH")).length;
      const total = bucketRows.length;
      return {
        label: buildTimeLabel(bucketStart, en),
        total,
        critical,
        high
      };
    });
    const maxTotal = Math.max(1, ...buckets.map((row) => row.total));
    return buckets.map((row) => ({
      ...row,
      width: Math.max(row.total ? 14 : 0, Math.round((row.total / maxTotal) * 100))
    }));
  }, [en, filteredByTimeEvents, timeRangeFilter]);

  const filteredBlockCandidateRows = useMemo(() => {
    if (candidateStatusFilter === "ALL") {
      return blockCandidateRows;
    }
    return blockCandidateRows.filter((row) => stringOf(row, "status").toUpperCase() === candidateStatusFilter);
  }, [blockCandidateRows, candidateStatusFilter]);
  const notificationHistoryRows = useMemo(
    () => activityRows.filter((row) => stringOf(row, "action").includes("dispatch-notification")),
    [activityRows]
  );
  const stateHistoryRows = useMemo(
    () => activityRows.filter((row) => {
      const action = stringOf(row, "action");
      return action.includes("save-state") || action.includes("block-candidate");
    }),
    [activityRows]
  );
  const filteredNotificationHistoryRows = useMemo(() => {
    const keyword = notificationSearchKeyword.trim().toLowerCase();
    return notificationHistoryRows.filter((row) => {
      if (notificationChannelFilter !== "ALL") {
      if (notificationChannelFilter === "SLACK") {
          if (!(stringOf(row, "slackStatus") && stringOf(row, "slackStatus") !== "-")) {
            return false;
          }
      }
      if (notificationChannelFilter === "MAIL") {
          if (!(stringOf(row, "mailStatus") && stringOf(row, "mailStatus") !== "-")) {
            return false;
          }
      }
      if (notificationChannelFilter === "WEBHOOK") {
          if (!(stringOf(row, "webhookStatus") && stringOf(row, "webhookStatus") !== "-")) {
            return false;
          }
      }
      if (notificationChannelFilter === "FAILED") {
          if (![stringOf(row, "slackStatus"), stringOf(row, "mailStatus"), stringOf(row, "webhookStatus"), stringOf(row, "deliveryStatus")].some((value) => value === "FAILED")) {
            return false;
          }
        }
      }
      if (!keyword) {
        return true;
      }
      return [
        stringOf(row, "target"),
        stringOf(row, "detail"),
        stringOf(row, "actorUserId"),
        stringOf(row, "deliveryDetail")
      ].join(" ").toLowerCase().includes(keyword);
    });
  }, [notificationChannelFilter, notificationHistoryRows, notificationSearchKeyword]);
  const filteredStateHistoryRows = useMemo(() => {
    const keyword = stateHistorySearchKeyword.trim().toLowerCase();
    return stateHistoryRows.filter((row) => {
      if (stateHistoryFilter !== "ALL" && !stringOf(row, "action").toUpperCase().includes(stateHistoryFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        stringOf(row, "target"),
        stringOf(row, "detail"),
        stringOf(row, "message"),
        stringOf(row, "actorUserId"),
        stringOf(row, "action")
      ].join(" ").toLowerCase().includes(keyword);
    });
  }, [stateHistoryFilter, stateHistoryRows, stateHistorySearchKeyword]);
  const totalCandidatePages = Math.max(1, Math.ceil(filteredBlockCandidateRows.length / AUX_PAGE_SIZE));
  const pagedCandidateRows = useMemo(() => {
    const startIndex = (candidatePage - 1) * AUX_PAGE_SIZE;
    return filteredBlockCandidateRows.slice(startIndex, startIndex + AUX_PAGE_SIZE);
  }, [candidatePage, filteredBlockCandidateRows]);
  const totalNotificationPages = Math.max(1, Math.ceil(filteredNotificationHistoryRows.length / AUX_PAGE_SIZE));
  const pagedNotificationRows = useMemo(() => {
    const startIndex = (notificationPage - 1) * AUX_PAGE_SIZE;
    return filteredNotificationHistoryRows.slice(startIndex, startIndex + AUX_PAGE_SIZE);
  }, [filteredNotificationHistoryRows, notificationPage]);
  const totalStateHistoryPages = Math.max(1, Math.ceil(filteredStateHistoryRows.length / AUX_PAGE_SIZE));
  const [stateHistoryPage, setStateHistoryPage] = useState(1);
  const pagedStateHistoryRows = useMemo(() => {
    const startIndex = (stateHistoryPage - 1) * AUX_PAGE_SIZE;
    return filteredStateHistoryRows.slice(startIndex, startIndex + AUX_PAGE_SIZE);
  }, [filteredStateHistoryRows, stateHistoryPage]);

  useEffect(() => {
    setCandidatePage(1);
    setCandidatePageInput("1");
  }, [candidateStatusFilter, blockCandidateRows]);

  useEffect(() => {
    setNotificationPage(1);
    setNotificationPageInput("1");
  }, [activityRows, notificationChannelFilter, notificationSearchKeyword]);

  useEffect(() => {
    setStateHistoryPage(1);
    setStateHistoryPageInput("1");
  }, [activityRows, stateHistoryFilter, stateHistorySearchKeyword]);

  const drillDownSummary = useMemo(() => {
    if (queryIp) {
      const matching = filteredEvents.filter((row) => {
        const haystack = [stringOf(row, "sourceIp"), stringOf(row, "ip"), stringOf(row, "detail")].join(" ").toLowerCase();
        return haystack.includes(queryIp.toLowerCase());
      });
      return {
        type: en ? "IP Drill-down" : "IP 상세",
        target: queryIp,
        count: matching.length,
        critical: matching.filter((row) => stringOf(row, "severity").toUpperCase().includes("CRITICAL")).length
      };
    }
    if (queryUrl) {
      const matching = filteredEvents.filter((row) => {
        const haystack = [stringOf(row, "targetUrl"), stringOf(row, "url"), stringOf(row, "detail")].join(" ").toLowerCase();
        return haystack.includes(queryUrl.toLowerCase());
      });
      return {
        type: en ? "URL Drill-down" : "URL 상세",
        target: queryUrl,
        count: matching.length,
        critical: matching.filter((row) => stringOf(row, "severity").toUpperCase().includes("CRITICAL")).length
      };
    }
    return null;
  }, [en, filteredEvents, queryIp, queryUrl]);

  const drillDownTimelineRows = useMemo(() => {
    if (!drillDownSummary) {
      return [];
    }
    const sourceRows = filteredEvents;
    if (!sourceRows.length) {
      return [];
    }
    const times = sourceRows
      .map((row) => parseDetectedAt(stringOf(row, "detectedAt")))
      .filter((value): value is number => value !== null);
    if (!times.length) {
      return [];
    }
    const bucketCount = 5;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times, minTime + 1);
    const bucketSize = Math.max(1, Math.ceil((maxTime - minTime + 1) / bucketCount));
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = minTime + index * bucketSize;
      const bucketEnd = index === bucketCount - 1 ? maxTime + 1 : bucketStart + bucketSize;
      const bucketRows = sourceRows.filter((row) => {
        const parsed = parseDetectedAt(stringOf(row, "detectedAt"));
        return parsed !== null && parsed >= bucketStart && parsed < bucketEnd;
      });
      return {
        label: buildTimeLabel(bucketStart, en),
        total: bucketRows.length
      };
    });
    const maxTotal = Math.max(1, ...buckets.map((row) => row.total));
    return buckets.map((row) => ({
      ...row,
      width: row.total ? Math.max(12, Math.round((row.total / maxTotal) * 100)) : 0
    }));
  }, [drillDownSummary, en, filteredEvents]);

  const drillDownBreakdownRows = useMemo(() => {
    if (!drillDownSummary) {
      return [];
    }
    const high = filteredEvents.filter((row) => stringOf(row, "severity").toUpperCase().includes("HIGH")).length;
    const values = [
      { key: queryIp ? "IP-PRESSURE" : "URL-PRESSURE", label: queryIp ? (en ? "IP Pressure" : "IP 압력") : (en ? "URL Pressure" : "URL 압력"), value: drillDownSummary.count, tone: "bg-blue-500" },
      { key: "CRITICAL", label: "CRITICAL", value: drillDownSummary.critical, tone: "bg-red-500" },
      { key: "HIGH", label: "HIGH", value: high, tone: "bg-amber-500" }
    ].filter((row) => row.value > 0);
    const maxValue = Math.max(1, ...values.map((row) => row.value));
    return values.map((row) => ({ ...row, width: Math.max(12, Math.round((row.value / maxValue) * 100)) }));
  }, [drillDownSummary, en, filteredEvents, queryIp]);

  const policySearchHref = useMemo(() => {
    const keyword = encodeURIComponent(firstNonBlankForMonitoring(stringOf(selectedEvent, "title"), stringOf(selectedEvent, "detail")));
    return `${buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}${keyword ? `?searchKeyword=${keyword}` : ""}`;
  }, [selectedEvent, en]);

  function exportFilteredEventsCsv() {
    const headers = ["detectedAt", "severity", "stateStatus", "stateOwner", "title", "detail"];
    const lines = [
      headers.join(","),
      ...filteredEvents.map((row) => headers.map((header) => csvCell(stringOf(row, header))).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `security-monitoring-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportFilteredEventsJson() {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `security-monitoring-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportDrillDownRowsCsv() {
    const rows = queryIp || queryUrl ? filteredEvents : [];
    const headers = ["detectedAt", "severity", "sourceIp", "targetUrl", "title", "detail"];
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => csvCell(stringOf(row, header))).join(","))
    ];
    downloadMonitoringBlob(`security-monitoring-drilldown-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportDrillDownRowsJson() {
    const rows = queryIp || queryUrl ? filteredEvents : [];
    downloadMonitoringBlob(`security-monitoring-drilldown-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(rows, null, 2), "application/json;charset=utf-8");
  }

  async function handleSaveState() {
    if (!selectedEvent) {
      return;
    }
    setSubmittingState(true);
    try {
      const response = await saveSecurityMonitoringState({
        fingerprint: stringOf(selectedEvent, "fingerprint"),
        status: selectedStatus,
        owner: selectedOwner,
        note: selectedNote,
        severity: stringOf(selectedEvent, "severity"),
        title: stringOf(selectedEvent, "title"),
        detail: stringOf(selectedEvent, "detail"),
        detectedAt: stringOf(selectedEvent, "detectedAt")
      });
      setOperationMessage(String(response.message || (en ? "Monitoring state saved." : "모니터링 상태를 저장했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingState(false);
    }
  }

  async function handleRegisterBlockCandidate() {
    if (!activeEscalationTarget || !selectedEvent) {
      return;
    }
    await handleRegisterNamedCandidate(stringOf(activeEscalationTarget, "ip"), "IP", `${stringOf(selectedEvent, "severity")} · ${stringOf(selectedEvent, "title")}`);
  }

  async function handleRegisterNamedCandidate(target: string, blockType: "IP" | "URL", reason: string) {
    if (!target || !selectedEvent) {
      return;
    }
    setRegisteringBlockCandidate(true);
    try {
      const response = await registerSecurityMonitoringBlockCandidate({
        target,
        blockType,
        sourceTitle: stringOf(selectedEvent, "title"),
        fingerprint: stringOf(selectedEvent, "fingerprint"),
        severity: stringOf(selectedEvent, "severity"),
        reason,
        expiresAt: ""
      });
      setOperationMessage(String(response.message || (en ? "Block candidate registered." : "차단 후보를 등록했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRegisteringBlockCandidate(false);
    }
  }

  async function handleRegisterDrillDownCandidate() {
    if (!drillDownSummary || !selectedEvent) {
      return;
    }
    setRegisteringBlockCandidate(true);
    try {
      const response = await registerSecurityMonitoringBlockCandidate({
        target: drillDownSummary.target,
        blockType: queryIp ? "IP" : "URL",
        sourceTitle: stringOf(selectedEvent, "title"),
        fingerprint: stringOf(selectedEvent, "fingerprint"),
        severity: stringOf(selectedEvent, "severity"),
        reason: `${drillDownSummary.type} · ${stringOf(selectedEvent, "severity")} · ${stringOf(selectedEvent, "title")}`,
        expiresAt: ""
      });
      setOperationMessage(String(response.message || (en ? "Block candidate registered." : "차단 후보를 등록했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRegisteringBlockCandidate(false);
    }
  }

  async function handleDispatchNotification() {
    if (!selectedEvent) {
      return;
    }
    setDispatchingNotification(true);
    try {
      const response = await dispatchSecurityMonitoringNotification({
        title: stringOf(selectedEvent, "title"),
        detail: stringOf(selectedEvent, "detail"),
        severity: stringOf(selectedEvent, "severity"),
        target: stringOf(topTarget, "url"),
        sourceIp: stringOf(topIp, "ip"),
        fingerprint: stringOf(selectedEvent, "fingerprint")
      });
      setOperationMessage(String(response.message || (en ? "Monitoring notification dispatched." : "모니터링 알림을 발송했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setDispatchingNotification(false);
    }
  }

  async function handleRetryNotification(row: Record<string, string>) {
    setDispatchingNotification(true);
    try {
      const detail = stringOf(row, "detail");
      const severity = detail.toUpperCase().includes("CRITICAL")
        ? "CRITICAL"
        : detail.toUpperCase().includes("HIGH")
          ? "HIGH"
          : stringOf(selectedEvent, "severity") || "HIGH";
      const response = await dispatchSecurityMonitoringNotification({
        title: firstNonBlankForMonitoring(stringOf(row, "target"), en ? "Monitoring alert retry" : "모니터링 알림 재발송"),
        detail,
        severity,
        target: stringOf(row, "target"),
        sourceIp: queryIp || stringOf(topIp, "ip"),
        fingerprint: stringOf(selectedEvent, "fingerprint")
      });
      setLastNotificationRetryKey(`${stringOf(row, "happenedAt")}-${stringOf(row, "target")}`);
      setLastNotificationRetryStatus(String(response.deliveryStatus || "DELIVERED"));
      setOperationMessage(String(response.message || (en ? "Monitoring notification re-dispatched." : "모니터링 알림을 다시 발송했습니다.")));
      await pageState.reload();
    } catch (error) {
      setLastNotificationRetryKey(`${stringOf(row, "happenedAt")}-${stringOf(row, "target")}`);
      setLastNotificationRetryStatus("FAILED");
      setOperationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setDispatchingNotification(false);
    }
  }

  function exportNotificationHistoryCsv() {
    const headers = ["happenedAt", "target", "detail", "slackStatus", "mailStatus", "webhookStatus", "deliveryStatus", "actorUserId"];
    const lines = [
      headers.join(","),
      ...filteredNotificationHistoryRows.map((row) => headers.map((header) => csvCell(stringOf(row, header))).join(","))
    ];
    downloadMonitoringBlob(
      `security-monitoring-notifications-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function exportNotificationHistoryJson() {
    downloadMonitoringBlob(
      `security-monitoring-notifications-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      JSON.stringify(filteredNotificationHistoryRows, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function exportStateHistoryCsv() {
    const headers = ["happenedAt", "target", "detail", "action", "actorUserId"];
    const lines = [
      headers.join(","),
      ...filteredStateHistoryRows.map((row) => headers.map((header) => csvCell(stringOf(row, header))).join(","))
    ];
    downloadMonitoringBlob(
      `security-monitoring-state-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function exportStateHistoryJson() {
    downloadMonitoringBlob(
      `security-monitoring-state-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      JSON.stringify(filteredStateHistoryRows, null, 2),
      "application/json;charset=utf-8"
    );
  }

  async function handleCandidateState(blockId: string, status: "ACTIVE" | "REJECTED") {
    try {
      const response = await updateSecurityMonitoringBlockCandidate({ blockId, status });
      setOperationMessage(String(response.message || (en ? "Block candidate updated." : "차단 후보 상태를 변경했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "security-monitoring", {
      route: window.location.pathname,
      cardCount: cards.length,
      targetCount: targets.length,
      ipCount: ips.length,
      eventCount: events.length
    });
    logGovernanceScope("COMPONENT", "security-monitoring-events", {
      component: "security-monitoring-events",
      targetCount: targets.length,
      ipCount: ips.length,
      eventCount: events.length
    });
    logGovernanceScope("COMPONENT", "security-monitoring-targets", {
      component: "security-monitoring-targets",
      targetCount: targets.length,
      ipCount: ips.length
    });
  }, [cards.length, events.length, ips.length, page, targets.length]);
  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Security Monitoring" : "보안 모니터링" }
      ]}
      title={en ? "Real-time Attack Monitoring" : "실시간 공격 현황"}
      subtitle={en ? "Review blocked rules, target URLs, top IPs, and incidents on one screen." : "차단 룰, 공격 대상 URL, 상위 IP, 인시던트 이벤트를 한 화면에서 확인합니다."}
    >
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      {operationMessage ? <PageStatusNotice tone={operationMessage.toLowerCase().includes("fail") || operationMessage.includes("오류") ? "error" : "success"}>{operationMessage}</PageStatusNotice> : null}
      <AdminWorkspacePageFrame>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard title={en ? "Open Incidents" : "오픈 인시던트"} value={events.length} description={en ? "Current incident queue" : "현재 이벤트 큐"} />
        <SummaryMetricCard title={en ? "Critical" : "치명"} value={criticalCount} description={en ? "Critical severity events" : "치명 등급 이벤트"} />
        <SummaryMetricCard title={en ? "High" : "높음"} value={highCount} description={en ? "High severity events" : "높음 등급 이벤트"} />
        <SummaryMetricCard title={en ? "Blocked Targets" : "차단 대상"} value={blockedTargetCount} description={en ? "Targets already blocked" : "이미 차단된 대상"} />
      </section>
      <CollectionResultPanel description={en ? "Review hot targets, promote repeated IPs, dispatch alerts, and hand off to policy or blocklist follow-up from the same workspace." : "상위 공격 대상 검토, 반복 IP 승격, 즉시 알림 발송, 정책/차단목록 후속 작업을 같은 작업 공간에서 이어갑니다."} title={en ? "Monitoring operation workflow" : "모니터링 운영 흐름"}>
        {en ? "Keep summary, candidate promotion, notification retry, and state history together so incident handling stays consistent across operators." : "요약, 후보 승격, 알림 재시도, 상태 이력을 한 화면에 두어 운영자 간 대응 흐름을 동일하게 유지합니다."}
      </CollectionResultPanel>
      <section className="gov-card mb-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr_0.8fr] gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringSearch">
              {en ? "Search Incidents" : "이벤트 검색"}
            </label>
            <input
              id="securityMonitoringSearch"
              className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              placeholder={en ? "URL, IP, rule, detail" : "URL, IP, 룰, 상세"}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringOwnerSearch">
              {en ? "Owner Search" : "담당자 검색"}
            </label>
            <input
              id="securityMonitoringOwnerSearch"
              className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              placeholder={en ? "Owner" : "담당자"}
              value={ownerKeyword}
              onChange={(event) => setOwnerKeyword(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringSort">
              {en ? "Sort" : "정렬"}
            </label>
            <select
              id="securityMonitoringSort"
              className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              <option value="LATEST">{en ? "Latest" : "최신순"}</option>
              <option value="SEVERITY">{en ? "Severity" : "심각도순"}</option>
              <option value="TITLE">{en ? "Title" : "제목순"}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringNoteSearch">
              {en ? "Operator Note Search" : "운영 메모 검색"}
            </label>
            <input
              id="securityMonitoringNoteSearch"
              className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              placeholder={en ? "Operator note" : "운영 메모"}
              value={noteKeyword}
              onChange={(event) => setNoteKeyword(event.target.value)}
            />
          </div>
          <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Escalation" : "차단 승격"}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
              {activeEscalationTarget
                ? `${en ? "Target IP" : "대상 IP"} ${stringOf(activeEscalationTarget, "ip")}`
                : en ? "Select an incident first." : "먼저 이벤트를 선택하세요."}
            </p>
            <button
              type="button"
              className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
              disabled={!activeEscalationTarget || registeringBlockCandidate}
              onClick={() => {
                void handleRegisterBlockCandidate();
              }}
            >
              {registeringBlockCandidate ? (en ? "Registering..." : "등록 중...") : en ? "Register Block Candidate" : "차단 후보 등록"}
            </button>
          </div>
        </div>
        {operationMessage ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{operationMessage}</div>
        ) : null}
      </section>
      {drillDownSummary ? (
        <section className="gov-card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--kr-gov-blue)]">{drillDownSummary.type}</p>
              <h3 className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)] break-all">{drillDownSummary.target}</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                <p className="text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Matched Events" : "매칭 이벤트"}</p>
                <p className="mt-2 text-xl font-black">{drillDownSummary.count}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[11px] font-bold text-red-700">CRITICAL</p>
                <p className="mt-2 text-xl font-black text-red-800">{drillDownSummary.critical}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700 disabled:opacity-50"
                disabled={registeringBlockCandidate || !selectedEvent}
                onClick={() => { void handleRegisterDrillDownCandidate(); }}
              >
                {registeringBlockCandidate ? (en ? "Registering..." : "등록 중...") : (en ? "Register Drill-down Candidate" : "현재 drill-down 차단 후보 등록")}
              </button>
            </div>
          </div>
          {drillDownTimelineRows.length ? (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
              {drillDownTimelineRows.map((row) => (
                <div key={row.label} className="rounded-lg border border-[var(--kr-gov-border-light)] px-3 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold">{row.label}</span>
                    <span className="text-[var(--kr-gov-text-secondary)]">{row.total}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-red-500" style={{ width: `${row.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {drillDownBreakdownRows.length ? (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {drillDownBreakdownRows.map((row) => (
                <div key={row.key} className="rounded-lg border border-[var(--kr-gov-border-light)] px-3 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold">{row.label}</span>
                    <span className="text-[var(--kr-gov-text-secondary)]">{row.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${row.tone}`} style={{ width: `${row.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)]"
              onClick={exportDrillDownRowsCsv}
            >
              {en ? "Drill-down CSV" : "상세 CSV"}
            </button>
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)]"
              onClick={exportDrillDownRowsJson}
            >
              {en ? "Drill-down JSON" : "상세 JSON"}
            </button>
          </div>
          <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
            {queryIp
              ? (en ? "This drill-down is pinned to the attacker IP and can be escalated without returning to the list." : "이 drill-down은 공격 IP에 고정돼 있어 목록으로 돌아가지 않고 바로 승격할 수 있습니다.")
              : (en ? "This drill-down is pinned to the target URL and can be escalated directly as a focused candidate." : "이 drill-down은 대상 URL에 고정돼 있어 집중 차단 후보로 바로 승격할 수 있습니다.")}
          </p>
        </section>
      ) : null}
      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <article className="gov-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[var(--kr-gov-blue)]">{en ? "LIVE MONITORING" : "실시간 모니터링"}</p>
              <h3 className="mt-2 text-lg font-bold">{en ? "Attack Surface Overview" : "공격 면 개요"}</h3>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Check high-severity detections, blocked targets, and top attacker IPs before reviewing individual incidents."
                  : "고심각도 탐지, 차단 대상, 상위 공격 IP를 먼저 확인한 뒤 개별 인시던트를 검토합니다."}
              </p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">{en ? "Open Incidents" : "오픈 인시던트"}</p>
              <p className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{events.length}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-700">{en ? "Critical" : "치명"}</p>
              <p className="mt-2 text-2xl font-black text-red-800">{criticalCount}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-700">{en ? "High" : "높음"}</p>
              <p className="mt-2 text-2xl font-black text-amber-800">{highCount}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold text-blue-700">{en ? "Blocked Targets" : "차단 대상"}</p>
              <p className="mt-2 text-2xl font-black text-blue-800">{blockedTargetCount}</p>
            </div>
          </div>
        </article>
        <article className="gov-card" data-help-id="security-monitoring-ops">
          <h3 className="text-lg font-bold">{en ? "Operator Checklist" : "운영 체크리스트"}</h3>
          <div className="mt-4 space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
            <p>{en ? "1. Confirm whether the top target URL belongs to a public page or an authenticated admin path." : "1. 최다 공격 URL이 공개 페이지인지 관리자 경로인지 먼저 확인합니다."}</p>
            <p>{en ? "2. Review whether the same attacker IP keeps triggering multiple rules in a short period." : "2. 동일 공격 IP가 짧은 시간에 여러 룰을 연속 트리거하는지 확인합니다."}</p>
            <p>{en ? "3. Escalate to blocklist or security policy tuning only after verifying repeated or critical incidents." : "3. 반복 또는 치명 이벤트가 확인된 뒤에만 차단목록이나 정책 조정으로 승격합니다."}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Top Target" : "최다 공격 대상"}</p>
              <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{topTarget ? stringOf(topTarget, "url") : "-"}</p>
            </div>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Top Attacker IP" : "최다 공격 IP"}</p>
              <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{topIp ? stringOf(topIp, "ip") : "-"}</p>
            </div>
          <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Related Actions" : "연계 작업"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                  className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                  href={buildLocalizedPath("/admin/system/blocklist", "/en/admin/system/blocklist")}
                >
                  {en ? "Open Blocklist" : "차단목록 이동"}
                </a>
                <a
                  className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                  href={buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}
                >
                  {en ? "Open Policy Console" : "정책 콘솔 이동"}
                </a>
                <a
                  className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                  href={buildLocalizedPath("/admin/monitoring/sensor_list", "/en/admin/monitoring/sensor_list")}
                >
                  {en ? "Open Sensor List" : "센서 목록 이동"}
                </a>
                <button
                  type="button"
                  className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                  onClick={exportFilteredEventsCsv}
                >
                  {en ? "Export CSV" : "CSV 다운로드"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                  onClick={exportFilteredEventsJson}
                >
                  {en ? "Export JSON" : "JSON 다운로드"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                  disabled={!selectedEvent || dispatchingNotification}
                  onClick={() => {
                    void handleDispatchNotification();
                  }}
                >
                  {dispatchingNotification ? (en ? "Dispatching..." : "발송 중...") : en ? "Dispatch Critical Alert" : "즉시 알림 발송"}
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6" data-help-id="security-monitoring-summary">
        {cards.map((card, idx) => <article className="gov-card" key={idx}><p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{card.title}</p><p className="mt-3 text-2xl font-black">{card.value}</p><p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{card.description}</p></article>)}
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-6" data-help-id="security-monitoring-targets">
        <article className="gov-card"><h3 className="text-lg font-bold mb-4">{en ? "Top Target URLs" : "상위 공격 대상 URL"}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="gov-table-header"><th className="px-4 py-3">URL</th><th className="px-4 py-3">RPS</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th><th className="px-4 py-3">{en ? "Applied Rule" : "적용 룰"}</th><th className="px-4 py-3">{en ? "Action" : "액션"}</th></tr></thead><tbody className="divide-y divide-gray-100">{targets.map((row, idx) => <tr key={idx}><td className="px-4 py-3 font-mono">{stringOf(row, "url")}</td><td className="px-4 py-3">{stringOf(row, "rps")}</td><td className="px-4 py-3">{stringOf(row, "status")}</td><td className="px-4 py-3">{stringOf(row, "rule")}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><a className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={`${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?url=${encodeURIComponent(stringOf(row, "url"))}`}>{en ? "Drill-down" : "상세"}</a><a className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={`${buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}?searchKeyword=${encodeURIComponent(firstNonBlankForMonitoring(stringOf(row, "url"), stringOf(row, "rule")))}`}>{en ? "Policy" : "정책"}</a>{selectedEvent ? <button type="button" className="text-xs font-bold text-red-700 hover:underline disabled:opacity-50" disabled={registeringBlockCandidate} onClick={() => { void handleRegisterNamedCandidate(stringOf(row, "url"), "URL", `${stringOf(row, "rule")} · ${stringOf(selectedEvent, "severity")} · ${stringOf(selectedEvent, "title")}`); }}>{en ? "Promote" : "후보 등록"}</button> : null}</div></td></tr>)}</tbody></table></div></article>
        <article className="gov-card"><h3 className="text-lg font-bold mb-4">{en ? "Top Attack IPs" : "상위 공격 IP"}</h3><div className="space-y-3">{ips.map((row, idx) => <div className="rounded-lg border border-[var(--kr-gov-border-light)] p-4" key={idx}><div className="flex items-center justify-between gap-3"><strong className="font-mono">{stringOf(row, "ip")}</strong><span className="text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(row, "action")}</span></div><p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "country")} · {en ? "Requests" : "요청"} {stringOf(row, "requestCount")}</p><div className="mt-3 flex flex-wrap gap-2"><a className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={`${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?ip=${encodeURIComponent(stringOf(row, "ip"))}`}>{en ? "Drill-down" : "상세"}</a><a className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={`${buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}?searchKeyword=${encodeURIComponent(firstNonBlankForMonitoring(stringOf(row, "ip"), stringOf(row, "action")))}`}>{en ? "Policy" : "정책"}</a>{selectedEvent ? <button type="button" className="text-xs font-bold text-red-700 hover:underline disabled:opacity-50" disabled={registeringBlockCandidate} onClick={() => { void handleRegisterNamedCandidate(stringOf(row, "ip"), "IP", `${stringOf(row, "action")} · ${stringOf(selectedEvent, "severity")} · ${stringOf(selectedEvent, "title")}`); }}>{en ? "Promote" : "후보 등록"}</button> : null}</div></div>)}</div></article>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 mb-6">
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Repeated IP Recommendation" : "반복 IP 자동 추천"}</h3>
          {repeatedIpRecommendation ? (
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="font-mono">{repeatedIpRecommendation.ip}</strong>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${repeatedIpRecommendation.shouldEscalate ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {repeatedIpRecommendation.shouldEscalate ? (en ? "Escalate" : "승격 권장") : (en ? "Watch" : "관찰")}
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? `Requests ${repeatedIpRecommendation.volume}, critical incidents ${repeatedIpRecommendation.critical}.`
                  : `요청 ${repeatedIpRecommendation.volume}건, 치명 이벤트 ${repeatedIpRecommendation.critical}건 기준으로 자동 추천했습니다.`}
              </p>
              <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{repeatedIpRecommendation.reason}</p>
              <p className="mt-2 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                {repeatedIpRecommendation.recommendationType === "CRITICAL_MIXED"
                  ? (en ? "Reason: critical incidents are mixed into the same IP flow." : "사유: 동일 IP 흐름에 치명 이벤트가 함께 존재합니다.")
                  : repeatedIpRecommendation.recommendationType === "HIGH_VOLUME"
                    ? (en ? "Reason: repeated request volume crossed the auto-escalation baseline." : "사유: 반복 요청량이 자동 승격 기준을 넘었습니다.")
                    : (en ? "Reason: continue watching the next recurrence before escalation." : "사유: 다음 재발까지 관찰 후 승격을 검토합니다.")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className={`rounded-lg border px-3 py-3 ${repeatedIpRecommendation.recommendationType === "CRITICAL_MIXED" ? "border-red-200 bg-red-50" : "border-[var(--kr-gov-border-light)]"}`}>
                  <p className="text-[11px] font-bold">CRITICAL_MIXED</p>
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Critical incidents mixed into the same IP sequence." : "동일 IP 흐름에 치명 이벤트가 섞여 있음."}</p>
                </div>
                <div className={`rounded-lg border px-3 py-3 ${repeatedIpRecommendation.recommendationType === "HIGH_VOLUME" ? "border-amber-200 bg-amber-50" : "border-[var(--kr-gov-border-light)]"}`}>
                  <p className="text-[11px] font-bold">HIGH_VOLUME</p>
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Request volume crossed the escalation threshold." : "요청량이 자동 승격 기준을 넘음."}</p>
                </div>
                <div className={`rounded-lg border px-3 py-3 ${repeatedIpRecommendation.recommendationType === "WATCH" ? "border-blue-200 bg-blue-50" : "border-[var(--kr-gov-border-light)]"}`}>
                  <p className="text-[11px] font-bold">WATCH</p>
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Monitor recurrence before escalating." : "재발 여부를 더 보고 승격 판단."}</p>
                </div>
              </div>
              {repeatedIpRecommendation.shouldEscalate ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                    disabled={registeringBlockCandidate || !selectedEvent}
                    onClick={() => { void handleRegisterBlockCandidate(); }}
                  >
                    {registeringBlockCandidate ? (en ? "Registering..." : "등록 중...") : (en ? "Register Recommended Candidate" : "추천 후보 바로 등록")}
                  </button>
                  <a
                    className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                    href={`${buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}?searchKeyword=${encodeURIComponent(repeatedIpRecommendation.ip)}`}
                  >
                    {en ? "Open Policy Console" : "정책 콘솔 이동"}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No repeated IP needs escalation right now." : "현재 즉시 승격할 반복 IP가 없습니다."}
            </div>
          )}
        </article>
        <article className="gov-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">{en ? "Notification Dispatch History" : "알림 발송 이력"}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <MemberPagination className="hidden" currentPage={1} onPageChange={() => {}} totalPages={1} />
              <button type="button" className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" onClick={exportNotificationHistoryCsv}>
                {en ? "CSV" : "CSV"}
              </button>
              <button type="button" className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" onClick={exportNotificationHistoryJson}>
                JSON
              </button>
              <select
                className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                value={notificationChannelFilter}
                onChange={(event) => setNotificationChannelFilter(event.target.value)}
              >
                <option value="ALL">{en ? "All Channels" : "전체 채널"}</option>
                <option value="SLACK">SLACK</option>
                <option value="MAIL">MAIL</option>
                <option value="WEBHOOK">WEBHOOK</option>
                <option value="FAILED">{en ? "Failed Only" : "실패만"}</option>
              </select>
            </div>
          </div>
          <input
            className="mb-4 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
            placeholder={en ? "Search target, detail, actor, delivery result" : "대상, 상세, 작업자, 발송 결과 검색"}
            value={notificationSearchKeyword}
            onChange={(event) => setNotificationSearchKeyword(event.target.value)}
          />
          <p className="mb-4 text-xs text-[var(--kr-gov-text-secondary)]">
            {en ? "Filter by channel or failed delivery to retry only the operationally relevant alerts." : "채널별 또는 실패 건만 골라서 운영상 다시 확인할 알림만 검토합니다."}
          </p>
          <div className="space-y-3">
            {pagedNotificationRows.length ? pagedNotificationRows.map((row, idx) => (
              <div key={`${stringOf(row, "happenedAt")}-${idx}`} className="rounded-lg border border-[var(--kr-gov-border-light)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{stringOf(row, "target") || (en ? "Monitoring alert" : "모니터링 알림")}</strong>
                  <span className="text-xs text-gray-400">{stringOf(row, "happenedAt")}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detail")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">{stringOf(row, "actorUserId")}</span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                    {`SLACK ${stringOf(row, "slackStatus") || "-"}`}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                    {`MAIL ${stringOf(row, "mailStatus") || "-"}`}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                    {`WEBHOOK ${stringOf(row, "webhookStatus") || stringOf(row, "deliveryStatus") || "-"}`}
                  </span>
                  {[stringOf(row, "slackStatus"), stringOf(row, "mailStatus"), stringOf(row, "webhookStatus"), stringOf(row, "deliveryStatus")].some((value) => value === "FAILED") ? (
                    <button
                      type="button"
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 disabled:opacity-50"
                      disabled={dispatchingNotification}
                      onClick={() => { void handleRetryNotification(row); }}
                    >
                      {dispatchingNotification ? (en ? "Retrying..." : "재시도 중...") : (en ? "Retry" : "재시도")}
                    </button>
                  ) : null}
                  {lastNotificationRetryKey === `${stringOf(row, "happenedAt")}-${stringOf(row, "target")}` ? (
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${lastNotificationRetryStatus === "FAILED" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {lastNotificationRetryStatus === "FAILED" ? (en ? "Retry Failed" : "재시도 실패") : (en ? "Retry Delivered" : "재시도 완료")}
                    </span>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No notification dispatch has been recorded yet." : "기록된 알림 발송 이력이 없습니다."}
              </div>
            )}
          </div>
          <MemberPagination className="mt-4 px-0 py-0 border-t-0 bg-transparent" currentPage={notificationPage} onPageChange={setNotificationPage} totalPages={totalNotificationPages} />
          <div className="mt-3 flex items-center justify-end gap-2 text-xs">
            <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
            <input
              className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
              value={notificationPageInput}
              onChange={(event) => setNotificationPageInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
              onClick={() => setNotificationPage(clampPageInput(notificationPageInput, totalNotificationPages))}
            >
              {en ? "Move" : "이동"}
            </button>
          </div>
        </article>
      </section>
      <section className="gov-card mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold">{en ? "State Change History" : "상태 변경 이력"}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">
              {en ? "Recent operations" : "최근 작업"} {filteredStateHistoryRows.length}
            </span>
            <button type="button" className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" onClick={exportStateHistoryCsv}>
              {en ? "CSV" : "CSV"}
            </button>
            <button type="button" className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" onClick={exportStateHistoryJson}>
              JSON
            </button>
            <select
              className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              value={stateHistoryFilter}
              onChange={(event) => setStateHistoryFilter(event.target.value)}
            >
              <option value="ALL">{en ? "All Actions" : "전체 작업"}</option>
              <option value="SAVE-STATE">{en ? "State Save" : "상태 저장"}</option>
              <option value="BLOCK-CANDIDATE">{en ? "Block Candidate" : "차단 후보"}</option>
            </select>
          </div>
        </div>
        <input
          className="mb-4 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
          placeholder={en ? "Search target, detail, actor, action" : "대상, 상세, 작업자, 작업 검색"}
          value={stateHistorySearchKeyword}
          onChange={(event) => setStateHistorySearchKeyword(event.target.value)}
        />
        <p className="mb-4 text-xs text-[var(--kr-gov-text-secondary)]">
          {en ? "Use this feed to separate normal state saves from actual escalation or block-candidate changes." : "이 피드로 단순 상태 저장과 실제 승격/차단 후보 변경을 구분해서 볼 수 있습니다."}
        </p>
        <div className="space-y-3">
          {pagedStateHistoryRows.length ? pagedStateHistoryRows.map((row, idx) => (
            <div key={`${stringOf(row, "happenedAt")}-${idx}`} className="rounded-lg border border-[var(--kr-gov-border-light)] p-4">
              <div className="flex items-center justify-between gap-3">
                <strong>{stringOf(row, "target") || stringOf(row, "title") || "-"}</strong>
                <span className="text-xs text-gray-400">{stringOf(row, "happenedAt") || "-"}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detail") || stringOf(row, "message") || "-"}</p>
              <p className="mt-2 text-xs text-gray-400">{stringOf(row, "actorUserId") || "-"} · {stringOf(row, "action") || "-"}</p>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No state changes have been recorded yet." : "기록된 상태 변경 이력이 없습니다."}
            </div>
          )}
        </div>
        <MemberPagination className="mt-4 px-0 py-0 border-t-0 bg-transparent" currentPage={stateHistoryPage} onPageChange={setStateHistoryPage} totalPages={totalStateHistoryPages} />
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
          <input
            className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
            value={stateHistoryPageInput}
            onChange={(event) => setStateHistoryPageInput(event.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            type="button"
            className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
            onClick={() => setStateHistoryPage(clampPageInput(stateHistoryPageInput, totalStateHistoryPages))}
          >
            {en ? "Move" : "이동"}
          </button>
        </div>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Grouped by Attacker IP" : "공격 IP 묶음"}</h3>
          <div className="space-y-3">
            {groupedIpRows.map((row) => (
              <div key={row.key} className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-mono">{row.label}</strong>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--kr-gov-blue)]">{row.action}</span>
                    <a className="text-[10px] font-bold text-[var(--kr-gov-blue)] underline" href={`${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?ip=${encodeURIComponent(row.label)}`}>
                      {en ? "Drill-down" : "상세"}
                    </a>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Requests" : "요청"} {row.volume}
                </p>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.max(12, Math.round((row.volume / maxIpVolume) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Grouped by Target URL" : "대상 URL 묶음"}</h3>
          <div className="space-y-3">
            {groupedTargetRows.map((row) => (
              <div key={row.key} className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-mono break-all">{row.label}</strong>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--kr-gov-blue)]">{row.action}</span>
                    <a className="text-[10px] font-bold text-[var(--kr-gov-blue)] underline" href={`${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?url=${encodeURIComponent(row.label)}`}>
                      {en ? "Drill-down" : "상세"}
                    </a>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">RPS {row.volume}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.max(12, Math.round((row.volume / maxTargetVolume) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6 mb-6">
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Detection Trend Snapshot" : "탐지 추이 스냅샷"}</h3>
          <div className="space-y-4">
            {trendRows.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{row.label}</span>
                  <span className="text-[var(--kr-gov-text-secondary)]">{row.count}</span>
                </div>
                <div className="mt-2 h-3 rounded-full bg-slate-100">
                  <div
                    className={`h-3 rounded-full ${row.key === "CRITICAL" ? "bg-red-500" : row.key === "HIGH" ? "bg-amber-500" : row.key === "MEDIUM" ? "bg-blue-500" : "bg-slate-400"}`}
                    style={{ width: `${row.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Time-line View" : "시간축 추이"}</h3>
          <div className="space-y-3">
            {timelineRows.length ? timelineRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{row.label}</span>
                  <span className="text-[var(--kr-gov-text-secondary)]">
                    {en ? "Total" : "전체"} {row.total} · CRITICAL {row.critical} · HIGH {row.high}
                  </span>
                </div>
                <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-blue-500" style={{ width: `${row.width}%` }} />
                  <div className="bg-amber-500" style={{ width: `${row.total ? Math.max(4, Math.round((row.high / row.total) * row.width)) : 0}%` }} />
                  <div className="bg-red-500" style={{ width: `${row.total ? Math.max(4, Math.round((row.critical / row.total) * row.width)) : 0}%` }} />
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No timeline data is available for the selected range." : "선택한 기간에 대한 시간축 데이터가 없습니다."}
              </div>
            )}
          </div>
        </article>
        <article className="gov-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold">{en ? "Block Candidate Queue" : "차단 후보 큐"}</h3>
            <select
              className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
              value={candidateStatusFilter}
              onChange={(event) => setCandidateStatusFilter(event.target.value)}
            >
              <option value="ALL">{en ? "All" : "전체"}</option>
              <option value="REVIEW">REVIEW</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div className="space-y-3">
            {pagedCandidateRows.length ? pagedCandidateRows.map((row, idx) => (
              <div key={`${stringOf(row, "blockId")}-${idx}`} className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-mono">{stringOf(row, "target")}</strong>
                  <span className="text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(row, "status") || "REVIEW"}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "reason")}</p>
                <p className="mt-2 text-xs text-gray-400">{stringOf(row, "registeredAt")}</p>
                {String(stringOf(row, "status") || "REVIEW").toUpperCase() === "REVIEW" ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                      onClick={() => {
                        void handleCandidateState(stringOf(row, "blockId"), "ACTIVE");
                      }}
                    >
                      {en ? "Approve" : "승인"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
                      onClick={() => {
                        void handleCandidateState(stringOf(row, "blockId"), "REJECTED");
                      }}
                    >
                      {en ? "Reject" : "반려"}
                    </button>
                  </div>
                ) : null}
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No block candidates have been registered yet." : "등록된 차단 후보가 없습니다."}
              </div>
            )}
          </div>
          <MemberPagination className="mt-4 px-0 py-0 border-t-0 bg-transparent" currentPage={candidatePage} onPageChange={setCandidatePage} totalPages={totalCandidatePages} />
          <div className="mt-3 flex items-center justify-end gap-2 text-xs">
            <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
            <input
              className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
              value={candidatePageInput}
              onChange={(event) => setCandidatePageInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
              onClick={() => setCandidatePage(clampPageInput(candidatePageInput, totalCandidatePages))}
            >
              {en ? "Move" : "이동"}
            </button>
          </div>
        </article>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6" data-help-id="security-monitoring-events">
        <article className="gov-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold">{en ? "Recent Detection Events" : "최근 탐지 이벤트"}</h3>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Filter by severity and select one incident to inspect its details." : "심각도별로 필터링하고 한 건을 선택해 상세 내용을 검토합니다."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringSeverity">
                {en ? "Severity" : "심각도"}
              </label>
              <select
                id="securityMonitoringSeverity"
                className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
              <label className="ml-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringTimeRange">
                {en ? "Range" : "기간"}
              </label>
              <select
                id="securityMonitoringTimeRange"
                className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                value={timeRangeFilter}
                onChange={(event) => setTimeRangeFilter(event.target.value)}
              >
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="10">10m</option>
                <option value="60">1h</option>
                <option value="1440">24h</option>
              </select>
              <label className="ml-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringRefresh">
                {en ? "Refresh" : "새로고침"}
              </label>
              <select
                id="securityMonitoringRefresh"
                className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                value={refreshInterval}
                onChange={(event) => setRefreshInterval(event.target.value)}
              >
                <option value="OFF">{en ? "Off" : "끄기"}</option>
                <option value="10000">10s</option>
                <option value="30000">30s</option>
                <option value="60000">1m</option>
              </select>
              <label className="ml-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringEventState">
                {en ? "State" : "상태"}
              </label>
              <select
                id="securityMonitoringEventState"
                className="h-10 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                value={eventStateFilter}
                onChange={(event) => setEventStateFilter(event.target.value)}
              >
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="NEW">NEW</option>
                <option value="ACK">ACK</option>
                <option value="ESCALATED">ESCALATED</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--kr-gov-text-secondary)]">
            <span>
              {en ? "Filtered incidents" : "필터 결과"} {filteredEvents.length}
            </span>
            <span>
              {en ? "Page" : "페이지"} {eventPage} / {totalEventPages}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {pagedEvents.map((row, idx) => {
              const active = selectedEvent === row;
              return (
                <button
                  key={`${stringOf(row, "title")}-${idx}`}
                  type="button"
                  onClick={() => setSelectedEventFingerprint(stringOf(row, "fingerprint"))}
                  className={`w-full rounded-lg border px-4 py-4 text-left transition ${active ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-[var(--kr-gov-border-light)] bg-white hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>{stringOf(row, "title")}</strong>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-[var(--kr-gov-border-light)] px-2 py-1 text-[10px] font-bold text-[var(--kr-gov-text-secondary)]">
                        {stringOf(row, "stateStatus") || "NEW"}
                      </span>
                      <span className={`text-xs font-bold ${stringOf(row, "severity").toUpperCase().includes("CRITICAL") ? "text-red-700" : "text-amber-700"}`}>
                        {stringOf(row, "severity")}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detail")}</p>
                  <p className="mt-2 text-xs text-gray-400">{stringOf(row, "detectedAt")}</p>
                </button>
              );
            })}
            {!pagedEvents.length ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No incidents match the selected severity." : "선택한 심각도에 해당하는 이벤트가 없습니다."}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold disabled:opacity-50"
              disabled={eventPage <= 1}
              onClick={() => setEventPage((prev) => Math.max(1, prev - 1))}
            >
              {en ? "Prev" : "이전"}
            </button>
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold disabled:opacity-50"
              disabled={eventPage >= totalEventPages}
              onClick={() => setEventPage((prev) => Math.min(totalEventPages, prev + 1))}
            >
              {en ? "Next" : "다음"}
            </button>
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold">{en ? "Selected Incident Detail" : "선택 이벤트 상세"}</h3>
          {selectedEvent ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{stringOf(selectedEvent, "title")}</strong>
                  <span className="text-xs font-bold text-red-700">{stringOf(selectedEvent, "severity")}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(selectedEvent, "detail")}</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Detected At" : "탐지 시각"}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{stringOf(selectedEvent, "detectedAt")}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Recommended Action" : "권장 조치"}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">
                    {stringOf(selectedEvent, "severity").toUpperCase().includes("CRITICAL")
                    ? (en ? "Escalate to blocklist or policy tightening immediately after confirming false positives are unlikely." : "오탐 가능성이 낮으면 즉시 차단목록 또는 정책 강화로 승격합니다.")
                      : (en ? "Monitor recurrence and compare with the same target URL or attacker IP before escalation." : "재발 여부와 동일 URL/IP 반복 여부를 본 뒤 승격 여부를 판단합니다.")}
                  </p>
                  <div className="mt-3">
                    <a
                      className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                      href={policySearchHref}
                    >
                      {en ? "Open Related Policy Search" : "관련 정책 검색 열기"}
                    </a>
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringStateStatus">
                        {en ? "State" : "상태"}
                      </label>
                      <select
                        id="securityMonitoringStateStatus"
                        className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                        value={selectedStatus}
                        onChange={(event) => setSelectedStatus(event.target.value)}
                      >
                        <option value="NEW">NEW</option>
                        <option value="ACK">ACK</option>
                        <option value="ESCALATED">ESCALATED</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringStateOwner">
                        {en ? "Owner" : "담당자"}
                      </label>
                      <input
                        id="securityMonitoringStateOwner"
                        className="mt-2 h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm"
                        value={selectedOwner}
                        onChange={(event) => setSelectedOwner(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="securityMonitoringStateNote">
                        {en ? "Operator Note" : "운영 메모"}
                      </label>
                      <textarea
                        id="securityMonitoringStateNote"
                        className="mt-2 min-h-[96px] w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                        value={selectedNote}
                        onChange={(event) => setSelectedNote(event.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
                      <span>
                        {en ? "Updated" : "최종 반영"} {stringOf(selectedEvent, "stateUpdatedAt") || "-"}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 font-bold text-[var(--kr-gov-blue)] disabled:opacity-50"
                        disabled={submittingState}
                        onClick={() => {
                          void handleSaveState();
                        }}
                      >
                        {submittingState ? (en ? "Saving..." : "저장 중...") : en ? "Save State" : "상태 저장"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Select an incident to inspect the operational detail." : "이벤트를 선택하면 운영 상세를 볼 수 있습니다."}
            </div>
          )}
        </article>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 mt-6">
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Monitoring Activity" : "운영 활동 이력"}</h3>
          <div className="space-y-3">
            {activityRows.length ? activityRows.map((row, idx) => (
              <div key={`${stringOf(row, "happenedAt")}-${idx}`} className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <strong>{stringOf(row, "action")}</strong>
                  <span className="text-xs text-gray-400">{stringOf(row, "happenedAt")}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detail")}</p>
                <p className="mt-2 text-xs text-gray-400">{stringOf(row, "actorUserId")} · {stringOf(row, "target")}</p>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No monitoring activity has been recorded yet." : "기록된 운영 활동 이력이 없습니다."}
              </div>
            )}
          </div>
        </article>
        <article className="gov-card">
          <h3 className="text-lg font-bold mb-4">{en ? "Operator Guidance" : "운영 가이드"}</h3>
          <div className="space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
            <p>{en ? "Persist incident state before escalation so the next operator can see whether the event was acknowledged or blocked." : "차단 승격 전 상태를 먼저 저장해 두면 다음 운영자가 ACK/BLOCKED 여부를 바로 파악할 수 있습니다."}</p>
            <p>{en ? "Use block candidate registration only for repeated or high-confidence incidents. REVIEW state remains visible in the blocklist page." : "반복되거나 신뢰도가 높은 이벤트에만 차단 후보를 등록합니다. REVIEW 상태는 차단목록 화면에서도 바로 검토할 수 있습니다."}</p>
            <p>{en ? "Trend bars are based on the current time-range filter, so use 10m/1h/24h to compare short bursts against day-level load." : "추이 막대는 현재 기간 필터 기준입니다. 10분/1시간/24시간 범위를 바꿔 burst와 하루 단위 부하를 비교해 보세요."}</p>
          </div>
        </article>
      </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
