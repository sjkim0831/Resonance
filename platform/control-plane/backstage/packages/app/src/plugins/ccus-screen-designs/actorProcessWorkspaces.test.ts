import {
  ACTOR_PROCESS_DATASET_BY_TAB,
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
  resolveProcessBranches,
} from './actorProcessWorkspaces';

describe('actorProcessWorkspaces', () => {
  it('binds all 24 functions to real runtime datasets', () => {
    const tabs = ACTOR_PROCESS_WORKSPACES.flatMap(workspace => workspace.tabs);

    expect(ACTOR_PROCESS_TAB_COUNT).toBe(24);
    expect(tabs).toHaveLength(24);
    expect(
      tabs.every(tab => Boolean(ACTOR_PROCESS_DATASET_BY_TAB[tab.id])),
    ).toBe(true);
  });

  it('uses readable Korean labels instead of menu-code fallbacks', () => {
    const labels = ACTOR_PROCESS_WORKSPACES.flatMap(workspace => [
      workspace.label,
      workspace.description,
      ...workspace.tabs.flatMap(tab => [
        tab.label,
        tab.description,
        tab.capability,
      ]),
    ]).join(' ');

    expect(labels).not.toMatch(/[?][^\s]|�/);
    expect(labels).toContain('액터·권한');
    expect(labels).toContain('장애·자가복구');
  });

  it('resolves the emission workflow by state instead of array position', () => {
    const steps = [
      {
        stepCode: 'EMISSION_PROJECT_VALIDATE',
        fromState: 'CALCULATED',
        toState: 'VERIFIED',
      },
      {
        stepCode: 'EMISSION_PROJECT_CORRECT',
        fromState: 'CORRECTION_REQUIRED',
        toState: 'CALCULATED',
      },
      {
        stepCode: 'EMISSION_PROJECT_APPROVE',
        fromState: 'VERIFIED',
        toState: 'APPROVED',
      },
    ];

    const validation = resolveProcessBranches(steps, steps[0]);
    expect(validation.nextStep?.stepCode).toBe('EMISSION_PROJECT_APPROVE');
    expect(validation.correctionStep?.stepCode).toBe(
      'EMISSION_PROJECT_CORRECT',
    );
    expect(validation.supportsCorrectionBranch).toBe(true);

    const correction = resolveProcessBranches(steps, steps[1]);
    expect(correction.nextStep?.stepCode).toBe('EMISSION_PROJECT_VALIDATE');
    expect(correction.supportsCorrectionBranch).toBe(false);
  });
});
