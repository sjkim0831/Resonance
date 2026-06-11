export interface BuilderComponent {
  componentId: string;
  componentNm: string;
  componentDc: string;
  componentType: string;
  categoryCd: string;
  iconNm: string;
  defaultProps: Record<string, unknown>;
  defaultClassNm: string;
  defaultStyle: Record<string, string>;
  dataAttrs: Record<string, string>;
  isContainer: boolean;
  isReusable: boolean;
  sortOrder: number;
  useAt: string;
}

export interface BuilderNode {
  nodeId: string;
  componentId: string;
  parentNodeId: string | null;
  componentType: string;
  slotName: string;
  sortOrder: number;
  props: Record<string, unknown>;
}

export interface BuilderEvent {
  eventBindingId: string;
  nodeId: string;
  eventName: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

export interface BuilderScreen {
  screenId: string;
  menuCode: string;
  pageId: string;
  menuNm: string;
  menuUrl: string;
  templateType: string;
  nodes: BuilderNode[];
  events: BuilderEvent[];
  themeId: string;
  customClasses: string;
  customStyles: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderTheme {
  themeId: string;
  themeName: string;
  description: string;
  themeType: string;
  isDefault: boolean;
  tokens?: Record<string, ThemeToken>;
}

export interface ThemeToken {
  name: string;
  value: string;
  type: 'color' | 'spacing' | 'typography' | 'shadow' | 'border';
}

export interface DragItem {
  type: 'COMPONENT' | 'NODE';
  component?: BuilderComponent;
  node?: BuilderNode;
  index?: number;
}

export interface DropResult {
  nodeId: string;
  parentNodeId: string | null;
  slotName: string;
  sortOrder: number;
}

export const COMPONENT_TYPES = {
  BUTTON: 'BUTTON',
  CARD: 'CARD',
  INPUT: 'INPUT',
  TABLE: 'TABLE',
  FORM: 'FORM',
  SECTION: 'SECTION',
  LAYOUT: 'LAYOUT',
  CHART: 'CHART',
  MEDIA: 'MEDIA',
  OTHER: 'OTHER',
} as const;

export const CATEGORIES = {
  LAYOUT: 'LAYOUT',
  FORM: 'FORM',
  DISPLAY: 'DISPLAY',
  DATA: 'DATA',
  NAVIGATION: 'NAVIGATION',
  FEEDBACK: 'FEEDBACK',
} as const;

export const COMPONENT_TYPE_LABELS: Record<string, { ko: string; en: string }> = {
  BUTTON: { ko: '버튼', en: 'Button' },
  CARD: { ko: '카드', en: 'Card' },
  INPUT: { ko: '입력', en: 'Input' },
  TABLE: { ko: '테이블', en: 'Table' },
  FORM: { ko: '폼', en: 'Form' },
  SECTION: { ko: '섹션', en: 'Section' },
  LAYOUT: { ko: '레이아웃', en: 'Layout' },
  CHART: { ko: '차트', en: 'Chart' },
  MEDIA: { ko: '미디어', en: 'Media' },
  OTHER: { ko: '기타', en: 'Other' },
};

export const CATEGORY_LABELS: Record<string, { ko: string; en: string }> = {
  LAYOUT: { ko: '레이아웃', en: 'Layout' },
  FORM: { ko: '입력', en: 'Form' },
  DISPLAY: { ko: '표시', en: 'Display' },
  DATA: { ko: '데이터', en: 'Data' },
  NAVIGATION: { ko: '내비게이션', en: 'Navigation' },
  FEEDBACK: { ko: '피드백', en: 'Feedback' },
};