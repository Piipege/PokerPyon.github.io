/* ---------- profile: lifetime statistics kept in this browser, and player cards at the table ---------- */
// Every hand you play is saved to IndexedDB (no limit of 20 like the history list). A short summary
// of your stats (`pf`) travels with your seat, so friends can open your card at the table. Stats are
// reported by each player about themselves: fine for a friendly game; a server can verify them later.

const PDB = {db:null, ready:null, mem:[]};      // mem: summaries when IndexedDB is not available
function pdbOpen(){
  if(PDB.ready) return PDB.ready;
  PDB.ready = new Promise(res=>{
    try{
      let fresh=false;
      const rq=indexedDB.open('pyonpoker-profile', 1);
      rq.onupgradeneeded=()=>{ fresh=true; const db=rq.result; if(!db.objectStoreNames.contains('hands')) db.createObjectStore('hands', {keyPath:'id'}); };
      rq.onsuccess=()=>{ PDB.db=rq.result; if(fresh) pdbMigrate(PDB.db).then(()=>res(PDB.db)); else res(PDB.db); };
      rq.onerror=rq.onblocked=()=>res(null);
    }catch(e){ res(null); }
  });
  return PDB.ready;
}
// hands saved before the rename (database «pion-profile») move into «pyonpoker-profile» once
function pdbMigrate(db){
  return new Promise(done=>{
    try{
      const old=indexedDB.open('pion-profile');
      old.onupgradeneeded=()=>{ try{ old.transaction.abort(); }catch(e){} }; // there was no old database: do not create one
      old.onerror=old.onblocked=()=>done();
      old.onsuccess=()=>{
        const odb=old.result;
        if(!odb.objectStoreNames.contains('hands')){ odb.close(); done(); return; }
        const g=odb.transaction('hands').objectStore('hands').getAll();
        g.onerror=()=>{ odb.close(); done(); };
        g.onsuccess=()=>{
          const tx=db.transaction('hands','readwrite'), st=tx.objectStore('hands');
          (g.result||[]).forEach(r=>st.put(r));
          tx.oncomplete=()=>{ odb.close(); try{ indexedDB.deleteDatabase('pion-profile'); }catch(e){} done(); };
          tx.onerror=tx.onabort=()=>{ odb.close(); done(); };
        };
      };
    }catch(e){ done(); }
  });
}
async function pdbAll(){
  const db=await pdbOpen(); if(!db) return PDB.mem.slice();
  return new Promise(res=>{ try{ const rq=db.transaction('hands').objectStore('hands').getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>res([]); }catch(e){ res([]); } });
}
async function pdbPut(rows){
  const db=await pdbOpen(); if(!db){ rows.forEach(r=>{ if(!PDB.mem.some(x=>x.id===r.id)) PDB.mem.push(r); }); return; }
  await new Promise(res=>{ try{ const tx=db.transaction('hands','readwrite'), st=tx.objectStore('hands'); rows.forEach(r=>st.put(r)); tx.oncomplete=tx.onerror=tx.onabort=()=>res(); }catch(e){ res(); } });
}
async function pdbClear(){
  PDB.mem=[]; const db=await pdbOpen(); if(!db) return;
  await new Promise(res=>{ try{ const tx=db.transaction('hands','readwrite'); tx.objectStore('hands').clear(); tx.oncomplete=tx.onerror=()=>res(); }catch(e){ res(); } });
}

