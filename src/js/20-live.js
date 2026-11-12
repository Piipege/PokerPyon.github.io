/* ---------- coach at the table: thinks the current decision through with you ---------- */
// Sees only what you see: your cards, the board, the bets, and how the opponents play at this
// table — VPIP, PFR, how often they bet or raise after the flop, how often they fold to a bet — or,
// while the table is new, their lifetime summary from the profile. From these it builds a range for
// each opponent, counts your equity against those ranges and weighs every possible action with the
// same rules as the review of played hands (judge). At a table with friends it talks about your
// cards during a hand only if the table allows decision hints («Подсказка решения и ауты»);
// the opponents' stats are public, so it discusses them always.

const LIVE = {msgs:[], key:'', autoKey:'', last:null};
const STREET_KEYS = ['preflop','flop','turn','river'];
const VSCORE = {good:2, ok:1, bad:0};
const VERDICT_WORD = {good:'тоже хорошо', ok:'спорно', bad:'ошибка'};
const liveAllowed = () => !!S && (MODE==='offline' || !!S.hAdvice);

function livePos(i){
  const ring=seats().map((p,k)=>k).filter(k=>seats()[k].inHand && !seats()[k].out);
  const n=ring.length, me=ring.indexOf(i);
  if(me<0 || n<2) return 'btn';
  const d=Math.max(0, ring.indexOf(S.dealer));
  return posByOff((me-d+n)%n, n);
}

// what we know about an opponent and the share of hands they can have here
function oppInfo(p, k){
  const st=stOf(p), pf=p.pf||{}, om=S.game==='omaha';
  let vp=null, pr=null, h=st.h, src='none';
  if(st.h>=8){ vp=st.v/st.h; pr=st.p/st.h; src='table'; }
  else if(pf.h>=30 && pf.vp!=null){ vp=pf.vp/100; pr=(pf.pr||0)/100; h=pf.h; src='profile'; }
  const post=(st.ag||0)+(st.ca||0);
  const af = post>=4 ? (st.ag||0)/Math.max(1, st.ca||0) : null;
  const ftb = (st.fb||0)>=4 ? (st.ff||0)/st.fb : null;
  const style = vp==null ? -1 : vp>=.3 ? (pr>=vp*.5 ? 2 : 1) : (pr>=vp*.5 ? 0 : 3);
  let r = vp!=null ? Math.min(1, Math.max(.08, vp*(om?1.1:1))) : (om ? .6 : .5);
  if(p._p) r = Math.min(r, pr!=null ? Math.max(pr, .05) : .2);
  if(S.street==='preflop' && S.aggr===k && (S.raises||0)>=2) r *= .5;
  if(S.street!=='preflop' && p._agg) r *= af!=null && af>=3 ? .85 : af!=null && af<1 ? .5 : .7;
  return {p, k, vp, pr, h, src, af, ftb, style, range:Math.max(.03, Math.min(1, r))};
}

// the decision in front of you, in the same shape as a decision replayed from a hand record
function liveSpot(){
  if(!S || S.handOver || !S.started) return null;
  const i=mySeat(); if(i<0) return null;
  const p=seats()[i];
  if(p.out || !p.inHand || p.folded) return null;
  const hand=cardsFor(i); if(!hand.length || !hand[0]) return null;
  const street=Math.max(0, STREET_KEYS.indexOf(S.street));
  const opps=seats().map((q,k)=>[q,k]).filter(([q,k])=>k!==i && !q.out && q.inHand && !q.folded).map(([q,k])=>oppInfo(q,k));
  const toCall=Math.max(0, Math.min(S.currentBet-p.bet, p.stack));
  const d={street, board:S.board.slice(), toCall, pot:potTotal(), stack:p.stack, opps:opps.length, cur:S.currentBet, raises:S.raises||0,
    aggrBefore: street===1 ? S.preAggr : null, bb:S.bb, bomb:S.bomb, ranges:opps.map(o=>o.range)};
  return {i, p, hand, d, opps, pos:livePos(i), turn:S.turn===i, om:hand.length===4, canRaise: !p.allIn && p.stack>toCall && maxRaiseTo(i)>S.currentBet};
}

