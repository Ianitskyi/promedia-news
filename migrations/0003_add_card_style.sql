ALTER TABLE articles ADD COLUMN card_style TEXT NOT NULL DEFAULT 'auto'
  CHECK (card_style IN ('auto', 'hero', 'image', 'text'));

CREATE INDEX idx_articles_card_style_published
  ON articles(card_style, status, published_at DESC);
