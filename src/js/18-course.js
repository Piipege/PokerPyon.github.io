/* ---------- course: theory and practice, from the basics to a winning strategy ---------- */
const C2 = s => ({r:'23456789TJQKA'.indexOf(s[0])+2, s:'shdc'.indexOf(s[1])});
const cardsOf = str => str.split(' ').map(C2);
const COMBO_EX=['Ks Jd 8c 5h 2s','Qh Qs 9d 6c 3h','Jh Jc 7s 7d Ac','8s 8h 8d Kc 4s','9c Td Jh Qs Kd','Ah Jh 9h 6h 2h','Ts Th Td 4c 4h','5s 5h 5d 5c Kh','5d 6d 7d 8d 9d'];
const HAND_DEFS=['Старшая карта — ничего не собралось, решает самая высокая карта.','Пара — две карты одного ранга.','Две пары — две разные пары.','Сет — три карты одного ранга.','Стрит — пять карт подряд по рангу, масти любые.','Флеш — пять карт одной масти.','Фулл-хаус — тройка и пара.','Каре — четыре карты одного ранга.','Стрит-флеш — пять карт подряд одной масти.'];
const STREET_NAMES=['Префлоп','Флоп','Тёрн','Ривер','Вскрытие'];
const STYLES=[
  {n:'Тайт-агрессивный', v:[15,22], p:[12,19], c:'Уважать его ставки: без сильной руки не платить'},
  {n:'Луз-пассивный', v:[40,60], p:[3,9], c:'Реже блефовать и больше ставить с сильными руками'},
  {n:'Луз-агрессивный', v:[35,50], p:[25,34], c:'Чаще уравнивать его с хорошими руками'},
  {n:'Тайт-пассивный', v:[10,16], p:[2,5], c:'На его рейз сбрасывать средние руки'},
];
const LESSONS=[
  {id:1, gen:['l1street','l1count','l1blind','l1hole','l1win']},
  {id:2, gen:['l2name','l2name','l2name','l2cmp','l2name'], ex:true},
  {id:3, gen:['l3win','l3win','l3win','l3win','l3win']},
  {id:4, gen:['l4check','l4call','l4minr','l4allin','l4minr'], play:true},
  {id:5, gen:['l5pre','l5pre','l5pos','l5pre','l5pre']},
  {id:6, gen:['l6outs','l6outs','l6flop','l6turn','l6outs']},
  {id:7, gen:['l7need','l7need','l7dec','l7dec','l7need'], play:true},
  {id:8, gen:['l8river','l8river','l8size','l8river','l8river'], play:true},
  {id:9, gen:['l9style','l9style','l9counter','l9tp','l9counter']},
  {id:10, gen:['l5pre','l6outs','l7dec','l10roll','l10tilt'], play:true},
];
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const shuf=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
function mc(correct, distractors){ const opts=shuf([correct, ...distractors.filter(d=>d!==correct).slice(0,3)]); return {opts, ans:opts.indexOf(correct)}; }
function numOpts(ans, cands){ const set=[...new Set(cands.filter(x=>x!==ans && x>0))]; return mc(ans, shuf(set).slice(0,3)); }
function pctOpts(ans){ return numOpts(ans, [ans-15,ans-9,ans+8,ans+14,ans+21,Math.round(ans/2),ans*2].map(x=>Math.max(1,Math.min(99,Math.round(x))))); }
const cardsRow = cs => `<div class="srow">${cs.map(c=>cardHTML(c)).join('')}</div>`;
function scene(parts){ return `<div class="scene">${parts.map(([label,html])=>`<div class="sblock"><span class="slabel">${t(label)}</span>${html}</div>`).join('')}</div>`; }
const deal = n => shuffle(freshDeck()).slice(0,n);
const fmtCards = cs => cs.map(fmtCard).join(' ');

