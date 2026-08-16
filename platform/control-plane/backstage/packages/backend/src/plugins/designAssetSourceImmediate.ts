import { createHash } from 'node:crypto';

export const DESIGN_ASSET_ACTIVATION_POLICY = 'SOURCE_IMMEDIATE_V1' as const;
export const SOURCE_DESIGN_ASSET_TYPES = [
  'THEME',
  'SECTION',
  'COMPONENT',
  'SCREEN',
] as const;

export type SourceDesignAssetType = (typeof SOURCE_DESIGN_ASSET_TYPES)[number];

export type DesignAssetSnapshot = {
  assetType: string;
  assetId: string;
  assetName: string;
  routePath: string;
  version: string;
  active: boolean;
  payload: Record<string, unknown>;
  fingerprint: string;
};

export type DesignAssetDependency = {
  assetType: SourceDesignAssetType;
  assetId: string;
  fingerprint: string;
};

export type SourceDesignAssetSnapshotTransition = DesignAssetSnapshot & {
  baseFingerprint: string;
};

export type DesignAssetProjectionFingerprint = {
  assetType: string;
  assetId: string;
  fingerprint: string;
};

export type ScreenDesignSection = {
  sectionId: string;
  zone: string;
  displayOrder: number;
  props: Record<string, unknown>;
};

export type ScreenDesignComponent = {
  componentId: string;
  sectionId: string;
  instanceKey: string;
  displayOrder: number;
  props: Record<string, unknown>;
  condition: string;
};

export type SourceDesignAssetMutation = {
  activationPolicy: typeof DESIGN_ASSET_ACTIVATION_POLICY;
  authorityMode: 'SOURCE';
  assetType: SourceDesignAssetType;
  assetId: string;
  assetName: string;
  routePath: string;
  version: string;
  active: boolean;
  payload: Record<string, unknown>;
  dependencies: DesignAssetDependency[];
  baseAsset: Omit<DesignAssetSnapshot, 'fingerprint'>;
  baseFingerprint: string;
  assetFingerprint: string;
};

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const HASH = /^[0-9a-f]{64}$/;
const GOVERNED_CODE = /^[A-Z][A-Z0-9_]{1,79}$/;

const payloadFields: Record<SourceDesignAssetType, ReadonlySet<string>> = {
  THEME: new Set([
    'schemaVersion',
    'themeName',
    'description',
    'themeType',
    'colorConfig',
    'typographyConfig',
    'spacingConfig',
    'borderConfig',
    'shadowConfig',
    'classPrefix',
    'isDefault',
    'dependencies',
  ]),
  SECTION: new Set([
    'schemaVersion',
    'sectionName',
    'sectionType',
    'layoutContract',
    'responsiveContract',
    'accessibilityContract',
    'designReference',
    'dependencies',
  ]),
  COMPONENT: new Set([
    'schemaVersion',
    'componentName',
    'componentType',
    'ownerDomain',
    'propsSchema',
    'designReference',
    'defaultProps',
    'category',
    'dependencies',
  ]),
  SCREEN: new Set([
    'schemaVersion',
    'pageName',
    'layout',
    'theme',
    'sections',
    'components',
    'dependencies',
  ]),
};

const exactKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
) => {
  const unsupported = Object.keys(value)
    .filter(key => !allowed.has(key))
    .sort();
  if (unsupported.length) {
    throw new Error(
      `${label} contains unsupported fields: ${unsupported.join(', ')}`,
    );
  }
};

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const nonEmpty = (value: unknown, label: string, maximum = 5000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const array = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};

