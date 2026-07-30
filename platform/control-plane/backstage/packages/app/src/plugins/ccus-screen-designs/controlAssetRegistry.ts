import {
  CCUS_SCREEN_DESIGN_CATALOG,
  CcusScreenDesignRecord,
} from './generatedCatalog';

export type ControlCapability = 'OPERATIONS' | 'DESIGN' | 'DEVELOPMENT';
export type ControlOwnershipLane =
  | 'BACKSTAGE_NATIVE'
  | 'RESONANCE_RUNTIME'
  | 'SHARED_RUNTIME';
export type ControlMigrationStatus =
  | 'DISCOVERED'
  | 'CLASSIFIED'
  | 'NATIVE_READY'
  | 'MIGRATED'
  | 'VERIFIED'
  | 'RETIRED_SOURCE';

export type ControlAssetRecord = CcusScreenDesignRecord & {
  capabilities: ControlCapability[];
  sourceUrl: string;
  ownershipLane: ControlOwnershipLane;
  migrationStatus: ControlMigrationStatus;
  targetPlugin: string;
  dependencyContracts: string[];
};

const rules: Record<ControlCapability, RegExp> = {
  OPERATIONS:
    /(monitor|operation|ops|status|health|log|audit|backup|restore|batch|cron|schedule|alert|incident|security|access|block|external|integration|deploy|release|runtime|database|db-|maintenance|usage|retry)/i,
  DESIGN:
    /(design|theme|section|component|css|layout|screen|page|flow|actor|process|scenario|task|schema|column|contract|menu|builder)/i,
  DEVELOPMENT:
    /(develop|build|code|api|function|controller|module|generator|asset|git|deploy|release|version|package|provision|studio)/i,
};

const controlPrefixes = [
  '/admin/system/',
  '/admin/external/',
  '/admin/monitoring/',
];

const backstageNativePattern =
  /(actor-process|design|theme|section|component|css|layout|screen|page|flow|scenario|task|schema|column|contract|menu|builder|develop|build|code|api|function|controller|module|generator|asset|git|deploy|release|version|package|provision|monitor|operation|ops|status|health|log|audit|backup|restore|batch|schedule|alert|incident|security|integration)/i;
const sharedRuntimePattern =
  /(theme|section|component|css|schema|column|contract|menu|permission|role|auth|code|classification|unit|conversion)/i;

const nativeDesignAssetRoutes = new Set([
  '/admin/system/theme-management',
  '/admin/system/css-management',
  '/admin/system/section-management',
  '/admin/system/component-management',
  '/admin/system/screen-management',
  '/admin/system/menu',
  '/admin/system/menu-management',
  '/admin/system/screen-menu-assignment-management',
  '/admin/system/design-management',
]);

const nativeScreenDesignRoutes = new Set([
  '/admin/system/page-management',
  '/admin/system/screen-flow-management',
  '/admin/system/screen-builder',
  '/admin/system/screen-runtime',
  '/admin/system/current-runtime-compare',
  '/admin/system/platform-studio',
  '/admin/system/home-page-workbench',
  '/admin/system/design-governance',
]);

const nativeScreenSpaceRoutes = new Set([
  '/admin/system/process-workspace',
  '/admin/system/process-step-workspace',
  '/admin/system/wbs-management',
  '/admin/system/sr-workbench',
]);

const nativeProjectControlRoutes = new Set([
  '/admin/system/asset-inventory',
  '/admin/system/asset-detail',
  '/admin/system/asset-impact',
  '/admin/system/asset-lifecycle',
  '/admin/system/asset-gap',
  '/admin/system/verification-center',
  '/admin/system/verification-assets',
  '/admin/system/verification-asset-management',
  '/admin/system/repair-workbench',
  '/admin/system/builder-studio',
  '/admin/system/build-studio',
]);

const nativeSystemOperationsRoutes = new Set([
  '/admin/external/connection_list',
  '/admin/external/keys',
  '/admin/external/logs',
  '/admin/external/maintenance',
  '/admin/external/monitoring',
  '/admin/external/retry',
  '/admin/external/schema',
  '/admin/external/sync',
  '/admin/external/usage',
  '/admin/external/webhooks',
  '/admin/monitoring/center',
  '/admin/system/batch',
  '/admin/system/error-log',
  '/admin/system/infra',
  '/admin/system/notification',
  '/admin/system/monitoring-dashboard',
  '/admin/system/db-monitoring',
  '/admin/system/batch-monitoring',
  '/admin/system/cron-monitoring',
  '/admin/system/git-build-monitoring',
  '/admin/system/performance',
]);

