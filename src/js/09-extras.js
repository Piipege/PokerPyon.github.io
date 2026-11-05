/* ---------- table extras: ghost run-out, bomb pot, auto next hand, pause ---------- */
function ghostRun(){
  if(!isDealer() || !S || !S.handOver || !S.canGhost || S.ghost || !H.deck || !H.deck.length) return;
  const d=H.deck.slice(), g=[]; let n=S.board.length;
  const take=()=>{ const c=d.pop(); H.pos[cardKey(c)]=d.length; return c; };
  while(n<5){ d.pop(); if(n===0){ g.push(take(),take(),take()); n=3; } else { g.push(take()); n++; } }
  S.ghost=g; fairOpen(g);
  log(L('Что выпало бы дальше: {0}', g.map(fmtCard).join(' ')));
  if(S.nextAt && !S.paused && S.nextAt-Date.now()<4000) scheduleNext(4000);
  commit();
}
function scheduleNext(ms){
  if(!isDealer() || !S || !S.started || S.paused || !S.handOver) return;
  const d = ms ?? CFG.delay*1000;
  S.nextAt=Date.now()+d; flow(startHand, d, true);
}
function togglePause(){
  if(!isDealer() || !S || !S.started) return;
  S.paused=!S.paused;
  if(S.paused){ if(S.handOver){ clearFlow(); S.nextAt=0; } log('Пауза','sep'); }
  else { log('Игра продолжается','sep'); if(S.handOver) scheduleNext(3000); }
  commit();
}
function askWait(uid){
  if(!S.handOver || S.paused || !S.nextAt) return;
  S.waits=S.waits||{}; if(S.waits[uid]) return; S.waits[uid]=1;
  const s=seats().find(x=>x.uid===uid);
  log(L('{0} просит подождать 15 секунд', s?s.name:'Игрок'));
  scheduleNext(Math.max(0,S.nextAt-Date.now())+15000);
  commit();
}
let profT=null;
function pushProfile(){
  clearTimeout(profT);
  profT=setTimeout(()=>{
    if(!S) return;
    if(MODE==='guest') sendHost({t:'profile', name:myName(), av:CFG.av});
    else { const s=seats()[mySeat()]; if(s){ s.av={...CFG.av}; commit(); } }
  }, 250);
}

