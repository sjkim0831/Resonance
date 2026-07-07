-- ============================================================================
-- Screen Builder Component, Theme, and Screen Config Schema
-- Resonance AI Page Builder Database
-- ============================================================================

-- TABLE 1: COMTNCOMPONENTINFO - Component Registry
CREATE TABLE IF NOT EXISTS comtncomponentinfo (
    component_id          VARCHAR(50) NOT NULL PRIMARY KEY,
    component_nm          VARCHAR(100) NOT NULL,
    component_dc         VARCHAR(500),
    component_type       VARCHAR(30) NOT NULL COMMENT 'BUTTON|CARD|INPUT|TABLE|FORM|SECTION|LAYOUT|CHART|MEDIA|OTHER',
    category_cd          VARCHAR(30) COMMENT 'LAYOUT|FORM|DISPLAY|DATA|NAVIGATION|FEEDBACK',
    icon_nm              VARCHAR(50),
    default_props        CLOB COMMENT 'JSON object for default props',
    default_class_nm     VARCHAR(200),
    default_style        CLOB COMMENT 'JSON object for inline styles',
    data_attrs           CLOB COMMENT 'JSON object for data-* attributes',
    is_container         CHAR(1) DEFAULT 'N' COMMENT 'Y/N - can contain child components',
    is_reusable          CHAR(1) DEFAULT 'Y' COMMENT 'Y/N - can be used in builder',
    sort_order           INTEGER DEFAULT 0,
    use_at               CHAR(1) DEFAULT 'Y',
    creat_pnttm          DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id        VARCHAR(20),
    updt_pnttm           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updt_user_id         VARCHAR(20)
);

-- TABLE 2: COMTNTHEMEDEFINITION - Theme Definitions
CREATE TABLE IF NOT EXISTS comtnthemedefinition (
    theme_id             VARCHAR(50) NOT NULL PRIMARY KEY,
    theme_nm             VARCHAR(100) NOT NULL,
    theme_dc             VARCHAR(500),
    theme_type           VARCHAR(30) DEFAULT 'CUSTOM' COMMENT 'SYSTEM|CUSTOM',
    base_theme_id        VARCHAR(50),
    color_config         CLOB COMMENT 'JSON: primary, secondary, success, warning, danger, etc.',
    typography_config    CLOB COMMENT 'JSON: font family, sizes, weights',
    spacing_config       CLOB COMMENT 'JSON: margins, paddings, gaps',
    border_config        CLOB COMMENT 'JSON: radius, widths, styles',
    shadow_config        CLOB COMMENT 'JSON: box shadows',
    class_prefix         VARCHAR(30) DEFAULT 'theme',
    is_default           CHAR(1) DEFAULT 'N',
    is_active            CHAR(1) DEFAULT 'Y',
    sort_order           INTEGER DEFAULT 0,
    use_at               CHAR(1) DEFAULT 'Y',
    creat_pnttm          DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id        VARCHAR(20),
    updt_pnttm           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updt_user_id         VARCHAR(20)
);

-- TABLE 3: COMTNTHEMECLASSSET - Theme Class Sets (predefined class combinations)
CREATE TABLE IF NOT EXISTS comtnthemeclassset (
    class_set_id         VARCHAR(50) NOT NULL PRIMARY KEY,
    theme_id             VARCHAR(50) NOT NULL,
    class_set_nm         VARCHAR(100) NOT NULL,
    class_set_dc         VARCHAR(500),
    target_component     VARCHAR(50) COMMENT 'component_id or NULL for general',
    base_classes         VARCHAR(500) COMMENT 'base Tailwind classes',
    hover_classes        VARCHAR(300),
    focus_classes        VARCHAR(300),
    active_classes       VARCHAR(300),
    disabled_classes     VARCHAR(300),
    responsive_classes   CLOB COMMENT 'JSON: { sm: "...", md: "...", lg: "..." }',
    sort_order           INTEGER DEFAULT 0,
    use_at               CHAR(1) DEFAULT 'Y',
    creat_pnttm          DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id        VARCHAR(20),
    updt_pnttm           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updt_user_id         VARCHAR(20),
    CONSTRAINT fk_theme_classset FOREIGN KEY (theme_id) REFERENCES comtnthemedefinition(theme_id) ON DELETE CASCADE
);

