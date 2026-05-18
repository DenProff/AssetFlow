ALTER TABLE asset_issue_act
    RENAME TO asset_movement_act;

ALTER TABLE asset_movement_act
    RENAME COLUMN issue_date TO movement_date;

ALTER TABLE asset_movement_act
    ADD COLUMN movement_type VARCHAR(16),
    ADD COLUMN related_act_no VARCHAR(32);

UPDATE asset_movement_act
SET movement_type = 'ISSUE';

INSERT INTO asset_movement_act (
    act_no,
    asset_inventory_no,
    employee_no,
    movement_date,
    return_date,
    actor_employee_no,
    movement_type,
    related_act_no
)
SELECT
    act_no || '-R',
    asset_inventory_no,
    employee_no,
    return_date,
    NULL,
    actor_employee_no,
    'RETURN',
    act_no
FROM asset_movement_act
WHERE return_date IS NOT NULL;

ALTER TABLE asset_movement_act
    DROP COLUMN return_date,
    ALTER COLUMN movement_type SET NOT NULL,
    ALTER COLUMN movement_date SET NOT NULL;

ALTER TABLE asset_movement_act
    ADD CONSTRAINT fk_asset_movement_related_act
    FOREIGN KEY (related_act_no) REFERENCES asset_movement_act(act_no);

ALTER TABLE software_installation
    ADD COLUMN installed_version VARCHAR(64),
    ADD COLUMN updated_at TIMESTAMP;

UPDATE software_installation si
SET installed_version = s.version
FROM software s
WHERE si.software_id = s.id;

ALTER TABLE software_installation
    ALTER COLUMN installed_version SET NOT NULL;

ALTER TABLE ticket
    ADD COLUMN target_software_version VARCHAR(64);
