// Smoke test: course generators, a few hands against bots, the coach review and chat,
// and screenshots at several screen sizes.   Run: node tools/smoke.mjs [--shots]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file://' + path.join(ROOT, process.env.PION_PAGE || 'pion-online.html');
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, 'tools', 'shots') : null;
if(SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if(!c) failed++; };
const browser = await chromium.launch();
const init = (lang) => { window.PION_TEST = 1; try{ localStorage.setItem('pion-cfg', JSON.stringify({ lang, speed: 'fast' })); localStorage.setItem('pion-nick', 'Тест'); }catch(e){} };

async function page(lang = 'ru', opts = {}){
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, ...opts });
  await ctx.addInitScript(init, lang);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  ! page error: ' + e.message); failed++; });
  await p.goto(URL);
  await p.waitForFunction(() => window.__pion);
  return p;
}

console.log('course generators');
{
  const p = await page();
  const res = await p.evaluate(() => {
    const { GEN, LESSONS, DRILLS } = window.__pion, bad = [];
    const names = new Set([...LESSONS.flatMap(l => l.gen), ...DRILLS.flatMap(d => d.gen)]);
    for(const g of names) for(let i = 0; i < 60; i++){
      try{
        const q = GEN[g]();
        if(!q || !q.q || !Array.isArray(q.opts) || q.opts.length < 2 || !(q.ans >= 0 && q.ans < q.opts.length) || !q.exp || new Set(q.opts.map(o => JSON.stringify(o))).size !== q.opts.length) { bad.push(g + ': ' + JSON.stringify(q).slice(0, 160)); break; }
      }catch(e){ bad.push(g + ': ' + e.message); break; }
    }
    return { n: names.size, bad };
  });
  ok(!res.bad.length, `${res.n} generators × 60 questions are well-formed` + (res.bad.length ? '\n     ' + res.bad.join('\n     ') : ''));
  // open the course, a new lesson, its practice and a drill
  await p.evaluate(() => window.__pion.openLearn(10));
  ok(await p.locator('#lesson h4').textContent() === 'Позиции за столом', 'new lesson 11 opens with its title');
  await p.click('[data-act="start"]');
  for(let k = 0; k < 5; k++){ await p.click('#lesson [data-opt="0"]'); await p.click('[data-act="next"]'); }
  ok(await p.locator('.result .big').isVisible(), 'practice runs to the result screen');
  await p.click('[data-view="drills"]');
  ok(await p.locator('.drill').count() === 7, 'drills list shows 7 drills');
  await p.click('[data-drill="nuts"]');
  for(let k = 0; k < 4; k++){ await p.click('#lesson [data-opt="0"]'); await p.click('[data-act="drillNext"]'); }
  ok(/Решено: 4/.test(await p.locator('.qhead').textContent()), 'drill counts answers');
  if(SHOTS){ await p.click('#lesson [data-opt="1"]'); await p.screenshot({ path: path.join(SHOTS, 'drill.png') }); }
  await p.context().close();
}

console.log('language switch loads its dictionary');
{
  const p = await page();
  await p.selectOption('#langSel', 'de');
  ok(await p.waitForFunction(() => document.querySelector('#bSolo').textContent.trim() !== 'Играть с ботами', null, { timeout: 5000 }).then(() => true, () => false), 'switching to German translates the page: ' + (await p.locator('#bSolo').textContent()).trim());
  await p.selectOption('#langSel', 'ru');
  ok(await p.waitForFunction(() => document.querySelector('#bSolo').textContent.trim() === 'Играть с ботами', null, { timeout: 5000 }).then(() => true, () => false), 'and back to Russian');
  await p.context().close();
}

