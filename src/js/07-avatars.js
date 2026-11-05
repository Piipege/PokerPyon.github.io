/* ---------- avatars ---------- */
const AVP = {
  bg:['#ff8cc0','#9c2a5c','#6c4ab6','#2f7f86','#e2a03f','#3a7d44','#d9534f','#4a5568'],
  skin:['#f9d7c4','#efc0a0','#d59a72','#a9714b','#7a4b2e','#4b2e1f','#bfe3a0','#b8c7f0'],
  hc:['#2a1a12','#6b3e1f','#d9a441','#c2452d','#eeeeee','#ff8cc0','#6c4ab6','#1f6f78'],
  shirt:['#2a0d1f','#9c2a5c','#ff8cc0','#2f7f86','#e2a03f','#f3ecdc','#3a3f5c','#6c4ab6','#d9363e'],
  kind:['Человек','Обезьянка'],
  eyes:['Точки','Радость','Подмигивание','Сонные','Хитрые','Звёзды'],
  mouth:['Улыбка','Смех','Ровно','Удивление','Ухмылка','Язык наружу'],
  hair:['Без причёски','Короткие','Длинные','Ирокез','Пучок','Кудри','Кепка','Цилиндр','Корона','Козырёк крупье','Шапка','Хвостики с бантиками'],
  acc:['Без аксессуара','Очки','Тёмные очки','Монокль','Усы','Борода','Серьга','Румянец'],
};
const AV_KEYS=['kind','bg','skin','eyes','mouth','hair','hc','acc','shirt'];
function cleanAv(a){
  if(!a || typeof a!=='object') return null;
  const o={}; for(const k of AV_KEYS){ const n=AVP[k].length, v=Math.floor(+a[k]); o[k]= Number.isFinite(v) ? ((v%n)+n)%n : 0; }
  return o;
}
function randomAv(seed){
  let h=2166136261; const str=String(seed ?? Math.random());
  for(let k=0;k<str.length;k++){ h^=str.charCodeAt(k); h=Math.imul(h,16777619); }
  const rnd=()=>{ h^=h<<13; h^=h>>>17; h^=h<<5; return ((h>>>0)%10000)/10000; };
  const o={}; for(const k of AV_KEYS) o[k]=Math.floor(rnd()*AVP[k].length); return o;
}
let avSeq=0;
function avatarSVG(raw){
  const a=cleanAv(raw)||randomAv('x'), id='av'+(++avSeq), ink='#2a1a1f';
  const bg=AVP.bg[a.bg], skin=AVP.skin[a.skin], hc=AVP.hc[a.hc], sh=AVP.shirt[a.shirt];
  const ln=(d,w=2)=>`<path d="${d}" stroke="${ink}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const star=(cx,cy)=>`<path d="M${cx} ${cy-3.5} L${cx+1.2} ${cy-1} L${cx+3.5} ${cy} L${cx+1.2} ${cy+1} L${cx} ${cy+3.5} L${cx-1.2} ${cy+1} L${cx-3.5} ${cy} L${cx-1.2} ${cy-1}Z" fill="#e2a03f"/>`;
  const EYES=[
    ()=>`<circle cx="26" cy="28" r="2.2" fill="${ink}"/><circle cx="38" cy="28" r="2.2" fill="${ink}"/>`,
    ()=>ln('M23 29 Q26 25 29 29 M35 29 Q38 25 41 29'),
    ()=>`<circle cx="26" cy="28" r="2.2" fill="${ink}"/>`+ln('M35 28 L41 28'),
    ()=>ln('M23 28 Q26 30 29 28 M35 28 Q38 30 41 28'),
    ()=>`<circle cx="26" cy="29" r="2" fill="${ink}"/><circle cx="38" cy="29" r="2" fill="${ink}"/>`+ln('M22 24 L29 26 M42 24 L35 26'),
    ()=>star(26,28)+star(38,28),
  ];
  const MOUTH=[
    ()=>ln('M27 36 Q32 40 37 36'),
    ()=>`<path d="M26 35 Q32 43 38 35Z" fill="${ink}"/><path d="M28 35.6 L36 35.6 L35 37 L29 37Z" fill="#fff"/>`,
    ()=>ln('M28 37 L36 37'),
    ()=>`<ellipse cx="32" cy="37" rx="2.5" ry="3" fill="${ink}"/>`,
    ()=>ln('M28 37 Q33 38 37 34'),
    ()=>`<path d="M27 35 Q32 40 37 35Z" fill="${ink}"/><path d="M30 37.5 Q32 42 34 37.5Z" fill="#e05a7a"/>`,
  ];
  const bow=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M0 0 L-6 -4 L-6 4Z M0 0 L6 -4 L6 4Z" fill="#f48fb1" stroke="#d76c97" stroke-width=".8" stroke-linejoin="round"/><circle r="1.8" fill="#e06c9a"/></g>`;
  const fuzz=(cx,cy,r,n,fill,stroke)=>{ let d=''; for(let k=0;k<=n;k++){ const a0=k/n*Math.PI*2, a1=(k-.5)/n*Math.PI*2; const x=cx+Math.cos(a0)*r, y=cy+Math.sin(a0)*r; if(k===0){ d+=`M${x.toFixed(1)} ${y.toFixed(1)}`; continue; } const qx=cx+Math.cos(a1)*r*1.13, qy=cy+Math.sin(a1)*r*1.13; d+=` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; } return `<path d="${d}Z" fill="${fill}" stroke="${stroke}" stroke-width=".8" stroke-linejoin="round"/>`; };
  const short=`<path d="M18 26 Q17 12 32 12 Q47 12 46 26 Q40 18 32 19 Q24 18 18 26Z" fill="${hc}"/>`;
  const HAIR=[
    ()=>'',
    ()=>short,
    ()=>`<path d="M18 30 Q16 11 32 11 Q48 11 46 30 Q44 19 32 18 Q22 19 18 30Z" fill="${hc}"/>`,
    ()=>`<path d="M28 17 L29 4 L32 8 L35 3 L36 17Z" fill="${hc}"/>`,
    ()=>short+`<circle cx="32" cy="10" r="6" fill="${hc}"/>`,
    ()=>[19,24,29,35,40,45].map((x,k)=>`<circle cx="${x}" cy="${k%2?14:17}" r="5.5" fill="${hc}"/>`).join(''),
    ()=>`<path d="M17 24 Q17 10 32 10 Q47 10 47 24Z" fill="${hc}"/><path d="M32 21 Q46 19 56 24 L46 25Z" fill="${hc}"/><circle cx="32" cy="10.5" r="1.6" fill="#0003"/>`,
    ()=>`<rect x="22" y="1" width="20" height="15" fill="#1b1b22"/><rect x="22" y="11" width="20" height="3" fill="${hc}"/><rect x="16" y="15" width="32" height="4" rx="2" fill="#1b1b22"/>`,
    ()=>`<path d="M20 18 L22 6 L27 13 L32 4 L37 13 L42 6 L44 18Z" fill="#e8b93c" stroke="#b8862a" stroke-width="1"/><circle cx="32" cy="13" r="1.6" fill="#d9534f"/>`,
    ()=>short+`<path d="M16 22 Q32 13 48 22 L51 26 Q32 19 13 26Z" fill="#2f9e6a" opacity=".88"/><rect x="17" y="20.5" width="30" height="2.4" fill="#1d6b47"/>`,
    ()=>`<path d="M17 25 Q17 8 32 8 Q47 8 47 25Z" fill="${hc}"/><rect x="16" y="21" width="32" height="6" rx="3" fill="${hc}" stroke="#0003"/><circle cx="32" cy="7" r="3.5" fill="${hc}"/>`,
    ()=>short+bow(17,19)+bow(47,19),
  ];
  const ACC=[
    ()=>'',
    ()=>`<circle cx="26" cy="28" r="5" fill="none" stroke="${ink}" stroke-width="1.6"/><circle cx="38" cy="28" r="5" fill="none" stroke="${ink}" stroke-width="1.6"/>`+ln('M31 28 L33 28',1.6),
    ()=>`<rect x="20" y="24.5" width="11" height="7" rx="3" fill="#15121a"/><rect x="33" y="24.5" width="11" height="7" rx="3" fill="#15121a"/><path d="M31 27 L33 27" stroke="#15121a" stroke-width="2"/>`,
    ()=>`<circle cx="38" cy="28" r="5" fill="#ffffff33" stroke="#c9a23e" stroke-width="1.6"/><path d="M43 30 Q46 40 44 48" stroke="#c9a23e" fill="none"/>`,
    ()=>`<path d="M25 34 Q29 31 32 33 Q35 31 39 34 Q35 36 32 34.5 Q29 36 25 34Z" fill="${hc}"/>`,
    ()=>`<path d="M18 31 Q20 47 32 47 Q44 47 46 31 Q44 38 38 40 Q32 42 26 40 Q20 38 18 31Z" fill="${hc}"/>`,
    ()=>`<circle cx="18" cy="35" r="2" fill="#e8b93c"/>`,
    ()=>`<circle cx="22" cy="33" r="3" fill="#ff7aa8" opacity=".5"/><circle cx="42" cy="33" r="3" fill="#ff7aa8" opacity=".5"/>`,
  ];
  let s=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#${id})"><rect width="64" height="64" fill="${bg}"/>`;
  if(a.kind===1){
    const edge='#00000033';
    if(a.hair===11) s+=fuzz(11,12,6.5,9,hc,edge)+fuzz(53,12,6.5,9,hc,edge);
    s+=`<path d="M5 64 Q7 46 32 46 Q57 46 59 64Z" fill="${hc}"/><path d="M20 47 L44 47 Q43 58 32 59 Q21 58 20 47Z" fill="${sh}" stroke="#fff" stroke-width="1.6"/>`;
    s+=`<circle cx="10.5" cy="36" r="5" fill="${skin}" stroke="${edge}"/><circle cx="53.5" cy="36" r="5" fill="${skin}" stroke="${edge}"/>`;
    s+=fuzz(32,27,19.5,22,hc,edge);
    s+=`<ellipse cx="32" cy="38" rx="15" ry="11" fill="${skin}"/>`;
    s+=`<path d="M16 31 L19 36 L22 29 L25 34 L28 28 L32 33 L36 28 L39 34 L42 29 L45 36 L48 31 L48 18 L16 18Z" fill="${hc}"/>`;
    s+=`<g transform="translate(0 10)">${EYES[a.eyes]()}</g><ellipse cx="32" cy="43" rx="2.7" ry="2.1" fill="#6b3e1f"/><g transform="translate(0 10.5)">${MOUTH[a.mouth]()}</g>`;
    s+=`<g fill="#c98a5a"><circle cx="21" cy="41" r=".6"/><circle cx="23.5" cy="42.6" r=".6"/><circle cx="43" cy="41" r=".6"/><circle cx="40.5" cy="42.6" r=".6"/><circle cx="30" cy="34.5" r=".5"/><circle cx="32" cy="33.8" r=".5"/><circle cx="34" cy="34.5" r=".5"/></g>`;
    s+=`<circle cx="21" cy="45" r="3.2" fill="#ff7aa8" opacity=".45"/><circle cx="43" cy="45" r="3.2" fill="#ff7aa8" opacity=".45"/>`;
    if([1,2,3,6].includes(a.acc)) s+=`<g transform="translate(0 10)">${ACC[a.acc]()}</g>`;
    if(a.hair>=6 && a.hair<=10) s+=`<g transform="translate(0 -3)">${HAIR[a.hair]()}</g>`;
    if(a.hair===11) s+=bow(15,16)+bow(49,16);
    return s+'</g></svg>';
  }
  if(a.hair===11) s+=`<circle cx="11" cy="18" r="7" fill="${hc}"/><circle cx="53" cy="18" r="7" fill="${hc}"/>`;
  if(a.hair===2) s+=`<path d="M15 30 Q14 10 32 10 Q50 10 49 30 L52 54 Q32 60 12 54Z" fill="${hc}"/>`;
  s+=`<path d="M8 64 Q10 47 32 47 Q54 47 56 64Z" fill="${sh}"/><rect x="27" y="40" width="10" height="9" rx="3" fill="${skin}"/>`;
  s+=`<circle cx="18" cy="31" r="3" fill="${skin}"/><circle cx="46" cy="31" r="3" fill="${skin}"/><ellipse cx="32" cy="29" rx="14" ry="16" fill="${skin}"/>`;
  s+=EYES[a.eyes]()+MOUTH[a.mouth]()+ACC[a.acc]()+HAIR[a.hair]();
  return s+'</g></svg>';
}
const avatarFor = s => s.av || randomAv(s.uid+s.name);

