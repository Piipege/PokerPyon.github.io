// Network test: a host and a guest in separate browser contexts, a local PeerJS server.
// Checks that the guest keeps its seat through a dead link, going offline, a host reload
// and its own page reload.   Run: node tools/net-test.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { ExpressPeerServer } = require('peer');
const express = require('express');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PEER_PORT = 9411, WEB_PORT = 8411;
{ const app = express(); const srv = app.listen(PEER_PORT, '127.0.0.1'); app.use('/', ExpressPeerServer(srv, { path: '/' })); }
http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/+/, '') || 'pion-online.html');
  fs.readFile(f, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'}); r.end(d); });
}).listen(WEB_PORT, '127.0.0.1');
const URL = `http://127.0.0.1:${WEB_PORT}/pion-online.html`;

const init = () => {
  window.PION_PEER_OPTS = { host: '127.0.0.1', port: 9411, path: '/', secure: false, config: { iceServers: [] } };
  window.__pcs = [];
  const P = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...a){ const pc = new P(...a); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = P.prototype;
  try{ localStorage.setItem('pion-cfg', JSON.stringify({ lang: 'ru' })); localStorage.setItem('pion-tour', '1'); localStorage.setItem('pion-tour3', '1'); }catch(e){}
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if(!cond) failed++; };
async function waitFor(page, fn, ms = 20000, arg){ try{ await page.waitForFunction(fn, arg, { timeout: ms, polling: 250 }); return true; }catch(e){ return false; } }

const browser = await chromium.launch();
const hostCtx = await browser.newContext(), guestCtx = await browser.newContext();
await hostCtx.addInitScript(init); await guestCtx.addInitScript(init);
const host = await hostCtx.newPage(), guest = await guestCtx.newPage();
for(const [n, p] of [['host', host], ['guest', guest]]) p.on('pageerror', e => { console.log(`  ! ${n} page error: ${e.message}\n${(e.stack||'').split('\n').slice(0,4).join('\n')}`); failed++; });

