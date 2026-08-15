import { createHash } from 'node:crypto';

export type RequirementPublicationState = {
  analysisStatus?: unknown;
  releaseStatus?: unknown;
};

export type RequirementBridgeResponse = {
  ok: boolean;
  status?: number;
  payload: Record<string, unknown>;
};

export type RequirementPublicationDisposition =
  | 'QUEUED'
  | 'APPLIED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'
  | 'CANCELLED';

export type RequirementPublicationPersistence = {
  releaseStatus: string;
  projectStatus: string;
  analysisStatus: string;
  itemStatus: string;
  completeTasks: boolean;
  taskStatus: 'PLANNED' | 'COMPLETED' | 'FAILED';
  successful: boolean;
};

export class RequirementPublicationError extends Error {
  constructor(
    readonly publication: Record<string, unknown>,
    readonly statusCode = 502,
  ) {
    super(
      String(
        publication.message ??
          publication.error ??
          'Runtime rejected the generated design contract',
      ),
    );
  }
}

const normalizedStatus = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

export const requirementDocumentId = (
  projectId: string,
  identityKey: string,
  designVersion: number,
  contentFingerprint: string,
) =>
  createHash('sha256')
    .update(
      `${normalizedStatus(
        projectId,
      )}\0${identityKey}\0${designVersion}\0${contentFingerprint}`,
    )
    .digest('hex');

export const requirementContentFingerprint = (
  documentSha256: string,
  textSha256: string,
) =>
  createHash('sha256')
    .update(`${documentSha256.toLowerCase()}\0${textSha256.toLowerCase()}`)
    .digest('hex');

export const sameRequirementRevision = (
  latest: { identityKey?: unknown; contentFingerprint?: unknown } | undefined,
  identityKey: string,
  contentFingerprint: string,
) =>
  latest !== undefined &&
  String(latest.identityKey ?? '') === identityKey &&
  String(latest.contentFingerprint ?? '').toLowerCase() ===
    contentFingerprint.toLowerCase();

export const requirementItemId = (
  projectId: string,
  documentId: string,
  logicalRequirementId: string,
) =>
  createHash('sha256')
    .update(
      `${normalizedStatus(projectId)}\0${documentId}\0${logicalRequirementId}`,
    )
    .digest('hex');

export const nextRequirementDesignVersion = (
  projectDesignVersion: unknown,
  maximumReleaseVersion: unknown,
) =>
  Math.max(
    Number(projectDesignVersion ?? 0),
    Number(maximumReleaseVersion ?? 0),
  ) + 1;

const publicationStatuses = (payload: Record<string, unknown>) => {
  const generation =
    payload.generation && typeof payload.generation === 'object'
      ? (payload.generation as Record<string, unknown>)
      : {};
  return [
    payload.applicationStatus,
    payload.releaseStatus,
    payload.status,
    generation.applicationStatus,
    generation.releaseStatus,
    generation.status,
  ].map(normalizedStatus);
};

const publicationGeneration = (payload: Record<string, unknown>) =>
  payload.generation && typeof payload.generation === 'object'
    ? (payload.generation as Record<string, unknown>)
    : {};

/**
 * Runtime FAILED/REVIEW_REQUIRED is only terminal after the runtime retry
 * budget is exhausted. Older receipts do not carry this bit, so they retain
 * their historical terminal meaning instead of being retried without a bound.
 */
export const requirementRuntimeRetryExhausted = (
  payload: Record<string, unknown>,
): boolean | undefined => {
  const generation = publicationGeneration(payload);
  const explicit = payload.retryExhausted ?? generation.retryExhausted;
  if (typeof explicit === 'boolean') return explicit;
  const attempt = Number(
    payload.retryAttempt ?? generation.retryAttempt ?? Number.NaN,
  );
  const limit = Number(
    payload.retryLimit ?? generation.retryLimit ?? Number.NaN,
  );
  if (
    Number.isInteger(attempt) &&
    attempt >= 0 &&
    Number.isInteger(limit) &&
    limit > 0
  ) {
    return attempt >= limit;
  }
  return undefined;
};