// what one hand means for my statistics
function summarize(rec){
  if(!rec || !rec.mine || !rec.seats || !rec.seats.some(s=>s.u===myUid)) return null;
  const ds=decisionsOf(rec, myUid), pre=ds.filter(d=>d.street===0);
  let foldedPre=false, reachedFlop=false;
  for(const e of rec.ev){ if(e.a==='street'){ reachedFlop=true; break; } if(e.u===myUid && e.a==='fold'){ foldedPre=true; break; } }
  const folded=rec.ev.some(e=>e.u===myUid && e.a==='fold');
  const board=(rec.board||[]).map(keyCard), hand=rec.mine.map(keyCard);
  const win=(rec.win||[]).find(w=>w.u===myUid);
  const sd=!folded && board.length===5 && Object.keys(rec.shown||{}).length>=2 && !!(rec.shown||{})[myUid];
  return {
    at:rec.at, no:rec.no, bb:rec.bb||20, bomb:!!rec.bomb,
    net:(rec.delta||{})[myUid]||0, won:win?win.amt:0,
    pos:posOf(rec, myUid), n:rec.seats.length,
    people:rec.seats.filter(s=>!s.b && s.u!==myUid).length, bots:rec.seats.filter(s=>s.b).length,
    vp:pre.some(d=>d.a==='call'||d.a==='raise'||d.a==='bet'), pf:pre.some(d=>d.a==='raise'||d.a==='bet'),
    flop:reachedFlop && !foldedPre, sd, sdw:sd && !!win,
    cat: !folded && board.length===5 ? bestHand(hand, board).cat : -1, game: hand.length===4 ? 'omaha' : 'holdem',
    acc:null, // coach accuracy, filled in later when the browser is idle
  };
}
// coach accuracy for one hand (0…1), or -1 if you made no decisions
function accOf(rec){
  if(rec.mine.length===4) return -1; // the coach judges Hold'em only
  const hand=rec.mine.map(keyCard), pos=posOf(rec, myUid), ds=decisionsOf(rec, myUid);
  if(!ds.length) return -1;
  return ds.reduce((a,d)=>{ const v=judge(d, hand, pos).verdict; return a+(v==='good'?1:v==='ok'?.5:0); },0)/ds.length;
}

let PF_ROWS=null; // cached summaries of every saved hand
async function profileRows(){ if(!PF_ROWS) PF_ROWS=(await pdbAll()).sort((a,b)=>a.at-b.at||a.no-b.no); return PF_ROWS; }
async function profileSave(recs){
  const have=new Set((await profileRows()).map(r=>r.id)), rows=[];
  for(const rec of recs){ const id=rec.at+'-'+rec.no; if(have.has(id)) continue; const s=summarize(rec); if(s) rows.push({id, ...s, rec}); }
  if(!rows.length) return;
  await pdbPut(rows);
  if(PF_ROWS){ rows.forEach(r=>{ if(!PF_ROWS.some(x=>x.id===r.id)) PF_ROWS.push(r); }); }
  await profileSummaryUpdate();
  scheduleAcc();
  if(!$('profOv').hidden) renderProfile();
}
// coach accuracy is computed a few hands at a time, when nothing else is going on
let accT=null;
function scheduleAcc(){
  if(accT) return;
  const idle = window.requestIdleCallback || (f=>setTimeout(()=>f({timeRemaining:()=>8}), 400));
  accT = idle(async deadline=>{
    accT=null;
    const rows=await profileRows(), todo=rows.filter(r=>r.acc==null && r.rec).slice(-200);
    const done=[];
    for(const r of todo){ r.acc=accOf(r.rec); done.push(r); if(deadline.timeRemaining()<4 || done.length>=6) break; }
    if(done.length){ await pdbPut(done); await profileSummaryUpdate(); if(!$('profOv').hidden) renderProfile(); }
    if(todo.length>done.length) scheduleAcc();
  });
}

// lifetime numbers from the saved hands
function profileStats(rows){
  const st={h:rows.length, net:0, netBB:0, vpN:0, vp:0, pf:0, flop:0, sd:0, sdw:0, wins:0, bigBB:0, bestCat:-1, accS:0, accN:0, people:0, since:rows.length?rows[0].at:0, pos:{}, vs:{bots:{h:0,net:0}, people:{h:0,net:0}}};
  for(const r of rows){
    st.net+=r.net; st.netBB+=r.net/(r.bb||20);
    if(!r.bomb){ st.vpN++; if(r.vp) st.vp++; if(r.pf) st.pf++; }
    if(r.flop) st.flop++; if(r.sd) st.sd++; if(r.sdw) st.sdw++;
    if(r.won>0){ st.wins++; st.bigBB=Math.max(st.bigBB, r.won/(r.bb||20)); }
    if(r.cat>st.bestCat && (r.sdw || r.won>0)) st.bestCat=r.cat;
    if(r.acc!=null && r.acc>=0){ st.accS+=r.acc; st.accN++; }
    const p=st.pos[r.pos]||(st.pos[r.pos]={h:0,vp:0,vpN:0,net:0}); p.h++; p.net+=r.net; if(!r.bomb){ p.vpN++; if(r.vp) p.vp++; }
    const v=r.people>0 ? st.vs.people : st.vs.bots; v.h++; v.net+=r.net;
    if(r.people>0) st.people++;
  }
  const pc=(a,b)=>b?Math.round(a/b*100):0;
  Object.assign(st, {vpP:pc(st.vp,st.vpN), pfP:pc(st.pf,st.vpN), wsdP:pc(st.sdw,st.sd), winP:pc(st.wins,st.h), bb100:st.h?Math.round(st.netBB/st.h*1000)/10:0, accP:st.accN?Math.round(st.accS/st.accN*100):null});
  return st;
}
function styleOf(V, P){ return V>=35 ? (P>=V*.5 ? STYLES[2] : STYLES[1]) : (P>=V*.5 ? STYLES[0] : STYLES[3]); }
function lessonsDone(){ const pr=loadProgress(); return LESSONS.filter(l=>lessonDone(pr,l)).length; }

