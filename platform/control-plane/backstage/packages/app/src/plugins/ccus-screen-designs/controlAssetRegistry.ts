import {
  CCUS_SCREEN_DESIGN_CATALOG,
  CcusScreenDesignRecord,
} from './generatedCatalog';

export type ControlCapability = 'OPERATIONS' | 'DESIGN' | 'DEVELOPMENT';

export type ControlAssetRecord = CcusScreenDesignRecord & {
  capabilities: ControlCapability[];
  sourceUrl: string;
  migrationMode: 'NATIVE_BACKSTAGE' | 'LINKED_RUNTIME';
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

const classify = (record: CcusScreenDesignRecord): ControlCapability[] => {
  const searchable = [
    record.routePath,
    record.screenName,
    record.processCodes.join(' '),
    record.actorCodes.join(' '),
  ].join(' ');
  const capabilities = (Object.entries(rules) as [
    ControlCapability,
    RegExp,
  ][])
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
    .map(record => ({
      ...record,
      capabilities: classify(record),
      sourceUrl: `http://172.16.1.232${record.routePath}`,
      migrationMode: 'LINKED_RUNTIME' as const,
    }))
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
    contractIds: [...new Set([...current.contractIds, ...candidate.contractIds])],
    requiredScenarios: [
      ...new Set([
        ...current.requiredScenarios,
        ...candidate.requiredScenarios,
      ]),
    ],
    capabilities: [
      ...new Set([...current.capabilities, ...candidate.capabilities]),
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
};
