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
// Value of the best five of 5–7 cards, the same number as max(eval5) over all fives, computed
// directly from rank counts and suit bit masks: no sorting, no arrays, no objects. It is the hot
// path of every equity estimate (bots, help mode, the coach), so it matters on slow phones.
const V_CNT = new Uint8Array(15), V_SM = new Uint16Array(4), V_SC = new Uint8Array(4);
const B15 = [50625, 3375, 225, 15, 1]; // 15^4 … 15^0: weights of the five kicker slots
function topStraight(mask){ // highest card of a straight in a 15-bit rank mask (bit r = rank r), 0 if none
  if(mask & 16384) mask |= 2; // the ace also plays low
  for(let hi=14; hi>=5; hi--) if(((mask >> (hi-4)) & 31) === 31) return hi;
  return 0;
}
function val7(cards){
  V_CNT.fill(0); V_SM.fill(0); V_SC.fill(0);
  let mask=0;
  for(let i=0;i<cards.length;i++){ const c=cards[i]; V_CNT[c.r]++; V_SM[c.s] |= 1<<c.r; V_SC[c.s]++; mask |= 1<<c.r; }
  let fs=-1; for(let s=0;s<4;s++) if(V_SC[s]>=5) fs=s;
  if(fs>=0){ const sf=topStraight(V_SM[fs]); if(sf) return 8*759375 + sf*B15[0]; }
  let quad=0, t1=0, t2=0, p1=0, p2=0;
  for(let r=14;r>=2;r--){ const n=V_CNT[r]; if(n===4) quad=r; else if(n===3){ if(!t1) t1=r; else if(!t2) t2=r; } else if(n===2){ if(!p1) p1=r; else if(!p2) p2=r; } }
  if(quad){ let k=0; for(let r=14;r>=2;r--) if(r!==quad && V_CNT[r]){ k=r; break; } return 7*759375 + quad*B15[0] + k*B15[1]; }
  if(t1 && (t2 || p1)){ return 6*759375 + t1*B15[0] + Math.max(t2, p1)*B15[1]; }
  if(fs>=0){ let v=5*759375, k=0; for(let r=14;r>=2 && k<5;r--) if(V_SM[fs] & (1<<r)) v += r*B15[k++]; return v; }
  const st=topStraight(mask); if(st) return 4*759375 + st*B15[0];
  let v, k=0, used=0;
  if(t1){ v=3*759375 + t1*B15[0]; k=1; used=1<<t1; }
  else if(p1 && p2){ v=2*759375 + p1*B15[0] + p2*B15[1]; k=2; used=(1<<p1)|(1<<p2); }
  else if(p1){ v=1*759375 + p1*B15[0]; k=1; used=1<<p1; }
  else v=0;
  const slots = t1 ? 3 : p1 && p2 ? 3 : p1 ? 4 : 5; // how many slots the category fills in total
  for(let r=14;r>=2 && k<slots;r--) if((mask & (1<<r)) && !(used & (1<<r))) v += r*B15[k++];
  return v;
}
// the cards that make the combination: none for a high card, only the matched ranks for pairs,
// two pair, sets and quads (kickers stay plain), all five for straights, flushes and full houses
function coreCards(five, cat){
  if(!five || cat<=0) return [];
  if(cat===4 || cat===5 || cat===6 || cat===8) return five;
  const n={}; five.forEach(c=>n[c.r]=(n[c.r]||0)+1);
  return five.filter(c=>n[c.r]>=2);
}
// best five cards and their value; `cards` (the five) is only worked out when someone asks for it
function best(cards){
  const v=val7(cards);
  return {v, cat:Math.floor(v/P5), get cards(){ for(const ix of combos(cards.length)){ const five=ix.map(i=>cards[i]); if(eval5(five)===v) return five; } return cards.slice(0,5); }};
}
function equity(hand, board, opps, iters=260){
  const known = new Set([...hand,...board].map(cardKey));
  const rest = freshDeck().filter(c=>!known.has(cardKey(c)));
  let score = 0; const need = 5-board.length, nb = board.length;
  const mine7 = hand.concat(board, Array(need)), opp7 = [null, null].concat(board, Array(need));
  for(let it=0; it<iters; it++){
    const take = need + opps*2;
    for(let i=0;i<take;i++){ const j=i+(Math.random()*(rest.length-i)|0); const x=rest[i]; rest[i]=rest[j]; rest[j]=x; }
    for(let i=0;i<need;i++){ mine7[2+nb+i]=rest[i]; opp7[2+nb+i]=rest[i]; }
    const mine = val7(mine7);
    let win=true, ties=0;
    for(let o=0;o<opps;o++){
      opp7[0]=rest[need+o*2]; opp7[1]=rest[need+o*2+1];
      const ov = val7(opp7);
      if(ov>mine){win=false;break;} if(ov===mine) ties++;
    }
    if(win) score += 1/(ties+1);
  }
  return score/iters;
}

