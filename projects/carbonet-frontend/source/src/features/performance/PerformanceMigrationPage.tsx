import { logGovernanceScope } from "../../app/policy/debug";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { fetchPerformancePage } from "../../lib/api/ops";
import type { PerformancePagePayload } from "../../lib/api/opsTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type PerformanceCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const PERFORMANCE_CLOSEOUT_ROWS: PerformanceCloseoutRow[] = [
  {
    titleKo: "최근 요청/JVM 진단",
    titleEn: "Recent request / JVM diagnostics",
    status: "Available",
    detailKo: "현재 page-data는 JVM 용량과 최근 요청 실행 로그를 읽어 요약, hotspot, 지연/오류 요청을 보여줍니다.",
    detailEn: "Current page-data reads JVM capacity and recent request execution logs for summaries, hotspots, and slow/error rows."
  },
  {
    titleKo: "임계치 관리",
    titleEn: "Threshold management",
    status: "Blocked",
    detailKo: "slow threshold, heap, error rate, p95 기준은 화면에서 저장할 수 없습니다. persisted 정책 또는 설정 소스가 필요합니다.",
    detailEn: "Slow threshold, heap, error-rate, and p95 thresholds cannot be saved here yet. A persisted policy/config source is required."
  },
  {
    titleKo: "알림/인시던트 연계",
    titleEn: "Alert / incident linkage",
    status: "Blocked",
    detailKo: "성능 악화가 알림 규칙, 운영센터 인시던트, 담당자 배정으로 이어지는 실행 포트가 필요합니다.",
    detailEn: "Performance degradation needs action ports into alert rules, Operations Center incidents, and assignee routing."
  },
  {
    titleKo: "내보내기/보존기간",
    titleEn: "Export / retention",
    status: "Blocked",
    detailKo: "CSV/감사용 export와 request log 보존기간 정책이 아직 화면 계약에 연결되지 않았습니다.",
    detailEn: "CSV/audit export and request-log retention policy are not yet bound to this screen contract."
  },
  {
    titleKo: "추세 비교",
    titleEn: "Trend comparison",
    status: "Blocked",
    detailKo: "현재는 최근 샘플 중심입니다. 배포 전후, 시간대별, 기준선 대비 추세 비교 저장소가 필요합니다.",
    detailEn: "The current view is sample-based. It needs storage for before/after deploy, time-window, and baseline trend comparisons."
  }
];

