// Performance probe: load time, script cost, long tasks while playing with bots, hot functions.
// Run: node tools/perf.mjs [page.html]   (served over http with a 4G-like throttle)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.argv[2] || 'pion-online.html';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let bytes = 0;
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, ''));
  fs.readFile(f, (e, d) => {
    if(e){ r.writeHead(404); r.end(); return; }
    const ext = path.extname(f), gz = /html|js|css|json|manifest/.test(TYPES[ext] || '');
    const body = gz ? zlib.gzipSync(d, { level: 6 }) : d; bytes += body.length;
    r.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', ...(gz ? { 'content-encoding': 'gzip' } : {}) }); r.end(body);
  });
}).listen(8433, '127.0.0.1');
const browser = await chromium.launch();
async function load(label, throttle){
  bytes = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.PION_TEST = 1; localStorage.setItem('pion-nick', 'T'); });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if(throttle){ await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:8433/${PAGE}`, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await p.waitForFunction(() => window.__pion);
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null }; });
  console.log(`${label}: transferred ${(bytes / 1024).toFixed(0)} KB, FCP ${nav.fcp} ms, DOMContentLoaded ${nav.dcl} ms, load ${nav.load} ms`);
  return { p, ctx, cdp };
}
await load('fast network, desktop CPU');
const { p, ctx } = await load('4G-like (1.6 Mbit/s, 150 ms) + CPU ×4 (budget phone)', true);
// long tasks while playing 4 hands with bots and help mode on
await p.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: false }); });
await p.click('[data-ltab="solo"]'); await p.check('#sOn').catch(() => {}); await p.click('#bSolo');
const t0 = Date.now();
while(Date.now() - t0 < 60000 && await p.evaluate(() => window.__pion.HIST().length) < 4){
  await p.evaluate(() => { const b = ['bCall', 'bNext'].map(id => document.getElementById(id)).find(b => b && !b.hidden && !b.disabled && b.offsetParent); if(b) b.click(); });
  await p.waitForTimeout(200);
}
const lt = await p.evaluate(() => window.__lt);
lt.sort((a, b) => b - a);
console.log(`play (CPU ×4): ${lt.length} long tasks > 50 ms, worst ${lt.slice(0, 5).map(Math.round).join(', ')} ms, total ${Math.round(lt.reduce((a, b) => a + b, 0))} ms`);
const t1 = Date.now(); await p.evaluate(() => window.__pion.openCoach()); console.log(`open coach review (CPU ×4): ${Date.now() - t1} ms`);
await ctx.close(); await browser.close(); srv.close();
