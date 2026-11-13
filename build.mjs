#!/usr/bin/env node
// Builds the site from src/:
//
//   play/index.html + assets/    the game (GitHub Pages / any web server). A small page; the code, PeerJS, one
//                                dictionary per language and the fonts are separate files with a
//                                content hash in the name, so browsers cache them for good and
//                                download only what is needed: the player's language and the font
//                                subsets that the page really uses (unicode-range).
//   pyonpoker-offline.html       everything in one self-contained file (works from disk, can be sent
//                                to a friend). Fonts, scripts and all 9 languages are inlined.
//
//   index.html, ru/…, en/…       the landing page and the legal pages, from src/pages/ (see below)
//   pyonpoker.html, pion-*.html  old addresses: small redirects that keep ?query and #t-CODE
//
// `node build.mjs`            build;   `node build.mjs --check`  also check syntax and t/L/tr shadowing.
// Minification uses terser if it is installed (npm i); without it the build still works.
//
// Directives inside src files (paths relative to the file):
//   @inline(path) the file's text, processed recursively   @datauri(path) the file as a data: URI
//   @include(path) the text as is
//   <!-- @icons --> <!-- @head --> <!-- @scripts -->   filled differently for the two forms
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');
const MIME = { '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json', '.webmanifest':'application/manifest+json' };
const CHECK = process.argv.includes('--check');

const read = p => fs.readFileSync(p, 'utf8');
const lines = p => read(p).split('\n').map(s => s.trim()).filter(Boolean);
const hash = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);
const kb = n => (n / 1024).toFixed(0) + ' KB';
const safeScript = s => s.replace(/<\/(script)/gi, '<\\/$1');

let terser = null;
try{ terser = await import('terser'); }catch(e){ console.warn('terser not installed: scripts are not minified (run npm i)'); }
async function minify(code, name){
  if(!terser) return code;
  const r = await terser.minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: /^!|License/i, ascii_only: false } });
  if(!r.code) throw new Error('terser failed on ' + name);
  return r.code;
}

const langs = read(path.join(SRC, 'i18n', '_order.txt')).trim().split(/\s+/);
const dict = lang => JSON.parse(read(path.join(SRC, 'i18n', lang + '.json')));
function appFiles(){ const dir = path.join(SRC, 'js'); return lines(path.join(dir, '_order.txt')).map(f => path.join(dir, f)); }
const appSource = () => '\n(() => {\n' + appFiles().map(read).join('') + '})();\n\n';

function processText(text, base){
  return text
    .replace(/@inline\(([^)]+)\)/g, (_, p) => { const f = path.resolve(base, p); return processText(read(f), path.dirname(f)); })
    .replace(/@include\(([^)]+)\)/g, (_, p) => read(path.resolve(base, p)).trim())
    .replace(/@datauri\(([^)]+)\)/g, (_, p) => {
      const f = path.resolve(base, p), mime = MIME[path.extname(f)] || 'application/octet-stream';
      return `data:${mime};base64,` + fs.readFileSync(f).toString('base64');
    });
}
const template = processText(read(path.join(SRC, 'index.html')), SRC);
const fill = (html, parts) => html.replace(/<!-- @(icons|head|scripts) -->\n?/g, (_, k) => parts[k] || '');

// ---------- shared pieces ----------
const app = await minify(appSource(), 'app');
const peer = read(path.join(SRC, 'vendor', 'peerjs.min.js'));
const fontsCss = read(path.join(SRC, 'css', 'fonts.css'));

