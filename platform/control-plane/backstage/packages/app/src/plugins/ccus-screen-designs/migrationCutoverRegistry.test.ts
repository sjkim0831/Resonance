import { ACTOR_PROCESS_TAB_COUNT } from './actorProcessWorkspaces';
import { RESONANCE_CONTROL_ASSETS } from './controlAssetRegistry';
import {
  MIGRATION_CUTOVER_LEDGER,
  MIGRATION_CUTOVER_SUMMARY,
} from './migrationCutoverRegistry';

describe('migrationCutoverRegistry', () => {
  it('derives the complete ledger from the canonical control registry', () => {
    const expectedSystemScreens = RESONANCE_CONTROL_ASSETS.filter(
      asset =>
        asset.ownershipLane === 'BACKSTAGE_NATIVE' &&
        asset.routePath.startsWith('/admin/') &&
        asset.routePath !== '/admin/system/actor-process',
    ).length;

    expect(MIGRATION_CUTOVER_SUMMARY.actorProcessTabs).toBe(
      ACTOR_PROCESS_TAB_COUNT,
    );
    expect(MIGRATION_CUTOVER_SUMMARY.systemScreens).toBe(
      expectedSystemScreens + 16,
    );
    expect(MIGRATION_CUTOVER_SUMMARY.total).toBe(
      ACTOR_PROCESS_TAB_COUNT + expectedSystemScreens + 16,
    );
    expect(
      new Set(MIGRATION_CUTOVER_LEDGER.map(entry => entry.assetId)).size,
    ).toBe(MIGRATION_CUTOVER_LEDGER.length);
  });

  it('tracks every residual A111 control-plane menu as a reversible cutover', () => {
    const residuals = MIGRATION_CUTOVER_LEDGER.filter(entry =>
      entry.assetId.startsWith('legacy-system-menu:'),
    );

    expect(residuals).toHaveLength(16);
    expect(residuals.every(entry => entry.implementation === 'NATIVE')).toBe(
      true,
    );
    expect(
      residuals.every(entry => entry.migrationStatus === 'NATIVE_READY'),
    ).toBe(true);
    expect(
      residuals.find(entry => entry.assetId === 'legacy-system-menu:A1110303')
        ?.sourceRoute,
    ).toBe('/admin/member/login_history');
    expect(
      residuals.find(entry => entry.assetId === 'legacy-system-menu:A1110304')
        ?.sourceRoute,
    ).toBe('/admin/emission/audit-log');
  });

  it('keeps project execution screens outside control-plane cutover', () => {
    expect(
      MIGRATION_CUTOVER_LEDGER.every(
        entry =>
          entry.category === 'ACTOR_PROCESS_TAB' ||
          entry.sourceRoute.startsWith('/admin/'),
      ),
    ).toBe(true);
  });

  it('does not retire entries before authenticated E2E verification', () => {
    expect(MIGRATION_CUTOVER_SUMMARY.cutoverEligible).toBe(0);
    expect(
      MIGRATION_CUTOVER_LEDGER.every(
        entry =>
          entry.migrationStatus !== 'VERIFIED' ||
          entry.cutoverBlockedBy.length > 0,
      ),
    ).toBe(true);
  });
});
