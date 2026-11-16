# Головний сайт promedia.report

Статичний сайт (HTML/CSS/JS) у папці `static/`, мови: `/` (UA), `/en/`, `/crh/`.
`static-worker.js` робить редиректи `/news` → news.promedia.report і
`/projects` → projects.promedia.report, решту віддає з `static/`.

Публікація: будь-яка зміна в `main-site/**` на гілці `main` запускає
`.github/workflows/deploy-main-site.yml`, який деплоїть воркер `promedia-main`
(до нього в Cloudflare прив'язаний домен promedia.report).

Що живе не тут:
- шапка й підвал усіх сайтів — `public/js/promedia-global-shell.js`;
- блок новин на головній — `public/js/promedia-featured-news.js`;
- картки проєктів беруться з API `projects.promedia.report/api/projects`
  (воркер новин) і малюються в `static/assets/js/static-site.js`;
- `robots.txt` і `sitemap.xml` — воркер `promedia-seo-gateway`
  (файли в `static/` на домені не віддаються).

Під час змін правте всі три мовні версії сторінки.
