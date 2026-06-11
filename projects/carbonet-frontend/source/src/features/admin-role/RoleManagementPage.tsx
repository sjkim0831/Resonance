import React, { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardBody, CardFooter, Modal } from '../../common/ui';
import { useTheme } from '../../common/ui/hooks/useTheme';

interface Role {
  authorCode: string;
  authorNm: string;
  authorDc: string;
  authorTyCode: string;
  sortOrder: number;
  useAt: string;
}

interface MenuItem {
  menuId: string;
  menuNm: string;
  menuPath: string;
  children?: MenuItem[];
}

const RoleManagementPage: React.FC = () => {
  const { theme } = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleMenus, setRoleMenus] = useState<Set<string>>(new Set());
  const [allMenus, setAllMenus] = useState<MenuItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoles();
    loadMenuTree();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/roles');
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuTree = async () => {
    try {
      const res = await fetch('/api/menu/tree');
      const data = await res.json();
      setAllMenus(data);
    } catch (err) {
      console.error('Failed to load menus:', err);
    }
  };

  const loadRoleMenus = async (authorCode: string) => {
    try {
      const res = await fetch(`/api/auth/roles/${authorCode}/menus`);
      const data = await res.json();
      setRoleMenus(new Set(data));
    } catch (err) {
      console.error('Failed to load role menus:', err);
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditing(false);
    loadRoleMenus(role.authorCode);
  };

  const handleNewRole = () => {
    setSelectedRole({
      authorCode: '',
      authorNm: '',
      authorDc: '',
      authorTyCode: 'USER',
      sortOrder: roles.length + 1,
      useAt: 'Y',
    });
    setRoleMenus(new Set());
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      const method = selectedRole.authorCode ? 'PUT' : 'POST';
      const url = selectedRole.authorCode
        ? `/api/auth/roles/${selectedRole.authorCode}`
        : '/api/auth/roles';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRole),
      });
      setIsEditing(false);
      loadRoles();
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole?.authorCode) return;
    if (confirm('역할을 삭제하시겠습니까?')) {
      try {
        await fetch(`/api/auth/roles/${selectedRole.authorCode}`, { method: 'DELETE' });
        setSelectedRole(null);
        loadRoles();
      } catch (err) {
        console.error('Failed to delete role:', err);
      }
    }
  };

  const handleSaveMenus = async () => {
    if (!selectedRole?.authorCode) return;
    try {
      await fetch(`/api/auth/roles/${selectedRole.authorCode}/menus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(roleMenus)),
      });
      setIsMenuModalOpen(false);
    } catch (err) {
      console.error('Failed to save menus:', err);
    }
  };

  const toggleMenu = (menuId: string) => {
    const newMenus = new Set(roleMenus);
    if (newMenus.has(menuId)) {
      newMenus.delete(menuId);
    } else {
      newMenus.add(menuId);
    }
    setRoleMenus(newMenus);
  };

  const renderMenuTree = (items: MenuItem[], depth = 0) => {
    return items.map((item) => (
      <div key={item.menuId}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 0',
            paddingLeft: depth * 20,
          }}
        >
          <input
            type="checkbox"
            checked={roleMenus.has(item.menuId)}
            onChange={() => toggleMenu(item.menuId)}
          />
          <span style={{ color: theme.colors.text }}>{item.menuNm}</span>
          <span style={{ color: theme.colors.textSecondary, fontSize: '12px' }}>
            {item.menuPath}
          </span>
        </div>
        {item.children && renderMenuTree(item.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div style={{ padding: theme.spacing.lg }}>
      <div style={{ display: 'flex', gap: theme.spacing.lg }}>
        <Card style={{ flex: 1, maxWidth: '350px' }}>
          <CardHeader>
            <h3 style={{ margin: 0 }}>역할 목록</h3>
            <Button size="sm" onClick={handleNewRole}>+ 추가</Button>
          </CardHeader>
          <CardBody style={{ maxHeight: '600px', overflow: 'auto' }}>
            {loading ? (
              <p>로딩 중...</p>
            ) : (
              roles.map((role) => (
                <div
                  key={role.authorCode}
                  onClick={() => handleSelectRole(role)}
                  style={{
                    padding: '12px',
                    margin: '4px 0',
                    borderRadius: theme.borderRadius.sm,
                    background: selectedRole?.authorCode === role.authorCode
                      ? theme.colors.primary + '20'
                      : 'transparent',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${
                      selectedRole?.authorCode === role.authorCode
                        ? theme.colors.primary
                        : 'transparent'
                    }`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: theme.colors.text }}>
                    {role.authorNm}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                    {role.authorCode}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card style={{ flex: 2 }}>
          <CardHeader>
            <h3 style={{ margin: 0 }}>
              {isEditing
                ? selectedRole?.authorCode
                  ? '역할 수정'
                  : '역할 생성'
                : '역할 상세'}
            </h3>
          </CardHeader>
          <CardBody>
            {selectedRole && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                <div style={{ display: 'flex', gap: theme.spacing.md }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      역할 코드
                    </label>
                    <input
                      type="text"
                      value={selectedRole.authorCode || ''}
                      onChange={(e) =>
                        setSelectedRole({ ...selectedRole, authorCode: e.target.value })
                      }
                      disabled={!!selectedRole.authorCode}
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
                      역할 명
                    </label>
                    <input
                      type="text"
                      value={selectedRole.authorNm || ''}
                      onChange={(e) =>
                        setSelectedRole({ ...selectedRole, authorNm: e.target.value })
                      }
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                    설명
                  </label>
                  <textarea
                    value={selectedRole.authorDc || ''}
                    onChange={(e) =>
                      setSelectedRole({ ...selectedRole, authorDc: e.target.value })
                    }
                    rows={2}
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
                      유형
                    </label>
                    <select
                      value={selectedRole.authorTyCode || 'USER'}
                      onChange={(e) =>
                        setSelectedRole({ ...selectedRole, authorTyCode: e.target.value })
                      }
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    >
                      <option value="SYSTEM">시스템</option>
                      <option value="BUSINESS">업무</option>
                      <option value="USER">사용자</option>
                      <option value="GUEST">게스트</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: theme.colors.textSecondary }}>
                      정렬 순서
                    </label>
                    <input
                      type="number"
                      value={selectedRole.sortOrder || 0}
                      onChange={(e) =>
                        setSelectedRole({
                          ...selectedRole,
                          sortOrder: parseInt(e.target.value),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                      }}
                    />
                  </div>
                </div>

                {!isEditing && selectedRole.authorCode && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: theme.colors.textSecondary }}>
                      접근 가능 메뉴 ({roleMenus.size}개)
                    </label>
                    <Button size="sm" variant="secondary" onClick={() => setIsMenuModalOpen(true)}>
                      메뉴 권한 설정
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardBody>
          <CardFooter>
            <Button variant="secondary" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? '취소' : '수정'}
            </Button>
            {isEditing && (
              <>
                <Button variant="primary" onClick={handleSave}>
                  저장
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={!selectedRole?.authorCode}
                >
                  삭제
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      <Modal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        title="메뉴 권한 설정"
        size="lg"
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {renderMenuTree(allMenus)}
        </div>
        <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setIsMenuModalOpen(false)}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSaveMenus}>
            저장
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagementPage;