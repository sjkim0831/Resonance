import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  reconcileDesignSnapshotSyncBatch,
  reconcileRequirementReceiptBatch,
  receiptPollDelayMs,
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
  errorAttempt: 0,
  publicationMode: 'RECEIPT',
});

describe('headless receipt reconciliation', () => {
  it('wires an indexed leased scheduler instead of depending on an open browser', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    expect(route).toContain('resonance_requirement_document_finite_due_idx');
    expect(route).toContain('resonance_design_asset_source_sync_due_idx');
    expect(route).toContain('.forUpdate()');
    expect(route).toContain('.skipLocked()');
    expect(route).toContain('publication_claim_token');
    expect(route).toContain('publication_lease_expires_at');
    expect(route).toContain('const commitDesignSnapshotSync');
    expect(route).toContain('receiptPollDelayMs(claimedPollAttempt)');
    expect(route).toContain('publication_error_attempt_count');
    expect(route).toContain(
      "'document.publication_error_attempt_count as errorAttempt'",
    );
    expect(route).not.toContain('settleRequirementReceiptClaim');
    expect(route).not.toContain('settleDesignSnapshotSyncClaim');
    expect(route).toContain('scheduler.scheduleTask({');
    expect(route).toContain('frequency: { seconds: 15 }');
    expect(route).toContain('reconcileRequirementReceiptBatch({');
    expect(route).toContain('reconcileDesignSnapshotSyncBatch({');
  });

  it('bounds retry backoff and round-robins projects before their second document', () => {
    const boundedDelays = [5_000, 10_000, 20_000, 40_000, 60_000, 60_000];
    expect([1, 2, 3, 4, 5, 20].map(receiptPollDelayMs)).toEqual(boundedDelays);
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
      retryClaim: async () => 'STALE',
    });

    expect(settled.sort()).toEqual(['doc-1', 'doc-2', 'doc-3']);
    expect(summary).toEqual({
      claimed: 3,
      terminal: 3,
      pending: 0,
      retried: 0,
      deadLettered: 0,
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
      return 'RETRIED' as const;
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
        retryClaim: async () => 'RETRIED',
      });

    const summaries = await Promise.all([run(), run()]);
    expect(summaries.map(item => item.claimed).sort()).toEqual([0, 1]);
    expect(writes).toBe(1);
  });

  it('keeps more than fifteen minutes of normal queued/running polls outside the error budget and then applies', async () => {
    const retryClaim = jest.fn(async () => 'RETRIED' as const);
    const dispositions: string[] = [];
    const pendingPolls = 18;

    expect(
      Array.from({ length: pendingPolls }, (_, index) =>
        receiptPollDelayMs(index + 1),
      ).reduce((total, delay) => total + delay, 0),
    ).toBeGreaterThanOrEqual(15 * 60 * 1_000);

    for (
      let pollAttempt = 1;
      pollAttempt <= pendingPolls + 1;
      pollAttempt += 1
    ) {
      const claim = {
        ...requirementClaim('doc-long-running', 'A'),
        pollAttempt,
        errorAttempt: 0,
      };
      const expected = pollAttempt === pendingPolls + 1 ? 'APPLIED' : 'QUEUED';
      let runtimeStatus = pollAttempt % 2 ? 'RUNNING' : 'QUEUED';
      if (expected === 'APPLIED') runtimeStatus = 'APPLIED';
      const summary = await reconcileRequirementReceiptBatch({
        claimDue: async () => [claim],
        readReceipt: async () => ({
          status: runtimeStatus,
          terminal: expected === 'APPLIED',
          retryAttempt: 0,
          retryExhausted: false,
        }),
        persistReceipt: async (_claim, disposition) => {
          dispositions.push(disposition);
          return disposition;
        },
        retryClaim,
      });
      expect(summary.deadLettered).toBe(0);
      expect(summary.retried).toBe(0);
      expect(summary[expected === 'APPLIED' ? 'terminal' : 'pending']).toBe(1);
    }

    expect(dispositions).toEqual([
      ...Array.from({ length: pendingPolls }, () => 'QUEUED'),
      'APPLIED',
    ]);
    expect(retryClaim).not.toHaveBeenCalled();
  });

  it('persists transport, parse, and 5xx failures in an independent five-error budget across restart', async () => {
    let clock = new Date('2026-08-16T00:00:00Z');
    const failures = [
      'RUNTIME_RECEIPT_REQUEST_FAILED',
      'RUNTIME_RECEIPT_RESPONSE_NOT_JSON',
      'RUNTIME_RECEIPT_HTTP_503',
      'RUNTIME_RECEIPT_REQUEST_FAILED',
      'RUNTIME_RECEIPT_HTTP_500',
    ];
    let failureIndex = 0;
    let durable = {
      status: 'PENDING',
      pollAttempt: 12,
      errorAttempt: 0,
      nextAttemptAt: new Date(clock),
    };
    const scheduledDelays: number[] = [];
    const claimDue = async () => {
      if (
        durable.status !== 'PENDING' ||
        durable.nextAttemptAt.getTime() > clock.getTime()
      ) {
        return [];
      }
      durable.status = 'RUNNING';
      durable.pollAttempt += 1;
      return [
        {
          ...requirementClaim('doc-transport-poison', 'A'),
          pollAttempt: durable.pollAttempt,
          errorAttempt: durable.errorAttempt,
        },
      ];
    };
    const retryClaim = async (
      claim: RequirementReceiptClaim,
      _message: string,
      nextAttemptAt: Date,
    ) => {
      expect(claim.errorAttempt).toBe(durable.errorAttempt);
      scheduledDelays.push(nextAttemptAt.getTime() - clock.getTime());
      durable.errorAttempt += 1;
      durable.status = durable.errorAttempt >= 5 ? 'DEAD_LETTERED' : 'PENDING';
      durable.nextAttemptAt = nextAttemptAt;
      return durable.status === 'DEAD_LETTERED'
        ? ('DEAD_LETTERED' as const)
        : ('RETRIED' as const);
    };
    const run = () =>
      reconcileRequirementReceiptBatch({
        claimDue,
        readReceipt: async () => {
          const failure = failures[failureIndex];
          failureIndex += 1;
          throw new Error(failure);
        },
        persistReceipt: async (_claim, disposition) => disposition,
        retryClaim,
        now: () => clock,
      });

    for (let errorAttempt = 1; errorAttempt <= 5; errorAttempt += 1) {
      const summary = await run();
      expect(summary[errorAttempt === 5 ? 'deadLettered' : 'retried']).toBe(1);
      if (errorAttempt === 5) break;

      // A scheduler tick before the persisted due time cannot reclaim the row.
      await expect(run()).resolves.toMatchObject({ claimed: 0 });
      if (errorAttempt === 2) {
        // Serialize/restore the durable state to model a process restart.
        durable = {
          ...JSON.parse(JSON.stringify(durable)),
          nextAttemptAt: new Date(durable.nextAttemptAt),
        };
      }
      clock = new Date(durable.nextAttemptAt);
    }

    expect(durable).toMatchObject({
      status: 'DEAD_LETTERED',
      pollAttempt: 17,
      errorAttempt: 5,
    });
    expect(failureIndex).toBe(5);
    expect(scheduledDelays).toEqual([5_000, 10_000, 20_000, 40_000, 60_000]);
  });

  it('dead-letters a poison requirement receipt at the finite fifth attempt', async () => {
    const claim = {
      ...requirementClaim('doc-poison', 'A'),
      pollAttempt: 5,
      errorAttempt: 4,
      publicationMode: 'PUBLISH' as const,
      contract: { schemaVersion: '3.0.0' },
    };
    const retryClaim = jest.fn(async () => 'DEAD_LETTERED' as const);
    const summary = await reconcileRequirementReceiptBatch({
      claimDue: async () => [claim],
      readReceipt: async () => {
        throw new Error('poison runtime response');
      },
      persistReceipt: async (_claim, disposition) => disposition,
      retryClaim,
    });

    expect(summary).toEqual({
      claimed: 1,
      terminal: 1,
      pending: 0,
      retried: 0,
      deadLettered: 1,
      stale: 0,
    });
    expect(retryClaim).toHaveBeenCalledWith(
      claim,
      'poison runtime response',
      expect.any(Date),
    );
  });

  it('publishes a durable VALIDATED claim and converges it to APPLIED', async () => {
    const claim = {
      ...requirementClaim('doc-validated', 'A'),
      publicationMode: 'PUBLISH' as const,
      contract: { schemaVersion: '3.0.0', projectId: 'A' },
    };
    const readReceipt = jest.fn(async () => ({
      success: true,
      status: 'APPLIED',
    }));
    const persistReceipt = jest.fn(async (_claim, disposition) => disposition);
    const summary = await reconcileRequirementReceiptBatch({
      claimDue: async () => [claim],
      readReceipt,
      persistReceipt,
      retryClaim: async () => 'STALE',
    });

    expect(summary).toMatchObject({ claimed: 1, terminal: 1, retried: 0 });
    expect(readReceipt).toHaveBeenCalledWith(claim);
    expect(persistReceipt).toHaveBeenCalledWith(
      claim,
      'APPLIED',
      expect.objectContaining({ status: 'APPLIED' }),
    );
  });

  it('uses a finite audited requirement queue and an authorized exact retry endpoint', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const retryStart = route.indexOf(
      "'/:projectId/requirements/:documentId/publication/retry'",
    );
    const retryEnd = route.indexOf(
      "router.get(\n          '/:projectId/requirements/:documentId'",
      retryStart,
    );
    const retry = route.slice(retryStart, retryEnd);

    expect(route).toContain('REQUIREMENT_RECEIPT_MAX_ATTEMPTS');
    expect(route).toContain("publication_reconcile_status: 'DEAD_LETTERED'");
    expect(route).toContain(
      "action_code: 'REQUIREMENT_PUBLICATION_DEAD_LETTERED'",
    );
    expect(retry).toContain("'DESIGN_APPROVER'");
    expect(retry).toContain(
      "action_code: 'REQUIREMENT_PUBLICATION_RETRY_REQUESTED'",
    );
    expect(retry).toContain('previousErrorAttemptCount: Number(');
    expect(retry).toContain('previousPollAttemptCount: Number(');
    expect(retry).toContain("disposition === 'APPLIED'");
    expect(retry).toContain('writeCount: 0');
    expect(retry).toContain("publication_reconcile_status: 'PENDING'");
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
        cancelClaim: async () => false,
        retryClaim: async () => 'RETRIED',
      });

    await expect(run()).resolves.toMatchObject({ retried: 1, terminal: 0 });
    expect(pending).toBe(true);
    await expect(run()).resolves.toMatchObject({ retried: 0, terminal: 1 });
    expect(snapshotWrites).toBe(1);
    expect(pending).toBe(false);
  });

  it('cancels an explicit runtime rejection without snapshot or retry writes', async () => {
    const claim: DesignSnapshotSyncClaim = {
      syncId: 'sync-rejected',
      projectId: 'A',
      assetType: 'THEME',
      assetId: 'KRDS',
      snapshotBaseFingerprint: 'a'.repeat(64),
      assetFingerprint: 'b'.repeat(64),
      mutation: { assetFingerprint: 'b'.repeat(64) },
      actorRef: 'user:default/approver',
      claimToken: 'lease-rejected',
      retryAttempt: 1,
    };
    const commitSnapshot = jest.fn();
    const cancelClaim = jest.fn(async () => true);
    const retryClaim = jest.fn(async () => 'RETRIED' as const);

    const summary = await reconcileDesignSnapshotSyncBatch({
      claimDue: async () => [claim],
      replaySource: async () => ({
        sourceCommitted: false,
        message: 'DEPENDENCY_FINGERPRINT_CHANGED',
      }),
      commitSnapshot,
      cancelClaim,
      retryClaim,
    });

    expect(summary).toEqual({
      claimed: 1,
      terminal: 1,
      pending: 0,
      retried: 0,
      deadLettered: 0,
      stale: 0,
    });
    expect(cancelClaim).toHaveBeenCalledWith(
      claim,
      'DEPENDENCY_FINGERPRINT_CHANGED',
      expect.objectContaining({ sourceCommitted: false }),
    );
    expect(commitSnapshot).not.toHaveBeenCalled();
    expect(retryClaim).not.toHaveBeenCalled();
  });

  it('retries only an unknown runtime outcome and does not cancel it', async () => {
    const claim: DesignSnapshotSyncClaim = {
      syncId: 'sync-unknown',
      projectId: 'A',
      assetType: 'THEME',
      assetId: 'KRDS',
      snapshotBaseFingerprint: 'a'.repeat(64),
      assetFingerprint: 'b'.repeat(64),
      mutation: { assetFingerprint: 'b'.repeat(64) },
      actorRef: 'user:default/approver',
      claimToken: 'lease-unknown',
      retryAttempt: 1,
    };
    const cancelClaim = jest.fn(async () => true);
    const retryClaim = jest.fn(async () => 'RETRIED' as const);

    const summary = await reconcileDesignSnapshotSyncBatch({
      claimDue: async () => [claim],
      replaySource: async () => ({ message: 'response was truncated' }),
      commitSnapshot: async () => true,
      cancelClaim,
      retryClaim,
    });

    expect(summary).toMatchObject({ retried: 1, terminal: 0, stale: 0 });
    expect(cancelClaim).not.toHaveBeenCalled();
    expect(retryClaim).toHaveBeenCalledTimes(1);
  });

  it('dead-letters the finite fifth source-sync attempt and preserves its confirmed runtime receipt', async () => {
    const claim: DesignSnapshotSyncClaim = {
      syncId: 'sync-dead-letter',
      projectId: 'A',
      assetType: 'THEME',
      assetId: 'KRDS',
      snapshotBaseFingerprint: 'a'.repeat(64),
      assetFingerprint: 'b'.repeat(64),
      mutation: { assetFingerprint: 'b'.repeat(64) },
      actorRef: 'user:default/approver',
      claimToken: 'lease-dead-letter',
      retryAttempt: 5,
    };
    const receipt = {
      sourceCommitted: true,
      assetFingerprint: 'b'.repeat(64),
    };
    const retryClaim = jest.fn(async () => 'DEAD_LETTERED' as const);

    const summary = await reconcileDesignSnapshotSyncBatch({
      claimDue: async () => [claim],
      replaySource: async () => receipt,
      commitSnapshot: async () => {
        throw new Error('snapshot database unavailable');
      },
      cancelClaim: async () => false,
      retryClaim,
    });

    expect(summary).toEqual({
      claimed: 1,
      terminal: 1,
      pending: 0,
      retried: 0,
      deadLettered: 1,
      stale: 0,
    });
    expect(retryClaim).toHaveBeenCalledWith(
      claim,
      'snapshot database unavailable',
      expect.any(Date),
      receipt,
    );
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
    expect(route).toContain('synchronizeGlobalDesignAssetSnapshotBatch(');
    expect(route).toContain('exactSourceDesignAssetSnapshotBatch(');
    expect(route).toContain('sourceReceiptId: claim.syncId');
    expect(route).not.toContain('CONTROL_PLANE_DESIGN_SNAPSHOT_NOT_FOUND');
    expect(splitReceipt).toContain("controlPlaneSnapshot: 'SYNC_REQUIRED'");
    expect(splitReceipt).toContain('syncReceiptId');
    expect(splitReceipt).toContain('sourceCommitState:');
    expect(splitReceipt).not.toContain('snapshotFingerprint');
  });

  it('creates a fresh 256-bit receipt for every prepared transition and reuses it only for replay', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const queueStart = route.indexOf('const queueDesignSnapshotSync = async');
    const cancelStart = route.indexOf(
      'const cancelPreparedDesignSnapshotSync = async',
      queueStart,
    );
    const queue = route.slice(queueStart, cancelStart);

    expect(route).toContain(
      "const designSnapshotSyncId = () => randomBytes(32).toString('hex');",
    );
    expect(queue).toContain('const syncId = designSnapshotSyncId();');
    expect(queue).toContain('.insert({ sync_id: syncId, ...row });');
    expect(queue).not.toContain('existing');
    expect(route).toContain('sourceReceiptId: preparedSync.syncId');
    expect(route).toContain('sourceReceiptId: claim.syncId');
  });

  it('bounds both source calls and preserves timeout truthfulness', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const sourceStart = route.indexOf("'/design-assets/:projectId/source'");
    const syncEndpoint = route.indexOf(
      "'/design-assets/:projectId/source-sync/:syncId'",
      sourceStart,
    );
    const source = route.slice(sourceStart, syncEndpoint);
    const headStart = source.indexOf('/design-assets/source-heads?');
    const prepareStart = source.indexOf('queueDesignSnapshotSync({');
    const postStart = source.indexOf(
      '/api/internal/actor-process/design-assets/source`',
      prepareStart,
    );
    const headCall = source.slice(headStart, prepareStart);
    const postCall = source.slice(
      postStart,
      source.indexOf('const runtimeText'),
    );

    expect(route).toContain('const RUNTIME_DESIGN_SOURCE_TIMEOUT_MS = 10_000;');
    expect(headStart).toBeGreaterThan(0);
    expect(prepareStart).toBeGreaterThan(headStart);
    expect(postStart).toBeGreaterThan(prepareStart);
    expect(headCall).toContain(
      'signal: AbortSignal.timeout(\n                        RUNTIME_DESIGN_SOURCE_TIMEOUT_MS',
    );
    expect(headCall.indexOf('headResponse.json()')).toBeLessThan(
      headCall.indexOf('} catch (error) {'),
    );
    expect(headCall).toContain('status: 502');
    expect(postCall).toContain(
      'signal: AbortSignal.timeout(\n                        RUNTIME_DESIGN_SOURCE_TIMEOUT_MS',
    );
    expect(postCall).toContain('RUNTIME_SOURCE_COMMIT_UNKNOWN');
    expect(source).toContain(
      "sourceCommitState:\n                    committedReceipt?.sourceCommitted === true\n                      ? 'COMMITTED'\n                      : 'UNKNOWN'",
    );
  });

  it('fences worker rejection cancellation and releases the active identity', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const cancelStart = route.indexOf(
      'const cancelDesignSnapshotSyncClaim = async',
    );
    const commitStart = route.indexOf(
      'const commitDesignSnapshotSync = async',
      cancelStart,
    );
    const cancel = route.slice(cancelStart, commitStart);
    const activeIndexStart = route.indexOf(
      'resonance_design_asset_source_sync_active_uq',
    );
    const activeIndex = route.slice(activeIndexStart, activeIndexStart + 300);
    const replayStart = route.indexOf('const replayDesignAssetSource = async');
    const replay = route.slice(replayStart, cancelStart);

    expect(cancelStart).toBeGreaterThan(0);
    expect(replay).toContain('result.body.sourceCommitted !== false');
    expect(cancel).toContain("sync_status: 'RUNNING'");
    expect(cancel).toContain('claim_token: claim.claimToken');
    expect(cancel).toContain("sync_status: 'CANCELLED'");
    expect(cancel).toContain('claim_token: null');
    expect(cancel).toContain('lease_expires_at: null');
    expect(cancel).toContain('runtime_receipt: JSON.stringify(receipt)');
    expect(activeIndex).toContain(
      "where sync_status in ('PREPARED','PENDING','RUNNING')",
    );
    expect(activeIndex).not.toContain('CANCELLED');
    expect(route).toContain(
      'drop constraint if exists resonance_design_asset_source_sync_identity_uq',
    );
    expect(route).not.toContain(
      "['project_id', 'asset_type', 'asset_id', 'asset_fingerprint']",
    );
    expect(route).toContain('cancelClaim: cancelDesignSnapshotSyncClaim');
  });

  it('uses a finite indexed source-sync queue with auditable dead-letter and authenticated retry', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const claimStart = route.indexOf('const claimDesignSnapshotSyncs = async');
    const replayStart = route.indexOf(
      'const replayDesignAssetSource = async',
      claimStart,
    );
    const claim = route.slice(claimStart, replayStart);
    const retryStart = route.indexOf(
      'const retryDesignSnapshotSyncClaim = async',
    );
    const routerStart = route.indexOf('const router = Router()', retryStart);
    const retry = route.slice(retryStart, routerStart);
    const manualRetryStart = route.indexOf(
      "'/design-assets/:projectId/source-sync/:syncId/retry'",
      routerStart,
    );
    const receiptReadStart = route.indexOf(
      "'/design-assets/:projectId/source-sync/:syncId'",
      routerStart,
    );
    const receiptRead = route.slice(receiptReadStart, manualRetryStart);
    const manualRetryEnd = route.indexOf(
      "'/design-assets/:projectId/drafts'",
      manualRetryStart,
    );
    const manualRetry = route.slice(manualRetryStart, manualRetryEnd);

    expect(route).toContain('const DESIGN_SNAPSHOT_SYNC_MAX_ATTEMPTS = 5;');
    expect(route).toContain('resonance_design_asset_source_sync_retry_due_idx');
    expect(route).toContain('resonance_design_asset_source_sync_exhausted_idx');
    expect(route).toContain(
      'and retry_attempt < ${DESIGN_SNAPSHOT_SYNC_MAX_ATTEMPTS}',
    );
    expect(claim).toContain("'retry_attempt',");
    expect(claim).toContain('.forUpdate()');
    expect(claim).toContain('.skipLocked()');
    expect(claim).toContain("reason: 'MAX_ATTEMPT_LEASE_EXPIRED'");
    expect(claim).toContain("sync_status: 'SYNC_TRACKING_FAILED'");
    expect(retry).toContain(
      "const nextStatus = exhausted ? 'SYNC_TRACKING_FAILED' : 'PENDING';",
    );
    expect(retry).toContain("action_code: 'SOURCE_SYNC_TRACKING_FAILED'");
    expect(retry).toContain("return 'DEAD_LETTERED'");
    expect(route).toContain(
      "'/design-assets/:projectId/source-sync/:syncId/retry'",
    );
    expect(receiptRead).toContain(
      "resolveDesignAssetAccess(\n              request,\n              'CCUS-PLATFORM'",
    );
    expect(receiptRead).not.toContain(
      'resolveDesignAssetAccess(request, projectId)',
    );
    expect(route).toContain("action_code: 'SOURCE_SYNC_RETRY_REQUESTED'");
    expect(manualRetry).toContain('resolveAuthenticatedProjectIdentity(');
    expect(manualRetry).toContain('lockGlobalDesignSourceAuthority(');
    expect(manualRetry).toContain('sourceIdentity.principals');
    expect(manualRetry).toContain('created_by: sourceIdentity.actorRef');
    expect(manualRetry).toContain('account_id: sourceIdentity.accountId');
    expect(manualRetry).toContain(
      'authority_principal: globalAuthorityPrincipal',
    );
    expect(manualRetry).not.toContain('requireDesignAssetRole(');
    expect(route).toContain("status: 'CANCELLED'");
    expect(route).toContain('retryExhausted: trackingFailed');
    expect(route).toContain('retryable: trackingFailed');
  });

  it('rechecks the requirement due timestamp in the locked SKIP LOCKED query', () => {
    const route = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');
    const lockedStart = route.indexOf('const locked = await transaction(');
    const lockedEnd = route.indexOf('.skipLocked();', lockedStart);
    const lockedClaim = route.slice(lockedStart, lockedEnd);

    expect(lockedStart).toBeGreaterThan(0);
    expect(lockedClaim).toContain(
      ".orWhere('document.publication_next_attempt_at', '<=', now)",
    );
    expect(lockedClaim).toContain('.forUpdate()');
  });
});
