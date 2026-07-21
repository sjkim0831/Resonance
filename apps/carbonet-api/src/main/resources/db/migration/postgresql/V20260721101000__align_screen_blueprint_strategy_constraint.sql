ALTER TABLE framework_screen_blueprint
  DROP CONSTRAINT IF EXISTS ck_screen_blueprint_strategy;

ALTER TABLE framework_screen_blueprint
  ADD CONSTRAINT ck_screen_blueprint_strategy
  CHECK (implementation_strategy IN (
    'ADOPT_EXISTING',
    'STANDARDIZE_RUNTIME',
    'GENERATE_NEW',
    'GENERATED_RUNTIME',
    'DESIGN_REQUIRED'
  ));

COMMENT ON CONSTRAINT ck_screen_blueprint_strategy ON framework_screen_blueprint IS
  '화면 설계, 기존 화면 채택, 표준화 및 생성 런타임에서 사용하는 모든 구현 전략을 허용한다.';
