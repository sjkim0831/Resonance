import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchScreenCommandPage } from "../../lib/api/platform";
import type {
  ScreenCommandApi,
  ScreenCommandEvent,
  ScreenCommandPagePayload,
  ScreenCommandSchema,
  ScreenCommandSurface
} from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GridToolbar, KeyValueGridPanel, PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  createEmptyScreenCommandPagePayload,
  resolveScreenCommandSummaryMetrics,
  ScreenManagementCatalogPanel,
  ScreenManagementSelectionOverview,
  ScreenManagementSummaryGrid
} from "./shared";

type ScreenFlowCloseoutRow = {
  labelKo: string;
  labelEn: string;
  status: "available" | "blocked";
  descriptionKo: string;
  descriptionEn: string;
};

const SCREEN_FLOW_CLOSEOUT_ROWS: ScreenFlowCloseoutRow[] = [
  {
    labelKo: "화면 카탈로그 / 선택 메타데이터",
    labelEn: "Screen catalog / selected metadata",
    status: "available",
    descriptionKo: "pageId, route, menuCode 기준 검색과 선택 화면의 source, 권한, layoutVersion 확인은 제공됩니다.",
    descriptionEn: "Search by pageId, route, menuCode and selected page source, permission, and layoutVersion metadata are available."
  },
  {
    labelKo: "Surface / Event / API / Schema 체인",
    labelEn: "Surface / event / API / schema chain",
    status: "available",
    descriptionKo: "선택 화면의 surface, 이벤트, 프론트 함수, API, schema, change target 연결은 읽기 전용으로 점검할 수 있습니다.",
    descriptionEn: "Selected page surface, event, frontend function, API, schema, and change-target links can be inspected read-only."
  },
  {
    labelKo: "흐름 CRUD / 순서 편집",
    labelEn: "Flow CRUD / ordered transition editing",
    status: "blocked",
    descriptionKo: "신규 flow 생성, transition 추가·삭제·정렬, 중복/순환 검증 저장 API가 없습니다.",
    descriptionEn: "No API exists yet for creating flows, adding/removing/reordering transitions, or saving duplicate/cycle validation results."
  },
  {
    labelKo: "버전 발행 / 롤백",
    labelEn: "Version publish / rollback",
    status: "blocked",
    descriptionKo: "draft/current/published/rollback 버전 모델, 승인 권한, 변경 전후 감사 저장 계약이 필요합니다.",
    descriptionEn: "Draft/current/published/rollback version models, approval permissions, and before/after audit contracts are required."
  },
  {
    labelKo: "메뉴·권한 영향도 Preview",
    labelEn: "Menu and authority impact preview",
    status: "blocked",
    descriptionKo: "연결 메뉴, route, feature/role 영향도를 저장 전 계산하고 차단 결과를 남기는 계약이 필요합니다.",
    descriptionEn: "A contract is required to calculate linked menu, route, feature, and role impact before save and persist blocking results."
  }
];

const SCREEN_FLOW_ACTION_CONTRACT = [
  { labelKo: "Flow 생성", labelEn: "Create Flow" },
  { labelKo: "Transition 편집", labelEn: "Edit Transitions" },
  { labelKo: "Flow 검증", labelEn: "Validate Flow" },
  { labelKo: "버전 발행", labelEn: "Publish Version" },
  { labelKo: "영향도 Preview 저장", labelEn: "Save Impact Preview" }
];

function summarizeFields(items: Array<{ fieldId: string; type: string }> | undefined) {
  if (!items || items.length === 0) {
    return "-";
  }
  return items.map((item) => `${item.fieldId}:${item.type}`).join(", ");
}

function countRelatedEvents(surface: ScreenCommandSurface, events: ScreenCommandEvent[]) {
  const eventIds = new Set(surface.eventIds || []);
  return events.filter((event) => eventIds.has(event.eventId)).length;
}

function countRelatedApis(surface: ScreenCommandSurface, events: ScreenCommandEvent[]) {
  const apiIds = new Set<string>();
  const eventIds = new Set(surface.eventIds || []);
  events.forEach((event) => {
    if (!eventIds.has(event.eventId)) {
      return;
    }
    (event.apiIds || []).forEach((apiId) => apiIds.add(apiId));
  });
  return apiIds.size;
}

function findSelectedPage(pages: ScreenCommandPagePayload["pages"], selectedPageId: string) {
  return pages.find((page) => page.pageId === selectedPageId) || null;
}

