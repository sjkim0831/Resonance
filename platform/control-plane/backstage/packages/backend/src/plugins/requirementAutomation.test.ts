import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  analyzeRequirementText,
  buildRequirementDesignContract,
  decodeRequirementDocument,
  requirementContractSha256,
  type RequirementAnalysis,
} from './requirementAutomation';

const requirementText =
  '기업 담당자는 프로젝트를 등록한다.\n검증자는 제출 자료를 검토한다.';
const prepare = (
  source = requirementText,
  fileName = 'requirements.md',
  designVersion = 1,
) => {
  const document = decodeRequirementDocument({
    fileName,
    extractedText: source,
    documentSlot: 'main-rfp',
  });
  const analysis = analyzeRequirementText(
    'CCUS-PLATFORM',
    document.fileName,
    document.text,
    document.identity,
  );
  return {
    document,
    analysis,
    contract: buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion,
      document,
      analysis,
    }),
  };
};
const clone = (analysis: RequirementAnalysis) =>
  JSON.parse(JSON.stringify(analysis)) as RequirementAnalysis;

const crossLanguageFixture = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../../../../ops/tests/fixtures/requirement-design-cross-language-v1.json',
    ),
    'utf8',
  ),
) as {
  input: {
    projectId: string;
    designVersion: number;
    fileName: string;
    documentSlot: string;
    requirementText: string;
  };
  contract: ReturnType<typeof buildRequirementDesignContract>;
  contractSha256: string;
};

const structuredDesign = {
  schemaVersion: '3.0.0',
  process: {
    processCode: 'APPLICATION_REVIEW',
    startState: 'DRAFT',
    endState: 'COMPLETED',
    steps: [
      {
        requirementId: 'REQ_APPLICATION_REVIEW',
        title: '신청 검토',
        description: '검토자가 신청 자료를 확인하고 결과를 저장한다.',
        actorCode: 'APPLICATION_REVIEWER',
        processCode: 'APPLICATION_REVIEW',
        stepCode: 'REVIEW_APPLICATION',
        stepOrder: 10,
        screenName: '신청 검토 화면',
        routePath: '/generated/application/review',
        layoutCode: 'KRDS_REVIEW_WORKSPACE',
        themeCode: 'KRDS_REVIEW_THEME',
        sections: [
          {
            sectionCode: 'REVIEW_FORM',
            order: 10,
            componentType: 'JSON_FORM',
          },
        ],
        permissionCodes: ['APPLICATION_REVIEW:EXECUTE'],
        commandCode: 'SUBMIT_APPLICATION_REVIEW',
        fromState: 'DRAFT',
        toState: 'COMPLETED',
        endpoint: {
          method: 'POST',
          path: '/api/application-reviews/{applicationId}/commands',
        },
        apiContract: {
          method: 'POST',
          path: '/api/application-reviews/{applicationId}/commands',
        },
        fields: [
          {
            fieldCode: 'REVIEW_NOTE',
            label: '검토 의견',
            type: 'string',
            required: true,
            order: 10,
          },
        ],
        acceptanceCriteria: ['저장 후 검토 결과를 다시 조회할 수 있다.'],
      },
    ],
  },
  actorDefinitions: [
    {
      actorCode: 'APPLICATION_REVIEWER',
      actorName: '신청 검토자',
      description: '신청 자료와 결과를 검토한다.',
      permissionCodes: ['APPLICATION_REVIEW:EXECUTE'],
    },
  ],
  generation: {
    commonLayout: 'KRDS_REVIEW_WORKSPACE',
    commonTheme: 'KRDS_REVIEW_THEME',
  },
  workspaces: prepare().analysis.workspaces,
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const prepareStructured = (
  input: unknown = structuredDesign,
  identity: { explicitProcessCode?: string } = {},
) => {
  const document = decodeRequirementDocument({
    fileName: 'structured-design.json',
    extractedText: JSON.stringify(input),
    documentSlot: 'structured-main',
    ...identity,
  });
  const analysis = analyzeRequirementText(
    'CCUS-PLATFORM',
    document.fileName,
    document.text,
    document.identity,
  );
  return {
    analysis,
    contract: buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 3,
      document,
      analysis,
    }),
  };
};

