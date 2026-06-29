import { useEffect, useMemo, useState } from 'react';
import { buildLocalizedPath, isEnglish } from '../../lib/navigation/runtime';
import { postFormUrlEncoded } from '../../lib/api/core';
import { refreshAdminMenuTree } from '../../lib/api/adminShell';
import type { MenuTreeNode } from './menuTreeShared';

interface DependentScreenSelectPopupProps {
  isOpen: boolean;
  onClose: () => void;
  menuCode: string;
  menuLabel: string;
  treeData: MenuTreeNode[];
  currentDependentCode?: string;
  onSuccess?: () => void;
}

export function DependentScreenSelectPopup({
  isOpen,
  onClose,
  menuCode,
  menuLabel,
  treeData,
  currentDependentCode,
  onSuccess
}: DependentScreenSelectPopupProps) {
  const en = isEnglish();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dependentCode, setDependentCode] = useState(currentDependentCode || '');

  useEffect(() => {
    setDependentCode(currentDependentCode || '');
  }, [currentDependentCode, isOpen]);

  const flatMenuList = useMemo(() => {
    const result: Array<{ code: string; label: string; url: string; depth: number }> = [];
    
    const traverse = (nodes: MenuTreeNode[], depth: number = 0) => {
      for (const node of nodes) {
        if (node.code !== menuCode && node.url) {
          result.push({ code: node.code, label: node.label, url: node.url, depth });
        }
        if (node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      }
    };
    
    traverse(treeData);
    return result;
  }, [treeData, menuCode]);

  const filteredMenuList = useMemo(() => {
    if (!searchKeyword.trim()) return flatMenuList;
    const keyword = searchKeyword.toLowerCase();
    return flatMenuList.filter(
      (m) =>
        m.code.toLowerCase().includes(keyword) ||
        m.label.toLowerCase().includes(keyword) ||
        m.url.toLowerCase().includes(keyword)
    );
  }, [flatMenuList, searchKeyword]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body = new URLSearchParams();
      body.set('menuCode', menuCode);
      body.set('dependentScreenCode', dependentCode);
      
      const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
        buildLocalizedPath('/admin/system/menu/update-dependent-screen', '/en/admin/system/menu/update-dependent-screen'),
        body
      );
      
      if (result.success) {
        refreshAdminMenuTree();
        onSuccess?.();
        onClose();
      } else {
        alert(result.message || (en ? 'Failed to save' : '저장 실패'));
      }
    } catch (err) {
      console.error('Failed to save dependent screen:', err);
      alert(en ? 'Failed to save' : '저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDependent = async () => {
    if (!confirm(en ? 'Clear dependent screen mapping?' : '종속 화면 매핑을 해제하시겠습니까?')) return;
    setIsSaving(true);
    try {
      const body = new URLSearchParams();
      body.set('menuCode', menuCode);
      body.set('dependentScreenCode', '');
      
      const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
        buildLocalizedPath('/admin/system/menu/update-dependent-screen', '/en/admin/system/menu/update-dependent-screen'),
        body
      );
      
      if (result.success) {
        refreshAdminMenuTree();
        setDependentCode('');
        onSuccess?.();
        onClose();
      } else {
        alert(result.message || (en ? 'Failed to clear' : '해제 실패'));
      }
    } catch (err) {
      console.error('Failed to clear dependent screen:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold">{en ? 'Select Dependent Screen' : '종속 화면 선택'}</h2>
            <p className="text-sm text-gray-500">
              {en 
                ? `Mapping for: ${menuCode} (${menuLabel})`
                : `매핑 대상: ${menuCode} (${menuLabel})`
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <input
            type="text"
            className="gov-input w-full"
            placeholder={en ? 'Search by code, name, or URL...' : '코드, 메뉴명, URL로 검색...'}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>

        {/* Menu List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredMenuList.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {en ? 'No screens available' : '선택 가능한 화면이 없습니다'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMenuList.map((menu) => (
                <button
                  key={menu.code}
                  type="button"
                  onClick={() => setDependentCode(menu.code)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-blue-50 text-left ${
                    dependentCode === menu.code ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                  }`}
                  style={{ paddingLeft: `${menu.depth * 20 + 12}px` }}
                >
                  <input
                    type="radio"
                    checked={dependentCode === menu.code}
                    onChange={() => setDependentCode(menu.code)}
                    className="w-4 h-4"
                  />
                  <span className="material-symbols-outlined text-[18px] text-[var(--kr-gov-blue)]">
                    {menu.depth === 0 ? 'folder' : 'description'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{menu.label}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{menu.code}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{menu.url}</p>
                  </div>
                  {dependentCode === menu.code && (
                    <span className="material-symbols-outlined text-blue-600">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Mapping Info */}
        {currentDependentCode && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-amber-600">info</span>
              <span className="text-amber-800">
                {en ? 'Current mapping: ' : '현재 매핑: '}
                <strong className="font-mono">{currentDependentCode}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div>
            {currentDependentCode && (
              <button
                type="button"
                onClick={handleClearDependent}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                {en ? 'Clear Mapping' : '매핑 해제'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="gov-btn gov-btn-outline">
              {en ? 'Cancel' : '취소'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || dependentCode === currentDependentCode}
              className="gov-btn gov-btn-primary"
            >
              {isSaving ? (en ? 'Saving...' : '저장 중...') : (en ? 'Save' : '저장')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
