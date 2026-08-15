import { createHash } from 'node:crypto';

export type RequirementPublicationState = {
  analysisStatus?: unknown;
  releaseStatus?: unknown;
};

export type RequirementBridgeResponse = {
  ok: boolean;
  payload: Record<string, unknown>;
};

export type RequirementPublicationDisposition = 'QUEUED' | 'APPLIED';

export class RequirementPublicationError extends Error {
  constructor(readonly publication: Record<string, unknown>) {
    super('Runtime rejected the generated design contract');
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
) =>
  disposition === 'APPLIED'
    ? {
        releaseStatus: 'APPLIED',
        projectStatus: 'GENERATION_APPLIED',
        analysisStatus: 'GENERATION_APPLIED',
        itemStatus: 'GENERATION_APPLIED',
        completeTasks: true,
      }
    : {
        releaseStatus: 'PROMOTED',
        projectStatus: 'GENERATION_QUEUED',
        analysisStatus: 'GENERATION_QUEUED',
        itemStatus: 'GENERATION_QUEUED',
        completeTasks: false,
      };

export const ensureRequirementPublication = async ({
  sourceImmediate,
  refreshQueued = false,
  state,
  publish,
  recordPublication,
}: {
  sourceImmediate: boolean;
  refreshQueued?: boolean;
  state: RequirementPublicationState;
  publish: () => Promise<RequirementBridgeResponse>;
  recordPublication: (
    disposition: RequirementPublicationDisposition,
    publication: Record<string, unknown>,
  ) => Promise<void>;
}) => {
  const currentDisposition = requirementPublicationDisposition(state);
  if (currentDisposition && !(currentDisposition === 'QUEUED' && refreshQueued)) {
    return {
      attempted: false,
      completed: true,
      disposition: currentDisposition,
      publication: {
        success: true,
        status:
          currentDisposition === 'APPLIED'
            ? 'ALREADY_APPLIED'
            : 'ALREADY_QUEUED',
      },
    };
  }
  if (!sourceImmediate) {
    return {
      attempted: false,
      completed: false,
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
    throw new RequirementPublicationError(result.payload);
  }
  const disposition = bridgePublicationDisposition(result.payload);
  if (!disposition) {
    throw new RequirementPublicationError({
      ...result.payload,
      error: 'UNRECOGNIZED_RUNTIME_PUBLICATION_STATE',
    });
  }
  await recordPublication(disposition, result.payload);
  return {
    attempted: true,
    completed: true,
    disposition,
    publication: result.payload,
  };
};
