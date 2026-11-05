/* ---------- dealer engine: runs offline, or on the host's tab ---------- */
async function startHand(){
  if(!isDealer()) return;
  clearFlow();
  const dUid = seats()[S.dealer]?.uid;
  if(MODE==='host'){
    S.seats = seats().filter(s=>!s.left);
    const di = seats().findIndex(s=>s.uid===dUid);
    S.dealer = di>=0 ? di : Math.min(S.dealer, seats().length-1) - 1;
  }
  seats().forEach(s=>{
    if(s.stack<=0 && s.rebuy>s.rebuySeen){ s.stack=S.start; s.rebuySeen=s.rebuy; log(L('{0} докупается на {1}', s.name, S.start)); }
    if(s.bot && s.stack<=0 && S.botRebuy!==false){ s.stack=S.start; s.rebuys=(s.rebuys||0)+1; log(L('{0} докупается на {1}', s.name, S.start)); if(Math.random()<.5) botSay(s, pick(['Ещё разок!','Новая попытка','Я вернулся','Теперь точно отыграюсь'])); }
    s.out = s.stack<=0 || !!s.away;
  });
  const alive = seats().filter(p=>!p.out).length;
  if(MODE==='offline'){
    if(seats()[0].stack<=0) return gameOver(t('Вы выбыли'), t('Раздач сыграно: {0}. Попробуйте ещё раз.', S.handNo));
    if(alive===1) return gameOver(t('Стол ваш'), t('Вы забрали все фишки. Раздач сыграно: {0}.', S.handNo));
  } else if(alive<2){
    S.handOver=true; S.turn=-1; S.nextAt=0;
    S.banner='Ждём игроков: для раздачи нужны минимум двое с фишками';
    return commit();
  }

  S.handNo++;
  S.dealer = nextIdx(S.dealer, p=>!p.out);
  H = {deck:shuffle(freshDeck()), hands:{}, pos:{}}; H.deck0=H.deck.slice(); S.fair=null; S.fairOpen={};
  Object.assign(S,{board:[],banner:'',best:[],winFx:null,collect:false,handOver:false,street:'preflop',currentBet:S.bb,minRaise:S.bb,nextAt:0,ghost:null,canGhost:false,waits:{}});
  seats().forEach(p=>Object.assign(p,{bet:0,total:0,folded:p.out,allIn:false,acted:false,last:'',won:0,shown:null,handName:'',enc:null,inHand:!p.out}));
  for(let r=0;r<2;r++) seats().forEach((p,i)=>{ if(!p.out) (H.hands[i]=H.hands[i]||[]).push(dealCard()); });
  if(MODE==='host'){ try{ await fairCommit(seats().filter(p=>!p.out).map(p=>p.uid)); }catch(e){ S.fair=null; } }

  if(S.blindEvery && S.handNo>1 && (S.handNo-1)%S.blindEvery===0 && S.lvl<BLIND_LEVELS.length-1){
    S.lvl++; [S.sb,S.bb]=BLIND_LEVELS[S.lvl];
    log(L('Блайнды растут: {0}/{1}',S.sb,S.bb),'sep'); S.banner=L('Блайнды растут: {0}/{1}',S.sb,S.bb);
  }
  S.currentBet=S.bb; S.minRaise=S.bb; S.aggr=-1;
  S.bomb = !!(S.bombEvery && S.handNo%S.bombEvery===0);
  recStart();
  seats().forEach(p=>{ p._v=false; p._p=false; p._agg=false; if(p.inHand && !S.bomb) stOf(p).h++; });
  if(S.bomb){
    const ante=S.bb*(S.bombBB||5);
    log(L('Раздача №{0} — бомб-пот', S.handNo),'sep');
    seats().forEach((p,i)=>{ if(p.inHand){ recEv(i,'ante',post(i,ante)); p.last='Бомб-пот'; } });
    S.banner=L('Бомб-пот! Все ставят по {0}, торговля начинается с флопа', ante);
    log(L('Все ставят по {0}, сразу флоп', ante));
    if(MODE==='offline') log(L('Ваши карты: {0}', H.hands[0].map(fmtCard).join(' ')));
    S.currentBet=0; S.turn=-1; commit();
    flow(()=>collectThen(nextStreet), 2200 + alive*2*130);
    return;
  }
  const sb = alive===2 ? S.dealer : nextIdx(S.dealer,p=>!p.out);
  const bb = nextIdx(sb,p=>!p.out);
  log(L('Раздача №{0}', S.handNo),'sep');
  recEv(sb,'sb',post(sb,S.sb)); seats()[sb].last='SB';
  recEv(bb,'bb',post(bb,S.bb)); seats()[bb].last='BB';
  log(L('{0}: малый блайнд {1}, {2}: большой блайнд {3}', seats()[sb].name, S.sb, seats()[bb].name, S.bb));
  if(MODE==='offline') log(L('Ваши карты: {0}', H.hands[0].map(fmtCard).join(' ')));
  S.turn=-1; commit();
  flow(()=>advance(bb), 1500 + alive*2*130);
}

function roundDone(){
  const actors = seats().filter(canAct);
  if(actors.length===0) return true;
  const maxBet = Math.max(...seats().map(p=>p.bet));
  if(actors.length===1){
    const a=actors[0];
    return a.bet>=maxBet && (a.acted || live().filter(p=>p!==a).every(p=>p.allIn));
  }
  return actors.every(p=>p.acted && p.bet===S.currentBet);
}

