import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";

type TagRow = {
  id: string;
  tagCode: string;
  tagNameKo: string;
  tagNameEn: string;
  status: "ACTIVE" | "DRAFT" | "HIDDEN";
  categoryKo: string;
  categoryEn: string;
  usageCount: number;
  faqCount: number;
  qnaCount: number;
  searchCount: number;
  ownerKo: string;
  ownerEn: string;
  updatedAt: string;
  updatedBy: string;
  descriptionKo: string;
  descriptionEn: string;
};

type Filters = {
  searchKeyword: string;
  status: string;
  selectedId: string;
};

const TAG_ROWS: TagRow[] = [
  {
    id: "TAG_001",
    tagCode: "EMISSION",
    tagNameKo: "배출량 제출",
    tagNameEn: "Emission Submission",
    status: "ACTIVE",
    categoryKo: "배출 관리",
    categoryEn: "Emission",
    usageCount: 128,
    faqCount: 18,
    qnaCount: 64,
    searchCount: 46,
    ownerKo: "배출 운영팀",
    ownerEn: "Emission Operations",
    updatedAt: "2026-03-31 10:12",
    updatedBy: "emission_ops",
    descriptionKo: "배출량 제출, 검증 일정, 제출 오류 안내에 연결되는 대표 태그입니다.",
    descriptionEn: "Primary tag linked to emission submissions, validation schedules, and submission issues."
  },
  {
    id: "TAG_002",
    tagCode: "CERTIFICATE",
    tagNameKo: "인증서 발급",
    tagNameEn: "Certificate Issuance",
    status: "ACTIVE",
    categoryKo: "인증 심사",
    categoryEn: "Certification",
    usageCount: 93,
    faqCount: 12,
    qnaCount: 51,
    searchCount: 30,
    ownerKo: "인증 심사팀",
    ownerEn: "Certification Team",
    updatedAt: "2026-03-30 16:08",
    updatedBy: "cert_lead",
    descriptionKo: "인증서 발급, 재발급, 이의신청 화면과 연결되는 공통 태그입니다.",
    descriptionEn: "Shared tag used across issuance, reissue, and objection support flows."
  },
  {
    id: "TAG_003",
    tagCode: "PAYMENT",
    tagNameKo: "결제/환불",
    tagNameEn: "Payments / Refunds",
    status: "DRAFT",
    categoryKo: "정산 운영",
    categoryEn: "Settlement",
    usageCount: 41,
    faqCount: 7,
    qnaCount: 21,
    searchCount: 13,
    ownerKo: "정산 운영팀",
    ownerEn: "Settlement Operations",
    updatedAt: "2026-03-28 09:44",
    updatedBy: "settlement_mgr",
    descriptionKo: "환불, 계좌 검수, 정산 캘린더 묶음을 재정리하는 초안 태그입니다.",
    descriptionEn: "Draft tag for regrouping refund, account review, and settlement-calendar guidance."
  },
  {
    id: "TAG_004",
    tagCode: "LEGACY_HELP",
    tagNameKo: "구버전 도움말",
    tagNameEn: "Legacy Help",
    status: "HIDDEN",
    categoryKo: "이관 보관",
    categoryEn: "Archive",
    usageCount: 9,
    faqCount: 4,
    qnaCount: 2,
    searchCount: 3,
    ownerKo: "서비스 기획",
    ownerEn: "Service Planning",
    updatedAt: "2026-03-21 08:10",
    updatedBy: "planner01",
    descriptionKo: "이관 이후 숨김 처리된 과거 운영 태그입니다.",
    descriptionEn: "Archived legacy tag hidden after the migration cutover."
  }
];

function readInitialFilters(): Filters {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "ALL",
    selectedId: search.get("tagId") || TAG_ROWS[0]?.id || ""
  };
}

function localized(en: boolean, ko: string, english: string) {
  return en ? english : ko;
}

function statusLabel(status: TagRow["status"], en: boolean) {
  if (status === "ACTIVE") {
    return en ? "Active" : "운영중";
  }
  if (status === "DRAFT") {
    return en ? "Draft" : "초안";
  }
  return en ? "Hidden" : "숨김";
}

function statusClassName(status: TagRow["status"]) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DRAFT") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
}

