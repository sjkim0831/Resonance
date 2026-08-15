export type RequirementPublicationReceipt = {
  status?: string;
  message?: string;
  terminal?: boolean;
  [key: string]: unknown;
};

export type RequirementPublicationPollResult = {
  outcome: 'TERMINAL' | 'TIMEOUT' | 'CANCELLED';
  attempts: number;
  receipt?: RequirementPublicationReceipt;
  error?: unknown;
};

export const REQUIREMENT_PUBLICATION_POLL_DELAYS_MS = [
  1000, 2000, 4000, 8000, 15000, 30000, 30000,
] as const;

export const isRequirementPublicationTerminal = (status: unknown) =>
  [
    'APPLIED',
    'GENERATION_APPLIED',
    'FAILED',
    'GENERATION_FAILED',
    'REVIEW_REQUIRED',
  ].includes(
    String(status ?? '')
      .trim()
      .toUpperCase(),
  );

const waitForPollDelay = (delayMs: number, signal: AbortSignal) =>
  new Promise<boolean>(resolve => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const completed = () => {
      signal.removeEventListener('abort', cancelled);
      resolve(true);
    };
    const timer = setTimeout(completed, delayMs);
    const cancelled = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelled);
      resolve(false);
    };
    signal.addEventListener('abort', cancelled, { once: true });
  });

export const pollRequirementPublication = async ({
  readReceipt,
  signal,
  delaysMs = REQUIREMENT_PUBLICATION_POLL_DELAYS_MS,
}: {
  readReceipt: () => Promise<RequirementPublicationReceipt>;
  signal: AbortSignal;
  delaysMs?: readonly number[];
}): Promise<RequirementPublicationPollResult> => {
  let attempts = 0;
  let receipt: RequirementPublicationReceipt | undefined;
  let error: unknown;
  for (let index = 0; index <= delaysMs.length; index += 1) {
    if (signal.aborted) return { outcome: 'CANCELLED', attempts, receipt };
    if (index > 0 && !(await waitForPollDelay(delaysMs[index - 1], signal))) {
      return { outcome: 'CANCELLED', attempts, receipt };
    }
    attempts += 1;
    try {
      receipt = await readReceipt();
      error = undefined;
      if (isRequirementPublicationTerminal(receipt.status)) {
        return { outcome: 'TERMINAL', attempts, receipt };
      }
    } catch (pollError) {
      error = pollError;
    }
  }
  return { outcome: 'TIMEOUT', attempts, receipt, error };
};
