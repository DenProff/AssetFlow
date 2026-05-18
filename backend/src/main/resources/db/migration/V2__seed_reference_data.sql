INSERT INTO role(name) VALUES
('EMPLOYEE'),
('IT_SPECIALIST'),
('IT_MANAGER'),
('HR');

INSERT INTO asset_status(name) VALUES
('На складе'),
('Эксплуатация'),
('Ремонт'),
('Списано');

INSERT INTO ticket_status(name) VALUES
('Новая'),
('В работе'),
('Требует уточнения'),
('Выполнена'),
('Отклонена');

INSERT INTO license_type(name) VALUES
('OEM'),
('Retail'),
('Volume License'),
('Подписка'),
('Бессрочная');

INSERT INTO asset_type(name, default_useful_life_years) VALUES
('ПК', 5),
('Ноутбук', 4),
('Принтер', 5);
