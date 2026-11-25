import { escapeHtml, markdownToHtml, markdownToPlainText, inlineMarkdown } from "./markdown.js";
import { normalizeUkrainianQuotes, normalizeUkrainianTitle } from "./typography.js";
import { PEOPLE, PEOPLE_SITE_URL } from "./people.js";
import { TTS } from "../data/tts-index.js";

// Версія статичних файлів: міняємо при оновленні CSS/JS, щоб телефони не тримали стару копію з кешу.
const ASSET_V = "20261123b";

const LANGS = ["uk", "en", "crh"];

function pick(dict, lang) {
  return (dict && dict[lang] != null) ? dict[lang] : dict.uk;
}

// Мова — перший сегмент шляху, як на інших сайтах мережі: "" для uk,
// "/en" чи "/crh" для інших мов (/en/article/<slug>, /crh/?tag=…).
function langPrefix(lang) {
  return lang === "uk" ? "" : `/${lang}`;
}

const SITE_NAME = { uk: "Новини ПроМедіа", en: "ProMedia News", crh: "ProMedia haberleri" };
const SITE_TAGLINE = {
  uk: "Заяви від ГО «ПроМедіа», а також новини зі світу медіа, громадських організацій та комунікацій.",
  en: "Public statements, press releases and important updates from ProMedia NGO, along with news about communities, education, research and people working in media, civil society and communications.",
  crh: "ProMedia İCT'niñ beyanatları hem mediya, cemiyet teşkilâtları ve kommunikatsiyalar sahasındaki muhim haberleri."
};
const SITE_EYEBROW = {
  uk: "Про журналістику та громадський активізм в Україні",
  en: "About journalism and civic activism in Ukraine",
  crh: "Ukrayinada jurnalistika hem içtimaiy aktivizm aqqında"
};
const OG_LOCALE = { uk: "uk_UA", en: "en_US", crh: "crh_UA" };
const HTML_LOCALE_LABEL = { uk: "Мова / Language", en: "Мова / Language", crh: "Til / Language" };
const LANG_BUTTON_LABEL = { uk: "UA", en: "EN", crh: "QT" };
const CATEGORIES = ["Новини", "Статті", "Пресреліз", "Анонс"];
const DEFAULT_OG_IMAGE = "https://news.promedia.report/img/og-share.png";

const TAG_LABELS_EN = {
  "Сербія": "Serbia",
  "Александар Вучич": "Aleksandar Vučić",
  "економічна журналістика": "economic journalism",
  "Центр Мєрошевського": "Mieroszewski Centre",
  "Польща": "Poland",
  "Олена Граждан": "Olena Hrazhdan",
  "Юлія Самаєва": "Yuliia Samaieva",
  "Гліб Вишлінський": "Hlib Vyshlinskyi",
  "DELTA": "DELTA",
  "оборонні технології": "defence technology",
  "Міністерство оборони": "Ministry of Defence",
  "Німеччина": "Germany",
  "Норвегія": "Norway",
  "Кропивницький": "Kropyvnytskyi",
  "Доступ. Медіа": "Dostup.Media",
  "документальне кіно": "documentary film",
  "Ольга Черних": "Olha Chernykh",
  "релігія": "religion",
  "капелани": "chaplains",
  "комунікації": "communications",
  "фіксери": "fixers",
  "Атлас медіа": "Media Atlas",
  "реєстр медіа": "media register",
  "Нацрада": "National Council on Television and Radio",
  "Чехія": "Czech Republic",
  "Киргизстан": "Kyrgyzstan",
  "соцмережі": "social media",
  "суспільні медіа": "public service media",
  "свобода медіа": "media freedom",
  "Вечірничок": "Večerníček",
  "відеоігри": "video games",
  "медіабізнес": "media business",
  "НАБУ": "NABU (National Anti-Corruption Bureau)",
  "САП": "SAPO (Anti-Corruption Prosecutor's Office)",
  "антикорупція": "anti-corruption",
  "підзвітність влади": "government accountability",
  "Мідас": "Operation Midas",
  "Карфаген": "Carthage",
  "ПроМедіа": "ProMedia",
  "Швейцарія": "Switzerland",
  "банківська таємниця": "banking secrecy",
  "Таємний Санта": "Secret Santa",
  "бізнес-моделі медіа": "media business models",
  "Українська правда": "Ukrainska Pravda",
  "пейвол": "paywall",
  "Андрій Боборикін": "Andrii Boborykin",
  "Можливості": "Opportunities",
  "навчання": "training",
  "публічні фінанси": "public finance",
  "відновлення": "recovery",
  "вотчдоги": "watchdogs",
  "Львів": "Lviv",
  "стипендії": "fellowships",
  "Нідерланди": "Netherlands",
  "комунальні медіа": "municipal media",
  "Війна в об'єктиві": "War Through the Lens",
  "історія журналістики": "history of journalism",
  "воєнна журналістика": "war journalism",
  "фотожурналістика": "photojournalism",
  "ЄС": "EU",
  "санкції": "sanctions",
  "дезінформація": "disinformation",
  "Росія": "Russia",
  "свобода слова": "freedom of speech",
  "регулювання платформ": "platform regulation",
  "Близький Схід": "Middle East",
  "Одеса": "Odesa",
  "Миколаїв": "Mykolaiv",
  "Суми": "Sumy",
  "Революція Гідності": "Revolution of Dignity",
  "Премія імені Георгія Ґонґадзе": "Georgiy Gongadze Prize",
  "регіональні медіа": "regional media",
  "Перший міський": "Pershyi Miskyi (Odesa TV)",
  "Репортери без кордонів": "Reporters Without Borders",
  "Мексика": "Mexico",
  "Коста-Рика": "Costa Rica",
  "державна підтримка медіа": "state support for media",
  "прифронтові медіа": "frontline media",
  "Мінкульт": "Ministry of Culture",
  "телемарафон": "TV marathon",
  "профспілки": "trade unions",
  "Пресреліз": "Press release",
  "Анонс": "Announcement",
  "Київ": "Kyiv",
  "медіа й бізнес": "media and business",
  "Ексклюзив": "Exclusive",
  "Заяви": "Statements",
  "Новини": "News",
  "Статті": "Articles",
  "освіта": "education",
  "журналістська освіта": "journalism education",
  "вступ": "admissions",
  "рейтинг журфаків": "journalism schools ranking",
  "українські медіа": "Ukrainian media",
  "війна": "war",
  "безпека журналістів": "journalist safety",
  "екологічна журналістика": "environmental journalism",
  "ЮНЕСКО": "UNESCO",
  "Рубрика": "Rubryka",
  "дослідження": "research",
  "медіаграмотність": "media literacy",
  "штучний інтелект": "artificial intelligence",
  "дані": "data",
  "медіаспільноти": "media communities",
  "Львівський медіафорум": "Lviv Media Forum",
  "стійкість медіа": "media resilience",
  "державні комунікації": "public communications",
  "суспільство": "society",
  "військова реформа": "military reform",
  "інтерв’ю": "interview",
  "студенти": "students",
  "Україна": "Ukraine",
  "Японія": "Japan",
  "медійні спільноти": "media communities",
  "локальні медіа": "local media",
  "карта спільнот": "community map",
  "медіаправо": "media law",
  "Верховна Рада": "Verkhovna Rada",
  "доступ журналістів": "journalist access",
  "парламент": "parliament",
  "фактчекінг": "fact-checking",
  "журналістські розслідування": "investigative journalism",
  "ІРРП": "RPDI",
  "Суспільне": "Suspilne",
  "державний бюджет": "state budget",
  "медіаполітика": "media policy",
  "незалежні медіа": "independent media",
  "членство": "membership",
  "Велика Британія": "United Kingdom",
  "Чернігів": "Chernihiv",
  "Індонезія": "Indonesia",
  "авторське право": "copyright",
  "Канада": "Canada",
  "місцеві медіа": "local media",
  "фінансування медіа": "media funding",
  "книжки": "books",
  "дрони": "drones",
  "Білорусь": "Belarus",
  "політв'язні": "political prisoners",
  "цифрова безпека": "digital security",
  "Наука про медіа": "Media Science",
  "фриланс": "freelancing",
  "умови праці": "working conditions",
  "США": "United States",
  "власність медіа": "media ownership",
  "редакційна незалежність": "editorial independence",
  "Ілон Маск": "Elon Musk",
  "Джефф Безос": "Jeff Bezos",
  "бойкоти": "boycotts",
  "PEN America": "PEN America",
  "Український ПЕН": "PEN Ukraine",
  "Газа": "Gaza",
  "Ізраїль": "Israel",
  "Дінау Менгесту": "Dinaw Mengestu",
  "Маша Гессен": "Masha Gessen",
  "Юрій Винничук": "Yuriy Vynnychuk",
  "шпигунські програми": "spyware",
  "Міжнародна федерація журналістів": "International Federation of Journalists",
  "Зуліана Лайнес": "Zuliana Lainez",
  "Ентоні Белланже": "Anthony Bellanger",
  "Танасіс Кукакіс": "Thanasis Koukakis",
  "Ельсі Муфаррідж": "Elsy Moufarrej",
  "Амаль Халіль": "Amal Khalil"
};

