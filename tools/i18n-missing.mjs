// Lists Russian strings from src/ that have no translation in some language.
// Run: node tools/i18n-missing.mjs [lang]   → prints JSON {key: ""} for the missing keys
// Cyrillic string literals in the JS and Cyrillic text/attributes in index.html are keys
// (that is how t() and the static-HTML translator look them up). Keyword lists that only
// match user input are skipped (lines marked with  // i18n-skip  or inside k:[…] arrays).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const CYR = /[А-Яа-яЁё]/;
const keys = new Set();
const jsDir = path.join(SRC, 'js');
for(const f of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))){
  for(const line of fs.readFileSync(path.join(jsDir, f), 'utf8').split('\n')){
    if(line.includes('i18n-skip')) continue;
    const l = line.replace(/\bk:\[[^\]]*\]/g, '');
    for(const m of l.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)){
      const s = (m[1] ?? m[2]).replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
      if(CYR.test(s) && !/[<>]/.test(s)) keys.add(s);
    }
  }
}
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
for(const m of html.matchAll(/>([^<>]+)</g)){ const s = m[1].trim(); if(CYR.test(s)) keys.add(s); }
for(const m of html.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) if(CYR.test(m[1])) keys.add(m[1].trim());
const langs = fs.readFileSync(path.join(SRC, 'i18n', '_order.txt'), 'utf8').trim().split(/\s+/).filter(l => l !== 'ru');
const only = process.argv[2];
const out = {};
for(const lang of only ? [only] : langs){
  const d = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', lang + '.json'), 'utf8'));
  const miss = [...keys].filter(k => d[k] == null);
  if(only) miss.forEach(k => out[k] = '');
  else console.log(lang, miss.length);
}
if(only) console.log(JSON.stringify(out, null, 1));
