/* ---------- appearance extras: felt pattern, chips, seasons, particles, animated background, speed ---------- */
const PATTERNS={none:'Без узора',dots:'Точки',waves:'Волны',diamonds:'Ромбы'};
const CHIPSETS={pion:'Пион',casino:'Казино',neon:'Неон',candy:'Конфетные'};
const SPEEDS={fast:'Быстро',normal:'Обычно',slow:'Медленно'};
const SPEEDF=()=>({fast:.55,normal:1,slow:1.5})[CFG.speed]||1;
const reducedMotion=()=>CFG.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
function denom(v){ const b=(S&&S.bb)||20; return v<b?1: v<5*b?2: v<25*b?3: v<100*b?4:5; }
function currentSeason(){
  if(CFG.season==='off') return null;
  if(CFG.season==='ny'||CFG.season==='spring') return CFG.season;
  const d=new Date(), m=d.getMonth()+1, day=d.getDate();
  if((m===12&&day>=15)||(m===1&&day<=15)) return 'ny';
  if((m===3&&day>=20)||m===4||(m===5&&day<=10)) return 'spring';
  return null;
}
function applyLook2(){
  const d=document.documentElement;
  d.dataset.pat=CFG.pat; d.dataset.chips=CFG.chips; d.dataset.speed=CFG.speed;
  const se=currentSeason(); d.dataset.season=se||'';
  $('bgfx').hidden = !CFG.bgfx || reducedMotion();
  const chipPrev=k=>`<span class="chipprev" data-chipset="${k}">${[1,2,3,4,5].map(n=>`<i class="cp" data-den="${n}"></i>`).join('')}</span>`;
  $('patSeg').innerHTML=Object.entries(PATTERNS).map(([k,v])=>`<button type="button" data-pt="${k}" aria-pressed="${k===CFG.pat}"><i class="swf pat-${k}"></i>${esc(t(v))}</button>`).join('');
  $('chipSeg').innerHTML=Object.entries(CHIPSETS).map(([k,v])=>`<button type="button" data-cs="${k}" aria-pressed="${k===CFG.chips}">${chipPrev(k)}${esc(t(v))}</button>`).join('');
  $('speedSeg').innerHTML=Object.entries(SPEEDS).map(([k,v])=>`<button type="button" data-sp="${k}" aria-pressed="${k===CFG.speed}">${esc(t(v))}</button>`).join('');
  $('cfgSeason').value=CFG.season; $('cfgFx').checked=CFG.fx; $('cfgBg').checked=CFG.bgfx; $('cfgPack').value=CFG.pack;
  pfxWake();
}
document.addEventListener('click', e=>{
  const pt=e.target.closest('[data-pt]'), cs=e.target.closest('[data-cs]'), sp=e.target.closest('[data-sp]');
  if(pt) CFG.pat=pt.dataset.pt; else if(cs) CFG.chips=cs.dataset.cs; else if(sp) CFG.speed=sp.dataset.sp; else return;
  saveCfg(); applyLook2(); if(cs) SFX.chip();
});
$('cfgSeason').onchange=e=>{ CFG.season=e.target.value; saveCfg(); applyLook2(); };
$('cfgFx').onchange=e=>{ CFG.fx=e.target.checked; saveCfg(); if(CFG.fx) burstAt(innerWidth/2, innerHeight/3, 'confetti', 60); };
$('cfgBg').onchange=e=>{ CFG.bgfx=e.target.checked; saveCfg(); applyLook2(); };
$('cfgPack').onchange=e=>{ CFG.pack=e.target.value; saveCfg(); const was=snd.on; snd.on=true; SFX.card(); setTimeout(SFX.chip,220); setTimeout(SFX.turn,480); setTimeout(()=>{ SFX.win(); snd.on=was; },900); };

