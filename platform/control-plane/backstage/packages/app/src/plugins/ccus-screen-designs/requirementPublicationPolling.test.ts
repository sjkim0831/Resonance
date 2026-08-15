import {
  pollRequirementPublication,
  pollRequirementDocumentSet,
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

  it('keeps FAILED(0) pending through QUEUED(1) and stops only after APPLIED', async () => {
    const readReceipt = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'FAILED',
        terminal: false,
        retryAttempt: 0,
        retryExhausted: false,
      })
      .mockResolvedValueOnce({
        status: 'QUEUED',
        terminal: false,
        retryAttempt: 1,
        retryExhausted: false,
      })
      .mockResolvedValueOnce({
        status: 'APPLIED',
        terminal: true,
        retryAttempt: 1,
        retryExhausted: false,
      });
    const resultPromise = pollRequirementPublication({
      readReceipt,
      signal: new AbortController().signal,
      delaysMs: [100, 200],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toMatchObject({
      outcome: 'TERMINAL',
      attempts: 3,
      receipt: { status: 'APPLIED', retryAttempt: 1 },
    });
    expect(readReceipt).toHaveBeenCalledTimes(3);
  });

  it('treats CANCELLED as final without retry but keeps UNKNOWN pending', async () => {
    const readReceipt = jest
      .fn()
      .mockResolvedValueOnce({ status: 'UNKNOWN', terminal: false })
      .mockResolvedValueOnce({ status: 'CANCELLED', terminal: true });
    const resultPromise = pollRequirementPublication({
      readReceipt,
      signal: new AbortController().signal,
      delaysMs: [100],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toMatchObject({
      outcome: 'TERMINAL',
      attempts: 2,
      receipt: { status: 'CANCELLED' },
    });
    expect(readReceipt).toHaveBeenCalledTimes(2);
  });

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

  it('observes all queued documents through backend truth without mutation races', async () => {
    const readDocuments = jest
      .fn()
      .mockResolvedValueOnce([
        { documentId: 'doc-1', status: 'GENERATION_QUEUED' },
        { documentId: 'doc-2', status: 'GENERATION_QUEUED' },
      ])
      .mockResolvedValueOnce([
        { documentId: 'doc-1', status: 'GENERATION_APPLIED' },
        { documentId: 'doc-2', status: 'FAILED' },
      ]);
    const resultPromise = pollRequirementDocumentSet({
      readDocuments,
      signal: new AbortController().signal,
      delaysMs: [1000],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toMatchObject({
      outcome: 'TERMINAL',
      attempts: 2,
      documents: [
        { documentId: 'doc-1', status: 'GENERATION_APPLIED' },
        { documentId: 'doc-2', status: 'FAILED' },
      ],
    });
    expect(readDocuments).toHaveBeenCalledTimes(2);
  });

  it('does not finalize a document set on a non-exhausted FAILED receipt', async () => {
    const readDocuments = jest
      .fn()
      .mockResolvedValueOnce([
        {
          documentId: 'doc-1',
          status: 'FAILED',
          retryExhausted: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          documentId: 'doc-1',
          status: 'GENERATION_QUEUED',
          retryExhausted: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          documentId: 'doc-1',
          status: 'GENERATION_APPLIED',
          retryExhausted: false,
        },
      ]);
    const resultPromise = pollRequirementDocumentSet({
      readDocuments,
      signal: new AbortController().signal,
      delaysMs: [100, 200],
    });
    await flush();
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toMatchObject({
      outcome: 'TERMINAL',
      attempts: 3,
      documents: [{ documentId: 'doc-1', status: 'GENERATION_APPLIED' }],
    });
  });

  it('waits for every requested target and cancels the shared timer on unmount', async () => {
    const readDocuments = jest.fn().mockResolvedValue([
      { documentId: 'doc-1', status: 'APPLIED' },
      { documentId: 'doc-2', status: 'GENERATION_QUEUED' },
    ]);
    const controller = new AbortController();
    const resultPromise = pollRequirementDocumentSet({
      readDocuments,
      targetDocumentIds: ['doc-1', 'doc-2'],
      signal: controller.signal,
      delaysMs: [1000, 2000],
    });
    await flush();
    controller.abort();
    await jest.runOnlyPendingTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      outcome: 'CANCELLED',
      attempts: 1,
    });
    expect(readDocuments).toHaveBeenCalledTimes(1);
  });
});