// the short summary that goes with my seat (numbers only, checked again by the host)
function mySummary(){ try{ return JSON.parse(localStorage.getItem('pyonpoker-pf')||'null'); }catch(e){ return null; } }
async function profileSummaryUpdate(){
  const st=profileStats(await profileRows());
  const pf={h:st.h, bb100:st.bb100, vp:st.vpP, pr:st.pfP, wsd:st.wsdP, acc:st.accP, ls:lessonsDone(), since:st.since};
  store.set('pyonpoker-pf', JSON.stringify(pf));
  pushProfile();
}
// host side: keep only sane numbers from what a guest says about itself
function cleanPf(p){
  if(!p || typeof p!=='object') return null;
  const n=(x,lo,hi)=>{ x=+x; return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x*10)/10)) : null; };
  return {h:n(p.h,0,1e7), bb100:n(p.bb100,-1e4,1e4), vp:n(p.vp,0,100), pr:n(p.pr,0,100), wsd:n(p.wsd,0,100), acc:p.acc==null?null:n(p.acc,0,100), ls:n(p.ls,0,99), since:n(p.since,0,4e12)};
}

/* achievements: worked out from the saved hands, nothing extra to store */
const ACHV = [
  ['🃏','Первая раздача','Сыграть первую раздачу', st=>st.h>=1],
  ['🏆','Первый банк','Выиграть банк', st=>st.wins>=1],
  ['💯','Сотня','Сыграть 100 раздач', st=>st.h>=100],
  ['🎖','Тысяча','Сыграть 1000 раздач', st=>st.h>=1000],
  ['💰','Большой банк','Выиграть банк больше 50 BB', st=>st.bigBB>=50],
  ['🌊','Флеш','Выиграть с флешем или сильнее', st=>st.bestCat>=5],
  ['🏠','Фулл-хаус','Выиграть с фулл-хаусом или сильнее', st=>st.bestCat>=6],
  ['🍀','Каре','Выиграть с каре или стрит-флешем', st=>st.bestCat>=7],
  ['🤝','С друзьями','Сыграть 10 раздач с людьми', st=>st.people>=10],
  ['🎯','Точность','Точность решений 80% и выше (от 20 раздач)', st=>st.accN>=20 && st.accP>=80],
  ['🎓','Выпускник','Пройти все уроки курса', ()=>lessonsDone()>=LESSONS.length],
  ['🔥','Серия','Ответить 10 раз подряд в тренажёре', ()=>Object.values(drillBest()).some(v=>v>=10)],
];

/* ---------- the profile window ---------- */
function openProfile(){ $('profOv').hidden=false; renderProfile(); }
function closeProfile(){ $('profOv').hidden=true; }
const fmtSigned = n => (n>0?'+':'')+n;
const fmtDate = ts => { try{ return new Date(ts).toLocaleDateString(LANG==='he'?'he-IL':LANG, {day:'numeric', month:'short', year:'numeric'}); }catch(e){ return new Date(ts).toLocaleDateString(); } };

