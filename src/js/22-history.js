/* ---------- hand records: history, summary, replay, evening results ---------- */
let HIST=[]; const SESS=[];
try{ HIST=JSON.parse(localStorage.getItem('pion-hist')||'[]')||[]; }catch(e){ HIST=[]; }
function recStart(){
  H.rec={no:S.handNo, sb:S.sb, bb:S.bb, bomb:!!S.bomb, at:Date.now(), dealer:seats()[S.dealer]?.uid,
    seats:seats().filter(p=>p.inHand).map(p=>({u:p.uid, n:p.name, b:!!p.bot, st:p.stack})), ev:[], shown:{}};
}
function recEv(i, a, paid=0, to=0, cards=null, ai=false){
  if(!H.rec) return;
  const e={a, u: i>=0 ? seats()[i].uid : null, p:paid, to};
  if(cards) e.c=cards.map(cardKey);
  if(ai) e.ai=1;
  H.rec.ev.push(e);
}
function finishRec(){
  const r=H.rec; if(!r || r.done) return; r.done=true;
  r.board=S.board.map(cardKey);
  r.win=seats().filter(p=>p.won>0).map(p=>({u:p.uid, amt:p.won, hn:p.shown?p.handName:''}));
  r.pot=r.win.reduce((a,w)=>a+w.amt,0);
  r.delta={}; seats().forEach(p=>{ if(p.inHand) r.delta[p.uid]=p._delta||0; });
  seats().forEach(p=>{ if(p.shown && p.inHand) r.shown[p.uid]={c:p.shown.map(cardKey), hn:p.handName}; });
  const pub=JSON.parse(JSON.stringify(r)); delete pub.done;
  if(MODE==='host') for(const c of conns.values()){ try{ if(c.open) c.send({t:'hist', rec:pub}); }catch(e){} }
  const mi=mySeat();
  histAdd({...pub, mine: mi>=0 && H.hands[mi] ? H.hands[mi].map(cardKey) : null});
}
function histAdd(rec){
  if(!rec || HIST.some(h=>h.no===rec.no && h.at===rec.at)) return;
  HIST.push(rec); if(HIST.length>20) HIST.splice(0, HIST.length-20);
  SESS.push(rec);
  try{ localStorage.setItem('pion-hist', JSON.stringify(HIST)); }catch(e){}
  renderHandList();
  profileSave([rec]);
}
const keyCard = k => ({r:Math.floor(k/4), s:k%4});
const nameOf = (rec,u) => { const s=rec.seats.find(x=>x.u===u); return s ? (s.b?t(s.n):s.n) : '—'; };
function renderHandList(){
  const ul=$('handList'); if(!ul) return;
  ul.innerHTML = HIST.slice().reverse().map((r,k)=>{
    const w=r.win&&r.win[0];
    const label = w ? t('{0} +{1}', nameOf(r,w.u), fmtWin(w.amt, r.bb)) + (w.hn?' · '+t(w.hn):'') : '';
    const ix=HIST.length-1-k, rev=r.mine && r.seats.some(s=>s.u===myUid);
    return `<li class="hli"><button type="button" class="hrow" data-rp="${ix}"><span class="hno">№${r.no}</span><span>${esc(label)}</span><span class="hgo">▶</span></button>${rev?`<button type="button" class="hcoach" data-coach="${ix}" title="${esc(t('Разбор с тренером'))}" aria-label="${esc(t('Разбор с тренером'))}">🎓</button>`:''}</li>`;
  }).join('') || `<li class="empty">${t('Здесь появятся сыгранные раздачи')}</li>`;
}
function renderSummary(){
  const box=$('sumBox'); if(!box) return;
  const r=HIST[HIST.length-1];
  if(!CFG.sumbox || !S || !S.handOver || !r || r.no!==S.handNo || sumClosed===r.no){ box.hidden=true; return; }
  const rows=(r.win||[]).map(w=>{
    const sh=r.shown[w.u];
    return `<div class="srow2"><b class="win">🏆 ${esc(nameOf(r,w.u))} +${esc(fmtWin(w.amt, r.bb))}</b>${w.hn?`<span>${esc(t(w.hn))}</span>`:`<span class="muted">${t('без вскрытия')}</span>`}${sh?`<span class="mini">${sh.c.map(k=>fmtCard(keyCard(k))).join(' ')}</span>`:''}</div>`;
  }).join('') + Object.entries(r.shown).filter(([u])=>!(r.win||[]).some(w=>w.u===u)).map(([u,sh])=>`<div class="srow2 other"><span>${esc(nameOf(r,u))}</span><span>${esc(t(sh.hn))}</span><span class="mini">${sh.c.map(k=>fmtCard(keyCard(k))).join(' ')}</span></div>`).join('');
  box.innerHTML=`<div class="sumhead"><b>${t('Итоги раздачи №{0}', r.no)}</b><span class="row">${r.mine?`<button type="button" class="btn small" data-sum="coach">${t('Разбор')}</button>`:''}<button type="button" class="btn small" data-sum="replay">${t('Повтор')}</button><button type="button" class="btn small ghost" data-sum="close" aria-label="${t('Закрыть')}">✕</button></span></div>${rows}`;
  box.hidden=false;
}
let sumClosed=-1;
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-sum]'); if(b){ if(b.dataset.sum==='close'){ sumClosed=HIST[HIST.length-1]?.no; renderSummary(); } else if(b.dataset.sum==='coach') openCoach(HIST.length-1); else openReplay(HIST.length-1); return; }
  const c=e.target.closest('[data-coach]'); if(c){ openCoach(+c.dataset.coach); return; }
  const h=e.target.closest('[data-rp]'); if(h) openReplay(+h.dataset.rp);
});

