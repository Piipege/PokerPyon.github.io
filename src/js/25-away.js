/* ---------- sit out ---------- */
function setAway(i, v){
  const s=seats()[i]; if(!s || !!s.away===v) return;
  s.away=v; if(!v) s.missed=0;
  log(L(v?'{0} отошёл от стола':'{0} вернулся в игру', s.name));
  commit(); if(!v) maybeAutoStart();
}