await host.goto(URL);
await host.fill('#nick', 'Хозяйка');
await host.click('[data-ltab="create"]');
await host.selectOption('#botsN', '1');
await host.click('#bCreate');
await waitFor(host, () => /#t-/.test(location.hash));
const code = (await host.evaluate(() => location.hash)).slice(3).toUpperCase();
console.log('table', code);

await guest.goto(URL);
await guest.fill('#nick', 'Гость');
await guest.click('[data-ltab="open"]');
await guest.fill('#joinCode', code);
await guest.click('#bJoin');
const seated = () => document.querySelector('#lobby').hidden && /Гость/.test(document.querySelector('#seats').textContent);
ok(await waitFor(guest, seated), 'guest joins and sees its seat');
ok(await waitFor(host, () => /Гость/.test(document.querySelector('#seats').textContent)), 'host sees the guest');
const seatsCount = () => document.querySelectorAll('#seats .seat').length;
console.log('0. profile cards');
await guest.evaluate(() => { localStorage.setItem('pion-pf', JSON.stringify({ h: 4242, bb100: 3.5, vp: 22, pr: 15, wsd: 55, acc: 81, ls: 7, since: 1700000000000 })); });
await guest.evaluate(() => document.querySelector('#lobby') && document.getElementById('avRand')?.click());
await host.waitForTimeout(1500);
await host.locator('#seats .seat:not(.me)', { hasText: 'Гость' }).locator('.plate').click();
ok(await host.waitForFunction(() => /4242/.test(document.querySelector('#pcardBody').textContent), null, { timeout: 8000 }).then(() => true, () => false), "host sees the guest's lifetime stats on its card");
await host.click('#pcardClose');
const n0 = await host.evaluate(seatsCount);

console.log('1. data channel dies silently on the host side');
await host.evaluate(() => window.__pcs.forEach(pc => { try{ pc.close(); }catch(e){} }));
ok(await waitFor(guest, () => !document.querySelector('#netBar').hidden, 25000), 'guest shows the "connection lost" strip');
ok(await waitFor(guest, () => document.querySelector('#netBar').hidden, 30000), 'guest reconnects by itself');
ok(await host.evaluate(seatsCount) === n0, 'no duplicate seat on the host');

console.log('2. guest goes offline for 12 s');
await guestCtx.setOffline(true);
await guest.evaluate(() => window.__pcs.forEach(pc => { try{ pc.close(); }catch(e){} }));
ok(await waitFor(guest, () => !document.querySelector('#netBar').hidden && /интернет/i.test(document.querySelector('#netBarText').textContent), 15000), 'guest says there is no internet');
await guest.evaluate(() => { const b = document.querySelector('#chatIn') || document.querySelector('#chatInput'); return !!b; });
await sleep(12000);
await guestCtx.setOffline(false);
ok(await waitFor(guest, () => document.querySelector('#netBar').hidden, 25000), 'guest is back right after the network returns');
ok(await waitFor(guest, seated, 5000), 'guest still has its seat');

console.log('3. host reloads the page');
await host.reload();
ok(await waitFor(host, () => document.querySelector('#lobby').hidden, 20000), 'host resumes its table');
ok(await waitFor(guest, () => document.querySelector('#netBar').hidden && /Гость/.test(document.querySelector('#seats').textContent), 40000), 'guest comes back to the resumed table');
ok(await waitFor(host, () => /Гость/.test(document.querySelector('#seats').textContent) && !document.querySelector('#seats .seat.offline'), 20000), 'host sees the guest online again');
ok(await host.evaluate(seatsCount) === n0, 'still the same number of seats');

console.log('4. guest reloads its page');
await guest.reload();
ok(await waitFor(guest, seated, 20000), 'guest rejoins from the link after a reload');
ok(await host.evaluate(seatsCount) === n0, 'no duplicate seat after the guest reload');

console.log('5. guest closes the tab and opens the site without the link');
await guest.goto(URL.replace('#', '') + '#');
await guest.evaluate(() => history.replaceState(null, '', location.pathname));
await guest.reload();
ok(await waitFor(guest, () => !document.querySelector('#bResume').hidden && /Вернуться за стол/.test(document.querySelector('#bResume').textContent), 8000), 'lobby offers "back to table"');
await guest.click('#bResume');
ok(await waitFor(guest, seated, 20000), 'one click brings the guest back');

console.log('5b. a friend watches, then takes a seat');
const wCtx = await browser.newContext(); await wCtx.addInitScript(init);
const watcher = await wCtx.newPage(); watcher.on('pageerror', e => { console.log('  ! watcher page error: ' + e.message); failed++; });
await watcher.goto(URL); await watcher.fill('#nick', 'Зритель');
await watcher.click('[data-ltab="open"]'); await watcher.fill('#joinCode', code); await watcher.click('#bWatch');
ok(await waitFor(watcher, () => document.querySelector('#lobby').hidden && !document.querySelector('#watchRow').hidden), 'watcher sees the table with «Take a seat»');
ok(await waitFor(host, () => /1/.test(document.querySelector('#watchChip').textContent) && !document.querySelector('#watchChip').hidden), 'host shows one spectator');
const nW = await host.evaluate(seatsCount);
ok(nW === n0 && !(await host.evaluate(() => /Зритель/.test(document.querySelector('#seats').textContent))), 'the spectator does not take a seat');
await watcher.click('#bSit');
ok(await waitFor(host, () => /Зритель/.test(document.querySelector('#seats').textContent)), 'after «Take a seat» the friend sits at the table');
ok(await waitFor(watcher, () => document.querySelector('#watchRow').hidden), 'and the spectator bar disappears');
await wCtx.close();

console.log('6. host closes the table');
await host.click('#bExit'); await sleep(300); await host.click('#bExit');
ok(await waitFor(guest, () => !document.querySelector('#lobby').hidden, 15000), 'guest returns to the lobby when the table is closed');
ok(await guest.evaluate(() => !localStorage.getItem('pion-guest')), 'and forgets the table');

console.log('7. Omaha knockout with a friend: four cards, fair deck check');
{
  const hC = await browser.newContext(), gC = await browser.newContext(); await hC.addInitScript(init); await gC.addInitScript(init);
  const h2 = await hC.newPage(), g2 = await gC.newPage();
  for(const [n, pg] of [['host2', h2], ['guest2', g2]]) pg.on('pageerror', e => { console.log(`  ! ${n} page error: ${e.message}`); failed++; });
  await h2.goto(URL); await h2.fill('#nick', 'Ведущая'); await h2.click('[data-ltab="create"]');
  await h2.selectOption('#tblGame', 'omaha'); await h2.selectOption('#tblFmt', 'ko'); await h2.selectOption('#botsN', '1'); await h2.click('#bCreate');
  await waitFor(h2, () => /#t-/.test(location.hash));
  const code2 = (await h2.evaluate(() => location.hash)).slice(3).toUpperCase();
  await g2.goto(URL); await g2.fill('#nick', 'Друг'); await g2.click('[data-ltab="open"]'); await g2.fill('#joinCode', code2); await g2.click('#bJoin');
  await waitFor(h2, () => /Друг/.test(document.querySelector('#seats').textContent));
  await h2.click('#bNext');
  ok(await waitFor(g2, () => document.querySelectorAll('.seat.me .cards .card:not(.back)').length === 4, 20000), 'guest gets four hole cards in Omaha');
  // play calls until a flop is out, then the guest's fair-deck check must pass
  const t0 = Date.now(); let flop = false;
  while(Date.now() - t0 < 40000 && !flop){
    for(const pg of [h2, g2]) await pg.evaluate(() => { const b = ['bCall', 'bNext'].map(id => document.getElementById(id)).find(b => b && !b.hidden && !b.disabled && b.offsetParent); if(b) b.click(); });
    flop = await g2.evaluate(() => document.querySelectorAll('#board .card:not(.ghost)').length >= 3);
    await g2.waitForTimeout(300);
  }
  ok(flop, 'the hand reaches the flop');
  ok(await waitFor(g2, () => { const f = document.getElementById('fairChip'); return f && !f.hidden && f.classList.contains('ok') && !f.classList.contains('bad'); }, 10000), 'fair-deck check passes with four hole cards');
  ok(await g2.evaluate(() => /Омаха/.test(document.querySelector('h1 .sub').textContent)), 'header shows the game');
  await hC.close(); await gC.close();
}
await browser.close();
console.log(failed ? `FAILED: ${failed}` : 'all network checks passed');
process.exit(failed ? 1 : 0);
