/* ---------- bots: four levels of play ---------- */
const LVL = {
  1:{name:'новичок',  iters:120, noise:.15, slack:.12, station:.35, bluff:.02, aggr:.6,  raiseAt:2.6},
  2:{name:'любитель', iters:220, noise:.07, slack:.03, station:.10, bluff:.06, aggr:1,   raiseAt:2.1},
  3:{name:'профи',    iters:400, noise:0,   slack:-.02,station:0,   bluff:.10, aggr:1.2, raiseAt:1.8, read:true, pos:true},
  4:{name:'акула',    iters:450, noise:0,   slack:-.03,station:0,   bluff:.13, aggr:1.3, raiseAt:1.65,read:true, pos:true, ranges:true, slow:true},
};
const EMPTY_ST = {h:0,v:0,p:0,sd:0,sdw:0,net:0};
const stOf = p => p.st || (p.st = {...EMPTY_ST});
const pick = a => a[Math.random()*a.length|0];

// preflop hand strength (Chen-style score) and its percentile among all 1326 starting hands
function chen(a,b){
  const hi=Math.max(a.r,b.r), lo=Math.min(a.r,b.r);
  const base={14:10,13:8,12:7,11:6}[hi] || hi/2;
  let s = a.r===b.r ? Math.max(5, base*2) : base;
  if(a.s===b.s) s+=2;
  if(a.r!==b.r){ const gap=hi-lo-1; s -= [0,1,2,4][gap] ?? 5; if(gap<=1 && hi<12) s+=1; }
  return s;
}
let PCT=null;
function pctOf(a,b){
  if(!PCT){
    const d=freshDeck(), all=[];
    for(let i=0;i<52;i++) for(let j=i+1;j<52;j++) all.push(chen(d[i],d[j]));
    all.sort((x,y)=>y-x);
    PCT=new Map(); all.forEach((s,k)=>{ if(!PCT.has(s)) PCT.set(s, k/all.length); });
  }
  return PCT.get(chen(a,b)) ?? .5;
}
// what share of starting hands this player plays, read from their stats and actions this hand
function rangeOf(p){
  const t=stOf(p);
  let r = t.h>=6 ? Math.min(1, Math.max(.1, t.v/t.h)) : .55;
  if(p._p) r = Math.min(r, t.h>=6 ? Math.max(t.p/t.h, .06) : .2);
  if(p._agg) r *= .7;
  return Math.max(r, .05);
}
function equityRanged(hand, board, opps, iters){
  if(hand.length===4) return equity(hand, board, opps.length, iters); // Omaha: no starting-hand table, plain equity
  const known=new Set([...hand,...board].map(cardKey));
  const rest=freshDeck().filter(c=>!known.has(cardKey(c)));
  const ranges=opps.map(rangeOf); const need=5-board.length; let score=0;
  for(let it=0; it<iters; it++){
    const used=new Set();
    const draw=()=>{ let c; do{ c=rest[Math.random()*rest.length|0]; }while(used.has(cardKey(c))); used.add(cardKey(c)); return c; };
    const hands=ranges.map(r=>{
      let a=null,b=null,tries=0;
      do{ if(a){ used.delete(cardKey(a)); used.delete(cardKey(b)); } a=draw(); b=draw(); tries++; }while(tries<25 && pctOf(a,b)>r);
      return [a,b];
    });
    const bd=board.concat(Array.from({length:need}, draw));
    const mine=val7(hand.concat(bd)); let win=true, ties=0;
    for(const h of hands){ const v=val7(h.concat(bd)); if(v>mine){win=false;break;} if(v===mine) ties++; }
    if(win) score+=1/(ties+1);
  }
  return score/iters;
}
function isLate(i){
  if(S.street==='preflop') return S.dealer===i;
  const n=seats().length, order=[]; let k=nextIdx(S.dealer, canAct);
  for(let c=0;c<n && k>=0;c++){ if(canAct(seats()[k]) && !order.includes(k)) order.push(k); k=(k+1)%n; }
  return order.indexOf(i) >= order.length-2;
}

function botAct(){
  const i=S.turn, p=seats()[i]; if(!p || !p.bot || S.handOver) return;
  const L = LVL[p.lvl||2];
  const others = live().filter(q=>q!==p), opps=others.length;
  let eq = L.ranges ? equityRanged(H.hands[i], S.board, others, L.iters) : equity(H.hands[i], S.board, opps, L.iters);
  if(L.read && !L.ranges && S.aggr>=0 && S.aggr!==i){
    const t=stOf(seats()[S.aggr]);
    if(t.h>=8){ const v=t.v/t.h; if(v<.2) eq*=.85; else if(v>.45) eq=Math.min(1,eq*1.12); }
  }
  eq = Math.max(0, Math.min(1, eq + (Math.random()*2-1)*L.noise));
  const toCall=S.currentBet-p.bet, pot=potTotal(), odds=toCall/(pot+toCall);
  const strength=eq*(opps+1), r=Math.random();
  const late = L.pos && isLate(i);
  const bluff = L.bluff*(late?1.6:1)*(opps<=2?1.3:.6)*(p.loose/.08);
  const aggr = Math.min(.95, p.aggr*L.aggr);
  const maxTo=maxRaiseTo(i), minTo=Math.min(maxTo, S.currentBet+S.minRaise);
  const sizeTo=f=>Math.min(maxTo, Math.max(minTo, round10(S.currentBet+pot*f)));
  const value = (p.lvl||2)>=3 ? .65 : .5;
  if(toCall<=0){
    if(L.slow && strength>L.raiseAt*1.6 && r<.25) return act(i,'call');
    if(strength>L.raiseAt && r<.45+aggr/2) return act(i,'raise', sizeTo(value+Math.random()*.4));
    if(strength>L.raiseAt*.7 && r<aggr*.6) return act(i,'raise', sizeTo(.4));
    if(r<bluff) return act(i,'raise', sizeTo(.5));
    return act(i,'call');
  }
  if(strength>L.raiseAt*1.15 && r<.35+aggr/2 && maxTo>S.currentBet) return act(i,'raise', sizeTo(.8+Math.random()*.6));
  if((p.lvl||2)>=3 && opps===1 && r<bluff*.5 && toCall<=pot*.5 && maxTo>S.currentBet) return act(i,'raise', sizeTo(1));
  if(eq>odds-L.slack) return act(i,'call');
  if(L.station && r<L.station && toCall<=S.bb*6) return act(i,'call');
  if(r<p.loose*.5 && toCall<=S.bb*2) return act(i,'call');
  return act(i,'fold');
}

