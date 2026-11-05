/* guest: join a table and stay at it through bad networks, sleeping phones and host reloads */
// Only the guest side lives here; the host code is untouched. The host pings every 3 s and
// re-sends the table whenever it gets an "act" it cannot use, so a guest can always ask for a
// fresh state with {t:'act', type:'sync'} and tell a live link from a dead one.
const GN = {
  state:'ok',        // ok | probing | lost
  lastMsg:0,         // last message from the host
  probeAt:0,         // when the sync probe was sent
  tries:0,           // reconnect attempts since the link was lost
  lostAt:0,
  nextAt:0,          // when the next attempt starts (for the countdown)
  busy:false,        // an attempt is running
  outbox:[],         // chat and similar messages typed while offline
  hostGone:false,    // the host's page is not reachable at all (closed or reloading)
};
const GUEST_QUIET_MS = 9000, GUEST_PROBE_MS = 6000;
const QUEUE_KINDS = new Set(['chat','profile','away','show','rebuy','emote']);
function saveGuest(){ if(code) store.set('pion-guest', JSON.stringify({code, at:Date.now()})); }
function savedGuest(){ try{ const r=JSON.parse(localStorage.getItem('pion-guest')||'null'); if(r && r.code && Date.now()-r.at < 6*3600e3) return r; }catch(e){} return null; }
function forgetGuest(){ try{ localStorage.removeItem('pion-guest'); }catch(e){} }

async function joinTable(c, watch){
  if(typeof Peer==='undefined') return setLobbyErr(t('Не загрузилась библиотека для игры по сети. Проверьте интернет и обновите страницу.'));
  c = String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(c.length!==4) return setLobbyErr(t('Код стола — четыре символа, например K7QM.'));
  setLobbyErr(''); $('bJoin').disabled=true; $('bJoin').textContent=t('Подключаемся…');
  try{
    Object.assign(GN, {state:'ok', tries:0, lastMsg:Date.now(), outbox:[], hostGone:false, busy:false, watch:!!watch});
    await guestPeer();
    code = c;
    await connectGuest(true);
    MODE='guest'; GN.lastMsg=Date.now();
    setHash(code); saveGuest();
    $('lobby').hidden=true; resetView(); render(); renderGuestNet();
  }catch(e){
    stopNet(); MODE='lobby'; code=null; S=null;
    setLobbyErr(e && e.type==='taken' ? t('Это место уже занято с другого устройства') : e && e.type==='full' ? t('За столом нет свободных мест') : netErr(e));
  }
  $('bJoin').disabled=false; $('bJoin').textContent=t('Войти по коду');
}

// a working connection to the PeerJS signalling server: reuse, reconnect or create anew
async function guestPeer(){
  if(peer && !peer.destroyed && peer.open) return peer;
  if(peer && !peer.destroyed && peer.disconnected){
    try{
      peer.reconnect();
      await new Promise((res,rej)=>{ const k=setTimeout(()=>rej({type:'timeout'}), 6000); peer.once('open', ()=>{ clearTimeout(k); res(); }); });
      return peer;
    }catch(e){}
  }
  if(peer){ try{ peer.destroy(); }catch(e){} }
  peer = await openPeer();
  peer.on('disconnected', ()=>{ if(MODE==='guest' && !peer.destroyed) try{ peer.reconnect(); }catch(e){} });
  return peer;
}

