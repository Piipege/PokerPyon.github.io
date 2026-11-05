/* ---------- keyboard: bound to key positions, rebindable in settings ---------- */
const KEY_LABEL={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Enter:'↵',NumpadEnter:'↵',Space:'Пробел',Slash:'/',Backslash:'\\',Backquote:'`',Minus:'-',Equal:'=',Comma:',',Period:'.',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Tab:'Tab',Backspace:'⌫',Delete:'Del',Home:'Home',End:'End',PageUp:'PgUp',PageDown:'PgDn',Insert:'Ins'};
const keyLabel = c => !c ? '—' : (c==='Space'?t('Пробел'):KEY_LABEL[c]) || c.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ');
let keyAction={};
function buildKeyMap(){ keyAction={}; for(const [a,c] of Object.entries(CFG.keys)) keyAction[c]=a; }
buildKeyMap();
const BADGES={bFold:'fold',bCall:'call',bRaise:'raise',preCF:'fold',preC:'call',preCA:'callany',pHalf:'half',pPot:'pot',pAll:'allin',bNext:'next',restart:'next',bShow:'show',bGhost:'ghost',bPause:'pause',bWait:'pause',bRebuy:'rebuy',bSound:'sound',bKeys:'help',bSettings:'settings'};
function applyKeyBadges(){ for(const [id,a] of Object.entries(BADGES)){ const b=$(id); if(b) b.dataset.key=keyLabel(CFG.keys[a]); } }
applyKeyBadges();
function renderKeysHelp(){ $('keysList').innerHTML=Object.keys(DEF_KEYS).map(a=>`<dt>${esc(keyLabel(CFG.keys[a]))}</dt><dd>${t(KEY_DESC[a])}</dd>`).join('')+`<dt>Esc</dt><dd>${t('Отменить действие заранее, закрыть окно, выйти из чата')}</dd>`; }
const toggleKeys = show => { const v = show ?? $('keysOv').hidden; if(v) renderKeysHelp(); $('keysOv').hidden = !v; };
$('bKeys').onclick=()=>toggleKeys(true);
$('keysClose').onclick=()=>toggleKeys(false);
function clickIf(id){ const b=$(id); if(b && !b.hidden && !b.disabled && b.offsetParent!==null){ b.click(); return true; } return false; }

document.addEventListener('keydown',e=>{
  if(rebinding) return;
  const t=e.target, tag=t.tagName;
  if(t.id==='chatIn' && e.key==='Escape'){ t.blur(); return; }
  if(t.id==='coachIn' && e.key==='Escape'){ closeCoach(); return; }
  if(['INPUT','SELECT','TEXTAREA'].includes(tag) && !['range','checkbox'].includes(t.type)) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key==='Escape'){
    if(!$('setOv').hidden) closeSettings();
    else if(!$('keysOv').hidden) toggleKeys(false);
    else if(!$('pcardOv').hidden) closeCard();
    else if(!$('profOv').hidden) closeProfile();
    else if(!$('coachOv').hidden) closeCoach();
    else if(!$('replayOv').hidden) closeReplay();
    else if(!$('learnOv').hidden) closeLearn();
    else if(pre){ pre=null; render(); }
    return;
  }
  if(!$('setOv').hidden || !$('coachOv').hidden || !$('learnOv').hidden || !$('profOv').hidden) return;
  const a = keyAction[e.code];
  if(!$('keysOv').hidden){ if(a==='help' || e.key==='?'){ toggleKeys(false); e.preventDefault(); } return; }
  if(a==='help' || e.key==='?'){ toggleKeys(true); e.preventDefault(); return; }
  if(!a) return;
  if(tag==='BUTTON' && (e.code==='Enter' || e.code==='Space')) return;
  const preOn = !$('preRow').hidden;
  let done=true;
  switch(a){
    case 'sound': $('bSound').click(); break;
    case 'settings': openSettings(); break;
    case 'fold': preOn ? clickIf('preCF') : clickIf('bFold'); break;
    case 'call': preOn ? clickIf('preC') : clickIf('bCall'); break;
    case 'callany': if(preOn) clickIf('preCA'); break;
    case 'raise': clickIf('bRaise'); break;
    case 'min': if(S && myTurn() && !$('amt').disabled) setAmt(raiseBounds().min); break;
    case 'half': clickIf('pHalf'); break;
    case 'pot': clickIf('pPot'); break;
    case 'allin': clickIf('pAll'); break;
    case 'up': case 'down':
      if(tag==='INPUT' || !S || !myTurn() || $('amt').disabled){ done=false; break; }
      setAmt(+$('amt').value + (a==='up'?1:-1)*(S.bb||BB)*(e.shiftKey?5:1)); break;
    case 'next': if(!clickIf('bNext') && !clickIf('restart')) done=false; break;
    case 'pause': if(!clickIf('bPause')) clickIf('bWait'); break;
    case 'show': clickIf('bShow'); break;
    case 'ghost': clickIf('bGhost'); break;
    case 'rebuy': clickIf('bRebuy'); break;
    case 'chat': $('chatIn').focus(); break;
    default: done=false;
  }
  if(done) e.preventDefault();
});