-- TABLE 4: COMTNSCRNCFG - Screen Configuration (DB-backed ScreenConfigVO)
CREATE TABLE IF NOT EXISTS comtnscrncfg (
    screen_id            VARCHAR(50) NOT NULL PRIMARY KEY,
    menu_code            VARCHAR(50) UNIQUE,
    page_id              VARCHAR(50),
    menu_nm              VARCHAR(100),
    menu_url             VARCHAR(200),
    template_type        VARCHAR(30) DEFAULT 'admin' COMMENT 'admin|public|mobile',
    theme_id             VARCHAR(50),
    custom_classes       VARCHAR(500),
    custom_styles        CLOB COMMENT 'JSON object for custom inline styles',
    nodes_json           CLOB COMMENT 'JSON array of ScreenBuilderNodeVO',
    events_json          CLOB COMMENT 'JSON array of ScreenBuilderEventBindingVO',
    status               VARCHAR(20) DEFAULT 'DRAFT' COMMENT 'DRAFT|PUBLISHED|ARCHIVED',
    version              INTEGER DEFAULT 1,
    screen_family        VARCHAR(50),
    screen_group         VARCHAR(30),
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by           VARCHAR(20),
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by           VARCHAR(20),
    published_at         DATETIME,
    published_by         VARCHAR(20),
    CONSTRAINT fk_scrncfg_theme FOREIGN KEY (theme_id) REFERENCES comtnthemedefinition(theme_id) ON DELETE SET NULL
);

-- TABLE 5: COMTNSCRNCFGVRSION - Screen Configuration Version History
CREATE TABLE IF NOT EXISTS comtnscrncfgvrsion (
    version_id           VARCHAR(50) NOT NULL PRIMARY KEY,
    screen_id            VARCHAR(50) NOT NULL,
    version              INTEGER NOT NULL,
    nodes_json           CLOB,
    events_json          CLOB,
    change_desc          VARCHAR(500),
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by           VARCHAR(20),
    CONSTRAINT fk_scrncfgvrsion_scrncfg FOREIGN KEY (screen_id) REFERENCES comtnscrncfg(screen_id) ON DELETE CASCADE
);

-- TABLE 6: COMTNWIDGETTEMPLATE - Widget/Component Templates for Quick Insert
CREATE TABLE IF NOT EXISTS comtnwidgettemplate (
    template_id          VARCHAR(50) NOT NULL PRIMARY KEY,
    template_nm          VARCHAR(100) NOT NULL,
    template_dc         VARCHAR(500),
    template_type       VARCHAR(30) NOT NULL COMMENT 'WIDGET|SNIPPET|LAYOUT|TABLE_CELL',
    thumbnail_url       VARCHAR(200),
    default_props        CLOB COMMENT 'JSON object',
    default_class_nm     VARCHAR(200),
    nodes_json           CLOB COMMENT 'JSON array of pre-built node structures',
    sort_order           INTEGER DEFAULT 0,
    use_at               CHAR(1) DEFAULT 'Y',
    creat_pnttm          DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id        VARCHAR(20),
    updt_pnttm           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updt_user_id         VARCHAR(20)
);

-- INDEXES
CREATE INDEX idx_component_type ON comtncomponentinfo(component_type);
CREATE INDEX idx_component_category ON comtncomponentinfo(category_cd);
CREATE INDEX idx_component_use_at ON comtncomponentinfo(use_at);

CREATE INDEX idx_theme_type ON comtnthemedefinition(theme_type);
CREATE INDEX idx_theme_active ON comtnthemedefinition(is_active);
CREATE INDEX idx_theme_default ON comtnthemedefinition(is_default);

CREATE INDEX idx_classset_theme ON comtnthemeclassset(theme_id);

CREATE INDEX idx_scrncfg_menu_code ON comtnscrncfg(menu_code);
CREATE INDEX idx_scrncfg_status ON comtnscrncfg(status);
CREATE INDEX idx_scrncfg_template ON comtnscrncfg(template_type);

CREATE INDEX idx_scrncfgvrsion_screen ON comtnscrncfgvrsion(screen_id);

CREATE INDEX idx_widget_template_type ON comtnwidgettemplate(template_type);
CREATE INDEX idx_widget_use_at ON comtnwidgettemplate(use_at);

