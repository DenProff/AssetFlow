ALTER TABLE employee
    ADD COLUMN last_name  VARCHAR(128),
    ADD COLUMN first_name VARCHAR(128),
    ADD COLUMN patronymic VARCHAR(128);

UPDATE employee
SET last_name  = SPLIT_PART(full_name, ' ', 1),
    first_name = SPLIT_PART(full_name, ' ', 2),
    patronymic = CASE
                     WHEN array_length(string_to_array(trim(full_name), ' '), 1) >= 3
                         THEN SPLIT_PART(full_name, ' ', 3)
                     ELSE NULL
                     END;

UPDATE employee SET last_name = 'Неизвестно' WHERE last_name IS NULL OR last_name = '';
UPDATE employee SET first_name = 'Неизвестно' WHERE first_name IS NULL OR first_name = '';

ALTER TABLE employee
    ALTER COLUMN last_name  SET NOT NULL,
    ALTER COLUMN first_name SET NOT NULL;

ALTER TABLE employee DROP COLUMN full_name;
