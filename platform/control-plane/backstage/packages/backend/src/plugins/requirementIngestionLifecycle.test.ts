import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RequirementPublicationError,
  ensureRequirementPublication,
  nextRequirementDesignVersion,
  requirementDocumentId,
  requirementItemId,
} from './requirementIngestionLifecycle';

describe('requirement ingestion lifecycle', () => {
  it('scopes identical document bytes to the project', () => {
    const sha = 'a'.repeat(64);
    const storedDocumentIds = new Set([
      requirementDocumentId('PROJECT-A', sha),
      requirementDocumentId('PROJECT-B', sha),
    ]);
    expect(storedDocumentIds.size).toBe(2);
    expect(requirementDocumentId('project-a', sha)).toBe(
      requirementDocumentId('PROJECT-A', sha),
    );
    expect(requirementItemId('PROJECT-A', 'doc-1', 'REQ-1')).not.toBe(
      requirementItemId('PROJECT-A', 'doc-2', 'REQ-1'),
    );
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
});
