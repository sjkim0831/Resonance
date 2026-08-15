import { readFileSync } from 'fs';
import { join } from 'path';

describe('ActorProcessControlPage SOURCE immediate contract', () => {
  const source = readFileSync(
    join(__dirname, 'ActorProcessControlPage.tsx'),
    'utf8',
  );

  it('routes the design workspace to the immediate runtime generator', () => {
    expect(source).toContain("command: 'screen.design.generate'");
    expect(source).toContain(
      "onClick={() => openControlTab('design-release')}",
    );
    expect(source).toContain('activationPolicy=SOURCE_IMMEDIATE_V1');
    for (const field of [
      'routePath',
      'pageId',
      'pageTitle',
      'designNote',
      'functionNote',
      'acceptanceNote',
      'status',
    ]) {
      expect(source).toContain(`name: '${field}'`);
    }
  });

  it('does not retain the incompatible schema-v2 promotion workflow', () => {
    expect(source).not.toContain('schemaVersion: 2');
    expect(source).not.toContain('promoteDesignRelease');
    expect(source).not.toContain('/design-releases/${designVersion}/promote');
  });
});
