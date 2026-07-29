import {
  MIGRATION_CUTOVER_LEDGER,
  MIGRATION_CUTOVER_SUMMARY,
} from './migrationCutoverRegistry';

describe('migrationCutoverRegistry', () => {
  it('records all actor-process tabs and remaining system screens', () => {
    expect(MIGRATION_CUTOVER_SUMMARY.actorProcessTabs).toBe(33);
    expect(MIGRATION_CUTOVER_SUMMARY.systemScreens).toBe(11);
    expect(MIGRATION_CUTOVER_SUMMARY.total).toBe(44);
    expect(
      new Set(MIGRATION_CUTOVER_LEDGER.map(entry => entry.assetId)).size,
    ).toBe(MIGRATION_CUTOVER_LEDGER.length);
  });

  it('does not claim shell-only functions are ready for cutover', () => {
    expect(MIGRATION_CUTOVER_SUMMARY.cutoverEligible).toBe(0);
    expect(
      MIGRATION_CUTOVER_LEDGER.every(
        entry =>
          entry.implementation !== 'SHELL' ||
          entry.migrationStatus === 'CLASSIFIED',
      ),
    ).toBe(true);
  });
});