/* replay */
let RP={i:-1, k:0, timer:null};
function openReplay(i){ if(!HIST[i]) return; RP={i, k:0, timer:null}; $('replayOv').hidden=false; renderReplay(); }
function closeReplay(){ clearInterval(RP.timer); RP.timer=null; $('replayOv').hidden=true; }
function replayAt(r,k){
  const st={}; r.seats.forEach(s=>st[s.u]={stack:s.st, bet:0, last:'', folded:false, won:0});
  let board=[], text='', pot=0;
  const n=Math.min(k, r.ev.length);
  for(let j=0;j<n;j++){
    const e=r.ev[j], p=e.u?st[e.u]:null, nm=e.u?nameOf(r,e.u):'';
    if(e.a==='street'){ Object.values(st).forEach(x=>{ pot+=x.bet; x.bet=0; if(!x.folded && x.last!=='Олл-ин') x.last=''; }); board=e.c.map(keyCard); text=t('{0}: {1}', {3:'Флоп',4:'Тёрн',5:'Ривер'}[board.length], board.map(fmtCard).join(' ')); continue; }
    if(!p) continue;
    p.stack-=e.p; p.bet+=e.p;
    const AI=e.ai?' (олл-ин)':'';
    if(e.a==='sb'){ p.last='SB'; text=t('{0}: малый блайнд {1}', nm, e.p); }
    else if(e.a==='bb'){ p.last='BB'; text=t('{0}: большой блайнд {1}', nm, e.p); }
    else if(e.a==='ante'){ p.last='Бомб-пот'; text=t('{0}: ставит {1} в бомб-пот', nm, e.p); }
    else if(e.a==='fold'){ p.folded=true; p.last='Пас'; text=t('{0}: пас', nm); }
    else if(e.a==='check'){ p.last='Чек'; text=t('{0}: чек', nm); }
    else if(e.a==='call'){ p.last=e.ai?'Олл-ин':'Колл'; text=t('{0}: колл {1}'+AI, nm, e.p); }
    else if(e.a==='bet'){ p.last=e.ai?'Олл-ин':'Бет'; text=t('{0}: бет {1}'+AI, nm, e.to); }
    else if(e.a==='raise'){ p.last=e.ai?'Олл-ин':'Рейз'; text=t('{0}: рейз до {1}'+AI, nm, e.to); }
  }
  pot+=Object.values(st).reduce((a,x)=>a+x.bet,0);
  const end = k>r.ev.length;
  if(end){ (r.win||[]).forEach(w=>{ if(st[w.u]){ st[w.u].stack+=w.amt; st[w.u].won=w.amt; } }); board=(r.board||[]).map(keyCard); text=(r.win||[]).map(w=>t('{0} забирает банк {1}', nameOf(r,w.u), fmtWin(w.amt, r.bb))).join(' · '); pot=0; Object.values(st).forEach(x=>x.bet=0); }
  return {st, board, text, pot, end};
}
function renderReplay(){
  const r=HIST[RP.i]; if(!r) return;
  const total=r.ev.length+1, k=Math.max(0,Math.min(RP.k,total));
  const R=replayAt(r,k);
  const mine=r.mine?r.mine.map(keyCard):null;
  const rows=r.seats.map(s=>{
    const x=R.st[s.u], me=s.u===myUid;
    const cards = me&&mine ? mine : (R.end || true) && r.shown[s.u] ? r.shown[s.u].c.map(keyCard) : null;
    return `<div class="rprow${x.folded?' folded':''}${x.won?' won':''}"><span class="rpn">${esc(s.b?t(s.n):s.n)}${s.u===r.dealer?' <i class="dl2">D</i>':''}</span><span class="rpc">${cards?cards.map(c=>cardHTML(c)).join(''):'<span class="muted">· ·</span>'}</span><span class="rpst">${esc(fmt(x.stack))}</span><span class="rpb">${x.bet?esc(fmt(x.bet)):''}${x.won?`<b class="win">+${esc(fmt(x.won))}</b>`:''}</span><span class="rpl">${esc(t(x.last))}</span></div>`;
  }).join('');
  $('replayBody').innerHTML=`<div class="rphead"><b>${t('Повтор раздачи №{0}', r.no)}</b><span class="muted">${t('Блайнды')} ${r.sb}/${r.bb}${r.bomb?' · '+t('Бомб-пот'):''}</span></div>
    <div class="scene rpboard"><div class="sblock"><span class="slabel">${t('Стол')}</span><div class="srow">${[0,1,2,3,4].map(j=>R.board[j]?cardHTML(R.board[j]):'<div class="slot"></div>').join('')}</div></div><div class="sblock"><span class="slabel">${t('Банк')}</span><b class="rppot">${esc(fmt(R.pot))}</b></div></div>
    <div class="rprows">${rows}</div><p class="rptext">${esc(R.text||t('Раздача начинается'))}</p>
    <div class="rpbar"><i style="width:${Math.round(k/total*100)}%"></i></div>`;
  $('rpPlay').textContent = RP.timer ? '⏸' : '▶';
}
function rpStep(d){ const r=HIST[RP.i]; if(!r) return; RP.k=Math.max(0,Math.min(r.ev.length+1, RP.k+d)); if(RP.k>=r.ev.length+1){ clearInterval(RP.timer); RP.timer=null; } renderReplay(); }
$('rpFirst').onclick=()=>{ RP.k=0; renderReplay(); };
$('rpPrev').onclick=()=>rpStep(-1);
$('rpNext').onclick=()=>rpStep(1);
$('rpLast').onclick=()=>{ RP.k=1e9; rpStep(0); };
$('rpPlay').onclick=()=>{ if(RP.timer){ clearInterval(RP.timer); RP.timer=null; } else { if(RP.k>=(HIST[RP.i]?.ev.length||0)+1) RP.k=0; RP.timer=setInterval(()=>rpStep(1), 1100); } renderReplay(); };
$('rpClose').onclick=closeReplay;
$('rpCopy').onclick=()=>{
  const r=HIST[RP.i]; if(!r) return;
  const lines=[t('Раздача №{0}', r.no)+` · ${r.sb}/${r.bb}`];
  for(let k=1;k<=r.ev.length+1;k++){ const x=replayAt(r,k).text; if(x && x!==lines[lines.length-1]) lines.push(x); }
  if(r.mine) lines.splice(1,0,t('Ваши карты: {0}', r.mine.map(c=>fmtCard(keyCard(c))).join(' ')));
  const txt=lines.join('\n');
  try{ navigator.clipboard.writeText(txt).then(()=>toast(t('Раздача скопирована')),()=>toast(t('Не получилось скопировать'))); }catch(e){}
};
$('replayOv').addEventListener('click', e=>{ if(e.target.id==='replayOv') closeReplay(); });

