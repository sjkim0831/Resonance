import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import {
  deleteFileManagementPage,
  fetchFileManagementPage,
  replaceFileManagementPage,
  restoreFileManagementPage,
  saveFileManagementPage,
  updateFileManagementPage
} from "../../lib/api/content";
import type { FileManagementPagePayload } from "../../lib/api/contentTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";
import { stringOf } from "./fileManagementShared";

type Filters = {
  searchKeyword: string;
  status: string;
  visibility: string;
  selectedId: string;
};

type EditForm = {
  category: string;
  visibility: string;
  status: string;
  description: string;
};

function readInitialFilters(): Filters {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "ALL",
    visibility: search.get("visibility") || "ALL",
    selectedId: search.get("fileId") || ""
  };
}

function statusClassName(status: string) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "REVIEW") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
}

function statusLabel(status: string, en: boolean) {
  if (status === "ACTIVE") {
    return en ? "Active" : "운영중";
  }
  if (status === "REVIEW") {
    return en ? "Review" : "검토중";
  }
  return en ? "Archive" : "보관";
}

function visibilityClassName(visibility: string) {
  if (visibility === "PUBLIC") {
    return "bg-sky-100 text-sky-700";
  }
  if (visibility === "INTERNAL") {
    return "bg-violet-100 text-violet-700";
  }
  return "bg-rose-100 text-rose-700";
}

function visibilityLabel(visibility: string, en: boolean) {
  if (visibility === "PUBLIC") {
    return en ? "Public" : "공개";
  }
  if (visibility === "INTERNAL") {
    return en ? "Internal" : "내부";
  }
  return en ? "Limited" : "제한";
}

