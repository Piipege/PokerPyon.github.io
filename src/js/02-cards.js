/* ---------- cards & evaluation ---------- */
function freshDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=2;r<=14;r++) d.push({r,s}); return d; }
function randInt(n){ const lim=Math.floor(4294967296/n)*n, b=new Uint32Array(1); for(;;){ crypto.getRandomValues(b); if(b[0]<lim) return b[0]%n; } }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=randInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const cardKey = c => c.r*4+c.s;

function eval5(c){
  const rs = c.map(x=>x.r).sort((a,b)=>b-a);
  const flush = c[0].s===c[1].s && c[1].s===c[2].s && c[2].s===c[3].s && c[3].s===c[4].s;
  const cnt = {}; for(const r of rs) cnt[r]=(cnt[r]||0)+1;
  const g = Object.keys(cnt).map(r=>[+r,cnt[r]]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  let sh = 0;
  if(g.length===5){ if(rs[0]-rs[4]===4) sh=rs[0]; else if(rs[0]===14 && rs[1]===5) sh=5; }
  let cat, k;
  if(sh && flush){cat=8;k=[sh];}
  else if(g[0][1]===4){cat=7;k=[g[0][0],g[1][0]];}
  else if(g[0][1]===3 && g[1][1]===2){cat=6;k=[g[0][0],g[1][0]];}
  else if(flush){cat=5;k=rs;}
  else if(sh){cat=4;k=[sh];}
  else if(g[0][1]===3){cat=3;k=g.map(x=>x[0]);}
  else if(g[0][1]===2 && g[1][1]===2){cat=2;k=g.map(x=>x[0]);}
  else if(g[0][1]===2){cat=1;k=g.map(x=>x[0]);}
  else {cat=0;k=rs;}
  let v=cat; for(let i=0;i<5;i++) v=v*15+(k[i]||0);
  return v;
}
const COMBOS = {};
function combos(n){
  if(COMBOS[n]) return COMBOS[n];
  const out=[];
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(let c=b+1;c<n;c++)for(let d=c+1;d<n;d++)for(let e=d+1;e<n;e++) out.push([a,b,c,d,e]);
  return COMBOS[n]=out;
}
function best(cards){
  let bv=-1, bc=null;
  for(const ix of combos(cards.length)){
    const five = ix.map(i=>cards[i]); const v = eval5(five);
    if(v>bv){bv=v;bc=five;}
  }
  return {v:bv, cards:bc, cat:Math.floor(bv/P5)};
}
function equity(hand, board, opps, iters=260){
  const known = new Set([...hand,...board].map(cardKey));
  const rest = freshDeck().filter(c=>!known.has(cardKey(c)));
  let score = 0; const need = 5-board.length;
  for(let it=0; it<iters; it++){
    const take = need + opps*2;
    for(let i=0;i<take;i++){ const j=i+(Math.random()*(rest.length-i)|0); [rest[i],rest[j]]=[rest[j],rest[i]]; }
    const b = board.concat(rest.slice(0,need));
    const mine = best(hand.concat(b)).v;
    let win=true, ties=0;
    for(let o=0;o<opps;o++){
      const ov = best([rest[need+o*2],rest[need+o*2+1]].concat(b)).v;
      if(ov>mine){win=false;break;} if(ov===mine) ties++;
    }
    if(win) score += 1/(ties+1);
  }
  return score/iters;
}

