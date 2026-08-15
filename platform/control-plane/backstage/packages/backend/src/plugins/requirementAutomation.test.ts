import {
  analyzeRequirementText,
  buildRequirementDesignContract,
  decodeRequirementDocument,
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

describe('requirement automation', () => {
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
      'workspace tab',
      (analysis: RequirementAnalysis) => {
        analysis.workspaces[0].tabs[0].label = '요구사항 전문 설계';
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
