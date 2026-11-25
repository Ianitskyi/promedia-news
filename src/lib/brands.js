// Дані розділу «Медіабренди» для новин: тег новини з назвою медіа підтягує коротке досьє бренду.
// Сам індекс генерує `node brands-site/build.mjs --index-only` з brands/data/*.json.
export { BRANDS } from "../data/brands-index.js";

// Адреса сайту досьє (воркер promedia-brands, субдомен прив'язується в brands-site/wrangler.toml).
// Порожній рядок вимикає блок «Медіабренди в матеріалі» під новинами; латинські назви брендів у тегах працюють і без нього.
export const BRANDS_SITE_URL = "https://brands.promedia.report";
