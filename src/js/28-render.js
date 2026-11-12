/* ---------- render ---------- */
// phone layout: narrow portrait screens and phones held sideways; `land` picks the wide seat geometry
const mq = matchMedia('(max-width:620px), (orientation:landscape) and (max-height:500px)');
const land = matchMedia('(orientation:landscape) and (max-height:500px)');
mq.addEventListener?.('change',()=>{ seatSig=''; render(); });
land.addEventListener?.('change',()=>{ seatSig=''; render(); });
let seatNodes=[], seatSig='', boardHand=-1, fxDone='', potShown=0, potAnim=null, bannerText=null, logTop=null;

function layout(n, me){
  const narrow = mq.matches && !land.matches;
  const rx = narrow ? 37 : 42, ry = narrow ? 41 : 40, cy = narrow ? 50 : 49;
  const base = me>=0 ? me : 0;
  const out=[];
  const dense = n>=7, gap = dense ? (narrow ? 1.05 : 0.8) : Math.PI/n*2;
  for(let i=0;i<n;i++){
    const k=((i-base)%n+n)%n;
    const a = k===0 ? Math.PI/2 : (dense ? Math.PI/2 + gap + (k-1)*(2*Math.PI-2*gap)/(n-2) : Math.PI/2 + k*2*Math.PI/n);
    const rr = k===0 && narrow ? .82 : k===0 && land.matches ? .74 : 1;
    out[i]=[50+rx*Math.cos(a), cy+ry*rr*Math.sin(a)];
  }
  return out;
}
function cardHTML(c, cls=''){
  if(!c) return `<div class="card back bk-${CFG.back||'pion'} ${cls}" aria-label="${t('Закрытая карта')}"></div>`;
  const red = c.s===1||c.s===2; const r = RL[c.r]||c.r; cls += ' s'+c.s;
  return `<div class="card${red?' red':''} ${cls}" data-k="${cardKey(c)}" aria-label="${r}${SUITS[c.s]}"><span class="r">${r}</span><span class="s1">${SUITS[c.s]}</span><span class="s2">${SUITS[c.s]}</span></div>`;
}
function resetView(){ $('chat').innerHTML=''; chatSeen=new Set(); chatInit=false; statsHtml=''; $('stats').innerHTML=''; prevBets=0; prevMyTurn=false; seatSig=''; boardHand=-1; fxDone=''; potShown=0; logTop=null; bannerText=null; $('pot').textContent='0'; $('banner').textContent=''; $('log').innerHTML=''; $('seats').innerHTML=''; $('bets').innerHTML=''; $('fx').innerHTML=''; $('board').innerHTML='<div class="slot"></div>'.repeat(5); $('table').classList.remove('myturn'); }

function cardsFor(i){
  const s=S.seats[i];
  if(!s.inHand || s.out) return [];
  if(s.shown) return s.shown;
  if(s.uid===myUid){
    if(isDealer()) return H.hands[i]||Array(holeN()).fill(null);
    if(myCards && myCards.hand===S.handNo) return myCards.cards;
  }
  return Array(holeN()).fill(null);
}

