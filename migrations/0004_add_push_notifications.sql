CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  lang TEXT,
  origin TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  disabled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON push_subscriptions(disabled_at, lang, updated_at);

CREATE TABLE IF NOT EXISTS push_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_uk TEXT NOT NULL,
  body_uk TEXT NOT NULL,
  title_en TEXT,
  body_en TEXT,
  url TEXT,
  target_lang TEXT NOT NULL DEFAULT 'all',
  sent_at TEXT NOT NULL,
  attempted INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_messages_sent
  ON push_messages(target_lang, sent_at);
