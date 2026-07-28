import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backstageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(backstageRoot, '../../..');
const testsPath = resolve(
  repositoryRoot,
  'projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenTests.ts',
);
const queuePath = resolve(
  repositoryRoot,
  'projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-development-priority-queue.json',
);
const outputPath = resolve(
  backstageRoot,
  'packages/app/src/plugins/ccus-screen-designs/generatedCatalog.ts',
);

const testsSource = readFileSync(testsPath, 'utf8');
const queueSource = readFileSync(queuePath, 'utf8');

const testContractPattern =
  /\{\s*"pageId":\s*"([^"]+)",\s*"actorCode":\s*"([^"]+)",\s*"routePath":\s*"([^"]+)",\s*"requiredScenarios":\s*(\[[\s\S]*?\]),\s*"designScore":\s*(\d+)\s*\}/g;
const queueItemPattern =
  /\{\s*"queueOrder":\s*(\d+),([\s\S]*?)"incrementalCommand":\s*"[^"]*"\s*\}/g;

const queueByRoute = new Map();
for (const match of queueSource.matchAll(queueItemPattern)) {
  const body = match[2];
  const value = pattern =>
    body.match(pattern)?.[1]?.replaceAll('\\"', '"').trim() ?? '';
  const values = pattern => {
    const raw = value(pattern);
    return [...raw.matchAll(/"([^"]+)"/g)].map(item => item[1]);
  };
  const routePath = value(/"routePath":\s*"([^"]+)"/);
  if (!routePath) continue;
  queueByRoute.set(routePath, {
    queueOrder: Number(match[1]),
    contractIds: values(/"contractIds":\s*(\[[\s\S]*?\])/).map(Number),
    actorCodes: values(/"actorCodes":\s*(\[[\s\S]*?\])/),
    processCodes: values(/"processCodes":\s*(\[[\s\S]*?\])/),
    sourceRef: value(/"sourceRef":\s*"([^"]*)"/),
    professionalScore: Number(value(/"professionalScore":\s*(\d+)/)) || 0,
    taskCount: Number(value(/"taskCount":\s*(\d+)/)) || 0,
    testCount: Number(value(/"testCount":\s*(\d+)/)) || 0,
    qualityScore: Number(value(/"qualityScore":\s*(\d+)/)) || 0,
    runtimeScore: Number(value(/"runtimeScore":\s*(\d+)/)) || 0,
    traceabilityScore:
      Number(value(/"traceabilityScore":\s*(\d+)/)) || 0,
    priority: value(/"priority":\s*"([^"]+)"/) || 'P3',
    gaps: values(/"gaps":\s*(\[[\s\S]*?\])/),
  });
}

const titleCase = path => {
  const clean = path
    .replace(/^\/(en\/)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/[_-]+/g, ' ')
    .split('/')
    .filter(Boolean)
    .slice(-2)
    .join(' · ');
  return clean
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || '통합 홈';
};

const inferDomain = path => {
  if (/lca|survey|lci/i.test(path)) return '제품 LCA';
  if (/emission|carbon/i.test(path)) return '탄소배출 관리';
  if (/reduction/i.test(path)) return '감축 관리';
  if (/monitor|analysis|statistics/i.test(path)) return '모니터링·분석';
  if (/trade|transaction|settlement|certificate/i.test(path))
    return '거래·정산·인증';
  if (/education|content|support|faq|qna/i.test(path))
    return '콘텐츠·교육·지원';
  if (/auth|member|company|user/i.test(path)) return '회원·기업·권한';
  if (/system|admin/i.test(path)) return '시스템 관리';
  return '공통 업무';
};

const defaultBinding = (path, domain) => {
  if (path.startsWith('/admin/')) {
    return {
      actorCodes: ['PLATFORM_OPERATOR'],
      processCodes: ['PLATFORM_GOVERNANCE'],
    };
  }
  const domainBindings = {
    '제품 LCA': ['LCA_ANALYST', 'LCA_ASSESSMENT'],
    '탄소배출 관리': ['EMISSION_MANAGER', 'EMISSION_MANAGEMENT'],
    '감축 관리': ['REDUCTION_MANAGER', 'REDUCTION_MANAGEMENT'],
    '모니터링·분석': ['DATA_ANALYST', 'MONITORING_ANALYSIS'],
    '거래·정산·인증': ['TRADE_OPERATOR', 'CARBON_TRANSACTION'],
    '콘텐츠·교육·지원': ['CONTENT_MANAGER', 'CONTENT_OPERATION'],
    '회원·기업·권한': ['COMPANY_ADMIN', 'MEMBERSHIP_MANAGEMENT'],
    '시스템 관리': ['PLATFORM_OPERATOR', 'PLATFORM_GOVERNANCE'],
    '공통 업무': ['BUSINESS_USER', 'COMMON_WORK'],
  };
  const [actor, process] = domainBindings[domain];
  return { actorCodes: [actor], processCodes: [process] };
};

