// Закріплення новини (📌) завжди має термін — правило Андрія Яніцького, 28.11.2026.
// Термін задаємо датою: новина висить закріпленою до кінця цього дня за київським часом
// (тобто зникає о 00:00 наступного дня). Якщо дату не вказали — 5 днів від сьогодні.
// Безстрокового закріплення немає: навіть старий запис без pinned_until діє лише 5 днів
// від моменту закріплення.

export const PIN_TIME_ZONE = "Europe/Kyiv";
export const DEFAULT_PIN_DAYS = 5;

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
// Кінець закріплення: pinned_until, а для старих записів без нього — pinned_at + 5 днів.
const PIN_END_SQL = (p) => `COALESCE(${p}pinned_until, strftime('%Y-%m-%dT%H:%M:%fZ', ${p}pinned_at, '+${DEFAULT_PIN_DAYS} days'))`;

// Умова «закріплення ще діє» для WHERE/ORDER BY. prefix — псевдонім таблиці з крапкою, напр. "a.".
export function pinActiveSql(prefix = "") {
  return `(${prefix}pinned_at IS NOT NULL AND ${PIN_END_SQL(prefix)} > ${NOW_SQL})`;
}

// Для SELECT: pinned_at лише якщо закріплення ще діє, інакше NULL —
// тоді решта коду (рендер, API) просто не бачить простроченого закріплення.
export function pinnedAtSelectSql(prefix = "") {
  return `CASE WHEN ${pinActiveSql(prefix)} THEN ${prefix}pinned_at END AS pinned_at`;
}

// Зсув часового поясу Києва (у хвилинах) у заданий момент: +120 узимку, +180 улітку.
function kyivOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: PIN_TIME_ZONE, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(date).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

// Сьогоднішня дата в Києві: "YYYY-MM-DD".
export function kyivDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Дата за замовчуванням: сьогодні + 5 днів (закріпили 28.11 — висить до кінця 03.12).
export function defaultPinDate(now = new Date()) {
  return addDays(kyivDate(now), DEFAULT_PIN_DAYS);
}

// Момент (UTC ISO), коли закінчується день dateStr за київським часом, тобто 00:00 наступного дня.
export function kyivDayEndUtc(dateStr) {
  const next = addDays(dateStr, 1);
  const [y, m, d] = next.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  let offset = kyivOffsetMinutes(new Date(naive));
  // Уточнюємо зсув на сам момент (на випадок переходу на літній/зимовий час).
  offset = kyivOffsetMinutes(new Date(naive - offset * 60000));
  return new Date(naive - offset * 60000).toISOString();
}

// Київська дата, до кінця якої діє закріплення (для показу в адмінці й API).
export function pinUntilDate(row) {
  if (!row || !row.pinned_at) return null;
  const end = row.pinned_until || new Date(new Date(row.pinned_at).getTime() + DEFAULT_PIN_DAYS * 86400000).toISOString();
  // Мінус 1 мс: кінець дня 04.12 — це 00:00 05.12, а показати треба 04.12.
  return kyivDate(new Date(new Date(end).getTime() - 1));
}

export function isPinActive(row, now = new Date()) {
  if (!row || !row.pinned_at) return false;
  const end = row.pinned_until || new Date(new Date(row.pinned_at).getTime() + DEFAULT_PIN_DAYS * 86400000).toISOString();
  return end > now.toISOString();
}

// Перевіряє дату з адмінки чи JSON. Повертає { until } (UTC ISO) або { error }.
// Без дати — 5 днів від сьогодні. Дата в минулому не приймається.
export function resolvePinUntil(dateStr, now = new Date()) {
  const value = (dateStr == null || dateStr === "") ? defaultPinDate(now) : String(dateStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || addDays(value, 0) !== value) {
    return { error: "Дата закріплення має бути у форматі РРРР-ММ-ДД" };
  }
  if (value < kyivDate(now)) return { error: "Дата закріплення вже минула" };
  return { until: kyivDayEndUtc(value), date: value };
}
