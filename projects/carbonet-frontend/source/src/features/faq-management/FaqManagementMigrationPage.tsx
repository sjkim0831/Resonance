import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchFaqManagementPage, saveFaqManagementPage } from "../../lib/api/content";
import type { FaqManagementPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, LookupContextStrip, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, AdminTextarea, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  searchKeyword: string;
  status: string;
  exposure: string;
  category: string;
  selectedId: string;
  page: number;
};

type EditDraft = {
  faqId: string;
  category: string;
  question: string;
  answerScope: string;
  exposure: string;
  status: string;
  displayOrder: string;
};

const PAGE_SIZE = 5;

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return { searchKeyword: "", status: "ALL", exposure: "ALL", category: "ALL", selectedId: "", page: 1 };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "ALL",
    exposure: search.get("exposure") || "ALL",
    category: search.get("category") || "ALL",
    selectedId: search.get("faqId") || "",
    page: Math.max(1, Number(search.get("page") || "1") || 1)
  };
}

function stringOf(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "REVIEW") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
}

function toDraft(selectedRow: Record<string, unknown> | null | undefined): EditDraft {
  return {
    faqId: stringOf(selectedRow, "id"),
    category: stringOf(selectedRow, "category"),
    question: stringOf(selectedRow, "question"),
    answerScope: stringOf(selectedRow, "answerScope"),
    exposure: stringOf(selectedRow, "exposure"),
    status: stringOf(selectedRow, "status"),
    displayOrder: stringOf(selectedRow, "displayOrder")
  };
}

