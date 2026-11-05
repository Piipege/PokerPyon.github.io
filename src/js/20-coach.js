/* ---------- coach: reviews your decisions in played hands and answers questions about them ---------- */
// Works from the hand records (HIST): every record keeps the order of actions, the board and
// your own cards, so the review is the same offline, as the host or as a guest.
// The coach is a set of rules, not a language model: it recognises a question by keywords
// (in every interface language) and answers from the numbers of the hand.

const POS_NAMES = {btn:'Баттон', sb:'Малый блайнд', bb:'Большой блайнд', ep:'Ранняя позиция', mp:'Средняя позиция', co:'Катофф'};
const OPEN_THR = {ep:.12, mp:.18, co:.27, btn:.40, sb:.30, bb:.30};
const VERDICT_ICON = {good:'✓', ok:'~', bad:'✗'};
const LESSON_OF = {pre:4, pos:10, odds:6, outs:5, value:7, cbet:11, implied:12};

function posOf(rec, u){
  const n=rec.seats.length, me=rec.seats.findIndex(s=>s.u===u), d=Math.max(0, rec.seats.findIndex(s=>s.u===rec.dealer));
  const off=(me-d+n)%n;
  if(n===2) return off===0 ? 'btn' : 'bb';
  if(off===0) return 'btn'; if(off===1) return 'sb'; if(off===2) return 'bb';
  if(off===n-1) return 'co';
  const early=Math.max(1, Math.round((n-3)/2));
  return off-3 < early ? 'ep' : 'mp';
}

// replay the record and stop at every action of player u
function decisionsOf(rec, u){
  const st={}; rec.seats.forEach(s=>st[s.u]={stack:s.st, bet:0, folded:false});
  let pot=0, cur=0, board=[], street=0, raises=0, lastAggr=null, preAggr=null;
  const out=[];
  for(const e of rec.ev){
    if(e.a==='street'){
      Object.values(st).forEach(x=>{ pot+=x.bet; x.bet=0; });
      cur=0; raises=0; board=e.c.map(keyCard); street=board.length===3?1:board.length===4?2:3;
      if(street===1) preAggr=lastAggr; lastAggr=null;
      continue;
    }
    const p=st[e.u]; if(!p) continue;
    if(e.u===u && ['fold','check','call','bet','raise'].includes(e.a)){
      const potNow=pot+Object.values(st).reduce((a,x)=>a+x.bet,0);
      const toCall=Math.max(0, Math.min(cur-p.bet, p.stack));
      const opps=Object.entries(st).filter(([k,x])=>k!==u && !x.folded).length;
      out.push({street, board:board.slice(), a:e.a, paid:e.p, to:e.to, ai:!!e.ai, toCall, pot:potNow, stack:p.stack, opps, cur,
        raises: street===0 ? Math.max(0, raises) : raises, aggrBefore: street===1 ? preAggr : null, bb:rec.bb, bomb:rec.bomb});
    }
    p.stack-=e.p; p.bet+=e.p;
    if(e.a==='fold') p.folded=true;
    if(e.a==='bb' || e.a==='ante'){ cur=Math.max(cur,p.bet); }
    if(e.a==='bet' || e.a==='raise'){ cur=Math.max(cur,p.bet); raises++; lastAggr=e.u; }
    if(e.a==='call') cur=Math.max(cur, p.bet);
  }
  return out;
}

function fakeOpps(n, range){ return Array.from({length:n}, ()=>({st:{h:10, v:10*range, p:10*range}})); }
function outsOf(hand, board){
  if(board.length<3 || board.length>4) return [];
  const known=new Set([...hand,...board].map(cardKey)), now=best(hand.concat(board)).cat, res=[];
  for(const c of freshDeck()){
    if(known.has(cardKey(c))) continue;
    const nb=board.concat([c]), cat=best(hand.concat(nb)).cat, boardCat=nb.length>=5 ? best(nb).cat : -1;
    if(cat>now && cat>boardCat && (cat>=4 || (now<=1 && cat>=3))) res.push(c);
  }
  return res;
}

