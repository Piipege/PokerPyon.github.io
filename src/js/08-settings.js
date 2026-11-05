/* ---------- personal settings ---------- */
const DEF_KEYS={fold:'KeyF',call:'KeyC',callany:'KeyV',raise:'KeyR',min:'Digit1',half:'Digit2',pot:'Digit3',allin:'Digit4',up:'ArrowUp',down:'ArrowDown',next:'Enter',pause:'KeyP',show:'KeyS',ghost:'KeyW',rebuy:'KeyB',chat:'KeyT',sound:'KeyM',settings:'KeyO',help:'KeyH'};
const KEY_DESC={fold:'Сбросить. Пока ходят другие — заранее «Чек / Фолд»',call:'Чек или колл. Пока ходят другие — заранее «Чек» или «Колл»',callany:'Заранее «Колл любую»',raise:'Бет или рейз на выбранную сумму',min:'Сумма: минимальная',half:'Сумма: ½ банка',pot:'Сумма: банк',allin:'Сумма: олл-ин',up:'Сумма больше на большой блайнд (с Shift — ×5)',down:'Сумма меньше на большой блайнд (с Shift — ×5)',next:'Начать игру, раздать сейчас, новая игра',pause:'Пауза перед следующей раздачей. Гостю — попросить +15 с',show:'Показать свои карты после раздачи',ghost:'Посмотреть, какие карты выпали бы',rebuy:'Докупиться',chat:'Написать в чат',sound:'Звук вкл/выкл',settings:'Настройки',help:'Список клавиш'};
function loadCfg(){
  let c={}; try{ c=JSON.parse(localStorage.getItem('pion-cfg')||'{}')||{}; }catch(e){}
  return {
    theme: ['dark','light','auto','night'].includes(c.theme) ? c.theme : 'dark',
    pat: ['none','dots','waves','diamonds'].includes(c.pat)?c.pat:'none', chips: ['pion','casino','neon','candy'].includes(c.chips)?c.chips:'casino', speed: ['fast','normal','slow'].includes(c.speed)?c.speed:'normal', season: ['auto','off','ny','spring'].includes(c.season)?c.season:'auto', fx: c.fx!==false, bgfx: c.bgfx===undefined ? !matchMedia('(max-width:620px)').matches : !!c.bgfx, pack: ['pion','casino','soft','bit'].includes(c.pack)?c.pack:'pion',
    vol: typeof c.vol==='number' ? Math.max(0,Math.min(1,c.vol)) : .7,
    sfx: Object.assign({cards:true,chips:true,turn:true,win:true,chat:true}, c.sfx||{}),
    bb: !!c.bb,
    delay: [3,5,8,12].includes(c.delay) ? c.delay : 5,
    lang: LANGS.some(x=>x[0]===c.lang) ? c.lang : guessLang(),
    table: ['pion','lavender','sakura','emerald','midnight','cherry'].includes(c.table)?c.table:'pion', back: ['pion','lilac','classic','stars','mono'].includes(c.back)?c.back:'pion', face: c.face==='big'?'big':'std',
    tips: c.tips!==false, sumbox: c.sumbox!==false,
    fs: [1,1.15,1.3].includes(+c.fs) ? +c.fs : 1, contrast: !!c.contrast, calm: !!c.calm,
    helpOpen: !!c.helpOpen,
    four: !!c.four, confirm: c.confirm!==false, vibe: c.vibe!==false, vib: Object.assign({turn:true, win:true, timer:true}, c.vib||{}), hideMine: !!c.hideMine, notify: !!c.notify, wake: c.wake!==false,
    turn: c.turn && typeof c.turn==='object' ? {url:String(c.turn.url||''), user:String(c.turn.user||''), pass:String(c.turn.pass||'')} : {url:'',user:'',pass:''},
    keys: Object.assign({}, DEF_KEYS, c.keys||{}),
    av: cleanAv(c.av) || randomAv(),
  };
}
const CFG = loadCfg();
function saveCfg(){ store.set('pion-cfg', JSON.stringify(CFG)); }
saveCfg();
const fmt = n => { if(!(CFG.bb && S && S.bb)) return String(n); const v=n/S.bb; return (v>=100 ? Math.round(v) : Math.round(v*10)/10)+' BB'; };

