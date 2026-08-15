import { createHash } from 'node:crypto';

export const REQUIREMENT_CONTRACT_SCHEMA = {
  version: '3.0.0',
  identity: 'STABLE_DOCUMENT_KEY_OR_EXPLICIT_PROCESS_CODE',
  reconciliation: 'EXACT_SET',
} as const;

export type RequirementDocumentIdentityInput = {
  documentSlot?: string;
  stableFileKey?: string;
  explicitProcessCode?: string;
};

export type RequirementDocumentInput = RequirementDocumentIdentityInput & {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  extractedText?: string;
  autoPromote?: boolean;
};

export type RequirementItem = {
  requirementId: string;
  title: string;
  description: string;
  actorCode: string;
  processCode: string;
  stepCode: string;
  stepOrder: number;
  screenName: string;
  routePath: string;
  layoutCode: string;
  themeCode: string;
  sections: {
    sectionCode: string;
    order: number;
    componentType: string;
  }[];
  permissionCodes: string[];
  commandCode: string;
  fromState: string;
  toState: string;
  endpoint: { method: string; path: string };
  apiContract: { method: string; path: string };
  fields: {
    fieldCode: string;
    label: string;
    type: string;
    required: boolean;
    order: number;
  }[];
  acceptanceCriteria: string[];
};

export type RequirementAnalysis = {
  identity: {
    strategy: 'EXPLICIT_PROCESS_CODE' | 'STABLE_DOCUMENT_KEY';
    stableKey: string;
    processCode: string;
  };
  processCode: string;
  requirements: RequirementItem[];
  actorDefinitions: {
    actorCode: string;
    actorName: string;
    description: string;
    permissionCodes: string[];
  }[];
  commonLayout: string;
  commonTheme: string;
  workspaces: {
    id: string;
    tabs: {
      id: string;
      label: string;
      order: number;
      sections: string[];
    }[];
  }[];
  startState: string;
  endState: string;
};

const digest = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
};

const normalizedCode = (value: unknown, field: string, maxLength = 160) => {
  const code = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toUpperCase();
  if (!code || code.length > maxLength || !/^[A-Z][A-Z0-9_.:-]*$/.test(code)) {
    throw new Error(`${field} has an unsupported code format`);
  }
  return code;
};

const normalizedIdentityInput = (
  input?: RequirementDocumentIdentityInput,
): RequirementDocumentIdentityInput => {
  const stableKey = (value: unknown, field: string) => {
    const normalized = String(value ?? '')
      .normalize('NFKC')
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .toLowerCase();
    if (
      !normalized ||
      normalized.length > 200 ||
      !/^[a-z0-9][a-z0-9._:/-]*$/.test(normalized) ||
      normalized.includes('..')
    ) {
      throw new Error(`${field} has an unsupported stable identity format`);
    }
    return normalized;
  };
  return {
    documentSlot: input?.documentSlot
      ? stableKey(input.documentSlot, 'documentSlot')
      : undefined,
    stableFileKey: input?.stableFileKey
      ? stableKey(input.stableFileKey, 'stableFileKey')
      : undefined,
    explicitProcessCode: input?.explicitProcessCode
      ? normalizedCode(input.explicitProcessCode, 'explicitProcessCode', 80)
      : undefined,
  };
};

const resolveIdentity = (
  projectId: string,
  fileName: string,
  input?: RequirementDocumentIdentityInput,
) => {
  const normalized = normalizedIdentityInput(input);
  if (
    normalized.documentSlot &&
    normalized.stableFileKey &&
    normalized.documentSlot !== normalized.stableFileKey
  ) {
    throw new Error('ambiguous requirement identity: choose one stable key');
  }
  if (normalized.explicitProcessCode) {
    return {
      strategy: 'EXPLICIT_PROCESS_CODE' as const,
      stableKey: `process:${normalized.explicitProcessCode.toLowerCase()}`,
      processCode: normalized.explicitProcessCode,
    };
  }
  const stableKey = normalized.documentSlot
    ? `slot:${normalized.documentSlot}`
    : `file:${
        normalized.stableFileKey ??
        `name-${digest(fileName.normalize('NFKC').toLowerCase()).slice(0, 24)}`
      }`;
  return {
    strategy: 'STABLE_DOCUMENT_KEY' as const,
    stableKey,
    processCode: `REQ_${digest(
      canonicalJson({
        projectId: normalizedCode(projectId, 'projectId', 64),
        stableKey,
      }),
    )
      .slice(0, 12)
      .toUpperCase()}`,
  };
};

