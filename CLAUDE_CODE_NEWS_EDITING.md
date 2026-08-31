# Інструкція для Claude Code: news.promedia.report

Цей документ описує безпечне редагування, перевірку й розгортання новинного
сайту ProMedia. Не записуйте API-токени, паролі адміністратора або інші секрети
в репозиторій, команди Git чи журнали.

## 1. Проєкт і production

- Репозиторій: `Ianitskyi/promedia-news`.
- Production: `https://news.promedia.report`.
- Cloudflare Worker: `promedia-news`.
- D1 binding: `DB`, база `promedia-news`.
- R2 binding: `IMAGES`, bucket `promedia-news-images`.
- Статичні assets: `public/`, binding `ASSETS`.
- Production route: `news.promedia.report/*`.
- Основна мова — українська; англійська вмикається через `?lang=en`.

## 2. Архітектура

- `src/worker.js` — головний router Worker.
- `src/routes/public.js` — публічні HTML-сторінки та read-only API.
- `src/routes/auth.js` — setup, login, logout і поточний користувач.
- `src/routes/admin.js` — CRUD статей, користувачі та завантаження в R2.
- `src/lib/render.js` — SSR-шаблони, мовні тексти, рубрики та композиція карток.
- `src/lib/markdown.js` — безпечний мінімальний Markdown renderer.
- `public/css/style.css` — увесь дизайн публічної частини й адмінки.
- `public/admin/` — клієнтська адмінпанель.
- `migrations/0001_init.sql` — базова схема D1; наступні нумеровані міграції
  змінюють production-схему послідовно.
- `scripts/audit-promedia-import.mjs` — idempotent dry-run/import зі старого сайту.
- `wrangler.toml` — bindings, assets і production route.

## 3. Як працює головна сторінка

`renderHomepage()` у `src/lib/render.js` отримує опубліковані статті,
відсортовані за `published_at DESC`.

- Перша стаття автоматично стає великою карткою `article-card--hero`.
- Друга показується як звичайна картка з фото.
- Третя — як текстова картка без фото.
- Решта формують сітку; кожна четверта позиція в патерні стає текстовою.
- Це лише спосіб показу: обкладинка не видаляється з D1/R2.
- Рубрики — значення тегів `Заяви`, `Новини`, `Статті`.
- Фільтр працює через `/?tag=<рубрика>`; EN додає `&lang=en`.
- Поле `articles.card_style` дозволяє перевизначити автоматичний вигляд:
  `hero` — велика головна, `image` — картка з фото, `text` — без фото,
  `auto` — описаний вище позиційний шаблон. Опублікована `hero` може бути
  лише одна; новий вибір повертає попередню у `auto`.

Змінюйте HTML-композицію в `src/lib/render.js`, а геометрію, кольори й
адаптивність — у `public/css/style.css`. Не копіюйте верстку або стилі інших
видань дослівно; зберігайте власну айдентику ProMedia.

Функції `header()` і `footer()` відтворюють спільну організаційну шапку та
футер основного `promedia.report`. Їхні CSS-класи мають префікс `org-`, щоб не
конфліктувати з новинними картками. Під час зміни навігації синхронізуйте UA/EN
посилання, desktop nav, mobile menu і footer nav. Партнерські логотипи беруться
з публічного media storage основного сайту.

### Вибрані новини на головному promedia.report

- Поле `articles.is_important` керує прапорцем «Важлива новина» в адмінці.
- `GET /api/articles?important=1&limit=3` повертає лише опубліковані важливі
  матеріали; CORS відкритий для головного сайту.
- `public/js/promedia-featured-news.js` додає позначені матеріали до блока
  «Вибрані новини». Вони мають пріоритет, а вільні місця заповнюються старим
  серверним добором; усього лишається три картки.
- Скрипт підключений у налаштуванні теми основного сайту `analitycs_body`.
  Не дублюйте тег підключення і не повертайте карткам URL старого `/news`.

## 4. Мовні правила

- Поля D1 без суфікса (`title`, `excerpt`, `body_md`) — українські.
- Поля `title_en`, `excerpt_en`, `body_md_en` — англійські.
- Якщо повного EN-тексту немає, сайт зараз використовує український fallback.
- Усі переходи на карту спільнот мають явно передавати `lang=uk` або `lang=en`.
- Під час додавання рубрики зберігайте внутрішнє значення тегу українською,
  а англійський підпис задавайте у словнику `categoryNav()`.

## 5. Локальна робота

```bash
npm install
npm run dev
```

Перевіряйте щонайменше:

- `/` і `/?lang=en`;
- `/?tag=Новини` та `/?tag=Новини&lang=en`;
- сторінку окремої статті обома мовами;
- ширини приблизно 1280, 768 і 390 px;
- відсутність зламаних зображень та горизонтального scroll;
- `/admin` після змін спільного CSS.

Перед публікацією виконайте:

```bash
npx wrangler deploy --dry-run
git diff --check
```

Якщо додано міграцію, застосуйте саме новий нумерований SQL-файл до D1 перед
деплоєм Worker. Не запускайте повторно вже застосовану `ALTER TABLE`-міграцію.

## 6. Безпечне розгортання

Cloudflare API-токен має надходити тільки зі змінної середовища
`CLOUDFLARE_API_TOKEN`. Не вставляйте його в `wrangler.toml`.

У цього deployment-токена може не бути дозволу змінювати routes. Тому для
оновлення коду й assets використовуйте versioned deployment, який не чіпає
вже налаштований route:

```bash
npx wrangler versions upload --message "Describe the change"
npx wrangler versions deploy <VERSION_ID>@100% -y --message "Describe rollout"
```

Після deployment перевірте production HTTP-відповіді та сторінку в браузері.
Попередня Worker version залишається доступною для rollback у Cloudflare.

## 7. Дані та імпорт

Dry-run старого контенту не змінює production:

```bash
npm run import:promedia:dry-run
```

`npm run import:promedia` виконує production-записи й потребує Cloudflare та
admin credentials через змінні середовища. Не запускайте apply-режим без
явного дозволу власника. Імпортер об'єднує окремі UA/EN записи, копіює
обкладинки в R2 й робить upsert за slug.

## 8. Git і секрети

- Перед комітом виконайте `git status --short` і перегляньте diff.
- Не змінюйте та не видаляйте чужі незавершені правки.
- Перевірте, що diff не містить паролів, токенів, cookies або `.env`.
- Push у `main` робіть лише після прямого дозволу власника.
- Для змін дизайну бажаний окремий невеликий коміт із зрозумілим повідомленням.
