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
  required: ["titleEn", "excerptEn", "bodyMdEn", "tags"],
  properties: {
    titleEn: { type: "string" },
    excerptEn: { type: "string" },
    bodyMdEn: { type: "string" },
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
    tags: hasTags(body.tags) ? body.tags : assisted.tags
  };
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
                "You are an experienced Ukrainian-American editor for ProMedia NGO.",
                "Translate Ukrainian news copy into natural American English for international audiences.",
                "Preserve facts, dates, names, links, Markdown headings, lists, blockquotes, bold, italics and link syntax.",
                "Use established English names where clear: ГО «ПроМедіа» = ProMedia NGO, ІРРП = RPDI, Суспільне = Suspilne, Львівський медіафорум = Lviv Media Forum.",
                "Create a concise English SEO excerpt under 170 characters.",
                "Return canonical tags in Ukrainian. Include one broad category from: Заяви, Новини, Статті. Add 1-5 topical tags, preferably from this vocabulary: " + TAG_VOCABULARY.join(", ") + ".",
                "If only the Ukrainian title is present, translate the title, create conservative tags from the title only, and leave bodyMdEn empty.",
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
    tags: normalizeTags(parsed.tags)
  };
}

export async function completeArticleDraft(body, env) {
  if (!body || !hasText(body.title) || !hasText(body.bodyMd)) return body;
  const needsAssist = !hasText(body.titleEn) || !hasText(body.excerptEn) || !hasText(body.bodyMdEn) || !hasTags(body.tags);
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
