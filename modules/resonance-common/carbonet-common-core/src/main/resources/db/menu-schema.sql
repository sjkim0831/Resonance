-- =========================================
-- Menu Management Schema
-- =========================================

-- 메뉴 그룹
CREATE TABLE comtnmenugroup (
    menu_group_id VARCHAR(20) NOT NULL PRIMARY KEY,
    menu_group_nm VARCHAR(100) NOT NULL,
    menu_group_ds VARCHAR(200),
    sort_order INTEGER DEFAULT 0,
    use_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id VARCHAR(20)
);

-- 메뉴
CREATE TABLE comtnmenuinfo (
    menu_id VARCHAR(20) NOT NULL PRIMARY KEY,
    upper_menu_id VARCHAR(20),
    menu_nm VARCHAR(100) NOT NULL,
    menu_dc VARCHAR(500),
    menu_path VARCHAR(200),
    menu_url VARCHAR(200),
    icon_path VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    menu_level INTEGER DEFAULT 1,
    menu_group_id VARCHAR(20),
    use_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id VARCHAR(20),
    CONSTRAINT fk_menu_upper FOREIGN KEY (upper_menu_id) REFERENCES comtnmenuinfo (menu_id),
    CONSTRAINT fk_menu_group FOREIGN KEY (menu_group_id) REFERENCES comtnmenugroup (menu_group_id)
);

-- 메뉴 역할/권한 매핑
CREATE TABLE comtnmenurole (
    menu_id VARCHAR(20) NOT NULL,
    role_code VARCHAR(20) NOT NULL,
    search_at CHAR(1) DEFAULT 'Y',
    regitr_at CHAR(1) DEFAULT 'Y',
    updt_at CHAR(1) DEFAULT 'Y',
    delete_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (menu_id, role_code),
    CONSTRAINT fk_menurole_menu FOREIGN KEY (menu_id) REFERENCES comtnmenuinfo (menu_id)
);

-- 메뉴 함수 매핑
CREATE TABLE comtnmenufunctioninfo (
    menu_id VARCHAR(20) NOT NULL,
    function_code VARCHAR(20) NOT NULL,
    function_nm VARCHAR(100),
    function_url VARCHAR(200),
    sort_order INTEGER DEFAULT 0,
    use_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (menu_id, function_code),
    CONSTRAINT fk_menufunc_menu FOREIGN KEY (menu_id) REFERENCES comtnmenuinfo (menu_id)
);