export function TagManagementMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const deferredKeyword = useDeferredValue(filters.searchKeyword.trim().toLowerCase());

  const filteredRows = useMemo(() => TAG_ROWS.filter((row) => {
    if (filters.status !== "ALL" && row.status !== filters.status) {
      return false;
    }
    if (!deferredKeyword) {
      return true;
    }
    const haystack = [
      row.tagCode,
      row.tagNameKo,
      row.tagNameEn,
      row.categoryKo,
      row.categoryEn,
      row.ownerKo,
      row.ownerEn
    ].join(" ").toLowerCase();
    return haystack.includes(deferredKeyword);
  }), [deferredKeyword, filters.status]);

  const selectedRow = filteredRows.find((row) => row.id === filters.selectedId)
    || TAG_ROWS.find((row) => row.id === filters.selectedId)
    || filteredRows[0]
    || TAG_ROWS[0]
    || null;

  const activeCount = TAG_ROWS.filter((row) => row.status === "ACTIVE").length;
  const draftCount = TAG_ROWS.filter((row) => row.status === "DRAFT").length;
  const hiddenCount = TAG_ROWS.filter((row) => row.status === "HIDDEN").length;
  const usageCount = TAG_ROWS.reduce((sum, row) => sum + row.usageCount, 0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.searchKeyword) {
      params.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.status !== "ALL") {
      params.set("status", filters.status);
    }
    if (selectedRow?.id) {
      params.set("tagId", selectedRow.id);
    }
    replace(`${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [filters.searchKeyword, filters.status, selectedRow?.id]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    if (filters.selectedId !== selectedRow.id) {
      setFilters((current) => ({ ...current, selectedId: selectedRow.id }));
    }
  }, [filters.selectedId, selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "tag-management", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      filterStatus: filters.status,
      resultCount: filteredRows.length,
      selectedTagId: selectedRow?.id || ""
    });
  }, [en, filteredRows.length, filters.status, selectedRow?.id]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Tag Management" : "태그 관리" }
      ]}
      title={en ? "Tag Management" : "태그 관리"}
      subtitle={en
        ? "Review content tags used by FAQ, Q&A, and search recommendation flows before wiring save APIs."
        : "FAQ, Q&A, 검색 추천 흐름에 연결되는 운영 태그를 검토하고 정리하는 화면입니다."}
    >
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="warning">
          {en
            ? "This page is wired for navigation and operator review first. Save actions are still pending backend integration."
            : "이 화면은 우선 탐색과 운영 검토 기준으로 연결했으며, 저장 액션은 아직 백엔드 연동 전입니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="tag-management-summary">
          <SummaryMetricCard title={en ? "Tags" : "태그 수"} value={TAG_ROWS.length} description={en ? "Configured operator tags" : "현재 등록된 운영 태그"} />
          <SummaryMetricCard title={en ? "Active" : "운영중"} value={activeCount} description={en ? "Currently exposed tags" : "현재 노출 중 태그"} />
          <SummaryMetricCard title={en ? "Draft" : "초안"} value={draftCount} description={en ? "Pending review" : "검토 대기 태그"} accentClassName="text-amber-700" surfaceClassName="bg-amber-50" />
          <SummaryMetricCard title={en ? "Total Usage" : "총 연결 수"} value={usageCount} description={en ? "FAQ, Q&A, and search references" : "FAQ, Q&A, 검색 추천 연결 합계"} accentClassName="text-indigo-700" surfaceClassName="bg-indigo-50" />
        </section>

        <CollectionResultPanel
          description={en
            ? "Use tags as the shared taxonomy layer across search suggestions, FAQ grouping, and Q&A intake routing."
            : "태그는 검색 추천, FAQ 분류, Q&A 접수 라우팅을 묶는 공통 분류 레이어로 사용합니다."}
          icon="sell"
          title={en ? "Governance Rule" : "운영 기준"}
        >
          {en
            ? "Keep category ownership and usage references visible before changing tag exposure."
            : "태그 노출 상태를 바꾸기 전에 연결 분류와 사용처를 함께 확인해야 합니다."}
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="tag-management-filters">
          <GridToolbar
            meta={en ? "Search by tag name, code, category, or owner." : "태그명, 코드, 분류, 담당 기준으로 조회합니다."}
            title={en ? "Filters" : "조회 조건"}
          />
          <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "Tag name, code, category" : "태그명, 코드, 분류"}
                value={filters.searchKeyword}
                onChange={(event) => setFilters((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Status" : "상태"}</span>
              <AdminSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">{statusLabel("ACTIVE", en)}</option>
                <option value="DRAFT">{statusLabel("DRAFT", en)}</option>
                <option value="HIDDEN">{statusLabel("HIDDEN", en)}</option>
              </AdminSelect>
            </label>
            <div className="flex items-end">
              <MemberButton
                onClick={() => setFilters({ searchKeyword: "", status: "ALL", selectedId: TAG_ROWS[0]?.id || "" })}
                type="button"
                variant="secondary"
              >
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <section className="gov-card overflow-hidden p-0" data-help-id="tag-management-table">
            <GridToolbar
              meta={en ? `${filteredRows.length} results` : `${filteredRows.length}건 조회`}
              title={en ? "Tag List" : "태그 목록"}
            />
            <AdminTable>
              <thead>
                <tr>
                  <th>{en ? "Code" : "코드"}</th>
                  <th>{en ? "Tag Name" : "태그명"}</th>
                  <th>{en ? "Category" : "분류"}</th>
                  <th>{en ? "Usage" : "연결 수"}</th>
                  <th>{en ? "Status" : "상태"}</th>
                  <th>{en ? "Updated" : "수정일"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    className={row.id === selectedRow?.id ? "bg-blue-50" : ""}
                    key={row.id}
                    onClick={() => setFilters((current) => ({ ...current, selectedId: row.id }))}
                  >
                    <td className="font-mono text-xs">{row.tagCode}</td>
                    <td className="font-bold">{localized(en, row.tagNameKo, row.tagNameEn)}</td>
                    <td>{localized(en, row.categoryKo, row.categoryEn)}</td>
                    <td>{row.usageCount.toLocaleString()}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(row.status)}`}>
                        {statusLabel(row.status, en)}
                      </span>
                    </td>
                    <td>{row.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </section>

          <section className="space-y-6" data-help-id="tag-management-usage">
            <article className="gov-card">
              <MemberSectionToolbar
                meta={selectedRow ? selectedRow.tagCode : "-"}
                title={en ? "Tag Detail" : "태그 상세"}
                actions={<MemberLinkButton href={buildLocalizedPath("/admin/content/qna", "/en/admin/content/qna")} variant="secondary">{en ? "Open Q&A Categories" : "Q&A 분류 열기"}</MemberLinkButton>}
              />
              {selectedRow ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Tag Name" : "태그명"}</p>
                    <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{localized(en, selectedRow.tagNameKo, selectedRow.tagNameEn)}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{localized(en, selectedRow.descriptionKo, selectedRow.descriptionEn)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "담당"}</p>
                      <p className="mt-2 text-sm font-bold">{localized(en, selectedRow.ownerKo, selectedRow.ownerEn)}</p>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</p>
                      <p className="mt-2 text-sm font-bold">{statusLabel(selectedRow.status, en)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>

            <article className="gov-card">
              <MemberSectionToolbar title={en ? "Usage Breakdown" : "사용처 현황"} />
              {selectedRow ? (
                <div className="mt-5 grid grid-cols-1 gap-3">
                  {[
                    { label: en ? "FAQ" : "FAQ", value: selectedRow.faqCount },
                    { label: en ? "Q&A" : "Q&A", value: selectedRow.qnaCount },
                    { label: en ? "Search Suggestions" : "검색 추천", value: selectedRow.searchCount }
                  ].map((item) => (
                    <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={item.label}>
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.label}</span>
                      <span className="text-base font-black text-[var(--kr-gov-blue)]">{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Keep shared tags broad enough for reuse, but do not merge categories that have different ownership or SLA rules."
                  : "공통 태그는 재사용 가능해야 하지만, 담당 조직이나 SLA가 다른 분류를 무리하게 합치면 안 됩니다."}
              </div>
            </article>
          </section>
        </section>

        {hiddenCount > 0 ? (
          <PageStatusNotice tone="warning">
            {en
              ? `${hiddenCount} hidden tags remain for archived or migration-only flows. Review references before deleting them.`
              : `${hiddenCount}개의 숨김 태그가 보관 또는 이관 전용으로 남아 있습니다. 삭제 전 연결 사용처를 먼저 점검하세요.`}
          </PageStatusNotice>
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
