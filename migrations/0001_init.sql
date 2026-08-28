CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('admin', 'author')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  excerpt TEXT NOT NULL DEFAULT '',
  excerpt_en TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_md_en TEXT,
  cover_image_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  related_media_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id INTEGER NOT NULL REFERENCES users(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX idx_articles_author ON articles(author_id);
