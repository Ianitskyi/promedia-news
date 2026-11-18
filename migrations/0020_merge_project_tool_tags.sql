-- Merge the project tag «інструмент» into «інструменти» (one tag, Nov 2026).
-- Idempotent: rewrites only rows that still contain the singular form; keeps tag order, drops duplicates.
UPDATE projects
SET tags = (
  SELECT json_group_array(t) FROM (
    SELECT CASE WHEN trim(value) IN ('інструмент', 'Інструмент') THEN 'інструменти' ELSE value END AS t,
           MIN(CAST(key AS INTEGER)) AS k
    FROM json_each(projects.tags)
    GROUP BY t
    ORDER BY k
  )
),
updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE json_valid(tags)
  AND EXISTS (SELECT 1 FROM json_each(projects.tags) WHERE trim(value) IN ('інструмент', 'Інструмент'));
