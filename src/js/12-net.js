/* ---------- network: browsers connect directly, the host's browser deals ---------- */
const PEER_PREFIX = 'pion-poker-';
let peer = null, hostConn = null, joinTimer = null, reconnectT = null, closeArm = 0;
const conns = new Map();   // host side: uid -> connection
function seatKey(){ let k=store.get('pion-key'); if(!k){ k=hex(crypto.getRandomValues(new Uint8Array(16))); store.set('pion-key',k); } return k; }
const seatKeys={}; const rate={};
function myId(){ let id=store.get('pion-uid'); if(!id){ id='p'+Math.random().toString(36).slice(2,10); store.set('pion-uid',id); } return id; }
function peerOpts(){ const ice=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]; if(CFG.turn && CFG.turn.url) ice.push({urls:CFG.turn.url, username:CFG.turn.user||undefined, credential:CFG.turn.pass||undefined}); return Object.assign({debug:0, config:{iceServers:ice}}, window.PION_PEER_OPTS||{}); }
function openPeer(id){
  return new Promise((res,rej)=>{
    const p = id ? new Peer(id, peerOpts()) : new Peer(peerOpts());
    const t=setTimeout(()=>{ rej({type:'timeout'}); try{p.destroy()}catch(e){} }, 12000);
    p.on('open',()=>{ clearTimeout(t); res(p); });
    p.on('error',e=>{ clearTimeout(t); rej(e); });
  });
}

let sendT = null;
function commit(){
  render();
  if(MODE!=='host') return;
  saveHost();
  if(sendT) return;
  sendT = setTimeout(()=>{ sendT=null; broadcast(); }, 30);
}
function broadcast(){
  if(MODE!=='host' || !S) return;
  const pub = JSON.parse(JSON.stringify(S));
  for(const [uid,c] of conns){
    if(!c.open) continue;
    const i=S.seats.findIndex(s=>s.uid===uid);
    const mine = i>=0 && S.seats[i].inHand && H.hands[i] ? H.hands[i] : null;
    const mineOpen = mine && S.fair && H.salts ? mine.map(cd=>{ const ix=H.pos[cardKey(cd)]; return [ix, H.salts[ix], cardKey(cd)]; }) : null;
    try{ c.send({t:'state', S:pub, mine, mineOpen, hand:S.handNo}); }catch(e){}
  }
}
function saveHost(){ store.set('pion-host', JSON.stringify({code, S, at:Date.now()})); }
function stopNet(){
  clearTimeout(joinTimer); clearTimeout(reconnectT);
  for(const c of conns.values()){ try{ c.close(); }catch(e){} }
  conns.clear();
  if(hostConn){ try{ hostConn.close(); }catch(e){} hostConn=null; }
  if(peer){ try{ peer.destroy(); }catch(e){} peer=null; }
}
const netErr = e => {
  const et = e && e.type;
  if(et==='peer-unavailable') return t('Стол с таким кодом не найден. Проверьте код и что у ведущего открыта страница.');
  if(et==='unavailable-id') return t('Этот стол уже открыт в другой вкладке.');
  if(et==='browser-incompatible') return t('Этот браузер не поддерживает игру по сети. Откройте страницу в Chrome, Safari или Firefox.');
  return t('Нет связи с сервером соединений. Проверьте интернет и попробуйте ещё раз.');
};

