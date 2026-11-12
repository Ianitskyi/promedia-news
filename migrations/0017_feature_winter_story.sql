-- One-time editorial update; later admin choices must stay authoritative.
CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY);
UPDATE articles SET card_style = 'hero'
WHERE slug = 'ahead-of-ukraines-most-difficult-winter-ukrainian-media-are-trying-to-survive-an'
  AND status = 'published' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = 'winter_feature_20261112');
INSERT OR IGNORE INTO editorial_data_fixes (name)
SELECT 'winter_feature_20261112' WHERE EXISTS (
  SELECT 1 FROM articles WHERE slug = 'ahead-of-ukraines-most-difficult-winter-ukrainian-media-are-trying-to-survive-an'
  AND card_style = 'hero' AND status = 'published' AND deleted_at IS NULL
);