describe('requirement automation', () => {
  it('hashes the exact uploaded bytes and uses UTF-8 extracted text only as fallback', () => {
    const raw = Buffer.from([0, 255, 10, 65, 66, 67]);
    const binary = decodeRequirementDocument({
      fileName: 'requirements.pdf',
      contentBase64: raw.toString('base64'),
      extractedText: 'extracted requirement',
      documentSlot: 'main-rfp',
    });
    const textOnly = decodeRequirementDocument({
      fileName: 'requirements.txt',
      extractedText: '  text-only requirement\n',
      documentSlot: 'main-rfp',
    });

    expect(binary.documentSha256).toBe(
      createHash('sha256').update(raw).digest('hex'),
    );
    expect(textOnly.documentSha256).toBe(
      createHash('sha256')
        .update(Buffer.from('  text-only requirement\n', 'utf8'))
        .digest('hex'),
    );
  });

  it('matches the Java bridge golden contract and canonical SHA bytes', () => {
    const input = crossLanguageFixture.input;
    const document = decodeRequirementDocument({
      fileName: input.fileName,
      extractedText: input.requirementText,
      documentSlot: input.documentSlot,
    });
    const analysis = analyzeRequirementText(
      input.projectId,
      document.fileName,
      document.text,
      document.identity,
    );
    const contract = buildRequirementDesignContract({
      projectId: input.projectId,
      designVersion: input.designVersion,
      document,
      analysis,
    });

    expect(contract).toEqual(crossLanguageFixture.contract);
    expect(requirementContractSha256(contract)).toBe(
      crossLanguageFixture.contractSha256,
    );
    expect(contract.reconciliation.endpointIdentities).toEqual([
      'POST /admin/api/system/actor-process/executions/{executionId}/commands',
    ]);
    expect(contract.process.steps).toHaveLength(2);
    expect(
      contract.workspaces.every(workspace =>
        workspace.tabs.every(tab =>
          tab.sections.every(
            section =>
              Boolean(section.sectionCode) &&
              Boolean(section.componentType) &&
              Number.isInteger(section.order),
          ),
        ),
      ),
    ).toBe(true);
  });

  it('maps a structured JSON design exactly into the v3 contract', () => {
    const { analysis, contract } = prepareStructured();

    expect(analysis.identity).toEqual({
      strategy: 'EXPLICIT_PROCESS_CODE',
      stableKey: 'process:application_review',
      processCode: 'APPLICATION_REVIEW',
    });
    expect(contract.process).toEqual(structuredDesign.process);
    expect(contract.actorDefinitions).toEqual(
      structuredDesign.actorDefinitions,
    );
    expect(contract.generation).toEqual(
      expect.objectContaining(structuredDesign.generation),
    );
    expect(contract.workspaces).toEqual(structuredDesign.workspaces);
    expect(contract.reconciliation.endpointIdentities).toEqual([
      'POST /api/application-reviews/{applicationId}/commands',
    ]);
  });

  it('uses the RequirementAutomationPanel extractedText request path for structured JSON', () => {
    const panelRequest = {
      fileName: 'structured-design.json',
      mimeType: 'application/json',
      contentBase64: Buffer.from(
        'file bytes are not the mapped source',
      ).toString('base64'),
      extractedText: JSON.stringify(structuredDesign),
      documentSlot: 'structured-main',
      sourceImmediate: true,
    };
    const document = decodeRequirementDocument(panelRequest);
    const analysis = analyzeRequirementText(
      'CCUS-PLATFORM',
      document.fileName,
      document.text,
      document.identity,
    );
    const contract = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 3,
      document,
      analysis,
    });

    expect(document.text).toBe(panelRequest.extractedText);
    expect(contract.process).toEqual(structuredDesign.process);
    expect(contract.workspaces).toEqual(structuredDesign.workspaces);
  });

  it('presents requirement automation as SOURCE immediate without promotion staging', () => {
    const panelSource = readFileSync(
      resolve(
        __dirname,
        '../../../app/src/plugins/ccus-screen-designs/RequirementAutomationPanel.tsx',
      ),
      'utf8',
    );

    expect(panelSource).toContain('sourceImmediate: true');
    expect(panelSource).toContain('SOURCE 설계·엔드포인트 즉시 반영');
    expect(panelSource).not.toContain('설계 승격');
    expect(panelSource).not.toContain('autoPromote');
    expect(panelSource).toContain("payload.status ?? 'FAILED'");
    expect(panelSource).toContain('pollDocumentPublication');
    expect(panelSource).toContain('/publication/reconcile');
    expect(panelSource).toContain('publicationPollRef.current?.abort()');
    expect(panelSource).not.toContain('setInterval(');
  });

  it.each([
    [
      'process identity',
      (input: typeof structuredDesign) => {
        input.process.processCode = 'APPLICATION_REVIEW_V2';
        input.process.steps[0].processCode = 'APPLICATION_REVIEW_V2';
      },
    ],
    [
      'layout',
      (input: typeof structuredDesign) => {
        input.process.steps[0].layoutCode = 'KRDS_REVIEW_WORKSPACE_V2';
      },
    ],
    [
      'theme',
      (input: typeof structuredDesign) => {
        input.process.steps[0].themeCode = 'KRDS_REVIEW_THEME_V2';
      },
    ],
    [
      'section',
      (input: typeof structuredDesign) => {
        input.process.steps[0].sections[0].componentType = 'JSON_FORM_V2';
      },
    ],
    [
      'field',
      (input: typeof structuredDesign) => {
        input.process.steps[0].fields[0].label = '검토 의견 V2';
      },
    ],
    [
      'permission',
      (input: typeof structuredDesign) => {
        input.process.steps[0].permissionCodes = [
          'APPLICATION_REVIEW:EXECUTE_V2',
        ];
        input.actorDefinitions[0].permissionCodes = [
          'APPLICATION_REVIEW:EXECUTE_V2',
        ];
      },
    ],
    [
      'command',
      (input: typeof structuredDesign) => {
        input.process.steps[0].commandCode = 'SUBMIT_APPLICATION_REVIEW_V2';
      },
    ],
    [
      'API',
      (input: typeof structuredDesign) => {
        const endpoint = {
          method: 'PUT',
          path: '/api/v2/application-reviews/{applicationId}/commands',
        };
        input.process.steps[0].endpoint = endpoint;
        input.process.steps[0].apiContract = cloneJson(endpoint);
      },
    ],
    [
      'actor',
      (input: typeof structuredDesign) => {
        input.process.steps[0].actorCode = 'SENIOR_REVIEWER';
        input.actorDefinitions[0].actorCode = 'SENIOR_REVIEWER';
        input.actorDefinitions[0].actorName = '책임 검토자';
      },
    ],
    [
      'state',
      (input: typeof structuredDesign) => {
        input.process.endState = 'ARCHIVED';
        input.process.steps[0].toState = 'ARCHIVED';
      },
    ],
    [
      'acceptance',
      (input: typeof structuredDesign) => {
        input.process.steps[0].acceptanceCriteria = [
          '저장 후 변경된 검토 결과와 감사 증적을 다시 조회할 수 있다.',
        ];
      },
    ],
  ])('binds a structured %s mutation into the content hash', (name, mutate) => {
    const baseline = prepareStructured().contract;
    const changedInput = cloneJson(structuredDesign);
    mutate(changedInput);
    const changed = prepareStructured(changedInput).contract;

    expect(changed.contentSha256).not.toBe(baseline.contentSha256);
    if (name === 'API') {
      expect(changed.reconciliation.endpointIdentities).not.toEqual(
        baseline.reconciliation.endpointIdentities,
      );
    }
  });

  it('fails closed for unknown, incomplete, invalid, and ambiguous JSON designs', () => {
    const unknown = cloneJson(structuredDesign) as typeof structuredDesign & {
      approvalGate?: string;
    };
    unknown.approvalGate = 'BYPASS';
    expect(() => prepareStructured(unknown)).toThrow('unknown fields');

    const incomplete = cloneJson(structuredDesign);
    delete (
      incomplete.process.steps[0] as Partial<
        (typeof incomplete.process.steps)[number]
      >
    ).apiContract;
    expect(() => prepareStructured(incomplete)).toThrow(
      'apiContract must be an object',
    );

    const missingWorkspaces = cloneJson(structuredDesign) as Partial<
      typeof structuredDesign
    >;
    delete missingWorkspaces.workspaces;
    expect(() => prepareStructured(missingWorkspaces)).toThrow(
      'workspaces must contain 1-200 items',
    );

    expect(() =>
      analyzeRequirementText('CCUS-PLATFORM', 'invalid.json', '{"process":', {
        documentSlot: 'invalid',
      }),
    ).toThrow('structured design JSON is invalid');

    expect(() =>
      prepareStructured(structuredDesign, {
        explicitProcessCode: 'DIFFERENT_PROCESS',
      }),
    ).toThrow('ambiguous structured process identity');

    const duplicate = cloneJson(structuredDesign);
    const duplicateStep = cloneJson(duplicate.process.steps[0]);
    duplicateStep.requirementId = 'REQ_APPLICATION_REVIEW_V2';
    duplicate.process.steps.push(duplicateStep);
    expect(() => prepareStructured(duplicate)).toThrow(
      'stepCode must be unique',
    );
  });

  it('rejects duplicate requirement identities before persistence', () => {
    const duplicate = cloneJson(structuredDesign);
    const first = duplicate.process.steps[0];
    first.toState = 'REVIEWED';
    const second = cloneJson(first);
    second.stepCode = 'ARCHIVE_APPLICATION';
    second.stepOrder = 20;
    second.screenName = '신청 보관 화면';
    second.routePath = '/generated/application/archive';
    second.commandCode = 'ARCHIVE_APPLICATION';
    second.fromState = 'REVIEWED';
    second.toState = 'COMPLETED';
    duplicate.process.steps.push(second);

    expect(() => prepareStructured(duplicate)).toThrow(
      'requirementId must be unique',
    );
  });

  it('matches Java bridge collection and integer bounds', () => {
    const permissions = cloneJson(structuredDesign);
    permissions.process.steps[0].permissionCodes = Array.from(
      { length: 201 },
      (_, index) => `PERMISSION_${index}`,
    );
    expect(() => prepareStructured(permissions)).toThrow(
      'permissionCodes must contain 1-200 items',
    );

    const sections = cloneJson(structuredDesign);
    sections.process.steps[0].sections = Array.from(
      { length: 201 },
      (_, index) => ({
        sectionCode: `SECTION_${index}`,
        order: index + 1,
        componentType: 'JSON_FORM',
      }),
    );
    expect(() => prepareStructured(sections)).toThrow(
      'sections must contain 1-200 items',
    );

    const fields = cloneJson(structuredDesign);
    fields.process.steps[0].fields = Array.from(
      { length: 501 },
      (_, index) => ({
        fieldCode: `FIELD_${index}`,
        label: `필드 ${index}`,
        type: 'string',
        required: false,
        order: index + 1,
      }),
    );
    expect(() => prepareStructured(fields)).toThrow(
      'fields must contain 1-500 items',
    );

    const acceptance = cloneJson(structuredDesign);
    acceptance.process.steps[0].acceptanceCriteria = Array.from(
      { length: 101 },
      (_, index) => `인수 조건 ${index}`,
    );
    expect(() => prepareStructured(acceptance)).toThrow(
      'acceptanceCriteria must contain 1-100 items',
    );

    const order = cloneJson(structuredDesign);
    order.process.steps[0].stepOrder = 2_147_483_648;
    expect(() => prepareStructured(order)).toThrow(
      'stepOrder must be a positive Java integer',
    );

    const title = cloneJson(structuredDesign);
    title.process.steps[0].title = 'T'.repeat(241);
    expect(() => prepareStructured(title)).toThrow(
      'title exceeds 240 characters',
    );

    const screenName = cloneJson(structuredDesign);
    screenName.process.steps[0].screenName = 'S'.repeat(161);
    expect(() => prepareStructured(screenName)).toThrow(
      'screenName exceeds 160 characters',
    );

    const actorName = cloneJson(structuredDesign);
    actorName.actorDefinitions[0].actorName = 'A'.repeat(121);
    expect(() => prepareStructured(actorName)).toThrow(
      'actorName exceeds 120 characters',
    );

    const route = cloneJson(structuredDesign);
    route.process.steps[0].routePath = `/${'r'.repeat(300)}`;
    expect(() => prepareStructured(route)).toThrow(
      'routePath is not canonical',
    );

    const endpoint = cloneJson(structuredDesign);
    endpoint.process.steps[0].endpoint.path = `/${'e'.repeat(270)}`;
    endpoint.process.steps[0].apiContract.path =
      endpoint.process.steps[0].endpoint.path;
    expect(() => prepareStructured(endpoint)).toThrow(
      'endpoint is not a canonical endpoint',
    );

    const workspace = cloneJson(structuredDesign);
    workspace.workspaces[0].tabs[0].label = 'DESIGN WRONG';
    expect(() => prepareStructured(workspace)).toThrow(
      'workspaces must match the canonical design/develop/operate 25-tab contract',
    );

    expect(() =>
      decodeRequirementDocument({
        fileName: 'requirements.txt',
        extractedText: 'requirement',
        mimeType: 'x'.repeat(161),
      }),
    ).toThrow('mimeType must fit the 160 character storage contract');
    expect(() =>
      prepare(requirementText, 'requirements.md', 2_147_483_648),
    ).toThrow('designVersion must be a positive PostgreSQL integer');
  });
  it('keeps logical process identity stable across content and file changes', () => {
    const first = prepare();
    const changed = prepare(
      '기업 담당자는 변경된 프로젝트를 등록한다.\n검증자는 제출 자료를 승인한다.',
      'renamed.md',
      2,
    );
    expect(changed.analysis.processCode).toBe(first.analysis.processCode);
    expect(changed.contract.contentSha256).not.toBe(
      first.contract.contentSha256,
    );
    expect(
      analyzeRequirementText('P1', 'other.md', '사용자는 목록을 조회한다.', {
        explicitProcessCode: 'application_review',
      }).processCode,
    ).toBe('APPLICATION_REVIEW');
  });

  it('emits the complete hash-bound design and exact reconciliation sets', () => {
    const { contract } = prepare();
    expect(contract.process.steps[0]).toEqual(
      expect.objectContaining({
        layoutCode: 'RESPONSIVE_WORKSPACE',
        themeCode: 'KRDS_GOV_DEFAULT',
        sections: expect.any(Array),
        permissionCodes: expect.arrayContaining([expect.any(String)]),
        commandCode: expect.any(String),
        endpoint: expect.objectContaining({ method: 'POST' }),
        apiContract: expect.objectContaining({ method: 'POST' }),
      }),
    );
    expect(contract.actorDefinitions).toHaveLength(2);
    expect(contract.workspaces.flatMap(item => item.tabs)).toHaveLength(25);
    expect(contract.generation.commonLayout).toBe('RESPONSIVE_WORKSPACE');
    expect(contract.generation.commonTheme).toBe('KRDS_GOV_DEFAULT');
    expect(contract.reconciliation).toEqual(
      expect.objectContaining({
        mode: 'EXACT_SET',
        staleIdentityIntent: 'REMOVE_GENERATOR_OWNED_MISSING',
        stepCodes: contract.process.steps.map(step => step.stepCode).sort(),
      }),
    );
    expect(contract.source.contentSha256).toBe(contract.contentSha256);
    expect(contract.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates designVersion from canonical content', () => {
    const { document, analysis, contract } = prepare();
    const v2 = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 2,
      document,
      analysis,
    });
    expect(v2.designVersion).toBe(2);
    expect(v2.contentSha256).toBe(contract.contentSha256);
  });

  it.each([
    [
      'route',
      (analysis: RequirementAnalysis) => {
        analysis.requirements[0].routePath = '/emission/projects/create';
      },
    ],
    [
      'step identity',
      (analysis: RequirementAnalysis) => {
        analysis.requirements[0].stepCode = 'CREATE_PROJECT';
      },
    ],
    [
      'layout',
      (analysis: RequirementAnalysis) => {
        analysis.commonLayout = 'COMMON_KRDS_WIDE_LAYOUT';
        analysis.requirements[0].layoutCode = analysis.commonLayout;
      },
    ],
    [
      'theme',
      (analysis: RequirementAnalysis) => {
        analysis.commonTheme = 'KRDS_HIGH_CONTRAST';
        analysis.requirements[0].themeCode = analysis.commonTheme;
      },
    ],
    [
      'section',
      (analysis: RequirementAnalysis) => {
        analysis.requirements[0].sections[0].componentType =
          'KRDS_TASK_HEADER_V2';
      },
    ],
    [
      'permission',
      (analysis: RequirementAnalysis) => {
        const permission = 'PROJECT.CREATE.V2';
        const step = analysis.requirements[0];
        step.permissionCodes = [permission];
        analysis.actorDefinitions.find(
          actor => actor.actorCode === step.actorCode,
        )!.permissionCodes = [permission];
      },
    ],
    [
      'command',
      (analysis: RequirementAnalysis) => {
        analysis.requirements[0].commandCode = 'CREATE_PROJECT_V2';
      },
    ],
    [
      'api',
      (analysis: RequirementAnalysis) => {
        const endpoint = {
          method: 'POST',
          path: '/api/v2/emission/projects',
        };
        analysis.requirements[0].endpoint = endpoint;
        analysis.requirements[0].apiContract = endpoint;
      },
    ],
  ])('changes content hash for a %s design mutation', (_name, mutate) => {
    const { document, analysis, contract } = prepare();
    const changedAnalysis = clone(analysis);
    mutate(changedAnalysis);
    const changed = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 2,
      document,
      analysis: changedAnalysis,
    });
    expect(changed.process.processCode).toBe(contract.process.processCode);
    expect(changed.contentSha256).not.toBe(contract.contentSha256);
  });

  it('canonicalizes object keys and set/explicit-order permutations', () => {
    const { document, analysis, contract } = prepare();
    const permuted = clone(analysis);
    permuted.workspaces.reverse();
    permuted.workspaces.forEach(item => {
      item.tabs.reverse();
      item.tabs.forEach(tab => tab.sections.reverse());
    });
    permuted.actorDefinitions.reverse();
    permuted.actorDefinitions.forEach(actor => actor.permissionCodes.reverse());
    permuted.requirements.reverse();
    permuted.requirements.forEach(step => {
      step.sections.reverse();
      step.fields.reverse();
      step.acceptanceCriteria.reverse();
    });
    const reversedKeys = JSON.parse(
      JSON.stringify(permuted, (_key, value) =>
        value && !Array.isArray(value) && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
      ),
    ) as RequirementAnalysis;
    const canonical = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 1,
      document,
      analysis: reversedKeys,
    });
    expect(canonical.contentSha256).toBe(contract.contentSha256);
  });

  it('uses locale-independent code-point ordering for canonical sets', () => {
    const { document, analysis } = prepare();
    const multilingual = clone(analysis);
    const endpoint = {
      method: multilingual.requirements[0].endpoint.method,
      path: multilingual.requirements[0].endpoint.path,
      한글: '값',
      ASCII: 'value',
    };
    multilingual.requirements[0].endpoint = endpoint as unknown as {
      method: string;
      path: string;
    };
    multilingual.requirements[0].apiContract = JSON.parse(
      JSON.stringify(multilingual.requirements[0].endpoint),
    ) as { method: string; path: string };
    const forward = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 1,
      document,
      analysis: multilingual,
    });
    multilingual.requirements[0].endpoint = Object.fromEntries(
      Object.entries(multilingual.requirements[0].endpoint).reverse(),
    ) as unknown as { method: string; path: string };
    multilingual.requirements[0].apiContract = JSON.parse(
      JSON.stringify(multilingual.requirements[0].endpoint),
    ) as { method: string; path: string };
    const reversed = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 1,
      document,
      analysis: multilingual,
    });
    expect(reversed.contentSha256).toBe(forward.contentSha256);
  });

  it('fails closed for ambiguous identity and incomplete design closure', () => {
    expect(() =>
      analyzeRequirementText('P1', 'r.md', '사용자는 조회한다.', {
        documentSlot: 'main',
        stableFileKey: 'different',
      }),
    ).toThrow('ambiguous requirement identity');
    const { document, analysis } = prepare();
    const build = (candidate: RequirementAnalysis) =>
      buildRequirementDesignContract({
        projectId: 'CCUS-PLATFORM',
        designVersion: 2,
        document,
        analysis: candidate,
      });
    const missingActor = clone(analysis);
    missingActor.actorDefinitions = [];
    expect(() => build(missingActor)).toThrow('has no actor definition');
    const ungranted = clone(analysis);
    ungranted.requirements[0].permissionCodes = ['PROJECT.UNGRANTED'];
    expect(() => build(ungranted)).toThrow('is not granted');
    const mismatchedApi = clone(analysis);
    mismatchedApi.requirements[0].apiContract.path = '/different';
    expect(() => build(mismatchedApi)).toThrow('incomplete design contract');
    const duplicateSection = clone(analysis);
    duplicateSection.requirements[0].sections[1].order =
      duplicateSection.requirements[0].sections[0].order;
    expect(() => build(duplicateSection)).toThrow('sectionOrder');
    const unusedActor = clone(analysis);
    unusedActor.actorDefinitions.push({
      actorCode: 'UNUSED_ACTOR',
      actorName: '미사용',
      description: '미사용 액터',
      permissionCodes: ['UNUSED.PERMISSION'],
    });
    expect(() => build(unusedActor)).toThrow('unused actor');
    expect(() =>
      decodeRequirementDocument({
        fileName: 'requirements.pdf',
        contentBase64: Buffer.from('%PDF').toString('base64'),
      }),
    ).toThrow('extractedText is required');
  });
});