export const decodeRequirementDocument = (input: RequirementDocumentInput) => {
  const fileName = String(input.fileName ?? '')
    .normalize('NFKC')
    .trim();
  if (!fileName || fileName.length > 240)
    throw new Error('fileName is required');
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (
    !['txt', 'md', 'csv', 'json', 'pdf', 'docx', 'xlsx'].includes(extension)
  ) {
    throw new Error('unsupported requirement document type');
  }
  const raw = input.contentBase64
    ? Buffer.from(String(input.contentBase64), 'base64')
    : Buffer.alloc(0);
  if (raw.length > 8 * 1024 * 1024) {
    throw new Error('requirement document exceeds 8MB');
  }
  let text = String(input.extractedText ?? '').trim();
  if (!text && ['txt', 'md', 'csv', 'json'].includes(extension)) {
    text = raw
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trim();
  }
  if (!text) {
    throw new Error(
      ['pdf', 'docx', 'xlsx'].includes(extension)
        ? 'extractedText is required for binary documents'
        : 'requirement document is empty',
    );
  }
  if (text.length > 2_000_000) {
    throw new Error('extracted requirement text is too large');
  }
  return {
    fileName,
    extension,
    mimeType: String(input.mimeType ?? 'application/octet-stream'),
    text,
    byteSize: raw.length || Buffer.byteLength(text),
    documentSha256: digest(raw.length ? raw.toString('base64') : text),
    textSha256: digest(text),
    identity: normalizedIdentityInput(input),
  };
};

const workspaces = ['design', 'develop', 'operate'].map(id => ({
  id,
  tabs: Array.from({ length: id === 'operate' ? 9 : 8 }, (_, index) => ({
    id: `${id}-${index + 1}`,
    label: `${id.toUpperCase()} ${index + 1}`,
    order: (index + 1) * 10,
    sections: ['HELP', 'NEXT_TASK', 'QA', 'SCREEN_DESIGN'],
  })),
}));

