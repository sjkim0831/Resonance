import {
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
} from './actorProcessWorkspaces';
import {
  ControlCapability,
  ControlMigrationStatus,
  RESONANCE_CONTROL_ASSETS,
} from './controlAssetRegistry';

export type CutoverReadiness = ControlMigrationStatus;

export type CutoverLedgerEntry = {
  assetId: string;
  category: 'ACTOR_PROCESS_TAB' | 'SYSTEM_MANAGEMENT';
  sourceRoute: string;
  sourceName: string;
  targetRoute: string;
  targetPlugin: string;
  migrationStatus: CutoverReadiness;
  implementation: 'SHELL' | 'PARTIAL' | 'NATIVE';
  capabilities: ControlCapability[];
  apiContracts: string[];
  databaseContracts: string[];
  permissionContracts: string[];
  testEvidence: string[];
  cutoverBlockedBy: string[];
};

const targetRouteByPlugin: Record<string, string> = {
  'ccus-screen-designs/actor-process-control': '/actor-process-control',
  'ccus-screen-designs/design-assets': '/design-assets',
  'ccus-screen-designs/screen-designs': '/ccus-screen-designs',
  'ccus-screen-designs/screen-space': '/ccus-screen-space',
  'ccus-screen-designs/project-control': '/resonance-projects',
  'ccus-screen-designs/system-operations': '/system-operations',
  'ccus-screen-designs/system-development': '/system-development',
  'ccus-screen-designs/system-security': '/system-security',
  'ccus-screen-designs/system-recovery': '/system-recovery',
  'ccus-screen-designs/control-plane': '/resonance-control-assets',
};

const actorProcessEntries: CutoverLedgerEntry[] =
  ACTOR_PROCESS_WORKSPACES.flatMap(workspace =>
    workspace.tabs.map(tab => ({
      assetId: `actor-process:${workspace.id}:${tab.id}`,
      category: 'ACTOR_PROCESS_TAB' as const,
      sourceRoute: `/admin/system/actor-process?workspace=${workspace.id}&tab=${tab.id}`,
      sourceName: `${workspace.label} / ${tab.label}`,
      targetRoute: `/actor-process-${workspace.id}?tab=${tab.id}`,
      targetPlugin: `ccus-screen-designs/actor-process-${workspace.id}`,
      migrationStatus: 'NATIVE_READY' as const,
      implementation: 'NATIVE' as const,
      capabilities: [
        workspace.id === 'design'
          ? 'DESIGN'
          : workspace.id === 'delivery'
          ? 'DEVELOPMENT'
          : workspace.id === 'verify'
          ? 'DESIGN'
          : 'OPERATIONS',
      ],
      apiContracts: [
        'GET /api/resonance-projects',
        'POST /api/resonance-projects/actor-process/designs',
      ],
      databaseContracts: ['framework_actor_process_design_release'],
      permissionContracts: ['BACKSTAGE_ACTOR_PROCESS_OPERATOR'],
      testEvidence: ['actor-process-workspace-contract'],
      cutoverBlockedBy: ['인증 사용자 E2E 검증 필요'],
    })),
  );

const systemEntries: CutoverLedgerEntry[] = RESONANCE_CONTROL_ASSETS.filter(
  asset =>
    asset.ownershipLane === 'BACKSTAGE_NATIVE' &&
    asset.routePath.startsWith('/admin/') &&
    asset.routePath !== '/admin/system/actor-process',
).map(asset => {
  const native = asset.migrationStatus === 'NATIVE_READY';
  return {
    assetId: `system-management:${asset.routePath}`,
    category: 'SYSTEM_MANAGEMENT',
    sourceRoute: asset.routePath,
    sourceName: asset.screenName,
    targetRoute:
      targetRouteByPlugin[asset.targetPlugin] ?? '/resonance-control-assets',
    targetPlugin: asset.targetPlugin,
    migrationStatus: asset.migrationStatus,
    implementation: native ? 'NATIVE' : 'SHELL',
    capabilities: asset.capabilities,
    apiContracts: asset.dataContracts.filter(contract =>
      /api|endpoint|command|query/i.test(contract),
    ),
    databaseContracts: asset.dataContracts.filter(
      contract => !/api|endpoint|command|query/i.test(contract),
    ),
    permissionContracts: asset.actorCodes,
    testEvidence: asset.requiredScenarios,
    cutoverBlockedBy: native
      ? ['인증 사용자 E2E 검증 필요']
      : ['Backstage 네이티브 기능 구현 필요', '인증 사용자 E2E 검증 필요'],
  } satisfies CutoverLedgerEntry;
});

type LegacySystemMenu = {
  menuCode: string;
  name: string;
  sourceRoute?: string;
  targetPlugin: keyof typeof targetRouteByPlugin;
  capabilities: ControlCapability[];
};

