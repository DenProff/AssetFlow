-- Привязываем существующие типы оборудования к кодам ОКОФ
UPDATE asset_type SET okof_code = '320.26.20.11', default_useful_life_years = 3 WHERE name = 'ПК';
UPDATE asset_type SET okof_code = '320.26.20.13', default_useful_life_years = 3 WHERE name = 'Ноутбук';
UPDATE asset_type SET okof_code = '320.28.23.23', default_useful_life_years = 5 WHERE name = 'Принтер';

-- Добавляем несколько распространённых типов сразу с ОКОФ
INSERT INTO asset_type(name, default_useful_life_years, okof_code) VALUES
('Монитор',            3, '320.26.20.16'),
('Сервер',             5, '320.26.20.15'),
('Сетевое оборудование', 5, '320.26.30.20'),
('МФУ / Сканер',       5, '320.28.23.23'),
('ИБП',                5, '330.28.23.13'),
('Планшет',            3, '320.26.20.14')
ON CONFLICT (name) DO NOTHING;