let EQ_CACHE={key:'', eq:0};
function spotEq(sp){
  const key=[S.handNo, S.street, S.board.length, S.currentBet, sp.d.toCall, sp.opps.map(o=>o.k+':'+o.range.toFixed(2)).join(',')].join('|');
  if(EQ_CACHE.key!==key) EQ_CACHE={key, eq: sp.opps.length ? equityVs(sp.hand, sp.d.board, sp.d.ranges, sp.om ? 400 : 1200) : 1};
  return EQ_CACHE.eq;
}
function wetBoard(board){
  if(board.length<3) return false;
  const sc=[0,0,0,0]; board.forEach(c=>sc[c.s]++);
  const rs=[...new Set(board.map(c=>c.r))].sort((a,b)=>a-b); let close=0;
  for(let k=1;k<rs.length;k++) if(rs[k]-rs[k-1]<=2) close++;
  return Math.max(...sc)>=3 || (Math.max(...sc)>=2 && board.length<5) || close>=2;
}
// a sensible bet or raise for this spot
function sizeFor(sp, eq){
  const {d, i}=sp, maxTo=maxRaiseTo(i), minTo=Math.min(maxTo, S.currentBet===0 ? S.bb : S.currentBet+S.minRaise);
  let to;
  if(d.street===0){
    if(d.raises===0){ const limpers=seats().filter((q,k)=>k!==i && q.inHand && !q.folded && q.acted && q.bet===S.bb).length; to=S.bb*(3+limpers); }
    else to=S.currentBet*(['btn','co'].includes(sp.pos) ? 3 : 3.5);
    if(sp.om && d.raises>=1) to=maxTo; // pot-limit re-raises are usually pot-sized
  } else if(d.toCall===0) to=d.pot*(eq>.8 && d.street===3 ? .75 : wetBoard(d.board) ? .66 : .4);
  else to=S.currentBet*3;
  return Math.min(maxTo, Math.max(minTo, round10(to)));
}
// every action that is possible now, judged; the best one first
function weigh(sp){
  const {d, hand, pos}=sp, eq=spotEq(sp);
  const acts = d.toCall>0 ? ['fold','call'] : ['check'];
  if(sp.canRaise) acts.push(d.toCall>0 || d.street===0 ? 'raise' : 'bet');
  const outs = d.street>0 && d.street<3 ? outsOf(hand, d.board) : [];
  const pc = d.street===0 ? handPct(hand) : null, thr=(sp.om?OPEN_THR_OM:OPEN_THR)[pos]||.2;
  const aggressive = d.street===0 ? pc<=thr*.6 : eq>.6 || (outs.length>=8 && d.opps<=2);
  const res=acts.map(a=>{
    const to = a==='raise'||a==='bet' ? sizeFor(sp, eq) : 0;
    const r = {a, to, ...judge({...d, a, to, eqLive:eq}, hand, pos)};
    r.rank = VSCORE[r.verdict]*10 + (a==='raise'||a==='bet' ? (aggressive?3:-1) : a==='fold' ? 0 : 1);
    return r;
  });
  const best=res.slice().sort((x,y)=>y.rank-x.rank)[0];
  return {eq, res, best, outs, pc, thr};
}
const actLabel = r => r.a==='raise'||r.a==='bet' ? L('{0} до {1}', ACT_NAMES[r.a], r.to) : ACT_NAMES[r.a];