/* particle layer: snow / petals in season, confetti on big wins, sparks for bomb pots */
const PFX={parts:[], raf:0, last:0, acc:0};
const pcv=$('fxCanvas'), pg=pcv.getContext('2d');
function pfxSize(){ const r=devicePixelRatio||1; pcv.width=innerWidth*r; pcv.height=innerHeight*r; pg.setTransform(r,0,0,r,0,0); }
pfxSize(); addEventListener('resize', pfxSize);
const CONF=['#ff8cc0','#f6b6d4','#ffd86b','#8fe0b5','#9f86ff','#ffffff'];
function burstAt(x,y,kind,n){
  if(reducedMotion()) n=Math.min(n,12);
  for(let k=0;k<n;k++){
    const a=Math.random()*Math.PI*2, v=kind==='spark'? 3+Math.random()*5 : 2+Math.random()*6;
    PFX.parts.push({kind, x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v - (kind==='spark'?1:4), life:0, max: kind==='spark'? 40+Math.random()*25 : 120+Math.random()*80, rot:Math.random()*6, vr:(Math.random()-.5)*.3, c: kind==='spark' ? (Math.random()<.5?'#ffd86b':'#ff9a3c') : kind==='petal' ? (Math.random()<.5?'#ffc4dd':'#ffe0ec') : CONF[k%CONF.length], s: kind==='spark'? 2+Math.random()*2 : 4+Math.random()*4});
  }
  pfxWake();
}
function burstSeat(i, kind, n){ const N=seatNodes[i]; if(!N) return; const r=N.el.getBoundingClientRect(); burstAt(r.left+r.width/2, r.top+r.height/2, kind, n); }
function pfxWake(){ if(!PFX.raf) PFX.raf=requestAnimationFrame(pfxLoop); }
function pfxLoop(ts){
  PFX.raf=0;
  const dt=Math.min(50, ts-(PFX.last||ts)); PFX.last=ts;
  const se=currentSeason(), ambient = se && !reducedMotion() && !document.hidden;
  if(ambient){ PFX.acc+=dt; const every = se==='ny' ? 140 : 260; while(PFX.acc>every){ PFX.acc-=every; if(PFX.parts.length<140) PFX.parts.push({kind: se==='ny'?'snow':'petal', x:Math.random()*innerWidth, y:-10, vx:(Math.random()-.5)*.6, vy: se==='ny'? .6+Math.random()*.9 : .8+Math.random()*.8, life:0, max:2000, rot:Math.random()*6, vr:(Math.random()-.5)*.04, c: se==='ny' ? '#ffffff' : (Math.random()<.5?'#ffc4dd':'#ffe0ec'), s: se==='ny'? 1.5+Math.random()*2.5 : 4+Math.random()*3, sway:Math.random()*6}); } }
  pg.clearRect(0,0,innerWidth,innerHeight);
  const k=dt/16.7;
  PFX.parts=PFX.parts.filter(p=>{
    p.life+=k;
    if(p.kind==='snow'||p.kind==='petal'&&p.max>1000){ p.x+=p.vx*k+Math.sin((p.life+p.sway*20)/40)*.4*k; p.y+=p.vy*k; }
    else { p.vy+= (p.kind==='spark'?.12:.15)*k; p.vx*=.99; p.x+=p.vx*k; p.y+=p.vy*k; }
    p.rot+=p.vr*k;
    if(p.life>p.max || p.y>innerHeight+20) return false;
    const fade = p.max>1000 ? 1 : Math.max(0, 1-p.life/p.max);
    pg.globalAlpha = p.kind==='snow' ? .85 : fade;
    pg.fillStyle=p.c;
    pg.save(); pg.translate(p.x,p.y); pg.rotate(p.rot);
    if(p.kind==='confetti') pg.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);
    else if(p.kind==='petal'){ pg.beginPath(); pg.ellipse(0,0,p.s,p.s*.55,0,0,Math.PI*2); pg.fill(); }
    else { pg.beginPath(); pg.arc(0,0,p.s,0,Math.PI*2); pg.fill(); }
    pg.restore();
    return true;
  });
  pg.globalAlpha=1;
  if(PFX.parts.length || ambient) PFX.raf=requestAnimationFrame(pfxLoop);
  else pg.clearRect(0,0,innerWidth,innerHeight);
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) pfxWake(); });
let bombFxHand=-1;
function celebrate(items){
  if(!CFG.fx || !S) return;
  items.forEach(it=>{
    const s=S.seats[it.seat]; if(!s) return;
    const cat=HAND_NAMES.indexOf(s.handName);
    if(it.amount >= 25*(S.bb||20) || cat>=7) burstSeat(it.seat, currentSeason()==='spring'?'petal':'confetti', cat>=7 ? 140 : 80);
  });
}

