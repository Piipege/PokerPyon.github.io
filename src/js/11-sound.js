/* ---------- sound (synthesized, off by default) ---------- */
const snd = {on: store.get('pion-sound')==='1', ctx:null};
function actx(){ if(!snd.ctx) snd.ctx=new (window.AudioContext||window.webkitAudioContext)(); if(snd.ctx.state==='suspended') snd.ctx.resume(); return snd.ctx; }
function tone(freq, dur, type='sine', vol=.06, when=0){
  if(!snd.on) return;
  vol*=CFG.vol*1.5;
  try{ const c=actx(), t=c.currentTime+when, o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.05); }catch(e){}
}
function noise(dur, vol=.05, freq=3200, ftype='bandpass'){
  if(!snd.on) return;
  vol*=CFG.vol*1.5;
  try{ const c=actx(), len=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let k=0;k<len;k++) d[k]=(Math.random()*2-1)*Math.pow(1-k/len,2);
    const src=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
    src.buffer=buf; f.type=ftype; f.frequency.value=freq; g.gain.value=vol;
    src.connect(f).connect(g).connect(c.destination); src.start(); }catch(e){}
}
const PACKS = {
  pion:{ card:()=>noise(.14,.06), chip:()=>{ tone(1900,.06,'triangle',.04); tone(2500,.05,'triangle',.03,.04); }, turn:()=>{ tone(660,.18,'sine',.07); tone(990,.28,'sine',.06,.14); }, win:()=>[523,659,784,1046].forEach((f,k)=>tone(f,.32,'triangle',.05,k*.09)), chat:()=>tone(880,.08,'sine',.035) },
  casino:{ card:()=>noise(.08,.09,2200), chip:()=>{ noise(.035,.12,4200,'highpass'); tone(3100,.03,'square',.015); noise(.03,.08,3600,'highpass'); }, turn:()=>{ tone(1320,.5,'sine',.06); tone(1980,.4,'sine',.025,.02); }, win:()=>{ [784,988,1175,1568].forEach((f,k)=>tone(f,.45,'sine',.05,k*.07)); for(let k=0;k<6;k++) setTimeout(()=>noise(.03,.08,4200,'highpass'), 300+k*70); }, chat:()=>tone(1568,.1,'sine',.03) },
  soft:{ card:()=>noise(.2,.035,900,'lowpass'), chip:()=>tone(1200,.09,'sine',.035), turn:()=>{ tone(520,.4,'sine',.05); tone(780,.5,'sine',.04,.18); }, win:()=>[392,494,587,784].forEach((f,k)=>tone(f,.8,'sine',.035,k*.12)), chat:()=>tone(660,.15,'sine',.025) },
  bit:{ card:()=>tone(220,.05,'square',.03), chip:()=>{ tone(1760,.04,'square',.025); tone(2349,.04,'square',.02,.04); }, turn:()=>{ tone(880,.08,'square',.035); tone(1175,.12,'square',.035,.09); }, win:()=>[523,659,784,1046,1319].forEach((f,k)=>tone(f,.09,'square',.03,k*.07)), chat:()=>tone(1319,.05,'square',.02) },
};
const pk = () => PACKS[CFG.pack] || PACKS.pion;
const SFX = { card:()=>pk().card(), chip:()=>pk().chip(), turn:()=>pk().turn(), win:()=>pk().win(), chat:()=>pk().chat() };

for(const [k,cat] of Object.entries({card:'cards',chip:'chips',turn:'turn',win:'win',chat:'chat'})){ const f=SFX[k]; SFX[k]=()=>{ if(CFG.sfx[cat]!==false) f(); }; }
let helpCache={};
function computeHelp(h, b){
  const all=h.concat(b), om=h.length===4; let cat, five=null, fiveCards=null;
  const catOf = extra => bestHand(h, b.concat(extra)).cat;
  if(b.length>=3){ const bs=bestHand(h, b); cat=bs.cat; fiveCards=bs.cards; five=fiveCards.slice().sort((x,y)=>y.r-x.r).map(fmtCard).join(' '); }
  else if(all.length>=5){ const bs=best(all); cat=bs.cat; fiveCards=bs.cards; five=bs.cards.slice().sort((x,y)=>y.r-x.r).map(fmtCard).join(' '); }
  else cat = new Set(h.map(c=>c.r)).size<h.length ? 1 : 0;
  let dist=null, outs=null;
  const known=new Set(all.map(cardKey)), rest=freshDeck().filter(c=>!known.has(cardKey(c)));
  if(b.length<5){
    const need=5-b.length, cnt=new Array(9).fill(0); let n=0;
    if(need===1){ for(const c of rest){ cnt[catOf([c])]++; n++; } }
    else if(need===2 && !om){ for(let i=0;i<rest.length;i++) for(let j=i+1;j<rest.length;j++){ cnt[catOf([rest[i],rest[j]])]++; n++; } }
    else { const r=rest.slice(); for(let k=0;k<(om?400:800);k++){ for(let i=0;i<need;i++){ const j=i+(Math.random()*(r.length-i)|0); [r[i],r[j]]=[r[j],r[i]]; } cnt[catOf(r.slice(0,need))]++; n++; } }
    dist=cnt.map((c,i)=>[i,c/n*100]).filter(x=>x[1]>0).map(([i,pr])=>[i, pr>=10?Math.round(pr):Math.round(pr*10)/10]);
  }
  if(b.length>=3 && b.length<5){
    outs=rest.filter(c=>{ const nb=bestHand(h, b.concat([c])); return nb.cat>cat && nb.cards.some(x=>h.includes(x)); });
  }
  return {cat, five, fiveCards, dist, outs};
}
function highlightMade(cards){
  document.querySelectorAll('.card.mk').forEach(e=>e.classList.remove('mk'));
  if(!cards) return;
  const ks=new Set(cards.map(c=>String(cardKey(c))));
  const i=mySeat(), N=seatNodes[i];
  const els=[...(N?N.cards.querySelectorAll('.card'):[]), ...$('board').querySelectorAll('.card:not(.ghost)')];
  els.forEach(e=>{ if(ks.has(e.dataset.k)) e.classList.add('mk'); });
}
let pre=null, preT=null, oddsKey='', oddsVal=0, statsHtml='';
let chatSeen=new Set(), chatInit=false, prevBets=0, prevMyTurn=false, sfxCard=false;

