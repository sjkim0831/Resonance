import {
  analyzeRequirementText,
  buildRequirementDesignContract,
  decodeRequirementDocument,
} from './requirementAutomation';

describe('requirement automation', () => {
  it('turns one uploaded document into traceable screens and endpoints', () => {
    const document = decodeRequirementDocument({
      fileName: 'requirements.md',
      contentBase64: Buffer.from(
        '# 배출량 프로젝트\n- 기업 담당자는 프로젝트를 등록한다.\n- 검증자는 제출 자료를 검토하고 승인한다.',
      ).toString('base64'),
    });
    const analysis = analyzeRequirementText(
      'CCUS-PLATFORM',
      document.fileName,
      document.text,
    );
    const contract = buildRequirementDesignContract({
      projectId: 'CCUS-PLATFORM',
      designVersion: 2,
      document,
      analysis,
    });

    expect(analysis.requirements).toHaveLength(3);
    expect(analysis.requirements[1].actorCode).toBe('COMPANY_MANAGER');
    expect(analysis.requirements[1].endpoint.method).toBe('POST');
    expect(analysis.requirements[2].actorCode).toBe('VERIFIER');
    expect(contract.workspaces).toHaveLength(3);
    expect(contract.workspaces.flatMap(workspace => workspace.tabs)).toHaveLength(25);
    expect(contract.process.steps).toHaveLength(3);
  });

  it('is deterministic and rejects binary files without extracted text', () => {
    expect(() =>
      decodeRequirementDocument({
        fileName: 'requirements.pdf',
        contentBase64: Buffer.from('%PDF').toString('base64'),
      }),
    ).toThrow('extractedText is required');
    const first = analyzeRequirementText('P1', 'r.txt', '사용자는 목록을 조회한다.');
    const second = analyzeRequirementText('P1', 'r.txt', '사용자는 목록을 조회한다.');
    expect(first).toEqual(second);
  });
});
