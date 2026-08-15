/* eslint-disable no-restricted-imports */
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DesignAssetControlPage SOURCE immediate contract', () => {
  const source = readFileSync(
    join(__dirname, 'DesignAssetControlPage.tsx'),
    'utf8',
  );

  it('saves approved design source directly and exposes the truthful fanout receipt', () => {
    expect(source).toContain('SOURCE_IMMEDIATE_V1');
    expect(source).toContain("authorityMode: 'SOURCE'");
    expect(source).toContain(')}/source`');
    expect(source).toContain('permissions.canApprove');
    expect(source).toContain('설계 저장·코드 자동 반영');
    for (const receiptField of [
      'sourceCommitted',
      'affectedScreenCount',
      'affectedProcessCount',
      'jobCount',
      'endpointExpected',
      'controlPlaneSnapshot',
    ]) {
      expect(source).toContain(receiptField);
    }
  });

  it('does not expose the retired staged mutation workflow', () => {
    expect(source).not.toContain('/drafts');
    expect(source).not.toContain('saveDraft');
    expect(source).not.toContain('approveDraft');
    expect(source).not.toContain('reviewDraft');
    expect(source).not.toContain('requestRollback');
    expect(source).not.toContain('DESIGN_ASSET_PROMOTION');
  });
});