// Crimean Tatar interface labels use the modern Latin orthography and the shared
// editorial terminology standard. Content translations receive a separate source-based check.
const TAG_LABELS_CRH = {
  "Сербія": "Serbiya",
  "Александар Вучич": "Aleksandar Vučić",
  "економічна журналістика": "iqtisadiy jurnalistika",
  "Центр Мєрошевського": "Mieroszewski Merkezi",
  "Польща": "Polşa",
  "Олена Граждан": "Olena Hrazhdan",
  "Юлія Самаєва": "Yuliia Samaieva",
  "Гліб Вишлінський": "Hlib Vyshlinskyi",
  "DELTA": "DELTA",
  "оборонні технології": "mudafaa texnologiyaları",
  "Міністерство оборони": "Mudafaa nazirligi",
  "Німеччина": "Almaniya",
  "Норвегія": "Norvegiya",
  "Кропивницький": "Kropyvnytskyi",
  "Доступ. Медіа": "Dostup. Media",
  "документальне кіно": "vesiqalı kino",
  "Ольга Черних": "Olha Chernykh",
  "релігія": "din",
  "капелани": "kapellanlar",
  "комунікації": "kommunikatsiyalar",
  "фіксери": "fikserler",
  "Атлас медіа": "Medya Atlası",
  "реєстр медіа": "medya reyestri",
  "Нацрада": "Milliy Televideniye ve Radio Şurası",
  "Чехія": "Çehiya",
  "Киргизстан": "Qırğızistan",
  "соцмережі": "sotsial şebekeler",
  "суспільні медіа": "cemaatçilik medyası",
  "свобода медіа": "medya serbestligi",
  "Вечірничок": "Večerníček",
  "відеоігри": "video oyunlar",
  "медіабізнес": "medya biznesi",
  "НАБУ": "NABU",
  "САП": "SAP",
  "антикорупція": "korruptsiyağa qarşı küreş",
  "підзвітність влади": "akimiyetniñ esap berüvi",
  "Мідас": "«Midas» işi",
  "Карфаген": "Karfagen",
  "ПроМедіа": "ProMedia",
  "Швейцарія": "İsveçriya",
  "банківська таємниця": "bank sırı",
  "Таємний Санта": "Gizli Santa",
  "бізнес-моделі медіа": "medya biznes-modelleri",
  "Українська правда": "Ukrainska Pravda",
  "пейвол": "paywall",
  "Андрій Боборикін": "Andrii Boborykin",
  "Можливості": "İmkânlar",
  "навчання": "tahsil",
  "публічні фінанси": "umumiy maliye",
  "відновлення": "tiklenüv",
  "вотчдоги": "votçdoglar",
  "Львів": "Lviv",
  "стипендії": "stipendiyalar",
  "Нідерланди": "Niderlandlar",
  "комунальні медіа": "munitsipal medya",
  "Війна в об'єктиві": "Obyektivde cenk",
  "історія журналістики": "jurnalistika tarihı",
  "воєнна журналістика": "cenk jurnalistikası",
  "фотожурналістика": "fotojurnalistika",
  "ЄС": "AB",
  "санкції": "sanktsiyalar",
  "дезінформація": "dezinformatsiya",
  "Росія": "Rusiye",
  "свобода слова": "söz serbestligi",
  "регулювання платформ": "platformalarnı tertipleştirüv",
  "Близький Схід": "Yaqın Şarq",
  "Одеса": "Odessa",
  "Миколаїв": "Mykolaiv",
  "Суми": "Sumı",
  "Революція Гідності": "Revolütsiya Dostlığı",
  "Премія імені Георгія Ґонґадзе": "Georgiy Gongadze mukâfatı",
  "регіональні медіа": "regional mediya",
  "Перший міський": "Perşıy Miskıy",
  "Репортери без кордонів": "Sıñırsız muhbirler",
  "Мексика": "Meksika",
  "Коста-Рика": "Kosta-Rika",
  "державна підтримка медіа": "devlet medya destegi",
  "прифронтові медіа": "cebe yanı medya",
  "Мінкульт": "Medeniyet nazirligi",
  "телемарафон": "telemarafon",
  "профспілки": "kasaba birlikleri",
  "Пресреліз": "Basın bildirisi",
  "Анонс": "İlân",
  "Київ": "Kyiv",
  "медіа й бізнес": "mediya ve biznes",
  "Ексклюзив": "Eksklüziv",
  "Заяви": "Beyanatlar",
  "Новини": "Haberler",
  "Статті": "Maqaleler",
  "освіта": "maarif",
  "журналістська освіта": "jurnalistika maarifi",
  "вступ": "qabul",
  "рейтинг журфаків": "jurnalistika fakülteleri reytingi",
  "українські медіа": "Ukrayina mediyası",
  "війна": "urış",
  "безпека журналістів": "jurnalistlerniñ emniyeti",
  "екологічна журналістика": "ekologiya jurnalistikası",
  "ЮНЕСКО": "YUNESKO",
  "Рубрика": "Rubryka",
  "дослідження": "tedqiqat",
  "медіаграмотність": "mediya savatlılığı",
  "штучний інтелект": "suniy zekâ",
  "дані": "malümat",
  "медіаспільноти": "mediya cemaatları",
  "Львівський медіафорум": "Lviv mediya forumı",
  "стійкість медіа": "mediyanıñ turaqlılığı",
  "державні комунікації": "devlet kommunikatsiyaları",
  "суспільство": "cemiyet",
  "військова реформа": "asker reformı",
  "інтерв’ю": "intervyu",
  "студенти": "talebeler",
  "Україна": "Ukrayina",
  "Японія": "Yaponiya",
  "медійні спільноти": "mediya cemaatları",
  "локальні медіа": "yerli mediya",
  "карта спільнот": "cemaatlar haritası",
  "медіаправо": "mediya huqoqı",
  "Верховна Рада": "Verhovna Rada",
  "доступ журналістів": "jurnalistlerniñ irişimi",
  "парламент": "parlament",
  "фактчекінг": "faktçeking",
  "журналістські розслідування": "jurnalist teftişleri",
  "ІРРП": "RPDI",
  "Суспільне": "Suspilne",
  "державний бюджет": "devlet byudjeti",
  "медіаполітика": "mediya siyaseti",
  "незалежні медіа": "müstaqil mediya",
  "членство": "azalıq",
  "Велика Британія": "Buyuk Britaniya",
  "Чернігів": "Çernihiv",
  "Індонезія": "İndoneziya",
  "авторське право": "müelliflik aqqı",
  "Канада": "Kanada",
  "місцеві медіа": "yerli mediya",
  "фінансування медіа": "mediyanı malieleştirüv",
  "книжки": "kitaplar",
  "дрони": "dronlar",
  "Білорусь": "Belarus",
  "політв'язні": "siyasiy mabüsler",
  "цифрова безпека": "dijital emniyet",
  "Наука про медіа": "Mediya aqqında ilim",
  "фриланс": "frilans",
  "умови праці": "iş şaraitleri",
  "США": "AQŞ",
  "власність медіа": "mediya mülkiyeti",
  "редакційна незалежність": "redaktsiya mustaqilligi",
  "Ілон Маск": "Elon Musk",
  "Джефф Безос": "Jeff Bezos",
  "бойкоти": "boykotlar",
  "PEN America": "PEN America",
  "Український ПЕН": "Ukrain PEN-i",
  "Газа": "Gaza",
  "Ізраїль": "İsrail",
  "Дінау Менгесту": "Dinaw Mengestu",
  "Маша Гессен": "Masha Gessen",
  "Юрій Винничук": "Yuriy Vynnychuk",
  "шпигунські програми": "casus programmları",
  "Міжнародна федерація журналістів": "Halqara jurnalistler federatsiyası",
  "Зуліана Лайнес": "Zuliana Lainez",
  "Ентоні Белланже": "Anthony Bellanger",
  "Танасіс Кукакіс": "Thanasis Koukakis",
  "Ельсі Муфаррідж": "Elsy Moufarrej",
  "Амаль Халіль": "Amal Khalil"
};

function tagLookupKey(tag) {
  return String(tag || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("uk-UA");
}

const TAG_LABEL_LOOKUP = Object.fromEntries(
  [["en", TAG_LABELS_EN], ["crh", TAG_LABELS_CRH]].map(([lang, labels]) => [
    lang, Object.fromEntries(Object.entries(labels).map(([tag, label]) => [tagLookupKey(tag), label]))
  ])
);

// Люди з розділу «Люди» (people.promedia.report): тег новини = ім'я та прізвище людини.
// typeof — щоб модуль працював і в тестах, які підставляють залежності вручну.
const PEOPLE_LIST = typeof PEOPLE !== "undefined" && Array.isArray(PEOPLE) ? PEOPLE : [];
const PEOPLE_BASE_URL = typeof PEOPLE_SITE_URL !== "undefined" ? PEOPLE_SITE_URL : "";
const PEOPLE_BY_TAG = new Map();
for (const person of PEOPLE_LIST) {
  for (const name of [person.tag, ...(person.aliases || [])]) PEOPLE_BY_TAG.set(tagLookupKey(name), person);
}
function personForTag(tag) {
  return PEOPLE_BY_TAG.get(tagLookupKey(tag)) || null;
}

function tagLabel(tag, lang) {
  const label = TAG_LABEL_LOOKUP[lang]?.[tagLookupKey(tag)];
  if (label) return label;
  // Імена людей в англійській і кримськотатарській версіях пишемо латиницею.
  const person = lang !== "uk" ? personForTag(tag) : null;
  if (person?.name?.en) return person.name.en;
  // Тег без перекладу в словнику: в англійській і кримськотатарській версіях не лишаємо кирилицю —
  // даємо латиницею (офіційна транслітерація). Новим тегам додаємо переклад у TAG_LABELS_EN/CRH.
  return lang !== "uk" && /[а-яіїєґ]/i.test(tag) ? transliterateTag(tag) : tag;
}

const TAG_TRANSLIT = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "’": "", "'": "" };
function transliterateTag(tag) {
  return [...String(tag)].map((ch) => {
    const low = ch.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TAG_TRANSLIT, low)) return ch;
    const out = TAG_TRANSLIT[low];
    return ch !== low && out ? out[0].toUpperCase() + out.slice(1) : out;
  }).join("");
}

const PEOPLE_BOX_TITLE = { uk: "Люди в матеріалі", en: "People in this story", crh: "Bu materialdaki insanlar" };
const PEOPLE_BOX_LINK = { uk: "Досьє", en: "Profile", crh: "Dosye" };

function peopleBox(tags, lang) {
  if (!PEOPLE_BASE_URL) return "";
  const seen = new Set();
  const people = tags.map(personForTag).filter(p => p && !seen.has(p.slug) && seen.add(p.slug));
  if (!people.length) return "";
  const base = PEOPLE_BASE_URL.replace(/\/$/, "");
  const prefix = lang === "en" ? "/en" : "";
  const items = people.map((p) => {
    const name = lang === "uk" ? p.name.uk : (p.name.en || p.name.uk);
    const role = lang === "en" ? (p.role.en || p.role.uk) : p.role.uk;
    const summary = lang === "en" ? (p.summary.en || p.summary.uk) : p.summary.uk;
    const href = `${base}${prefix}/${p.slug}/`;
    const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("");
    return `<li class="people-box-item">
      <a class="people-box-photo" href="${escapeHtml(href)}" aria-hidden="true" tabindex="-1"><span>${escapeHtml(initials)}</span><img src="${escapeHtml(`${base}/photo/${p.slug}`)}" alt="" loading="lazy" onerror="this.remove()"></a>
      <div><a class="people-box-name" href="${escapeHtml(href)}">${escapeHtml(name)}</a>
      <p class="people-box-role">${escapeHtml(role)}</p>
      <p class="people-box-summary">${escapeHtml(summary)} <a href="${escapeHtml(href)}">${pick(PEOPLE_BOX_LINK, lang)} →</a></p></div>
    </li>`;
  }).join("");
  return `<aside class="people-box" aria-label="${escapeHtml(pick(PEOPLE_BOX_TITLE, lang))}"><h2>${pick(PEOPLE_BOX_TITLE, lang)}</h2><ul>${items}</ul></aside>`;
}

