import { useDeferredValue, useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchSystemCodePage } from "../../lib/api/member";
import type { SystemCodePagePayload } from "../../lib/api/memberTypes";
import {
  buildLocalizedPath,
  isEnglish
} from "../../lib/navigation/runtime";
import { stringOf, submitFormRequest } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ADMIN_BUTTON_LABELS } from "../admin-ui/labels";
import {
  AdminInput,
  AdminSearchSection,
  AdminSearchField,
  AdminSelect,
  AdminSortableHeader,
  AdminTable,
  MemberButton,
  MemberSectionToolbar,
  PageStatusNotice,
  useAdminSort,
  useAdminSearch
} from "../admin-ui/common";
import { MemberModal } from "../admin-ui/Modal";

const ITEMS_PER_PAGE = 20;

export function SystemCodePage() {
  const en = isEnglish();

  const { keyword, draftKeyword, setDraftKeyword, handleSearchSubmit, handleReset } = useAdminSearch();
  const { sortState, handleSort } = useAdminSort("code", "asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState("");

  const state = useAsyncValue<SystemCodePagePayload>(() => fetchSystemCodePage(), []);
  const { value: page, reload } = state;

  const deferredSearch = useDeferredValue(keyword);

  const clCodeList = (page?.clCodeList || []) as Array<Record<string, unknown>>;
  const codeList = (page?.codeList || []) as Array<Record<string, unknown>>;
  const detailCodeList = (page?.detailCodeList || []) as Array<Record<string, unknown>>;

  const [selectedClCode, setSelectedClCode] = useState("");
  const [selectedCodeId, setSelectedCodeId] = useState("");

  const filteredDetailCodeList = detailCodeList.filter((row) => {
    const detailCodeId = stringOf(row, "codeId", "CODE_ID");
    const codeNm = stringOf(row, "codeNm", "CODE_NM").toLowerCase();
    const code = stringOf(row, "code", "CODE").toLowerCase();
    const codeDc = stringOf(row, "codeDc", "CODE_DC").toLowerCase();
    const search = deferredSearch.toLowerCase();

    if (deferredSearch && !codeNm.includes(search) && !code.includes(search) && !codeDc.includes(search)) {
      return false;
    }
    if (selectedCodeId && detailCodeId !== selectedCodeId) {
      return false;
    }
    if (selectedClCode) {
      const parentCode = codeList.find((c) => stringOf(c, "codeId", "CODE_ID") === detailCodeId);
      if (!parentCode || stringOf(parentCode, "clCode", "CL_CODE") !== selectedClCode) {
        return false;
      }
    }
    return true;
  });

  const sortedRows = [...filteredDetailCodeList].sort((a, b) => {
    const col = sortState.column;
    const aVal = col ? stringOf(a, col, col.toUpperCase()) : "";
    const bVal = col ? stringOf(b, col, col.toUpperCase()) : "";
    const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
    return sortState.direction === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ITEMS_PER_PAGE));
  const paginatedRows = sortedRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClCode, selectedCodeId, deferredSearch]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setActionError("");
    try {
      await submitFormRequest(form);
      setEditModalOpen(false);
      setDeleteConfirmOpen(false);
      setSelectedRow(null);
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Request failed." : "요청 처리에 실패했습니다."));
    }
  }

  function openEditModal(row: Record<string, unknown>) {
    setSelectedRow(row);
    setEditModalOpen(true);
  }

  function openDeleteModal(row: Record<string, unknown>) {
    setSelectedRow(row);
    setDeleteConfirmOpen(true);
  }

  function resetAll() {
    handleReset();
    setSelectedClCode("");
    setSelectedCodeId("");
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Code Inquiry" : "코드 조회" }
      ]}
      title={en ? "Code Inquiry" : "코드 조회"}
    >
      {actionError ? (
        <PageStatusNotice aria-live="assertive" role="alert" tone="error">{actionError}</PageStatusNotice>
      ) : null}

      <AdminSearchSection
        en={en}
        metaLabel={en ? "Search by class, code ID, or keyword" : "대분류, 중분류, 검색어로 조회"}
        onReset={resetAll}
        onSearch={handleSearchSubmit}
        searchLabel={en ? "Search" : "검색"}
        totalCount={filteredDetailCodeList.length}
      >
        <AdminSearchField label={en ? "Class" : "대분류"}>
          <AdminSelect
            onChange={(e) => {
              setSelectedClCode(e.target.value);
              setSelectedCodeId("");
            }}
            value={selectedClCode}
          >
            <option value="">{en ? "All Classes" : "전체 대분류"}</option>
            {clCodeList.map((row) => (
              <option key={stringOf(row, "clCode", "CL_CODE")} value={stringOf(row, "clCode", "CL_CODE")}>
                {`${stringOf(row, "clCode", "CL_CODE")} - ${stringOf(row, "clCodeNm", "CL_CODE_NM")}`}
              </option>
            ))}
          </AdminSelect>
        </AdminSearchField>
        <AdminSearchField label={en ? "Code ID" : "중분류"}>
          <AdminSelect
            onChange={(e) => setSelectedCodeId(e.target.value)}
            value={selectedCodeId}
          >
            <option value="">{en ? "All Code IDs" : "전체 중분류"}</option>
            {codeList
              .filter((row) => !selectedClCode || stringOf(row, "clCode", "CL_CODE") === selectedClCode)
              .map((row) => (
                <option key={stringOf(row, "codeId", "CODE_ID")} value={stringOf(row, "codeId", "CODE_ID")}>
                  {`${stringOf(row, "codeId", "CODE_ID")} - ${stringOf(row, "codeIdNm", "CODE_ID_NM")}`}
                </option>
              ))}
          </AdminSelect>
        </AdminSearchField>
        <AdminSearchField label={en ? "Search" : "검색"} className="md:col-span-2">
          <AdminInput
            className="flex-1"
            onChange={(e) => setDraftKeyword(e.target.value)}
            placeholder={en ? "Code, name, description" : "코드, 코드명, 설명"}
            value={draftKeyword}
          />
        </AdminSearchField>
      </AdminSearchSection>

      <div className="gov-card p-0 overflow-hidden">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={
              <MemberButton
                onClick={() => {
                  setSelectedRow(null);
                  setEditModalOpen(true);
                }}
                type="button"
                variant="primary"
              >
                {en ? "Add" : ADMIN_BUTTON_LABELS.create}
              </MemberButton>
            }
            meta={en ? `${filteredDetailCodeList.length} items found` : `${filteredDetailCodeList.length}개 항목`}
            title={en ? "Code List" : "코드 목록"}
          />
        </div>
        <div className="overflow-x-auto">
          <AdminTable>
            <thead>
              <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                <AdminSortableHeader column="clCode" currentSort={sortState} label={en ? "Class" : "대분류"} onSort={handleSort} />
                <AdminSortableHeader column="codeId" currentSort={sortState} label={en ? "Code ID" : "중분류"} onSort={handleSort} />
                <AdminSortableHeader column="code" currentSort={sortState} label={en ? "Code" : "소분류 코드"} onSort={handleSort} />
                <AdminSortableHeader column="codeNm" currentSort={sortState} label={en ? "Name" : "코드명"} onSort={handleSort} />
                <th className="px-6 py-4">{en ? "Description" : "설명"}</th>
                <AdminSortableHeader column="useAt" currentSort={sortState} label={en ? "Use" : "사용"} onSort={handleSort} />
                <th className="px-6 py-4 text-center">{en ? "Actions" : "작업"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={7}>
                    {en ? "No codes found." : "코드가 없습니다."}
                  </td>
                </tr>
              ) : paginatedRows.map((row) => {
                const rowKey = stringOf(row, "code", "CODE");
                const detailCodeId = stringOf(row, "codeId", "CODE_ID");
                const parentCode = codeList.find((c) => stringOf(c, "codeId", "CODE_ID") === detailCodeId);
                const parentClCode = parentCode ? stringOf(parentCode, "clCode", "CL_CODE") : "";
                const parentClCodeNm = clCodeList.find((c) => stringOf(c, "clCode", "CL_CODE") === parentClCode) ? stringOf(clCodeList.find((c) => stringOf(c, "clCode", "CL_CODE") === parentClCode)!, "clCodeNm", "CL_CODE_NM") : "";
                return (
                  <tr key={rowKey} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">{parentClCode} - {parentClCodeNm}</td>
                    <td className="px-6 py-4">{detailCodeId} - {parentCode ? stringOf(parentCode, "codeIdNm", "CODE_ID_NM") : ""}</td>
                    <td className="px-6 py-4">{rowKey}</td>
                    <td className="px-6 py-4">{stringOf(row, "codeNm", "CODE_NM")}</td>
                    <td className="px-6 py-4">{stringOf(row, "codeDc", "CODE_DC")}</td>
                    <td className="px-6 py-4">{stringOf(row, "useAt", "USE_AT")}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <MemberButton onClick={() => openEditModal(row)} type="button" variant="secondary">
                          {en ? "Edit" : "편집"}
                        </MemberButton>
                        <MemberButton onClick={() => openDeleteModal(row)} type="button" variant="danger">
                          {en ? "Delete" : "삭제"}
                        </MemberButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <MemberButton disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} type="button" variant="secondary">
              {en ? "Previous" : "이전"}
            </MemberButton>
            <span className="text-sm">{currentPage} / {totalPages}</span>
            <MemberButton disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} type="button" variant="secondary">
              {en ? "Next" : "다음"}
            </MemberButton>
          </div>
        )}
      </div>

      {editModalOpen && (
        <MemberModal
          onClose={() => { setEditModalOpen(false); setSelectedRow(null); }}
          size="md"
          title={selectedRow ? (en ? "Edit Detail Code" : "소분류 수정") : (en ? "Add Detail Code" : "소분류 등록")}
        >
          <form action="/admin/system/code/detail/create" className="space-y-4" method="post" onSubmit={handleSubmit}>
            <input name="code" type="hidden" value={selectedRow ? stringOf(selectedRow, "code", "CODE") : ""} />
            <input name="codeId" type="hidden" value={selectedRow ? stringOf(selectedRow, "codeId", "CODE_ID") : ""} />

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Class" : "대분류"}</span>
              <AdminSelect
                id="modalClCode"
                name="clCode"
                onChange={(e) => {
                  const firstCodeId = codeList.find((c) => stringOf(c, "clCode", "CL_CODE") === e.target.value);
                  const codeIdSelect = document.getElementById("modalCodeId") as HTMLSelectElement;
                  if (codeIdSelect && firstCodeId) {
                    codeIdSelect.value = stringOf(firstCodeId, "codeId", "CODE_ID");
                  }
                }}
              >
                {clCodeList.map((row) => (
                  <option
                    key={stringOf(row, "clCode", "CL_CODE")}
                    value={stringOf(row, "clCode", "CL_CODE")}
                    selected={selectedRow ? stringOf(codeList.find((c) => stringOf(c, "codeId", "CODE_ID") === stringOf(selectedRow, "codeId", "CODE_ID"))!, "clCode", "CL_CODE") === stringOf(row, "clCode", "CL_CODE") : false}
                  >
                    {`${stringOf(row, "clCode", "CL_CODE")} - ${stringOf(row, "clCodeNm", "CL_CODE_NM")}`}
                  </option>
                ))}
              </AdminSelect>
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Code ID" : "중분류"}</span>
              <AdminSelect id="modalCodeId" name="codeId">
                {codeList
                  .filter((row) => {
                    if (selectedRow) {
                      const selectedParent = codeList.find((c) => stringOf(c, "codeId", "CODE_ID") === stringOf(selectedRow, "codeId", "CODE_ID"));
                      return stringOf(row, "clCode", "CL_CODE") === stringOf(selectedParent, "clCode", "CL_CODE");
                    }
                    const clCodeSelect = document.getElementById("modalClCode") as HTMLSelectElement;
                    return !clCodeSelect || stringOf(row, "clCode", "CL_CODE") === clCodeSelect.value;
                  })
                  .map((row) => (
                    <option
                      key={stringOf(row, "codeId", "CODE_ID")}
                      value={stringOf(row, "codeId", "CODE_ID")}
                      selected={selectedRow ? stringOf(row, "codeId", "CODE_ID") === stringOf(selectedRow, "codeId", "CODE_ID") : false}
                    >
                      {`${stringOf(row, "codeId", "CODE_ID")} - ${stringOf(row, "codeIdNm", "CODE_ID_NM")}`}
                    </option>
                  ))}
              </AdminSelect>
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Code Value" : "소분류 코드"}</span>
              <AdminInput defaultValue={selectedRow ? stringOf(selectedRow, "code", "CODE") : ""} name="code" placeholder={en ? "e.g., H001" : "예: H001"} />
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Name" : "코드명"}</span>
              <AdminInput defaultValue={selectedRow ? stringOf(selectedRow, "codeNm", "CODE_NM") : ""} name="codeNm" placeholder={en ? "e.g., Home Menu" : "예: 홈 메뉴"} />
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
              <AdminInput defaultValue={selectedRow ? stringOf(selectedRow, "codeDc", "CODE_DC") : ""} name="codeDc" />
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Use" : "사용"}</span>
              <AdminSelect defaultValue={selectedRow ? stringOf(selectedRow, "useAt", "USE_AT") || "Y" : "Y"} name="useAt">
                <option value="Y">Y</option>
                <option value="N">N</option>
              </AdminSelect>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <MemberButton onClick={() => { setEditModalOpen(false); setSelectedRow(null); }} type="button" variant="secondary">
                {en ? "Cancel" : "취소"}
              </MemberButton>
              <MemberButton type="submit" variant="primary">
                {en ? "Save" : "저장"}
              </MemberButton>
            </div>
          </form>
        </MemberModal>
      )}

      {deleteConfirmOpen && selectedRow && (
        <MemberModal
          onClose={() => { setDeleteConfirmOpen(false); setSelectedRow(null); }}
          size="sm"
          title={en ? "Confirm Delete" : "삭제 확인"}
        >
          <p className="mb-4">
            {en ? `Delete "${stringOf(selectedRow, "code", "CODE")}"?` : `"${stringOf(selectedRow, "code", "CODE")}"을(를) 삭제하시겠습니까?`}
          </p>
          <form action="/admin/system/code/detail/delete" method="post" onSubmit={handleSubmit}>
            <input name="code" type="hidden" value={stringOf(selectedRow, "code", "CODE")} />
            <input name="codeId" type="hidden" value={stringOf(selectedRow, "codeId", "CODE_ID")} />
            <div className="flex justify-end gap-2">
              <MemberButton onClick={() => { setDeleteConfirmOpen(false); setSelectedRow(null); }} type="button" variant="secondary">
                {en ? "Cancel" : "취소"}
              </MemberButton>
              <MemberButton type="submit" variant="danger">
                {en ? "Delete" : "삭제"}
              </MemberButton>
            </div>
          </form>
        </MemberModal>
      )}
    </AdminPageShell>
  );
}

export const SystemCodeMigrationPage = SystemCodePage;