export function FaqManagementMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [draft, setDraft] = useState<EditDraft>(toDraft(null));
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const pageState = useAsyncValue<FaqManagementPagePayload>(() => fetchFaqManagementPage({
    searchKeyword: filters.searchKeyword,
    status: filters.status === "ALL" ? "" : filters.status,
    exposure: filters.exposure === "ALL" ? "" : filters.exposure,
    category: filters.category === "ALL" ? "" : filters.category,
    faqId: filters.selectedId
  }), [filters.searchKeyword, filters.status, filters.exposure, filters.category, filters.selectedId, en, message]);

  const faqRows = (pageState.value?.faqRows || []) as Array<Record<string, unknown>>;
  const summaryCards = (pageState.value?.summaryCards || []) as Array<Record<string, string>>;
  const totalPages = Math.max(1, Math.ceil(faqRows.length / PAGE_SIZE));
  const safePage = Math.min(filters.page, totalPages);
  const pagedRows = faqRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedRow = (pageState.value?.selectedFaq as Record<string, unknown> | undefined) || pagedRows[0] || faqRows[0] || null;

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.searchKeyword) params.set("searchKeyword", filters.searchKeyword);
    if (filters.status !== "ALL") params.set("status", filters.status);
    if (filters.exposure !== "ALL") params.set("exposure", filters.exposure);
    if (filters.category !== "ALL") params.set("category", filters.category);
    if (safePage > 1) params.set("page", String(safePage));
    if (stringOf(selectedRow, "id")) params.set("faqId", stringOf(selectedRow, "id"));
    const query = params.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [filters.category, filters.exposure, filters.searchKeyword, filters.status, safePage, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    const selectedId = stringOf(selectedRow, "id");
    if (filters.selectedId !== selectedId || filters.page !== safePage) {
      setFilters((current) => ({ ...current, selectedId, page: safePage }));
    }
    setDraft(toDraft(selectedRow));
  }, [filters.page, filters.selectedId, safePage, selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "faq-management", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      filterStatus: filters.status,
      filterExposure: filters.exposure,
      filterCategory: filters.category,
      resultCount: faqRows.length,
      selectedFaqId: stringOf(selectedRow, "id")
    });
  }, [en, faqRows.length, filters.category, filters.exposure, filters.status, selectedRow]);

  async function handleSave() {
    if (!draft.faqId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await saveFaqManagementPage(draft);
      setMessage(String(response.message || (en ? "FAQ draft saved." : "FAQ 초안을 저장했습니다.")));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to save FAQ." : "FAQ 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "FAQ Management" : "FAQ 관리" }
      ]}
      title={en ? "FAQ Management" : "FAQ 관리"}
      subtitle={en
        ? "Manage FAQ visibility and review status with a connected read/write demo flow."
        : "읽기/쓰기 demo 흐름이 연결된 FAQ 운영 화면입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {saveError ? <PageStatusNotice tone="error">{saveError}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        <PageStatusNotice tone="warning">
          {en
            ? "FAQ reads and draft saves are connected. Persistence is still backed by in-memory demo storage."
            : "FAQ 조회와 초안 저장은 연결됐고, 현재 저장은 in-memory demo storage 기준입니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="faq-management-summary">
          {summaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${card.title}-${index}`}
              title={String(card.title || "")}
              value={String(card.value || "")}
              description={String(card.description || "")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="faq-management-search"
          description={en
            ? "Search by question, answer scope, or owner, then narrow the list by category, exposure, and publishing state."
            : "질문, 답변 범위, 담당 조직으로 검색하고 분류, 노출 상태, 게시 상태로 목록을 좁힙니다."}
          icon="quiz"
          title={en ? "FAQ Filters" : "FAQ 조회 조건"}
        >
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({ ...current, page: 1 }));
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "Question, answer scope, owner, or FAQ ID" : "질문, 답변 범위, 담당 조직, FAQ ID"}
                value={filters.searchKeyword}
                onChange={(event) => setFilters((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{en ? "Category" : "분류"}</span>
              <AdminSelect value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACCOUNT">{en ? "Account" : "계정"}</option>
                <option value="APPLICATION">{en ? "Application" : "가입/신청"}</option>
                <option value="DATA">{en ? "Data" : "데이터"}</option>
                <option value="POLICY">{en ? "Policy" : "정책"}</option>
              </AdminSelect>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{en ? "Exposure" : "노출 상태"}</span>
              <AdminSelect value={filters.exposure} onChange={(event) => setFilters((current) => ({ ...current, exposure: event.target.value, page: 1 }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="PUBLIC">{en ? "Public" : "공개"}</option>
                <option value="PRIVATE">{en ? "Private" : "비공개"}</option>
              </AdminSelect>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{en ? "Status" : "게시 상태"}</span>
              <AdminSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="PUBLISHED">{en ? "Published" : "게시"}</option>
                <option value="REVIEW">{en ? "Review" : "검토"}</option>
                <option value="DRAFT">{en ? "Draft" : "초안"}</option>
              </AdminSelect>
            </label>
            <div className="flex items-end gap-2">
              <MemberButton type="submit" variant="primary">{en ? "Search" : "조회"}</MemberButton>
              <MemberButton
                onClick={() => setFilters({ searchKeyword: "", status: "ALL", exposure: "ALL", category: "ALL", selectedId: "", page: 1 })}
                type="button"
                variant="secondary"
              >
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="faq-management-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Rows" : "행 수"} <strong>{faqRows.length}</strong></span>}
              meta={en ? "Select a row to edit the FAQ draft in the detail form." : "행을 선택하면 우측 상세 폼에서 FAQ 초안을 수정할 수 있습니다."}
              title={en ? "FAQ List" : "FAQ 목록"}
            />
          </div>
          {pagedRows.length === 0 ? (
            <PageStatusNotice className="m-6" tone="warning">
              {en ? "No FAQ entries match the current filters." : "현재 조건에 맞는 FAQ 항목이 없습니다."}
            </PageStatusNotice>
          ) : (
            <>
              <div className="overflow-x-auto">
                <AdminTable>
                  <thead>
                    <tr className="gov-table-header">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">{en ? "Question" : "질문"}</th>
                      <th className="px-4 py-3">{en ? "Category" : "분류"}</th>
                      <th className="px-4 py-3">{en ? "Exposure" : "노출"}</th>
                      <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                      <th className="px-4 py-3">{en ? "Order" : "정렬"}</th>
                      <th className="px-4 py-3">{en ? "Updated" : "최근 수정"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedRows.map((row) => (
                      <tr
                        className={`cursor-pointer ${stringOf(row, "id") === stringOf(selectedRow, "id") ? "bg-blue-50/70" : ""}`}
                        key={stringOf(row, "id")}
                        onClick={() => setFilters((current) => ({ ...current, selectedId: stringOf(row, "id") }))}
                      >
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{stringOf(row, "id")}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{stringOf(row, "question")}</div>
                          <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "owner")}</div>
                        </td>
                        <td className="px-4 py-3">{stringOf(row, "categoryLabel")}</td>
                        <td className="px-4 py-3">{stringOf(row, "exposureLabel")}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(stringOf(row, "status"))}`}>
                            {stringOf(row, "statusLabel")}
                          </span>
                        </td>
                        <td className="px-4 py-3">{stringOf(row, "displayOrder")}</td>
                        <td className="px-4 py-3">{stringOf(row, "lastChangedAt")}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
              <MemberPagination currentPage={safePage} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} totalPages={totalPages} />
            </>
          )}
        </section>

        {selectedRow ? (
          <section className="space-y-4" data-help-id="faq-management-detail">
            <LookupContextStrip
              action={(
                <MemberButton disabled={saving} onClick={handleSave} type="button" variant="primary">
                  {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save FAQ" : "FAQ 저장")}
                </MemberButton>
              )}
              label={en ? "Selected FAQ" : "선택 FAQ"}
              value={(
                <div className="space-y-1">
                  <div className="font-semibold">{stringOf(selectedRow, "id")} · {stringOf(selectedRow, "question")}</div>
                  <div className="text-xs text-[var(--kr-gov-text-secondary)]">
                    {stringOf(selectedRow, "categoryLabel")} · {stringOf(selectedRow, "exposureLabel")} · {stringOf(selectedRow, "statusLabel")}
                  </div>
                </div>
              )}
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <CollectionResultPanel
                description={en ? "Edit the FAQ draft fields and save them through the connected demo API." : "FAQ 초안 필드를 수정하고 연결된 demo API로 저장합니다."}
                icon="edit_note"
                title={en ? "FAQ Editor" : "FAQ 편집기"}
              >
                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold">{en ? "Question" : "질문"}</span>
                    <AdminInput value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold">{en ? "Answer Scope" : "답변 범위"}</span>
                    <AdminTextarea rows={5} value={draft.answerScope} onChange={(event) => setDraft((current) => ({ ...current, answerScope: event.target.value }))} />
                  </label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">{en ? "Category" : "분류"}</span>
                      <AdminSelect value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                        <option value="ACCOUNT">{en ? "Account" : "계정"}</option>
                        <option value="APPLICATION">{en ? "Application" : "가입/신청"}</option>
                        <option value="DATA">{en ? "Data" : "데이터"}</option>
                        <option value="POLICY">{en ? "Policy" : "정책"}</option>
                      </AdminSelect>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">{en ? "Display Order" : "정렬 순서"}</span>
                      <AdminInput value={draft.displayOrder} onChange={(event) => setDraft((current) => ({ ...current, displayOrder: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">{en ? "Exposure" : "노출 상태"}</span>
                      <AdminSelect value={draft.exposure} onChange={(event) => setDraft((current) => ({ ...current, exposure: event.target.value }))}>
                        <option value="PUBLIC">{en ? "Public" : "공개"}</option>
                        <option value="PRIVATE">{en ? "Private" : "비공개"}</option>
                      </AdminSelect>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">{en ? "Status" : "게시 상태"}</span>
                      <AdminSelect value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                        <option value="PUBLISHED">{en ? "Published" : "게시"}</option>
                        <option value="REVIEW">{en ? "Review" : "검토"}</option>
                        <option value="DRAFT">{en ? "Draft" : "초안"}</option>
                      </AdminSelect>
                    </label>
                  </div>
                </div>
              </CollectionResultPanel>

              <CollectionResultPanel
                description={en ? "Operational metadata stays read-only while content fields are editable." : "운영 메타데이터는 읽기 전용으로 유지하고 콘텐츠 필드만 편집합니다."}
                icon="fact_check"
                title={en ? "Operational Metadata" : "운영 메타데이터"}
              >
                <dl className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
                    <dt className="font-bold">{en ? "Owner" : "담당"}</dt>
                    <dd className="mt-1">{stringOf(selectedRow, "owner")}</dd>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
                    <dt className="font-bold">{en ? "Last Changed" : "최근 수정"}</dt>
                    <dd className="mt-1">{stringOf(selectedRow, "lastChangedAt")} · {stringOf(selectedRow, "lastChangedBy")}</dd>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
                    <dt className="font-bold">{en ? "FAQ ID" : "FAQ ID"}</dt>
                    <dd className="mt-1 font-mono">{draft.faqId}</dd>
                  </div>
                </dl>
              </CollectionResultPanel>
            </div>
          </section>
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