// the subtitle under the logo names the game; set here on every render (in the menu too), so it always follows the language
function renderSub(){ const sub=document.querySelector('h1 .sub'); if(!sub) return; const v = S ? t(S.game==='omaha'?'Омаха':'Техасский холдем')+(S.ko?' · '+t('Нокаут'):'') : t('Техасский холдем'); if(sub.textContent!==v) sub.textContent=v; }
function render(){
  renderSub();
  const tbl=$('table');
  $('tableChip').hidden = !(code && (MODE==='host'||MODE==='guest'));
  $('tableCode').textContent = code||'';
  $('hostTag').hidden = MODE!=='host';
  $('bExit').hidden = MODE==='lobby';
  document.body.classList.toggle('inlobby', !S);
  if(!S){ renderControls(); liveTick(); return; }

  const n=S.seats.length, me=mySeat();
  const pos=layout(n, me);
  tbl.classList.toggle('dense', n>=7 || (mq.matches && n>=6));
  document.body.classList.toggle('tight', mq.matches);
  tbl.classList.toggle('omaha', S.game==='omaha');
  const W=tbl.clientWidth, Ht=tbl.clientHeight;
  const sig=S.seats.map(s=>s.uid).join(',')+'|'+me+'|'+mq.matches;
  if(sig!==seatSig){
    seatSig=sig; $('seats').innerHTML=''; $('bets').innerHTML='';
    seatNodes = S.seats.map(()=>{
      const el=document.createElement('div'); el.className='seat';
      el.innerHTML='<div class="cards"></div><div class="plate"><div class="act"></div><div class="ava"></div><i class="net" hidden></i><div class="dealer" hidden title="'+t('Дилер')+'">D</div><div class="name"></div><div class="stack"></div><div class="vp"></div><div class="timer" hidden><i></i></div></div><div class="hn"></div><div class="bubble"></div>';
      $('seats').append(el);
      const bet=document.createElement('div'); bet.className='bet'; $('bets').append(bet);
      return {el, cards:el.querySelector('.cards'), act:el.querySelector('.act'), ava:el.querySelector('.ava'), avSig:'', net:el.querySelector('.net'), prevBet:0, dealer:el.querySelector('.dealer'), name:el.querySelector('.name'), stack:el.querySelector('.stack'), timer:el.querySelector('.timer'), bar:el.querySelector('.timer i'), hn:el.querySelector('.hn'), vp:el.querySelector('.vp'), bubble:el.querySelector('.bubble'), bet, cardSig:'', lastAct:null, betOn:false};
    });
  }
  const isSD = S.street==='showdown' && S.handOver;
  const bestSet = new Set((S.best||[]).map(cardKey));
  const dealOrder=[]; { let k=nextIdx(S.dealer, p=>p.inHand); for(let c=0;c<n && k>=0;c++){ dealOrder.push(k); k=(k+1)%n; } }
  const inHandCount = Math.max(1, S.seats.filter(s=>s.inHand).length);

  S.seats.forEach((s,i)=>{
    const N=seatNodes[i]; const [x,y]=pos[i];
    N.el.style.left=x+'%'; N.el.style.top=y+'%';
    N.el.className = ['seat', s.uid===myUid?'me':'', S.turn===i&&!S.handOver?'turn':'', s.folded&&s.inHand?'folded':'', (s.out||s.left)?'out':'', s.won>0&&S.handOver?'winner':''].join(' ');
    N.name.innerHTML = esc(s.bot?t(s.name):s.name) + (s.bot?'<em>'+esc(t((LVL[s.lvl||2]||LVL[2]).name))+'</em>':'') + (s.uid===myUid&&MODE!=='offline'?'<em>'+esc(t('вы'))+'</em>':'') + (s.kos?' <em class="kos" title="'+esc(t('Выбито соперников: {0}', s.kos))+'">🎯'+s.kos+'</em>':'');
    { const av=avatarFor(s), sig=JSON.stringify(av); if(sig!==N.avSig){ N.avSig=sig; N.ava.innerHTML=avatarSVG(av); } }
    N.stack.textContent = fmt(s.stack);
    { const t=s.st||EMPTY_ST; N.vp.textContent = t.h>=3 ? `VPIP ${Math.round(t.v/t.h*100)} · PFR ${Math.round(t.p/t.h*100)}` : ''; }
    N.dealer.hidden = !(S.dealer===i && !s.out && S.handNo>0);
    const status = s.busted ? L('{0} место', s.place) : s.left ? 'Ушёл' : s.offline ? 'Не в сети' : s.away ? 'Отошёл' : (s.out ? 'Без фишек' : (!s.inHand && S.handNo>0 && !S.handOver ? 'Ждёт' : s.last));
    if(status+'|'+LANG!==N.lastAct){ N.lastAct=status+'|'+LANG; N.act.textContent=t(status); N.act.style.animation='none'; void N.act.offsetWidth; N.act.style.animation=''; }

    // own cards can stay face down until you press them (setting «hide my cards»)
    const cs0 = cardsFor(i), mine = s.uid===myUid, canPeek = mine && CFG.hideMine && !s.shown && cs0.some(Boolean);
    const cs = canPeek && !peeking() ? cs0.map(()=>null) : cs0;
    if(mine){ N.el.classList.toggle('peekable', canPeek); N.el.classList.toggle('peeking', canPeek && peeking()); document.body.classList.toggle('mehidden', canPeek && !peeking()); }
    N.el.classList.toggle('hidecards', s.uid!==myUid && cs.length>0 && cs.every(c=>!c));
    N.el.classList.toggle('showcards', s.uid!==myUid && cs.some(Boolean));
    const hl = c => c && isSD && s.won>0 && bestSet.has(cardKey(c));
    const csig = S.handNo+':'+cs.map(c=>c?cardKey(c)+(hl(c)?'*':''):'b').join(',')+(isSD&&s.folded?'d':'');
    if(csig!==N.cardSig){
      const prev=N.cardSig; N.cardSig=csig;
      const sameHand = prev.split(':')[0]===String(S.handNo);
      const prevEmpty = !prev || prev.endsWith(':');
      const prevBacks = prev.includes('b'), nowFaces = cs.some(Boolean);
      N.cards.innerHTML = cs.map(c=>cardHTML(c, hl(c)?'hl':(isSD&&s.folded?'dim':''))).join('');
      const els=[...N.cards.children];
      if(cs.length && (!sameHand || prevEmpty)){
        const order = Math.max(0, dealOrder.indexOf(i));
        const fx=(50-x)/100*W, fy=(46-y)/100*Ht;
        els.forEach((el,k)=>{ el.style.setProperty('--fx',fx+'px'); el.style.setProperty('--fy',fy+'px'); el.style.animationDelay=((k*inHandCount+order)*0.13)+'s'; el.classList.add('deal'); }); sfxCard=true;
      } else if(sameHand && prevBacks && nowFaces){
        els.forEach((el,k)=>{ el.style.animationDelay=(k*0.14)+'s'; el.classList.add('flip'); });
      }
    }

    let hn='', plus=false;
    if(S.handOver && s.won>0 && S.handNo>0){ hn = '+'+fmt(s.won) + (s.handName&&s.shown?' · '+t(s.handName):''); plus=true; }
    else if(s.shown && s.handName) hn=t(s.handName);
    else if(s.uid===myUid && cs[0] && S.board.length>=3 && !s.folded && CFG.tips && S.hMade) hn = t(HAND_NAMES[bestHand(cs, S.board).cat]);
    N.hn.textContent=hn; N.hn.classList.toggle('plus',plus);

    N.timer.hidden = !(S.deadline>0 && S.turn===i && !S.handOver);
    { const online = MODE==='host'||MODE==='guest'; let nc='';
      if(online && !s.bot){ nc = s.uid===S.hostUid || (MODE==='host' && s.uid===myUid) ? 'host' : s.offline ? 'off' : netClass((S.net||{})[s.uid]); }
      N.net.hidden=!nc; N.net.className='net '+nc; N.net.title = nc ? (nc==='host'?t('Ведущий'):((S.net||{})[s.uid]>=0?t('Связь: {0} мс',(S.net||{})[s.uid]):t('Связь: потеряна'))) : ''; }

    let bx = x+(50-x)*.42, by = y+(46-y)*.42;
    if(mq.matches && Ht>0){
      const hh = N.el.offsetHeight/2 + 13;
      bx = x;
      by = s.uid===myUid ? y - (hh)/Ht*100 : (y < 58 ? y + (hh)/Ht*100 : y - (hh)/Ht*100);
    }
    if(s.bet>N.prevBet && !S.collect && seatSig===sig){
      const f=document.createElement('div'); f.className='fly mini'; f.dataset.den=denom(s.bet-N.prevBet); f.textContent=fmt(s.bet-N.prevBet); f.style.left=x+'%'; f.style.top=y+'%'; $('fx').append(f);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ f.style.left=bx+'%'; f.style.top=by+'%'; f.style.opacity='0'; }));
      setTimeout(()=>f.remove(), 1000);
    }
    N.prevBet = S.collect ? 0 : s.bet;
    if(s.bet>0 && !S.collect){
      if(!N.betOn){ N.bet.style.transition='none'; N.bet.style.left=bx+'%'; N.bet.style.top=by+'%'; N.bet.classList.remove('collect'); void N.bet.offsetWidth; N.bet.style.transition=''; }
      N.bet.style.left=bx+'%'; N.bet.style.top=by+'%';
      N.bet.textContent=fmt(s.bet); N.bet.dataset.den=denom(s.bet); N.bet.classList.add('on'); N.betOn=true;
    } else if(s.bet>0 && S.collect){
      N.bet.style.left='50%'; N.bet.style.top='52%'; N.bet.classList.add('collect'); N.bet.classList.remove('on'); N.betOn=false;
    } else { N.bet.classList.remove('on'); N.betOn=false; }
  });

  // board
  const bd=$('board');
  if(boardHand!==S.handNo || bd.querySelectorAll('.card:not(.ghost)').length>S.board.length){ bd.innerHTML='<div class="slot"></div>'.repeat(5); boardHand=S.handNo; }
  let fresh=0;
  for(let k=0;k<5;k++){
    const c=S.board[k], el=bd.children[k];
    if(c && !el.classList.contains('card')){
      const tmp=document.createElement('div'); tmp.innerHTML=cardHTML(c,'flipin'); const ce=tmp.firstChild;
      ce.style.animationDelay=(fresh++*0.28)+'s'; bd.replaceChild(ce, el); sfxCard=true;
    } else if(c){ el.classList.toggle('hl', isSD && bestSet.has(cardKey(c))); }
    else if(S.ghost && S.ghost[k-S.board.length] && !el.classList.contains('card')){
      const tmp=document.createElement('div'); tmp.innerHTML=cardHTML(S.ghost[k-S.board.length],'flipin ghost'); const ce=tmp.firstChild;
      ce.style.animationDelay=(fresh++*0.28)+'s'; ce.title=t('Эта карта выпала бы, если бы игра продолжилась'); bd.replaceChild(ce, el); sfxCard=true;
    }
  }

  // pot counts smoothly
  const target = S.handOver ? 0 : potTotal();
  if(target!==potShown){
    const from=potShown, t0=performance.now(); potShown=target; cancelAnimationFrame(potAnim);
    if(target>from){ $('potBox').classList.add('bump'); setTimeout(()=>$('potBox').classList.remove('bump'),500); }
    const step=t=>{ const k=Math.min(1,(t-t0)/700), e=1-Math.pow(1-k,3); $('pot').textContent=fmt(Math.round(from+(target-from)*e)); if(k<1) potAnim=requestAnimationFrame(step); };
    potAnim=requestAnimationFrame(step);
  }

  // chips fly to winners
  if(S.winFx && S.handOver){
    const key=S.winFx.hand+'|'+S.winFx.items.map(it=>it.seat+':'+it.amount).join(',');
    if(key!==fxDone){
      fxDone=key; SFX.win(); setTimeout(()=>celebrate(S.winFx?S.winFx.items:[]), 900);
      if((S.winFx?S.winFx.items:[]).some(x=>S.seats[x.seat] && S.seats[x.seat].uid===myUid)) buzz('win');
      S.winFx.items.forEach((it,k)=>{
        const p=pos[it.seat]; if(!p) return;
        const f=document.createElement('div'); f.className='fly'; f.dataset.den=denom(it.amount); f.textContent='+'+fmt(it.amount);
        f.style.left='50%'; f.style.top='52%'; $('fx').append(f);
        setTimeout(()=>{ f.style.left=p[0]+'%'; f.style.top=p[1]+'%'; f.style.opacity='0'; }, 120+k*180);
        setTimeout(()=>f.remove(), 2700+k*180);
      });
    }
  }

  const bt=tr(S.banner); if(bannerText!==bt){ bannerText=bt; const b=$('banner'); b.textContent=bt; b.style.animation='none'; void b.offsetWidth; b.style.animation=''; }
  $('handNo').textContent = S.handNo || '—';
  $('street').textContent = t(STREETS[S.street] || '—');
  tbl.classList.toggle('myturn', myTurn());
  if(S.bomb && !S.handOver && bombFxHand!==S.handNo && CFG.fx){ bombFxHand=S.handNo; const r=$('potBox').getBoundingClientRect(); burstAt(r.left+r.width/2, r.top+r.height/2, 'spark', 70); }
  { const br = S.tname ? JSON.stringify(String(S.tname).toUpperCase()) : JSON.stringify(String('PyonPoker').toUpperCase()); if(document.documentElement.style.getPropertyValue('--brand')!==br) document.documentElement.style.setProperty('--brand', br); }

  const lastId = S.log.length ? S.log[S.log.length-1].id : null;
  if(lastId!==logTop){
    const first = logTop===null;
    logTop=lastId;
    const known = new Set([...$('log').children].map(li=>li.dataset.id));
    $('log').innerHTML = S.log.slice().reverse().map(l=>`<li data-id="${esc(l.id)}" class="${esc(l.cls||'')}${!first&&!known.has(String(l.id))?' new':''}">${esc(l.k?t(l.k,...(l.a||[])):t(l.text))}</li>`).join('');
  }
  renderExtras();
  checkPre();
  renderControls();
  liveTick();
}

