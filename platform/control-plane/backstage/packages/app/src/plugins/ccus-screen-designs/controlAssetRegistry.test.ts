import {
  CONTROL_ASSET_SUMMARY,
  RESONANCE_CONTROL_ASSETS,
} from './controlAssetRegistry';

const nativeTargets = new Set([
  'ccus-screen-designs/actor-process-control',
  'ccus-screen-designs/design-assets',
  'ccus-screen-designs/screen-designs',
  'ccus-screen-designs/screen-space',
  'ccus-screen-designs/project-control',
  'ccus-screen-designs/system-operations',
]);

describe('controlAssetRegistry', () => {
  it('keeps every control route unique', () => {
    expect(CONTROL_ASSET_SUMMARY.duplicateRoutes).toBe(0);
    expect(
      new Set(RESONANCE_CONTROL_ASSETS.map(asset => asset.routePath)).size,
    ).toBe(RESONANCE_CONTROL_ASSETS.length);
  });

  it('only marks implemented Backstage targets as native ready', () => {
    const nativeReady = RESONANCE_CONTROL_ASSETS.filter(
      asset => asset.migrationStatus === 'NATIVE_READY',
    );

    expect(nativeReady.length).toBeGreaterThan(0);
    expect(
      nativeReady.every(
        asset =>
          asset.ownershipLane === 'BACKSTAGE_NATIVE' &&
          nativeTargets.has(asset.targetPlugin),
      ),
    ).toBe(true);
  });

  it('maps representative system functions to their native workspaces', () => {
    const byRoute = new Map(
      RESONANCE_CONTROL_ASSETS.map(asset => [asset.routePath, asset]),
    );

    expect(byRoute.get('/admin/system/actor-process')?.targetPlugin).toBe(
      'ccus-screen-designs/actor-process-control',
    );
    expect(byRoute.get('/admin/system/theme-management')?.targetPlugin).toBe(
      'ccus-screen-designs/design-assets',
    );
    expect(byRoute.get('/admin/system/page-management')?.targetPlugin).toBe(
      'ccus-screen-designs/screen-designs',
    );
    expect(byRoute.get('/admin/system/process-workspace')?.targetPlugin).toBe(
      'ccus-screen-designs/screen-space',
    );
    expect(byRoute.get('/admin/system/asset-inventory')?.targetPlugin).toBe(
      'ccus-screen-designs/project-control',
    );
  });

  it('maps operational monitoring screens to the native operations console', () => {
    const routes = [
      '/admin/system/monitoring-dashboard',
      '/admin/system/db-monitoring',
      '/admin/system/batch-monitoring',
      '/admin/system/cron-monitoring',
      '/admin/system/git-build-monitoring',
      '/admin/system/performance',
    ];
    for (const route of routes) {
      const asset = RESONANCE_CONTROL_ASSETS.find(
        candidate => candidate.routePath === route,
      );
      expect(asset).toMatchObject({
        ownershipLane: 'BACKSTAGE_NATIVE',
        migrationStatus: 'NATIVE_READY',
        targetPlugin: 'ccus-screen-designs/system-operations',
      });
    }
  });
});
