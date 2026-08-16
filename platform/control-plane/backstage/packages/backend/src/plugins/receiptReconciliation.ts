import {
  bridgePublicationDisposition,
  type RequirementPublicationDisposition,
} from './requirementIngestionLifecycle';

export const RECEIPT_RECONCILIATION_BATCH_SIZE = 10;
export const RECEIPT_RECONCILIATION_CONCURRENCY = 4;
export const RECEIPT_RECONCILIATION_LEASE_MS = 30_000;
export const REQUIREMENT_RECEIPT_MAX_ATTEMPTS = 5;

const boundedReceiptDelayMs = (attempt: number) =>
  Math.min(60_000, 5_000 * 2 ** Math.max(0, Math.min(8, attempt - 1)));

// Successful PENDING/RUNNING receipts and failed reads have independent
// clocks. Keeping the functions separate prevents a normal runtime wait from
// consuming the finite transport/parse error budget.
export const receiptPollDelayMs = (pollAttempt: number) =>
  boundedReceiptDelayMs(pollAttempt);

export const receiptRetryDelayMs = (errorAttempt: number) =>
  boundedReceiptDelayMs(errorAttempt);

export type RequirementReceiptClaim = {
  documentId: string;
  projectId: string;
  designVersion: number;
  contractSha256: string;
  claimToken: string;
  pollAttempt: number;
  errorAttempt: number;
  publicationMode: 'PUBLISH' | 'RECEIPT';
  contract?: Record<string, unknown>;
};

export type DesignSnapshotSyncClaim = {
  syncId: string;
  projectId: string;
  assetType: string;
  assetId: string;
  snapshotBaseFingerprint: string;
  assetFingerprint: string;
  mutation: Record<string, unknown>;
  actorRef: string;
  accountId?: string;
  authorityPrincipal?: string;
  claimToken: string;
  retryAttempt: number;
};

export type ReceiptReconciliationSummary = {
  claimed: number;
  terminal: number;
  pending: number;
  retried: number;
  deadLettered: number;
  stale: number;
};

export type DesignSnapshotRetryOutcome = 'RETRIED' | 'DEAD_LETTERED' | 'STALE';
export type RequirementReceiptRetryOutcome =
  | 'RETRIED'
  | 'DEAD_LETTERED'
  | 'STALE';

const emptySummary = (): ReceiptReconciliationSummary => ({
  claimed: 0,
  terminal: 0,
  pending: 0,
  retried: 0,
  deadLettered: 0,
  stale: 0,
});

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 2_000);

const runWithConcurrency = async <T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
) => {
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await work(items[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, concurrency)) },
      worker,
    ),
  );
};

/**
 * Produces a bounded round-robin batch. A project gets its first due document
 * before any project gets a second, preventing a large project from starving
 * smaller projects.
 */
export const selectFairRequirementClaims = <
  T extends { projectId: string; dueAt?: unknown; documentId: string },
>(
  candidates: readonly T[],
  limit: number,
) => {
  const groups = new Map<string, T[]>();
  const ordered = [...candidates].sort((left, right) => {
    const leftDue = new Date(String(left.dueAt ?? 0)).getTime();
    const rightDue = new Date(String(right.dueAt ?? 0)).getTime();
    return (
      leftDue - rightDue ||
      left.projectId.localeCompare(right.projectId) ||
      left.documentId.localeCompare(right.documentId)
    );
  });
  for (const candidate of ordered) {
    const group = groups.get(candidate.projectId) ?? [];
    group.push(candidate);
    groups.set(candidate.projectId, group);
  }
  const result: T[] = [];
  while (result.length < limit) {
    let advanced = false;
    for (const group of groups.values()) {
      const next = group.shift();
      if (!next) continue;
      result.push(next);
      advanced = true;
      if (result.length >= limit) break;
    }
    if (!advanced) break;
  }
  return result;
};

