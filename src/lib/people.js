// Дані розділу «Люди» для новин: тег новини з іменем людини підтягує її коротке досьє.
// Сам індекс генерує `node people-site/build.mjs --index-only` з people/data/*.json.
export { PEOPLE } from "../data/people-index.js";

// Адреса сайту досьє. Поки субдомен не прив'язано, лишаємо порожньою —
// тоді блок «Люди в матеріалі» не показується, а теги з іменами вже працюють.
// Після прив'язки: "https://people.promedia.report".
export const PEOPLE_SITE_URL = "";