export const analyzeRequirementText = (
  projectId: string,
  fileName: string,
  text: string,
  identityInput?: RequirementDocumentIdentityInput,
): RequirementAnalysis => {
  const lines = text
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(line => line.length >= 4 && !/^[_=-]{4,}$/.test(line))
    .slice(0, 1000);
  if (!lines.length) throw new Error('no actionable requirements were found');
  if (new Set(lines).size !== lines.length) {
    throw new Error(
      'ambiguous requirement identity: duplicate requirement lines',
    );
  }
  const identity = resolveIdentity(projectId, fileName, identityInput);
  const requirements = lines.map((line, index): RequirementItem => {
    const itemId = digest(line).slice(0, 10).toUpperCase();
    const stepCode = `${identity.processCode}_S_${itemId}`;
    const actorCode = /관리자|운영자|승인자/.test(line)
      ? 'PLATFORM_ADMIN'
      : /검증|검토/.test(line)
      ? 'VERIFIER'
      : /기업|회사|담당자/.test(line)
      ? 'COMPANY_MANAGER'
      : /기관|규제|제출/.test(line)
      ? 'REGULATOR'
      : 'BUSINESS_USER';
    const operation = /삭제|취소/.test(line)
      ? 'DELETE'
      : /수정|변경|보완|승인|반려/.test(line)
      ? 'UPDATE'
      : /등록|생성|제출|업로드|실행|발급/.test(line)
      ? 'SUBMIT'
      : 'VIEW';
    const permissionCodes = [
      `PROCESS.${identity.processCode}.STEP.${stepCode}.EXECUTE`,
    ];
    const endpoint = {
      method: 'POST',
      path: '/admin/api/system/actor-process/executions/{executionId}/commands',
    };
    return {
      requirementId: `${identity.processCode}_R_${itemId}`,
      title: line.slice(0, 120),
      description: line,
      actorCode,
      processCode: identity.processCode,
      stepCode,
      stepOrder: (index + 1) * 10,
      screenName: line.slice(0, 80),
      routePath: `/generated/${projectId.toLowerCase()}/${identity.processCode.toLowerCase()}/${stepCode.toLowerCase()}`,
      layoutCode: 'RESPONSIVE_WORKSPACE',
      themeCode: 'KRDS_GOV_DEFAULT',
      sections: [
        'TASK_HEADER',
        'JSON_FORM',
        'SCREEN_HELP',
        'QA_EVIDENCE',
        'NEXT_TASK',
      ].map((sectionCode, sectionIndex) => ({
        sectionCode,
        componentType: sectionCode,
        order: (sectionIndex + 1) * 10,
      })),
      permissionCodes,
      commandCode: `${operation}_${stepCode}`,
      fromState: index === 0 ? 'DRAFT' : `STEP_${index}_COMPLETED`,
      toState:
        index === lines.length - 1
          ? 'COMPLETED'
          : `STEP_${index + 1}_COMPLETED`,
      endpoint,
      apiContract: endpoint,
      fields: [
        'PROJECT_ID',
        'ACTOR_CODE',
        'STATUS_CODE',
        'COMMAND_CODE',
        'PAYLOAD',
      ].map((fieldCode, fieldIndex) => ({
        fieldCode,
        label: fieldCode,
        type: fieldCode === 'PAYLOAD' ? 'object' : 'string',
        required: fieldCode !== 'PAYLOAD' || operation !== 'VIEW',
        order: (fieldIndex + 1) * 10,
      })),
      acceptanceCriteria: [
        '권한과 상태 전이를 검증한다.',
        '저장 후 DB 재조회 결과가 일치한다.',
        '모바일과 WCAG 2.1 AA 기준을 충족한다.',
      ],
    };
  });
  const actorDefinitions = Array.from(
    new Set(requirements.map(item => item.actorCode)),
  )
    .sort()
    .map(actorCode => ({
      actorCode,
      actorName: actorCode,
      description: `${actorCode} 업무 액터`,
      permissionCodes: requirements
        .filter(item => item.actorCode === actorCode)
        .flatMap(item => item.permissionCodes)
        .sort(),
    }));
  return {
    identity,
    processCode: identity.processCode,
    requirements,
    actorDefinitions,
    commonLayout: 'RESPONSIVE_WORKSPACE',
    commonTheme: 'KRDS_GOV_DEFAULT',
    workspaces,
    startState: 'DRAFT',
    endState: 'COMPLETED',
  };
};

const canonicalAnalysis = (source: RequirementAnalysis) => {
  const analysis = JSON.parse(JSON.stringify(source)) as RequirementAnalysis;
  analysis.workspaces.sort((left, right) => left.id.localeCompare(right.id));
  analysis.workspaces.forEach(workspace => {
    workspace.tabs.sort((left, right) => left.order - right.order);
    workspace.tabs.forEach(tab => tab.sections.sort());
  });
  analysis.actorDefinitions.sort((left, right) =>
    left.actorCode.localeCompare(right.actorCode),
  );
  analysis.actorDefinitions.forEach(actor => actor.permissionCodes.sort());
  analysis.requirements.sort(
    (left, right) =>
      left.stepOrder - right.stepOrder ||
      left.stepCode.localeCompare(right.stepCode),
  );
  analysis.requirements.forEach(step => {
    step.permissionCodes.sort();
    step.sections.sort((left, right) => left.order - right.order);
    step.fields.sort((left, right) => left.order - right.order);
    step.acceptanceCriteria.sort();
  });
  return analysis;
};