// one decision → verdict, explanation, better line, lesson to revise
function judge(d, hand, pos){
  const A=d.a, bb=d.bb||20, R={verdict:'good', why:null, better:null, topic:null, eq:null, need:null, outs:null};
  if(d.street===0 && !d.bomb){
    const pc=pctOf(hand[0],hand[1]), top=Math.max(1,Math.round(pc*100)), thr=OPEN_THR[pos]||.2, short=d.stack<=12*bb;
    R.topic=LESSON_OF.pre; R.pc=pc;
    if(d.raises<=1){ // nobody raised yet: only the blinds (and maybe limpers)
      if(pos==='bb' && d.toCall===0){
        if(A==='check' && pc<=.08){ R.verdict='ok'; R.why=L('Рука сильная (топ {0}%), а вы просто прочекали. Рейз заставил бы слабые руки платить больше.', top); R.better='raise'; }
        else R.why = A==='raise' ? L('Повысить с большого блайнда — нормально с рукой из топ {0}%.', top) : L('Бесплатно посмотреть флоп с большого блайнда — правильно.');
      } else if(A==='fold'){
        if(pc<=thr-.03){ R.verdict='bad'; R.why=L('Это топ {0}% рук — с позиции «{1}» такие руки разыгрывают рейзом (примерно лучшие {2}%).', top, POS_NAMES[pos], Math.round(thr*100)); R.better='raise'; }
        else R.why=L('Топ {0}% рук — для позиции «{1}» слабовато, пас верный.', top, POS_NAMES[pos]);
      } else if(A==='call'){
        if(pos==='sb' && pc<=.5){ R.verdict='ok'; R.why=L('Доплатить малый блайнд можно, но с рукой из топ {0}% лучше рейзить или сбрасывать.', top); R.better = pc<=thr ? 'raise' : 'fold'; }
        else if(pc<=thr){ R.verdict='ok'; R.why=L('Рука достаточно сильная (топ {0}%), но входить в банк лучше рейзом, а не коллом блайнда (лимпом): так вы забираете инициативу.', top); R.better='raise'; }
        else if(pc>thr+.15){ R.verdict='bad'; R.why=L('Слабая рука (топ {0}%) для позиции «{1}». Колл блайнда с ней теряет деньги — лучше пас.', top, POS_NAMES[pos]); R.better='fold'; }
        else { R.verdict='ok'; R.why=L('Пограничная рука (топ {0}%). Лимп — не лучший вариант: либо рейз, либо пас.', top); R.better='fold'; }
      } else if(A==='raise' || A==='bet'){
        if(pc<=thr+.05) R.why=L('Рейз с рукой из топ {0}% с позиции «{1}» — как по учебнику.', top, POS_NAMES[pos]);
        else if(pc<=thr+.15 || (short && pc<=.35)){ R.verdict='ok'; R.why=L('Широковато: топ {0}% рук, а с позиции «{1}» обычно играют лучшие {2}%.', top, POS_NAMES[pos], Math.round(thr*100)); }
        else { R.verdict='bad'; R.why=L('Слишком слабая рука для рейза (топ {0}%). С позиции «{1}» разумно играть лучшие {2}%.', top, POS_NAMES[pos], Math.round(thr*100)); R.better='fold'; }
      }
    } else { // facing a raise (or more)
      const three = d.raises>=3, late = pos==='btn'||pos==='co';
      const reThr = three ? .025 : late ? .07 : .05;
      let callThr = three ? .06 : pos==='bb' ? .28 : late ? .18 : .14;
      if(d.toCall<=2*bb) callThr*=1.4;
      if(A==='fold'){
        if(pc<=callThr*.6){ R.verdict='bad'; R.why=L('Против рейза рука из топ {0}% слишком сильна для паса — её стоило хотя бы уравнять.', top); R.better = pc<=reThr ? 'raise' : 'call'; }
        else R.why=L('Против рейза с рукой из топ {0}% пас — дисциплинированное решение.', top);
      } else if(A==='call'){
        if(short && pc<=.2){ R.verdict='ok'; R.why=L('С коротким стеком (меньше 12 BB) лучше играть «олл-ин или пас», а не колл.'); R.better='raise'; }
        else if(pc<=reThr){ R.verdict='ok'; R.why=L('Рука очень сильная (топ {0}%). Здесь выгоднее повторный рейз (3-бет).', top); R.better='raise'; }
        else if(pc<=callThr) R.why=L('Колл рейза с рукой из топ {0}% — разумно.', top);
        else if(pc<=callThr*1.6){ R.verdict='ok'; R.why=L('Колл рейза с рукой из топ {0}% — на грани. Против рейза диапазон стоит сужать.', top); R.better='fold'; }
        else { R.verdict='bad'; R.why=L('Против рейза рука из топ {0}% обычно проигрывает. Лучше было сбросить.', top); R.better='fold'; }
      } else {
        if(pc<=reThr*1.6 || (short && pc<=.2)) R.why=L('Повторный рейз с рукой из топ {0}% — сильный ход.', top);
        else if(pc<=callThr){ R.verdict='ok'; R.why=L('Рука играбельная (топ {0}%), но для повторного рейза слабовата: обычно её уравнивают.', top); R.better='call'; }
        else { R.verdict='bad'; R.why=L('Повторный рейз с рукой из топ {0}% — очень рискованный блеф.', top); R.better='fold'; }
      }
    }
    return R;
  }
  // after the flop
  const range = d.toCall===0 ? .8 : d.raises>=2 ? .3 : .5;
  const opp=Math.max(1, d.opps);
  const eq = d.board.length ? equityRanged(hand, d.board, fakeOpps(opp, range), 500) : equity(hand, d.board, opp, 400);
  const need = d.toCall>0 ? d.toCall/(d.pot+d.toCall) : 0;
  const outs = outsOf(hand, d.board), draw = outs.length>=8 && d.street<3;
  const implied = draw ? .06 : 0;
  const E=Math.round(eq*100), N=Math.round(need*100);
  Object.assign(R, {eq:E, need:N, outs:outs.length});
  if(d.toCall>0){
    R.topic=LESSON_OF.odds;
    if(A==='fold'){
      if(eq>need+.10){ R.verdict='bad'; R.why=L('Пас был лишним: шансы на победу ≈{0}%, а для колла хватало {1}%.', E, N); R.better='call'; }
      else if(eq+implied>need+.03){ R.verdict='ok'; R.why=L('Пограничный пас: шансы ≈{0}%, нужно {1}%.', E, N); R.better='call'; }
      else R.why=L('Верный пас: шансы ≈{0}%, а колл требовал {1}%.', E, N);
    } else if(A==='call'){
      if(eq+implied<need-.08){ R.verdict='bad'; R.why=L('Колл в минус: шансы ≈{0}%, а нужно было {1}%.', E, N); R.better='fold'; }
      else if(eq+implied<need){ R.verdict='ok'; R.why=L('Колл чуть в минус: шансы ≈{0}% при нужных {1}%.', E, N); if(draw) R.why=L('Колл чуть в минус: шансы ≈{0}% при нужных {1}%, но с дро ({2} аутов) можно рассчитывать выиграть больше на следующих улицах.', E, N, outs.length); R.better='fold'; }
      else if(eq>.72 && d.street===3){ R.verdict='ok'; R.why=L('Колл выгоден (≈{0}% при нужных {1}%), но с такой сильной рукой можно было повысить ради вэлью.', E, N); R.better='raise'; R.topic=LESSON_OF.value; }
      else R.why = draw ? L('Хороший колл: с {2} аутами шансы ≈{0}% при нужных {1}%.', E, N, outs.length) : L('Хороший колл: шансы ≈{0}% при нужных {1}%.', E, N);
    } else {
      R.topic=LESSON_OF.value;
      if(eq>.6) R.why=L('Рейз на вэлью с сильной рукой (≈{0}%) — отлично.', E);
      else if(eq>need) { R.verdict='ok'; R.why=L('Рейз со средней рукой (≈{0}%): колл был бы осторожнее.', E); R.better='call'; }
      else if(draw){ R.verdict='ok'; R.why=L('Полублеф-рейз с дро ({0} аутов): если соперник не сбросит, у вас ещё есть шансы собрать руку.', outs.length); }
      else { R.verdict='bad'; R.why=L('Рейз со слабой рукой (≈{0}%) — блеф против ставки соперника редко срабатывает.', E); R.better='fold'; }
    }
  } else {
    if(A==='check'){
      if(eq>.72){ R.verdict = d.street===3 ? 'bad' : 'ok'; R.why=L('С такой сильной рукой (≈{0}%) стоило ставить: чек упускает вэлью.', E); R.better='bet'; R.topic=LESSON_OF.value; }
      else if(d.street===1 && d.aggrBefore===myUid && d.opps===1 && eq>.3){ R.verdict='ok'; R.why=L('Вы рейзили до флопа и против одного соперника продолженная ставка (c-bet) часто выигрывает банк сразу.'); R.better='bet'; R.topic=LESSON_OF.cbet; }
      else R.why=L('Чек со средней или слабой рукой (≈{0}%) — разумно.', E);
    } else {
      const size = d.pot>0 ? (d.to||d.paid)/d.pot : 1;
      R.topic=LESSON_OF.value;
      if(eq>.55){ R.why=L('Ставка на вэлью (≈{0}%) — правильно.', E); if(size<.25){ R.verdict='ok'; R.why=L('Ставка на вэлью (≈{0}%) правильная, но маленькая: ½–¾ банка принесла бы больше.', E); } else if(size>1.5 && eq<.8){ R.verdict='ok'; R.why=L('Ставка на вэлью (≈{0}%), но слишком крупная: заплатят в основном руки сильнее.', E); } }
      else if(draw) R.why=L('Полублеф с {0} аутами — хорошая ставка: можно выиграть сразу или собрать руку.', outs.length);
      else if(d.opps>=3 && eq<.35){ R.verdict='bad'; R.why=L('Блеф против нескольких соперников ({0}) редко срабатывает.', d.opps); R.better='check'; }
      else if(d.street===3 && eq<.3){ R.verdict='ok'; R.why=L('Блеф на ривере: работает, только если ваша игра похожа на сильную руку. Делайте это редко.'); }
      else if(d.street===3){ R.verdict='ok'; R.why=L('Средняя рука на ривере (≈{0}%): ставка прогонит худшие руки, а заплатят лучшие. Часто чек лучше.', E); R.better='check'; }
      else R.why=L('Ставка со средней рукой (≈{0}%) защищает банк от дро — допустимо.', E);
    }
  }
  return R;
}

