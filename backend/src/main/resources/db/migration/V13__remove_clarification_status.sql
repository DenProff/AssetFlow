-- Перевести заявки в статусе "Требует уточнения" в "В работе"
UPDATE ticket
SET status_id = (SELECT id FROM ticket_status WHERE name = 'В работе')
WHERE status_id = (SELECT id FROM ticket_status WHERE name = 'Требует уточнения');

-- Удалить статус
DELETE FROM ticket_status WHERE name = 'Требует уточнения';
