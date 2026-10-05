ALTER TABLE articles ADD COLUMN deleted_at TEXT;

CREATE INDEX idx_articles_deleted_at ON articles(deleted_at);
