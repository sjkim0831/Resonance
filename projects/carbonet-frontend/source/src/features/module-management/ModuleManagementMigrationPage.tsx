import { useMemo, useState } from "react";
import {
  ALL_ROUTE_DEFINITIONS,
  ALL_ROUTE_FAMILY_CLOSEOUTS,
  listRouteOwnershipTraces
} from "../../app/routes/routeCatalog";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";
import { GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type StandardModule = {
  id: string;
  labelKo: string;
  labelEn: string;
  categoryKo: string;
  categoryEn: string;
  source: string;
  status: "ACTIVE" | "READY" | "REFERENCE";
  count?: number;
  noteKo: string;
  noteEn: string;
};

type SystemModuleRow = {
  id: string;
  label: string;
  routeCount: number;
  owner: string;
  installScope: string;
  pageFamily: string;
  runtimeTarget: string;
  status: "ACTIVE" | "READY";
};

const STANDARD_MODULES: StandardModule[] = [
  {
    id: "egov-runtime",
    labelKo: "실행환경",
    labelEn: "Runtime Environment",
    categoryKo: "표준프레임워크 5.0",
    categoryEn: "eGovFrame 5.0",
    source: "egovframe.go.kr",
    status: "ACTIVE",
    count: 5,
    noteKo: "화면처리, 업무처리, 데이터처리, 연계처리, 공통기반 5개 실행 레이어 기준으로 관리합니다.",
    noteEn: "Managed as five runtime layers: presentation, business logic, data, integration, and common foundation."
  },
  {
    id: "egov-development",
    labelKo: "개발환경",
    labelEn: "Development Environment",
    categoryKo: "표준프레임워크 5.0",
    categoryEn: "eGovFrame 5.0",
    source: "egovframe.go.kr",
    status: "READY",
    noteKo: "화면/컴포넌트/데이터 개발, 테스트 자동화, 코드 검사, 템플릿 및 공통컴포넌트 생성 도구를 관리합니다.",
    noteEn: "Tracks screen, component, data, test, code inspection, template, and common component tooling."
  },
  {
    id: "egov-management",
    labelKo: "관리환경",
    labelEn: "Management Environment",
    categoryKo: "표준프레임워크 5.0",
    categoryEn: "eGovFrame 5.0",
    source: "egovframe.go.kr",
    status: "REFERENCE",
    noteKo: "프로젝트 표준, 산출물, 품질 기준, 운영 이관 기준을 시스템 모듈과 연결합니다.",
    noteEn: "Connects project standards, deliverables, quality gates, and operation handoff rules."
  },
  {
    id: "egov-operation",
    labelKo: "운영환경",
    labelEn: "Operation Environment",
    categoryKo: "표준프레임워크 5.0",
    categoryEn: "eGovFrame 5.0",
    source: "egovframe.go.kr",
    status: "READY",
    noteKo: "배포, 모니터링, 로그, 백업/복구, 보안 운영 모듈을 시스템 운영 화면과 매핑합니다.",
    noteEn: "Maps deployment, monitoring, logs, backup, restore, and security operation modules."
  },
  {
    id: "egov-common-components",
    labelKo: "웹 공통컴포넌트",
    labelEn: "Web Common Components",
    categoryKo: "공통컴포넌트",
    categoryEn: "Common Components",
    source: "egovframe.go.kr wiki v5.0",
    status: "ACTIVE",
    count: 253,
    noteKo: "v5.0 공통컴포넌트 생성 마법사 기준 253종을 상위 분류 단위로 관리합니다.",
    noteEn: "Manages 253 v5.0 common components by top-level category."
  },
  {
    id: "egov-common-tech-service",
    labelKo: "공통기술서비스",
    labelEn: "Common Technical Services",
    categoryKo: "공통컴포넌트",
    categoryEn: "Common Components",
    source: "egovframe.go.kr",
    status: "ACTIVE",
    noteKo: "사용자 디렉터리/인증, 보안, 통계/리포팅, 협업, 사용자지원, 시스템관리, 연계, 디지털 자산 관리를 포함합니다.",
    noteEn: "Covers authentication, security, reporting, collaboration, user support, system management, integration, and digital assets."
  },
  {
    id: "egov-elementary-service",
    labelKo: "요소기술서비스",
    labelEn: "Elementary Technical Services",
    categoryKo: "공통컴포넌트",
    categoryEn: "Common Components",
    source: "egovframe.go.kr",
    status: "REFERENCE",
    noteKo: "달력, 포맷, 계산, 변환, 검증 등 공통 유틸리티 모듈을 관리합니다.",
    noteEn: "Tracks common utilities such as calendar, formatting, calculation, conversion, and validation."
  },
  {
    id: "egov-mobile-common",
    labelKo: "모바일 공통컴포넌트",
    labelEn: "Mobile Common Components",
    categoryKo: "공통컴포넌트",
    categoryEn: "Common Components",
    source: "egovframe.go.kr",
    status: "REFERENCE",
    noteKo: "모바일 공통 서비스, 지원, 디바이스 지원 컴포넌트를 별도 관리합니다.",
    noteEn: "Tracks mobile common service, support, and device support components."
  }
];

function statusClassName(status: StandardModule["status"] | SystemModuleRow["status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "READY") return "bg-blue-100 text-[var(--kr-gov-blue)]";
  return "bg-slate-100 text-slate-700";
}

function buildSystemModules(): SystemModuleRow[] {
  const routeCounts = new Map<string, number>();
  ALL_ROUTE_DEFINITIONS.forEach((route) => {
    routeCounts.set(route.group, (routeCounts.get(route.group) || 0) + 1);
  });
  return ALL_ROUTE_FAMILY_CLOSEOUTS.map((family) => ({
    id: family.familyId,
    label: family.pageFamily,
    routeCount: routeCounts.get(family.pageFamily) || family.pageContracts.length,
    owner: family.projectExecutor.owner,
    installScope: family.installScope,
    pageFamily: family.pageFamily,
    runtimeTarget: family.installDeploy.runtimeVerificationTarget,
    status: family.pageSystemizationCloseout.startsWith("CLOSED") ? "ACTIVE" : "READY"
  }));
}

export function ModuleManagementMigrationPage() {
  const en = isEnglish();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("ALL");
  const ownershipTraces = useMemo(() => listRouteOwnershipTraces(), []);
  const systemModules = useMemo(() => buildSystemModules(), []);
  const filteredStandardModules = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return STANDARD_MODULES.filter((row) => {
      const scopeMatched = scope === "ALL" || scope === "STANDARD";
      const haystack = `${row.id} ${row.labelKo} ${row.labelEn} ${row.categoryKo} ${row.categoryEn} ${row.noteKo} ${row.noteEn}`.toLowerCase();
      return scopeMatched && (!keyword || haystack.includes(keyword));
    });
  }, [query, scope]);
  const filteredSystemModules = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return systemModules.filter((row) => {
      const scopeMatched = scope === "ALL" || scope === "SYSTEM";
      const haystack = `${row.id} ${row.label} ${row.owner} ${row.installScope} ${row.runtimeTarget}`.toLowerCase();
      return scopeMatched && (!keyword || haystack.includes(keyword));
    });
  }, [query, scope, systemModules]);
  const platformRouteCount = ownershipTraces.filter((trace) => trace.routeScope === "PLATFORM").length;
  const runtimeRouteCount = ownershipTraces.filter((trace) => trace.routeScope === "RUNTIME").length;

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Module" : "모듈 관리" }
      ]}
      sidebarVariant="system"
      title={en ? "System Module Management" : "모듈 관리"}
    >
      <GovernanceCompressionNav activeId="module" en={en} />
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="info">
          {en
            ? "This page manages eGovFrame 5.0 reference modules and every route family/module registered in the current system catalog."
            : "표준프레임워크 5.0 기준 모듈과 현재 시스템 route catalog에 등록된 모든 시스템 모듈을 함께 관리합니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "eGovFrame Modules" : "표준 모듈"} value={STANDARD_MODULES.length} />
          <SummaryMetricCard title={en ? "System Modules" : "시스템 모듈"} value={systemModules.length} />
          <SummaryMetricCard title={en ? "Platform Routes" : "플랫폼 화면"} value={platformRouteCount} />
          <SummaryMetricCard title={en ? "Runtime Routes" : "업무 화면"} value={runtimeRouteCount} />
        </section>

        <section className="gov-card">
          <GridToolbar
            actions={(
              <select className="gov-select max-w-[13rem]" onChange={(event) => setScope(event.target.value)} value={scope}>
                <option value="ALL">{en ? "All modules" : "전체 모듈"}</option>
                <option value="STANDARD">{en ? "eGovFrame only" : "표준프레임워크"}</option>
                <option value="SYSTEM">{en ? "System only" : "시스템 모듈"}</option>
              </select>
            )}
            title={en ? "Module Search" : "모듈 검색"}
          />
          <div className="px-6 pb-6">
            <label className="gov-label" htmlFor="system-module-search">{en ? "Search" : "검색"}</label>
            <input
              className="gov-input"
              id="system-module-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={en ? "Search module, owner, route target" : "모듈명, 소유자, 경로를 검색하세요"}
              value={query}
            />
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0">
          <GridToolbar title={en ? "eGovFrame 5.0 Reference Modules" : "표준프레임워크 5.0 모듈"} />
          <div className="overflow-x-auto">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>{en ? "Module" : "모듈"}</th>
                  <th>{en ? "Category" : "분류"}</th>
                  <th>{en ? "Source" : "출처"}</th>
                  <th>{en ? "Count" : "수량"}</th>
                  <th>{en ? "Notes" : "관리 기준"}</th>
                  <th>{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStandardModules.map((row) => (
                  <tr key={row.id}>
                    <td className="font-black">{en ? row.labelEn : row.labelKo}</td>
                    <td>{en ? row.categoryEn : row.categoryKo}</td>
                    <td>{row.source}</td>
                    <td>{row.count ?? "-"}</td>
                    <td>{en ? row.noteEn : row.noteKo}</td>
                    <td><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusClassName(row.status)}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0">
          <GridToolbar title={en ? "System Route Modules" : "시스템 내 모듈"} />
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1040px]">
              <thead>
                <tr>
                  <th>{en ? "Module ID" : "모듈 ID"}</th>
                  <th>{en ? "Page Family" : "화면군"}</th>
                  <th>{en ? "Routes" : "화면 수"}</th>
                  <th>{en ? "Install Scope" : "설치 범위"}</th>
                  <th>{en ? "Owner" : "실행 소유"}</th>
                  <th>{en ? "Runtime Target" : "검증 경로"}</th>
                  <th>{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSystemModules.map((row) => (
                  <tr key={row.id}>
                    <td className="font-black">{row.id}</td>
                    <td>{row.pageFamily}</td>
                    <td>{row.routeCount}</td>
                    <td>{row.installScope}</td>
                    <td>{row.owner}</td>
                    <td>{row.runtimeTarget}</td>
                    <td><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusClassName(row.status)}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

