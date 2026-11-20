-- Новина про The Kyiv Independent лишається головною з фото на комп'ютері,
-- а на смартфоні — без фото (прохання редактора 20.11.2026). Виконується один раз.
CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY);
UPDATE articles SET cover_crop_data = json_set(CASE WHEN json_valid(cover_crop_data) THEN cover_crop_data ELSE '{}' END, '$.hideMobile', json('true')),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'yak-the-kyiv-independent-zaluchylo-37-5-tysiachi-donatoriv'
  AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = '0029_kyiv_independent_no_mobile_photo');
INSERT OR IGNORE INTO editorial_data_fixes (name) VALUES ('0029_kyiv_independent_no_mobile_photo');
