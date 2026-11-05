/* ---------- verifiable deck: the order of cards is committed (hashed) before the deal and opened card by card ---------- */
const hex = buf => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha(s){ return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0,24); }
function dealCard(){ const c=H.deck.pop(); H.pos[cardKey(c)]=H.deck.length; return c; }
function burn(){ H.deck.pop(); }
async function fairCommit(order){
  H.salts = H.deck0.map(()=>hex(crypto.getRandomValues(new Uint8Array(16))));
  const c = await Promise.all(H.deck0.map((card,i)=>sha(`${H.salts[i]}|${i}|${cardKey(card)}`)));
  S.fair = {hand:S.handNo, n:order.length, order, c}; S.fairOpen = {};
}
function fairOpen(cards){
  if(MODE!=='host' || !S.fair || !H.salts || !cards) return;
  for(const c of cards){ const i=H.pos[cardKey(c)]; if(i!=null) S.fairOpen[i]=[H.salts[i], cardKey(c)]; }
}
let myFairOpen=null, fairTamper=-1, fairState={hand:-1, ok:0, bad:0, sig:''};
async function verifyFair(){
  if(MODE!=='guest' || !S || !S.fair || S.fair.hand!==S.handNo){ fairState={hand:-1,ok:0,bad:0,sig:''}; renderFair(); return; }
  const F=S.fair, n=F.n;
  const opens=new Map(Object.entries(S.fairOpen||{}).map(([i,v])=>[+i,v]));
  (myFairOpen||[]).forEach(o=>opens.set(o[0],[o[1],o[2]]));
  const bIdx=[50-2*n,49-2*n,48-2*n,46-2*n,44-2*n], expect=[];
  S.board.forEach((c,k)=>expect.push([bIdx[k],cardKey(c)]));
  (S.ghost||[]).forEach((c,k)=>expect.push([bIdx[S.board.length+k],cardKey(c)]));
  const seatCards=(uid,cs)=>{ const k=F.order.indexOf(uid); if(k>=0 && cs && cs.length===2) expect.push([51-k,cardKey(cs[0])],[51-n-k,cardKey(cs[1])]); };
  S.seats.forEach(s=>{ if(s.shown && s.uid!==myUid) seatCards(s.uid, s.shown); });
  if(myCards && myCards.hand===S.handNo) seatCards(myUid, myCards.cards);
  const sig=S.handNo+':'+expect.map(e=>e.join('.')).join(',')+':'+opens.size;
  if(sig===fairState.sig) return;
  fairState.sig=sig;
  let ok=0, bad=0;
  for(const [idx,key] of expect){
    const o=opens.get(idx);
    if(!o || +o[1]!==key){ bad++; continue; }
    if(await sha(`${o[0]}|${idx}|${key}`)===F.c[idx]) ok++; else bad++;
  }
  if(fairState.sig!==sig) return;
  if(fairTamper===S.handNo) bad++;
  fairState={hand:S.handNo, ok, bad, sig}; renderFair();
}
function renderFair(){
  const el=$('fairChip'); if(!el) return;
  if(!S || MODE==='offline' || MODE==='lobby' || !S.fair){ el.hidden=true; return; }
  el.hidden=false;
  if(mq.matches){ setTimeout(()=>{ el.title=el.title||el.textContent; el.textContent=el.textContent.slice(0,2).trim(); },0); }
  if(MODE==='host'){ el.className='fair ok'; el.textContent='🔒 '+t('Колода зафиксирована'); el.title=t('Порядок карт закреплён отпечатком до раздачи. Гости проверяют каждую открытую карту.'); return; }
  if(fairState.bad>0){ el.className='fair bad'; el.textContent='⚠ '+t('Карты не совпали'); el.title=t('Открытые карты не совпадают с колодой, зафиксированной до раздачи.'); }
  else { el.className='fair ok'; el.textContent='🔒 '+t('Честная колода'); el.title=t('Порядок карт закреплён до раздачи. Проверено карт: {0}, все совпали.', fairState.ok); }
}

