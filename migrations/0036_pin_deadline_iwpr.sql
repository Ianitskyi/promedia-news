-- Закріплення тепер завжди з терміном (правило Андрія Яніцького, 28.11.2026).
-- Новина про воркшоп IWPR (заявки до 4 грудня) висить закріпленою до кінця 4 грудня за Києвом,
-- тобто до 00:00 5 грудня = 2026-12-04T22:00:00Z. Повторний запуск нічого не змінює:
-- оновлюємо лише якщо термін ще не задано.
UPDATE articles SET pinned_until = '2026-12-04T22:00:00.000Z'
WHERE slug = 'yak-vidstezhuvaty-hroshi-na-vidnovlennia-vorkshop-iwpr-lviv'
  AND pinned_at IS NOT NULL AND pinned_until IS NULL;