const GEN = {
  l1street(){ const i=rint(0,3); const o=mc(STREET_NAMES[i+1], STREET_NAMES.filter((_,k)=>k!==i+1)); return {q:L('Какая улица идёт после этой: {0}?', STREET_NAMES[i]), ...o, exp:'Порядок: префлоп → флоп → тёрн → ривер → вскрытие.'}; },
  l1count(){ const i=rint(0,3), ans=['0','3','4','5'][i]; return {q:L('Сколько общих карт открыто на улице «{0}»?', STREET_NAMES[i]), ...mc(ans,['0','3','4','5']), exp:'Флоп — три общие карты, тёрн — четвёртая, ривер — пятая. На префлопе общих карт нет.'}; },
  l1blind(){ return {q:'Кто ставит малый блайнд?', ...mc('Игрок слева от дилера',['Сам дилер','Игрок справа от дилера','Игрок с самым большим стеком']), exp:'Малый блайнд — первый игрок слева от дилера, большой — следующий за ним.'}; },
  l1hole(){ return {q:'Сколько закрытых карт получает каждый игрок?', ...mc('2',['1','3','5']), exp:'В холдеме у каждого две свои карты.'}; },
  l1win(){ return {q:'Вы поставили на флопе, и все соперники сбросили карты. Что дальше?', ...mc('Вы забираете банк без вскрытия',['Нужно доиграть до ривера','Банк делится между всеми','Раздача переигрывается']), exp:'Если остался один игрок, он забирает банк сразу. Карты можно не показывать.'}; },
  l2name(){
    const cat = Math.random()<.5 ? rint(4,8) : rint(0,3);
    let five;
    if(cat>=4){ five=cardsOf(COMBO_EX[cat]); const s=rint(0,3), shift=rint(-2,2); five=five.map(c=>({r:Math.max(2,Math.min(14,c.r+(cat===4||cat===8?shift:0))), s: cat===5||cat===8 ? s : c.s})); if(cat===4||cat===8){ const lo=Math.max(2,Math.min(10,five[0].r)); five=five.map((c,k)=>({r:lo+k,s:c.s})); } }
    else { for(let i=0;i<500;i++){ const d=deal(5); if(Math.floor(eval5(d)/P5)===cat){ five=d; break; } } }
    five.sort((a,b)=>b.r-a.r);
    const real=Math.floor(eval5(five)/P5);
    return {q:'Как называется эта комбинация?', scene:scene([['Карты',cardsRow(five)]]), ...mc(HAND_NAMES[real], shuf(HAND_NAMES.filter((_,k)=>k!==real))), exp:HAND_DEFS[real]};
  },
  l2cmp(){ const a=rint(0,8); let b=rint(0,8); while(b===a) b=rint(0,8); const hi=Math.max(a,b); return {q:'Какая комбинация сильнее?', opts:[HAND_NAMES[a],HAND_NAMES[b]], ans:a===hi?0:1, exp:'Старшинство: стрит-флеш › каре › фулл-хаус › флеш › стрит › сет › две пары › пара › старшая карта.'}; },
  l3win(){
    const d=deal(9), board=d.slice(0,5), A=d.slice(5,7), B=d.slice(7,9);
    const ba=best(A.concat(board)), bb=best(B.concat(board));
    const ans = ba.v>bb.v ? 0 : bb.v>ba.v ? 1 : 2;
    return {q:'Кто выигрывает?', scene:scene([['Стол',cardsRow(board)],['Игрок A',cardsRow(A)],['Игрок B',cardsRow(B)]]), opts:['Игрок A','Игрок B','Ничья, банк делится'], ans,
      exp:L('У игрока A: {0} ({1}). У игрока B: {2} ({3}).', HAND_NAMES[ba.cat], fmtCards(ba.cards), HAND_NAMES[bb.cat], fmtCards(bb.cards))};
  },
  l4check(){ return {q:'До вас на этой улице никто не ставил. Что можно сделать?', ...mc('Чек или бет',['Только колл','Колл или рейз','Только пас']), exp:'Без ставки перед вами можно пропустить ход (чек) или поставить самому (бет).'}; },
  l4call(){ const b=rint(2,15)*10; return {q:L('Соперник поставил {0}. Вы ещё ничего не вкладывали на этой улице. Сколько стоит колл?', b), ...numOpts(b,[b*2,b/2,b+20,b*3].map(x=>Math.round(x/10)*10)), exp:L('Колл — уравнять ставку, то есть доложить {0}.', b)}; },
  l4minr(){ const bb=[10,20,50][rint(0,2)], r=bb*rint(2,4), ans=r+(r-bb); return {q:L('Большой блайнд {0}, соперник рейзит до {1}. До какой суммы минимум можно повысить?', bb, r), ...numOpts(ans,[r+bb, r*2+bb, r*3, r+bb*2]), exp:L('Соперник повысил на {0}, значит минимальный рейз — до {1} + {0} = {2}.', r-bb, r, ans)}; },
  l4allin(){ const st=rint(3,9)*10, bet=st+rint(2,10)*10; return {q:L('У вас осталось {0} фишек, соперник ставит {1}. Что вы можете сделать?', st, bet), ...mc(L('Пас или колл олл-ин на {0}', st),[L('Только пас'), L('Только колл на {0}', bet), L('Рейз до {0}', bet*2)]), exp:'Если ставка больше стека, колл — это олл-ин на все фишки. Остальное уходит в побочный банк, который вы не разыгрываете.'}; },
  l5pre(){
    for(let i=0;i<300;i++){
      const h=deal(2), pc=pctOf(h[0],h[1]), late=Math.random()<.5, thr=late?.28:.10;
      if(Math.abs(pc-thr)<.03) continue;
      const pos = late ? 'поздняя (баттон)' : 'ранняя (первый после блайндов)';
      return {q:L('Позиция: {0}. До вас все сбросили. Что делать с этой рукой?', pos), scene:scene([['Ваши карты',cardsRow(h)]]), opts:['Рейз','Колл','Пас'], ans: pc<=thr?0:2,
        exp:L('Это примерно топ {0}% стартовых рук. С ранней позиции рейзим около 10% лучших рук, с поздней — около 28%. Просто уравнивать блайнд (колл) невыгодно.', Math.max(1,Math.round(pc*100)))};
    }
  },
  l5pos(){ return {q:'Какая позиция лучшая после флопа?', ...mc('Дилер (баттон)',['Малый блайнд','Большой блайнд','Первый после блайндов']), exp:'Дилер ходит последним на флопе, тёрне и ривере и видит решения всех соперников.'}; },
  _draw(){
    for(let i=0;i<4000;i++){
      const d=deal(5), h=d.slice(0,2), f=d.slice(2,5);
      if(new Set(f.map(c=>c.r)).size<3) continue;
      const now=best(h.concat(f)); if(now.cat>=4 || now.cat>=2) continue;
      const known=new Set(d.map(cardKey)); const outs=[];
      for(const c of freshDeck()){ if(known.has(cardKey(c))) continue; if(best(h.concat(f,[c])).cat>=4) outs.push(c); }
      if([4,8,9,12,15].includes(outs.length)) return {h,f,outs};
    }
  },
  l6outs(){ const x=GEN._draw(); return {q:'Сколько у вас аутов, чтобы собрать стрит или флеш?', scene:scene([['Флоп',cardsRow(x.f)],['Ваши карты',cardsRow(x.h)]]), ...numOpts(x.outs.length,[4,6,8,9,12,15]),
    exp:L('{0} аутов: {1}. По правилу 2 и 4 это ≈{2}% до ривера.', x.outs.length, fmtCards(x.outs), x.outs.length*4)}; },
  l6flop(){ const o=[4,8,9,12,15][rint(0,4)]; return {q:L('У вас {0} аутов на флопе. Какой примерно шанс собрать руку к риверу?', o), ...pctOpts(o*4), exp:L('Правило 2 и 4: на флопе умножаем ауты на 4 — {0} × 4 ≈ {1}%.', o, o*4)}; },
  l6turn(){ const o=[4,8,9,12,15][rint(0,4)]; return {q:L('У вас {0} аутов на тёрне. Какой примерно шанс собрать руку на ривере?', o), ...pctOpts(o*2), exp:L('На тёрне осталась одна карта: умножаем ауты на 2 — {0} × 2 ≈ {1}%.', o, o*2)}; },
  l7need(){ const P=[60,80,100,120,150,200,300][rint(0,6)], B=Math.max(10,Math.round(P*[.25,.33,.5,.66,.75,1][rint(0,5)]/10)*10), pot=P+B, need=Math.round(B/(pot+B)*100);
    return {q:L('В банке {0} вместе со ставкой соперника {1}. Какой шанс на победу нужен, чтобы колл был выгоден?', pot, B), ...pctOpts(need), exp:L('Колл {0} ÷ (банк {1} + колл {0}) ≈ {2}%.', B, pot, need)}; },
  l7dec(){
    for(let i=0;i<50;i++){
      const o=[4,8,9,12,15][rint(0,4)], P=[100,150,200,300][rint(0,3)], B=Math.max(10,Math.round(P*[.25,.33,.5,.75,1][rint(0,4)]/10)*10), pot=P+B;
      const need=Math.round(B/(pot+B)*100), eq=o*2;
      if(Math.abs(eq-need)<4) continue;
      return {q:L('Тёрн. У вас {0} аутов. В банке {1} вместе со ставкой соперника {2}. Колл или пас?', o, pot, B), opts:['Колл','Пас'], ans: eq>need?0:1,
        exp:L('Шанс ≈ {0} × 2 = {1}%, а для колла нужно {2}%. {3}', o, eq, need, eq>need?'Колл выгоден на дистанции.':'Колл убыточен, лучше сбросить.')};
    }
  },
  l8river(){
    for(let i=0;i<60;i++){
      const d=deal(7), h=d.slice(0,2), b=d.slice(2,7), eq=equity(h,b,1,350);
      if(Math.abs(eq-.7)<.06 || Math.abs(eq-.35)<.06) continue;
      const ans = eq>=.7 ? 0 : eq>.35 ? 1 : 2;
      const why = ['Рука сильная: ставьте, чтобы худшие руки заплатили.','Рука средняя: ставка прогонит худшие руки, а заплатят только лучшие. Лучше чек.','На вскрытии такая рука почти всегда проигрывает. Иногда стоит блефовать — особенно против одного соперника, который показал слабость.'][ans];
      return {q:'Ривер, против вас один соперник, он сыграл чек. Что лучше?', scene:scene([['Стол',cardsRow(b)],['Ваши карты',cardsRow(h)]]), opts:['Ставка на вэлью','Чек','Блеф'], ans,
        exp:L('{0} Против случайной руки вы выигрываете ≈{1}%.', why, Math.round(eq*100))};
    }
  },
  l8size(){ return {q:'Вы ставите на вэлью. Какой размер ставки обычно разумен?', ...mc('½–¾ банка',['1/10 банка','Всегда олл-ин','Минимальная ставка']), exp:'Половина или три четверти банка: худшие руки ещё готовы платить, а банк растёт.'}; },
  l9style(){ const st=STYLES[rint(0,3)], v=rint(...st.v), p=rint(...st.p); return {q:L('Соперник: VPIP {0}%, PFR {1}%. Какой у него стиль?', v, p), ...mc(st.n, STYLES.map(s=>s.n)), exp:L('{0}: VPIP {1}–{2}%, PFR {3}–{4}%.', st.n, st.v[0], st.v[1], st.p[0], st.p[1])}; },
  l9counter(){ const st=STYLES[rint(0,3)], v=rint(...st.v), p=rint(...st.p); return {q:L('Соперник: VPIP {0}%, PFR {1}%. Как лучше против него играть?', v, p), ...mc(st.c, STYLES.map(s=>s.c)), exp:L('Это {0}. {1}.', st.n, st.c)}; },
  l9tp(){ return {q:'Тайт-пассивный игрок неожиданно сделал рейз. Что это обычно значит?', ...mc('Очень сильная рука',['Блеф','Случайность','Ничего не значит']), exp:'Пассивные игроки редко повышают. Если такой игрок рейзит, у него почти всегда сильная рука.'}; },
  l10roll(){ return {q:'Сколько бай-инов советуют держать в банкролле для выбранных ставок?', ...mc('20 и больше',['1–2','5','Неважно']), exp:'Запас в 20+ бай-инов переживёт неизбежные серии проигрышей.'}; },
  l10tilt(){ return {q:'Вы проиграли три больших банка подряд и злитесь. Что лучше сделать?', ...mc('Сделать перерыв',['Поднять ставки, чтобы отыграться','Играть все руки подряд','Пойти олл-ин вслепую']), exp:'Решения на эмоциях (тильт) стоят дороже всего. Перерыв возвращает ясную голову.'}; },
};

