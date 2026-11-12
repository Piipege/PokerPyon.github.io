/* ---------- stats, chat, showing cards ---------- */
function settle(){
  seats().forEach(p=>{ p._delta = p.inHand ? p.won - p.total : 0; if(p.inHand) stOf(p).net += p._delta; });
  if(S.ko) koSettle();
}
/* knockout: who went out this hand, their place, and a trophy for the player who knocked them out */
function koSettle(){
  const winner = seats().filter(p=>p.won>0).sort((a,b)=>b.won-a.won)[0];
  const busted = seats().filter(p=>p.inHand && p.stack<=0 && !p.busted).sort((a,b)=>a.total-b.total);
  let left = seats().filter(p=>!p.busted).length;
  busted.forEach(p=>{
    p.busted=true; p.place=left--;
    if(winner && winner!==p){ winner.kos=(winner.kos||0)+1; log(L('{0} выбивает {1} — {2} место', winner.name, p.name, p.place),'sep'); }
    else log(L('{0} выбывает — {1} место', p.name, p.place),'sep');
  });
}
function koStandings(){ return seats().slice().sort((a,b)=>(a.place||0)-(b.place||0)).map(p=>({name:p.bot?t(p.name):p.name, uid:p.uid, place:p.place||1, kos:p.kos||0})); }
// the tournament ends when one player is left, or (playing alone with bots) when you are out
function koCheckEnd(){
  if(S.koDone) return;
  const alive=seats().filter(p=>!p.busted && !p.left);
  const meOut = MODE==='offline' && seats()[0] && seats()[0].busted;
  if(alive.length>1 && !meOut) return;
  if(alive.length===1) alive[0].place=1;
  S.koDone={at:Date.now(), standings:koStandings()};
  S.handOver=true; S.turn=-1; S.nextAt=0; clearFlow();
  if(alive.length===1){ S.banner=L('{0} выигрывает турнир!', alive[0].name); log(L('{0} выигрывает турнир!', alive[0].name),'win'); }
  else S.banner=L('Вы выбыли — {0} место', seats()[0].place);
}
function koRestart(){
  if(!isDealer() || !S) return;
  seats().forEach(p=>Object.assign(p,{stack:S.start, busted:false, place:0, kos:0, out:false, rebuy:0, rebuySeen:0}));
  S.lvl=0; S.sb=SB; S.bb=BB; S.koDone=null; S.banner=L('Новый турнир!'); log(L('Новый турнир!'),'sep');
  commit(); flow(startHand, 1200);
}
const SAY = {
  win:['Спасибо за фишки','Всё по плану','Хорошо зашло','gg','Беру'],
  lose:['Ну этот ривер…','Как так-то','Ладно, отыграюсь','Карта не идёт','Больно'],
  reply:['Ха','Согласен','Ну-ну','Играем дальше','😄','Посмотрим','Это покер'],
  taunt:['слишком часто входишь в раздачи','читаю тебя как книгу','попробуй потерпеть'],
};
function botSay(seat, text){
  setTimeout(()=>{ if(S && isDealer() && seats().includes(seat)) addChat(seat.uid, seat.name, text, true); }, 900+Math.random()*1600);
}
function banter(){
  if(!isDealer()) return;
  seats().forEach(s=>{
    if(!s.bot) return; const d=s._delta||0;
    if(d>=S.bb*15 && Math.random()<.4) botSay(s, pick(SAY.win));
    else if(d<=-S.bb*15 && Math.random()<.35) botSay(s, pick(SAY.lose));
  });
  const shark=seats().find(s=>s.bot && s.lvl===4 && !s.out);
  if(shark && Math.random()<.08){
    const loose=seats().find(s=>!s.bot && s.st && s.st.h>=12 && s.st.v/s.st.h>.45);
    if(loose) botSay(shark, L('{0}, {1}', loose.name, pick(SAY.taunt)));
  }
}
const lastChat={};
function addChat(uid, name, text, fromBot){
  if(!S) return;
  if(!(fromBot && typeof text==='object')){ text=String(text||'').replace(/\s+/g,' ').trim().slice(0,200); if(!text) return; }
  const now=Date.now();
  if(!fromBot && lastChat[uid] && now-lastChat[uid]<350) return;
  lastChat[uid]=now;
  S.chat=S.chat||[];
  S.chat.push({id:now+'-'+Math.random().toString(36).slice(2,6), uid, name, text, bot:!!fromBot});
  if(S.chat.length>50) S.chat.splice(0, S.chat.length-50);
  commit();
  if(!fromBot && Math.random()<.25){ const bots=seats().filter(s=>s.bot && !s.out); if(bots.length) botSay(pick(bots), pick(SAY.reply)); }
}
function sendChat(text){
  if(!S) return toast(t('Сначала сядьте за стол'));
  if(MODE==='guest'){ if(!sendHost({t:'chat', text})) toast(t('Нет связи с ведущим')); }
  else { const s=seats()[mySeat()]; addChat(myUid, s?s.name:myName(), text); }
}
function showCards(i){
  const s=seats()[i];
  if(!s || !S.handOver || !s.inHand || s.shown || !H.hands[i]) return;
  s.shown=H.hands[i]; fairOpen(s.shown);
  if(S.board.length>=3) s.handName=HAND_NAMES[bestHand(s.shown, S.board).cat];
  log(L('{0} показывает {1}', s.name, s.shown.map(fmtCard).join(' ')));
  commit();
}


// end of a knockout: standings for everyone at the table; the dealer can start a new one
let koShown=0;
function renderKo(){
  if(!S || !S.koDone || koShown===S.koDone.at) return;
  koShown=S.koDone.at;
  const st=S.koDone.standings, me=st.find(x=>x.uid===myUid);
  $('ovTitle').textContent = me && me.place===1 ? t('Вы выиграли турнир!') : t('Турнир окончен');
  $('ovText').innerHTML = (me?`<p>${esc(t('Ваше место: {0} из {1}. Выбито соперников: {2}.', me.place, st.length, me.kos))}</p>`:'')
    + `<ol class="kolist">${st.map(x=>`<li class="${x.uid===myUid?'me':''}"><b>${x.place}</b><span>${esc(x.name)}</span>${x.kos?`<em>🎯 ${x.kos}</em>`:''}</li>`).join('')}</ol>`;
  $('restart').hidden = !isDealer(); setT($('restart'), 'Новый турнир');
  $('overlay').hidden=false;
  if(me && me.place===1){ try{ SFX.win(); }catch(e){} buzz('win'); }
}
