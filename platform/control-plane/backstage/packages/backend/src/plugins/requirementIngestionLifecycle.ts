import { createHash } from 'node:crypto';

export type RequirementPublicationState = {
  analysisStatus?: unknown;
  releaseStatus?: unknown;
};

export type RequirementBridgeResponse = {
  ok: boolean;
  payload: Record<string, unknown>;
};

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

export const requirementPublicationComplete = ({
  analysisStatus,
  releaseStatus,
}: RequirementPublicationState) =>
  ['GENERATION_QUEUED', 'GENERATION_APPLIED', 'APPLIED'].includes(
    normalizedStatus(analysisStatus),
  ) || ['PROMOTED', 'APPLIED'].includes(normalizedStatus(releaseStatus));

export const ensureRequirementPublication = async ({
  autoPromote,
  state,
  publish,
  markQueued,
}: {
  autoPromote: boolean;
  state: RequirementPublicationState;
  publish: () => Promise<RequirementBridgeResponse>;
  markQueued: () => Promise<void>;
}) => {
  if (requirementPublicationComplete(state)) {
    return {
      attempted: false,
      completed: true,
      publication: { success: true, status: 'ALREADY_QUEUED' },
    };
  }
  if (!autoPromote) {
    return {
      attempted: false,
      completed: false,
      publication: { success: false, status: 'AWAITING_PROMOTION' },
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
  await markQueued();
  return {
    attempted: true,
    completed: true,
    publication: result.payload,
  };
};