/* ---------- describing opponents ---------- */
function oppStyle(o){
  if(o.src==='none') return L('пока мало данных ({0} разд.), считаю обычным игроком', o.h);
  const base=L('{0}: VPIP {1}%, PFR {2}%', STYLES[o.style].n, Math.round(o.vp*100), Math.round(o.pr*100));
  return o.src==='profile' ? [base, L('по его профилю ({0} раздач)', o.h)] : base;
}
function oppLine(o, withRange){
  const parts=[oppStyle(o)];
  if(o.p.bot) parts.push(L('бот «{0}»', LVL[o.p.lvl||2].name));
  if(o.af!=null) parts.push(o.af>=2.5 ? L('после флопа ставит очень часто') : o.af>=1.2 ? L('после флопа ставит часто') : L('после флопа ставит редко'));
  if(o.ftb!=null) parts.push(L('на ставку сбрасывает в {0}% случаев', Math.round(o.ftb*100)));
  if(S.street!=='preflop' && o.p._agg) parts.push(L('на этой улице ставил'));
  else if(o.p._p) parts.push(L('повышал до флопа'));
  if(withRange) parts.push(L('диапазон ≈ топ {0}% рук', Math.round(o.range*100)));
  return L('{0}: {1}.', o.p.name, parts);
}
function exploits(sp){
  const out=[], {d}=sp, ag=sp.opps.find(o=>o.k===S.aggr);
  if(d.toCall>0 && ag && ag.src!=='none'){
    if(d.street>0 && ag.af!=null && ag.af<1) out.push(L('{0} редко ставит сам — его ставка обычно означает сильную руку.', ag.p.name));
    else if(ag.af!=null && ag.af>=3) out.push(L('{0} ставит очень часто, в том числе с блефами, — против него можно уравнивать шире.', ag.p.name));
    if(d.street===0 && ag.vp!=null && ag.vp<.18) out.push(L('{0} играет мало рук ({1}%) — его рейз почти всегда означает сильную руку.', ag.p.name, Math.round(ag.vp*100)));
  }
  if(d.toCall===0 && sp.opps.length===1){
    const o=sp.opps[0];
    if(o.ftb!=null && o.ftb>=.6) out.push(L('{0} сбрасывает на ставку в {1}% случаев — здесь хорошо работают продолженная ставка и блеф.', o.p.name, Math.round(o.ftb*100)));
    else if((o.ftb!=null && o.ftb<=.3) || (o.vp!=null && o.vp>=.45)) out.push(L('{0} редко сбрасывает — не блефуйте, а с хорошей рукой ставьте крупнее.', o.p.name));
  }
  if(sp.opps.length>=3 && d.street>0) out.push(L('Против {0} соперников кто-то часто попадает в стол: блефовать дорого, ставить стоит в основном с сильными руками.', sp.opps.length));
  return out;
}
function omFeatureKeys(h){
  const f=omFeatures(h), out=[];
  if(f.pairs.length===2) out.push('две пары в руке');
  else if(f.pairs[0]===14) out.push('пара тузов');
  else if(f.pairs[0]>=11) out.push('высокая пара');
  else if(f.pairs.length) out.push('маленькая пара');
  out.push(f.suited.length===2 ? 'две масти по две карты' : f.suited.length ? (f.aceSuit ? 'масть с тузом' : 'одна масть') : f.suited3 ? 'три карты одной масти — минус' : 'разномастная');
  if(f.rundown) out.push('четыре связанные карты'); else if(f.conn>=4) out.push('связанные карты');
  if(f.dangler) out.push('лишняя карта');
  if(f.trips) out.push('три карты одного ранга — сильный минус');
  return out;
}