const ACT_NAMES = {fold:'Пас', check:'Чек', call:'Колл', bet:'Бет', raise:'Рейз'};
const STREET_SHORT = ['Префлоп','Флоп','Тёрн','Ривер'];
const REVIEW_CACHE = new Map();
function reviewOf(rec){
  const key=rec.no+'|'+rec.at;
  if(REVIEW_CACHE.has(key)) return REVIEW_CACHE.get(key);
  let res=null;
  if(rec.mine && rec.seats.some(s=>s.u===myUid)){
    const hand=rec.mine.map(keyCard), pos=posOf(rec, myUid);
    const ds=decisionsOf(rec, myUid).map(d=>({...d, ...judge(d, hand, pos)}));
    const score = ds.length ? ds.reduce((a,d)=>a+(d.verdict==='good'?1:d.verdict==='ok'?.5:0),0)/ds.length : 1;
    res={rec, hand, pos, ds, score, net:(rec.delta||{})[myUid]||0, made: (rec.board||[]).length>=3 ? best(hand.concat(rec.board.map(keyCard))) : null};
  }
  REVIEW_CACHE.set(key, res);
  return res;
}

/* ---------- glossary ---------- */
const TERMS = [
  {k:['vpip'], n:'VPIP', d:'Доля раздач, в которых игрок добровольно вложил фишки до флопа. 15–25% — тайтово, 35%+ — очень широко.'},
  {k:['pfr'], n:'PFR', d:'Доля раздач, в которых игрок повышал до флопа. Если VPIP намного больше PFR, игрок пассивен: часто уравнивает и редко повышает.'},
  {k:['аут','outs','out','аутів','auts'], n:'Ауты', d:'Карты, которые улучшат вашу руку до вероятно лучшей. Правило 2 и 4: ауты × 4 — шанс к риверу с флопа, ауты × 2 — шанс на следующей карте.'},
  {k:['шансы банка','шанси банку','pot odds','шанс банка','цена колла'], n:'Шансы банка', d:'Сравнение цены колла с размером банка. Нужный шанс на победу = колл ÷ (банк + колл).'},
  {k:['c-bet','кбет','си-бет','конти','продолж','cbet'], n:'Продолженная ставка (c-bet)', d:'Ставка на флопе от игрока, который последним повышал до флопа. Против одного соперника часто выигрывает банк сразу.'},
  {k:['натс','nuts','натси'], n:'Натсы', d:'Лучшая возможная комбинация при текущих общих картах.'},
  {k:['блеф','bluff','блеф'], n:'Блеф', d:'Ставка со слабой рукой, чтобы соперник сбросил лучшую. Работает против одного-двух соперников и когда история ваших ставок похожа на сильную руку.'},
  {k:['полублеф','semi-bluff','semibluff','напівблеф'], n:'Полублеф', d:'Ставка с дро: можно выиграть сразу, если соперник сбросит, или собрать руку позже.'},
  {k:['вэлью','value','валью','велью'], n:'Вэлью-ставка', d:'Ставка с сильной рукой, чтобы худшие руки заплатили. Обычно ½–¾ банка.'},
  {k:['позици','position','позиці'], n:'Позиция', d:'Ваше место относительно дилера. Чем позже вы ходите, тем больше знаете о решениях соперников и тем больше рук можно играть.'},
  {k:['баттон','button','дилер','batton'], n:'Баттон', d:'Место дилера. После флопа баттон ходит последним — это лучшая позиция за столом.'},
  {k:['блайнд','blind'], n:'Блайнды', d:'Обязательные ставки до раздачи: малый и большой блайнд. Они создают банк, за который стоит бороться.'},
  {k:['олл-ин','all-in','allin','олл ин','олін'], n:'Олл-ин', d:'Ставка всех оставшихся фишек. Если у соперников больше фишек, лишнее идёт в побочный банк.'},
  {k:['сет','set','трипс','trips'], n:'Сет', d:'Тройка, собранная с карманной парой. Сет хорошо спрятан и часто выигрывает большой банк.'},
  {k:['дро','draw','дроу'], n:'Дро', d:'Незаконченная комбинация: например, четыре карты к флешу или стриту.'},
  {k:['тильт','tilt'], n:'Тильт', d:'Игра на эмоциях после проигрышей. Лучшее лекарство — перерыв.'},
  {k:['банкролл','bankroll'], n:'Банкролл', d:'Деньги, отведённые на игру. Держите минимум 20 бай-инов для своих ставок.'},
  {k:['импл','implied','неявн'], n:'Неявные шансы', d:'Фишки, которые вы рассчитываете выиграть на следующих улицах, если соберёте руку. Из-за них колл с дро или с маленькой парой ради сета бывает выгоден, даже если прямые шансы банка не сходятся.'},
  {k:['3-бет','3бет','3-bet','3bet','три-бет','ребай'], n:'3-бет', d:'Повторный рейз до флопа (первый рейз — «2-бет»). Делают с самыми сильными руками и иногда как блеф.'},
  {k:['лимп','limp'], n:'Лимп', d:'Вход в банк коллом большого блайнда без рейза. Обычно хуже, чем рейз или пас.'},
  {k:['чек-рейз','check-raise','чекрейз'], n:'Чек-рейз', d:'Сначала чек, а после ставки соперника — рейз. Сильный приём с очень сильными руками и дро.'},
  {k:['кикер','kicker'], n:'Кикер', d:'Старшая карта, которая не входит в комбинацию, но решает при равных комбинациях: у AK и AQ на тузовом столе пара тузов, но кикер K сильнее.'},
  {k:['spr'], n:'SPR', d:'Отношение стека к банку на флопе. При маленьком SPR (до 3) с топ-парой можно идти олл-ин, при большом — осторожнее.'},
  {k:['эквити','equity','еквіті'], n:'Эквити', d:'Ваша доля банка, если доиграть до конца: шанс на победу с учётом ничьих.'},
];

