-- Закріплена новина (📌) шукається на кожному показі головної: без індексу D1 перебирав усю таблицю.
CREATE INDEX IF NOT EXISTS idx_articles_pinned ON articles(pinned_at) WHERE pinned_at IS NOT NULL;