/* ---------- answers ---------- */
function liveHandMsg(sp, w){
  const {d, hand}=sp, top=w.pc!=null ? Math.max(1, Math.round(w.pc*100)) : 0;
  const potMsg = d.toCall>0 ? L('В банке {0}, вам доплатить {1}.', d.pot, d.toCall) : L('В банке {0}, можно сыграть чек.', d.pot);
  if(d.street===0){
    const parts=[L('Префлоп, позиция «{0}». {1} — топ {2}% стартовых рук.', POS_NAMES[sp.pos], fmtCards(hand), top)];
    if(sp.om) parts.push(L('В Омахе важно, чтобы карты работали вместе: {0}.', omFeatureKeys(hand)));
    parts.push(potMsg);
    return parts;
  }
  const made=bestHand(hand, d.board), nu=nutsOf(hand, d.board);
  const parts=[L('{0}: у вас {1} ({2}).', STREET_SHORT[d.street], HAND_NAMES[made.cat], fmtCards(made.cards))];
  if(nu.nuts) parts.push(L('Это натсы — сильнее руки на этом столе нет.'));
  else if(nu.top===made.cat) parts.push(L('Почти натсы: сильнее может быть только {0} постарше.', HAND_NAMES[made.cat]));
  else if(made.cat>=2) parts.push(L('Натсы здесь — {0}, так что ваша рука не самая сильная из возможных.', HAND_NAMES[nu.top]));
  if(w.outs.length) parts.push(L('Карт, которые усилят руку: {0} ({1}).', w.outs.length, fmtCards(w.outs)));
  parts.push(potMsg);
  return parts;
}
function liveMathMsg(sp, w){
  const {d}=sp, E=Math.round(w.eq*100), parts=[];
  if(d.street===0){
    if(sp.pos==='bb' && d.toCall===0) parts.push(L('С большого блайнда без рейза флоп можно посмотреть бесплатно, а повышать стоит с сильными руками.'));
    else parts.push(L('До флопа решают сила руки и позиция: с позиции «{0}» разумно открывать примерно лучшие {1}% рук.', POS_NAMES[sp.pos], Math.round(w.thr*100)));
    if(d.raises>0) parts.push(L('Против рейза диапазон сужают: соперник уже показал силу.'));
    if(sp.opps.length) parts.push(L('Против этих диапазонов ваши шансы ≈{0}%.', E));
    return parts;
  }
  parts.push(L('Против этих диапазонов ваши шансы ≈{0}%.', E));
  if(d.toCall>0){
    const N=Math.round(d.toCall/(d.pot+d.toCall)*100), ev=Math.round(w.eq*(d.pot+d.toCall)-d.toCall);
    parts.push(ev>=0 ? L('Колл {0} при банке {1}: нужно {2}%. В среднем такой колл приносит {3} фишек.', d.toCall, d.pot, N, ev) : L('Колл {0} при банке {1}: нужно {2}%. В среднем такой колл теряет {3} фишек.', d.toCall, d.pot, N, -ev));
  }
  if(w.outs.length>=8 && d.street<3) parts.push(L('С дро добавляйте неявные шансы: если соберёте руку, соперник может заплатить ещё.'));
  if(d.street===1 && d.pot>0){
    const spr=sp.p.stack/d.pot;
    parts.push(L('Стек к банку (SPR) ≈ {0}. {1}', Math.round(spr*10)/10, spr<=3 ? L('Банк уже большой: с топ-парой и сильнее можно играть до олл-ина.') : spr>=10 ? L('Стеки глубокие: без очень сильной руки не раздувайте банк.') : L('Средний SPR: играйте по силе руки.')));
  }
  return parts;
}
function liveVerdictMsg(sp, w){
  const others=w.res.filter(r=>r!==w.best).map(r=>L('{0} — {1}', actLabel(r), VERDICT_WORD[r.verdict]));
  return [L('Мой совет: {0}.', actLabel(w.best)), w.best.why, w.best.note, ...exploits(sp), others.length ? L('Другие варианты: {0}', others) : null];
}
function liveSay(parts, extra){ coachSay(parts.filter(Boolean), extra); }

