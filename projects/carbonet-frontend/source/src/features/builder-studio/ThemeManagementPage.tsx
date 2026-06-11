import { useState, useEffect } from 'react';
import type { BuilderTheme } from './types/builder';
import * as api from './api/builderApi';

const DEFAULT_THEMES: BuilderTheme[] = [
  {
    themeId: 'THEME001',
    themeName: 'Default Light',
    description: '기본 라이트 테마',
    themeType: 'SYSTEM',
    isDefault: true,
  },
  {
    themeId: 'THEME002',
    themeName: 'Default Dark',
    description: '기본 다크 테마',
    themeType: 'SYSTEM',
    isDefault: false,
  },
  {
    themeId: 'THEME003',
    themeName: 'Dashboard',
    description: '대시보드용 다크 테마',
    themeType: 'CUSTOM',
    isDefault: false,
  },
];

export function ThemeManagementPage() {
  const [themes, setThemes] = useState<BuilderTheme[]>(DEFAULT_THEMES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<BuilderTheme | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadThemes();
  }, []);

  async function loadThemes() {
    try {
      setIsLoading(true);
      const res = await api.getThemes();
      if (res.themes.length > 0) {
        setThemes(res.themes);
      }
    } catch (e) {
      console.log('Using default themes');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectTheme(theme: BuilderTheme) {
    setSelectedTheme(theme);
  }

  function handlePreview(theme: BuilderTheme) {
    alert(`${theme.themeName} 미리보기 기능은 준비 중입니다.`);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">테마 관리</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 테마
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 mb-4 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
          <div
            key={theme.themeId}
            className={`bg-white rounded-lg shadow p-6 border-2 transition-all ${
              selectedTheme?.themeId === theme.themeId ? 'border-blue-500' : 'border-transparent'
            }`}
            onClick={() => handleSelectTheme(theme)}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{theme.themeName}</h3>
                <p className="text-sm text-gray-500">{theme.description}</p>
              </div>
              {theme.isDefault && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                  기본
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handlePreview(theme)}
                className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
              >
                미리보기
              </button>
              <button
                onClick={() => { setSelectedTheme(theme); setShowModal(true); }}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                편집
              </button>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">
                <span className="font-medium">유형:</span> {theme.themeType}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">테마 미리보기</h2>
        {selectedTheme ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded"></div>
              <div className="w-12 h-12 bg-green-500 rounded"></div>
              <div className="w-12 h-12 bg-yellow-500 rounded"></div>
              <div className="w-12 h-12 bg-red-500 rounded"></div>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-sm">본문 텍스트 예시</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded">버튼</button>
              <button className="px-4 py-2 border rounded">테두리</button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">테마를 선택하세요</p>
        )}
      </div>

      {showModal && (
        <ThemeModal
          theme={selectedTheme}
          onClose={() => { setShowModal(false); setSelectedTheme(null); }}
          onSave={() => { setShowModal(false); setSelectedTheme(null); loadThemes(); }}
        />
      )}
    </div>
  );
}

interface ThemeModalProps {
  theme: BuilderTheme | null;
  onClose: () => void;
  onSave: () => void;
}

function ThemeModal({ theme, onClose, onSave }: ThemeModalProps) {
  const [form, setForm] = useState({
    themeId: theme?.themeId || `THEME-${Date.now()}`,
    themeName: theme?.themeName || '',
    description: theme?.description || '',
    themeType: theme?.themeType || 'CUSTOM',
    isDefault: theme?.isDefault || false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert('테마 저장 기능은 준비 중입니다.');
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4">
          {theme ? '테마 편집' : '새 테마'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">테마 ID</label>
            <input
              type="text"
              value={form.themeId}
              onChange={e => setForm({ ...form, themeId: e.target.value })}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">테마 이름</label>
            <input
              type="text"
              value={form.themeName}
              onChange={e => setForm({ ...form, themeName: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="테마 이름"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">설명</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="테마 설명"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">유형</label>
            <select
              value={form.themeType}
              onChange={e => setForm({ ...form, themeType: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="SYSTEM">시스템</option>
              <option value="CUSTOM">사용자 정의</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={e => setForm({ ...form, isDefault: e.target.checked })}
            />
            <span className="text-sm">기본 테마로 설정</span>
          </label>
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

export default ThemeManagementPage;