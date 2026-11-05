/* ---------- boot ---------- */
myUid = myId();
resetView();
$('nick').value = store.get('pion-nick') || '';
const hashCode = (location.hash.match(/^#t-([a-z0-9]{4})$/i)||[])[1];
function savedHost(){ try{ const r=JSON.parse(localStorage.getItem('pion-host')||'null'); if(r && r.S && r.code && Date.now()-r.at < 12*3600e3) return r; }catch(e){} return null; }
function showResume(){ try{ showQuick(); }catch(e){} const r=savedHost(); $('bResume').hidden=!r; if(r) $('bResume').textContent=t('Вернуться к своему столу {0}', r.code); }
showResume();
if(hashCode){ lobbyTab('open'); $('joinCode').value = hashCode.toUpperCase(); $('lobbyTitle').textContent=t('Вас позвали за стол'); }
applyLang();
if(typeof Peer==='undefined'){
  $('netNote').textContent=t('Не загрузилась библиотека для игры по сети. Проверьте интернет и обновите страницу. С ботами можно играть и так.');
  ['bCreate','bJoin','joinCode'].forEach(id=>$(id).disabled=true);
} else {
  $('netNote').textContent=t('Вкладка ведущего раздаёт карты: держите её открытой, лучше на компьютере.');
  lobbyStart();
  const r=savedHost();
  if(hashCode && r && r.code===hashCode.toUpperCase()) setTimeout(()=>$('bResume').click(), 0);
  else if(hashCode && $('nick').value.trim()) setTimeout(()=>joinTable(hashCode), 0);
}
