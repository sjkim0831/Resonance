/**
 * Menu Management Page
 * 메뉴 관리 - 트리 구조, 접기/펼치기, 이동, 저장 기능
 */
import React, { useState, useEffect } from 'react';

import { Button, Card, CardHeader, CardBody } from '../../common/ui';
import { useTheme } from '../../common/ui/hooks/useTheme';

interface MenuItem {
  menuId: string;
  upperMenuId: string | null;
  menuNm: string;
  menuDc: string;
  menuPath: string;
  menuUrl: string;
  sortOrder: number;
  menuLevel: number;
  menuGroupId: string;
  pageId?: string;
  createScreen?: boolean;
  screenTemplateType?: string;
  children?: MenuItem[];
  hasChildren?: boolean;
  expanded?: boolean;
}

interface MenuGroup {
  menuGroupId: string;
  menuGroupNm: string;
  menuGroupDs: string;
  sortOrder: number;
}

interface DragState {
  menuId: string;
  originalParentId: string | null;
  originalSortOrder: number;
}

const MenuManagementPage: React.FC = () => {
  const { theme } = useTheme();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    loadMenus();
    loadGroups();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/menu/tree');
      const data = await response.json();
      setMenus(initializeExpanded(data));
    } catch (error) {
      console.error('Failed to load menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/menu/groups');
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const initializeExpanded = (items: MenuItem[]): MenuItem[] => {
    return items.map(item => ({
      ...item,
      expanded: item.menuLevel < 2,
      children: item.children ? initializeExpanded(item.children) : undefined
    }));
  };

  const toggleExpand = (menuId: string) => {
    setMenus(prev => updateExpandedState(prev, menuId));
  };

  const updateExpandedState = (items: MenuItem[], menuId: string): MenuItem[] => {
    return items.map(item => {
      if (item.menuId === menuId) {
        return { ...item, expanded: !item.expanded };
      }
      if (item.children) {
        return { ...item, children: updateExpandedState(item.children, menuId) };
      }
      return item;
    });
  };

  const expandAll = () => {
    setMenus(prev => updateAllExpandedState(prev, true));
  };

  const collapseAll = () => {
    setMenus(prev => updateAllExpandedState(prev, false));
  };

  const updateAllExpandedState = (items: MenuItem[], expanded: boolean): MenuItem[] => {
    return items.map(item => ({
      ...item,
      expanded,
      children: item.children ? updateAllExpandedState(item.children, expanded) : undefined
    }));
  };

  const findMenuById = (items: MenuItem[], id: string): MenuItem | null => {
    for (const item of items) {
      if (item.menuId === id) return item;
      if (item.children) {
        const found = findMenuById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const removeMenuFromTree = (items: MenuItem[], id: string): MenuItem[] => {
    return items.filter(item => {
      if (item.menuId === id) return false;
      if (item.children) {
        item.children = removeMenuFromTree(item.children, id);
      }
      return true;
    });
  };

  const insertAsChild = (items: MenuItem[], targetId: string, menu: MenuItem): MenuItem[] => {
    return items.map(item => {
      if (item.menuId === targetId) {
        return {
          ...item,
          hasChildren: true,
          children: [
            ...(item.children || []),
            { ...menu, upperMenuId: targetId, menuLevel: item.menuLevel + 1 }
          ]
        };
      }
      if (item.children) {
        return { ...item, children: insertAsChild(item.children, targetId, menu) };
      }
      return item;
    });
  };

  const insertAtPosition = (items: MenuItem[], targetId: string, menu: MenuItem, position: 'before' | 'after'): MenuItem[] => {
    const result: MenuItem[] = [];
    for (const item of items) {
      if (item.menuId === targetId) {
        if (position === 'before') {
          result.push({ ...menu, upperMenuId: item.upperMenuId, menuLevel: item.menuLevel });
          result.push(item);
        } else {
          result.push(item);
          result.push({ ...menu, upperMenuId: item.upperMenuId, menuLevel: item.menuLevel });
        }
      } else {
        if (item.children) {
          result.push({ ...item, children: insertAtPosition(item.children, targetId, menu, position) });
        } else {
          result.push(item);
        }
      }
    }
    return result;
  };

  const handleDragStart = (e: React.DragEvent, menu: MenuItem) => {
    setDragState({
      menuId: menu.menuId,
      originalParentId: menu.upperMenuId,
      originalSortOrder: menu.sortOrder
    });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetMenu: MenuItem) => {
    e.preventDefault();
    if (!dragState || dragState.menuId === targetMenu.menuId) return;
    setDragOverId(targetMenu.menuId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetMenu: MenuItem, position: 'before' | 'after' | 'child') => {
    e.preventDefault();
    if (!dragState) return;

    const menuToMove = findMenuById(menus, dragState.menuId);
    if (!menuToMove) return;

    let newMenus = removeMenuFromTree(menus, dragState.menuId);

    if (position === 'child') {
      newMenus = insertAsChild(newMenus, targetMenu.menuId, menuToMove);
    } else {
      newMenus = insertAtPosition(newMenus, targetMenu.menuId, menuToMove, position);
    }

    setMenus(newMenus);
    setHasChanges(true);
    setDragState(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDragOverId(null);
  };

  const handleSave = async () => {
    try {
      const flattenedMenus = flattenMenus(menus);
      await fetch('/api/menu/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flattenedMenus),
      });
      setHasChanges(false);
      loadMenus();
    } catch (error) {
      console.error('Failed to save menu order:', error);
    }
  };

  const flattenMenus = (items: MenuItem[], result: Partial<MenuItem>[] = []): Partial<MenuItem>[] => {
    for (const item of items) {
      result.push({
        menuId: item.menuId,
        upperMenuId: item.upperMenuId,
        sortOrder: item.sortOrder
      });
      if (item.children) {
        flattenMenus(item.children, result);
      }
    }
    return result;
  };

  const handleNewMenu = (parentId: string | null = null) => {
    const newMenu: MenuItem = {
      menuId: '',
      upperMenuId: parentId,
      menuNm: '새 메뉴',
      menuDc: '',
      menuPath: '',
      menuUrl: '',
      sortOrder: 0,
      menuLevel: parentId ? (findMenuById(menus, parentId)?.menuLevel || 0) + 1 : 1,
      menuGroupId: 'GNRL',
      createScreen: true,
      screenTemplateType: 'admin',
    };
    setSelectedMenu(newMenu);
  };

  const colors = theme.colors;
  const borderRadius = theme.borderRadius;
  const borderColor = colors.border;
  const primaryColor = colors.primary;
  const textColor = colors.text;
  const textSecondaryColor = colors.textSecondary;
  const surfaceBg = '#f8f9fa';
  const cardBg = '#ffffff';

  const renderMenuTree = (items: MenuItem[], level = 0): React.ReactNode => {
    return items.map((item) => (
      <div key={item.menuId}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragOver={(e) => handleDragOver(e, item)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item, 'before')}
          onDragEnd={handleDragEnd}
          onClick={() => setSelectedMenu(item)}
          style={{
            padding: '10px 12px',
            margin: '2px 0',
            borderRadius: borderRadius.md,
            background: selectedMenu?.menuId === item.menuId
              ? primaryColor + '15'
              : dragOverId === item.menuId
                ? primaryColor + '10'
                : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderLeft: level > 0 ? `3px solid ${level === 1 ? primaryColor + '40' : borderColor}` : 'none',
            opacity: dragState?.menuId === item.menuId ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
          className="hover:bg-gray-100"
        >
          {item.hasChildren || (item.children && item.children.length > 0) ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(item.menuId);
              }}
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: textSecondaryColor,
              }}
            >
              <span style={{
                transform: item.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '14px',
              }}>
                ▶
              </span>
            </button>
          ) : (
            <span style={{ width: '20px', height: '20px' }} />
          )}

          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: item.menuLevel === 1 ? primaryColor : textSecondaryColor,
            flexShrink: 0,
          }} />

          <span style={{
            flex: 1,
            color: textColor,
            fontWeight: item.menuLevel === 1 ? 600 : 400,
            fontSize: item.menuLevel === 1 ? '14px' : '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.menuNm}
          </span>

          <span style={{
            color: textSecondaryColor,
            fontSize: '11px',
            fontFamily: 'monospace',
            backgroundColor: surfaceBg,
            padding: '2px 6px',
            borderRadius: borderRadius.sm,
          }}>
            {item.menuPath || '/'}
          </span>
        </div>

        {item.expanded && item.children && item.children.length > 0 && (
          <div style={{ marginLeft: level > 0 ? '16px' : '0' }}>
            {renderMenuTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: surfaceBg,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: `1px solid ${borderColor}`,
        backgroundColor: cardBg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 700,
            color: textColor,
          }}>
            메뉴 관리
          </h2>
          <span style={{
            fontSize: '12px',
            color: textSecondaryColor,
            backgroundColor: surfaceBg,
            padding: '4px 8px',
            borderRadius: '9999px',
          }}>
            {menus.length} 개 메뉴
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button size="sm" variant="ghost" onClick={expandAll}>
            전체 펼치기
          </Button>
          <Button size="sm" variant="ghost" onClick={collapseAll}>
            전체 접기
          </Button>
          <div style={{ width: '1px', height: '24px', backgroundColor: borderColor, margin: '0 4px' }} />
          <Button size="sm" variant="primary" onClick={handleSave} disabled={!hasChanges}>
            {hasChanges ? '변경사항 저장' : '저장됨'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Menu Tree Panel */}
        <div style={{
          width: '480px',
          borderRight: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: cardBg,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${borderColor}`,
            backgroundColor: surfaceBg,
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: textColor,
            }}>
              메뉴 트리
            </span>
            <Button size="sm" variant="secondary" onClick={() => handleNewMenu(null)}>
              + 상위 메뉴 추가
            </Button>
          </div>

          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px',
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: textSecondaryColor,
              }}>
                로딩 중...
              </div>
            ) : menus.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: textSecondaryColor,
                gap: '12px',
              }}>
                <span style={{ fontSize: '32px', opacity: 0.5 }}>📁</span>
                <span>메뉴가 없습니다. 상위 메뉴 추가를 클릭하세요.</span>
              </div>
            ) : (
              <div>
                {renderMenuTree(menus)}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          backgroundColor: surfaceBg,
        }}>
          {selectedMenu ? (
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                    {selectedMenu.menuId ? '메뉴 수정' : '메뉴 생성'}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMenu(null)}
                    >
                      닫기
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        메뉴 ID
                      </label>
                      <input
                        type="text"
                        value={selectedMenu.menuId || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                          backgroundColor: surfaceBg,
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        메뉴명
                      </label>
                      <input
                        type="text"
                        value={selectedMenu.menuNm || ''}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, menuNm: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: textSecondaryColor,
                    }}>
                      설명
                    </label>
                    <textarea
                      value={selectedMenu.menuDc || ''}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, menuDc: e.target.value })}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${borderColor}`,
                        borderRadius: borderRadius.md,
                        fontSize: '13px',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        메뉴 경로
                      </label>
                      <input
                        type="text"
                        value={selectedMenu.menuPath || ''}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, menuPath: e.target.value })}
                        placeholder="/admin/menu"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        API URL
                      </label>
                      <input
                        type="text"
                        value={selectedMenu.menuUrl || ''}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, menuUrl: e.target.value })}
                        placeholder="/api/menu"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        상위 메뉴
                      </label>
                      <select
                        value={selectedMenu.upperMenuId || ''}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, upperMenuId: e.target.value || null })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      >
                        <option value="">상위 메뉴 없음</option>
                        {menus.map((m) => (
                          <option key={m.menuId} value={m.menuId}>{m.menuNm}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        메뉴 그룹
                      </label>
                      <select
                        value={selectedMenu.menuGroupId || 'GNRL'}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, menuGroupId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      >
                        {groups.map((g) => (
                          <option key={g.menuGroupId} value={g.menuGroupId}>{g.menuGroupNm}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: textSecondaryColor,
                      }}>
                        정렬 순서
                      </label>
                      <input
                        type="number"
                        value={selectedMenu.sortOrder || 0}
                        onChange={(e) => setSelectedMenu({ ...selectedMenu, sortOrder: parseInt(e.target.value) || 0 })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: borderRadius.md,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: textSecondaryColor,
              gap: '12px',
            }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>👆</span>
              <span>좌측에서 메뉴를 선택하거나 새로 추가하세요</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuManagementPage;