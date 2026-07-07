import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { deleteQnaCategory, fetchQnaCategoryPage, saveQnaCategory } from "../../lib/api/content";
import type { QnaCategoryPagePayload } from "../../lib/api/contentTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, LookupContextStrip, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, AdminTextarea, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";

type Filters = {
  searchKeyword: string;
  useAt: string;
  channel: string;
  selectedId: string;
};

type CategoryForm = {
  categoryId: string;
  code: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  channel: string;
  useAt: string;
  sortOrder: string;
  ownerKo: string;
  ownerEn: string;
};

const BASE_CATEGORY_IDS = new Set([
  "QNA_CAT_001",
  "QNA_CAT_002",
  "QNA_CAT_003",
  "QNA_CAT_004",
  "QNA_CAT_005"
]);

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return {
      searchKeyword: "",
      useAt: "ALL",
      channel: "ALL",
      selectedId: ""
    };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    useAt: search.get("useAt") || "ALL",
    channel: search.get("channel") || "ALL",
    selectedId: search.get("categoryId") || ""
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

function statusBadgeClass(useAt: string) {
  return useAt === "Y" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
}

function buildEmptyForm(): CategoryForm {
  return {
    categoryId: "",
    code: "",
    nameKo: "",
    nameEn: "",
    descriptionKo: "",
    descriptionEn: "",
    channel: "BOTH",
    useAt: "Y",
    sortOrder: "0",
    ownerKo: "",
    ownerEn: ""
  };
}

function buildFormFromRow(row: Record<string, string> | null | undefined): CategoryForm {
  if (!row) {
    return buildEmptyForm();
  }
  return {
    categoryId: stringOf(row, "id"),
    code: stringOf(row, "code"),
    nameKo: stringOf(row, "nameKo"),
    nameEn: stringOf(row, "nameEn"),
    descriptionKo: stringOf(row, "descriptionKo"),
    descriptionEn: stringOf(row, "descriptionEn"),
    channel: stringOf(row, "channel") || "BOTH",
    useAt: stringOf(row, "useAt") || "Y",
    sortOrder: stringOf(row, "sortOrder") || "0",
    ownerKo: stringOf(row, "ownerKo"),
    ownerEn: stringOf(row, "ownerEn")
  };
}

