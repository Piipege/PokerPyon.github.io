/* ---------- settings dialog ---------- */
let rebinding=null;
function wireTabs(sel, attr, paneAttr, root, onShow){
  const tabs=[...root.querySelectorAll(sel)];
  const show=v=>{ tabs.forEach(b=>b.setAttribute('aria-selected', b.getAttribute(attr)===v)); root.querySelectorAll(`[${paneAttr}]`).forEach(p=>p.hidden=p.getAttribute(paneAttr)!==v); onShow && onShow(v); };
  tabs.forEach(b=>b.onclick=()=>show(b.getAttribute(attr)));
  return show;
}
const setTab = wireTabs('[data-stab]','data-stab','data-spane',$('setOv'), v=>{ rebinding=null; if(v==='keys') renderRebind(); });
function openSettings(tab){ $('setOv').hidden=false; if(tab) setTab(tab); renderSettings(); }
function closeSettings(){ rebinding=null; $('setOv').hidden=true; }
$('bSettings').onclick=()=>openSettings();
$('setClose').onclick=closeSettings;
$('setOv').addEventListener('click', e=>{ if(e.target.id==='setOv') closeSettings(); });
$('lobbyAva').onclick=()=>openSettings('profile');

function renderAvEditor(){
  $('avBig').innerHTML=avatarSVG(CFG.av);
  $('lobbyAva').innerHTML=avatarSVG(CFG.av);
  const LABEL={kind:'Вид',bg:'Фон',skin:'Кожа',eyes:'Глаза',mouth:'Рот',hair:'Причёска и шапка',hc:'Цвет волос и шапки',acc:'Аксессуар',shirt:'Одежда'};
  $('avParts').innerHTML=AV_KEYS.map(k=>{
    const list=AVP[k], cur=CFG.av[k];
    const body = list[0].startsWith('#')
      ? `<div class="sw">${list.map((c,i)=>`<button type="button" class="swatch" data-k="${k}" data-v="${i}" aria-pressed="${i===cur}" aria-label="${t(LABEL[k])} ${i+1}" style="background:${c}"></button>`).join('')}</div>`
      : `<div class="stepper"><button type="button" class="btn small" data-k="${k}" data-d="-1" aria-label="${t('Назад')}">‹</button><span>${t(list[cur])}</span><button type="button" class="btn small" data-k="${k}" data-d="1" aria-label="${t('Дальше')}">›</button></div>`;
    return `<div class="part"><span class="plabel">${t(LABEL[k])}</span>${body}</div>`;
  }).join('');
}
$('avParts').onclick=e=>{
  const b=e.target.closest('button[data-k]'); if(!b) return;
  const k=b.dataset.k, n=AVP[k].length;
  CFG.av[k] = b.dataset.v!==undefined ? +b.dataset.v : ((CFG.av[k]+(+b.dataset.d))%n+n)%n;
  saveCfg(); renderAvEditor(); pushProfile();
};
$('avRand').onclick=()=>{ CFG.av=randomAv(); saveCfg(); renderAvEditor(); pushProfile(); };

