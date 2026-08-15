import {
  PROJECT_DESIGN_ROLES,
  bootstrapProjectDesignRoles,
  validateProjectDesignRoleAssignments,
} from './projectDesignRoles';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('project design role authority', () => {
  it('bootstraps every role for the authenticated owner and ownership groups', () => {
    const assignments = bootstrapProjectDesignRoles([
      'user:default/OWNER',
      'group:default/Platform-Team',
      'user:default/owner',
      'not-a-principal',
    ]);

    expect(assignments).toHaveLength(8);
    for (const principalRef of [
      'group:default/platform-team',
      'user:default/owner',
    ]) {
      expect(
        assignments
          .filter(item => item.principalRef === principalRef)
          .map(item => item.roleCode),
      ).toEqual(PROJECT_DESIGN_ROLES);
    }
  });

  it('rejects duplicate, malformed, and lockout assignment sets', () => {
    const complete = PROJECT_DESIGN_ROLES.map(roleCode => ({
      principalRef: 'user:default/owner',
      roleCode,
    }));
    expect(validateProjectDesignRoleAssignments(complete)).toHaveLength(4);
    expect(() =>
      validateProjectDesignRoleAssignments([...complete, complete[0]]),
    ).toThrow('duplicates');
    expect(() =>
      validateProjectDesignRoleAssignments(
        complete.filter(item => item.roleCode !== 'DESIGN_APPROVER'),
      ),
    ).toThrow('every required');
    expect(() =>
      validateProjectDesignRoleAssignments([
        ...complete.slice(0, 3),
        { principalRef: '../owner', roleCode: 'DESIGN_AUDITOR' },
      ]),
    ).toThrow('not canonical');
  });

  it('atomically bootstraps owner authority and protects the management API', () => {
    const source = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const createStart = source.indexOf("router.post('/',");
    const createRoute = source.slice(
      createStart,
      source.indexOf('registerProjectLifecycleRoutes', createStart),
    );
    const transaction = createRoute.slice(
      createRoute.indexOf('await knex.transaction'),
    );

    expect(createRoute).toContain('resolveAuthenticatedProjectIdentity');
    expect(transaction).toContain(
      "transaction('resonance_projects__project').insert",
    );
    expect(transaction).toContain(
      "transaction(\n              'resonance_projects__design_asset_role_assignment',",
    );
    expect(transaction).toContain('PROJECT_DESIGN_ROLES_BOOTSTRAPPED');

    const roleRoutes = source.slice(
      source.indexOf("'/:projectId/design-role-assignments'"),
      source.indexOf("router.get('/control-assets/:projectId'"),
    );
    expect(roleRoutes).toContain("'DESIGN_AUDITOR'");
    expect(roleRoutes).toContain("'DESIGN_APPROVER'");
    expect(roleRoutes).toContain('validateProjectDesignRoleAssignments');
    expect(roleRoutes).toContain('await knex.transaction');
  });

  it('forwards the authenticated account for design-document mutations', () => {
    const source = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const start = source.indexOf("'/actor-process/design-documents'");
    const mutation = source.slice(
      source.indexOf(
        "router.post(\n          '/actor-process/design-documents'",
        start,
      ),
      source.indexOf("'/actor-process/commands'", start),
    );

    expect(mutation).toContain('resolveRuntimeAccount(request)');
    expect(mutation).toContain(
      "'x-resonance-account': runtimeIdentity.accountId",
    );
    expect(mutation).toContain(
      "'x-resonance-actor': runtimeIdentity.userEntityRef",
    );
    expect(mutation).not.toContain("'BACKSTAGE_CONTROL_PLANE'");
  });
});
