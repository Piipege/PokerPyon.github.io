/* ---------- emotes: big emoji over the seat, not in the chat ---------- */
const EMOTES=['👍','😂','😱','🤔','🔥','😎','🙏','💪'];
const lastEmote={};
function emoteShow(uid, e){
  const i=S?S.seats.findIndex(s=>s.uid===uid):-1, N=seatNodes[i]; if(!N) return;
  const el=document.createElement('div'); el.className='emo'; el.textContent=e; N.el.append(el); setTimeout(()=>el.remove(), 2400);
}
function emoteFrom(uid, e){
  if(!EMOTES.includes(e)) return;
  const now=Date.now(); if(lastEmote[uid] && now-lastEmote[uid]<1200) return; lastEmote[uid]=now;
  emoteShow(uid, e);
  if(MODE==='host') for(const c of conns.values()){ try{ if(c.open) c.send({t:'emote', u:uid, e}); }catch(x){} }
}
function sendEmote(e){ if(!S) return; if(MODE==='guest') sendHost({t:'emote', e}); else emoteFrom(myUid, e); }

