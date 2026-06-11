import { useEffect, useMemo, useState } from "react";
import {
  fetchScreenCommandPage
} from "../../lib/api/platform";
import { getScreenCommandChainText, getScreenCommandChainValues } from "../../lib/api/screenCommand";
import type {
  ScreenCommandApi,
  ScreenCommandChangeTarget,
  ScreenCommandEvent,
  ScreenCommandFieldSpec,
  ScreenCommandMaskRule,
  ScreenCommandPagePayload,
  ScreenCommandSchema,
  ScreenCommandSurface
} from "../../lib/api/platformTypes";

type ScreenCommandCenterPanelProps = {
  initialPageId: string;
};

function buildDirectionPreview(params: {
  pageLabel: string;
  routePath: string;
  surface?: ScreenCommandSurface;
  event?: ScreenCommandEvent;
  api?: ScreenCommandApi;
  target?: ScreenCommandChangeTarget;
  schema?: ScreenCommandSchema;
  summary: string;
  instruction: string;
}) {
  const lines = [
    `[수정 요약] ${params.summary || "요약 없음"}`,
    `대상 화면: ${params.pageLabel} (${params.routePath})`,
    `대상 요소: ${params.surface ? `${params.surface.label} [${params.surface.selector}]` : "미선택"}`,
    `이벤트: ${params.event ? `${params.event.label} / ${params.event.frontendFunction}` : "미선택"}`,
    `API/라우트: ${params.api ? `${params.api.method} ${params.api.endpoint}` : "미선택"}`,
    `백엔드 연결: ${params.api ? [
      getScreenCommandChainText(params.api.controllerActions, params.api.controllerAction),
      getScreenCommandChainText(params.api.serviceMethods, params.api.serviceMethod),
      getScreenCommandChainText(params.api.mapperQueries, params.api.mapperQuery)
    ].join(" -> ") : "미선택"}`,
    `함수 입력: ${params.event?.functionInputs?.map((item) => `${item.fieldId}:${item.type}`).join(", ") || "미선택"}`,
    `API 요청: ${params.api?.requestFields?.map((item) => `${item.fieldId}:${item.type}`).join(", ") || "미선택"}`,
    `스키마: ${params.schema ? `${params.schema.tableName} (${params.schema.columns.join(", ")})` : "미선택"}`,
    `수정 레이어: ${params.target ? `${params.target.label} [${params.target.editableFields.join(", ")}]` : "미선택"}`,
    `지시 내용: ${params.instruction || "구체 지시를 입력하세요."}`
  ];
  return lines.join("\n");
}