const assertJsonShape = (value: unknown, label: string, depth = 0): void => {
  if (depth > 12) throw new Error(`${label} exceeds the maximum nesting depth`);
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error(`${label} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2000)
      throw new Error(`${label} contains too many array items`);
    value.forEach((item, index) =>
      assertJsonShape(item, `${label}[${index}]`, depth + 1),
    );
    return;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 1000)
      throw new Error(`${label} contains too many object fields`);
    for (const [key, item] of entries) {
      if (
        !key ||
        key.length > 160 ||
        [...key].some(character => character.charCodeAt(0) <= 31)
      ) {
        throw new Error(`${label} contains an invalid object key`);
      }
      assertJsonShape(item, `${label}.${key}`, depth + 1);
    }
    return;
  }
  throw new Error(`${label} contains a non-JSON value`);
};

const assertUnicodeScalarString = (value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const trail = value.charCodeAt(index + 1);
      if (!(trail >= 0xdc00 && trail <= 0xdfff)) {
        throw new Error('value contains an unpaired Unicode surrogate');
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('value contains an unpaired Unicode surrogate');
    }
  }
};

const canonicalString = (value: string): string => {
  assertUnicodeScalarString(value);
  return `"${Buffer.from(value, 'utf8').toString('hex')}"`;
};

const canonicalNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error('value contains a non-finite number');
  }
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setFloat64(0, Object.is(value, -0) ? 0 : value, false);
  return `@${view.getUint32(0, false).toString(16).padStart(8, '0')}${view
    .getUint32(4, false)
    .toString(16)
    .padStart(8, '0')}`;
};

export const stableJson = (value: unknown): string => {
  if (value === undefined) throw new Error('value contains undefined');
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${canonicalString(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  if (typeof value === 'number') return canonicalNumber(value);
  if (typeof value === 'string') return canonicalString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return 'null';
  throw new Error('value contains a non-JSON value');
};

export const canonicalDesignAssetRoute = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const query = raw.indexOf('?');
  const fragment = raw.indexOf('#');
  const boundary = [query, fragment]
    .filter(index => index >= 0)
    .reduce((left, right) => Math.min(left, right), raw.length);
  const path = raw.slice(0, boundary).replace(/\/{2,}/g, '/');
  return path || '/';
};

export const designAssetFingerprint = (
  asset: Omit<DesignAssetSnapshot, 'fingerprint'>,
) =>
  createHash('sha256')
    .update(
      stableJson({
        ...asset,
        routePath: canonicalDesignAssetRoute(asset.routePath),
      }),
    )
    .digest('hex');

export type ProjectionDatabase = {
  raw: (
    sql: string,
    bindings?: unknown[],
  ) => Promise<{ rows?: Record<string, unknown>[] }>;
};

/**
 * Common design is a platform-global source.  A role copied to, or created in,
 * an ordinary project is deliberately irrelevant.  Call this inside the same
 * transaction that commits the source mutation so a concurrent revocation is
 * serialized by the locked CCUS-PLATFORM assignment row.
 */
export const lockGlobalDesignSourceAuthority = async (
  transaction: ProjectionDatabase,
  principals: string[],
): Promise<string | undefined> => {
  const normalized = [
    ...new Set(principals.map(value => value.trim().toLowerCase())),
  ]
    .filter(Boolean)
    .sort();
  if (!normalized.length) return undefined;
  const placeholders = normalized.map(() => '?').join(',');
  const authority = await transaction.raw(
    `select assignment_id,lower(principal_ref) as principal_ref
       from resonance_projects__design_asset_role_assignment
      where project_id='CCUS-PLATFORM'
        and role_code='DESIGN_APPROVER'
        and active=true
        and lower(principal_ref) in (${placeholders})
      order by assignment_id
      for update`,
    normalized,
  );
  return Array.isArray(authority.rows) && authority.rows.length > 0
    ? String(authority.rows[0].principal_ref)
    : undefined;
};

export const synchronizeGlobalDesignAssetSnapshots = async (
  transaction: ProjectionDatabase,
  mutation: Pick<
    SourceDesignAssetMutation,
    | 'assetType'
    | 'assetId'
    | 'assetName'
    | 'routePath'
    | 'version'
    | 'active'
    | 'payload'
    | 'assetFingerprint'
  >,
  now: Date,
): Promise<number> => {
  await transaction.raw('lock table resonance_projects__project in share mode');
  const projectResult = await transaction.raw(
    'select count(*)::integer as count from resonance_projects__project',
  );
  const projectCount = Number(projectResult.rows?.[0]?.count ?? 0);
  const synchronized = await transaction.raw(
    `insert into resonance_projects__design_asset_snapshot (
       project_id,asset_type,asset_id,asset_name,route_path,
       asset_version,active,asset_payload,asset_sha256,synced_at)
     select project_id,?,?,?,?,?,?,cast(? as jsonb),?,?
       from resonance_projects__project
     on conflict (project_id,asset_type,asset_id) do update set
       asset_name=excluded.asset_name,
       route_path=excluded.route_path,
       asset_version=excluded.asset_version,
       active=excluded.active,
       asset_payload=excluded.asset_payload,
       asset_sha256=excluded.asset_sha256,
       synced_at=excluded.synced_at
     returning project_id`,
    [
      mutation.assetType,
      mutation.assetId,
      mutation.assetName,
      mutation.routePath,
      mutation.version,
      mutation.active,
      JSON.stringify(mutation.payload),
      mutation.assetFingerprint,
      now,
    ],
  );
  const synchronizedProjectCount = Array.isArray(synchronized.rows)
    ? synchronized.rows.length
    : 0;
  const projectionResult = await transaction.raw(
    `select count(*)::integer as count
       from resonance_projects__design_asset_snapshot
      where asset_type=? and asset_id=? and asset_sha256=?`,
    [mutation.assetType, mutation.assetId, mutation.assetFingerprint],
  );
  if (
    projectCount < 1 ||
    synchronizedProjectCount !== projectCount ||
    Number(projectionResult.rows?.[0]?.count ?? 0) !== projectCount
  ) {
    throw new Error(
      'global control-plane snapshot synchronization was not exact',
    );
  }
  return synchronizedProjectCount;
};

const validatePayload = (assetType: SourceDesignAssetType, raw: unknown) => {
  const payload = { ...object(raw, 'payload') };
  if (!Object.keys(payload).length)
    throw new Error('payload must not be empty');
  exactKeys(payload, payloadFields[assetType], 'payload');
  assertJsonShape(payload, 'payload');
  if (assetType === 'THEME') {
    for (const key of [
      'colorConfig',
      'typographyConfig',
      'spacingConfig',
      'borderConfig',
      'shadowConfig',
    ])
      object(payload[key], `payload.${key}`);
    for (const key of ['description', 'themeType', 'classPrefix']) {
      nonEmpty(payload[key], `payload.${key}`);
    }
    if (typeof payload.isDefault !== 'boolean') {
      throw new Error('payload.isDefault must be boolean');
    }
  } else if (assetType === 'SECTION') {
    for (const key of [
      'sectionType',
      'layoutContract',
      'responsiveContract',
      'accessibilityContract',
      'designReference',
    ])
      nonEmpty(payload[key], `payload.${key}`);
  } else if (assetType === 'COMPONENT') {
    for (const key of [
      'componentType',
      'ownerDomain',
      'designReference',
      'category',
    ]) {
      nonEmpty(payload[key], `payload.${key}`);
    }
    object(payload.propsSchema, 'payload.propsSchema');
    object(payload.defaultProps, 'payload.defaultProps');
  } else {
    const layout = nonEmpty(payload.layout, 'payload.layout');
    const theme = nonEmpty(payload.theme, 'payload.theme');
    if (!GOVERNED_CODE.test(layout) || !GOVERNED_CODE.test(theme)) {
      throw new Error(
        'payload.layout and payload.theme must be governed codes',
      );
    }
    const sectionIds = new Set<string>();
    const sectionOrders = new Set<number>();
    let previousSectionOrder = -1;
    payload.sections = array(payload.sections, 'payload.sections').map(
      (rawSection, index) => {
        const section = object(rawSection, `payload.sections[${index}]`);
        exactKeys(
          section,
          new Set(['sectionId', 'zone', 'displayOrder', 'props']),
          `payload.sections[${index}]`,
        );
        const sectionId = nonEmpty(
          section.sectionId,
          `payload.sections[${index}].sectionId`,
          200,
        );
        const zone = nonEmpty(
          section.zone,
          `payload.sections[${index}].zone`,
          120,
        );
        const displayOrder = section.displayOrder;
        if (
          !IDENTIFIER.test(sectionId) ||
          !IDENTIFIER.test(zone) ||
          typeof displayOrder !== 'number' ||
          !Number.isSafeInteger(displayOrder) ||
          displayOrder < 0 ||
          displayOrder <= previousSectionOrder ||
          sectionOrders.has(displayOrder) ||
          sectionIds.has(sectionId)
        ) {
          throw new Error(
            `payload.sections[${index}] must have a unique governed identity and strictly increasing displayOrder`,
          );
        }
        const props = object(section.props, `payload.sections[${index}].props`);
        assertJsonShape(props, `payload.sections[${index}].props`);
        sectionIds.add(sectionId);
        sectionOrders.add(displayOrder);
        previousSectionOrder = displayOrder;
        return { sectionId, zone, displayOrder, props };
      },
    );
    const componentIds = new Set<string>();
    const instanceKeys = new Set<string>();
    const componentOrders = new Set<number>();
    let previousComponentOrder = -1;
    payload.components = array(payload.components, 'payload.components').map(
      (rawComponent, index) => {
        const component = object(rawComponent, `payload.components[${index}]`);
        exactKeys(
          component,
          new Set([
            'componentId',
            'sectionId',
            'instanceKey',
            'displayOrder',
            'props',
            'condition',
          ]),
          `payload.components[${index}]`,
        );
        const componentId = nonEmpty(
          component.componentId,
          `payload.components[${index}].componentId`,
          200,
        );
        const sectionId = nonEmpty(
          component.sectionId,
          `payload.components[${index}].sectionId`,
          200,
        );
        const instanceKey = nonEmpty(
          component.instanceKey,
          `payload.components[${index}].instanceKey`,
          200,
        );
        const condition = nonEmpty(
          component.condition,
          `payload.components[${index}].condition`,
          1000,
        );
        const displayOrder = component.displayOrder;
        if (
          !IDENTIFIER.test(componentId) ||
          !sectionIds.has(sectionId) ||
          !IDENTIFIER.test(instanceKey) ||
          typeof displayOrder !== 'number' ||
          !Number.isSafeInteger(displayOrder) ||
          displayOrder < 0 ||
          displayOrder <= previousComponentOrder ||
          componentOrders.has(displayOrder) ||
          instanceKeys.has(instanceKey)
        ) {
          throw new Error(
            `payload.components[${index}] must reference a section and have unique stable order and instanceKey`,
          );
        }
        const props = object(
          component.props,
          `payload.components[${index}].props`,
        );
        assertJsonShape(props, `payload.components[${index}].props`);
        componentIds.add(componentId);
        instanceKeys.add(instanceKey);
        componentOrders.add(displayOrder);
        previousComponentOrder = displayOrder;
        return {
          componentId,
          sectionId,
          instanceKey,
          displayOrder,
          props,
          condition,
        };
      },
    );
  }
  return payload;
};

const dependencies = (
  payload: Record<string, unknown>,
): DesignAssetDependency[] => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'dependencies')) {
    throw new Error('payload.dependencies is required');
  }
  const raw = payload.dependencies;
  if (!Array.isArray(raw) || raw.length > 200) {
    throw new Error(
      'payload.dependencies must be an array with at most 200 items',
    );
  }
  const seen = new Set<string>();
  return raw
    .map((item, index) => {
      const dependency = object(item, `payload.dependencies[${index}]`);
      exactKeys(
        dependency,
        new Set(['assetType', 'assetId', 'fingerprint']),
        `payload.dependencies[${index}]`,
      );
      const assetType = nonEmpty(
        dependency.assetType,
        `payload.dependencies[${index}].assetType`,
      ).toUpperCase() as SourceDesignAssetType;
      const assetId = nonEmpty(
        dependency.assetId,
        `payload.dependencies[${index}].assetId`,
      );
      const fingerprint = String(dependency.fingerprint ?? '').toLowerCase();
      if (
        !SOURCE_DESIGN_ASSET_TYPES.includes(assetType) ||
        !IDENTIFIER.test(assetId)
      ) {
        throw new Error(
          `payload.dependencies[${index}] has an invalid identity`,
        );
      }
      if (!HASH.test(fingerprint)) {
        throw new Error(
          `payload.dependencies[${index}].fingerprint must be a non-empty SHA-256`,
        );
      }
      const identity = `${assetType}:${assetId}`;
      if (seen.has(identity))
        throw new Error(`duplicate dependency: ${identity}`);
      seen.add(identity);
      return { assetType, assetId, fingerprint };
    })
    .sort((left, right) =>
      `${left.assetType}:${left.assetId}` <
      `${right.assetType}:${right.assetId}`
        ? -1
        : `${left.assetType}:${left.assetId}` >
          `${right.assetType}:${right.assetId}`
        ? 1
        : 0,
    );
};

const assertScreenDependencyCompleteness = (
  assetType: SourceDesignAssetType,
  payload: Record<string, unknown>,
  declared: DesignAssetDependency[],
) => {
  if (assetType !== 'SCREEN') return;
  const required = new Set<string>([
    `THEME:${String(payload.theme)}`,
    ...(payload.sections as ScreenDesignSection[]).map(
      section => `SECTION:${section.sectionId}`,
    ),
    ...(payload.components as ScreenDesignComponent[]).map(
      component => `COMPONENT:${component.componentId}`,
    ),
  ]);
  const actual = new Set(
    declared.map(item => `${item.assetType}:${item.assetId}`),
  );
  const missing = [...required]
    .filter(identity => !actual.has(identity))
    .sort();
  if (missing.length) {
    throw new Error(
      `SCREEN dependencies must fingerprint every referenced theme, section and component: ${missing.join(
        ', ',
      )}`,
    );
  }
};

export const buildSourceDesignAssetMutation = (
  current: DesignAssetSnapshot,
  raw: unknown,
): SourceDesignAssetMutation => {
  const input = object(raw, 'request');
  exactKeys(
    input,
    new Set([
      'activationPolicy',
      'authorityMode',
      'assetType',
      'assetId',
      'baseFingerprint',
      'assetName',
      'routePath',
      'version',
      'active',
      'payload',
    ]),
    'request',
  );
  const requiredRequestFields = [
    'activationPolicy',
    'authorityMode',
    'assetType',
    'assetId',
    'baseFingerprint',
    'assetName',
    'routePath',
    'version',
    'active',
    'payload',
  ];
  const missing = requiredRequestFields.filter(
    field => !Object.prototype.hasOwnProperty.call(input, field),
  );
  if (missing.length) {
    throw new Error(
      `request is missing required fields: ${missing.join(', ')}`,
    );
  }
  if (String(input.activationPolicy) !== DESIGN_ASSET_ACTIVATION_POLICY) {
    throw new Error('activationPolicy must be SOURCE_IMMEDIATE_V1');
  }
  if (String(input.authorityMode).toUpperCase() !== 'SOURCE') {
    throw new Error('MANUAL and ADOPT authority modes are forbidden');
  }
  const assetType = String(input.assetType ?? current.assetType).toUpperCase();
  const assetId = String(input.assetId ?? current.assetId).trim();
  if (assetType !== current.assetType || assetId !== current.assetId) {
    throw new Error('asset identity is immutable');
  }
  if (!SOURCE_DESIGN_ASSET_TYPES.includes(assetType as SourceDesignAssetType)) {
    throw new Error(
      `SOURCE-immediate mutation is unsupported for ${assetType}`,
    );
  }
  if (!IDENTIFIER.test(assetId)) throw new Error('assetId is invalid');
  const baseFingerprint = String(input.baseFingerprint ?? '').toLowerCase();
  if (!HASH.test(baseFingerprint) || baseFingerprint !== current.fingerprint) {
    throw new Error('source fingerprint changed; refresh before editing');
  }
  const baseAsset: Omit<DesignAssetSnapshot, 'fingerprint'> = {
    assetType: current.assetType,
    assetId: current.assetId,
    assetName: current.assetName,
    routePath: canonicalDesignAssetRoute(current.routePath),
    version: current.version,
    active: current.active,
    payload: current.payload,
  };
  if (designAssetFingerprint(baseAsset) !== baseFingerprint) {
    throw new Error('source snapshot fingerprint is not canonical');
  }
  const payload = validatePayload(
    assetType as SourceDesignAssetType,
    input.payload,
  );
  const declaredDependencies = dependencies(payload);
  assertScreenDependencyCompleteness(
    assetType as SourceDesignAssetType,
    payload,
    declaredDependencies,
  );
  const assetName = nonEmpty(
    input.assetName ?? current.assetName,
    'assetName',
    300,
  );
  const routePath = canonicalDesignAssetRoute(
    input.routePath ?? current.routePath,
  );
  if (routePath && (!routePath.startsWith('/') || routePath.length > 500)) {
    throw new Error('routePath must be an absolute application path');
  }
  const version = nonEmpty(input.version ?? current.version, 'version', 80);
  if (!VERSION.test(version)) throw new Error('version is invalid');
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw new Error('active must be boolean');
  }
  const active = input.active === undefined ? current.active : input.active;
  const snapshot = {
    assetType,
    assetId,
    assetName,
    routePath,
    version,
    active,
    payload,
  } as Omit<DesignAssetSnapshot, 'fingerprint'>;
  return {
    activationPolicy: DESIGN_ASSET_ACTIVATION_POLICY,
    authorityMode: 'SOURCE',
    ...snapshot,
    assetType: assetType as SourceDesignAssetType,
    dependencies: declaredDependencies,
    baseAsset,
    baseFingerprint,
    assetFingerprint: designAssetFingerprint(snapshot),
  };
};

export const exactSourceDesignAssetSnapshotBatch = (
  receipt: Record<string, unknown>,
  target: Pick<
    SourceDesignAssetMutation,
    'assetType' | 'assetId' | 'baseFingerprint' | 'assetFingerprint'
  >,
): SourceDesignAssetSnapshotTransition[] => {
  const rawSnapshots = array(receipt.sourceSnapshots, 'sourceSnapshots');
  if (!rawSnapshots.length || rawSnapshots.length > 2_000) {
    throw new Error('runtime source snapshot batch must contain 1..2000 items');
  }
  const identities = new Set<string>();
  let targetCount = 0;
  const snapshots = rawSnapshots.map((raw, index) => {
    const transition = object(raw, `sourceSnapshots[${index}]`);
    exactKeys(
      transition,
      new Set([
        'assetType',
        'assetId',
        'assetName',
        'routePath',
        'version',
        'active',
        'payload',
        'baseFingerprint',
        'fingerprint',
      ]),
      `sourceSnapshots[${index}]`,
    );
    if (Object.keys(transition).length !== 9) {
      throw new Error(`sourceSnapshots[${index}] has an incomplete schema`);
    }
    const assetType = String(transition.assetType).toUpperCase();
    const assetId = nonEmpty(
      transition.assetId,
      `sourceSnapshots[${index}].assetId`,
      200,
    );
    if (
      !SOURCE_DESIGN_ASSET_TYPES.includes(assetType as SourceDesignAssetType) ||
      !IDENTIFIER.test(assetId)
    ) {
      throw new Error(`sourceSnapshots[${index}] has an invalid identity`);
    }
    const assetName = nonEmpty(
      transition.assetName,
      `sourceSnapshots[${index}].assetName`,
      300,
    );
    const routePath = canonicalDesignAssetRoute(transition.routePath);
    if (routePath !== transition.routePath) {
      throw new Error(`sourceSnapshots[${index}].routePath is not canonical`);
    }
    const version = nonEmpty(
      transition.version,
      `sourceSnapshots[${index}].version`,
      80,
    );
    if (!VERSION.test(version) || typeof transition.active !== 'boolean') {
      throw new Error(
        `sourceSnapshots[${index}] has invalid version or active state`,
      );
    }
    const payload = validatePayload(
      assetType as SourceDesignAssetType,
      transition.payload,
    );
    const declared = dependencies(payload);
    assertScreenDependencyCompleteness(
      assetType as SourceDesignAssetType,
      payload,
      declared,
    );
    const baseFingerprint = String(transition.baseFingerprint).toLowerCase();
    const fingerprint = String(transition.fingerprint).toLowerCase();
    if (!HASH.test(baseFingerprint) || !HASH.test(fingerprint)) {
      throw new Error(
        `sourceSnapshots[${index}] requires exact SHA-256 values`,
      );
    }
    const snapshot: DesignAssetSnapshot = {
      assetType,
      assetId,
      assetName,
      routePath,
      version,
      active: transition.active,
      payload,
      fingerprint,
    };
    const { fingerprint: _fingerprint, ...canonicalSnapshot } = snapshot;
    if (designAssetFingerprint(canonicalSnapshot) !== fingerprint) {
      throw new Error(`sourceSnapshots[${index}] fingerprint is not canonical`);
    }
    const identity = `${assetType}:${assetId}`;
    if (identities.has(identity)) {
      throw new Error(`runtime source snapshot batch duplicates ${identity}`);
    }
    identities.add(identity);
    if (assetType === target.assetType && assetId === target.assetId) {
      targetCount += 1;
      if (
        baseFingerprint !== target.baseFingerprint ||
        fingerprint !== target.assetFingerprint
      ) {
        throw new Error('runtime source snapshot target fingerprint mismatch');
      }
    }
    return { ...snapshot, baseFingerprint };
  });
  if (targetCount !== 1) {
    throw new Error(
      'runtime source snapshot batch must contain the target exactly once',
    );
  }
  return snapshots.sort((left, right) => {
    const leftIdentity = `${left.assetType}:${left.assetId}`;
    const rightIdentity = `${right.assetType}:${right.assetId}`;
    return leftIdentity < rightIdentity
      ? -1
      : leftIdentity > rightIdentity
      ? 1
      : 0;
  });
};

const readOnlySourceHeadConflict = (message: string): never => {
  throw new Error(`READ_ONLY_SOURCE_HEAD_SNAPSHOT_CONFLICT: ${message}`);
};

/**
 * Reconstructs the exact runtime cascade receipt when the durable receipt was
 * lost after the runtime transaction committed. Runtime supplies the current
 * target + transitive dependent closure; the control-plane projection supplies
 * the only admissible pre-transition fingerprint for each dependent. A row
 * already at the runtime fingerprint is accepted for idempotent recovery, but
 * two different older projection heads are an explicit conflict.
 */
export const exactReadOnlySourceHeadSnapshotBatch = (
  runtimeHeads: readonly unknown[],
  projectionFingerprints: readonly DesignAssetProjectionFingerprint[],
  target: Pick<
    SourceDesignAssetMutation,
    'assetType' | 'assetId' | 'baseFingerprint' | 'assetFingerprint'
  >,
): SourceDesignAssetSnapshotTransition[] => {
  if (
    !Array.isArray(runtimeHeads) ||
    runtimeHeads.length < 1 ||
    runtimeHeads.length > 2_000
  ) {
    return readOnlySourceHeadConflict(
      'runtime dependent closure must contain 1..2000 heads',
    );
  }
  const runtimeIdentities = new Set<string>();
  for (const raw of runtimeHeads) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return readOnlySourceHeadConflict('runtime head must be an object');
    }
    const head = raw as Record<string, unknown>;
    runtimeIdentities.add(
      `${String(head.assetType ?? '').toUpperCase()}:${String(
        head.assetId ?? '',
      )}`,
    );
  }
  const projected = new Map<string, Set<string>>();
  for (const row of projectionFingerprints) {
    const assetType = String(row.assetType ?? '').toUpperCase();
    const assetId = String(row.assetId ?? '');
    const fingerprint = String(row.fingerprint ?? '').toLowerCase();
    const identity = `${assetType}:${assetId}`;
    if (!runtimeIdentities.has(identity)) {
      return readOnlySourceHeadConflict(
        `projection identity is outside runtime closure: ${identity}`,
      );
    }
    if (!HASH.test(fingerprint)) {
      return readOnlySourceHeadConflict(
        `projection fingerprint is invalid: ${identity}`,
      );
    }
    const fingerprints = projected.get(identity) ?? new Set<string>();
    fingerprints.add(fingerprint);
    projected.set(identity, fingerprints);
  }

  const targetIdentity = `${target.assetType}:${target.assetId}`;
  const sourceSnapshots = runtimeHeads.map(raw => {
    const head = raw as Record<string, unknown>;
    const assetType = String(head.assetType ?? '').toUpperCase();
    const assetId = String(head.assetId ?? '');
    const identity = `${assetType}:${assetId}`;
    const fingerprint = String(head.fingerprint ?? '').toLowerCase();
    const existing = [...(projected.get(identity) ?? new Set<string>())];
    let baseFingerprint: string;
    if (identity === targetIdentity) {
      baseFingerprint = String(target.baseFingerprint).toLowerCase();
      const incompatible = existing.filter(
        value => value !== baseFingerprint && value !== fingerprint,
      );
      if (incompatible.length) {
        return readOnlySourceHeadConflict(
          `target projection diverged: ${identity}`,
        );
      }
    } else {
      if (!existing.length) {
        return readOnlySourceHeadConflict(
          `dependent projection base is unavailable: ${identity}`,
        );
      }
      const older = existing.filter(value => value !== fingerprint);
      if (older.length > 1) {
        return readOnlySourceHeadConflict(
          `dependent projection has multiple older heads: ${identity}`,
        );
      }
      baseFingerprint = older[0] ?? fingerprint;
    }
    return {
      assetType,
      assetId,
      assetName: head.assetName,
      routePath: head.routePath,
      version: head.version,
      active: head.active,
      payload: head.payload,
      baseFingerprint,
      fingerprint,
    };
  });
  try {
    return exactSourceDesignAssetSnapshotBatch({ sourceSnapshots }, target);
  } catch (error) {
    return readOnlySourceHeadConflict(
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const reconcileReadOnlySourceHeadSnapshotReceipt = ({
  runtimeHeads,
  projectionFingerprints,
  target,
  reason,
}: {
  runtimeHeads: readonly unknown[];
  projectionFingerprints: readonly DesignAssetProjectionFingerprint[];
  target: Pick<
    SourceDesignAssetMutation,
    'assetType' | 'assetId' | 'baseFingerprint' | 'assetFingerprint'
  >;
  reason: string;
}): Record<string, unknown> => {
  try {
    const sourceSnapshots = exactReadOnlySourceHeadSnapshotBatch(
      runtimeHeads,
      projectionFingerprints,
      target,
    );
    return {
      success: true,
      status: 'APPLIED',
      sourceCommitted: true,
      assetFingerprint: target.assetFingerprint,
      sourceSnapshots,
      jobCount: 0,
      reconciliationMode: 'READ_ONLY_SOURCE_HEAD_EXACT_BATCH',
      message: reason,
    };
  } catch (error) {
    return {
      success: false,
      status: 'REVIEW_REQUIRED',
      sourceCommitted: false,
      assetFingerprint: target.assetFingerprint,
      jobCount: 0,
      reconciliationMode: 'READ_ONLY_SOURCE_HEAD_CONFLICT',
      message:
        error instanceof Error
          ? error.message
          : `READ_ONLY_SOURCE_HEAD_SNAPSHOT_CONFLICT: ${String(error)}`,
    };
  }
};

export const synchronizeGlobalDesignAssetSnapshotBatch = async (
  transaction: ProjectionDatabase,
  snapshots: SourceDesignAssetSnapshotTransition[],
  now: Date,
): Promise<{
  projectCount: number;
  snapshotCount: number;
  synchronizedProjectionCount: number;
}> => {
  if (!snapshots.length)
    throw new Error('global source snapshot batch is empty');
  await transaction.raw('lock table resonance_projects__project in share mode');
  const projectResult = await transaction.raw(
    'select count(*)::integer as count from resonance_projects__project',
  );
  const projectCount = Number(projectResult.rows?.[0]?.count ?? 0);
  if (projectCount < 1)
    throw new Error('global design snapshot has no projects');
  let synchronizedProjectionCount = 0;
  for (const snapshot of snapshots) {
    await transaction.raw(
      'select pg_advisory_xact_lock(hashtextextended(?,0))',
      [
        `BACKSTAGE_COMMON_DESIGN_SNAPSHOT_V1:${snapshot.assetType}:${snapshot.assetId}`,
      ],
    );
    const synchronized = await transaction.raw(
      `insert into resonance_projects__design_asset_snapshot (
         project_id,asset_type,asset_id,asset_name,route_path,
         asset_version,active,asset_payload,asset_sha256,synced_at)
       select project_id,?,?,?,?,?,?,cast(? as jsonb),?,?
         from resonance_projects__project
       on conflict (project_id,asset_type,asset_id) do update set
         asset_name=excluded.asset_name,
         route_path=excluded.route_path,
         asset_version=excluded.asset_version,
         active=excluded.active,
         asset_payload=excluded.asset_payload,
         asset_sha256=excluded.asset_sha256,
         synced_at=excluded.synced_at
       where resonance_projects__design_asset_snapshot.asset_sha256 in (?,?)
       returning project_id`,
      [
        snapshot.assetType,
        snapshot.assetId,
        snapshot.assetName,
        snapshot.routePath,
        snapshot.version,
        snapshot.active,
        JSON.stringify(snapshot.payload),
        snapshot.fingerprint,
        now,
        snapshot.baseFingerprint,
        snapshot.fingerprint,
      ],
    );
    const synchronizedCount = Array.isArray(synchronized.rows)
      ? synchronized.rows.length
      : 0;
    if (synchronizedCount !== projectCount) {
      throw new Error(
        `global design snapshot CAS diverged for ${snapshot.assetType}:${snapshot.assetId}`,
      );
    }
    const exact = await transaction.raw(
      `select count(*)::integer as count
         from resonance_projects__design_asset_snapshot
        where asset_type=? and asset_id=? and asset_sha256=?`,
      [snapshot.assetType, snapshot.assetId, snapshot.fingerprint],
    );
    if (Number(exact.rows?.[0]?.count ?? 0) !== projectCount) {
      throw new Error(
        `global design snapshot projection is not exact for ${snapshot.assetType}:${snapshot.assetId}`,
      );
    }
    synchronizedProjectionCount += synchronizedCount;
  }
  return {
    projectCount,
    snapshotCount: snapshots.length,
    synchronizedProjectionCount,
  };
};
