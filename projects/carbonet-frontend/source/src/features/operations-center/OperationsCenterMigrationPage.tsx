import React, { useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchOperationsCenterPage, fetchProjectRuntimeRegistry, mutateProjectRuntime, saveProjectRuntime, deleteProjectRuntime, applyProjectRouting, fetchProjectAdapters } from "../../lib/api/ops";
import { fetchPageJson } from "../../lib/api/core";
import type { OperationsCenterPagePayload, ProjectRuntimeRegistryItem, ProjectRuntimeRegistryPayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type OperationsCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const OPERATIONS_CLOSEOUT_ROWS: OperationsCloseoutRow[] = [
  {
    titleKo: "운영 상황판 조회",
    titleEn: "Operations visibility",
    status: "Available",
    detailKo: "요약 카드, 우선 대응 큐, 도메인 위젯, 최근 조치 이력, 상세 화면 이동은 현재 payload로 제공됩니다.",
    detailEn: "Summary cards, priority queue, domain widgets, recent actions, and drill-down links are available from the current payload."
  },
  {
    titleKo: "실측 Metric Source",
    titleEn: "Real metric source binding",
    status: "Blocked",
    detailKo: "센서/배출/연계/보안 지표별 원천 테이블, 수집 시각, stale 판단, trace id 계약이 필요합니다.",
    detailEn: "Source tables, collected-at timestamps, stale detection, and trace-id contracts are required per sensor/emission/integration/security metric."
  },
  {
    titleKo: "Incident Acknowledge",
    titleEn: "Incident acknowledgement",
    status: "Blocked",
    detailKo: "우선 대응 항목을 운영자가 인지 처리하고 담당자/시각/사유를 감사로 남기는 API가 필요합니다.",
    detailEn: "An API is required to acknowledge priority items and audit assignee, timestamp, and reason."
  },
  {
    titleKo: "Escalation / Assignment",
    titleEn: "Escalation / assignment",
    status: "Blocked",
    detailKo: "도메인별 담당자 배정, 상위 escalation, 알림센터 연계, 권한 기능 코드가 필요합니다.",
    detailEn: "Domain assignment, escalation, notification-center linkage, and feature codes are required."
  },
  {
    titleKo: "Closeout History",
    titleEn: "Closeout history",
    status: "Blocked",
    detailKo: "조치 완료, 재발 방지 메모, 증적 링크, 종료 감사와 재오픈 정책이 필요합니다.",
    detailEn: "Closeout, prevention notes, evidence links, closing audit, and reopen policy are required."
  }
];

const OPERATIONS_ACTION_CONTRACT = [
  {
    labelKo: "인지 처리",
    labelEn: "Acknowledge",
    noteKo: "incident acknowledge API와 감사 이벤트가 필요합니다.",
    noteEn: "Requires incident acknowledge API and audit event."
  },
  {
    labelKo: "담당자 배정",
    labelEn: "Assign Owner",
    noteKo: "도메인별 담당자 directory와 권한 기능 코드가 필요합니다.",
    noteEn: "Requires domain owner directory and feature codes."
  },
  {
    labelKo: "Escalate",
    labelEn: "Escalate",
    noteKo: "상위 escalation 규칙과 알림센터 연계가 필요합니다.",
    noteEn: "Requires escalation rules and notification-center linkage."
  },
  {
    labelKo: "Closeout",
    labelEn: "Closeout",
    noteKo: "증적 링크, 조치 메모, 종료 감사, 재오픈 정책이 필요합니다.",
    noteEn: "Requires evidence links, action notes, closing audit, and reopen policy."
  }
];

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function toneClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes("DANGER") || upper.includes("위험")) {
    return "bg-red-100 text-red-700";
  }
  if (upper.includes("WARNING") || upper.includes("주의")) {
    return "bg-amber-100 text-amber-700";
  }
  if (upper.includes("HEALTHY") || upper.includes("정상")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function domainLabel(value: string, en: boolean) {
  const upper = value.toUpperCase();
  if (upper === "MEMBER") {
    return en ? "Member / Company" : "회원/회원사";
  }
  if (upper === "EMISSION") {
    return en ? "Emission / Business" : "배출/업무";
  }
  if (upper === "INTEGRATION") {
    return en ? "External Integration" : "외부연계";
  }
  if (upper === "CONTENT") {
    return en ? "Content" : "콘텐츠";
  }
  if (upper === "SECURITY_SYSTEM") {
    return en ? "Security / System" : "보안/시스템";
  }
  if (upper === "OPERATIONS_TOOLS") {
    return en ? "Operations Tools" : "운영도구";
  }
  return value || (en ? "General" : "일반");
}

function severityRank(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes("위험")) {
    return 4;
  }
  if (upper.includes("WARNING") || upper.includes("주의")) {
    return 3;
  }
  if (upper.includes("INFO")) {
    return 2;
  }
  return 1;
}

