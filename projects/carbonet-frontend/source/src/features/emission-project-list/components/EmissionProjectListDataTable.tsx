import { useState, useMemo } from "react";
import { TableColumn, FilterOption } from "./EmissionProjectListTypes";
import { StatusBadge, ScopeBadge } from "./EmissionProjectListShared";

interface DataTableSectionProps {
  en: boolean;
}

export function EmissionProjectListDataTable({ en }: DataTableSectionProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const columns: TableColumn[] = [
    { key: "siteId", label: "시설 코드", labelEn: "Site ID", sortable: true, width: "w-24" },
    { key: "siteName", label: "배출지 명칭", labelEn: "Site Name", sortable: true, width: "w-48" },
    { key: "scope", label: "Scope", labelEn: "Scope", sortable: true, width: "w-20" },
    { key: "emission", label: "배출량", labelEn: "Emission", sortable: true, width: "w-28" },
    { key: "target", label: "목표", labelEn: "Target", sortable: true, width: "w-28" },
    { key: "status", label: "상태", labelEn: "Status", sortable: true, width: "w-28" },
    { key: "completeness", label: "데이터 완전성", labelEn: "Data Completeness", sortable: true, width: "w-28" },
    { key: "lastUpdated", label: "최종 업데이트", labelEn: "Last Updated", sortable: true, width: "w-32" },
    { key: "actions", label: "작업", labelEn: "Actions", sortable: false, width: "w-32" }
  ];

  const tableData = useMemo(() => [
    { siteId: "PH-001", siteName: "포항 제1 열연공장", siteNameEn: "Pohang Hot Rolling Mill 1", scope: "scope1", emission: "2,341", target: "2,500", status: "normal", completeness: "100%", lastUpdated: "2025-08-14 14:30" },
    { siteId: "US-042", siteName: "울산 제3 화학기지", siteNameEn: "Ulsan Chemical Base 3", scope: "scope1", emission: "4,812", target: "5,000", status: "delayed", completeness: "65%", lastUpdated: "2025-08-13 09:15" },
    { siteId: "GN-112", siteName: "광양 제2 에너지센터", siteNameEn: "Gwangyang Energy Center 2", scope: "scope2", emission: "12,890", target: "13,000", status: "verifying", completeness: "100%", lastUpdated: "2025-08-14 11:45" },
    { siteId: "IC-005", siteName: "인천 물류센터", siteNameEn: "Incheon Logistics Center", scope: "scope2", emission: "452", target: "500", status: "normal", completeness: "100%", lastUpdated: "2025-08-14 16:00" },
    { siteId: "DJ-021", siteName: "대전 R&D 캠퍼스", siteNameEn: "Daejeon R&D Campus", scope: "scope3", emission: "210", target: "250", status: "pending", completeness: "40%", lastUpdated: "2025-08-12 10:00" },
    { siteId: "PJ-088", siteName: "파주 전산센터", siteNameEn: "Paju Data Center", scope: "scope2", emission: "890", target: "900", status: "normal", completeness: "100%", lastUpdated: "2025-08-14 15:30" },
    { siteId: "AS-033", siteName: "안산 제조공장", siteNameEn: "Ansan Manufacturing Plant", scope: "scope1", emission: "1,560", target: "1,600", status: "normal", completeness: "95%", lastUpdated: "2025-08-14 12:00" },
    { siteId: "BS-055", siteName: "부산 해상 물류", siteNameEn: "Busan Marine Logistics", scope: "scope3", emission: "678", target: "700", status: "delayed", completeness: "72%", lastUpdated: "2025-08-13 17:45" },
    { siteId: "GW-077", siteName: "광주 제조공장", siteNameEn: "Gwangju Manufacturing Plant", scope: "scope1", emission: "923", target: "1,000", status: "normal", completeness: "88%", lastUpdated: "2025-08-14 09:20" },
    { siteId: "SJ-099", siteName: "성남 연구센터", siteNameEn: "Seongnam Research Center", scope: "scope3", emission: "345", target: "350", status: "verifying", completeness: "100%", lastUpdated: "2025-08-14 13:00" },
    { siteId: "HD-011", siteName: "현대제철 1공장", siteNameEn: "Hyundai Steel Works 1", scope: "scope1", emission: "8,234", target: "8,500", status: "normal", completeness: "100%", lastUpdated: "2025-08-14 14:45" },
    { siteId: "YS-022", siteName: "여수 석유화학", siteNameEn: "Yosu Petrochemical Complex", scope: "scope1", emission: "15,670", target: "16,000", status: "verifying", completeness: "92%", lastUpdated: "2025-08-14 10:30" }
  ], []);

  const filteredData = useMemo(() => {
    return tableData.filter((row) => {
      const matchesSearch =
        searchKeyword === "" ||
        (en ? row.siteNameEn : row.siteName).toLowerCase().includes(searchKeyword.toLowerCase()) ||
        row.siteId.toLowerCase().includes(searchKeyword.toLowerCase());

      const matchesStatus = statusFilter === "all" || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tableData, searchKeyword, statusFilter, en]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const statusFilters: FilterOption[] = [
    { key: "all", label: "전체", labelEn: "All" },
    { key: "normal", label: "정상", labelEn: "Normal" },
    { key: "delayed", label: "지연", labelEn: "Delayed" },
    { key: "verifying", label: "검증중", labelEn: "Verifying" },
    { key: "pending", label: "대기", labelEn: "Pending" }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)] text-2xl">
            table_chart
          </span>
          {en ? "Emission Data Overview" : "배출 데이터 개요"}
        </h2>
        <div className="flex gap-3">
          <button
            className="action-button-secondary"
            type="button"
            onClick={() => {}}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {en ? "Export CSV" : "CSV 내보내기"}
          </button>
          <button
            className="action-button-primary"
            type="button"
            onClick={() => {}}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {en ? "Add Site" : "배출지 추가"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-[2]">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">
              search
            </span>
            <input
              type="text"
              className="search-input"
              placeholder={
                en
                  ? "Search by facility code, emission site name, or process..."
                  : "시설 코드, 배출지 명칭, 또는 관리 중인 특정 프로세스를 입력하세요..."
              }
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                className={`filter-tab ${
                  statusFilter === filter.key ? "filter-tab-active" : "filter-tab-inactive"
                }`}
                onClick={() => setStatusFilter(filter.key)}
                type="button"
              >
                {en ? filter.labelEn : filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={col.width}
                    scope="col"
                  >
                    <div className="flex items-center gap-1">
                      {col.labelEn || col.label}
                      {col.sortable && (
                        <span className="material-symbols-outlined text-[14px] text-gray-400">
                         unfold_more
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => (
                <tr key={row.siteId}>
                  <td className="font-mono text-sm font-bold text-gray-500">{row.siteId}</td>
                  <td>
                    <div className="font-medium text-gray-900">
                      {en ? row.siteNameEn : row.siteName}
                    </div>
                  </td>
                  <td>
                    <ScopeBadge scope={row.scope as "scope1" | "scope2" | "scope3"} />
                  </td>
                  <td className="font-bold text-gray-900">{row.emission} tCO₂</td>
                  <td className="text-gray-600">{row.target} tCO₂</td>
                  <td>
                    <StatusBadge
                      status={row.status as "normal" | "delayed" | "verifying" | "pending"}
                      label={
                        statusFilters.find((f) => f.key === row.status)?.[en ? "labelEn" : "label"] || ""
                      }
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: row.completeness }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{row.completeness}</span>
                    </div>
                  </td>
                  <td className="text-sm text-gray-500">{row.lastUpdated}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        type="button"
                        title={en ? "View Details" : "상세 보기"}
                      >
                        <span className="material-symbols-outlined text-[18px] text-gray-500">
                          visibility
                        </span>
                      </button>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        type="button"
                        title={en ? "Edit" : "수정"}
                      >
                        <span className="material-symbols-outlined text-[18px] text-gray-500">
                          edit
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {en ? "Showing" : "표시 중"} {paginatedData.length} {en ? "of" : "/"} {filteredData.length}{" "}
            {en ? "entries" : "개 항목"}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="pagination-button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`pagination-button ${
                    currentPage === pageNum ? "pagination-button-active" : ""
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                  type="button"
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              className="pagination-button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}