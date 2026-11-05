/* ---------- connection quality ---------- */
const netSeen={};
setInterval(()=>{
  if(MODE!=='host' || !S || !conns.size) return;
  S.net=S.net||{}; const now=Date.now();
  for(const [uid,c] of conns){ try{ if(c.open) c.send({t:'ping', ts:now}); }catch(e){} if(netSeen[uid] && now-netSeen[uid]>9000) S.net[uid]=-1; }
  commit();
}, 3000);
function netPong(uid, ts){ const rtt=Date.now()-ts; if(rtt<0||rtt>60000) return; netSeen[uid]=Date.now(); S.net=S.net||{}; S.net[uid]=rtt; }
const netClass = ms => ms==null ? '' : ms<0 ? 'off' : ms<150 ? 'good' : ms<400 ? 'mid' : 'bad';
document.addEventListener('toggle', e=>{ if(e.target && e.target.id==='helpDet'){ CFG.helpOpen=e.target.open; saveCfg(); } }, true);
function renderNet(){
  const el=$('netChip'); if(!el) return;
  if(MODE!=='guest' || !S){ el.hidden=true; return; }
  const ms=(S.net||{})[myUid];
  el.hidden=false; el.className='netchip '+(netClass(ms)||'mid');
  el.textContent = ms==null ? t('Связь: проверяем…') : ms<0 ? t('Связь: потеряна') : t('Связь: {0} мс', ms);
  if(mq.matches){ el.title=el.textContent; el.textContent = ms==null ? '…' : ms<0 ? '✕' : ms+' мс'; }
}

