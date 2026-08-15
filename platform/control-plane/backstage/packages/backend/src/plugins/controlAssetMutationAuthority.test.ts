import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, 'resonanceProjects.ts'), 'utf8');

const route = (start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('control asset mutation authority', () => {
  it.each([
    [
      "'/control-assets/:projectId/sync'",
      "router.get('/design-assets/:projectId'",
      'CONTROL_ASSETS_SYNCHRONIZED',
    ],
    [
      "'/control-assets/:projectId/transition'",
      "'/control-assets/:projectId/verify-native'",
      'CONTROL_ASSET_TRANSITIONED',
    ],
    [
      "'/control-assets/:projectId/verify-native'",
      "'/control-assets/:projectId/retire-source'",
      'CONTROL_ASSETS_NATIVE_VERIFIED',
    ],
    [
      "'/control-assets/:projectId/retire-source'",
      "router.get('/',",
      'CONTROL_ASSET_SOURCE_RETIRED',
    ],
  ])(
    'guards %s with project DESIGN_APPROVER before mutation and audits the actor',
    (start, end, actionCode) => {
      const mutation = route(start, end);
      const guard = mutation.indexOf('requireDesignAssetRole(');
      const firstDatabaseAccess = mutation.indexOf('await knex');

      expect(guard).toBeGreaterThan(0);
      expect(mutation).toContain("'DESIGN_APPROVER'");
      expect(mutation).not.toContain("'DESIGN_AUDITOR'");
      expect(firstDatabaseAccess).toBeGreaterThan(guard);
      expect(mutation).toContain(`action_code: '${actionCode}'`);
      expect(mutation).toContain('actor_ref: access.actorRef');
    },
  );

  it('binds source retirement to the exact authenticated runtime account and actor', () => {
    const mutation = route(
      "'/control-assets/:projectId/retire-source'",
      "router.get('/',",
    );

    expect(mutation).toContain('resolveRuntimeAccount(request)');
    expect(mutation).toContain(
      "'x-resonance-account': runtimeIdentity.accountId",
    );
    expect(mutation).toContain(
      "'x-resonance-actor': runtimeIdentity.userEntityRef",
    );
    expect(mutation).toContain('requestedBy: runtimeIdentity.userEntityRef');
  });

  it('forwards the account as well as the actor for workflow-test mutations', () => {
    for (const [start, end] of [
      [
        "'/actor-process/screen-workflow-test-cases'",
        "'/actor-process/screen-workflow-test'",
      ],
      [
        "'/actor-process/screen-workflow-test'",
        "'/actor-process/design-documents'",
      ],
    ]) {
      const mutation = route(start, end);
      expect(mutation).toContain('resolveRuntimeAccount(request)');
      expect(mutation).toContain(
        "'x-resonance-account': runtimeIdentity.accountId",
      );
      expect(mutation).toContain(
        "'x-resonance-actor': runtimeIdentity.userEntityRef",
      );
    }
  });
});
