import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalMonitoringPage } from "../../lib/api/ops";
import { readBootstrappedExternalMonitoringPageData } from "../../lib/api/bootstrap";
import type { ExternalMonitoringPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes("FAILED") || upper.includes("DEGRADED")) return "bg-red-100 text-red-700";
  if (upper.includes("HIGH") || upper.includes("WARNING") || upper.includes("REVIEW") || upper.includes("WATCH")) return "bg-amber-100 text-amber-700";
  if (upper.includes("ACTIVE") || upper.includes("HEALTHY") || upper.includes("STABLE")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function ExternalMonitoringMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedExternalMonitoringPageData(), []);
  const pageState = useAsyncValue<ExternalMonitoringPagePayload>(fetchExternalMonitoringPage, [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalMonitoringSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalMonitoringRows || []) as Array<Record<string, string>>), [page]);
  const alertRows = useMemo(() => ((page?.externalMonitoringAlertRows || []) as Array<Record<string, string>>), [page]);
  const timelineRows = useMemo(() => ((page?.externalMonitoringTimelineRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalMonitoringQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalMonitoringGuidance || []) as Array<Record<string, string>>), [page]);
  const overallStatus = stringOf(page as Record<string, unknown>, "overallStatus").toUpperCase();
  const [keyword, setKeyword] = useState("");
  const [healthStatus, setHealthStatus] = useState("ALL");
  const [alertLevel, setAlertLevel] = useState("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        stringOf(row, "connectionId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "protocol"),
        stringOf(row, "ownerName")
      ].join(" ").toLowerCase();
      const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword);
      const matchesHealth = healthStatus === "ALL" || stringOf(row, "status").toUpperCase() === healthStatus;
      const matchesAlert = alertLevel === "ALL"
        || (alertLevel === "NONE" ? stringOf(row, "alertCount") === "0" : stringOf(row, "topAlertLevel").toUpperCase() === alertLevel);
      return matchesKeyword && matchesHealth && matchesAlert;
    });
  }, [alertLevel, healthStatus, keyword, rows]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-monitoring", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      healthStatus,
      alertLevel
    });
  }, [alertLevel, en, filteredRows.length, healthStatus, rows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Integration Monitoring" : "연계 모니터링" }
      ]}
      title={en ? "Integration Monitoring" : "연계 모니터링"}
      subtitle={en ? "Review connection health, sync backlog, webhook risk, and active alerts in one operational board." : "연계 상태, 동기화 적체, 웹훅 위험, 활성 경보를 한 화면에서 함께 점검하는 운영 보드입니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list")}>{en ? "Connection Registry" : "외부 연계 목록"}</a>
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/sync", "/en/admin/external/sync")}>{en ? "Sync Execution" : "동기화 실행"}</a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/webhooks", "/en/admin/external/webhooks")}>{en ? "Webhook Settings" : "웹훅 설정"}</a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading integration monitoring..." : "연계 모니터링 데이터를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {!pageState.error && overallStatus ? (
          <PageStatusNotice tone={overallStatus === "DEGRADED" ? "error" : overallStatus === "REVIEW" ? "warning" : "success"}>
            {overallStatus === "DEGRADED"
              ? (en ? "Critical monitoring signals are active. Review degraded connections and open alerts first." : "치명 경보가 활성 상태입니다. 상태 저하 연계와 활성 경보를 먼저 검토하세요.")
              : overallStatus === "REVIEW"
                ? (en ? "Some monitored connections need review. Check backlog and webhook drift before rerun." : "일부 연계가 재검토 상태입니다. 재실행 전 적체와 웹훅 이상 여부를 먼저 확인하세요.")
                : (en ? "All monitored connections are currently stable." : "현재 모니터링 중인 연계는 안정 상태입니다.")}
          </PageStatusNotice>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-monitoring-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard key={`${stringOf(item, "title")}-${index}`} title={stringOf(item, "title")} value={stringOf(item, "value")} description={stringOf(item, "description")} />
          ))}
        </section>

        <CollectionResultPanel data-help-id="external-monitoring-filters" title={en ? "Monitoring Filters" : "모니터링 조회 조건"} description={en ? "Narrow by connection, health state, or alert severity before opening a follow-up page." : "후속 운영 화면으로 이동하기 전에 연계, 건강 상태, 경보 등급 기준으로 범위를 좁힙니다."} icon="monitoring">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMonitoringKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalMonitoringKeyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Connection, partner, owner" : "연계명, 기관명, 담당자"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMonitoringHealth">{en ? "Health" : "건강 상태"}</label>
              <AdminSelect id="externalMonitoringHealth" value={healthStatus} onChange={(event) => setHealthStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVIEW">REVIEW</option>
                <option value="DEGRADED">DEGRADED</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMonitoringAlert">{en ? "Top Alert" : "상위 경보"}</label>
              <AdminSelect id="externalMonitoringAlert" value={alertLevel} onChange={(event) => setAlertLevel(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="NONE">{en ? "No Alerts" : "경보 없음"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setHealthStatus("ALL"); setAlertLevel("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-monitoring-overview">
          <GridToolbar title={en ? "Monitoring Overview" : "연계 모니터링 현황"} meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")} actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                  <th className="px-4 py-3">{en ? "Traffic" : "호출량"}</th>
                  <th className="px-4 py-3">{en ? "Success" : "성공률"}</th>
                  <th className="px-4 py-3">{en ? "Backlog" : "적체"}</th>
                  <th className="px-4 py-3">{en ? "Alerts" : "경보"}</th>
                  <th className="px-4 py-3">{en ? "Health" : "건강 상태"}</th>
                  <th className="px-4 py-3">{en ? "Last Seen" : "최근 관측"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "connectionId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "connectionId")} / {stringOf(row, "partnerName")}</p>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "requestCount")}</td>
                    <td className="px-4 py-3">{stringOf(row, "successRate")}</td>
                    <td className="px-4 py-3">{stringOf(row, "backlogCount")}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "topAlertLevel"))}`}>{stringOf(row, "topAlertLevel") || "NONE"}</span>
                        <span className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? `${stringOf(row, "alertCount")} active` : `활성 ${stringOf(row, "alertCount")}건`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "lastObservedAt")}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? <tr className="border-t border-[var(--kr-gov-border-light)]"><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={7}>{en ? "No monitored connections match the current filters." : "현재 조건에 맞는 연계 모니터링 대상이 없습니다."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-monitoring-alerts">
            <GridToolbar title={en ? "Active Alerts" : "활성 경보"} meta={en ? "Backlog, usage degradation, and webhook risks are merged into one triage queue." : "적체, 사용량 저하, 웹훅 위험 신호를 하나의 조치 큐로 통합했습니다."} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Severity" : "등급"}</th><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Alert" : "경보 내용"}</th><th className="px-4 py-3">{en ? "Action" : "권장 조치"}</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {alertRows.map((row, index) => (
                    <tr key={`${stringOf(row, "alertId")}-${index}`}>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "severity"))}`}>{stringOf(row, "severity")}</span></td>
                      <td className="px-4 py-3"><a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a><p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "connectionId")}</p></td>
                      <td className="px-4 py-3">{stringOf(row, "title")}</td>
                      <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "recommendedAction")}</td>
                    </tr>
                  ))}
                  {alertRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>{en ? "There are no active monitoring alerts." : "현재 활성 경보가 없습니다."}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <article className="gov-card overflow-hidden p-0" data-help-id="external-monitoring-timeline">
              <GridToolbar title={en ? "Recent Monitoring Timeline" : "최근 모니터링 타임라인"} meta={en ? "Latest follow-up points and linked destinations." : "최근 조치 포인트와 연결된 후속 화면입니다."} />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Time" : "시각"}</th><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Summary" : "요약"}</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {timelineRows.map((row, index) => (
                      <tr key={`${stringOf(row, "timelineId")}-${index}`}>
                        <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "occurredAt")}</td>
                        <td className="px-4 py-3"><a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a></td>
                        <td className="px-4 py-3">{stringOf(row, "summary")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <CollectionResultPanel data-help-id="external-monitoring-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move directly into adjacent operational pages." : "후속 조치가 필요한 운영 화면으로 바로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>{stringOf(item, "label", "title")}</a>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-monitoring-guidance" title={en ? "Operating Guidance" : "운영 가이드"} description={en ? "Use the same baseline before rerun, pause, or escalation." : "재실행, 중지, 승격 전에는 같은 판단 기준을 적용합니다."} icon="fact_check">
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
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