function occurredAtTime(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }
  const parsed = Date.parse(normalized.replace(" ", "T"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function OperationsCenterMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<OperationsCenterPagePayload>(fetchOperationsCenterPage, [], {});
  const runtimeRegistryState = useAsyncValue<ProjectRuntimeRegistryPayload>(fetchProjectRuntimeRegistry, [], { initialValue: { items: [] } });

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionResult, setActionResult] = useState<{ projectId: string; output: string } | null>(null);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editorJson, setEditorJson] = useState<string>("");
  const [editorLoading, setEditorLoading] = useState<boolean>(false);
  const [editorError, setEditorError] = useState<string>("");

  const [adapterViewProjectId, setAdapterViewProjectId] = useState<string | null>(null);
  const [adapters, setAdapters] = useState<Array<{ name: string; size: number; lastModified: number }>>([]);

  const handleViewAdapters = async (projectId: string) => {
    if (adapterViewProjectId === projectId) {
      setAdapterViewProjectId(null);
      return;
    }
    setEditingProjectId(null); // Close editor if open
    setAdapterViewProjectId(projectId);
    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const data = await fetchProjectAdapters(projectId);
      setAdapters(data);
    } catch (error) {
      setActionResult({ projectId, output: "Failed to load adapters: " + (error instanceof Error ? error.message : "Unknown") });
      setAdapterViewProjectId(null);
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleEditProject = async (projectId: string) => {
    if (editingProjectId === projectId) {
      setEditingProjectId(null);
      return;
    }
    setAdapterViewProjectId(null); // Close adapter view if open
    setEditingProjectId(projectId);
    setEditorLoading(true);
    setEditorError("");
    setEditorJson("");
    try {
      const projectDetail = await fetchPageJson<Record<string, unknown>>(`/api/operations/governance/runtime/projects/${projectId}`);
      setEditorJson(JSON.stringify(projectDetail, null, 2));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to load project details");
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!editingProjectId) return;
    setEditorLoading(true);
    setEditorError("");
    try {
      const parsed = JSON.parse(editorJson);
      const targetId = parsed.metadata?.projectId || editingProjectId;
      await saveProjectRuntime(targetId, parsed);
      await runtimeRegistryState.reload();
      setEditingProjectId(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to save project. Ensure JSON is valid.");
    } finally {
      setEditorLoading(false);
    }
  };

  const handleNewProject = () => {
    const template = {
      metadata: {
        projectId: "NEW_PROJECT_ID",
        projectName: "New Project Name",
        owner: "team-name",
        description: "Project description"
      },
      installations: {
        commonCore: "1.1.0",
        stableGate: "v1",
        adapter: "1.0.0",
        adapterContract: "v1"
      },
      bindings: {
        database: {
          bindingMode: "COMMON_DB + PROJECT_DB",
          projectDb: {
            url: "jdbc:cubrid:localhost:33000:db_name:::?charset=utf-8"
          }
        }
      },
      runtime: {
        runtimeMode: "DEDICATED_PROJECT_RUNTIME",
        status: "STOPPED",
        bootCommand: "java -jar project-runtime.jar --server.port=18002",
        routing: {
          selectorPath: "/projects/NEW",
          routePrefix: "/r/NEW"
        }
      }
    };
    setEditingProjectId("NEW");
    setEditorJson(JSON.stringify(template, null, 2));
    setEditorError("");
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm(en ? `Are you sure you want to delete project ${projectId}?` : `프로젝트 ${projectId}를 삭제하시겠습니까?`)) {
      return;
    }
    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      await deleteProjectRuntime(projectId);
      await runtimeRegistryState.reload();
    } catch (error) {
      setActionResult({ projectId, output: "Delete failed: " + (error instanceof Error ? error.message : "Unknown") });
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleCheckHealth = async (projectId: string) => {
    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      await fetchPageJson(`/api/operations/governance/runtime/projects/${projectId}/check-health`, { init: { method: "POST" } });
      await runtimeRegistryState.reload();
    } catch (error) {
      setActionResult({ projectId, output: "Health check failed: " + (error instanceof Error ? error.message : "Unknown") });
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleApplyRouting = async (projectId: string) => {
    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const result = await applyProjectRouting(projectId);
      setActionResult({ projectId, output: result.output || (result.success ? "Routing applied successfully." : "Routing application failed.") });
    } catch (error) {
      setActionResult({ projectId, output: "Routing failed: " + (error instanceof Error ? error.message : "Unknown") });
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleProjectAction = async (projectId: string, action: "start" | "stop" | "restart") => {
    if (actionLoading[projectId]) return;

    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const result = await mutateProjectRuntime(projectId, action);
      setActionResult({ projectId, output: result.output || (result.success ? "Success" : "Failed") });
      // Refresh registry after action
      await runtimeRegistryState.reload();
    } catch (error) {
      setActionResult({ projectId, output: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };
  const page = pageState.value;
  const runtimeRegistry = useMemo(() => (runtimeRegistryState.value?.items || []) as ProjectRuntimeRegistryItem[], [runtimeRegistryState.value]);
  const summaryCards = useMemo(() => ((page?.summaryCards || []) as Array<Record<string, string>>), [page]);
  const priorityItems = useMemo(() => ((page?.priorityItems || []) as Array<Record<string, string>>), [page]);
  const widgetGroups = useMemo(() => ((page?.widgetGroups || []) as Array<Record<string, unknown>>), [page]);
  const navigationSections = useMemo(() => ((page?.navigationSections || []) as Array<Record<string, unknown>>), [page]);
  const recentActions = useMemo(() => ((page?.recentActions || []) as Array<Record<string, string>>), [page]);
  const playbooks = useMemo(() => ((page?.playbooks || []) as Array<Record<string, string>>), [page]);
  const coreSummaryCards = useMemo(() => summaryCards.filter((card) => {
    const domain = stringOf(card, "domainType");
    return domain === "MEMBER" || domain === "EMISSION" || domain === "SECURITY_SYSTEM";
  }), [summaryCards]);
  const supportSummaryCards = useMemo(() => summaryCards.filter((card) => {
    const domain = stringOf(card, "domainType");
    return domain !== "MEMBER" && domain !== "EMISSION" && domain !== "SECURITY_SYSTEM";
  }), [summaryCards]);
  const primaryWidgetGroups = useMemo(() => widgetGroups.filter((group) => {
    const domain = stringOf(group as Record<string, unknown>, "domainType");
    return domain === "MEMBER" || domain === "EMISSION" || domain === "SECURITY_SYSTEM";
  }), [widgetGroups]);
  const secondaryWidgetGroups = useMemo(() => widgetGroups.filter((group) => {
    const domain = stringOf(group as Record<string, unknown>, "domainType");
    return domain !== "MEMBER" && domain !== "EMISSION" && domain !== "SECURITY_SYSTEM";
  }), [widgetGroups]);
  const overallStatus = stringOf(page as Record<string, unknown>, "overallStatus");
  const [selectedQueueDomain, setSelectedQueueDomain] = useState("ALL");
  const queueDomainOptions = useMemo(() => {
    const counts = new Map<string, number>();
    priorityItems.forEach((item) => {
      const domain = stringOf(item, "domainType") || "GENERAL";
      counts.set(domain, (counts.get(domain) || 0) + 1);
    });
    return [
      { value: "ALL", label: en ? "All" : "전체", count: priorityItems.length },
      ...Array.from(counts.entries()).map(([value, count]) => ({
        value,
        label: domainLabel(value, en),
        count
      }))
    ];
  }, [en, priorityItems]);
  const filteredPriorityItems = useMemo(() => {
    const scoped = selectedQueueDomain === "ALL"
      ? priorityItems
      : priorityItems.filter((item) => stringOf(item, "domainType") === selectedQueueDomain);
    return [...scoped].sort((left, right) => {
      const severityGap = severityRank(stringOf(right, "severity")) - severityRank(stringOf(left, "severity"));
      if (severityGap !== 0) {
        return severityGap;
      }
      return occurredAtTime(stringOf(right, "occurredAt")) - occurredAtTime(stringOf(left, "occurredAt"));
    });
  }, [priorityItems, selectedQueueDomain]);

  logGovernanceScope("PAGE", "operations-center", {
    language: en ? "en" : "ko",
    overallStatus,
    summaryCardCount: summaryCards.length,
    priorityItemCount: priorityItems.length,
    runtimeRegistryCount: runtimeRegistry.length,
    selectedQueueDomain,
    widgetGroupCount: widgetGroups.length,
    navigationSectionCount: navigationSections.length,
    recentActionCount: recentActions.length
  });

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Operations Center" : "운영센터" }
      ]}
      title={en ? "Operations Center" : "운영센터"}
      subtitle={en ? "Review current operational health and move into detailed response screens." : "현재 운영 상태를 빠르게 점검하고 상세 대응 화면으로 이동합니다."}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading operations center..." : "운영센터를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="gov-card" data-help-id="operations-center-status">
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Current Status" : "현재 운영 상태"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-black ${toneClass(overallStatus)}`}>
                  {overallStatus || (en ? "Unknown" : "미정")}
                </span>
                <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
                </span>
              </div>
            </div>
            <div className="max-w-xl text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Use this page as the first stop, then move into the linked monitoring, log, scheduler, and audit screens."
                : "이 화면은 1차 상황판입니다. 상세 분석과 조치는 연결된 모니터링, 로그, 스케줄러, 감사 화면에서 진행합니다."}
            </div>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <a className="gov-btn" href={buildLocalizedPath("/admin/monitoring/sensor_add", "/en/admin/monitoring/sensor_add")}>
                {en ? "Register Sensor" : "센서 등록"}
              </a>
              <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/monitoring/sensor_edit", "/en/admin/monitoring/sensor_edit")}>
                {en ? "Open Sensor Settings" : "센서 설정 열기"}
              </a>
              <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/monitoring/sensor_list", "/en/admin/monitoring/sensor_list")}>
                {en ? "Open Sensor List" : "센서 목록 열기"}
              </a>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="operations-center-project-selector">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                  {en ? "Project Runtime Registry" : "프로젝트 런타임 레지스트리"}
                </p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
                  {en ? "Central Project Selection" : "중앙 프로젝트 선택"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Even when each project boots as a separate runtime, operators can confirm active projects here and move by route prefix or external domain."
                    : "각 프로젝트가 별도 runtime으로 떠 있어도 이 화면에서 활성 프로젝트를 확인하고 route prefix 또는 외부 도메인으로 이동할 수 있습니다."}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="gov-btn gov-btn-primary"
                  onClick={handleNewProject}
                  type="button"
                >
                  {en ? "Register Project" : "프로젝트 등록"}
                </button>
                <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {(en ? "Registered projects " : "등록 프로젝트 ") + String(runtimeRegistry.length)}
                </div>
              </div>
            </div>
          </div>
          {runtimeRegistryState.error ? (
            <div className="px-6 py-5">
              <PageStatusNotice tone="error">{runtimeRegistryState.error}</PageStatusNotice>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Project" : "프로젝트"}</th>
                  <th className="px-4 py-3">{en ? "Runtime" : "런타임"}</th>
                  <th className="px-4 py-3">{en ? "Path Routing" : "경로 분기"}</th>
                  <th className="px-4 py-3">{en ? "External Domain" : "외부 도메인"}</th>
                  <th className="px-4 py-3">{en ? "Compatibility" : "호환성"}</th>
                  <th className="px-4 py-3 text-right">{en ? "Actions" : "이동"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editingProjectId === "NEW" && (
                  <tr>
                    <td colSpan={6} className="p-0 border-b border-[var(--kr-gov-border-light)]">
                      <div className="bg-blue-50 p-4 shadow-inner border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-black text-blue-900 uppercase">
                            {en ? "Register New Project Manifest" : "새 프로젝트 매니페스트 등록"}
                          </h4>
                          <div className="flex gap-2">
                            <button
                              className="gov-btn gov-btn-outline"
                              onClick={() => setEditingProjectId(null)}
                              type="button"
                            >
                              {en ? "Cancel" : "취소"}
                            </button>
                            <button
                              className="gov-btn gov-btn-primary"
                              disabled={editorLoading}
                              onClick={handleSaveProject}
                              type="button"
                            >
                              {editorLoading ? (en ? "Registering..." : "등록 중...") : (en ? "Confirm Registration" : "프로젝트 등록 완료")}
                            </button>
                          </div>
                        </div>
                        {editorError && <div className="mb-2 text-sm text-red-600">{editorError}</div>}
                        <textarea
                          className="gov-textarea w-full font-mono text-sm bg-white"
                          disabled={editorLoading}
                          onChange={(e) => setEditorJson(e.target.value)}
                          rows={15}
                          value={editorJson}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                {runtimeRegistry.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                      {runtimeRegistryState.loading
                        ? (en ? "Loading project runtime registry..." : "프로젝트 런타임 레지스트리를 불러오는 중입니다.")
                        : (en ? "There are no registered project runtimes." : "등록된 프로젝트 runtime이 없습니다.")}
                    </td>
                  </tr>
                ) : runtimeRegistry.map((item, index) => {
                  const projectId = stringOf(item, "projectId");
                  const projectName = stringOf(item, "projectName");
                  const runtimeMode = stringOf(item, "runtimeMode");
                  const routePrefix = stringOf(item, "routePrefix");
                  const externalBaseUrl = stringOf(item, "externalBaseUrl");
                  const selectorPath = stringOf(item, "selectorPath");
                  const status = stringOf(item, "status");
                  return (
                    <React.Fragment key={`${projectId}-${index}`}>
                    <tr>
                      <td className="px-4 py-3">
                        <div className="font-black text-[var(--kr-gov-text-primary)]">{projectId || "-"}</div>
                        <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{projectName || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClass(status || runtimeMode)}`}>
                            {status || runtimeMode || (en ? "Unknown" : "미정")}
                          </span>
                          <button
                            className="text-slate-400 hover:text-blue-600 disabled:opacity-50"
                            disabled={actionLoading[projectId]}
                            onClick={() => handleCheckHealth(projectId)}
                            title={en ? "Check Health" : "상태 확인"}
                            type="button"
                          >
                            <span className="material-icons text-sm">refresh</span>
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                          {stringOf(item, "lastHealthCheck") ?
                            (en ? "Last check: " : "최근 확인: ") + new Date(stringOf(item, "lastHealthCheck")).toLocaleString()
                            : (en ? "No check history" : "확인 이력 없음")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--kr-gov-text-secondary)] italic">
                          {runtimeMode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{routePrefix || "-"}</div>
                        <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{selectorPath || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[13px] text-[var(--kr-gov-text-primary)] break-all">{externalBaseUrl || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">
                        {stringOf(item, "compatibilityClass") || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {selectorPath ? (
                            <a className="gov-btn gov-btn-outline" href={selectorPath}>
                              {en ? "Select" : "선택"}
                            </a>
                          ) : null}

                          <div className="flex items-center gap-1 rounded-md border border-[var(--kr-gov-border-light)] bg-slate-50 p-1">
                            <button
                              className="px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              disabled={actionLoading[projectId]}
                              onClick={() => handleProjectAction(projectId, "start")}
                              type="button"
                            >
                              {en ? "Start" : "시작"}
                            </button>
                            <button
                              className="px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              disabled={actionLoading[projectId]}
                              onClick={() => handleProjectAction(projectId, "stop")}
                              type="button"
                            >
                              {en ? "Stop" : "중지"}
                            </button>
                            <button
                              className="px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              disabled={actionLoading[projectId]}
                              onClick={() => handleProjectAction(projectId, "restart")}
                              type="button"
                            >
                              {en ? "Restart" : "재시작"}
                            </button>
                          </div>

                          <button
                            className="gov-btn gov-btn-outline"
                            disabled={actionLoading[projectId]}
                            onClick={() => handleApplyRouting(projectId)}
                            type="button"
                          >
                            {en ? "Route" : "라우팅"}
                          </button>

                          <button
                            className="gov-btn gov-btn-outline text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteProject(projectId)}
                            type="button"
                          >
                            <span className="material-icons text-sm">delete</span>
                          </button>

                          <button
                            className="gov-btn gov-btn-outline"
                            disabled={actionLoading[projectId]}
                            onClick={() => handleViewAdapters(projectId)}
                            type="button"
                          >
                            {en ? "Adapters" : "어댑터"}
                          </button>

                          <button
                            className="gov-btn gov-btn-outline"
                            onClick={() => handleEditProject(projectId)}
                            type="button"
                          >
                            {editingProjectId === projectId ? (en ? "Close" : "닫기") : (en ? "JSON" : "설정")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {adapterViewProjectId === projectId && (
                      <tr>
                        <td colSpan={6} className="p-0 border-b border-[var(--kr-gov-border-light)]">
                          <div className="bg-emerald-50 p-4 shadow-inner border-l-4 border-emerald-500">
                            <h4 className="text-sm font-black text-emerald-900 uppercase mb-3">
                              {en ? "Project Libraries & Adapters:" : "프로젝트 라이브러리 및 어댑터:"} {projectId}
                            </h4>
                            <div className="overflow-hidden rounded-md border border-emerald-200 bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-emerald-100 text-emerald-900">
                                  <tr>
                                    <th className="px-3 py-2 text-left">File Name</th>
                                    <th className="px-3 py-2 text-right">Size</th>
                                    <th className="px-3 py-2 text-right">Last Modified</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-50">
                                  {adapters.length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="px-3 py-4 text-center text-emerald-600">
                                        No JAR files found in lib/ directory.
                                      </td>
                                    </tr>
                                  ) : adapters.map(jar => (
                                    <tr key={jar.name}>
                                      <td className="px-3 py-2 font-mono">{jar.name}</td>
                                      <td className="px-3 py-2 text-right">{(jar.size / 1024 / 1024).toFixed(2)} MB</td>
                                      <td className="px-3 py-2 text-right">{new Date(jar.lastModified).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {editingProjectId === projectId && (
                      <tr>
                        <td colSpan={6} className="p-0 border-b border-[var(--kr-gov-border-light)]">
                          <div className="bg-slate-50 p-4 shadow-inner">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                                {en ? "Edit Project Manifest:" : "프로젝트 매니페스트 편집:"} {projectId}
                              </h4>
                              <div className="flex gap-2">
                                <button
                                  className="gov-btn gov-btn-outline"
                                  onClick={() => handleEditProject(projectId)}
                                  type="button"
                                >
                                  {en ? "Cancel" : "취소"}
                                </button>
                                <button
                                  className="gov-btn gov-btn-primary"
                                  disabled={editorLoading}
                                  onClick={handleSaveProject}
                                  type="button"
                                >
                                  {editorLoading ? (en ? "Saving..." : "저장 중...") : (en ? "Save Changes" : "설정 저장")}
                                </button>
                              </div>
                            </div>
                            {editorError && <div className="mb-2 text-sm text-red-600">{editorError}</div>}
                            <textarea
                              className="gov-textarea w-full font-mono text-sm"
                              disabled={editorLoading}
                              onChange={(e) => setEditorJson(e.target.value)}
                              rows={15}
                              value={editorJson}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {actionResult && (
            <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-900 p-4 font-mono text-xs text-emerald-400">
              <div className="flex items-center justify-between mb-2">
                <span>Last Action Result: {actionResult.projectId}</span>
                <button className="text-slate-400 hover:text-white" onClick={() => setActionResult(null)}>Close</button>
              </div>
              <pre className="whitespace-pre-wrap">{actionResult.output}</pre>
            </div>
          )}
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="operations-center-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for incident operations" : "운영센터 incident 처리를 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page is currently a first-stop visibility console. Incident lifecycle actions remain disabled until real metric provenance, acknowledgement, escalation, assignment, closeout history, and audit contracts are implemented."
                    : "이 화면은 현재 1차 상황판입니다. 실측 지표 출처, 인지 처리, escalation, 담당자 배정, closeout 이력, 감사 계약이 구현되기 전까지 incident lifecycle 조치는 비활성화합니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / lifecycle actions blocked" : "PARTIAL / lifecycle 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {OPERATIONS_CLOSEOUT_ROWS.map((row) => (
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
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="operations-center-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Incident Actions" : "차단된 incident 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Keep drill-down navigation active; enable these actions only after backend lifecycle, authorization, and audit are connected." : "상세 화면 이동은 유지하되, 백엔드 lifecycle·권한·감사가 연결된 뒤에만 아래 조치를 활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {OPERATIONS_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4" data-help-id="operations-center-core-summary">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                {en ? "Core Operations" : "핵심 운영"}
              </p>
              <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
                {en ? "Primary Response Domains" : "우선 대응 도메인"}
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Start from member, emission, and security/system signals, then move into detailed screens."
                : "회원, 배출, 보안/시스템 신호부터 확인한 뒤 상세 화면으로 이동합니다."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreSummaryCards.map((card, index) => (
              <a href={stringOf(card, "targetRoute")} key={`${stringOf(card, "key", "title", "label")}-${index}`}>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(248,251,255,0.96),rgba(255,255,255,1))] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                    {domainLabel(stringOf(card, "domainType"), en)}
                  </p>
                  <SummaryMetricCard
                    className="mt-2 border-0 bg-transparent px-0 py-0 shadow-none"
                    title={stringOf(card, "title", "label")}
                    description={stringOf(card, "description")}
                    value={stringOf(card, "value")}
                  />
                </article>
              </a>
            ))}
          </div>
        </section>

        <section className="space-y-4" data-help-id="operations-center-support-summary">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                {en ? "Support Domains" : "지원 도메인"}
              </p>
              <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
                {en ? "Governance And Tooling" : "거버넌스 및 도구"}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {supportSummaryCards.map((card, index) => (
            <a href={stringOf(card, "targetRoute")} key={`${stringOf(card, "key", "title", "label")}-${index}`}>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">
                  {domainLabel(stringOf(card, "domainType"), en)}
                </p>
                <SummaryMetricCard
                  className="mt-2 border-0 bg-transparent px-0 py-0 shadow-none"
                  title={stringOf(card, "title", "label")}
                  description={stringOf(card, "description")}
                  value={stringOf(card, "value")}
                />
              </article>
            </a>
          ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" data-help-id="operations-center-navigation">
          {navigationSections.map((section, index) => {
            const links = ((section.links || []) as Array<Record<string, string>>);
            return (
              <article className="gov-card" key={`${stringOf(section as Record<string, unknown>, "sectionId", "title")}-${index}`}>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{stringOf(section as Record<string, unknown>, "title")}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(section as Record<string, unknown>, "description")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {links.map((link, linkIndex) => (
                    <a className="gov-btn gov-btn-outline" href={stringOf(link, "href")} key={`${stringOf(link, "label")}-${linkIndex}`}>
                      {stringOf(link, "label")}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="operations-center-priority-queue">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Priority Response Queue" : "우선 대응 큐"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Review the highest-impact items first and move into the linked detail screens." : "영향도가 큰 항목부터 확인하고 연결된 상세 화면으로 이동합니다."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {queueDomainOptions.map((option) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selectedQueueDomain === option.value
                        ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white"
                        : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                    }`}
                    key={option.value}
                    onClick={() => setSelectedQueueDomain(option.value)}
                    type="button"
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Severity" : "심각도"}</th>
                    <th className="px-4 py-3">{en ? "Domain / Type" : "도메인 / 유형"}</th>
                    <th className="px-4 py-3">{en ? "Summary" : "요약"}</th>
                    <th className="px-4 py-3">{en ? "Occurred At" : "발생 시각"}</th>
                    <th className="px-4 py-3 text-right">{en ? "Action" : "이동"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPriorityItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                        {selectedQueueDomain === "ALL"
                          ? (en ? "There are no priority items right now." : "현재 우선 대응 항목이 없습니다.")
                          : (en ? "There are no items in the selected domain." : "선택한 도메인에 우선 대응 항목이 없습니다.")}
                      </td>
                    </tr>
                  ) : filteredPriorityItems.map((item, index) => (
                    <tr key={`${stringOf(item, "itemId", "title")}-${index}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClass(stringOf(item, "severity"))}`}>
                          {stringOf(item, "severity")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{domainLabel(stringOf(item, "domainType"), en)}</div>
                        <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{stringOf(item, "sourceType")}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</div>
                        <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "occurredAt")}</td>
                      <td className="px-4 py-3 text-right">
                        <a className="gov-btn gov-btn-outline" href={stringOf(item, "targetRoute")}>
                          {en ? "Open" : "열기"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <CollectionResultPanel
            data-help-id="operations-center-playbooks"
            description={en ? "Operator reminders before taking action in downstream screens." : "연결된 상세 화면에서 조치하기 전 운영 체크포인트입니다."}
            icon="rule"
            title={en ? "Operational Checkpoints" : "운영 체크포인트"}
          >
            <div className="space-y-3">
              {playbooks.map((item, index) => (
                <div
                  key={`${stringOf(item, "title")}-${index}`}
                  className={`rounded-lg border px-4 py-3 ${toneClass(stringOf(item, "tone"))}`}
                >
                  <p className="text-sm font-black">{stringOf(item, "title")}</p>
                  <p className="mt-1 text-sm">{stringOf(item, "body")}</p>
                </div>
              ))}
            </div>
          </CollectionResultPanel>
        </section>

        <section className="space-y-4" data-help-id="operations-center-core-widgets">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
              {en ? "Operational Widgets" : "운영 위젯"}
            </p>
            <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
              {en ? "Core Domains" : "핵심 도메인"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {primaryWidgetGroups.map((group, index) => {
            const metricRows = ((group.metricRows || []) as Array<Record<string, string>>);
            const quickLinks = ((group.quickLinks || []) as Array<Record<string, string>>);
            return (
              <article className="gov-card" key={`${stringOf(group as Record<string, unknown>, "widgetId", "title")}-${index}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                      {domainLabel(stringOf(group as Record<string, unknown>, "domainType"), en)}
                    </p>
                    <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(group as Record<string, unknown>, "title")}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(group as Record<string, unknown>, "description")}</p>
                  </div>
                  {stringOf(group as Record<string, unknown>, "targetRoute") ? (
                    <a className="gov-btn gov-btn-outline" href={stringOf(group as Record<string, unknown>, "targetRoute")}>
                      {en ? "View Detail" : "상세 보기"}
                    </a>
                  ) : null}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metricRows.map((row, rowIndex) => (
                    <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${stringOf(row, "label")}-${rowIndex}`}>
                      <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(row, "label")}</p>
                      <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(row, "value")}</p>
                    </div>
                  ))}
                </div>
                {quickLinks.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {quickLinks.map((link, linkIndex) => (
                      <a className="gov-btn gov-btn-outline" href={stringOf(link, "href")} key={`${stringOf(link, "label")}-${linkIndex}`}>
                        {stringOf(link, "label")}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          </div>
        </section>

        <section className="space-y-4" data-help-id="operations-center-extended-widgets">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
              {en ? "Extended Operations" : "확장 운영"}
            </p>
            <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
              {en ? "Integration, Content, And Tooling" : "외부연계, 콘텐츠, 운영도구"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {secondaryWidgetGroups.map((group, index) => {
            const metricRows = ((group.metricRows || []) as Array<Record<string, string>>);
            const quickLinks = ((group.quickLinks || []) as Array<Record<string, string>>);
            return (
              <article className="gov-card" key={`${stringOf(group as Record<string, unknown>, "widgetId", "title")}-${index}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                      {domainLabel(stringOf(group as Record<string, unknown>, "domainType"), en)}
                    </p>
                    <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(group as Record<string, unknown>, "title")}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(group as Record<string, unknown>, "description")}</p>
                  </div>
                  {stringOf(group as Record<string, unknown>, "targetRoute") ? (
                    <a className="gov-btn gov-btn-outline" href={stringOf(group as Record<string, unknown>, "targetRoute")}>
                      {en ? "View Detail" : "상세 보기"}
                    </a>
                  ) : null}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metricRows.map((row, rowIndex) => (
                    <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${stringOf(row, "label")}-${rowIndex}`}>
                      <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(row, "label")}</p>
                      <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(row, "value")}</p>
                    </div>
                  ))}
                </div>
                {quickLinks.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {quickLinks.map((link, linkIndex) => (
                      <a className="gov-btn gov-btn-outline" href={stringOf(link, "href")} key={`${stringOf(link, "label")}-${linkIndex}`}>
                        {stringOf(link, "label")}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="operations-center-recent-actions">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <h3 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Actions" : "최근 조치 이력"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Check recent operator actions and move into the related history screen when needed." : "최근 운영자 조치를 확인하고 필요하면 관련 이력 화면으로 이동합니다."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Time" : "시각"}</th>
                  <th className="px-4 py-3">{en ? "Actor" : "수행자"}</th>
                  <th className="px-4 py-3">{en ? "Action" : "조치"}</th>
                  <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                  <th className="px-4 py-3">{en ? "Result" : "결과"}</th>
                  <th className="px-4 py-3 text-right">{en ? "Link" : "이동"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentActions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                      {en ? "There is no recent action history." : "최근 조치 이력이 없습니다."}
                    </td>
                  </tr>
                ) : recentActions.map((row, index) => (
                  <tr key={`${stringOf(row, "actionId", "actedAt")}-${index}`}>
                    <td className="px-4 py-3">{stringOf(row, "actedAt")}</td>
                    <td className="px-4 py-3 font-semibold">{stringOf(row, "actorId")}</td>
                    <td className="px-4 py-3">{stringOf(row, "actionType")}</td>
                    <td className="px-4 py-3">{stringOf(row, "targetLabel")}</td>
                    <td className="px-4 py-3">{stringOf(row, "resultStatus")}</td>
                    <td className="px-4 py-3 text-right">
                      {stringOf(row, "targetRoute") ? (
                        <a className="gov-btn gov-btn-outline" href={stringOf(row, "targetRoute")}>
                          {en ? "History" : "이력"}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