/* ---------- chat ---------- */
const COACH = {i:-1, msgs:[], focus:null, open:false};
// keyword stems per intent; matched against the lower-cased question, any language
const INTENTS = [
  ['mistakes', ['ошиб','ошибк','помил','mistake','wrong','error','fehler','erreur','faute','greș','gres','қате','שגי','შეცდ']], // i18n-skip
  ['better',   ['надо было','нужно было','лучше','как сыграть','как надо','як треба','краще','should','better','instead','besser','hätte','mieux','aurais','mai bine','trebuia','жақсы','керек','עדיף','צריך','უკეთ']], // i18n-skip
  ['odds',     ['шанс','процент','эквити','вероятн','odds','chance','equity','percent','prozent','wahrschein','cote','pourcent','șans','sans','procent','мүмкін','пайыз','סיכוי','შანს']], // i18n-skip
  ['outs',     ['аут','outs','дро','draw','auts']], // i18n-skip
  ['opp',      ['соперник','противник','у него','у нее','у неё','суперник','opponent','villain','gegner','adversaire','adversar','қарсылас','יריב','მოწინააღ']], // i18n-skip
  ['lesson',   ['урок','повтор','учить','почитать','lesson','learn','study','lektion','leçon','lecon','lecți','lecti','сабақ','שיעור','გაკვეთ']], // i18n-skip
  ['style',    ['стиль','как я играю','в целом','общ','статист','style','overall','in general','how do i play','spielstil','allgemein','en général','general','жалпы','סגנון','სტილ']], // i18n-skip
  ['why',      ['почему','зачем','чому','навіщо','why','warum','pourquoi','de ce','неге','למה','რატომ']], // i18n-skip
  ['next',     ['следующ','дальше','наступн','next','nächste','suivant','următoar','келесі','הבא','შემდეგ']], // i18n-skip
  ['prev',     ['предыдущ','прошл','назад','попередн','previous','prev','vorherige','précédent','anterioar','алдыңғы','הקודם','წინა']], // i18n-skip
  ['hello',    ['привет','здравств','привіт','hello','hi ','hey','hallo','salut','bonjour','бонжур','сәлем','שלום','გამარჯ']], // i18n-skip
  ['thanks',   ['спасибо','благодар','дякую','thank','danke','merci','mulțum','multum','рахмет','תודה','მადლობ']], // i18n-skip
];
const STREET_WORDS = [
  ['префлоп','preflop','pre-flop','prefl','préflop','префлопі'], // i18n-skip
  ['флоп','flop','флопі','ფლოპ','פלופ'], // i18n-skip
  ['тёрн','терн','turn','тьорн','терні','ტერნ','טרן'], // i18n-skip
  ['ривер','river','рівер','рівері','რივერ','ריבר'], // i18n-skip
];