-- SAMPLE DATA: Default Component Types
INSERT INTO comtncomponentinfo (component_id, component_nm, component_dc, component_type, category_cd, icon_nm, default_class_nm, is_container, is_reusable, sort_order) VALUES
('CMPT001', 'Button', '일반 버튼', 'BUTTON', 'FEEDBACK', 'button', 'px-4 py-2 rounded font-medium', 'N', 'Y', 1),
('CMPT002', 'Card', '카드 컨테이너', 'CARD', 'LAYOUT', 'card', 'bg-white rounded-lg shadow p-4', 'Y', 'Y', 2),
('CMPT003', 'Input', '텍스트 입력 필드', 'INPUT', 'FORM', 'text-input', 'w-full px-3 py-2 border rounded', 'N', 'Y', 3),
('CMPT004', 'Select', '셀렉트 박스', 'INPUT', 'FORM', 'select', 'w-full px-3 py-2 border rounded', 'N', 'Y', 4),
('CMPT005', 'Table', '데이터 테이블', 'TABLE', 'DATA', 'table', 'min-w-full divide-y divide-gray-200', 'Y', 'Y', 5),
('CMPT006', 'Section', '섹션 컨테이너', 'SECTION', 'LAYOUT', 'layout', 'p-4 mb-4', 'Y', 'Y', 6),
('CMPT007', 'Form', '입력 폼 컨테이너', 'FORM', 'LAYOUT', 'form', 'space-y-4', 'Y', 'Y', 7),
('CMPT008', 'Modal', '모달 다이얼로그', 'OTHER', 'FEEDBACK', 'modal', '', 'Y', 'Y', 8),
('CMPT009', 'Alert', '알림 메시지', 'OTHER', 'FEEDBACK', 'alert', 'p-4 rounded', 'N', 'Y', 9),
('CMPT010', 'Badge', '배지/태그', 'OTHER', 'DISPLAY', 'tag', 'px-2 py-1 text-xs rounded-full', 'N', 'Y', 10);

-- SAMPLE DATA: Default Themes
INSERT INTO comtnthemedefinition (theme_id, theme_nm, theme_dc, theme_type, color_config, typography_config, is_default, sort_order) VALUES
('THEME001', 'Default Light', '기본 라이트 테마', 'SYSTEM',
 '{"primary": "#3B82F6", "secondary": "#6B7280", "success": "#10B981", "warning": "#F59E0B", "danger": "#EF4444", "background": "#FFFFFF", "foreground": "#1F2937"}',
 '{"fontFamily": "Inter, sans-serif", "baseSize": "16px", "scale": "1.25"}',
 'Y', 1),
('THEME002', 'Default Dark', '기본 다크 테마', 'SYSTEM',
 '{"primary": "#60A5FA", "secondary": "#9CA3AF", "success": "#34D399", "warning": "#FBBF24", "danger": "#F87171", "background": "#111827", "foreground": "#F9FAFB"}',
 '{"fontFamily": "Inter, sans-serif", "baseSize": "16px", "scale": "1.25"}',
 'N', 2),
('THEME003', 'Dashboard', '대시보드용 다크 테마', 'CUSTOM',
 '{"primary": "#3B82F6", "secondary": "#64748B", "success": "#22C55E", "warning": "#EAB308", "danger": "#DC2626", "background": "#0F172A", "foreground": "#F8FAFC"}',
 '{"fontFamily": "Inter, sans-serif", "baseSize": "14px", "scale": "1.2"}',
 'N', 3);

-- SAMPLE DATA: Widget Templates
INSERT INTO comtnwidgettemplate (template_id, template_nm, template_dc, template_type, default_props, default_class_nm, nodes_json, sort_order) VALUES
('WGT001', 'Header Section', '헤더 섹션 위젯', 'WIDGET',
 '{"title": "제목", "showBackButton": true}',
 'bg-white shadow',
 '[{"nodeId": "header-root", "componentType": "section", "props": {"title": "제목"}}]',
 1),
('WGT002', 'Data Table', '데이터 테이블 위젯', 'WIDGET',
 '{"columns": 5, "rows": 10, "striped": true}',
 'min-w-full divide-y divide-gray-200',
 '[{"nodeId": "table-root", "componentType": "table", "props": {"columns": 5, "striped": true}}]',
 2),
('WGT003', 'Form Layout', '입력 폼 레이아웃', 'LAYOUT',
 '{"columns": 2, "gutter": "md"}',
 'grid grid-cols-2 gap-4',
 '[{"nodeId": "form-root", "componentType": "form", "props": {"columns": 2}}]',
 3);