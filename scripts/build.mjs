// Сборка статического сайта АНО «ИДС» в папку dist/.
// Страницы — src/pages/*.html; первая строка каждой — метаданные:
// <!--meta {"title": "...", "description": "...", "nav": "about"} -->
// Общие части (шапка, подвал) — src/partials/. Логотип — маски из растра логотипа в assets/img/logo/. Запуск: npm run build (или node scripts/build.mjs).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const SITE = 'АНО «ИДС»';
const VERSION = '5';

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'АНО «ИДС»',
  legalName: 'Автономная некоммерческая организация по развитию, продвижению и популяризации цифровых технологий «Интеллектуальные доверенные системы»',
  taxID: '9731151562',
  foundingDate: '2025-06-06',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Москва',
    streetAddress: 'территория ИЦ «Сколково», Большой бульвар, д. 42, стр. 1',
    addressCountry: 'RU'
  }
};

// Шрифты: в репозитории лежат в assets/fonts/. Если установлены пакеты Fontsource (npm install),
// берём файлы из них — так шрифты не нужно хранить в деплое. Имена файлов совпадают с site.css.
const FONTS = [
  ['@fontsource-variable/onest', '-cyrillic-wght-normal.woff2', 'onest-cyrillic-wght-normal.woff2'],
  ['@fontsource-variable/onest', '-latin-wght-normal.woff2', 'onest-latin-wght-normal.woff2'],
  ['@fontsource/jetbrains-mono', '-cyrillic-400-normal.woff2', 'jetbrains-mono-cyrillic-400-normal.woff2'],
  ['@fontsource/jetbrains-mono', '-latin-400-normal.woff2', 'jetbrains-mono-latin-400-normal.woff2']
];

const read = (p) => readFileSync(join(SRC, p), 'utf8');

const head = ({ title, description, nav }) => `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta name="theme-color" content="#031B23">
<link rel="icon" href="assets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="preload" href="assets/fonts/onest-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/site.css?v=${VERSION}">
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">${JSON.stringify(ORG_LD)}</script>
</head>
<body data-page="${nav}">
`;

const foot = `<script src="assets/js/site.js?v=${VERSION}" defer></script>
</body>
</html>
`;

function buildAssets() {
  rmSync(OUT, { recursive: true, force: true });
  cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });

  mkdirSync(join(OUT, 'assets/fonts'), { recursive: true });
  for (const [pkg, suffix, name] of FONTS) {
    const dir = join(ROOT, 'node_modules', pkg, 'files');
    const file = existsSync(dir) && readdirSync(dir).find((f) => f.endsWith(suffix) && !f.includes('-ext-'));
    if (file) cpSync(join(dir, file), join(OUT, 'assets/fonts', name));
    else if (!existsSync(join(OUT, 'assets/fonts', name))) {
      throw new Error(`Нет шрифта ${name}: ни в assets/fonts, ни в ${pkg}` + (existsSync(dir) ? ` (файлы: ${readdirSync(dir).join(', ')})` : ''));
    }
  }
}

// Стык — стилистическая вставка между крупными блоками. В странице пишется комментарием:
// <!--seam n="02" label="Принцип работы" theme="dark" k="ЗАДАЧА"-->
// n — номер, label — подпись слева, theme — dark | dark-2 | light | mist | teal, k — подпись рамки сканера.
const SEAM_RE = /<!--seam((?:\s+\w+="[^"]*")*)\s*-->/g;
const COORD = '55.70° N · 37.36° E';
function seam(attrs) {
  const a = Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const theme = a.theme || 'dark';
  const mode = theme.startsWith('dark') || theme === 'teal' ? (theme === 'teal' ? 'light' : 'dark') : 'light';
  const left = a.label ? `<span class="seam-l">${a.n ? `<b>§ ${a.n}</b> — ` : ''}${a.label}</span>` : '<span class="seam-l"></span>';
  return `<div class="seam theme-${theme}" data-theme="${mode}" data-seam aria-hidden="true"><div class="wrap seam-in">${left}` +
    `<span class="seam-ruler"><i class="seam-scan" data-k="${a.k || 'ИДС'}"></i></span>` +
    `<span class="lg lg-mark seam-mark" data-spin></span>` +
    `<span class="seam-r"><i class="seam-dot"></i><span class="seam-coord">${COORD}</span></span></div></div>`;
}

function buildPages() {
  const header = read('partials/header.html');
  const footer = read('partials/footer.html');
  for (const name of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html')).sort()) {
    const raw = read(`pages/${name}`);
    const m = raw.match(/^<!--meta (\{[\s\S]*?\}) -->\n/);
    const meta = JSON.parse(m[1]);
    const nav = meta.nav || '';
    const title = nav === 'home' ? meta.title : `${meta.title} — ${SITE}`;
    const hdr = header.replaceAll(`data-nav="${nav}"`, `data-nav="${nav}" aria-current="page"`);
    const html = head({ title, description: meta.description, nav }) + hdr +
      '<main id="main">\n' + raw.slice(m[0].length).replace(SEAM_RE, (_, at) => seam(at)) + '</main>\n' +
      (meta.nofooter ? '' : footer) + foot;
    writeFileSync(join(OUT, name), html);
    console.log('built', name);
  }
}

buildAssets();
buildPages();
