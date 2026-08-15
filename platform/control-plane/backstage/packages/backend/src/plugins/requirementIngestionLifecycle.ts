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
  | 'REVIEW_REQUIRED';

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
  if (statuses.includes('REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (statuses.some(status => ['GENERATION_FAILED', 'FAILED'].includes(status)))
    return 'FAILED';
  if (
    statuses.some(status => ['GENERATION_QUEUED', 'PROMOTED'].includes(status))
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
  if (statuses.includes('REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (statuses.some(status => ['GENERATION_FAILED', 'FAILED'].includes(status)))
    return 'FAILED';
  if (
    statuses.some(status =>
      [
        'GENERATION_QUEUED',
        'QUEUED',
        'PROMOTED',
        'PENDING',
        'PLANNED',
        'RUNNING',
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
  return {
    releaseStatus: 'PROMOTED',
    projectStatus: 'GENERATION_QUEUED',
    analysisStatus: 'GENERATION_QUEUED',
    itemStatus: 'GENERATION_QUEUED',
    completeTasks: false,
    taskStatus: 'PLANNED',
    successful: true,
  };
};

export const requirementReceiptTransitionAllowed = ({
  currentReleaseStatus,
  currentAttempt,
  incomingDisposition,
  incomingAttempt,
  existingRevision,
}: {
  currentReleaseStatus: unknown;
  currentAttempt: number;
  incomingDisposition: RequirementPublicationDisposition;
  incomingAttempt: number;
  existingRevision: boolean;
}) => {
  const current = normalizedStatus(currentReleaseStatus);
  if (current === 'APPLIED') return false;
  if (incomingDisposition === 'APPLIED') return true;
  const currentTerminal = ['FAILED', 'REVIEW_REQUIRED'].includes(current);
  if (incomingDisposition === 'QUEUED' && currentTerminal) {
    return existingRevision && incomingAttempt > currentAttempt;
  }
  if (incomingDisposition === 'QUEUED' && current === 'PROMOTED') {
    return incomingAttempt > currentAttempt;
  }
  if (currentTerminal) return incomingAttempt > currentAttempt;
  return incomingAttempt >= currentAttempt;
};

export const ensureRequirementPublication = async ({
  sourceImmediate,
  refreshExisting = false,
  state,
  publish,
  recordPublication,
}: {
  sourceImmediate: boolean;
  refreshExisting?: boolean;
  state: RequirementPublicationState;
  publish: () => Promise<RequirementBridgeResponse>;
  recordPublication: (
    disposition: RequirementPublicationDisposition,
    publication: Record<string, unknown>,
  ) => Promise<RequirementPublicationDisposition | void>;
}) => {
  const currentDisposition = requirementPublicationDisposition(state);
  if (
    currentDisposition &&
    (currentDisposition === 'APPLIED' || !refreshExisting)
  ) {
    return {
      attempted: false,
      completed: true,
      successful: ['APPLIED', 'QUEUED'].includes(currentDisposition),
      disposition: currentDisposition,
      publication: {
        success: ['APPLIED', 'QUEUED'].includes(currentDisposition),
        status: `ALREADY_${currentDisposition}`,
      },
    };
  }
  if (!sourceImmediate) {
    return {
      attempted: false,
      completed: false,
      successful: false,
      disposition: undefined,
      publication: { success: false, status: 'AWAITING_SOURCE_APPLY' },
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
    completed: true,
    successful: ['APPLIED', 'QUEUED'].includes(effectiveDisposition),
    disposition: effectiveDisposition,
    publication: effectivePublication,
  };
};