const validateAnalysis = (analysis: RequirementAnalysis) => {
  const fail = (condition: boolean, message: string) => {
    if (condition) throw new Error(message);
  };
  fail(
    analysis.workspaces.length !== 3 ||
      analysis.workspaces
        .map(item => item.id)
        .sort()
        .join(',') !== 'design,develop,operate' ||
      analysis.workspaces.flatMap(item => item.tabs).length !== 25,
    'workspaces must contain 3 workspaces and 25 tabs',
  );
  fail(
    !analysis.requirements.length || analysis.requirements.length > 1000,
    'process must contain 1-1000 steps',
  );
  fail(
    analysis.identity.processCode !== analysis.processCode ||
      !analysis.commonLayout ||
      !analysis.commonTheme ||
      !analysis.startState ||
      !analysis.endState,
    'process identity or common design is incomplete',
  );
  const unique = (values: unknown[], field: string) =>
    fail(new Set(values).size !== values.length, `${field} must be unique`);
  for (const field of [
    'stepCode',
    'stepOrder',
    'routePath',
    'commandCode',
  ] as const) {
    unique(
      analysis.requirements.map(item => item[field]),
      field,
    );
  }
  unique(
    analysis.actorDefinitions.map(actor => actor.actorCode),
    'actorCode',
  );
  const actors = new Map(
    analysis.actorDefinitions.map(actor => [actor.actorCode, actor]),
  );
  analysis.workspaces.forEach(workspace => {
    for (const [field, values] of Object.entries({
      tabId: workspace.tabs.map(tab => tab.id),
      tabOrder: workspace.tabs.map(tab => tab.order),
    })) {
      unique(values, `workspaces.${workspace.id}.${field}`);
    }
    workspace.tabs.forEach(tab => {
      fail(
        !tab.id ||
          !tab.label ||
          !Number.isInteger(tab.order) ||
          !tab.sections.length,
        `tabs.${tab.id}.design is incomplete`,
      );
      unique(tab.sections, `tabs.${tab.id}.sections`);
    });
  });
  analysis.actorDefinitions.forEach(actor => {
    fail(
      !actor.actorCode ||
        !actor.actorName ||
        !actor.description ||
        !actor.permissionCodes.length,
      `actors.${actor.actorCode}.definition is incomplete`,
    );
    unique(actor.permissionCodes, `actors.${actor.actorCode}.permissionCodes`);
  });
  analysis.requirements.forEach((step, index) => {
    const actor = actors.get(step.actorCode);
    fail(!actor, `steps[${index}].actorCode has no actor definition`);
    fail(
      !step.layoutCode ||
        !step.themeCode ||
        !step.sections.length ||
        !step.fields.length ||
        !step.acceptanceCriteria.length ||
        !step.permissionCodes.length ||
        !step.commandCode ||
        !step.fromState ||
        !step.toState ||
        !step.routePath.startsWith('/') ||
        !step.endpoint?.path.startsWith('/') ||
        !['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].includes(
          step.endpoint?.method,
        ) ||
        canonicalJson(step.endpoint) !== canonicalJson(step.apiContract) ||
        step.processCode !== analysis.processCode ||
        step.sections.some(
          section =>
            !section.sectionCode ||
            !section.componentType ||
            !Number.isInteger(section.order),
        ) ||
        step.fields.some(
          field =>
            !field.fieldCode ||
            !field.label ||
            !field.type ||
            typeof field.required !== 'boolean' ||
            !Number.isInteger(field.order),
        ),
      `steps[${index}] has an incomplete design contract`,
    );
    for (const [field, values] of Object.entries({
      permissionCodes: step.permissionCodes,
      acceptanceCriteria: step.acceptanceCriteria,
      sectionCode: step.sections.map(section => section.sectionCode),
      sectionOrder: step.sections.map(section => section.order),
      fieldCode: step.fields.map(item => item.fieldCode),
      fieldOrder: step.fields.map(item => item.order),
    })) {
      unique(values, `steps[${index}].${field}`);
    }
    fail(
      step.permissionCodes.some(
        permission => !actor?.permissionCodes.includes(permission),
      ),
      `steps[${index}].permissionCodes is not granted`,
    );
  });
  const actorsUsed = new Set(analysis.requirements.map(step => step.actorCode));
  fail(
    [...actors.keys()].some(actorCode => !actorsUsed.has(actorCode)),
    'actorDefinitions contains an unused actor',
  );
  fail(
    analysis.requirements[0].fromState !== analysis.startState ||
      analysis.requirements.at(-1)?.toState !== analysis.endState ||
      analysis.requirements
        .slice(1)
        .some(
          (item, index) =>
            item.fromState !== analysis.requirements[index].toState,
        ),
    'process step state chain is ambiguous',
  );
};