// The final A111 menu still contains query-addressed aliases for control-plane
// capabilities. They cannot be derived from the route catalog because the
// catalog intentionally normalizes query strings. Keep the aliases in the
// same reversible cutover ledger so no menu is hidden by an untracked SQL fix.
const legacySystemMenus: LegacySystemMenu[] = [
  {
    menuCode: 'A1110105',
    name: '메뉴·화면 연결',
    targetPlugin: 'ccus-screen-designs/design-assets',
    capabilities: ['DESIGN'],
  },
  {
    menuCode: 'A1110109',
    name: '빌더',
    targetPlugin: 'ccus-screen-designs/design-assets',
    capabilities: ['DESIGN', 'DEVELOPMENT'],
  },
  {
    menuCode: 'A1110198',
    name: 'Ops 통합 관제',
    sourceRoute: '/admin/system/ops-bridge',
    targetPlugin: 'ccus-screen-designs/system-operations',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110203',
    name: '함수 관리',
    targetPlugin: 'ccus-screen-designs/system-development',
    capabilities: ['DEVELOPMENT'],
  },
  {
    menuCode: 'A1110206',
    name: '컬럼·데이터 계약',
    targetPlugin: 'ccus-screen-designs/system-development',
    capabilities: ['DESIGN', 'DEVELOPMENT'],
  },
  {
    menuCode: 'A1110302',
    name: '접속 이력',
    targetPlugin: 'ccus-screen-designs/system-security',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110303',
    name: '로그인 이력',
    sourceRoute: '/admin/member/login_history',
    targetPlugin: 'ccus-screen-designs/system-security',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110304',
    name: '감사 로그',
    sourceRoute: '/admin/emission/audit-log',
    targetPlugin: 'ccus-screen-designs/system-security',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110306',
    name: '차단·허용 목록',
    targetPlugin: 'ccus-screen-designs/system-security',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110307',
    name: '개인정보 접근 이력',
    targetPlugin: 'ccus-screen-designs/system-security',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A11104',
    name: '운영·배포',
    targetPlugin: 'ccus-screen-designs/system-operations',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110403',
    name: '배치·스케줄',
    targetPlugin: 'ccus-screen-designs/system-operations',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110404',
    name: 'Git·빌드·배포',
    targetPlugin: 'ccus-screen-designs/system-operations',
    capabilities: ['OPERATIONS', 'DEVELOPMENT'],
  },
  {
    menuCode: 'A1110405',
    name: '버전 관리',
    targetPlugin: 'ccus-screen-designs/system-development',
    capabilities: ['DEVELOPMENT'],
  },
  {
    menuCode: 'A1110406',
    name: '백업·복구',
    targetPlugin: 'ccus-screen-designs/system-recovery',
    capabilities: ['OPERATIONS'],
  },
  {
    menuCode: 'A1110407',
    name: '외부 서비스 상태',
    targetPlugin: 'ccus-screen-designs/system-operations',
    capabilities: ['OPERATIONS'],
  },
];

const legacySystemEntries: CutoverLedgerEntry[] = legacySystemMenus.map(
  menu => ({
    assetId: `legacy-system-menu:${menu.menuCode}`,
    category: 'SYSTEM_MANAGEMENT',
    sourceRoute:
      menu.sourceRoute ?? `/admin/system/menu?menuCode=${menu.menuCode}`,
    sourceName: menu.name,
    targetRoute: targetRouteByPlugin[menu.targetPlugin],
    targetPlugin: menu.targetPlugin,
    migrationStatus: 'NATIVE_READY',
    implementation: 'NATIVE',
    capabilities: menu.capabilities,
    apiContracts: [],
    databaseContracts: ['comtnmenuinfo', 'comtnmenuorder'],
    permissionContracts: ['BACKSTAGE_CONTROL_PLANE_OPERATOR'],
    testEvidence: ['authenticated-backstage-route-smoke'],
    cutoverBlockedBy: ['인증 사용자 E2E 검증 필요'],
  }),
);

export const MIGRATION_CUTOVER_LEDGER = [
  ...actorProcessEntries,
  ...systemEntries,
  ...legacySystemEntries,
];

export const MIGRATION_CUTOVER_SUMMARY = {
  total: MIGRATION_CUTOVER_LEDGER.length,
  actorProcessTabs: ACTOR_PROCESS_TAB_COUNT,
  systemScreens: systemEntries.length + legacySystemEntries.length,
  nativeReady: MIGRATION_CUTOVER_LEDGER.filter(
    entry => entry.migrationStatus === 'NATIVE_READY',
  ).length,
  verified: MIGRATION_CUTOVER_LEDGER.filter(
    entry => entry.migrationStatus === 'VERIFIED',
  ).length,
  cutoverEligible: MIGRATION_CUTOVER_LEDGER.filter(
    entry =>
      entry.migrationStatus === 'VERIFIED' &&
      entry.implementation === 'NATIVE' &&
      entry.cutoverBlockedBy.length === 0,
  ).length,
};

export const toControlAssetPayload = (entry: CutoverLedgerEntry) => ({
  assetId: entry.assetId,
  routePath: entry.sourceRoute,
  screenName: entry.sourceName,
  ownershipLane: 'BACKSTAGE_NATIVE',
  migrationStatus: entry.migrationStatus,
  targetPlugin: entry.targetPlugin,
  capabilities: entry.capabilities,
  dependencyContracts: [
    ...entry.apiContracts,
    ...entry.databaseContracts,
    ...entry.permissionContracts,
  ],
});
