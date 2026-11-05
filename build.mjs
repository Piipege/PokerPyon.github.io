#!/usr/bin/env node
// Builds the single self-contained pion-online.html from src/.
// No dependencies: `node build.mjs` (add --check to also run syntax/shadowing checks).
//
// Directives understood inside src files:
//   @inline(path)   — the file's text, recursively processed
//   @datauri(path)  — the file as a base64 data: URI (mime type from the extension)
//   @include(path)  — the file's text as is
//   @i18n           — window.PION_I18N={...}; built from src/i18n/*.json (order from _order.txt)
//   @app            — the app script: src/js/* in the order of src/js/_order.txt, wrapped in one IIFE
// Paths are relative to the file that contains the directive.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'pion-online.html');
const MIME = { '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json', '.webmanifest':'application/manifest+json' };

const read = p => fs.readFileSync(p, 'utf8');
const lines = p => read(p).split('\n').map(s => s.trim()).filter(Boolean);

function i18n(){
  const dir = path.join(SRC, 'i18n');
  const obj = {};
  for(const lang of read(path.join(dir, '_order.txt')).trim().split(/\s+/)) obj[lang] = JSON.parse(read(path.join(dir, lang + '.json')));
  return 'window.PION_I18N=' + JSON.stringify(obj).replace(/<\//g, '<\\/') + ';';
}
function appFiles(){ const dir = path.join(SRC, 'js'); return lines(path.join(dir, '_order.txt')).map(f => path.join(dir, f)); }
function app(){ return '\n(() => {\n' + appFiles().map(read).join('') + '})();\n\n'; }

function processText(text, base){
  return text
    .replace(/@inline\(([^)]+)\)/g, (_, p) => { const f = path.resolve(base, p); return processText(read(f), path.dirname(f)); })
    .replace(/@include\(([^)]+)\)/g, (_, p) => read(path.resolve(base, p)).trim())
    .replace(/@datauri\(([^)]+)\)/g, (_, p) => {
      const f = path.resolve(base, p), mime = MIME[path.extname(f)] || 'application/octet-stream';
      return `data:${mime};base64,` + fs.readFileSync(f).toString('base64');
    })
    .replace('<script>@i18n</script>', () => '<script>' + i18n() + '</script>')
    .replace('<script>@app</script>', () => '<script>' + app() + '</script>');
}

const html = processText(read(path.join(SRC, 'index.html')), SRC);
fs.writeFileSync(OUT, html);
console.log(`pion-online.html: ${(html.length/1024).toFixed(0)} KB`);

if(process.argv.includes('--check')){
  // 1) syntax of every inline script
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'pion-'));
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, k) => {
    const f = path.join(tmp, `s${k}.js`); fs.writeFileSync(f, m[1]);
    execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
  });
  // 2) no call of t(), L() or tr() may hit a local variable with the same name
  const { checkShadowing } = await import('./tools/check.mjs');
  const appCode = app(), offs = [];
  let ln = 3; for(const f of appFiles()){ offs.push([ln, f]); ln += read(f).split('\n').length - 1; }
  const where = line => { let r = offs[0]; for(const o of offs) if(o[0] <= line) r = o; return `${path.relative(ROOT, r[1])}:${line - r[0] + 1}`; };
  const bad = checkShadowing(appCode);
  if(bad.length){ console.error('t / L / tr is shadowed by a local name at:\n' + bad.map(b => `  ${where(b.line)} (${b.name})`).join('\n')); process.exit(1); }
  console.log('checks: ok');
}