const nativeSystemDevelopmentRoutes = new Set([
  '/admin/system/api-management',
  '/admin/system/feature-management',
  '/admin/system/controller-management',
  '/admin/system/function-console',
  '/admin/system/module',
  '/admin/system/code',
  '/admin/system/column-management',
  '/admin/system/full-stack-management',
  '/admin/system/package-governance',
  '/admin/system/version-management',
  '/admin/system/codex-provision',
]);

const nativeSystemSecurityRoutes = new Set([
  '/admin/system/consent-history',
  '/admin/system/authority-management',
  '/admin/system/access_history',
  '/admin/system/security-audit',
  '/admin/system/security-monitoring',
  '/admin/system/security-policy',
  '/admin/system/blocklist',
  '/admin/system/ip_whitelist',
]);

const nativeSystemRecoveryRoutes = new Set([
  '/admin/system/backup',
  '/admin/system/backup_config',
  '/admin/system/db-promotion-policy',
  '/admin/system/db-sync-deploy',
  '/admin/system/restore',
]);

const generatedNativeTargets: {
  pattern: RegExp;
  targetPlugin: string;
}[] = [
  {
    pattern: /^\/admin\/generated\/api-usage-monitoring\//,
    targetPlugin: 'ccus-screen-designs/system-operations',
  },
  {
    pattern: /^\/admin\/generated\/background-db-version-impact\//,
    targetPlugin: 'ccus-screen-designs/system-development',
  },
  {
    pattern: /^\/admin\/generated\/builder-generator-operation\//,
    targetPlugin: 'ccus-screen-designs/system-development',
  },
  {
    pattern: /^\/admin\/generated\/design-asset-governance\//,
    targetPlugin: 'ccus-screen-designs/design-assets',
  },
  {
    pattern: /^\/admin\/generated\/menu-access-control\//,
    targetPlugin: 'ccus-screen-designs/system-security',
  },
];

const resonanceBusinessRoutes = new Set([
  '/admin/generated/trade-contract/trade-contract-s4',
]);

const ownershipFor = (
  record: CcusScreenDesignRecord,
  capabilities: ControlCapability[],
): Pick<
  ControlAssetRecord,
  'ownershipLane' | 'migrationStatus' | 'targetPlugin' | 'dependencyContracts'