const TABLES={pion:{n:'Пион',c:['#7d2552','#4f1233']},lavender:{n:'Лаванда',c:['#8a6fc4','#5b4391','#2e2150','#6a55a0']},sakura:{n:'Сакура',c:['#e38ab5','#b04f84','#5a1f42','#d48aae']},emerald:{n:'Изумруд',c:['#1f8063','#11503f','#0b2a22','#2f6f5c']},midnight:{n:'Полночь',c:['#33467f','#1b2547','#0e1328','#3b4a7a']},cherry:{n:'Вишня',c:['#951e3b','#5e0f22','#2d0710','#6b1a2e']}};
const BACKS={pion:'Пион',lilac:'Лиловый узор',classic:'Классика',stars:'Звёзды',mono:'Минимал'};
const FACES={std:'Обычные',big:'Крупные индексы'};
function applyLook(){
  const d=document.documentElement, T=TABLES[CFG.table]||TABLES.pion;
  ['--felt-hi','--felt','--rim','--rim-hi'].forEach((v,k)=>{ if(CFG.table!=='pion' && T.c[k]) d.style.setProperty(v,T.c[k]); else d.style.removeProperty(v); });
  d.dataset.face=CFG.face;
  document.querySelectorAll('.card.back').forEach(el=>{ if(el.closest('#backSeg')) return; el.className=el.className.replace(/\bbk-\w+/,'bk-'+CFG.back); });
  $('tableSeg').innerHTML=Object.entries(TABLES).map(([k,v])=>`<button type="button" data-tb="${k}" aria-pressed="${k===CFG.table}"><i class="swf" style="background:radial-gradient(circle at 50% 35%,${v.c[0]},${v.c[1]})"></i>${esc(t(v.n))}</button>`).join('');
  $('backSeg').innerHTML=Object.entries(BACKS).map(([k,v])=>`<button type="button" data-bk="${k}" aria-pressed="${k===CFG.back}"><div class="card back bk-${k}"></div>${esc(t(v))}</button>`).join('');
  $('faceSeg').innerHTML=Object.entries(FACES).map(([k,v])=>`<button type="button" data-fc="${k}" aria-pressed="${k===CFG.face}">${esc(t(v))}</button>`).join('');
}
document.addEventListener('click', e=>{
  const tb=e.target.closest('[data-tb]'), bk=e.target.closest('[data-bk]'), fc=e.target.closest('[data-fc]');
  if(tb){ CFG.table=tb.dataset.tb; } else if(bk){ CFG.back=bk.dataset.bk; } else if(fc){ CFG.face=fc.dataset.fc; } else return;
  saveCfg(); applyLook();
});
function applyTheme(){ document.documentElement.dataset.theme=CFG.theme; applyLook(); applyLook2(); document.querySelectorAll('#themeSeg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===CFG.theme)); }
$('themeSeg').onclick=e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; CFG.theme=b.dataset.v; saveCfg(); applyTheme(); };
function applyA11y(){
  const d=document.documentElement;
  if(CFG.fs>1) d.dataset.fs=String(CFG.fs); else delete d.dataset.fs;
  if(CFG.contrast) d.dataset.contrast='1'; else delete d.dataset.contrast;
  d.classList.toggle('calm', !!CFG.calm);
}
$('cfgFs').onchange=e=>{ CFG.fs=+e.target.value; saveCfg(); applyA11y(); seatSig=''; render(); };
$('cfgContrast').onchange=e=>{ CFG.contrast=e.target.checked; saveCfg(); applyA11y(); };
$('cfgCalm').onchange=e=>{ CFG.calm=e.target.checked; saveCfg(); applyA11y(); applyLook2(); };
$('cfgBB').onchange=e=>{ CFG.bb=e.target.checked; saveCfg(); potShown=-1; render(); };
$('cfgDelay').onchange=e=>{ CFG.delay=+e.target.value; saveCfg(); };
$('cfgSound').onchange=e=>{ snd.on=e.target.checked; store.set('pion-sound', snd.on?'1':'0'); updSound(); };
$('cfgVol').oninput=e=>{ CFG.vol=(+e.target.value)/100; saveCfg(); };
$('cfgVol').onchange=()=>SFX.turn();
document.querySelectorAll('[data-sfx]').forEach(cb=>cb.onchange=()=>{ CFG.sfx[cb.dataset.sfx]=cb.checked; saveCfg(); });
$('sndTest').onclick=()=>{ const was=snd.on; snd.on=true; SFX.card(); setTimeout(SFX.chip,250); setTimeout(SFX.turn,550); setTimeout(SFX.win,1000); setTimeout(()=>{ snd.on=was; },1800); };

function renderRebind(){
  $('rebindList').innerHTML=Object.keys(DEF_KEYS).map(a=>`<dt><button type="button" class="btn small keybtn${rebinding===a?' wait':''}" data-act="${a}">${rebinding===a?t('Нажмите клавишу…'):esc(keyLabel(CFG.keys[a]))}</button></dt><dd>${t(KEY_DESC[a])}</dd>`).join('');
}
$('rebindList').onclick=e=>{ const b=e.target.closest('[data-act]'); if(!b) return; rebinding = rebinding===b.dataset.act ? null : b.dataset.act; renderRebind(); };
$('keysReset').onclick=()=>{ CFG.keys={...DEF_KEYS}; saveCfg(); buildKeyMap(); applyKeyBadges(); renderRebind(); toast(t('Клавиши как по умолчанию')); };
document.addEventListener('keydown', e=>{
  if(!rebinding) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(e.key==='Escape'){ rebinding=null; renderRebind(); return; }
  if(/^(Shift|Control|Alt|Meta|OS|CapsLock|Fn)/.test(e.code) || !e.code) return;
  const a=rebinding, old=CFG.keys[a];
  const other=Object.keys(CFG.keys).find(k=>k!==a && CFG.keys[k]===e.code);
  if(other) CFG.keys[other]=old;
  CFG.keys[a]=e.code; rebinding=null;
  saveCfg(); buildKeyMap(); applyKeyBadges(); renderRebind();
  if(other) toast(t('«{0}» была у другого действия — поменял их местами', keyLabel(e.code)));
}, true);

function renderSettings(){
  renderAvEditor(); applyTheme();
  $('cfgFs').value=String(CFG.fs); $('cfgContrast').checked=CFG.contrast; $('cfgCalm').checked=CFG.calm;
  $('cfgBB').checked=CFG.bb; $('cfgDelay').value=String(CFG.delay);
  $('cfgSound').checked=snd.on; $('cfgVol').value=Math.round(CFG.vol*100); $('hdrVol').value=Math.round(CFG.vol*100);
  $('cfgFour').checked=!!CFG.four; $('cfgTips').checked=!!CFG.tips; $('cfgSum').checked=!!CFG.sumbox; $('cfgConfirm').checked=!!CFG.confirm; $('cfgHide').checked=!!CFG.hideMine; syncVibUi(); $('cfgNotify').checked=!!CFG.notify; $('cfgWake').checked=!!CFG.wake;
  $('turnUrl').value=CFG.turn.url; $('turnUser').value=CFG.turn.user; $('turnPass').value=CFG.turn.pass;
  document.querySelectorAll('[data-sfx]').forEach(cb=>cb.checked=CFG.sfx[cb.dataset.sfx]!==false);
  renderRebind();
}

/* lobby tabs */
// main menu: four tiles; a tile opens its section, «Back» returns to the tiles
const lobbyTab = wireTabs('[data-ltab]','data-ltab','data-lpane',$('lobby'), v=>{ $('lobby').querySelector('.lobbybox').dataset.view=v; });
lobbyTab('home');
$('lobbyBack').onclick=()=>lobbyTab('home');
$('tables').onclick=e=>{ const b=e.target.closest('button[data-code]'); if(b && !b.disabled && checkNick()){ saveNick(); joinTable(b.dataset.code); } };
$('lobbyAva').innerHTML=avatarSVG(CFG.av);
applyTheme();

