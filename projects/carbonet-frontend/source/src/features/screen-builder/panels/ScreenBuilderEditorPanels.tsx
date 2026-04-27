import type { Dispatch, SetStateAction } from "react";
import type {
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderEventBinding,
  ScreenBuilderNode,
  ScreenBuilderPaletteItem,
  ScreenCommandPagePayload
} from "../../../lib/api/platformTypes";
import { GridToolbar, MemberButton, MemberButtonGroup, MemberIconButton } from "../../admin-ui/common";
import { renderScreenBuilderNodePreview } from "../shared/screenBuilderPreview";
import { sortScreenBuilderNodes } from "../shared/screenBuilderUtils";
import { resolveTemplateSlots, type BuilderTemplateType } from "../shared/screenBuilderShared";

type ScreenCommandApi = NonNullable<ScreenCommandPagePayload["page"]["apis"]>[number];

type NodeTreeRow = {
  node: ScreenBuilderNode;
  depth: number;
  hasChildren: boolean;
};

type Props = {
  en: boolean;
  filteredPalette: ScreenBuilderPaletteItem[];
  addNode: (item: ScreenBuilderPaletteItem) => void;
  selectedTemplateType: BuilderTemplateType;
  nodes: ScreenBuilderNode[];
  selectedNode: ScreenBuilderNode | null;
  dragNodeId: string;
  setDragNodeId: Dispatch<SetStateAction<string>>;
  setSelectedNodeId: Dispatch<SetStateAction<string>>;
  nodeTreeRows: NodeTreeRow[];
  collapsedNodeIdSet: Set<string>;
  toggleCollapsedNode: (nodeId: string) => void;
  moveSelectedNode: (direction: -1 | 1) => void;
  duplicateSelectedNode: () => void;
  removeSelectedNode: () => void;
  reorderNodes: (sourceNodeId: string, targetNodeId: string) => void;
  selectedNodeProps: Record<string, unknown>;
  updateSelectedNodeField: (field: string, value: unknown) => void;
  setNodes: Dispatch<SetStateAction<ScreenBuilderNode[]>>;
  componentLabel: string;
  setComponentLabel: Dispatch<SetStateAction<string>>;
  componentDescription: string;
  setComponentDescription: Dispatch<SetStateAction<string>>;
  saving: boolean;
  handleRegisterSelectedComponent: () => Promise<void>;
  setReplacementComponentId: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  replacementComponentId: string;
  selectedRegistryComponent: ScreenBuilderComponentRegistryItem | null;
  handleReplaceSelectedComponent: () => void;
  selectedEvent: ScreenBuilderEventBinding | null;
  ensureSelectedEvent: () => ScreenBuilderEventBinding | null;
  updateSelectedEvent: (field: "eventName" | "actionType", value: string) => void;
  updateSelectedEventTarget: (value: string) => void;
  updateSelectedEventApi: (apiId: string) => void;
  availableApis: ScreenCommandApi[];
  commandHasApis: boolean;
  selectedApi: ScreenCommandApi | null;
  updateSelectedEventRequestMapping: (fieldId: string, value: string) => void;
  setEvents: Dispatch<SetStateAction<ScreenBuilderEventBinding[]>>;
  previewMode: "DRAFT" | "PUBLISHED";
  setPreviewMode: Dispatch<SetStateAction<"DRAFT" | "PUBLISHED">>;
  publishedVersionId?: string;
  menuUrl?: string;
  previewMessage: string;
  previewNodes: ScreenBuilderNode[];
};