function renderExtras(){
  $('blinds').textContent = `${S.sb||SB}/${S.bb||BB}`;
  if(S.blindEvery && S.lvl<BLIND_LEVELS.length-1){ const n=Math.max(1,S.handNo); $('blindUp').textContent=t('· рост через {0}', S.blindEvery-((n-1)%S.blindEvery)); }
  else $('blindUp').textContent='';
  if(S.bombEvery){ const left=S.bombEvery-(S.handNo%S.bombEvery); $('blindUp').textContent += S.bomb && !S.handOver ? t(' · бомб-пот!') : t(' · бомб-пот через {0}', left); }
  const bets=S.seats.reduce((a,s)=>a+s.bet,0); if(bets>prevBets) SFX.chip(); prevBets=bets;
  if(sfxCard){ sfxCard=false; SFX.card(); }
  const mt=myTurn(); if(mt && !prevMyTurn){ SFX.turn(); myTurnAlert(); } prevMyTurn=mt;
  renderNet(); renderFair(); renderSummary(); wantWake(true);
  if(chatDotOn && !$('aside')?.classList.contains('open')) $('chatDot').hidden=false;

  const list=S.chat||[], box=$('chat');
  const li = (m, anim) => { const el=document.createElement('li'); const seat=S.seats.find(x=>x.uid===m.uid); if(seat && seat.bot) el.className='bot'; const b=document.createElement('b'); b.textContent=m.bot?t(m.name):m.name; el.append(b, document.createTextNode(m.bot?tr(m.text):String(m.text))); if(!anim) el.style.animation='none'; return el; };
  if(!chatInit){ chatInit=true; box.innerHTML=''; list.forEach(m=>{ chatSeen.add(m.id); box.append(li(m,false)); }); box.scrollTop=box.scrollHeight; }
  else {
    let added=false;
    list.forEach(m=>{
      if(chatSeen.has(m.id)) return;
      chatSeen.add(m.id); box.append(li(m,true)); added=true;
      if(m.uid!==myUid){ SFX.chat(); chatDotOn=true; }
      const si=S.seats.findIndex(x=>x.uid===m.uid), N=seatNodes[si];
      if(N){ const tx=m.bot?tr(m.text):String(m.text); N.bubble.textContent = tx.length>60 ? tx.slice(0,58)+'…' : tx; N.bubble.classList.add('show'); clearTimeout(N.bubbleT); N.bubbleT=setTimeout(()=>N.bubble.classList.remove('show'), 4200); }
    });
    while(box.children.length>60) box.firstChild.remove();
    if(added) box.scrollTop=box.scrollHeight;
  }

  const pc=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  const rows=S.seats.map(s=>{
    const q=s.st||EMPTY_ST;
    const net=q.net||0, nm=esc(s.bot?t(s.name):s.name);
    return `<tr><td title="${nm}">${nm}</td><td>${q.h}</td><td>${pc(q.v,q.h)}</td><td>${pc(q.p,q.h)}</td><td>${pc(q.sdw,q.sd)}</td><td class="${net>0?'pos':net<0?'neg':''}">${net>0?'+':''}${net}</td></tr>`;
  }).join('');
  const html=`<thead><tr><th>${t('Игрок')}</th><th>${t('Раздач')}</th><th>VPIP</th><th>PFR</th><th>W$SD</th><th>${t('Итог')}</th></tr></thead><tbody>${rows}</tbody>`;
  if(html!==statsHtml){ statsHtml=html; $('stats').innerHTML=html; }
}