/* host */
async function createTable(resume){
  if(typeof Peer==='undefined') return setLobbyErr(t('Не загрузилась библиотека для игры по сети. Проверьте интернет и обновите страницу.'));
  setLobbyErr(''); $('bCreate').disabled=true;
  try{
    let c = resume ? resume.code : genCode();
    for(let attempt=0;;attempt++){
      try{ peer = await openPeer(PEER_PREFIX+c); break; }
      catch(e){ if(e.type==='unavailable-id' && !resume && attempt<3){ c=genCode(); continue; } throw e; }
    }
    code = c;
    peer.on('connection', onConn);
    peer.on('disconnected', ()=>{ try{ peer.reconnect(); }catch(e){} });
    peer.on('error', e=>{ if(e.type==='network' || e.type==='server-error') toast(t('Сервер соединений барахлит, переподключаемся…')); });
    MODE='host'; H={deck:[],hands:{}};
    if(resume){
      S = resume.S;
      S.sb=S.sb||SB; S.bb=S.bb||BB; S.lvl=S.lvl||0; S.chat=S.chat||[]; if(S.help===undefined) S.help=true; if(S.hMade===undefined){ S.hMade=true; S.hDraws=true; S.hAdvice=false; } S.aggr=-1; S.canGhost=false; S.ghost=null; S.waits={}; { const me=seats().find(x=>x.uid===myUid); if(me) me.av={...CFG.av}; }
      seats().forEach(p=>{ p.offline = p.uid!==myUid && !p.bot; });
      if(!S.handOver){
        seats().forEach(p=>{ p.stack+=p.total; p.total=0; p.bet=0; p.shown=null; p.last=''; p.inHand=false; });
        S.board=[]; S.handOver=true; S.collect=false;
        S.banner='Ведущий перезагрузил страницу. Ставки прерванной раздачи вернулись';
        log('Раздача прервана, ставки возвращены');
      } else S.banner='Стол снова открыт. Игроки вернутся автоматически';
      S.turn=-1; S.deadline=0; S.nextAt=0;
    } else {
      const start = +$('stackN').value;
      S = mkState(start); S.hostUid=myUid; applyOpts('create');
      S.seats.push(mkSeat({uid:myUid,name:myName(),av:{...CFG.av},stack:start,out:false}));
      BOTS.slice(0,+$('botsN').value).forEach((b,k)=>S.seats.push(mkSeat({...b,uid:'bot'+k,bot:true,lvl:botLevel(k,'botLvl'),stack:start,out:false})));
      S.banner='Стол открыт. Отправьте друзьям ссылку и нажмите «Начать игру»';
      log(L('Стол {0} открыт', code),'sep');
    }
    setHash(code);
    $('lobby').hidden=true; resetView(); commit();
    if(resume && S.started){ S.paused=false; scheduleNext(8000); }
    lobbyReg();
  }catch(e){
    stopNet(); MODE='lobby'; code=null; S=null;
    setLobbyErr(netErr(e));
  }
  $('bCreate').disabled=false;
}
function onConn(c){
  c.on('data', m=>onGuestMsg(c,m));
  c.on('close', ()=>{
    const uid=c.uid;
    if(uid && conns.get(uid)===c){
      conns.delete(uid);
      const i=seats().findIndex(s=>s.uid===uid);
      if(i>=0 && MODE==='host'){ seats()[i].offline=true; commit(); }
    }
  });
}
function onGuestMsg(c,m){
  if(!m || typeof m!=='object' || MODE!=='host' || !S) return;
  const now=Date.now(), rk=c.peer||'?', rb=rate[rk]||(rate[rk]={n:0,at:now});
  if(now-rb.at>5000){ rb.n=0; rb.at=now; } if(++rb.n>60) return;
  if(m.t==='join'){
    const uid=String(m.uid||'').replace(/[^a-z0-9]/gi,'').slice(0,20); if(!uid || uid===myUid || /^bot/i.test(uid)) return;
    const key=String(m.key||'').slice(0,64);
    if(seatKeys[uid] && seatKeys[uid]!==key){ try{ c.send({t:'taken'}); }catch(e){} return; }
    if(!seatKeys[uid] && seats().some(s=>s.uid===uid) && key.length<16){ try{ c.send({t:'taken'}); }catch(e){} return; }
    seatKeys[uid]=key;
    c.uid=uid;
    const old=conns.get(uid); if(old && old!==c){ try{ old.close(); }catch(e){} }
    conns.set(uid,c);
    const i=seats().findIndex(s=>s.uid===uid);
    if(i<0){
      if(seats().length>=MAX_SEATS){ try{ c.send({t:'full'}); }catch(e){} }
      else { seats().push(mkSeat({uid,name:cleanName(m.name),av:cleanAv(m.av),stack:S.start,out:false,folded:true,inHand:false})); log(L('{0} садится за стол', cleanName(m.name))); }
    } else {
      const s=seats()[i]; s.offline=false; s.missed=0;
      if(s.left){ s.left=false; log(L('{0} возвращается', s.name)); }
      s.name=cleanName(m.name); s.av=cleanAv(m.av)||s.av;
    }
    commit(); maybeAutoStart(); return;
  }
  const i=seats().findIndex(s=>s.uid===c.uid); if(i<0 || seats()[i].bot) return;
  if(m.t==='pong'){ netPong(c.uid, +m.ts); return; }
  if(m.t==='emote'){ emoteFrom(c.uid, String(m.e||'')); return; }
  if(m.t==='away'){ setAway(i, !!m.v); return; }
  if(m.t==='act'){
    if(!S.handOver && S.turn===i && m.turnId===S.turnId && ['fold','call','raise'].includes(m.type)) act(i, m.type, +m.to||0);
    else broadcast();
  } else if(m.t==='profile'){ seats()[i].name=cleanName(m.name); seats()[i].av=cleanAv(m.av)||seats()[i].av; commit(); }
  else if(m.t==='ghost') ghostRun();
  else if(m.t==='wait') askWait(seats()[i].uid);
  else if(m.t==='chat') addChat(seats()[i].uid, seats()[i].name, m.text);
  else if(m.t==='show') showCards(i);
  else if(m.t==='rebuy') doRebuy(i);
  else if(m.t==='leave'){
    const s=seats()[i];
    if(!s.left){ s.left=true; log(L('{0} выходит из-за стола', s.name)); if(!S.handOver && S.turn===i) flow(()=>act(i,'fold'),500); commit(); }
  }
}
function maybeAutoStart(){ if(S && S.started && !S.paused && S.handOver && !timers.flow && seats().filter(s=>s.stack>0&&!s.left&&!s.away).length>=2) flow(startHand, 2500); }
function doRebuy(i){
  const s=seats()[i]; if(!s || s.stack>0 || s.rebuy>s.rebuySeen) return;
  s.rebuy=(s.rebuy||0)+1;
  if(S.handOver || !s.inHand){ s.stack=S.start; s.rebuySeen=s.rebuy; s.out=false; log(L('{0} докупается на {1}', s.name, S.start)); }
  commit(); maybeAutoStart();
}