// A press release (someone else's text published with light editing) is marked
// with a distinct, muted tag colour so readers don't take it for our own reporting.
// An announcement (upcoming event) gets a muted green tag the same way.
const PRESS_RELEASE_KEY = tagLookupKey("Пресреліз");
const ANNOUNCEMENT_KEY = tagLookupKey("Анонс");
// «Статті» (long reads) get a muted violet tag, matching the «Статті» chip on the home page.
const ARTICLES_KEY = tagLookupKey("Статті");
// «Ексклюзив» — власні тексти ПроМедіа (не компіляція з інших видань): помітний тег кольору бренду.
const EXCLUSIVE_KEY = tagLookupKey("Ексклюзив");
function isExclusive(tags) {
  return tags.some(t => tagLookupKey(t) === EXCLUSIVE_KEY);
}
function isPressRelease(tags) {
  return tags.some(t => tagLookupKey(t) === PRESS_RELEASE_KEY);
}
function isAnnouncement(tags) {
  return tags.some(t => tagLookupKey(t) === ANNOUNCEMENT_KEY);
}
function specialTagClass(tag) {
  const key = tagLookupKey(tag);
  if (key === PRESS_RELEASE_KEY) return " article-tag--press";
  if (key === ANNOUNCEMENT_KEY) return " article-tag--announce";
  if (key === ARTICLES_KEY) return " article-tag--articles";
  if (key === EXCLUSIVE_KEY) return " article-tag--exclusive";
  return "";
}
function tagLinks(tags, lang) {
  // Format tags (press release, announcement, articles) always come first so they are the first thing a reader sees.
  const ordered = [...tags.filter(t => specialTagClass(t)), ...tags.filter(t => !specialTagClass(t))];
  return `<div class="article-tags">${ordered.map((t) => `<a class="article-tag${specialTagClass(t)}" href="${langPrefix(lang)}/?tag=${encodeURIComponent(t)}">${escapeHtml(tagLabel(t, lang))}</a>`).join("")}</div>`;
}

function articleCoverMetadata(article, lang) {
  let data = lang === "crh" && article.cover_image_url_crh ? article.cover_crop_data_crh
    : lang === "en" && article.cover_image_url_en ? article.cover_crop_data_en : article.cover_crop_data;
  try { return (typeof data === "string" ? JSON.parse(data) : data) || {}; } catch (_) { return {}; }
}

function articleCoverAlt(article, lang, fallback) {
  return articleCoverMetadata(article, lang).alt || fallback;
}

function articleFocalStyle(article, lang, format) {
  let data = articleCoverMetadata(article, lang);
  try { if (typeof data === "string") data = JSON.parse(data); } catch (_) { return ""; }
  const fit = data && data.fit === "contain" ? "object-fit:contain;background:#f1f2fa;" : "";
  const point = data && data[format];
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return "";
  const clamped = (p) => Math.max(0, Math.min(100, Number(p.x))) + "% " + Math.max(0, Math.min(100, Number(p.y))) + "%";
  if (format === "desktop") {
    const mobile = data.mobile && Number.isFinite(Number(data.mobile.x)) && Number.isFinite(Number(data.mobile.y))
      ? clamped(data.mobile) : clamped(point);
    return ' style="' + fit + '--cover-desktop-position:' + clamped(point) + ';--cover-mobile-position:' + mobile + '"';
  }
  return ' style="' + fit + 'object-position:' + clamped(point) + '"';
}

// Точка фокусу обкладинки «x y» у відсотках (мобільна, інакше десктопна) — для сторіз і соцмереж.
function coverFocusPoint(article, lang) {
  const data = articleCoverMetadata(article, lang);
  const p = manualFocus(data.mobile) || manualFocus(data.desktop);
  return p ? p.x + " " + p.y : "";
}

// Окрема картинка 1200×630 для соцмереж (scripts/social-covers.mjs) — лише якщо вона
// зроблена з поточної обкладинки й поточної точки фокусу.
function socialCover(article, lang) {
  const src = articleCover(article, lang);
  const data = articleCoverMetadata(article, lang);
  const og = data.og;
  if (!src || !og || !og.url) return "";
  const p = manualFocus(data.social) || manualFocus(data.desktop) || manualFocus(data.feed) || { x: 50, y: 50 };
  return og.signature === `v3|${src}|${p.x}|${p.y}` ? og.url : "";
}

// Точка фокусу з адмінки; 50/50 — значення за замовчуванням, тобто кадр ніхто не виставляв.
function manualFocus(p) {
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) return null;
  const v = { x: Math.max(0, Math.min(100, Number(p.x))), y: Math.max(0, Math.min(100, Number(p.y))) };
  return v.x === 50 && v.y === 50 ? null : v;
}

// Підпис під обкладинкою: поле caption у даних обкладинки (адмінка), інакше — рядок
// «Фото на обкладинці: …» / «Фото: …» з приміток під тонкою лінією (тоді він переїжджає під фото).
const COVER_CAPTION_LINE = /^\*(Фото на обкладинці|Фото|Cover photo|Photo|Qapaqtaki resim|Resim|Fotoresim):\s*(.+)\*$/;
function coverCaption(article, lang, bodyMd) {
  const meta = articleCoverMetadata(article, "uk");
  const own = meta.caption && typeof meta.caption === "object" ? String(meta.caption[lang] || "").trim() : "";
  const lines = String(bodyMd || "").split("\n");
  const divider = lines.findIndex((l) => /^(-{3,}|\*{3,})$/.test(l.trim()));
  if (own) return { caption: String(own).replace(/^\*|\*$/g, ""), bodyMd };
  if (divider < 0) return { caption: "", bodyMd };
  for (let i = divider + 1; i < lines.length; i++) {
    const m = lines[i].trim().match(COVER_CAPTION_LINE);
    if (m) {
      const rest = lines.slice(0, i).concat(lines.slice(i + 1));
      return { caption: m[2], bodyMd: rest.join("\n") };
    }
  }
  return { caption: "", bodyMd };
}

function articleCover(article, lang) {
  if (lang === "crh" && article.cover_image_url_crh) return article.cover_image_url_crh;
  return lang === "en" && article.cover_image_url_en
    ? article.cover_image_url_en
    : article.cover_image_url;
}

// Ту саму сторінку іншими мовами: прибираємо мовний префікс і додаємо потрібний.
function localizedUrls(url) {
  const u = new URL(url);
  u.searchParams.delete("lang");
  const path = u.pathname.replace(/^\/(en|crh)(?=\/|$)/, "") || "/";
  const withLang = (lang) => `${u.origin}${langPrefix(lang)}${path}${u.search}`;
  return { ukUrl: withLang("uk"), enUrl: withLang("en"), crhUrl: withLang("crh") };
}

function baseHead({ title, description, url, ogImage, lang, ogType, publishedAt, modifiedAt, imageAlt, jsonLd }) {
  const { ukUrl, enUrl, crhUrl } = localizedUrls(url);
  const canonicalUrl = lang === "en" ? enUrl : (lang === "crh" ? crhUrl : ukUrl);
  const defaultImage = lang === "crh" || lang === "en"
    ? `/img/og-share-${lang}.png`
    : DEFAULT_OG_IMAGE;
  const socialImage = new URL(ogImage || defaultImage, canonicalUrl).toString();
  const locale = OG_LOCALE[lang] || OG_LOCALE.uk;
  const alternateLocales = LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]);
  return `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="${escapeHtml(ogType || "website")}" />
<meta property="og:site_name" content="${escapeHtml(pick(SITE_NAME, lang))}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(socialImage)}" />
<meta property="og:image:secure_url" content="${escapeHtml(socialImage)}" />
${/\/img\/social\//.test(socialImage) ? `<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n<meta property="og:image:type" content="image/jpeg" />` : ""}
${imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />` : ""}
<meta property="og:locale" content="${locale}" />
${alternateLocales.map((l) => `<meta property="og:locale:alternate" content="${l}" />`).join("\n")}
${publishedAt ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}" />` : ""}
${modifiedAt ? `<meta property="article:modified_time" content="${escapeHtml(modifiedAt)}" />` : ""}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(socialImage)}" />
<link rel="alternate" hreflang="uk" href="${escapeHtml(ukUrl)}" />
<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
<link rel="alternate" hreflang="crh" href="${escapeHtml(crhUrl)}" />
<link rel="alternate" hreflang="x-default" href="${escapeHtml(ukUrl)}" />
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V}" />`;
}

