ALTER TABLE software
    DROP CONSTRAINT IF EXISTS software_name_key;

ALTER TABLE software
    DROP CONSTRAINT IF EXISTS uk_software_name_version;

DROP INDEX IF EXISTS uk_software_name_version;

ALTER TABLE software
    ADD CONSTRAINT uk_software_name_version UNIQUE(name, version);
