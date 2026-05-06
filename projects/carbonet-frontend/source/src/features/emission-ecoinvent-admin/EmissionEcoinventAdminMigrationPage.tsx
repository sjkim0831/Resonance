import { useEffect, useState } from "react";
import {
  fetchEcoinventDatasets,
  importAllEcoinventDatasets,
  importSelectedEcoinventDatasets,
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

export function EmissionEcoinventAdminMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<EcoinventDatasetRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedRow, setSelectedRow] = useState<EcoinventDatasetRow | null>(null);
  const [koreanName, setKoreanName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadLocal(nextKeyword = keyword) {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchEcoinventDatasets({ keyword: nextKeyword });
      setRows(data);
      setMessage(`저장 목록 ${data.length}건을 불러왔습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "저장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLocal("");
  }, []);

  async function searchRemote() {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchEcoinventDatasets({ keyword, remote: true });
      setRows(data);
      setMessage(`ecoinvent API 검색 결과 ${data.length}건을 불러왔습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ecoinvent API 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
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

  async function importAll() {
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

  async function saveMapping() {
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
            actions={(
              <div className="flex flex-wrap justify-end gap-2">
                <MemberButton disabled={loading} onClick={searchRemote} type="button" variant="secondary">ecoinvent 검색</MemberButton>
                <MemberButton disabled={loading} onClick={importSelected} type="button" variant="secondary">선택 저장</MemberButton>
                <MemberButton disabled={loading} onClick={importAll} type="button" variant="primary">ecoinvent 전체 가져오기</MemberButton>
                <MemberButton disabled={loading} onClick={() => void loadLocal(keyword)} type="button" variant="secondary">저장 목록 출력</MemberButton>
              </div>
            )}
          />
          <div className="mt-4">
            <AdminInput onChange={(event) => setKeyword(event.target.value)} placeholder="영문 물질명, activity, product 검색" value={keyword} />
          </div>
          <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
            저장된 전체 데이터셋을 출력하고, 행을 선택해 한글 물질명을 매핑합니다. 설문 관리 화면은 이 매핑을 기준으로 물질명 드롭다운을 보여줍니다.
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
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>데이터셋이 없습니다.</td></tr>
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
                      <td className="px-4 py-3">{textOf(row.referenceProductUnit) || "-"}</td>
                      <td className="px-4 py-3">{formatScore(row.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

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
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
