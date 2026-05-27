import { useEffect, useMemo, useState } from "react";
import {
  fetchEcoinventDatasetPage,
  fetchEcoinventFilterOptions,
  importAllEcoinventDatasets,
  importSelectedEcoinventDatasets,
  premapEcoinventKoreanAliases,
  saveEcoinventMapping
} from "../../lib/api/emission";
import type { EcoinventDatasetRow } from "../../lib/api/emissionTypes";
import { isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, MemberButton, MemberSectionToolbar } from "../member/common";

function textOf(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatScore(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "-";
}

// @ts-ignore - unused when mapping section is commented out
function _detailValue(row: EcoinventDatasetRow | null, key: keyof EcoinventDatasetRow) {
  return row ? textOf(row[key]) || "-" : "-";
}

const FILTER_FIELDS = [
  ["productName", "Product"],
  ["activityName", "Activity"],
  ["geography", "Geography"],
  ["activityType", "Activity Type"],
  ["timePeriod", "Time Period"],
  ["referenceProductUnit", "Reference Unit"],
  ["indicatorName", "Indicator"]
] as const;

const KEYWORD_SUGGESTION_FIELDS = [
  ["materialName", "한글명"],
  ["productName", "Product"],
  ["activityName", "Activity"],
  ["geography", "Geography"],
  ["activityType", "Type"],
  ["timePeriod", "Period"],
  ["referenceProductUnit", "Unit"],
  ["indicatorName", "Indicator"],
  ["unit", "Score Unit"],
  ["scoreUnit", "Score Unit"],
  ["version", "Version"]
] as const;

export function EmissionEcoinventAdminMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [composing, setComposing] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rows, setRows] = useState<EcoinventDatasetRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedRow, setSelectedRow] = useState<EcoinventDatasetRow | null>(null);
  const [koreanName, setKoreanName] = useState("");
  // @ts-ignore - unused when mapping section is commented out
  const [sortOrder, setSortOrder] = useState("0");
  // @ts-ignore - unused when mapping section is commented out
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  const keywordSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: Array<{ label: string; value: string }> = [];
    for (const [key, label] of KEYWORD_SUGGESTION_FIELDS) {
      for (const value of filterOptions[key] ?? []) {
        const normalized = value.trim();
        const dedupeKey = normalized.toLocaleLowerCase();
        if (!normalized || seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        suggestions.push({ label, value: normalized });
      }
    }
    return suggestions.slice(0, 30000);
  }, [filterOptions]);

  async function loadLocal(nextKeyword = keyword) {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetchEcoinventDatasetPage({
        keyword: nextKeyword,
        ...filters,
        minScore,
        maxScore,
        pageIndex,
        pageSize
      });
      const data = response.data ?? [];
      setRows(data);
      setTotalCount(response.totalCount ?? data.length);
      setTotalPages(response.totalPages ?? 1);
      setMessage(`저장 목록 ${response.totalCount ?? data.length}건 중 ${data.length}건을 불러왔습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "저장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLocal("");
  }, []);

  useEffect(() => {
    void loadLocal(keyword);
  }, [pageIndex, pageSize]);

  useEffect(() => {
    if (composing) {
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [keyword, composing]);

  useEffect(() => {
    void fetchEcoinventFilterOptions(debouncedKeyword).then(setFilterOptions).catch(() => setFilterOptions({}));
  }, [debouncedKeyword]);

  // @ts-ignore - unused when mapping section is commented out
  async function _importSelected() {
    if (selectedIds.length === 0) {
      setErrorMessage("저장할 데이터셋을 선택하세요.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await importSelectedEcoinventDatasets(selectedIds);
      setMessage(`${response.count ?? selectedIds.length}건을 저장했습니다.`);
      setSelectedIds([]);
      await loadLocal(keyword);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "선택 데이터셋 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // @ts-ignore - unused when mapping section is commented out
  async function _importAll() {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await importAllEcoinventDatasets(keyword);
      setMessage(`${response.count ?? 0}건을 가져왔습니다.`);
      await loadLocal(keyword);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ecoinvent 전체 가져오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // @ts-ignore - unused when mapping section is commented out
  async function _premapKoreanAliases() {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await premapEcoinventKoreanAliases();
      const data = response.data || {};
      setMessage(response.message || `한글 alias ${data.aliasCount ?? 0}건 중 신규 매핑 ${data.insertedCount ?? 0}건을 저장했습니다.`);
      await loadLocal(keyword);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "한글 매핑 사전 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // @ts-ignore - unused when mapping section is commented out
  async function _saveMapping() {
    if (!selectedRow?.datasetId) {
      setErrorMessage("한글명과 연결할 데이터셋을 선택하세요.");
      return;
    }
    if (!koreanName.trim()) {
      setErrorMessage("한글 물질명을 입력하세요.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await saveEcoinventMapping({
        koreanName: koreanName.trim(),
        datasetId: numberOf(selectedRow.datasetId),
        sortOrder: numberOf(sortOrder),
        memo
      });
      setMessage(`${koreanName.trim()} 매핑을 저장했습니다.`);
      await loadLocal(keyword);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "한글 매핑 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(row: EcoinventDatasetRow) {
    const datasetId = numberOf(row.datasetId);
    setSelectedIds((current) => current.includes(datasetId) ? current.filter((id) => id !== datasetId) : [...current, datasetId]);
  }

  function chooseRow(row: EcoinventDatasetRow) {
    setSelectedRow(row);
    const mappedName = textOf(row.koreanName).split(",")[0].trim();
    if (mappedName) {
      setKoreanName(mappedName);
    }
  }

  function setFilterValue(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPageIndex(1);
  }

  function clearFilters() {
    setKeyword("");
    setFilters({});
    setMinScore("");
    setMaxScore("");
    setPageIndex(1);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈" },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: "ecoinvent" }
      ]}
      loading={false}
      loadingLabel={en ? "Loading ecoinvent admin..." : "ecoinvent 관리 화면을 불러오는 중입니다."}
      subtitle={en ? "Import ecoinvent datasets and map them to Korean material names." : "ecoinvent 데이터셋을 저장하고 한글 물질명으로 매핑합니다."}
      title={en ? "ecoinvent Emission Factors" : "ecoinvent 배출계수 관리"}
    >
      <AdminWorkspacePageFrame>
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {errorMessage ? <PageStatusNotice tone="error">{errorMessage}</PageStatusNotice> : null}

        <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
          <MemberSectionToolbar
            title={<span>데이터셋 검색 및 저장</span>}
            actions={<></>}
          />
          <div className="mt-4">
            <AdminInput
              list="ecoinvent-keyword-suggestions"
              onChange={(event) => {
                setKeyword(event.target.value);
                if (!composing) {
                  setPageIndex(1);
                }
              }}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                const target = event.target as HTMLInputElement;
                setComposing(false);
                setKeyword(target.value);
                setPageIndex(1);
              }}
              placeholder="Search material name"
              value={keyword}
            />
            <datalist id="ecoinvent-keyword-suggestions">
              {keywordSuggestions.map((option) => (
                <option key={`${option.label}:${option.value}`} label={option.label} value={option.value} />
              ))}
            </datalist>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {FILTER_FIELDS.map(([key, label]) => (
              <label className="text-sm font-bold text-slate-700" key={key}>
                <span className="mb-1 block">{label}</span>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  list={`ecoinvent-filter-${key}`}
                  onChange={(event) => setFilterValue(key, event.target.value)}
                  placeholder={`${label} 선택/검색`}
                  value={filters[key] ?? ""}
                />
                <datalist id={`ecoinvent-filter-${key}`}>
                  {(filterOptions[key] ?? []).map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>
            ))}
            <AdminInput onChange={(event) => { setMinScore(event.target.value); setPageIndex(1); }} placeholder="최소 배출계수" value={minScore} />
            <AdminInput onChange={(event) => { setMaxScore(event.target.value); setPageIndex(1); }} placeholder="최대 배출계수" value={maxScore} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>총 {totalCount.toLocaleString()}건</span>
              <span>페이지 {pageIndex.toLocaleString()} / {Math.max(totalPages, 1).toLocaleString()}</span>
              <select
                className="h-9 rounded-lg border border-slate-300 px-2"
                onChange={(event) => { setPageSize(Number(event.target.value)); setPageIndex(1); }}
                value={pageSize}
              >
                <option value={50}>50개</option>
                <option value={100}>100개</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <MemberButton disabled={loading || pageIndex <= 1} onClick={() => setPageIndex((current) => Math.max(current - 1, 1))} type="button" variant="secondary">이전</MemberButton>
              <MemberButton disabled={loading || pageIndex >= Math.max(totalPages, 1)} onClick={() => setPageIndex((current) => current + 1)} type="button" variant="secondary">다음</MemberButton>
              <MemberButton disabled={loading} onClick={() => void loadLocal(keyword)} type="button" variant="secondary">현재 조건 검색</MemberButton>
              <MemberButton disabled={loading} onClick={clearFilters} type="button" variant="secondary">조건 초기화</MemberButton>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
            검색은 항상 DB에 저장된 데이터셋만 대상으로 수행합니다. ecoinvent API는 배치 가져오기/상세 보강 작업에만 사용합니다.
          </p>
          <div className="mt-5 overflow-auto rounded-[var(--kr-gov-radius)] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">선택</th>
                  <th className="px-4 py-3">한글 매핑명</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Geography</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Indicator</th>
                  <th className="px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={10}>데이터셋이 없습니다.</td></tr>
                ) : rows.map((row) => {
                  const datasetId = numberOf(row.datasetId);
                  return (
                    <tr
                      className={`cursor-pointer hover:bg-sky-50 ${selectedRow?.datasetId === row.datasetId ? "bg-sky-50" : ""}`}
                      key={`${datasetId}-${textOf(row.productName)}-${textOf(row.activityName)}`}
                      onClick={() => chooseRow(row)}
                    >
                      <td className="px-4 py-3">
                        <input checked={selectedIds.includes(datasetId)} onChange={() => toggleRow(row)} onClick={(event) => event.stopPropagation()} type="checkbox" />
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--kr-gov-blue)]">{textOf(row.koreanName) || "-"}</td>
                      <td className="px-4 py-3 font-bold">{textOf(row.productName) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.activityName) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.geography) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.activityType) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.timePeriod) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.referenceProductUnit) || "-"}</td>
                      <td className="px-4 py-3">{textOf(row.indicatorName) || "-"}</td>
                      <td className="px-4 py-3">{formatScore(row.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/*
        <section className="mt-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
          <MemberSectionToolbar title={<span>한글명 매핑</span>} />
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto]">
            <AdminInput onChange={(event) => setKoreanName(event.target.value)} placeholder="한글 물질명" value={koreanName} />
            <AdminInput onChange={(event) => setSortOrder(event.target.value)} placeholder="정렬" value={sortOrder} />
            <AdminInput onChange={(event) => setMemo(event.target.value)} placeholder="메모" value={memo} />
            <MemberButton disabled={loading} onClick={saveMapping} type="button">매핑 저장</MemberButton>
          </div>
          <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
            선택 데이터셋: {selectedRow ? `${textOf(selectedRow.productName)} / ${textOf(selectedRow.activityName)}` : "선택 안 됨"}
          </p>
          {selectedRow ? (
            <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-700">선택 데이터셋 기본 필드</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Dataset ID", detailValue(selectedRow, "datasetId")],
                  ["Product", detailValue(selectedRow, "productName")],
                  ["Activity", detailValue(selectedRow, "activityName")],
                  ["Geography", detailValue(selectedRow, "geography")],
                  ["Activity Type", detailValue(selectedRow, "activityType")],
                  ["Time Period", detailValue(selectedRow, "timePeriod")],
                  ["Reference Unit", detailValue(selectedRow, "referenceProductUnit")],
                  ["Indicator", detailValue(selectedRow, "indicatorName")],
                  ["Score", formatScore(selectedRow.score)]
                ].map(([label, value]) => (
                  <div className="rounded-lg bg-white p-3" key={label}>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 break-words text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

 */}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
