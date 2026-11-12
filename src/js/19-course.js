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
  {id:11, gen:['l11name','l11open','l11last','l11open','l11wide']},
  {id:12, gen:['l12tex','l12cbet','l12tex','l12multi','l12size'], play:true},
  {id:13, gen:['l13set','l13set','l13draw','l13reverse','l13set']},
  {id:14, gen:['l14nuts','l14nuts','l14pair','l14kick','l14nuts']},
  {id:15, gen:['o15rule','o15read','o15flush','o15read','o15pl'], omaha:true},
  {id:16, gen:['o16pre','o16dang','o16pre','o16ds','o16pre'], omaha:true, play:true},
  {id:17, gen:['o17outs','o17nuts','o17nfd','o17outs','o17nuts'], omaha:true},
  {id:18, gen:['o18eq','o18tp','o18call','o15pl','o18call'], omaha:true, play:true},
];
// the course in three levels; the numbers are lesson ids, in the order they are taught
const LEVELS=[{n:'Основы', ids:[1,2,3,4]}, {n:'Стратегия', ids:[5,11,6,7,13]}, {n:'Мастерство', ids:[8,12,14,9,10]}, {n:'Омаха', ids:[15,16,17,18]}];
const ORDER=LEVELS.flatMap(l=>l.ids.map(id=>id-1));
// endless drills: the same generators as in the lessons, one question after another
const DRILLS=[
  {id:'pre', n:'Префлоп: рейз или пас', d:'Позиция и стартовая рука', gen:['l5pre','l11open']},
  {id:'outs', n:'Ауты', d:'Сколько карт улучшат руку', gen:['l6outs']},
  {id:'odds', n:'Шансы банка', d:'Колл или пас по цене ставки', gen:['l7need','l7dec']},
  {id:'win', n:'Кто выигрывает', d:'Сравните две руки на столе', gen:['l3win']},
  {id:'name', n:'Комбинации', d:'Назовите комбинацию', gen:['l2name']},
  {id:'nuts', n:'Натсы', d:'Лучшая возможная рука на столе', gen:['l14nuts']},
  {id:'tex', n:'Текстура флопа', d:'Сухой или мокрый флоп', gen:['l12tex']},
  {id:'omRead', n:'Омаха: лучшая рука', d:'Две карты из руки, три со стола', gen:['o15read']},
  {id:'omPre', n:'Омаха: стартовые руки', d:'Какая рука сильнее до флопа', gen:['o16pre']},
  {id:'omOuts', n:'Омаха: ауты', d:'Дро с четырьмя картами', gen:['o17outs']},
  {id:'pl', n:'Пот-лимит', d:'Максимальный рейз', gen:['o15pl','o18call']},
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
  l11name(){ const q=[['Как называется место дилера?','Баттон'],['Как называется место справа от баттона?','Катофф'],['Кто сидит сразу слева от баттона?','Малый блайнд'],['Как называют первого, кто ходит до флопа (сразу после большого блайнда)?','Ранняя позиция']][rint(0,3)];
    return {q:q[0], ...mc(q[1], ['Баттон','Катофф','Малый блайнд','Большой блайнд','Ранняя позиция'].filter(x=>x!==q[1]).sort(()=>Math.random()-.5)), exp:'Порядок за столом от дилера по часовой стрелке: баттон, малый блайнд, большой блайнд, ранние позиции, средние, катофф — и снова баттон.'}; },
  l11open(){
    const P=[['ep','Ранняя позиция'],['mp','Средняя позиция'],['co','Катофф'],['btn','Баттон']];
    for(let i=0;i<400;i++){
      const [pk,pn]=P[rint(0,3)], thr=OPEN_THR[pk], h=deal(2), pc=pctOf(h[0],h[1]);
      if(Math.abs(pc-thr)<.04) continue;
      return {q:L('Позиция: {0}. До вас все сбросили. Рейз или пас?', pn), scene:scene([['Ваши карты',cardsRow(h)]]), opts:['Рейз','Пас'], ans: pc<=thr?0:1,
        exp:L('Это топ {0}% рук. С позиции «{1}» разумно открывать примерно лучшие {2}%.', Math.max(1,Math.round(pc*100)), pn, Math.round(thr*100))};
    }
  },
  l11last(){ return {q:'Кто ходит последним до флопа, если никто не повышал?', ...mc('Большой блайнд',['Баттон','Малый блайнд','Ранняя позиция']), exp:'До флопа первым ходит игрок после большого блайнда, а большой блайнд — последним. После флопа последним ходит баттон.'}; },
  l11wide(){ return {q:'С какой позиции можно разыгрывать больше всего рук?', ...mc('Баттон',['Ранняя позиция','Средняя позиция','Большой блайнд']), exp:'На баттоне вы ходите последним на всех улицах после флопа, поэтому с него играют до 40% рук.'}; },
  _tex(){
    for(let i=0;i<500;i++){
      const f=deal(3), sm=Math.max(...[0,1,2,3].map(x=>f.filter(c=>c.s===x).length)), rs=[...new Set(f.map(c=>c.r))].sort((a,b)=>a-b);
      const rsA = rs.includes(14) ? [1,...rs] : rs;
      let close=0; for(let k=1;k<rsA.length;k++) if(rsA[k]-rsA[k-1]<=2) close++;
      const span = rs.length===3 ? rs[2]-rs[0] : 99;
      const wet = sm===3 || (sm===2 && (span<=4 || close>=2)) || (rs.length===3 && span<=4);
      const dry = sm===1 && close===0;
      if(wet||dry) return {f, wet};
    }
  },
  l12tex(){ const x=GEN._tex(); return {q:'Какой это флоп?', scene:scene([['Флоп',cardsRow(x.f)]]), opts:['Сухой','Мокрый'], ans:x.wet?1:0,
    exp: x.wet ? 'Мокрый: карты связаны по рангу или по масти, у соперников много дро. Ставьте крупнее, чтобы дро платили за шанс.' : 'Сухой: карты разномастные и далеко друг от друга, дро почти нет. Хватит маленькой ставки, около ⅓ банка.'}; },
  l12cbet(){ return {q:'Вы рейзили до флопа, против вас один соперник, флоп сухой. Что чаще всего лучше?', ...mc('Продолженная ставка ⅓–½ банка',['Чек и пас на любую ставку','Олл-ин','Чек всегда']), exp:'Соперник на сухом флопе чаще всего ни во что не попал. Небольшая продолженная ставка (c-bet) часто забирает банк сразу.'}; },
  l12multi(){ return {q:'Вы рейзили до флопа, но в банке ещё трое соперников, флоп мокрый, а вы ни во что не попали. Что лучше?', ...mc('Чек',['Продолженная ставка в банк','Олл-ин','Минимальная ставка']), exp:'Против нескольких соперников на мокром флопе кто-то почти наверняка попал. Блеф здесь стоит дорого — лучше чек.'}; },
  l12size(){ const wet=Math.random()<.5; return {q:L('Флоп {0}. Какой размер продолженной ставки обычно разумен?', wet?'мокрый':'сухой'), ...mc(wet?'½–¾ банка':'Около ⅓ банка', ['½–¾ банка','Около ⅓ банка','Два банка','Минимальная ставка']), exp:'На сухом флопе хватает ⅓ банка. На мокром ставят ½–¾: соперники с дро должны платить за шанс собрать руку.'}; },
  l13set(){
    for(let i=0;i<60;i++){
      const r=rint(2,9), raise=rint(3,5)*20, ratio=[6,8,10,20,25,30,40][rint(0,6)], stack=raise*ratio;
      const pair=[{r,s:rint(0,1)},{r,s:rint(2,3)}];
      return {q:L('У вас пара, соперник рейзит до {0}. У вас обоих по {1} фишек. Колл ради сета выгоден?', raise, stack), scene:scene([['Ваши карты',cardsRow(pair)]]), opts:['Да, колл','Нет, пас'], ans: ratio>=15?0:1,
        exp:L('Сет собирается примерно в 1 случае из 8. Колл ради сета окупается, если стеки хотя бы в 15 раз больше колла. Здесь в {0} раз. {1}', ratio, ratio>=15?'Неявные шансы есть — колл.':'Слишком мало, чтобы окупить промахи — пас.')};
    }
  },
  l13draw(){ return {q:'У вас флеш-дро на тёрне, прямых шансов банка не хватает. Когда колл всё же может быть оправдан?', ...mc('У соперника большой стек, и он заплатит, если флеш соберётся',['Всегда — флеш собирается часто','Если у соперника короткий стек','Никогда']), exp:'Это неявные шансы: на будущих ставках вы выиграете больше, чем лежит в банке сейчас. С коротким стеком соперника их нет.'}; },
  l13reverse(){ return {q:'Что такое обратные неявные шансы?', ...mc('Даже собрав руку, вы можете проиграть крупный банк руке сильнее',['Шанс, что соперник сбросит','Вероятность собрать дро','Выигрыш с блефа']), exp:'Например, младший флеш или стрит на одном конце: собрали — и платите старшему флешу. Такие дро стоят меньше, чем кажется.'}; },
  l14nuts(){
    for(let i=0;i<50;i++){
      const b=deal(5), known=new Set(b.map(cardKey)), rest=freshDeck().filter(c=>!known.has(cardKey(c)));
      let top=-1;
      for(let x=0;x<rest.length;x++) for(let y=x+1;y<rest.length;y++){ const c=best([rest[x],rest[y],...b]).cat; if(c>top) top=c; }
      if(top===8 && Math.random()<.6) continue;
      return {q:'Какая лучшая возможная комбинация (натсы) на этом столе?', scene:scene([['Стол',cardsRow(b.sort((p,q)=>q.r-p.r))]]), ...mc(HAND_NAMES[top], shuf(HAND_NAMES.filter((_,k)=>k!==top && Math.abs(k-top)<=3))),
        exp:L('Натсы здесь — {0}. Проверяйте: есть ли на столе пара (возможны фулл-хаус и каре), три карты одной масти (флеш), три карты рядом (стрит).', HAND_NAMES[top])};
    }
  },
  l14pair(){ return {q:'На столе спарилась карта (лежит пара). Какие комбинации стали возможны?', ...mc('Фулл-хаус и каре',['Только флеш','Только стрит','Никакие новые']), exp:'Без пары на столе фулл-хаус и каре невозможны. Когда стол спарился, ваш стрит или флеш может уже проигрывать.'}; },
  // ----- Omaha -----
  o15rule(){ return {q:'Сколько своих карт нужно использовать в Омахе?', ...mc('Ровно две',['Одну или две','Сколько угодно','Все четыре']), exp:'В Омахе у вас четыре карты, но комбинация всегда собирается из двух своих и трёх общих — ни больше, ни меньше.'}; },
  o15flush(){ return {q:'Омаха. На столе четыре карты одной масти, а у вас в руке одна карта этой масти — туз. Есть ли у вас флеш?', ...mc('Нет',['Да, натсовый флеш','Да, но младший','Только на ривере']), exp:'Для флеша в Омахе нужны две карты масти в руке и три на столе. С одной картой масти флеша нет, даже если на столе их четыре.'}; },
  o15read(){
    let h, board, om, he;
    for(let i=0;i<600;i++){
      const d=deal(9); board=d.slice(0,5); h=d.slice(5,9);
      om=bestHand(h, board); he=best(h.concat(board));
      if(om.cat!==he.cat || i>400 || Math.random()<.25) break;
    }
    const exp=[L('Лучшая рука в Омахе — {0}: {1} (две карты из руки и три со стола).', HAND_NAMES[om.cat], fmtCards(om.cards))];
    if(he.cat!==om.cat) exp.push(L('Если брать карты как в холдеме, вышло бы «{0}», но в Омахе так нельзя.', HAND_NAMES[he.cat]));
    return {q:'Омаха: какая лучшая комбинация у игрока?', scene:scene([['Стол',cardsRow(board)],['Карты игрока',cardsRow(h)]]), ...mc(HAND_NAMES[om.cat], shuf([HAND_NAMES[he.cat], ...HAND_NAMES.filter((_,k)=>k!==om.cat && k!==he.cat && Math.abs(k-om.cat)<=3)])), exp};
  },
  o15pl(){
    if(Math.random()<.35){
      const bb=[10,20,50,100][rint(0,3)], sb=bb/2, ans=3*bb+sb;
      return {q:L('Пот-лимит, блайнды {0}/{1}. Все до вас сбросили. До какой суммы максимум можно повысить?', sb, bb), ...numOpts(ans,[2*bb+sb, 3*bb, 4*bb, 2*bb, ans+bb]),
        exp:L('В банке {0} + {1}. Мысленно уравниваем {1} — банк становится {2}. Рейз — на всю эту сумму: {1} + {2} = {3}.', sb, bb, sb+2*bb, ans)};
    }
    const P=rint(4,30)*10, B=Math.max(10, Math.round(P*[.33,.5,.66,.75,1][rint(0,4)]/10)*10), ans=P+3*B;
    return {q:L('Пот-лимит. В банке {0}, соперник ставит {1}. До какой суммы максимум можно повысить?', P, B), ...numOpts(ans,[P+2*B, 3*B, 2*P+B, ans+B, ans-B]),
      exp:L('Сначала мысленно уравниваем {0} — в банке станет {1}. Рейз можно сделать на всю эту сумму: {0} + {1} = {2}.', B, P+2*B, ans)};
  },
  o16pre(){
    for(let i=0;i<800;i++){
      const d=deal(8), A=d.slice(0,4), B=d.slice(4,8), sa=omScore(A), sb=omScore(B);
      if(Math.abs(sa-sb)<12 || Math.min(omPct(A), omPct(B))>.3) continue;
      return {q:'Омаха: какая рука лучше для игры до флопа?', scene:scene([['Рука A',cardsRow(A)],['Рука B',cardsRow(B)]]), opts:['Рука A','Рука B'], ans: sa>sb?0:1,
        exp:[L('Рука A: {0}.', omFeatureKeys(A)), L('Рука B: {0}.', omFeatureKeys(B)), L('Сильнее руки, где все четыре карты работают вместе: пары, масти, связанность.')]};
    }
  },
  o16dang(){ return {q:'Что такое «висящая» карта в руке Омахи?', ...mc('Карта, которая не работает с остальными тремя',['Самая старшая карта','Карта, которая открывается на ривере','Пятая карта на столе']), exp:'Например, в K♠ Q♠ J♦ 3♣ тройка не помогает ни стриту, ни флешу, ни паре. Такая рука по сути играет тремя картами — это заметный минус.'}; },
  o16ds(){ return {q:'Что делает руку в Омахе сильной до флопа?', ...mc('Все четыре карты работают вместе',['Одна очень старшая карта','Три карты одного ранга','Четыре карты одной масти']), exp:'Пары, две масти по две карты и связанность дают много способов собрать сильную руку. Четыре карты одной масти — минус: флеш всё равно собирается только из двух, а остальные «съедают» ауты.'}; },
  o17nuts(){
    for(let i=0;i<50;i++){
      const b=deal(5), nu=nutsOf([], b, true); if(nu.top===8 && Math.random()<.6) continue;
      return {q:'Омаха: какие натсы на этом столе (две карты из руки и три со стола)?', scene:scene([['Стол',cardsRow(b.sort((p,q)=>q.r-p.r))]]), ...mc(HAND_NAMES[nu.top], shuf(HAND_NAMES.filter((_,k)=>k!==nu.top && Math.abs(k-nu.top)<=3))),
        exp:L('Натсы здесь — {0}. Проверяйте по порядку: пара на столе (фулл-хаус и каре), три карты одной масти (флеш), три карты рядом (стрит).', HAND_NAMES[nu.top])};
    }
  },
  o17outs(){
    for(let i=0;i<5000;i++){
      const d=deal(7), h=d.slice(0,4), f=d.slice(4,7);
      if(new Set(f.map(c=>c.r)).size<3 || bestHand(h, f).cat>=3) continue;
      const known=new Set(d.map(cardKey)), outs=freshDeck().filter(c=>!known.has(cardKey(c)) && bestHand(h, f.concat([c])).cat>=4);
      if(outs.length<8 || outs.length>20) continue;
      return {q:'Омаха, флоп. Сколько у вас аутов на стрит или флеш?', scene:scene([['Флоп',cardsRow(f)],['Ваши карты',cardsRow(h)]]), ...numOpts(outs.length,[outs.length-4,outs.length-2,outs.length+3,outs.length+5,9,13,16,20]),
        exp:L('{0} аутов: {1}. В Омахе дро бывают огромными: врап (стрит-дро сразу с несколькими своими картами) даёт до 20 аутов.', outs.length, fmtCards(outs))};
    }
  },
  o17nfd(){ return {q:'Омаха. У вас флеш-дро с королём, а не с тузом. Чем это опасно?', ...mc('У соперника часто есть туз той же масти — натсовый флеш',['Флеш в Омахе не собирается','Ничем: флеш всегда выигрывает','Король не может быть во флеше']), exp:'У каждого соперника по четыре карты, поэтому натсовые руки встречаются намного чаще, чем в холдеме. Собрав ненатсовый флеш, можно проиграть большой банк.'}; },
  o18eq(){ return {q:'В холдеме AA против случайной руки до флопа выигрывает ≈85%. А лучшая рука Омахи A♠ A♥ K♠ K♥ против случайной?', ...mc('≈70%',['≈95%','≈85%','≈50%']), exp:'В Омахе шансы рук намного ближе: у каждого шесть пар своих карт для комбинации. Огромного преимущества до флопа почти не бывает — главное решается после флопа.'}; },
  o18tp(){ return {q:'Омаха, флоп, против вас трое. У вас топ-пара с лучшим кикером, один соперник ставит банк, другой уравнивает. Что обычно правильно?', ...mc('Пас',['Рейз на весь стек','Колл до конца','Минимальный рейз']), exp:'В Омахе против нескольких соперников одна пара почти всегда проигрывает: у кого-то уже две пары, сет или большое дро. Крупно играйте натсы и натсовые дро.'}; },
  o18call(){
    for(let i=0;i<80;i++){
      const d=deal(7), h=d.slice(0,4), f=d.slice(4,7), eq=equityOmaha(h, f, 1, 400);
      const P=[100,150,200,300][rint(0,3)], B=Math.max(10, Math.round(P*[.5,.66,.75,1][rint(0,3)]/10)*10), pot=P+B, need=B/(pot+B);
      if(Math.abs(eq-need)<.1) continue;
      return {q:L('Омаха, флоп, один соперник. В банке {0} вместе с его ставкой {1}. Колл или пас?', pot, B), scene:scene([['Флоп',cardsRow(f)],['Ваши карты',cardsRow(h)]]), opts:['Колл','Пас'], ans: eq>need?0:1,
        exp:L('Против случайной руки ваши шансы ≈{0}%, а для колла нужно {1}%. {2}', Math.round(eq*100), Math.round(need*100), eq>need ? 'Колл выгоден.' : 'Колл невыгоден — пас.')};
    }
  },
  l14kick(){
    for(let i=0;i<200;i++){
      const ks=shuf([13,12,11,10]).slice(0,2).sort((x,y)=>y-x), lows=shuf([2,3,4,5,6,7,8,9]).slice(0,4);
      const board=[{r:14,s:0},...lows.map((r,k)=>({r,s:(k+1)%4}))];
      const A=[{r:14,s:1},{r:ks[0],s:rint(0,3)}], B=[{r:14,s:2},{r:ks[1],s:rint(0,3)}];
      if(best(A.concat(board)).cat!==1 || best(B.concat(board)).cat!==1) continue;
      const swap=Math.random()<.5;
      return {q:'Кто выигрывает?', scene:scene([['Стол',cardsRow(board)],['Игрок A',cardsRow(swap?B:A)],['Игрок B',cardsRow(swap?A:B)]]), opts:['Игрок A','Игрок B','Ничья, банк делится'], ans: swap?1:0,
        exp:L('У обоих пара тузов, решает кикер: {0} старше {1}.', RL[ks[0]]||ks[0], RL[ks[1]]||ks[1])};
    }
  },
};

