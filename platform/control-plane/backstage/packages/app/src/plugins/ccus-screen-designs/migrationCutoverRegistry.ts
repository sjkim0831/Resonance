import { ACTOR_PROCESS_WORKSPACES } from './actorProcessWorkspaces';

export type CutoverReadiness =
  | 'DISCOVERED'
  | 'CLASSIFIED'
  | 'NATIVE_READY'
  | 'MIGRATED'
  | 'VERIFIED'
  | 'RETIRED_SOURCE';

export type CutoverLedgerEntry = {
  assetId: string;
  category: 'ACTOR_PROCESS_TAB' | 'SYSTEM_MANAGEMENT';
  sourceRoute: string;
  sourceName: string;
  targetRoute: string;
  targetPlugin: string;
  migrationStatus: CutoverReadiness;
  implementation: 'SHELL' | 'PARTIAL' | 'NATIVE';
  apiContracts: string[];
  databaseContracts: string[];
  permissionContracts: string[];
  testEvidence: string[];
  cutoverBlockedBy: string[];
};

const actorProcessEntries: CutoverLedgerEntry[] =
  ACTOR_PROCESS_WORKSPACES.flatMap(workspace =>
    workspace.tabs.map(tab => ({
      assetId: `actor-process:${workspace.id}:${tab.id}`,
      category: 'ACTOR_PROCESS_TAB' as const,
      sourceRoute: `/admin/system/actor-process?workspace=${workspace.id}&tab=${tab.id}`,
      sourceName: `${workspace.label} / ${tab.label}`,
      targetRoute: `/actor-process-control?workspace=${workspace.id}&tab=${tab.id}`,
      targetPlugin: 'ccus-screen-designs/actor-process-control',
      migrationStatus: 'CLASSIFIED' as const,
      implementation: 'SHELL' as const,
      apiContracts: [],
      databaseContracts: [],
      permissionContracts: [],
      testEvidence: [],
      cutoverBlockedBy: [
        '실행 API 계약 미등록',
        'DB 계약 미등록',
        '권한 정책 미등록',
        '인증 사용자 E2E 증적 없음',
      ],
    })),
  );

const remainingSystemScreens = [
  ['/admin/system/backup', '백업 관리'],
  ['/admin/system/backup_config', '백업 설정'],
  ['/admin/system/batch', '배치 관리'],
  ['/admin/system/consent-history', '동의 이력'],
  ['/admin/system/db-promotion-policy', 'DB 승격 정책'],
  ['/admin/system/db-sync-deploy', 'DB 동기화·배포'],
  ['/admin/system/error-log', '오류 로그'],
  ['/admin/system/infra', '인프라 관리'],
  ['/admin/system/notification', '알림 관리'],
  ['/admin/system/restore', '복구 관리'],
  [
    '/admin/system/screen-menu-assignment-management',
    '화면·메뉴 연결 관리',
  ],
] as const;

const recoveryRoutes = new Set([
  '/admin/system/backup',
  '/admin/system/backup_config',
  '/admin/system/db-promotion-policy',
  '/admin/system/db-sync-deploy',
  '/admin/system/restore',
]);

const systemEntries: CutoverLedgerEntry[] = remainingSystemScreens.map(
  ([route, name]) => ({
    assetId: `system-management:${route.split('/').pop()}`,
    category: 'SYSTEM_MANAGEMENT',
    sourceRoute: route,
    sourceName: name,
    targetRoute: recoveryRoutes.has(route)
      ? '/system-recovery'
      : '/system-operations',
    targetPlugin: recoveryRoutes.has(route)
      ? 'ccus-screen-designs/system-recovery'
      : 'ccus-screen-designs/system-operations',
    migrationStatus: 'CLASSIFIED',
    implementation: 'SHELL',
    apiContracts: [],
    databaseContracts: [],
    permissionContracts: [],
    testEvidence: [],
    cutoverBlockedBy: [
      'Backstage 네이티브 기능 미검증',
      '인증 사용자 E2E 증적 없음',
      '원본 메뉴 숨김·리다이렉트 비활성',
    ],
  }),
);

export const MIGRATION_CUTOVER_LEDGER = [
  ...actorProcessEntries,
  ...systemEntries,
];

export const MIGRATION_CUTOVER_SUMMARY = {
  total: MIGRATION_CUTOVER_LEDGER.length,
  actorProcessTabs: actorProcessEntries.length,
  systemScreens: systemEntries.length,
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
  capabilities: ['OPERATIONS', 'DESIGN', 'DEVELOPMENT'],
  dependencyContracts: [
    ...entry.apiContracts,
    ...entry.databaseContracts,
    ...entry.permissionContracts,
  ],
});
