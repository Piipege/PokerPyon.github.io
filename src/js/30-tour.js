/* ---------- first-visit tour: three short cards pointing at the main places ---------- */
// Two cards in the main menu (how to start, where profile/learning/settings are) and one on the
// first own turn (what the buttons do). Seen once; Settings → «show tips for beginners again».
const TOUR_LOBBY = [
  ['.lobbybox .ltiles', 'Выберите, как играть. Проще всего начать с ботов — это работает и без интернета.'],
  ['.hnav', 'Здесь ваш профиль со статистикой, обучение с тренером и настройки: тема, звук, вибрация, размер текста.'],
];
const TOUR_GAME = ['.controls', 'Ваш ход. «Сбросить» — выйти из раздачи, «Чек» или «Колл» — продолжить, «Рейз» — повысить; ползунок задаёт ставку. Нажмите на игрока, чтобы увидеть его статистику.'];
const tourOn = () => !window.PION_TEST || window.PION_TOUR;
let tourEl=null, tourTarget=null;
function tourClose(){ if(tourEl){ tourEl.remove(); tourEl=null; } if(tourTarget){ tourTarget.classList.remove('tourfocus'); tourTarget=null; } removeEventListener('resize', tourPlace); }
function tourPlace(){
  if(!tourEl || !tourTarget) return;
  const r=tourTarget.getBoundingClientRect(), c=tourEl.getBoundingClientRect(), m=12;
  let top = r.bottom + m + c.height < innerHeight ? r.bottom + m : Math.max(m, r.top - m - c.height);
  if(r.bottom + m + c.height >= innerHeight && r.top - m - c.height < 0) top = Math.max(m, innerHeight - c.height - m);
  const left = Math.max(m, Math.min(innerWidth - c.width - m, r.left + r.width/2 - c.width/2));
  tourEl.style.top=top+'px'; tourEl.style.left=left+'px';
}
function tourShow(sel, text, n, total, next){
  tourClose();
  const target=[...document.querySelectorAll(sel)].find(e=>e.offsetParent!==null); if(!target){ next(false); return; }
  tourTarget=target; target.classList.add('tourfocus');
  tourEl=document.createElement('div'); tourEl.className='tourcard'; tourEl.setAttribute('role','dialog'); tourEl.setAttribute('aria-live','polite');
  tourEl.innerHTML=`<p>${esc(t(text))}</p><div class="row"><span class="muted">${n} / ${total}</span><button type="button" class="btn small ghost" data-tour="skip">${t('Пропустить')}</button><button type="button" class="btn small primary" data-tour="next">${t(n<total?'Дальше':'Понятно')}</button></div>`;
  document.body.append(tourEl);
  tourEl.onclick=e=>{ const b=e.target.closest('[data-tour]'); if(!b) return; tourClose(); next(b.dataset.tour==='next'); };
  tourPlace(); addEventListener('resize', tourPlace);
  setTimeout(()=>{ try{ tourEl && tourEl.querySelector('[data-tour="next"]').focus({preventScroll:true}); }catch(e){} }, 50);
}
function tourLobby(k=0){
  if(k>=TOUR_LOBBY.length || MODE!=='lobby'){ store.set('pion-tour','1'); return; }
  tourShow(TOUR_LOBBY[k][0], TOUR_LOBBY[k][1], k+1, TOUR_LOBBY.length+1, go=>{ if(go) tourLobby(k+1); else { store.set('pion-tour','1'); store.set('pion-tour3','1'); } });
}
function tourStart(){ if(tourOn() && !store.get('pion-tour') && MODE==='lobby' && !$('lobby').hidden) tourLobby(0); }
// the third card waits for the first own turn
setInterval(()=>{
  if(!tourOn() || tourEl || store.get('pion-tour3') || !S || !myTurn()) return;
  tourShow(TOUR_GAME[0], TOUR_GAME[1], 3, 3, ()=>store.set('pion-tour3','1'));
}, 800);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && tourEl){ tourClose(); store.set('pion-tour','1'); store.set('pion-tour3','1'); } });
$('tourAgain').onclick=()=>{ try{ localStorage.removeItem('pion-tour'); localStorage.removeItem('pion-tour3'); }catch(e){} closeSettings(); if(MODE==='lobby'){ lobbyTab('home'); setTimeout(tourStart, 300); } else toast(t('Подсказки покажутся снова в главном меню и на следующем ходу')); };
setTimeout(tourStart, 900);
