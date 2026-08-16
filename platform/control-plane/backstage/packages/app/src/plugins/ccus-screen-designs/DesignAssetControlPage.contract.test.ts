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

  it('does not treat a split 202 receipt as success or replace the fingerprint optimistically', () => {
    const splitStart = source.indexOf('sourceResponse.status === 202');
    const splitConditionEnd = source.indexOf(') {', splitStart);
    const splitCondition = source.slice(splitStart, splitConditionEnd);
    expect(source).toContain('sourceResponse.status === 202');
    expect(source).toContain("result.controlPlaneSnapshot === 'SYNC_REQUIRED'");
    expect(splitCondition).not.toContain('result.sourceCommitted === true');
    expect(source).toContain('런타임 원본 확인 중');
    expect(source).toContain('result.syncReceiptId');
    expect(source).toContain('pollDesignAssetSync');
    expect(source).toContain("result.controlPlaneSnapshot === 'SYNCHRONIZED'");
    expect(source).toContain(
      'authoritative.fingerprint !== sync.receipt.snapshotFingerprint',
    );
  });

  it('shows truthful cancelled/unknown states and exposes dead-letter retry only', () => {
    expect(source).toContain("sync.receipt?.status === 'CANCELLED'");
    expect(source).toContain('동기화 취소됨 · 재시도 불가');
    expect(source).toContain("receipt?.sourceCommitState === 'UNKNOWN'");
    expect(source).toContain('receipt.retryable && receipt.syncReceiptId');
    expect(source).toContain('/retry`');
    expect(source).toContain('동기화 재시도');
  });

  it('uses the platform-global authority project instead of the selected project for mutation access', () => {
    expect(source).toContain(
      "const globalDesignAuthorityProjectId = 'CCUS-PLATFORM'",
    );
    expect(source).toContain(
      'encodeURIComponent(\n          globalDesignAuthorityProjectId,\n        )}/access`',
    );
    expect(source).not.toContain(
      'encodeURIComponent(\n          projectId,\n        )}/access`',
    );
  });
});
