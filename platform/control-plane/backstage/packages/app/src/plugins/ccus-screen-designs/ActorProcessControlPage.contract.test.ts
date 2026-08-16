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
    expect(source).not.toContain('PROMOTED');
  });

  it('binds all eighteen axes to one versioned composite SOURCE authority', () => {
    for (const type of [
      'REQUIREMENT',
      'ACTOR_RACI',
      'AUTHORITY',
      'PROCESS',
      'STATE',
      'NAVIGATION',
      'ACTIVE_UI',
      'DESIGN_ASSET',
      'FIELD_DICTIONARY',
      'DATA_HANDOFF',
      'DATABASE',
      'API',
      'BUSINESS_RULE',
      'VALIDATION',
      'NOTIFICATION',
      'TEST',
      'TASK_EVIDENCE',
      'RELEASE_AUDIT',
    ]) {
      expect(source).toContain(`'${type}'`);
    }
    expect(source).toContain('carbonet.integrated-design-axis/v1');
    expect(source).toContain('COMPOSITE_SOURCE_IMMEDIATE');
    expect(source).toContain('COMPOSITE_PENDING');
    expect(source).toContain('18축 미리보기(IN_REVIEW)');
    expect(source).toContain("'GENERATE_VALIDATE_COMPILE'");
    expect(source).toContain("'PROCESS_GENERATE_VALIDATE_COMPILE'");
    expect(source).toContain('선택 화면 설계 생성·검증·코드 자동 반영');
    expect(source).toContain('프로세스 전체 설계·코드 1-click 반영');
    expect(source).toContain('authority ${receipt.authorityCount ?? 0}개');
    expect(source).toContain('축 저장·18/18 자동 컴파일');
    expect(source).toContain('SOURCE 적용·물리 생성 대기');
    expect(source).toContain('물리 생성·테스트 검증 완료');
    expect(source).toContain('물리 생성 실패');
    expect(source).not.toContain('자동 반영 완료');
    expect(source).not.toContain('NOTE_ONLY');
  });

  it('selects USER and ADMIN authority explicitly even when routes are identical', () => {
    expect(source).toContain('professionalScreenContracts');
    expect(source).toContain('matchingIdentities');
    expect(source).toContain('Canonical audience');
    expect(source).toContain('같은 route의 USER·ADMIN authority를 추정하지 않습니다.');
    expect(source).not.toContain(
      "routePath === String(step?.adminPath ?? '') ? 'ADMIN' : 'USER'",
    );
  });
});
