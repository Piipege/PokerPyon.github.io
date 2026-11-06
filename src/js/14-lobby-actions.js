/* ---------- lobby actions ---------- */
function myName(){ return cleanName($('nick').value); }
function setLobbyErr(t){ $('lobbyErr').textContent=t; }
function genCode(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b=new Uint32Array(4); crypto.getRandomValues(b); return [...b].map(x=>A[x%A.length]).join(''); }

function startSolo(opts){
  clearFlow(); stopNet();
  MODE='offline'; code=null;
  S = mkState(1000); applyOpts('solo');
  if(opts && opts.coach){ S.game='holdem'; S.ko=false; S.coach=true; S.botRebuy=true; S.help=true; S.hMade=true; S.hDraws=true; S.hAdvice=true; S.bombEvery=0; S.blindEvery=0; S.banner='Тренировка: после каждого вашего решения тренер даст подсказку'; }
  S.seats = [mkSeat({uid:myUid,name:myName()==='Игрок'?'Вы':myName(),av:{...CFG.av},pf:mySummary(),stack:1000,out:false}), ...BOTS.slice(0,+$('soloN').value||4).map((b,k)=>mkSeat({...b,uid:'bot'+k,bot:true,lvl:(opts&&opts.coach?1:botLevel(k,'soloLvl')),stack:1000,out:false}))];
  S.started=true;
  $('lobby').hidden=true; resetView(); startHand();
}

function exitToLobby(silent){
  try{ openSheet(false); closeReplay(); wantWake(false); }catch(e){}
  if(MODE==='host' && S && S.public && code) lobbyUnreg(code);
  if(MODE==='guest' && !silent){ sendHost({t:'leave'}); forgetGuest(); }
  if(MODE==='host'){
    for(const c of conns.values()){ try{ c.send({t:'closed'}); }catch(e){} }
    try{ localStorage.removeItem('pion-host'); }catch(e){}
  }
  clearFlow();
  const wasHost = MODE==='host';
  setTimeout(stopNet, wasHost ? 400 : 0);
  MODE='lobby'; S=null; code=null; myCards=null; pending=null;
  setHash('');
  { const sub=document.querySelector('h1 .sub'); if(sub) sub.textContent=t('Техасский холдем'); }
  $('overlay').hidden=true; $('lobby').hidden=false; resetView(); render(); renderGuestNet(); showResume();
  maybeRecap();
}

function setHash(c){
  try{ history.replaceState(null,'', c ? '#t-'+c.toLowerCase() : location.pathname+location.search); }
  catch(e){ try{ location.hash = c ? 't-'+c.toLowerCase() : ''; }catch(_){} }
}
function inviteLink(){ return location.protocol.startsWith('http') ? location.href.split('#')[0]+'#t-'+code.toLowerCase() : ''; }

let toastT=null;
function toast(msg, ms=3400){ document.querySelectorAll('.toast').forEach(e=>e.remove()); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.append(el); clearTimeout(toastT); toastT=setTimeout(()=>el.remove(), ms); }