async function renderProfile(){
  const rows=await profileRows(), st=profileStats(rows), box=$('profBody');
  const style = st.vpN>=10 ? styleOf(st.vpP, st.pfP) : null;
  const tile=(label, value, sub, cls='')=>`<div class="ptile"><span class="slabel">${esc(t(label))}</span><b class="${cls}">${esc(value)}</b>${sub?`<span class="muted">${esc(sub)}</span>`:''}</div>`;
  const tiles = [
    tile('Раздач', String(st.h), st.since?t('с {0}', fmtDate(st.since)):''),
    tile('Итог', fmtSigned(st.net), t('{0} BB на 100 раздач', fmtSigned(st.bb100)), st.net>0?'win':st.net<0?'loss':''),
    tile('Выиграно банков', st.winP+'%', String(st.wins)),
    tile('VPIP', st.vpP+'%', t('входите в раздачу')),
    tile('PFR', st.pfP+'%', t('рейз до флопа')),
    tile('W$SD', st.sd?st.wsdP+'%':'—', t('выиграно вскрытий')),
    tile('Точность решений', st.accP==null?'—':st.accP+'%', st.accN?t('по {0} раздачам', st.accN):t('считается…')),
    tile('Лучшая комбинация', st.bestCat>=0?t(HAND_NAMES[st.bestCat]):'—', st.bigBB?t('крупнейший банк {0} BB', Math.round(st.bigBB)):''),
  ].join('');
  const posOrder=['ep','mp','co','btn','sb','bb'];
  const posRows=posOrder.filter(p=>st.pos[p]).map(p=>{ const x=st.pos[p]; return `<tr><td>${esc(t(POS_NAMES[p]))}</td><td>${x.h}</td><td>${x.vpN?Math.round(x.vp/x.vpN*100):0}%</td><td class="${x.net>0?'win':x.net<0?'loss':''}">${fmtSigned(x.net)}</td></tr>`; }).join('');
  const vsRows=[['bots','Против ботов'],['people','С людьми']].filter(([k])=>st.vs[k].h).map(([k,l])=>`<tr><td>${esc(t(l))}</td><td>${st.vs[k].h}</td><td class="${st.vs[k].net>0?'win':st.vs[k].net<0?'loss':''}">${fmtSigned(st.vs[k].net)}</td></tr>`).join('');
  const achv=ACHV.map(([ic,n,d,f])=>{ const on=!!f(st); return `<li class="ach${on?' on':''}" title="${esc(t(d))}"><span class="aic" aria-hidden="true">${ic}</span><span><b>${esc(t(n))}</b><small>${esc(t(d))}</small></span>${on?`<i class="sr">${esc(t('получено'))}</i>`:''}</li>`; }).join('');
  const got=ACHV.filter(a=>a[3](st)).length;
  const bests=drillBest(), bestDrill=Math.max(0, ...Object.values(bests));
  box.innerHTML=`
    <div class="phead">
      <div class="pava">${avatarSVG(CFG.av)}</div>
      <div class="pwho"><h4>${esc(myName())}</h4>${style?`<span class="tag">${esc(t(style.n))}</span>`:`<span class="muted">${esc(t('Стиль определится после 10 раздач'))}</span>`}</div>
      <button type="button" class="btn small" data-pf="avatar">${t('Изменить аватар')}</button>
    </div>
    ${st.h ? `<div class="ptiles">${tiles}</div>
    <section class="pchart"><h5>${t('Итог по раздачам')}</h5><p class="muted small">${t('Сумма выигрышей и проигрышей в фишках после каждой раздачи')}</p><div class="chartbox" id="pfChart"></div></section>
    <div class="ptables">
      ${posRows?`<section><h5>${t('По позициям')}</h5><table class="ptable"><thead><tr><th>${t('Позиция')}</th><th>${t('Раздач')}</th><th>VPIP</th><th>${t('Итог')}</th></tr></thead><tbody>${posRows}</tbody></table></section>`:''}
      ${vsRows?`<section><h5>${t('Соперники')}</h5><table class="ptable"><thead><tr><th></th><th>${t('Раздач')}</th><th>${t('Итог')}</th></tr></thead><tbody>${vsRows}</tbody></table></section>`:''}
    </div>` : `<p class="hint">${t('Здесь появится ваша статистика за всё время. Сыграйте несколько раздач — с ботами, с тренером или с друзьями.')}</p>`}
    <section><h5>${t('Достижения')} <span class="muted">${got}/${ACHV.length}</span></h5><ul class="achs">${achv}</ul></section>
    <section class="prow"><span>${t('Уроков пройдено: {0} из {1}', lessonsDone(), LESSONS.length)}</span>${bestDrill?`<span>${t('Рекорд в тренажёрах: {0}', bestDrill)}</span>`:''}</section>
    <p class="muted small">${t('Статистика хранится только в этом браузере. Друзья за столом видят краткую сводку: число раздач, стиль, VPIP, PFR и точность.')}</p>
    ${st.h?`<button type="button" class="btn small danger" data-pf="clear">${t('Очистить статистику')}</button>`:''}`;
  if(st.h) drawNetChart($('pfChart'), rows);
}

