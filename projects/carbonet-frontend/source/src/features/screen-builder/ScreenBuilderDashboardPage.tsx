/**
 * Screen Builder Dashboard
 * Screen Builder 관리 대시보드 - 화면 관리와 통합
 */
import { useState, useEffect, useMemo } from 'react';
import { useAsyncValue } from '../../app/hooks/useAsyncValue';
import { AdminPageShell } from '../admin-entry/AdminPageShell';
import {
  buildScreenBuilderPath,
  buildScreenManagementPath
} from './screenBuilderPaths';
import {
  listRouteOwnershipTraces,
  type RouteOwnershipTrace
} from '../../app/routes/routeCatalog';
import { fetchScreenCommandPage } from '../../lib/api/platform';
import type { ScreenCommandPagePayload } from '../../lib/api/platformTypes';
import { isEnglish } from '../../lib/navigation/runtime';
import { GovernanceCompressionNav } from '../admin-system/GovernanceCompressionNav';
import { AdminWorkspacePageFrame } from '../admin-ui/pageFrames';
import { AdminInput, AdminSelect, MemberButton } from '../member/common';
import { SummaryMetricCard, PageStatusNotice } from '../admin-ui/common';

interface DashboardScreen {
  routeId: string;
  pageId: string;
  menuCode: string;
  routePath: string;
  menuTitle: string;
  status: 'registered' | 'unregistered' | 'has-screen';
  nodeCount: number;
  eventCount: number;
  updatedAt: string;
}

function buildDashboardScreens(
  routeTraces: RouteOwnershipTrace[],
  screenPages?: ScreenCommandPagePayload["pages"]
): DashboardScreen[] {
  const pageMap = new Map<string, ScreenCommandPagePayload["pages"][number]>();
  (screenPages || []).forEach((page) => {
    if (page.menuCode) pageMap.set(page.menuCode.toUpperCase(), page);
    if (page.pageId) pageMap.set(page.pageId, page);
  });

  return routeTraces.map((trace): DashboardScreen => {
    const menuCode = trace.menuCode || "";
    const pageId = trace.pageId || "";
    const matched = pageMap.get(menuCode.toUpperCase()) || pageMap.get(pageId);

    let status: DashboardScreen["status"] = "unregistered";
    if (matched) status = "has-screen";
    else if (menuCode) status = "registered";

    return {
      routeId: trace.routeId,
      pageId: pageId,
      menuCode: menuCode,
      routePath: trace.canonicalRoute,
      menuTitle: trace.routeLabel || trace.routeId,
      status,
      nodeCount: 0,
      eventCount: 0,
      updatedAt: ''
    };
  });
}

