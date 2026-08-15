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

export const stableJson = (value: unknown): string => {
  if (value === undefined) throw new Error('value contains undefined');
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) as string;
};

export const designAssetFingerprint = (
  asset: Omit<DesignAssetSnapshot, 'fingerprint'>,
) => createHash('sha256').update(stableJson(asset)).digest('hex');

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
  } else if (assetType === 'SECTION') {
    for (const key of [
      'sectionType',
      'layoutContract',
      'responsiveContract',
      'accessibilityContract',
    ])
      nonEmpty(payload[key], `payload.${key}`);
  } else if (assetType === 'COMPONENT') {
    for (const key of ['componentType', 'ownerDomain', 'designReference']) {
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
      if (fingerprint && !HASH.test(fingerprint)) {
        throw new Error(
          `payload.dependencies[${index}].fingerprint must be SHA-256`,
        );
      }
      const identity = `${assetType}:${assetId}`;
      if (seen.has(identity))
        throw new Error(`duplicate dependency: ${identity}`);
      seen.add(identity);
      return { assetType, assetId, fingerprint };
    })
    .sort((left, right) =>
      `${left.assetType}:${left.assetId}`.localeCompare(
        `${right.assetType}:${right.assetId}`,
      ),
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
  const payload = validatePayload(
    assetType as SourceDesignAssetType,
    input.payload,
  );
  const assetName = nonEmpty(
    input.assetName ?? current.assetName,
    'assetName',
    300,
  );
  const routePath = String(input.routePath ?? current.routePath).trim();
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
    baseFingerprint,
    assetFingerprint: designAssetFingerprint(snapshot),
  };
};
