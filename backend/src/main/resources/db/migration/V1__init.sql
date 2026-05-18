-- Базовые справочники создаются первыми, чтобы основные таблицы могли ссылаться на них через FK
CREATE TABLE role (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE asset_status (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE ticket_status (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE asset_type (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    default_useful_life_years INT NOT NULL CHECK (default_useful_life_years BETWEEN 2 AND 10)
);

CREATE TABLE license_type (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE employee (
    employee_no VARCHAR(16) PRIMARY KEY,
    full_name VARCHAR(256) NOT NULL,
    position VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    login VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES role(id)
);

-- Основные бизнес-таблицы используют строковые номера как понятные пользователю первичные ключи
CREATE TABLE asset (
    inventory_no VARCHAR(32) PRIMARY KEY,
    type_id BIGINT NOT NULL REFERENCES asset_type(id),
    manufacturer VARCHAR(128) NOT NULL,
    model VARCHAR(256) NOT NULL,
    serial_number VARCHAR(128) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL CHECK (purchase_date <= CURRENT_DATE),
    cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
    useful_life_years INT NOT NULL CHECK (useful_life_years BETWEEN 2 AND 10),
    status_id BIGINT NOT NULL REFERENCES asset_status(id)
);

CREATE TABLE software (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    version VARCHAR(64) NOT NULL,
    license_type_id BIGINT NOT NULL REFERENCES license_type(id),
    license_identifier VARCHAR(256),
    license_start DATE,
    license_end DATE,
    license_status VARCHAR(32) NOT NULL DEFAULT 'Активна',
    CONSTRAINT uk_software_name_version UNIQUE(name, version)
);

CREATE TABLE software_installation (
    id BIGSERIAL PRIMARY KEY,
    asset_inventory_no VARCHAR(32) NOT NULL REFERENCES asset(inventory_no),
    software_id BIGINT NOT NULL REFERENCES software(id),
    installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(asset_inventory_no, software_id)
);

CREATE TABLE ticket (
    ticket_no VARCHAR(32) PRIMARY KEY,
    type VARCHAR(128) NOT NULL,
    category VARCHAR(128),
    author_employee_no VARCHAR(16) NOT NULL REFERENCES employee(employee_no),
    assignee_employee_no VARCHAR(16) REFERENCES employee(employee_no),
    asset_inventory_no VARCHAR(32) REFERENCES asset(inventory_no),
    software_id BIGINT REFERENCES software(id),
    justification TEXT,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,
    status_id BIGINT NOT NULL REFERENCES ticket_status(id)
);

-- Актовые таблицы фиксируют жизненный цикл оборудования: выдачу, возврат и списание
CREATE TABLE asset_issue_act (
    act_no VARCHAR(32) PRIMARY KEY,
    asset_inventory_no VARCHAR(32) NOT NULL REFERENCES asset(inventory_no),
    employee_no VARCHAR(16) NOT NULL REFERENCES employee(employee_no),
    issue_date DATE NOT NULL,
    return_date DATE
);

CREATE TABLE asset_write_off_act (
    act_no VARCHAR(32) PRIMARY KEY,
    asset_inventory_no VARCHAR(32) NOT NULL REFERENCES asset(inventory_no),
    reason VARCHAR(128) NOT NULL,
    write_off_date DATE NOT NULL
);

CREATE TABLE system_log (
    id BIGSERIAL PRIMARY KEY,
    logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
    actor_employee_no VARCHAR(16) REFERENCES employee(employee_no),
    action VARCHAR(128) NOT NULL,
    details TEXT
);

CREATE TABLE notification (
    id BIGSERIAL PRIMARY KEY,
    recipient_employee_no VARCHAR(16) NOT NULL REFERENCES employee(employee_no),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    type VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    body TEXT NOT NULL,
    related_ticket_no VARCHAR(32) REFERENCES ticket(ticket_no),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE sequence_counter (
    name VARCHAR(64) PRIMARY KEY,
    year INT NOT NULL,
    last_number INT NOT NULL
);

-- Индексы ускоряют частые фильтры списков по статусу, пользователю и дате
CREATE INDEX idx_asset_status_type ON asset(status_id, type_id);
CREATE INDEX idx_ticket_status_author ON ticket(status_id, author_employee_no, created_at);
CREATE INDEX idx_ticket_status_assignee ON ticket(status_id, assignee_employee_no, created_at);
CREATE INDEX idx_notification_user ON notification(recipient_employee_no, is_read, created_at);
