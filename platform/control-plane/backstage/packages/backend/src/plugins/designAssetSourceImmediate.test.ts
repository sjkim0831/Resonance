import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildSourceDesignAssetMutation,
  designAssetFingerprint,
  stableJson,
  synchronizeGlobalDesignAssetSnapshots,
  type DesignAssetSnapshot,
  type SourceDesignAssetType,
} from './designAssetSourceImmediate';

const payloads: Record<SourceDesignAssetType, Record<string, unknown>> = {
  THEME: {
    schemaVersion: '1.0.0',
    themeName: 'KRDS default',
    description: 'KRDS government default theme',
    themeType: 'SYSTEM',
    colorConfig: { primary: '#005ea8' },
    typographyConfig: { body: 'Pretendard' },
    spacingConfig: { unit: 4 },
    borderConfig: { radius: 8 },
    shadowConfig: { panel: '0 1px 3px #0002' },
    classPrefix: 'krds-',
    isDefault: true,
    dependencies: [],
  },
  SECTION: {
    schemaVersion: '1.0.0',
    sectionName: 'Application summary',
    sectionType: 'SUMMARY',
    layoutContract: 'RESPONSIVE_GRID',
    responsiveContract: 'MOBILE_FIRST',
    accessibilityContract: 'KRDS_A11Y',
    designReference: 'KRDS_GOV_DEFAULT',
    dependencies: [],
  },
  COMPONENT: {
    schemaVersion: '1.0.0',
    componentName: 'Application form',
    componentType: 'JSON_FORM',
    ownerDomain: 'APPLICATION',
    propsSchema: { type: 'object' },
    designReference: 'KRDS_GOV_DEFAULT',
    defaultProps: { dense: false },
    category: 'COMMON',
    dependencies: [],
  },
  SCREEN: {
    schemaVersion: '1.0.0',
    pageName: 'Application workspace',
    layout: 'KRDS_RESPONSIVE_WORKSPACE',
    theme: 'KRDS_GOV_DEFAULT',
    sections: ['APPLICATION_SUMMARY'],
    components: ['APPLICATION_FORM'],
    dependencies: [],
  },
};

const current = (assetType: SourceDesignAssetType): DesignAssetSnapshot => {
  const asset = {
    assetType,
    assetId: `${assetType}_ASSET`,
    assetName: `${assetType} asset`,
    routePath: assetType === 'SCREEN' ? '/applications/workspace' : '',
    version: '1.0.0',
    active: true,
    payload: payloads[assetType],
  };
  return { ...asset, fingerprint: designAssetFingerprint(asset) };
};

const request = (
  assetType: SourceDesignAssetType,
  overrides: Record<string, unknown> = {},
) => ({
  activationPolicy: 'SOURCE_IMMEDIATE_V1',
  authorityMode: 'SOURCE',
  assetType,
  assetId: `${assetType}_ASSET`,
  baseFingerprint: current(assetType).fingerprint,
  assetName: `${assetType} asset v2`,
  routePath: assetType === 'SCREEN' ? '/applications/workspace' : '',
  version: '1.0.1',
  active: true,
  payload: payloads[assetType],
  ...overrides,
});

