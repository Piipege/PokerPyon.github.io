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
  try{ localStorage.setItem('pion-cfg', JSON.stringify({ lang: 'ru' })); }catch(e){}
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if(!cond) failed++; };
async function waitFor(page, fn, ms = 20000, arg){ try{ await page.waitForFunction(fn, arg, { timeout: ms, polling: 250 }); return true; }catch(e){ return false; } }

const browser = await chromium.launch();
const hostCtx = await browser.newContext(), guestCtx = await browser.newContext();
await hostCtx.addInitScript(init); await guestCtx.addInitScript(init);
const host = await hostCtx.newPage(), guest = await guestCtx.newPage();
for(const [n, p] of [['host', host], ['guest', guest]]) p.on('pageerror', e => { console.log(`  ! ${n} page error: ${e.message}`); failed++; });

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
await guest.fill('#joinCode', code);
await guest.click('#bJoin');
const seated = () => document.querySelector('#lobby').hidden && /Гость/.test(document.querySelector('#seats').textContent);
ok(await waitFor(guest, seated), 'guest joins and sees its seat');
ok(await waitFor(host, () => /Гость/.test(document.querySelector('#seats').textContent)), 'host sees the guest');
const seatsCount = () => document.querySelectorAll('#seats .seat').length;
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

console.log('6. host closes the table');
await host.click('#bExit'); await sleep(300); await host.click('#bExit');
ok(await waitFor(guest, () => !document.querySelector('#lobby').hidden, 15000), 'guest returns to the lobby when the table is closed');
ok(await guest.evaluate(() => !localStorage.getItem('pion-guest')), 'and forgets the table');

await browser.close();
console.log(failed ? `FAILED: ${failed}` : 'all network checks passed');
process.exit(failed ? 1 : 0);
