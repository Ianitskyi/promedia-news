-- Cached GA4 screenPageViews. Article text and publication dates are untouched.
CREATE TABLE IF NOT EXISTS article_views (
  article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  ga4_views INTEGER NOT NULL CHECK (ga4_views >= 0),
  synced_at TEXT NOT NULL
);
