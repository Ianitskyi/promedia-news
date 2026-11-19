-- Повертаємо «З фото на першій» інтерв'ю з Жанною Безп'ятчук: позначку зняв скрипт,
-- коли головною стала новина про The Kyiv Independent (19.11.2026). Виконується один раз.
CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY);
UPDATE articles SET card_style = 'hero', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'vid-vvs-do-suspilnoho-zhanna-bezpiatchuk-pro-mizhnarodnu-zhurnalistyku'
  AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = '0028_zhanna_bezpiatchuk_hero_restore');
INSERT OR IGNORE INTO editorial_data_fixes (name) VALUES ('0028_zhanna_bezpiatchuk_hero_restore');
