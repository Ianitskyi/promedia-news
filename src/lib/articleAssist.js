import { markdownToPlainText } from "./markdown.js";

const TAG_VOCABULARY = [
  "Заяви",
  "Новини",
  "Статті",
  "освіта",
  "журналістська освіта",
  "вступ",
  "рейтинг журфаків",
  "українські медіа",
  "війна",
  "безпека журналістів",
  "дослідження",
  "Львівський медіафорум",
  "стійкість медіа",
  "державні комунікації",
  "суспільство",
  "військова реформа",
  "інтерв’ю",
  "студенти",
  "Україна",
  "Японія",
  "медійні спільноти",
  "локальні медіа",
  "карта спільнот",
  "медіаправо",
  "Верховна Рада",
  "доступ журналістів",
  "парламент",
  "фактчекінг",
  "журналістські розслідування",
  "ІРРП",
  "Суспільне",
  "державний бюджет",
  "медіаполітика",
  "незалежні медіа",
  "членство",
  "Велика Британія",
  "Чернігів"
];

const ASSIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titleEn", "excerptEn", "bodyMdEn", "titleCrh", "excerptCrh", "bodyMdCrh", "tags"],
  properties: {
    titleEn: { type: "string" },
    excerptEn: { type: "string" },
    bodyMdEn: { type: "string" },
    titleCrh: { type: "string" },
    excerptCrh: { type: "string" },
    bodyMdCrh: { type: "string" },
    tags: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" }
    }
  }
};

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTags(value) {
  return Array.isArray(value) && value.some((tag) => String(tag || "").trim());
}