export default function ScreenBuilderEditorPanels({
  en,
  filteredPalette,
  addNode,
  selectedTemplateType,
  nodes,
  selectedNode,
  dragNodeId,
  setDragNodeId,
  setSelectedNodeId,
  nodeTreeRows,
  collapsedNodeIdSet,
  toggleCollapsedNode,
  moveSelectedNode,
  duplicateSelectedNode,
  removeSelectedNode,
  reorderNodes,
  selectedNodeProps,
  updateSelectedNodeField,
  setNodes,
  componentLabel,
  setComponentLabel,
  componentDescription,
  setComponentDescription,
  saving,
  handleRegisterSelectedComponent,
  setReplacementComponentId,
  setMessage,
  componentRegistry,
  replacementComponentId,
  selectedRegistryComponent,
  handleReplaceSelectedComponent,
  selectedEvent,
  ensureSelectedEvent,
  updateSelectedEvent,
  updateSelectedEventTarget,
  updateSelectedEventApi,
  availableApis,
  commandHasApis,
  selectedApi,
  updateSelectedEventRequestMapping,
  setEvents,
  previewMode,
  setPreviewMode,
  publishedVersionId,
  menuUrl,
  previewMessage,
  previewNodes
}: Props) {
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        actions={<MemberButtonGroup>{filteredPalette.map((item) => (
          <MemberButton key={item.componentType} onClick={() => addNode(item)} size="xs" type="button" variant="secondary">
            {en ? (item.labelEn || item.label) : item.label}
          </MemberButton>
        ))}</MemberButtonGroup>}
        meta={en ? `${selectedTemplateType} palette. Append standardized blocks that match the selected page type.` : `${selectedTemplateType} 팔레트입니다. 선택한 페이지 타입에 맞는 표준 블록만 추가합니다.`}
        title={en ? "Component Palette" : "컴포넌트 팔레트"}
      />
      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
          <GridToolbar
            actions={(
              <MemberButtonGroup>
                <MemberIconButton disabled={!selectedNode || selectedNode.componentType === "page"} icon="arrow_upward" onClick={() => moveSelectedNode(-1)} type="button" />
                <MemberIconButton disabled={!selectedNode || selectedNode.componentType === "page"} icon="arrow_downward" onClick={() => moveSelectedNode(1)} type="button" />
                <MemberIconButton disabled={!selectedNode || selectedNode.componentType === "page"} icon="content_copy" onClick={duplicateSelectedNode} type="button" />
                <MemberIconButton disabled={!selectedNode || selectedNode.componentType === "page"} icon="delete" onClick={removeSelectedNode} type="button" variant="dangerSecondary" />
              </MemberButtonGroup>
            )}
            meta={en ? `${nodes.length} nodes in draft. Drag cards to reorder.` : `현재 초안 노드 ${nodes.length}개. 카드를 드래그해 순서를 바꿀 수 있습니다.`}
            title={en ? "Canvas Nodes" : "캔버스 노드"}
          />
          <div className="max-h-[680px] overflow-auto p-4">
            <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-gray-50 px-3 py-3">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Hierarchy" : "계층 트리"}</p>
              <div className="mt-3 space-y-1">
                {nodeTreeRows.map(({ node, depth, hasChildren }) => (
                  <div className="flex items-center gap-1" key={`tree-${node.nodeId}`} style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                    <button
                      className={`flex h-6 w-6 items-center justify-center rounded ${hasChildren ? "hover:bg-white text-[var(--kr-gov-text-secondary)]" : "text-transparent"}`}
                      disabled={!hasChildren}
                      onClick={() => toggleCollapsedNode(node.nodeId)}
                      type="button"
                    >
                      {hasChildren ? (collapsedNodeIdSet.has(node.nodeId) ? "+" : "-") : "."}
                    </button>
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${node.nodeId === selectedNode?.nodeId ? "bg-blue-100 text-[var(--kr-gov-blue)]" : "hover:bg-white text-[var(--kr-gov-text-primary)]"}`}
                      onClick={() => setSelectedNodeId(node.nodeId)}
                      type="button"
                    >
                      <span className="font-mono text-[10px] uppercase text-[var(--kr-gov-text-secondary)]">{node.componentType}</span>
                      <span className="truncate">{String(node.props?.label || node.props?.title || node.props?.text || node.nodeId)}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sortScreenBuilderNodes(nodes).map((node) => {
                const selected = node.nodeId === selectedNode?.nodeId;
                return (
                  <button
                    className={`w-full rounded-[var(--kr-gov-radius)] border px-4 py-3 text-left ${selected ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-[var(--kr-gov-border-light)] bg-white hover:bg-gray-50"} ${dragNodeId === node.nodeId ? "opacity-60" : ""}`}
                    draggable={node.componentType !== "page"}
                    key={node.nodeId}
                    onClick={() => setSelectedNodeId(node.nodeId)}
                    onDragEnd={() => setDragNodeId("")}
                    onDragOver={(event) => {
                      if (node.componentType === "page") {
                        return;
                      }
                      event.preventDefault();
                    }}
                    onDragStart={() => setDragNodeId(node.nodeId)}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (node.componentType === "page") {
                        return;
                      }
                      reorderNodes(dragNodeId, node.nodeId);
                      setDragNodeId("");
                    }}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{node.componentType}</p>
                        <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{String(node.props?.label || node.props?.title || node.props?.text || node.nodeId)}</p>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{node.parentNodeId || "root"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </article>

        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
          <GridToolbar
            meta={selectedNode ? `${selectedNode.componentType} / ${selectedNode.nodeId}` : (en ? "Select a node" : "노드를 선택하세요")}
            title={en ? "Properties & Events" : "속성 및 이벤트"}
          />
          <div className="space-y-5 p-4">
            {selectedNode ? (
              <>
                {selectedNode.componentType === "section" ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Section Title" : "섹션 제목"}</span>
                    <input className="gov-input" value={String(selectedNodeProps.title || "")} onChange={(event) => updateSelectedNodeField("title", event.target.value)} />
                  </label>
                ) : null}
                {(selectedNode.componentType === "heading" || selectedNode.componentType === "text") ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Text" : "문구"}</span>
                    <textarea className="gov-input min-h-[110px] py-3" rows={4} value={String(selectedNodeProps.text || "")} onChange={(event) => updateSelectedNodeField("text", event.target.value)} />
                  </label>
                ) : null}
                {["input", "textarea", "select", "checkbox", "button"].includes(selectedNode.componentType) ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Label" : "라벨"}</span>
                    <input className="gov-input" value={String(selectedNodeProps.label || "")} onChange={(event) => updateSelectedNodeField("label", event.target.value)} />
                  </label>
                ) : null}
                {["input", "textarea", "select"].includes(selectedNode.componentType) ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Placeholder" : "플레이스홀더"}</span>
                    <input className="gov-input" value={String(selectedNodeProps.placeholder || "")} onChange={(event) => updateSelectedNodeField("placeholder", event.target.value)} />
                  </label>
                ) : null}
                {selectedNode.componentType === "button" ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Variant" : "버튼 종류"}</span>
                    <select className="gov-select" value={String(selectedNodeProps.variant || "primary")} onChange={(event) => updateSelectedNodeField("variant", event.target.value)}>
                      <option value="primary">primary</option>
                      <option value="secondary">secondary</option>
                    </select>
                  </label>
                ) : null}
                {selectedNode.componentType === "table" ? (
                  <>
                    <label className="block">
                      <span className="gov-label">{en ? "Table Title" : "테이블 제목"}</span>
                      <input className="gov-input" value={String(selectedNodeProps.title || "")} onChange={(event) => updateSelectedNodeField("title", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">{en ? "Columns" : "컬럼"}</span>
                      <input className="gov-input" value={String(selectedNodeProps.columns || "")} onChange={(event) => updateSelectedNodeField("columns", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">{en ? "Empty Text" : "빈 상태 문구"}</span>
                      <input className="gov-input" value={String(selectedNodeProps.emptyText || "")} onChange={(event) => updateSelectedNodeField("emptyText", event.target.value)} />
                    </label>
                  </>
                ) : null}
                {selectedNode.componentType === "pagination" ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Summary" : "요약 문구"}</span>
                    <input className="gov-input" value={String(selectedNodeProps.summary || "")} onChange={(event) => updateSelectedNodeField("summary", event.target.value)} />
                  </label>
                ) : null}
                {selectedNode.componentType !== "page" ? (
                  <label className="block">
                    <span className="gov-label">{en ? "Layout Slot" : "레이아웃 슬롯"}</span>
                    <select
                      className="gov-select"
                      value={String(selectedNode.slotName || resolveTemplateSlots(selectedTemplateType, selectedNode.componentType)[0] || "content")}
                      onChange={(event) => {
                        setNodes((current) => current.map((node) => node.nodeId === selectedNode.nodeId ? { ...node, slotName: event.target.value } : node));
                      }}
                    >
                      {resolveTemplateSlots(selectedTemplateType, selectedNode.componentType).map((slot) => (
                        <option key={`${selectedNode.nodeId}-${slot}`} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {["input", "textarea", "select", "checkbox"].includes(selectedNode.componentType) ? (
                  <label className="flex items-center gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3 text-sm font-medium text-[var(--kr-gov-text-primary)]">
                    <input checked={Boolean(selectedNodeProps.required)} onChange={(event) => updateSelectedNodeField("required", event.target.checked)} type="checkbox" />
                    <span>{en ? "Required field" : "필수 입력"}</span>
                  </label>
                ) : null}

                <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Component Registry" : "컴포넌트 레지스트리"}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${selectedNode.componentId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {selectedNode.componentId ? (en ? "Registered" : "등록됨") : (en ? "Unregistered" : "미등록")}
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="gov-label">{en ? "Linked componentId" : "연결된 componentId"}</span>
                      <input className="gov-input font-mono" readOnly value={String(selectedNode.componentId || "")} />
                    </label>
                    <label className="block">
                      <span className="gov-label">{en ? "Registry label" : "레지스트리 이름"}</span>
                      <input className="gov-input" value={componentLabel} onChange={(event) => setComponentLabel(event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">{en ? "Description" : "설명"}</span>
                      <textarea className="gov-input min-h-[90px] py-3" rows={3} value={componentDescription} onChange={(event) => setComponentDescription(event.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <MemberButton disabled={saving || selectedNode.componentType === "page"} onClick={() => { void handleRegisterSelectedComponent(); }} size="xs" type="button" variant="secondary">
                        {en ? "Register selected node" : "선택 노드 등록"}
                      </MemberButton>
                      <MemberButton disabled={!selectedNode.componentId} onClick={() => {
                        setNodes((current) => current.map((node) => node.nodeId === selectedNode.nodeId ? { ...node, componentId: "" } : node));
                        setReplacementComponentId("");
                        setMessage(en ? "Component link cleared." : "컴포넌트 연결을 해제했습니다.");
                      }} size="xs" type="button" variant="dangerSecondary">
                        {en ? "Clear link" : "연결 해제"}
                      </MemberButton>
                    </div>
                    <label className="block">
                      <span className="gov-label">{en ? "Replace with existing component" : "기존 컴포넌트로 대체"}</span>
                      <select className="gov-select" value={replacementComponentId} onChange={(event) => setReplacementComponentId(event.target.value)}>
                        <option value="">{en ? "Select component" : "컴포넌트 선택"}</option>
                        {componentRegistry
                          .filter((item) => item.componentType !== "page")
                          .map((item) => (
                            <option key={item.componentId} value={item.componentId}>
                              {item.componentId} / {en ? (item.labelEn || item.label) : item.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <MemberButton disabled={!selectedRegistryComponent} onClick={handleReplaceSelectedComponent} size="xs" type="button" variant="secondary">
                      {en ? "Apply registered component" : "등록 컴포넌트 적용"}
                    </MemberButton>
                  </div>
                </div>

                <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Event Binding" : "이벤트 연결"}</p>
                    <MemberButton onClick={() => { ensureSelectedEvent(); }} size="xs" type="button" variant="secondary">
                      {selectedEvent ? (en ? "Reset" : "다시 연결") : (en ? "Add Event" : "이벤트 추가")}
                    </MemberButton>
                  </div>
                  {selectedEvent ? (
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <span className="gov-label">{en ? "Event Name" : "이벤트명"}</span>
                        <select className="gov-select" value={selectedEvent.eventName} onChange={(event) => updateSelectedEvent("eventName", event.target.value)}>
                          <option value="onClick">onClick</option>
                          <option value="onChange">onChange</option>
                          <option value="onSubmit">onSubmit</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="gov-label">{en ? "Action Type" : "액션 타입"}</span>
                        <select className="gov-select" value={selectedEvent.actionType} onChange={(event) => updateSelectedEvent("actionType", event.target.value)}>
                          <option value="navigate">navigate</option>
                          <option value="open_modal">open_modal</option>
                          <option value="api_call">api_call</option>
                          <option value="set_state">set_state</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="gov-label">{en ? "Target / Config" : "대상 / 설정"}</span>
                        <input className="gov-input" value={String(selectedEvent.actionConfig?.target || "")} onChange={(event) => updateSelectedEventTarget(event.target.value)} />
                      </label>
                      {selectedEvent.actionType === "api_call" ? (
                        <>
                          <label className="block">
                            <span className="gov-label">{en ? "Linked API" : "연결 API"}</span>
                            <select className="gov-select" value={String(selectedEvent.actionConfig?.apiId || "")} onChange={(event) => updateSelectedEventApi(event.target.value)}>
                              <option value="">{en ? "Select API" : "API 선택"}</option>
                              {availableApis.map((api) => (
                                <option key={api.apiId} value={api.apiId}>
                                  {api.method} {api.endpoint}
                                </option>
                              ))}
                            </select>
                            <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                              {selectedEvent.actionConfig?.apiId
                                ? `${String(selectedEvent.actionConfig?.method || "")} ${String(selectedEvent.actionConfig?.endpoint || "")}`
                                : (commandHasApis
                                  ? (en ? "Use the current page API catalog from screen-command metadata." : "screen-command 메타데이터의 현재 페이지 API 목록을 사용합니다.")
                                  : (en ? "No screen-command API metadata linked yet." : "연결된 screen-command API 메타데이터가 아직 없습니다."))}
                            </p>
                          </label>
                          {selectedApi?.requestFields?.length ? (
                            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-4">
                              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Request Field Mapping" : "요청 필드 매핑"}</p>
                              <div className="mt-3 space-y-3">
                                {selectedApi.requestFields.map((field) => (
                                  <label className="block" key={`req-map-${field.fieldId}`}>
                                    <span className="gov-label">{field.fieldId} <span className="text-xs font-normal text-[var(--kr-gov-text-secondary)]">[{field.type}]</span></span>
                                    <input
                                      className="gov-input"
                                      placeholder={en ? "ex) form.companyName or state.selectedId" : "예) form.companyName 또는 state.selectedId"}
                                      value={String(((selectedEvent.actionConfig?.requestMappings as Record<string, string> | undefined) || {})[field.fieldId] || "")}
                                      onChange={(event) => updateSelectedEventRequestMapping(field.fieldId, event.target.value)}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {selectedApi?.responseFields?.length ? (
                            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-4">
                              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Response Field Binding" : "응답 필드 바인딩"}</p>
                              <div className="mt-3 space-y-3">
                                {selectedApi.responseFields.map((field) => (
                                  <label className="block" key={`res-map-${field.fieldId}`}>
                                    <span className="gov-label">{field.fieldId} <span className="text-xs font-normal text-[var(--kr-gov-text-secondary)]">[{field.type}]</span></span>
                                    <input
                                      className="gov-input"
                                      placeholder={en ? "ex) state.resultRows or form.companyName" : "예) state.resultRows 또는 form.companyName"}
                                      value={String(((selectedEvent.actionConfig?.responseMappings as Record<string, string> | undefined) || {})[field.fieldId] || "")}
                                      onChange={(event) => {
                                        const base = ensureSelectedEvent();
                                        if (!base) {
                                          return;
                                        }
                                        setEvents((current) => current.map((item) => item.eventBindingId === base.eventBindingId
                                          ? {
                                            ...item,
                                            actionConfig: {
                                              ...(item.actionConfig || {}),
                                              responseMappings: {
                                                ...((item.actionConfig?.responseMappings as Record<string, string> | undefined) || {}),
                                                [field.fieldId]: event.target.value
                                              }
                                            }
                                          }
                                          : item));
                                      }}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en ? "Connect a basic runtime action such as page navigation, modal open, API call, or local state update." : "페이지 이동, 모달 열기, API 호출, 로컬 상태 변경 같은 기본 런타임 액션을 연결할 수 있습니다."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a node from the canvas first." : "먼저 캔버스에서 노드를 선택하세요."}</p>
            )}
          </div>
        </article>

        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
          <GridToolbar
            actions={(
              <MemberButtonGroup>
                <MemberButton onClick={() => setPreviewMode("DRAFT")} size="xs" type="button" variant={previewMode === "DRAFT" ? "primary" : "secondary"}>
                  {en ? "Draft" : "초안"}
                </MemberButton>
                <MemberButton disabled={!publishedVersionId} onClick={() => setPreviewMode("PUBLISHED")} size="xs" type="button" variant={previewMode === "PUBLISHED" ? "primary" : "secondary"}>
                  {en ? "Published" : "발행본"}
                </MemberButton>
              </MemberButtonGroup>
            )}
            meta={`${menuUrl || "-"} / ${previewMode}`}
            title={en ? "Preview" : "미리보기"}
          />
          <div className="min-h-[680px] bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4">
            {previewMessage ? (
              <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                {previewMessage}
              </div>
            ) : null}
            {previewNodes.length ? renderScreenBuilderNodePreview(sortScreenBuilderNodes(previewNodes)[0], previewNodes, en) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No preview nodes yet." : "아직 미리볼 노드가 없습니다."}
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