function connectGuest(first){
  return new Promise((res,rej)=>{
    const conn = peer.connect(PEER_PREFIX+code, {reliable:true});
    let done=false;
    const fail = e => { if(done) return; done=true; clearTimeout(joinTimer); peer.off('error', onErr); try{ conn.close(); }catch(_){} rej(e); };
    const onErr = e => { if(e.type==='peer-unavailable') fail(e); };
    peer.on('error', onErr);
    joinTimer = setTimeout(()=>fail({type:'timeout'}), first ? 15000 : 12000);
    conn.on('open', ()=>{
      conn.send({t:'join', uid:myUid, key:seatKey(), name:myName(), av:CFG.av, pf:mySummary(), watch:!!GN.watch});
      // ICE says the path is broken long before the data channel notices
      const pc = conn.peerConnection;
      if(pc) pc.addEventListener('iceconnectionstatechange', ()=>{
        if(hostConn!==conn) return;
        if(pc.iceConnectionState==='failed' || pc.iceConnectionState==='closed') guestLost();
        else if(pc.iceConnectionState==='disconnected') guestProbe();
      });
    });
    conn.on('data', m=>{
      if(!m || typeof m!=='object') return;
      if(hostConn===conn || !done) GN.lastMsg=Date.now();
      if(m.t==='state'){
        if(!done){ done=true; clearTimeout(joinTimer); peer.off('error', onErr); hostConn=conn; res(); }
        if(hostConn!==conn) return;
        if(GN.state!=='ok') guestBack();
        if(S && m.S && S.fair && m.S.fair && S.fair.hand===m.S.fair.hand && S.fair.c.join()!==m.S.fair.c.join()) fairTamper=S.fair.hand;
        S=m.S; myCards = m.mine ? {hand:m.hand, cards:m.mine} : null; myFairOpen = m.mineOpen || null;
        if(pending!==null && (S.turnId!==pending || S.handOver)) pending=null;
        if(MODE==='guest' || !first){ render(); verifyFair(); }
      } else if(hostConn!==conn){ /* a stale link: ignore */ }
      else if(m.t==='ping'){ try{ conn.send({t:'pong', ts:m.ts}); }catch(e){} }
      else if(m.t==='hist' && m.rec){ histAdd({...m.rec, mine: myCards&&myCards.hand===m.rec.no ? myCards.cards.map(cardKey) : null}); }
      else if(m.t==='emote'){ emoteShow(String(m.u), String(m.e)); }
      else if(m.t==='closed'){ forgetGuest(); toast(t('Ведущий закрыл стол')); exitToLobby(true); }
      if(m.t==='taken'){ fail({type:'taken'}); if(MODE==='guest') guestStop(t('Это место уже занято с другого устройства')); }
      else if(m.t==='full'){ fail({type:'full'}); if(MODE==='guest') guestStop(t('За столом нет свободных мест')); }
    });
    conn.on('error', ()=>{ if(!done) fail({type:'peer-unavailable'}); else if(hostConn===conn) guestLost(); });
    conn.on('close', ()=>{
      if(!done) return fail({type:'peer-unavailable'});
      if(MODE==='guest' && hostConn===conn) guestLost();
    });
  });
}

// the link looks quiet: ask the host for the table; if nothing comes back, it is gone
function guestProbe(){
  if(MODE!=='guest' || GN.state!=='ok') return;
  if(!sendHost({t:'act', type:'sync'})) return guestLost();
  GN.state='probing'; GN.probeAt=Date.now(); renderGuestNet();
}
function guestLost(){
  if(MODE!=='guest' || GN.state==='lost') return;
  GN.state='lost'; GN.lostAt=Date.now(); GN.tries=0; GN.hostGone=false; pending=null;
  if(hostConn){ const c=hostConn; hostConn=null; try{ c.close(); }catch(e){} }
  render(); renderGuestNet();
  scheduleReconnect(600);
}
function guestBack(){
  const wasLost = GN.state==='lost';
  GN.state='ok'; GN.tries=0; GN.hostGone=false; clearTimeout(reconnectT);
  const q=GN.outbox.splice(0); q.forEach(m=>sendHost(m));
  if(wasLost) toast(t('Снова за столом'));
  renderGuestNet();
}
function guestStop(msg){ forgetGuest(); toast(msg, 6000); exitToLobby(true); }

// 1 s, 2 s, 4 s … up to 15 s between attempts; immediately when the network comes back
function scheduleReconnect(ms){
  clearTimeout(reconnectT);
  if(MODE!=='guest' || GN.state!=='lost') return;
  const wait = ms!=null ? ms : Math.min(15000, 1000 * 2 ** Math.min(GN.tries, 4));
  GN.nextAt = Date.now()+wait; renderGuestNet();
  reconnectT = setTimeout(guestAttempt, wait);
}
async function guestAttempt(){
  if(MODE!=='guest' || GN.state!=='lost' || GN.busy) return;
  if(navigator.onLine===false){ GN.nextAt=0; renderGuestNet(); return; } // the 'online' event resumes
  GN.busy=true; GN.tries++; GN.nextAt=0; renderGuestNet();
  try{
    await guestPeer();
    await connectGuest(false);
  }catch(e){
    if(e && (e.type==='taken' || e.type==='full')){ GN.busy=false; return; }
    GN.hostGone = !!e && e.type==='peer-unavailable';
  }
  GN.busy=false;
  if(MODE==='guest' && GN.state==='lost') scheduleReconnect();
}
function guestRetryNow(){ if(MODE==='guest' && GN.state==='lost'){ GN.tries=0; scheduleReconnect(0); } }

