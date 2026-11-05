/* ---------- phone comforts ---------- */
let wakeLock=null;
async function wantWake(on){
  try{
    if(on && CFG.wake && !document.hidden && navigator.wakeLock && !wakeLock){ wakeLock=await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release',()=>{ wakeLock=null; }); }
    if(!on && wakeLock){ await wakeLock.release(); wakeLock=null; }
  }catch(e){ wakeLock=null; }
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ document.title=t('Покерный стол «Пион»'); wantWake(!!S); } });
let titleT=null;
/* vibration: a different pattern for each event, each one can be switched off */
const VIB = {turn:[90,60,90], win:[40,40,40,40,180], timer:[250,120,250]};
const canVibrate = () => typeof navigator.vibrate==='function';
function buzz(kind){ if(CFG.vibe && CFG.vib[kind] && canVibrate()) try{ navigator.vibrate(VIB[kind]); }catch(e){} }
function myTurnAlert(){
  buzz('turn');
  if(document.hidden){
    clearInterval(titleT); let on=false;
    titleT=setInterval(()=>{ if(!document.hidden){ clearInterval(titleT); document.title=t('Покерный стол «Пион»'); return; } on=!on; document.title = on ? '● '+t('Ваш ход') : t('Покерный стол «Пион»'); }, 900);
    if(CFG.notify && window.Notification && Notification.permission==='granted'){ try{ new Notification(t('Ваш ход'), {body:t('Покерный стол «Пион»'), tag:'pion-turn'}); }catch(e){} }
  }
}
let confirmArm=null;
function needConfirm(type, to){
  if(!CFG.confirm || !S) return false;
  const p=seats()[mySeat()]; if(!p) return false;
  const paid = type==='raise' ? Math.min(+to||0, p.bet+p.stack)-p.bet : type==='call' ? Math.min(S.currentBet-p.bet, p.stack) : 0;
  if(paid<=0 || paid < p.stack*0.5) return false;
  if(confirmArm && confirmArm.type===type && Date.now()-confirmArm.at<3500){ confirmArm=null; return false; }
  confirmArm={type, at:Date.now(), paid}; render(); setTimeout(()=>{ if(confirmArm && Date.now()-confirmArm.at>=3500){ confirmArm=null; render(); } }, 3600);
  return true;
}

let chatDotOn=false;
$('emotes').innerHTML=EMOTES.map(e=>`<button type="button" data-e="${e}">${e}</button>`).join('');
$('emotes').onclick=e=>{ const b=e.target.closest('[data-e]'); if(b) sendEmote(b.dataset.e); };
$('quick').innerHTML=['nh','gg','gl','wp'].map(q=>`<button type="button" data-q="${q}">${q}</button>`).join('');
$('bAway').onclick=()=>{ const i=mySeat(); if(i<0) return; const v=!seats()[i].away; if(MODE==='guest') sendHost({t:'away', v}); else setAway(i, v); };
function openSheet(v){ const a=document.querySelector('aside'); a.classList.toggle('open', v); $('sheetBg').hidden=!v; if(v){ chatDotOn=false; $('chatDot').hidden=true; } }
document.querySelector('aside').id='aside';
$('bPanel').onclick=()=>openSheet(!document.querySelector('aside').classList.contains('open'));
$('sheetBg').onclick=()=>openSheet(false);
$('sheetClose').onclick=()=>openSheet(false);
$('hdrVol').value=Math.round(CFG.vol*100);
$('hdrVol').oninput=e=>{ CFG.vol=(+e.target.value)/100; saveCfg(); if(!snd.on && CFG.vol>0){ snd.on=true; store.set('pion-sound','1'); updSound(); } };
$('hdrVol').onchange=()=>SFX.chip();
$('cfgFour').onchange=e=>{ CFG.four=e.target.checked; saveCfg(); document.documentElement.classList.toggle('fourc', CFG.four); };
$('cfgConfirm').onchange=e=>{ CFG.confirm=e.target.checked; saveCfg(); };
$('cfgTips').onchange=e=>{ CFG.tips=e.target.checked; saveCfg(); oddsKey=''; render(); };
$('cfgSum').onchange=e=>{ CFG.sumbox=e.target.checked; saveCfg(); render(); };
$('cfgVibe').onchange=e=>{ CFG.vibe=e.target.checked; saveCfg(); syncVibUi(); if(CFG.vibe) buzz('turn'); };
document.querySelectorAll('[data-vib]').forEach(el=>el.onchange=()=>{ CFG.vib[el.dataset.vib]=el.checked; saveCfg(); if(el.checked) buzz(el.dataset.vib); });
$('vibTest').onclick=()=>{ const ks=Object.keys(VIB).filter(k=>CFG.vib[k]); ks.forEach((k,n)=>setTimeout(()=>buzz(k), n*1100)); };
function syncVibUi(){
  const ok=canVibrate();
  $('cfgVibe').checked=!!CFG.vibe; $('cfgVibe').disabled=!ok;
  document.querySelectorAll('[data-vib]').forEach(el=>{ el.checked=!!CFG.vib[el.dataset.vib]; el.disabled=!ok || !CFG.vibe; });
  $('vibTest').disabled=!ok || !CFG.vibe; $('vibNote').hidden=ok;
}