// ---------- the game: play/index.html + assets/ (paths are relative to the site root through R) ----------
fs.rmSync(ASSETS, { recursive: true, force: true });
fs.mkdirSync(path.join(ASSETS, 'fonts'), { recursive: true });
const written = {};
function asset(rel, data){ const ext = path.extname(rel), name = rel.slice(0, -ext.length) + '.' + hash(data) + ext; fs.writeFileSync(path.join(ASSETS, name), data); written[name] = Buffer.byteLength(data); return 'assets/' + name; }
const appUrl = asset('app.js', app), peerUrl = asset('peerjs.js', peer);
const langUrls = {};
for(const l of langs) langUrls[l] = asset(`lang-${l}.js`, `(window.PYONPOKER_I18N=window.PYONPOKER_I18N||{})[${JSON.stringify(l)}]=${JSON.stringify(dict(l))};`);
const siteFonts = fontsCss.replace(/@datauri\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => asset('fonts/' + f, fs.readFileSync(path.join(SRC, 'fonts', f))));
const R = '../'; // play/ is one folder below the site root
const atRoot = (css, p) => css.replace(/url\(assets\//g, 'url(' + p + 'assets/');
// language is chosen before the app starts (same rule as guessLang in the app), then the scripts run in order
const langUrlsR = Object.fromEntries(Object.entries(langUrls).map(([l, u]) => [l, R + u]));
const loader = `<script>(function(){window.PYONPOKER_ROOT=${JSON.stringify(R)};var U=${JSON.stringify(langUrlsR)},c={},l;try{c=JSON.parse(localStorage.getItem("pyonpoker-cfg")||"{}")||{}}catch(e){}l=c.lang;if(!U[l]){var n=(navigator.language||"ru").slice(0,2).toLowerCase();n=n==="iw"?"he":n;l=U[n]?n:n==="be"?"ru":"en"}window.PYONPOKER_LANG_URL=U;[${JSON.stringify(R + peerUrl)},U[l],${JSON.stringify(R + appUrl)}].forEach(function(u){var s=document.createElement("script");s.src=u;s.async=false;document.body.appendChild(s)})})();</script>\n`;
const site = fill(template, {
  icons: `<link rel="icon" href="${R}icons/icon-192.png">\n<link rel="apple-touch-icon" href="${R}icons/apple-touch-icon.png">\n`,
  head: `<link rel="preload" href="${R + appUrl}" as="script">\n<link rel="preload" href="${R + peerUrl}" as="script">\n<style>${atRoot(siteFonts, R)}</style>\n`,
  scripts: loader,
}).replace('<link rel="manifest" href="manifest.webmanifest">', `<link rel="manifest" href="${R}manifest.webmanifest">`);
fs.mkdirSync(path.join(ROOT, 'play'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'play', 'index.html'), site);

// ---------- one self-contained file: pyonpoker-offline.html ----------
const allLangs = {}; for(const l of langs) allLangs[l] = dict(l);
const offline = fill(template, {
  icons: processText('<link rel="icon" href="@datauri(assets/icon-192.png)">\n<link rel="apple-touch-icon" href="@datauri(assets/apple-touch-icon.png)">\n', SRC),
  head: '',
  // fonts and scripts after the content, so the page paints before ~1.5 MB of them is parsed
  scripts: `<style>${processText(fontsCss, path.join(SRC, 'css'))}</style>\n<script>${safeScript(peer)}</script>\n<script>window.PYONPOKER_I18N=${safeScript(JSON.stringify(allLangs))};</script>\n<script>${safeScript(app)}</script>\n`,
});
fs.writeFileSync(path.join(ROOT, 'pyonpoker-offline.html'), offline);

// ---------- installable app + offline: manifest, icons, service worker ----------
fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for(const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(ROOT, 'icons', f));
fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(ROOT, 'manifest.webmanifest'));
// the old addresses lead to the game, keeping #t-CODE invite links working
const redirect = to => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PyonPoker</title><link rel="canonical" href="${to}"><script>location.replace("${to}"+location.search+location.hash)</script><meta http-equiv="refresh" content="1;url=${to}"></head><body style="background:#170912;color:#fff;font-family:system-ui,sans-serif;padding:24px"><a href="${to}" style="color:#ff8ac0">PyonPoker</a></body></html>\n`;
for(const [from, to] of [['pyonpoker.html', 'play/'], ['pion-online.html', 'play/'], ['pion-offline.html', 'pyonpoker-offline.html']]) fs.writeFileSync(path.join(ROOT, from), redirect(to));

// ---------- pages: src/pages/<route>.html → <route>/index.html (index.html → the site root) ----------
// The first line of a page is <!--meta {"title","description","lang","alt":{"ru":route,"en":route}} -->;
// "@/" in a page is the way to the site root. Fonts are the game's (same hashed files), styles from src/pages/site.css.
const PAGES = path.join(SRC, 'pages'), SITE = 'https://pyonpoker.com/', pageCss = read(path.join(PAGES, 'site.css'));
const escA = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function pageFiles(dir){ return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pageFiles(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []); }
const pagesOut = [];
for(const f of pageFiles(PAGES)){
  const rel = path.relative(PAGES, f).replace(/\\/g, '/').replace(/\.html$/, ''), route = rel === 'index' ? '' : rel;
  const depth = route ? route.split('/').length : 0, P = '../'.repeat(depth);
  const src = read(f), m = JSON.parse(src.match(/^<!--meta (.*?) -->/)[1]), body = src.replace(/^<!--meta .*? -->\n?/, '').replace(/@\//g, P);
  const url = SITE + (route ? route + '/' : '');
  const alt = Object.entries(m.alt || {}).map(([l, r]) => `<link rel="alternate" hreflang="${l}" href="${SITE}${r ? r + '/' : ''}">`).join('');
  const html = `<!doctype html>
<html lang="${m.lang}"${m.lang === 'he' ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escA(m.title)}</title><meta name="description" content="${escA(m.description)}"><link rel="canonical" href="${url}">${alt}
<meta name="theme-color" content="#170912"><link rel="icon" href="${P}icons/icon-192.png"><link rel="apple-touch-icon" href="${P}icons/apple-touch-icon.png"><link rel="manifest" href="${P}manifest.webmanifest">
<meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${escA(m.title)}"><meta property="og:description" content="${escA(m.description)}"><meta property="og:image" content="${SITE}brand/pyonpoker-og.png"><meta name="twitter:card" content="summary_large_image">
<style>${atRoot(siteFonts, P)}${pageCss}</style></head>
<body class="${m.body || ''}">
${body}</body></html>
`;
  const out = route ? path.join(ROOT, route, 'index.html') : path.join(ROOT, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); pagesOut.push(route || '/');
}
// /privacy/, /terms/, /refund/: open the Russian or the English document by the visitor's language
for(const doc of ['privacy', 'terms', 'refund']){
  const pick = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PyonPoker</title><meta name="robots" content="noindex"><script>(function(){var l="";try{l=(JSON.parse(localStorage.getItem("pyonpoker-cfg")||"{}")||{}).lang||""}catch(e){}l=l||(navigator.language||"en").slice(0,2).toLowerCase();location.replace((/^(ru|uk|be|kk)$/.test(l)?"../ru/":"../en/")+"${doc}/")})()</script></head><body style="background:#170912;color:#fff;font-family:system-ui,sans-serif;padding:24px"><a style="color:#ff8ac0" href="../ru/${doc}/">Русский</a> · <a style="color:#ff8ac0" href="../en/${doc}/">English</a></body></html>\n`;
  fs.mkdirSync(path.join(ROOT, doc), { recursive: true }); fs.writeFileSync(path.join(ROOT, doc, 'index.html'), pick);
}
const precache = ['./play/', './' + appUrl, './' + peerUrl];
fs.writeFileSync(path.join(ROOT, 'sw.js'), read(path.join(SRC, 'sw.js')).replace('__VERSION__', hash(site + app)).replace('__PRECACHE__', JSON.stringify(precache)));

