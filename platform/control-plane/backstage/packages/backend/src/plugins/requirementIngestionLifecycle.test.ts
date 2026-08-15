import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RequirementPublicationError,
  ensureRequirementPublication,
  nextRequirementDesignVersion,
  requirementContentFingerprint,
  requirementDocumentId,
  requirementItemId,
  sameRequirementRevision,
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
    const markQueued = async () => {
      state.analysisStatus = 'GENERATION_QUEUED';
      state.releaseStatus = 'PROMOTED';
    };

    await expect(
      ensureRequirementPublication({
        autoPromote: true,
        state,
        publish,
        markQueued,
      }),
    ).rejects.toBeInstanceOf(RequirementPublicationError);
    expect(state.analysisStatus).toBe('DESIGN_VALIDATED');

    const retry = await ensureRequirementPublication({
      autoPromote: true,
      state,
      publish,
      markQueued,
    });
    expect(retry).toEqual(
      expect.objectContaining({ attempted: true, completed: true }),
    );

    const replay = await ensureRequirementPublication({
      autoPromote: true,
      state,
      publish,
      markQueued,
    });
    expect(replay).toEqual(
      expect.objectContaining({ attempted: false, completed: true }),
    );
    expect(attempts).toBe(2);
  });

  it('does not downgrade a completed publication when auto promotion is off', async () => {
    let attempts = 0;
    const result = await ensureRequirementPublication({
      autoPromote: false,
      state: { analysisStatus: 'GENERATION_APPLIED', releaseStatus: 'APPLIED' },
      publish: async () => {
        attempts += 1;
        return { ok: true, payload: { success: true } };
      },
      markQueued: async () => undefined,
    });

    expect(result).toEqual(
      expect.objectContaining({ attempted: false, completed: true }),
    );
    expect(attempts).toBe(0);
  });
});
