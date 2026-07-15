CREATE TABLE IF NOT EXISTS ai_rag_document (
    id varchar(80) PRIMARY KEY,
    document_id varchar(80) NOT NULL UNIQUE,
    project_id varchar(60) NOT NULL DEFAULT 'carbonet',
    document_name varchar(500) NOT NULL,
    document_type varchar(80) NOT NULL,
    source varchar(40) NOT NULL,
    source_type varchar(40) NOT NULL,
    source_path varchar(1000),
    version integer NOT NULL DEFAULT 1,
    status varchar(40) NOT NULL DEFAULT 'ACTIVE',
    chunk_count integer NOT NULL DEFAULT 0,
    duplicate_rate double precision NOT NULL DEFAULT 0,
    indexed_at timestamptz,
    created_by varchar(80) NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_updt_pnttm timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS ai_rag_chunk (
    id varchar(80) PRIMARY KEY,
    chunk_id varchar(80) NOT NULL UNIQUE,
    document_id varchar(80) NOT NULL REFERENCES ai_rag_document(document_id) ON DELETE CASCADE,
    document_name varchar(500) NOT NULL,
    project_id varchar(60) NOT NULL DEFAULT 'carbonet',
    chunk_index integer NOT NULL DEFAULT 0,
    content_hash varchar(80) NOT NULL,
    content_text text,
    content_preview varchar(500),
    chunk_size integer NOT NULL DEFAULT 0,
    token_count integer NOT NULL DEFAULT 0,
    quality_score double precision,
    status varchar(40) NOT NULL DEFAULT 'ACTIVE',
    embedded_yn char(1) NOT NULL DEFAULT 'N',
    created_by varchar(80) NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_updt_pnttm timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_ai_rag_chunk_document ON ai_rag_chunk(document_id, chunk_index);

CREATE TABLE IF NOT EXISTS ai_prompt_template (
    prompt_id varchar(80) PRIMARY KEY,
    project_id varchar(60) NOT NULL DEFAULT 'carbonet',
    prompt_name varchar(300) NOT NULL,
    prompt_type varchar(80) NOT NULL,
    version varchar(20) NOT NULL,
    system_prompt text,
    user_template text,
    variables_json text,
    model_name varchar(200),
    temperature double precision NOT NULL DEFAULT 0.1,
    max_tokens integer,
    description text,
    status varchar(40) NOT NULL DEFAULT 'DRAFT',
    active_yn char(1) NOT NULL DEFAULT 'Y',
    created_by varchar(80) NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_updt_pnttm timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS ai_krds_code_generation (
    generation_id varchar(80) PRIMARY KEY,
    project_id varchar(60) NOT NULL DEFAULT 'carbonet',
    user_prompt text NOT NULL,
    target_type varchar(40) NOT NULL,
    model_name varchar(200) NOT NULL,
    prompt_snapshot text NOT NULL,
    output_code text,
    rag_chunk_count integer NOT NULL DEFAULT 0,
    wcag_status varchar(20) NOT NULL,
    violations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    duration_ms bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_ai_krds_generation_status_time
    ON ai_krds_code_generation(wcag_status, created_at DESC);

INSERT INTO ai_rag_document(id, document_id, project_id, document_name, document_type, source, source_type, source_path,
                            version, status, chunk_count, duplicate_rate, indexed_at, created_by)
VALUES ('KRDS-MANUAL-2026', 'KRDS-MANUAL-2026', 'carbonet', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼',
        'KRDS_MANUAL', 'SYSTEM', 'SYSTEM', 'db://krds/manual/2026', 1, 'ACTIVE', 6, 0, current_timestamp, 'flyway')
ON CONFLICT(document_id) DO UPDATE SET document_name=excluded.document_name, document_type=excluded.document_type,
    status='ACTIVE', chunk_count=6, indexed_at=current_timestamp, last_updt_pnttm=current_timestamp;

INSERT INTO ai_rag_chunk(id, chunk_id, document_id, document_name, project_id, chunk_index, content_hash, content_text, content_preview,
                         chunk_size, token_count, quality_score, status, embedded_yn, created_by)
VALUES
('KRDS-TOKEN-FOUNDATION', 'KRDS-TOKEN-FOUNDATION', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 1, 'krds-foundation-v1',
 $$KRDS foundation: use only registered gov-/krds- classes and CSS variables. Typography uses gov-text-display, gov-text-heading-lg/md/sm, gov-text-body, gov-text-body-sm, gov-text-label. Preserve a small, responsive type scale. Use spacing in 4px multiples, content max-width, readable line length, and mobile-first breakpoints. Never introduce arbitrary hex colors when a KRDS semantic token exists.$$,
 'KRDS 토큰·타이포그래피·간격 기본 규칙', 520, 120, 100, 'ACTIVE', 'Y', 'flyway'),
('KRDS-COMPONENT-FORM', 'KRDS-COMPONENT-FORM', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 2, 'krds-form-v1',
 $$Forms: every input, select and textarea has a persistent visible label connected by htmlFor/id. Required state and error text are programmatically associated with aria-describedby and aria-invalid. Use gov-input, gov-select, gov-btn, gov-btn-primary and gov-btn-outline. Buttons always declare type. Do not rely on placeholder, color, icon, or position alone.$$,
 'KRDS 입력·버튼·오류 처리 규칙', 530, 125, 100, 'ACTIVE', 'Y', 'flyway'),
('KRDS-COMPONENT-NAV', 'KRDS-COMPONENT-NAV', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 3, 'krds-nav-v1',
 $$Navigation: use header, nav, main and footer landmarks; one descriptive h1; logical heading order; aria-current for the current destination; native button for disclosure; Escape closes dialogs; focus returns to the trigger; skip link targets main content. All actions must be keyboard operable with a visible focus-visible indicator.$$,
 'KRDS 내비게이션·키보드 규칙', 510, 118, 100, 'ACTIVE', 'Y', 'flyway'),
('KRDS-COMPONENT-DATA', 'KRDS-COMPONENT-DATA', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 4, 'krds-data-v1',
 $$Data UI: tables include caption, th scope, meaningful empty/loading/error states and a mobile overflow strategy. Charts have a text summary and data table alternative. Status is expressed by text as well as color. Destructive actions require confirmation and announce the result through an aria-live region.$$,
 'KRDS 표·차트·상태 규칙', 440, 102, 100, 'ACTIVE', 'Y', 'flyway'),
('KRDS-WCAG-AA', 'KRDS-WCAG-AA', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 5, 'krds-wcag-aa-v1',
 $$WCAG 2.1 AA gate: normal text contrast at least 4.5:1, large text at least 3:1, UI component boundaries and focus indicators at least 3:1. Touch targets should be at least 44 by 44 CSS pixels. Content works at 320px width and 200% zoom without loss. Images have purposeful alt text or empty alt when decorative. Errors identify the field and provide correction guidance.$$,
 'WCAG 2.1 AA 정적 품질 게이트', 510, 120, 100, 'ACTIVE', 'Y', 'flyway'),
('KRDS-OUTPUT-CONTRACT', 'KRDS-OUTPUT-CONTRACT', 'KRDS-MANUAL-2026', 'KRDS UI·UX 디자인 토큰 및 WCAG 2.1 AA 생성 매뉴얼', 'carbonet', 6, 'krds-output-v1',
 $$Output contract: return one complete React TypeScript component or semantic HTML fragment only, without Markdown fences or explanation. Use existing KRDS/GOV classes, semantic HTML and responsive layout. No inline event handler on non-interactive elements, no raw hex palette, no inaccessible custom control, no hidden focus outline, and no placeholder-only form.$$,
 'KRDS 코드 출력 계약', 430, 98, 100, 'ACTIVE', 'Y', 'flyway')
ON CONFLICT(chunk_id) DO UPDATE SET content_text=excluded.content_text, content_preview=excluded.content_preview,
    quality_score=100, status='ACTIVE', embedded_yn='Y', last_updt_pnttm=current_timestamp;

INSERT INTO ai_prompt_template(prompt_id, project_id, prompt_name, prompt_type, version, system_prompt, user_template,
                               variables_json, model_name, temperature, max_tokens, description, status, active_yn, created_by)
VALUES ('PROMPT-KRDS-CODE-001', 'carbonet', 'KRDS·WCAG 2.1 AA 코드 생성', 'KRDS_CODE_GENERATION', '1.0',
$$You are the Carbonet KRDS code compiler. Treat retrieved KRDS manual and live DB theme tokens as binding constraints, not suggestions. Produce production-ready semantic code that satisfies WCAG 2.1 AA. Prefer existing gov-/krds- component classes. Never invent APIs, tokens, data fields, or routes. Include loading, empty, error and success behavior when the request involves data. Return code only, without Markdown fences.$$,
$$Target: {{target}}
Request: {{userPrompt}}
Retrieved context: {{krdsContext}}$$,
 '{"required":["target","userPrompt","krdsContext"]}', 'qwen3.6-40b-hermes-framework-qlora', 0.1, 6000,
 'KRDS RAG와 정적 접근성 게이트를 사용하는 화면·컴포넌트 코드 생성 프롬프트', 'ACTIVE', 'Y', 'flyway')
ON CONFLICT(prompt_id) DO UPDATE SET system_prompt=excluded.system_prompt, user_template=excluded.user_template,
    variables_json=excluded.variables_json, model_name=excluded.model_name, temperature=excluded.temperature,
    max_tokens=excluded.max_tokens, description=excluded.description, status='ACTIVE', active_yn='Y',
    last_updt_pnttm=current_timestamp;
