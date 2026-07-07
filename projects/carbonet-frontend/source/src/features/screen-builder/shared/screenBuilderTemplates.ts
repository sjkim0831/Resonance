import type { ScreenBuilderEventBinding, ScreenBuilderNode, ScreenBuilderPaletteItem } from "../../../lib/api/platformTypes";
import { sortScreenBuilderNodes } from "./screenBuilderUtils";

export type AiNodeTreeInputRow = {
  componentId: string;
  alias: string;
  parentAlias: string;
  propsJson: string;
};

export type BuilderTemplateType = "EDIT_PAGE" | "LIST_PAGE" | "DETAIL_PAGE" | "REVIEW_PAGE";

type TemplateOption = {
  value: BuilderTemplateType;
  label: string;
  labelEn: string;
  description: string;
};

const TEMPLATE_SLOT_RULES: Record<BuilderTemplateType, Record<string, string[]>> = {
  LIST_PAGE: {
    section: ["search_filters", "grid_toolbar", "content"],
    heading: ["search_filters", "grid_toolbar", "content"],
    text: ["grid_toolbar", "content"],
    input: ["search_filters", "content"],
    textarea: ["search_filters", "content"],
    select: ["search_filters", "content"],
    checkbox: ["search_filters", "content"],
    button: ["header_actions", "grid_toolbar_left", "grid_toolbar_right", "row_actions", "bottom_left_actions", "bottom_right_actions"],
    table: ["content"],
    pagination: ["pagination"]
  },
  DETAIL_PAGE: {
    section: ["summary", "content"],
    heading: ["summary", "content"],
    text: ["summary", "content"],
    input: ["content"],
    textarea: ["content"],
    select: ["content"],
    checkbox: ["content"],
    button: ["header_actions", "top_actions", "bottom_left_actions", "bottom_right_actions"],
    table: ["content"],
    pagination: ["bottom_right_actions"]
  },
  EDIT_PAGE: {
    section: ["summary", "content"],
    heading: ["summary", "content"],
    text: ["summary", "content"],
    input: ["content"],
    textarea: ["content"],
    select: ["content"],
    checkbox: ["content"],
    button: ["header_actions", "top_actions", "bottom_left_actions", "bottom_right_actions"],
    table: ["content"],
    pagination: ["bottom_right_actions"]
  },
  REVIEW_PAGE: {
    section: ["review_summary", "content"],
    heading: ["review_summary", "content"],
    text: ["review_summary", "content"],
    input: ["content"],
    textarea: ["content"],
    select: ["content"],
    checkbox: ["content"],
    button: ["header_actions", "review_actions", "bottom_left_actions", "bottom_right_actions"],
    table: ["content"],
    pagination: ["bottom_right_actions"]
  }
};

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { value: "LIST_PAGE", label: "목록형", labelEn: "List", description: "검색, 그리드, 페이지네이션, 행 액션 중심" },
  { value: "DETAIL_PAGE", label: "상세형", labelEn: "Detail", description: "요약, 상세 섹션, 상단/하단 이동 액션 중심" },
  { value: "EDIT_PAGE", label: "수정형", labelEn: "Edit", description: "입력 폼, 저장, 하단 액션바 중심" },
  { value: "REVIEW_PAGE", label: "검토형", labelEn: "Review", description: "검토 요약, 승인/반려, 하단 결정 액션 중심" }
];

export function blankPropsFor(type: string): Record<string, unknown> {
  switch (type) {
    case "section":
      return { title: "새 섹션" };
    case "heading":
      return { text: "제목" };
    case "text":
      return { text: "설명 문구" };
    case "input":
      return { label: "입력 필드", placeholder: "값 입력", required: false };
    case "textarea":
      return { label: "긴 입력", placeholder: "상세 내용을 입력하세요.", required: false };
    case "select":
      return { label: "선택", placeholder: "옵션 선택", required: false };
    case "checkbox":
      return { label: "동의 항목", required: false };
    case "button":
      return { label: "버튼", variant: "primary" };
    case "table":
      return { title: "목록 테이블", columns: "번호|이름|상태", emptyText: "조회된 데이터가 없습니다." };
    case "pagination":
      return { summary: "1 / 1 페이지" };
    default:
      return {};
  }
}

