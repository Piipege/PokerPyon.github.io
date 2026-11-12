// Layout check: a table with bots at many screen sizes. Reports horizontal overflow, controls
// that are off screen or covered, and board/own cards that are hidden; saves screenshots.
// Run: node tools/layout.mjs [--shots] [--a11y]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file://' + path.join(ROOT, 'pyonpoker.html');
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, 'tools', 'shots') : null;
const A11Y = process.argv.includes('--a11y');
if(SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const SIZES = [
  ['phone-portrait', 390, 844, true], ['phone-small', 360, 640, true],
  ['phone-landscape', 844, 390, true], ['phone-landscape-small', 640, 360, true], ['phone-landscape-wide', 915, 412, true],
  ['tablet-portrait', 768, 1024, true], ['tablet-landscape', 1024, 768, true],
  ['tablet-big-portrait', 1024, 1366, true], ['tablet-big-landscape', 1366, 1024, true],
  ['laptop', 1280, 720, false], ['desktop', 1920, 1080, false],
];
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const browser = await chromium.launch();
let failed = 0;
for(const [name, w, h, touch] of SIZES.filter(s => !ONLY || s[0].includes(ONLY))){
  for(const bots of [3, 8]){
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1100, deviceScaleFactor: 1 });
    await ctx.addInitScript(([a11y]) => { window.PYONPOKER_TEST = 1; localStorage.setItem('pyonpoker-nick', 'Тест'); localStorage.setItem('pyonpoker-cfg', JSON.stringify({ lang: 'ru', speed: 'fast', ...(a11y ? { fs: 1.3, contrast: true } : {}) })); }, [A11Y]);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  ! ' + e.message); failed++; });
    await p.goto(URL);
    await p.click('[data-ltab="solo"]');
    await p.selectOption('#soloN', String(bots));
    await p.click('#bSolo');
    // wait until it is our turn on the flop or later, so that board and controls are all visible
    const t0 = Date.now();
    while(Date.now() - t0 < 40000){
      const st = await p.evaluate(() => { const S = window.__pyonpoker.S; const b = document.getElementById('bFold'); return { street: S && S.street, my: b && !b.hidden && !b.disabled && b.offsetParent !== null }; });
      if(st.my && st.street !== 'preflop') break;
      await p.evaluate(() => { const b = ['bCall', 'bNext'].map(id => document.getElementById(id)).find(b => b && !b.hidden && !b.disabled && b.offsetParent); if(b) b.click(); });
      await p.waitForTimeout(250);
    }
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const W = innerWidth, H = innerHeight, issues = [];
      if(document.documentElement.scrollWidth > W + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
      const visible = el => { const b = el.getBoundingClientRect(); if(b.width < 2 || b.height < 2) return 'zero'; const cx = Math.min(W - 1, Math.max(0, b.left + b.width / 2)), cy = Math.min(H - 1, Math.max(0, b.top + b.height / 2)); if(b.right < 0 || b.left > W) return 'off'; const top = document.elementFromPoint(cx, cy); return top && (el === top || el.contains(top) || top.contains(el)) ? 'ok' : 'covered by ' + (top ? (top.id || top.className || top.tagName) : 'nothing'); };
      for(const id of ['bFold', 'bCall', 'bRaise']){ const el = document.getElementById(id); if(el && !el.hidden){ const b = el.getBoundingClientRect(); if(b.bottom > document.documentElement.scrollHeight + 1) issues.push(id + ' below the page'); const v = visible(el); if(v !== 'ok' && v !== 'off') issues.push(`${id}: ${v}`); if(b.height < 40 && matchMedia('(pointer:coarse)').matches) issues.push(`${id}: touch target ${Math.round(b.height)}px`); } }
      document.querySelectorAll('#board .card').forEach((c, k) => { const v = visible(c); if(v !== 'ok') issues.push(`board card ${k + 1}: ${v}`); });
      const mine = [...document.querySelectorAll('.seat.me .card, .seat.me .hole .card')];
      mine.forEach((c, k) => { const v = visible(c); if(v !== 'ok') issues.push(`own card ${k + 1}: ${v}`); });
      const seats = [...document.querySelectorAll('#seats .seat')].map(s => s.getBoundingClientRect());
      const tbl = document.getElementById('table').getBoundingClientRect();
      seats.forEach((b, k) => { if(b.left < -2 || b.right > W + 2) issues.push(`seat ${k + 1} off screen sideways`); });
      return { issues, table: [Math.round(tbl.width), Math.round(tbl.height)], ctl: Math.round(document.querySelector('.controls').getBoundingClientRect().height), scrollH: document.documentElement.scrollHeight, H };
    });
    const tag = `${name} ${w}×${h}, ${bots + 1} players`;
    if(r.issues.length){ failed++; console.log(`✗ ${tag}: ${r.issues.join('; ')}`); }
    else console.log(`✓ ${tag} (table ${r.table.join('×')}, controls ${r.ctl}px, page ${r.scrollH}px)`);
    if(SHOTS) await p.screenshot({ path: path.join(SHOTS, `${A11Y ? 'a11y-' : ''}${name}-${bots + 1}.png`) });
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `layout issues: ${failed}` : 'layout ok');
process.exit(failed ? 1 : 0);
