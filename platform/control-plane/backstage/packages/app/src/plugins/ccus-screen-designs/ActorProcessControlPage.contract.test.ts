import { readFileSync } from 'fs';
import { join } from 'path';

describe('ActorProcessControlPage SOURCE immediate contract', () => {
  const source = readFileSync(
    join(__dirname, 'ActorProcessControlPage.tsx'),
    'utf8',
  );

  it('routes the standard design action to the structured immediate contract workspace', () => {
    expect(source).not.toContain("command: 'screen.design.generate'");
    expect(source).toContain(
      "onClick={() => openControlTab('data-contracts')}",
    );
    expect(source).toContain('activationPolicy=SOURCE_IMMEDIATE_V1');
    for (const field of [
      'permissionCodes',
      'layoutCode',
      'themeCode',
      'sectionContract',
      'fieldContract',
      'commandContract',
      'apiContract',
    ]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("command: 'screen.contract.save'");
    expect(source).toContain('professionalContractSaveValues(draft)');
    expect(source).toContain('hydrateStringDraft(emptyDataContract(), row)');
  });

  it('does not retain the incompatible schema-v2 promotion workflow', () => {
    expect(source).not.toContain('schemaVersion: 2');
    expect(source).not.toContain('promoteDesignRelease');
    expect(source).not.toContain('/design-releases/${designVersion}/promote');
    const lifecycleStart = source.indexOf('label="수명주기"');
    const lifecycleOptions = source.slice(
      lifecycleStart,
      source.indexOf('</TextField>', lifecycleStart),
    );
    expect(lifecycleOptions).not.toContain("'PROMOTED'");
    expect(source).toContain("=== 'PROMOTED'");
    expect(source).toContain("? 'VALIDATED'");
  });
});