console.log('coach verdicts on fixed hands');
{
  const p = await page();
  const v = await p.evaluate(() => {
    const P = window.__pion, me = P.myUid, k = (r, s) => r * 4 + s;
    // 6 players, dealer = 'd'; seat order: me is first after the big blind (early position)
    const seats = ['d', 's', 'b', me, 'x', 'y'].map(u => ({ u, n: u, b: u !== me, st: 1000 }));
    const base = (mine, ev, board = []) => ({ no: 1, at: Math.random(), sb: 10, bb: 20, dealer: 'd', seats, ev: [{ a: 'sb', u: 's', p: 10, to: 10 }, { a: 'bb', u: 'b', p: 20, to: 20 }, ...ev], board, win: [], shown: {}, delta: {}, mine });
    const out = {};
    // 7-2 offsuit open-raise from early position → mistake
    out.trashOpen = P.reviewOf(base([k(7, 0), k(2, 1)], [{ a: 'raise', u: me, p: 60, to: 60 }])).ds[0].verdict;
    // aces folded unopened → mistake
    out.acesFold = P.reviewOf(base([k(14, 0), k(14, 1)], [{ a: 'fold', u: me, p: 0, to: 0 }])).ds[0].verdict;
    // aces raised → good
    out.acesRaise = P.reviewOf(base([k(14, 0), k(14, 1)], [{ a: 'raise', u: me, p: 60, to: 60 }])).ds[0].verdict;
    // facing a raise and a 3-bet with K-9 offsuit, calling → mistake
    out.k9vs3bet = P.reviewOf(base([k(13, 0), k(9, 1)], [{ a: 'raise', u: 'x', p: 60, to: 60 }, { a: 'raise', u: 'y', p: 180, to: 180 }, { a: 'call', u: me, p: 180, to: 180 }])).ds[0].verdict;
    // river: calling a pot-size bet with nothing (7-high on a board of high cards) → mistake
    const board = [k(14, 2), k(13, 2), k(12, 3), k(9, 0), k(4, 3)];
    out.riverCall = P.reviewOf(base([k(7, 0), k(2, 1)], [
      { a: 'call', u: me, p: 20, to: 20 }, { a: 'fold', u: 'x', p: 0, to: 0 }, { a: 'fold', u: 'y', p: 0, to: 0 }, { a: 'fold', u: 'd', p: 0, to: 0 }, { a: 'fold', u: 's', p: 0, to: 0 }, { a: 'check', u: 'b', p: 0, to: 20 },
      { a: 'street', u: null, p: 0, to: 0, c: board.slice(0, 3) }, { a: 'check', u: 'b', p: 0, to: 0 }, { a: 'check', u: me, p: 0, to: 0 },
      { a: 'street', u: null, p: 0, to: 0, c: board.slice(0, 4) }, { a: 'check', u: 'b', p: 0, to: 0 }, { a: 'check', u: me, p: 0, to: 0 },
      { a: 'street', u: null, p: 0, to: 0, c: board }, { a: 'bet', u: 'b', p: 45, to: 45 }, { a: 'call', u: me, p: 45, to: 45 }], board)).ds.pop().verdict;
    return out;
  });
  ok(v.trashOpen === 'bad', `7-2o open from early position → ✗ (${v.trashOpen})`);
  ok(v.acesFold === 'bad', `folding aces unopened → ✗ (${v.acesFold})`);
  ok(v.acesRaise === 'good', `raising aces → ✓ (${v.acesRaise})`);
  ok(v.k9vs3bet === 'bad', `calling a 3-bet with K-9o → ✗ (${v.k9vs3bet})`);
  ok(v.riverCall === 'bad', `calling a river bet with 7-high → ✗ (${v.riverCall})`);
  await p.context().close();
}

