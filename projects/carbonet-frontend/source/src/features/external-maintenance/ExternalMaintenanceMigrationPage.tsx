import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalMaintenancePage } from "../../lib/api/ops";
import type { ExternalMaintenancePagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

type MaintenanceCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const MAINTENANCE_CLOSEOUT_ROWS: MaintenanceCloseoutRow[] = [
  {
    titleKo: "점검 대상/영향 조회",
    titleEn: "Maintenance inventory / impact visibility",
    status: "Available",
    detailKo: "예정 시각, 점검 윈도우, 영향 범위, 대체 경로, 운영 런북은 현재 payload로 조회됩니다.",
    detailEn: "Planned time, maintenance window, impact scope, fallback route, and runbook are visible from the current payload."
  },
  {
    titleKo: "점검 윈도우 CRUD",
    titleEn: "Maintenance window CRUD",
    status: "Blocked",
    detailKo: "생성/수정/취소 API, 시간 충돌 검증, 파트너별 제한 시간 정책, 변경 감사가 필요합니다.",
    detailEn: "Create/update/cancel APIs, time-conflict checks, partner window policy, and change audit are required."
  },
  {
    titleKo: "승인 / 해제 전이",
    titleEn: "Approval / release transitions",
    status: "Blocked",
    detailKo: "승인 요청, 승인/반려, 점검 시작, 복구 확인, 해제 상태 전이와 권한 기능 코드가 필요합니다.",
    detailEn: "Approval request, approve/reject, start, recovery proof, release transitions, and feature codes are required."
  },
  {
    titleKo: "영향 Scope / 공지",
    titleEn: "Affected scope / notice plan",
    status: "Blocked",
    detailKo: "영향 연계/메뉴/담당자 preview, 알림센터 공지 계획, 수신자 마스킹 응답이 필요합니다.",
    detailEn: "Affected connection/menu/owner preview, notification-center notice plan, and masked recipients are required."
  },
  {
    titleKo: "Backlog replay / Incident",
    titleEn: "Backlog replay / incident linkage",
    status: "Blocked",
    detailKo: "점검 중 적체 replay 정책, 실패 시 incident 생성, 복구 증적과 감사 연결이 필요합니다.",
    detailEn: "Maintenance backlog replay policy, incident creation on failure, recovery evidence, and audit linkage are required."
  }
];

const MAINTENANCE_ACTION_CONTRACT = [
  {
    labelKo: "점검 등록",
    labelEn: "Create Window",
    noteKo: "점검 윈도우 저장 API와 시간 충돌 검증이 필요합니다.",
    noteEn: "Requires maintenance window save API and time-conflict validation."
  },
  {
    labelKo: "승인 요청",
    labelEn: "Request Approval",
    noteKo: "승인 workflow, 반려 사유, 권한 기능 코드가 필요합니다.",
    noteEn: "Requires approval workflow, rejection reason, and feature codes."
  },
  {
    labelKo: "공지 계획 생성",
    labelEn: "Build Notice Plan",
    noteKo: "영향 scope preview와 알림센터 수신자 계약이 필요합니다.",
    noteEn: "Requires affected scope preview and notification-center recipient contract."
  },
  {
    labelKo: "Backlog Replay",
    labelEn: "Replay Backlog",
    noteKo: "점검 종료 후 적체 replay 실행기, 멱등키, 결과 감사가 필요합니다.",
    noteEn: "Requires post-maintenance replay runner, idempotency key, and result audit."
  },
  {
    labelKo: "Incident 생성",
    labelEn: "Open Incident",
    noteKo: "복구 실패 신호와 incident 생성/연계 API가 필요합니다.",
    noteEn: "Requires recovery-failure signal and incident create/link API."
  }
];

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("BLOCKED") || upper.includes("DANGER")) return "bg-red-100 text-red-700";
  if (upper.includes("DUE") || upper.includes("WARN")) return "bg-amber-100 text-amber-700";
  if (upper.includes("READY") || upper.includes("NEUTRAL")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function ExternalMaintenanceMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<ExternalMaintenancePagePayload>(fetchExternalMaintenancePage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalMaintenanceSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalMaintenanceRows || []) as Array<Record<string, string>>), [page]);
  const impactRows = useMemo(() => ((page?.externalMaintenanceImpactRows || []) as Array<Record<string, string>>), [page]);
  const runbooks = useMemo(() => ((page?.externalMaintenanceRunbooks || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalMaintenanceQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalMaintenanceGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState("");
  const [syncMode, setSyncMode] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword = !normalizedKeyword || [
        stringOf(row, "connectionId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "ownerName")
      ].join(" ").toLowerCase().includes(normalizedKeyword);
      const matchesSyncMode = syncMode === "ALL" || stringOf(row, "syncMode").toUpperCase() === syncMode;
      const matchesStatus = status === "ALL" || stringOf(row, "maintenanceStatus").toUpperCase() === status;
      return matchesKeyword && matchesSyncMode && matchesStatus;
    });
  }, [keyword, rows, status, syncMode]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-maintenance", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      syncMode,
      status
    });
  }, [en, filteredRows.length, rows.length, status, syncMode]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Maintenance" : "점검 관리" }
      ]}
      title={en ? "Maintenance" : "점검 관리"}
      subtitle={en ? "Track maintenance windows, impact scope, fallback paths, and recovery proof for external integrations." : "외부연계 점검 윈도우, 영향 범위, 대체 경로, 복구 확인 항목을 함께 관리합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/sync", "/en/admin/external/sync")}>
            {en ? "Sync Execution" : "동기화 실행"}
          </a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/retry", "/en/admin/external/retry")}>
            {en ? "Retry Control" : "재시도 관리"}
          </a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external maintenance plan..." : "외부연계 점검 현황을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-maintenance-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "title")}-${index}`}
              title={stringOf(item, "title")}
              value={stringOf(item, "value")}
              description={stringOf(item, "description")}
            />
          ))}
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-maintenance-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for maintenance operations" : "점검 운영 완성을 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page is currently a visibility and runbook console. Mutation and state-transition actions stay disabled until maintenance CRUD, approval/release, affected scope, notice, replay, incident, and audit contracts are implemented."
                    : "이 화면은 현재 조회와 런북 중심의 점검 콘솔입니다. 점검 CRUD, 승인/해제, 영향 scope, 공지, replay, incident, 감사 계약이 구현되기 전까지 상태 변경 조치는 비활성화합니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / transition actions blocked" : "PARTIAL / 전이 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {MAINTENANCE_CLOSEOUT_ROWS.map((row) => (
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
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="external-maintenance-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Maintenance Actions" : "차단된 점검 변경 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Keep inventory and runbook review active; enable these actions only after workflow, authorization, and audit are connected." : "점검 현황과 런북 조회는 유지하되, workflow·권한·감사가 연결된 뒤에만 아래 조치를 활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {MAINTENANCE_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CollectionResultPanel
          data-help-id="external-maintenance-filters"
          title={en ? "Maintenance Filters" : "점검 조회 조건"}
          description={en ? "Narrow the maintenance queue before coordinating fallback routing, partner notice, or recovery proof." : "대체 경로, 파트너 공지, 복구 증적을 조정하기 전에 점검 대상을 좁힙니다."}
          icon="build"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMaintenanceKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalMaintenanceKeyword" placeholder={en ? "Connection, partner, owner" : "연계명, 기관명, 담당자"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMaintenanceMode">{en ? "Sync Mode" : "동기화 방식"}</label>
              <AdminSelect id="externalMaintenanceMode" value={syncMode} onChange={(event) => setSyncMode(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="SCHEDULED">{en ? "Scheduled" : "스케줄 수집"}</option>
                <option value="HYBRID">{en ? "Hybrid" : "혼합형"}</option>
                <option value="WEBHOOK">{en ? "Webhook" : "웹훅"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalMaintenanceStatus">{en ? "Status" : "점검 상태"}</label>
              <AdminSelect id="externalMaintenanceStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="READY">READY</option>
                <option value="DUE_SOON">DUE_SOON</option>
                <option value="BLOCKED">BLOCKED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" onClick={() => { setKeyword(""); setSyncMode("ALL"); setStatus("ALL"); }} type="button">
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-maintenance-inventory">
          <GridToolbar
            actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>}
            meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
            title={en ? "Maintenance Inventory" : "점검 대상 현황"}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                  <th className="px-4 py-3">{en ? "Mode" : "방식"}</th>
                  <th className="px-4 py-3">{en ? "Planned At" : "예정 시각"}</th>
                  <th className="px-4 py-3">{en ? "Window" : "점검 윈도우"}</th>
                  <th className="px-4 py-3">{en ? "Impact" : "영향 범위"}</th>
                  <th className="px-4 py-3">{en ? "Fallback" : "대체 경로"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "maintenanceId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                        {stringOf(row, "connectionName")}
                      </a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "connectionId")} / {stringOf(row, "ownerName")}</p>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "syncMode")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "plannedAt")}</td>
                    <td className="px-4 py-3">{stringOf(row, "maintenanceWindow")}</td>
                    <td className="px-4 py-3">{stringOf(row, "impactScope")}</td>
                    <td className="px-4 py-3">{stringOf(row, "fallbackRoute")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "maintenanceStatus"))}`}>{stringOf(row, "maintenanceStatus")}</span>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                      {en ? "No maintenance targets match the current filters." : "현재 조건에 맞는 점검 대상이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-maintenance-impact">
            <GridToolbar title={en ? "Impact Review" : "영향 검토"} meta={en ? "Operator actions are paired with fallback routing for each row." : "각 항목마다 운영 조치와 대체 경로를 함께 제시합니다."} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                    <th className="px-4 py-3">{en ? "Impact" : "영향"}</th>
                    <th className="px-4 py-3">{en ? "Fallback" : "대체 경로"}</th>
                    <th className="px-4 py-3">{en ? "Operator Action" : "운영 조치"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {impactRows.map((row, index) => (
                    <tr key={`${stringOf(row, "connectionName")}-${index}`}>
                      <td className="px-4 py-3 font-bold">{stringOf(row, "connectionName")}</td>
                      <td className="px-4 py-3">{stringOf(row, "impactScope")}</td>
                      <td className="px-4 py-3">{stringOf(row, "fallbackRoute")}</td>
                      <td className="px-4 py-3">{stringOf(row, "operatorAction")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <CollectionResultPanel data-help-id="external-maintenance-runbook" title={en ? "Runbook" : "운영 런북"} description={en ? "Keep the same operating sequence before, during, and after the maintenance window." : "점검 전, 점검 중, 복구 후 절차를 같은 순서로 유지합니다."} icon="fact_check">
              <div className="space-y-3">
                {runbooks.map((item, index) => (
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

            <CollectionResultPanel data-help-id="external-maintenance-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move into adjacent operational screens without losing the maintenance context." : "점검 맥락을 유지한 채 인접 운영 화면으로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>
                    {stringOf(item, "label", "title")}
                  </a>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-maintenance-guidance" title={en ? "Guidance" : "운영 가이드"} description={en ? "Maintenance closure needs runtime proof, not just a status flip." : "점검 종료는 상태 변경이 아니라 실제 복구 확인까지 포함해야 합니다."} icon="schedule">
              <div className="space-y-3">
                {guidance.map((item, index) => (
                  <div key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm">
                    <strong>{stringOf(item, "title")}</strong>
                    <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p>
                  </div>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
