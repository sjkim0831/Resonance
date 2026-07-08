import { useState, useEffect } from 'react';
import type { BuilderComponent } from './types/builder';
import * as api from './api/builderApi';
import { COMPONENT_TYPE_LABELS, CATEGORY_LABELS } from './types/builder';
import { isEnglish } from '../../lib/navigation/runtime';
import { BuilderGovernanceNav } from '../builder-governance/BuilderGovernanceNav';

function buildComponentBuilderUrl(component: BuilderComponent) {
  const query = new URLSearchParams();
  query.set('menuCode', 'component-management');
  query.set('pageId', 'component-management');
  query.set('menuTitle', '컴포넌트 관리');
  query.set('menuUrl', '/admin/system/component-management');
  query.set('assetType', 'component');
  query.set('assetId', component.componentId);
  query.set('assetLabel', component.componentNm || component.componentId);
  query.set('selector', component.defaultClassNm || component.componentType);
  query.set('sourcePath', 'features/builder-studio/ComponentManagementPage.tsx');
  query.set('focus', 'component-management');
  query.set('tab', 'asset-registry');
  return `/admin/system/builder-studio?${query.toString()}`;
}

export function ComponentManagementPage() {
  const en = isEnglish();
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<BuilderComponent | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    try {
      setIsLoading(true);
      const res = await api.getComponents({ activeOnly: false });
      setComponents(res.components);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(component: Partial<BuilderComponent>) {
    try {
      if (editingComponent) {
        await api.updateComponent(editingComponent.componentId, component);
      } else {
        await api.createComponent(component);
      }
      setShowModal(false);
      setEditingComponent(null);
      loadComponents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async function handleDelete(componentId: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await api.deleteComponent(componentId);
      loadComponents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const filteredComponents = filterType === 'ALL'
    ? components
    : components.filter(c => c.componentType === filterType);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <BuilderGovernanceNav activeId="component-management" en={en} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">컴포넌트 관리</h1>
        <button
          onClick={() => { setEditingComponent(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 컴포넌트
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 mb-4 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}

      <div className="mb-4 flex gap-2 flex-wrap">
        {['ALL', ...Object.keys(COMPONENT_TYPE_LABELS)].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-sm rounded ${
              filterType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {type === 'ALL' ? '전체' : COMPONENT_TYPE_LABELS[type]?.ko || type}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">이름</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">유형</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">클래스</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">컨테이너</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredComponents.map(comp => (
              <tr key={comp.componentId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{comp.componentId}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{comp.componentNm}</p>
                  <p className="text-xs text-gray-500">{comp.componentDc}</p>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    {COMPONENT_TYPE_LABELS[comp.componentType]?.ko || comp.componentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {CATEGORY_LABELS[comp.categoryCd]?.ko || comp.categoryCd}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-xs max-w-xs truncate">
                  {comp.defaultClassNm}
                </td>
                <td className="px-4 py-3 text-sm">
                  {comp.isContainer ? '✓' : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingComponent(comp); setShowModal(true); }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      수정
                    </button>
                    <a
                      href={buildComponentBuilderUrl(comp)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm"
                    >
                      빌더 수정
                    </a>
                    <button
                      onClick={() => handleDelete(comp.componentId)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ComponentModal
          component={editingComponent}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingComponent(null); }}
        />
      )}
    </div>
  );
}

interface ComponentModalProps {
  component: BuilderComponent | null;
  onSave: (component: Partial<BuilderComponent>) => void;
  onClose: () => void;
}

function ComponentModal({ component, onSave, onClose }: ComponentModalProps) {
  const [form, setForm] = useState<Partial<BuilderComponent>>({
    componentId: component?.componentId || '',
    componentNm: component?.componentNm || '',
    componentDc: component?.componentDc || '',
    componentType: component?.componentType || 'OTHER',
    categoryCd: component?.categoryCd || 'LAYOUT',
    iconNm: component?.iconNm || '',
    defaultClassNm: component?.defaultClassNm || '',
    isContainer: component?.isContainer || false,
    isReusable: component?.isReusable ?? true,
    useAt: component?.useAt || 'Y',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4">
          {component ? '컴포넌트 수정' : '새 컴포넌트'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">컴포넌트 ID</label>
            <input
              type="text"
              value={form.componentId || ''}
              onChange={e => setForm({ ...form, componentId: e.target.value })}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="CMPT001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input
              type="text"
              value={form.componentNm || ''}
              onChange={e => setForm({ ...form, componentNm: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="컴포넌트 이름"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">설명</label>
            <input
              type="text"
              value={form.componentDc || ''}
              onChange={e => setForm({ ...form, componentDc: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="컴포넌트 설명"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">유형</label>
              <select
                value={form.componentType || ''}
                onChange={e => setForm({ ...form, componentType: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {Object.entries(COMPONENT_TYPE_LABELS).map(([code, labels]) => (
                  <option key={code} value={code}>{labels.ko}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">카테고리</label>
              <select
                value={form.categoryCd || ''}
                onChange={e => setForm({ ...form, categoryCd: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {Object.entries(CATEGORY_LABELS).map(([code, labels]) => (
                  <option key={code} value={code}>{labels.ko}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">기본 클래스</label>
            <input
              type="text"
              value={form.defaultClassNm || ''}
              onChange={e => setForm({ ...form, defaultClassNm: e.target.value })}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="px-4 py-2 bg-blue-600 text-white rounded"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isContainer || false}
                onChange={e => setForm({ ...form, isContainer: e.target.checked })}
              />
              <span className="text-sm">컨테이너 (자식 포함 가능)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isReusable ?? true}
                onChange={e => setForm({ ...form, isReusable: e.target.checked })}
              />
              <span className="text-sm">재사용 가능</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComponentManagementPage;