/* own cards face down until pressed: a tap shows them for 3 s, holding shows them while held */
const peek={hold:false, until:0, t:0, downAt:0};
function peeking(){ return peek.hold || Date.now()<peek.until; }
function peekOn(e){ const c=e.target.closest('.seat.peekable .cards'); if(!c) return; e.preventDefault(); peek.hold=true; peek.downAt=Date.now(); render(); }
function peekOff(){ if(!peek.hold) return; peek.hold=false; if(Date.now()-peek.downAt<300){ peek.until=Date.now()+3000; clearTimeout(peek.t); peek.t=setTimeout(()=>{ if(S) render(); }, 3050); } render(); }
$('seats').addEventListener('pointerdown', peekOn);
addEventListener('pointerup', peekOff); addEventListener('pointercancel', peekOff);
$('seats').addEventListener('contextmenu', e=>{ if(e.target.closest('.seat.peekable')) e.preventDefault(); });
$('cfgHide').onchange=e=>{ CFG.hideMine=e.target.checked; saveCfg(); peek.until=0; if(S) render(); };
$('cfgWake').onchange=e=>{ CFG.wake=e.target.checked; saveCfg(); wantWake(CFG.wake && !!S); if(!CFG.wake) wantWake(false); };
$('cfgNotify').onchange=async e=>{
  CFG.notify=e.target.checked;
  if(CFG.notify){ if(!window.Notification){ toast(t('Этот браузер не поддерживает уведомления')); CFG.notify=false; } else if(Notification.permission!=='granted'){ const r=await Notification.requestPermission().catch(()=>'denied'); if(r!=='granted'){ CFG.notify=false; toast(t('Уведомления запрещены в браузере')); } } }
  e.target.checked=CFG.notify; saveCfg();
};
$('turnSave').onclick=()=>{ CFG.turn={url:$('turnUrl').value.trim(), user:$('turnUser').value.trim(), pass:$('turnPass').value}; saveCfg(); toast(t('Сохранено. Подействует при следующем подключении')); };
document.documentElement.classList.toggle('fourc', !!CFG.four);
/* remember lobby choices, so starting again is one click */
const LOBBY_IDS=['tableName','botsN','botLvl','stackN','blindMode','bombEvery','bombSize','publicOn','hOn','hOdds','hMade','hDraws','hAdv','soloLvl','soloBlinds','soloBomb','sOn','sOdds','sMade','sDraws','sAdv','soloN','soloRebuy','botRebuy'];
try{ const sv=JSON.parse(localStorage.getItem('pion-lobby')||'{}'); LOBBY_IDS.forEach(id=>{ const el=$(id); if(!el || sv[id]==null) return; if(el.type==='checkbox') el.checked=!!sv[id]; else el.value=sv[id]; }); }catch(e){}
function saveLobby(){ const o={}; LOBBY_IDS.forEach(id=>{ const el=$(id); if(el) o[id]= el.type==='checkbox' ? el.checked : el.value; }); store.set('pion-lobby', JSON.stringify(o)); }
LOBBY_IDS.forEach(id=>$(id)?.addEventListener('change', ()=>{ saveLobby(); syncHelpSets(); }));
function syncHelpSets(){ $('hSet').hidden=!$('hOn').checked; $('sSet').hidden=!$('sOn').checked; }
syncHelpSets();
function showQuick(){
  const last=store.get('pion-last'), b=$('bQuick');
  if(!last || savedHost()){ b.hidden=true; return; }
  b.hidden=false; b.textContent = last==='solo' ? '▶ '+t('Сыграть с ботами, как в прошлый раз') : '▶ '+t('Создать стол, как в прошлый раз');
}
$('bQuick').onclick=()=>{ const last=store.get('pion-last'); if(last==='solo') $('bSolo').click(); else if(last==='create') $('bCreate').click(); };


/* phone menu (☰): profile, learning and settings in big labelled buttons; sound, invite and exit too */
function toggleMenu(v){
  const pop=$('menuPop'), on = v ?? pop.hidden;
  if(on){ $('mCopy').hidden = $('tableChip').hidden || $('bCopy').hidden; $('mExit').hidden = $('bExit').hidden; updSound(); }
  pop.hidden=!on; $('bMenu').setAttribute('aria-expanded', on);
}
$('bMenu').onclick=e=>{ e.stopPropagation(); toggleMenu(); };
$('menuPop').onclick=e=>{ const b=e.target.closest('[data-proxy]'); if(!b) return; const id=b.dataset.proxy; if(id!=='bSound') toggleMenu(false); $(id).click(); if(id==='bSound') updSound(); };
document.addEventListener('click', e=>{ if(!$('menuPop').hidden && !e.target.closest('#menuPop') && !e.target.closest('#bMenu')) toggleMenu(false); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('menuPop').hidden) toggleMenu(false); });
