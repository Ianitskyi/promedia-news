-- Communities map cover: people with speech bubbles (chosen 2026-11-18).
UPDATE projects SET cover_image_url = '/img/projects/karta-spilnot-cover-v4.jpg',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE cover_image_url LIKE '/img/projects/karta-spilnot-cover%';
UPDATE projects SET cover_image_url_en = '/img/projects/karta-spilnot-cover-v4.jpg'
WHERE cover_image_url_en LIKE '/img/projects/karta-spilnot-cover%';