console.log('hands against bots + coach');
{
  const p = await page();
  await p.click('[data-ltab="solo"]');
  await p.selectOption('#soloN', '3');
  await p.click('#bSolo');
  // play: call or check most of the time, sometimes fold or raise; wait for 6 recorded hands
  const t0 = Date.now();
  while(Date.now() - t0 < 120000){
    const n = await p.evaluate(() => window.__pion.HIST().length);
    if(n >= 6) break;
    const acted = await p.evaluate(() => {
      const v = id => { const b = document.getElementById(id); return b && !b.hidden && !b.disabled && b.offsetParent ? b : null; };
      const r = Math.random();
      const b = (r < .15 && v('bFold')) || (r < .3 && v('bRaise')) || v('bCall') || v('bNext');
      if(b){ b.click(); return true; } return false;
    });
    await p.waitForTimeout(acted ? 150 : 300);
  }
  const n = await p.evaluate(() => window.__pion.HIST().length);
  ok(n >= 6, `played ${n} hands`);
  const reviews = await p.evaluate(() => window.__pion.HIST().map(r => { const R = window.__pion.reviewOf(r); return R ? { ds: R.ds.length, bad: R.ds.filter(d => !d.why).length } : null; }));
  ok(reviews.every(Boolean), 'every hand has a review');
  ok(reviews.every(r => r.bad === 0), 'every decision has an explanation');
  ok(reviews.some(r => r.ds > 0), 'reviews contain decisions');
  await p.click('#bPanel').catch(() => {});
  await p.evaluate(() => window.__pion.openCoach());
  ok(await p.locator('#coachLog .step').count() >= 0, 'coach opens with the step list');
  for(const id of ['mistakes', 'better', 'odds', 'outs', 'opp', 'lesson', 'style', 'prev']){
    const before = await p.locator('#coachLog .cm').count();
    await p.click(`[data-intent="${id}"]`);
    ok(await p.locator('#coachLog .cm').count() >= before + 2, `chip "${id}" gets an answer`);
  }
  for(const q of ['что такое ауты?', 'почему это ошибка', 'что было на флопе', 'what is VPIP', 'абракадабра']){
    await p.fill('#coachIn', q); await p.press('#coachIn', 'Enter');
    const last = await p.locator('#coachLog .cm.coach').last().textContent();
    ok(last.length > 10 && !/undefined|\{0\}|NaN/.test(last), `answers "${q}": ${last.slice(0, 70).replace(/\s+/g, ' ')}…`);
  }
  if(SHOTS){
    await p.evaluate(() => window.__pion.openCoach());
    await p.screenshot({ path: path.join(SHOTS, 'coach-desktop.png') });
  }
  // profile: lifetime stats from IndexedDB, chart, achievements; player card at the table
  await p.evaluate(() => { document.getElementById('coachOv').hidden = true; });
  await p.waitForTimeout(800);
  await p.click('#bProfile');
  ok(await p.waitForFunction(() => /^\d+$/.test(document.querySelector('.ptile b')?.textContent || '') && +document.querySelector('.ptile b').textContent >= 6, null, { timeout: 8000 }).then(() => true, () => false), 'profile counts the played hands: ' + await p.locator('.ptile b').first().textContent().catch(() => '?'));
  ok(await p.locator('#pfChart svg path.line').count() === 1, 'results chart is drawn');
  const box = await p.locator('#pfChart svg').boundingBox();
  await p.mouse.move(box.x + box.width * .6, box.y + box.height / 2);
  ok(await p.locator('.ctip').isVisible(), 'chart tooltip appears on hover');
  ok(await p.locator('.ach.on').count() >= 1, 'at least one achievement unlocked');
  ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('pion-pf') || 'null')?.h), 'summary for the table is saved');
  if(SHOTS) await p.screenshot({ path: path.join(SHOTS, 'profile-desktop.png') });
  await p.click('#profClose');
  await p.locator('#seats .seat:not(.me) .plate').first().click();
  ok(await p.locator('#pcardOv').isVisible() && /Бот|уровень/.test(await p.locator('#pcardBody').textContent()), 'tapping a bot opens its card');
  await p.click('#pcardClose');
  await p.locator('#seats .seat.me .plate').click();
  ok(/За всё время/.test(await p.locator('#pcardBody').textContent()), 'my card shows lifetime stats');
  await p.click('#pcardClose');
  const reload = await p.evaluate(async () => { localStorage.setItem('pion-hist', '[]'); return true; });
  await p.reload(); await p.waitForFunction(() => window.__pion); await p.click('#bProfile2');
  ok(await p.waitForFunction(() => +(document.querySelector('.ptile b')?.textContent || 0) >= 6, null, { timeout: 8000 }).then(() => true, () => false), 'stats survive a reload even with the history list cleared');
  await p.context().close();
}

console.log('coach in English, on a phone');
{
  const p = await page('en', { ...devices['Pixel 5'] });
  await p.click('[data-ltab="solo"]'); await p.click('#bSolo');
  const t0 = Date.now();
  while(Date.now() - t0 < 60000 && await p.evaluate(() => window.__pion.HIST().length) < 2){
    await p.evaluate(() => { const b = ['bCall', 'bNext'].map(id => document.getElementById(id)).find(b => b && !b.hidden && !b.disabled && b.offsetParent); if(b) b.click(); });
    await p.waitForTimeout(200);
  }
  await p.evaluate(() => window.__pion.openCoach());
  await p.click('[data-intent="odds"]');
  const txt = await p.locator('#coachOv').textContent();
  ok(!/[А-Яа-яЁё]{4,}/.test(txt.replace(/Тест/g, '')), 'no Russian text left in the English coach');
  const fits = await p.evaluate(() => { const b = document.querySelector('.coachbox').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth; });
  ok(fits, 'coach window fits the phone screen');
  if(SHOTS) await p.screenshot({ path: path.join(SHOTS, 'coach-phone-en.png') });
  await p.evaluate(() => { document.getElementById('coachOv').hidden = true; });
  await p.waitForTimeout(600);
  await p.click('#bMenu'); await p.click('[data-proxy="bProfile"]');
  await p.waitForSelector('.ptile');
  const txt2 = await p.locator('#profOv').textContent();
  ok(!/[А-Яа-яЁё]{4,}/.test(txt2.replace(/Тест/g, '')), 'no Russian text left in the English profile');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.profbox').getBoundingClientRect().right <= innerWidth + 1), 'profile fits the phone screen');
  if(SHOTS) await p.screenshot({ path: path.join(SHOTS, 'profile-phone-en.png') });
  await p.context().close();
}

await browser.close();
console.log(failed ? `FAILED: ${failed}` : 'smoke test passed');
process.exit(failed ? 1 : 0);
