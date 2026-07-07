import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalSyncPage } from "../../lib/api/ops";
import type { ExternalSyncPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("FAILED") || upper.includes("ERROR") || upper.includes("REVIEW")) {
    return "bg-red-100 text-red-700";
  }
  if (upper.includes("DEGRADED") || upper.includes("WARN")) {
    return "bg-amber-100 text-amber-700";
  }
  if (upper.includes("ACTIVE") || upper.includes("SUCCESS") || upper.includes("HEALTHY")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function readInitialFilters() {
  if (typeof window === "undefined") {
    return {
      keyword: "",
      syncMode: "ALL",
      status: "ALL"
    };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    keyword: search.get("keyword") || "",
    syncMode: search.get("syncMode") || "ALL",
    status: search.get("status") || "ALL"
  };
}

export function ExternalSyncMigrationPage() {
  const en = isEnglish();
  const initialFilters = useMemo(() => readInitialFilters(), []);
  const pageState = useAsyncValue<ExternalSyncPagePayload>(fetchExternalSyncPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalSyncSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalSyncRows || []) as Array<Record<string, string>>), [page]);
  const queueRows = useMemo(() => ((page?.externalSyncQueueRows || []) as Array<Record<string, string>>), [page]);
  const executionRows = useMemo(() => ((page?.externalSyncExecutionRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalSyncQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalSyncGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState(initialFilters.keyword);
  const [syncMode, setSyncMode] = useState(initialFilters.syncMode);
  const [status, setStatus] = useState(initialFilters.status);

  function resetFilters() {
    setKeyword("");
    setSyncMode("ALL");
    setStatus("ALL");
  }

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword = !normalizedKeyword || [
        stringOf(row, "jobId"),
        stringOf(row, "connectionId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "endpointUrl")
      ].join(" ").toLowerCase().includes(normalizedKeyword);
      const matchesSyncMode = syncMode === "ALL" || stringOf(row, "syncMode").toUpperCase() === syncMode;
      const matchesStatus = status === "ALL" || stringOf(row, "status").toUpperCase() === status;
      return matchesKeyword && matchesSyncMode && matchesStatus;
    });
  }, [keyword, rows, status, syncMode]);

  useEffect(() => {
    const search = new URLSearchParams();
    if (keyword.trim()) {
      search.set("keyword", keyword.trim());
    }
    if (syncMode !== "ALL") {
      search.set("syncMode", syncMode);
    }
    if (status !== "ALL") {
      search.set("status", status);
    }
    const query = search.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [keyword, status, syncMode]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-sync", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      syncMode,
      status
    });
  }, [en, filteredRows.length, rows.length, status, syncMode]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (keyword.trim()) {
      labels.push(en ? `Keyword: ${keyword.trim()}` : `검색어: ${keyword.trim()}`);
    }
    if (syncMode !== "ALL") {
      labels.push(en ? `Sync Mode: ${syncMode}` : `동기화 방식: ${syncMode}`);
    }
    if (status !== "ALL") {
      labels.push(en ? `Status: ${status}` : `상태: ${status}`);
    }
    return labels;
  }, [en, keyword, status, syncMode]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Sync Execution" : "동기화 실행" }
      ]}
      title={en ? "Sync Execution" : "동기화 실행"}
      subtitle={en ? "Review scheduled, hybrid, and event-driven external sync targets with backlog and recent execution signals." : "정기, 혼합형, 이벤트 기반 외부연계 동기화 대상을 적체와 최근 실행 이력 기준으로 함께 점검합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/schema", "/en/admin/external/schema")}>
            {en ? "Schema Registry" : "스키마 현황"}
          </a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list")}>
            {en ? "Open Registry" : "외부 연계 목록"}
          </a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external sync status..." : "동기화 실행 현황을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-sync-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "title")}-${index}`}
              title={stringOf(item, "title")}
              value={stringOf(item, "value")}
              description={stringOf(item, "description")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="external-sync-filters"
          title={en ? "Sync Filters" : "동기화 조회 조건"}
          description={en ? "Narrow by target, mode, or runtime status before checking queue backlog or recent executions." : "큐 적체와 최근 실행 이력을 보기 전에 대상, 동기화 방식, 런타임 상태 기준으로 범위를 좁힙니다."}
          icon="sync"
        >
          {activeFilterLabels.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {activeFilterLabels.map((label) => (
                <span key={label} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalSyncKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalSyncKeyword" placeholder={en ? "Connection, queue, endpoint" : "연계명, 큐, 엔드포인트"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalSyncMode">{en ? "Sync Mode" : "동기화 방식"}</label>
              <AdminSelect id="externalSyncMode" value={syncMode} onChange={(event) => setSyncMode(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="SCHEDULED">{en ? "Scheduled" : "스케줄 수집"}</option>
                <option value="HYBRID">{en ? "Hybrid" : "혼합형"}</option>
                <option value="WEBHOOK">{en ? "Webhook" : "웹훅"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalSyncStatus">{en ? "Status" : "상태"}</label>
              <AdminSelect id="externalSyncStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="REVIEW">REVIEW</option>
                <option value="FAILED">FAILED</option>
                <option value="DISABLED">DISABLED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" onClick={resetFilters} type="button">
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-sync-registry">
          <GridToolbar
            actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>}
            meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
            title={en ? "Sync Target Registry" : "동기화 대상 현황"}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                  <th className="px-4 py-3">{en ? "Mode" : "방식"}</th>
                  <th className="px-4 py-3">{en ? "Trigger" : "트리거"}</th>
                  <th className="px-4 py-3">{en ? "Schedule" : "실행 기준"}</th>
                  <th className="px-4 py-3">{en ? "Last Sync" : "최근 동기화"}</th>
                  <th className="px-4 py-3">{en ? "Next Sync" : "다음 실행"}</th>
                  <th className="px-4 py-3">{en ? "Backlog" : "적체"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "jobId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                        {stringOf(row, "connectionName")}
                      </a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "jobId")} / {stringOf(row, "connectionId")}</p>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "syncMode")}</td>
                    <td className="px-4 py-3">{stringOf(row, "triggerType")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{stringOf(row, "schedule")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "lastSyncAt")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "nextSyncAt")}</td>
                    <td className="px-4 py-3">{stringOf(row, "backlogCount")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={8}>
                      {en ? "No sync targets match the current filters." : "현재 조건에 맞는 동기화 대상이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-sync-queue">
            <GridToolbar meta={en ? "Backlog and worker ownership are shown together for faster triage." : "적체와 워커 담당 노드를 함께 보여 빠르게 조치할 수 있게 구성했습니다."} title={en ? "Sync Queue Backlog" : "동기화 큐 적체"} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Queue ID" : "큐 ID"}</th><th className="px-4 py-3">{en ? "Queue Name" : "큐명"}</th><th className="px-4 py-3">{en ? "Backlog" : "적체"}</th><th className="px-4 py-3">{en ? "Consumer" : "소비 노드"}</th><th className="px-4 py-3">{en ? "Last Message" : "최근 메시지"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                {queueRows.map((row, index) => (
                    <tr key={`${stringOf(row, "queueId")}-${index}`}>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "queueId")}</td>
                      <td className="px-4 py-3">{stringOf(row, "queueName")}</td>
                      <td className="px-4 py-3">{stringOf(row, "backlogCount")}</td>
                      <td className="px-4 py-3">{stringOf(row, "consumerNode")}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "lastMessageAt")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                    </tr>
                  ))}
                  {queueRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                        {en ? "No queue backlog is registered." : "등록된 큐 적체 정보가 없습니다."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <CollectionResultPanel data-help-id="external-sync-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move into registry, scheduler, or logs for the selected sync target." : "선택 대상에 따라 레지스트리, 스케줄러, 로그 화면으로 바로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>
                    {stringOf(item, "label", "title")}
                  </a>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-sync-guidance" title={en ? "Operating Guidance" : "운영 가이드"} description={en ? "Keep the same decision baseline before forcing sync retries or queue moves." : "강제 재시도나 큐 이동 전에는 같은 판단 기준으로 먼저 점검합니다."} icon="fact_check">
              <div className="space-y-3">
                {guidance.map((item, index) => (
                  <article key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${badgeClass(stringOf(item, "tone"))}`}>{stringOf(item, "tone") || "INFO"}</span>
                      <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p>
                  </article>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-sync-executions">
          <GridToolbar meta={en ? "Recent sync windows are summarized here for quick review routing." : "최근 동기화 주기 결과를 빠르게 확인하고 후속 화면으로 넘길 수 있게 요약했습니다."} title={en ? "Recent Sync Executions" : "최근 동기화 실행 이력"} />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Executed At" : "실행 시각"}</th><th className="px-4 py-3">{en ? "Job ID" : "잡 ID"}</th><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Trigger" : "트리거"}</th><th className="px-4 py-3">{en ? "Result" : "결과"}</th><th className="px-4 py-3">{en ? "Duration" : "소요 시간"}</th><th className="px-4 py-3">{en ? "Message" : "메시지"}</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {executionRows.map((row, index) => (
                  <tr key={`${stringOf(row, "jobId")}-${index}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "executedAt")}</td>
                    <td className="px-4 py-3 font-bold">{stringOf(row, "jobId")}</td>
                    <td className="px-4 py-3">{stringOf(row, "connectionName")}</td>
                    <td className="px-4 py-3">{stringOf(row, "triggerType")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "result"))}`}>{stringOf(row, "result")}</span></td>
                    <td className="px-4 py-3">{stringOf(row, "duration")}</td>
                    <td className="px-4 py-3">{stringOf(row, "message")}</td>
                  </tr>
                ))}
                {executionRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                      {en ? "No recent sync executions are available." : "최근 동기화 실행 이력이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