function liveAnswer(intent, arg){
  const sp=liveSpot();
  if(['advise','whatif','odds','outs','beats','size','bluff','why'].includes(intent)){
    if(!sp){ liveSay([S && S.handOver ? L('Раздача закончилась. Могу разобрать её или рассказать, кто как играет за столом.') : L('Сейчас вы не в раздаче. Могу рассказать, кто как играет за столом, или разобрать прошлую раздачу.')]); return; }
    if(!liveAllowed()){ liveSay([L('За этим столом ведущий выключил подсказки решений, поэтому во время раздачи я не советую по вашим картам — так честно для всех. Могу рассказать о соперниках по их статистике, а после раздачи — разобрать её.')]); return; }
  }
  if(intent==='advise'){
    const w=weigh(sp); LIVE.last=w;
    liveSay(liveHandMsg(sp, w));
    if(sp.opps.length) liveSay([L('Соперники в раздаче:'), ...sp.opps.slice().sort((a,b)=>(b.k===S.aggr)-(a.k===S.aggr)).slice(0,4).map(o=>oppLine(o, true))]);
    liveSay(liveMathMsg(sp, w));
    liveSay(liveVerdictMsg(sp, w), {verdict:'good'});
    return;
  }
  if(intent==='whatif'){
    const w=weigh(sp), want = arg==='check' && sp.d.toCall>0 ? 'call' : arg==='call' && sp.d.toCall===0 ? 'check' : arg==='bet' && sp.d.toCall>0 ? 'raise' : arg==='raise' && sp.d.toCall===0 && sp.d.street>0 ? 'bet' : arg;
    const r=w.res.find(x=>x.a===want);
    if(!r){ liveSay([L('Сейчас этот ход недоступен.'), L('Мой совет: {0}.', actLabel(w.best))]); return; }
    liveSay([L('Если {0}: {1}.', actLabel(r), {good:'хорошее решение', ok:'спорное решение', bad:'ошибка'}[r.verdict]), r.why, r.note, r!==w.best ? L('Я бы выбрал: {0}.', actLabel(w.best)) : null], {verdict:r.verdict});
    return;
  }
  if(intent==='why'){ const w=weigh(sp); liveSay([...liveMathMsg(sp, w), w.best.why]); return; }
  if(intent==='odds'){
    const w=weigh(sp), E=Math.round(w.eq*100);
    if(sp.d.street===0) liveSay([L('Ваша рука — топ {0}% стартовых рук.', Math.max(1, Math.round(w.pc*100))), sp.opps.length ? L('Против диапазонов соперников ваши шансы ≈{0}%.', E) : null]);
    else liveSay(liveMathMsg(sp, w));
    return;
  }
  if(intent==='outs'){
    if(sp.d.street===0){ liveSay([L('Ауты считают после флопа, когда открыты общие карты.')]); return; }
    if(sp.d.street===3){ liveSay([L('Это ривер: карт больше не будет, ауты уже не помогут.')]); return; }
    const o=outsOf(sp.hand, sp.d.board);
    liveSay(o.length ? [L('Аутов: {0} — {1}.', o.length, fmtCards(o)), (sp.d.street===1 ? L('По правилу 2 и 4 это ≈{0}% на следующей карте и ≈{1}% к риверу.', o.length*2, Math.min(100, o.length*4)) : L('По правилу 2 и 4 это ≈{0}% на следующей карте.', o.length*2))] : [L('Аутов для сильной руки сейчас нет.')]);
    return;
  }
  if(intent==='beats'){
    if(sp.d.street===0){ liveSay([L('До флопа рано: стол ещё не открыт. Спросите после флопа.')]); return; }
    const th=threatsOf(sp.hand, sp.d.board), nu=nutsOf(sp.hand, sp.d.board), pct=Math.round(th.beat/th.total*1000)/10;
    const mc0=Math.floor(nu.mineV/P5), fmtN=n=>th.om ? Math.round(n/th.total*1000)/10+'%' : n;
    const cats=Object.entries(th.by).filter(([c])=>+c>mc0).sort((a,b)=>b[0]-a[0]).map(([c,n])=>L('{0} — {1}', HAND_NAMES[c], fmtN(n)));
    if(th.by[mc0]) cats.push(L('та же комбинация, но старше — {0}', fmtN(th.by[mc0])));
    const head = nu.nuts ? L('У вас натсы: сейчас вас не бьёт ничего.') : th.om ? L('Примерно {0}% случайных рук Омахи сейчас сильнее вашей.', pct) : L('Из {0} возможных рук соперника вашу сейчас бьют {1} ({2}%).', th.total, th.beat, pct);
    liveSay([head, cats.length ? L('Что сильнее: {0}.', cats) : null, !nu.nuts ? L('Натсы на этом столе — {0}.', HAND_NAMES[nu.top]) : null, L('Но соперники играют не случайными руками: если кто-то ставит и повышает, его диапазон ближе к этим рукам.')]);
    return;
  }
  if(intent==='size'){
    const w=weigh(sp), pot=sp.d.pot;
    const ref=L('Для ориентира: ⅓ банка = {0}, ½ = {1}, ¾ = {2}, банк = {3}.', round10(pot/3), round10(pot/2), round10(pot*.75), round10(pot));
    if(w.best.a==='raise' || w.best.a==='bet'){
      const why = sp.d.street===0 ? L('До флопа обычный размер — 3 больших блайнда плюс по одному за каждого лимпера, а против рейза — примерно втрое больше его ставки.') : wetBoard(sp.d.board) ? L('Стол мокрый — ставьте крупнее, чтобы дро платили за шанс.') : L('Стол сухой — небольшой ставки хватает.');
      liveSay([sp.d.street===0 ? L('Я бы поставил {0} — это {1} BB.', w.best.to, Math.round(w.best.to/S.bb*10)/10) : L('Я бы поставил {0} — это ≈{1}% банка.', w.best.to, Math.round(w.best.to/Math.max(1,pot)*100)), why, sp.om ? L('В пот-лимите максимум сейчас — до {0}.', maxRaiseTo(sp.i)) : null, ref]);
    } else liveSay([L('Здесь я бы не ставил: {0}', w.best.why), ref]);
    return;
  }
  if(intent==='bluff'){
    const w=weigh(sp), pot=Math.max(1, sp.d.pot), size=round10(pot*.66), be=Math.round(size/(pot+size)*100);
    const parts=[L('Блеф ставкой {0} окупается, если соперники сбрасывают чаще, чем в {1}% случаев.', size, be)];
    if(sp.opps.length>=3) parts.push(L('Но соперников {0} — кто-нибудь почти наверняка заплатит. Блеф здесь плохая идея.', sp.opps.length));
    else sp.opps.forEach(o=>{
      if(o.ftb!=null) parts.push(L('{0} сбрасывает на ставку в {1}% случаев — {2}.', o.p.name, Math.round(o.ftb*100), o.ftb*100>be ? L('блеф в плюс') : L('блеф в минус')));
      else if(o.vp!=null && o.vp>=.45) parts.push(L('{0} играет много рук и редко сдаётся — блефовать против него невыгодно.', o.p.name));
      else parts.push(L('{0}: данных о сбросах на ставку пока мало.', o.p.name));
    });
    if(w.eq>.55) parts.push(L('И главное: ваша рука и так сильная (≈{0}%) — это не блеф, а ставка на вэлью.', Math.round(w.eq*100)));
    else if(w.outs.length>=8) parts.push(L('С {0} аутами это полублеф: даже если заплатят, вы можете собрать руку.', w.outs.length));
    liveSay(parts);
    return;
  }
  if(intent==='opp'){
    const list = sp ? sp.opps : seats().map((q,k)=>[q,k]).filter(([q,k])=>q.uid!==myUid && !q.out && !q.left).map(([q,k])=>oppInfo(q,k));
    if(!list.length){ liveSay([L('Соперников сейчас нет.')]); return; }
    liveSay([sp ? L('Соперники в раздаче:') : L('Соперники за столом:'), ...list.slice(0,6).map(o=>oppLine(o, !!sp))]);
    return;
  }
  if(intent==='who'){ // one opponent in detail
    const p=seats()[arg], o=oppInfo(p, arg), st=stOf(p), parts=[oppLine(o, !!sp && !p.folded && p.inHand)];
    if(o.style>=0) parts.push(L('Как играть против такого игрока: {0}.', STYLES[o.style].c));
    if(st.sd>=3) parts.push(L('На вскрытии выигрывает {0}% ({1} вскрытий).', Math.round(st.sdw/st.sd*100), st.sd));
    if(st.h) parts.push(L('Итог за этим столом: {0}.', (st.net>0?'+':'')+st.net));
    if(o.src==='none') parts.push(L('Сыграйте с ним ещё несколько раздач — я начну замечать его привычки.'));
    liveSay(parts);
    return;
  }
  if(intent==='table'){
    const all=seats().map((q,k)=>[q,k]).filter(([q])=>q.uid!==myUid && !q.out && !q.left).map(([q,k])=>oppInfo(q,k));
    const known=all.filter(o=>o.src!=='none');
    if(!known.length){ liveSay([L('Статистики пока мало: сыграйте ещё несколько раздач — я начну замечать, кто как играет.')]); return; }
    const parts=[L('Кто как играет за столом:'), ...known.sort((a,b)=>b.vp-a.vp).map(o=>oppLine(o, false))];
    const aggr=known.filter(o=>o.af!=null).sort((a,b)=>b.af-a.af)[0], folder=known.filter(o=>o.ftb!=null).sort((a,b)=>b.ftb-a.ftb)[0];
    const said=new Set(), note=(o, msg)=>{ if(o && !said.has(o.k)){ said.add(o.k); parts.push(msg); } };
    if(aggr && aggr.af>=2) note(aggr, L('Самый агрессивный — {0}: против него уравнивайте шире и чаще отдавайте ему инициативу.', aggr.p.name));
    if(folder && folder.ftb>=.55) note(folder, L('Чаще всех сбрасывает на ставку {0} — его удобно атаковать.', folder.p.name));
    const loosePass=known.find(o=>o.style===1 && !said.has(o.k)), tightAg=known.find(o=>o.style===0 && !said.has(o.k));
    if(loosePass) note(loosePass, L('{0} играет много рук и редко повышает — против него ставьте на вэлью и почти не блефуйте.', loosePass.p.name));
    if(tightAg) note(tightAg, L('{0} играет мало рук, но агрессивно — осторожнее с его ставками.', tightAg.p.name));
    liveSay(parts);
    return;
  }
  if(intent==='review'){ closeCoach(); openCoach(); return; }
  coachAnswer(intent, arg);
}