let course={i:0, view:'theory', qs:[], qi:0, score:0, picked:null, drill:null, streak:0, solved:0};
function loadProgress(){ try{ return JSON.parse(localStorage.getItem('pyonpoker-course')||'{}')||{}; }catch(e){ return {}; } }
function saveProgress(p){ store.set('pyonpoker-course', JSON.stringify(p)); }
const lessonDone = (prog, l) => (prog['l'+l.id]||0)>=4;
function openLearn(i){ $('learnOv').hidden=false; if(i!=null){ course.i=i; course.view='theory'; } renderLearn(); }
function closeLearn(){ $('learnOv').hidden=true; }
function startPractice(){ const les=LESSONS[course.i]; course.qs=les.gen.map(g=>GEN[g]()); course.qi=0; course.score=0; course.picked=null; course.view='practice'; renderLearn(); }
function startDrill(id){ course.drill=DRILLS.find(d=>d.id===id); course.streak=0; course.solved=0; course.view='drill'; nextDrillQ(); }
function nextDrillQ(){ const g=pick(course.drill.gen); course.qs=[GEN[g]()]; course.qi=0; course.picked=null; renderLearn(); }
function drillBest(){ try{ return JSON.parse(localStorage.getItem('pyonpoker-drills')||'{}')||{}; }catch(e){ return {}; } }
function questionHTML(q, answered){
  return `${q.scene||''}<p class="q">${esc(tr(q.q))}</p>
    <div class="opts">${q.opts.map((o,k)=>`<button type="button" class="btn opt${answered?(k===q.ans?' ok':k===course.picked?' bad':''):''}" data-opt="${k}" ${answered?'disabled':''}>${esc(tr(o))}</button>`).join('')}</div>
    ${answered?`<div class="fb ${course.picked===q.ans?'ok':'bad'}" role="status"><b>${t(course.picked===q.ans?'Верно!':'Неверно.')}</b> ${esc(tr(q.exp))}</div>`:''}`;
}
function renderLearn(){
  const prog=loadProgress(), done=LESSONS.filter(l=>lessonDone(prog,l)).length;
  $('learnProg').textContent=t('Пройдено: {0} из {1}', done, LESSONS.length);
  const cur = v => course.view===v || (v==='drills' && course.view==='drill');
  $('lessons').innerHTML=LEVELS.map(lv=>{
    const n=lv.ids.filter(id=>lessonDone(prog, LESSONS[id-1])).length;
    return `<div class="lvl"><span>${esc(t(lv.n))}</span><i>${n}/${lv.ids.length}</i></div>`+lv.ids.map(id=>{ const k=id-1, l=LESSONS[k]; return `<button type="button" class="lsn" data-l="${k}" aria-current="${['theory','practice','result'].includes(course.view) && k===course.i}"><span class="ln">${lessonDone(prog,l)?'✓':ORDER.indexOf(k)+1}</span><span>${esc(t('c'+l.id+'.title'))}</span></button>`; }).join('');
  }).join('')+`<div class="lvl"><span>${t('Практика')}</span></div>
    <button type="button" class="lsn" data-view="drills" aria-current="${cur('drills')}"><span class="ln">∞</span><span>${t('Тренажёры')}</span></button>
    <button type="button" class="lsn" data-view="coach"><span class="ln">🎓</span><span>${t('Разбор с тренером')}</span></button>`;
  const box=$('lesson');
  if(course.view==='drills'){
    const bests=drillBest();
    box.innerHTML=`<div class="eyebrow">${t('Практика')}</div><h4>${t('Тренажёры')}</h4><p class="hint">${t('Бесконечные вопросы на одну тему. Отвечайте подряд без ошибок — серия растёт, лучший результат сохраняется.')}</p>
      <div class="drills">${DRILLS.map(d=>`<button type="button" class="drill" data-drill="${d.id}"><b>${esc(t(d.n))}</b><span>${esc(t(d.d))}</span>${bests[d.id]?`<i>${t('Рекорд: {0}', bests[d.id])}</i>`:''}</button>`).join('')}</div>
      <div class="coachcta"><span class="cav" aria-hidden="true">🎓</span><div><b>${t('Разбор с тренером')}</b><p class="hint">${t('Тренер разберёт ваши сыгранные раздачи: где были ошибки, какие были шансы и что почитать. Ему можно задавать вопросы.')}</p></div><button type="button" class="btn primary" data-act="coach">${t('Открыть разбор')}</button></div>`;
    return;
  }
  if(course.view==='drill'){
    const q=course.qs[0], answered=course.picked!=null, best=drillBest()[course.drill.id]||0;
    box.innerHTML=`<div class="eyebrow">${t('Тренажёр')}</div><h4>${esc(t(course.drill.n))}</h4>
      <div class="qhead"><span>${t('Серия: {0}', course.streak)} · ${t('Рекорд: {0}', best)}</span><span>${t('Решено: {0}', course.solved)}</span></div>
      ${questionHTML(q, answered)}
      <div class="row">${answered?`<button type="button" class="btn primary" data-act="drillNext">${t('Следующий вопрос')}</button>`:''}<button type="button" class="btn ghost" data-view="drills">${t('Все тренажёры')}</button></div>`;
    return;
  }
  const les=LESSONS[course.i];
  const pos=ORDER.indexOf(course.i), lvl=LEVELS.find(l=>l.ids.includes(les.id));
  const head=`<div class="eyebrow">${esc(t(lvl.n))} · ${t('Урок {0} из {1}', pos+1, LESSONS.length)}</div><h4>${esc(t('c'+les.id+'.title'))}</h4>`;
  const playBtn = les.play ? `<button type="button" class="btn" data-act="play">${t(les.omaha ? 'Сыграть Омаху с ботами и тренером' : 'Сыграть с ботами и тренером')}</button>` : '';
  if(course.view==='theory'){
    const paras=String(t('c'+les.id+'.body')).split(/\n\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
    const ex = les.ex ? `<div class="combos">${COMBO_EX.map((s,k)=>`<div class="combo"><span>${esc(t(HAND_NAMES[k]))}</span>${cardsRow(cardsOf(s))}</div>`).join('')}</div>` : '';
    const bestR=prog['l'+les.id];
    box.innerHTML=`${head}<div class="theory">${paras}</div>${ex}<div class="row">${bestR!=null?`<span class="hint">${t('Лучший результат: {0} из {1}', bestR, 5)}</span>`:''}</div><div class="row"><button type="button" class="btn primary" data-act="start">${t('Начать практику')}</button>${playBtn}</div>`;
  } else if(course.view==='practice'){
    const q=course.qs[course.qi], answered=course.picked!=null;
    const dots=course.qs.map((_,k)=>`<i class="${k<course.qi?'d':k===course.qi?'c':''}"></i>`).join('');
    box.innerHTML=`${head}<div class="qhead"><span>${t('Вопрос {0} из {1}', course.qi+1, course.qs.length)}</span><span class="dots">${dots}</span></div>${questionHTML(q, answered)}
      ${answered?`<div class="row"><button type="button" class="btn primary" data-act="next">${t(course.qi+1<course.qs.length?'Дальше':'Результат')}</button></div>`:''}`;
  } else {
    const s=course.score, n=course.qs.length;
    const msg = s===n ? 'Отлично, всё верно!' : s>=4 ? 'Урок пройден. Можно двигаться дальше.' : 'Стоит перечитать теорию и попробовать ещё раз.';
    const nextBtn = pos<ORDER.length-1 ? `<button type="button" class="btn primary" data-act="nextLesson">${t('Следующий урок')}</button>` : '';
    box.innerHTML=`${head}<div class="result"><div class="big">${s}/${n}</div><p>${t(msg)}</p></div><div class="row"><button type="button" class="btn" data-act="start">${t('Пройти практику ещё раз')}</button><button type="button" class="btn" data-act="theory">${t('Теория')}</button>${nextBtn}${playBtn}</div>`;
  }
  box.scrollTop=0;
}
function learnNav(e){
  const v=e.target.closest('[data-view]');
  if(v){ if(v.dataset.view==='coach'){ closeLearn(); openCoach(); } else { course.view=v.dataset.view; renderLearn(); } return true; }
  return false;
}
$('lessons').onclick=e=>{ if(learnNav(e)) return; const b=e.target.closest('[data-l]'); if(!b) return; course.i=+b.dataset.l; course.view='theory'; renderLearn(); };
$('lesson').onclick=e=>{
  const o=e.target.closest('[data-opt]'), a=e.target.closest('[data-act]'), dr=e.target.closest('[data-drill]');
  if(learnNav(e)) return;
  if(dr){ startDrill(dr.dataset.drill); return; }
  if(o && (course.view==='practice' || course.view==='drill') && course.picked==null){
    course.picked=+o.dataset.opt;
    const right = course.picked===course.qs[course.qi].ans;
    if(course.view==='drill'){
      course.solved++;
      if(right){ course.streak++; SFX.chip(); const b=drillBest(); if(course.streak>(b[course.drill.id]||0)){ b[course.drill.id]=course.streak; store.set('pyonpoker-drills', JSON.stringify(b)); } }
      else course.streak=0;
    } else if(right){ course.score++; SFX.chip(); }
    renderLearn(); return;
  }
  if(!a) return;
  const act=a.dataset.act;
  if(act==='start') startPractice();
  else if(act==='theory'){ course.view='theory'; renderLearn(); }
  else if(act==='drillNext') nextDrillQ();
  else if(act==='coach'){ closeLearn(); openCoach(); }
  else if(act==='next'){
    if(course.qi+1<course.qs.length){ course.qi++; course.picked=null; renderLearn(); }
    else { const p=loadProgress(), k='l'+LESSONS[course.i].id; p[k]=Math.max(p[k]||0, course.score); saveProgress(p); course.view='result'; if(course.score>=4) SFX.win(); renderLearn(); }
  }
  else if(act==='nextLesson'){ course.i=ORDER[ORDER.indexOf(course.i)+1]; course.view='theory'; renderLearn(); }
  else if(act==='play'){ closeLearn(); if(!$('nick').value.trim()) $('nick').value=t('Ученик'); saveNick(); startSolo({coach:true, game: LESSONS[course.i].omaha ? 'omaha' : 'holdem'}); }
};
$('learnClose').onclick=closeLearn;
$('learnOv').addEventListener('click', e=>{ if(e.target.id==='learnOv') closeLearn(); });
$('bLearn').onclick=()=>openLearn();
$('bLearn2').onclick=()=>openLearn();
$('bDrills').onclick=()=>{ course.view='drills'; openLearn(); };
$('bCoach2').onclick=()=>openCoach();

function coachTip(i, type){
  if(!S || !S.coach || MODE!=='offline') return;
  const p=seats()[i], cs=H.hands[i]; if(!p || !cs) return;
  const opps=live().length-1; if(opps<1) return;
  const toCall=S.currentBet-p.bet, pot=potTotal();
  const eq=equity(cs, S.board, opps, 400), need=toCall>0 ? toCall/(pot+toCall) : 0;
  const E=Math.round(eq*100), N=Math.round(need*100);
  let msg=null;
  if(S.street==='preflop' && S.currentBet<=S.bb){
    const pc=handPct(cs);
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

