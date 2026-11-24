# Builds the English and Crimean Tatar versions of about.promedia.report from public/index.html.
# Run after every change to the Ukrainian page:  python3 about-site/build-translations.py
# Each Ukrainian string that changed needs a new line in T below; the script stops if a string is missing.
# The Crimean Tatar text is a draft for review by a native speaker (docs/CRIMEAN_TATAR_TRANSLATION_RULES.md).
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent / "public"
SRC = (ROOT / "index.html").read_text(encoding="utf-8")

# (Ukrainian, English, Crimean Tatar). Longer strings first, so that parts are not replaced inside them.
T = [
    ("ГО «ПроМедіа» розвиває незалежні медіа та комунікації в Україні: дослідження, інструменти на основі відкритих даних, навчання. Хто ми, результати, проєкти, команда.",
     "The NGO ProMedia develops independent media and communications in Ukraine through research, open-data tools and training. Who we are, our results, projects and team.",
     "ProMedia İCT Ukrayinada serbest mediya ve kommunikatsiyalarnı inkişaf ete: tedqiqatlar, açıq malümat esasında aletler, talim. Biz kimmiz, neticeler, leyhalar, komanda."),
    ("Посилюємо медіа та громадські організації: розвиток медіа, дослідження, комунікації, навчання.",
     "We strengthen media and civil society organisations: media development, research, communications and training.",
     "Mediya ve cemiyet teşkilâtlarını küçlendiremiz: mediya inkişafı, tedqiqatlar, kommunikatsiyalar, talim."),
    ("«ПроМедіа» — громадська організація, створена журналістами і фахівцями з комунікацій. Ми допомагаємо українським медіа та громадським організаціям ставати сильнішими: краще розуміти свою аудиторію, розвивати нові продукти й зміцнювати організаційну стійкість.",
     "ProMedia is a non-governmental organisation founded by journalists and communications professionals. We help Ukrainian media and civil society organisations grow stronger: understand their audiences better, develop new products and build organisational resilience.",
     "ProMedia — gazeteciler ve kommunikatsiya mütehassısları tarafından yaratılğan cemiyet teşkilâtı. Biz ukrain mediyasına ve cemiyet teşkilâtlarına küçlenmege yardım etemiz: auditoriyasını daa yaqşı añlamağa, yañı mahsulatlar inkişaf etmege ve teşkilâtnıñ mukemmelligini peqitmege."),
    ("Допомагаємо незалежним медіа краще розуміти себе та свою аудиторію, розвивати продукти, будувати спільноти й зміцнювати організаційну стійкість.",
     "We help independent media understand themselves and their audiences better, develop products, build communities and strengthen organisational resilience.",
     "Serbest mediyağa özüni ve auditoriyasını daa yaqşı añlamağa, mahsulatlar inkişaf etmege, cemaatlar qurmağa ve teşkilâtnıñ mukemmelligini peqitmege yardım etemiz."),
    ("Досліджуємо медіаринок, аудиторії, контент і комунікації, щоб допомагати командам ухвалювати обґрунтовані рішення.",
     "We research the media market, audiences, content and communications to help teams make evidence-based decisions.",
     "Komandalarğa esaslı qararlar qabul etmege yardım etmek içün mediya bazarını, auditoriyalarnı, kontentni ve kommunikatsiyalarnı tedqiq etemiz."),
    ("Допомагаємо громадським організаціям і суспільно важливим ініціативам зрозуміло й переконливо розповідати про свою роботу — з дотриманням етичних стандартів.",
     "We help civil society organisations and socially important initiatives tell clear and convincing stories about their work, in line with ethical standards.",
     "Cemiyet teşkilâtlarına ve cemiyet içün müim teşebbüslerge öz işi aqqında añlayışlı ve inandırıcı olaraq, etik standartlarğa riayet etip, aytıp bermege yardım etemiz."),
    ("Розробляємо навчальні програми, що поєднують наукові підходи з практикою: лекції, семінари, ситуаційні ігри та лабораторії для розвитку команд.",
     "We design training programmes that combine academic approaches with practice: lectures, seminars, simulation games and labs for team development.",
     "İlmiy yanaşmalarnı ameliyatnen birleştirgen talim programmaları azırlaymız: lektsiyalar, seminarlar, vaziyet oyunları ve komandalarnı inkişaf ettirüv laboratoriyaları."),
    ("Журналісти Андрій Яніцький та Анна Родічкіна запускають розсилку про медіа та комунікації — з неї починається бренд ProMedia.",
     "Journalists Andrii Ianitskyi and Anna Rodichkina launch a newsletter about media and communications. The ProMedia brand starts with it.",
     "Gazeteciler Andrii Ianitskyi ve Anna Rodichkina mediya ve kommunikatsiyalar aqqında mektüp yayınını başlatalar — ProMedia brendi ondan başlana."),
    ("На основі розсилки виходить відеопроєкт про медіа «Дедлайн» на YouTube.",
     "Building on the newsletter, the video project about media «Deadline» comes out on YouTube.",
     "Mektüp yayını esasında YouTube-da mediya aqqında «Deadline» video leyhası çıqa."),
    ("До Андрія та Анни приєднуються Катерина Грищенко й Анастасія Сімонова. Четверо однодумців реєструють громадську організацію.",
     "Kateryna Hryshchenko and Anastasiia Simonova join Andrii and Anna. The four like-minded people register a non-governmental organisation.",
     "Andrii ve Annağa Kateryna Hryshchenko ile Anastasiia Simonova qoşula. Dört fikirdeş cemiyet teşkilâtını qayd eteler."),
    ("Перші власні онлайн-інструменти для вивчення ринку медіа та журналістської освіти",
     "Our first online tools for studying the media market and journalism education",
     "Mediya bazarını ve jurnalistika maarifini ögrenmek içün ilk öz onlayn aletlerimiz"),
    ("Запускаємо Рейтинг журфаків України, Карту медійних спільнот і Атлас медіа.",
     "We launch the Ranking of Ukrainian Journalism Schools, the Map of Media Communities and the Media Atlas.",
     "Ukrayinanıñ jurnalistika fakülteleri reytingini, Mediya cemaatları haritasını ve Mediya Atlasını başlatamız."),
    ("Проводимо чотири воркшопи для журналістів і представників громадських організацій, реалізуємо спільні проєкти з IWPR та ІРРП.",
     "We run four workshops for journalists and civil society representatives and carry out joint projects with IWPR and the Regional Press Development Institute.",
     "Gazeteciler ve cemiyet teşkilâtlarınıñ temsilcileri içün dört vorkşop keçiremiz, IWPR ve Regional matbuatnı inkişaf ettirüv institutınen ortaq leyhalar amelge keçiremiz."),
    ("Відповідає за організаційний розвиток і фандрейзинг. Медіа- та комунікаційний менеджер. Раніше очолював комунікації у Державній службі зайнятості, керував розвитком цифрових платформ на телеканалі «Еспресо», очолював Центр журналістики Київської школи економіки та Київську незалежну медіапрофспілку.",
     "Responsible for organisational development and fundraising. Media and communications manager. Previously headed communications at the State Employment Service, led digital platform development at the Espreso TV channel, and headed the Journalism Centre of the Kyiv School of Economics and the Kyiv Independent Media Trade Union.",
     "Teşkilâtnıñ inkişafı ve fandreyzing içün mesuliyet taşıy. Mediya ve kommunikatsiya menecerı. Evelce Devlet iş bulmaq hızmetinde kommunikatsiyalarnı idare etti, «Espreso» telekanalında raqamlı platformalarnıñ inkişafını yolğa qoydı, Kyiv iqtisadiyat mektebiniñ Jurnalistika merkezine ve Kyiv serbest mediya ämeliyat birligine reberlik etti."),
    ("Відповідає за організаційний розвиток і дотримання етичних та професійних стандартів. Редакторка і журналістка з 20-річним досвідом. Керувала благодійними проєктами та великими подіями. Співзасновниця Military Film Week в Одесі.",
     "Responsible for organisational development and compliance with ethical and professional standards. Editor and journalist with 20 years of experience. Has managed charity projects and large events. Co-founder of Military Film Week in Odesa.",
     "Teşkilâtnıñ inkişafı ve etik ile professional standartlarğa riayet etilüvi içün mesuliyet taşıy. 20 yıllıq tecribeli muarrir ve gazeteci. Hayriye leyhalarına ve büyük vaqialarğa reberlik etti. Odesadaki Military Film Week-niñ qurucılarından biri."),
    ("Відповідає за копірайтинг і сторітелінг у команді. Журналістка й редакторка з досвідом роботи з темами бізнесу, економіки та фінансів. Має багаторічний досвід роботи з провідними бізнес-медіа, зокрема Forbes Ukraine та Interfax-Ukraine.",
     "Responsible for copywriting and storytelling in the team. Journalist and editor experienced in covering business, the economy and finance. Has many years of experience with leading business media, including Forbes Ukraine and Interfax-Ukraine.",
     "Komandada kopirayting ve storitelling içün mesuliyet taşıy. Biznes, iqtisadiyat ve finans mevzularınen çalışqan gazeteci ve muarrir. Forbes Ukraine ve Interfax-Ukraine kibi esas biznes mediyalarınen çoq yıllıq iş tecribesi bar."),
    ("Працює з SMM і креативним відеоконтентом. Має досвід у комунікаціях, відеозйомці та дизайні. Поєднує навички від розробки візуального стилю до роботи з людськими історіями, щоб робити діяльність організації ближчою та зрозумілішою для аудиторій.",
     "Works on social media and creative video content. Has experience in communications, video production and design. Combines skills from developing a visual style to working with human stories to make the organisation's work closer and clearer to its audiences.",
     "SMM ve yaratıcı video kontentnen çalışa. Kommunikatsiyalar, video çekimi ve dizaynda tecribesi bar. Teşkilâtnıñ faaliyetini auditoriyalarğa daa yaqın ve añlayışlı yapmaq içün vizual stil yaratuvdan insan hikâyelerinen çalışuvğa qadar becerilerini birleştire."),
    ("Відповідає за комунікаційні процеси в організації. Працювала копірайтеркою в Університеті Короля Данила (Івано-Франківськ), зараз працює комунікаційницею у Центрі студентської карʼєри Українського католицького університету (Львів).",
     "Responsible for communication processes in the organisation. Previously worked as a copywriter at King Danylo University (Ivano-Frankivsk); now works as a communications specialist at the Student Career Centre of the Ukrainian Catholic University (Lviv).",
     "Teşkilâtta kommunikatsiya protsessleri içün mesuliyet taşıy. Qıral Danylo universitetinde (Ivano-Frankivsk) kopirayter olaraq çalıştı, şimdi Ukrain katolik universitetiniñ (Lviv) Talebe kariyerası merkezinde kommunikatsiya mütehassısı olaraq çalışa."),
    ("ГО «ПроМедіа» закликає уряд і парламент передбачити 3,9 млрд грн на Суспільне у бюджеті 2027 року",
     "ProMedia NGO urges government and parliament to allocate UAH 3.9 billion for Suspilne in the 2027 budget",
     "ProMedia İCT ükümetni ve parlamentni 2027 senesi büdcesinde Suspilne içün 3,9 milyard grivna ayırmağa çağıra"),
    ("ГО «ПроМедіа» закликає розслідувати затримання Михайла Ткача і Ярослава Бондаренка",
     "ProMedia NGO calls to investigate the detention of Mykhailo Tkach and Yaroslav Bondarenko",
     "ProMedia İCT Mykhailo Tkach ve Yaroslav Bondarenkonıñ tutuluvını tahqiq etmege çağıra"),
    ("Звернення ГО «ПроМедіа» до уряду й парламенту", "ProMedia NGO's appeal to the government and parliament", "ProMedia İCT-niñ ükümetke ve parlamentke müracaatı"),
    ("Андрій Яніцький, голова ГО «ПроМедіа», в інтерв'ю «Українській Службі Інформації».",
     "Andrii Ianitskyi, chair of the NGO ProMedia, in an interview with the Ukrainian Information Service.",
     "Andrii Ianitskyi, ProMedia İCT reisi, «Ukrain malümat hızmetine» bergen intervyusında."),
    ("Анастасія Сімонова: Тиждень воєнного кіно допомагає цивільним розуміти військових",
     "Anastasiia Simonova: A Military Film Week Helps Civilians Understand Soldiers",
     "Anastasiia Simonova: Cenk kinosı aftası sivillerge askerlerni añlamağa yardım ete"),
    ("Андрій Яніцький: «Коли медіа бреше, це може коштувати життя»",
     "Andrii Ianitskyi: “When media lie, it can cost lives”",
     "Andrii Ianitskyi: «Mediya yalan aytqanda, bu ayatqa mal ola bile»"),
    ("Українські медіа демонструють винахідливість під подвійним тиском",
     "Ukrainian media show ingenuity under double pressure",
     "Ukrain mediyası çift basqı altında becerikliligini köstere"),
    ("Чому замість телемарафону мають бути конкурси для медіа",
     "Why media grant competitions should replace the national telethon (in Ukrainian)",
     "Nege telemarafon yerine mediya içün yarışlar olmalı (ukrain tilinde)"),
    ("Напередодні суворої зими. Як медіа працюють в Україні", "On the eve of a harsh winter. How media work in Ukraine", "Sert qış arfesinde. Ukrayinada mediya nasıl çalışa"),
    ("Розмова з Андрієм Яніцьким для The Fix Media", "Conversation with Andrii Ianitskyi for The Fix Media", "The Fix Media içün Andrii Ianitskyinen subet"),
    ("Інтерв'ю «Українській Службі Інформації»", "Interview with the Ukrainian Information Service", "«Ukrain malümat hızmetine» intervyu"),
    ("Колонка Андрія Яніцького для Press Emblem Campaign", "Column by Andrii Ianitskyi for Press Emblem Campaign", "Andrii Ianitskyiniñ Press Emblem Campaign içün maqalesi"),
    ("Колонка Андрія Яніцького для LIGA.net", "Column by Andrii Ianitskyi for LIGA.net", "Andrii Ianitskyiniñ LIGA.net içün maqalesi"),
    ("Медіа — це інфраструктура демократії", "Media are the infrastructure of democracy", "Mediya — demokratiyanıñ infrastrukturası"),
    ("та відповідальні комунікації в Україні з 2025 року", "and responsible communications in Ukraine since 2025", "ve mesuliyetli kommunikatsiyalarnı 2025 senesinden berli inkişaf etemiz"),
    ("Навчальні програми та спільні проєкти", "Training programmes and joint projects", "Talim programmaları ve ortaq leyhalar"),
    ("Відеопроєкт «Дедлайн» на YouTube", "Video project «Deadline» on YouTube", "YouTube-da «Deadline» video leyhası"),
    ("Громадська організація «ПроМедіа»", "The NGO ProMedia", "ProMedia İCT cemiyet teşkilâtı"),
    ("Інтерв'ю Софії Дубік", "Interview by Sofiia Dubik", "Sofiia Dubikniñ intervyusı"),
    ("Заява ГО «ПроМедіа»", "Statement by the NGO ProMedia", "ProMedia İCT-niñ beyanatı"),
    ("Про нас — ГО «ПроМедіа»", "About us — NGO ProMedia", "Biz aqqımızda — ProMedia İCT"),
    ("Розсилка ProMedia Report", "ProMedia Report newsletter", "ProMedia Report mektüp yayını"),
    ("Стратегія та партнерства", "Strategy and partnerships", "Strategiya ve ortaqlıqlar"),
    ("Липень — вересень 2026", "July — September 2026", "2026 senesi iyul — sentâbr"),
    ("Сторітелінг і тексти", "Storytelling and texts", "Storitelling ve metinler"),
    ("Політики та стандарти", "Policies and standards", "Siyasetler ve standartlar"),
    ("Розділи сторінки", "Page sections", "Saife bölükleri"),
    ("Відео та контент", "Video and content", "Video ve kontent"),
    ("Розвиток медіа", "Media development", "Mediya inkişafı"),
    ("Читати інтерв'ю", "Read the interview", "İntervyunı oqumaq"),
    ("Андрій Яніцький", "Andrii Ianitskyi", "Andrii Ianitskyi"),
    ("Анастасія Сімонова", "Anastasiia Simonova", "Anastasiia Simonova"),
    ("Анна Родічкіна", "Anna Rodichkina", "Anna Rodichkina"),
    ("Катерина Грищенко", "Kateryna Hryshchenko", "Kateryna Hryshchenko"),
    ("Софія Дубік", "Sofiia Dubik", "Sofiia Dubik"),
    ("незалежні медіа", "independent media", "serbest mediyanı"),
    ("Стежте за нами", "Follow us", "Bizni taqip etiñiz"),
    ("Усі проєкти", "All projects", "Bütün leyhalar"),
    ("Комунікації", "Communications", "Kommunikatsiyalar"),
    ("Дослідження", "Research", "Tedqiqatlar"),
    ("Пряма мова", "In their words", "Doğrudan söz"),
    ("Що робимо", "What we do", "Ne yapamız"),
    ("Розвиваємо", "We develop", "Ukrayinada"),
    ("Навчання", "Training", "Talim"),
    ("Літо 2025", "Summer 2025", "2025 senesi yazı"),
    ("Історія", "History", "Tarih"),
    ("Проєкти", "Projects", "Leyhalar"),
    ("Команда", "Team", "Komanda"),
    ("Заяви", "Statements", "Beyanatlar"),
]