export function FileManagementMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoreNote, setRestoreNote] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({ category: "", visibility: "INTERNAL", status: "REVIEW", description: "" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const pageState = useAsyncValue<FileManagementPagePayload>(
    () => fetchFileManagementPage({
      searchKeyword: filters.searchKeyword,
      status: filters.status,
      visibility: filters.visibility,
      fileId: filters.selectedId
    }),
    [filters.searchKeyword, filters.status, filters.visibility, filters.selectedId]
  );
  const page = pageState.value;
  const pageError = actionError || pageState.error;
  const summaryCards = ((page?.summaryCards || []) as Array<Record<string, string>>);
  const fileRows = ((page?.fileRows || []) as Array<Record<string, string>>);
  const selectedRow = ((page?.selectedFile || null) as Record<string, string> | null);
  const selectedHistory = ((page?.selectedFileHistory || []) as Array<Record<string, string>>);
  const deletedFileRows = ((page?.deletedFileRows || []) as Array<Record<string, string>>);
  const governanceNotes = ((page?.governanceNotes || []) as Array<Record<string, string>>);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.searchKeyword) {
      params.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.status !== "ALL") {
      params.set("status", filters.status);
    }
    if (filters.visibility !== "ALL") {
      params.set("visibility", filters.visibility);
    }
    if (selectedRow?.id) {
      params.set("fileId", stringOf(selectedRow, "id"));
    }
    replace(`${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [filters.searchKeyword, filters.status, filters.visibility, selectedRow?.id]);

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
    logGovernanceScope("PAGE", "file-management", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      filterStatus: filters.status,
      filterVisibility: filters.visibility,
      resultCount: fileRows.length,
      selectedFileId: stringOf(selectedRow, "id")
    });
  }, [en, filters.status, filters.visibility, fileRows.length, selectedRow]);

  const linkedScreenCount = useMemo(() => fileRows.reduce((sum, row) => sum + Number(stringOf(row, "linkedScreens") || "0"), 0), [fileRows]);
  const canDownloadSelected = stringOf(selectedRow, "downloadAvailable") === "Y";
  const canEditSelected = stringOf(selectedRow, "uploaded") === "Y";

  useEffect(() => {
    setEditForm({
      category: stringOf(selectedRow, "categoryLabel"),
      visibility: stringOf(selectedRow, "visibility") || "INTERNAL",
      status: stringOf(selectedRow, "status") || "REVIEW",
      description: stringOf(selectedRow, "description")
    });
  }, [selectedRow]);

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await saveFileManagementPage({
        uploadFile: nextFile,
        category: en ? "Uploaded Asset" : "운영 업로드",
        visibility: "INTERNAL",
        status: "REVIEW",
        description: en ? "Uploaded from the admin file-management screen." : "관리자 파일 관리 화면에서 업로드한 파일입니다."
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to upload file." : "파일 업로드에 실패했습니다."));
      }
      setMessage(response.message || (en ? "File uploaded." : "파일을 업로드했습니다."));
      setFilters((current) => ({ ...current, selectedId: String(response.fileId || current.selectedId) }));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to upload file." : "파일 업로드에 실패했습니다."));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSaving(false);
    }
  }

  async function handleDelete() {
    const selectedId = stringOf(selectedRow, "id");
    if (!selectedId) {
      return;
    }
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(en ? "Delete this file entry?" : "이 파일 항목을 삭제하시겠습니까?");
    if (!confirmed) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await deleteFileManagementPage(selectedId);
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to delete file." : "파일 삭제에 실패했습니다."));
      }
      setMessage(response.message || (en ? "File deleted." : "파일을 삭제했습니다."));
      setFilters((current) => ({ ...current, selectedId: "" }));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to delete file." : "파일 삭제에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleReplaceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedId = stringOf(selectedRow, "id");
    const nextFile = event.target.files?.[0];
    if (!selectedId || !nextFile || !canEditSelected) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await replaceFileManagementPage({
        fileId: selectedId,
        uploadFile: nextFile
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to replace file." : "파일 교체에 실패했습니다."));
      }
      setMessage(response.message || (en ? "File replaced." : "파일을 교체했습니다."));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to replace file." : "파일 교체에 실패했습니다."));
    } finally {
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = "";
      }
      setSaving(false);
    }
  }

  function handleDownload() {
    const selectedId = stringOf(selectedRow, "id");
    if (!selectedId || !canDownloadSelected || typeof window === "undefined") {
      return;
    }
    const downloadPath = buildLocalizedPath("/admin/api/admin/content/file/download", "/en/admin/api/admin/content/file/download");
    window.location.href = `${downloadPath}?${new URLSearchParams({ fileId: selectedId }).toString()}`;
  }

  async function handleMetadataSave() {
    const selectedId = stringOf(selectedRow, "id");
    if (!selectedId || !canEditSelected) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await updateFileManagementPage({
        fileId: selectedId,
        category: editForm.category,
        visibility: editForm.visibility,
        status: editForm.status,
        description: editForm.description
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to update file metadata." : "파일 정보 수정에 실패했습니다."));
      }
      setMessage(response.message || (en ? "File metadata updated." : "파일 정보를 수정했습니다."));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to update file metadata." : "파일 정보 수정에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(fileId: string) {
    if (!fileId) {
      return;
    }
    setActionError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await restoreFileManagementPage(fileId, restoreNote);
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to restore deleted file." : "삭제 파일 복구에 실패했습니다."));
      }
      setMessage(response.message || (en ? "Deleted file restored." : "삭제 파일을 복구했습니다."));
      setRestoreNote("");
      setFilters((current) => ({ ...current, selectedId: String(response.fileId || current.selectedId) }));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to restore deleted file." : "삭제 파일 복구에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "File Management" : "파일 관리" }
      ]}
      title={en ? "File Management" : "파일 관리"}
      subtitle={en
        ? "Review content assets, distribution scope, and linked screens before wiring upload and approval APIs."
        : "콘텐츠 운영 파일의 배포 범위와 연결 화면을 확인하는 관리자 페이지입니다. 업로드와 승인 API 연결 전 운영 기준을 먼저 정리합니다."}
      loading={pageState.loading && !page && !pageError}
      loadingLabel={en ? "Loading file inventory..." : "파일 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageError ? <PageStatusNotice tone="error">{pageError}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        <PageStatusNotice tone="warning">
          {en
            ? "Uploaded files are now persisted locally and can be downloaded. Seeded reference rows remain preview-only until a full repository-backed registry is wired."
            : "업로드 파일은 이제 로컬에 영속 저장되고 다운로드할 수 있습니다. 기본 시드 행은 저장소 연계 전까지 미리보기 성격의 참조 데이터로 유지됩니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="file-management-summary">
          {summaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card, "title")}-${index}`}
              title={stringOf(card, "title")}
              value={stringOf(card, "value")}
              description={index === 3
                ? (en ? `${linkedScreenCount} linked screen references` : `연결 화면 ${linkedScreenCount}건 참조`)
                : stringOf(card, "description")}
              accentClassName={index === 2 ? "text-amber-700" : index === 3 ? "text-indigo-700" : undefined}
              surfaceClassName={index === 2 ? "bg-amber-50" : index === 3 ? "bg-indigo-50" : undefined}
            />
          ))}
        </section>

        <CollectionResultPanel
          description={en
            ? "Treat content files as governed assets with exposure scope, retention policy, and screen linkage."
            : "운영 파일은 노출 범위, 보관 정책, 연결 화면을 함께 관리하는 콘텐츠 자산으로 취급합니다."}
          icon="folder"
          title={en ? "Governance Rule" : "운영 기준"}
        >
          {en
            ? "Do not widen visibility before confirming owner, retention period, and linked screen impact."
            : "담당자, 보관 기간, 연결 화면 영향을 확인하기 전에는 공개 범위를 넓히지 않습니다."}
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="file-management-filters">
          <GridToolbar
            meta={en ? "Search by file name, extension, category, or owner." : "파일명, 확장자, 분류, 담당 기준으로 조회합니다."}
            title={en ? "Filters" : "조회 조건"}
          />
          <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "File name, extension, category" : "파일명, 확장자, 분류"}
                value={filters.searchKeyword}
                onChange={(event) => setFilters((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Status" : "상태"}</span>
              <AdminSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">{statusLabel("ACTIVE", en)}</option>
                <option value="REVIEW">{statusLabel("REVIEW", en)}</option>
                <option value="ARCHIVE">{statusLabel("ARCHIVE", en)}</option>
              </AdminSelect>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Visibility" : "공개 범위"}</span>
              <AdminSelect value={filters.visibility} onChange={(event) => setFilters((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="PUBLIC">{visibilityLabel("PUBLIC", en)}</option>
                <option value="INTERNAL">{visibilityLabel("INTERNAL", en)}</option>
                <option value="LIMITED">{visibilityLabel("LIMITED", en)}</option>
              </AdminSelect>
            </label>
            <div className="flex items-end">
              <MemberButton
                onClick={() => setFilters({ searchKeyword: "", status: "ALL", visibility: "ALL", selectedId: "" })}
                type="button"
                variant="secondary"
                disabled={saving}
              >
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <section className="gov-card overflow-hidden p-0" data-help-id="file-management-table">
            <GridToolbar
              meta={en ? `${fileRows.length} results` : `${fileRows.length}건 조회`}
              title={en ? "File List" : "파일 목록"}
            />
            <AdminTable>
              <thead>
                <tr>
                  <th>{en ? "File Name" : "파일명"}</th>
                  <th>{en ? "Version" : "버전"}</th>
                  <th>{en ? "Category" : "분류"}</th>
                  <th>{en ? "Type" : "형식"}</th>
                  <th>{en ? "Screens" : "연결 화면"}</th>
                  <th>{en ? "Visibility" : "공개 범위"}</th>
                  <th>{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {fileRows.map((row) => (
                  <tr
                    className={stringOf(row, "id") === stringOf(selectedRow, "id") ? "bg-blue-50" : ""}
                    key={stringOf(row, "id")}
                    onClick={() => setFilters((current) => ({ ...current, selectedId: stringOf(row, "id") }))}
                  >
                    <td className="font-bold">{stringOf(row, "fileName")}</td>
                    <td className="font-mono text-xs">{stringOf(row, "versionLabel") || "-"}</td>
                    <td>{stringOf(row, "categoryLabel")}</td>
                    <td className="font-mono text-xs">{stringOf(row, "extension")} / {stringOf(row, "sizeLabel")}</td>
                    <td>{stringOf(row, "linkedScreens")}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${visibilityClassName(stringOf(row, "visibility"))}`}>
                        {stringOf(row, "visibilityLabel")}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(stringOf(row, "status"))}`}>
                        {stringOf(row, "statusLabel")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </section>

          <section className="space-y-4" data-help-id="file-management-detail">
            <section className="gov-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">
                    {en ? "Selected File" : "선택 파일"}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--kr-gov-text-primary)]">
                    {stringOf(selectedRow, "fileName") || (en ? "No file selected" : "선택된 파일 없음")}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {stringOf(selectedRow, "description")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRow ? (
                    <>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${visibilityClassName(stringOf(selectedRow, "visibility"))}`}>
                        {stringOf(selectedRow, "visibilityLabel")}
                      </span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(stringOf(selectedRow, "status"))}`}>
                        {stringOf(selectedRow, "statusLabel")}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Category" : "분류"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">
                    {stringOf(selectedRow, "categoryLabel") || "-"}
                    {stringOf(selectedRow, "versionLabel") ? ` / ${stringOf(selectedRow, "versionLabel")}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Owner" : "운영 담당"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "owner") || "-"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Retention" : "보관 정책"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "retentionLabel") || "-"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Security Grade" : "보안 등급"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "securityGradeLabel") || "-"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Downloads" : "다운로드 수"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "downloadCount") || "-"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Stored File" : "실제 저장 파일"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">
                    {stringOf(selectedRow, "uploaded") === "Y"
                      ? (canDownloadSelected ? (en ? "Available for download" : "다운로드 가능") : (en ? "File missing from storage" : "저장 파일 없음"))
                      : (en ? "Seeded reference row" : "기본 참조 행")}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Last Updated" : "최종 수정"}</dt>
                  <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">
                    {selectedRow ? `${stringOf(selectedRow, "updatedAt")} / ${stringOf(selectedRow, "updatedBy")}` : "-"}
                  </dd>
                </div>
              </dl>

              <MemberSectionToolbar
                title={en ? "Related Content" : "연결 콘텐츠"}
                meta={en ? "Move to nearby content screens that usually consume shared files." : "공통 파일을 함께 쓰는 인접 콘텐츠 화면으로 이동합니다."}
                actions={(
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      className="hidden"
                      type="file"
                      onChange={handleUploadChange}
                    />
                    <input
                      ref={replaceFileInputRef}
                      className="hidden"
                      type="file"
                      onChange={handleReplaceChange}
                    />
                    <MemberButton onClick={() => fileInputRef.current?.click()} size="xs" type="button" disabled={saving}>
                      {en ? "Upload" : "업로드"}
                    </MemberButton>
                    <MemberButton onClick={() => replaceFileInputRef.current?.click()} size="xs" type="button" variant="secondary" disabled={saving || !canEditSelected}>
                      {en ? "Replace" : "파일 교체"}
                    </MemberButton>
                    <MemberButton onClick={handleDownload} size="xs" type="button" variant="secondary" disabled={saving || !canDownloadSelected}>
                      {en ? "Download" : "다운로드"}
                    </MemberButton>
                    <MemberButton onClick={handleDelete} size="xs" type="button" variant="secondary" disabled={saving || !stringOf(selectedRow, "id")}>
                      {en ? "Delete" : "삭제"}
                    </MemberButton>
                    <MemberLinkButton href={buildLocalizedPath("/admin/content/faq_list", "/en/admin/content/faq_list")} size="xs" variant="secondary">
                      {en ? "FAQ" : "FAQ"}
                    </MemberLinkButton>
                    <MemberLinkButton href={buildLocalizedPath("/admin/content/tag", "/en/admin/content/tag")} size="xs" variant="secondary">
                      {en ? "Tags" : "태그"}
                    </MemberLinkButton>
                    <MemberLinkButton href={buildLocalizedPath("/admin/content/banner_list", "/en/admin/content/banner_list")} size="xs" variant="secondary">
                      {en ? "Banners" : "배너"}
                    </MemberLinkButton>
                  </div>
                )}
              />
            </section>
            <section className="gov-card">
              <MemberSectionToolbar
                title={en ? "Edit Metadata" : "파일 정보 수정"}
                meta={canEditSelected
                  ? (en ? "Uploaded files can be reclassified before exposure." : "업로드된 파일은 배포 전에 분류와 상태를 다시 조정할 수 있습니다.")
                  : (en ? "Seeded reference rows are read-only." : "기본 참조 행은 읽기 전용입니다.")}
              />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Category" : "분류"}</span>
                  <AdminInput
                    value={editForm.category}
                    onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                    disabled={!canEditSelected || saving}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Visibility" : "공개 범위"}</span>
                  <AdminSelect
                    value={editForm.visibility}
                    onChange={(event) => setEditForm((current) => ({ ...current, visibility: event.target.value }))}
                    disabled={!canEditSelected || saving}
                  >
                    <option value="PUBLIC">{visibilityLabel("PUBLIC", en)}</option>
                    <option value="INTERNAL">{visibilityLabel("INTERNAL", en)}</option>
                    <option value="LIMITED">{visibilityLabel("LIMITED", en)}</option>
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Status" : "상태"}</span>
                  <AdminSelect
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                    disabled={!canEditSelected || saving}
                  >
                    <option value="ACTIVE">{statusLabel("ACTIVE", en)}</option>
                    <option value="REVIEW">{statusLabel("REVIEW", en)}</option>
                    <option value="ARCHIVE">{statusLabel("ARCHIVE", en)}</option>
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Description" : "설명"}</span>
                  <textarea
                    className="min-h-28 rounded-md border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm text-[var(--kr-gov-text-primary)]"
                    value={editForm.description}
                    onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    disabled={!canEditSelected || saving}
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <MemberButton onClick={handleMetadataSave} type="button" disabled={!canEditSelected || saving}>
                  {en ? "Save Metadata" : "정보 저장"}
                </MemberButton>
              </div>
            </section>
            <section className="gov-card">
              <MemberSectionToolbar
                title={en ? "Version History" : "버전 이력"}
                meta={en ? "Recent file actions persisted with the local registry." : "로컬 레지스트리에 함께 저장되는 최근 파일 액션입니다."}
              />
              <div className="mt-4 space-y-3">
                {selectedHistory.length > 0 ? selectedHistory.map((history, index) => (
                  <div className="rounded-xl border border-[var(--kr-gov-border-light)] p-4" key={`${stringOf(history, "at", "action")}-${index}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(history, "actionLabel")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                          {`${stringOf(history, "at")} / ${stringOf(history, "actor") || "-"}`}
                        </div>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {stringOf(history, "action")}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(history, "message")}</div>
                  </div>
                )) : (
                  <PageStatusNotice tone="warning">
                    {en ? "No version history recorded for this file yet." : "이 파일에 기록된 버전 이력이 아직 없습니다."}
                  </PageStatusNotice>
                )}
              </div>
            </section>
            <section className="gov-card">
              <MemberSectionToolbar
                title={en ? "Deleted Backups" : "삭제 백업"}
                meta={en ? "Recent deleted files that can be restored into the active list." : "활성 목록으로 복구 가능한 최근 삭제 파일입니다."}
              />
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Restore Note" : "복구 메모"}</span>
                <textarea
                  className="min-h-24 rounded-md border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm text-[var(--kr-gov-text-primary)]"
                  placeholder={en ? "Reason for restoring this deleted file" : "삭제 파일을 복구하는 이유를 기록합니다."}
                  value={restoreNote}
                  onChange={(event) => setRestoreNote(event.target.value)}
                  disabled={saving}
                />
              </label>
              <div className="mt-4 space-y-3">
                {deletedFileRows.length > 0 ? deletedFileRows.map((row) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--kr-gov-border-light)] p-4" key={stringOf(row, "id")}>
                    <div>
                      <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                        {`${stringOf(row, "fileName")} ${stringOf(row, "versionLabel") ? `(${stringOf(row, "versionLabel")})` : ""}`}
                      </div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                        {`${stringOf(row, "categoryLabel")} / ${stringOf(row, "updatedAt")} / ${stringOf(row, "updatedBy")}`}
                      </div>
                      {stringOf(row, "lastActionMessage") ? (
                        <div className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "lastActionMessage")}</div>
                      ) : null}
                    </div>
                    <MemberButton onClick={() => handleRestore(stringOf(row, "id"))} size="xs" type="button" variant="secondary" disabled={saving}>
                      {en ? "Restore" : "복구"}
                    </MemberButton>
                  </div>
                )) : (
                  <PageStatusNotice tone="warning">
                    {en ? "No deleted backups are available." : "복구 가능한 삭제 백업이 없습니다."}
                  </PageStatusNotice>
                )}
              </div>
            </section>
            {governanceNotes.length > 0 ? (
              <section className="gov-card">
                <MemberSectionToolbar
                  title={en ? "Governance Notes" : "운영 메모"}
                  meta={en ? "Policy notes delivered by the backend payload." : "백엔드 payload로 전달되는 운영 기준 메모입니다."}
                />
                <div className="mt-4 space-y-3">
                  {governanceNotes.map((note, index) => (
                    <div className="rounded-xl border border-[var(--kr-gov-border-light)] p-4" key={`${stringOf(note, "title")}-${index}`}>
                      <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(note, "title")}</div>
                      <div className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(note, "body")}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
