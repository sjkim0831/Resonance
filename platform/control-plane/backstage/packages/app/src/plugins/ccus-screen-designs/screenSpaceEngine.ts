export type ScreenCoordinateInput = {
  project: string;
  domainObject: string;
  actor: string;
  process: string;
  step: string;
  state: string;
  action: string;
  permission: string;
  archetype: string;
  device: string;
  language: string;
  dataContext: string;
};

export type ScreenSpaceDimensions = {
  projects: number;
  actors: number;
  processes: number;
  states: number;
  permissions: number;
  devices: number;
};

export const TARGET_SCREEN_SPACE: ScreenSpaceDimensions = {
  projects: 1_000,
  actors: 50,
  processes: 200,
  states: 20,
  permissions: 10,
  devices: 7,
};

export const GENERATION_PIPELINE = [
  {
    code: 'PROCESS_STUDIO',
    name: '프로세스 설계',
    minuteRange: '0~2분',
    outputs: ['Actor', 'Process', 'Step', 'State', 'Transition', 'Decision'],
  },
  {
    code: 'DEFINITION_DATABASE',
    name: '정의 데이터 적재',
    minuteRange: '0~2분',
    outputs: ['Entity', 'Field', 'Action', 'Policy', 'Data Context'],
  },
  {
    code: 'SCREEN_COMPOSITION',
    name: '화면 원형 조합',
    minuteRange: '2~4분',
    outputs: ['Layout', 'Section', 'Component', 'Binding', 'Event'],
  },
  {
    code: 'CONTRACT_GENERATOR',
    name: '계약 생성',
    minuteRange: '4~6분',
    outputs: ['OpenAPI', 'JSON Schema', 'Validation', 'Permission Matrix'],
  },
  {
    code: 'CODE_GENERATOR',
    name: '코드 생성',
    minuteRange: '6~8분',
    outputs: ['Spring Boot', 'SQL', 'React', 'Client SDK', 'Automated Test'],
  },
  {
    code: 'QUALITY_GATE',
    name: '오류 차단',
    minuteRange: '8~10분',
    outputs: ['Graph Validation', 'Contract Test', 'A11y', 'Responsive', 'Recovery'],
  },
] as const;

const normalize = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'default';

export function calculateScreenSpace(dimensions: ScreenSpaceDimensions) {
  return Object.values(dimensions).reduce(
    (total, value) => total * BigInt(value),
    1n,
  );
}

export function buildScreenCoordinate(input: ScreenCoordinateInput) {
  return [
    'ccus',
    input.project,
    input.domainObject,
    input.actor,
    input.process,
    input.step,
    input.state,
    input.action,
    input.permission,
    input.archetype,
    input.device,
    input.language,
    input.dataContext,
  ]
    .map(normalize)
    .join(':');
}

export function buildMaterializationOutputs(input: ScreenCoordinateInput) {
  const base = normalize(`${input.project}-${input.process}-${input.step}`);
  return {
    screenSpec: `screen-spec/${base}.json`,
    openApi: `contracts/${base}.openapi.yaml`,
    jsonSchema: `contracts/${base}.schema.json`,
    frontend: `screens/${base}/index.tsx`,
    backend: `api/${base}/command-handler.java`,
    database: `db/${base}.migration.sql`,
    tests: `tests/${base}.scenario.spec.ts`,
  };
}
