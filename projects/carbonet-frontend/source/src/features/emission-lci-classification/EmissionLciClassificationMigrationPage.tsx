import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  deleteEmissionLciClassification,
  fetchEmissionLciClassificationPage,
  saveEmissionLciClassification
} from "../../lib/api/emission";
import type { EmissionLciClassificationPagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, MemberButton } from "../member/common";
import { LookupContextStrip, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  searchKeyword: string;
  level: string;
  useAt: string;
  code: string;
};

type FormState = {
  originalCode: string;
  code: string;
  label: string;
  tierLabel: string;
  aliases: string;
  useAt: string;
};

function stringOf(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function arrayOf(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return { searchKeyword: "", level: "", useAt: "", code: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    searchKeyword: params.get("searchKeyword") || "",
    level: params.get("level") || "",
    useAt: params.get("useAt") || "",
    code: params.get("code") || ""
  };
}

function buildEmptyForm(): FormState {
  return {
    originalCode: "",
    code: "",
    label: "",
    tierLabel: "",
    aliases: "",
    useAt: "Y"
  };
}

function buildFormFromRow(row: Record<string, unknown> | null | undefined): FormState {
  if (!row) {
    return buildEmptyForm();
  }
  return {
    originalCode: stringOf(row.code),
    code: stringOf(row.code),
    label: stringOf(row.label),
    tierLabel: stringOf(row.tierLabel),
    aliases: arrayOf(row.aliases).map((item) => stringOf(item)).filter(Boolean).join(", "),
    useAt: stringOf(row.useAt) || "Y"
  };
}

function inferLevelLabel(code: string, en: boolean) {
  const length = code.replace(/\D/g, "").length;
  if (length >= 6) return en ? "Small" : "소분류";
  if (length >= 4) return en ? "Middle" : "중분류";
  if (length >= 2) return en ? "Major" : "대분류";
  return en ? "Pending" : "입력 전";
}

export function EmissionLciClassificationMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [form, setForm] = useState<FormState>(buildEmptyForm);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const pageState = useAsyncValue<EmissionLciClassificationPagePayload>(
    () => fetchEmissionLciClassificationPage(filters),
    [filters.searchKeyword, filters.level, filters.useAt, filters.code]
  );

  const page = pageState.value;
  const rows = ((page?.classificationRows || []) as Array<Record<string, unknown>>);
  const selectedRow = ((page?.selectedClassification || null) as Record<string, unknown> | null);
  const summaryCards = ((page?.summaryCards || []) as Array<Record<string, string>>);
  const levelOptions = ((page?.levelOptions || []) as Array<Record<string, string>>);
  const governanceNotes = ((page?.governanceNotes || []) as Array<Record<string, string>>);
  const pageError = actionError || pageState.error;

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.searchKeyword) params.set("searchKeyword", filters.searchKeyword);
    if (filters.level) params.set("level", filters.level);
    if (filters.useAt) params.set("useAt", filters.useAt);
    if (filters.code) params.set("code", filters.code);
    const query = params.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [filters]);

  useEffect(() => {
    setForm(buildFormFromRow(selectedRow));
  }, [selectedRow]);

  useEffect(() => {
    const selectedCode = stringOf(selectedRow?.code);
    if (selectedCode && selectedCode !== filters.code) {
      setFilters((current) => ({ ...current, code: selectedCode }));
    }
  }, [filters.code, selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-lci-classification", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      searchKeyword: filters.searchKeyword,
      level: filters.level,
      useAt: filters.useAt,
      selectedCode: filters.code,
      rowCount: rows.length
    });
  }, [en, filters, rows.length]);

  const selectedPath = useMemo(() => stringOf(selectedRow?.pathLabel), [selectedRow]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setFilters((current) => ({ ...current, code: "" }));
    setForm(buildEmptyForm());
    setActionError("");
    setMessage("");
  }

  async function handleSave() {
    setSaving(true);
    setActionError("");
    setMessage("");
    try {
      const response = await saveEmissionLciClassification({
        originalCode: form.originalCode || undefined,
        code: form.code,
        label: form.label,
        tierLabel: form.tierLabel,
        aliases: form.aliases,
        useAt: form.useAt
      });
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to save the LCI classification." : "LCI 분류 저장에 실패했습니다."));
      }
      const nextCode = stringOf(response.code);
      setMessage(response.message || (en ? "LCI classification saved." : "LCI 분류를 저장했습니다."));
      setFilters((current) => ({ ...current, code: nextCode }));
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to save the LCI classification." : "LCI 분류 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.originalCode) {
      return;
    }
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(en ? "Delete this classification row?" : "이 분류 행을 삭제하시겠습니까?");
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setActionError("");
    setMessage("");
    try {
      const response = await deleteEmissionLciClassification(form.originalCode);
      if (!response.success) {
        throw new Error(response.message || (en ? "Failed to delete the LCI classification." : "LCI 분류 삭제에 실패했습니다."));
      }
      setMessage(response.message || (en ? "LCI classification deleted." : "LCI 분류를 삭제했습니다."));
      startCreate();
      await pageState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to delete the LCI classification." : "LCI 분류 삭제에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "LCI Classification" : "LCI 분류 관리" }
      ]}
      title={en ? "LCI Classification Management" : "LCI 분류 관리"}
      subtitle={en
        ? "Manage the shared LCI hierarchy stored in the EMLCI common-code group."
        : "EMLCI 공통코드 그룹에 저장된 공용 LCI 분류 체계를 관리합니다."}
      loading={pageState.loading && !page && !pageError}
      loadingLabel={en ? "Loading the LCI classification workspace..." : "LCI 분류 작업공간을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageError ? <PageStatusNotice tone="error">{pageError}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        <PageStatusNotice tone="warning">
          {en
            ? "This screen updates the same EMLCI common-code source read by emission management, definition studio, GWP values, and survey admin."
            : "이 화면은 배출 변수 관리, 정의 관리, GWP 값 관리, 설문 관리가 함께 읽는 EMLCI 공통코드 원본을 수정합니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="emission-lci-classification-summary">
          {summaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card.title)}-${index}`}
              title={stringOf(card.title)}
              value={stringOf(card.value)}
              description={stringOf(card.description)}
            />
          ))}
        </section>

        <section className="gov-card" data-help-id="emission-lci-classification-detail">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,auto]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="lciSearchKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput
                id="lciSearchKeyword"
                value={filters.searchKeyword}
                placeholder={en ? "Code, label, path, alias" : "코드, 분류명, 경로, 별칭"}
                onChange={(event) => setFilters((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="lciLevel">{en ? "Level" : "단계"}</label>
              <AdminSelect id="lciLevel" value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}>
                {levelOptions.map((option) => (
                  <option key={stringOf(option.value)} value={stringOf(option.value)}>{stringOf(option.label)}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="lciUseAt">{en ? "Exposure" : "노출 상태"}</label>
              <AdminSelect id="lciUseAt" value={filters.useAt} onChange={(event) => setFilters((current) => ({ ...current, useAt: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="Y">{en ? "Active" : "운영중"}</option>
                <option value="N">{en ? "Hidden" : "숨김"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <MemberButton type="button" onClick={startCreate}>{en ? "New Row" : "신규 등록"}</MemberButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr,1fr]" data-help-id="emission-lci-classification-table">
          <div className="gov-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{en ? "Classification Rows" : "분류 목록"}</h2>
                <p className="text-sm text-slate-500">{en ? "Select a row to edit the hierarchy metadata." : "행을 선택하면 계층 메타데이터를 수정할 수 있습니다."}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {stringOf(page?.catalogSourceLabel)}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="app-table w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">{en ? "Code" : "코드"}</th>
                    <th className="px-4 py-3">{en ? "Level" : "단계"}</th>
                    <th className="px-4 py-3">{en ? "Path" : "경로"}</th>
                    <th className="px-4 py-3">{en ? "Aliases" : "별칭"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                        {en ? "No LCI classifications match the current filters." : "조건에 맞는 LCI 분류가 없습니다."}
                      </td>
                    </tr>
                  ) : rows.map((row) => {
                    const selected = stringOf(row.code) === filters.code;
                    return (
                      <tr
                        className={`cursor-pointer border-t border-slate-200 ${selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                        key={stringOf(row.code)}
                        onClick={() => setFilters((current) => ({ ...current, code: stringOf(row.code) }))}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{stringOf(row.code)}</td>
                        <td className="px-4 py-3">{stringOf(row.level)}</td>
                        <td className="px-4 py-3">{stringOf(row.pathLabel) || "-"}</td>
                        <td className="px-4 py-3">{arrayOf(row.aliases).map((item) => stringOf(item)).join(", ") || "-"}</td>
                        <td className="px-4 py-3">{stringOf(row.useAt) === "N" ? (en ? "Hidden" : "숨김") : (en ? "Active" : "운영중")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="gov-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{en ? "Edit Row" : "분류 편집"}</h2>
                <p className="text-sm text-slate-500">{en ? "The level is inferred from the numeric code length." : "단계는 숫자 코드 길이로 자동 판정됩니다."}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {inferLevelLabel(form.code, en)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="lciCode">{en ? "Code" : "분류 코드"}</label>
                <AdminInput
                  id="lciCode"
                  value={form.code}
                  placeholder={en ? "2 / 4 / 6 digits" : "2 / 4 / 6자리 숫자"}
                  onChange={(event) => updateForm("code", event.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="lciLabel">{en ? "Label" : "분류명"}</label>
                <AdminInput id="lciLabel" value={form.label} onChange={(event) => updateForm("label", event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="lciTier">{en ? "Tier Label" : "Tier 라벨"}</label>
                <AdminInput id="lciTier" value={form.tierLabel} onChange={(event) => updateForm("tierLabel", event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="lciAliases">{en ? "Aliases" : "별칭"}</label>
                <AdminInput
                  id="lciAliases"
                  value={form.aliases}
                  placeholder={en ? "Comma separated aliases" : "쉼표로 별칭 구분"}
                  onChange={(event) => updateForm("aliases", event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="lciUseAtForm">{en ? "Exposure" : "노출 상태"}</label>
                <AdminSelect id="lciUseAtForm" value={form.useAt} onChange={(event) => updateForm("useAt", event.target.value)}>
                  <option value="Y">{en ? "Active" : "운영중"}</option>
                  <option value="N">{en ? "Hidden" : "숨김"}</option>
                </AdminSelect>
              </div>
            </div>

            <LookupContextStrip
              label={en ? "Hierarchy Preview" : "계층 미리보기"}
              value={
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <span><strong>{en ? "Selected code" : "선택 코드"}:</strong> {form.originalCode || form.code || "-"}</span>
                  <span><strong>{en ? "Resolved path" : "해석 경로"}:</strong> {selectedPath || "-"}</span>
                  <span><strong>{en ? "Code group" : "공통코드 그룹"}:</strong> EMLCI</span>
                </div>
              }
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <MemberButton type="button" onClick={handleSave} disabled={saving}>{saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save" : "저장")}</MemberButton>
              <MemberButton type="button" variant="secondary" onClick={startCreate} disabled={saving}>{en ? "Reset" : "초기화"}</MemberButton>
              <MemberButton type="button" variant="dangerSecondary" onClick={handleDelete} disabled={saving || !form.originalCode}>{en ? "Delete" : "삭제"}</MemberButton>
            </div>
          </div>
        </section>

        <section className="gov-card">
          <h2 className="text-base font-bold text-slate-900">{en ? "Operational Notes" : "운영 메모"}</h2>
          <div className="mt-3 space-y-3">
            {governanceNotes.map((note, index) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" key={`${stringOf(note.title)}-${index}`}>
                <p className="text-sm font-bold text-slate-900">{stringOf(note.title)}</p>
                <p className="mt-1 text-sm text-slate-600">{stringOf(note.description)}</p>
              </div>
            ))}
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
