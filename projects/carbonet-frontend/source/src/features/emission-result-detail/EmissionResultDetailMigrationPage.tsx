import { useEffect, useMemo } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  readBootstrappedEmissionResultDetailPageData
} from "../../lib/api/bootstrap";
import { fetchEmissionResultDetailPage } from "../../lib/api/emission";
import type { EmissionResultDetailPagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, getSearchParam, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  CollectionResultPanel,
  GridToolbar,
  MemberActionBar,
  MemberLinkButton,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

function readString(value: unknown) {
  return String(value || "");
}

function readReturnUrl() {
  const fallbackUrl = buildLocalizedPath("/admin/emission/result_list", "/en/admin/emission/result_list");
  const raw = getSearchParam("returnUrl");
  if (!raw || typeof window === "undefined") {
    return fallbackUrl;
  }
  try {
    const decoded = decodeURIComponent(raw);
    const nextUrl = new URL(decoded, window.location.origin);
    if (nextUrl.origin !== window.location.origin) {
      return fallbackUrl;
    }
    if (!(nextUrl.pathname.startsWith("/admin/") || nextUrl.pathname.startsWith("/en/admin/"))) {
      return fallbackUrl;
    }
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return fallbackUrl;
  }
}

function withReturnUrl(targetUrl: string, returnUrl: string) {
  const normalizedTargetUrl = String(targetUrl || "").trim();
  if (!normalizedTargetUrl || !returnUrl || typeof window === "undefined") {
    return normalizedTargetUrl;
  }
  try {
    const nextUrl = new URL(normalizedTargetUrl, window.location.origin);
    nextUrl.searchParams.set("returnUrl", returnUrl);
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return normalizedTargetUrl;
  }
}

function statusBadgeClass(code: string) {
  switch (code) {
    case "COMPLETED": return "bg-emerald-100 text-emerald-700";
    case "REVIEW": return "bg-amber-100 text-amber-700";
    case "DRAFT": return "bg-slate-200 text-slate-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function verificationBadgeClass(code: string) {
  switch (code) {
    case "VERIFIED": return "bg-emerald-100 text-emerald-700";
    case "PENDING": return "bg-blue-100 text-blue-700";
    case "IN_PROGRESS": return "bg-indigo-100 text-indigo-700";
    case "FAILED": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function matchesInitialResultDetailPayload(payload: EmissionResultDetailPagePayload | null, resultId: string) {
  if (!payload) {
    return false;
  }
  return readString(payload.resultId) === readString(resultId);
}

export function EmissionResultDetailMigrationPage() {
  const en = isEnglish();
  const resultId = getSearchParam("resultId");
  const returnUrl = readReturnUrl();
  const initialPayload = useMemo(() => readBootstrappedEmissionResultDetailPageData(), []);
  const canUseInitialPayload = matchesInitialResultDetailPayload(initialPayload, resultId);
  const pageState = useAsyncValue<EmissionResultDetailPagePayload>(
    () => fetchEmissionResultDetailPage(resultId),
    [resultId],
    {
      initialValue: canUseInitialPayload ? initialPayload : null,
      skipInitialLoad: canUseInitialPayload
    }
  );
  const page = pageState.value;
  const siteRows = ((page?.siteRows as Array<Record<string, unknown>> | undefined) || []);
  const evidenceRows = ((page?.evidenceRows as Array<Record<string, unknown>> | undefined) || []);
  const historyRows = ((page?.historyRows as Array<Record<string, unknown>> | undefined) || []);
  const reviewChecklist = ((page?.reviewChecklist as Array<Record<string, unknown>> | undefined) || []);
  const found = Boolean(page?.found);
  const error = pageState.error || readString(page?.pageError);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "emission-result-detail", {
      language: en ? "en" : "ko",
      resultId,
      found,
      resultStatusCode: readString(page.resultStatusCode),
      verificationStatusCode: readString(page.verificationStatusCode),
      siteCount: siteRows.length,
      evidenceCount: evidenceRows.length
    });
    logGovernanceScope("COMPONENT", "emission-result-detail-site-table", {
      rowCount: siteRows.length,
      resultId
    });
  }, [en, evidenceRows.length, found, page, resultId, siteRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        { label: en ? "Emission Result List" : "산정 결과 목록", href: returnUrl },
        { label: en ? "Result Detail" : "결과 상세" }
      ]}
      title={en ? "Emission Result Detail" : "산정 결과 상세"}
      subtitle={en ? "Inspect the calculation basis, site-level totals, and review evidence for this result." : "산정 근거, 배출지별 집계, 검토 증빙을 한 화면에서 확인합니다."}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading emission result detail." : "산정 결과 상세 정보를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {!resultId ? (
          <PageStatusNotice tone="warning">{en ? "A result ID is required." : "결과 ID가 필요합니다."}</PageStatusNotice>
        ) : null}

        {found ? (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-help-id="emission-result-detail-summary">
              <SummaryMetricCard title={en ? "Total Emission" : "총 배출량"} value={readString(page?.totalEmission) || "-"} />
              <SummaryMetricCard accentClassName="text-indigo-600" surfaceClassName="bg-indigo-50" title={en ? "Emission Sites" : "배출지 수"} value={String(Number(page?.siteCount || siteRows.length || 0))} />
              <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "Evidence Files" : "증빙 파일"} value={String(Number(page?.evidenceCount || evidenceRows.length || 0))} />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="gov-card" data-help-id="emission-result-detail-overview">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-text-secondary)]">{readString(page?.resultId)}</p>
                    <h2 className="mt-2 text-2xl font-bold text-[var(--kr-gov-text-primary)]">{readString(page?.projectName) || "-"}</h2>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{readString(page?.companyName) || "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(readString(page?.resultStatusCode))}`}>
                      {readString(page?.resultStatusLabel) || "-"}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${verificationBadgeClass(readString(page?.verificationStatusCode))}`}>
                      {readString(page?.verificationStatusLabel) || "-"}
                    </span>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    [en ? "Report Period" : "보고 기간", readString(page?.reportPeriod) || "-"],
                    [en ? "Calculated At" : "산정 일시", readString(page?.calculatedAt) || "-"],
                    [en ? "Submitted At" : "제출 일시", readString(page?.submittedAt) || "-"],
                    [en ? "Formula Version" : "산정식 버전", readString(page?.formulaVersion) || "-"],
                    [en ? "Verification Owner" : "검증 담당", readString(page?.verificationOwner) || "-"],
                    [en ? "Total Emission" : "총 배출량", readString(page?.totalEmission) || "-"]
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
                data-help-id="emission-result-detail-review"
                description={readString(page?.reviewMessage) || (en ? "Check the review handoff before moving to verification." : "검증 단계로 넘기기 전 검토 포인트를 확인합니다.")}
                icon="fact_check"
                title={en ? "Review Focus" : "검토 포인트"}
              >
                <div className="space-y-3">
                  {reviewChecklist.length === 0 ? (
                    <PageStatusNotice tone="warning">
                      {en ? "No review checklist items are registered for this result yet." : "이 결과에 등록된 검토 체크리스트가 아직 없습니다."}
                    </PageStatusNotice>
                  ) : reviewChecklist.map((item, index) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${readString(item.title)}-${index}`}>
                      <p className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{readString(item.title)}</p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-primary)]">{readString(item.detail) || "-"}</p>
                    </div>
                  ))}
                </div>
              </CollectionResultPanel>
            </section>

            <section className="gov-card overflow-hidden p-0" data-help-id="emission-result-detail-sites">
              <GridToolbar meta={en ? "Review activity data and aggregated emissions by site." : "배출지별 활동자료와 집계 배출량을 확인합니다."} title={en ? "Site Calculation Breakdown" : "배출지별 산정 내역"} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="gov-table-header">
                      <th className="px-6 py-4">{en ? "Site" : "배출지"}</th>
                      <th className="px-6 py-4">{en ? "Scope" : "Scope"}</th>
                      <th className="px-6 py-4">{en ? "Activity Data" : "활동자료"}</th>
                      <th className="px-6 py-4">{en ? "Emission" : "배출량"}</th>
                      <th className="px-6 py-4">{en ? "Review Status" : "검토 상태"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {siteRows.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-gray-500" colSpan={5}>
                          {en ? "No site calculation rows are available." : "표시할 배출지별 산정 내역이 없습니다."}
                        </td>
                      </tr>
                    ) : siteRows.map((row, index) => (
                      <tr className="hover:bg-gray-50/60" key={`${readString(row.siteName)}-${index}`}>
                        <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">{readString(row.siteName) || "-"}</td>
                        <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{readString(row.scopeLabel) || "-"}</td>
                        <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{readString(row.activityLabel) || "-"}</td>
                        <td className="px-6 py-4 font-bold text-[var(--kr-gov-blue)]">{readString(row.emissionValue) || "-"}</td>
                        <td className="px-6 py-4">{readString(row.statusLabel) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="gov-card overflow-hidden p-0" data-help-id="emission-result-detail-evidence">
                <GridToolbar meta={en ? "Submitted and reviewed evidence linked to this result." : "해당 결과에 연결된 제출·검토 증빙입니다."} title={en ? "Evidence Files" : "증빙 파일"} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="gov-table-header">
                        <th className="px-6 py-4">{en ? "File" : "파일명"}</th>
                        <th className="px-6 py-4">{en ? "Category" : "구분"}</th>
                        <th className="px-6 py-4">{en ? "Updated At" : "수정 일시"}</th>
                        <th className="px-6 py-4">{en ? "Owner" : "담당"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {evidenceRows.length === 0 ? (
                        <tr>
                          <td className="px-6 py-8 text-center text-gray-500" colSpan={4}>
                            {en ? "No evidence files are linked to this result." : "이 결과에 연결된 증빙 파일이 없습니다."}
                          </td>
                        </tr>
                      ) : evidenceRows.map((row, index) => (
                        <tr key={`${readString(row.fileName)}-${index}`}>
                          <td className="px-6 py-4 font-medium">{readString(row.fileName) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.categoryLabel) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.updatedAt) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.owner) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="gov-card overflow-hidden p-0" data-help-id="emission-result-detail-history">
                <GridToolbar meta={en ? "Track execution, review, and status transitions." : "산정 실행, 검토 요청, 상태 변경 이력을 확인합니다."} title={en ? "Review History" : "검토 이력"} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="gov-table-header">
                        <th className="px-6 py-4">{en ? "When" : "시각"}</th>
                        <th className="px-6 py-4">{en ? "Actor" : "담당자"}</th>
                        <th className="px-6 py-4">{en ? "Action" : "처리"}</th>
                        <th className="px-6 py-4">{en ? "Note" : "메모"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyRows.length === 0 ? (
                        <tr>
                          <td className="px-6 py-8 text-center text-gray-500" colSpan={4}>
                            {en ? "No review history is available." : "표시할 검토 이력이 없습니다."}
                          </td>
                        </tr>
                      ) : historyRows.map((row, index) => (
                        <tr key={`${readString(row.actionAt)}-${index}`}>
                          <td className="px-6 py-4">{readString(row.actionAt) || "-"}</td>
                          <td className="px-6 py-4">{readString(row.actor) || "-"}</td>
                          <td className="px-6 py-4 font-medium">{readString(row.actionLabel) || "-"}</td>
                          <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{readString(row.note) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>

            <MemberActionBar
              dataHelpId="emission-result-detail-actions"
              description={en ? "Move to the connected review flow or back to the result list. The left menu remains anchored to the result list family." : "연결된 검증 흐름으로 이동하거나 결과 목록으로 돌아갈 수 있습니다. 좌측 메뉴 활성은 결과 목록 화면군에 고정됩니다."}
              eyebrow={en ? "Emission Result Flow" : "산정 결과 흐름"}
              primary={(
                <MemberLinkButton href={withReturnUrl(readString(page?.verificationActionUrl) || "#", returnUrl)} icon="fact_check" size="lg" variant="primary">
                  {en ? "Open Verification" : "검증 화면 이동"}
                </MemberLinkButton>
              )}
              secondary={{
                href: returnUrl || readString(page?.listUrl) || buildLocalizedPath("/admin/emission/result_list", "/en/admin/emission/result_list"),
                icon: "list",
                label: en ? "Back to List" : "목록으로"
              }}
              tertiary={{
                href: withReturnUrl(readString(page?.historyUrl) || buildLocalizedPath("/admin/emission/data_history", "/en/admin/emission/data_history"), returnUrl),
                icon: "history",
                label: en ? "Open History" : "이력 보기"
              }}
              title={en ? "Next review actions" : "다음 검토 작업"}
            />
          </>
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