export function QnaCategoryMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [form, setForm] = useState<CategoryForm>(buildEmptyForm);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const pageState = useAsyncValue<QnaCategoryPagePayload>(
    () => fetchQnaCategoryPage({
      searchKeyword: filters.searchKeyword,
      useAt: filters.useAt,
      channel: filters.channel,
      categoryId: filters.selectedId
    }),
    [filters.searchKeyword, filters.useAt, filters.channel, filters.selectedId]
  );

  const page = pageState.value;
  const summaryCards = ((page?.summaryCards || []) as Array<Record<string, string>>);
  const filteredRows = ((page?.categoryRows || []) as Array<Record<string, string>>);
  const selectedRow = ((page?.selectedCategory || null) as Record<string, string> | null);
  const governanceNotes = ((page?.governanceNotes || []) as Array<Record<string, string>>);
  const integrationNotes = ((page?.integrationNotes || []) as Array<Record<string, string>>);
  const hiddenCount = Number(summaryCards.find((item) => stringOf(item, "title") === (en ? "Hidden" : "숨김"))?.value || "0");
  const pageError = actionError || pageState.error;
  const selectedCategoryCanDelete = !!selectedRow
    && !BASE_CATEGORY_IDS.has(form.categoryId)
    && Number(stringOf(selectedRow, "qnaCount")) === 0
    && Number(stringOf(selectedRow, "pendingCount")) === 0;

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.searchKeyword) {
      params.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.useAt !== "ALL") {
      params.set("useAt", filters.useAt);
    }
    if (filters.channel !== "ALL") {
      params.set("channel", filters.channel);
    }
    if (stringOf(selectedRow, "id") || filters.selectedId) {
      params.set("categoryId", stringOf(selectedRow, "id") || filters.selectedId);
    }
    const query = params.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [filters.channel, filters.searchKeyword, filters.selectedId, filters.useAt, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    const selectedId = stringOf(selectedRow, "id");
    if (selectedId && filters.selectedId !== selectedId) {
      setFilters((current) => ({ ...current, selectedId }));
    }
  }, [filters.selectedId, selectedRow]);

  useEffect(() => {
    setForm(buildFormFromRow(selectedRow));
  }, [selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "qna-category", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      filterUseAt: filters.useAt,
      filterChannel: filters.channel,
      resultCount: filteredRows.length,
      selectedCategoryId: stringOf(selectedRow, "id")
    });
  }, [en, filteredRows.length, filters.channel, filters.useAt, selectedRow]);

  const visibleSummaryCards = useMemo(() => summaryCards.slice(0, 4), [summaryCards]);

  function updateForm<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(nextUseAt?: string) {
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await saveQnaCategory({
        categoryId: form.categoryId || undefined,
        code: form.code.trim().toUpperCase(),
        nameKo: form.nameKo.trim(),
        nameEn: form.nameEn.trim(),
        descriptionKo: form.descriptionKo.trim(),
        descriptionEn: form.descriptionEn.trim(),
        channel: form.channel,
        useAt: nextUseAt || form.useAt,
        sortOrder: Number(form.sortOrder || "0") || 0,
        ownerKo: form.ownerKo.trim(),
        ownerEn: form.ownerEn.trim()
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to save Q&A category." : "Q&A 분류 저장에 실패했습니다."));
      }
      const nextCategoryId = String(response.categoryId || "");
      setMessage(response.message || (en ? "Q&A category saved." : "Q&A 분류를 저장했습니다."));
      setFilters((current) => ({ ...current, selectedId: nextCategoryId || current.selectedId }));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to save Q&A category." : "Q&A 분류 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.categoryId) {
      return;
    }
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(en ? "Delete this category permanently?" : "이 분류를 완전히 삭제하시겠습니까?");
    if (!confirmed) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await deleteQnaCategory(form.categoryId);
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to delete Q&A category." : "Q&A 분류 삭제에 실패했습니다."));
      }
      setMessage(response.message || (en ? "Q&A category deleted." : "Q&A 분류를 삭제했습니다."));
      setFilters((current) => ({ ...current, selectedId: "" }));
      setForm(buildEmptyForm());
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to delete Q&A category." : "Q&A 분류 삭제에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Q&A Categories" : "Q&A 분류" }
      ]}
      title={en ? "Q&A Categories" : "Q&A 분류"}
      subtitle={en
        ? "Manage the category structure used before Q&A routing, assignment, and answer SLA handling."
        : "Q&A 접수 이후 라우팅, 담당 배정, 응답 SLA에 사용되는 분류 구조를 운영하는 화면입니다."}
      loading={pageState.loading && !page && !pageError}
      loadingLabel={en ? "Loading Q&A categories..." : "Q&A 분류를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageError ? <PageStatusNotice tone="error">{pageError}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        <PageStatusNotice tone="warning">
          {en
            ? "The save flow now persists local admin category data. Historical question counts remain protected from delete behavior."
            : "저장 흐름은 이제 로컬 관리자 분류 데이터에 반영됩니다. 기존 문의 건수는 삭제 대신 숨김 규칙으로 보호됩니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="qna-category-summary">
          {visibleSummaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card, "title")}-${index}`}
              title={stringOf(card, "title")}
              value={stringOf(card, "value")}
              description={stringOf(card, "description")}
              accentClassName={index === 2 ? "text-amber-700" : index === 3 ? "text-indigo-700" : undefined}
              surfaceClassName={index === 2 ? "bg-amber-50" : index === 3 ? "bg-indigo-50" : undefined}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="qna-category-search"
          title={en ? "Search Categories" : "검색 조건"}
          description={en
            ? "Apply status, channel, and keyword filters before inspecting category details."
            : "상태, 채널, 검색어를 먼저 좁힌 뒤 분류 상세를 확인합니다."}
          icon="quiz"
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,auto]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="qnaCategoryKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput
                id="qnaCategoryKeyword"
                placeholder={en ? "Code, category, description, owner" : "코드, 분류명, 설명, 운영 담당자"}
                value={filters.searchKeyword}
                onChange={(event) => setFilters((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="qnaCategoryUseAt">{en ? "Exposure" : "노출 상태"}</label>
              <AdminSelect id="qnaCategoryUseAt" value={filters.useAt} onChange={(event) => setFilters((current) => ({ ...current, useAt: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="Y">{en ? "Active" : "운영중"}</option>
                <option value="N">{en ? "Hidden" : "숨김"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="qnaCategoryChannel">{en ? "Channel" : "노출 채널"}</label>
              <AdminSelect id="qnaCategoryChannel" value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="PORTAL">{en ? "Public Portal" : "공개 포털"}</option>
                <option value="PARTNER">{en ? "Partner Center" : "파트너 센터"}</option>
                <option value="BOTH">{en ? "Portal + Partner" : "포털 + 파트너"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <MemberButton
                onClick={() => setFilters({ searchKeyword: "", useAt: "ALL", channel: "ALL", selectedId: "" })}
                type="button"
                variant="secondary"
              >
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </div>
        </CollectionResultPanel>

        {selectedRow ? (
          <LookupContextStrip
            action={(
              <div className="flex flex-wrap gap-2">
                <MemberLinkButton href={buildLocalizedPath("/admin/content/faq", "/en/admin/content/faq")} size="xs" variant="secondary">
                  {en ? "FAQ" : "FAQ 관리"}
                </MemberLinkButton>
                <MemberLinkButton href={buildLocalizedPath("/admin/content/sitemap", "/en/admin/content/sitemap")} size="xs" variant="primary">
                  {en ? "Sitemap" : "사이트맵"}
                </MemberLinkButton>
              </div>
            )}
            label={en ? "Selected Category" : "선택된 분류"}
            value={(
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{stringOf(selectedRow, "name")}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{stringOf(selectedRow, "code")}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusBadgeClass(stringOf(selectedRow, "useAt"))}`}>
                  {stringOf(selectedRow, "useAtLabel")}
                </span>
              </div>
            )}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <section className="gov-card overflow-hidden p-0" data-help-id="qna-category-table">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <MemberSectionToolbar
                actions={<span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? "Results" : "조회 결과"} {filteredRows.length}</span>}
                meta={en ? "List density and management column order follow the shared admin table pattern." : "목록 밀도와 관리 컬럼 순서는 공통 관리자 테이블 규칙을 유지합니다."}
                title={en ? "Category List" : "분류 목록"}
              />
            </div>
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-left">Code</th>
                    <th className="px-6 py-4 text-left">{en ? "Category" : "분류명"}</th>
                    <th className="px-6 py-4 text-left">{en ? "Channel" : "채널"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Questions" : "문의 수"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Pending" : "미처리"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Manage" : "관리"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {en ? "No categories match the current filters." : "현재 검색 조건에 맞는 분류가 없습니다."}
                      </td>
                    </tr>
                  ) : filteredRows.map((row) => (
                    <tr className={stringOf(row, "id") === stringOf(selectedRow, "id") ? "bg-blue-50/60" : "hover:bg-gray-50/60"} key={stringOf(row, "id")}>
                      <td className="px-6 py-4 font-bold text-[var(--kr-gov-blue)]">{stringOf(row, "code")}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "name")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "description")}</div>
                      </td>
                      <td className="px-6 py-4">{stringOf(row, "channelLabel")}</td>
                      <td className="px-6 py-4 text-center">{stringOf(row, "qnaCount")}</td>
                      <td className="px-6 py-4 text-center">{stringOf(row, "pendingCount")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusBadgeClass(stringOf(row, "useAt"))}`}>
                          {stringOf(row, "useAtLabel")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <MemberButton onClick={() => setFilters((current) => ({ ...current, selectedId: stringOf(row, "id") }))} size="xs" type="button" variant={stringOf(row, "id") === stringOf(selectedRow, "id") ? "primary" : "secondary"}>
                          {en ? "Select" : "선택"}
                        </MemberButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          </section>

          <section className="space-y-4" data-help-id="qna-category-detail">
            <section className="gov-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{form.categoryId ? (en ? "Edit Category" : "분류 편집") : (en ? "Create Category" : "분류 등록")}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{form.categoryId || (en ? "NEW" : "신규")}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Category Code" : "분류 코드"}</span>
                    <AdminInput value={form.code} onChange={(event) => updateForm("code", event.target.value.toUpperCase())} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Sort Order" : "정렬 순서"}</span>
                    <AdminInput inputMode="numeric" value={form.sortOrder} onChange={(event) => updateForm("sortOrder", event.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Korean Name" : "국문 분류명"}</span>
                    <AdminInput value={form.nameKo} onChange={(event) => updateForm("nameKo", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "English Name" : "영문 분류명"}</span>
                    <AdminInput value={form.nameEn} onChange={(event) => updateForm("nameEn", event.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Korean Description" : "국문 설명"}</span>
                    <AdminTextarea rows={3} value={form.descriptionKo} onChange={(event) => updateForm("descriptionKo", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "English Description" : "영문 설명"}</span>
                    <AdminTextarea rows={3} value={form.descriptionEn} onChange={(event) => updateForm("descriptionEn", event.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Korean Owner" : "국문 운영 담당"}</span>
                    <AdminInput value={form.ownerKo} onChange={(event) => updateForm("ownerKo", event.target.value)} />
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "English Owner" : "영문 운영 담당"}</span>
                    <AdminInput value={form.ownerEn} onChange={(event) => updateForm("ownerEn", event.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Channel" : "노출 채널"}</span>
                    <AdminSelect value={form.channel} onChange={(event) => updateForm("channel", event.target.value)}>
                      <option value="PORTAL">{en ? "Public Portal" : "공개 포털"}</option>
                      <option value="PARTNER">{en ? "Partner Center" : "파트너 센터"}</option>
                      <option value="BOTH">{en ? "Portal + Partner" : "포털 + 파트너"}</option>
                    </AdminSelect>
                  </label>
                  <label className="text-sm font-bold">
                    <span className="mb-1 block">{en ? "Exposure" : "노출 상태"}</span>
                    <AdminSelect value={form.useAt} onChange={(event) => updateForm("useAt", event.target.value)}>
                      <option value="Y">{en ? "Active" : "운영중"}</option>
                      <option value="N">{en ? "Hidden" : "숨김"}</option>
                    </AdminSelect>
                  </label>
                </div>
                {selectedRow ? (
                  <dl className="grid grid-cols-1 gap-2 rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "Last Change" : "최종 변경"}</dt>
                      <dd>{stringOf(selectedRow, "lastChangedAt")} / {stringOf(selectedRow, "lastChangedBy")}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-bold">{en ? "Counts" : "문의 현황"}</dt>
                      <dd>{en ? "Questions" : "문의"} {stringOf(selectedRow, "qnaCount")} / {en ? "Pending" : "미처리"} {stringOf(selectedRow, "pendingCount")}</dd>
                    </div>
                  </dl>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <MemberButton onClick={() => setForm(buildEmptyForm())} type="button" variant="secondary">
                    {en ? "New" : "신규"}
                  </MemberButton>
                  <MemberButton disabled={saving} onClick={() => { void handleSave(); }} type="button" variant="primary">
                    {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save" : "저장")}
                  </MemberButton>
                  <MemberButton disabled={saving} onClick={() => { void handleSave("N"); }} type="button" variant="secondary">
                    {en ? "Hide Category" : "숨김 처리"}
                  </MemberButton>
                  <MemberButton disabled={saving || !selectedCategoryCanDelete} onClick={() => { void handleDelete(); }} type="button" variant="secondary">
                    {en ? "Delete" : "삭제"}
                  </MemberButton>
                </div>
              </div>
            </section>

            <CollectionResultPanel
              className="mb-0 border-slate-200 bg-slate-50"
              description={en ? "Lock these operating rules before expanding into delete or bulk actions." : "삭제나 일괄 처리보다 먼저 유지해야 하는 운영 기준입니다."}
              icon="fact_check"
              title={en ? "Governance Notes" : "운영 기준"}
            >
              <ul className="space-y-2 text-sm leading-6">
                {governanceNotes.map((item, index) => (
                  <li key={`${stringOf(item, "title")}-${index}`}>
                    <span className="font-bold">{stringOf(item, "title")}</span> {stringOf(item, "body")}
                  </li>
                ))}
              </ul>
            </CollectionResultPanel>
          </section>
        </section>

        <section className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold">{en ? "Next Integration Step" : "다음 연동 단계"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {stringOf(integrationNotes[0], "body") || (en
                  ? `Connect delete guards and keep hidden categories (${hiddenCount}) blocked from hard deletion while historical question counts remain.`
                  : `삭제 차단 연동을 추가할 때 숨김 분류 ${hiddenCount}건은 기존 문의 이력이 남아 있으면 하드 삭제를 막아야 합니다.`)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MemberButton onClick={() => setForm(buildEmptyForm())} type="button" variant="secondary">{en ? "Create Category" : "분류 등록"}</MemberButton>
              <MemberButton disabled={saving} onClick={() => { void handleSave(); }} type="button" variant="primary">{en ? "Save Changes" : "변경 저장"}</MemberButton>
            </div>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
