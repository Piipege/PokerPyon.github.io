/* ---------- stats, chat, showing cards ---------- */
function settle(){
  seats().forEach(p=>{ p._delta = p.inHand ? p.won - p.total : 0; if(p.inHand) stOf(p).net += p._delta; });
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
  if(S.board.length>=3) s.handName=HAND_NAMES[best(s.shown.concat(S.board)).cat];
  log(L('{0} показывает {1}', s.name, s.shown.map(fmtCard).join(' ')));
  commit();
}

