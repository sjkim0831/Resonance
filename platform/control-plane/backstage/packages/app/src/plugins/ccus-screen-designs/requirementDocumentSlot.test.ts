import {
  DEFAULT_REQUIREMENT_DOCUMENT_SLOT,
  persistRequirementDocumentSlot,
  readRequirementDocumentSlot,
  requirementDocumentSlotStorageKey,
  withRequirementDocumentSlot,
} from './requirementDocumentSlot';

describe('requirement document slot', () => {
  it('persists one stable logical RFP slot per project', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readRequirementDocumentSlot('P1', storage)).toBe(
      DEFAULT_REQUIREMENT_DOCUMENT_SLOT,
    );
    expect(persistRequirementDocumentSlot('P1', 'Main-RFP', storage)).toBe(
      'main-rfp',
    );
    expect(readRequirementDocumentSlot('P1', storage)).toBe('main-rfp');
    expect(readRequirementDocumentSlot('P2', storage)).toBe(
      DEFAULT_REQUIREMENT_DOCUMENT_SLOT,
    );
    expect(requirementDocumentSlotStorageKey('p1')).not.toBe(
      requirementDocumentSlotStorageKey('p2'),
    );
    expect(
      withRequirementDocumentSlot({ fileName: 'renamed.md' }, 'Main-RFP'),
    ).toEqual({ fileName: 'renamed.md', documentSlot: 'main-rfp' });
  });
});
