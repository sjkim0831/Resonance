import { useState, useEffect, useMemo, useRef } from 'react';
import type { BuilderComponent, BuilderScreen, BuilderNode } from './types/builder';
import * as api from './api/builderApi';
import { COMPONENT_TYPE_LABELS, CATEGORY_LABELS } from './types/builder';
import { addSrWorkbenchStackItem, quickExecuteSrTicket } from '../../lib/api/platform';
import { getTraceContext } from '../../platform/telemetry/traceContext';
import { findRouteOwnershipTraceByPath, listRouteOwnershipTraces, type RouteOwnershipTrace } from '../../app/routes/routeCatalog';
import { PAGE_COMPLETENESS_INVENTORY, type PageCompletenessInventoryRow } from './pageCompletenessInventory';
import { ROUTE_SOURCE_INVENTORY, type RouteSourceInventoryRow } from './routeSourceInventory';


type BuilderAgentId = 'HERMES' | 'KILO';
type BuilderWorkspaceTab = 'target-preview' | 'builder-canvas' | 'sections' | 'asset-registry' | 'full-stack-workbench' | 'page-quality' | 'environment-audit';

type BuilderTargetContext = {
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
};

type BuilderManagedAssetContext = {
  assetType: string;
  assetId: string;
  assetLabel: string;
  selector: string;
  sourcePath: string;
  focus: string;
};

type SavedBuilderSection = {
  id: string;
  name: string;
  sourcePageId: string;
  sourceMenuCode: string;
  node: BuilderNode;
  savedAt: string;
};

type FrontendCandidate = {
  id: string;
  title: string;
  source: 'original' | 'generated' | 'uploaded';
  summary: string;
  confidence: number;
  html: string;
  createdAt: string;
};

type CapturedPreviewElement = {
  selector: string;
  tagName: string;
  id: string;
  className: string;
  text: string;
  ariaLabel: string;
  role: string;
  dataPageId: string;
  dataComponentId: string;
  dataTestId: string;
  href: string;
  rect: { x: number; y: number; width: number; height: number };
};

const SECTION_STORAGE_KEY = 'carbonet:builder:saved-sections';
const FRONTEND_CANDIDATE_STORAGE_KEY = 'carbonet:builder:frontend-candidates';
const BUILDER_AGENT_OPTIONS: Array<{ id: BuilderAgentId; label: string; description: string; modelNote: string }> = [
  { id: 'HERMES', label: 'HERMES', description: '기존 Hermes 작업 흐름으로 화면 수정 요청을 전달합니다.', modelNote: '현재 로컬 모델 설정은 추후 비중국 모델로 교체 예정' },
  { id: 'KILO', label: 'KILO', description: 'Kilo 에이전트 작업 큐로 넘길 요청 형식을 생성합니다.', modelNote: '현재 모델 설정은 추후 Mixtral/Gemma 계열로 교체 예정' },
];

const ENVIRONMENT_BUILDER_SURFACES = [
  { id: 'screen-management', title: '화면 관리', route: '/admin/system/screen-management', status: '화면/라우트/메뉴 연결의 기준 데이터 확인' },
  { id: 'screen-flow-management', title: '화면 흐름 관리', route: '/admin/system/screen-flow-management', status: '프론트 이벤트와 API 흐름 추적' },
  { id: 'screen-menu-assignment-management', title: '화면-메뉴 귀속 관리', route: '/admin/system/screen-menu-assignment-management', status: '메뉴별 대상 화면 매핑' },
  { id: 'theme-management', title: '테마 관리', route: '/admin/system/theme-management', status: '토큰, 색상, 컴포넌트 스타일 등록' },
  { id: 'component-management', title: '컴포넌트 관리', route: '/admin/system/component-management', status: '재사용 컴포넌트 등록/수정' },
  { id: 'module', title: '모듈 관리', route: '/admin/system/module', status: '화면 기능 모듈 경계 관리' },
  { id: 'function-management', title: '기능 관리', route: '/admin/system/feature-management', status: '기능 단위 권한/동작 카탈로그' },
  { id: 'api-management', title: 'API 관리', route: '/admin/system/api-management', status: 'API 경로와 화면 이벤트 연결' },
  { id: 'controller-management', title: '컨트롤러 관리', route: '/admin/system/controller-management', status: 'Java 표준 구조 경로 기준화' },
  { id: 'column-management', title: '컬럼 관리', route: '/admin/system/column-management', status: '테이블 컬럼/입력 요소 연결' },
  { id: 'section-management', title: '섹션 관리', route: '/admin/system/section-management', status: '빌더 내 1차 섹션 보관함으로 제공' },
];

function readBuilderTargetContext(): BuilderTargetContext {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const menuUrl = params.get('menuUrl') || '';
  const pageId = params.get('pageId') || params.get('menuCode') || '';
  return {
    menuCode: params.get('menuCode') || '',
    pageId,
    menuTitle: params.get('menuTitle') || params.get('title') || pageId || '대상 화면',
    menuUrl: menuUrl || '/admin/system/menu',
  };
}

function readManagedAssetContext(): BuilderManagedAssetContext {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  return {
    assetType: params.get('assetType') || '',
    assetId: params.get('assetId') || '',
    assetLabel: params.get('assetLabel') || '',
    selector: params.get('selector') || '',
    sourcePath: params.get('sourcePath') || '',
    focus: params.get('focus') || '',
  };
}

function readInitialBuilderTab(): BuilderWorkspaceTab {
  if (typeof window === 'undefined') return 'target-preview';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab === 'sections' || window.location.pathname.endsWith('/section-management')) return 'sections';
  if (tab === 'builder-canvas') return 'builder-canvas';
  if (tab === 'asset-registry') return 'asset-registry';
  if (tab === 'full-stack-workbench') return 'full-stack-workbench';
  if (tab === 'page-quality') return 'page-quality';
  if (tab === 'environment-audit') return 'environment-audit';
  return 'target-preview';
}

function normalizePreviewUrl(menuUrl: string) {
  if (!menuUrl) return '/admin/system/menu';
  if (menuUrl.startsWith('http://') || menuUrl.startsWith('https://')) return menuUrl;
  return menuUrl.startsWith('/') ? menuUrl : `/${menuUrl}`;
}

function loadSavedSections(): SavedBuilderSection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedSections(sections: SavedBuilderSection[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
}

function defaultFrontendCandidates(target: BuilderTargetContext): FrontendCandidate[] {
  const now = new Date().toISOString();
  const title = target.menuTitle || target.pageId || '대상 화면';
  const path = target.menuUrl || '/admin/system/menu';
  return [
    {
      id: 'original-runtime',
      title: '현재 운영 원본',
      source: 'original',
      summary: '현재 라우트와 소스 추적 정보를 기준으로 운영 화면을 그대로 가져옵니다.',
      confidence: 96,
      html: `<main data-builder-template="original"><h1>${title}</h1><p>${path}</p></main>`,
      createdAt: now,
    },
    {
      id: 'generated-admin-density',
      title: '관리자 고밀도 목록형',
      source: 'generated',
      summary: '검색, 필터, 표, 상세 패널을 우선 배치하는 운영 관리자 화면 후보입니다.',
      confidence: 91,
      html: `<section data-builder-template="admin-density"><header><h1>${title}</h1></header><form><input placeholder="검색어" /><button>검색</button></form><table><thead><tr><th>항목</th><th>상태</th><th>관리</th></tr></thead><tbody><tr><td>Sample</td><td>READY</td><td>수정</td></tr></tbody></table></section>`,
      createdAt: now,
    },
    {
      id: 'generated-dashboard',
      title: '모니터링 대시보드형',
      source: 'generated',
      summary: '수치 카드, 상태 요약, 최근 이벤트를 한 화면에 보여주는 후보입니다.',
      confidence: 88,
      html: `<section data-builder-template="dashboard"><h1>${title}</h1><div><article>정상</article><article>주의</article><article>최근 변경</article></div></section>`,
      createdAt: now,
    },
    {
      id: 'generated-form-master-detail',
      title: '마스터-상세 편집형',
      source: 'generated',
      summary: '목록 선택 후 우측 상세 편집/저장으로 이어지는 화면 후보입니다.',
      confidence: 86,
      html: `<section data-builder-template="master-detail"><aside>목록</aside><main><h1>${title}</h1><label>이름<input /></label><label>경로<input value="${path}" /></label><button>저장</button></main></section>`,
      createdAt: now,
    },
    {
      id: 'generated-ai-assisted',
      title: 'AI 수정 최적화형',
      source: 'generated',
      summary: '모든 주요 영역에 selector와 data 속성을 부여해 AI가 정확히 수정하기 쉬운 후보입니다.',
      confidence: 84,
      html: `<section data-page-id="${target.pageId || 'page'}" data-builder-template="ai-assisted"><header data-surface-id="title"><h1>${title}</h1></header><div data-surface-id="content">AI 수정 대상 영역</div></section>`,
      createdAt: now,
    },
  ];
}

function loadFrontendCandidates(target: BuilderTargetContext): FrontendCandidate[] {
  if (typeof window === 'undefined') return defaultFrontendCandidates(target);
  try {
    const raw = window.localStorage.getItem(FRONTEND_CANDIDATE_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) as FrontendCandidate[] : [];
    const defaults = defaultFrontendCandidates(target);
    const savedIds = new Set(saved.map(item => item.id));
    return [...defaults.filter(item => !savedIds.has(item.id)), ...saved].slice(0, 20);
  } catch {
    return defaultFrontendCandidates(target);
  }
}

function persistFrontendCandidates(candidates: FrontendCandidate[]) {
  if (typeof window === 'undefined') return;
  const uploadedAndGenerated = candidates.filter(item => item.source === 'uploaded');
  window.localStorage.setItem(FRONTEND_CANDIDATE_STORAGE_KEY, JSON.stringify(uploadedAndGenerated.slice(0, 15)));
}

function buildDesignClassName(current: string, updates: Record<string, string>) {
  const blockedPrefixes = ['p-', 'px-', 'py-', 'gap-', 'rounded', 'text-[', 'w-', 'max-w-', 'shadow'];
  const preserved = current
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !blockedPrefixes.some(prefix => item === prefix || item.startsWith(prefix)));
  return [...preserved, ...Object.values(updates).filter(Boolean)].join(' ').trim();
}