const NAV_ARIA = { uk: "Проєкти ПроМедіа", en: "ProMedia projects", crh: "ProMedia leyhaları" };
const NAV_LABELS = {
  uk: { communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження", atlas: "Атлас Медіа", news: "Новини" },
  en: { communities: "Media communities", ratings: "Journalism schools", research: "Research", atlas: "Media Atlas", news: "News" },
  crh: { communities: "Cemaatlar haritası", ratings: "Jurnalistika fakülteleri reytingi", research: "Tedqiqatlar", atlas: "Mediya Atlası", news: "Haberler" }
};

// Адреси сусідніх сайтів мережі для кожної мови. Communities, research і
// atlas і рейтинг журфаків мають crh-версію; promedia.report — ні, тож
// кримськотатарський читач потрапляє на його українську версію.
const NETWORK_URLS = {
  communities: { uk: "https://communities.promedia.report/", en: "https://communities.promedia.report/en/", crh: "https://communities.promedia.report/crh/" },
  ratings: { uk: "https://ratings.promedia.report/", en: "https://ratings.promedia.report/en/", crh: "https://ratings.promedia.report/crh/" },
  research: { uk: "https://research.promedia.report/", en: "https://research.promedia.report/en/", crh: "https://research.promedia.report/crh/" },
  atlas: { uk: "https://atlas.promedia.report/", en: "https://atlas.promedia.report/en/", crh: "https://atlas.promedia.report/crh/" }
};

function header() {
  return `<promedia-global-header></promedia-global-header>`;
}

const FOOTER_TEXT = {
  en: {
    details: "Organization details", name: "Official name", nameValue: "ProMedia NGO",
    registration: "Registration number", address: "Registered address",
    addressValue: "19/44 Volodymyra Samiilenka St., Kyiv, Ukraine, 03118",
    chair: "Chair of the Board", chairValue: "Andrii Ianitskyi", phone: "Phone", email: "Email",
    social: "Social media", project: "A ProMedia project", correction: "Found an error?"
  },
  uk: {
    details: "Дані про організацію", name: "Офіційна назва", nameValue: "ГО «ПроМедіа»",
    registration: "Реєстраційний номер", address: "Юридична адреса",
    addressValue: "вул. Володимира Самійленка, 19/44, Київ, Україна, 03118",
    chair: "Голова правління", chairValue: "Андрій Яніцький", phone: "Телефон", email: "Електронна пошта",
    social: "Соціальні мережі", project: "Проєкт ПроМедіа", correction: "Побачили помилку?"
  },
  crh: {
    details: "Teşkilât aqqında malümat", name: "Resmiy adı", nameValue: "«ProMedia» İCT",
    registration: "Qayd nomeri", address: "Yuridik adres",
    addressValue: "Volodymyr Samiylenko soqağı, 19/44, Kyiv, Ukrayina, 03118",
    chair: "İdare Keñeşi Reisi", chairValue: "Andrii Ianitskyi", phone: "Telefon", email: "Elektron poçta",
    social: "İçtimaiy şebekeler", project: "ProMedia leyhası", correction: "Hata taptıñızmı?"
  }
};

function footer() {
  return `<promedia-global-footer></promedia-global-footer>`;
}

function pageShell({ title, description, url, ogImage, lang, ogType, publishedAt, modifiedAt, imageAlt, jsonLd, bodyHtml }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
${baseHead({ title, description, url, ogImage, lang, ogType, publishedAt, modifiedAt, imageAlt, jsonLd })}
<script async src="https://news.promedia.report/js/promedia-analytics.js"></script>
</head>
<body>
${header(lang, url)}
${bodyHtml}
${footer(lang)}
<script defer src="/js/promedia-language-suggest.js"></script>
<script defer src="/js/promedia-memorial-popup.js"></script>
<script defer src="/js/promedia-story-share.js?v=${ASSET_V}"></script>
<script defer src="/js/promedia-gallery.js?v=${ASSET_V}"></script>
<script defer src="/js/promedia-global-shell.js"></script>
</body>
</html>`;
}

const CRH_MONTHS = ["yanvar", "fevral", "mart", "aprel", "mayıs", "iyün", "iyül", "avgust", "sentâbr", "oktâbr", "noyabr", "dekabr"];

function formatDate(dateStr, lang) {
  // Коротка дата цифрами (17.11.2026) — як на promedia.report (рішення редактора 19.11.2026).
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" }).format(d);
}

// Owner decision (2026-11-17): hide the view counter for the first 24 hours after
// publication, so fresh news never shows "0 views" before GA4 has collected anything.
const VIEWS_VISIBLE_AFTER_MS = 24 * 60 * 60 * 1000;

export function viewsVisible(publishedAt, now = Date.now()) {
  const published = Date.parse(publishedAt);
  return Number.isFinite(published) && now - published >= VIEWS_VISIBLE_AFTER_MS;
}

// Значки «у тексті є фото / відео / аудіо» біля дати.
const MEDIA_LABELS = {
  photo: { uk: (n) => `У тексті ${n} фото`, en: (n) => `${n} photos in the story`, crh: (n) => `Metinde ${n} fotoresim` },
  video: { uk: () => "У тексті є відео", en: () => "Video in the story", crh: () => "Metinde video bar" },
  audio: { uk: () => "У тексті є аудіозапис", en: () => "Audio recording in the story", crh: () => "Metinde audio yazı bar" }
};
const MEDIA_ICONS = {
  photo: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
  video: '<rect x="2.5" y="7" width="13" height="10" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/>',
  audio: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z" fill="currentColor"/>'
};
function articleMediaBadges(article, lang) {
  let photos = Number(article.media_photos), video = Boolean(Number(article.media_video)), audio = Boolean(Number(article.media_audio));
  if (!Number.isFinite(photos) && typeof article.body_md === "string") {
    const md = article.body_md;
    photos = (md.match(/!\[/g) || []).length;
    video = /\[youtube\]\(/i.test(md);
    audio = /\[audio\]\(/i.test(md);
  }
  const items = [];
  if (photos >= 2) items.push(["photo", photos]);
  if (video) items.push(["video"]);
  if (audio) items.push(["audio"]);
  if (!items.length) return "";
  return `<span class="article-media-badges">${items.map(([kind, n]) => {
    const label = pick(MEDIA_LABELS[kind], lang)(n);
    return `<span class="article-media-badge" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${MEDIA_ICONS[kind]}</svg>${kind === "photo" ? `<span>${n}</span>` : ""}</span>`;
  }).join("")}</span>`;
}

// Плеєр «Слухати статтю»: озвучка синтезатором мовлення (лише українська й англійська).
const LISTEN_LABEL = { uk: "Слухати статтю", en: "Listen to this story" };
const LISTEN_NOTE = { uk: "Озвучено синтезатором мовлення Google", en: "Read by a Google text-to-speech voice" };
const MINUTES = { uk: "хв", en: "min" };
function listenPlayer(article, lang) {
  const tts = typeof TTS !== "undefined" ? TTS : {};
  const entry = tts[article.slug] && tts[article.slug][lang];
  if (!entry || !LISTEN_LABEL[lang]) return "";
  return `<div class="article-listen"><p class="article-listen-title"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z" fill="currentColor"/></svg>${LISTEN_LABEL[lang]} · ${entry.minutes} ${MINUTES[lang]}</p><audio controls preload="none" src="${escapeHtml(entry.file)}"></audio><p class="article-listen-note">${LISTEN_NOTE[lang]}</p></div>`;
}

function articleMeta(article, lang, now = Date.now()) {
  return `<div class="article-meta"><p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>${articleViews(article, lang, now)}${articleMediaBadges(article, lang)}</div>`;
}

function articleViews(article, lang, now = Date.now()) {
  const count = article.view_count;
  const labels = { uk: "Перегляди", en: "Views", crh: "Baqıluvlar" };
  const hints = { uk: "Перегляди за даними Google Analytics", en: "Page views from Google Analytics", crh: "Google Analytics malümatlarına köre baqıluvlar" };
  const views = Number.isSafeInteger(count) && count >= 0 && viewsVisible(article.published_at, now)
    ? `<span class="article-views" title="${pick(hints, lang)}" aria-label="${pick(labels, lang)}: ${count}"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>${new Intl.NumberFormat(lang === "en" ? "en-GB" : "uk-UA").format(count)}</span></span>`
    : "";
  return views;
}

function localizedField(article, field, lang) {
  const normalize = field === "title" ? normalizeUkrainianTitle : normalizeUkrainianQuotes;
  if (lang === "uk") return normalize(article[field]);
  const localized = article[`${field}_${lang}`];
  return localized || normalize(article[field]);
}

function articleTitle(article, lang) {
  return localizedField(article, "title", lang);
}
function articleExcerpt(article, lang) {
  // The excerpt is shown as plain text (cards, lead, share text, meta description),
  // so markdown links in it become just their label instead of raw [text](url).
  const raw = String(localizedField(article, "excerpt", lang) || "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^\s)]+\)/g, "$1");
  return raw || markdownToPlainText(localizedField(article, "body_md", lang), 200);
}

const ALL_LABEL = { uk: "Усі", en: "All", crh: "Episi" };
const CATEGORY_NAV_ARIA = { uk: "Рубрики новин", en: "News categories", crh: "Haber kategoriyaları" };
const CATEGORY_NAV_KIND = { "Новини": "news", "Статті": "articles", "Пресреліз": "press", "Анонс": "announce" };
// Підписи фільтра форматів на головній (множина: «Пресрелізи», «Анонси»).
const CATEGORY_NAV_LABELS = {
  "Новини": { uk: "Новини", en: "News", crh: "Haberler" },
  "Статті": { uk: "Статті", en: "Articles", crh: "Maqaleler" },
  "Пресреліз": { uk: "Пресрелізи", en: "Press releases", crh: "Basın bildirileri" },
  "Анонс": { uk: "Анонси", en: "Announcements", crh: "İlânlar" }
};

const TOP_NAV_LABEL = { uk: "Топ", en: "Top", crh: "Top" };

function categoryNav(lang, activeTag, activeSort) {
  const labels = { all: pick(ALL_LABEL, lang), ...Object.fromEntries(CATEGORIES.map(category => [category, pick(CATEGORY_NAV_LABELS[category], lang)])) };
  const allHref = `${langPrefix(lang)}/`;
  const items = [
    `<a class="category-link${!activeTag && !activeSort ? " active" : ""}" href="${allHref}">${labels.all}</a>`,
    `<a class="category-link category-link--top${activeSort === "top" ? " active" : ""}" href="${langPrefix(lang)}/?sort=top">${pick(TOP_NAV_LABEL, lang)}</a>`,
    ...CATEGORIES.map((category) => {
      const query = `?tag=${encodeURIComponent(category)}`;
      return `<a class="category-link category-link--${CATEGORY_NAV_KIND[category]}${activeTag === category ? " active" : ""}" href="${langPrefix(lang)}/${query}">${labels[category]}</a>`;
    })
  ];
  return `<nav class="category-nav" aria-label="${pick(CATEGORY_NAV_ARIA, lang)}">${items.join("")}</nav>`;
}

const TOP_STORY_LABEL = { uk: "У центрі уваги", en: "Top story", crh: "Baş haber" };

function articleCard(article, lang, baseUrl, variant) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const tags = JSON.parse(article.tags || "[]");
  const isArticle = tags.some(t => tagLookupKey(t) === "статті");
  const contentKind = isArticle ? "article" : isPressRelease(tags) ? "press-release" : isAnnouncement(tags) ? "announcement" : tags.some(t => tagLookupKey(t) === "заяви") ? "statement" : tags.some(t => tagLookupKey(t) === "новини") ? "news" : "other";
  const cardVariant = variant || "visual";
  const coverUrl = articleCover(article, lang);
  const showCover = coverUrl && (cardVariant !== "text" || isArticle);
  const articleHref = `${baseUrl}${langPrefix(lang)}/article/${escapeHtml(article.slug)}`;
  const cover = showCover
    ? `<a class="article-card-media${cardVariant === "text" ? " article-card-media--mobile-only" : ""}" href="${articleHref}">
        <img class="article-card-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(articleCoverAlt(article, lang, title))}"${articleFocalStyle(article, lang, cardVariant === "hero" ? "desktop" : "feed")} loading="${cardVariant === "hero" ? "eager" : "lazy"}" />
      </a>`
    : "";
  return `
<article class="article-card article-card--${cardVariant}${article.card_style === "hero" ? " article-card--photo" : ""}${article.is_important ? " article-card--important" : ""}" data-content-kind="${contentKind}">
  ${cover}
  <div class="article-card-body">
    ${tags.length ? tagLinks(tags, lang) : ""}
    <${cardVariant === "hero" ? "h1" : "h3"}><a href="${articleHref}">${escapeHtml(title)}</a></${cardVariant === "hero" ? "h1" : "h3"}>
    <p class="article-excerpt">${escapeHtml(excerpt)}</p>
    ${articleMeta(article, lang)}
  </div>
</article>`;
}

// Картка у стрічці завжди з фото: варіантів «без фото» більше немає.
function articleCardVariant() {
  return "visual";
}

const SHARE_LABELS = {
  en: { title: "Share", instagram: "Instagram: share to your story", copy: "Copy this link and paste it into Instagram", copied: "Link copied. Paste it into an Instagram message or a story link sticker." },
  uk: { title: "Поширити", instagram: "Instagram: поширити в сторіз", copy: "Скопіюйте посилання та вставте в Instagram", copied: "Посилання скопійовано. Вставте його в повідомлення Instagram або стікер посилання в історії." },
  crh: { title: "Paylaş", instagram: "Instagram: hikâyede paylaşmaq", copy: "Bağlantını kopiyalañız ve Instagram'ğa yapıştırıñız", copied: "Bağlantı kopiyalandı. Onı Instagram mesajına ya da hikâyedeki bağlantı etiketine yapıştırıñız." }
};

// Inline brand icons keep the share controls independent of external icon services.
const SHARE_ICON_PATHS = {
  Facebook: "M13.7 21v-8h2.8l.4-3.2h-3.2V7.7c0-.9.3-1.6 1.7-1.6h1.8V3.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.3V13h2.9v8h3.5Z",
  X: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  Threads: "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z",
  LinkedIn: "M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 10h4v11H3V10Zm6 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05C20.65 9.45 21 12.1 21 15.55V21h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55V21H9V10Z",
  YouTube: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z",
  Instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
};

function shareIcon(network) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${SHARE_ICON_PATHS[network]}" /></svg>`;
}