def build(lang):
    col = 1 if lang == "en" else 2
    s = SRC
    # Structural switches: language, URLs, data attributes.
    s = s.replace('<html lang="uk">', f'<html lang="{lang}">', 1)
    s = s.replace('<meta property="og:url" content="https://about.promedia.report/">', f'<meta property="og:url" content="https://about.promedia.report/{lang}/">', 1)
    s = s.replace('<link rel="canonical" href="https://about.promedia.report/">', f'<link rel="canonical" href="https://about.promedia.report/{lang}/">', 1)
    s = s.replace('data-lang="uk" data-live="Триває"', f'data-lang="{lang}" data-live="{"Ongoing" if lang == "en" else "Devam ete"}"', 1)
    s = s.replace('data-lang="uk" data-live="триває"', f'data-lang="{lang}" data-live="{"ongoing" if lang == "en" else "devam ete"}"', 1)
    s = s.replace('href="https://news.promedia.report/article/', f'href="https://news.promedia.report/{lang}/article/')
    s = s.replace('<a class="pm-hp-all" href="https://projects.promedia.report/">', f'<a class="pm-hp-all" href="https://projects.promedia.report/{lang}/">', 1)
    # Crimean Tatar headline: "Ukrayinada <em>serbest mediyanı</em> ve ... inkişaf etemiz".
    for uk, en, crh in T:
        s = s.replace(uk, en if col == 1 else crh)
    left = sorted(set(re.findall(r"[А-ЯҐЄІЇа-яґєії][^<>\"]*", re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S))))
    if left:
        sys.exit(f"{lang}: untranslated Ukrainian text left:\n" + "\n".join(left))
    out = ROOT / lang / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(s, encoding="utf-8")
    print("wrote", out)

for lang in ("en", "crh"):
    build(lang)
