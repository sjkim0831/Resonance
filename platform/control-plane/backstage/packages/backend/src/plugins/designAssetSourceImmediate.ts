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

type ProjectionDatabase = {
  raw: (
    sql: string,
    bindings?: unknown[],
  ) => Promise<{ rows?: Record<string, unknown>[] }>;
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
  const payload = object(raw, 'payload');
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
    array(payload.sections, 'payload.sections');
    array(payload.components, 'payload.components');
  }
  return payload;
};

const dependencies = (
  payload: Record<string, unknown>,
): DesignAssetDependency[] => {
  const raw = payload.dependencies ?? [];
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
    dependencies: dependencies(payload),
    baseAsset,
    baseFingerprint,
    assetFingerprint: designAssetFingerprint(snapshot),
  };
};
