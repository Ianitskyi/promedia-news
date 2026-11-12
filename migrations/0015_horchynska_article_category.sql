-- Correct only the category; keep every other tag and all article content.
UPDATE articles
SET tags = (SELECT json_group_array(value) FROM
  (SELECT DISTINCT CASE WHEN value = 'Новини' THEN 'Статті' ELSE value END AS value
   FROM json_each(articles.tags))),
    updated_at = datetime('now')
WHERE slug = 'vy-nedostatno-boitesia-katia-horchynska-pro-shi-ta-media'
  AND json_valid(tags)
  AND EXISTS (SELECT 1 FROM json_each(articles.tags) WHERE value = 'Новини');