// «Бажані джерела» Google: читач додає news.promedia.report, і Google частіше
// показує наші новини в Top Stories / Discover. Звичайне посилання (deeplink),
// без стороннього скрипту Google; кліки рахує promedia-story-share.js.
const GOOGLE_SOURCE_URL = "https://www.google.com/preferences/source?q=news.promedia.report";
const GOOGLE_SOURCE_COPY = {
  uk: { aria: "Додати «ПроМедіа» до бажаних джерел Google", button: "Додати", text: "Додайте «ПроМедіа» до бажаних джерел Google — і наші новини траплятимуться вам частіше." },
  en: { aria: "Add ProMedia as a preferred source on Google", button: "Add", text: "Add ProMedia as a preferred source on Google to see our news more often." },
  crh: { aria: "«ProMedia»-nı Google-da tercih etilgen menbalarğa qoşmaq", button: "Qoşmaq", text: "«ProMedia»-nı Google-da tercih etilgen menbalarğa qoşuñız — haberlerimiz sizge daa sıq rastkelir." }
};
const GOOGLE_G_MONO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"/><path d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"/><path d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"/><path d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"/></svg>';

// Компактна плашка стоїть на місці тонкої лінії між текстом новини й службовими
// примітками (фото, джерела); лінія лишається в HTML прихованою, бо від неї
// залежить курсив приміток. Якщо приміток немає — плашка йде після тексту.
const NOTES_DIVIDER = '<hr class="article-notes-divider" />';
function withGoogleSourceStrip(html, lang) {
  const strip = googleSourceCta(lang, "in-text");
  // Вставка всередині тексту — після третього абзацу, але не серед приміток.
  const notesAt = html.indexOf(NOTES_DIVIDER);
  const body = notesAt === -1 ? html : html.slice(0, notesAt);
  let pos = -1;
  for (let i = 0, from = 0; i < 3; i += 1) {
    const at = body.indexOf("</p>", from);
    if (at === -1) { pos = -1; break; }
    pos = at + 4; from = pos;
  }
  if (pos !== -1 && body.indexOf("</p>", pos) !== -1) return html.slice(0, pos) + strip + html.slice(pos);
  return notesAt === -1 ? html + strip : html.slice(0, notesAt) + strip + html.slice(notesAt);
}

function googleSourceCta(lang, placement) {
  const copy = pick(GOOGLE_SOURCE_COPY, lang);
  const text = copy.text;
  return `<aside class="google-source-cta google-source-cta--${escapeHtml(placement)}" aria-label="${escapeHtml(copy.aria)}">
  <p>${escapeHtml(text)}</p>
  <a class="google-source-button" href="${GOOGLE_SOURCE_URL}" target="_blank" rel="noopener" data-google-source="${escapeHtml(placement)}" aria-label="${escapeHtml(copy.aria)}">${GOOGLE_G_MONO}<span>${escapeHtml(copy.button)}</span></a>
</aside>`;
}

// «Стежте за ПроМедіа» (owner, 2026-11-23): кінець новини й права колонка. Telegram-каналу немає.
const PROMEDIA_SOCIALS = [
  ["Facebook", "https://www.facebook.com/promediaukraine"],
  ["Instagram", "https://www.instagram.com/promediaua/"],
  ["LinkedIn", "https://www.linkedin.com/company/promediaukraine"],
  ["YouTube", "https://www.youtube.com/@prostirmedia"]
];
const FOLLOW_LABEL = { uk: "Стежте за ПроМедіа", en: "Follow ProMedia", crh: "ProMedia-nı taqip etiñiz" };
function followBlock(lang, placement) {
  const label = pick(FOLLOW_LABEL, lang);
  return `<section class="pm-follow pm-follow--${placement}" aria-label="${escapeHtml(label)}">
  <span class="pm-follow-title">${escapeHtml(label)}</span>
  <div class="pm-follow-links">${PROMEDIA_SOCIALS.map(([name, href]) => `<a href="${href}" target="_blank" rel="noopener" data-follow="${placement}" aria-label="${escapeHtml(`${label}: ${name}`)}" title="${name}">${shareIcon(name)}</a>`).join("")}</div>
</section>`;
}

