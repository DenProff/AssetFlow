-- Образцы оборудования
INSERT INTO asset (inventory_no, type_id, manufacturer, model, serial_number,
                   purchase_date, cost, status_id, vendor_name, receipt_act_no)
SELECT 'IT-2025-0001',
       (SELECT id FROM asset_type WHERE name = 'ПК'),
       'Dell', 'OptiPlex 7010', 'SN-DELL-001',
       '2025-01-15', 75000.00,
       (SELECT id FROM asset_status WHERE name = 'На складе'),
       'ООО ТехноМаркет', 'ОС-1-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0001');

INSERT INTO asset (inventory_no, type_id, manufacturer, model, serial_number,
                   purchase_date, cost, status_id, vendor_name, receipt_act_no)
SELECT 'IT-2025-0002',
       (SELECT id FROM asset_type WHERE name = 'Ноутбук'),
       'Lenovo', 'ThinkPad E15', 'SN-LENOVO-002',
       '2025-02-10', 95000.00,
       (SELECT id FROM asset_status WHERE name = 'На складе'),
       'ООО ТехноМаркет', 'ОС-1-2025-0002'
WHERE NOT EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0002');

INSERT INTO asset (inventory_no, type_id, manufacturer, model, serial_number,
                   purchase_date, cost, status_id, vendor_name, receipt_act_no)
SELECT 'IT-2025-0003',
       (SELECT id FROM asset_type WHERE name = 'Принтер'),
       'HP', 'LaserJet Pro M404n', 'SN-HP-003',
       '2025-03-05', 32000.00,
       (SELECT id FROM asset_status WHERE name = 'На складе'),
       'ИП Иванов', 'ОС-1-2025-0003'
WHERE NOT EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0003');

INSERT INTO asset (inventory_no, type_id, manufacturer, model, serial_number,
                   purchase_date, cost, status_id, vendor_name, receipt_act_no)
SELECT 'IT-2025-0004',
       (SELECT id FROM asset_type WHERE name = 'Монитор'),
       'Samsung', 'ViewFinity S8', 'SN-SAM-004',
       '2025-04-01', 48000.00,
       (SELECT id FROM asset_status WHERE name = 'На складе'),
       'ООО ТехноМаркет', 'ОС-1-2025-0004'
WHERE NOT EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0004');

INSERT INTO asset (inventory_no, type_id, manufacturer, model, serial_number,
                   purchase_date, cost, status_id, vendor_name, receipt_act_no)
SELECT 'IT-2025-0005',
       (SELECT id FROM asset_type WHERE name = 'Ноутбук'),
       'Asus', 'ExpertBook B9', 'SN-ASUS-005',
       '2025-05-20', 110000.00,
       (SELECT id FROM asset_status WHERE name = 'На складе'),
       'ООО ДиджиталСнаб', 'ОС-1-2025-0005'
WHERE NOT EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0005');

-- Sequence counters для сгенерированных выше номеров
INSERT INTO sequence_counter(name, year, last_number) VALUES ('asset_it', 2025, 5)
    ON CONFLICT (name) DO NOTHING;
INSERT INTO sequence_counter(name, year, last_number) VALUES ('os1', 2025, 5)
    ON CONFLICT (name) DO NOTHING;

-- ПО с разными типами лицензий
INSERT INTO software (name, version, license_type_id, license_identifier,
                      license_start, license_end, license_status)
SELECT 'Windows 11 Pro',
       '23H2',
       (SELECT id FROM license_type WHERE name = 'OEM'),
       'XXXXX-XXXXX-XXXXX-XXXXX-WN11P',
       '2025-01-15', NULL, 'Активна'
WHERE NOT EXISTS (SELECT 1 FROM software WHERE name = 'Windows 11 Pro');

INSERT INTO software (name, version, license_type_id, license_identifier,
                      license_start, license_end, license_status)
SELECT 'Microsoft Office 365',
       '2024',
       (SELECT id FROM license_type WHERE name = 'Подписка'),
       'XXXXX-XXXXX-XXXXX-XXXXX-O365',
       '2025-01-01', '2026-01-01', 'Активна'
