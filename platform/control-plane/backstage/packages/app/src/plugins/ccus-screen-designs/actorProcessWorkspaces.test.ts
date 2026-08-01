import {
  ACTOR_PROCESS_DATASET_BY_TAB,
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_FULL_UI_COUNT,
  ACTOR_PROCESS_PARTIAL_UI_COUNT,
  ACTOR_PROCESS_SOURCE_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
  buildCustomerJourneySimulation,
  buildProcessGraph,
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

  it('tracks source parity without promoting partial UI restoration', () => {
    expect(ACTOR_PROCESS_SOURCE_TAB_COUNT).toBe(32);
    expect(ACTOR_PROCESS_FULL_UI_COUNT).toBe(5);
    expect(ACTOR_PROCESS_PARTIAL_UI_COUNT).toBe(19);
    expect(
      ACTOR_PROCESS_WORKSPACES.flatMap(workspace => workspace.tabs)
        .filter(tab => tab.uiRestoration === 'FULL')
        .map(tab => tab.id),
    ).toEqual([
      'work-dashboard',
      'execution',
      'assignments',
      'completion',
      'actors',
    ]);
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

  it('builds normal, correction, and recovery paths from state contracts', () => {
    const steps = [
      {
        stepOrder: 1,
        stepCode: 'COLLECT',
        fromState: 'READY',
        toState: 'COLLECTED',
      },
      {
        stepOrder: 2,
        stepCode: 'VALIDATE',
        fromState: 'COLLECTED',
        toState: 'VERIFIED',
        exceptionRule: 'validation failed',
      },
      {
        stepOrder: 3,
        stepCode: 'CORRECT',
        fromState: 'CORRECTION_REQUIRED',
        toState: 'COLLECTED',
      },
      {
        stepOrder: 4,
        stepCode: 'APPROVE',
        fromState: 'VERIFIED',
        toState: 'APPROVED',
      },
    ];

    const graph = buildProcessGraph(steps);

    expect(
      graph.edges.some(
        edge =>
          edge.from.stepCode === 'VALIDATE' &&
          edge.to.stepCode === 'APPROVE' &&
          edge.kind === 'NORMAL',
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        edge =>
          edge.from.stepCode === 'VALIDATE' &&
          edge.to.stepCode === 'CORRECT' &&
          edge.kind === 'CORRECTION',
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        edge =>
          edge.from.stepCode === 'CORRECT' &&
          edge.to.stepCode === 'VALIDATE' &&
          edge.kind === 'RECOVERY',
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        edge =>
          edge.from.stepCode === 'VALIDATE' &&
          edge.to.stepCode === 'CORRECT' &&
          edge.kind === 'EXCEPTION',
      ),
    ).toBe(true);
    expect(graph.terminalSteps.map(step => step.stepCode)).toContain('APPROVE');
  });

  it('calculates customer journey readiness without hiding missing safety tests', () => {
    const steps = [
      {
        processCode: 'EMISSION_PROJECT',
        stepOrder: 1,
        stepCode: 'COLLECT',
        actorCode: 'DATA_OWNER',
        fromState: 'READY',
        toState: 'COLLECTED',
        inputContract: '{}',
        outputContract: '{}',
        userPath: '/emission/data',
      },
    ];
    const simulation = buildCustomerJourneySimulation(
      steps,
      [
        {
          processCode: 'EMISSION_PROJECT',
          caseType: 'HAPPY_PATH',
          status: 'APPROVED',
        },
      ],
      [{ processCode: 'EMISSION_PROJECT', stepCode: 'COLLECT' }],
      [
        {
          processCode: 'EMISSION_PROJECT',
          stepCode: 'COLLECT',
          jobStatus: 'VERIFIED',
        },
      ],
      [],
    );

    expect(simulation.journeySteps[0].readinessPercent).toBe(100);
    expect(simulation.missingScenarioTypes).toEqual([
      'AUTHORITY',
      'ISOLATION',
      'EXCEPTION',
      'RECOVERY',
    ]);
    expect(simulation.readinessPercent).toBe(100);
  });
});