let course={i:0, view:'theory', qs:[], qi:0, score:0, picked:null};
function loadProgress(){ try{ return JSON.parse(localStorage.getItem('pion-course')||'{}')||{}; }catch(e){ return {}; } }
function saveProgress(p){ store.set('pion-course', JSON.stringify(p)); }
function openLearn(i){ $('learnOv').hidden=false; if(i!=null){ course.i=i; course.view='theory'; } renderLearn(); }
function closeLearn(){ $('learnOv').hidden=true; }
function startPractice(){ const les=LESSONS[course.i]; course.qs=les.gen.map(g=>GEN[g]()); course.qi=0; course.score=0; course.picked=null; course.view='practice'; renderLearn(); }
function renderLearn(){
  const prog=loadProgress(), done=LESSONS.filter(l=>(prog['l'+l.id]||0)>=4).length;
  $('learnProg').textContent=t('Пройдено: {0} из {1}', done, LESSONS.length);
  $('lessons').innerHTML=LESSONS.map((l,k)=>`<button type="button" class="lsn" data-l="${k}" aria-current="${k===course.i}"><span class="ln">${(prog['l'+l.id]||0)>=4?'✓':l.id}</span><span>${esc(t('c'+l.id+'.title'))}</span></button>`).join('');
  const les=LESSONS[course.i], box=$('lesson');
  const head=`<div class="eyebrow">${t('Урок {0} из {1}', les.id, LESSONS.length)}</div><h4>${esc(t('c'+les.id+'.title'))}</h4>`;
  const playBtn = les.play ? `<button type="button" class="btn" data-act="play">${t('Сыграть с ботами и тренером')}</button>` : '';
  if(course.view==='theory'){
    const paras=String(t('c'+les.id+'.body')).split(/\n\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
    const ex = les.ex ? `<div class="combos">${COMBO_EX.map((s,k)=>`<div class="combo"><span>${esc(t(HAND_NAMES[k]))}</span>${cardsRow(cardsOf(s))}</div>`).join('')}</div>` : '';
    const best=prog['l'+les.id];
    box.innerHTML=`${head}<div class="theory">${paras}</div>${ex}<div class="row">${best!=null?`<span class="hint">${t('Лучший результат: {0} из {1}', best, 5)}</span>`:''}</div><div class="row"><button type="button" class="btn primary" data-act="start">${t('Начать практику')}</button>${playBtn}</div>`;
  } else if(course.view==='practice'){
    const q=course.qs[course.qi], answered=course.picked!=null;
    const dots=course.qs.map((_,k)=>`<i class="${k<course.qi?'d':k===course.qi?'c':''}"></i>`).join('');
    box.innerHTML=`${head}<div class="qhead"><span>${t('Вопрос {0} из {1}', course.qi+1, course.qs.length)}</span><span class="dots">${dots}</span></div>${q.scene||''}<p class="q">${esc(tr(q.q))}</p>
      <div class="opts">${q.opts.map((o,k)=>`<button type="button" class="btn opt${answered?(k===q.ans?' ok':k===course.picked?' bad':''):''}" data-opt="${k}" ${answered?'disabled':''}>${esc(tr(o))}</button>`).join('')}</div>
      ${answered?`<div class="fb ${course.picked===q.ans?'ok':'bad'}"><b>${t(course.picked===q.ans?'Верно!':'Неверно.')}</b> ${esc(tr(q.exp))}</div><div class="row"><button type="button" class="btn primary" data-act="next">${t(course.qi+1<course.qs.length?'Дальше':'Результат')}</button></div>`:''}`;
  } else {
    const s=course.score, n=course.qs.length;
    const msg = s===n ? 'Отлично, всё верно!' : s>=4 ? 'Урок пройден. Можно двигаться дальше.' : 'Стоит перечитать теорию и попробовать ещё раз.';
    const nextBtn = course.i<LESSONS.length-1 ? `<button type="button" class="btn primary" data-act="nextLesson">${t('Следующий урок')}</button>` : '';
    box.innerHTML=`${head}<div class="result"><div class="big">${s}/${n}</div><p>${t(msg)}</p></div><div class="row"><button type="button" class="btn" data-act="start">${t('Пройти практику ещё раз')}</button><button type="button" class="btn" data-act="theory">${t('Теория')}</button>${nextBtn}${playBtn}</div>`;
  }
}
$('lessons').onclick=e=>{ const b=e.target.closest('[data-l]'); if(!b) return; course.i=+b.dataset.l; course.view='theory'; renderLearn(); };
$('lesson').onclick=e=>{
  const o=e.target.closest('[data-opt]'), a=e.target.closest('[data-act]');
  if(o && course.view==='practice' && course.picked==null){ course.picked=+o.dataset.opt; if(course.picked===course.qs[course.qi].ans){ course.score++; SFX.chip(); } renderLearn(); return; }
  if(!a) return;
  const act=a.dataset.act;
  if(act==='start') startPractice();
  else if(act==='theory'){ course.view='theory'; renderLearn(); }
  else if(act==='next'){
    if(course.qi+1<course.qs.length){ course.qi++; course.picked=null; renderLearn(); }
    else { const p=loadProgress(), k='l'+LESSONS[course.i].id; p[k]=Math.max(p[k]||0, course.score); saveProgress(p); course.view='result'; if(course.score>=4) SFX.win(); renderLearn(); }
  }
  else if(act==='nextLesson'){ course.i++; course.view='theory'; renderLearn(); }
  else if(act==='play'){ closeLearn(); if(!$('nick').value.trim()) $('nick').value=t('Ученик'); saveNick(); startSolo({coach:true}); }
};
$('learnClose').onclick=closeLearn;
$('learnOv').addEventListener('click', e=>{ if(e.target.id==='learnOv') closeLearn(); });
$('bLearn').onclick=()=>openLearn();
$('bLearn2').onclick=()=>openLearn();

function coachTip(i, type){
  if(!S || !S.coach || MODE!=='offline') return;
  const p=seats()[i], cs=H.hands[i]; if(!p || !cs) return;
  const opps=live().length-1; if(opps<1) return;
  const toCall=S.currentBet-p.bet, pot=potTotal();
  const eq=equity(cs, S.board, opps, 400), need=toCall>0 ? toCall/(pot+toCall) : 0;
  const E=Math.round(eq*100), N=Math.round(need*100);
  let msg=null;
  if(S.street==='preflop' && S.currentBet<=S.bb){
    const pc=pctOf(cs[0],cs[1]);
    if(type==='fold' && pc<=.12) msg=L('Тренер: с такой рукой (топ {0}%) стоило играть рейзом.', Math.max(1,Math.round(pc*100)));
    else if(type!=='fold' && pc>.6 && toCall>0) msg=L('Тренер: это слабая рука (топ {0}%). Её обычно сбрасывают.', Math.round(pc*100));
  }
  if(!msg && toCall>0){
    if(type==='fold' && eq>need+.08) msg=L('Тренер: пас был лишним — шансы ≈{0}%, а для колла хватало {1}%.', E, N);
    else if(type==='call' && eq<need-.08) msg=L('Тренер: колл в минус — шансы ≈{0}%, а нужно {1}%.', E, N);
    else if(type!=='fold' && eq>=need) msg=L('Тренер: хорошее решение — шансы ≈{0}% при нужных {1}%.', E, N);
  } else if(!msg){
    if(type==='call' && eq>.7) msg=L('Тренер: с такой сильной рукой (≈{0}%) лучше ставить — так банк вырастет.', E);
    else if(type==='raise' && eq<.25 && opps>2) msg=L('Тренер: блеф против нескольких соперников ({0}) редко срабатывает.', opps);
  }
  if(msg) toast(tr(msg), 5600);
}