function winUncontested(){
  const w = live()[0]; const wi = seats().indexOf(w); const pot=potTotal();
  w.stack+=pot; w.won=pot;
  S.canGhost = S.board.length<5 && !!(H.deck && H.deck.length);
  settle();
  seats().forEach(p=>{p.total=0;p.bet=0;});
  S.winFx = {hand:S.handNo, items:[{seat:wi, amount:pot}]};
  S.banner = L('{0} забирает банк {1}', w.name, AM(pot));
  log(L('{0} — банк {1} без вскрытия', w.name, AM(pot)),'win');
  endHand();
}

function showdown(){
  S.street='showdown';
  const contenders = live();
  const sc = new Map();
  contenders.forEach(p=>{ const i=seats().indexOf(p); p.shown=H.hands[i]; fairOpen(p.shown); const b=bestHand(H.hands[i], S.board); sc.set(p,b); p.handName=HAND_NAMES[b.cat]; });
  contenders.forEach(p=>log(L('{0}: {1} — {2}', p.name, p.shown.map(fmtCard).join(' '), p.handName)));

  const levels = [...new Set(contenders.map(p=>p.total))].sort((a,b)=>a-b);
  let prev=0, distributed=0;
  const totalPot = potTotal(); const msgs=[];
  levels.forEach((lvl, li)=>{
    let amount=0;
    seats().forEach(p=>{ amount += Math.max(0, Math.min(p.total,lvl)-prev); });
    const elig = contenders.filter(p=>p.total>=lvl);
    if(li===levels.length-1) amount = totalPot - distributed;
    prev=lvl;
    if(amount<=0) return;
    const top = Math.max(...elig.map(p=>sc.get(p).v));
    const ws = elig.filter(p=>sc.get(p).v===top);
    const share = Math.floor(amount/ws.length/10)*10 || Math.floor(amount/ws.length);
    ws.forEach(w=>{w.stack+=share; w.won+=share;});
    const rem = amount - share*ws.length;
    if(rem>0){ const first = seats()[nextIdx(S.dealer, p=>ws.includes(p))]; first.stack+=rem; first.won+=rem; }
    distributed+=amount;
    const label = levels.length>1 ? (li===0?L('Основной банк'):L('Побочный банк {0}', li)) : L('Банк');
    msgs.push(L('{0} {1}: {2} ({3})', label, AM(amount), ws.map(w=>w.name).join(', '), ws[0].handName));
    log(L('{0} {1} → {2}', label, AM(amount), ws.map(w=>w.name).join(', ')),'win');
  });
  contenders.forEach(p=>{ stOf(p).sd++; if(p.won>0) stOf(p).sdw++; });
  S.winFx = {hand:S.handNo, items:seats().map((p,i)=>({seat:i, amount:p.won})).filter(x=>x.amount>0)};
  S.best = seats().filter(p=>p.won>0).flatMap(p=>{ const b=sc.get(p); return coreCards(b.cards, b.cat); });
  S.banner = msgs;
  settle();
  seats().forEach(p=>{p.total=0;p.bet=0;});
  endHand();
}

function endHand(){
  S.handOver=true; S.turn=-1; S.deadline=0;
  try{ finishRec(); }catch(e){}
  banter();
  scheduleNext();
  commit();
}

function gameOver(title, text){
  S.handOver=true; S.turn=-1; commit();
  $('restart').hidden=false; $('restart').textContent=t('Новая игра');
  $('ovTitle').textContent=title; $('ovText').textContent=text; $('overlay').hidden=false;
}

