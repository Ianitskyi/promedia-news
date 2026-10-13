#!/usr/bin/env python3
"""Validate all D1 SQL migrations in an isolated SQLite database.

This test never connects to Cloudflare and cannot touch production data.
"""
from pathlib import Path
import sqlite3

db = sqlite3.connect(":memory:")
migrations = sorted(Path("migrations").glob("*.sql"))
assert migrations, "No database migrations found"

for migration in migrations:
    try:
        db.executescript(migration.read_text(encoding="utf-8"))
    except sqlite3.Error as exc:
        raise AssertionError(f"Migration {migration.name} failed: {exc}") from exc

def columns(table):
    return {row[1] for row in db.execute(f"PRAGMA table_info({table})")}

assert {"cover_crop_data", "cover_crop_data_en"} <= columns("articles")
assert {"cover_image_url_en", "cover_crop_data", "cover_crop_data_en"} <= columns("projects")

db.execute("INSERT INTO users (email,password_hash,name,role) VALUES ('test@example.org','hash','Tester','admin')")
db.execute("""
INSERT INTO articles
(slug,title,excerpt,body_md,cover_image_url,cover_image_url_en,cover_crop_data,cover_crop_data_en,author_id)
VALUES (?,?,?,?,?,?,?,?,?)
""", (
    "test-article", "Тест", "Опис", "Текст", "/image.jpg", "/image-en.jpg",
    '{"feed":{"x":30,"y":70}}', '{"mobile":{"x":20,"y":50}}', 1
))
db.execute("""
INSERT INTO projects
(slug,title,cover_image_url,cover_image_url_en,cover_crop_data,cover_crop_data_en,author_id)
VALUES (?,?,?,?,?,?,?)
""", (
    "test-project", "Проєкт", "/project.jpg", "/project-en.jpg",
    '{"feed":{"x":75,"y":35}}', '{"mobile":{"x":25,"y":40}}', 1
))
assert db.execute("SELECT cover_crop_data_en FROM articles WHERE slug='test-article'").fetchone()[0]
assert db.execute("SELECT cover_image_url_en FROM projects WHERE slug='test-project'").fetchone()[0] == "/project-en.jpg"
print(f"Success: {len(migrations)} SQL migrations, articles and projects insert/read verified.")