const sum = Object.entries(written);
console.log(`pages: ${pagesOut.join(' ')}`);
console.log(`play/index.html: ${kb(Buffer.byteLength(site))} + assets: app ${kb(written[appUrl.slice(7)])}, peerjs ${kb(written[peerUrl.slice(7)])}, one language ≈ ${kb(written[langUrls.en.slice(7)])}, fonts ${kb(sum.filter(([n]) => n.startsWith('fonts/')).reduce((a, [, b]) => a + b, 0))} (only the needed subsets load)`);
console.log(`pyonpoker-offline.html: ${kb(Buffer.byteLength(offline))}`);

if(CHECK){
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'pyonpoker-'));
  const checkJs = (code, name) => { const f = path.join(tmp, name); fs.writeFileSync(f, code); execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' }); };
  [...offline.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, k) => checkJs(m[1], `offline${k}.js`));
  [...site.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, k) => checkJs(m[1], `site${k}.js`));
  for(const name of Object.keys(written).filter(n => n.endsWith('.js'))) checkJs(read(path.join(ASSETS, name)), path.basename(name));
  // no call of t(), L() or tr() may hit a local variable with the same name
  const { checkShadowing } = await import('./tools/check.mjs');
  const offs = []; let ln = 3; for(const f of appFiles()){ offs.push([ln, f]); ln += read(f).split('\n').length - 1; }
  const where = line => { let r = offs[0]; for(const o of offs) if(o[0] <= line) r = o; return `${path.relative(ROOT, r[1])}:${line - r[0] + 1}`; };
  const bad = checkShadowing(appSource());
  if(bad.length){ console.error('t / L / tr is shadowed by a local name at:\n' + bad.map(b => `  ${where(b.line)} (${b.name})`).join('\n')); process.exit(1); }
  console.log('checks: ok');
}
