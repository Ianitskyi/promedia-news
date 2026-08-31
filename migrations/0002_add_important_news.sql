ALTER TABLE articles ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0 CHECK (is_important IN (0, 1));

CREATE INDEX idx_articles_important_published
  ON articles(is_important, status, published_at DESC);