// running result: one series, so no legend; the zero line is the reference
function drawNetChart(el, rows){
  if(!el) return;
  let pts=[], s=0; rows.forEach((r,i)=>{ s+=r.net; pts.push({i:i+1, v:s, at:r.at}); });
  if(pts.length>600){ const step=pts.length/600, out=[]; for(let k=0;k<600;k++) out.push(pts[Math.floor(k*step)]); out.push(pts[pts.length-1]); pts=out; }
  pts.unshift({i:0, v:0, at:rows[0].at});
  const W=Math.max(260, el.clientWidth||600), H=180, L=48, R=12, T=12, B=26;
  let lo=Math.min(0, ...pts.map(p=>p.v)), hi=Math.max(0, ...pts.map(p=>p.v)); if(hi===lo){ hi+=100; lo-=100; }
  const pad=(hi-lo)*.08; lo-=pad; hi+=pad;
  const nice=x=>{ const e=10**Math.floor(Math.log10(Math.abs(x)||1)); return Math.round(x/e)*e; };
  const X=i=>L+(W-L-R)*(i/Math.max(1, pts[pts.length-1].i)), Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  const ticks=[...new Set([nice(hi-pad), 0, nice(lo+pad)])].filter(v=>v<=hi && v>=lo);
  const path=pts.map((p,k)=>(k?'L':'M')+X(p.i).toFixed(1)+' '+Y(p.v).toFixed(1)).join('');
  const last=pts[pts.length-1];
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(t('Итог по раздачам'))}: ${fmtSigned(last.v)}">
    ${ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="${v===0?'zero':'grid'}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" class="tick">${fmtSigned(v)}</text>`).join('')}
    <text x="${L}" y="${H-6}" class="tick">${t('Раздача {0}', 1)}</text><text x="${W-R}" y="${H-6}" text-anchor="end" class="tick">${t('Раздача {0}', last.i)}</text>
    <path d="${path}" class="line"/>
    <circle cx="${X(last.i)}" cy="${Y(last.v)}" r="4" class="end"/>
    <g class="hover" visibility="hidden"><line class="cross" y1="${T}" y2="${H-B}"/><circle r="4" class="dot"/></g>
    <rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" class="hit"/>
  </svg><div class="ctip" hidden></div>`;
  const svg=el.querySelector('svg'), g=svg.querySelector('.hover'), tip=el.querySelector('.ctip');
  const move=e=>{
    const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)*W/r.width;
    let bp=pts[0], bd=1e9; for(const p of pts){ const d=Math.abs(X(p.i)-x); if(d<bd){ bd=d; bp=p; } }
    g.setAttribute('visibility','visible'); g.querySelector('.cross').setAttribute('x1', X(bp.i)); g.querySelector('.cross').setAttribute('x2', X(bp.i));
    g.querySelector('.dot').setAttribute('cx', X(bp.i)); g.querySelector('.dot').setAttribute('cy', Y(bp.v));
    tip.hidden=false; tip.innerHTML=`<b>${esc(fmtSigned(bp.v))}</b><span>${esc(t('Раздача {0}', bp.i))} · ${esc(fmtDate(bp.at))}</span>`;
    const px=X(bp.i)*r.width/W; tip.style.left=Math.max(4, Math.min(r.width-tip.offsetWidth-4, px-tip.offsetWidth/2))+'px';
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', ()=>{ g.setAttribute('visibility','hidden'); tip.hidden=true; });
}

$('profBody').addEventListener('click', async e=>{
  const b=e.target.closest('[data-pf]'); if(!b) return;
  if(b.dataset.pf==='avatar'){ closeProfile(); openSettings('profile'); }
  else if(b.dataset.pf==='clear'){
    if(b.dataset.arm!=='1'){ b.dataset.arm='1'; b.textContent=t('Нажмите ещё раз, чтобы удалить всё'); setTimeout(()=>{ if(b.isConnected){ b.dataset.arm=''; b.textContent=t('Очистить статистику'); } }, 4000); return; }
    await pdbClear(); PF_ROWS=[]; await profileSummaryUpdate(); renderProfile();
  }
});
$('profClose').onclick=closeProfile;
$('profOv').addEventListener('click', e=>{ if(e.target.id==='profOv') closeProfile(); });
$('bProfile').onclick=openProfile;
$('bProfile2').onclick=openProfile;