type BuilderAssetRow = {
  id: string;
  group: string;
  title: string;
  status: 'ready' | 'needs-link' | 'managed' | 'generated';
  owner: string;
  path: string;
  detail: string;
  actionPath: string;
};

function statusLabel(status: BuilderAssetRow['status']) {
  if (status === 'ready') return '준비';
  if (status === 'managed') return '관리중';
  if (status === 'generated') return '생성';
  return '연결필요';
}


function pageCompletenessLabel(status: PageCompletenessInventoryRow['status']) {
  if (status === 'delegated') return '공통구현 위임';
  if (status === 'placeholder-managed') return '플레이스홀더 관리';
  if (status === 'thin') return '기능 보강 필요';
  return '구현됨';
}

function pageCompletenessClassName(status: PageCompletenessInventoryRow['status']) {
  if (status === 'delegated') return 'bg-blue-100 text-blue-700';
  if (status === 'placeholder-managed') return 'bg-amber-100 text-amber-700';
  if (status === 'thin') return 'bg-rose-100 text-rose-700';
  return 'bg-emerald-100 text-emerald-700';
}

function findTargetRouteTrace(menuUrl: string): RouteOwnershipTrace | null {
  return findRouteOwnershipTraceByPath(menuUrl) || findRouteOwnershipTraceByPath(normalizePreviewUrl(menuUrl));
}

function findTargetRouteSource(trace: RouteOwnershipTrace | null, menuUrl: string): RouteSourceInventoryRow | null {
  const normalizedUrl = normalizePreviewUrl(menuUrl);
  return ROUTE_SOURCE_INVENTORY.find((row) => row.routeId === trace?.routeId)
    || ROUTE_SOURCE_INVENTORY.find((row) => row.koPath === normalizedUrl || row.enPath === normalizedUrl)
    || null;
}

function buildBuilderAssetRows(params: {
  targetContext: BuilderTargetContext;
  managedAsset: BuilderManagedAssetContext;
  currentScreen: BuilderScreen | null;
  selectedNode: BuilderNode | null;
  components: BuilderComponent[];
  savedSections: SavedBuilderSection[];
  targetTrace: RouteOwnershipTrace | null;
  targetSource: RouteSourceInventoryRow | null;
}): BuilderAssetRow[] {
  const { targetContext, managedAsset, currentScreen, selectedNode, components, savedSections, targetTrace, targetSource } = params;
  const rows: BuilderAssetRow[] = [];
  const routeRows = listRouteOwnershipTraces();
  if (managedAsset.assetId || managedAsset.assetType) {
    rows.push({
      id: 'managed-target-asset',
      group: '관리 대상',
      title: managedAsset.assetLabel || managedAsset.assetId || '선택 자산',
      status: 'managed',
      owner: managedAsset.focus || managedAsset.assetType || 'platform-studio',
      path: managedAsset.sourcePath || managedAsset.selector || targetContext.menuUrl || '-',
      detail: `type=${managedAsset.assetType || '-'} id=${managedAsset.assetId || '-'} selector=${managedAsset.selector || '-'}`,
      actionPath: `/admin/system/builder-studio?menuCode=${encodeURIComponent(targetContext.menuCode)}&pageId=${encodeURIComponent(targetContext.pageId)}&menuTitle=${encodeURIComponent(targetContext.menuTitle)}&menuUrl=${encodeURIComponent(targetContext.menuUrl)}&assetType=${encodeURIComponent(managedAsset.assetType)}&assetId=${encodeURIComponent(managedAsset.assetId)}&assetLabel=${encodeURIComponent(managedAsset.assetLabel)}&selector=${encodeURIComponent(managedAsset.selector)}&sourcePath=${encodeURIComponent(managedAsset.sourcePath)}&focus=${encodeURIComponent(managedAsset.focus)}&tab=asset-registry`,
    });
  }
  rows.push({
    id: 'target-route',
    group: '화면/라우트',
    title: targetContext.menuTitle || currentScreen?.menuNm || '대상 화면',
    status: targetTrace ? 'managed' : 'needs-link',
    owner: targetTrace?.familyId || 'admin-system',
    path: targetContext.menuUrl || currentScreen?.menuUrl || '-',
    detail: `menuCode=${targetContext.menuCode || currentScreen?.menuCode || '-'} pageId=${targetContext.pageId || currentScreen?.pageId || '-'}`,
    actionPath: `/admin/system/screen-management?searchKeyword=${encodeURIComponent(targetContext.menuTitle || targetContext.pageId || '')}`,
  });
  rows.push({
    id: 'source-route-family',
    group: '프론트 소스',
    title: targetTrace ? `${targetTrace.routeId} 라우트 패밀리` : '소스 후보 미확정',
    status: targetTrace ? 'ready' : 'needs-link',
    owner: targetSource?.exportName || targetTrace?.assemblyOwnerPath || 'frontend route registry',
    path: targetSource?.sourcePath || targetTrace?.packagingOwnerPath || 'projects/carbonet-frontend/source/src',
    detail: targetSource ? `${targetSource.routeId} / ${targetSource.routeFamilyFile} / effective=${targetSource.effectiveSourcePath}` : targetTrace ? `${targetTrace.ownershipLane} / ${targetTrace.pageFamily}` : '화면 관리에서 route/pageId/menuCode를 먼저 연결하세요.',
    actionPath: '/admin/system/page-management',
  });
  if (targetSource) {
    rows.push({
      id: 'target-source-file',
      group: '프론트 소스',
      title: '수정 대상 소스 파일',
      status: 'ready',
      owner: targetSource.effectiveExportName || targetSource.exportName,
      path: targetSource.effectiveSourcePath || targetSource.sourcePath,
      detail: `route=${targetSource.sourcePath} / family=${targetSource.routeFamilyFile}`,
      actionPath: `/admin/system/builder-studio?menuCode=${encodeURIComponent(targetContext.menuCode || targetSource.routeId)}&pageId=${encodeURIComponent(targetContext.pageId || targetSource.routeId)}&menuTitle=${encodeURIComponent(targetContext.menuTitle || targetSource.label)}&menuUrl=${encodeURIComponent(targetContext.menuUrl || targetSource.koPath)}`,
    });
  }
  rows.push({
    id: 'builder-component-catalog',
    group: '컴포넌트',
    title: '빌더 컴포넌트 카탈로그',
    status: components.length ? 'managed' : 'needs-link',
    owner: 'builder-studio/component-management',
    path: '/admin/system/component-management',
    detail: `${components.length}개 컴포넌트 로드됨${selectedNode ? ` / 선택=${selectedNode.componentType}` : ''}`,
    actionPath: '/admin/system/component-management',
  });
  rows.push({
    id: 'theme-token-registry',
    group: '디자인',
    title: '테마 토큰/컴포넌트 스타일',
    status: 'managed',
    owner: 'theme-management',
    path: '/admin/system/theme-management',
    detail: '색상, 여백, 반경, 그림자, 컴포넌트 스타일의 기준 데이터',
    actionPath: '/admin/system/theme-management',
  });
  rows.push({
    id: 'section-library',
    group: '섹션',
    title: '섹션 보관함',
    status: savedSections.length ? 'managed' : 'generated',
    owner: 'builder-studio/section-management',
    path: '/admin/system/section-management',
    detail: `${savedSections.length}개 섹션 보관됨. 검색/목록/상세/승인 패널을 표준 블록으로 재사용`,
    actionPath: '/admin/system/section-management',
  });
  [
    ['surface-registry', '화면 요소', '/admin/system/screen-elements-management', 'DOM surface, selector, componentId, layoutZone'],
    ['event-registry', '이벤트', '/admin/system/event-management', 'click/change/submit 이벤트와 프론트 함수 연결'],
    ['function-registry', '함수', '/admin/system/function-console', '프론트 함수, 파라미터, 결과 스펙'],
    ['api-registry', 'API', '/admin/system/api-management', 'endpoint, method, request/response, controller action'],
    ['controller-registry', '컨트롤러', '/admin/system/controller-management', 'Java controller/service/mapper 경로'],
    ['column-registry', '컬럼/DB', '/admin/system/column-management', 'table, column, field binding'],
    ['ai-agent-registry', 'AI 에이전트', '/admin/system/ai-developer-team', 'HERMES/KILO 작업 요청 대상과 모델 정책'],
  ].forEach(([id, title, path, detail]) => rows.push({
    id,
    group: '동작/데이터',
    title,
    status: 'managed',
    owner: 'platform-studio',
    path,
    detail,
    actionPath: path,
  }));
  rows.push({
    id: 'route-inventory',
    group: '전체 페이지',
    title: '프로젝트 전체 라우트 인벤토리',
    status: 'ready',
    owner: 'routeCatalog',
    path: 'app/routes/families/allRouteFamilies',
    detail: `${routeRows.length}개 라우트가 소유권/배포/검증 메타데이터와 연결됨`,
    actionPath: '/admin/system/screen-management',
  });
  return rows;
}

