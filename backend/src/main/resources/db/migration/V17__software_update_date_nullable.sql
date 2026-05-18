ALTER TABLE software_installation
    ALTER COLUMN updated_at DROP NOT NULL;

UPDATE software_installation
SET updated_at = NULL
WHERE updated_at = installed_at;
