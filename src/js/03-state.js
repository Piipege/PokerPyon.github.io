/* ---------- state ---------- */
function mkSeat(o){
  return Object.assign({uid:'',name:'',bot:false,aggr:.5,loose:.08,stack:1000,bet:0,total:0,folded:true,allIn:false,out:false,acted:false,last:'',won:0,shown:null,handName:'',enc:null,inHand:false,left:false,rebuy:0,rebuySeen:0,pub:null}, o);
}
// the buy-in (rebuys and new players) is a fixed number of big blinds: when the blinds go up, so does it
const buyIn = () => !S ? 1000 : Math.max(S.bb||BB, Math.round((S.startBB || (S.start||1000)/BB) * (S.bb||BB) / 10) * 10);
// Omaha is played pot-limit: a raise can be at most to the current bet + the pot after calling
const holeN = () => S && S.game==='omaha' ? 4 : 2;
function maxRaiseTo(i){
  const p=seats()[i], all=p.bet+p.stack;
  if(!S || S.game!=='omaha') return all;
  return Math.min(all, S.currentBet + potTotal() + Math.max(0, S.currentBet-p.bet));
}
function mkState(start){
  return {v:2,start,startBB:start/BB,seats:[],board:[],dealer:-1,street:'',currentBet:0,minRaise:BB,sb:SB,bb:BB,public:false,bombEvery:0,bombBB:5,bomb:false,ghost:null,canGhost:false,paused:false,waits:{},lvl:0,blindEvery:0,help:true,chat:[],aggr:-1,turn:-1,turnId:0,handNo:0,handOver:true,banner:'',best:[],log:[],collect:false,deadline:0,seqs:{},started:false,hostUid:'',hostPub:null,winFx:null,nextAt:0};
}
const seats = () => S.seats;
const canAct = p => !p.out && !p.folded && !p.allIn;
const live = () => seats().filter(p=>!p.out && !p.folded);
const potTotal = () => S ? seats().reduce((s,p)=>s+p.total,0) : 0;
const mySeat = () => S ? seats().findIndex(s=>s.uid===myUid) : -1;
const isDealer = () => MODE==='offline' || MODE==='host';
function nextIdx(from, pred){
  const n=seats().length;
  for(let k=1;k<=n;k++){ const i=((from+k)%n+n)%n; if(pred(seats()[i])) return i; }
  return -1;
}
function log(text, cls=''){ S.log.push({...(text && typeof text==='object' ? {k:text.k, a:text.a} : {text}),cls,id:Date.now()+'-'+Math.random().toString(36).slice(2,6)}); if(S.log.length>70) S.log.splice(0, S.log.length-70); }
const fmtCard = c => (RL[c.r]||c.r)+SUITS[c.s];
const round10 = x => Math.max(10, Math.round(x/10)*10);
const cleanName = n => String(n||'').replace(/[<>&"]/g,'').trim().slice(0,16) || 'Игрок';
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function flow(fn, ms, raw){ clearTimeout(timers.flow); timers.flow = setTimeout(()=>{ timers.flow=null; fn(); }, raw ? ms : ms*SPEEDF()); }
function clearFlow(){ clearTimeout(timers.flow); timers.flow=null; clearTimeout(timers.turn); timers.turn=null; }

function post(i, amt){
  const p=seats()[i]; const a=Math.min(amt,p.stack);
  p.stack-=a; p.bet+=a; p.total+=a;
  if(p.stack===0) p.allIn=true;
  return a;
}