// a question typed in the live chat
const LIVE_WORDS = [
  ['review',  ['разбор','разбери','прошл','review','last hand','analys','analyz','analyse','analiz','талда','ניתוח','ანალიზ']], // i18n-skip
  ['size',    ['сколько став','какой размер','размер став','how much','sizing','bet size','wie viel','wieviel','combien','cât să','cat sa','қанша','כמה','რამდენ']], // i18n-skip
  ['bluff',   ['блеф','bluff','blef','bluf','בלוף','ბლეფ']], // i18n-skip
  ['beats',   ['бьет','что сильнее','натс','бьют','beat','nuts','schläg','schlag','bat ','bate','ұтады','מנצח','სჯობ']], // i18n-skip
  ['table',   ['кто как','за столом','весь стол','всех','кого атак','table','everyone','who ','tisch','wer ','qui ','masa','cine','үстел','кім','שולחן','מי ','მაგიდ','ვინ']], // i18n-skip
  ['advise',  ['что делать','что мне','как сыграть','как быть','совет','подскаж','мой ход','что посовет','what should','what do i','what now','advice','advise','suggest','was soll','was tun','rat ','que faire','conseil','ce să fac','ce sa fac','sfat','не істе','кеңес','מה לעשות','עצה','რა ვქნა','რჩევ','що робити','порад']], // i18n-skip
];
const ACT_WORDS = [
  ['fold',  ['пас','сброс','фолд','fold','passe','couch','aussteig','abandon','פולד','ფოლდ','скин']], // i18n-skip
  ['check', ['чек','check','צ\'ק','ჩეკ']], // i18n-skip
  ['call',  ['колл','уравн','call','suivre','mitgeh','plătesc','platesc','קול','ქოლ']], // i18n-skip
  ['raise', ['рейз','повыс','поднять','подним','олл-ин','олл ин','all-in','allin','raise','relance','erhöh','mărește','mareste','ריי','რეიზ','ва-банк']], // i18n-skip
  ['bet',   ['бет','поставить','bet','miser','setzen','pariez','הימור','ფსონ']], // i18n-skip
];
function liveAsk(q){
  const norm=s=>String(s).toLowerCase().replace(/ё/g,'е');
  // an opponent by name
  const named=seats().map((p,k)=>[p,k]).filter(([p])=>p.uid!==myUid && !p.out).find(([p])=>{ const n=norm(p.bot?t(p.name):p.name), n0=norm(p.name); return (n.length>=2 && q.includes(n.slice(0, Math.max(3, n.length-2)))) || (n0.length>=2 && q.includes(n0.slice(0, Math.max(3, n0.length-2)))); });
  if(named) return liveAnswer('who', named[1]);
  const asksDef = /что так|що так|what is|what's|was ist|qu.est-ce|ce (e|înseamn)|деген не|מה זה|რა არის|означа|значит|mean/.test(q); // i18n-skip
  const termIdx = TERMS.findIndex(T=>T.k.some(k=>q.includes(norm(k))) || q.includes(norm(t(T.n))));
  if(termIdx>=0 && asksDef) return coachAnswer('term', termIdx);
  const lw=LIVE_WORDS.find(([,ws])=>ws.some(w=>q.includes(w)));
  if(lw) return liveAnswer(lw[0]);
  const ci=INTENTS.filter(([,ws])=>ws.some(w=>q.includes(w))).map(([n])=>n);
  if(ci.includes('opp')) return liveAnswer('opp');
  if(ci.includes('outs')) return liveAnswer('outs');
  if(ci.includes('odds')) return liveAnswer('odds');
  const aw=ACT_WORDS.find(([,ws])=>ws.some(w=>q.includes(w)));
  if(aw) return liveAnswer('whatif', aw[0]);
  if(ci.includes('why')) return liveAnswer('why');
  if(ci.includes('hello') || ci.includes('thanks')) return coachAnswer(ci.includes('hello') ? 'hello' : 'thanks');
  if(termIdx>=0) return coachAnswer('term', termIdx);
  if(ci.includes('style')) return liveAnswer('table');
  return liveAnswer(liveSpot() ? 'advise' : 'table');
}

