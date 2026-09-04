# Новини ПроМедіа (news.promedia.report)

Окремий піддомен-медіа екосистеми ProMedia: новини з тегами, зображеннями та
адмінпанеллю для кількох авторів. Побудований як один Cloudflare Worker
(SSR публічних сторінок + JSON API + адмінка) поверх D1 (база даних) та R2
(зберігання зображень) — без сторонніх бекенд-залежностей.

Статті також можна підтягувати на сторінки медіа в каталозі
[communities.promedia.report](https://communities.promedia.report) через
публічний ендпоінт `GET /api/articles?mediaId=<id>` (CORS відкритий).
Позначені в адмінці важливі матеріали доступні через
`GET /api/articles?important=1&limit=3` і потрапляють до блока «Вибрані
новини» на головному `promedia.report`.
Підписка на браузерні сповіщення працює через Web Push: читач натискає
дзвіночок, дозволяє повідомлення у браузері, а редактор надсилає коротке
UA/EN-сповіщення з адмінки новин.
Адмінка також може редагувати GitHub-субдомени, наприклад
`research.promedia.report`, через один серверний GitHub-токен. Редактори
входять лише в адмінку новин і не вводять власні GitHub-логіни чи токени.

## Стек

- Cloudflare Workers (`src/worker.js` — єдина точка входу)
- D1 (SQLite) — таблиці `users`, `articles` (`migrations/0001_init.sql`)
- R2 — зберігання завантажених зображень (бакет `promedia-news-images`)
- Workers Assets — статичні файли (`public/`: css, favicon, адмін-SPA)
- Web Push — таблиці `push_subscriptions`, `push_messages`, service worker
  `public/promedia-push-sw.js` і клієнтський дзвіночок
  `public/js/promedia-push-bell.js`
- Без зовнішніх npm-залежностей у рантаймі: пароль хешується через
  `crypto.subtle` (PBKDF2), сесії — власні HMAC-підписані токени, markdown —
  власний XSS-safe конвертер

## Розгортання (production)

Виконується один раз власником Cloudflare-акаунта.

### 1. Встановити залежності та увійти в Cloudflare

```bash
npm install
npx wrangler login
```

### 2. Створити базу даних D1

```bash
npx wrangler d1 create promedia-news
```

Команда виведе `database_id` — вставте його у `wrangler.toml` замість
плейсхолдера в блоці `[[d1_databases]]`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "promedia-news"
database_id = "ВАШ_РЕАЛЬНИЙ_ID"
```

Застосуйте міграцію до бойової бази:

```bash
npm run db:migrate:remote
```

(це виконає `wrangler d1 execute promedia-news --remote --file=migrations/0001_init.sql`)

### 3. Створити R2-бакет для зображень

```bash
npx wrangler r2 bucket create promedia-news-images
```

За замовчуванням зображення віддаються самим Worker'ом через
`/img-storage/<key>` — додаткових налаштувань не потрібно.

Якщо бажаєте віддавати їх напряму з R2 (кастомний домен для бакета або
`r2.dev`-домен), увімкніть публічний доступ у Cloudflare Dashboard → R2 →
`promedia-news-images` → Settings, і додайте базовий URL як змінну
середовища `IMAGES_PUBLIC_BASE_URL` (Dashboard → Workers → promedia-news →
Settings → Variables), напр. `https://images.promedia.report`.

### 4. Задати секрет підпису сесій

```bash
npx wrangler secret put AUTH_SECRET
```

Введіть довільний випадковий рядок 32+ символів, наприклад згенерований
через:

```bash
openssl rand -base64 32
```

Для Web Push також потрібен приватний VAPID-ключ:

```bash
npx wrangler secret put VAPID_PRIVATE_JWK
```

Публічний VAPID-ключ зберігається в `src/lib/push.js`, приватний ключ
зберігається тільки як секрет Cloudflare Worker.

Щоб увімкнути збереження змін у GitHub-субдомени з цієї самої адмінки,
додайте секрет:

```bash
npx wrangler secret put SUBDOMAINS_GITHUB_TOKEN
```

Це має бути fine-grained GitHub token, обмежений лише потрібними репозиторіями
субдоменів, з правом `Contents: Read and write`. Якщо секрет не заданий,
адмінка зможе показувати файли, але не зможе зберігати зміни.

### 5. Підключити кастомний домен

Переконайтесь, що зона `promedia.report` є у вашому Cloudflare-акаунті
(там же, де вже налаштований `submit-community` Worker), потім
розкоментуйте блок у `wrangler.toml`:

```toml
[[routes]]
pattern = "news.promedia.report/*"
zone_name = "promedia.report"
```

Якщо DNS-запис для `news` ще не існує, Cloudflare зазвичай створює його
автоматично при деплої маршруту; якщо ні — додайте вручну проксійований
CNAME/A-запис `news` → будь-яке значення (Cloudflare Workers Route його
перехопить) у Dashboard → DNS.

### 6. Деплой

```bash
npm run deploy
```

### 7. Створити перший акаунт адміністратора (одноразовий бутстрап)

Ендпоінт `/api/setup` активний лише поки таблиця `users` порожня — після
першого успішного виклику він назавжди самоблокується.

```bash
curl -X POST https://news.promedia.report/api/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"ВАШ_НАДІЙНИЙ_ПАРОЛЬ_10+","name":"Ваше ім'\''я"}'
```

Пароль — мінімум 10 символів. Після цього увійдіть на
`https://news.promedia.report/admin`.

Створювати авторів після цього можна вже з самої адмінки
(розділ «Користувачі», доступний лише ролі admin).

## Локальна розробка

```bash
npm install
npm run db:migrate:local
npm run dev
```

`wrangler dev` піднімає локальні емуляції D1/R2 без звернення до бойового
Cloudflare-акаунта. Створіть `.dev.vars` (не комітиться) з рядком:

```
AUTH_SECRET=будь-який-локальний-рядок
```

Бутстрап-адміна локально — той самий запит `POST /api/setup`, але на
`http://localhost:8787`.

## Структура

```
src/
  worker.js        — точка входу, маршрутизація
  routes/
    public.js       — публічні сторінки (SSR) + публічний JSON API
    auth.js         — /api/setup, /api/auth/*, /api/me
    admin.js        — CRUD статей/користувачів, завантаження зображень
  lib/
    auth.js          — хешування паролів, сесійні токени, cookies
    markdown.js       — markdown → HTML (XSS-safe) та markdown → plain text
    subdomains.js      — серверне редагування GitHub-субдоменів з адмінки
    slug.js          — транслітерація/slug з унікальністю
    render.js         — HTML-шаблони публічних сторінок (SSR, OG-теги)
public/
  admin/            — ванільний JS SPA адмінпанелі
  css/style.css     — стилі (бренд ProMedia)
  promedia-push-sw.js — service worker для Web Push
migrations/             — послідовні SQL-міграції D1
```

## Інтеграція з каталогом спільнот

На сторінці медіа (`communities.promedia.report/media/?id=<id>`) виконується
запит `GET https://news.promedia.report/api/articles?mediaId=<id>` для
показу заголовків пов'язаних новин. Прив'язка медіа до статті робиться в
адмінці при створенні/редагуванні статті (поле пошуку медіа за назвою).

## Інтеграція з головною сторінкою ProMedia

Прапорець «Важлива новина» в редакторі статті записує `is_important` у D1.
Головний сайт завантажує до трьох таких опублікованих матеріалів через
`GET https://news.promedia.report/api/articles?important=1&limit=3`.
Позначені матеріали мають пріоритет, а решта трьох місць заповнюється
чинними картками старого добору. Клієнтська інтеграція знаходиться у
`public/js/promedia-featured-news.js`.

Поле «Оформлення картки» окремо керує виглядом матеріалу на головній
`news.promedia.report`: автоматично за позицією, велика головна новина,
картка з фото або картка без фото. Ручний вибір має пріоритет; вибрана велика
новина піднімається у головну позицію, і одночасно такою може бути лише одна
опублікована стаття.

## Web Push

Публічні endpoints:

- `GET /api/push/public-key` — публічний VAPID-ключ для браузера
- `POST /api/push/subscribe` — збереження браузерної підписки
- `POST /api/push/unsubscribe` — деактивація підписки
- `GET /api/push/latest?lang=uk|en` — останній текст сповіщення для service worker

Адмінські endpoints:

- `GET /api/admin/push/summary` — кількість підписників і останні відправки
- `POST /api/admin/push/send` — збереження нового повідомлення і відправка
  push-сигналу активним підписникам

Клієнтський скрипт `public/js/promedia-push-bell.js` показує дзвіночок не
одразу: після другої сторінки у поточній сесії або приблизно після 75 секунд
перебування на сайті. Для тесту можна додати `?promedia_push_preview=1` або
`?subscribe=1`. На доменах, де немає root service worker
`/promedia-push-sw.js`, скрипт пропонує перейти на `news.promedia.report` і
оформити підписку там.

## Імпорт новин із promedia.report

Одноразовий імпортер читає публічні UA/EN сторінки старого сайту, об'єднує
окремі мовні записи в одну двомовну статтю та не створює дублікати при
повторному запуску. Спочатку завжди запускайте перевірку без запису:

```bash
npm run import:promedia:dry-run
```

Production-режим `npm run import:promedia` потребує Cloudflare та admin
облікових даних лише через змінні середовища; секрети у файлах не зберігаються.
