-- 1. Справочник амортизационных групп (НК РФ, ст. 258)
CREATE TABLE amortization_group (
    group_no             SMALLINT    PRIMARY KEY,
    description          VARCHAR(200) NOT NULL,
    min_useful_life_months INTEGER NOT NULL,
    max_useful_life_months INTEGER         -- NULL = без ограничения
);

INSERT INTO amortization_group(group_no, description, min_useful_life_months, max_useful_life_months) VALUES
(1,  'Первая группа (1–2 года)',       13,  24),
(2,  'Вторая группа (2–3 года)',       25,  36),
(3,  'Третья группа (3–5 лет)',        37,  60),
(4,  'Четвёртая группа (5–7 лет)',     61,  84),
(5,  'Пятая группа (7–10 лет)',        85,  120),
(6,  'Шестая группа (10–15 лет)',      121, 180),
(7,  'Седьмая группа (15–20 лет)',     181, 240),
(8,  'Восьмая группа (20–25 лет)',     241, 300),
(9,  'Девятая группа (25–30 лет)',     301, 360),
(10, 'Десятая группа (свыше 30 лет)', 361, NULL);

-- 2. Справочник ОКОФ (общероссийский классификатор основных фондов)
CREATE TABLE okof (
    code                  VARCHAR(32)  PRIMARY KEY,
    name                  VARCHAR(256) NOT NULL,
    amortization_group_no SMALLINT     NOT NULL
        REFERENCES amortization_group(group_no)
);

INSERT INTO okof(code, name, amortization_group_no) VALUES
('320.26.20.11', 'Компьютеры персональные (стационарные)',          2),
('320.26.20.13', 'Ноутбуки и портативные компьютеры',               2),
('320.26.20.14', 'Планшетные компьютеры',                           2),
('320.26.20.15', 'Серверы',                                         3),
('320.26.20.16', 'Мониторы и проекторы',                            2),
('320.26.30.20', 'Сетевое и коммуникационное оборудование',         3),
('320.28.23.23', 'Принтеры, МФУ, сканеры',                         3),
('330.28.23.21', 'Офисная техника (копиры, факсы)',                 3),
('320.26.20.60', 'Накопители данных (SAN/NAS)',                     3),
('330.28.23.13', 'Источники бесперебойного питания (ИБП)',          3);

-- 3. Привязать asset_type.okof_code к таблице okof как FK
--    Существующие строки с кодами не из окоф-справочника обнуляем
UPDATE asset_type SET okof_code = NULL
WHERE okof_code IS NOT NULL AND okof_code NOT IN (SELECT code FROM okof);

ALTER TABLE asset_type
    ADD CONSTRAINT fk_asset_type_okof FOREIGN KEY (okof_code) REFERENCES okof(code);

-- 4. Транзитивная зависимость устранена — удаляем избыточную колонку
ALTER TABLE asset_type DROP COLUMN amortization_group_no;
