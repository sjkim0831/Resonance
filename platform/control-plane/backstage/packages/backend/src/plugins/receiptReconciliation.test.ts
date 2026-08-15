import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  reconcileDesignSnapshotSyncBatch,
  reconcileRequirementReceiptBatch,
  receiptRetryDelayMs,
  selectFairRequirementClaims,
  type DesignSnapshotSyncClaim,
  type RequirementReceiptClaim,
} from './receiptReconciliation';

const requirementClaim = (
  documentId: string,
  projectId: string,
): RequirementReceiptClaim => ({
  documentId,
  projectId,
  designVersion: 1,
  contractSha256: documentId.padEnd(64, 'a').slice(0, 64),
  claimToken: `claim-${documentId}`,
  pollAttempt: 1,
});

describe('headless receipt reconciliation', () => {
  it('wires an indexed leased scheduler instead of depending on an open browser', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    expect(route).toContain('resonance_requirement_document_receipt_due_idx');
    expect(route).toContain('resonance_design_asset_source_sync_due_idx');
    expect(route).toContain('.forUpdate()');
    expect(route).toContain('.skipLocked()');
    expect(route).toContain('publication_claim_token');
    expect(route).toContain('publication_lease_expires_at');
    expect(route).toContain('const commitDesignSnapshotSync');
    expect(route).toContain('receiptRetryDelayMs(claimedPollAttempt)');
    expect(route).not.toContain('settleRequirementReceiptClaim');
    expect(route).not.toContain('settleDesignSnapshotSyncClaim');
    expect(route).toContain('scheduler.scheduleTask({');
    expect(route).toContain('frequency: { seconds: 15 }');
    expect(route).toContain('reconcileRequirementReceiptBatch({');
    expect(route).toContain('reconcileDesignSnapshotSyncBatch({');
  });

  it('bounds retry backoff and round-robins projects before their second document', () => {
    expect([1, 2, 3, 4, 5, 20].map(receiptRetryDelayMs)).toEqual([
      5_000, 10_000, 20_000, 40_000, 60_000, 60_000,
    ]);
    expect(
      selectFairRequirementClaims(
        [
          { projectId: 'A', documentId: 'A1', dueAt: '2026-01-01T00:00:00Z' },
          { projectId: 'A', documentId: 'A2', dueAt: '2026-01-01T00:00:01Z' },
          { projectId: 'B', documentId: 'B1', dueAt: '2026-01-01T00:00:02Z' },
          { projectId: 'C', documentId: 'C1', dueAt: '2026-01-01T00:00:03Z' },
        ],
        4,
      ).map(item => item.documentId),
    ).toEqual(['A1', 'B1', 'C1', 'A2']);
  });

  it('converges every queued document with the UI closed', async () => {
    const claims = [
      requirementClaim('doc-1', 'A'),
      requirementClaim('doc-2', 'A'),
      requirementClaim('doc-3', 'B'),
    ];
    const settled: string[] = [];
    const summary = await reconcileRequirementReceiptBatch({
      claimDue: async () => claims,
      readReceipt: async claim => ({
        success: true,
        status: 'APPLIED',
        documentId: claim.documentId,
      }),
      persistReceipt: async (claim, disposition) => {
        settled.push(claim.documentId);
        return disposition;
      },
      retryClaim: async () => false,
    });

    expect(settled.sort()).toEqual(['doc-1', 'doc-2', 'doc-3']);
    expect(summary).toEqual({
      claimed: 3,
      terminal: 3,
      pending: 0,
      retried: 0,
      stale: 0,
    });
  });

  it('persists backoff across a restart and never writes an already-applied row', async () => {
    const claim = requirementClaim('doc-restart', 'A');
    let dueAt = new Date(0);
    let failed = false;
    let localStatus = 'QUEUED';
    let clock = new Date('2026-08-16T00:00:00Z');
    const claimDue = async () =>
      localStatus === 'QUEUED' && clock >= dueAt ? [claim] : [];
    const retryClaim = async (
      _claim: RequirementReceiptClaim,
      _message: string,
      nextAttemptAt: Date,
    ) => {
      dueAt = nextAttemptAt;
      failed = true;
      return true;
    };
    const first = await reconcileRequirementReceiptBatch({
      claimDue,
      readReceipt: async () => {
        throw new Error('temporary runtime outage');
      },
      persistReceipt: async (_claim, disposition) => disposition,
      retryClaim,
      now: () => clock,
    });
    expect(first.retried).toBe(1);
    expect(failed).toBe(true);

    clock = new Date(clock.getTime() + 4_999);
    await expect(
      reconcileRequirementReceiptBatch({
        claimDue,
        readReceipt: async () => ({ status: 'APPLIED' }),
        persistReceipt: async (_claim, disposition) => disposition,
        retryClaim,
        now: () => clock,
      }),
    ).resolves.toMatchObject({ claimed: 0 });

    localStatus = 'APPLIED';
    clock = new Date(clock.getTime() + 1);
    const persistReceipt = jest.fn();
    await reconcileRequirementReceiptBatch({
      claimDue,
      readReceipt: async () => ({ status: 'APPLIED' }),
      persistReceipt,
      retryClaim,
      now: () => clock,
    });
    expect(persistReceipt).not.toHaveBeenCalled();
  });

  it('allows only one concurrent worker to claim and persist a document', async () => {
    const claim = requirementClaim('doc-race', 'A');
    let available = true;
    let writes = 0;
    const claimDue = async () => {
      if (!available) return [];
      available = false;
      return [claim];
    };
    const run = () =>
      reconcileRequirementReceiptBatch({
        claimDue,
        readReceipt: async () => ({ status: 'APPLIED' }),
        persistReceipt: async (_claim, disposition) => {
          writes += 1;
          return disposition;
        },
        retryClaim: async () => true,
      });

    const summaries = await Promise.all([run(), run()]);
    expect(summaries.map(item => item.claimed).sort()).toEqual([0, 1]);
    expect(writes).toBe(1);
  });

  it('keeps a split 202 design receipt pending and converges on automatic retry', async () => {
    const claim: DesignSnapshotSyncClaim = {
      syncId: 'sync-1',
      projectId: 'A',
      assetType: 'THEME',
      assetId: 'KRDS',
      snapshotBaseFingerprint: 'a'.repeat(64),
      assetFingerprint: 'b'.repeat(64),
      mutation: { assetFingerprint: 'b'.repeat(64) },
      actorRef: 'user:default/approver',
      claimToken: 'lease-1',
      retryAttempt: 1,
    };
    let pending = true;
    let snapshotWrites = 0;
    let applyAttempts = 0;
    const run = () =>
      reconcileDesignSnapshotSyncBatch({
        claimDue: async () => (pending ? [claim] : []),
        replaySource: async () => ({
          sourceCommitted: true,
          assetFingerprint: 'b'.repeat(64),
        }),
        commitSnapshot: async () => {
          applyAttempts += 1;
          if (applyAttempts === 1) throw new Error('snapshot unavailable');
          snapshotWrites += 1;
          pending = false;
          return true;
        },
        retryClaim: async () => true,
      });

    await expect(run()).resolves.toMatchObject({ retried: 1, terminal: 0 });
    expect(pending).toBe(true);
    await expect(run()).resolves.toMatchObject({ retried: 0, terminal: 1 });
    expect(snapshotWrites).toBe(1);
    expect(pending).toBe(false);
  });

  it('persists split source receipts before returning 202 without a snapshot fingerprint', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const sourceStart = route.indexOf("'/design-assets/:projectId/source'");
    const syncEndpoint = route.indexOf(
      "'/design-assets/:projectId/source-sync/:syncId'",
      sourceStart,
    );
    const source = route.slice(sourceStart, syncEndpoint);
    const prepareStart = source.indexOf('queueDesignSnapshotSync({');
    const runtimeStart = source.indexOf(
      '/api/internal/actor-process/design-assets/source`',
      prepareStart,
    );
    const catchStart = source.indexOf(
      '} catch (error) {',
      source.indexOf('response.status(result.status)', runtimeStart),
    );
    const responseStart = source.indexOf('response.status(202)', catchStart);
    const splitReceipt = source.slice(
      catchStart,
      source.indexOf('return;', responseStart),
    );
    expect(prepareStart).toBeGreaterThan(0);
    expect(runtimeStart).toBeGreaterThan(prepareStart);
    expect(catchStart).toBeGreaterThan(runtimeStart);
    expect(responseStart).toBeGreaterThan(catchStart);
    expect(route).toContain("sync_status: 'PREPARED'");
    expect(route).toContain('resonance_design_asset_source_sync_active_uq');
    expect(route).toContain('synchronizeGlobalDesignAssetSnapshots(');
    expect(route).not.toContain('CONTROL_PLANE_DESIGN_SNAPSHOT_NOT_FOUND');
    expect(splitReceipt).toContain("controlPlaneSnapshot: 'SYNC_REQUIRED'");
    expect(splitReceipt).toContain('syncReceiptId');
    expect(splitReceipt).toContain('sourceCommitState:');
    expect(splitReceipt).not.toContain('snapshotFingerprint');
  });
});
