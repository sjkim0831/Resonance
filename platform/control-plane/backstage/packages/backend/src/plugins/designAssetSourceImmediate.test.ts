import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSourceDesignAssetMutation,
  designAssetFingerprint,
  stableJson,
  type DesignAssetSnapshot,
  type SourceDesignAssetType,
} from './designAssetSourceImmediate';

const baseFingerprint = 'a'.repeat(64);
const payloads: Record<SourceDesignAssetType, Record<string, unknown>> = {
  THEME: {
    schemaVersion: '1.0.0',
    themeName: 'KRDS default',
    colorConfig: { primary: '#005ea8' },
    typographyConfig: { body: 'Pretendard' },
    spacingConfig: { unit: 4 },
    borderConfig: { radius: 8 },
    shadowConfig: { panel: '0 1px 3px #0002' },
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

const current = (assetType: SourceDesignAssetType): DesignAssetSnapshot => ({
  assetType,
  assetId: `${assetType}_ASSET`,
  assetName: `${assetType} asset`,
  routePath: assetType === 'SCREEN' ? '/applications/workspace' : '',
  version: '1.0.0',
  active: true,
  payload: payloads[assetType],
  fingerprint: baseFingerprint,
});

const request = (
  assetType: SourceDesignAssetType,
  overrides: Record<string, unknown> = {},
) => ({
  activationPolicy: 'SOURCE_IMMEDIATE_V1',
  authorityMode: 'SOURCE',
  assetType,
  assetId: `${assetType}_ASSET`,
  baseFingerprint,
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
        baseFingerprint,
      });
      expect(mutation.assetFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(mutation.assetFingerprint).not.toBe(baseFingerprint);
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
    const retiredStart = routeSource.indexOf(
      'const retiredDesignAssetMutation',
      routeStart,
    );
    const route = routeSource.slice(routeStart, retiredStart);

    expect(routeStart).toBeGreaterThan(0);
    expect(route).toContain("'DESIGN_APPROVER'");
    expect(route).toContain('.forUpdate()');
    expect(route).toContain('/api/internal/actor-process/design-assets/source');
    expect(route).toContain('asset_sha256: mutation.assetFingerprint');
    expect(route).toContain("controlPlaneSnapshot: 'SYNCHRONIZED'");
    expect(route).not.toContain("'resonance_projects__task'");
    expect(routeSource).not.toContain('DESIGN_ASSET_PROMOTION');

    const retired = routeSource.slice(
      retiredStart,
      routeSource.indexOf(
        "'/control-assets/:projectId/transition'",
        retiredStart,
      ),
    );
    expect(retired.match(/retiredDesignAssetMutation/g)).toHaveLength(6);
    expect(retired).toContain('response.status(410)');
  });
});
