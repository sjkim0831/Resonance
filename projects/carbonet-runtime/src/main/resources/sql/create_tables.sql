-- Theme table
CREATE TABLE CARR_THEMA (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    source VARCHAR(50) NOT NULL
);

-- Module table
CREATE TABLE CARR_MODULE (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    source VARCHAR(50) NOT NULL
);

-- Screen-menu-assignment table
CREATE TABLE CARR_SCREEN_MENU_ASSIGNMENT (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    source VARCHAR(50) NOT NULL
);
