/**
 * Menu Management Page
 * 메뉴 관리 (CRUD, 트리 구조, 권한 매핑)
 */
import React, { useState, useEffect } from 'react';

// Use common UI components
import { Button, Card, CardHeader, CardBody, CardFooter } from '../../common/ui';
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
}

interface MenuGroup {
  menuGroupId: string;
  menuGroupNm: string;
  menuGroupDs: string;
  sortOrder: number;
}

const MenuManagementPage: React.FC = () => {
  const { theme } = useTheme();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMenus();
    loadGroups();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/menu/tree');
      const data = await response.json();
      setMenus(data);
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

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedMenu(menu);
    setIsEditing(false);
  };

  const handleNewMenu = () => {
    setSelectedMenu({
      menuId: '',
      upperMenuId: null,
      menuNm: '',
      menuDc: '',
      menuPath: '',
      menuUrl: '',
      sortOrder: 0,
      menuLevel: 1,
      menuGroupId: 'GNRL',
      createScreen: true,
      screenTemplateType: 'admin',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const method = selectedMenu?.menuId ? 'PUT' : 'POST';
      const url = selectedMenu?.menuId 
        ? `/api/menu/${selectedMenu.menuId}` 
        : '/api/menu';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedMenu),
      });
      
      setIsEditing(false);
      loadMenus();
    } catch (error) {
      console.error('Failed to save menu:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedMenu?.menuId) return;
    
    if (confirm('메뉴를 삭제하시겠습니까?')) {
      try {
        await fetch(`/api/menu/${selectedMenu.menuId}`, { method: 'DELETE' });
        setSelectedMenu(null);
        loadMenus();
      } catch (error) {
        console.error('Failed to delete menu:', error);
      }
    }
  };

  // Render menu tree recursively
  const renderMenuTree = (items: MenuItem[], level = 0) => {
    return items.map((item) => (
      <div key={item.menuId} style={{ paddingLeft: level * 20 }}>
        <div
          onClick={() => handleMenuClick(item)}
          style={{
            padding: '8px 12px',
            margin: '4px 0',
            borderRadius: theme.borderRadius.sm,
            background: selectedMenu?.menuId === item.menuId 
              ? theme.colors.primary + '20' 
              : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderLeft: level > 0 ? `3px solid ${theme.colors.border}` : 'none',
          }}
        >
          <span style={{ 
            color: theme.colors.text,
            fontWeight: item.menuLevel === 1 ? 'bold' : 'normal',
          }}>
            {item.menuNm}
          </span>
          <span style={{ color: theme.colors.textSecondary, fontSize: '12px' }}>
            {item.menuPath}
          </span>
        </div>
        {item.children && renderMenuTree(item.children, level + 1)}
      </div>
    ));
  };

  return (
    <div style={{ padding: theme.spacing.lg }}>
      <div style={{ display: 'flex', gap: theme.spacing.lg }}>
        {/* Menu Tree Panel */}
        <Card style={{ flex: 1, maxWidth: '400px' }}>
          <CardHeader>
            <h3 style={{ margin: 0 }}>메뉴 트리</h3>
            <Button size="sm" onClick={handleNewMenu}>
              +新增
            </Button>
          </CardHeader>
          <CardBody style={{ maxHeight: '600px', overflow: 'auto' }}>
            {loading ? (
              <p>로딩 중...</p>
            ) : (
              renderMenuTree(menus)
            )}
          </CardBody>
        </Card>

        {/* Menu Detail/Edit Panel */}
        <Card style={{ flex: 2 }}>
          <CardHeader>
            <h3 style={{ margin: 0 }}>
              {isEditing 
                ? (selectedMenu?.menuId ? '메뉴 수정' : '메뉴 생성') 
                : '메뉴 상세'}
            </h3>
          </CardHeader>
          <CardBody>
            {selectedMenu && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                    메뉴 ID
                  </label>
                  <input
                    type="text"
                    value={selectedMenu.menuId || ''}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, menuId: e.target.value })}
                    disabled={!!selectedMenu.menuId}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.sm,
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                    메뉴명
                  </label>
                  <input
                    type="text"
                    value={selectedMenu.menuNm || ''}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, menuNm: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.sm,
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                    설명
                  </label>
                  <textarea
                    value={selectedMenu.menuDc || ''}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, menuDc: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.sm,
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: theme.spacing.md }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      메뉴 경로
                    </label>
                    <input
                      type="text"
                      value={selectedMenu.menuPath || ''}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, menuPath: e.target.value })}
                      placeholder="/admin/menu"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      API URL
                    </label>
                    <input
                      type="text"
                      value={selectedMenu.menuUrl || ''}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, menuUrl: e.target.value })}
                      placeholder="/api/menu"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: theme.spacing.md }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      상위 메뉴
                    </label>
                    <select
                      value={selectedMenu.upperMenuId || ''}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, upperMenuId: e.target.value || null })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    >
                      <option value="">상위 메뉴 없음</option>
                      {menus.map((m) => (
                        <option key={m.menuId} value={m.menuId}>
                          {m.menuNm}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      메뉴 그룹
                    </label>
                    <select
                      value={selectedMenu.menuGroupId || 'GNRL'}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, menuGroupId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    >
                      {groups.map((g) => (
                        <option key={g.menuGroupId} value={g.menuGroupId}>
                          {g.menuGroupNm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: theme.spacing.md }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      정렬 순서
                    </label>
                    <input
                      type="number"
                      value={selectedMenu.sortOrder || 0}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, sortOrder: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  padding: theme.spacing.md,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: '#f9fafb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                    <input
                      type="checkbox"
                      id="createScreen"
                      checked={selectedMenu.createScreen ?? true}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, createScreen: e.target.checked })}
                      disabled={!!selectedMenu.pageId}
                    />
                    <label htmlFor="createScreen" style={{ cursor: 'pointer' }}>
                      Screen Builder 화면 생성
                    </label>
                    {selectedMenu.pageId && (
                      <span style={{
                        fontSize: '12px',
                        color: '#10b981',
                        backgroundColor: '#10b98120',
                        padding: '2px 8px',
                        borderRadius: theme.borderRadius.sm,
                      }}>
                        생성됨: {selectedMenu.pageId}
                      </span>
                    )}
                  </div>

                  {selectedMenu.createScreen && (
                    <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                          화면 템플릿
                        </label>
                        <select
                          value={selectedMenu.screenTemplateType || 'admin'}
                          onChange={(e) => setSelectedMenu({ ...selectedMenu, screenTemplateType: e.target.value })}
                          disabled={!!selectedMenu.pageId}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.borderRadius.sm,
                          }}
                        >
                          <option value="admin">Admin (관리자)</option>
                          <option value="form">Form (입력表单)</option>
                          <option value="list">List (목록)</option>
                          <option value="detail">Detail (상세)</option>
                          <option value="dashboard">Dashboard (대시보드)</option>
                        </select>
                      </div>
                      {selectedMenu.pageId && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const screenBuilderUrl = `/admin/system/builder-studio?menuCode=${selectedMenu.menuId}&pageId=${selectedMenu.pageId}&menuTitle=${encodeURIComponent(selectedMenu.menuNm || '')}&menuUrl=${encodeURIComponent(selectedMenu.menuUrl || '')}`;
                              window.open(screenBuilderUrl, '_blank');
                            }}
                          >
                            화면 편집 열기
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardBody>
          <CardFooter>
            <Button variant="secondary" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? '取消' : '수정'}
            </Button>
            {isEditing && (
              <>
                <Button variant="primary" onClick={handleSave}>
                  저장
                </Button>
                <Button variant="ghost" onClick={handleDelete} disabled={!selectedMenu?.menuId}>
                  삭제
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default MenuManagementPage;