> => {
  const searchable = `${record.routePath} ${record.screenName}`;
  if (resonanceBusinessRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'RESONANCE_RUNTIME',
      migrationStatus: 'CLASSIFIED',
      targetPlugin: 'resonance/business-runtime',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  const generatedTarget = generatedNativeTargets.find(target =>
    target.pattern.test(record.routePath),
  );
  if (generatedTarget) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: generatedTarget.targetPlugin,
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  const isActorProcess = record.routePath === '/admin/system/actor-process';
  if (isActorProcess) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/actor-process-control',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeDesignAssetRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/design-assets',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeScreenDesignRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/screen-designs',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeScreenSpaceRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/screen-space',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeProjectControlRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/project-control',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeSystemOperationsRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/system-operations',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeSystemDevelopmentRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/system-development',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeSystemSecurityRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/system-security',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (nativeSystemRecoveryRoutes.has(record.routePath)) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'NATIVE_READY',
      targetPlugin: 'ccus-screen-designs/system-recovery',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (
    controlPrefixes.some(prefix => record.routePath.startsWith(prefix)) ||
    (record.routePath.includes('/generated/') &&
      capabilities.length > 1 &&
      backstageNativePattern.test(searchable))
  ) {
    return {
      ownershipLane: 'BACKSTAGE_NATIVE',
      migrationStatus: 'CLASSIFIED',
      targetPlugin: 'ccus-screen-designs/control-plane',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  if (sharedRuntimePattern.test(searchable)) {
    return {
      ownershipLane: 'SHARED_RUNTIME',
      migrationStatus: 'CLASSIFIED',
      targetPlugin: 'resonance/shared-runtime',
      dependencyContracts: [...new Set(record.dataContracts)],
    };
  }
  return {
    ownershipLane: 'RESONANCE_RUNTIME',
    migrationStatus: 'CLASSIFIED',
    targetPlugin: 'resonance/business-runtime',
    dependencyContracts: [...new Set(record.dataContracts)],
  };
};

const classify = (record: CcusScreenDesignRecord): ControlCapability[] => {
  const searchable = [
    record.routePath,
    record.screenName,
    record.processCodes.join(' '),
    record.actorCodes.join(' '),
  ].join(' ');
  const capabilities = (Object.entries(rules) as [ControlCapability, RegExp][])
    .filter(([, pattern]) => pattern.test(searchable))
    .map(([capability]) => capability);
  if (
    !capabilities.length &&
    controlPrefixes.some(prefix => record.routePath.startsWith(prefix))
  ) {
    capabilities.push('OPERATIONS');
  }
  return capabilities;
};

const candidates: ControlAssetRecord[] = CCUS_SCREEN_DESIGN_CATALOG.records
  .map(record => {
    const capabilities = classify(record);
    return {
      ...record,
      screenName: record.screenName.replaceAll(' 쨌 ', ' · '),
      capabilities,
      sourceUrl: `http://172.16.1.232${record.routePath}`,
      ...ownershipFor(record, capabilities),
    };
  })
  .filter(record => record.capabilities.length > 0);

const byRoute = new Map<string, ControlAssetRecord>();
for (const candidate of candidates) {
  const current = byRoute.get(candidate.routePath);
  if (!current) {
    byRoute.set(candidate.routePath, candidate);
    continue;
  }
  byRoute.set(candidate.routePath, {
    ...current,
    actorCodes: [...new Set([...current.actorCodes, ...candidate.actorCodes])],
    processCodes: [
      ...new Set([...current.processCodes, ...candidate.processCodes]),
    ],
    contractIds: [
      ...new Set([...current.contractIds, ...candidate.contractIds]),
    ],
    requiredScenarios: [
      ...new Set([
        ...current.requiredScenarios,
        ...candidate.requiredScenarios,
      ]),
    ],
    capabilities: [
      ...new Set([...current.capabilities, ...candidate.capabilities]),
    ],
    dependencyContracts: [
      ...new Set([
        ...current.dependencyContracts,
        ...candidate.dependencyContracts,
      ]),
    ],
    gaps: [...new Set([...current.gaps, ...candidate.gaps])],
    sections: [...new Set([...current.sections, ...candidate.sections])],
    dataContracts: [
      ...new Set([...current.dataContracts, ...candidate.dataContracts]),
    ],
    qualityScore: Math.min(current.qualityScore, candidate.qualityScore),
    professionalScore: Math.min(
      current.professionalScore,
      candidate.professionalScore,
    ),
    runtimeScore: Math.min(current.runtimeScore, candidate.runtimeScore),
    traceabilityScore: Math.min(
      current.traceabilityScore,
      candidate.traceabilityScore,
    ),
    taskCount: current.taskCount + candidate.taskCount,
    testCount: current.testCount + candidate.testCount,
  });
}

export const RESONANCE_CONTROL_ASSETS = [...byRoute.values()].sort((a, b) =>
  a.routePath.localeCompare(b.routePath),
);

export const CONTROL_ASSET_SUMMARY = {
  total: RESONANCE_CONTROL_ASSETS.length,
  operations: RESONANCE_CONTROL_ASSETS.filter(record =>
    record.capabilities.includes('OPERATIONS'),
  ).length,
  design: RESONANCE_CONTROL_ASSETS.filter(record =>
    record.capabilities.includes('DESIGN'),
  ).length,
  development: RESONANCE_CONTROL_ASSETS.filter(record =>
    record.capabilities.includes('DEVELOPMENT'),
  ).length,
  mergedContracts: candidates.length - RESONANCE_CONTROL_ASSETS.length,
  duplicateRoutes: 0,
  backstageNative: RESONANCE_CONTROL_ASSETS.filter(
    record => record.ownershipLane === 'BACKSTAGE_NATIVE',
  ).length,
  resonanceRuntime: RESONANCE_CONTROL_ASSETS.filter(
    record => record.ownershipLane === 'RESONANCE_RUNTIME',
  ).length,
  sharedRuntime: RESONANCE_CONTROL_ASSETS.filter(
    record => record.ownershipLane === 'SHARED_RUNTIME',
  ).length,
  nativeReady: RESONANCE_CONTROL_ASSETS.filter(
    record => record.migrationStatus === 'NATIVE_READY',
  ).length,
};
