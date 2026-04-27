import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalWebhooksPage } from "../../lib/api/ops";
import type { ExternalWebhooksPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

type WebhookCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const WEBHOOK_CLOSEOUT_ROWS: WebhookCloseoutRow[] = [
  {
    titleKo: "대상/전달 정책 조회",
    titleEn: "Target / delivery policy visibility",
    status: "Available",
    detailKo: "엔드포인트, 서명 상태, 성공률, 실패 건수, 이벤트별 재시도 정책은 현재 payload로 조회됩니다.",
    detailEn: "Endpoint, signature state, success rate, failure count, and event retry policy are visible from the current payload."
  },
  {
    titleKo: "엔드포인트 CRUD",
    titleEn: "Endpoint CRUD",
    status: "Blocked",
    detailKo: "생성/수정/비활성화 API, 중복 endpoint 검증, 파트너 scope 검증, 변경 감사가 필요합니다.",
    detailEn: "Create/update/disable APIs, duplicate endpoint checks, partner-scope validation, and change audit are required."
  },
  {
    titleKo: "서명 Secret 회전",
    titleEn: "Signing-secret rotation",
    status: "Blocked",
    detailKo: "secret 값 마스킹, 이중 secret grace period, 폐기 예약, 회전 이력 저장 계약이 필요합니다.",
    detailEn: "Secret masking, dual-secret grace period, retirement scheduling, and rotation history contracts are required."
  },
  {
    titleKo: "테스트 발송 / Replay",
    titleEn: "Test delivery / replay",
    status: "Blocked",
    detailKo: "운영 이벤트와 분리된 테스트 발송, 실패 이벤트 replay, 멱등키, 결과 이력이 필요합니다.",
    detailEn: "Test delivery separated from production events, failed-event replay, idempotency keys, and result history are required."
  },
  {
    titleKo: "실패 정책 저장",
    titleEn: "Failure policy save",
    status: "Blocked",
    detailKo: "timeout, retry, dead-letter, 알림 연동을 저장하고 변경 전후를 감사할 정책 모델이 필요합니다.",
    detailEn: "A policy model is required to save timeout, retry, dead-letter, notification linkage, and before/after audit."
  }
];

const WEBHOOK_ACTION_CONTRACT = [
  {
    labelKo: "엔드포인트 추가",
    labelEn: "Add Endpoint",
    noteKo: "endpoint CRUD API와 파트너 scope 권한 검증이 필요합니다.",
    noteEn: "Requires endpoint CRUD APIs and partner-scope authorization."
  },
  {
    labelKo: "Secret 회전",
    labelEn: "Rotate Secret",
    noteKo: "마스킹, 이중 secret 기간, 폐기 예약, 회전 감사가 필요합니다.",
    noteEn: "Requires masking, dual-secret grace window, retirement scheduling, and rotation audit."
  },
  {
    labelKo: "테스트 발송",
    labelEn: "Test Delivery",
    noteKo: "운영 발송과 분리된 테스트 API와 결과 이력이 필요합니다.",
    noteEn: "Requires a test-only API and result history separated from production delivery."
  },
  {
    labelKo: "실패 Replay",
    labelEn: "Replay Failed",
    noteKo: "실패 event id, 멱등키, replay 제한, 결과 감사가 필요합니다.",
    noteEn: "Requires failed event id, idempotency key, replay limits, and result audit."
  }
];

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("REVIEW") || upper.includes("FAILED")) return "bg-red-100 text-red-700";
  if (upper.includes("ACTIVE") || upper.includes("SUCCESS")) return "bg-emerald-100 text-emerald-700";
  if (upper.includes("DEGRADED")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function ExternalWebhooksMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [syncMode, setSyncMode] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const pageState = useAsyncValue<ExternalWebhooksPagePayload>(
    () => fetchExternalWebhooksPage({ keyword, syncMode, status }),
    [keyword, syncMode, status],
    {}
  );
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalWebhookSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalWebhookRows || []) as Array<Record<string, string>>), [page]);
  const deliveryRows = useMemo(() => ((page?.externalWebhookDeliveryRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalWebhookQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalWebhookGuidance || []) as Array<Record<string, string>>), [page]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-webhooks", {
      language: en ? "en" : "ko",
      keyword,
      syncMode,
      status,
      visibleRows: rows.length,
      deliveryRows: deliveryRows.length
    });
  }, [deliveryRows.length, en, keyword, rows.length, status, syncMode]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Webhooks" : "웹훅 설정" }
      ]}
      title={en ? "Webhooks" : "웹훅 설정"}
      subtitle={en ? "Review webhook targets, delivery state, and signature policy in one place." : "웹훅 대상, 전달 상태, 서명 정책을 한 화면에서 함께 점검합니다."}
      actions={<a className="gov-btn" href={buildLocalizedPath("/admin/external/schema", "/en/admin/external/schema")}>{en ? "Schema Registry" : "외부 스키마"}</a>}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading webhook settings..." : "웹훅 설정을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-webhooks-summary">
          {summary.map((item, index) => <SummaryMetricCard key={`${stringOf(item, "title")}-${index}`} title={stringOf(item, "title")} value={stringOf(item, "value")} description={stringOf(item, "description")} />)}
        </section>
        <section className="gov-card overflow-hidden p-0" data-help-id="external-webhooks-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for webhook operations" : "웹훅 운영 완성을 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page is currently a visibility console for endpoint state and delivery policy. Mutation actions stay disabled until CRUD, secret rotation, test delivery, replay, failure-policy persistence, and audit contracts are implemented."
                    : "이 화면은 현재 엔드포인트 상태와 전달 정책을 확인하는 조회 콘솔입니다. CRUD, secret 회전, 테스트 발송, replay, 실패 정책 저장, 감사 계약이 구현되기 전까지 변경 조치는 비활성화합니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / mutation actions blocked" : "PARTIAL / 변경 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {WEBHOOK_CLOSEOUT_ROWS.map((row) => (
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
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="external-webhooks-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Webhook Mutation Actions" : "차단된 웹훅 변경 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Keep read-only diagnostics active; enable these actions only after backend execution, authorization, and audit are connected." : "조회 진단은 유지하되, 백엔드 실행·권한·감사가 연결된 뒤에만 아래 조치를 활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <CollectionResultPanel data-help-id="external-webhooks-filters" title={en ? "Webhook Filters" : "웹훅 조회 조건"} description={en ? "Narrow targets by keyword, sync mode, or delivery status before opening the connection detail." : "연계 상세로 이동하기 전에 검색어, 연계 방식, 전달 상태 기준으로 범위를 좁힙니다."} icon="tune">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalWebhookKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalWebhookKeyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Connection, partner, endpoint" : "연계명, 기관명, 엔드포인트"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalWebhookSyncMode">{en ? "Sync Mode" : "연계 방식"}</label>
              <AdminSelect id="externalWebhookSyncMode" value={syncMode} onChange={(event) => setSyncMode(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="WEBHOOK">WEBHOOK</option>
                <option value="HYBRID">HYBRID</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalWebhookStatus">{en ? "Status" : "상태"}</label>
              <AdminSelect id="externalWebhookStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVIEW">REVIEW</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="DISABLED">DISABLED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setSyncMode("ALL"); setStatus("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>
        <section className="gov-card overflow-hidden p-0" data-help-id="external-webhooks-targets">
          <GridToolbar title={en ? "Webhook Targets" : "웹훅 대상"} meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")} actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `${rows.length} targets / ${deliveryRows.length} delivery policies` : `대상 ${rows.length}건 / 전달 정책 ${deliveryRows.length}건`}</p>} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                  <th className="px-4 py-3">{en ? "Mode" : "연계 방식"}</th>
                  <th className="px-4 py-3">{en ? "Signature" : "서명 상태"}</th>
                  <th className="px-4 py-3">{en ? "Success Rate" : "성공률"}</th>
                  <th className="px-4 py-3">{en ? "Failed" : "실패 건수"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${stringOf(row, "webhookId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "partnerName")}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "endpointUrl")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{stringOf(row, "syncMode")}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "lastEventAt")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{stringOf(row, "signatureStatus")}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "ownerName")}</div>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "successRate")}</td>
                    <td className="px-4 py-3">{stringOf(row, "failedCount")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                      {en ? "No webhook targets match the current filters." : "현재 조건에 맞는 웹훅 대상이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-webhooks-deliveries">
            <GridToolbar title={en ? "Recent Deliveries" : "최근 전달 이력"} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Webhook" : "웹훅"}</th>
                    <th className="px-4 py-3">{en ? "Event Type" : "이벤트 유형"}</th>
                    <th className="px-4 py-3">{en ? "Retry Policy" : "재시도 정책"}</th>
                    <th className="px-4 py-3">{en ? "Timeout" : "타임아웃"}</th>
                    <th className="px-4 py-3">{en ? "Failures" : "실패"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliveryRows.map((row, index) => (
                    <tr key={`${stringOf(row, "deliveryId")}-${index}`}>
                      <td className="px-4 py-3">
                        <div>{stringOf(row, "connectionName")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "lastDeliveryAt")}</div>
                      </td>
                      <td className="px-4 py-3">{stringOf(row, "eventType")}</td>
                      <td className="px-4 py-3">
                        <div>{stringOf(row, "retryPolicy")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "deadLetterPolicy")}</div>
                      </td>
                      <td className="px-4 py-3">{stringOf(row, "timeoutSeconds")}s</td>
                      <td className="px-4 py-3">{stringOf(row, "failedCount")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span>
                      </td>
                    </tr>
                  ))}
                  {deliveryRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                        {en ? "No delivery policies match the current filters." : "현재 조건에 맞는 전달 정책이 없습니다."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
          <div className="space-y-4">
            <CollectionResultPanel data-help-id="external-webhooks-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Open related registry and error screens." : "관련 레지스트리와 오류 화면으로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">{quickLinks.map((item, index) => <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>{stringOf(item, "label", "title")}</a>)}</div>
            </CollectionResultPanel>
            <CollectionResultPanel data-help-id="external-webhooks-guidance" title={en ? "Guidance" : "운영 가이드"} description={en ? "Verify signature and retry policy before changing delivery state." : "전달 상태를 바꾸기 전 서명과 재시도 정책을 먼저 확인합니다."} icon="fact_check">
              <div className="space-y-2">{guidance.map((item, index) => <div key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm"><strong>{stringOf(item, "title")}</strong><p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p></div>)}</div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
