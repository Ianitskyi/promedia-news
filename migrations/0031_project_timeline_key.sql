-- Позначка «Важливий на таймлайні» для сторінки «Про нас» (рішення редактора 24.11.2026).
ALTER TABLE projects ADD COLUMN is_key INTEGER NOT NULL DEFAULT 0;
UPDATE projects SET is_key = 1 WHERE slug IN (
  'journalism-program-ranking',
  'map-of-ukrainian-media-communities',
  'media-atlas',
  'servis-z-faktchekinhu-proof-na-zamovlennia-irrp'
);