function renderPlus(mine, i, p){
  const HS = CFG.tips ? S : {};
  const myC = p ? cardsFor(i) : [];
  const showPre = !!p && !S.handOver && p.inHand && !p.folded && !p.allIn && !mine && pending===null;
  $('preRow').hidden = !showPre;
  $('raiseRow').hidden = showPre || S.handOver;
  if(showPre){
    ['bFold','bCall','bRaise'].forEach(id=>$(id).hidden=true);
    const tc=S.currentBet-p.bet;
    $('preC').textContent = tc>0 ? (tc>=p.stack ? t('Колл {0} (олл-ин)', fmt(p.stack)) : t('Колл {0}', fmt(tc))) : t('Чек');
    $('preCF').setAttribute('aria-pressed', pre?.type==='checkfold');
    $('preC').setAttribute('aria-pressed', !!pre && (pre.type==='check' || pre.type==='call'));
    $('preCA').setAttribute('aria-pressed', pre?.type==='callany');
  }
  $('bShow').hidden = !(S.handOver && p && p.inHand && !p.shown && myC[0]);
  const od=$('odds');
  const on = p && p.inHand && !p.folded && !S.handOver && myC[0] && (HS.help || HS.hMade || HS.hDraws || HS.hAdvice);
  if(on){
    const opps=live().length-1;
    const key=S.handNo+'|'+myC.map(cardKey).join(',')+'|'+S.board.length+'|'+opps;
    if(key!==oddsKey){ oddsKey=key; oddsVal = opps>0 ? equity(myC, S.board, opps, 500) : 1; helpCache=computeHelp(myC, S.board); }
    const pct=Math.round(oddsVal*100), parts=[];
    if(HS.help) parts.push(`<div>${t('Шансы на победу сейчас ≈ <b>{0}%</b>. Соперников: {1}, их карты считаются случайными', pct, opps)}<div class="bar"><i style="width:${pct}%"></i></div></div>`);
    if(HS.hMade) parts.push(`<div>${t('Ваша комбинация: {0}', '<b>'+esc(t(HAND_NAMES[helpCache.cat]))+'</b>')}${helpCache.five?` <span class="mini">${helpCache.five}</span>`:''}</div>`);
    if(HS.hDraws && helpCache.dist) parts.push(`<div class="dist"><span class="dl">${t('Шансы к риверу:')}</span>${helpCache.dist.map(([c,pr])=>`<span class="dchip${c===helpCache.cat?' cur':''}"><i style="width:${Math.min(100,Math.max(3,pr))}%"></i><span>${esc(t(HAND_NAMES[c]))} ${pr<1?'&lt;1':pr}%</span></span>`).join('')}</div>`);
    if(HS.hAdvice){
      const toCall=S.currentBet-p.bet, need=toCall>0?Math.round(toCall/(potTotal()+toCall)*100):0;
      const adv = toCall>0 ? (pct>=need ? t('Колл окупается: шансы {0}% при нужных {1}%', pct, need) : t('Колл не окупается: шансы {0}%, а нужно {1}%. Лучше пас.', pct, need)) : (oddsVal>.6 ? t('Сильная рука — стоит ставить.') : t('Можно бесплатно сыграть чек.'));
      const outs = helpCache.outs && helpCache.outs.length ? ` · ${t('Ауты: {0}', helpCache.outs.length)} <span class="mini">${helpCache.outs.slice(0,16).map(fmtCard).join(' ')}${helpCache.outs.length>16?' …':''}</span>` : '';
      parts.push(`<div class="adv">${adv}${outs}</div>`);
    }
    if(mq.matches && parts.length){
      const sh=[];
      if(HS.help) sh.push(`≈${pct}%`);
      if(HS.hMade) sh.push(esc(t(HAND_NAMES[helpCache.cat])));
      if(HS.hAdvice){ const tc=S.currentBet-p.bet, nd=tc>0?Math.round(tc/(potTotal()+tc)*100):0; if(tc>0) sh.push(t('Колл')+' '+(pct>=nd?'✓':'✕')); if(helpCache.outs&&helpCache.outs.length) sh.push(t('Ауты: {0}', helpCache.outs.length)); }
      if(!sh.length && HS.hDraws && helpCache.dist) sh.push(t('Шансы к риверу:'));
      od.innerHTML=`<details id="helpDet"${CFG.helpOpen?' open':''}><summary>${sh.join(' · ')}</summary>${parts.join('')}</details>`;
    } else od.innerHTML=parts.join('');
    od.hidden=!parts.length;
  } else od.hidden=true;
  highlightMade(on && HS.hMade && helpCache.fiveCards && !document.body.classList.contains('mehidden') ? coreCards(helpCache.fiveCards, helpCache.cat) : null);
}

