/* ---------- human input ---------- */
function myTurn(){ const i=mySeat(); return !!S && !S.handOver && i>=0 && S.turn===i && pending===null && MODE!=='lobby'; }
function raiseBounds(){
  const p=seats()[mySeat()];
  const max = maxRaiseTo(mySeat());
  const min = Math.min(max, S.currentBet===0 ? S.bb : S.currentBet+S.minRaise);
  return {min,max};
}
function setAmt(v){ if(!myTurn()) return; const {min,max}=raiseBounds(); v=Math.max(min,Math.min(max,v)); $('amt').value=v; $('amtOut').textContent=fmt(v); }
async function human(type, sure){
  if(!myTurn()) return;
  const to = +$('amt').value;
  if(!sure && needConfirm(type, to)) return;
  confirmArm=null;
  if(MODE==='guest'){
    if(sendHost({t:'act', turnId:S.turnId, type, to})){ pending=S.turnId; render(); }
    else toast(t('Нет связи с ведущим. Переподключаемся…'));
  } else { coachTip(mySeat(), type); act(mySeat(), type, to); }
}
$('bFold').onclick=()=>human('fold');
$('bCall').onclick=()=>human('call');
$('bRaise').onclick=()=>human('raise');
$('bNext').onclick=()=>{
  if(!S) return;
  if(MODE==='host' && !S.started){ S.started=true; S.banner=''; log('Игра началась','sep'); startHand(); lobbyReg(); return; }
  if(isDealer() && S.handOver){ clearFlow(); if(S.paused){ S.paused=false; log('Игра продолжается','sep'); } startHand(); }
};
$('bGhost').onclick=()=>{ if(MODE==='guest') sendHost({t:'ghost'}); else ghostRun(); };
$('bPause').onclick=()=>togglePause();
$('bWait').onclick=()=>{ if(sendHost({t:'wait'})) toast(t('Попросили ведущего подождать')); };
$('nick').addEventListener('change', ()=>{ saveNick(); });
$('bRebuy').onclick=()=>{
  const i=mySeat(); if(i<0) return;
  if(MODE==='host') doRebuy(i);
  else if(MODE==='guest'){ if(sendHost({t:'rebuy'})) toast(t('Фишки придут к следующей раздаче')); }
};
$('amt').oninput=e=>{ $('amtOut').textContent=fmt(+e.target.value); };
$('pHalf').onclick=()=>setAmt(round10(S.currentBet + potTotal()/2));
$('pPot').onclick=()=>setAmt(round10(S.currentBet + potTotal() + (S.currentBet-seats()[mySeat()].bet)));
$('pAll').onclick=()=>setAmt(raiseBounds().max);
$('restart').onclick=()=>{ $('overlay').hidden=true; if(S && S.ko && MODE==='host'){ koRestart(); return; } startSolo(S&&S.coach?{coach:true}:undefined); };
$('bSolo').onclick=()=>{ saveNick(); startSolo(); };
$('bCreate').onclick=()=>{ if(!checkNick()) return; saveNick(); createTable(); };
$('bJoin').onclick=()=>{ if(!checkNick()) return; saveNick(); joinTable($('joinCode').value); };
$('joinCode').addEventListener('keydown',e=>{ if(e.key==='Enter') $('bJoin').click(); });
$('bExit').onclick=()=>{
  if(MODE==='host' && seats().some(s=>!s.bot && s.uid!==myUid && !s.left && !s.offline) && Date.now()-closeArm>4000){
    closeArm=Date.now(); toast(t('Нажмите ещё раз, чтобы закрыть стол для всех')); return;
  }
  exitToLobby();
};
$('bCopy').onclick=()=>{
  const link=inviteLink();
  const msg = link ? t('Садись за мой покерный стол «Пион»: {0}', link) : t('Садись за мой покерный стол «Пион». Код стола: {0}', code);
  try{ navigator.clipboard.writeText(msg).then(()=>toast(t(link?'Ссылка-приглашение скопирована':'Код скопирован')),()=>toast(t('Код стола: {0}', code))); }catch(e){ toast(t('Код стола: {0}', code)); }
};
$('bResume').onclick=()=>{ const r=savedHost(); if(r){ saveNick(); createTable(r); return; } const g=savedGuest(); if(g){ if(!checkNick()) return; saveNick(); joinTable(g.code); } };
function botLevel(k,sel){ const v=+$(sel).value; return v || [2,3,1,4][k%4]; }
function applyOpts(kind){
  store.set('pion-last', kind);
  // game and format: Hold'em or Omaha (pot-limit); regular (rebuys) or knockout (no rebuys, last one wins)
  const pre = kind==='solo' ? 'solo' : 'tbl';
  S.game = $(pre+'Game').value==='omaha' ? 'omaha' : 'holdem';
  S.ko = $(pre+'Fmt').value==='ko';
  if(kind==='solo'){ S.blindEvery=+$('soloBlinds').value; { const on=$('sOn').checked; S.help=on&&$('sOdds').checked; S.hMade=on&&$('sMade').checked; S.hDraws=on&&$('sDraws').checked; S.hAdvice=on&&$('sAdv').checked;  } S.bombEvery=+$('soloBomb').value; S.bombBB=5; S.public=false; S.botRebuy=$('soloRebuy').checked; }
  if(S.ko){ S.botRebuy=false; if(!S.blindEvery) S.blindEvery=8; } // a knockout needs rising blinds to finish
  else { S.blindEvery=+$('blindMode').value; { const on=$('hOn').checked; S.help=on&&$('hOdds').checked; S.hMade=on&&$('hMade').checked; S.hDraws=on&&$('hDraws').checked; S.hAdvice=on&&$('hAdv').checked;  } S.bombEvery=+$('bombEvery').value; S.bombBB=+$('bombSize').value; S.public=$('publicOn').checked; S.botRebuy=$('botRebuy').checked; S.tname=cleanName($('tableName').value).slice(0,24); if(S.tname==='Игрок') S.tname=''; }
}
const QUICK=['👍','😂','😱','🤔','🔥','nh','gg'];
$('quick').innerHTML=QUICK.map(q=>`<button type="button" data-q="${q}">${q}</button>`).join('');
$('quick').onclick=e=>{ const q=e.target.closest('button')?.dataset.q; if(q) sendChat(q); };
$('chatForm').onsubmit=e=>{ e.preventDefault(); const v=$('chatIn').value; if(v.trim()){ sendChat(v); $('chatIn').value=''; } };
function setPre(type){
  const i=mySeat(); if(i<0 || !S) return; const p=seats()[i];
  const amt = type==='call' ? S.currentBet-p.bet : 0;
  pre = (pre && pre.type===type) ? null : {type, amt, hand:S.handNo};
  render();
}
$('preCF').onclick=()=>setPre('checkfold');
$('preC').onclick=()=>{ const p=seats()[mySeat()]; if(p) setPre(S.currentBet-p.bet>0 ? 'call' : 'check'); };
$('preCA').onclick=()=>setPre('callany');
$('bShow').onclick=()=>{ if(MODE==='guest') sendHost({t:'show'}); else showCards(mySeat()); };
function updSound(){
  const label=t(snd.on ? 'Звук: вкл' : 'Звук: выкл'), b=$('bSound');
  b.textContent = snd.on ? '🔊' : '🔇'; b.title=label; b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', snd.on);
  const m=$('mSound'); if(m){ m.querySelector('i').textContent=b.textContent; m.querySelector('span').textContent=label; }
}
$('bSound').onclick=()=>{ snd.on=!snd.on; store.set('pion-sound', snd.on?'1':'0'); updSound(); if(snd.on) SFX.turn(); };
updSound();
function checkPre(){
  if(!pre || !S) return;
  if(pre.hand!==S.handNo || S.handOver){ pre=null; return; }
  const i=mySeat(); if(i<0){ pre=null; return; }
  const p=S.seats[i]; if(p.folded || p.allIn){ pre=null; return; }
  const toCall=S.currentBet-p.bet;
  if(pre.type==='check' && toCall>0){ pre=null; return; }
  if(pre.type==='call' && toCall!==pre.amt && toCall>0){ pre=null; return; }
  if(myTurn() && !preT){
    preT=setTimeout(()=>{
      preT=null; if(!pre || !myTurn()) return;
      const t=pre.type; pre=null;
      const tc=S.currentBet-S.seats[mySeat()].bet;
      human(t==='checkfold' && tc>0 ? 'fold' : 'call', true);
    }, 450);
  }
}
function checkNick(){ if(!$('nick').value.trim()){ setLobbyErr(t('Введите имя, чтобы друзья вас узнали.')); $('nick').focus(); return false; } return true; }
function saveNick(){ store.set('pion-nick', $('nick').value.trim()); }
