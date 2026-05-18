-- Seed-логи (идемпотентно: добавляем только если таблица пустая)
INSERT INTO system_log (logged_at, actor_employee_no, action, details)
SELECT ts, actor, action, details FROM (VALUES
  (NOW() - INTERVAL '10 days', NULL::varchar, 'ASSET_CREATED', 'inventoryNo=IT-2025-0001; serial=SN-DELL-001'),
  (NOW() - INTERVAL '10 days', NULL::varchar, 'ASSET_CREATED', 'inventoryNo=IT-2025-0002; serial=SN-LENOVO-002'),
  (NOW() - INTERVAL '9 days',  NULL::varchar, 'ASSET_CREATED', 'inventoryNo=IT-2025-0003; serial=SN-HP-003'),
  (NOW() - INTERVAL '9 days',  NULL::varchar, 'ASSET_CREATED', 'inventoryNo=IT-2025-0004; serial=SN-SAM-004'),
  (NOW() - INTERVAL '8 days',  NULL::varchar, 'ASSET_CREATED', 'inventoryNo=IT-2025-0005; serial=SN-ASUS-005'),
  (NOW() - INTERVAL '7 days',  NULL::varchar, 'SOFTWARE_CREATED', 'id=1; name=Windows 11 Pro'),
  (NOW() - INTERVAL '7 days',  NULL::varchar, 'SOFTWARE_CREATED', 'id=2; name=Microsoft Office 365'),
  (NOW() - INTERVAL '6 days',  NULL::varchar, 'SOFTWARE_CREATED', 'id=3; name=Kaspersky Endpoint Security'),
  (NOW() - INTERVAL '6 days',  NULL::varchar, 'SOFTWARE_CREATED', 'id=4; name=7-Zip'),
  (NOW() - INTERVAL '5 days',  NULL::varchar, 'SOFTWARE_CREATED', 'id=5; name=Adobe Acrobat Pro'),
  (NOW() - INTERVAL '4 days',  NULL::varchar, 'SOFTWARE_INSTALLED', 'softwareId=1; asset=IT-2025-0001'),
  (NOW() - INTERVAL '4 days',  NULL::varchar, 'SOFTWARE_INSTALLED', 'softwareId=2; asset=IT-2025-0001'),
  (NOW() - INTERVAL '3 days',  NULL::varchar, 'SOFTWARE_INSTALLED', 'softwareId=1; asset=IT-2025-0002')
) AS v(ts, actor, action, details)
WHERE NOT EXISTS (SELECT 1 FROM system_log LIMIT 1);
