import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RequirementPublicationError,
  bridgePublicationDisposition,
  ensureRequirementPublication,
  nextRequirementDesignVersion,
  requirementContentFingerprint,
  requirementDocumentId,
  requirementItemId,
  requirementPublicationPersistence,
  requirementReceiptTransitionAllowed,
  sameRequirementRevision,
  type RequirementPublicationDisposition,
} from './requirementIngestionLifecycle';

describe('requirement ingestion lifecycle', () => {
  it('scopes immutable revision ids to project, logical slot and version', () => {
    const fingerprint = requirementContentFingerprint(
      'a'.repeat(64),
      'b'.repeat(64),
    );
    const storedDocumentIds = new Set([
      requirementDocumentId('PROJECT-A', 'slot:main', 2, fingerprint),
      requirementDocumentId('PROJECT-B', 'slot:main', 2, fingerprint),
      requirementDocumentId('PROJECT-A', 'slot:supporting', 2, fingerprint),
      requirementDocumentId('PROJECT-A', 'slot:main', 3, fingerprint),
    ]);
    expect(storedDocumentIds.size).toBe(4);
    expect(
      requirementDocumentId('project-a', 'slot:main', 2, fingerprint),
    ).toBe(requirementDocumentId('PROJECT-A', 'slot:main', 2, fingerprint));
    expect(requirementItemId('PROJECT-A', 'doc-1', 'REQ-1')).not.toBe(
      requirementItemId('PROJECT-A', 'doc-2', 'REQ-1'),
    );
  });

  it('only reuses the latest logical-slot head with the same byte and text fingerprint', () => {
    const bytes = 'a'.repeat(64);
    const textA = 'b'.repeat(64);
    const textB = 'c'.repeat(64);
    const fingerprintA = requirementContentFingerprint(bytes, textA);
    const fingerprintB = requirementContentFingerprint(bytes, textB);
    const latest = {
      identityKey: 'slot:main-rfp',
      contentFingerprint: fingerprintA,
    };

    expect(sameRequirementRevision(latest, 'slot:main-rfp', fingerprintA)).toBe(
      true,
    );
    expect(sameRequirementRevision(latest, 'slot:main-rfp', fingerprintB)).toBe(
      false,
    );
    expect(
      sameRequirementRevision(latest, 'slot:another-rfp', fingerprintA),
    ).toBe(false);
    // A -> B -> A compares against B, so the returning A is a new version.
    expect(
      sameRequirementRevision(
        { identityKey: 'slot:main-rfp', contentFingerprint: fingerprintB },
        'slot:main-rfp',
        fingerprintA,
      ),
    ).toBe(false);
  });

  it('allocates distinct maximum-plus-one versions for concurrent uploads', async () => {
    const committed: number[] = [];
    let lock = Promise.resolve();
    const reserve = async () => {
      const predecessor = lock;
      let unlock = () => {};
      lock = new Promise<void>(resolve => {
        unlock = resolve;
      });
      await predecessor;
      try {
        await Promise.resolve();
        const version = nextRequirementDesignVersion(
          1,
          committed.length ? Math.max(...committed) : 1,
        );
        committed.push(version);
        return version;
      } finally {
        unlock();
      }
    };

    await expect(Promise.all([reserve(), reserve()])).resolves.toEqual([2, 3]);
    expect(new Set(committed).size).toBe(2);

    const routeSource = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const lifecycleStart = routeSource.indexOf(
      "'/:projectId/requirements/automate'",
    );
    const lifecycle = routeSource.slice(
      lifecycleStart,
      routeSource.indexOf("'/:projectId/design-releases'", lifecycleStart),
    );
    expect(lifecycle.indexOf('.forUpdate()')).toBeGreaterThanOrEqual(0);
    expect(lifecycle.indexOf('.forUpdate()')).toBeLessThan(
      lifecycle.indexOf(".max({ max: 'design_version' })"),
    );
    expect(lifecycle).toContain('identity_key: identityKey');
    expect(lifecycle).toContain(".orderBy('design_version', 'desc')");
    expect(lifecycle).toContain('content_fingerprint: contentFingerprint');
    expect(lifecycle).toContain("implementation_status: 'DESIGN_VALIDATED'");
    expect(lifecycle).toContain("'DESIGN_APPROVER'");
    expect(routeSource).toContain(
      'drop constraint if exists resonance_requirement_document_project_hash_uq',
    );
    expect(routeSource.match(/response\.status\(410\)/g)).toHaveLength(2);
    const retiredMutationRoutes = routeSource.slice(
      routeSource.indexOf("'/:projectId/design-releases'", lifecycleStart),
      routeSource.indexOf("'/:projectId/development-contract'", lifecycleStart),
    );
    expect(retiredMutationRoutes).not.toContain('RESONANCE_OPS_TOKEN');
    expect(retiredMutationRoutes).not.toContain('contract_payload');
    expect(retiredMutationRoutes).not.toContain('.onConflict(');
    expect(retiredMutationRoutes).not.toContain('await fetch(');
    expect(lifecycle).toContain(
      'requirementPublicationPersistence(disposition)',
    );
    expect(lifecycle).toContain("evidenceType: 'RUNTIME_PUBLICATION_RECEIPT'");
    expect(lifecycle).toContain('status: target.taskStatus');
    expect(lifecycle).toContain('error_message: terminalError');
    expect(lifecycle).toContain('attempt_count: retryAttempt');
    expect(lifecycle).toContain("target.taskStatus !== 'COMPLETED'");
    expect(lifecycle).toContain("taskUpdates.whereNot('status', 'COMPLETED')");
    expect(lifecycle).toContain(
      'finished_at: target.completeTasks ? recordedAt : null',
    );
    expect(lifecycle).toContain(
      "const terminalFailure = ['FAILED', 'REVIEW_REQUIRED']",
    );
    expect(lifecycle).toContain(
      ".where('design_version', '<=', persistence.designVersion)",
    );
    expect(lifecycle).toContain('message: terminalMessage');
    expect(lifecycle).toContain('requirementReceiptTransitionAllowed({');
    expect(lifecycle).toContain(
      'return knex.transaction(async transaction => {',
    );
    expect(lifecycle).toContain('.forUpdate()');
    expect(lifecycle).toContain('response.status(error.statusCode)');
    const developmentContract = routeSource.slice(
      routeSource.indexOf("'/:projectId/development-contract'"),
      routeSource.indexOf(
        "router.post('/',",
        routeSource.indexOf("'/:projectId/development-contract'"),
      ),
    );
    expect(developmentContract).toContain(
      "query.whereIn('release_status', ['PROMOTED', 'APPLIED'])",
    );
  });

  it('retries a failed bridge publication and no-ops after it is queued', async () => {
    const state = {
      analysisStatus: 'DESIGN_VALIDATED',
      releaseStatus: 'VALIDATED',
    };
    let attempts = 0;
    const publish = async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, payload: { success: false, status: 'REJECTED' } }
        : { ok: true, payload: { success: true, status: 'QUEUED' } };
    };
    const recordPublication = async (disposition: string) => {
      state.analysisStatus =
        disposition === 'APPLIED' ? 'GENERATION_APPLIED' : 'GENERATION_QUEUED';
      state.releaseStatus = disposition === 'APPLIED' ? 'APPLIED' : 'PROMOTED';
    };

    await expect(
      ensureRequirementPublication({
        sourceImmediate: true,
        state,
        publish,
        recordPublication,
      }),
    ).rejects.toBeInstanceOf(RequirementPublicationError);
    expect(state.analysisStatus).toBe('DESIGN_VALIDATED');

    const retry = await ensureRequirementPublication({
      sourceImmediate: true,
      state,
      publish,
      recordPublication,
    });
    expect(retry).toEqual(
      expect.objectContaining({ attempted: true, completed: true }),
    );

    const replay = await ensureRequirementPublication({
      sourceImmediate: true,
      state,
      publish,
      recordPublication,
    });
    expect(replay).toEqual(
      expect.objectContaining({ attempted: false, completed: true }),
    );
    expect(attempts).toBe(2);
  });

  it('records an idempotent runtime APPLIED receipt without queue downgrades', async () => {
    const recorded: Array<{ disposition: string; publication: unknown }> = [];
    const publication = {
      success: true,
      idempotent: true,
      releaseStatus: 'APPLIED',
      applicationStatus: 'GENERATION_APPLIED',
      generation: { status: 'APPLIED', evidenceRef: 'receipt://release/7' },
    };

    const result = await ensureRequirementPublication({
      sourceImmediate: true,
      refreshExisting: true,
      state: {
        analysisStatus: 'GENERATION_QUEUED',
        releaseStatus: 'PROMOTED',
      },
      publish: async () => ({ ok: true, payload: publication }),
      recordPublication: async (disposition, receipt) => {
        recorded.push({ disposition, publication: receipt });
      },
    });

    expect(bridgePublicationDisposition(publication)).toBe('APPLIED');
    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        completed: true,
        disposition: 'APPLIED',
      }),
    );
    expect(recorded).toEqual([{ disposition: 'APPLIED', publication }]);
    expect(requirementPublicationPersistence('APPLIED')).toEqual({
      releaseStatus: 'APPLIED',
      projectStatus: 'GENERATION_APPLIED',
      analysisStatus: 'GENERATION_APPLIED',
      itemStatus: 'GENERATION_APPLIED',
      completeTasks: true,
      taskStatus: 'COMPLETED',
      successful: true,
    });
    expect(requirementPublicationPersistence('QUEUED')).toEqual(
      expect.objectContaining({
        releaseStatus: 'PROMOTED',
        projectStatus: 'GENERATION_QUEUED',
        completeTasks: false,
        taskStatus: 'PLANNED',
      }),
    );
  });

  it('persists terminal receipts and retries the exact failed head to queued then applied', async () => {
    const state = {
      analysisStatus: 'GENERATION_FAILED',
      releaseStatus: 'FAILED',
    };
    const publications = [
      {
        success: true,
        releaseStatus: 'QUEUED',
        applicationStatus: 'PENDING',
        generation: { status: 'PENDING', retryAttempt: 1 },
      },
      {
        success: true,
        releaseStatus: 'APPLIED',
        applicationStatus: 'APPLIED',
        generation: { status: 'APPLIED', retryAttempt: 1 },
      },
    ];
    const recorded: string[] = [];
    const recordPublication = async (disposition: string) => {
      recorded.push(disposition);
      const target = requirementPublicationPersistence(
        disposition as RequirementPublicationDisposition,
      );
      state.analysisStatus = target.analysisStatus;
      state.releaseStatus = target.releaseStatus;
    };

    const queued = await ensureRequirementPublication({
      sourceImmediate: true,
      refreshExisting: true,
      state,
      publish: async () => ({ ok: true, payload: publications.shift()! }),
      recordPublication,
    });
    const applied = await ensureRequirementPublication({
      sourceImmediate: true,
      refreshExisting: true,
      state,
      publish: async () => ({ ok: true, payload: publications.shift()! }),
      recordPublication,
    });

    expect(queued).toEqual(
      expect.objectContaining({ disposition: 'QUEUED', successful: true }),
    );
    expect(applied).toEqual(
      expect.objectContaining({ disposition: 'APPLIED', successful: true }),
    );
    expect(recorded).toEqual(['QUEUED', 'APPLIED']);
    expect(state).toEqual({
      analysisStatus: 'GENERATION_APPLIED',
      releaseStatus: 'APPLIED',
    });
  });

  it.each([
    [
      'FAILED',
      {
        success: true,
        releaseStatus: 'FAILED',
        generation: {
          status: 'FAILED',
          message: 'worker failed',
          retryAttempt: 3,
        },
      },
      {
        releaseStatus: 'FAILED',
        projectStatus: 'GENERATION_FAILED',
        analysisStatus: 'GENERATION_FAILED',
        itemStatus: 'GENERATION_FAILED',
        completeTasks: true,
        taskStatus: 'FAILED',
        successful: false,
      },
    ],
    [
      'REVIEW_REQUIRED',
      {
        success: true,
        releaseStatus: 'REVIEW_REQUIRED',
        generation: {
          status: 'REVIEW_REQUIRED',
          message: 'design review required',
          retryAttempt: 2,
        },
      },
      {
        releaseStatus: 'REVIEW_REQUIRED',
        projectStatus: 'REVIEW_REQUIRED',
        analysisStatus: 'REVIEW_REQUIRED',
        itemStatus: 'REVIEW_REQUIRED',
        completeTasks: true,
        taskStatus: 'FAILED',
        successful: false,
      },
    ],
  ])(
    'records a truthful %s terminal receipt instead of throwing 502',
    async (disposition, publication, persistence) => {
      const recorded: string[] = [];
      const result = await ensureRequirementPublication({
        sourceImmediate: true,
        state: {
          analysisStatus: 'DESIGN_VALIDATED',
          releaseStatus: 'VALIDATED',
        },
        publish: async () => ({ ok: true, payload: publication }),
        recordPublication: async status => {
          recorded.push(status);
        },
      });

      expect(bridgePublicationDisposition(publication)).toBe(disposition);
      expect(result).toEqual(
        expect.objectContaining({ disposition, successful: false }),
      );
      expect(recorded).toEqual([disposition]);
      expect(
        requirementPublicationPersistence(
          disposition as RequirementPublicationDisposition,
        ),
      ).toEqual(persistence);
    },
  );

  it('rejects a successful bridge response without an exact queued or applied state', async () => {
    let recorded = false;
    await expect(
      ensureRequirementPublication({
        sourceImmediate: true,
        state: {
          analysisStatus: 'DESIGN_VALIDATED',
          releaseStatus: 'VALIDATED',
        },
        publish: async () => ({
          ok: true,
          payload: { success: true, status: 'UNKNOWN' },
        }),
        recordPublication: async () => {
          recorded = true;
        },
      }),
    ).rejects.toMatchObject({
      publication: expect.objectContaining({
        error: 'UNRECOGNIZED_RUNTIME_PUBLICATION_STATE',
      }),
    });
    expect(recorded).toBe(false);
  });

  it('preserves the runtime stale-head conflict status instead of translating it to 502', async () => {
    await expect(
      ensureRequirementPublication({
        sourceImmediate: true,
        state: {
          analysisStatus: 'DESIGN_VALIDATED',
          releaseStatus: 'VALIDATED',
        },
        publish: async () => ({
          ok: false,
          status: 409,
          payload: {
            success: false,
            message: 'Design release version is stale',
          },
        }),
        recordPublication: async () => undefined,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Design release version is stale',
    });
  });

  it('reports APPLIED when its delayed queued receipt loses the absorbing release CAS', async () => {
    const delayedQueued = { success: true, status: 'QUEUED' };
    const result = await ensureRequirementPublication({
      sourceImmediate: true,
      refreshExisting: true,
      state: {
        analysisStatus: 'GENERATION_QUEUED',
        releaseStatus: 'PROMOTED',
      },
      publish: async () => ({ ok: true, payload: delayedQueued }),
      recordPublication: async () => 'APPLIED',
    });

    expect(result).toEqual(
      expect.objectContaining({
        disposition: 'APPLIED',
        successful: true,
        publication: {
          success: true,
          status: 'ALREADY_APPLIED',
          ignoredPublication: delayedQueued,
        },
      }),
    );
  });

  it('absorbs stale queued and terminal receipts unless a newer exact retry advances the attempt', () => {
    const allowed = (
      currentReleaseStatus: string,
      currentAttempt: number,
      incomingDisposition: RequirementPublicationDisposition,
      incomingAttempt: number,
      existingRevision = true,
    ) =>
      requirementReceiptTransitionAllowed({
        currentReleaseStatus,
        currentAttempt,
        incomingDisposition,
        incomingAttempt,
        existingRevision,
      });

    expect(allowed('APPLIED', 1, 'QUEUED', 2)).toBe(false);
    expect(allowed('FAILED', 1, 'QUEUED', 1)).toBe(false);
    expect(allowed('REVIEW_REQUIRED', 1, 'QUEUED', 2, false)).toBe(false);
    expect(allowed('FAILED', 1, 'QUEUED', 2)).toBe(true);
    expect(allowed('PROMOTED', 2, 'QUEUED', 2)).toBe(false);
    expect(allowed('PROMOTED', 2, 'QUEUED', 3)).toBe(true);
    expect(allowed('PROMOTED', 2, 'FAILED', 1)).toBe(false);
    expect(allowed('PROMOTED', 2, 'FAILED', 2)).toBe(true);
    expect(allowed('FAILED', 2, 'APPLIED', 2)).toBe(true);
  });

  it('keeps an already applied local head terminal without another bridge call', async () => {
    let bridgeCalls = 0;
    let recordCalls = 0;
    const result = await ensureRequirementPublication({
      sourceImmediate: true,
      state: { analysisStatus: 'GENERATION_APPLIED', releaseStatus: 'APPLIED' },
      publish: async () => {
        bridgeCalls += 1;
        return { ok: true, payload: { success: true, status: 'QUEUED' } };
      },
      recordPublication: async () => {
        recordCalls += 1;
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: false,
        disposition: 'APPLIED',
        publication: { success: true, status: 'ALREADY_APPLIED' },
      }),
    );
    expect({ bridgeCalls, recordCalls }).toEqual({
      bridgeCalls: 0,
      recordCalls: 0,
    });
  });

  it('does not downgrade a completed publication when auto promotion is off', async () => {
    let attempts = 0;
    const result = await ensureRequirementPublication({
      sourceImmediate: false,
      state: { analysisStatus: 'GENERATION_APPLIED', releaseStatus: 'APPLIED' },
      publish: async () => {
        attempts += 1;
        return { ok: true, payload: { success: true } };
      },
      recordPublication: async () => undefined,
    });

    expect(result).toEqual(
      expect.objectContaining({ attempted: false, completed: true }),
    );
    expect(attempts).toBe(0);
  });
});
