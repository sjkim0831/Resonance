import { pollDesignAssetSync } from './designAssetSyncPolling';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('design asset snapshot sync polling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps a split receipt pending until the authoritative snapshot converges', async () => {
    const readReceipt = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'UNKNOWN',
        sourceCommitState: 'UNKNOWN',
        controlPlaneSnapshot: 'SYNC_REQUIRED',
      })
      .mockResolvedValueOnce({
        status: 'SYNCHRONIZED',
        controlPlaneSnapshot: 'SYNCHRONIZED',
        snapshotFingerprint: 'a'.repeat(64),
      });
    const result = pollDesignAssetSync({
      readReceipt,
      signal: new AbortController().signal,
      delaysMs: [1000],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toMatchObject({
      outcome: 'SYNCHRONIZED',
      attempts: 2,
    });
    expect(readReceipt).toHaveBeenCalledTimes(2);
  });

  it.each(['CANCELLED', 'SYNC_TRACKING_FAILED'])(
    'stops on terminal %s without another retry',
    async status => {
      const readReceipt = jest.fn().mockResolvedValue({
        status,
        controlPlaneSnapshot: 'SYNC_FAILED',
      });
      const result = pollDesignAssetSync({
        readReceipt,
        signal: new AbortController().signal,
        delaysMs: [1000],
      });
      await flush();

      await expect(result).resolves.toMatchObject({
        outcome: 'FAILED',
        attempts: 1,
        receipt: { status },
      });
      expect(readReceipt).toHaveBeenCalledTimes(1);
    },
  );

  it('cleans up its pending timer when the screen closes', async () => {
    const readReceipt = jest.fn().mockResolvedValue({
      status: 'PENDING',
      controlPlaneSnapshot: 'SYNC_REQUIRED',
    });
    const controller = new AbortController();
    const result = pollDesignAssetSync({
      readReceipt,
      signal: controller.signal,
      delaysMs: [1000, 2000],
    });
    await flush();
    controller.abort();
    await jest.runOnlyPendingTimersAsync();

    await expect(result).resolves.toMatchObject({
      outcome: 'CANCELLED',
      attempts: 1,
    });
    expect(readReceipt).toHaveBeenCalledTimes(1);
  });
});