/* ---------- player cards at the table ---------- */
// short style marks from tonight's play (10+ hands): тайт / луз by VPIP, агро if most voluntary entries are raises
function tableTags(st){
  if(st.h<10) return '';
  const v=st.v/st.h, tags=[], why=[];
  if(v<.18){ tags.push(t('тайт')); why.push(t('играет мало рук')); } else if(v>.42){ tags.push(t('луз')); why.push(t('играет много рук')); }
  if(st.v && st.p/st.v>.6){ tags.push(t('агро')); why.push(t('чаще входит в банк рейзом, чем коллом')); }
  return tags.length ? `<span><span class="tag">${esc(tags.join('-'))}</span> <span class="muted">${esc(why.join(' · '))}</span></span>` : '';
}
function openCard(i){
  if(!S || !S.seats[i]) return;
  const s=S.seats[i], me=s.uid===myUid, st=s.st||EMPTY_ST, pf=me ? mySummary() : s.pf;
  const ev = st.h ? `<div class="pcrow"><span class="slabel">${t('За вечер')}</span><span>${t('Раздач')}: <b>${st.h}</b></span>${st.h>=3?`<span>VPIP <b>${Math.round(st.v/st.h*100)}%</b> · PFR <b>${Math.round(st.p/st.h*100)}%</b></span>`:''}<span>${t('Итог')}: <b class="${st.net>0?'win':st.net<0?'loss':''}">${fmtSigned(st.net)}</b></span>${tableTags(st)}</div>` : '';
  let all='';
  if(s.bot) all=`<p class="muted">${esc(t('Бот, уровень «{0}»', t((LVL[s.lvl||2]||LVL[2]).name)))}</p>`;
  else if(pf && pf.h){
    const style = pf.h>=10 && pf.vp!=null ? styleOf(pf.vp, pf.pr) : null;
    all=`<div class="pcrow"><span class="slabel">${t('За всё время')}</span><span>${t('Раздач')}: <b>${pf.h}</b>${pf.since?` · ${esc(t('с {0}', fmtDate(pf.since)))}`:''}</span>${style?`<span class="tag">${esc(t(style.n))}</span>`:''}<span>VPIP <b>${pf.vp}%</b> · PFR <b>${pf.pr}%</b> · W$SD <b>${pf.wsd}%</b></span><span>${t('{0} BB на 100 раздач', fmtSigned(pf.bb100))}</span>${pf.acc!=null?`<span>${t('Точность решений')}: <b>${pf.acc}%</b></span>`:''}<span>${t('Уроков пройдено: {0} из {1}', pf.ls||0, LESSONS.length)}</span></div>`;
  } else all=`<p class="muted">${esc(t(me ? 'Ваша статистика появится после первых раздач.' : 'Игрок пока не поделился статистикой.'))}</p>`;
  $('pcardBody').innerHTML=`<div class="phead"><div class="pava">${avatarSVG(avatarFor(s))}</div><div class="pwho"><h4>${esc(s.bot?t(s.name):s.name)}</h4>${me?`<span class="muted">${t('вы')}</span>`:''}</div></div>${ev}${all}${me?`<button type="button" class="btn small primary" id="pcardMine">${t('Открыть мой профиль')}</button>`:''}`;
  $('pcardOv').hidden=false;
  const mb=$('pcardMine'); if(mb) mb.onclick=()=>{ closeCard(); openProfile(); };
}
function closeCard(){ $('pcardOv').hidden=true; }
$('pcardClose').onclick=closeCard;
$('pcardOv').addEventListener('click', e=>{ if(e.target.id==='pcardOv') closeCard(); });
$('seats').addEventListener('click', e=>{ const el=e.target.closest('.plate'); if(!el) return; const i=seatNodes.findIndex(N=>N.el.contains(el)); if(i>=0) openCard(i); });

// save the hands already in the history (first run after the update), then keep the summary fresh
setTimeout(async()=>{ if(HIST.length) await profileSave(HIST); else if(!mySummary()) await profileSummaryUpdate(); scheduleAcc(); }, 1500);
