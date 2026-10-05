CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  excerpt TEXT NOT NULL DEFAULT '',
  excerpt_en TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_md_en TEXT,
  cover_image_url TEXT,
  partner TEXT,
  partner_en TEXT,
  donor TEXT,
  donor_en TEXT,
  project_status TEXT NOT NULL DEFAULT 'active' CHECK (project_status IN ('upcoming','active','completed')),
  start_date TEXT,
  end_date TEXT,
  website_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  is_featured INTEGER NOT NULL DEFAULT 0,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published')),
  author_id INTEGER NOT NULL REFERENCES users(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_publication ON projects(publication_status, published_at DESC);
CREATE INDEX idx_projects_status ON projects(project_status);
CREATE INDEX idx_projects_featured ON projects(is_featured, published_at DESC);
CREATE INDEX idx_projects_author ON projects(author_id);
