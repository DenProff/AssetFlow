-- Справочник статусов лицензий выносит строковые значения из software в отдельную таблицу
CREATE TABLE license_status (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

INSERT INTO license_status(name) VALUES
('Активна'),
('Истекает'),
('Истекла');

ALTER TABLE software ADD COLUMN license_status_id BIGINT;

UPDATE software s
SET license_status_id = ls.id
FROM license_status ls
WHERE ls.name = s.license_status;

UPDATE software
SET license_status_id = (SELECT id FROM license_status WHERE name = 'Активна')
WHERE license_status_id IS NULL;

ALTER TABLE software
    ALTER COLUMN license_status_id SET NOT NULL,
    ADD CONSTRAINT fk_software_license_status FOREIGN KEY (license_status_id) REFERENCES license_status(id);

ALTER TABLE software DROP COLUMN license_status;