export function ScreenBuilderDashboardPage() {
  const en = isEnglish();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has-screen' | 'registered' | 'unregistered'>('all');
  const [screens, setScreens] = useState<DashboardScreen[]>([]);
  const [loading, setLoading] = useState(true);

  const routeTraces = useMemo(() => listRouteOwnershipTraces(), []);

  const screenPayload = useAsyncValue<ScreenCommandPagePayload>(
    () => fetchScreenCommandPage(""),
    []
  );

  useEffect(() => {
    const data = buildDashboardScreens(routeTraces, screenPayload.value?.pages);
    setScreens(data);
    setLoading(false);
  }, [routeTraces, screenPayload.value]);

  const filteredScreens = useMemo(() => {
    let result = [...screens];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.menuTitle.toLowerCase().includes(term) ||
        s.routeId.toLowerCase().includes(term) ||
        s.menuCode.toLowerCase().includes(term) ||
        s.routePath.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    return result;
  }, [screens, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: screens.length,
    hasScreen: screens.filter(s => s.status === 'has-screen').length,
    registered: screens.filter(s => s.status === 'registered').length,
    unregistered: screens.filter(s => s.status === 'unregistered').length,
  }), [screens]);

  const handleOpenBuilder = (screen: DashboardScreen) => {
    const url = buildScreenBuilderPath({
      menuCode: screen.menuCode || screen.routeId,
      pageId: screen.pageId,
      menuTitle: screen.menuTitle,
      menuUrl: screen.routePath,
    });
    window.location.href = url;
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Environment" : "환경" },
        { label: en ? "Screen Builder" : "스크린 빌더" }
      ]}
      title={en ? "Screen Builder Dashboard" : "스크린 빌더 대시보드"}
    >
      <GovernanceCompressionNav activeId="screen-builder" en={en} />
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="info">
          <div className="text-sm text-[var(--kr-gov-text-secondary)]">
            {en
              ? "Manage all screens in the system. Select a screen to edit with Screen Builder or create new screens."
              : "시스템 내 모든 화면을 관리합니다. 화면을 선택하여 스크린 빌더로 편집하거나 새 화면을 생성하세요."}
          </div>
        </PageStatusNotice>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryMetricCard
            title={en ? "Total Screens" : "전체 화면"}
            value={stats.total}
            accentClassName="bg-blue-50 border-blue-200"
            surfaceClassName="text-blue-800"
          />
          <SummaryMetricCard
            title={en ? "Has Screen" : "화면 있음"}
            value={stats.hasScreen}
            accentClassName="bg-emerald-50 border-emerald-200"
            surfaceClassName="text-emerald-800"
          />
          <SummaryMetricCard
            title={en ? "Menu Only" : "메뉴만 있음"}
            value={stats.registered}
            accentClassName="bg-amber-50 border-amber-200"
            surfaceClassName="text-amber-800"
          />
          <SummaryMetricCard
            title={en ? "Unregistered" : "미등록"}
            value={stats.unregistered}
            accentClassName="bg-gray-50 border-gray-200"
            surfaceClassName="text-gray-800"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <AdminSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-48"
          >
            <option value="all">{en ? "All Status" : "전체 상태"}</option>
            <option value="has-screen">{en ? "Has Screen" : "화면 있음"}</option>
            <option value="registered">{en ? "Menu Only" : "메뉴만 있음"}</option>
            <option value="unregistered">{en ? "Unregistered" : "미등록"}</option>
          </AdminSelect>
          <div className="flex-1">
            <AdminInput
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={en ? "Search screens..." : "화면 검색..."}
              value={searchTerm}
              className="w-full"
            />
          </div>
          <MemberButton
            onClick={() => {
              window.location.href = buildScreenManagementPath();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {en ? "Screen Management" : "화면 관리"}
          </MemberButton>
          <MemberButton
            onClick={() => handleOpenBuilder({
              routeId: 'new-screen',
              pageId: '',
              menuCode: '',
              routePath: '',
              menuTitle: en ? 'New Screen' : '새 화면',
              status: 'unregistered',
              nodeCount: 0,
              eventCount: 0,
              updatedAt: ''
            })}
            size="sm"
            type="button"
            variant="primary"
          >
            {en ? "+ New Screen" : "+ 새 화면"}
          </MemberButton>
        </div>

        {/* Screen List */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[var(--kr-gov-border-light)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">
                  {en ? "Screen" : "화면"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">
                  {en ? "Menu Code" : "메뉴코드"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">
                  {en ? "Status" : "상태"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">
                  {en ? "Components" : "컴포넌트"}
                </th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">
                  {en ? "Actions" : "작업"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--kr-gov-border-light)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]">
                    {en ? "Loading..." : "로딩 중..."}
                  </td>
                </tr>
              ) : filteredScreens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]">
                    {en ? "No screens found" : "화면을 찾을 수 없습니다"}
                  </td>
                </tr>
              ) : (
                filteredScreens.slice(0, 100).map((screen) => (
                  <tr key={screen.routeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--kr-gov-text-primary)]">
                        {screen.menuTitle}
                      </div>
                      <div className="text-xs text-[var(--kr-gov-text-secondary)]">
                        {screen.routePath}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {screen.menuCode || '-'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        screen.status === 'has-screen'
                          ? 'bg-emerald-100 text-emerald-800'
                          : screen.status === 'registered'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {screen.status === 'has-screen'
                          ? (en ? 'Screen' : '화면있음')
                          : screen.status === 'registered'
                          ? (en ? 'Menu' : '메뉴')
                          : (en ? 'None' : '없음')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {screen.nodeCount > 0 ? `🧩 ${screen.nodeCount}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MemberButton
                        onClick={() => handleOpenBuilder(screen)}
                        size="xs"
                        type="button"
                        variant={screen.status === 'has-screen' ? 'primary' : 'secondary'}
                      >
                        {screen.status === 'has-screen'
                          ? (en ? "Edit" : "편집")
                          : (en ? "Create" : "생성")}
                      </MemberButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredScreens.length > 100 && (
            <div className="px-4 py-3 text-center text-sm text-[var(--kr-gov-text-secondary)] border-t">
              {en ? `Showing 100 of ${filteredScreens.length} screens` : `${filteredScreens.length}개 중 100개 표시`}
            </div>
          )}
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default ScreenBuilderDashboardPage;