function renderFieldSpecs(title: string, items: ScreenCommandFieldSpec[] | undefined) {
  return (
    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{title}</p>
      {items && items.length > 0 ? (
        <div className="mt-3 space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
          {items.map((item) => (
            <div key={`${title}-${item.fieldId}`}>
              <p className="font-bold text-[var(--kr-gov-text-primary)]">
                {item.fieldId} <span className="font-normal text-[var(--kr-gov-text-secondary)]">[{item.type}]</span>
              </p>
              <p className="mt-1 text-xs">{item.required ? "required" : "optional"} / {item.source}</p>
              <p className="mt-1 text-xs">{item.notes}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">-</p>
      )}
    </article>
  );
}

function renderMaskRules(items: ScreenCommandMaskRule[] | undefined) {
  return (
    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Masking</p>
      {items && items.length > 0 ? (
        <div className="mt-3 space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
          {items.map((item) => (
            <div key={`mask-${item.fieldId}`}>
              <p className="font-bold text-[var(--kr-gov-text-primary)]">
                {item.fieldId} <span className="font-normal text-[var(--kr-gov-text-secondary)]">[{item.strategy}]</span>
              </p>
              <p className="mt-1 text-xs">{item.notes}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">-</p>
      )}
    </article>
  );
}

export function ScreenCommandCenterPanel({ initialPageId }: ScreenCommandCenterPanelProps) {
  const [pageId, setPageId] = useState(initialPageId);
  const [payload, setPayload] = useState<ScreenCommandPagePayload | null>(null);
  const [surfaceId, setSurfaceId] = useState("");
  const [eventId, setEventId] = useState("");
  const [changeTargetId, setChangeTargetId] = useState("");
  const [summary, setSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(nextPageId: string) {
    setLoading(true);
    setError("");
    try {
      const nextPayload = await fetchScreenCommandPage(nextPageId);
      setPayload(nextPayload);
      setPageId(nextPayload.selectedPageId || nextPageId);
      const firstSurfaceId = nextPayload.page?.surfaces?.[0]?.surfaceId || "";
      const firstTargetId = nextPayload.page?.changeTargets?.[0]?.targetId || "";
      setSurfaceId(firstSurfaceId);
      setEventId("");
      setChangeTargetId(firstTargetId);
      setSummary("");
      setInstruction("");
      setPreviewText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 디렉션 메타데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(initialPageId).catch(() => undefined);
  }, [initialPageId]);

  const currentPage = payload?.page;
  const selectedSurface = useMemo(
    () => currentPage?.surfaces?.find((item) => item.surfaceId === surfaceId) || currentPage?.surfaces?.[0],
    [currentPage, surfaceId]
  );
  const availableEvents = useMemo(() => {
    if (!currentPage) {
      return [];
    }
    if (!selectedSurface?.eventIds?.length) {
      return currentPage.events || [];
    }
    const eventIdSet = new Set(selectedSurface.eventIds);
    return (currentPage.events || []).filter((item) => eventIdSet.has(item.eventId));
  }, [currentPage, selectedSurface]);
  const selectedEvent = useMemo(
    () => availableEvents.find((item) => item.eventId === eventId) || availableEvents[0],
    [availableEvents, eventId]
  );
  const availableApis = useMemo(() => {
    if (!currentPage) {
      return [];
    }
    if (!selectedEvent?.apiIds?.length) {
      return currentPage.apis || [];
    }
    const apiIdSet = new Set(selectedEvent.apiIds);
    return (currentPage.apis || []).filter((item) => apiIdSet.has(item.apiId));
  }, [currentPage, selectedEvent]);
  const selectedApi = availableApis[0];
  const selectedSchema = useMemo(() => {
    if (!currentPage) {
      return undefined;
    }
    const schemaId = selectedApi?.schemaIds?.[0];
    if (!schemaId) {
      return currentPage.schemas?.[0];
    }
    return currentPage.schemas.find((item) => item.schemaId === schemaId) || currentPage.schemas?.[0];
  }, [currentPage, selectedApi]);
  const selectedTarget = useMemo(
    () => currentPage?.changeTargets?.find((item) => item.targetId === changeTargetId) || currentPage?.changeTargets?.[0],
    [changeTargetId, currentPage]
  );
  const preview = useMemo(() => buildDirectionPreview({
    pageLabel: currentPage?.label || "-",
    routePath: currentPage?.routePath || "-",
    surface: selectedSurface,
    event: selectedEvent,
    api: selectedApi,
    target: selectedTarget,
    schema: selectedSchema,
    summary,
    instruction
  }), [currentPage, instruction, selectedApi, selectedEvent, selectedSchema, selectedSurface, selectedTarget, summary]);

  function handleGeneratePreview() {
    setPreviewText(preview);
  }

  return (
    <div className="space-y-6" data-help-id="help-management-command-center">
      {error ? (
        <section className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <article className="gov-card border-l-4 border-l-[var(--kr-gov-blue)]">
          <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">Target Screen</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{currentPage?.label || "-"}</p>
          <p className="mt-2 break-all text-xs text-gray-500">{currentPage?.routePath || "-"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-[var(--kr-gov-green)]">
          <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">Registry</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{currentPage?.manifestRegistry?.pageId || "-"}</p>
          <p className="mt-2 text-xs text-gray-500">layout {currentPage?.manifestRegistry?.layoutVersion || "-"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-amber-500">
          <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">View Feature</p>
          <p className="mt-3 break-all text-lg font-black text-[var(--kr-gov-text-primary)]">{currentPage?.menuPermission?.requiredViewFeatureCode || "-"}</p>
          <p className="mt-2 text-xs text-gray-500">{(currentPage?.menuPermission?.featureCodes || []).join(", ") || "-"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-slate-500">
          <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">Components</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{String(currentPage?.manifestRegistry?.componentCount || 0)}</p>
          <p className="mt-2 break-all text-xs text-gray-500">{currentPage?.menuLookupUrl || "-"}</p>
        </article>
      </section>

      <section className="gov-card">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">수정 경로 선택</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              선택한 화면의 요소, 이벤트, API, 권한 메타데이터를 함께 묶어 수정 지시를 생성합니다.
            </p>
          </div>
          <button
            className="gov-btn gov-btn-secondary"
            disabled={loading}
            onClick={() => load(pageId).catch(() => undefined)}
            type="button"
          >
            {loading ? "불러오는 중..." : "화면 연결 불러오기"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="gov-label">대상 화면</span>
            <select className="gov-select" value={pageId} onChange={(event) => setPageId(event.target.value)}>
              {(payload?.pages || []).map((option) => (
                <option key={option.pageId} value={option.pageId}>
                  {option.label} ({option.routePath})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">요소</span>
            <select className="gov-select" value={selectedSurface?.surfaceId || ""} onChange={(event) => setSurfaceId(event.target.value)}>
              {(currentPage?.surfaces || []).map((item) => (
                <option key={item.surfaceId} value={item.surfaceId}>
                  {item.label} ({item.componentId})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">이벤트</span>
            <select className="gov-select" value={selectedEvent?.eventId || ""} onChange={(event) => setEventId(event.target.value)}>
              {availableEvents.map((item) => (
                <option key={item.eventId} value={item.eventId}>
                  {item.label} ({item.eventType})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">수정 레이어</span>
            <select className="gov-select" value={selectedTarget?.targetId || ""} onChange={(event) => setChangeTargetId(event.target.value)}>
              {(currentPage?.changeTargets || []).map((item) => (
                <option key={item.targetId} value={item.targetId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <label className="block">
            <span className="gov-label">수정 요약</span>
            <input
              className="gov-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="예: 도움말 CTA 노출 기준과 권한 조건을 일치시키도록 정리"
            />
          </label>
          <label className="block">
            <span className="gov-label">작업 지시</span>
            <textarea
              className="gov-input min-h-[120px] py-3"
              rows={4}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="예: 선택 요소 기준으로 이벤트, API, 매퍼 조회조건, 권한 영향, 수정 레이어를 함께 검토"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="gov-btn gov-btn-outline-blue" data-action="generate" onClick={handleGeneratePreview} type="button">
            지시문 생성
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="gov-card">
          <div className="mb-4">
            <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">연결된 요소와 실행 경로</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              현재 선택 기준으로 화면, 이벤트, API, 스키마 연결 상태를 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">선택 요소</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedSurface?.label || "-"}</p>
              <p className="mt-2 break-all text-xs text-gray-500">{selectedSurface?.selector || "-"}</p>
              <p className="mt-2 text-xs text-gray-500">{selectedSurface?.notes || "-"}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">이벤트</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedEvent?.label || "-"}</p>
              <p className="mt-2 break-all text-xs text-gray-500">{selectedEvent?.frontendFunction || "-"}</p>
              <p className="mt-2 text-xs text-gray-500">{selectedEvent?.notes || "-"}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">API / Controller</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedApi ? `${selectedApi.method} ${selectedApi.endpoint}` : "-"}</p>
              <p className="mt-2 break-all text-xs text-gray-500">{getScreenCommandChainText(selectedApi?.controllerActions, selectedApi?.controllerAction || "")}</p>
              <p className="mt-1 break-all text-xs text-gray-500">{getScreenCommandChainText(selectedApi?.serviceMethods, selectedApi?.serviceMethod || "")}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Schema</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedSchema?.tableName || "-"}</p>
              <div className="mt-2 space-y-1">
                {getScreenCommandChainValues(selectedApi?.mapperQueries, selectedApi?.mapperQuery || "").length > 0 ? getScreenCommandChainValues(selectedApi?.mapperQueries, selectedApi?.mapperQuery || "").map((item) => (
                  <p key={item} className="break-all text-xs text-gray-500">{item}</p>
                )) : <p className="break-all text-xs text-gray-500">-</p>}
              </div>
              <p className="mt-1 text-xs text-gray-500">{selectedSchema?.notes || "-"}</p>
            </article>
            {renderFieldSpecs("Function Inputs", selectedEvent?.functionInputs)}
            {renderFieldSpecs("Function Outputs", selectedEvent?.functionOutputs)}
            {renderFieldSpecs("API Request", selectedApi?.requestFields)}
            {renderFieldSpecs("API Response", selectedApi?.responseFields)}
            {renderMaskRules(selectedApi?.maskingRules)}
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Guards / Side Effects</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedEvent?.eventId || "-"}</p>
              <p className="mt-2 text-xs text-gray-500">{selectedEvent?.guardConditions?.join(", ") || "-"}</p>
              <p className="mt-1 text-xs text-gray-500">{selectedEvent?.sideEffects?.join(", ") || "-"}</p>
            </article>
          </div>
        </article>

        <article className="gov-card">
          <div className="mb-4">
            <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">AI 작업 지시 초안</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              선택한 요소, 이벤트, 수정 레이어와 입력한 요약/요구사항을 기반으로 바로 전달 가능한 지시문을 생성합니다.
            </p>
          </div>
          <label className="block">
            <span className="gov-label">생성된 지시문</span>
            <textarea className="gov-input min-h-[320px] py-3 font-mono text-[12px]" readOnly rows={12} value={previewText || preview} />
          </label>
        </article>
      </section>

      <section className="gov-card">
        <div className="mb-6">
          <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">메뉴, 기능 권한, 공통코드</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
            메뉴 접근 권한과 연결된 기능 코드, 공통코드 그룹을 함께 검토합니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">VIEW 권한</p>
            <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{currentPage?.menuPermission?.requiredViewFeatureCode || "-"}</p>
            <p className="mt-2 text-xs text-gray-500">{(currentPage?.menuPermission?.featureCodes || []).join(", ") || "기능 코드 없음"}</p>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">권한 해석 테이블</p>
            <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{(currentPage?.menuPermission?.relationTables || []).join(", ") || "-"}</p>
            <p className="mt-2 text-xs text-gray-500">{(currentPage?.menuPermission?.resolverNotes || []).join(" ") || "-"}</p>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">공통코드 그룹</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(currentPage?.commonCodeGroups || []).map((item) => (
                <span className="inline-flex rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-primary)]" key={item.codeGroupId}>
                  {item.codeGroupId}: {item.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {(currentPage?.commonCodeGroups || [])
                .map((item) => `${item.codeGroupId}[${item.values.join(", ")}]`)
                .join(" / ") || "-"}
            </p>
          </article>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="gov-table-header">
                <th className="px-5 py-4">featureCode</th>
                <th className="px-5 py-4">featureNm</th>
                <th className="px-5 py-4">menuCode</th>
                <th className="px-5 py-4">menuUrl</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(currentPage?.menuPermission?.featureRows || []).length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-500" colSpan={4}>
                    연결된 기능 코드가 없습니다.
                  </td>
                </tr>
              ) : (currentPage?.menuPermission?.featureRows || []).map((item) => (
                <tr key={item.featureCode} className="hover:bg-gray-50/60">
                  <td className="px-5 py-4 font-mono text-xs">{item.featureCode}</td>
                  <td className="px-5 py-4 font-bold">{item.featureNm}</td>
                  <td className="px-5 py-4">{item.menuCode}</td>
                  <td className="px-5 py-4 break-all">{item.menuUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