function articleShareBlock({ title, excerpt, articleUrl, lang, coverUrl, coverFocus }) {
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(`${title}\n\n${articleUrl}`);
  const labels = pick(SHARE_LABELS, lang);
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`],
    ["X", `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`],
    ["Threads", `https://www.threads.net/intent/post?text=${encodedText}`],
    // На Android — прямо в застосунок LinkedIn (promedia-story-share.js); на iPhone і комп'ютері — share-offsite.
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`]
  ];
  return `
<section class="article-share" aria-label="${escapeHtml(labels.title)}">
  <span>${escapeHtml(labels.title)}</span>
  <div class="article-share-links">
    ${links.map(([label, href]) => `<a href="${escapeHtml(href)}"${label === "LinkedIn" ? ` data-share-native data-share-title="${escapeHtml(title)}" data-share-url="${escapeHtml(articleUrl)}"` : ""} target="_blank" rel="noopener" aria-label="${escapeHtml(`${labels.title}: ${label}`)}" title="${escapeHtml(label)}">${shareIcon(label)}</a>`).join("")}
    <button type="button" data-share-instagram data-share-cover="${escapeHtml(coverUrl || "")}" data-share-focus="${escapeHtml(coverFocus || "")}" data-share-title="${escapeHtml(title)}" data-share-text="${escapeHtml(excerpt)}" data-share-url="${escapeHtml(articleUrl)}" data-copy="${escapeHtml(labels.copy)}" data-copied="${escapeHtml(labels.copied)}" aria-label="${escapeHtml(`${labels.title}: Instagram`)}" title="${escapeHtml(labels.instagram)}">${shareIcon("Instagram")}</button>
    <a href="${GOOGLE_SOURCE_URL}" target="_blank" rel="noopener" data-google-source="share-row" aria-label="${escapeHtml(pick(GOOGLE_SOURCE_COPY, lang).aria)}" title="${escapeHtml(pick(GOOGLE_SOURCE_COPY, lang).aria)}">${GOOGLE_G_MONO}</a>
  </div>
  <p class="article-share-status" data-share-status role="status"></p>
</section>`;
}

const NO_ARTICLES_LABEL = { uk: "Статей поки немає.", en: "No articles yet.", crh: "Şimdilik maqale yoq." };
const TOP_STORIES_ARIA = { uk: "Головні новини", en: "Top stories", crh: "Baş haberler" };
const LATEST_NEWS_LABEL = { uk: "Останні новини", en: "Latest news", crh: "Soñki haberler" };

export const PRACTICE_TOPICS = [
  { id: "audience", labels: { uk: "Залучати аудиторію", en: "Engage audiences", crh: "Auditoriyanı celp etmek" }, tags: ["медійні спільноти", "медіаспільноти", "Медіаспільноти", "членство", "карта спільнот"] },
  { id: "money", labels: { uk: "Знаходити гроші", en: "Find funding", crh: "Malî imkânlar tapmaq" }, tags: ["локальний бізнес", "фінансування", "фандрейзинг", "медіапідприємництво", "членство"] },
  { id: "technology", labels: { uk: "Автоматизувати роботу", en: "Automate work", crh: "İşni avtomatlaştırmaq" }, tags: ["штучний інтелект", "Штучний інтелект", "ШІ", "автоматизація", "відкриті дані", "фактчекінг"] },
  { id: "team", labels: { uk: "Розвивати команду", en: "Develop your team", crh: "Komandanı inkişaf ettirmek" }, tags: ["журналістська освіта", "освіта", "навчання", "безпека журналістів", "ейджизм"] }
];

function articleTags(article) {
  try { const tags = JSON.parse(article.tags || "[]"); return Array.isArray(tags) ? tags : []; } catch { return []; }
}

const PRACTICE_COPY = {
  uk: { title: "Новини медіа та комунікацій", intro: "Новини медіа, журналістики та комунікацій для українських редакцій: ринок, дослідження, можливості, законодавство.", needs: "Що потрібно вашій редакції?", practice: "Взяти в роботу", latest: "Останні публікації", all: "Усі матеріали", research: "Дослідження", organisation: "ПроМедіа: події та проєкти", services: "Інструменти ПроМедіа", guide: "Посібник із розвитку спільнот", atlas: "Атлас Медіа", jobs: "Робота в медіа", filtered: "Матеріали за темою" },
  en: { title: "Media and communications news", intro: "Media, journalism and communications news for Ukrainian newsrooms: market, research, opportunities, regulation.", needs: "What does your newsroom need?", practice: "Put into practice", latest: "Latest publications", all: "All publications", research: "Research", organisation: "ProMedia: events and projects", services: "ProMedia tools", guide: "Community development guide", atlas: "Media Atlas", jobs: "Media jobs", filtered: "Explore this topic" },
  crh: { title: "Mediya ve kommunikatsiya haberleri", intro: "Ukrayina redaktsiyaları içün mediya, jurnalistika ve kommunikatsiya haberleri.", needs: "Redaktsiyañızğa ne kerek?", practice: "Amelde qullanıñız", latest: "Soñki neşirler", all: "Bütün neşirler", research: "Tedqiqatlar", organisation: "ProMedia: tedbirler ve leyhalar", services: "ProMedia aletleri", guide: "Cemaatlarnı inkişaf ettirüv qılavuzı", atlas: "Mediya Atlası", jobs: "Mediyada iş", filtered: "Mevzuğa ait neşirler" }
};


const PROJECT_PROMOS = {
  uk: { label: "Проєкт ПроМедіа", atlas: ["Хто стоїть за українськими медіа?", "Шукайте медіа та їхніх власників в Атласі Медіа.", "Відкрити Атлас"], jobs: ["Знайдіть свою роботу в медіа", "Вакансії та можливості для медійників.", "До вакансій"] },
  en: { label: "A ProMedia project", atlas: ["Who owns Ukrainian media?", "Explore media outlets and their owners in the Media Atlas.", "Open the Atlas"], jobs: ["Find your next media job", "Jobs and opportunities for media professionals.", "Explore jobs"] },
  crh: { label: "ProMedia leyhası", atlas: ["Ukrayina mediyasınıñ saipleri kim?", "Mediya Atlasında mediya ve saiplerini tapıñız.", "Atlasnı aç"], jobs: ["Mediyada iş tapıñız", "Mediya mütehassısları içün vakansiyalar.", "Vakansiyalar"] }
};

function projectPromo(lang, project, placement) {
  const copy = pick(PROJECT_PROMOS, lang);
  const [title, description, action] = copy[project];
  const href = project === "atlas" ? NETWORK_URLS.atlas[lang] : "https://jobs.promedia.report/";
  if (project === "atlas" && placement === "home-mosaic") {
    const labels = pick({
      uk: { label: "Наші проєкти", brand: "АТЛАС МЕДІА", title: "Хто володіє українськими медіа?" },
      en: { label: "Our projects", brand: "MEDIA ATLAS", title: "Who owns Ukrainian media?" },
      crh: { label: "Leyhalarımız", brand: "MEDİYA ATLASI", title }
    }, lang);
    return `<aside class="project-promo-slot" data-ad-slot="home-mosaic" aria-label="${escapeHtml(labels.label)}">
      <a class="project-promo atlas-display-ad" href="${escapeHtml(href)}">
        <span class="atlas-ad-eyebrow">${escapeHtml(labels.label)} <span>↗</span></span>
        <span class="atlas-ad-brand">${escapeHtml(labels.brand)}</span>
        <svg class="atlas-ad-network" viewBox="0 0 140 150" fill="none" aria-hidden="true" focusable="false">
          <g stroke="#ffac33" stroke-width="1.5" opacity=".65"><path d="M76 72 18 24M76 72 126 18M76 72 122 124M76 72 20 132M76 72 16 76"/></g>
          <g fill="#17166c" stroke="#ffac33" stroke-width="2"><circle cx="18" cy="24" r="12"/><circle cx="126" cy="18" r="9"/><circle cx="122" cy="124" r="13"/><circle cx="20" cy="132" r="8"/><circle cx="16" cy="76" r="7"/></g>
          <circle cx="76" cy="72" r="23" fill="#ffac33"/>
          <g stroke="#0d0c5c" stroke-width="2"><rect x="64" y="61" width="24" height="19" rx="2"/><path d="M68 66h16M68 71h10M68 76h14"/></g>
        </svg>
        <h2>${escapeHtml(labels.title)}</h2>
        <span class="atlas-ad-action">${escapeHtml(action)} <span>↗</span></span>
      </a>
    </aside>`;
  }
  return `<aside class="project-promo-slot" data-ad-slot="${escapeHtml(placement)}" aria-label="${escapeHtml(copy.label)}">
    <a class="project-promo project-promo--${project}" href="${escapeHtml(href)}">
      <div class="project-promo-copy"><span class="project-promo-label">${escapeHtml(copy.label)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
      <span class="project-promo-action">${escapeHtml(action)} ↗</span>
    </a>
  </aside>`;
}


function mosaicPromoTemplates(lang) {
  const copy = pick({
    uk: { label: "Наші проєкти", guide: ["РОЗВИТОК СПІЛЬНОТ", "Як об’єднати аудиторію навколо медіа?", "Відкрити посібник"], ratings: ["РЕЙТИНГ ЖУРФАКІВ", "Де навчатися журналістики?", "Переглянути рейтинг"] },
    en: { label: "Our projects", guide: ["COMMUNITY GUIDE", "Build a community around your media", "Explore the guide"], ratings: ["JOURNALISM SCHOOLS", "Where to study journalism?", "Explore the ranking"] },
    crh: { label: "Leyhalarımız", guide: ["CEMAAT REHBERİ", "Mediya etrafında cemaat quruñız", "Rehberni aç"], ratings: ["FAKÜLTELER REYTİNGİ", "Jurnalistikanı qayda ögrenmeli?", "Reytingni aç"] }
  }, lang);
  return ["guide", "ratings"].map(project => {
    const [brand, title, action] = copy[project];
    const href = project === "guide" ? "https://guide.promedia.report/" + (lang === "uk" ? "" : lang + "/") : NETWORK_URLS.ratings[lang];
    const graphic = project === "guide"
      ? '<path d="M22 32Q48 19 70 34Q94 19 120 32V121Q94 108 70 123Q48 108 22 121Z"/><path d="M70 34V123M33 47L56 45M33 59L56 57M84 45L108 47M84 57L108 59"/>'
      : '<path d="M22 128H126M30 128V88H51V128M65 128V60H86V128M100 128V29H121V128"/><path d="M24 62L62 35L82 43L119 10"/>';
    return `<template data-mosaic-promo-template><div class="mosaic-cell mosaic-cell--promo">
      <aside class="project-promo-slot" data-ad-slot="home-mosaic-${project}" aria-label="${escapeHtml(copy.label)}">
        <a class="project-promo atlas-display-ad display-ad--${project}" href="${escapeHtml(href)}">
          <span class="atlas-ad-eyebrow">${escapeHtml(copy.label)} <span>↗</span></span>
          <span class="atlas-ad-brand">${escapeHtml(brand)}</span>
          <svg class="atlas-ad-network" viewBox="0 0 140 150" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" focusable="false">${graphic}</svg>
          <h2>${escapeHtml(title)}</h2>
          <span class="atlas-ad-action">${escapeHtml(action)} <span>↗</span></span>
        </a>
      </aside>
    </div></template>`;
  }).join("");
}

export function renderHomepage({ articles, lang, activeTag, activeTopic, activeSort, baseUrl, leadArticle, pinnedArticle }) {
  const copy = pick(PRACTICE_COPY, lang);
  const prefix = langPrefix(lang);
  const topic = PRACTICE_TOPICS.find(item => item.id === activeTopic);
  const filtered = Boolean(activeTag || topic || activeSort);
  const heading = (title, href, label) => `<div class="practice-heading"><h2>${escapeHtml(title)}</h2>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(label || copy.all)} ↗</a>` : ""}</div>`;
  let list = `<p class="empty-state">${pick(NO_ARTICLES_LABEL, lang)}</p>`;
  const mosaic = (items, withPromo, mobileListed) => {
    const cells = items.map((a, i) => `<div class="mosaic-cell${mobileListed?.has(a.slug) ? " mosaic-cell--mobile-listed" : ""}" data-published="${escapeHtml(a.published_at || "")}">${articleCard(a, lang, baseUrl, articleCardVariant(a, i % 4 === 2 ? "text" : "visual"))}</div>`);
    // Atlas promo a few cards lower, so it does not sit right under the newsletter strip (owner, 2026-11-20).
    if (withPromo) cells.splice(Math.min(6, cells.length), 0, `<div class="mosaic-cell mosaic-cell--promo">${projectPromo(lang, "atlas", "home-mosaic")}</div>`);
    return cells.length ? `<div class="article-grid restored-feed">${cells.join("")}</div>` : "";
  };
  if (articles.length && topic) {
    list = heading(pick(topic.labels, lang), `${prefix}/`) + `<div class="practice-stream">${articles.map(a => articleCard(a, lang, baseUrl, "visual")).join("")}</div>`;
  } else if (articles.length) {
    // Усі вкладки — як на promedia.report: головна новина з великим фото, поруч 5 наступних
    // заголовків, далі мозаїка з рештою.
    let hero;
    if (!filtered) {
      // The editor's lead story may be older than the newest 60; it still leads.
      const featured = articles.filter(a => a.card_style === "hero");
      if (!featured.length && leadArticle) { featured.push(leadArticle); articles = [leadArticle, ...articles]; }
      hero = featured.length ? featured.reduce((latest, article) => (article.published_at || "") > (latest.published_at || "") ? article : latest) : articles[0];
    } else {
      hero = activeSort === "top" ? articles[0] : (articles.find(a => a.card_style === "hero") || articles[0]);
    }
    // Закріплена новина (лише в загальній стрічці): завжди перша в списку заголовків,
    // з булавкою й заливкою; у мозаїці не дублюється.
    const pinned = !filtered && pinnedArticle && pinnedArticle.slug !== hero.slug ? pinnedArticle : null;
    const remaining = articles.filter(a => a.slug !== hero.slug && (!pinned || a.slug !== pinned.slug));
    // На комп'ютері поруч із головною 5 заголовків, на мобільному — 9 (разом із головною 10).
    const side = pinned ? [pinned, ...remaining.slice(0, 8)] : remaining.slice(0, 9);
    const rest = remaining.slice(pinned ? 4 : 5);
    const mobileListed = new Set(side.slice(5).map(a => a.slug));
    const tagHeading = filtered && !activeSort && !CATEGORY_NAV_LABELS[activeTag] ? heading(tagLabel(activeTag, lang), null) : "";
    list = tagHeading + newsLead(hero, side, lang, baseUrl, activeSort === "top", pinned?.slug) + (filtered ? "" : newsletterSlot(lang, "strip")) + mosaic(rest, !filtered, mobileListed);
  }
  const bodyHtml = `<main class="wrap practice-home magazine-home">
    ${topic ? "" : categoryNav(lang, activeTag, activeSort)}
    ${list}
  </main>${!filtered && articles.length ? mosaicPromoTemplates(lang) : ""}<script defer src="/js/promedia-mosaic.js?v=${ASSET_V}"></script><script defer src="/js/promedia-feed-more.js?v=${ASSET_V}"></script>`;
  return pageShell({ title: filtered ? `${topic ? pick(topic.labels, lang) : activeSort === "top" ? pick(TOP_NAV_LABEL, lang) : tagLabel(activeTag, lang)} — ПроМедіа` : `${pick({ uk: "ПроМедіа", en: "ProMedia", crh: "ProMedia" }, lang)}. ${copy.title}`, description: copy.intro,
    url: `${baseUrl}${prefix}/${activeTag ? `?tag=${encodeURIComponent(activeTag)}` : topic ? `?topic=${topic.id}` : activeSort === "top" ? "?sort=top" : ""}`, lang, bodyHtml });
}