export function ScreenFlowManagementMigrationPage() {
  const en = isEnglish();
  const [pageFilter, setPageFilter] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const catalogState = useAsyncValue<ScreenCommandPagePayload>(() => fetchScreenCommandPage(""), []);
  const filteredPages = useMemo(() => {
    const items = catalogState.value?.pages || [];
    const normalized = pageFilter.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => {
      const haystack = `${item.label} ${item.pageId} ${item.routePath} ${item.menuCode}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [catalogState.value?.pages, pageFilter]);

  useEffect(() => {
    if (!selectedPageId && filteredPages.length > 0) {
      setSelectedPageId(filteredPages[0].pageId);
      return;
    }
    if (selectedPageId && filteredPages.every((item) => item.pageId !== selectedPageId) && filteredPages.length > 0) {
      setSelectedPageId(filteredPages[0].pageId);
    }
  }, [filteredPages, selectedPageId]);

  const detailState = useAsyncValue<ScreenCommandPagePayload>(
    () => (selectedPageId ? fetchScreenCommandPage(selectedPageId) : Promise.resolve(createEmptyScreenCommandPagePayload())),
    [selectedPageId]
  );

  const page = detailState.value?.page || createEmptyScreenCommandPagePayload().page;
  const selectedSummary = findSelectedPage(catalogState.value?.pages || [], selectedPageId);
  const error = catalogState.error || detailState.error;
  const summaryMetrics = resolveScreenCommandSummaryMetrics(page);
  const apisById = useMemo(() => {
    const next = new Map<string, ScreenCommandApi>();
    (page.apis || []).forEach((api) => next.set(api.apiId, api));
    return next;
  }, [page.apis]);

  useEffect(() => {
    logGovernanceScope("PAGE", "screen-flow-management", {
      language: en ? "en" : "ko",
      selectedPageId,
      filteredPageCount: filteredPages.length,
      surfaceCount: page.surfaces?.length || 0,
      eventCount: page.events?.length || 0,
      apiCount: page.apis?.length || 0
    });
    logGovernanceScope("COMPONENT", "screen-flow-catalog", {
      filter: pageFilter,
      filteredPageCount: filteredPages.length,
      selectedPageId
    });
  }, [en, filteredPages.length, page.apis?.length, page.events?.length, page.surfaces?.length, pageFilter, selectedPageId]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Environment" : "환경" },
        { label: en ? "Screen Flow Management" : "화면 흐름 관리" }
      ]}
      title={en ? "Screen Flow Management" : "화면 흐름 관리"}
      subtitle={en ? "Inspect each registered screen by route, component surface, event, API, and schema chain." : "등록된 화면을 route, surface, event, API, schema 체인 기준으로 점검합니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}

        <ScreenManagementSummaryGrid
          dataHelpId="screen-flow-summary"
          items={[
            {
              title: en ? "Registered Screens" : "등록 화면",
              value: catalogState.value?.pages?.length || 0,
              description: en ? "Pages registered in screen command and manifest sources." : "screen command와 manifest에 등록된 화면 수입니다."
            },
            {
              title: en ? "Surfaces" : "화면 요소",
              value: summaryMetrics.surfaceCount,
              description: en ? "Tracked runtime surfaces for the selected page." : "선택 화면에 연결된 runtime surface 수입니다.",
              dataHelpId: "screen-flow-catalog"
            },
            {
              title: en ? "Events" : "이벤트",
              value: summaryMetrics.eventCount,
              description: en ? "Frontend events linked from those surfaces." : "surface에서 이어지는 프론트 이벤트 수입니다.",
              accentClassName: "text-emerald-700",
              surfaceClassName: "bg-emerald-50"
            },
            {
              title: en ? "APIs / Schemas" : "API / 스키마",
              value: `${summaryMetrics.apiCount} / ${summaryMetrics.schemaCount}`,
              description: en ? "Backend contracts and schema references." : "연결 API와 스키마 참조 수입니다.",
              accentClassName: "text-amber-700",
              surfaceClassName: "bg-amber-50"
            }
          ]}
        />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.65fr]">
          <article className="gov-card" data-help-id="screen-flow-closeout-gate">
            <div className="flex flex-col gap-2 border-b border-[var(--kr-gov-border-light)] pb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
              <h2 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Read-only chain inspector vs. blocked flow mutations" : "읽기 전용 체인 점검과 차단된 흐름 변경"}</h2>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "This screen is currently reliable for metadata inspection. Flow authoring, transition editing, versioning, and impact save actions stay disabled until backend contracts exist."
                  : "현재 이 화면은 메타데이터 점검 용도까지 신뢰할 수 있습니다. 흐름 작성, transition 편집, 버전 관리, 영향도 저장은 백엔드 계약 전까지 비활성화합니다."}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {SCREEN_FLOW_CLOSEOUT_ROWS.map((row) => (
                <article key={row.labelEn} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? row.labelEn : row.labelKo}</h3>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${row.status === "available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.status === "available" ? (en ? "Available" : "가능") : (en ? "Blocked" : "차단")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? row.descriptionEn : row.descriptionKo}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="gov-card" data-help-id="screen-flow-action-contract">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Action Contract" : "실행 계약"}</p>
            <h2 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Disabled until validation and audit exist" : "검증과 감사 연결 전까지 비활성"}</h2>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {SCREEN_FLOW_ACTION_CONTRACT.map((action) => (
                <button key={action.labelEn} className="gov-btn gov-btn-outline justify-center opacity-65" type="button" disabled>
                  {en ? action.labelEn : action.labelKo}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold text-[var(--kr-gov-text-secondary)]">
              {en ? "Mutation actions require duplicate/cycle validation, menu and authority impact preview, approval rules, and before/after audit." : "변경 조치는 중복·순환 검증, 메뉴·권한 영향도 preview, 승인 규칙, 변경 전후 감사가 필요합니다."}
            </p>
          </article>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
          <ScreenManagementCatalogPanel
            count={filteredPages.length}
            dataHelpId="screen-flow-catalog"
            emptyLabel={en ? "No screens matched the filter." : "검색 조건과 일치하는 화면이 없습니다."}
            filterPlaceholder={en ? "Search by page ID, route, menu code" : "page ID, route, 메뉴 코드 검색"}
            filterValue={pageFilter}
            items={filteredPages.map((item) => ({
              key: item.pageId,
              title: item.label || item.pageId,
              subtitle: item.pageId,
              description: item.routePath || "-",
              active: item.pageId === selectedPageId,
              onSelect: () => setSelectedPageId(item.pageId)
            }))}
            onFilterChange={(event) => setPageFilter(event.target.value)}
            title={en ? "Screen Catalog" : "화면 카탈로그"}
          />

          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <ScreenManagementSelectionOverview
                className="flex-1"
                badges={(
                  <>
                    {selectedSummary?.domainCode ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{selectedSummary.domainCode}</span> : null}
                    {page.menuPermission?.requiredViewFeatureCode ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{page.menuPermission.requiredViewFeatureCode}</span> : null}
                    {page.manifestRegistry?.layoutVersion ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{page.manifestRegistry.layoutVersion}</span> : null}
                  </>
                )}
                description={page.summary || (en ? "No summary is registered for this screen." : "이 화면에 등록된 요약 정보가 없습니다.")}
                metaDescription={en ? "Page routing, source ownership, and component inventory stay together as the canonical trace." : "화면 경로, 소스 위치, 컴포넌트 인벤토리를 한 카드에서 같이 봅니다."}
                metaItems={[
                  { label: en ? "Page ID" : "페이지 ID", value: page.pageId || "-" },
                  { label: en ? "Menu Code" : "메뉴 코드", value: page.menuCode || "-" },
                  { label: en ? "Route" : "경로", value: page.routePath || "-" },
                  { label: en ? "Source" : "소스", value: page.source || "-" }
                ]}
                metaTitle={en ? "Selected Screen Metadata" : "선택 화면 메타데이터"}
                title={page.label || (en ? "Select a screen" : "화면을 선택하세요")}
              />
              {page.pageId ? (
                <div className="shrink-0 pt-1 pl-1">
                  <a
                    href={buildLocalizedPath(`/admin/system/asset-detail?id=UI-${page.pageId}`, `/en/admin/system/asset-detail?id=UI-${page.pageId}`)}
                    className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--kr-gov-blue)] focus:ring-offset-1"
                  >
                    {en ? "View Asset details" : "자산 거버넌스 상세"}
                  </a>
                </div>
              ) : null}
            </div>

            <section className="gov-card overflow-hidden p-0" data-help-id="screen-flow-surface-chain">
              <GridToolbar
                meta={en ? "From rendered surface to frontend event and downstream API connection." : "렌더링 surface에서 프론트 이벤트, API 연결까지 이어지는 체인입니다."}
                title={en ? "Surface to Event Flow" : "화면 요소 흐름"}
              />
              <div className="overflow-x-auto">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>{en ? "Surface" : "화면 요소"}</th>
                      <th>{en ? "Zone" : "영역"}</th>
                      <th>{en ? "Event Count" : "이벤트 수"}</th>
                      <th>{en ? "API Count" : "API 수"}</th>
                      <th>{en ? "Selector" : "셀렉터"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(page.surfaces || []).length === 0 ? (
                      <tr>
                        <td className="text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                          {en ? "No surface metadata is registered." : "등록된 화면 요소 메타데이터가 없습니다."}
                        </td>
                      </tr>
                    ) : (
                      (page.surfaces || []).map((surface) => (
                        <tr key={surface.surfaceId}>
                          <td>
                            <strong>{surface.label || surface.surfaceId}</strong>
                            <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{surface.componentId || "-"}</div>
                          </td>
                          <td>{surface.layoutZone || "-"}</td>
                          <td>{countRelatedEvents(surface, page.events || [])}</td>
                          <td>{countRelatedApis(surface, page.events || [])}</td>
                          <td className="break-all text-xs">{surface.selector || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden p-0" data-help-id="screen-flow-event-chain">
              <GridToolbar
                meta={en ? "Frontend function inputs and outputs stay visible with the linked API contract." : "프론트 함수 입출력과 연결 API 계약을 한 표에서 확인합니다."}
                title={en ? "Event / API Chain" : "이벤트 / API 체인"}
              />
              <div className="overflow-x-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>{en ? "Event" : "이벤트"}</th>
                      <th>{en ? "Frontend Function" : "프론트 함수"}</th>
                      <th>{en ? "Parameters" : "파라미터"}</th>
                      <th>{en ? "Results" : "결과값"}</th>
                      <th>{en ? "Linked APIs" : "연결 API"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(page.events || []).length === 0 ? (
                      <tr>
                        <td className="text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                          {en ? "No event chain is registered." : "등록된 이벤트 체인이 없습니다."}
                        </td>
                      </tr>
                    ) : (
                      (page.events || []).map((event) => (
                        <tr key={event.eventId}>
                          <td>
                            <strong>{event.label || event.eventId}</strong>
                            <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{event.eventType || "-"}</div>
                          </td>
                          <td>{event.frontendFunction || "-"}</td>
                          <td>{summarizeFields(event.functionInputs)}</td>
                          <td>{summarizeFields(event.functionOutputs)}</td>
                          <td>
                            {(event.apiIds || []).length === 0 ? "-" : (
                              <div className="space-y-1">
                                {(event.apiIds || []).map((apiId) => {
                                  const api = apisById.get(apiId);
                                  return (
                                    <div key={apiId}>
                                      <strong>{api?.label || apiId}</strong>
                                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">{api ? `${api.method} ${api.endpoint}` : ""}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" data-help-id="screen-flow-schema-permission">
              <section className="gov-card">
                <GridToolbar
                  meta={en ? "Schema metadata exposed from the screen command registry." : "screen command 레지스트리에 등록된 스키마 메타데이터입니다."}
                  title={en ? "Schemas" : "스키마"}
                />
                <div className="space-y-3 p-6">
                  {(page.schemas || []).length === 0 ? (
                    <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No schema metadata." : "등록된 스키마 메타데이터가 없습니다."}</p>
                  ) : (
                    (page.schemas || []).map((schema: ScreenCommandSchema) => (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4" key={schema.schemaId}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <strong>{schema.label || schema.schemaId}</strong>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{schema.tableName || "-"}</span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{(schema.columns || []).join(", ") || "-"}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="gov-card">
                <GridToolbar
                  meta={en ? "Permission binding and editable targets tracked for the selected page." : "선택 화면의 권한 연결과 수정 대상 메타데이터입니다."}
                  title={en ? "Permission / Change Targets" : "권한 / 변경 대상"}
                />
                <div className="space-y-4 p-6">
                  <KeyValueGridPanel
                    description={en ? "The required VIEW feature and relation tables should stay aligned with menu binding." : "필수 VIEW 기능과 권한 연계 테이블이 메뉴 귀속과 맞아야 합니다."}
                    items={[
                      { label: en ? "Required View Feature" : "필수 VIEW 기능", value: page.menuPermission?.requiredViewFeatureCode || "-" },
                      { label: en ? "Feature Codes" : "기능 코드", value: (page.menuPermission?.featureCodes || []).join(", ") || "-" },
                      { label: en ? "Relation Tables" : "권한 연계 테이블", value: (page.menuPermission?.relationTables || []).join(", ") || "-" },
                      { label: en ? "Change Targets" : "변경 대상 수", value: summaryMetrics.changeTargetCount }
                    ]}
                    title={en ? "Permission Binding" : "권한 귀속"}
                  />
                  <div className="space-y-3">
                    {(page.changeTargets || []).length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No registered change targets." : "등록된 변경 대상이 없습니다."}</p>
                    ) : (
                      (page.changeTargets || []).map((target) => (
                        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4" key={target.targetId}>
                          <strong>{target.label || target.targetId}</strong>
                          <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{(target.editableFields || []).join(", ") || "-"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </section>
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