function advance(lastIdx){
  if(live().length===1) return collectThen(winUncontested);
  if(roundDone()){ S.turn=-1; S.deadline=0; commit(); return flow(()=>collectThen(nextStreet), 900); }
  S.turn = nextIdx(lastIdx, canAct);
  S.turnId++;
  const t = seats()[S.turn];
  S.deadline = (MODE==='host' && !t.bot) ? Date.now()+TURN_MS : 0;
  commit();
  if(t.bot) flow(botAct, 1500+Math.random()*1300);
  else if(MODE==='host'){
    if(t.left) flow(()=>act(S.turn,'fold'), 600);
    else {
      clearTimeout(timers.turn); const id=S.turnId;
      timers.turn=setTimeout(()=>{ if(S && S.turnId===id && !S.handOver){ const i=S.turn; act(i, S.currentBet>seats()[i].bet?'fold':'call', 0, true); } }, TURN_MS+400);
    }
  }
}

function collectThen(next){
  if(seats().some(p=>p.bet>0)){
    S.collect=true; S.turn=-1; commit();
    flow(()=>{ seats().forEach(p=>p.bet=0); S.collect=false; next(); }, 900);
  } else next();
}

function nextStreet(){
  seats().forEach(p=>{p.bet=0; p.acted=false; if(!p.folded && !p.allIn) p.last='';});
  S.currentBet=0; S.minRaise=S.bb; S.aggr=-1; seats().forEach(p=>p._agg=false);
  if(S.street==='preflop'){ S.street='flop'; burn(); S.board.push(dealCard(),dealCard(),dealCard()); }
  else if(S.street==='flop'){ S.street='turn'; burn(); S.board.push(dealCard()); }
  else if(S.street==='turn'){ S.street='river'; burn(); S.board.push(dealCard()); }
  else return showdown();
  log(L('{0}: {1}', {flop:'Флоп',turn:'Тёрн',river:'Ривер'}[S.street], S.board.map(fmtCard).join(' ')));
  recEv(-1,'street',0,0,S.board); fairOpen(S.board);
  const dealt = S.street==='flop' ? 3 : 1;
  if(seats().filter(canAct).length<=1){
    seats().forEach((p,i)=>{ if(!p.out && !p.folded){ p.shown = H.hands[i]; fairOpen(p.shown); } });
    S.turn=-1; commit(); flow(nextStreet, 1600 + dealt*250); return;
  }
  S.turn=-1; commit();
  flow(()=>advance(S.dealer), 700 + dealt*250);
}

function act(i, type, to=0, auto=false){
  const p=seats()[i];
  if(!p || S.handOver || S.turn!==i) return;
  clearTimeout(timers.turn);
  const toCall = S.currentBet - p.bet, before=p.total, cb0=S.currentBet;
  if(type==='fold'){
    p.folded=true; p.last='Пас'; log(L(auto?'{0}: пас (время вышло)':'{0}: пас', p.name));
  } else if(type==='call'){
    if(toCall<=0){ p.last='Чек'; log(L(auto?'{0}: чек (время вышло)':'{0}: чек', p.name)); }
    else { const a=post(i,toCall); p.last = p.allIn?'Олл-ин':'Колл'; log(L(p.allIn?'{0}: колл {1} (олл-ин)':'{0}: колл {1}', p.name, a)); }
  } else if(type==='raise'){
    to = Math.min(Math.floor(+to||0), p.bet+p.stack);
    const minTo = Math.min(p.bet+p.stack, S.currentBet===0 ? S.bb : S.currentBet+S.minRaise);
    if(to<minTo) to=minTo;
    if(to<=S.currentBet) return act(i,'call');
    const size = to - S.currentBet;
    if(size>=S.minRaise) S.minRaise=size;
    post(i, to-p.bet);
    const wasZero = S.currentBet===0;
    S.currentBet = to;
    seats().forEach((q,j)=>{ if(j!==i) q.acted=false; });
    p.last = p.allIn ? 'Олл-ин' : (wasZero?'Бет':'Рейз');
    log(L(wasZero ? (p.allIn?'{0}: бет {1} (олл-ин)':'{0}: бет {1}') : (p.allIn?'{0}: рейз до {1} (олл-ин)':'{0}: рейз до {1}'), p.name, to));
  } else return;
  if(S.street==='preflop' && (type==='raise' || (type==='call' && toCall>0)) && !p._v){ p._v=true; stOf(p).v++; }
  if(type==='raise'){ S.aggr=i; p._agg=true; if(S.street==='preflop' && !p._p){ p._p=true; stOf(p).p++; } }
  { const paid=p.total-before; recEv(i, type==='fold'?'fold': type==='call'?(paid>0?'call':'check'):(cb0===0?'bet':'raise'), paid, p.bet, null, p.allIn); }
  p.acted=true;
  if(auto){ p.missed=(p.missed||0)+1; if(p.missed>=2 && !p.bot && MODE==='host'){ p.away=true; log(L('{0} пропустил два хода и отошёл от стола', p.name)); } }
  else p.missed=0;
  advance(i);
}

