-- Головна новина (card_style = 'hero', велике фото на першому екрані) — лише одна (28.11.2026).
-- Лишаємо ту, що зараз стоїть на першому екрані (найсвіжіша серед опублікованих головних),
-- з інших знімаємо позначку. «Важливі» (is_important) не чіпаємо.
-- Повторний запуск безпечний: коли головна одна, запит нічого не змінює.
UPDATE articles SET card_style = 'auto'
WHERE card_style = 'hero' AND status = 'published'
  AND id <> (
    SELECT id FROM articles
    WHERE card_style = 'hero' AND status = 'published' AND deleted_at IS NULL
    ORDER BY published_at DESC, id DESC LIMIT 1
  );
