import { useMemo, useState } from "react";
import { PAGE_COMPLETENESS_INVENTORY } from "../builder-studio/pageCompletenessInventory";
import { ROUTE_SOURCE_INVENTORY } from "../builder-studio/routeSourceInventory";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type WorkStatus = "unchecked" | "empty" | "thin" | "expanding" | "done" | "deferred";
type WorkRecord = {
  status: WorkStatus;
  sectionGroup: string;
  proposedMenuName: string;
  nextPageIdea: string;
  memo: string;
  commitHash: string;
  updatedAt: string;
};

const STORAGE_KEY = "carbonet:home-page-workbench:v1";

const STATUS_LABELS: Record<WorkStatus, { ko: string; en: string }> = {
  unchecked: { ko: "미점검", en: "Unchecked" },
  empty: { ko: "내용 없음", en: "Empty" },
  thin: { ko: "기능 부족", en: "Thin" },
  expanding: { ko: "확장 중", en: "Expanding" },
  done: { ko: "완료", en: "Done" },
  deferred: { ko: "보류", en: "Deferred" }
};

function readRecords(): Record<string, WorkRecord> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, WorkRecord> : {};
  } catch {
    return {};
  }
}

function writeRecords(records: Record<string, WorkRecord>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function inferSectionGroup(routeId: string, label: string, path: string) {
  const source = `${routeId} ${label} ${path}`.toLowerCase();
  if (source.includes("edu/") || source.includes("edu-") || source.includes("교육")) return "교육/자격";
  if (source.includes("join/") || source.includes("join-") || source.includes("회원가입")) return "가입/온보딩";
  if (source.includes("mypage") || source.includes("마이")) return "마이페이지/회원";
  if (source.includes("support") || source.includes("mtn") || source.includes("faq") || source.includes("문의")) return "고객지원/민원";
  if (source.includes("emission") || source.includes("co2") || source.includes("배출")) return "배출/탄소";
  if (source.includes("trade") || source.includes("payment") || source.includes("정산")) return "거래/정산";
  return "홈 공통";
}

function inferDefaultStatus(routeId: string) {
  const completeness = PAGE_COMPLETENESS_INVENTORY.find((row) => row.routeIds.includes(routeId));
  if (!completeness) return "unchecked" as WorkStatus;
  if (completeness.status === "missing") return "empty" as WorkStatus;
  if (completeness.status === "thin" || completeness.status === "placeholder-managed") return "thin" as WorkStatus;
  return "unchecked" as WorkStatus;
}

function statusClass(status: WorkStatus) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "expanding") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "empty") return "border-red-200 bg-red-50 text-red-800";
  if (status === "thin") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "deferred") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function HomePageWorkbenchMigrationPage() {
  const en = isEnglish();
  const [records, setRecords] = useState<Record<string, WorkRecord>>(() => readRecords());
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const rows = useMemo(() => {
    return ROUTE_SOURCE_INVENTORY
      .filter((route) => route.group === "home" || route.group === "join")
      .map((route) => {
        const group = inferSectionGroup(route.routeId, route.label, route.koPath);
        const defaultStatus = inferDefaultStatus(route.routeId);
        const record = records[route.routeId];
        return {
          ...route,
          completeness: PAGE_COMPLETENESS_INVENTORY.find((item) => item.routeIds.includes(route.routeId)),
          status: record?.status || defaultStatus,
          sectionGroup: record?.sectionGroup || group,
          proposedMenuName: record?.proposedMenuName || route.label,
          nextPageIdea: record?.nextPageIdea || "",
          memo: record?.memo || "",
          commitHash: record?.commitHash || "",
          updatedAt: record?.updatedAt || ""
        };
      })
      .sort((left, right) => left.sectionGroup.localeCompare(right.sectionGroup, "ko") || left.koPath.localeCompare(right.koPath));
  }, [records]);

  const groups = useMemo(() => Array.from(new Set(rows.map((row) => row.sectionGroup))).sort((a, b) => a.localeCompare(b, "ko")), [rows]);
  const filteredRows = rows.filter((row) => {
    const haystack = `${row.routeId} ${row.label} ${row.koPath} ${row.sectionGroup} ${row.proposedMenuName} ${row.memo}`.toLowerCase();
    return (!keyword || haystack.includes(keyword.toLowerCase()))
      && (statusFilter === "all" || row.status === statusFilter)
      && (groupFilter === "all" || row.sectionGroup === groupFilter);
  });

  const summary = rows.reduce<Record<WorkStatus, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { unchecked: 0, empty: 0, thin: 0, expanding: 0, done: 0, deferred: 0 });

  function updateRecord(routeId: string, patch: Partial<WorkRecord>) {
    setRecords((current) => {
      const route = rows.find((item) => item.routeId === routeId);
      const previous = current[routeId];
      const next = {
        ...current,
        [routeId]: {
          status: previous?.status || route?.status || "unchecked",
          sectionGroup: previous?.sectionGroup || route?.sectionGroup || "홈 공통",
          proposedMenuName: previous?.proposedMenuName || route?.label || "",
          nextPageIdea: previous?.nextPageIdea || "",
          memo: previous?.memo || "",
          commitHash: previous?.commitHash || "",
          updatedAt: new Date().toISOString(),
          ...patch
        }
      };
      writeRecords(next);
      return next;
    });
  }

  return (
    <AdminPageShell
      subtitle={en ? "Track, group, rename, and expand every home-facing menu page." : "홈 메뉴 전체를 점검하고 유사 섹션별로 묶어 확장 작업을 누적합니다."}
      title={en ? "Home Page Workbench" : "홈 페이지 작업대"}
    >
      <div className="space-y-6">
        <section className="grid gap-3 md:grid-cols-6">
          {(Object.keys(STATUS_LABELS) as WorkStatus[]).map((status) => (
            <button
              className={`rounded-lg border px-4 py-3 text-left text-sm font-black ${statusClass(status)}`}
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              type="button"
            >
              <span className="block text-xs opacity-70">{en ? STATUS_LABELS[status].en : STATUS_LABELS[status].ko}</span>
              <span className="text-2xl">{summary[status] || 0}</span>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={en ? "Search route, menu, memo" : "라우트, 메뉴, 메모 검색"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as WorkStatus | "all")}>
              <option value="all">{en ? "All Status" : "전체 상태"}</option>
              {(Object.keys(STATUS_LABELS) as WorkStatus[]).map((status) => <option key={status} value={status}>{en ? STATUS_LABELS[status].en : STATUS_LABELS[status].ko}</option>)}
            </select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
              <option value="all">{en ? "All Groups" : "전체 그룹"}</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white" onClick={() => navigate(buildLocalizedPath("/admin/system/menu?menuType=USER", "/en/admin/system/menu?menuType=USER"))} type="button">
              {en ? "Open Menu Admin" : "메뉴 관리 열기"}
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[160px_1fr_150px_160px_220px_220px] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">
            <span>{en ? "Status" : "상태"}</span>
            <span>{en ? "Menu / Route" : "메뉴 / 라우트"}</span>
            <span>{en ? "Group" : "섹션 그룹"}</span>
            <span>{en ? "Proposed Name" : "제안 메뉴명"}</span>
            <span>{en ? "Next Page Candidate" : "추가 페이지 후보"}</span>
            <span>{en ? "Memo / Commit" : "메모 / 커밋"}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <div className="grid grid-cols-[160px_1fr_150px_160px_220px_220px] gap-3 px-4 py-4 text-sm" key={row.routeId}>
                <select className={`h-9 rounded-lg border px-2 text-xs font-black ${statusClass(row.status)}`} value={row.status} onChange={(event) => updateRecord(row.routeId, { status: event.target.value as WorkStatus })}>
                  {(Object.keys(STATUS_LABELS) as WorkStatus[]).map((status) => <option key={status} value={status}>{en ? STATUS_LABELS[status].en : STATUS_LABELS[status].ko}</option>)}
                </select>
                <div>
                  <p className="font-black text-slate-950">{row.label}</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">{row.koPath}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.routeId} · {row.completeness?.status || "unknown"} · {row.effectiveSourcePath}</p>
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-bold" onClick={() => navigate(row.koPath)} type="button">{en ? "Open" : "열기"}</button>
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-bold" onClick={() => navigate(buildLocalizedPath(`/admin/system/builder-studio?pageId=${encodeURIComponent(row.routeId)}&menuTitle=${encodeURIComponent(row.label)}&menuUrl=${encodeURIComponent(row.koPath)}`, `/en/admin/system/builder-studio?pageId=${encodeURIComponent(row.routeId)}&menuTitle=${encodeURIComponent(row.label)}&menuUrl=${encodeURIComponent(row.enPath)}`))} type="button">{en ? "Builder" : "빌더"}</button>
                  </div>
                </div>
                <input className="h-9 rounded-lg border border-slate-300 px-2 text-xs" value={row.sectionGroup} onChange={(event) => updateRecord(row.routeId, { sectionGroup: event.target.value })} />
                <input className="h-9 rounded-lg border border-slate-300 px-2 text-xs" value={row.proposedMenuName} onChange={(event) => updateRecord(row.routeId, { proposedMenuName: event.target.value })} />
                <textarea className="min-h-20 rounded-lg border border-slate-300 px-2 py-2 text-xs" value={row.nextPageIdea} onChange={(event) => updateRecord(row.routeId, { nextPageIdea: event.target.value })} placeholder={en ? "Related page/menu to add" : "묶어서 추가할 페이지/메뉴"} />
                <div className="space-y-2">
                  <textarea className="min-h-14 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" value={row.memo} onChange={(event) => updateRecord(row.routeId, { memo: event.target.value })} placeholder={en ? "Work memo" : "작업 메모"} />
                  <input className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs" value={row.commitHash} onChange={(event) => updateRecord(row.routeId, { commitHash: event.target.value })} placeholder="commit hash" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