export const buildRequirementDesignContract = ({
  projectId,
  designVersion,
  document,
  analysis: sourceAnalysis,
}: {
  projectId: string;
  designVersion: number;
  document: ReturnType<typeof decodeRequirementDocument>;
  analysis: RequirementAnalysis;
}) => {
  if (!Number.isInteger(designVersion) || designVersion <= 0) {
    throw new Error('designVersion must be a positive integer');
  }
  const analysis = canonicalAnalysis(sourceAnalysis);
  validateAnalysis(analysis);
  const reconciliation = {
    mode: 'EXACT_SET' as const,
    staleIdentityIntent: 'REMOVE_GENERATOR_OWNED_MISSING' as const,
    stepCodes: analysis.requirements.map(item => item.stepCode).sort(),
    routePaths: analysis.requirements.map(item => item.routePath).sort(),
    screenKeys: analysis.requirements
      .map(item =>
        [
          item.processCode,
          item.stepCode,
          item.actorCode.includes('ADMIN') ? 'ADMIN' : 'USER',
          item.routePath,
        ].join('|'),
      )
      .sort(),
    commandCodes: analysis.requirements.map(item => item.commandCode).sort(),
    endpointIdentities: analysis.requirements
      .map(item => `${item.endpoint.method} ${item.endpoint.path}`)
      .sort(),
    actorCodes: analysis.actorDefinitions.map(item => item.actorCode).sort(),
  };
  const hashBound = {
    schemaVersion: REQUIREMENT_CONTRACT_SCHEMA.version,
    projectId: normalizedCode(projectId, 'projectId', 64),
    tenantId: 'DEFAULT',
    identity: analysis.identity,
    contextFields: [
      'projectId',
      'tenantId',
      'designVersion',
      'actorCode',
      'processCode',
      'stepCode',
    ],
    workspaces: analysis.workspaces,
    actorDefinitions: analysis.actorDefinitions,
    process: {
      processCode: analysis.processCode,
      startState: analysis.startState,
      endState: analysis.endState,
      steps: analysis.requirements,
    },
    generation: {
      strategy: 'METADATA_FIRST_INCREMENTAL',
      maxScreens: 1000,
      commonTheme: analysis.commonTheme,
      commonLayout: analysis.commonLayout,
      genericEndpoints: [
        '/admin/api/system/actor-process/executions/start',
        '/admin/api/system/actor-process/executions/{executionId}/commands',
        '/admin/api/system/actor-process/process-design',
        '/admin/api/system/actor-process/backend/verify',
      ],
    },
    reconciliation,
    qualityGates: [
      'ACTOR_PROCESS_TRACEABILITY',
      'INPUT_OUTPUT_HANDOFF',
      'AUTHORITY_ISOLATION',
      'DATABASE_REREAD',
      'RESPONSIVE_ACCESSIBILITY',
      'RECOVERY_EVIDENCE',
    ],
  };
  const contentSha256 = digest(canonicalJson(hashBound));
  return {
    ...hashBound,
    designVersion,
    contentSha256,
    contentHashAlgorithm: 'SHA-256/CANONICAL-JSON-V1',
    source: {
      type: 'REQUIREMENT_DOCUMENT',
      fileName: document.fileName,
      documentSha256: document.documentSha256,
      textSha256: document.textSha256,
      stableKey: analysis.identity.stableKey,
      processCode: analysis.processCode,
      contentSha256,
    },
  };
};
