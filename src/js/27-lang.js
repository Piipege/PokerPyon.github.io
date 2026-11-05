/* ---------- language switch ---------- */
function fillLangSelects(){ const o=LANGS.map(([c,n])=>`<option value="${c}">${n}</option>`).join(''); $('langSel').innerHTML=o; $('cfgLang').innerHTML=o; }
function applyLang(){
  LANG = CFG.lang; document.documentElement.lang=LANG; document.documentElement.dir = LANG==='he' ? 'rtl' : 'ltr';
  applyStatic(); document.title=t('Покерный стол «Пион»');
  $('chat').dataset.empty=t('Здесь будут сообщения стола');
  document.documentElement.style.setProperty('--brand', JSON.stringify(String(t('Пион')).toUpperCase()));
  $('langSel').value=LANG; $('cfgLang').value=LANG;
  seatSig=''; logTop=null; bannerText=null; chatInit=false; statsHtml=''; oddsKey='';
  updSound(); applyKeyBadges(); showResume(); lobbyRender(); renderHandList(); fairState.sig='';
  const pr=loadProgress(); $('learnProg2').textContent=t('Пройдено: {0} из {1}', LESSONS.filter(l=>(pr['l'+l.id]||0)>=4).length, LESSONS.length);
  if(!$('setOv').hidden) renderSettings();
  if(!$('learnOv').hidden) renderLearn();
  if(!$('keysOv').hidden) renderKeysHelp();
  render();
}
function setLang(c){ CFG.lang=c; saveCfg(); applyLang(); }
fillLangSelects();
$('langSel').onchange=e=>setLang(e.target.value);
$('cfgLang').onchange=e=>setLang(e.target.value);

