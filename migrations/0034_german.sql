-- Німецька мова (26.11.2026): переклади новин і проєктів робить автоматично src/lib/translateDe.js.
-- *_de_at — коли зроблено переклад; якщо updated_at пізніше, текст перекладається наново.
-- У production колонки додає scripts/ensure-german-columns.mjs (повторний запуск безпечний).
ALTER TABLE articles ADD COLUMN title_de TEXT;
ALTER TABLE articles ADD COLUMN excerpt_de TEXT;
ALTER TABLE articles ADD COLUMN body_md_de TEXT;
ALTER TABLE articles ADD COLUMN de_translated_at TEXT;
ALTER TABLE projects ADD COLUMN title_de TEXT;
ALTER TABLE projects ADD COLUMN excerpt_de TEXT;
ALTER TABLE projects ADD COLUMN body_md_de TEXT;
ALTER TABLE projects ADD COLUMN work_md_de TEXT;
ALTER TABLE projects ADD COLUMN results_md_de TEXT;
ALTER TABLE projects ADD COLUMN partner_de TEXT;
ALTER TABLE projects ADD COLUMN donor_de TEXT;
ALTER TABLE projects ADD COLUMN period_label_de TEXT;
ALTER TABLE projects ADD COLUMN de_translated_at TEXT;
