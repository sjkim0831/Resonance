import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildSourceDesignAssetMutation,
  designAssetFingerprint,
  exactReadOnlySourceHeadSnapshotBatch,
  exactSourceDesignAssetSnapshotBatch,
  reconcileReadOnlySourceHeadSnapshotReceipt,
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
    sections: [
      {
        sectionId: 'APPLICATION_SUMMARY',
        zone: 'main-zone',
        displayOrder: 10,
        props: { dense: false },
      },
    ],
    components: [
      {
        componentId: 'APPLICATION_FORM',
        sectionId: 'APPLICATION_SUMMARY',
        instanceKey: 'application-form',
        displayOrder: 10,
        props: { dense: false },
        condition: 'always',
      },
    ],
    dependencies: [
      {
        assetType: 'THEME',
        assetId: 'KRDS_GOV_DEFAULT',
        fingerprint: 'a'.repeat(64),
      },
      {
        assetType: 'SECTION',
        assetId: 'APPLICATION_SUMMARY',
        fingerprint: 'b'.repeat(64),
      },
      {
        assetType: 'COMPONENT',
        assetId: 'APPLICATION_FORM',
        fingerprint: 'c'.repeat(64),
      },
    ],
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
          sections: [
            {
              sectionId: 'SUMMARY',
              zone: 'summary-zone',
              displayOrder: 10,
              props: {},
            },
            {
              sectionId: 'FORM',
              zone: 'form-zone',
              displayOrder: 20,
              props: {},
            },
          ],
          components: [
            {
              componentId: 'JSON_FORM',
              sectionId: 'FORM',
              instanceKey: 'json-form',
              displayOrder: 10,
              props: {},
              condition: 'always',
            },
          ],
          dependencies: [],
        },
      }),
    ).toBe('91d88a9e7f2ba5e48bf8bcac96ed63f7df7beb480f60d935aa74b73cb17f1480');
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
    const { dependencies: _missingDependencies, ...withoutDependencies } =
      payloads.SCREEN;
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', { payload: withoutDependencies }),
      ),
    ).toThrow('payload.dependencies is required');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', {
          payload: {
            ...payloads.SCREEN,
            dependencies: (payloads.SCREEN.dependencies as unknown[]).slice(
              0,
              1,
            ),
          },
        }),
      ),
    ).toThrow('fingerprint every referenced theme, section and component');
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
        request('SCREEN', {
          payload: { ...payloads.SCREEN, sections: ['APPLICATION_SUMMARY'] },
        }),
      ),
    ).toThrow('must be an object');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', {
          payload: {
            ...payloads.SCREEN,
            components: [
              {
                ...(payloads.SCREEN.components as Record<string, unknown>[])[0],
                sectionId: 'MISSING_SECTION',
              },
            ],
          },
        }),
      ),
    ).toThrow('must reference a section');
    expect(() =>
      buildSourceDesignAssetMutation(
        current('SCREEN'),
        request('SCREEN', { baseFingerprint: 'c'.repeat(64) }),
      ),
    ).toThrow('source fingerprint changed');
  });

  it('requires an exact canonical target transition in the runtime cascade receipt', () => {
    const mutation = buildSourceDesignAssetMutation(
      current('COMPONENT'),
      request('COMPONENT', { assetName: 'Changed component' }),
    );
    const transition = {
      assetType: mutation.assetType,
      assetId: mutation.assetId,
      assetName: mutation.assetName,
      routePath: mutation.routePath,
      version: mutation.version,
      active: mutation.active,
      payload: mutation.payload,
      baseFingerprint: mutation.baseFingerprint,
      fingerprint: mutation.assetFingerprint,
    };
    expect(
      exactSourceDesignAssetSnapshotBatch(
        { sourceSnapshots: [transition] },
        mutation,
      ),
    ).toEqual([transition]);
    expect(() => exactSourceDesignAssetSnapshotBatch({}, mutation)).toThrow(
      'sourceSnapshots must be an array',
    );
    expect(() =>
      exactSourceDesignAssetSnapshotBatch(
        { sourceSnapshots: [transition, transition] },
        mutation,
      ),
    ).toThrow('duplicates COMPONENT:COMPONENT_ASSET');
  });

  it('reconstructs an exact target and dependent closure but terminalizes an unprovable base mutant', () => {
    const targetBeforeAsset = {
      assetType: 'COMPONENT',
      assetId: 'APPLICATION_FORM',
      assetName: 'Application form',
      routePath: '',
      version: '1.0.0',
      active: true,
      payload: payloads.COMPONENT,
    } as const;
    const targetBefore = {
      ...targetBeforeAsset,
      fingerprint: designAssetFingerprint(targetBeforeAsset),
    };
    const mutation = buildSourceDesignAssetMutation(targetBefore, {
      activationPolicy: 'SOURCE_IMMEDIATE_V1',
      authorityMode: 'SOURCE',
      assetType: 'COMPONENT',
      assetId: 'APPLICATION_FORM',
      baseFingerprint: targetBefore.fingerprint,
      assetName: 'Application form v2',
      routePath: '',
      version: '1.0.1',
      active: true,
      payload: payloads.COMPONENT,
    });
    const screenBeforePayload = {
      ...payloads.SCREEN,
      dependencies: (
        payloads.SCREEN.dependencies as Record<string, unknown>[]
      ).map(dependency =>
        dependency.assetType === 'COMPONENT'
          ? {
              ...dependency,
              assetId: mutation.assetId,
              fingerprint: mutation.baseFingerprint,
            }
          : dependency,
      ),
    };
    const screenBeforeAsset = {
      assetType: 'SCREEN',
      assetId: 'APPLICATION_SCREEN',
      assetName: 'Application workspace',
      routePath: '/applications/workspace',
      version: '1.0.0',
      active: true,
      payload: screenBeforePayload,
    };
    const screenBeforeFingerprint = designAssetFingerprint(screenBeforeAsset);
    const screenAfterAsset = {
      ...screenBeforeAsset,
      payload: {
        ...screenBeforePayload,
        dependencies: (
          screenBeforePayload.dependencies as Record<string, unknown>[]
        ).map(dependency =>
          dependency.assetType === 'COMPONENT'
            ? { ...dependency, fingerprint: mutation.assetFingerprint }
            : dependency,
        ),
      },
    };
    const screenAfterFingerprint = designAssetFingerprint(screenAfterAsset);
    const runtimeHeads = [
      {
        assetType: mutation.assetType,
        assetId: mutation.assetId,
        assetName: mutation.assetName,
        routePath: mutation.routePath,
        version: mutation.version,
        active: mutation.active,
        payload: mutation.payload,
        fingerprint: mutation.assetFingerprint,
        syncedAt: '2026-08-16T00:00:00.000Z',
      },
      {
        ...screenAfterAsset,
        fingerprint: screenAfterFingerprint,
        syncedAt: '2026-08-16T00:00:00.000Z',
      },
    ];
    const projectionFingerprints = [
      {
        assetType: mutation.assetType,
        assetId: mutation.assetId,
        fingerprint: mutation.baseFingerprint,
      },
      {
        assetType: 'SCREEN',
        assetId: 'APPLICATION_SCREEN',
        fingerprint: screenBeforeFingerprint,
      },
    ];

    const batch = exactReadOnlySourceHeadSnapshotBatch(
      runtimeHeads,
      projectionFingerprints,
      mutation,
    );
    expect(batch).toHaveLength(2);
    expect(batch.map(item => `${item.assetType}:${item.assetId}`)).toEqual([
      'COMPONENT:APPLICATION_FORM',
      'SCREEN:APPLICATION_SCREEN',
    ]);
    expect(batch[1]).toMatchObject({
      baseFingerprint: screenBeforeFingerprint,
      fingerprint: screenAfterFingerprint,
    });

    const mutant = reconcileReadOnlySourceHeadSnapshotReceipt({
      runtimeHeads,
      projectionFingerprints: projectionFingerprints.slice(0, 1),
      target: mutation,
      reason: 'durable receipt missing',
    });
    expect(mutant).toMatchObject({
      success: false,
      status: 'REVIEW_REQUIRED',
      sourceCommitted: false,
      reconciliationMode: 'READ_ONLY_SOURCE_HEAD_CONFLICT',
    });
    expect(mutant.message).toContain(
      'dependent projection base is unavailable: SCREEN:APPLICATION_SCREEN',
    );
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
    expect(route).toContain('lockGlobalDesignSourceAuthority');
    expect(route).toContain(
      'CCUS-PLATFORM DESIGN_APPROVER authority is required',
    );
    expect(route).not.toContain('requireDesignAssetRole(');
    expect(route).toContain('BACKSTAGE_COMMON_DESIGN_SOURCE_V1:');
    expect(route).toContain('/design-assets/source-heads?');
    expect(route).toContain('/api/internal/actor-process/design-assets/source');
    expect(route).toContain("'x-resonance-account': sourceIdentity.accountId");
    expect(route).toContain('authorityPrincipal: globalAuthorityPrincipal');
    expect(route).toContain('synchronizeGlobalDesignAssetSnapshotBatch');
    expect(route).toContain('exactSourceDesignAssetSnapshotBatch');
    expect(route).toContain('sourceReceiptId: preparedSync.syncId');
    expect(route.indexOf('lockGlobalDesignSourceAuthority')).toBeLessThan(
      route.indexOf('BACKSTAGE_COMMON_DESIGN_SOURCE_V1:'),
    );
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
    const replayStart = routeSource.indexOf('const replayDesignAssetSource');
    const replayEnd = routeSource.indexOf(
      'const cancelDesignSnapshotSyncClaim',
      replayStart,
    );
    const replay = routeSource.slice(replayStart, replayEnd);
    expect(replay).toContain('lockGlobalDesignSourceAuthority');
    expect(replay).toContain('GLOBAL_DESIGN_SOURCE_AUTHORITY_REVOKED');
    expect(replay).toContain('reconcileReadOnly');
    expect(replay).toContain('/design-assets/source-heads?');
    expect(replay).toContain("includeDependents: 'true'");
    expect(replay).toContain('reconcileReadOnlySourceHeadSnapshotReceipt');
    expect(replay).toContain('const accountId = claim.accountId');
    expect(replay).toContain("'x-resonance-account': accountId");

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
