-- Replace the communities map cover with a corrected map that includes Crimea (2026-11-18).
UPDATE projects SET cover_image_url = '/img/projects/karta-spilnot-cover-v2.jpg',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE cover_image_url = '/img/projects/karta-spilnot-cover.jpg';
UPDATE projects SET cover_image_url_en = '/img/projects/karta-spilnot-cover-v2.jpg'
WHERE cover_image_url_en = '/img/projects/karta-spilnot-cover.jpg';
