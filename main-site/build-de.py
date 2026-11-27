# Builds the German homepage static/de/index.html from the English one (26.11.2026).
# Run after every change to static/en/index.html:  python3 main-site/build-de.py
# The script stops if an English string below is no longer found, so a changed text is never left untranslated.
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent / "static"
s = (ROOT / "en" / "index.html").read_text(encoding="utf-8")

# Structure: language, own URLs, links to ProMedia sites that already have German.
STRUCT = [
    ('<html lang="en"', '<html lang="de"'),
    ('<link rel="canonical" href="https://promedia.report/en/">', '<link rel="canonical" href="https://promedia.report/de/">'),
    ('<meta property="og:url" content="https://promedia.report/en/">', '<meta property="og:url" content="https://promedia.report/de/">'),
    ('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="de_DE">'),
    ('href="https://projects.promedia.report/en/', 'href="https://projects.promedia.report/de/'),
    ('data-base="https://projects.promedia.report/en/project/"', 'data-base="https://projects.promedia.report/de/project/"'),
    ('data-home="https://projects.promedia.report/en/"', 'data-home="https://projects.promedia.report/de/"'),
    # Mobile news-format chips on the homepage (27.11.2026).
    ('<nav class="pm-formats-nav" aria-label="ProMedia news formats"><a class="pm-format-chip" href="https://news.promedia.report/en/">All</a><a class="pm-format-chip pm-format-chip--top" href="https://news.promedia.report/en/?sort=top">Top</a><a class="pm-format-chip pm-format-chip--news" href="https://news.promedia.report/en/?tag=%D0%9D%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8">News</a><a class="pm-format-chip pm-format-chip--articles" href="https://news.promedia.report/en/?tag=%D0%A1%D1%82%D0%B0%D1%82%D1%82%D1%96">Articles</a><a class="pm-format-chip pm-format-chip--press" href="https://news.promedia.report/en/?tag=%D0%9F%D1%80%D0%B5%D1%81%D1%80%D0%B5%D0%BB%D1%96%D0%B7">Press releases</a><a class="pm-format-chip pm-format-chip--announce" href="https://news.promedia.report/en/?tag=%D0%90%D0%BD%D0%BE%D0%BD%D1%81">Announcements</a></nav>',
     '<nav class="pm-formats-nav" aria-label="Formate der ProMedia-Nachrichten"><a class="pm-format-chip" href="https://news.promedia.report/de/">Alle</a><a class="pm-format-chip pm-format-chip--top" href="https://news.promedia.report/de/?sort=top">Top</a><a class="pm-format-chip pm-format-chip--news" href="https://news.promedia.report/de/?tag=%D0%9D%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8">Nachrichten</a><a class="pm-format-chip pm-format-chip--articles" href="https://news.promedia.report/de/?tag=%D0%A1%D1%82%D0%B0%D1%82%D1%82%D1%96">Artikel</a><a class="pm-format-chip pm-format-chip--press" href="https://news.promedia.report/de/?tag=%D0%9F%D1%80%D0%B5%D1%81%D1%80%D0%B5%D0%BB%D1%96%D0%B7">Pressemitteilungen</a><a class="pm-format-chip pm-format-chip--announce" href="https://news.promedia.report/de/?tag=%D0%90%D0%BD%D0%BE%D0%BD%D1%81">Ankündigungen</a></nav>'),
    ('data-lang="en"', 'data-lang="de"'),
    ('lang="en";', 'lang="de";'),
    ('function fmt(n){return lang==="en"?n.toLocaleString("en-US")', 'function fmt(n){return lang==="en"?n.toLocaleString("en-US"):lang==="de"?n.toLocaleString("de-DE")'),
    ('return lang==="en"?(p[k+"En"]||p[k])', 'return lang==="de"?(p[k+"De"]||p[k+"En"]||p[k]):lang==="en"?(p[k+"En"]||p[k])'),
]
# Visible text (English → German). Longer strings first.
TEXT = [
    ("ProMedia supports independent media and civil society organizations through research, training, strategic communications and community building.",
     "ProMedia unterstützt unabhängige Medien und zivilgesellschaftliche Organisationen in der Ukraine mit Forschung, Weiterbildung, strategischer Kommunikation und Community-Aufbau."),
    ("We help independent media better understand themselves and their audiences, develop products, build communities and strengthen organizational resilience.",
     "Wir helfen unabhängigen Medien, sich selbst und ihr Publikum besser zu verstehen, Produkte zu entwickeln, Communitys aufzubauen und ihre organisatorische Widerstandsfähigkeit zu stärken."),
    ("We research media markets, audiences, content and communications so your decisions are based on data, not intuition.",
     "Wir erforschen Medienmärkte, Publikum, Inhalte und Kommunikation, damit Ihre Entscheidungen auf Daten beruhen und nicht auf Bauchgefühl."),
    ("We help civil society organizations and public-interest initiatives turn complex work into clear, strong and ethical communications.",
     "Wir helfen zivilgesellschaftlichen Organisationen und gemeinwohlorientierten Initiativen, komplexe Arbeit in klare, starke und ethische Kommunikation zu übersetzen."),
    ("We create academic and practical training programs: lectures, seminars, simulation exercises and labs for team development.",
     "Wir entwickeln wissenschaftlich fundierte und praxisnahe Weiterbildungsprogramme: Vorlesungen, Seminare, Planspiele und Labore für die Teamentwicklung."),
    ("We focus on four areas where ProMedia creates measurable value.", "Wir konzentrieren uns auf vier Bereiche, in denen ProMedia messbaren Mehrwert schafft."),
    ("unique entries in the Atlas of registered media", "einzelne Einträge im Atlas der registrierten Medien"),
    ("media outlets on the Communities Map", "Medien auf der Community-Karte"),
    ("universities in the J-school ranking", "Universitäten im Journalistik-Ranking"),
    ("profiles of media people", "Profile von Medienschaffenden"),
    ("Ukraine’s Journalism Program Ranking", "Ranking der Journalistik-Studiengänge in der Ukraine"),
    ("ProMedia | Media Development", "ProMedia | Medienentwicklung"),
    ("Strategic Communications", "Strategische Kommunikation"),
    ("Four core strengths", "Vier Kernkompetenzen"),
    ("Media Development", "Medienentwicklung"),
    ("ProMedia projects", "Projekte von ProMedia"),
    ("All projects", "Alle Projekte"),
    ("What we do", "Was wir tun"),
    ("In numbers", "In Zahlen"),
    ("Media Atlas", "Medienatlas"),
    ("Projects:", "Projekte:"),
    (">Projects<", ">Projekte<"),
    (">Research<", ">Forschung<"),
    (">Training<", ">Weiterbildung<"),
    ('data-live="Ongoing"', 'data-live="Laufend"'),
]
for old, new in STRUCT + TEXT:
    if old not in s:
        sys.exit(f"Not found in en/index.html: {old[:80]}")
    s = s.replace(old, new)
# hreflang for German on top of the English list (uk, en, crh stay as they are).
if 'hreflang="de"' not in s:
    s = s.replace('<link rel="alternate" hreflang="crh" href="https://promedia.report/crh/">',
                  '<link rel="alternate" hreflang="crh" href="https://promedia.report/crh/"><link rel="alternate" hreflang="de" href="https://promedia.report/de/">', 1)
out = ROOT / "de" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(s, encoding="utf-8")
print("wrote", out)
