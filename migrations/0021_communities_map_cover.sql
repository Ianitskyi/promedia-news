-- One-time editorial update (2026-11-18): new illustrated cover for the «Карта медійних спільнот» project.
-- Applies only if exactly one project matches; later admin choices stay authoritative.
CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY);
UPDATE projects
SET cover_image_url = '/img/projects/karta-spilnot-cover.jpg',
    cover_crop_data = '{}', cover_image_url_en = NULL, cover_crop_data_en = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT id FROM projects WHERE deleted_at IS NULL AND (title LIKE '%арт%спільнот%' OR lower(coalesce(title_en,'')) LIKE '%communit%map%' OR lower(coalesce(title_en,'')) LIKE '%map of%communit%'))
  AND (SELECT COUNT(*) FROM (SELECT id FROM projects WHERE deleted_at IS NULL AND (title LIKE '%арт%спільнот%' OR lower(coalesce(title_en,'')) LIKE '%communit%map%' OR lower(coalesce(title_en,'')) LIKE '%map of%communit%'))) = 1
  AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = 'communities_map_cover_20261118');
INSERT OR IGNORE INTO editorial_data_fixes (name)
SELECT 'communities_map_cover_20261118'
WHERE EXISTS (SELECT 1 FROM projects WHERE cover_image_url = '/img/projects/karta-spilnot-cover.jpg');
SELECT id, slug, title, cover_image_url FROM projects WHERE id IN (SELECT id FROM projects WHERE deleted_at IS NULL AND (title LIKE '%арт%спільнот%' OR lower(coalesce(title_en,'')) LIKE '%communit%map%' OR lower(coalesce(title_en,'')) LIKE '%map of%communit%'));
