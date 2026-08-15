export const DEFAULT_REQUIREMENT_DOCUMENT_SLOT = 'main-rfp';

type SlotStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const requirementDocumentSlotStorageKey = (projectId: string) =>
  `resonance.requirement-document-slot:${projectId.trim().toUpperCase()}`;

export const normalizeRequirementDocumentSlot = (value: string) => {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .toLowerCase();
  return /^[a-z0-9][a-z0-9._:/-]{0,199}$/.test(normalized) &&
    !normalized.includes('..')
    ? normalized
    : DEFAULT_REQUIREMENT_DOCUMENT_SLOT;
};

export const readRequirementDocumentSlot = (
  projectId: string,
  storage?: SlotStorage,
) => {
  if (!storage) return DEFAULT_REQUIREMENT_DOCUMENT_SLOT;
  try {
    return normalizeRequirementDocumentSlot(
      storage.getItem(requirementDocumentSlotStorageKey(projectId)) ??
        DEFAULT_REQUIREMENT_DOCUMENT_SLOT,
    );
  } catch {
    return DEFAULT_REQUIREMENT_DOCUMENT_SLOT;
  }
};

export const persistRequirementDocumentSlot = (
  projectId: string,
  value: string,
  storage?: SlotStorage,
) => {
  const normalized = normalizeRequirementDocumentSlot(value);
  if (storage) {
    try {
      storage.setItem(requirementDocumentSlotStorageKey(projectId), normalized);
    } catch {
      // Browser storage can be unavailable; the stable in-memory value still applies.
    }
  }
  return normalized;
};

export const withRequirementDocumentSlot = <T extends Record<string, unknown>>(
  payload: T,
  documentSlot: string,
) => ({
  ...payload,
  documentSlot: normalizeRequirementDocumentSlot(documentSlot),
});
