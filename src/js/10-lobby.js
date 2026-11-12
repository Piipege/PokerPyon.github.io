/* ---------- open lobby: whoever has the site open first keeps the list of public tables ---------- */
const LOBBY_ID='pyonpoker-lobby-v1';
const lob={peer:null, role:null, conn:null, tables:new Map(), subs:new Set(), retryT:null};
async function lobbyStart(){
  if(typeof Peer==='undefined') return;
  clearTimeout(lob.retryT);
  try{
    const p=await openPeer(LOBBY_ID);
    lob.peer=p; lob.role='registry';
    p.on('connection', c=>{ c.on('data', m=>lobbyMsg(c,m)); c.on('close', ()=>lob.subs.delete(c)); });
    p.on('disconnected', ()=>{ try{ p.reconnect(); }catch(e){} });
    p.on('error', e=>{ if(['network','server-error','socket-error','socket-closed'].includes(e.type)) lobbyRetry(4000); });
    lobbyReg(); lobbyRender();
  }catch(e){
    if(e.type!=='unavailable-id') return lobbyRetry(8000);
    try{
      const p=await openPeer(); lob.peer=p; lob.role='client';
      const c=p.connect(LOBBY_ID, {reliable:true}); lob.conn=c;
      const t=setTimeout(()=>{ if(!c.open) lobbyRetry(2000); }, 10000);
      c.on('open', ()=>{ clearTimeout(t); c.send({t:'sub'}); lobbyReg(); lobbyRender(); });
      c.on('data', m=>{ if(m && m.t==='list' && Array.isArray(m.tables)){ lob.tables=new Map(m.tables.map(x=>[x.code,x])); lobbyRender(); } });
      c.on('close', ()=>lobbyRetry(500+Math.random()*2500));
      p.on('error', e=>{ if(e.type==='peer-unavailable') lobbyRetry(300+Math.random()*1500); });
    }catch(e2){ lobbyRetry(8000); }
  }
}
function lobbyRetry(ms=3000){
  clearTimeout(lob.retryT);
  const p=lob.peer; lob.peer=null; lob.conn=null; lob.role=null; lob.subs.clear();
  try{ p && p.destroy(); }catch(e){}
  lobbyRender();
  lob.retryT=setTimeout(lobbyStart, ms);
}
function cleanTable(t){
  const num=(v,d=0)=>Number.isFinite(+v)?Math.max(0,Math.min(100000,Math.floor(+v))):d;
  return {code:String(t.code).toUpperCase().slice(0,4), name:cleanName(String(t.name||'Стол').slice(0,30)).slice(0,30), tn:!!t.tn, humans:num(t.humans), bots:num(t.bots), seats:num(t.seats), max:num(t.max,6), sb:num(t.sb,10), bb:num(t.bb,20), start:num(t.start,1000), bomb:num(t.bomb), started:!!t.started, game:t.game==='omaha'?'omaha':'holdem', ko:!!t.ko, ts:Date.now()};
}
function lobbyMsg(c,m){
  if(!m || typeof m!=='object') return;
  if(m.t==='sub'){ lob.subs.add(c); try{ c.send({t:'list', tables:[...lob.tables.values()]}); }catch(e){} }
  else if(m.t==='reg' && m.table && /^[A-Z0-9]{4}$/.test(String(m.table.code)) && (lob.tables.has(m.table.code) || lob.tables.size<60)){ lob.tables.set(m.table.code, cleanTable(m.table)); lobbyBroadcast(); }
  else if(m.t==='unreg' && m.code){ lob.tables.delete(String(m.code)); lobbyBroadcast(); }
}
function lobbyPrune(){ const now=Date.now(); for(const [k,v] of lob.tables) if(now-v.ts>25000) lob.tables.delete(k); }
function lobbyBroadcast(){
  lobbyPrune(); const tables=[...lob.tables.values()];
  for(const c of lob.subs){ try{ if(c.open) c.send({t:'list', tables}); }catch(e){} }
  lobbyRender();
}
function myTableInfo(){
  if(MODE!=='host' || !S || !S.public) return null;
  const me=seats().find(s=>s.uid===myUid);
  return {code, name: S.tname || (me?me.name:'—'), tn: !!S.tname, humans:seats().filter(s=>!s.bot&&!s.left).length, bots:seats().filter(s=>s.bot).length, seats:seats().filter(s=>!s.left).length, max:MAX_SEATS, sb:S.sb, bb:S.bb, start:buyIn(), game:S.game==='omaha'?'omaha':'holdem', ko:!!S.ko, bomb:S.bombEvery||0, started:!!S.started};
}
function lobbyReg(){
  const t=myTableInfo(); if(!t) return;
  if(lob.role==='registry'){ lob.tables.set(t.code, cleanTable(t)); lobbyBroadcast(); }
  else if(lob.conn && lob.conn.open){ try{ lob.conn.send({t:'reg', table:t}); }catch(e){} }
}
function lobbyUnreg(c){
  if(lob.role==='registry'){ lob.tables.delete(c); lobbyBroadcast(); }
  else if(lob.conn && lob.conn.open){ try{ lob.conn.send({t:'unreg', code:c}); }catch(e){} }
}
setInterval(()=>{ lobbyReg(); if(lob.role==='registry'){ const n=lob.tables.size; lobbyPrune(); if(n!==lob.tables.size) lobbyBroadcast(); } }, 8000);
function lobbyRender(){
  const ul=$('tables'); if(!ul) return;
  lobbyPrune();
  const list=[...lob.tables.values()].filter(x=>x.code!==code).sort((a,b)=>b.humans-a.humans);
  $('tablesNote').textContent = lob.role ? '' : t('Подключаемся к лобби…');
  ul.innerHTML = list.length ? list.map(x=>{
    const info=[t('Игроков: {0}', x.humans)];
    if(x.game==='omaha') info.push(t('Омаха')); if(x.ko) info.push(t('Нокаут'));
    if(x.bots) info.push(t('ботов: {0}', x.bots));
    info.push(t('блайнды {0}/{1}', x.sb, x.bb), t('стек {0}', x.start));
    if(x.bomb) info.push(t('бомб-пот каждые {0}', x.bomb));
    info.push(t(x.started?'идёт игра':'ждут игроков'));
    return `<li><div class="tinfo"><b>${esc(x.tn ? x.name : t('Стол {0}', x.name))}</b><span>${esc(info.join(' · '))}</span></div><button class="btn small ghost" data-code="${esc(x.code)}" data-watch="1" title="${esc(t('Смотреть игру'))}" aria-label="${esc(t('Смотреть игру'))}">👁</button><button class="btn small primary" data-code="${esc(x.code)}" ${x.seats>=x.max?'disabled':''}>${t(x.seats>=x.max?'Мест нет':'Сесть')}</button></li>`;
  }).join('') : `<li class="empty">${t(lob.role ? 'Открытых столов пока нет. Создайте свой и отметьте «Открытый стол».' : 'Ищем открытые столы…')}</li>`;
}

