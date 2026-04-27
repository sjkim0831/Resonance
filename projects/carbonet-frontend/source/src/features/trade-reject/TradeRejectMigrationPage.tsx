import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { submitTradeRejectAction } from "../../lib/api/adminActions";
import { readBootstrappedTradeRejectPageData } from "../../lib/api/bootstrap";
import { fetchTradeRejectPage } from "../../lib/api/trade";
import type { TradeRejectPagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, getSearchParam, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  CollectionResultPanel,
  GridToolbar,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  MemberActionBar,
  MemberButton,
  MemberLinkButton,
  PageStatusNotice
} from "../member/common";

function readString(value: unknown) {
  return String(value || "");
}

function rowsOf(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function readTradeId() {
  return getSearchParam("tradeId");
}

function readReturnUrl() {
  const fallback = buildLocalizedPath("/admin/trade/list", "/en/admin/trade/list");
  const raw = getSearchParam("returnUrl");
  if (!raw || typeof window === "undefined") {
    return fallback;
  }
  try {
    const decoded = decodeURIComponent(raw);
    const next = new URL(decoded, window.location.origin);
    if (next.origin !== window.location.origin) {
      return fallback;
    }
    if (!(next.pathname.startsWith("/admin/") || next.pathname.startsWith("/en/admin/"))) {
      return fallback;
    }
    return `${next.pathname}${next.search}${next.hash}`;
  } catch {
    return fallback;
  }
}

function tradeStatusBadgeClass(code: string) {
  switch (code) {
    case "HOLD": return "bg-rose-100 text-rose-700";
    case "APPROVED": return "bg-blue-100 text-blue-700";
    case "COMPLETED": return "bg-emerald-100 text-emerald-700";
    default: return "bg-amber-100 text-amber-700";
  }
}

function settlementStatusBadgeClass(code: string) {
  switch (code) {
    case "EXCEPTION": return "bg-rose-100 text-rose-700";
    case "DONE": return "bg-emerald-100 text-emerald-700";
    case "IN_PROGRESS": return "bg-indigo-100 text-indigo-700";
    default: return "bg-amber-100 text-amber-700";
  }
}

function severityClassName(value: string) {
  switch (value) {
    case "high": return "bg-rose-50 text-rose-700 border-rose-200";
    case "medium": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function TradeRejectMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const tradeId = readTradeId();
  const returnUrl = readReturnUrl();
  const initialPayload = useMemo(() => readBootstrappedTradeRejectPageData(), []);
  const canUseInitialPayload = readString(initialPayload?.tradeId) === tradeId;
  const pageState = useAsyncValue<TradeRejectPagePayload>(
    () => fetchTradeRejectPage({ tradeId, returnUrl }),
    [tradeId, returnUrl],
    {
      initialValue: canUseInitialPayload ? initialPayload : null,
      skipInitialLoad: canUseInitialPayload
    }
  );
  const page = pageState.value;
  const found = Boolean(page?.found);
  const error = pageState.error || readString(page?.pageError);
  const rejectionChecklist = rowsOf(page?.rejectionChecklist);
  const rejectionReasons = rowsOf(page?.rejectionReasons);
  const evidenceRows = rowsOf(page?.evidenceRows);
  const historyRows = rowsOf(page?.historyRows);
  const notificationPlan = rowsOf(page?.notificationPlan);
  const quickLinks = rowsOf(page?.quickLinks);
  const [rejectReason, setRejectReason] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!page) {
      return;
    }
    setRejectReason(readString(page.suggestedReason));
    setOperatorNote("");
  }, [page]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "trade-reject", {
      language: en ? "en" : "ko",
      tradeId,
      found,
      blockerCount: Number(page.blockerCount || 0),
      evidenceCount: evidenceRows.length,
      historyCount: historyRows.length
    });
  }, [en, evidenceRows.length, found, historyRows.length, page, tradeId]);

  async function handleSubmit() {
    if (!sessionState.value) {
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");
    try {
      const result = await submitTradeRejectAction(sessionState.value, {
        tradeId,
        rejectReason,
        operatorNote
      });
      setSubmitMessage(readString(result.message));
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error
        ? submitErr.message
        : (en ? "Failed to submit the rejection review." : "반려 검토 제출에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Trade" : "거래" },
        { label: en ? "Trade List" : "거래 목록", href: returnUrl },
        { label: en ? "Reject Review" : "반려 검토" }
      ]}
      title={en ? "Trade Reject Review" : "거래 반려 검토"}
      subtitle={en ? "Review blockers, evidence gaps, and operator communication before sending a trade back for correction." : "거래를 보완 요청 상태로 되돌리기 전 차단 사유, 증빙 누락, 운영 커뮤니케이션 범위를 정리합니다."}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading trade reject review." : "거래 반려 검토 화면을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {submitMessage ? <PageStatusNotice tone="success">{submitMessage}</PageStatusNotice> : null}
        {submitError ? <PageStatusNotice tone="error">{submitError}</PageStatusNotice> : null}
        {!tradeId ? (
          <PageStatusNotice tone="warning">{en ? "A trade ID is required to open this page." : "이 화면은 거래 ID가 있어야 열 수 있습니다."}</PageStatusNotice>
        ) : null}

        {found ? (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-help-id="trade-reject-summary">
              <SummaryMetricCard title={en ? "Blockers" : "차단 사유"} value={String(Number(page?.blockerCount || 0))} />
              <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "Evidence Gaps" : "증빙 누락"} value={String(Number(page?.evidenceCount || evidenceRows.length || 0))} />
              <SummaryMetricCard accentClassName="text-indigo-600" surfaceClassName="bg-indigo-50" title={en ? "Review History" : "검토 이력"} value={String(Number(page?.historyCount || historyRows.length || 0))} />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="gov-card" data-help-id="trade-reject-overview">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-text-secondary)]">{readString(page?.tradeId)}</p>
                    <h2 className="mt-2 text-2xl font-bold text-[var(--kr-gov-text-primary)]">{readString(page?.contractName) || "-"}</h2>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                      {`${readString(page?.sellerName) || "-"} -> ${readString(page?.buyerName) || "-"}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tradeStatusBadgeClass(readString(page?.tradeStatusCode))}`}>
                      {readString(page?.tradeStatusLabel) || "-"}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${settlementStatusBadgeClass(readString(page?.settlementStatusCode))}`}>
                      {readString(page?.settlementStatusLabel) || "-"}
                    </span>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    [en ? "Product" : "상품", readString(page?.productType) || "-"],
                    [en ? "Quantity" : "거래 수량", readString(page?.quantity) || "-"],
                    [en ? "Amount" : "거래 금액", readString(page?.amount) || "-"],
                    [en ? "Requested At" : "요청 일시", readString(page?.requestedAt) || "-"]
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{label}</p>
                      <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm font-medium text-[var(--kr-gov-text-primary)]">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <CollectionResultPanel
                data-help-id="trade-reject-checklist"
                description={en ? "Confirm the rejection scope before notifying both counterparties." : "양측 기관에 통지하기 전에 반려 범위를 확정합니다."}
                icon="rule"
                title={en ? "Reject Review Focus" : "반려 검토 포인트"}
              >
                <div className="space-y-3">
                  {rejectionChecklist.map((item, index) => (
                    <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${severityClassName(readString(item.severity))}`} key={`${readString(item.title)}-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{readString(item.title) || "-"}</p>
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{readString(item.severity) || "info"}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{readString(item.detail) || "-"}</p>
                    </div>
                  ))}
                </div>
              </CollectionResultPanel>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="gov-card" data-help-id="trade-reject-form">
                <GridToolbar meta={en ? "Record the message that will be sent back to the counterparties." : "양측 기관에 되돌려 보낼 보완 지시를 기록합니다."} title={en ? "Reject Decision Draft" : "반려 결정 초안"} />
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Recommended reason" : "권장 반려 사유"}</span>
                    <select className="gov-select" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}>
                      <option value="">{en ? "Select a reason" : "사유를 선택하세요"}</option>
                      {rejectionReasons.map((reason, index) => (
                        <option key={`${readString(reason.code)}-${index}`} value={readString(reason.label)}>{readString(reason.label)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Operator note" : "운영 메모"}</span>
                    <textarea
                      className="gov-textarea min-h-[160px]"
                      placeholder={en ? "Describe exactly what must be corrected before re-submission." : "재제출 전에 반드시 보완해야 할 내용을 구체적으로 작성하세요."}
                      value={operatorNote}
                      onChange={(event) => setOperatorNote(event.target.value)}
                    />
                  </label>
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Use explicit document names, quantity ranges, and due dates so the seller and buyer correct the same scope."
                      : "매도·매수 기관이 동일 범위를 수정할 수 있도록 문서명, 수량 범위, 기한을 명시하세요."}
                  </div>
                  <div className="flex justify-end">
                    <MemberButton disabled={submitting || !sessionState.value} onClick={handleSubmit} type="button" variant="primary">
                      {submitting ? (en ? "Submitting..." : "제출 중...") : (en ? "Record Reject Review" : "반려 검토 기록")}
                    </MemberButton>
                  </div>
                </div>
              </section>

              <section className="gov-card overflow-hidden p-0" data-help-id="trade-reject-evidence">
                <GridToolbar meta={en ? "Compare evidence quality and identify what must be re-submitted." : "증빙 품질을 비교해 재제출 대상만 분리합니다."} title={en ? "Evidence Review" : "증빙 검토"} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm text-left">
                    <thead>
                      <tr className="gov-table-header">
                        <th className="px-6 py-4">{en ? "File" : "파일명"}</th>
                        <th className="px-6 py-4">{en ? "Category" : "구분"}</th>
                        <th className="px-6 py-4">{en ? "Status" : "상태"}</th>
                        <th className="px-6 py-4">{en ? "Owner" : "제출 주체"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {evidenceRows.map((row, index) => (
                        <tr key={`${readString(row.fileName)}-${index}`}>
                          <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-primary)]">{readString(row.fileName) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.category) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.statusLabel) || "-"}</td>
                          <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{readString(row.owner) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="gov-card overflow-hidden p-0" data-help-id="trade-reject-history">
                <GridToolbar meta={en ? "Track what was already requested and where the mismatch remained." : "이미 요청된 보완 내용과 불일치가 남은 지점을 확인합니다."} title={en ? "Review Timeline" : "검토 타임라인"} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm text-left">
                    <thead>
                      <tr className="gov-table-header">
                        <th className="px-6 py-4">{en ? "Occurred At" : "발생 일시"}</th>
                        <th className="px-6 py-4">{en ? "Actor" : "주체"}</th>
                        <th className="px-6 py-4">{en ? "Action" : "행동"}</th>
                        <th className="px-6 py-4">{en ? "Note" : "메모"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyRows.map((row, index) => (
                        <tr key={`${readString(row.occurredAt)}-${index}`}>
                          <td className="px-6 py-4">{readString(row.occurredAt) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.actor) || "-"}</td>
                          <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-primary)]">{readString(row.actionLabel) || "-"}</td>
                          <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{readString(row.note) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <CollectionResultPanel
                data-help-id="trade-reject-notification"
                description={en ? "Align the partner notification path before recording the rejection." : "반려 기록 전에 대외 통지 경로를 맞춥니다."}
                icon="campaign"
                title={en ? "Notification Plan" : "통지 계획"}
              >
                <div className="space-y-3">
                  {notificationPlan.map((item, index) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${readString(item.target)}-${index}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{readString(item.target) || "-"}</p>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{readString(item.channel) || "-"}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{readString(item.detail) || "-"}</p>
                    </div>
                  ))}
                </div>
              </CollectionResultPanel>
            </section>

            <MemberActionBar
              dataHelpId="trade-reject-actions"
              description={en ? "Return to the trade queue or continue into adjacent review flows after recording the rejection scope." : "반려 범위를 기록한 뒤 거래 목록으로 돌아가거나 인접 검토 흐름으로 이어집니다."}
              eyebrow={en ? "Trade Review Flow" : "거래 검토 흐름"}
              primary={(
                <MemberLinkButton href={returnUrl} icon="arrow_back" size="lg" variant="primary">
                  {en ? "Back to Trade List" : "거래 목록으로"}
                </MemberLinkButton>
              )}
              secondary={quickLinks[1] ? { href: readString(quickLinks[1].href), icon: "fact_check", label: readString(quickLinks[1].label) } : undefined}
              tertiary={quickLinks[2] ? { href: readString(quickLinks[2].href), icon: "assignment", label: readString(quickLinks[2].label) } : undefined}
              title={en ? "Next operator actions" : "다음 운영 작업"}
            />
          </>
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