export function BuilderStudioPage() {
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [screens, setScreens] = useState<BuilderScreen[]>([]);
  const [currentScreen, setCurrentScreen] = useState<BuilderScreen | null>(null);
  const [selectedNode, setSelectedNode] = useState<BuilderNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [targetContext, setTargetContext] = useState<BuilderTargetContext>(() => readBuilderTargetContext());
  const [managedAssetContext, setManagedAssetContext] = useState<BuilderManagedAssetContext>(() => readManagedAssetContext());
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<BuilderWorkspaceTab>(() => readInitialBuilderTab());
  const [selectedAgent, setSelectedAgent] = useState<BuilderAgentId>('HERMES');
  const [contextCaptureEnabled, setContextCaptureEnabled] = useState(true);
  const [previewContextRequest, setPreviewContextRequest] = useState<{ x: number; y: number; selector: string; note: string; element?: CapturedPreviewElement } | null>(null);
  const [designDraft, setDesignDraft] = useState({ padding: '16', radius: '8', gap: '12', width: '100', fontSize: '14', shadow: 'sm' });
  const [savedSections, setSavedSections] = useState<SavedBuilderSection[]>(() => loadSavedSections());
  const [frontendCandidates, setFrontendCandidates] = useState<FrontendCandidate[]>(() => loadFrontendCandidates(readBuilderTargetContext()));
  const [selectedFrontendCandidateId, setSelectedFrontendCandidateId] = useState('original-runtime');
  const [fullStackMode, setFullStackMode] = useState<'frontend-only' | 'metadata-api' | 'java-core' | 'db-migration'>('frontend-only');
  const [changedFileDraft, setChangedFileDraft] = useState('');
  const [rollbackPoints, setRollbackPoints] = useState<Array<{ id: string; label: string; candidateId: string; createdAt: string }>>([]);
  const [workbenchStatus, setWorkbenchStatus] = useState<api.FullStackBuilderStatus | null>(null);
  const [workbenchResult, setWorkbenchResult] = useState<Record<string, unknown> | null>(null);
  const [isWorkbenchBusy, setIsWorkbenchBusy] = useState(false);
  const [builderToast, setBuilderToast] = useState('');
  const [pageQualityFilter, setPageQualityFilter] = useState<PageCompletenessInventoryRow['status'] | 'all'>('all');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    function syncTargetContext() {
      const nextTarget = readBuilderTargetContext();
      setTargetContext(nextTarget);
      setManagedAssetContext(readManagedAssetContext());
      setFrontendCandidates(loadFrontendCandidates(nextTarget));
    }
    window.addEventListener('popstate', syncTargetContext);
    window.addEventListener('carbonet:navigation', syncTargetContext);
    return () => {
      window.removeEventListener('popstate', syncTargetContext);
      window.removeEventListener('carbonet:navigation', syncTargetContext);
    };
  }, []);

  async function loadInitialData() {
    try {
      setIsLoading(true);
      const [componentsRes, screensRes] = await Promise.all([
        api.getComponents({ activeOnly: true }),
        api.getScreens(),
      ]);
      setComponents(componentsRes.components);
      setScreens(screensRes.screens);
      if (screensRes.screens.length > 0) {
        setCurrentScreen(screensRes.screens[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!currentScreen) return;
    try {
      setIsSaving(true);
      await api.updateScreen(currentScreen.screenId, currentScreen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!currentScreen) return;
    try {
      const result = await api.publishScreen(currentScreen.screenId);
      setCurrentScreen(result.screen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    }
  }

  function handleDragStart(e: React.DragEvent, component: BuilderComponent) {
    e.dataTransfer.setData('component', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent, parentNodeId: string | null, slotName: string) {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('component');
    if (!componentData || !currentScreen) return;

    const component: BuilderComponent = JSON.parse(componentData);
    const newNode: BuilderNode = {
      nodeId: `node-${Date.now()}`,
      componentId: component.componentId,
      parentNodeId,
      componentType: component.componentType,
      slotName,
      sortOrder: currentScreen.nodes.filter(n => n.parentNodeId === parentNodeId && n.slotName === slotName).length,
      props: {
        ...component.defaultProps,
        className: component.defaultClassNm,
        label: component.componentNm,
      },
    };

    const updatedScreen = {
      ...currentScreen,
      nodes: [...currentScreen.nodes, newNode],
    };
    setCurrentScreen(updatedScreen);
  }

  function handleNodeClick(node: BuilderNode) {
    setSelectedNode(node);
  }

  function handleNodeDelete(nodeId: string) {
    if (!currentScreen) return;
    const updatedScreen = {
      ...currentScreen,
      nodes: currentScreen.nodes.filter(n => n.nodeId !== nodeId),
    };
    setCurrentScreen(updatedScreen);
    if (selectedNode?.nodeId === nodeId) {
      setSelectedNode(null);
    }
  }

  function handleUpdateNodeProps(nodeId: string, props: Record<string, unknown>) {
    if (!currentScreen) return;
    const updatedScreen = {
      ...currentScreen,
      nodes: currentScreen.nodes.map(n =>
        n.nodeId === nodeId ? { ...n, props: { ...n.props, ...props } } : n
      ),
    };
    setCurrentScreen(updatedScreen);
    if (selectedNode?.nodeId === nodeId) {
      setSelectedNode({ ...selectedNode, props: { ...selectedNode.props, ...props } });
    }
  }

  const previewUrl = useMemo(() => normalizePreviewUrl(targetContext.menuUrl), [targetContext.menuUrl]);
  const targetRouteTrace = useMemo(() => findTargetRouteTrace(targetContext.menuUrl), [targetContext.menuUrl]);
  const targetRouteSource = useMemo(() => findTargetRouteSource(targetRouteTrace, targetContext.menuUrl), [targetRouteTrace, targetContext.menuUrl]);
  const assetRows = useMemo(() => buildBuilderAssetRows({ targetContext, managedAsset: managedAssetContext, currentScreen, selectedNode, components, savedSections, targetTrace: targetRouteTrace, targetSource: targetRouteSource }), [targetContext, managedAssetContext, currentScreen, selectedNode, components, savedSections, targetRouteTrace, targetRouteSource]);
  const pageQualityRows = useMemo(() => PAGE_COMPLETENESS_INVENTORY.filter(row => pageQualityFilter === 'all' || row.status === pageQualityFilter), [pageQualityFilter]);
  const pageQualitySummary = useMemo(() => ({
    total: PAGE_COMPLETENESS_INVENTORY.length,
    delegated: PAGE_COMPLETENESS_INVENTORY.filter(row => row.status === 'delegated').length,
    placeholder: PAGE_COMPLETENESS_INVENTORY.filter(row => row.status === 'placeholder-managed').length,
    thin: PAGE_COMPLETENESS_INVENTORY.filter(row => row.status === 'thin').length,
  }), []);

  function buildPreviewInspectorScript() {
    return `
      (function () {
        if (window.__carbonetBuilderInspectorInstalled) return;
        window.__carbonetBuilderInspectorInstalled = true;
        var style = document.createElement('style');
        style.setAttribute('data-carbonet-builder-inspector', 'true');
        style.textContent = '[data-carbonet-builder-hover="true"]{outline:2px solid #2563eb !important;outline-offset:2px !important;cursor:crosshair !important;}';
        document.head.appendChild(style);
        var hovered = null;
        function esc(value) {
          if (!value) return '';
          if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
          return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        }
        function selectorOf(el) {
          if (!el || el.nodeType !== 1) return 'document';
          if (el.id) return '#' + esc(el.id);
          var dataKeys = ['pageId', 'componentId', 'testid', 'menuCode', 'surfaceId'];
          for (var i = 0; i < dataKeys.length; i += 1) {
            var key = dataKeys[i];
            var value = el.dataset ? el.dataset[key] : '';
            if (value) return el.tagName.toLowerCase() + '[data-' + key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + '="' + String(value).replace(/"/g, '\\"') + '"]';
          }
          var parts = [];
          var current = el;
          while (current && current.nodeType === 1 && current !== document.body && parts.length < 5) {
            var part = current.tagName.toLowerCase();
            if (current.classList && current.classList.length) {
              part += '.' + Array.prototype.slice.call(current.classList).slice(0, 2).map(esc).join('.');
            }
            var parent = current.parentElement;
            if (parent) {
              var siblings = Array.prototype.filter.call(parent.children, function (child) { return child.tagName === current.tagName; });
              if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
            }
            parts.unshift(part);
            current = parent;
          }
          return parts.join(' > ') || el.tagName.toLowerCase();
        }
        function payloadFromEvent(event) {
          var el = event.target && event.target.nodeType === 1 ? event.target : (event.target && event.target.parentElement);
          if (!el) return null;
          var rect = el.getBoundingClientRect();
          return {
            type: 'carbonet:builder-preview-context',
            selector: selectorOf(el),
            tagName: el.tagName.toLowerCase(),
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className : '',
            text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || '',
            dataPageId: el.getAttribute('data-page-id') || '',
            dataComponentId: el.getAttribute('data-component-id') || '',
            dataTestId: el.getAttribute('data-testid') || '',
            href: el.getAttribute('href') || '',
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            clientX: Math.round(event.clientX),
            clientY: Math.round(event.clientY)
          };
        }
        document.addEventListener('mouseover', function (event) {
          if (hovered) hovered.removeAttribute('data-carbonet-builder-hover');
          hovered = event.target && event.target.nodeType === 1 ? event.target : null;
          if (hovered) hovered.setAttribute('data-carbonet-builder-hover', 'true');
        }, true);
        document.addEventListener('mouseout', function () {
          if (hovered) hovered.removeAttribute('data-carbonet-builder-hover');
          hovered = null;
        }, true);
        document.addEventListener('contextmenu', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var payload = payloadFromEvent(event);
          if (payload) window.parent.postMessage(payload, window.location.origin);
        }, true);
      })();
    `;
  }

  function attachPreviewInspector() {
    if (!contextCaptureEnabled) return;
    const frame = previewFrameRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc?.documentElement) return;
      const script = doc.createElement('script');
      script.textContent = buildPreviewInspectorScript();
      doc.documentElement.appendChild(script);
      script.remove();
      showToast('미리보기 화면 요소 캡처를 연결했습니다. 대상 요소를 우클릭하세요.');
    } catch {
      showToast('미리보기 DOM 접근이 제한되어 좌표 기반 캡처로 동작합니다.');
    }
  }

  useEffect(() => {
    function handlePreviewMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; clientX?: number; clientY?: number } & CapturedPreviewElement;
      if (data?.type !== 'carbonet:builder-preview-context') return;
      const frame = previewFrameRef.current;
      const frameRect = frame?.getBoundingClientRect();
      const x = Math.max(12, Math.round((frameRect?.left || 0) + (data.clientX || data.rect?.x || 0) - (frameRect?.left || 0)));
      const y = Math.max(12, Math.round((frameRect?.top || 0) + (data.clientY || data.rect?.y || 0) - (frameRect?.top || 0)));
      setPreviewContextRequest({
        x,
        y,
        selector: data.selector || `preview:${targetContext.pageId || targetContext.menuCode || 'unknown'}`,
        note: '',
        element: {
          selector: data.selector || '',
          tagName: data.tagName || '',
          id: data.id || '',
          className: data.className || '',
          text: data.text || '',
          ariaLabel: data.ariaLabel || '',
          role: data.role || '',
          dataPageId: data.dataPageId || '',
          dataComponentId: data.dataComponentId || '',
          dataTestId: data.dataTestId || '',
          href: data.href || '',
          rect: data.rect || { x: 0, y: 0, width: 0, height: 0 },
        },
      });
    }
    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [targetContext.menuCode, targetContext.pageId]);

  function showToast(message: string) {
    setBuilderToast(message);
    window.setTimeout(() => setBuilderToast(''), 3500);
  }

  const selectedFrontendCandidate = frontendCandidates.find(item => item.id === selectedFrontendCandidateId) || frontendCandidates[0];

  function handleFrontendCandidateUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result || '');
      const candidate: FrontendCandidate = {
        id: `uploaded-${Date.now()}`,
        title: file.name.replace(/\.html?$/i, '') || '업로드 HTML',
        source: 'uploaded',
        summary: '업로드한 HTML을 AI가 현재 프레임워크 구조에 맞춰 React/메타데이터 자산으로 변환합니다.',
        confidence: 80,
        html,
        createdAt: new Date().toISOString(),
      };
      const next = [candidate, ...frontendCandidates].slice(0, 20);
      setFrontendCandidates(next);
      persistFrontendCandidates(next);
      setSelectedFrontendCandidateId(candidate.id);
      showToast('HTML 후보를 업로드하고 선택했습니다.');
    };
    reader.readAsText(file);
  }

  function createRollbackPoint(label: string) {
    const point = {
      id: `rollback-${Date.now()}`,
      label,
      candidateId: selectedFrontendCandidate?.id || 'original-runtime',
      createdAt: new Date().toISOString(),
    };
    setRollbackPoints([point, ...rollbackPoints].slice(0, 12));
    showToast('롤백 지점을 만들었습니다.');
  }

  function buildFullStackWorkbenchPayload(): api.FullStackBuilderPlanRequest {
    return {
      mode: fullStackMode,
      target: {
        menuCode: targetContext.menuCode,
        pageId: targetContext.pageId,
        menuTitle: targetContext.menuTitle,
        menuUrl: targetContext.menuUrl,
        routeSource: targetRouteSource?.effectiveSourcePath || targetRouteSource?.sourcePath || '',
      },
      frontendCandidate: selectedFrontendCandidate ? {
        id: selectedFrontendCandidate.id,
        title: selectedFrontendCandidate.title,
        source: selectedFrontendCandidate.source,
        summary: selectedFrontendCandidate.summary,
        html: selectedFrontendCandidate.html,
      } : {},
      changedFiles: changedFileDraft.split('\n').map(item => item.trim()).filter(Boolean),
    };
  }

  async function refreshWorkbenchStatus() {
    setIsWorkbenchBusy(true);
    try {
      const status = await api.getFullStackBuilderStatus();
      setWorkbenchStatus(status);
      setWorkbenchResult(status as unknown as Record<string, unknown>);
      showToast('전체 개발 워크벤치 상태를 조회했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '워크벤치 상태 조회에 실패했습니다.');
    } finally {
      setIsWorkbenchBusy(false);
    }
  }

  async function createWorkbenchPlan() {
    setIsWorkbenchBusy(true);
    try {
      const result = await api.createFullStackBuilderPlan(buildFullStackWorkbenchPayload());
      setWorkbenchResult(result);
      showToast('변경 파일 기준 컴파일/검증 계획을 생성했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '워크벤치 계획 생성에 실패했습니다.');
    } finally {
      setIsWorkbenchBusy(false);
    }
  }

  async function createWorkbenchSnapshot() {
    setIsWorkbenchBusy(true);
    try {
      const result = await api.createFullStackBuilderSnapshot(buildFullStackWorkbenchPayload());
      setWorkbenchResult(result);
      createRollbackPoint(String(result.snapshotId || `${targetContext.menuTitle || '화면'} 스냅샷`));
      showToast('백엔드 스냅샷을 생성했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '워크벤치 스냅샷 생성에 실패했습니다.');
    } finally {
      setIsWorkbenchBusy(false);
    }
  }

  function requestFullStackChange(executeNow: boolean) {
    const compilePlan = fullStackMode === 'frontend-only'
      ? 'frontend overlay sync + selected React chunk rebuild; Java build not required'
      : fullStackMode === 'metadata-api'
        ? 'metadata/API contract update first; changed frontend files only; Java avoided unless controller signature changes'
        : fullStackMode === 'java-core'
          ? 'project-core changed Java files incremental compile, test targeted classes, rolling restart only when class reload cannot apply'
          : 'DB migration dry-run, transactional DDL/DML guard, backup/rollback SQL required';
    const changedFiles = changedFileDraft.split('\n').map(item => item.trim()).filter(Boolean);
    setAiPrompt([
      `빌더 전체 개발 요청을 수행해줘.`,
      `mode=${fullStackMode}`,
      `compilePlan=${compilePlan}`,
      `menuTitle=${targetContext.menuTitle}`,
      `menuUrl=${targetContext.menuUrl}`,
      `routeSource=${targetRouteSource?.effectiveSourcePath || targetRouteSource?.sourcePath || '-'}`,
      `frontendCandidate=${selectedFrontendCandidate ? JSON.stringify({ id: selectedFrontendCandidate.id, title: selectedFrontendCandidate.title, source: selectedFrontendCandidate.source, summary: selectedFrontendCandidate.summary, html: selectedFrontendCandidate.html.slice(0, 5000) }) : '-'}`,
      `changedFiles=${changedFiles.length ? changedFiles.join(', ') : 'auto-detect changed files only'}`,
      `rollbackPolicy=before applying, create git diff snapshot and runtime rollback point; after applying, verify page and allow candidate rollback`,
      `requirements=front/back/db asset registry must be updated; only changed files should be compiled or rebuilt where possible`,
    ].join('\n'));
    setShowAiPanel(true);
    if (executeNow) {
      window.setTimeout(() => { void submitBuilderAgentRequest(true); }, 0);
    }
  }

  function handlePreviewContextMenu(e: React.MouseEvent<HTMLElement>) {
    if (!contextCaptureEnabled) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setPreviewContextRequest({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
      selector: `preview:${targetContext.pageId || targetContext.menuCode || 'unknown'}@${Math.round(e.clientX - rect.left)},${Math.round(e.clientY - rect.top)}`,
      note: '',
    });
  }

  async function submitBuilderAgentRequest(executeNow: boolean) {
    const instruction = (previewContextRequest?.note || aiPrompt || '').trim();
    if (!instruction) {
      showToast('수정 요청 내용을 먼저 입력하세요.');
      return;
    }
    const agent = BUILDER_AGENT_OPTIONS.find(item => item.id === selectedAgent) || BUILDER_AGENT_OPTIONS[0];
    const summary = `${agent.id} 화면 수정 요청 - ${targetContext.menuTitle || currentScreen?.menuNm || '빌더 화면'}`;
    const technicalContext = [
      `[builderTarget]`,
      `agent=${agent.id}`,
      `modelPolicy=${agent.modelNote}`,
      `menuCode=${targetContext.menuCode || currentScreen?.menuCode || ''}`,
      `pageId=${targetContext.pageId || currentScreen?.pageId || ''}`,
      `menuTitle=${targetContext.menuTitle || currentScreen?.menuNm || ''}`,
      `menuUrl=${targetContext.menuUrl || currentScreen?.menuUrl || ''}`,
      `previewSelector=${previewContextRequest?.selector || '-'}`,
      `previewElement=${previewContextRequest?.element ? JSON.stringify(previewContextRequest.element) : '-'}`,
      `managedAsset=${JSON.stringify(managedAssetContext)}`,
      `sourceRouteCandidates=frontend route ${targetContext.menuUrl || currentScreen?.menuUrl || ''}; pageId ${targetContext.pageId || currentScreen?.pageId || ''}; menuCode ${targetContext.menuCode || currentScreen?.menuCode || ''}`,
      `assetRegistry=${JSON.stringify(assetRows.map(row => ({ id: row.id, group: row.group, path: row.path, status: row.status })))}`,
      `pageCompleteness=${JSON.stringify({ total: pageQualitySummary.total, thin: pageQualitySummary.thin, placeholder: pageQualitySummary.placeholder, delegated: pageQualitySummary.delegated })}`,
      `routeTrace=${targetRouteTrace ? JSON.stringify(targetRouteTrace) : '-'}`,
      `routeSource=${targetRouteSource ? JSON.stringify(targetRouteSource) : '-'}`,
      `effectiveSourcePath=${targetRouteSource?.effectiveSourcePath || targetRouteSource?.sourcePath || '-'}`,
      `effectiveExportName=${targetRouteSource?.effectiveExportName || targetRouteSource?.exportName || '-'}`,
      `selectedNode=${selectedNode?.nodeId || '-'}`,
      `componentType=${selectedNode?.componentType || '-'}`,
      `className=${String(selectedNode?.props?.className || '')}`,
      `designDraft=${JSON.stringify(designDraft)}`,
      `selectedFrontendCandidate=${selectedFrontendCandidate ? JSON.stringify({ id: selectedFrontendCandidate.id, title: selectedFrontendCandidate.title, source: selectedFrontendCandidate.source, summary: selectedFrontendCandidate.summary, htmlPreview: selectedFrontendCandidate.html.slice(0, 2000) }) : '-'}`,
      `fullStackMode=${fullStackMode}`,
      `changedFileCompilePlan=${changedFileDraft.split('\n').map(item => item.trim()).filter(Boolean).join(', ') || 'auto-detect changed files only'}`,
      `requiredPathPolicy=controller/service/mapper/frontend path must follow route family and pageId consistently`,
      `designPolicy=theme-management and component-management first; direct CSS only when local and minimal`,
    ].join('\n');

    setIsAiProcessing(true);
    try {
      const trace = getTraceContext();
      if (executeNow) {
        await quickExecuteSrTicket({
          pageId: targetContext.pageId || currentScreen?.pageId || 'builder-studio',
          pageLabel: targetContext.menuTitle || currentScreen?.menuNm || '빌더 화면',
          routePath: targetContext.menuUrl || currentScreen?.menuUrl || '/admin/system/builder-studio',
          menuCode: targetContext.menuCode || currentScreen?.menuCode || '',
          menuLookupUrl: targetContext.menuUrl || currentScreen?.menuUrl || '',
          surfaceId: previewContextRequest?.selector || selectedNode?.nodeId || 'builder-preview',
          surfaceLabel: selectedNode?.componentType || '빌더 미리보기',
          eventId: 'builder-agent-request',
          eventLabel: `${agent.id} 작업 요청`,
          targetId: 'ui',
          targetLabel: 'UI / Builder / Theme / Component',
          summary,
          instruction,
          technicalContext,
          generatedDirection: `${summary}\n\n${instruction}\n\n${technicalContext}`,
          commandPrompt: `${agent.id} agent request\n${summary}\n${instruction}\n${technicalContext}`,
        });
        showToast(`${agent.id} 즉시 작업 요청을 시작했습니다.`);
      } else {
        await addSrWorkbenchStackItem({
          traceId: trace.traceId,
          requestId: trace.requestId,
          pageId: targetContext.pageId || currentScreen?.pageId || 'builder-studio',
          pageLabel: targetContext.menuTitle || currentScreen?.menuNm || '빌더 화면',
          routePath: targetContext.menuUrl || currentScreen?.menuUrl || '/admin/system/builder-studio',
          menuCode: targetContext.menuCode || currentScreen?.menuCode || '',
          menuLookupUrl: targetContext.menuUrl || currentScreen?.menuUrl || '',
          surfaceId: previewContextRequest?.selector || selectedNode?.nodeId || 'builder-preview',
          surfaceLabel: selectedNode?.componentType || '빌더 미리보기',
          selector: previewContextRequest?.selector || '',
          componentId: selectedNode?.componentId || '',
          eventId: 'builder-agent-request',
          eventLabel: `${agent.id} 작업 요청`,
          targetId: 'ui',
          targetLabel: 'UI / Builder / Theme / Component',
          summary,
          instruction,
          technicalContext,
        });
        showToast(`${agent.id} 작업 요청을 워크벤치 스택에 추가했습니다.`);
      }
      setPreviewContextRequest(null);
      setShowAiPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 작업 요청에 실패했습니다.');
    } finally {
      setIsAiProcessing(false);
    }
  }

  function applyDesignDraftToSelectedNode() {
    if (!selectedNode) {
      showToast('디자인을 적용할 노드를 먼저 선택하세요.');
      return;
    }
    const shadowClass = designDraft.shadow === 'none' ? 'shadow-none' : designDraft.shadow === 'lg' ? 'shadow-lg' : 'shadow-sm';
    const className = buildDesignClassName(String(selectedNode.props?.className || ''), {
      padding: `p-[${designDraft.padding}px]`,
      radius: `rounded-[${designDraft.radius}px]`,
      gap: `gap-[${designDraft.gap}px]`,
      width: `w-[${designDraft.width}%]`,
      fontSize: `text-[${designDraft.fontSize}px]`,
      shadow: shadowClass,
    });
    handleUpdateNodeProps(selectedNode.nodeId, {
      className,
      style: {
        ...(typeof selectedNode.props?.style === 'object' && selectedNode.props.style ? selectedNode.props.style : {}),
        padding: `${designDraft.padding}px`,
        borderRadius: `${designDraft.radius}px`,
        gap: `${designDraft.gap}px`,
        width: `${designDraft.width}%`,
        fontSize: `${designDraft.fontSize}px`,
      },
    });
    showToast('선택 요소 디자인 수치를 적용했습니다. 저장/발행하면 빌더 화면에 반영됩니다.');
  }

  function saveSelectedNodeAsSection() {
    if (!selectedNode) {
      showToast('보관할 섹션 노드를 먼저 선택하세요.');
      return;
    }
    const section: SavedBuilderSection = {
      id: `section-${Date.now()}`,
      name: String(selectedNode.props?.label || selectedNode.componentType || '저장 섹션'),
      sourcePageId: targetContext.pageId || currentScreen?.pageId || '',
      sourceMenuCode: targetContext.menuCode || currentScreen?.menuCode || '',
      node: { ...selectedNode, nodeId: `node-${Date.now()}` },
      savedAt: new Date().toISOString(),
    };
    const next = [section, ...savedSections].slice(0, 60);
    setSavedSections(next);
    persistSavedSections(next);
    showToast('섹션 보관함에 저장했습니다.');
  }

  function insertSavedSection(section: SavedBuilderSection) {
    if (!currentScreen) return;
    const nextNode = {
      ...section.node,
      nodeId: `node-${Date.now()}`,
      parentNodeId: null,
      slotName: 'root',
      sortOrder: currentScreen.nodes.filter(n => n.parentNodeId === null).length,
    };
    setCurrentScreen({ ...currentScreen, nodes: [...currentScreen.nodes, nextNode] });
    setSelectedNode(nextNode);
    showToast('보관된 섹션을 현재 화면에 추가했습니다.');
  }

  function buildSavedSectionBuilderUrl(section: SavedBuilderSection) {
    const query = new URLSearchParams();
    query.set('menuCode', targetContext.menuCode || section.sourceMenuCode || 'section-management');
    query.set('pageId', targetContext.pageId || section.sourcePageId || 'section-management');
    query.set('menuTitle', targetContext.menuTitle || section.name || '섹션 관리');
    query.set('menuUrl', targetContext.menuUrl || '/admin/system/section-management');
    query.set('assetType', 'section');
    query.set('assetId', section.id);
    query.set('assetLabel', section.name);
    query.set('selector', String(section.node.props?.className || section.node.componentType || 'section'));
    query.set('sourcePath', 'features/builder-studio/BuilderStudioPage.tsx');
    query.set('focus', 'section-management');
    query.set('tab', 'asset-registry');
    return `/admin/system/builder-studio?${query.toString()}`;
  }

  async function handleCreateNewScreen() {
    try {
      const newScreen = await api.createScreen({
        menuCode: `SCRN-${Date.now()}`,
        menuNm: '새 화면',
        menuUrl: `/admin/screen/new-${Date.now()}`,
        templateType: 'admin',
      });
      setScreens([...screens, newScreen.screen]);
      setCurrentScreen(newScreen.screen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create screen');
    }
  }

  const categories = ['ALL', ...Object.values(CATEGORY_LABELS).map((_, i) => Object.keys(CATEGORY_LABELS)[i])];
  const filteredComponents = activeCategory === 'ALL'
    ? components
    : components.filter(c => c.categoryCd === activeCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">빌더 스튜디오</h1>
          <div className="hidden max-w-[30rem] flex-col text-xs text-gray-500 xl:flex">
            <span className="font-bold text-gray-800">{targetContext.menuTitle}</span>
            <span className="truncate">{targetContext.menuCode || '-'} · {targetContext.pageId || '-'} · {targetContext.menuUrl}</span>
          </div>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={currentScreen?.screenId || ''}
            onChange={e => {
              const screen = screens.find(s => s.screenId === e.target.value);
              if (screen) setCurrentScreen(screen);
            }}
          >
            {screens.map(s => (
              <option key={s.screenId} value={s.screenId}>{s.menuNm}</option>
            ))}
          </select>
          <button
            onClick={handleCreateNewScreen}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            + 새 화면
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
          >
            <span>✨</span> AI 최적화
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={handlePublish}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            발행
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {showAiPanel && (
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[220px,minmax(0,1fr)_260px]">
            <div>
              <h3 className="font-bold text-slate-900">AI 작업 요청</h3>
              <p className="mt-1 text-xs text-slate-500">대상 에이전트를 고르고 화면/요소 수정 요청을 전달합니다.</p>
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="예: 회원 목록 검색 영역의 간격을 줄이고 버튼을 테마 primary 버튼으로 통일"
              className="min-h-[76px] rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="space-y-2">
              <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value as BuilderAgentId)} className="w-full rounded border px-3 py-2 text-sm">
                {BUILDER_AGENT_OPTIONS.map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { void submitBuilderAgentRequest(false); }} disabled={isAiProcessing || !aiPrompt.trim()} className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">스택 추가</button>
                <button onClick={() => { void submitBuilderAgentRequest(true); }} disabled={isAiProcessing || !aiPrompt.trim()} className="rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">즉시 요청</button>
              </div>
              <button onClick={() => setShowAiPanel(false)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b bg-white px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {[
            ['target-preview', '대상 화면'],
            ['builder-canvas', '빌더 캔버스'],
            ['sections', '섹션 보관함'],
            ['asset-registry', '자산 레지스트리'],
            ['full-stack-workbench', '전체 개발'],
            ['page-quality', '페이지 완성도'],
            ['environment-audit', '환경 기능 확인'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveWorkspaceTab(id as BuilderWorkspaceTab)} className={`rounded px-3 py-1.5 text-sm font-bold ${activeWorkspaceTab === id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={contextCaptureEnabled} onChange={e => setContextCaptureEnabled(e.target.checked)} />
            우클릭 수정 캡처
          </label>
        </div>
      </div>

      {activeWorkspaceTab === 'target-preview' ? (
        <div className="flex-1 overflow-hidden bg-slate-100 p-4">
          <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded border bg-white p-3">
              <p className="text-xs font-black uppercase text-blue-700">Target Screen</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">{targetContext.menuTitle}</h2>
              <p className="mt-1 break-all text-sm text-slate-500">{targetContext.menuCode || '-'} · {targetContext.pageId || '-'} · {targetContext.menuUrl}</p>
              {managedAssetContext.assetId || managedAssetContext.assetType ? (
                <div className="mt-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <p className="font-black">관리 대상 자산</p>
                  <p className="mt-1 break-all">{managedAssetContext.assetType || 'asset'} · {managedAssetContext.assetLabel || managedAssetContext.assetId}</p>
                  <p className="mt-1 break-all font-mono text-blue-700">{managedAssetContext.selector || managedAssetContext.sourcePath || '-'}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded border bg-white p-3 text-xs text-slate-600">
              <p className="font-black text-slate-900">수정 기준</p>
              <p className="mt-1">우클릭 캡처를 켜면 미리보기 위에서 HERMES CONTEXT 요청 패널을 띄울 수 있습니다.</p>
              <p className="mt-1">같은 출처 화면은 iframe 내부 DOM 요소의 selector, class, text까지 캡처합니다.</p>
            </div>
          </div>
          <div className="relative h-[calc(100%-104px)] overflow-hidden rounded border bg-white shadow-sm">
            <iframe ref={previewFrameRef} title="builder-target-preview" src={previewUrl} className="h-full w-full" onLoad={attachPreviewInspector} />
            {contextCaptureEnabled ? <button type="button" onClick={attachPreviewInspector} onContextMenu={handlePreviewContextMenu} className="absolute right-3 top-3 rounded bg-white/90 px-3 py-1.5 text-xs font-bold text-blue-700 shadow">요소 캡처 재연결</button> : null}
            {previewContextRequest ? (
              <div className="absolute z-20 w-[360px] rounded-lg border border-slate-200 bg-white p-4 shadow-2xl" style={{ left: Math.min(previewContextRequest.x, 520), top: Math.min(previewContextRequest.y, 360) }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">Hermes Context</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{targetContext.menuTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">{previewContextRequest.selector}</p>
                    {previewContextRequest.element ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {previewContextRequest.element.tagName}
                        {previewContextRequest.element.id ? `#${previewContextRequest.element.id}` : ""}
                        {previewContextRequest.element.ariaLabel ? ` · ${previewContextRequest.element.ariaLabel}` : ""}
                        {previewContextRequest.element.text ? ` · ${previewContextRequest.element.text}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => setPreviewContextRequest(null)}>닫기</button>
                </div>
                <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value as BuilderAgentId)} className="mt-3 w-full rounded border px-3 py-2 text-sm">
                  {BUILDER_AGENT_OPTIONS.map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
                </select>
                <textarea className="mt-3 min-h-[110px] w-full rounded border px-3 py-2 text-sm" value={previewContextRequest.note} onChange={e => setPreviewContextRequest({ ...previewContextRequest, note: e.target.value })} placeholder="이 위치의 UI를 어떻게 수정할지 적어주세요." />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white" onClick={() => { void submitBuilderAgentRequest(false); }}>스택 추가</button>
                  <button className="rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white" onClick={() => { void submitBuilderAgentRequest(true); }}>즉시 요청</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'sections' ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">섹션 관리</h2>
              <p className="mt-1 text-sm text-slate-500">모든 페이지에서 재사용할 섹션을 보관하고 현재 화면으로 불러옵니다.</p>
            </div>
            <button onClick={saveSelectedNodeAsSection} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">선택 노드 섹션 저장</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedSections.map(section => (
              <article key={section.id} className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-blue-700">{section.sourceMenuCode || 'COMMON'} · {section.sourcePageId || 'page'}</p>
                <h3 className="mt-1 font-black text-slate-900">{section.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{section.node.componentType} · {new Date(section.savedAt).toLocaleString()}</p>
                <p className="mt-2 line-clamp-2 break-all text-xs font-mono text-slate-500">{String(section.node.props?.className || '')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => insertSavedSection(section)} className="rounded border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700">현재 화면에 추가</button>
                  <a href={buildSavedSectionBuilderUrl(section)} className="rounded border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">빌더 수정</a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiPanel(true);
                      setAiPrompt(`섹션 자산을 기준으로 화면과 섹션 디자인을 수정해줘.\nsectionId=${section.id}\nsectionName=${section.name}\nsourcePageId=${section.sourcePageId}\nsourceMenuCode=${section.sourceMenuCode}\ncomponentType=${section.node.componentType}\nclassName=${String(section.node.props?.className || '')}\nmenuUrl=${targetContext.menuUrl}`);
                    }}
                    className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white"
                  >
                    AI 수정
                  </button>
                </div>
              </article>
            ))}
            {savedSections.length === 0 ? <div className="rounded border border-dashed bg-white p-8 text-center text-sm text-slate-400">저장된 섹션이 없습니다.</div> : null}
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'asset-registry' ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">빌더 자산 레지스트리</h2>
              <p className="mt-1 text-sm text-slate-500">화면 수정 시 빠지면 안 되는 라우트, 소스, 컴포넌트, 섹션, 테마, API, 컨트롤러, DB 자산을 한 곳에서 관리합니다.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {['관리 대상', '화면/라우트', '컴포넌트', '동작/데이터'].map(group => (
                <div key={group} className="rounded border bg-white px-3 py-2">
                  <p className="font-black text-slate-900">{assetRows.filter(row => row.group === group).length}</p>
                  <p className="text-slate-500">{group}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded border bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">자산</th>
                    <th className="px-4 py-3">소유/경로</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assetRows.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 align-top">
                        <p className="text-xs font-black text-blue-700">{row.group}</p>
                        <p className="font-black text-slate-900">{row.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.detail}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-mono text-xs text-slate-700">{row.owner}</p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-400">{row.path}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${row.status === 'managed' ? 'bg-emerald-100 text-emerald-700' : row.status === 'ready' ? 'bg-blue-100 text-blue-700' : row.status === 'generated' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabel(row.status)}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <a href={row.actionPath} className="rounded border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">열기</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="space-y-3">
              {managedAssetContext.assetId || managedAssetContext.assetType ? (
                <section className="rounded border border-blue-200 bg-blue-50 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-blue-700">Managed Asset</p>
                  <h3 className="mt-1 font-black text-slate-900">{managedAssetContext.assetLabel || managedAssetContext.assetId || managedAssetContext.assetType}</h3>
                  <div className="mt-3 space-y-2 text-xs text-slate-700">
                    <p><b>type</b> {managedAssetContext.assetType || '-'}</p>
                    <p><b>id</b> {managedAssetContext.assetId || '-'}</p>
                    <p><b>focus</b> {managedAssetContext.focus || '-'}</p>
                    <p className="break-all"><b>selector</b> {managedAssetContext.selector || '-'}</p>
                    <p className="break-all"><b>source</b> {managedAssetContext.sourcePath || '-'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiPanel(true);
                      setAiPrompt(`관리 대상 자산을 기준으로 대상 화면을 수정해줘.\nassetType=${managedAssetContext.assetType}\nassetId=${managedAssetContext.assetId}\nassetLabel=${managedAssetContext.assetLabel}\nselector=${managedAssetContext.selector}\nsourcePath=${managedAssetContext.sourcePath}\nmenuUrl=${targetContext.menuUrl}`);
                    }}
                    className="mt-3 w-full rounded bg-blue-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    이 자산 기준 AI 수정
                  </button>
                </section>
              ) : null}
              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Target Trace</p>
                <h3 className="mt-1 font-black text-slate-900">{targetRouteTrace?.routeLabel || targetContext.menuTitle}</h3>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p><b>routeId</b> {targetRouteTrace?.routeId || '-'}</p>
                  <p><b>family</b> {targetRouteTrace?.familyId || '-'}</p>
                  <p><b>pageId</b> {targetRouteTrace?.pageId || targetContext.pageId || '-'}</p>
                  <p><b>menuCode</b> {targetRouteTrace?.menuCode || targetContext.menuCode || '-'}</p>
                  <p><b>route source</b> {targetRouteSource?.sourcePath || '-'}</p>
                  <p><b>effective source</b> {targetRouteSource?.effectiveSourcePath || targetRouteSource?.sourcePath || '-'}</p>
                </div>
              </section>
              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-slate-500">AI 작업 원칙</p>
                <ul className="mt-2 space-y-2 text-xs text-slate-600">
                  <li>수정 요청에는 DOM 캡처, route trace, asset registry를 함께 전달합니다.</li>
                  <li>디자인은 테마/컴포넌트/섹션 기준을 먼저 갱신합니다.</li>
                  <li>자바/API/DB 변경은 project-core 빌드 대상인지 표시해야 합니다.</li>
                  <li>화면만 바뀌는 경우 오버레이 무재배포 경로를 사용합니다.</li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'full-stack-workbench' ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">전체 개발 워크벤치</h2>
              <p className="mt-1 text-sm text-slate-500">프론트 후보 선택, HTML 업로드, 백엔드/API/DB 변경 계획, 변경 파일 기준 컴파일과 롤백을 한 번에 관리합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { void refreshWorkbenchStatus(); }} disabled={isWorkbenchBusy} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">상태 조회</button>
              <button type="button" onClick={() => { void createWorkbenchPlan(); }} disabled={isWorkbenchBusy} className="rounded border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">컴파일 계획</button>
              <button type="button" onClick={() => { void createWorkbenchSnapshot(); }} disabled={isWorkbenchBusy} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">백엔드 스냅샷</button>
              <button type="button" onClick={() => requestFullStackChange(false)} className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white">AI 요청 작성</button>
              <button type="button" onClick={() => requestFullStackChange(true)} className="rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white">즉시 수정 요청</button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <section className="space-y-4">
              <div className="rounded border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-blue-700">Frontend Candidates</p>
                    <h3 className="mt-1 font-black text-slate-900">프론트 원본 + 추천 후보 + 업로드 HTML</h3>
                  </div>
                  <label className="cursor-pointer rounded border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                    HTML 업로드
                    <input type="file" accept=".html,.htm,text/html" className="hidden" onChange={e => handleFrontendCandidateUpload(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {frontendCandidates.map(candidate => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setSelectedFrontendCandidateId(candidate.id)}
                      className={`rounded border p-4 text-left shadow-sm ${selectedFrontendCandidateId === candidate.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase text-slate-500">{candidate.source}</p>
                          <h4 className="mt-1 font-black text-slate-900">{candidate.title}</h4>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{candidate.confidence}%</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{candidate.summary}</p>
                      <p className="mt-3 line-clamp-2 break-all font-mono text-xs text-slate-400">{candidate.html}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Selected Preview</p>
                <h3 className="mt-1 font-black text-slate-900">{selectedFrontendCandidate?.title || '선택 후보 없음'}</h3>
                <div className="mt-3 max-h-[280px] overflow-auto rounded border bg-slate-950 p-3">
                  <pre className="whitespace-pre-wrap break-all text-xs leading-5 text-slate-100">{selectedFrontendCandidate?.html || ''}</pre>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Change Scope</p>
                <h3 className="mt-1 font-black text-slate-900">변경 범위와 즉시 반영 방식</h3>
                {workbenchStatus ? (
                  <div className="mt-3 rounded border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <p className="font-black">{workbenchStatus.gitBranch} · {workbenchStatus.gitHead}</p>
                    <p className="mt-1">{workbenchStatus.changedFiles.length}개 변경 파일 감지 · {workbenchStatus.status}</p>
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2">
                  {[
                    ['frontend-only', '프론트/HTML만', '오버레이 동기화와 변경 청크 중심으로 즉시 반영'],
                    ['metadata-api', '메타데이터/API', '공통 메타데이터와 API 계약 우선, Java 변경 최소화'],
                    ['java-core', 'Java project-core', '변경 Java 파일 중심 증분 컴파일 후 필요 시 롤링 재시작'],
                    ['db-migration', 'DB 변경 포함', '사전 백업, dry-run, 롤백 SQL을 포함해 적용'],
                  ].map(([id, label, desc]) => (
                    <label key={id} className={`rounded border p-3 ${fullStackMode === id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                      <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                        <input type="radio" checked={fullStackMode === id} onChange={() => setFullStackMode(id as typeof fullStackMode)} />
                        {label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{desc}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Changed Files</p>
                <h3 className="mt-1 font-black text-slate-900">변경 파일만 컴파일/검증</h3>
                <textarea
                  value={changedFileDraft}
                  onChange={e => setChangedFileDraft(e.target.value)}
                  placeholder={'자동 감지 가능. 직접 지정 시 한 줄에 하나씩 입력\nprojects/carbonet-frontend/source/src/features/...\nproject-core/src/main/java/...'}
                  className="mt-3 min-h-[130px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
                />
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  <li>프론트는 선택 후보를 React/빌더 메타데이터로 변환 후 변경 청크만 재생성합니다.</li>
                  <li>Java는 트랜잭션/서비스/컨트롤러 변경 시 project-core 기준 증분 컴파일 대상으로 표시합니다.</li>
                  <li>DB는 migration, rollback SQL, 적용 전 백업 여부를 AI 요청에 포함합니다.</li>
                </ul>
              </section>

              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Rollback</p>
                <h3 className="mt-1 font-black text-slate-900">선택 후보/변경 전 상태 복구</h3>
                <div className="mt-3 space-y-2">
                  {rollbackPoints.map(point => (
                    <button
                      key={point.id}
                      type="button"
                      onClick={() => {
                        setSelectedFrontendCandidateId(point.candidateId);
                        showToast('선택 후보를 롤백 지점으로 되돌렸습니다.');
                      }}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-left text-xs hover:border-blue-200"
                    >
                      <span className="block font-black text-slate-900">{point.label}</span>
                      <span className="block text-slate-500">{new Date(point.createdAt).toLocaleString()} · {point.candidateId}</span>
                    </button>
                  ))}
                  {rollbackPoints.length === 0 ? <p className="rounded border border-dashed p-4 text-center text-xs text-slate-400">아직 생성된 롤백 지점이 없습니다.</p> : null}
                </div>
              </section>

              <section className="rounded border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-blue-700">Runtime Result</p>
                <h3 className="mt-1 font-black text-slate-900">백엔드 실행 결과</h3>
                <div className="mt-3 max-h-[260px] overflow-auto rounded border bg-slate-950 p-3">
                  <pre className="whitespace-pre-wrap break-all text-xs leading-5 text-slate-100">{workbenchResult ? JSON.stringify(workbenchResult, null, 2) : '상태 조회, 컴파일 계획, 백엔드 스냅샷 결과가 여기에 표시됩니다.'}</pre>
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'page-quality' ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">페이지 완성도 점검</h2>
              <p className="mt-1 text-sm text-slate-500">이름만 있는 화면, 공통 구현 위임 화면, 플레이스홀더 화면을 빌더 관리 대상으로 추적합니다.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <button type="button" onClick={() => setPageQualityFilter('all')} className={`rounded border bg-white px-3 py-2 ${pageQualityFilter === 'all' ? 'border-blue-400 text-blue-700' : 'text-slate-500'}`}><p className="font-black">{pageQualitySummary.total}</p><p>전체</p></button>
              <button type="button" onClick={() => setPageQualityFilter('thin')} className={`rounded border bg-white px-3 py-2 ${pageQualityFilter === 'thin' ? 'border-rose-400 text-rose-700' : 'text-slate-500'}`}><p className="font-black">{pageQualitySummary.thin}</p><p>보강</p></button>
              <button type="button" onClick={() => setPageQualityFilter('placeholder-managed')} className={`rounded border bg-white px-3 py-2 ${pageQualityFilter === 'placeholder-managed' ? 'border-amber-400 text-amber-700' : 'text-slate-500'}`}><p className="font-black">{pageQualitySummary.placeholder}</p><p>플레이스홀더</p></button>
              <button type="button" onClick={() => setPageQualityFilter('delegated')} className={`rounded border bg-white px-3 py-2 ${pageQualityFilter === 'delegated' ? 'border-blue-400 text-blue-700' : 'text-slate-500'}`}><p className="font-black">{pageQualitySummary.delegated}</p><p>위임</p></button>
            </div>
          </div>
          <div className="overflow-hidden rounded border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">페이지 소스</th>
                  <th className="px-4 py-3">기능 신호</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">빌더 조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageQualityRows.map(row => (
                  <tr key={row.sourcePath}>
                    <td className="px-4 py-3 align-top">
                      <p className="break-all font-mono text-xs font-bold text-slate-900">{row.sourcePath}</p>
                      {row.effectiveSourcePath !== row.sourcePath ? <p className="mt-1 break-all font-mono text-xs font-bold text-blue-700">effective: {row.effectiveSourcePath}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
                      <p className="mt-1 text-xs text-slate-400">routes {row.routeCount}: {row.routeIds.slice(0, 4).join(', ')}{row.routeIds.length > 4 ? ' ...' : ''}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1 text-[11px] font-bold">
                        <span className={`rounded px-2 py-1 ${row.hasAsyncData ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>DATA</span>
                        <span className={`rounded px-2 py-1 ${row.hasForm ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>FORM</span>
                        <span className={`rounded px-2 py-1 ${row.hasTable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>TABLE</span>
                        <span className={`rounded px-2 py-1 ${row.hasBuilderLink ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>BUILDER</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{row.lineCount} non-empty lines</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded-full px-2 py-1 text-xs font-black ${pageCompletenessClassName(row.status)}`}>{pageCompletenessLabel(row.status)}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button type="button" onClick={() => {
                        setActiveWorkspaceTab('target-preview');
                        setAiPrompt(`다음 페이지가 이름만 있는 화면인지 점검하고, 실제 데이터/검색/목록/상세/저장 기능과 빌더 자산 연결을 보강해줘.\nsource=${row.sourcePath}\neffectiveSource=${(row as any).effectiveSourcePath || row.sourcePath}\nstatus=${row.status}\nreason=${row.reason}`);
                        setShowAiPanel(true);
                      }} className="rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">AI 보강 요청</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'environment-audit' ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <h2 className="text-xl font-black">시스템 환경 기능 확인</h2>
          <p className="mt-1 text-sm text-slate-500">빌더 화면 개발에 필요한 환경 중메뉴 기능을 한 곳에서 확인합니다.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ENVIRONMENT_BUILDER_SURFACES.map(item => (
              <a key={item.id} href={item.route} className="rounded border bg-white p-4 shadow-sm hover:border-blue-300">
                <p className="text-xs font-black uppercase text-blue-700">{item.id}</p>
                <h3 className="mt-1 font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.status}</p>
                <p className="mt-3 break-all text-xs font-mono text-slate-400">{item.route}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab === 'builder-canvas' ? <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r flex flex-col">
          <div className="p-3 border-b">
            <h2 className="font-bold text-sm">컴포넌트</h2>
          </div>
          <div className="flex gap-1 p-2 border-b flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-1 text-xs rounded ${
                  activeCategory === cat ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                {cat === 'ALL' ? '전체' : CATEGORY_LABELS[cat]?.ko || cat}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredComponents.map(comp => (
              <div
                key={comp.componentId}
                draggable
                onDragStart={e => handleDragStart(e, comp)}
                className="p-3 mb-2 bg-gray-50 border border-gray-200 rounded cursor-grab hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {comp.componentType === 'BUTTON' ? '🔘' :
                     comp.componentType === 'CARD' ? '🃏' :
                     comp.componentType === 'INPUT' ? '📝' :
                     comp.componentType === 'TABLE' ? '📊' :
                     comp.componentType === 'FORM' ? '📋' : '📦'}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{comp.componentNm}</p>
                    <p className="text-xs text-gray-500">{COMPONENT_TYPE_LABELS[comp.componentType]?.ko || comp.componentType}</p>
                  </div>
                </div>
                {comp.componentDc && <p className="text-xs text-gray-400 mt-1">{comp.componentDc}</p>}
              </div>
            ))}
          </div>
        </aside>

        <main
          className="flex-1 overflow-auto p-6 bg-gray-100"
          onDragOver={handleDragOver}
          onDrop={e => handleDrop(e, null, 'root')}
        >
          <div className="bg-white rounded-lg shadow-sm min-h-full p-6">
            <div className="mb-4 pb-4 border-b">
              <h2 className="text-lg font-bold">{currentScreen?.menuNm || '화면 제목'}</h2>
              <p className="text-sm text-gray-500">{currentScreen?.menuUrl}</p>
            </div>
            {currentScreen?.nodes.filter(n => n.parentNodeId === null).map(node => (
              <NodeRenderer
                key={node.nodeId}
                node={node}
                allNodes={currentScreen.nodes}
                selectedNode={selectedNode}
                onSelect={handleNodeClick}
                onDelete={handleNodeDelete}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
            ))}
            {(!currentScreen?.nodes || currentScreen.nodes.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">📦</p>
                <p>왼쪽에서 컴포넌트를 드래그하여 배치하세요</p>
              </div>
            )}
          </div>
        </main>

        <aside className="w-80 bg-white border-l flex flex-col">
          <div className="p-3 border-b">
            <h2 className="font-bold text-sm">속성</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">컴포넌트</label>
                  <p className="text-sm font-medium">{selectedNode.componentType}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Node ID</label>
                  <p className="text-xs text-gray-500 font-mono">{selectedNode.nodeId}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Class Name</label>
                  <input
                    type="text"
                    value={String(selectedNode.props?.className || '')}
                    onChange={e => handleUpdateNodeProps(selectedNode.nodeId, { className: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                    placeholder=" Tailwind classes..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Custom ID</label>
                  <input
                    type="text"
                    value={String(selectedNode.props?.customId || '')}
                    onChange={e => handleUpdateNodeProps(selectedNode.nodeId, { customId: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                    placeholder="custom-id"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Label/Title</label>
                  <input
                    type="text"
                    value={String(selectedNode.props?.label || '')}
                    onChange={e => handleUpdateNodeProps(selectedNode.nodeId, { label: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="Label..."
                  />
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">디자인 수치</label>
                    <button onClick={applyDesignDraftToSelectedNode} className="rounded bg-blue-700 px-2 py-1 text-xs font-bold text-white">적용</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['padding', '여백', '0', '48'],
                      ['radius', '반경', '0', '32'],
                      ['gap', '간격', '0', '40'],
                      ['width', '너비%', '20', '100'],
                      ['fontSize', '글자', '10', '28'],
                    ].map(([key, label, min, max]) => (
                      <label key={key} className="text-[11px] font-bold text-slate-600">
                        {label}: {designDraft[key as keyof typeof designDraft]}
                        <input type="range" min={min} max={max} value={designDraft[key as keyof typeof designDraft]} onChange={e => setDesignDraft({ ...designDraft, [key]: e.target.value })} className="w-full" />
                      </label>
                    ))}
                  </div>
                  <select value={designDraft.shadow} onChange={e => setDesignDraft({ ...designDraft, shadow: e.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-xs">
                    <option value="none">그림자 없음</option>
                    <option value="sm">작은 그림자</option>
                    <option value="lg">큰 그림자</option>
                  </select>
                </div>
                {selectedNode.props?.placeholder ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={String(selectedNode.props.placeholder)}
                      onChange={e => handleUpdateNodeProps(selectedNode.nodeId, { placeholder: e.target.value })}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                ) : null}
                <div className="pt-4 border-t">
                  <button
                    onClick={() => handleNodeDelete(selectedNode.nodeId)}
                    className="w-full px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>컴포넌트를 선택하세요</p>
              </div>
            )}
          </div>
        </aside>
      </div> : null}

      {builderToast ? (
        <div className="fixed bottom-5 left-1/2 z-[1600] -translate-x-1/2 rounded border bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-xl">
          {builderToast}
        </div>
      ) : null}
    </div>
  );
}

interface NodeRendererProps {
  node: BuilderNode;
  allNodes: BuilderNode[];
  selectedNode: BuilderNode | null;
  onSelect: (node: BuilderNode) => void;
  onDelete: (nodeId: string) => void;
  onDrop: (e: React.DragEvent, parentNodeId: string | null, slotName: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

function NodeRenderer({ node, allNodes, selectedNode, onSelect, onDelete, onDrop, onDragOver }: NodeRendererProps) {
  const isSelected = selectedNode?.nodeId === node.nodeId;
  const children = allNodes.filter(n => n.parentNodeId === node.nodeId);

  const getComponentStyle = (): string => {
    const baseClass = String(node.props?.className || '');
    return baseClass;
  };

  const getComponentInlineStyle = (): React.CSSProperties => {
    return typeof node.props?.style === 'object' && node.props.style ? node.props.style as React.CSSProperties : {};
  };

  const renderComponent = () => {
    switch (node.componentType) {
      case 'BUTTON':
        return (
          <button
            className={getComponentStyle()}
            style={getComponentInlineStyle()}
            onClick={() => onSelect(node)}
          >
            {String(node.props?.label || 'Button')}
          </button>
        );
      case 'INPUT':
        return (
          <input
            type="text"
            className={getComponentStyle()}
            style={getComponentInlineStyle()}
            placeholder={String(node.props?.placeholder || '')}
            onClick={() => onSelect(node)}
            readOnly
          />
        );
      case 'CARD':
      case 'SECTION':
      case 'FORM':
        return (
          <div
            className={`${getComponentStyle()} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            style={getComponentInlineStyle()}
            onClick={() => onSelect(node)}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, node.nodeId, 'children')}
          >
            {children.map(child => (
              <NodeRenderer
                key={child.nodeId}
                node={child}
                allNodes={allNodes}
                selectedNode={selectedNode}
                onSelect={onSelect}
                onDelete={onDelete}
                onDrop={onDrop}
                onDragOver={onDragOver}
              />
            ))}
            {children.length === 0 && (
              <div className="text-gray-300 text-sm p-4 border-2 border-dashed rounded text-center">
                여기에 드롭
              </div>
            )}
          </div>
        );
      case 'TABLE':
        return (
          <table className={getComponentStyle()} style={getComponentInlineStyle()} onClick={() => onSelect(node)}>
            <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
            <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
          </table>
        );
      default:
        return (
          <div
            className={`${getComponentStyle()} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            style={getComponentInlineStyle()}
            onClick={() => onSelect(node)}
          >
            {String(node.props?.label || node.componentType)}
            {children.map(child => (
              <NodeRenderer
                key={child.nodeId}
                node={child}
                allNodes={allNodes}
                selectedNode={selectedNode}
                onSelect={onSelect}
                onDelete={onDelete}
                onDrop={onDrop}
                onDragOver={onDragOver}
              />
            ))}
          </div>
        );
    }
  };

  return renderComponent();
}

export default BuilderStudioPage;