function coachHands(){ return HIST.map((r,i)=>[r,i]).filter(([r])=>r.mine && r.seats.some(s=>s.u===myUid)); }
function openCoach(i){
  const list=coachHands();
  if(i==null || !HIST[i] || !HIST[i].mine) i = list.length ? list[list.length-1][1] : -1;
  COACH.i=i; COACH.msgs=[]; COACH.focus=null; COACH.open=true;
  $('coachOv').hidden=false;
  if(i<0) coachSay([L('Здесь появятся ваши сыгранные раздачи. Сыграйте пару раздач — с ботами, с тренером или с друзьями, — и я разберу ваши решения.'), L('А пока можно спросить меня о терминах: например, «что такое ауты» или «что такое VPIP».')]);
  else coachIntro();
  renderCoach();
  setTimeout(()=>{ try{ $('coachIn').focus({preventScroll:true}); }catch(e){} }, 50);
}
function closeCoach(){ COACH.open=false; $('coachOv').hidden=true; }
function coachSay(parts, extra){ COACH.msgs.push({from:'coach', parts:[].concat(parts), ...(extra||{})}); }
function coachIntro(){
  const R=reviewOf(HIST[COACH.i]); if(!R) return;
  const bad=R.ds.filter(d=>d.verdict==='bad').length, ok=R.ds.filter(d=>d.verdict==='ok').length;
  const head = !R.ds.length ? L('В этой раздаче вы не принимали решений — карты сбросились за вас или раздача закончилась раньше.')
    : bad ? L('Разберём раздачу №{0}. Решений: {1}, ошибок: {2}, спорных: {3}.', R.rec.no, R.ds.length, bad, ok)
    : ok ? L('Разберём раздачу №{0}. Решений: {1}, грубых ошибок нет, спорных: {2}.', R.rec.no, R.ds.length, ok)
    : L('Разберём раздачу №{0}. Все {1} решений хорошие — так держать!', R.rec.no, R.ds.length);
  coachSay([head], {steps:true});
}
function describeDecision(R, d, k){
  const head=L('{0}: вы — {1}', STREET_SHORT[d.street], ACT_NAMES[d.a]);
  const parts=[head, d.why];
  if(d.better && d.verdict!=='good') parts.push(L('Лучше: {0}.', ACT_NAMES[d.better]));
  return parts;
}
function coachAnswer(intent, arg){
  const R = COACH.i>=0 ? reviewOf(HIST[COACH.i]) : null;
  const need = () => { if(!R){ coachSay(L('Сначала выберите раздачу — или сыграйте хотя бы одну.')); return false; } if(!R.ds.length){ coachSay(L('В этой раздаче вы не принимали решений.')); return false; } return true; };
  if(intent==='term'){ const T=TERMS[arg]; coachSay([L('{0} — {1}', T.n, T.d)]); return; }
  if(intent==='hello'){ coachSay(L('Привет! Спросите, где вы ошиблись, какие были шансы или что значит любой термин.')); return; }
  if(intent==='thanks'){ coachSay(L('Пожалуйста! Хорошей игры.')); return; }
  if(intent==='next' || intent==='prev'){
    const list=coachHands(), pos=list.findIndex(([,i])=>i===COACH.i), np=pos+(intent==='next'?1:-1);
    if(np<0 || np>=list.length){ coachSay(L(intent==='next'?'Это последняя сыгранная раздача.':'Это самая ранняя раздача из сохранённых.')); return; }
    COACH.i=list[np][1]; COACH.focus=null; coachIntro(); return;
  }
  if(intent==='style'){ coachStyle(); return; }
  if(intent==='street'){
    if(!need()) return;
    const ds=R.ds.filter(d=>d.street===arg);
    if(!ds.length){ coachSay(L('На улице «{0}» вы не принимали решений.', STREET_SHORT[arg])); return; }
    ds.forEach(d=>{ COACH.focus=R.ds.indexOf(d); coachSay(describeDecision(R, d), {verdict:d.verdict}); });
    const d=ds[ds.length-1];
    if(d.street>0 && d.outs) coachSay(L('На этой улице у вас было {0} аутов для сильной руки.', d.outs));
    return;
  }
  if(intent==='step'){ if(!need()) return; const d=R.ds[arg]; COACH.focus=arg; coachSay(describeDecision(R, d), {verdict:d.verdict}); coachExplainNumbers(d); return; }
  if(intent==='mistakes'){
    if(!need()) return;
    const bad=R.ds.map((d,k)=>[d,k]).filter(([d])=>d.verdict!=='good');
    if(!bad.length){ coachSay(L('Ошибок не вижу: все решения в этой раздаче разумные.')); return; }
    bad.forEach(([d,k])=>{ COACH.focus=k; coachSay(describeDecision(R, d), {verdict:d.verdict}); });
    return;
  }
  if(intent==='why'){
    if(!need()) return;
    const k = COACH.focus!=null ? COACH.focus : R.ds.findIndex(d=>d.verdict==='bad');
    const d = R.ds[k>=0?k:0]; COACH.focus=R.ds.indexOf(d);
    coachSay(describeDecision(R, d), {verdict:d.verdict}); coachExplainNumbers(d, true); return;
  }
  if(intent==='better'){
    if(!need()) return;
    const parts=R.ds.map(d=> d.verdict==='good' ? L('{0}: {1} — верно', STREET_SHORT[d.street], ACT_NAMES[d.a]) : L('{0}: вместо «{1}» — {2}', STREET_SHORT[d.street], ACT_NAMES[d.a], ACT_NAMES[d.better||d.a]));
    coachSay([L('Как я сыграл бы эту раздачу:'), ...parts]); return;
  }
  if(intent==='odds'){
    if(!need()) return;
    const parts=R.ds.map(d=> d.street===0 ? L('{0}: рука из топ {1}% стартовых рук', STREET_SHORT[0], Math.max(1,Math.round((d.pc!=null?d.pc:pctOf(R.hand[0],R.hand[1]))*100)))
      : d.need ? L('{0}: шансы ≈{1}%, для колла нужно {2}%', STREET_SHORT[d.street], d.eq, d.need) : L('{0}: шансы ≈{1}%', STREET_SHORT[d.street], d.eq));
    coachSay([L('Шансы по ходу раздачи (против типичных рук соперников):'), ...parts]); return;
  }
  if(intent==='outs'){
    if(!R){ coachAnswer('term', TERMS.findIndex(x=>x.n==='Ауты')); return; }
    const b=(R.rec.board||[]).map(keyCard), parts=[];
    [[3,'Флоп'],[4,'Тёрн']].forEach(([n,name])=>{ if(b.length>=n){ const o=outsOf(R.hand, b.slice(0,n)); parts.push(o.length ? L('{0}: {1} аутов — {2}', name, o.length, fmtCards(o)) : L('{0}: аутов для сильной руки не было', name)); } });
    coachSay(parts.length ? [L('Ауты к стриту, флешу или сету и сильнее:'), ...parts] : L('В этой раздаче до флопа дело не дошло, так что аутов не считали.')); return;
  }
  if(intent==='opp'){
    if(!R){ coachSay(L('Сначала выберите раздачу — или сыграйте хотя бы одну.')); return; }
    const shown=Object.entries(R.rec.shown||{}).filter(([u])=>u!==myUid);
    const parts=shown.map(([u,sh])=>L('{0} показал(а): {1} — {2}', nameOf(R.rec,u), sh.c.map(k=>fmtCard(keyCard(k))).join(' '), sh.hn));
    const aggr=R.rec.ev.filter(e=>e.u && e.u!==myUid && (e.a==='raise'||e.a==='bet'));
    if(!parts.length) parts.push(aggr.length ? L('Карты соперников не открылись. Они ставили или повышали {0} раз(а) — обычно так играют пару повыше или сильные дро.', aggr.length) : L('Карты соперников не открылись, и они почти не ставили — скорее всего, у них были слабые или средние руки.'));
    coachSay(parts); return;
  }
  if(intent==='lesson'){
    const topics={};
    (R ? R.ds : []).filter(d=>d.verdict!=='good' && d.topic!=null).forEach(d=>topics[d.topic]=(topics[d.topic]||0)+1);
    let li=Object.entries(topics).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(li==null){ const prog=loadProgress(); li=LESSONS.findIndex(l=>(prog['l'+l.id]||0)<4); if(li<0) li=LESSONS.length-1; }
    coachSay([L('Советую урок «{0}».', t('c'+LESSONS[li].id+'.title'))], {lesson:+li}); return;
  }
  coachSay([L('Я не понял вопрос. Попробуйте одну из подсказок ниже или спросите о термине, например «что такое ауты».')]);
}
function coachExplainNumbers(d, deep){
  if(d.street===0){
    if(deep) coachSay(L('До флопа я сравниваю силу руки с позицией: с ранних мест играют только лучшие руки, с баттона — почти вдвое больше. Против рейза диапазон сужают.'));
    return;
  }
  if(d.need) coachSay(L('Считаем: колл {0} ÷ (банк {1} + колл {0}) = {2}%. Ваши шансы ≈{3}% против типичных рук, которыми соперник так ставит.', d.toCall, d.pot, d.need, d.eq));
  else if(d.eq!=null && deep) coachSay(L('Ваши шансы ≈{0}% против типичных рук соперников, которые остались в раздаче ({1}).', d.eq, d.opps));
  if(d.outs && d.street<3) coachSay(L('Аутов: {0}. По правилу 2 и 4 это ≈{1}% на следующей карте.', d.outs, d.outs*2));
}
function coachStyle(){
  const list=coachHands().map(([r])=>reviewOf(r)).filter(Boolean);
  if(list.length<3){ coachSay(L('Чтобы оценить ваш стиль, нужно хотя бы 3 сыгранные раздачи. Пока их {0}.', list.length)); return; }
  let vp=0, pf=0, dec=0, good=0, bad=0, net=0;
  list.forEach(R=>{
    const pre=R.ds.filter(d=>d.street===0);
    if(pre.some(d=>d.a==='call'||d.a==='raise'||d.a==='bet')) vp++;
    if(pre.some(d=>d.a==='raise'||d.a==='bet')) pf++;
    R.ds.forEach(d=>{ dec++; if(d.verdict==='good') good++; if(d.verdict==='bad') bad++; });
    net+=R.net;
  });
  const V=Math.round(vp/list.length*100), P=Math.round(pf/list.length*100), acc=dec?Math.round(good/dec*100):100;
  const st = V>=35 ? (P>=V*.5 ? STYLES[2] : STYLES[1]) : (P>=V*.5 ? STYLES[0] : STYLES[3]);
  const tip = V>=35 ? L('Вы играете много рук. Попробуйте сбрасывать слабые руки до флопа, особенно с ранних позиций.')
    : V<12 ? L('Вы играете очень мало рук. С поздних позиций можно смелее входить рейзом.')
    : P<V*.5 ? L('Вы часто уравниваете и редко повышаете. Входите в банк рейзом — так вы чаще забираете его без борьбы.')
    : L('Хороший баланс: вы выбираете руки и играете их агрессивно.');
  coachSay([L('За последние {0} раздач: VPIP {1}%, PFR {2}%. Это похоже на стиль «{3}».', list.length, V, P, st.n), L('Хороших решений: {0}%, ошибок: {1}. Итог: {2}.', acc, bad, (net>0?'+':'')+net), tip]);
}
function coachAsk(text){
  const q=' '+String(text||'').toLowerCase().replace(/ё/g,'е')+' ';
  if(!q.trim()) return;
  COACH.msgs.push({from:'me', text:String(text).slice(0,300)});
  const norm = s => String(s).toLowerCase().replace(/ё/g,'е');
  // a glossary term: «что такое …», or just the term
  const termIdx = TERMS.findIndex(T=>T.k.some(k=>q.includes(norm(k))) || q.includes(norm(t(T.n))));
  const asksDef = /что так|що так|what is|what's|was ist|qu.est-ce|ce (e|înseamn)|деген не|מה זה|რა არის|означа|значит|mean/.test(q); // i18n-skip
  const intents=INTENTS.filter(([,ws])=>ws.some(w=>q.includes(w))).map(([n])=>n);
  const streetIdx=STREET_WORDS.findIndex(ws=>ws.some(w=>q.includes(w)) || q.includes(norm(t(STREET_SHORT[STREET_WORDS.indexOf(ws)]))));
  if(termIdx>=0 && (asksDef || !intents.length && streetIdx<0)) coachAnswer('term', termIdx);
  else if(streetIdx>=0 && !intents.includes('outs') && !intents.includes('opp')) coachAnswer('street', streetIdx);
  else if(intents.length) coachAnswer(intents.includes('mistakes')?'mistakes':intents[0]);
  else if(termIdx>=0) coachAnswer('term', termIdx);
  else coachAnswer('?');
  renderCoach();
}
const COACH_CHIPS = [['mistakes','Где я ошибся?'],['better','Как надо было сыграть?'],['odds','Какие были шансы?'],['outs','Сколько было аутов?'],['opp','Что было у соперников?'],['lesson','Какой урок повторить?'],['style','Как я играю в целом?'],['prev','← Предыдущая раздача'],['next','Следующая раздача →']];

