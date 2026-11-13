/* ---------- boot ---------- */
myUid = myId();
resetView();
$('nick').value = store.get('pyonpoker-nick') || '';
const hashCode = (location.hash.match(/^#t-([a-z0-9]{4})$/i)||[])[1];
function savedHost(){ try{ const r=JSON.parse(localStorage.getItem('pyonpoker-host')||'null'); if(r && r.S && r.code && Date.now()-r.at < 12*3600e3) return r; }catch(e){} return null; }
function renderPfLine(){ const pf=mySummary(); $('pfLine').textContent = pf && pf.h ? t('Мой профиль · {0} раздач · VPIP {1}%', pf.h, pf.vp) : t('Мой профиль и статистика'); }
function showResume(){ try{ showQuick(); renderPfLine(); }catch(e){} const r=savedHost(), g=!r && savedGuest(); $('bResume').hidden=!(r||g); if(r) $('bResume').textContent=t('Вернуться к своему столу {0}', r.code); else if(g) $('bResume').textContent=t('Вернуться за стол {0}', g.code); }
showResume();
if(hashCode){ lobbyTab('open'); $('joinCode').value = hashCode.toUpperCase(); setT($('lobbyTitle'), 'Вас позвали за стол'); }
applyLang();
if(!I18N[LANG]) loadLang(LANG).then(applyLang); // the page guessed another language than the settings say
if(typeof Peer==='undefined'){
  setT($('netNote'), 'Не загрузилась библиотека для игры по сети. Проверьте интернет и обновите страницу. С ботами можно играть и так.');
  ['bCreate','bJoin','joinCode'].forEach(id=>$(id).disabled=true);
} else {
  setT($('netNote'), 'Вкладка ведущего раздаёт карты: держите её открытой, лучше на компьютере.');
  lobbyStart();
  const r=savedHost();
  if(hashCode && r && r.code===hashCode.toUpperCase()) setTimeout(()=>$('bResume').click(), 0);
  else if(hashCode && $('nick').value.trim()) setTimeout(()=>joinTable(hashCode), 0);
}
// test hook (tools/*.mjs set window.PYONPOKER_TEST before the page loads)
if(window.PYONPOKER_TEST) window.__pyonpoker={buyIn, GEN, LESSONS, DRILLS, TERMS, openLiveCoach, liveSpot, weigh, oppInfo, omPct, equityVs, nutsOf, threatsOf, handPct, HIST:()=>HIST, reviewOf, get myUid(){ return myUid; }, coachAsk, openCoach, openLearn, get S(){ return S; }, get MODE(){ return MODE; }};
// offline: on GitHub Pages (or any http server) a service worker keeps a copy of the game
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.PYONPOKER_TEST && !window.PYONPOKER_PEER_OPTS){
  addEventListener('load', ()=>{ navigator.serviceWorker.register((window.PYONPOKER_ROOT||'')+'sw.js', {scope:window.PYONPOKER_ROOT||'./'}).catch(()=>{}); });
}
