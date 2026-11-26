-- Матеріали рубрики «Статті» не позначаються як «Важлива новина», щоб їхні заголовки
-- не ставали помаранчевими (прохання редактора 26.11.2026). Виконується один раз.
CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY);
UPDATE articles SET is_important = 0,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_important = 1
  AND json_valid(tags)
  AND EXISTS (SELECT 1 FROM json_each(articles.tags) WHERE json_each.value = 'Статті')
  AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = '0033_articles_rubric_not_important');
INSERT OR IGNORE INTO editorial_data_fixes (name) VALUES ('0033_articles_rubric_not_important');
