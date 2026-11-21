// Draws src/assets/peony.svg and peony-bud.svg (the brand's line-art peony).   Run: node tools/peony.mjs
// Peony as line art: every petal is a closed shape, drawn back to front; the outline of each petal is
// masked by the petals in front of it, so only the visible lines remain (like a pen drawing).
// The stroke is currentColor, so the page decides its colour.
import fs from 'node:fs';
const f = n => +n.toFixed(1);
// a petal from base (x, y) towards angle ang: narrow base, wide round tip with an optional notch
function petal(x, y, angDeg, len, wid, notch = .12){
  const a = angDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], p = [-d[1], d[0]];
  const P = (u, v) => [x + d[0] * u + p[0] * v, y + d[1] * u + p[1] * v];
  const w = wid / 2, L = len;
  const pts = [
    ['M', P(0, 0)],
    ['C', P(L * .35, -w * .95), P(L * .78, -w * 1.08), P(L * .97, -w * .55)],
    ['C', P(L * 1.06, -w * .25), P(L * 1.02, -w * .05), P(L * (1 - notch * .5), 0)],
    ['C', P(L * 1.02, w * .05), P(L * 1.06, w * .25), P(L * .97, w * .55)],
    ['C', P(L * .78, w * 1.08), P(L * .35, w * .95), P(0, 0)],
  ];
  return pts.map(([c, ...q]) => c + q.map(([u, v]) => f(u) + ' ' + f(v)).join(' ')).join(' ') + 'Z';
}
const ell = (cx, cy, rx, ry, rot) => { const r = rot * Math.PI / 180, P = t => [cx + rx * Math.cos(t) * Math.cos(r) - ry * Math.sin(t) * Math.sin(r), cy + rx * Math.cos(t) * Math.sin(r) + ry * Math.sin(t) * Math.cos(r)]; const k = .5523; let d = ''; for(let i = 0; i < 4; i++){ const t0 = i * Math.PI / 2, t1 = t0 + Math.PI / 2, p0 = P(t0), p1 = P(t1), d0 = [-rx * Math.sin(t0) * Math.cos(r) - ry * Math.cos(t0) * Math.sin(r), -rx * Math.sin(t0) * Math.sin(r) + ry * Math.cos(t0) * Math.cos(r)], d1 = [-rx * Math.sin(t1) * Math.cos(r) - ry * Math.cos(t1) * Math.sin(r), -rx * Math.sin(t1) * Math.sin(r) + ry * Math.cos(t1) * Math.cos(r)]; if(!i) d += `M${f(p0[0])} ${f(p0[1])}`; d += ` C${f(p0[0] + d0[0] * k)} ${f(p0[1] + d0[1] * k)} ${f(p1[0] - d1[0] * k)} ${f(p1[1] - d1[1] * k)} ${f(p1[0])} ${f(p1[1])}`; } return d + 'Z'; };
// back to front
const petals = [
  // the back crown, pointing up and out
  petal(256, 250, -152, 150, 150, .04), petal(256, 246, -120, 162, 146, .05), petal(256, 244, -90, 156, 150, .04), petal(256, 246, -60, 162, 146, .05), petal(256, 250, -28, 150, 150, .04),
  // the wide side petals
  petal(246, 270, 170, 182, 168, .05), petal(266, 270, 10, 182, 168, .05),
  // the big bottom petals
  petal(236, 286, 120, 168, 186, .04), petal(276, 286, 60, 168, 186, .04),
  // the inner cup rim
  petal(256, 236, -142, 98, 104, .03), petal(256, 234, -108, 104, 100, .03), petal(256, 234, -72, 104, 100, .03), petal(256, 236, -38, 98, 104, .03),
  // curls in the very middle
  ell(232, 176, 26, 34, -30), ell(282, 176, 26, 34, 30), ell(256, 196, 34, 26, 0),
  // the front of the cup: rounded lumps closing it from below
  ell(196, 262, 62, 44, -28), ell(316, 262, 62, 44, 28), ell(256, 250, 52, 40, 0), ell(222, 300, 66, 42, -10), ell(292, 300, 66, 42, 10),
];
// fold lines inside a few petals (drawn with their petal, so they are masked the same way)
const folds = {
  5: 'M96 296 C126 284 162 286 190 298', 6: 'M416 296 C386 284 350 286 322 298',
  7: 'M150 410 C162 384 184 366 208 356', 8: 'M362 410 C350 384 328 366 304 356',
  0: 'M150 190 C166 200 182 212 196 226', 4: 'M362 190 C346 200 330 212 316 226',
};
function svg(viewBox, sw){
  const defs = petals.map((d, i) => `<path id="pp${i}" d="${d}"/>`).join('');
  const masks = petals.map((_, i) => i === petals.length - 1 ? '' : `<mask id="pm${i}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="600" height="600"><rect x="-40" y="-40" width="600" height="600" fill="#fff"/>${petals.slice(i + 1).map((__, j) => `<use href="#pp${i + 1 + j}" fill="#000"/>`).join('')}</mask>`).join('');
  const body = petals.map((_, i) => `<g${i === petals.length - 1 ? '' : ` mask="url(#pm${i})"`}><use href="#pp${i}"/>${folds[i] ? `<path d="${folds[i]}"/>` : ''}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><defs>${defs}${masks}</defs>${body}</svg>\n`;
}
fs.writeFileSync('' + new URL('../src/assets/', import.meta.url).pathname + 'peony.svg', svg('50 60 412 400', 3.2));
fs.writeFileSync('' + new URL('../src/assets/', import.meta.url).pathname + 'peony-bud.svg', svg('50 60 412 400', 9));
console.log(fs.statSync('' + new URL('../src/assets/', import.meta.url).pathname + 'peony.svg').size, 'bytes');