/* evening results */
function sessionData(){
  const P={};
  for(const r of SESS){
    r.seats.forEach(s=>{ const p=P[s.u]||(P[s.u]={name:s.b?t(s.n):s.n, hands:0, wins:0, net:0, best:0, allin:0, folds:0}); p.hands++; p.net+=(r.delta&&r.delta[s.u])||0; });
    (r.win||[]).forEach(w=>{ const p=P[w.u]; if(p){ p.wins++; p.best=Math.max(p.best,w.amt); } });
    r.ev.forEach(e=>{ const p=P[e.u]; if(!p) return; if(e.ai) p.allin++; if(e.a==='fold') p.folds++; });
  }
  const list=Object.values(P).sort((a,b)=>b.net-a.net);
  const by=(f)=>list.length?list.reduce((a,b)=>f(b)>f(a)?b:a):null;
  const facts=[];
  if(list.length){
    const big=SESS.reduce((a,r)=>!a||r.pot>a.pot?r:a,null);
    if(big && big.win && big.win[0]) facts.push(t('Самый большой банк: {0} — {1} (раздача №{2})', nameOf(big,big.win[0].u), big.pot, big.no));
    const w=by(p=>p.wins); if(w&&w.wins) facts.push(t('Больше всех выигранных банков: {0} ({1})', w.name, w.wins));
    const a=by(p=>p.allin); if(a&&a.allin) facts.push(t('Самый смелый: {0} — олл-инов: {1}', a.name, a.allin));
    const f=by(p=>p.hands?p.folds/p.hands:0); if(f&&f.folds) facts.push(t('Самый осторожный: {0} — пасов: {1}', f.name, f.folds));
  }
  return {list, facts};
}
// my own evening: from the hands of this visit (SESS) where I had cards
function myRecap(){
  const recs=SESS.filter(r=>r.mine && r.seats.some(s=>s.u===myUid)); if(!recs.length) return null;
  const R={h:recs.length, net:0, wins:0, big:0, bigBB:0, bestCat:-1, bestCards:null, acc:null};
  let aS=0, aN=0;
  recs.forEach((r,k)=>{
    const s=summarize(r); if(!s) return;
    R.net+=s.net;
    if(s.won>0){ R.wins++; if(s.won>R.big){ R.big=s.won; R.bigBB=Math.round(s.won/(s.bb||20)); } }
    if((s.sdw || s.won>0) && s.cat>R.bestCat){ R.bestCat=s.cat; R.bestCards=bestHand(r.mine.map(keyCard), (r.board||[]).map(keyCard)).cards; }
    if(k>=recs.length-40){ const a=accOf(r); if(a>=0){ aS+=a; aN++; } }
  });
  if(aN) R.acc=Math.round(aS/aN*100);
  return R;
}
let sessAutoAt=0;
function openSession(){
  const {list,facts}=sessionData(), me=myRecap();
  const tile=(l,v,cls='')=>`<div class="ptile"><span class="slabel">${esc(t(l))}</span><b class="${cls}">${esc(v)}</b></div>`;
  const mine = me ? `<section class="myeve"><h5>${t('Ваш вечер')}</h5><div class="ptiles">${[
      tile('Раздач', String(me.h)), tile('Итог', (me.net>0?'+':'')+me.net, me.net>0?'win':me.net<0?'loss':''), tile('Выиграно банков', String(me.wins)),
      tile('Крупнейший банк', me.big?`${me.big} · ${me.bigBB} BB`:'—'), tile('Лучшая комбинация', me.bestCat>=0?t(HAND_NAMES[me.bestCat]):'—'), tile('Точность решений', me.acc==null?'—':me.acc+'%')].join('')}</div>
      ${me.bestCards?`<div class="srow">${me.bestCards.map(c=>cardHTML(c)).join('')}</div>`:''}</section>` : '';
  $('sessBody').innerHTML = mine + (list.length ? `<div class="statwrap"><table class="stats"><thead><tr><th>${t('Игрок')}</th><th>${t('Раздач')}</th><th>${t('Выиграно банков')}</th><th>${t('Итог')}</th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.hands}</td><td>${p.wins}</td><td class="${p.net>0?'win':p.net<0?'loss':''}">${p.net>0?'+':''}${p.net}</td></tr>`).join('')}</tbody></table></div>${facts.length?`<ul class="facts">${facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}` : `<p class="hint">${t('Сыграйте хотя бы одну раздачу.')}</p>`);
  $('sessShare').hidden = !(navigator.share && navigator.canShare);
  $('sessOv').hidden=false;
  sessAutoAt=SESS.length;
}
// after a table, show the recap once if it was a real evening (5+ hands)
function maybeRecap(){ const me=myRecap(); if(me && me.h>=5 && SESS.length!==sessAutoAt) setTimeout(openSession, 400); }