function renderCoach(){
  if(!COACH.open) return;
  const R = COACH.i>=0 ? reviewOf(HIST[COACH.i]) : null;
  const list=coachHands();
  $('coachSel').innerHTML = list.length ? list.slice().reverse().map(([r,i])=>{ const d=(r.delta||{})[myUid]||0; return `<option value="${i}"${i===COACH.i?' selected':''}>${esc(t('Раздача №{0}', r.no))} · ${esc((r.mine||[]).map(k=>fmtCard(keyCard(k))).join(' '))} · ${d>0?'+':''}${d}</option>`; }).join('') : `<option>${esc(t('Нет сыгранных раздач'))}</option>`;
  $('coachSel').disabled=!list.length;
  if(R){
    const board=(R.rec.board||[]).map(keyCard);
    $('coachHand').innerHTML=`<div class="sblock"><span class="slabel">${t('Ваши карты')}</span><div class="srow">${R.hand.map(c=>cardHTML(c)).join('')}</div></div>
      <div class="sblock"><span class="slabel">${t('Стол')}</span><div class="srow">${[0,1,2,3,4].map(j=>board[j]?cardHTML(board[j]):'<div class="slot"></div>').join('')}</div></div>
      <div class="sblock chmeta"><span class="slabel">${t('Позиция')}</span><b>${esc(t(POS_NAMES[R.pos]))}</b><span class="slabel">${t('Итог')}</span><b class="${R.net>0?'win':R.net<0?'loss':''}">${R.net>0?'+':''}${esc(fmtWin(R.net, R.rec.bb))}</b>${R.made?`<span class="muted">${esc(t(HAND_NAMES[R.made.cat]))}</span>`:''}</div>
      ${R.ds.length?`<div class="sblock chscore"><span class="slabel">${t('Точность')}</span><div class="meter" role="img" aria-label="${Math.round(R.score*100)}%"><i style="width:${Math.round(R.score*100)}%"></i></div><b>${Math.round(R.score*100)}%</b></div>`:''}`;
    $('coachHand').hidden=false;
  } else $('coachHand').hidden=true;
  $('coachLog').innerHTML = COACH.msgs.map((m,k)=>{
    if(m.from==='me') return `<div class="cm me"><p>${esc(m.text)}</p></div>`;
    let html=m.parts.filter(Boolean).map(p=>`<p>${esc(tr(p))}</p>`).join('');
    if(m.steps && R) html+=`<ol class="steps">${R.ds.map((d,j)=>`<li><button type="button" class="step v-${d.verdict}" data-step="${j}"><i aria-hidden="true">${VERDICT_ICON[d.verdict]}</i><span><b>${esc(t(STREET_SHORT[d.street]))}: ${esc(t(ACT_NAMES[d.a]))}${d.a==='raise'||d.a==='bet'?' '+esc(String(d.to)):d.a==='call'?' '+esc(String(d.paid)):''}</b> ${esc(tr(d.why))}</span></button></li>`).join('')}</ol>`;
    if(m.lesson!=null) html+=`<button type="button" class="btn small primary" data-golesson="${m.lesson}">${t('Открыть урок')}</button>`;
    return `<div class="cm coach${m.verdict?' v-'+m.verdict:''}"><span class="cav" aria-hidden="true">🎓</span><div>${html}</div></div>`;
  }).join('');
  $('coachChips').innerHTML = COACH_CHIPS.map(([id,label])=>`<button type="button" class="qchip" data-intent="${id}">${esc(t(label))}</button>`).join('');
  const log=$('coachLog'); log.scrollTop=log.scrollHeight;
}
$('coachChips').onclick=e=>{ const b=e.target.closest('[data-intent]'); if(!b) return; COACH.msgs.push({from:'me', text:b.textContent}); coachAnswer(b.dataset.intent); renderCoach(); };
$('coachLog').onclick=e=>{
  const s=e.target.closest('[data-step]'); if(s){ COACH.msgs.push({from:'me', text:t('Подробнее: {0}', s.querySelector('b').textContent)}); coachAnswer('step', +s.dataset.step); renderCoach(); return; }
  const l=e.target.closest('[data-golesson]'); if(l){ closeCoach(); openLearn(+l.dataset.golesson); }
};
$('coachForm').onsubmit=e=>{ e.preventDefault(); const v=$('coachIn').value.trim(); if(!v) return; $('coachIn').value=''; coachAsk(v); };
$('coachSel').onchange=()=>{ COACH.i=+$('coachSel').value; COACH.focus=null; coachIntro(); renderCoach(); };
$('coachClose').onclick=closeCoach;
$('coachOv').addEventListener('click', e=>{ if(e.target.id==='coachOv') closeCoach(); });
