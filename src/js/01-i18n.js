/* ---------- languages: every visible string goes through t(); shared table data stores keys, not text ---------- */
const LANGS=[['ru','Русский'],['en','English'],['uk','Українська'],['ka','ქართული'],['fr','Français'],['de','Deutsch'],['ro','Română'],['he','עברית'],['kk','Қазақша']]; // i18n-skip
const I18N = window.PION_I18N || {};
let LANG='ru';
function t(k, ...a){
  if(k==null) return '';
  if(typeof k==='object') return tr(k);
  const d=I18N[LANG], base=I18N.ru;
  let s = (d && d[k]!=null) ? d[k] : (base && base[k]!=null ? base[k] : k);
  if(a.length) s=String(s).replace(/\{(\d+)\}/g,(m,i)=>{ const v=a[+i]; if(v==null) return ''; if(typeof v==='object') return v.amt!=null ? fmtWin(v.amt, v.bb) : tr(v); if(typeof v==='string' && d && d[v]!=null) return d[v]; return v; });
  return s;
}
const L = (k, ...a) => ({k, a});
const AM = n => ({amt:n, bb:(typeof S!=='undefined' && S && S.bb) || 20});
function fmtWin(n, bb){ if(!(CFG.bb && bb)) return String(n); const v=n/bb; return `${n} · ${v>=100?Math.round(v):Math.round(v*10)/10} BB`; }
const tr = x => x==null ? '' : Array.isArray(x) ? x.map(tr).join(' · ') : typeof x==='object' ? t(x.k, ...(x.a||[])) : t(x);
const I18N_NODES=[];
(function collectStatic(){
  const cyr=/[А-Яа-яЁё]/;
  const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode:n=> cyr.test(n.nodeValue) && !n.parentElement.closest('script,style') ? 1 : 3});
  let n; while((n=w.nextNode())){ const v=n.nodeValue; I18N_NODES.push({n, pre:v.match(/^\s*/)[0], post:v.match(/\s*$/)[0], k:v.trim()}); }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>['placeholder','title','aria-label'].forEach(at=>{ const v=el.getAttribute(at); if(v && cyr.test(v)) I18N_NODES.push({el, at, k:v}); }));
})();
function applyStatic(){ for(const x of I18N_NODES){ if(x.n) x.n.nodeValue = x.pre + t(x.k) + x.post; else x.el.setAttribute(x.at, t(x.k)); } }
function guessLang(){ const l=(navigator.language||'ru').slice(0,2).toLowerCase(); const map={iw:'he'}; const c=map[l]||l; return LANGS.some(x=>x[0]===c) ? c : (l==='be'?'ru':'en'); }

const tabId = Math.random().toString(36).slice(2,10);

let MODE = 'lobby';          // lobby | offline | host | guest
let S = null;                // public table state
let H = {deck:[], hands:{}}; // dealer-only secrets: deck and hole cards
let myUid = 'me';
let db = null, userCap = null, code = null;
let unsub = {table:null, joins:null, acts:null};
let timers = {flow:null, turn:null, lease:null};
let keys = null, myCards = null, myCardsFor = '';
let pending = null;
let rebuyAsked = 0;

const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};

