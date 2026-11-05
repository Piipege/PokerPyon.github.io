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
function myTurnAlert(){
  if(CFG.vibe && navigator.vibrate) try{ navigator.vibrate([90,60,90]); }catch(e){}
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
$('cfgVibe').onchange=e=>{ CFG.vibe=e.target.checked; saveCfg(); if(CFG.vibe && navigator.vibrate) navigator.vibrate(60); };
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