export function collectDescendantIds(nodes: ScreenBuilderNode[], nodeId: string): string[] {
  const children = nodes.filter((node) => (node.parentNodeId || "") === nodeId);
  return children.reduce<string[]>((acc, child) => {
    acc.push(child.nodeId);
    acc.push(...collectDescendantIds(nodes, child.nodeId));
    return acc;
  }, []);
}

export function buildNodeTreeRows(nodes: ScreenBuilderNode[], collapsedNodeIds: Set<string>, parentNodeId = "", depth = 0): Array<{ node: ScreenBuilderNode; depth: number; hasChildren: boolean }> {
  return sortScreenBuilderNodes(nodes.filter((node) => (node.parentNodeId || "") === parentNodeId)).reduce<Array<{ node: ScreenBuilderNode; depth: number; hasChildren: boolean }>>((acc, node) => {
    const hasChildren = nodes.some((item) => (item.parentNodeId || "") === node.nodeId);
    acc.push({ node, depth, hasChildren });
    if (collapsedNodeIds.has(node.nodeId)) {
      return acc;
    }
    acc.push(...buildNodeTreeRows(nodes, collapsedNodeIds, node.nodeId, depth + 1));
    return acc;
  }, []);
}

export function duplicateNodeTree(nodes: ScreenBuilderNode[], events: ScreenBuilderEventBinding[], sourceNodeId: string) {
  const timestamp = Date.now();
  const descendants = [sourceNodeId, ...collectDescendantIds(nodes, sourceNodeId)];
  const idMap = new Map<string, string>();
  descendants.forEach((nodeId, index) => {
    idMap.set(nodeId, `${nodeId}-copy-${timestamp}-${index}`);
  });
  const clonedNodes = sortScreenBuilderNodes(nodes)
    .filter((node) => descendants.includes(node.nodeId))
    .map((node, index) => ({
      ...node,
      nodeId: String(idMap.get(node.nodeId)),
      parentNodeId: node.parentNodeId && idMap.has(node.parentNodeId) ? String(idMap.get(node.parentNodeId)) : node.parentNodeId,
      sortOrder: nodes.length + index,
      props: { ...(node.props || {}) }
    }));
  const clonedEvents = events
    .filter((event) => idMap.has(event.nodeId))
    .map((event, index) => ({
      ...event,
      eventBindingId: `${event.eventBindingId}-copy-${timestamp}-${index}`,
      nodeId: String(idMap.get(event.nodeId)),
      actionConfig: { ...(event.actionConfig || {}) }
    }));
  return { clonedNodes, clonedEvents, topNodeId: String(idMap.get(sourceNodeId) || "") };
}

export function resolveTemplateSlots(templateType: BuilderTemplateType, componentType: string) {
  return TEMPLATE_SLOT_RULES[templateType]?.[componentType] || ["content"];
}

export function filterPaletteByTemplate(items: ScreenBuilderPaletteItem[], templateType: BuilderTemplateType) {
  return items.filter((item) => {
    if (templateType === "LIST_PAGE") {
      return true;
    }
    return item.componentType !== "table" && item.componentType !== "pagination";
  });
}

