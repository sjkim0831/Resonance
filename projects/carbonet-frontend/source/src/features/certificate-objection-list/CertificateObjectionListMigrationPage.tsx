import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchCertificateObjectionListPage } from "../../lib/api/member";
import type { CertificateObjectionListPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard, ReviewModalFrame } from "../member/sections";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  status: string;
  priority: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  status: "ALL",
  priority: "ALL"
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    status: params.get("status") || "ALL",
    priority: params.get("priority") || "ALL"
  };
}

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

export function CertificateObjectionListMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const [activeObjectionId, setActiveObjectionId] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const pageState = useAsyncValue<CertificateObjectionListPagePayload>(
    () => fetchCertificateObjectionListPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.status, filters.priority],
    {
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          status: String(payload.status || "ALL"),
          priority: String(payload.priority || "ALL")
        };
        setFilters(next);
        setDraftFilters(next);
      }
    }
  );
  const page = pageState.value;
  const error = pageState.error || String(page?.certificateObjectionError || "");
  const rows = (page?.certificateObjectionRows || []) as Array<Record<string, unknown>>;
  const summary = (page?.certificateObjectionSummary || []) as Array<Record<string, unknown>>;
  const guidance = (page?.certificateObjectionGuidance || []) as Array<Record<string, unknown>>;
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const totalCount = Number(page?.totalCount || rows.length);
  const canView = page?.canViewCertificateObjectionList !== false;
  const activeRow = useMemo(
    () => rows.find((row) => stringOf(row, "objectionId") === activeObjectionId) || null,
    [activeObjectionId, rows]
  );
  const activeAttachments = Array.isArray(activeRow?.attachments)
    ? activeRow.attachments.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
  const activeReviewPoints = Array.isArray(en ? activeRow?.reviewPointsEn : activeRow?.reviewPoints)
    ? ((en ? activeRow?.reviewPointsEn : activeRow?.reviewPoints) as unknown[]).map((item) => String(item || "")).filter(Boolean)
    : [];

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "certificate-objection-list", {
      language: en ? "en" : "ko",
      totalCount,
      currentPage,
      status: filters.status,
      priority: filters.priority,
      searchKeyword: filters.searchKeyword
    });
  }, [currentPage, en, filters.priority, filters.searchKeyword, filters.status, page, totalCount]);

  useEffect(() => {
    if (!activeRow) {
      setOperatorNote("");
      return;
    }
    setOperatorNote(en
      ? `Next step: ${stringOf(activeRow, "recommendedNextStepEn", "recommendedNextStep")}`
      : `다음 조치: ${stringOf(activeRow, "recommendedNextStep", "recommendedNextStepEn")}`);
  }, [activeRow, en]);

  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    setFilters({
      ...draftFilters,
      pageIndex: nextPageIndex
    });
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "Objection Handling" : "이의신청 처리" }
      ]}
      title={en ? "Objection Handling" : "이의신청 처리"}
      subtitle={en ? "Review and process objections raised after certificate issuance or rejection." : "발급 또는 반려 이후 접수된 이의신청을 검토하고 처리하는 화면입니다."}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading certificate objections..." : "이의신청 처리 현황을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {!pageState.loading && page && !canView ? (
          <MemberStateCard
            description={en ? "The current account cannot access the objection handling queue." : "현재 계정으로는 이의신청 처리 화면을 조회할 수 없습니다."}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="warning"
          />
        ) : null}
        {!canView ? null : (
          <>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="certificate-objection-list-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "metricKey")}-${index}`}
              title={en ? stringOf(item, "labelEn", "label") : stringOf(item, "label", "labelEn")}
              value={stringOf(item, "value") || "0"}
              description={en ? stringOf(item, "descriptionEn", "description") : stringOf(item, "description", "descriptionEn")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="certificate-objection-list-search"
          title={en ? "Search Queue" : "검색 조건"}
          description={en ? "Narrow the objection queue before assigning, escalating, or closing a case." : "담당자 배정, 상신, 종결 전에 대상 이의신청 건을 좁혀서 확인합니다."}
          icon="rule"
        >
          <form className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,auto]" onSubmit={(event) => {
            event.preventDefault();
            applyFilters(1);
          }}>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="certificateObjectionKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput
                id="certificateObjectionKeyword"
                placeholder={en ? "Objection ID, application, company, assignee" : "이의번호, 신청번호, 기업명, 담당자"}
                value={draftFilters.searchKeyword}
                onChange={(event) => updateDraft("searchKeyword", event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="certificateObjectionStatus">{en ? "Status" : "처리 상태"}</label>
              <AdminSelect id="certificateObjectionStatus" value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="RECEIVED">{en ? "Received" : "접수"}</option>
                <option value="IN_REVIEW">{en ? "In Review" : "검토중"}</option>
                <option value="ESCALATED">{en ? "Escalated" : "상신 필요"}</option>
                <option value="COMPLETED">{en ? "Completed" : "처리 완료"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="certificateObjectionPriority">{en ? "Priority" : "긴급도"}</label>
              <AdminSelect id="certificateObjectionPriority" value={draftFilters.priority} onChange={(event) => updateDraft("priority", event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="HIGH">{en ? "High" : "높음"}</option>
                <option value="MEDIUM">{en ? "Medium" : "보통"}</option>
                <option value="LOW">{en ? "Low" : "낮음"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <MemberButton onClick={resetFilters} type="button" variant="secondary">{en ? "Reset" : "초기화"}</MemberButton>
              <MemberButton type="submit" variant="primary">{en ? "Search" : "검색"}</MemberButton>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="certificate-objection-list-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              title={en ? "Objection Queue" : "이의신청 대기열"}
              meta={en ? `Total ${totalCount} cases in the current filter.` : `현재 필터 기준 총 ${totalCount}건입니다.`}
              actions={<span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{en ? `Page ${currentPage} / ${totalPages}` : `${currentPage} / ${totalPages} 페이지`}</span>}
            />
          </div>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-4 text-left">{en ? "Objection" : "이의신청"}</th>
                  <th className="px-4 py-4 text-left">{en ? "Applicant" : "신청인"}</th>
                  <th className="px-4 py-4 text-left">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-4 text-left">{en ? "Reason / Requested Action" : "이의 내용 / 요청 조치"}</th>
                  <th className="px-4 py-4 text-left">{en ? "Assignee" : "담당자"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                      {en ? "No objections match the current filters." : "현재 조건에 맞는 이의신청 건이 없습니다."}
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr className="align-top" key={stringOf(row, "objectionId", "applicationId")}>
                    <td className="px-4 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "objectionId")}</div>
                      <div className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? stringOf(row, "companyNameEn", "companyName") : stringOf(row, "companyName", "companyNameEn")}</div>
                      <div className="mt-1 text-xs text-gray-500">{stringOf(row, "applicationId")} / {stringOf(row, "certificateNo")}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? stringOf(row, "objectionTypeEn", "objectionType") : stringOf(row, "objectionType", "objectionTypeEn")}</span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(row, "priorityBadgeClass")}`}>{en ? stringOf(row, "priorityLabelEn", "priorityLabel") : stringOf(row, "priorityLabel", "priorityLabelEn")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "applicantNameEn", "applicantName") : stringOf(row, "applicantName", "applicantNameEn")}</div>
                      <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? "Submitted" : "접수"}: {stringOf(row, "submittedAt")}</div>
                      <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? "Due" : "처리기한"}: {stringOf(row, "dueDate")}</div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(row, "statusBadgeClass")}`}>{en ? stringOf(row, "statusLabelEn", "statusLabel") : stringOf(row, "statusLabel", "statusLabelEn")}</span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <p className="font-medium text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "reasonEn", "reason") : stringOf(row, "reason", "reasonEn")}</p>
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]"><strong>{en ? "Requested" : "요청 조치"}:</strong> {en ? stringOf(row, "requestedActionEn", "requestedAction") : stringOf(row, "requestedAction", "requestedActionEn")}</p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "assigneeEn", "assignee") : stringOf(row, "assignee", "assigneeEn")}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MemberLinkButton href={en ? stringOf(row, "detailUrlEn", "detailUrl") : stringOf(row, "detailUrl", "detailUrlEn")} variant="secondary">{en ? "Open Review" : "검토 화면"}</MemberLinkButton>
                        <MemberButton
                          onClick={() => setActiveObjectionId(stringOf(row, "objectionId"))}
                          type="button"
                          variant="primary"
                        >
                          {en ? "Process" : "처리"}
                        </MemberButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </div>
          <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(pageNumber) => applyFilters(pageNumber)} />
        </section>

        <CollectionResultPanel
          data-help-id="certificate-objection-list-guidance"
          title={en ? "Operator Guidance" : "운영 가이드"}
          description={en ? "Keep the same review order before changing certificate issuance or rejection outcomes." : "발급 결과나 반려 상태를 바꾸기 전에 동일한 검토 순서를 유지합니다."}
          icon="fact_check"
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {guidance.map((item, index) => (
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(item, "title")}-${index}`}>
                <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
              </article>
            ))}
          </div>
        </CollectionResultPanel>
          </>
        )}
      </AdminWorkspacePageFrame>

      <ReviewModalFrame
        maxWidthClassName="max-w-4xl"
        onClose={() => {
          setActiveObjectionId("");
          setOperatorNote("");
        }}
        open={Boolean(activeRow) && canView}
        title={en ? "Objection Processing Review" : "이의신청 처리 검토"}
      >
        {activeRow ? (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Objection" : "이의신청"}</p>
                <p className="mt-2 text-base font-bold text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "objectionId")}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(activeRow, "applicationId")} / {stringOf(activeRow, "certificateNo")}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "처리 담당"}</p>
                <p className="mt-2 text-base font-bold text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "responseOwnerEn", "responseOwner")}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Due" : "기한"}: {stringOf(activeRow, "dueDate")}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "처리 상태"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(activeRow, "statusBadgeClass")}`}>{stringOf(activeRow, "statusLabelEn", "statusLabel")}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(activeRow, "priorityBadgeClass")}`}>{stringOf(activeRow, "priorityLabelEn", "priorityLabel")}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Last updated" : "최종 갱신"}: {stringOf(activeRow, "lastUpdatedAtEn", "lastUpdatedAt")}</p>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr,1fr]">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Objection Detail" : "이의 내용"}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "reasonEn", "reason")}</p>
                <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  <strong>{en ? "Requested action" : "요청 조치"}:</strong> {stringOf(activeRow, "requestedActionEn", "requestedAction")}
                </p>
                <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700">{en ? "Recommended next step" : "권장 다음 조치"}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "recommendedNextStepEn", "recommendedNextStep")}</p>
                </div>
              </article>

              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Attachments" : "첨부 자료"}</h3>
                <div className="mt-3 space-y-3">
                  {activeAttachments.map((attachment, index) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3" key={`${stringOf(attachment, "name", "nameEn")}-${index}`}>
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(attachment, en ? "nameEn" : "name", en ? "name" : "nameEn")}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(attachment, "type")}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.2fr]">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Review checklist" : "검토 체크리스트"}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                  {activeReviewPoints.map((point, index) => (
                    <li className="flex gap-2" key={`${point}-${index}`}>
                      <span className="mt-1 h-2 w-2 rounded-full bg-[var(--kr-gov-blue)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <label className="block">
                  <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Operator note" : "운영 메모"}</span>
                  <textarea
                    className="gov-input mt-3 min-h-[160px] py-3"
                    onChange={(event) => setOperatorNote(event.target.value)}
                    placeholder={en ? "Record escalation rationale, response direction, or attachment review notes." : "상신 사유, 회신 방향, 첨부 검토 메모를 남깁니다."}
                    value={operatorNote}
                  />
                </label>
              </article>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <MemberLinkButton href={en ? stringOf(activeRow, "detailUrlEn", "detailUrl") : stringOf(activeRow, "detailUrl", "detailUrlEn")} variant="secondary">
                {en ? "Open Review Screen" : "검토 화면으로 이동"}
              </MemberLinkButton>
              <MemberButton onClick={() => setActiveObjectionId("")} type="button" variant="primary">
                {en ? "Done" : "확인"}
              </MemberButton>
            </div>
          </div>
        ) : null}
      </ReviewModalFrame>
    </AdminPageShell>
  );
}
