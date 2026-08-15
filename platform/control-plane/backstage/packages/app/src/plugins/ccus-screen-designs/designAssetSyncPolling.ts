export type DesignAssetSyncReceipt = {
  status?: string;
  controlPlaneSnapshot?: string;
  snapshotFingerprint?: string;
  message?: string;
  [key: string]: unknown;
};

export const DESIGN_ASSET_SYNC_POLL_DELAYS_MS = [
  1_000, 2_000, 4_000, 8_000, 15_000,
] as const;

const waitForDelay = (delayMs: number, signal: AbortSignal) =>
  new Promise<boolean>(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer: { current?: ReturnType<typeof setTimeout> } = {};
    const cancelled = () => {
      if (timer.current) clearTimeout(timer.current);
      signal.removeEventListener('abort', cancelled);
      resolve(false);
    };
    const completed = () => {
      signal.removeEventListener('abort', cancelled);
      resolve(true);
    };
    timer.current = setTimeout(completed, delayMs);
    signal.addEventListener('abort', cancelled, { once: true });
  });

export const pollDesignAssetSync = async ({
  readReceipt,
  signal,
  delaysMs = DESIGN_ASSET_SYNC_POLL_DELAYS_MS,
}: {
  readReceipt: () => Promise<DesignAssetSyncReceipt>;
  signal: AbortSignal;
  delaysMs?: readonly number[];
}) => {
  let attempts = 0;
  let receipt: DesignAssetSyncReceipt | undefined;
  let error: unknown;
  for (let index = 0; index <= delaysMs.length; index += 1) {
    if (signal.aborted)
      return { outcome: 'CANCELLED' as const, attempts, receipt };
    if (index > 0 && !(await waitForDelay(delaysMs[index - 1], signal))) {
      return { outcome: 'CANCELLED' as const, attempts, receipt };
    }
    attempts += 1;
    try {
      receipt = await readReceipt();
      error = undefined;
      if (
        String(receipt.controlPlaneSnapshot).toUpperCase() === 'SYNCHRONIZED' &&
        /^[0-9a-f]{64}$/.test(String(receipt.snapshotFingerprint ?? ''))
      ) {
        return { outcome: 'SYNCHRONIZED' as const, attempts, receipt };
      }
      if (
        ['FAILED', 'SYNC_TRACKING_FAILED', 'CANCELLED'].includes(
          String(receipt.status).toUpperCase(),
        )
      ) {
        return { outcome: 'FAILED' as const, attempts, receipt };
      }
    } catch (pollError) {
      error = pollError;
    }
  }
  return { outcome: 'TIMEOUT' as const, attempts, receipt, error };
};