export function buildTemplatePresetNodes(templateType: BuilderTemplateType, pageTitle: string): ScreenBuilderNode[] {
  const rootTitle = pageTitle || "Builder Page";
  if (templateType === "LIST_PAGE") {
    return sortScreenBuilderNodes([
      { nodeId: "root", parentNodeId: "", componentId: "", componentType: "page", slotName: "root", sortOrder: 0, props: { title: rootTitle } },
      { nodeId: "search-section", parentNodeId: "root", componentId: "", componentType: "section", slotName: "search_filters", sortOrder: 1, props: { title: "검색 조건" } },
      { nodeId: "search-heading", parentNodeId: "search-section", componentId: "", componentType: "heading", slotName: "search_filters", sortOrder: 2, props: { text: "검색" } },
      { nodeId: "search-input", parentNodeId: "search-section", componentId: "", componentType: "input", slotName: "search_filters", sortOrder: 3, props: { label: "검색어", placeholder: "검색어 입력" } },
      { nodeId: "search-button", parentNodeId: "search-section", componentId: "", componentType: "button", slotName: "grid_toolbar_right", sortOrder: 4, props: { label: "검색", variant: "primary" } },
      { nodeId: "toolbar-note", parentNodeId: "root", componentId: "", componentType: "text", slotName: "grid_toolbar_left", sortOrder: 5, props: { text: "총 건수 및 공통 목록 액션" } },
      { nodeId: "result-table", parentNodeId: "root", componentId: "", componentType: "table", slotName: "content", sortOrder: 6, props: { title: "목록", columns: "번호|이름|상태|관리", emptyText: "조회된 데이터가 없습니다." } },
      { nodeId: "result-pagination", parentNodeId: "root", componentId: "", componentType: "pagination", slotName: "pagination", sortOrder: 7, props: { summary: "1 / 1 페이지" } }
    ]);
  }
  if (templateType === "DETAIL_PAGE") {
    return sortScreenBuilderNodes([
      { nodeId: "root", parentNodeId: "", componentId: "", componentType: "page", slotName: "root", sortOrder: 0, props: { title: rootTitle } },
      { nodeId: "summary", parentNodeId: "root", componentId: "", componentType: "section", slotName: "summary", sortOrder: 1, props: { title: "요약" } },
      { nodeId: "summary-text", parentNodeId: "summary", componentId: "", componentType: "text", slotName: "summary", sortOrder: 2, props: { text: "상세 요약 정보" } },
      { nodeId: "detail-section", parentNodeId: "root", componentId: "", componentType: "section", slotName: "content", sortOrder: 3, props: { title: "상세 정보" } },
      { nodeId: "detail-heading", parentNodeId: "detail-section", componentId: "", componentType: "heading", slotName: "content", sortOrder: 4, props: { text: "상세 정보" } },
      { nodeId: "detail-actions", parentNodeId: "root", componentId: "", componentType: "button", slotName: "bottom_left_actions", sortOrder: 5, props: { label: "목록", variant: "secondary" } }
    ]);
  }
  if (templateType === "REVIEW_PAGE") {
    return sortScreenBuilderNodes([
      { nodeId: "root", parentNodeId: "", componentId: "", componentType: "page", slotName: "root", sortOrder: 0, props: { title: rootTitle } },
      { nodeId: "review-summary", parentNodeId: "root", componentId: "", componentType: "section", slotName: "review_summary", sortOrder: 1, props: { title: "검토 요약" } },
      { nodeId: "review-text", parentNodeId: "review-summary", componentId: "", componentType: "text", slotName: "review_summary", sortOrder: 2, props: { text: "검토 대상과 영향 요약" } },
      { nodeId: "review-section", parentNodeId: "root", componentId: "", componentType: "section", slotName: "content", sortOrder: 3, props: { title: "검토 내용" } },
      { nodeId: "approve-button", parentNodeId: "root", componentId: "", componentType: "button", slotName: "bottom_right_actions", sortOrder: 4, props: { label: "승인", variant: "primary" } },
      { nodeId: "reject-button", parentNodeId: "root", componentId: "", componentType: "button", slotName: "bottom_left_actions", sortOrder: 5, props: { label: "반려", variant: "secondary" } }
    ]);
  }
  return sortScreenBuilderNodes([
    { nodeId: "root", parentNodeId: "", componentId: "", componentType: "page", slotName: "root", sortOrder: 0, props: { title: rootTitle } },
    { nodeId: "summary", parentNodeId: "root", componentId: "", componentType: "section", slotName: "summary", sortOrder: 1, props: { title: "요약" } },
    { nodeId: "content-section", parentNodeId: "root", componentId: "", componentType: "section", slotName: "content", sortOrder: 2, props: { title: "기본 정보" } },
    { nodeId: "content-heading", parentNodeId: "content-section", componentId: "", componentType: "heading", slotName: "content", sortOrder: 3, props: { text: "기본 정보" } },
    { nodeId: "content-input", parentNodeId: "content-section", componentId: "", componentType: "input", slotName: "content", sortOrder: 4, props: { label: "필드명", placeholder: "값 입력" } },
    { nodeId: "save-button", parentNodeId: "root", componentId: "", componentType: "button", slotName: "bottom_right_actions", sortOrder: 5, props: { label: "저장", variant: "primary" } },
    { nodeId: "list-button", parentNodeId: "root", componentId: "", componentType: "button", slotName: "bottom_left_actions", sortOrder: 6, props: { label: "목록", variant: "secondary" } }
  ]);
}

export function createAiNodeTreeInputRow(partial?: Partial<AiNodeTreeInputRow>): AiNodeTreeInputRow {
  return {
    componentId: partial?.componentId || "",
    alias: partial?.alias || "",
    parentAlias: partial?.parentAlias || "",
    propsJson: partial?.propsJson || "{}"
  };
}