// a picture of the evening, 1080×1350 (fits phone galleries and messengers)
function recapCanvas(){
  const {list,facts}=sessionData(), me=myRecap(), W=1080, H=1350, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d'), F=(w,s,f)=>`${w} ${s}px ${f==='d'?'Unbounded':f==='n'?'"JetBrains Mono"':'Onest'}, "Noto Sans Georgian", "Noto Sans Hebrew", sans-serif`;
  const rtl = LANG==='he'; g.direction = rtl ? 'rtl' : 'ltr'; const X = x => rtl ? W-x : x; g.textAlign = rtl ? 'right' : 'left';
  const grd=g.createLinearGradient(0,0,W,H); grd.addColorStop(0,'#5a1438'); grd.addColorStop(.55,'#2a0c1e'); grd.addColorStop(1,'#170912'); g.fillStyle=grd; g.fillRect(0,0,W,H);
  g.fillStyle='#ff8cc0'; g.font=F(700,30,'d'); g.fillText('PyonPoker', X(72), 96);
  g.fillStyle='#fff3f8'; g.font=F(700,58,'d'); g.fillText(t('Мой вечер'), X(72), 176);
  g.fillStyle='#c49ab4'; g.font=F(500,30); g.fillText(`${myName()} · ${fmtDate(Date.now())}`, X(72), 226);
  const round=(x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  let y=280;
  if(me){
    const tiles=[[t('Итог'), (me.net>0?'+':'')+me.net, me.net>0?'#8fe0b5':me.net<0?'#ff8fa8':'#fff3f8'], [t('Раздач'), String(me.h)], [t('Выиграно банков'), String(me.wins)], [t('Точность решений'), me.acc==null?'—':me.acc+'%']];
    tiles.forEach(([l,v,col],k)=>{ const x=72+(k%2)*476, ty=y+Math.floor(k/2)*170; g.fillStyle='#ffffff12'; round(x,ty,452,146,24); g.fill();
      g.fillStyle='#c49ab4'; g.font=F(600,24); g.fillText(l.toUpperCase(), rtl?x+452-28:x+28, ty+48); g.fillStyle=col||'#fff3f8'; g.font=F(700,56,'n'); g.fillText(v, rtl?x+452-28:x+28, ty+116); });
    y+=360;
    if(me.bestCards){
      g.fillStyle='#c49ab4'; g.font=F(600,24); g.fillText(t('Лучшая комбинация').toUpperCase(), X(72), y+20);
      g.fillStyle='#fff3f8'; g.font=F(700,36,'d'); g.fillText(t(HAND_NAMES[me.bestCat]), X(72), y+68);
      me.bestCards.slice().sort((a,b)=>b.r-a.r).forEach((c,k)=>{ const cx=72+k*126, cy=y+96; g.fillStyle='#fff3f8'; round(rtl?W-cx-110:cx,cy,110,150,14); g.fill();
        g.fillStyle = c.s===1||c.s===2 ? '#b0164a' : '#2a0d1f'; g.textAlign='left'; g.font=F(700,46,'n'); g.fillText(RL[c.r]||String(c.r), (rtl?W-cx-110:cx)+14, cy+56); g.font=F(500,52); g.fillText(SUITS[c.s], (rtl?W-cx-110:cx)+52, cy+130); g.textAlign = rtl ? 'right' : 'left'; });
      y+=290;
    }
  }
  if(list.length){
    g.fillStyle='#c49ab4'; g.font=F(600,24); g.fillText(t('Стол').toUpperCase(), X(72), y+10); y+=56;
    list.slice(0,5).forEach((p,k)=>{ g.fillStyle=k===0?'#ffd86b':'#fff3f8'; g.font=F(600,32); g.fillText(`${k+1}. ${p.name}`, X(72), y);
      g.font=F(700,32,'n'); g.fillStyle=p.net>0?'#8fe0b5':p.net<0?'#ff8fa8':'#fff3f8'; g.textAlign = rtl ? 'left' : 'right'; g.fillText((p.net>0?'+':'')+p.net, rtl?72:W-72, y); g.textAlign = rtl ? 'right' : 'left'; y+=52; });
  }
  if(facts[0] && y<H-120){ g.fillStyle='#f6b6d4'; g.font=F(500,26); g.fillText(facts[0].slice(0,60), X(72), Math.min(H-110, y+30)); }
  g.fillStyle='#c49ab4'; g.font=F(500,24); g.fillText('piipege.github.io/PokerPyon.github.io', X(72), H-60);
  return cv;
}
function recapBlob(){ return new Promise(res=>recapCanvas().toBlob(res, 'image/jpeg', .9)); } // JPEG: ~10× smaller than PNG for messengers
function sessionText(){ const {list,facts}=sessionData(); return [t('Итоги вечера — «PyonPoker»'), ...list.map((p,k)=>`${k+1}. ${p.name}: ${p.net>0?'+':''}${p.net} (${t('раздач')}: ${p.hands}, ${t('банков')}: ${p.wins})`), '', ...facts].join('\n'); }
$('bSession').onclick=openSession;
$('sessClose').onclick=()=>$('sessOv').hidden=true;
$('sessOv').addEventListener('click', e=>{ if(e.target.id==='sessOv') $('sessOv').hidden=true; });
$('sessCopy').onclick=()=>{ try{ navigator.clipboard.writeText(sessionText()).then(()=>toast(t('Итоги скопированы')),()=>toast(t('Не получилось скопировать'))); }catch(e){} };
$('sessImg').onclick=async()=>{ const b=await recapBlob(); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='pyonpoker-my-evening.jpg'; document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); };
$('sessShare').onclick=async()=>{ try{ const b=await recapBlob(), f=new File([b], 'pyonpoker-my-evening.jpg', {type:'image/jpeg'}); if(navigator.canShare({files:[f]})) await navigator.share({files:[f], title:t('Мой вечер'), text:sessionText().split('\n').slice(0,3).join('\n')}); else $('sessImg').click(); }catch(e){} };

