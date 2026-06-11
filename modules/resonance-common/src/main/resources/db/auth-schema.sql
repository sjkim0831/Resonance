-- =========================================
-- Authority Management Schema
-- =========================================
-- 역할 (Role)
CREATE TABLE comtnauthorinfo (
    author_code VARCHAR(20) NOT NULL PRIMARY KEY,
    author_nm VARCHAR(100) NOT NULL,
    authorDc VARCHAR(200),
    author_ty_code VARCHAR(10),
    sort_order INTEGER DEFAULT 0,
    use_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    creat_user_id VARCHAR(20)
);

-- 역할별 접근 가능 메뉴
CREATE TABLE comtnauthormenumapping (
    author_code VARCHAR(20) NOT NULL,
    menu_id VARCHAR(20) NOT NULL,
    search_at CHAR(1) DEFAULT 'Y',
    regitr_at CHAR(1) DEFAULT 'Y',
    updt_at CHAR(1) DEFAULT 'Y',
    delete_at CHAR(1) DEFAULT 'Y',
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (author_code, menu_id)
);

-- 사용자-역할 매핑
CREATE TABLE comtnuserauthormapping (
    user_id VARCHAR(20) NOT NULL,
    author_code VARCHAR(20) NOT NULL,
    creat_pnttm DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, author_code)
);

-- 기본 역할 데이터
INSERT INTO comtnauthorinfo (author_code, author_nm, authorDc, author_ty_code, sort_order, use_at, creat_user_id)
VALUES ('ROLE_ADMIN', '관리자', '전체 시스템 접근 가능', 'SYSTEM', 1, 'Y', 'system');

INSERT INTO comtnauthorinfo (author_code, author_nm, authorDc, author_ty_code, sort_order, use_at, creat_user_id)
VALUES ('ROLE_MANAGER', '매니저', '부서 관리 및 모니터링', 'BUSINESS', 2, 'Y', 'system');

INSERT INTO comtnauthorinfo (author_code, author_nm, authorDc, author_ty_code, sort_order, use_at, creat_user_id)
VALUES ('ROLE_USER', '일반사용자', '기본 기능만 접근', 'USER', 3, 'Y', 'system');

INSERT INTO comtnauthorinfo (author_code, author_nm, authorDc, author_ty_code, sort_order, use_at, creat_user_id)
VALUES ('ROLE_GUEST', '게스트', '읽기 전용', 'GUEST', 4, 'Y', 'system');

-- ROLE_ADMIN에 모든 메뉴 권한 부여
INSERT INTO comtnauthormenumapping (author_code, menu_id, search_at, regitr_at, updt_at, delete_at)
SELECT 'ROLE_ADMIN', menu_id, 'Y', 'Y', 'Y', 'Y' FROM comtnmenuinfo WHERE use_at = 'Y';