const LEAD_SIDE_LABEL = { uk: "Останні", en: "Latest", crh: "Soñki" };
const PINNED_LABEL = { uk: "Закріплено", en: "Pinned", crh: "Bekitilgen" };
const LEAD_SIDE_TOP_LABEL = { uk: "Найчитаніші", en: "Most read", crh: "Eñ çoq oqulğanlar" };
const LEAD_RUBRICS = {
  "Пресреліз": { uk: "Пресреліз", en: "Press release", crh: "Basın bildirisi" },
  "Анонс": { uk: "Анонс", en: "Announcement", crh: "İlân" },
  "Новини": { uk: "Новини", en: "News", crh: "Haberler" },
  "Статті": { uk: "Статті", en: "Articles", crh: "Maqaleler" },
  "Заяви": { uk: "Заяви", en: "Statements", crh: "Beyanatlar" }
};

function leadMeta(article, lang) {
  const tags = JSON.parse(article.tags || "[]");
  const key = tags.includes("Пресреліз") ? "Пресреліз" : tags.includes("Анонс") ? "Анонс" : tags.find(t => LEAD_RUBRICS[t]);
  const kind = key === "Пресреліз" ? " feed-lead-rubric--press" : key === "Анонс" ? " feed-lead-rubric--announce" : key && key !== "Новини" ? " feed-lead-rubric--alt" : "";
  const rubric = key ? `<span class="feed-lead-rubric${kind}">${escapeHtml(pick(LEAD_RUBRICS[key], lang))}</span> · ` : "";
  const exclusive = isExclusive(tags) ? `<span class="feed-lead-exclusive">${escapeHtml(tagLabel("Ексклюзив", lang))}</span> · ` : "";
  return `<p class="feed-lead-meta">${exclusive}${rubric}${escapeHtml(formatDate(article.published_at, lang))}</p>`;
}

// Блок угорі стрічки — такий самий, як на promedia.report.
function newsLead(hero, side, lang, baseUrl, isTop, pinnedSlug) {
  const isPinned = (a) => Boolean(pinnedSlug) && a.slug === pinnedSlug;
  const href = (a) => `${baseUrl}${langPrefix(lang)}/article/${escapeHtml(a.slug)}`;
  const title = articleTitle(hero, lang);
  const cover = articleCover(hero, lang);
  const media = cover ? `<a class="feed-lead-media" href="${href(hero)}">
      <img class="feed-lead-blur" src="${escapeHtml(cover)}" alt="" aria-hidden="true" />
      <img class="feed-lead-photo" src="${escapeHtml(cover)}" alt="${escapeHtml(articleCoverAlt(hero, lang, title))}"${articleFocalStyle(hero, lang, "desktop")} loading="eager" onload="if(this.naturalHeight/this.naturalWidth>=0.9)this.parentNode.classList.add('feed-lead-media--portrait')" />
    </a>` : "";
  const excerpt = articleExcerpt(hero, lang);
  // Мобільний: новини, що вийшли після головної, стоять над нею (найсвіжіша зверху).
  // Закріплена на телефоні теж угорі — над головною.
  const isNewer = (a) => !isTop && (isPinned(a) || (a.published_at || "") > (hero.published_at || ""));
  const pinMark = (a) => isPinned(a) ? `<span class="feed-lead-pin" title="${escapeHtml(pick(PINNED_LABEL, lang))}" aria-label="${escapeHtml(pick(PINNED_LABEL, lang))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg></span>` : "";
  // «З фото на першій»: на комп'ютері головна одна, а на смартфоні кожна така новина
  // стоїть у стрічці з фото (фото в списку сховане на комп'ютері).
  const itemPhoto = (a) => {
    const c = a.card_style === "hero" && !articleCoverMetadata(a, lang).hideMobile ? articleCover(a, lang) : "";
    return c ? `<a class="feed-lead-item-photo" href="${href(a)}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(c)}" alt=""${articleFocalStyle(a, lang, "feed")} loading="lazy" /></a>` : "";
  };
  const item = (a, extra) => { const photo = itemPhoto(a); return `<li class="feed-lead-item${a.is_important ? " feed-lead-item--important" : ""}${isPinned(a) ? " feed-lead-item--pinned" : ""}${photo ? " feed-lead-item--photo" : ""}${extra}">${pinMark(a)}${photo}${leadMeta(a, lang)}<a href="${href(a)}">${escapeHtml(articleTitle(a, lang))}</a></li>`; };
  const newer = side.filter(isNewer);
  const newerBlock = newer.length ? `<aside class="feed-lead-newer" aria-label="${escapeHtml(pick(LEAD_SIDE_LABEL, lang))}">
      <ol class="feed-lead-list">${newer.map(a => item(a, "")).join("")}</ol>
    </aside>` : "";
  const aside = side.length ? `<aside class="feed-lead-side" aria-label="${escapeHtml(pick(isTop ? LEAD_SIDE_TOP_LABEL : LEAD_SIDE_LABEL, lang))}">
      <ol class="feed-lead-list">${side.map((a, i) => item(a, `${isNewer(a) ? " feed-lead-item--newer" : ""}${i >= 5 ? " feed-lead-item--extra" : ""}`)).join("")}</ol>
    </aside>` : "";
  return `<section class="feed-lead" aria-label="${escapeHtml(pick(TOP_STORIES_ARIA, lang))}">
    ${newerBlock}
    <article class="feed-lead-main${media ? " feed-lead-main--media" : ""}${media && articleCoverMetadata(hero, lang).hideMobile ? " feed-lead-main--no-mobile-photo" : ""}">
      ${media}
      <div class="feed-lead-hero-meta">${leadMeta(hero, lang)}${articleViews(hero, lang)}${articleMediaBadges(hero, lang)}</div>
      <h1 class="feed-lead-title${hero.is_important ? " feed-lead-title--important" : ""}"><a href="${href(hero)}">${escapeHtml(title)}</a></h1>
      ${excerpt ? `<p class="feed-lead-excerpt">${escapeHtml(excerpt)}</p>` : ""}
    </article>
    ${aside}
  </section>`;
}

const BACK_TO_NEWS_LABEL = { uk: "← Усі новини", en: "← All news", crh: "← Episi haberler" };
const ABOUT_LABEL = { uk: "Про кого:", en: "About:", crh: "Kimler aqqında:" };

// Картка «Медіа в матеріалі» під новиною — поруч із карткою «Люди в матеріалі».
// Показуємо лише медіа, які є в Атласі медіа або на карті спільнот, з посиланнями на обидва.
const MEDIA_BOX_TITLE = { uk: "Українські медіа в матеріалі", en: "Ukrainian media in this story", crh: "Bu materialdaki ukrain mediyaları" };
const MEDIA_BOX_ATLAS = { uk: "В Атласі медіа", en: "In the Media Atlas", crh: "Mediya Atlasında" };
const MEDIA_BOX_MAP = { uk: "На карті спільнот", en: "On the community map", crh: "Cemaatlar haritasında" };
const MEDIA_BOX_SITE = { uk: "Сайт", en: "Website", crh: "Sayt" };