/* ---------- the panel ---------- */
const LIVE_CHIPS = [['advise','Что делать?'],['odds','Какие шансы?'],['opp','Что у соперников?'],['beats','Что меня бьёт?'],['size','Сколько ставить?'],['bluff','Можно блефовать?'],['table','Кто как играет?'],['review','Разбор прошлой раздачи']];
function openLiveCoach(){
  COACH.live=true; COACH.open=true; COACH.msgs=LIVE.msgs; LIVE.key='';
  if(!LIVE.msgs.length) liveSay([L('Я рядом и вижу то же, что и вы: ваши карты, стол и как играют соперники.'), L('Спрашивайте прямо во время раздачи: «что делать?», «а если рейз?», «что меня бьёт?», «как играть против него?» — или назовите соперника по имени.')]);
  $('coachOv').classList.add('live'); $('coachOv').hidden=false; placeLive();
  renderCoach();
}
function liveHeadHTML(){
  const sp=liveSpot();
  if(!sp) return `<div class="sblock"><b>${esc(t(mySeat()>=0 ? 'Вы не в раздаче — можно обсудить соперников' : 'Вы смотрите игру — можно обсудить соперников'))}</b></div>`;
  const b=sp.d.board;
  return `<div class="sblock"><span class="slabel">${t('Ваши карты')}</span><div class="srow">${sp.hand.map(c=>cardHTML(c)).join('')}</div></div>
    <div class="sblock"><span class="slabel">${t('Стол')}</span><div class="srow">${[0,1,2,3,4].map(j=>b[j]?cardHTML(b[j]):'<div class="slot"></div>').join('')}</div></div>
    <div class="sblock chmeta"><span class="slabel">${t('Позиция')}</span><b>${esc(t(POS_NAMES[sp.pos]))}</b><span class="slabel">${t('Банк')}</span><b>${esc(fmtWin(sp.d.pot, S.bb))}</b><span class="slabel">${t('Колл')}</span><b>${sp.d.toCall ? esc(fmtWin(sp.d.toCall, S.bb)) : '—'}</b>${sp.turn?`<span class="muted">${esc(t('Ваш ход'))}</span>`:''}</div>`;
}
// the panel starts below the header, so the header buttons (and this one) stay reachable
function placeLive(){ const h=document.querySelector('header'); if(h) $('coachOv').style.setProperty('--coachTop', Math.round(h.getBoundingClientRect().bottom+6)+'px'); }
addEventListener('resize', ()=>{ if(COACH.open && COACH.live) placeLive(); });
// called from render(): keeps the panel in step with the table and gives advice on your turn if asked to
function liveTick(){
  $('bTutor').hidden=!S;
  if(!COACH.open || !COACH.live) return;
  if(!S){ closeCoach(); return; }
  const sp=liveSpot();
  const key = sp ? [S.handNo, S.street, S.board.length, S.currentBet, sp.turn, sp.d.toCall, sp.opps.length].join('|') : 'x|'+S.handNo+'|'+mySeat();
  if(key!==LIVE.key){ LIVE.key=key; $('coachHand').innerHTML=liveHeadHTML(); }
  if(CFG.coachAuto && sp && sp.turn && myTurn() && liveAllowed()){
    const ak=[S.handNo, S.street, S.currentBet, sp.d.toCall].join('|');
    if(ak!==LIVE.autoKey){
      LIVE.autoKey=ak;
      const w=weigh(sp);
      liveSay([L('{0}: советую {1}.', STREET_SHORT[sp.d.street], actLabel(w.best)), w.best.why, w.best.note, ...exploits(sp).slice(0,1)], {verdict:'good'});
      renderCoach();
    }
  }
}
$('bTutor').onclick=()=>{ if(COACH.open && COACH.live) closeCoach(); else openLiveCoach(); };
$('coachAuto').onchange=e=>{ CFG.coachAuto=e.target.checked; saveCfg(); LIVE.autoKey=''; if(CFG.coachAuto) liveTick(); };
