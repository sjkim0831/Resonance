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

export type RequirementDocumentPublication = {
  documentId: string;
  status: string;
  [key: string]: unknown;
};

export type RequirementDocumentSetPollResult = {
  outcome: 'TERMINAL' | 'TIMEOUT' | 'CANCELLED';
  attempts: number;
  documents: RequirementDocumentPublication[];
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

export const isRequirementPublicationPending = (status: unknown) =>
  ['QUEUED', 'GENERATION_QUEUED', 'RUNNING', 'GENERATION_RUNNING'].includes(
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

/**
 * Observes every queued document through the read-only project history. The
 * backend scheduler owns reconciliation, so opening several browser tabs never
 * creates duplicate receipt mutations.
 */
export const pollRequirementDocumentSet = async ({
  readDocuments,
  signal,
  targetDocumentIds,
  delaysMs = REQUIREMENT_PUBLICATION_POLL_DELAYS_MS,
}: {
  readDocuments: () => Promise<RequirementDocumentPublication[]>;
  signal: AbortSignal;
  targetDocumentIds?: readonly string[];
  delaysMs?: readonly number[];
}): Promise<RequirementDocumentSetPollResult> => {
  let attempts = 0;
  let documents: RequirementDocumentPublication[] = [];
  let error: unknown;
  const targets = targetDocumentIds ? new Set(targetDocumentIds) : undefined;
  for (let index = 0; index <= delaysMs.length; index += 1) {
    if (signal.aborted) return { outcome: 'CANCELLED', attempts, documents };
    if (index > 0 && !(await waitForPollDelay(delaysMs[index - 1], signal))) {
      return { outcome: 'CANCELLED', attempts, documents };
    }
    attempts += 1;
    try {
      documents = await readDocuments();
      error = undefined;
      const observed = targets
        ? documents.filter(document => targets.has(document.documentId))
        : documents;
      const targetsPresent = !targets || observed.length === targets.size;
      const converged = targets
        ? observed.every(document =>
            isRequirementPublicationTerminal(document.status),
          )
        : observed.every(
            document => !isRequirementPublicationPending(document.status),
          );
      if (targetsPresent && converged) {
        return { outcome: 'TERMINAL', attempts, documents };
      }
    } catch (pollError) {
      error = pollError;
    }
  }
  return { outcome: 'TIMEOUT', attempts, documents, error };
};