function localizedAtlasUrl(url, lang) {
  if (!url || lang === "uk") return url;
  return url.replace(/^(https:\/\/atlas\.promedia\.report)\//, `$1/${lang}/`);
}

// Картка «Університети в матеріалі»: посилання на сторінку закладу в рейтингу журфаків.
const UNI_BOX_TITLE = { uk: "Університети в матеріалі", en: "Universities in this story", crh: "Bu materialdaki universitetler" };
const UNI_BOX_LINK = { uk: "У рейтингу журфаків", en: "In the journalism schools ranking", crh: "Jurnalistika fakülteleri reytinginde" };

function universitiesBox(universities, lang) {
  if (!universities || !universities.length) return "";
  const base = `https://ratings.promedia.report${lang === "uk" ? "" : `/${lang}`}/university.html?id=`;
  const rows = universities.map((u) => {
    const href = base + encodeURIComponent(u.id);
    const name = lang === "uk" ? u.name : (u.nameEn || u.name);
    const initials = u.short || String(name).split(/\s+/).map(w => w[0]).slice(0, 2).join("");
    return `<li class="people-box-item media-box-item">
      <a class="people-box-photo media-box-logo" href="${escapeHtml(href)}" aria-hidden="true" tabindex="-1"><span>${escapeHtml(initials)}</span>${u.logo ? `<img src="${escapeHtml(u.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</a>
      <div><a class="people-box-name" href="${escapeHtml(href)}">${escapeHtml(name)}</a>
      <p class="media-box-links"><a href="${escapeHtml(href)}">${pick(UNI_BOX_LINK, lang)} →</a></p></div>
    </li>`;
  }).join("");
  return `<aside class="people-box media-box" aria-label="${escapeHtml(pick(UNI_BOX_TITLE, lang))}"><h2>${pick(UNI_BOX_TITLE, lang)}</h2><ul>${rows}</ul></aside>`;
}

function mediaBox(media, lang) {
  const items = (media || []).filter(m => m && (m.atlasUrl || m.community || (m.manual && m.website)));
  if (!items.length) return "";
  const rows = items.map((m) => {
    const c = m.community || {};
    const description = lang === "en" ? (c.descriptionEn || c.description) : lang === "crh" ? (c.descriptionCrh || c.description) : c.description;
    const city = lang === "uk" ? (c.city || m.city) : (c.cityEn || c.city || m.city);
    const mapUrl = m.community ? `https://communities.promedia.report${langPrefix(lang)}/media/?id=${encodeURIComponent(c.id)}` : "";
    const atlasUrl = localizedAtlasUrl(m.atlasUrl, lang);
    const main = mapUrl || atlasUrl || m.website;
    const initials = String(m.name || "").replace(/[«»"'.]/g, "").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const website = m.website || c.website;
    const links = [
      atlasUrl ? `<a href="${escapeHtml(atlasUrl)}">${pick(MEDIA_BOX_ATLAS, lang)} →</a>` : "",
      mapUrl ? `<a href="${escapeHtml(mapUrl)}">${pick(MEDIA_BOX_MAP, lang)} →</a>` : "",
      website ? `<a href="${escapeHtml(website)}" rel="noopener">${pick(MEDIA_BOX_SITE, lang)} ↗</a>` : ""
    ].filter(Boolean).join("");
    return `<li class="people-box-item media-box-item">
      <a class="people-box-photo media-box-logo" href="${escapeHtml(main)}" aria-hidden="true" tabindex="-1"><span>${escapeHtml(initials)}</span>${(m.logo || c.logo) ? `<img src="${escapeHtml(m.logo || c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</a>
      <div><a class="people-box-name" href="${escapeHtml(main)}">${escapeHtml(m.name)}</a>
      ${city ? `<p class="people-box-role">${escapeHtml(city)}</p>` : ""}
      ${description ? `<p class="people-box-summary">${escapeHtml(description)}</p>` : ""}
      <p class="media-box-links">${links}</p></div>
    </li>`;
  }).join("");
  return `<aside class="people-box media-box" aria-label="${escapeHtml(pick(MEDIA_BOX_TITLE, lang))}"><h2>${pick(MEDIA_BOX_TITLE, lang)}</h2><ul>${rows}</ul></aside>`;
}

export function renderArticlePage({ article, lang, baseUrl, relatedMediaNames = [], relatedUniversities = [], popularArticles = [] }) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const articleUrl = `${baseUrl}${langPrefix(lang)}/article/${article.slug}`;
  const { caption: coverCaptionText, bodyMd } = coverCaption(article, lang, localizedField(article, "body_md", lang));
  const bodyHtmlContent = markdownToHtml(bodyMd);
  const tags = JSON.parse(article.tags || "[]");
  // Рубрика (Новини, Статті, Пресреліз, Анонс…) — у рядку з датою; тематичні теги — під текстом.
  const rubricTags = tags.filter(t => LEAD_RUBRICS[t] || specialTagClass(t));
  const topicTags = tags.filter(t => !rubricTags.includes(t));
  const coverUrl = articleCover(article, lang);
  const coverAlt = articleCoverAlt(article, lang, title);
  const coverImg = coverUrl
    ? `<img class="article-cover" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(coverAlt)}"${articleFocalStyle(article, lang, "desktop")} />`
    : "";
  const cover = coverImg && coverCaptionText
    ? `<figure class="article-cover-figure">${coverImg}<figcaption class="article-caption">${inlineMarkdown(coverCaptionText)}</figcaption></figure>`
    : coverImg;
  const mediaLinksHtml = mediaBox(relatedMediaNames, lang);
  const bodyHtml = `
<main class="wrap article-page article-page--with-aside">
  <div class="article-main">
  <p class="article-back"><a href="${langPrefix(lang)}/">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
  <h1>${escapeHtml(title)}</h1>
  ${articleMeta(article, lang).replace('<p class="article-date">', `<p class="article-date">${rubricTags.length ? rubricTags.map(t => `<a class="article-rubric${specialTagClass(t)}" href="${langPrefix(lang)}/?tag=${encodeURIComponent(t)}">${escapeHtml(tagLabel(t, lang))}</a>`).join(" · ") + " · " : ""}`)}
  ${articleShareBlock({ title, excerpt, articleUrl, lang, coverUrl, coverFocus: coverFocusPoint(article, lang) })}
  ${cover}
  ${listenPlayer(article, lang)}
  <div class="article-body">${withGoogleSourceStrip(bodyHtmlContent, lang)}</div>
  ${topicTags.length ? `<div class="article-tags-bottom">${tagLinks(topicTags, lang)}</div>` : ""}
  ${followBlock(lang, "article-end")}
  ${newsletterSlot(lang, "article-end")}
  ${peopleBox(tags, lang)}
  ${mediaLinksHtml}
  ${universitiesBox(relatedUniversities, lang)}
  ${projectPromo(lang, "atlas", "article-bottom")}
  </div>
  ${articleAside(popularArticles, lang)}
</main>`;
  return pageShell({
    title: `${title} — ${pick(SITE_NAME, lang)}`,
    description: excerpt,
    url: articleUrl,
    ogImage: socialCover(article, lang) || coverUrl || undefined,
    ogType: "article",
    publishedAt: article.published_at,
    modifiedAt: article.updated_at || undefined,
    imageAlt: coverUrl ? coverAlt : undefined,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: title.slice(0, 110),
      description: excerpt,
      inLanguage: lang === "crh" ? "crh" : lang,
      mainEntityOfPage: articleUrl,
      url: articleUrl,
      datePublished: article.published_at || undefined,
      dateModified: article.updated_at || article.published_at || undefined,
      image: coverUrl ? [new URL(coverUrl, articleUrl).toString()] : undefined,
      keywords: tags.join(", ") || undefined,
      author: { "@type": "Organization", name: "ГО «ПроМедіа»", url: "https://promedia.report" },
      publisher: { "@type": "Organization", name: "ГО «ПроМедіа»", url: "https://promedia.report",
        logo: { "@type": "ImageObject", url: new URL("/favicon.png", articleUrl).toString() } }
    },
    lang,
    bodyHtml
  });
}

// Права колонка статті на десктопі (owner, 2026-11-22): «Найчитаніше», підписка на розсилку
// і липкий блок плоских банерів сервісів ПроМедіа. На мобільних колонку приховано.
const ASIDE_POPULAR_LABEL = { uk: "Найчитаніше за місяць", en: "Most read this month", crh: "Ay içinde en çoq oqulğanlar" };
const ASIDE_SERVICES_LABEL = { uk: "Сервіси ПроМедіа", en: "ProMedia services", crh: "ProMedia hizmetleri" };
const ASIDE_SERVICES = [
  { key: "atlas", url: NETWORK_URLS.atlas,
    title: { uk: "Атлас медіа", en: "Media Atlas", crh: "Mediya atlası" },
    text: { uk: "Хто володіє українськими медіа — реєстр Нацради щомісяця", en: "Who owns Ukrainian media — the regulator's registry, monthly", crh: "Ukrain mediyalarına kim saip" } },
  { key: "communities", url: NETWORK_URLS.communities,
    title: { uk: "Карта медійних спільнот", en: "Media communities map", crh: "Mediya cemaatları haritası" },
    text: { uk: "Місцеві медіа та спільноти навколо них по всій Україні", en: "Local media and their communities across Ukraine", crh: "Bütün Ukrainadaki yerli mediyalar" } },
  { key: "ratings", url: NETWORK_URLS.ratings,
    title: { uk: "Рейтинг журфаків", en: "Journalism schools ranking", crh: "Jurnalistika fakultetleri reytingi" },
    text: { uk: "Де вчитися журналістики: рейтинг за даними вступу", en: "Where to study journalism: a ranking based on admissions data", crh: "Jurnalistikanı qayda ögrenmeli" } },
  { key: "people", url: { uk: "https://people.promedia.report/", en: "https://people.promedia.report/", crh: "https://people.promedia.report/" },
    title: { uk: "Люди", en: "People", crh: "İnsanlar" },
    text: { uk: "Досьє журналістів, медійників і комунікаційників", en: "Profiles of journalists and media people", crh: "Jurnalistlerniñ dosyeleri" } }
];

function articleAside(popular, lang) {
  const items = (popular || []).slice(0, 10);
  const popularHtml = items.length ? `<section class="article-aside-block article-aside-popular">
      <h2 class="article-aside-title">${escapeHtml(pick(ASIDE_POPULAR_LABEL, lang))}</h2>
      <ol>${items.map(a => `<li><a href="${langPrefix(lang)}/article/${escapeHtml(a.slug)}">${escapeHtml(articleTitle(a, lang))}</a></li>`).join("")}</ol>
    </section>` : "";
  const services = ASIDE_SERVICES.map(sv => `<a class="article-aside-service article-aside-service--${sv.key}" href="${escapeHtml(pick(sv.url, lang))}">
        <strong>${escapeHtml(pick(sv.title, lang))} <span aria-hidden="true">↗</span></strong>
        <span>${escapeHtml(pick(sv.text, lang))}</span>
      </a>`).join("");
  return `<aside class="article-aside" aria-label="${escapeHtml(pick(ASIDE_SERVICES_LABEL, lang))}">
    ${popularHtml}
    ${newsletterSlot(lang, "sidebar")}
    ${followBlock(lang, "sidebar")}
    <div class="article-aside-sticky">
      <h2 class="article-aside-title">${escapeHtml(pick(ASIDE_SERVICES_LABEL, lang))}</h2>
      ${services}
    </div>
  </aside>`;
}

// Newsletter (owner, 2026-11-20): empty, hidden slots filled by /js/promedia-newsletter.js
// only after the Events list goes live (or in ?pm_newsletter=preview). Ukrainian only.
function newsletterSlot(lang, placement) {
  return lang === "uk" ? `<div class="pm-nl-slot" data-pm-newsletter="${placement}" hidden></div>` : "";
}

export function renderNewsletterPage({ baseUrl }) {
  const bodyHtml = `
<main class="wrap article-page newsletter-page">
  <p class="article-back"><a href="/">${pick(BACK_TO_NEWS_LABEL, "uk")}</a></p>
  <h1>Розсилка ProMedia Report</h1>
  <div class="article-body">
    <p>Раз на тиждень надсилаємо головне про медіа та комунікації: найважливіші новини, дослідження й можливості для журналістів і комунікаційників. На початку кожного листа — коротке слово від редакції.</p>
    <p>Лист приходить лише тим, хто підтвердив підписку. Відписатися можна в один клік у будь-якому листі.</p>
  </div>
  <div data-pm-newsletter="page"><p class="newsletter-page-soon">Підписка відкриється найближчим часом.</p></div>
</main>`;
  return pageShell({ title: "Розсилка ProMedia Report — ПроМедіа", description: "Головне про медіа та комунікації — раз на тиждень у вашій пошті.", url: `${baseUrl}/rozsylka/`, lang: "uk", bodyHtml });
}

const NOT_FOUND_LABEL = { uk: "Сторінку не знайдено.", en: "Page not found.", crh: "Saife tapılmadı." };

export function renderNotFound(lang, baseUrl) {
  const bodyHtml = `
<main class="wrap">
  <p class="empty-state">${pick(NOT_FOUND_LABEL, lang)}</p>
  <p><a href="${langPrefix(lang)}/">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
</main>`;
  return pageShell({
    title: pick(SITE_NAME, lang),
    description: pick(SITE_TAGLINE, lang),
    url: `${baseUrl}${langPrefix(lang)}/`,
    lang,
    bodyHtml
  });
}