const records = [];
for (const match of testsSource.matchAll(testContractPattern)) {
  const [, pageId, actorCode, routePath, scenariosSource, designScore] = match;
  const group = routePath.split('/').filter(Boolean)[0] || 'home';
  const enPath = `/en${routePath === '/' ? '' : routePath}`;
  const queue = queueByRoute.get(routePath);
  const domain = inferDomain(routePath);
  const inferred = defaultBinding(routePath, domain);
  const actors = queue?.actorCodes.length
    ? queue.actorCodes
    : [actorCode || inferred.actorCodes[0]];
  const processes = queue?.processCodes.length
    ? queue.processCodes
    : inferred.processCodes;
  const missingImplementation = queue?.gaps.includes('IMPLEMENTATION_MISSING');
  const requiredScenarios = [
    ...scenariosSource.matchAll(/"([^"]+)"/g),
  ].map(item => item[1]);
  records.push({
    sequence: records.length + 1,
    screenId: pageId,
    screenName: titleCase(routePath),
    routePath,
    enPath,
    group,
    domain,
    actorCodes: actors,
    processCodes: processes,
    contractIds: queue?.contractIds ?? [],
    designStatus: queue?.contractIds.length ? 'CONTRACTED' : 'DESIGNED',
    implementationStatus: missingImplementation
      ? 'PLANNED'
      : queue?.sourceRef
        ? 'CONNECTED'
        : 'GENERATED',
    qualityScore: queue?.qualityScore || 92,
    professionalScore:
      queue?.professionalScore || Math.min(100, 65 + Number(designScore)),
    runtimeScore: queue?.runtimeScore || 90,
    traceabilityScore: queue?.traceabilityScore || 8,
    taskCount: queue?.taskCount || 0,
    testCount: queue?.testCount || requiredScenarios.length,
    requiredScenarios,
    priority: queue?.priority || 'P2',
    gaps: queue?.gaps ?? [],
    sourceRef: queue?.sourceRef || 'generatedScreenFamily',
    sections: [
      '업무 현황',
      '핵심 입력',
      '검증·판정',
      '증적·이력',
      '다음 업무',
    ],
    dataContracts: [
      'projectId',
      'actorCode',
      'processCode',
      'processSequence',
      'screenId',
      'status',
      'version',
      'updatedAt',
    ],
  });
}

if (records.length !== 1000) {
  throw new Error(`Expected 1000 screen contracts, received ${records.length}`);
}

const domains = Object.fromEntries(
  [...new Set(records.map(record => record.domain))]
    .sort()
    .map(domain => [
      domain,
      records.filter(record => record.domain === domain).length,
    ]),
);

const payload = {
  generatedAt:
    queueSource.match(/"completedAt":\s*"([^"]+)"/)?.[1] ??
    '1970-01-01T00:00:00.000Z',
  source: 'generatedScreenTests + full-screen-development-priority-queue',
  project: {
    projectId: 'CCUS-PLATFORM',
    projectName: 'CCUS 플랫폼 구축',
  },
  summary: {
    screenCount: records.length,
    designedCount: records.filter(record => record.designStatus === 'DESIGNED')
      .length,
    contractedCount: records.filter(
      record => record.designStatus === 'CONTRACTED',
    ).length,
    connectedCount: records.filter(
      record => record.implementationStatus === 'CONNECTED',
    ).length,
    generatedCount: records.filter(
      record => record.implementationStatus === 'GENERATED',
    ).length,
    plannedCount: records.filter(
      record => record.implementationStatus === 'PLANNED',
    ).length,
    actorCount: new Set(records.flatMap(record => record.actorCodes)).size,
    processCount: new Set(records.flatMap(record => record.processCodes)).size,
    testCount: records.reduce((sum, record) => sum + record.testCount, 0),
    domains,
  },
  records,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `// Generated by scripts/generate-ccus-screen-design-catalog.mjs. Do not edit.
export interface CcusScreenDesignRecord {
  sequence: number;
  screenId: string;
  screenName: string;
  routePath: string;
  enPath: string;
  group: string;
  domain: string;
  actorCodes: string[];
  processCodes: string[];
  contractIds: number[];
  designStatus: string;
  implementationStatus: string;
  qualityScore: number;
  professionalScore: number;
  runtimeScore: number;
  traceabilityScore: number;
  taskCount: number;
  testCount: number;
  requiredScenarios: string[];
  priority: string;
  gaps: string[];
  sourceRef: string;
  sections: string[];
  dataContracts: string[];
}
export interface CcusScreenDesignCatalog {
  generatedAt: string;
  source: string;
  project: { projectId: string; projectName: string };
  summary: {
    screenCount: number;
    designedCount: number;
    contractedCount: number;
    connectedCount: number;
    generatedCount: number;
    plannedCount: number;
    actorCount: number;
    processCount: number;
    testCount: number;
    domains: Record<string, number>;
  };
  records: CcusScreenDesignRecord[];
}
export const CCUS_SCREEN_DESIGN_CATALOG: CcusScreenDesignCatalog = ${JSON.stringify(payload, null, 2)};
`,
  'utf8',
);
console.log(
  `[screen-design-catalog] wrote ${records.length} screens to ${outputPath}`,
);