const PERFORMANCE_ACTION_CONTRACT = [
  {
    labelKo: "임계치 저장",
    labelEn: "Save Thresholds",
    noteKo: "성능 임계치 정책 저장 API와 변경 감사가 필요합니다.",
    noteEn: "Requires threshold policy save API and change audit."
  },
  {
    labelKo: "알림 규칙 연결",
    labelEn: "Link Alert Rule",
    noteKo: "알림센터 rule id, 조건, 수신 범위, 테스트 발송 결과가 필요합니다.",
    noteEn: "Requires notification rule id, condition, recipient scope, and test dispatch result."
  },
  {
    labelKo: "성능 리포트 Export",
    labelEn: "Export Report",
    noteKo: "마스킹/보존기간/감사 이벤트가 포함된 export API가 필요합니다.",
    noteEn: "Requires export API with masking, retention, and audit event handling."
  },
  {
    labelKo: "인시던트 생성",
    labelEn: "Open Incident",
    noteKo: "운영센터 인시던트 lifecycle, 담당자, trace 연결이 필요합니다.",
    noteEn: "Requires Operations Center incident lifecycle, assignee, and trace binding."
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
  if (upper.includes("CRITICAL") || upper.includes("DANGER")) {
    return "bg-red-100 text-red-700";
  }
  if (upper.includes("WARNING")) {
    return "bg-amber-100 text-amber-700";
  }
  if (upper.includes("HEALTHY")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function metricToneClass(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("danger")) {
    return "border-red-200 bg-red-50";
  }
  if (lower.includes("warning")) {
    return "border-amber-200 bg-amber-50";
  }
  return "border-slate-200 bg-white";
}

export function PerformanceMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<PerformancePagePayload>(fetchPerformancePage, [], {});
  const page = pageState.value;
  const runtimeSummary = ((page?.runtimeSummary || []) as Array<Record<string, string>>);
  const requestSummary = ((page?.requestSummary || []) as Array<Record<string, string>>);
  const hotspotRoutes = ((page?.hotspotRoutes || []) as Array<Record<string, string>>);
  const recentSlowRequests = ((page?.recentSlowRequests || []) as Array<Record<string, string>>);
  const responseStatusSummary = ((page?.responseStatusSummary || []) as Array<Record<string, string>>);
  const quickLinks = ((page?.quickLinks || []) as Array<Record<string, string>>);
  const guidance = ((page?.guidance || []) as Array<Record<string, string>>);
  const overallStatus = stringOf(page as Record<string, unknown>, "overallStatus");
  const refreshedAt = stringOf(page as Record<string, unknown>, "refreshedAt");
  const slowThresholdMs = stringOf(page as Record<string, unknown>, "slowThresholdMs") || "1000";
  const requestWindowSize = stringOf(page as Record<string, unknown>, "requestWindowSize") || "200";

  logGovernanceScope("PAGE", "performance", {
    language: en ? "en" : "ko",
    overallStatus,
    runtimeSummaryCount: runtimeSummary.length,
    requestSummaryCount: requestSummary.length,
    hotspotRouteCount: hotspotRoutes.length,
    recentSlowRequestCount: recentSlowRequests.length
  });

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Performance" : "성능" }
      ]}
      title={en ? "Performance" : "성능"}
      subtitle={en ? "Review current JVM capacity and recent request latency without leaving the admin console." : "관리 콘솔에서 현재 JVM 여유와 최근 요청 지연을 함께 점검합니다."}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading performance page..." : "성능 화면을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="gov-card overflow-hidden" data-help-id="performance-status">
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Current Status" : "현재 상태"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-black ${toneClass(overallStatus)}`}>
                  {overallStatus || "UNKNOWN"}
                </span>
                <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {(en ? "Refreshed at " : "갱신 시각 ") + refreshedAt}
                </span>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? `Sampled from the latest ${requestWindowSize} request execution logs. Slow threshold is ${slowThresholdMs}ms.`
                : `최근 ${requestWindowSize}건 요청 실행 로그를 기준으로 계산했습니다. 지연 기준은 ${slowThresholdMs}ms입니다.`}
            </p>
          </div>
        </section>

        <section className="gov-card overflow-hidden" data-help-id="performance-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for governed performance operations" : "성능 운영 화면 완성을 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page already reads recent request and JVM signals. It is still not a full performance governance console until thresholds, alert rules, export, retention, trend comparison, incident handoff, and audit are connected."
                    : "이 화면은 이미 최근 요청과 JVM 신호를 읽습니다. 다만 임계치, 알림 규칙, export, 보존기간, 추세 비교, 인시던트 핸드오프, 감사가 연결되기 전까지는 완성된 성능 거버넌스 콘솔이 아닙니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / policy actions blocked" : "PARTIAL / 정책 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {PERFORMANCE_CLOSEOUT_ROWS.map((row) => (
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
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="performance-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Governance Actions" : "차단된 거버넌스 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "These actions stay disabled until backend contracts, permissions, retention, and audit evidence exist." : "백엔드 계약, 권한, 보존기간, 감사 증적이 생기기 전까지 아래 조치는 비활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PERFORMANCE_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(180deg,rgba(248,251,255,0.96),rgba(255,255,255,1))] p-5" data-help-id="performance-runtime">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime" : "런타임"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "JVM Capacity" : "JVM 용량 현황"}</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {runtimeSummary.map((item, index) => (
                <article key={`${stringOf(item, "title")}-${index}`} className={`rounded-[var(--kr-gov-radius)] border p-4 ${metricToneClass(stringOf(item, "tone"))}`}>
                  <SummaryMetricCard
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    title={stringOf(item, "title")}
                    description={stringOf(item, "description")}
                    value={stringOf(item, "value")}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5" data-help-id="performance-request-summary">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Request Window" : "요청 윈도우"}</p>
            <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Latency Summary" : "지연 요약"}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {requestSummary.map((item, index) => (
                <article key={`${stringOf(item, "title")}-${index}`} className={`rounded-[var(--kr-gov-radius)] border p-4 ${metricToneClass(stringOf(item, "tone"))}`}>
                  <SummaryMetricCard
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    title={stringOf(item, "title")}
                    description={stringOf(item, "description")}
                    value={stringOf(item, "value")}
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
          <CollectionResultPanel
            title={en ? "Hotspot Routes" : "지연 집중 경로"}
            description={en ? "Routes with the highest average or peak latency in the current sample." : "현재 샘플에서 평균 또는 최대 지연이 높은 경로입니다."}
            icon="speed"
            className="mb-0"
          >
            <div className="overflow-x-auto" data-help-id="performance-hotspot-routes">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">{en ? "Route" : "경로"}</th>
                    <th className="px-3 py-2">{en ? "Method" : "메서드"}</th>
                    <th className="px-3 py-2">{en ? "Avg" : "평균"}</th>
                    <th className="px-3 py-2">{en ? "Max" : "최대"}</th>
                    <th className="px-3 py-2">{en ? "Hits" : "건수"}</th>
                    <th className="px-3 py-2">{en ? "Slow" : "지연"}</th>
                    <th className="px-3 py-2">{en ? "Error" : "오류"}</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspotRoutes.map((row, index) => (
                    <tr key={`${stringOf(row, "requestUri")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                      <td className="px-3 py-3 font-mono text-xs">
                        <a className="text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                          {stringOf(row, "requestUri")}
                        </a>
                      </td>
                      <td className="px-3 py-3">{stringOf(row, "httpMethod")}</td>
                      <td className="px-3 py-3 font-bold">{stringOf(row, "avgDurationMs")}ms</td>
                      <td className="px-3 py-3">{stringOf(row, "maxDurationMs")}ms</td>
                      <td className="px-3 py-3">{stringOf(row, "hits")}</td>
                      <td className="px-3 py-3">{stringOf(row, "slowCount")}</td>
                      <td className="px-3 py-3">{stringOf(row, "errorCount")}</td>
                    </tr>
                  ))}
                  {hotspotRoutes.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {en ? "No request samples are available yet." : "아직 요청 샘플이 없습니다."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CollectionResultPanel>

          <div className="space-y-4">
            <CollectionResultPanel
              title={en ? "Response Distribution" : "응답 분포"}
              description={en ? "Status code and peak latency summary from the same sample." : "동일 샘플 기준 상태 코드와 최대 지연 요약입니다."}
              icon="analytics"
              className="mb-0"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-help-id="performance-response-distribution">
                {responseStatusSummary.map((item, index) => (
                  <article key={`${stringOf(item, "title")}-${index}`} className={`rounded-[var(--kr-gov-radius)] border p-4 ${metricToneClass(stringOf(item, "tone"))}`}>
                    <SummaryMetricCard
                      className="border-0 bg-transparent px-0 py-0 shadow-none"
                      title={stringOf(item, "title")}
                      description={stringOf(item, "description")}
                      value={stringOf(item, "value")}
                    />
                  </article>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel
              title={en ? "Quick Links" : "바로가기"}
              description={en ? "Move into deeper traces and error details." : "상세 추적과 오류 화면으로 바로 이동합니다."}
              icon="link"
              className="mb-0"
            >
              <div className="flex flex-wrap gap-2" data-help-id="performance-quick-links">
                {quickLinks.map((link, index) => (
                  <a
                    key={`${stringOf(link, "label")}-${index}`}
                    className="gov-btn gov-btn-outline"
                    href={stringOf(link, "targetRoute")}
                  >
                    {stringOf(link, "label")}
                  </a>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,1fr]">
          <CollectionResultPanel
            title={en ? "Recent Slow Or Error Requests" : "최근 지연/오류 요청"}
            description={en ? "Latest requests that crossed the slow threshold or returned an error response." : "지연 기준을 넘었거나 오류 응답을 반환한 최근 요청입니다."}
            icon="playlist_play"
            className="mb-0"
          >
            <div className="space-y-3" data-help-id="performance-slow-requests">
              {recentSlowRequests.map((row, index) => (
                <article key={`${stringOf(row, "traceId", "executedAt")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{stringOf(row, "httpMethod") || "GET"}</span>
                      <span className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "requestUri")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-black text-amber-800">{stringOf(row, "durationMs")}ms</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-black">{stringOf(row, "responseStatus")}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    <p><span className="font-bold">{en ? "Executed" : "실행 시각"}:</span> {stringOf(row, "executedAt") || "-"}</p>
                    <p><span className="font-bold">{en ? "Actor" : "사용자"}:</span> {stringOf(row, "actorUserId") || "-"}</p>
                    <p className="font-mono text-xs md:col-span-2"><span className="font-bold not-italic">{en ? "Trace" : "Trace"}:</span> {stringOf(row, "traceId") || "-"}</p>
                    {stringOf(row, "errorMessage") ? (
                      <p className="md:col-span-2"><span className="font-bold">{en ? "Error" : "오류"}:</span> {stringOf(row, "errorMessage")}</p>
                    ) : null}
                  </div>
                  {stringOf(row, "targetRoute") ? (
                    <div className="mt-3">
                      <a className="text-sm font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                        {en ? "Open related trace" : "연관 trace 열기"}
                      </a>
                    </div>
                  ) : null}
                </article>
              ))}
              {recentSlowRequests.length === 0 ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "No slow or error requests were found in the latest sample." : "최근 샘플에서 지연 또는 오류 요청이 발견되지 않았습니다."}
                </p>
              ) : null}
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Operator Guidance" : "운영 가이드"}
            description={en ? "Use the page as a fast triage surface, then move into the linked tools." : "이 화면은 빠른 분기점으로 사용하고 상세 분석은 연결된 도구에서 진행합니다."}
            icon="rule"
            className="mb-0"
          >
            <div className="space-y-3" data-help-id="performance-guidance">
              {guidance.map((item, index) => (
                <article key={`${stringOf(item, "title")}-${index}`} className={`rounded-[var(--kr-gov-radius)] border p-4 ${metricToneClass(stringOf(item, "tone"))}`}>
                  <h3 className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body")}</p>
                </article>
              ))}
            </div>
          </CollectionResultPanel>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
