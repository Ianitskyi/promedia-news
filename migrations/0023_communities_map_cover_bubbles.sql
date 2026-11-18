-- Communities map cover: speech bubbles instead of dots, so it differs from the Atlas cover (2026-11-18).
UPDATE projects SET cover_image_url = '/img/projects/karta-spilnot-cover-v3.jpg',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE cover_image_url IN ('/img/projects/karta-spilnot-cover.jpg', '/img/projects/karta-spilnot-cover-v2.jpg');
UPDATE projects SET cover_image_url_en = '/img/projects/karta-spilnot-cover-v3.jpg'
WHERE cover_image_url_en IN ('/img/projects/karta-spilnot-cover.jpg', '/img/projects/karta-spilnot-cover-v2.jpg');