export const requirementPublicationDisposition = ({
  analysisStatus,
  releaseStatus,
}: RequirementPublicationState):
  | RequirementPublicationDisposition
  | undefined => {
  const statuses = [analysisStatus, releaseStatus].map(normalizedStatus);
  if (
    statuses.some(status => ['GENERATION_APPLIED', 'APPLIED'].includes(status))
  ) {
    return 'APPLIED';
  }
  if (
    statuses.some(status =>
      ['GENERATION_CANCELLED', 'CANCELLED'].includes(status),
    )
  )
    return 'CANCELLED';
  if (statuses.includes('REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (statuses.some(status => ['GENERATION_FAILED', 'FAILED'].includes(status)))
    return 'FAILED';
  if (
    statuses.some(status => ['GENERATION_QUEUED', 'QUEUED'].includes(status))
  ) {
    return 'QUEUED';
  }
  return undefined;
};

export const requirementPublicationComplete = (
  state: RequirementPublicationState,
) => requirementPublicationDisposition(state) !== undefined;

export const bridgePublicationDisposition = (
  payload: Record<string, unknown>,
): RequirementPublicationDisposition | undefined => {
  const statuses = publicationStatuses(payload);
  if (
    statuses.some(status => ['GENERATION_APPLIED', 'APPLIED'].includes(status))
  ) {
    return 'APPLIED';
  }
  if (
    statuses.some(status =>
      ['GENERATION_CANCELLED', 'CANCELLED'].includes(status),
    )
  )
    return 'CANCELLED';
  const reviewRequired = statuses.includes('REVIEW_REQUIRED');
  const failed = statuses.some(status =>
    ['GENERATION_FAILED', 'FAILED'].includes(status),
  );
  if (reviewRequired || failed) {
    // A failed runtime attempt remains pending while its durable self-healer
    // owns another attempt. This prevents Backstage from freezing the local
    // release/tasks before FAILED(0) -> QUEUED(1) -> APPLIED converges.
    if (requirementRuntimeRetryExhausted(payload) === false) return 'QUEUED';
    return reviewRequired ? 'REVIEW_REQUIRED' : 'FAILED';
  }
  if (
    statuses.some(status =>
      [
        'GENERATION_QUEUED',
        'QUEUED',
        'PENDING',
        'PLANNED',
        'RUNNING',
        'UNKNOWN',
      ].includes(status),
    )
  ) {
    return 'QUEUED';
  }
  return undefined;
};

export const requirementPublicationPersistence = (
  disposition: RequirementPublicationDisposition,
): RequirementPublicationPersistence => {
  if (disposition === 'APPLIED') {
    return {
      releaseStatus: 'APPLIED',
      projectStatus: 'GENERATION_APPLIED',
      analysisStatus: 'GENERATION_APPLIED',
      itemStatus: 'GENERATION_APPLIED',
      completeTasks: true,
      taskStatus: 'COMPLETED',
      successful: true,
    };
  }
  if (disposition === 'FAILED') {
    return {
      releaseStatus: 'FAILED',
      projectStatus: 'GENERATION_FAILED',
      analysisStatus: 'GENERATION_FAILED',
      itemStatus: 'GENERATION_FAILED',
      completeTasks: true,
      taskStatus: 'FAILED',
      successful: false,
    };
  }
  if (disposition === 'REVIEW_REQUIRED') {
    return {
      releaseStatus: 'REVIEW_REQUIRED',
      projectStatus: 'REVIEW_REQUIRED',
      analysisStatus: 'REVIEW_REQUIRED',
      itemStatus: 'REVIEW_REQUIRED',
      completeTasks: true,
      taskStatus: 'FAILED',
      successful: false,
    };
  }
  if (disposition === 'CANCELLED') {
    return {
      releaseStatus: 'CANCELLED',
      projectStatus: 'GENERATION_CANCELLED',
      analysisStatus: 'GENERATION_CANCELLED',
      itemStatus: 'GENERATION_CANCELLED',
      completeTasks: true,
      taskStatus: 'FAILED',
      successful: false,
    };
  }
  return {
    releaseStatus: 'QUEUED',
    projectStatus: 'GENERATION_QUEUED',
    analysisStatus: 'GENERATION_QUEUED',
    itemStatus: 'GENERATION_QUEUED',
    completeTasks: false,
    taskStatus: 'PLANNED',
    successful: false,
  };
};

export const requirementReceiptTransitionAllowed = ({
  currentReleaseStatus,
  currentAttempt,
  incomingDisposition,
  incomingAttempt,
  incomingRetryExhausted,
  existingRevision,
}: {
  currentReleaseStatus: unknown;
  currentAttempt: number;
  incomingDisposition: RequirementPublicationDisposition;
  incomingAttempt: number;
  incomingRetryExhausted?: boolean;
  existingRevision: boolean;
}) => {
  const current = normalizedStatus(currentReleaseStatus);
  if (['APPLIED', 'CANCELLED'].includes(current)) return false;
  if (incomingDisposition === 'APPLIED') return true;
  const currentTerminal = ['FAILED', 'REVIEW_REQUIRED', 'CANCELLED'].includes(
    current,
  );
  if (incomingDisposition === 'QUEUED' && currentTerminal) {
    return (
      existingRevision &&
      (incomingAttempt > currentAttempt ||
        (incomingRetryExhausted === false &&
          incomingAttempt === currentAttempt))
    );
  }
  if (incomingDisposition === 'QUEUED' && current === 'QUEUED') {
    return incomingAttempt > currentAttempt;
  }
  if (currentTerminal) return incomingAttempt > currentAttempt;
  return incomingAttempt >= currentAttempt;
};

export const reconcileRequirementPublicationReceipt = async ({
  state,
  readReceipt,
  persistReceipt,
}: {
  state: RequirementPublicationState;
  readReceipt: () => Promise<Record<string, unknown>>;
  persistReceipt: (
    disposition: RequirementPublicationDisposition,
    receipt: Record<string, unknown>,
  ) => Promise<RequirementPublicationDisposition>;
}) => {
  const localDisposition = requirementPublicationDisposition(state);
  if (localDisposition && ['APPLIED', 'CANCELLED'].includes(localDisposition)) {
    return { disposition: localDisposition, reconciled: false };
  }
  if (
    !localDisposition ||
    !['QUEUED', 'FAILED', 'REVIEW_REQUIRED'].includes(localDisposition)
  ) {
    throw new RequirementPublicationError(
      {
        success: false,
        status: String(state.analysisStatus ?? state.releaseStatus ?? ''),
        message: 'Requirement publication is not queued for reconciliation',
      },
      409,
    );
  }
  const receipt = await readReceipt();
  const runtimeDisposition = bridgePublicationDisposition(receipt);
  if (!runtimeDisposition) {
    throw new RequirementPublicationError(
      {
        ...receipt,
        success: false,
        message: 'Runtime receipt has no recognized publication state',
      },
      502,
    );
  }
  const disposition = await persistReceipt(runtimeDisposition, receipt);
  return {
    disposition,
    reconciled: disposition === runtimeDisposition,
    receipt,
  };
};

export const ensureRequirementPublication = async ({
  sourceImmediate: _requestedSourceImmediate = true,
  refreshExisting = false,
  state,
  publish,
  recordPublication,
}: {
  sourceImmediate?: boolean;
  refreshExisting?: boolean;
  state: RequirementPublicationState;
  publish: () => Promise<RequirementBridgeResponse>;
  recordPublication: (
    disposition: RequirementPublicationDisposition,
    publication: Record<string, unknown>,
  ) => Promise<RequirementPublicationDisposition | void>;
}) => {
  // SOURCE_IMMEDIATE_V1 is an invariant. The compatibility flag is accepted
  // only so old callers cannot turn generation off by sending false.
  void _requestedSourceImmediate;
  const currentDisposition = requirementPublicationDisposition(state);
  if (
    currentDisposition &&
    (['APPLIED', 'CANCELLED'].includes(currentDisposition) || !refreshExisting)
  ) {
    return {
      attempted: false,
      completed: currentDisposition === 'APPLIED',
      successful: currentDisposition === 'APPLIED',
      disposition: currentDisposition,
      publication: {
        success: currentDisposition === 'APPLIED',
        status: `ALREADY_${currentDisposition}`,
      },
    };
  }
  let result: RequirementBridgeResponse;
  try {
    result = await publish();
  } catch (error) {
    throw new RequirementPublicationError({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!result.ok || result.payload.success !== true) {
    throw new RequirementPublicationError(
      result.payload,
      result.status === 409 ? 409 : 502,
    );
  }
  const disposition = bridgePublicationDisposition(result.payload);
  if (!disposition) {
    throw new RequirementPublicationError({
      ...result.payload,
      error: 'UNRECOGNIZED_RUNTIME_PUBLICATION_STATE',
    });
  }
  const recordedDisposition = await recordPublication(
    disposition,
    result.payload,
  );
  const effectiveDisposition = recordedDisposition ?? disposition;
  const effectivePublication =
    effectiveDisposition === disposition
      ? result.payload
      : {
          success: true,
          status: `ALREADY_${effectiveDisposition}`,
          ignoredPublication: result.payload,
        };
  return {
    attempted: true,
    completed: effectiveDisposition === 'APPLIED',
    successful: effectiveDisposition === 'APPLIED',
    disposition: effectiveDisposition,
    publication: effectivePublication,
  };
};
