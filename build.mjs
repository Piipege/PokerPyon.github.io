#!/usr/bin/env node
// Builds the game from src/ in two forms:
//
//   pion-online.html + assets/   the site (GitHub Pages). A small page; the code, PeerJS, one
//                                dictionary per language and the fonts are separate files with a
//                                content hash in the name, so browsers cache them for good and
//                                download only what is needed: the player's language and the font
//                                subsets that the page really uses (unicode-range).
//   pion-offline.html            everything in one self-contained file (works from disk, can be sent
//                                to a friend). Fonts, scripts and all 9 languages are inlined.
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

// ---------- the site: pion-online.html + assets/ ----------
fs.rmSync(ASSETS, { recursive: true, force: true });
fs.mkdirSync(path.join(ASSETS, 'fonts'), { recursive: true });
const written = {};
function asset(rel, data){ const ext = path.extname(rel), name = rel.slice(0, -ext.length) + '.' + hash(data) + ext; fs.writeFileSync(path.join(ASSETS, name), data); written[name] = Buffer.byteLength(data); return 'assets/' + name; }
const appUrl = asset('app.js', app), peerUrl = asset('peerjs.js', peer);
const langUrls = {};
for(const l of langs) langUrls[l] = asset(`lang-${l}.js`, `(window.PION_I18N=window.PION_I18N||{})[${JSON.stringify(l)}]=${JSON.stringify(dict(l))};`);
const siteFonts = fontsCss.replace(/@datauri\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => asset('fonts/' + f, fs.readFileSync(path.join(SRC, 'fonts', f))));
// language is chosen before the app starts (same rule as guessLang in the app), then the scripts run in order
const loader = `<script>(function(){var U=${JSON.stringify(langUrls)},c={},l;try{c=JSON.parse(localStorage.getItem("pion-cfg")||"{}")||{}}catch(e){}l=c.lang;if(!U[l]){var n=(navigator.language||"ru").slice(0,2).toLowerCase();n=n==="iw"?"he":n;l=U[n]?n:n==="be"?"ru":"en"}window.PION_LANG_URL=U;[${JSON.stringify(peerUrl)},U[l],${JSON.stringify(appUrl)}].forEach(function(u){var s=document.createElement("script");s.src=u;s.async=false;document.body.appendChild(s)})})();</script>\n`;
const site = fill(template, {
  icons: '<link rel="icon" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n',
  head: `<link rel="preload" href="${appUrl}" as="script">\n<link rel="preload" href="${peerUrl}" as="script">\n<style>${siteFonts}</style>\n`,
  scripts: loader,
});
fs.writeFileSync(path.join(ROOT, 'pion-online.html'), site);

// ---------- one self-contained file: pion-offline.html ----------
const allLangs = {}; for(const l of langs) allLangs[l] = dict(l);
const offline = fill(template, {
  icons: processText('<link rel="icon" href="@datauri(assets/icon-192.png)">\n<link rel="apple-touch-icon" href="@datauri(assets/apple-touch-icon.png)">\n', SRC),
  head: '',
  // fonts and scripts after the content, so the page paints before ~1.5 MB of them is parsed
  scripts: `<style>${processText(fontsCss, path.join(SRC, 'css'))}</style>\n<script>${safeScript(peer)}</script>\n<script>window.PION_I18N=${safeScript(JSON.stringify(allLangs))};</script>\n<script>${safeScript(app)}</script>\n`,
});
fs.writeFileSync(path.join(ROOT, 'pion-offline.html'), offline);

// ---------- installable app + offline: manifest, icons, service worker ----------
fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for(const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(ROOT, 'icons', f));
fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(ROOT, 'manifest.webmanifest'));
const precache = ['./pion-online.html', './' + appUrl, './' + peerUrl];
fs.writeFileSync(path.join(ROOT, 'sw.js'), read(path.join(SRC, 'sw.js')).replace('__VERSION__', hash(site + app)).replace('__PRECACHE__', JSON.stringify(precache)));

const sum = Object.entries(written);
console.log(`pion-online.html: ${kb(Buffer.byteLength(site))} + assets: app ${kb(written[appUrl.slice(7)])}, peerjs ${kb(written[peerUrl.slice(7)])}, one language ≈ ${kb(written[langUrls.en.slice(7)])}, fonts ${kb(sum.filter(([n]) => n.startsWith('fonts/')).reduce((a, [, b]) => a + b, 0))} (only the needed subsets load)`);
console.log(`pion-offline.html: ${kb(Buffer.byteLength(offline))}`);

if(CHECK){
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'pion-'));
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