WHERE NOT EXISTS (SELECT 1 FROM software WHERE name = 'Microsoft Office 365');

INSERT INTO software (name, version, license_type_id, license_identifier,
                      license_start, license_end, license_status)
SELECT 'Kaspersky Endpoint Security',
       '12.0',
       (SELECT id FROM license_type WHERE name = 'Volume License'),
       'KES-VOL-2025-XXXXX',
       '2025-01-01', '2025-12-31', 'Истекает'
WHERE NOT EXISTS (SELECT 1 FROM software WHERE name = 'Kaspersky Endpoint Security');

INSERT INTO software (name, version, license_type_id, license_identifier,
                      license_start, license_end, license_status)
SELECT '7-Zip',
       '24.06',
       (SELECT id FROM license_type WHERE name = 'Бессрочная'),
       NULL,
       NULL, NULL, 'Активна'
WHERE NOT EXISTS (SELECT 1 FROM software WHERE name = '7-Zip');

INSERT INTO software (name, version, license_type_id, license_identifier,
                      license_start, license_end, license_status)
SELECT 'Adobe Acrobat Pro',
       '2024',
       (SELECT id FROM license_type WHERE name = 'Retail'),
       'ADOBE-ACR-2024-XXXXX',
       '2024-06-01', '2025-05-31', 'Истекла'
WHERE NOT EXISTS (SELECT 1 FROM software WHERE name = 'Adobe Acrobat Pro');

-- Seed-логи (actor = NULL, т.к. сотрудники создаются после миграций)
INSERT INTO system_log (logged_at, actor_employee_no, action, details)
VALUES
  (NOW() - INTERVAL '5 days', NULL, 'ASSET_CREATED', 'inventoryNo=IT-2025-0001; serial=SN-DELL-001'),
  (NOW() - INTERVAL '4 days', NULL, 'ASSET_CREATED', 'inventoryNo=IT-2025-0002; serial=SN-LENOVO-002'),
  (NOW() - INTERVAL '3 days', NULL, 'ASSET_CREATED', 'inventoryNo=IT-2025-0003; serial=SN-HP-003'),
  (NOW() - INTERVAL '2 days', NULL, 'SOFTWARE_CREATED', 'id=1; name=Windows 11 Pro'),
  (NOW() - INTERVAL '1 day',  NULL, 'SOFTWARE_CREATED', 'id=2; name=Microsoft Office 365');

-- Установить Windows и Office на ПК
INSERT INTO software_installation (asset_inventory_no, software_id, installed_at)
SELECT 'IT-2025-0001',
       (SELECT id FROM software WHERE name = 'Windows 11 Pro'),
       NOW()
WHERE EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0001')
  AND EXISTS (SELECT 1 FROM software WHERE name = 'Windows 11 Pro')
  AND NOT EXISTS (SELECT 1 FROM software_installation
                 WHERE asset_inventory_no = 'IT-2025-0001'
                   AND software_id = (SELECT id FROM software WHERE name = 'Windows 11 Pro'));

INSERT INTO software_installation (asset_inventory_no, software_id, installed_at)
SELECT 'IT-2025-0001',
       (SELECT id FROM software WHERE name = 'Microsoft Office 365'),
       NOW()
WHERE EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0001')
  AND EXISTS (SELECT 1 FROM software WHERE name = 'Microsoft Office 365')
  AND NOT EXISTS (SELECT 1 FROM software_installation
                 WHERE asset_inventory_no = 'IT-2025-0001'
                   AND software_id = (SELECT id FROM software WHERE name = 'Microsoft Office 365'));

INSERT INTO software_installation (asset_inventory_no, software_id, installed_at)
SELECT 'IT-2025-0002',
       (SELECT id FROM software WHERE name = 'Windows 11 Pro'),
       NOW()
WHERE EXISTS (SELECT 1 FROM asset WHERE inventory_no = 'IT-2025-0002')
  AND EXISTS (SELECT 1 FROM software WHERE name = 'Windows 11 Pro')
  AND NOT EXISTS (SELECT 1 FROM software_installation
                 WHERE asset_inventory_no = 'IT-2025-0002'
                   AND software_id = (SELECT id FROM software WHERE name = 'Windows 11 Pro'));