export const reconcileRequirementReceiptBatch = async ({
  claimDue,
  readReceipt,
  persistReceipt,
  retryClaim,
  batchSize = RECEIPT_RECONCILIATION_BATCH_SIZE,
  concurrency = RECEIPT_RECONCILIATION_CONCURRENCY,
  now = () => new Date(),
}: {
  claimDue: (limit: number) => Promise<RequirementReceiptClaim[]>;
  readReceipt: (
    claim: RequirementReceiptClaim,
  ) => Promise<Record<string, unknown>>;
  persistReceipt: (
    claim: RequirementReceiptClaim,
    disposition: RequirementPublicationDisposition,
    receipt: Record<string, unknown>,
  ) => Promise<RequirementPublicationDisposition>;
  retryClaim: (
    claim: RequirementReceiptClaim,
    message: string,
    nextAttemptAt: Date,
  ) => Promise<RequirementReceiptRetryOutcome>;
  batchSize?: number;
  concurrency?: number;
  now?: () => Date;
}) => {
  const summary = emptySummary();
  const claims = await claimDue(batchSize);
  summary.claimed = claims.length;
  await runWithConcurrency(claims, concurrency, async claim => {
    try {
      const receipt = await readReceipt(claim);
      const runtimeDisposition = bridgePublicationDisposition(receipt);
      if (!runtimeDisposition) {
        throw new Error('UNRECOGNIZED_RUNTIME_PUBLICATION_STATE');
      }
      const effectiveDisposition = await persistReceipt(
        claim,
        runtimeDisposition,
        receipt,
      );
      const terminal = [
        'APPLIED',
        'FAILED',
        'REVIEW_REQUIRED',
        'CANCELLED',
      ].includes(effectiveDisposition);
      if (terminal) summary.terminal += 1;
      else summary.pending += 1;
    } catch (error) {
      const nextAttemptAt = new Date(
        now().getTime() + receiptRetryDelayMs(claim.errorAttempt + 1),
      );
      const retryOutcome = await retryClaim(
        claim,
        errorMessage(error),
        nextAttemptAt,
      );
      if (retryOutcome === 'RETRIED') {
        summary.retried += 1;
      } else if (retryOutcome === 'DEAD_LETTERED') {
        summary.deadLettered += 1;
        summary.terminal += 1;
      } else {
        summary.stale += 1;
      }
    }
  });
  return summary;
};

export const reconcileDesignSnapshotSyncBatch = async ({
  claimDue,
  replaySource,
  commitSnapshot,
  cancelClaim,
  retryClaim,
  batchSize = RECEIPT_RECONCILIATION_BATCH_SIZE,
  concurrency = RECEIPT_RECONCILIATION_CONCURRENCY,
  now = () => new Date(),
}: {
  claimDue: (limit: number) => Promise<DesignSnapshotSyncClaim[]>;
  replaySource: (
    claim: DesignSnapshotSyncClaim,
  ) => Promise<Record<string, unknown>>;
  commitSnapshot: (
    claim: DesignSnapshotSyncClaim,
    receipt: Record<string, unknown>,
  ) => Promise<boolean>;
  cancelClaim: (
    claim: DesignSnapshotSyncClaim,
    message: string,
    receipt: Record<string, unknown>,
  ) => Promise<boolean>;
  retryClaim: (
    claim: DesignSnapshotSyncClaim,
    message: string,
    nextAttemptAt: Date,
    receipt?: Record<string, unknown>,
  ) => Promise<DesignSnapshotRetryOutcome>;
  batchSize?: number;
  concurrency?: number;
  now?: () => Date;
}) => {
  const summary = emptySummary();
  const claims = await claimDue(batchSize);
  summary.claimed = claims.length;
  await runWithConcurrency(claims, concurrency, async claim => {
    let receipt: Record<string, unknown> | undefined;
    try {
      receipt = await replaySource(claim);
      if (receipt.sourceCommitted === false) {
        const cancelled = await cancelClaim(
          claim,
          String(receipt.message ?? 'RUNTIME_SOURCE_REJECTED'),
          receipt,
        );
        if (cancelled) summary.terminal += 1;
        else summary.stale += 1;
        return;
      }
      if (receipt.sourceCommitted !== true) {
        throw new Error(
          String(receipt.message ?? 'RUNTIME_SOURCE_NOT_COMMITTED'),
        );
      }
      if (
        String(receipt.assetFingerprint ?? '').toLowerCase() !==
        claim.assetFingerprint.toLowerCase()
      ) {
        throw new Error('RUNTIME_SOURCE_RECEIPT_FINGERPRINT_MISMATCH');
      }
      if (await commitSnapshot(claim, receipt)) summary.terminal += 1;
      else summary.stale += 1;
    } catch (error) {
      const nextAttemptAt = new Date(
        now().getTime() + receiptRetryDelayMs(claim.retryAttempt),
      );
      const retryOutcome = await retryClaim(
        claim,
        errorMessage(error),
        nextAttemptAt,
        receipt,
      );
      if (retryOutcome === 'RETRIED') {
        summary.retried += 1;
      } else if (retryOutcome === 'DEAD_LETTERED') {
        summary.deadLettered += 1;
        summary.terminal += 1;
      } else {
        summary.stale += 1;
      }
    }
  });
  return summary;
};