describe('source-immediate common design mutation', () => {
  it.each(['THEME', 'SECTION', 'COMPONENT', 'SCREEN'] as const)(
    'normalizes an exact %s source mutation and produces a new canonical fingerprint',
    assetType => {
      const before = current(assetType);
      const beforeCopy = JSON.parse(JSON.stringify(before));
      const mutation = buildSourceDesignAssetMutation(
        before,
        request(assetType),
      );

      expect(mutation).toMatchObject({
        activationPolicy: 'SOURCE_IMMEDIATE_V1',
        authorityMode: 'SOURCE',
        assetType,
        assetId: `${assetType}_ASSET`,
        baseFingerprint: before.fingerprint,
      });
      expect(mutation.assetFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(mutation.assetFingerprint).not.toBe(before.fingerprint);
      expect(mutation.baseAsset).toEqual({
        assetType: before.assetType,
        assetId: before.assetId,
        assetName: before.assetName,
        routePath: before.routePath,
        version: before.version,
        active: before.active,
        payload: before.payload,
      });
      expect(before).toEqual(beforeCopy);
    },
  );

  it('keeps unrelated source fingerprints stable and hashes object key order canonically', () => {
    const untouched = current('SECTION');
    const untouchedHash = designAssetFingerprint({
      assetType: untouched.assetType,
      assetId: untouched.assetId,
      assetName: untouched.assetName,
      routePath: untouched.routePath,
      version: untouched.version,
      active: untouched.active,
      payload: untouched.payload,
    });
    buildSourceDesignAssetMutation(current('SCREEN'), request('SCREEN'));

    expect(
      designAssetFingerprint({
        assetType: untouched.assetType,
        assetId: untouched.assetId,
        assetName: untouched.assetName,
        routePath: untouched.routePath,
        version: untouched.version,
        active: untouched.active,
        payload: untouched.payload,
      }),
    ).toBe(untouchedHash);
    expect(stableJson({ z: 1, a: { y: 2, b: 3 } })).toBe(
      stableJson({ a: { b: 3, y: 2 }, z: 1 }),
    );
    expect(
      stableJson({ numbers: [1, 1.5, 1e-7, 1e-6, 1e21, -0, -1.25e21] }),
    ).toBe(
      '{"6e756d62657273":[@3ff0000000000000,@3ff8000000000000,@3e7ad7f29abcaf48,@3eb0c6f7a0b5ed8d,@444b1ae4d6e2ef50,@0000000000000000,@c450f0cf064dd592]}',
    );
    expect(
      designAssetFingerprint({
        assetType: 'SCREEN',
        assetId: 'SCREEN_GLOBAL',
        assetName: '전역 화면',
        routePath: '/global',
        version: '1.0.0',
        active: true,
        payload: {
          schemaVersion: '1.0.0',
          pageName: '전역 화면',
          layout: 'KRDS_WORKSPACE',
          theme: 'KRDS_GOV_DEFAULT',
          sections: ['SUMMARY', 'FORM'],
          components: ['JSON_FORM'],
          dependencies: [],
        },
      }),
    ).toBe('8e54f5c6185545bc94fea05909ce1b4ef9f8f0520566bbccd695f3cd19f4f2a7');
    expect(
      createHash('sha256')
        .update(
          stableJson({
            numbers: [1, 1.5, 1e-7, 1e-6, 1e21, -0, -1.25e21, 1e23, 5e-324],
            text: 'control\u000f😀',
          }),
        )
        .digest('hex'),
    ).toBe('ab37e189a99684ecd2cbad7cb21874b42402f460b7143c932e2c70ef151ff4ad');
    const { fingerprint: _fingerprint, ...routed } = current('SCREEN');
    expect(
      designAssetFingerprint({
        ...routed,
        routePath: '//applications//workspace?draft=1#editor',
      }),
    ).toBe(
      designAssetFingerprint({
        ...routed,
        routePath: '/applications/workspace',
      }),
    );
  });

  it.each(['MANUAL', 'ADOPT'])(
    'fails closed for %s authority',
    authorityMode => {
      expect(() =>
        buildSourceDesignAssetMutation(
          current('SCREEN'),
          request('SCREEN', { authorityMode }),
        ),
      ).toThrow('MANUAL and ADOPT authority modes are forbidden');
    },
  );

  it('rejects invalid schema, dependency duplication and stale source before mutation', () => {
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', {
          payload: { ...payloads.SCREEN, unexpected: true },
        }),
      ),
    ).toThrow('unsupported fields');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', {
          payload: {
            ...payloads.SCREEN,
            dependencies: [
              {
                assetType: 'THEME',
                assetId: 'KRDS_GOV_DEFAULT',
                fingerprint: 'b'.repeat(64),
              },
              {
                assetType: 'THEME',
                assetId: 'KRDS_GOV_DEFAULT',
                fingerprint: 'b'.repeat(64),
              },
            ],
          },
        }),
      ),
    ).toThrow('duplicate dependency');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', {
          payload: {
            ...payloads.SCREEN,
            dependencies: [
              {
                assetType: 'THEME',
                assetId: 'KRDS_GOV_DEFAULT',
                fingerprint: '',
              },
            ],
          },
        }),
      ),
    ).toThrow('non-empty SHA-256');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', { baseFingerprint: 'c'.repeat(64) }),
      ),
    ).toThrow('source fingerprint changed');
  });

  it('connects the active API to runtime canonical generation and retires old mutation bodies', () => {
    const routeSource = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const routeStart = routeSource.indexOf(
      "'/design-assets/:projectId/source'",
    );
    const routeEnd = routeSource.indexOf(
      "'/design-assets/:projectId/drafts'",
      routeStart,
    );
    const route = routeSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(0);
    expect(route).toContain("'DESIGN_APPROVER'");
    expect(route).toContain('BACKSTAGE_COMMON_DESIGN_SOURCE_V1:');
    expect(route).toContain('/design-assets/source-heads?');
    expect(route).toContain('/api/internal/actor-process/design-assets/source');
    expect(route).toContain('synchronizeGlobalDesignAssetSnapshots');
    const projection = synchronizeGlobalDesignAssetSnapshots.toString();
    expect(projection).toContain(
      'insert into resonance_projects__design_asset_snapshot',
    );
    expect(projection).toContain('from resonance_projects__project');
    expect(projection).toContain(
      'on conflict (project_id,asset_type,asset_id) do update',
    );
    expect(projection).toContain('asset_sha256=excluded.asset_sha256');
    expect(route).toContain("controlPlaneSnapshot: 'SYNCHRONIZED'");
    expect(route).not.toContain('.where({ project_id: projectId })');
    expect(route).not.toContain('dependencyRows');
    expect(route).not.toContain("'resonance_projects__task'");
    expect(routeSource).not.toContain('DESIGN_ASSET_PROMOTION');

    const retiredStart = routeSource.indexOf(
      'const retiredDesignAssetMutation',
    );
    const retired = routeSource.slice(
      retiredStart,
      routeSource.indexOf(
        "'/control-assets/:projectId/transition'",
        retiredStart,
      ),
    );
    expect(retired.match(/retiredDesignAssetMutation/g)).toHaveLength(7);
    expect(retired).toContain('response.status(410)');
    const syncStart = retired.indexOf("'/design-assets/:projectId/sync'");
    const sourceStart = retired.indexOf(
      "'/design-assets/:projectId/source'",
      syncStart,
    );
    const retiredSync = retired.slice(syncStart, sourceStart);
    expect(retiredSync).toContain('retiredDesignAssetMutation');
    expect(retiredSync).not.toContain('request.body');
    expect(retiredSync).not.toContain(
      'resonance_projects__design_asset_snapshot',
    );
  });
});