function normalizeTags(tags) {
  const seen = new Set();
  return (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLocaleLowerCase("uk-UA");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function responseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("");
}

function applyAssistedFields(body, assisted) {
  if (!assisted) return body;
  return {
    ...body,
    titleEn: hasText(body.titleEn) ? body.titleEn : assisted.titleEn,
    excerptEn: hasText(body.excerptEn) ? body.excerptEn : assisted.excerptEn,
    bodyMdEn: hasText(body.bodyMdEn) ? body.bodyMdEn : assisted.bodyMdEn,
    titleCrh: hasText(body.titleCrh) ? body.titleCrh : assisted.titleCrh,
    excerptCrh: hasText(body.excerptCrh) ? body.excerptCrh : assisted.excerptCrh,
    bodyMdCrh: hasText(body.bodyMdCrh) ? body.bodyMdCrh : assisted.bodyMdCrh,
    tags: hasTags(body.tags) ? body.tags : assisted.tags
  };
}

// Small, source-backed guardrail for mistakes that have already appeared in
// generated copy. It deliberately avoids grammar-changing rewrites.
function normalizeCrimeanTatar(text) {
  return String(text || "")
    .replace(/\bTesebbüs\b/g, "Teşebbüs")
    .replace(/\bTelevizor(?=\s+ve\s+radio)/g, "Televideniye")
    .replace(/\bUkrayna\b/g, "Ukraina")
    .replace(/\bUkraina\s+da\b/g, "Ukrainada")
    .replace(/\bmedya\b/g, "mediya")
    .replace(/\bspileñost\b/g, "cemaat")
    .replace(/\bxəritede\b/g, "haritada")
    .replace(/\bxəriteni\b/g, "haritanı")
    .replace(/\bxərite\b/g, "harita")
    .replace(/\bYanitskyi\b/g, "Ianitskyi");
}

export async function generateArticleAssist(env, article) {
  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are an experienced Ukrainian-American editor for ProMedia NGO, and also a professional Crimean Tatar translator.",
                "Translate Ukrainian news copy into natural American English for international audiences, and separately into Crimean Tatar (Qırımtatar tili) using the modern Latin orthography, for the indigenous Crimean Tatar audience.",
                "For Crimean Tatar, follow the modern Latin literary norm. Do not invent a word merely because it resembles Turkish, Azerbaijani, Ukrainian, Russian or English. Preserve an official Ukrainian registry marker, code or an organization’s established spelling when a reliable Crimean Tatar equivalent is not known.",
                "Before returning the Crimean Tatar draft, perform a strict self-check: retain every fact, number, date, link, heading and list item; keep the required Latin special letters; do not leave Ukrainian or Russian prose behind; and do not replace a data match with a word meaning a chance coincidence.",
                "Preserve facts, dates, names, links, Markdown headings, lists, blockquotes, bold, italics and link syntax in both translations.",
                "Use established English names where clear: ГО «ПроМедіа» = ProMedia NGO, ІРРП = RPDI, Суспільне = Suspilne, Львівський медіафорум = Lviv Media Forum, Андрій Яніцький = Andrii Ianitskyi.",
                "Always spell Andrii Ianitskyi exactly this way in both translations. Never use the spelling Yanitskyi.",
                "In the Crimean Tatar translation, keep ГО «ПроМедіа» as \"ProMedia İCT\", and keep other organization names and untranslatable proper nouns in Latin transliteration.",
                "Crimean Tatar source hierarchy: use the DESS orthography standard (https://dess.gov.ua/wp-content/uploads/2025/04/Dodatok-1.1.-Pravopys-1.pdf) for modern Latin spelling and punctuation; use the Ukrainian-Crimean Tatar dictionary of the Ukrainian Linguistic Information Fund (https://lcorp.ulif.org.ua/LSen/) and Ana Yurt Luğat (https://ana-yurt.com/lugat) for lexical meaning; use the National Corpus of the Crimean Tatar Language (https://ctcorpus.org/uk/) to prefer attested collocations and natural context when available.",
                "Apply dictionaries and the corpus as terminology and usage checks, not as word-for-word translators: preserve natural Crimean Tatar grammar, syntax, case, agreement and context. If the dictionary offers several equivalents, choose the one that best matches the media, journalism, civil-society or communications context. If no source-backed equivalent is available, use a clear neutral wording or preserve the established international term rather than inventing a calque.",
                "Do not invent a Crimean Tatar term merely to avoid a loanword. If Ana Yurt has no suitable entry or the established proper/professional term should remain unchanged, use the established Crimean Tatar form, a conventional international term, or Latin transliteration as appropriate.",
                "Use these established Crimean Tatar forms exactly: Initiative = Teşebbüs; television broadcasting = Televideniye. Never use Tesebbüs or Televizor for these meanings. Keep the Ukrainian registry marker ФОП as \"ФОП / FOP\" rather than inventing an abbreviation.",
                "Apply ProMedia's source-checked editorial glossary consistently: Ukraine = Ukraina (and Ukrainada for 'in Ukraine'); media = mediya; a media community = cemaat; research = tedqiqat; news = haber. Prefer leyha for a ProMedia product project, while proyekt is acceptable where it is the established conventional term. Never substitute Ukrainian or Turkish look-alikes such as Ukrayna, medya, or spileñost for these concepts. Do not translate the Ukrainian word \"війна\" as \"occupation\"; preserve its meaning as war unless the source explicitly says occupation.",
                "The Crimean Tatar Latin alphabet here uses ç, ğ, ñ, ö, ş, ü, ı, İ and â where appropriate. Never introduce letters from Azerbaijani, especially ə. Use harita for map and its natural forms, not xəritə.",
                "After translating, perform a second terminology pass: check consistency of repeated terms, modern Crimean Tatar Latin orthography, names, special letters, and the absence of Ukrainian or Russian prose. Do not render data matches as a chance coincidence. Facts, meaning, dates, quotations, links and Markdown structure must remain unchanged.",
                "Create a concise English SEO excerpt under 170 characters, and a concise Crimean Tatar SEO excerpt under 170 characters.",
                "Return canonical tags in Ukrainian. Include one broad category from: Заяви, Новини, Статті. Add 1-5 topical tags, preferably from this vocabulary: " + TAG_VOCABULARY.join(", ") + ".",
                "If only the Ukrainian title is present, translate the title into both languages, create conservative tags from the title only, and leave bodyMdEn and bodyMdCrh empty.",
                "Do not add facts, quotes, links or sources that are not present in the Ukrainian text."
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                titleUk: article.title || "",
                excerptUk: article.excerpt || "",
                bodyMdUk: article.bodyMd || ""
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "promedia_article_assist",
          strict: true,
          schema: ASSIST_SCHEMA
        }
      }
    })
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error("OpenAI returned a non-JSON response");
  }
  if (!response.ok) {
    throw new Error(data && data.error && data.error.message ? data.error.message : `OpenAI API ${response.status}`);
  }

  const parsed = JSON.parse(responseText(data));
  return {
    titleEn: String(parsed.titleEn || "").trim(),
    excerptEn: String(parsed.excerptEn || "").trim(),
    bodyMdEn: String(parsed.bodyMdEn || "").trim(),
    titleCrh: normalizeCrimeanTatar(parsed.titleCrh).trim(),
    excerptCrh: normalizeCrimeanTatar(parsed.excerptCrh).trim(),
    bodyMdCrh: normalizeCrimeanTatar(parsed.bodyMdCrh).trim(),
    tags: normalizeTags(parsed.tags)
  };
}

export async function completeArticleDraft(body, env) {
  if (!body || !hasText(body.title) || !hasText(body.bodyMd)) return body;
  const needsAssist = !hasText(body.titleEn) || !hasText(body.excerptEn) || !hasText(body.bodyMdEn)
    || !hasText(body.titleCrh) || !hasText(body.excerptCrh) || !hasText(body.bodyMdCrh) || !hasTags(body.tags);
  if (!needsAssist) return body;

  let assisted = null;
  try {
    assisted = await generateArticleAssist(env, {
      title: body.title,
      excerpt: body.excerpt || markdownToPlainText(body.bodyMd || "", 200),
      bodyMd: body.bodyMd
    });
  } catch (err) {
    console.warn("Article assist failed", err && err.message ? err.message : err);
  }
  if (!assisted) return body;

  return applyAssistedFields(body, assisted);
}
