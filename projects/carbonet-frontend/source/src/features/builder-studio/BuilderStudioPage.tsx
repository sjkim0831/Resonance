import { useState, useEffect } from 'react';
import type { BuilderComponent, BuilderScreen, BuilderNode } from './types/builder';
import * as api from './api/builderApi';
import { COMPONENT_TYPE_LABELS, CATEGORY_LABELS } from './types/builder';

export function BuilderStudioPage() {
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

  useEffect(() => {
    loadInitialData();
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

  function handleAiOptimize() {
    if (!currentScreen || !aiPrompt.trim()) return;
    setIsAiProcessing(true);
    setTimeout(() => {
      const prompt = aiPrompt.toLowerCase();
      let updatedNodes = [...currentScreen.nodes];

      if (prompt.includes('버튼') || prompt.includes('button')) {
        updatedNodes = updatedNodes.map(n => {
          if (n.componentType === 'BUTTON') {
            return {
              ...n,
              props: {
                ...n.props,
                className: 'px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors',
              },
            };
          }
          return n;
        });
      }

      if (prompt.includes('카드') || prompt.includes('card')) {
        updatedNodes = updatedNodes.map(n => {
          if (n.componentType === 'CARD') {
            return {
              ...n,
              props: {
                ...n.props,
                className: 'bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow',
              },
            };
          }
          return n;
        });
      }

      if (prompt.includes('반응형') || prompt.includes('responsive')) {
        updatedNodes = updatedNodes.map(n => ({
          ...n,
          props: {
            ...n.props,
            className: String(n.props.className || '').replace(/\s*$/, ' md:flex-row lg:w-1/2'),
          },
        }));
      }

      if (prompt.includes('다크') || prompt.includes('dark')) {
        updatedNodes = updatedNodes.map(n => ({
          ...n,
          props: {
            ...n.props,
            className: String(n.props.className || '').replace(/bg-white/g, 'bg-gray-800').replace(/bg-gray-/g, 'bg-gray-').replace(/text-gray-/g, 'text-gray-'),
          },
        }));
      }

      setCurrentScreen({ ...currentScreen, nodes: updatedNodes });
      setIsAiProcessing(false);
      setShowAiPanel(false);
      setAiPrompt('');
    }, 1500);
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
        <div className="bg-purple-50 border-b border-purple-200 p-4">
          <div className="max-w-2xl mx-auto">
            <h3 className="font-bold text-purple-800 mb-2">AI 화면 최적화</h3>
            <p className="text-sm text-purple-600 mb-3">
              자연어로 요청하면 AI가 화면을 최적화합니다. 예: "버튼 색상을 파란색으로", "반응형으로 변경", "다크 모드 적용"
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="예: 버튼을 더 큰 파란색으로 변경하고 카드에 그림자 추가"
                className="flex-1 border rounded px-3 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAiOptimize()}
              />
              <button
                onClick={handleAiOptimize}
                disabled={isAiProcessing || !aiPrompt.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {isAiProcessing ? '처리 중...' : '적용'}
              </button>
              <button
                onClick={() => setShowAiPanel(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
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
      </div>
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

  const renderComponent = () => {
    switch (node.componentType) {
      case 'BUTTON':
        return (
          <button
            className={getComponentStyle()}
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
          <table className={getComponentStyle()} onClick={() => onSelect(node)}>
            <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
            <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
          </table>
        );
      default:
        return (
          <div
            className={`${getComponentStyle()} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
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