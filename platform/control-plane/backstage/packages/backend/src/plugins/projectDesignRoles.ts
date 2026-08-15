export const PROJECT_DESIGN_ROLES = [
  'DESIGN_REQUESTER',
  'DESIGN_REVIEWER',
  'DESIGN_APPROVER',
  'DESIGN_AUDITOR',
] as const;

export type ProjectDesignRole = (typeof PROJECT_DESIGN_ROLES)[number];

export type ProjectDesignRoleAssignment = {
  principalRef: string;
  roleCode: ProjectDesignRole;
};

const principalPattern = /^(?:user|group):[a-z0-9_.-]+\/[a-z0-9_.@-]{1,200}$/;

export const canonicalProjectPrincipals = (principals: unknown[]) => {
  const canonical = principals
    .map(value =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(value => principalPattern.test(value));
  return [...new Set(canonical)].sort();
};

export const bootstrapProjectDesignRoles = (
  principals: unknown[],
): ProjectDesignRoleAssignment[] =>
  canonicalProjectPrincipals(principals).flatMap(principalRef =>
    PROJECT_DESIGN_ROLES.map(roleCode => ({ principalRef, roleCode })),
  );

export const validateProjectDesignRoleAssignments = (
  value: unknown,
): ProjectDesignRoleAssignment[] => {
  if (!Array.isArray(value) || value.length < PROJECT_DESIGN_ROLES.length) {
    throw new Error(
      'assignments must contain every required project design role',
    );
  }
  if (value.length > 400) {
    throw new Error('assignments exceeds the 400 row safety limit');
  }
  const roleSet = new Set<string>(PROJECT_DESIGN_ROLES);
  const assignments = value.map((candidate, index) => {
    if (
      !candidate ||
      Array.isArray(candidate) ||
      typeof candidate !== 'object'
    ) {
      throw new Error(`assignments[${index}] must be an object`);
    }
    const object = candidate as Record<string, unknown>;
    if (
      Object.keys(object).some(
        key => !['principalRef', 'roleCode'].includes(key),
      )
    ) {
      throw new Error(`assignments[${index}] contains unsupported fields`);
    }
    const [principalRef] = canonicalProjectPrincipals([object.principalRef]);
    const roleCode = String(object.roleCode ?? '') as ProjectDesignRole;
    if (!principalRef || !roleSet.has(roleCode)) {
      throw new Error(`assignments[${index}] is not canonical`);
    }
    return { principalRef, roleCode };
  });
  const keys = assignments.map(
    assignment => `${assignment.principalRef}\0${assignment.roleCode}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error('assignments contains duplicates');
  }
  const assignedRoles = new Set(assignments.map(item => item.roleCode));
  for (const role of PROJECT_DESIGN_ROLES) {
    if (!assignedRoles.has(role)) {
      throw new Error(`assignments must retain ${role}`);
    }
  }
  return assignments.sort(
    (left, right) =>
      left.principalRef.localeCompare(right.principalRef) ||
      left.roleCode.localeCompare(right.roleCode),
  );
};
