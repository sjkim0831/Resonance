import {
  pollRequirementPublication,
  REQUIREMENT_PUBLICATION_POLL_DELAYS_MS,
} from './requirementPublicationPolling';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('requirement publication polling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses eight reads over a bounded ninety-second backoff window', () => {
    expect(REQUIREMENT_PUBLICATION_POLL_DELAYS_MS).toHaveLength(7);
    expect(
      REQUIREMENT_PUBLICATION_POLL_DELAYS_MS.reduce(
        (total, delay) => total + delay,
        0,
      ),
    ).toBe(90_000);
  });

  it.each(['APPLIED', 'FAILED', 'REVIEW_REQUIRED'])(
    'converges QUEUED to %s and stops',
    async terminalStatus => {
      const readReceipt = jest
        .fn()
        .mockResolvedValueOnce({ status: 'GENERATION_QUEUED' })
        .mockResolvedValueOnce({ status: terminalStatus });
      const controller = new AbortController();

      const resultPromise = pollRequirementPublication({
        readReceipt,
        signal: controller.signal,
        delaysMs: [1000, 2000],
      });
      await flush();
      await jest.advanceTimersByTimeAsync(1000);

      await expect(resultPromise).resolves.toEqual(
        expect.objectContaining({
          outcome: 'TERMINAL',
          attempts: 2,
          receipt: { status: terminalStatus },
        }),
      );
      expect(readReceipt).toHaveBeenCalledTimes(2);
    },
  );

  it('backs off transient failures and stops at the bounded timeout', async () => {
    const readReceipt = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary 502'))
      .mockResolvedValue({ status: 'GENERATION_QUEUED' });
    const resultPromise = pollRequirementPublication({
      readReceipt,
      signal: new AbortController().signal,
      delaysMs: [100, 200],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({ outcome: 'TIMEOUT', attempts: 3 }),
    );
    expect(readReceipt).toHaveBeenCalledTimes(3);
  });

  it('cancels its timer and does not fetch again after unmount', async () => {
    const readReceipt = jest
      .fn()
      .mockResolvedValue({ status: 'GENERATION_QUEUED' });
    const controller = new AbortController();
    const resultPromise = pollRequirementPublication({
      readReceipt,
      signal: controller.signal,
      delaysMs: [1000, 2000],
    });
    await flush();

    controller.abort();
    await jest.runOnlyPendingTimersAsync();

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({ outcome: 'CANCELLED', attempts: 1 }),
    );
    expect(readReceipt).toHaveBeenCalledTimes(1);
  });
});