function renderControls(){
  const ids=['bFold','bCall','bRaise','amt','pHalf','pPot','pAll'];
  if(!S){ ids.forEach(id=>$(id).disabled=true); ['bFold','bCall','bRaise'].forEach(id=>$(id).hidden=false); $('bNext').hidden=true; $('preRow').hidden=true; $('raiseRow').hidden=false; ['bGhost','bPause','bWait'].forEach(id=>$(id).hidden=true); $('odds').hidden=true; $('bShow').hidden=true; $('blinds').textContent='—'; $('blindUp').textContent=''; $('bRebuy').hidden=true; $('hint').textContent=t('Выберите, как играть: с ботами или с друзьями.'); return; }
  const mine=myTurn(); const i=mySeat(); const p=seats()[i];
  ids.forEach(id=>$(id).disabled=!mine);
  ['bFold','bCall','bRaise'].forEach(id=>$(id).hidden=S.handOver);
  renderPlus(mine, i, p);
  $('bAway').hidden = !(p && MODE!=='offline' && MODE!=='lobby');
  if(p) $('bAway').textContent = t(p.away ? 'Вернуться в игру' : 'Отойти');
  $('bPause').hidden = !(isDealer() && S.started);
  $('bPause').textContent = t(S.paused ? 'Снять паузу' : 'Пауза');
  $('bPause').setAttribute('aria-pressed', !!S.paused);
  $('bWait').hidden = !(MODE==='guest' && S.handOver && S.nextAt && !S.paused && !(S.waits||{})[myUid]);
  $('bGhost').hidden = !(S.handOver && S.canGhost && !S.ghost && S.handNo>0);
  const toCall = p ? S.currentBet-p.bet : 0;

  let nextLabel='', showNext=false, nextDisabled=false;
  if(isDealer() && S.started && S.handOver){ showNext=true; nextLabel = S.paused ? 'Продолжить' : 'Раздать сейчас'; }
  if(MODE==='host' && !S.started){ showNext=true; nextLabel='Начать игру'; nextDisabled = seats().filter(s=>s.stack>0&&!s.left).length<2; }
  $('bNext').hidden = !showNext || !$('overlay').hidden; $('bNext').textContent=t(nextLabel); $('bNext').disabled=nextDisabled;
  const canRebuy = !S.ko && MODE!=='offline' && p && p.stack<=0 && !(p.rebuy>p.rebuySeen) && (S.handOver || !p.inHand);
  $('bRebuy').hidden = !canRebuy; $('bRebuy').textContent=t('Докупиться на {0}', buyIn());

  if(p) $('bCall').textContent = toCall>0 ? (toCall>=p.stack ? t('Олл-ин {0}', fmt(p.stack)) : t('Колл {0}', fmt(toCall))) : t('Чек');
  let hint='', minor=false;
  if(mine){
    const {min,max}=raiseBounds();
    const canRaise = max>S.currentBet && toCall<p.stack;
    $('bRaise').disabled = $('amt').disabled = !canRaise;
    $('amt').min=min; $('amt').max=max;
    if(+$('amt').value<min || +$('amt').value>max) $('amt').value=min;
    $('amtOut').textContent=fmt(+$('amt').value);
    $('bRaise').textContent = t(S.currentBet===0 ? 'Бет' : 'Рейз');
    $('pAll').textContent = t(S.game==='omaha' ? 'Макс.' : 'Олл-ин');
    ['bCall','bRaise','bFold'].forEach(id=>$(id).classList.remove('confirm')); $('bFold').textContent=t('Сбросить');
    if(confirmArm && Date.now()-confirmArm.at<3500){
      if(confirmArm.type==='fold'){ $('bFold').classList.add('confirm'); $('bFold').textContent=t('Пас?'); } // short: it must fit a phone button
      else { const id=confirmArm.type==='raise'?'bRaise':'bCall'; $(id).classList.add('confirm'); $(id).textContent=t('Точно? {0}', fmt(confirmArm.paid)); }
    }
    const odds = toCall>0 ? Math.round(toCall/(potTotal()+toCall)*100) : 0;
    hint = t('Ваш ход'); minor=true;
    if(confirmArm && confirmArm.type==='fold' && Date.now()-confirmArm.at<3500){ hint=t('Чек бесплатный: нажмите «Чек», чтобы остаться в раздаче'); minor=false; }
  } else if(pending!==null){
    hint=t('Ход отправлен ведущему…');
  } else if(MODE==='host' && !S.started){
    const humans=seats().filter(s=>!s.bot).length;
    hint = t('За столом {0} из {1}, из них людей: {2}. Нажмите «Позвать друзей» вверху и отправьте ссылку в чат. Код стола: <b>{3}</b>.', seats().length, MAX_SEATS, humans, esc(code));
  } else if(MODE==='guest' && !S.started){
    hint = t(i<0 ? 'Садимся за стол…' : 'Ждём, пока ведущий начнёт игру.');
  } else if(i<0 && MODE==='guest'){
    hint = t(seats().length>=MAX_SEATS ? 'Все места заняты. Вы смотрите игру.' : 'Садимся за стол…');
  } else if(S.handOver){
    if(S.paused) hint = t(isDealer() ? 'Пауза. Следующая раздача начнётся, когда нажмёте «Продолжить».' : 'Ведущий поставил паузу.');
    else if(S.nextAt) hint = t('Следующая раздача через <b id="cd">{0}</b> с.', Math.max(0,Math.ceil((S.nextAt-Date.now())/1000)));
    else hint = t('Ждём игроков.');
  } else if(p && !p.inHand){
    hint=t('Вы сядете в игру со следующей раздачи.');
  } else {
    const tp=seats()[S.turn];
    hint = tp ? t('Ходит {0}…', esc(tp.bot?t(tp.name):tp.name)) : t('Сдаём карты…'); minor=true;
  }
  $('hint').innerHTML=hint; $('hint').classList.toggle('minor', minor || !hint);
  applyWatch(); renderKo();
}

let timerBuzz=-1;
setInterval(()=>{
  if(!S) return;
  if(S.deadline>0 && !S.handOver && seatNodes[S.turn]){
    const left=Math.max(0,S.deadline-Date.now());
    seatNodes[S.turn].bar.style.width=(left/TURN_MS*100)+'%';
    if(left<5000 && left>0 && S.seats[S.turn].uid===myUid && timerBuzz!==S.turnId){ timerBuzz=S.turnId; buzz('timer'); }
  }
  const cd=document.getElementById('cd'); if(cd && S.nextAt) cd.textContent=Math.max(0,Math.ceil((S.nextAt-Date.now())/1000));
}, 250);
let resizeRaf=0; // phones fire many resize events while the address bar slides: one redraw per frame is enough
addEventListener('resize', ()=>{ if(S && !resizeRaf) resizeRaf=requestAnimationFrame(()=>{ resizeRaf=0; if(S) render(); }); });

