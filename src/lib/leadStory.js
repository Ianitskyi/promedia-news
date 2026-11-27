// Головна новина (card_style = 'hero', велике фото на першому екрані) — лише одна серед
// опублікованих (правило Андрія Яніцького, 28.11.2026). Коли головною стає інша, попередня
// повертається у звичайну картку ('auto'). «Важлива» (is_important, помаранчевий заголовок) —
// окрема позначка, її це не стосується: важливих може бути багато.

export const RESET_OTHER_LEADS_BY_ID_SQL =
  "UPDATE articles SET card_style = 'auto' WHERE card_style = 'hero' AND status = 'published' AND id <> ?";

export const RESET_OTHER_LEADS_BY_SLUG_SQL =
  "UPDATE articles SET card_style = 'auto' WHERE card_style = 'hero' AND status = 'published' AND slug <> ?";

// Після того як стаття стала (чи лишилась) опублікованою головною — зняти позначку з інших.
export async function keepSingleLead(db, { id, slug }) {
  const where = id != null ? "id = ?" : "slug = ?";
  const key = id != null ? id : slug;
  const row = await db.prepare(`SELECT card_style, status FROM articles WHERE ${where} AND deleted_at IS NULL`).bind(key).first();
  if (!row || row.card_style !== "hero" || row.status !== "published") return false;
  await db.prepare(id != null ? RESET_OTHER_LEADS_BY_ID_SQL : RESET_OTHER_LEADS_BY_SLUG_SQL).bind(key).run();
  return true;
}