// messages that make sense later wait in the outbox; moves and requests do not
function sendHost(msg){
  try{ if(hostConn && hostConn.open){ hostConn.send(msg); return true; } }catch(e){}
  if(MODE==='guest' && msg && QUEUE_KINDS.has(msg.t)){
    if(msg.t==='profile') GN.outbox=GN.outbox.filter(x=>x.t!=='profile');
    if(GN.outbox.length<20) GN.outbox.push(msg);
    if(msg.t==='chat') toast(t('Нет связи — сообщение уйдёт, когда связь вернётся'));
    return true;
  }
  return false;
}

setInterval(()=>{
  if(MODE!=='guest') return;
  const now=Date.now();
  if(GN.state==='ok' && now-GN.lastMsg > GUEST_QUIET_MS) guestProbe();
  else if(GN.state==='probing' && now-GN.lastMsg < now-GN.probeAt){ GN.state='ok'; renderGuestNet(); }
  else if(GN.state==='probing' && now-GN.probeAt > GUEST_PROBE_MS) guestLost();
  if(GN.state==='lost') renderGuestNet();
}, 1000);
addEventListener('online', ()=>{ if(MODE==='guest'){ if(GN.state==='lost') guestRetryNow(); else guestProbe(); } });
addEventListener('offline', ()=>{ if(MODE==='guest') renderGuestNet(); });
// a phone woke up: the link may have died while the page slept
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState!=='visible' || MODE!=='guest') return;
  if(GN.state==='lost') guestRetryNow(); else if(Date.now()-GN.lastMsg > 4000) guestProbe();
});
addEventListener('pageshow', e=>{ if(e.persisted && MODE==='guest') guestProbe(); });

// the strip under the header that tells a guest what is going on with the link
function renderGuestNet(){
  const bar=$('netBar'); if(!bar) return;
  const show = MODE==='guest' && GN.state==='lost';
  bar.hidden=!show;
  document.body.classList.toggle('netlost', show);
  if(!show) return;
  const offline = navigator.onLine===false;
  const secs = GN.nextAt ? Math.max(0, Math.ceil((GN.nextAt-Date.now())/1000)) : 0;
  const away = Math.round((Date.now()-GN.lostAt)/1000);
  $('netBarText').textContent =
    offline ? t('Нет интернета. Вернёмся за стол, как только он появится') :
    GN.busy ? t('Связь с ведущим потеряна. Подключаемся… (попытка {0})', GN.tries) :
    GN.hostGone ? t('Ведущий не отвечает — возможно, перезагружает страницу. Следующая попытка через {0} с', secs) :
    t('Связь с ведущим потеряна. Следующая попытка через {0} с', secs);
  $('netBarSub').textContent = away>=20 ? t('Ваше место и фишки сохраняются. Нет связи уже {0} с', away) : t('Ваше место и фишки сохраняются');
  $('netBarRetry').disabled = GN.busy || offline;
}
$('netBarRetry').onclick=()=>guestRetryNow();
$('netBarLeave').onclick=()=>{ forgetGuest(); exitToLobby(); };

// a spectator takes a seat: the same connection sends a normal join
function sitDown(){ if(MODE!=='guest' || mySeat()>=0) return; GN.watch=false; sendHost({t:'join', uid:myUid, key:seatKey(), name:myName(), av:CFG.av, pf:mySummary()}); }
$('bSit').onclick=sitDown;
function applyWatch(){
  const watching = MODE==='guest' && !!S && mySeat()<0;
  $('watchRow').hidden=!watching;
  if(watching){ ['actRow','raiseRow','preRow','odds'].forEach(id=>$(id).hidden=true); $('hint').textContent=''; $('bSit').disabled = seats().filter(s=>!s.left).length>=MAX_SEATS; }
  const w=S && S.watchers ? Object.values(S.watchers) : [];
  $('watchChip').hidden=!w.length; $('watchChip').textContent='👁 '+w.length; $('watchChip').title=t('Смотрят: {0}', w.join(', '));
}
