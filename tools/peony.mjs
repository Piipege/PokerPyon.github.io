// Draws src/assets/peony.svg and peony-bud.svg: the brand's line-art peony.   Run: node tools/peony.mjs
// Style: one bold even outline, petals with wavy ("cloud") edges, a cup of crumpled petals in the
// middle, pointed leaves with a vein, the whole flower turned a little (three-quarter view).
// Every petal is a closed shape drawn back to front; the outline of a petal is masked by the
// petals in front of it, so only the visible lines remain. The stroke is currentColor.
import fs from 'node:fs';
const OUT = new URL('../src/assets/', import.meta.url).pathname;
const f = n => +n.toFixed(1);
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + (b - a) * rnd();

// a petal from base (x, y) towards angle ang: narrow base, wide end made of `lobes` round bumps
function petal(x, y, angDeg, len, wid, lobes = 3){
  const a = angDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], p = [-d[1], d[0]];
  const P = (u, v) => [x + d[0] * u + p[0] * v, y + d[1] * u + p[1] * v];
  const w = wid / 2, L = len, pts = [];
  // points on the end, from one side to the other, slightly rounded as a whole
  for(let i = 0; i <= lobes; i++){ const t = -1 + 2 * i / lobes; pts.push([L * (1 - .16 * t * t) * R(.97, 1.02), w * t * .92]); }
  let s = `M${P(0, 0).map(f).join(' ')}`;
  let c1 = P(L * .3, -w * 1.05), c2 = P(L * .72, -w * 1.12), e = P(...pts[0]);
  s += ` C${c1.map(f).join(' ')} ${c2.map(f).join(' ')} ${e.map(f).join(' ')}`;
  for(let i = 1; i <= lobes; i++){
    const [u0, v0] = pts[i - 1], [u1, v1] = pts[i], bulge = (v1 - v0) * .4 * R(.85, 1.15);
    const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
    const k1 = P(u0 + bulge, v0 + (vm - v0) * .2), k2 = P(u1 + bulge, v1 - (v1 - vm) * .2), end = P(u1, v1);
    s += ` C${k1.map(f).join(' ')} ${k2.map(f).join(' ')} ${end.map(f).join(' ')}`;
  }
  c1 = P(L * .72, w * 1.12); c2 = P(L * .3, w * 1.05);
  s += ` C${c1.map(f).join(' ')} ${c2.map(f).join(' ')} ${P(0, 0).map(f).join(' ')}Z`;
  return s;
}
// a cup petal seen from the side: a smooth round bottom and a wavy top edge with `lobes` bumps
function cup(cx, cy, w, h, rotDeg, lobes = 3){
  const a = rotDeg * Math.PI / 180, P = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)].map(f).join(' ');
  const hw = w / 2;
  let s = `M${P(-hw, 0)} C${P(-hw * 1.04, h * .68)} ${P(hw * 1.04, h * .68)} ${P(hw, 0)}`;
  const top = x => -h * .42 * (1 - .45 * (x / hw) ** 2);
  for(let i = 1; i <= lobes; i++){
    const x0 = hw - w * (i - 1) / lobes, x1 = hw - w * i / lobes, bump = h * R(.26, .36);
    const y0 = i === 1 ? 0 : top(x0), y1 = i === lobes ? 0 : top(x1);
    s += ` C${P(x0 - (x0 - x1) * .05, Math.min(y0, top(x0)) - bump)} ${P(x1 + (x0 - x1) * .05, Math.min(y1, top(x1)) - bump)} ${P(x1, y1)}`;
  }
  return s + 'Z';
}
// a pointed leaf with a vein (the vein is returned as a separate line)
function leaf(x, y, angDeg, len, wid){
  const a = angDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], p = [-d[1], d[0]];
  const P = (u, v) => [x + d[0] * u + p[0] * v, y + d[1] * u + p[1] * v].map(f).join(' ');
  const w = wid / 2;
  return [`M${P(0, 0)} C${P(len * .35, -w * 1.1)} ${P(len * .75, -w * .9)} ${P(len, 0)} C${P(len * .75, w * .9)} ${P(len * .35, w * 1.1)} ${P(0, 0)}Z`,
    `M${P(len * .08, 0)} C${P(len * .4, w * .12)} ${P(len * .7, w * .08)} ${P(len * .9, 0)}`];
}

const C = [256, 262];
const shapes = [];            // [d, extra line or null], back to front
const add = (d, line = null) => shapes.push([d, line]);
// leaves behind everything, sticking out between the petals
for(const [ang, len, wid] of [[-50, 262, 70], [-24, 236, 62], [150, 262, 64], [64, 250, 58]]){ const [d, v] = leaf(C[0], C[1], ang, len, wid); add(d, v); }
// the back petals around: broad, two or three soft waves each
add(petal(C[0], C[1], -124, 186, 152, 3)); add(petal(C[0], C[1], -80, 200, 146, 3));
add(petal(C[0], C[1], 178, 194, 152, 3));  add(petal(C[0], C[1], 4, 198, 152, 3));
add(petal(C[0], C[1], 134, 190, 160, 3));  add(petal(C[0], C[1], 44, 192, 160, 3));
add(petal(C[0] - 10, C[1], 106, 186, 150, 3)); add(petal(C[0] + 10, C[1], 74, 186, 150, 3));
// the cup: its back rim, the crumpled middle, then its front lip
add(cup(256, 222, 196, 96, 0, 4));
add(cup(236, 226, 74, 46, -14, 2)); add(cup(280, 226, 74, 46, 14, 2)); add(cup(258, 236, 70, 40, 0, 2));
add(cup(204, 270, 140, 104, -14, 3)); add(cup(310, 272, 140, 104, 14, 3));
add(cup(256, 304, 186, 100, 0, 4));

function svg(viewBox, sw, pre = 'p', rot = -14){
  const ids = shapes.map((_, i) => `${pre}p${i}`);
  const defs = shapes.map(([d], i) => `<path id="${ids[i]}" d="${d}"/>`).join('');
  const last = shapes.length - 1;
  const masks = shapes.map((_, i) => i === last ? '' : `<mask id="${pre}m${i}" maskUnits="userSpaceOnUse" x="-60" y="-60" width="640" height="640"><rect x="-60" y="-60" width="640" height="640" fill="#fff"/>${ids.slice(i + 1).map(id => `<use href="#${id}" fill="#000"/>`).join('')}</mask>`).join('');
  const body = shapes.map(([, line], i) => `<g${i === last ? '' : ` mask="url(#${pre}m${i})"`}><use href="#${ids[i]}"/>${line ? `<path d="${line}" stroke-width="${f(sw * .7)}"/>` : ''}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><defs>${defs}${masks}</defs><g transform="rotate(${rot} 256 262)">${body}</g></svg>\n`;
}
fs.writeFileSync(OUT + 'peony.svg', svg('16 16 480 500', 7.5));
fs.writeFileSync(OUT + 'peony-bud.svg', svg('16 16 480 500', 16, 'b'));
// a second copy for pages that show two flowers (its own ids, turned the other way)
fs.writeFileSync(OUT + 'peony-2.svg', svg('16 16 480 500', 7.5, 'q', 22));
console.log(fs.statSync(OUT + 'peony.svg').size, 'bytes');
